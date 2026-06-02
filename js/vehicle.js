"use strict";
/* =====================================================================
   VERDANT — drivable vehicle (low-poly buggy)
   Invisible collision box mover + parented visuals (chassis, cabin,
   four wheels, headlights). Enter/exit on foot with E; arcade driving
   with WASD; runs over enemies at speed.
   ===================================================================== */
function vbox(scene,name,w,h,d,parent,x,y,z,mat){
  const b=BABYLON.MeshBuilder.CreateBox(name,{width:w,height:h,depth:d},scene);
  b.position.set(x,y,z); b.parent=parent; b.material=mat; b.isPickable=false; return b;
}
function buildVehicle(scene,x,z){
  const body=BABYLON.MeshBuilder.CreateBox('vehBody',{width:1.9,height:1.1,depth:3.4},scene);
  body.position.set(x, terrainHeight(x,z)+0.7, z);
  body.checkCollisions=true; body.ellipsoid=new BABYLON.Vector3(1.05,0.6,1.8);
  body.isVisible=false;

  const root=new BABYLON.TransformNode('vehVis',scene); root.parent=body;
  const paint=lowPolyMat(scene,'vehPaint',0.82,0.45,0.10,[0.12,0.06,0.0]);
  const dark =lowPolyMat(scene,'vehDark',0.08,0.08,0.10);
  const glass=lowPolyMat(scene,'vehGlass',0.3,0.45,0.5,[0.04,0.06,0.07]);
  const light=lowPolyMat(scene,'vehLamp',1.0,0.95,0.7,[0.6,0.55,0.3]);

  vbox(scene,'chassis',1.7,0.5,3.0,root,0,0,0,paint);
  vbox(scene,'cabin',1.5,0.6,1.5,root,0,0.5,-0.2,paint);
  vbox(scene,'windshield',1.42,0.5,0.1,root,0,0.55,0.55,glass);
  vbox(scene,'rollbar',1.5,0.1,0.1,root,0,0.95,-0.4,dark);
  vbox(scene,'bumperF',1.7,0.25,0.2,root,0,-0.1,1.55,dark);
  vbox(scene,'bumperR',1.7,0.25,0.2,root,0,-0.1,-1.55,dark);
  vbox(scene,'lampL',0.3,0.2,0.1,root,-0.55,0.05,1.6,light);
  vbox(scene,'lampR',0.3,0.2,0.1,root, 0.55,0.05,1.6,light);

  const wheels=[], front=[];
  const wmat=lowPolyMat(scene,'vehWheel',0.05,0.05,0.06);
  [[-1,1],[1,1],[-1,-1],[1,-1]].forEach(([sx,sz],i)=>{
    const hub=new BABYLON.TransformNode('wheelHub',scene); hub.parent=root;
    hub.position.set(sx*0.95, -0.35, sz*1.1);
    const w=BABYLON.MeshBuilder.CreateCylinder('wheel',{height:0.3,diameter:0.7,tessellation:8},scene);
    w.rotation.z=Math.PI/2; w.parent=hub; w.material=wmat; w.isPickable=false;
    wheels.push(w); if(sz>0) front.push(hub);
  });
  if(Game.shadowGen) root.getChildMeshes().forEach(m=>Game.shadowGen.addShadowCaster(m));

  return { body, root, wheels, front, speed:0 };
}

function enterVehicle(){
  if(!Game.vehicle || Game.inVehicle) return;
  Game.inVehicle=true;
  Game.vehYaw = Game.vehicle.body.rotation.y || Game.yaw;
  Game.playerRig.root.setEnabled(false);
  toast('ENTERED VEHICLE');
}
function exitVehicle(){
  if(!Game.inVehicle) return;
  Game.inVehicle=false;
  const v=Game.vehicle, b=v.body; v.speed=0;
  const side=new BABYLON.Vector3(Math.cos(Game.vehYaw),0,-Math.sin(Game.vehYaw));
  const ex=b.position.x+side.x*2.2, ez=b.position.z+side.z*2.2;
  Game.player.position.set(ex, terrainHeight(ex,ez)+1.0, ez);
  Game.yaw=Game.vehYaw; Game.grounded=true; Game.vy=0;
  Game.playerRig.root.setEnabled(true);
  toast('EXITED VEHICLE');
}

function updateVehicle(dt){
  const v=Game.vehicle, b=v.body, k=Game.keys;
  const accel=20, maxF=24, maxR=9;
  if(k['w'])      v.speed+=accel*dt;
  else if(k['s']) v.speed-=accel*dt;
  else { v.speed*=(1-2.0*dt); if(Math.abs(v.speed)<0.2) v.speed=0; }
  v.speed=clamp(v.speed,-maxR,maxF);

  // steering (inverted when reversing, like a real car)
  if(Math.abs(v.speed)>0.4){
    const rev=v.speed<0?-1:1, steer=1.7*dt*rev;
    if(k['a']) Game.vehYaw-=steer;
    if(k['d']) Game.vehYaw+=steer;
  }
  const fwd=new BABYLON.Vector3(Math.sin(Game.vehYaw),0,Math.cos(Game.vehYaw));
  b.moveWithCollisions(fwd.scale(v.speed*dt));
  b.position.y=terrainHeight(b.position.x,b.position.z)+0.7;
  b.rotation.y=Game.vehYaw;

  // wheels: spin + steer the front pair
  v.wheels.forEach(w=>{ w.rotation.x+=v.speed*dt*1.3; });
  const sa=(k['a']?-0.4:k['d']?0.4:0);
  v.front.forEach(h=>{ h.rotation.y=sa; });

  // keep the player (and minimap/net position) on the vehicle
  Game.player.position.set(b.position.x, b.position.y+0.3, b.position.z);

  // run over enemies at speed
  if(Math.abs(v.speed)>6){
    for(const e of [...Game.enemies]){
      if(BABYLON.Vector3.Distance(e.body.position,b.position)<2.5){
        e.hp-=45; flashEnemyHit(e); addShake(0.22);
        if(e.hp<=0) killEnemy(e); else updateHealthBar(e.hb,e.hp/e.maxHp);
      }
    }
  }
}

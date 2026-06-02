"use strict";
/* =====================================================================
   VERDANT — NPC pedestrians (civilians)
   Wander to random points, idle, and flee (run) from nearby enemies or
   from recent gunfire (Game.alarm). They don't fight — just add life.
   ===================================================================== */
function npcTarget(){ return { x:rand(-82,82), z:rand(-82,82) }; }

function buildNPC(scene){
  const x=rand(-75,75), z=rand(-75,75);
  const body=BABYLON.MeshBuilder.CreateCapsule('npc',{height:1.8,radius:0.4},scene);
  body.position.set(x,terrainHeight(x,z)+0.95,z);
  body.checkCollisions=true; body.ellipsoid=new BABYLON.Vector3(0.5,0.9,0.5);
  body.isVisible=false;

  const shirts=[[0.3,0.4,0.7],[0.7,0.7,0.72],[0.2,0.55,0.4],[0.7,0.55,0.2],[0.55,0.3,0.5]];
  const sh=shirts[Math.floor(Math.random()*shirts.length)];
  const rig=buildHumanoid(scene,{ skin:[0.85,0.68,0.55], shirt:sh, pants:[0.18,0.18,0.2], em:[0,0,0] });
  rig.root.parent=body; rig.root.position.y=-0.95;
  if(Game.shadowGen) rig.root.getChildMeshes().forEach(m=>Game.shadowGen.addShadowCaster(m));

  const n={ body, rig, target:npcTarget(), speed:rand(1.6,2.6), idle:rand(0,2) };
  Game.npcs.push(n);
  return n;
}
function spawnNPCs(scene,count){ for(let i=0;i<count;i++) buildNPC(scene); }

function updateNPCs(dt){
  const p=Game.player;
  for(const n of Game.npcs){
    let nearestE=Infinity, ex=0, ez=0;
    for(const e of Game.enemies){
      const d=BABYLON.Vector3.Distance(e.body.position,n.body.position);
      if(d<nearestE){ nearestE=d; ex=e.body.position.x; ez=e.body.position.z; }
    }
    const flee = nearestE<16 || Game.alarm>0;
    let moving=true, run=false;

    if(flee){
      run=true;
      // run from the nearest enemy, or from the player's gunfire if no enemy near
      let thx=ex, thz=ez;
      if(nearestE>=16){ thx=p.position.x; thz=p.position.z; }
      let dx=n.body.position.x-thx, dz=n.body.position.z-thz;
      const d=Math.hypot(dx,dz)||1; dx/=d; dz/=d;
      n.body.moveWithCollisions(new BABYLON.Vector3(dx*n.speed*1.9*dt,0,dz*n.speed*1.9*dt));
      n.body.rotation.y=Math.atan2(dx,dz);
    } else {
      let dx=n.target.x-n.body.position.x, dz=n.target.z-n.body.position.z;
      const d=Math.hypot(dx,dz);
      if(d<2){ n.idle-=dt; moving=false; if(n.idle<=0){ n.target=npcTarget(); n.idle=rand(1,3); } }
      else {
        dx/=d; dz/=d;
        n.body.moveWithCollisions(new BABYLON.Vector3(dx*n.speed*dt,0,dz*n.speed*dt));
        n.body.rotation.y=Math.atan2(dx,dz);
      }
    }
    n.body.position.y=terrainHeight(n.body.position.x,n.body.position.z)+0.95;
    animateHumanoid(n.rig,dt,{ moving, run, speed:n.speed, aiming:false, attack:null });
  }
}

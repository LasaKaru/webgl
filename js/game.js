"use strict";
/* =====================================================================
   VERDANT — main loop: camera, movement, driving, AI, waves, pickups, fx
   ===================================================================== */
function gameOver(){
  document.exitPointerLock && document.exitPointerLock();
  $('finalScore').textContent=Game.score;
  $('finalWave').textContent='REACHED WAVE '+Game.wave;
  setState('over');
}
function resetGame(){
  Game.enemies.forEach(e=>{ e.body.dispose(false,true); });
  Game.items.forEach(it=>it.mesh.dispose());
  Game.eBullets.forEach(b=>b.mesh.dispose());
  Game.corpses.forEach(c=>c.root.dispose());
  Game.grenades.forEach(g=>g.mesh.dispose());
  Game.fx.forEach(f=>f.mesh.dispose());
  Game.npcs.forEach(n=>n.body.dispose(false,true));
  if(Game.vehicle) Game.vehicle.body.dispose(false,true);
  Game.enemies=[]; Game.items=[]; Game.eBullets=[]; Game.corpses=[]; Game.grenades=[]; Game.fx=[]; Game.npcs=[];
  Game.vehicle=null; Game.inVehicle=false; Game.alarm=0; Game.timeOfDay=0.35;
  Game.score=0; Game.wave=0; Game.waveActive=false; Game.nearItem=null;
  if(Game.playerRig) Game.playerRig.root.setEnabled(true);
  Game.player.position.set(0,terrainHeight(0,0)+1.0,0); Game.vy=0;
  Game.weapons=defaultWeapons(); Game.currentWeapon=0; Game.grenadeCount=3;
  Game.playerData={hp:100,stamina:100};
  equipWeaponModel();
  initInventory(); renderInventory(); refreshHP(); refreshSP(); refreshAmmoHUD(); refreshGrenades(); updateHUD();
  scatterLoot(Game.scene);
  spawnNPCs(Game.scene,6);
  Game.vehicle=buildVehicle(Game.scene,7,-3); Game.vehYaw=0;
  startWave();
}

function computeShake(dt){
  if(Game.shake.t>0){
    Game.shake.t-=dt;
    const m=Game.shake.mag*Math.max(0,Game.shake.t/0.35);
    if(Game.shake.t<=0) Game.shake.mag=0;
    return { x:rand(-m,m), y:rand(-m,m), z:rand(-m,m) };
  }
  return { x:0,y:0,z:0 };
}

function updateGame(dt,now){
  if(Game.state!=='playing') return;
  const p=Game.player, k=Game.keys;
  const ePressed = (!!k['e']) && !Game._ePrev; Game._ePrev=!!k['e'];
  Game.alarm=Math.max(0,Game.alarm-dt);
  updateDayNight(dt);
  const sh=computeShake(dt);

  /* ---------------- camera + control: driving vs on foot ---------------- */
  if(Game.inVehicle){
    updateVehicle(dt);
    const b=Game.vehicle.body, rad=9, h=4.2;
    Game.camera.position.set(
      b.position.x - Math.sin(Game.vehYaw)*rad + sh.x,
      b.position.y + h + sh.y,
      b.position.z - Math.cos(Game.vehYaw)*rad + sh.z);
    Game.camera.setTarget(new BABYLON.Vector3(
      b.position.x + Math.sin(Game.vehYaw)*3, b.position.y+1, b.position.z + Math.cos(Game.vehYaw)*3));
    Game.camera.fov=Game.settings.fov;
  } else {
    const radius=6, headY=1.5;
    const cosP=Math.cos(Game.pitch), sinP=Math.sin(Game.pitch);
    const tx=p.position.x, ty=p.position.y+headY, tz=p.position.z;
    Game.camera.position.set(
      tx - Math.sin(Game.yaw)*cosP*radius + sh.x,
      ty + sinP*radius + 1.2 + sh.y,
      tz - Math.cos(Game.yaw)*cosP*radius + sh.z);
    Game.camera.setTarget(new BABYLON.Vector3(tx,ty,tz));

    const fwd=new BABYLON.Vector3(Math.sin(Game.yaw),0,Math.cos(Game.yaw));
    const right=new BABYLON.Vector3(Math.cos(Game.yaw),0,-Math.sin(Game.yaw));
    let mx=0,mz=0;
    if(k['w']){mx+=fwd.x;mz+=fwd.z;} if(k['s']){mx-=fwd.x;mz-=fwd.z;}
    if(k['d']){mx+=right.x;mz+=right.z;} if(k['a']){mx-=right.x;mz-=right.z;}
    const len=Math.hypot(mx,mz);
    const sprinting = k['shift'] && Game.playerData.stamina>0 && len>0;
    let speed=6*(sprinting?1.7:1);
    if(len>0){ mx/=len; mz/=len; }
    if(sprinting){ Game.playerData.stamina=Math.max(0,Game.playerData.stamina-28*dt); }
    else { Game.playerData.stamina=Math.min(100,Game.playerData.stamina+18*dt); }
    refreshSP();

    Game.vy-=22*dt;
    if(Game.grounded && k[' ']){ Game.vy=8.5; Game.grounded=false; }
    p.moveWithCollisions(new BABYLON.Vector3(mx*speed*dt, Game.vy*dt, mz*speed*dt));
    const gh=terrainHeight(p.position.x,p.position.z)+1.0;
    if(p.position.y<=gh){ p.position.y=gh; Game.vy=0; Game.grounded=true; }

    const paim = Game.mouseDown || (now-lastShot<180);
    if(len>0 || paim) p.rotation.y=Game.yaw;
    animateHumanoid(Game.playerRig, dt, { moving:len>0, run:sprinting, speed, aiming:paim, attack:null });
    const baseFov=Game.settings.fov, tgtFov=paim?baseFov*0.82:baseFov;
    Game.aimFov = (Game.aimFov==null)?baseFov:(Game.aimFov+(tgtFov-Game.aimFov)*Math.min(1,dt*10));
    Game.camera.fov=Game.aimFov;

    if(Game.mouseDown && Game.weapons[Game.currentWeapon].auto) tryShoot(now);
  }

  /* ---------------- enemies AI + animation ---------------- */
  for(const e of Game.enemies){
    const dx=p.position.x-e.body.position.x, dz=p.position.z-e.body.position.z;
    const d=Math.hypot(dx,dz);
    const nx=d>0.001?dx/d:0, nz=d>0.001?dz/d:0;
    e.body.rotation.y=Math.atan2(nx,nz);
    let moving=false, run=false;
    if(e.ranged){
      let mv=0; if(d>22) mv=1; else if(d<12) mv=-1;
      if(mv!==0){ e.body.moveWithCollisions(new BABYLON.Vector3(nx*e.speed*mv*dt,0,nz*e.speed*mv*dt)); moving=true; }
      e.atkCd-=dt;
      if(e.atkCd<=0 && d<32){ e.atkCd=rand(1.4,2.2); enemyFire(e); }
    } else {
      if(d>1.8){ e.body.moveWithCollisions(new BABYLON.Vector3(nx*e.speed*dt,0,nz*e.speed*dt)); moving=true; run=e.speed>3.1; }
      else { e.atkCd-=dt; if(e.atkCd<=0){ e.atkCd=1.0; e.attackT=0; damagePlayer(8+Game.wave); } }
    }
    let atk=null;
    if(e.attackT!=null){ e.attackT+=dt/0.45; if(e.attackT>=1) e.attackT=null; else atk=e.attackT; }
    e.body.position.y = terrainHeight(e.body.position.x,e.body.position.z)+0.95;
    animateHumanoid(e.rig, dt, { moving, run, speed:e.speed, aiming:e.ranged && d<32, attack:atk });
    updateHealthBar(e.hb, e.hp/e.maxHp);
  }

  /* corpses — ragdoll-ish topple, then clean up */
  for(const c of [...Game.corpses]){
    c.t+=dt;
    c.root.rotation.x=Math.min(Math.PI/2, c.t*5);
    c.root.rotation.z=c.tilt*Math.min(1,c.t*2);
    c.root.position.y-=dt*0.25;
    if(c.t>1.3){ c.root.dispose(); Game.corpses=Game.corpses.filter(x=>x!==c); }
  }

  /* enemy projectiles */
  for(const b of [...Game.eBullets]){
    b.life-=dt;
    b.mesh.position.addInPlace(b.dir.scale(b.speed*dt));
    if(BABYLON.Vector3.Distance(b.mesh.position,new BABYLON.Vector3(p.position.x,p.position.y+0.4,p.position.z))<1.0){
      damagePlayer(b.dmg); b.mesh.dispose(); Game.eBullets=Game.eBullets.filter(x=>x!==b); continue;
    }
    if(b.life<=0){ b.mesh.dispose(); Game.eBullets=Game.eBullets.filter(x=>x!==b); }
  }

  updateGrenades(dt);
  updateFx(dt);
  updateNPCs(dt);

  /* wave spawning */
  if(Game.waveActive){
    if(Game.enemiesToSpawn>0 && Game.enemies.length<8 && Math.random()<0.04){
      spawnEnemy(Game.scene,Game.settings.shadows); Game.enemiesToSpawn--;
    }
    if(Game.enemiesToSpawn<=0 && Game.enemies.length===0){
      Game.waveActive=false; toast('WAVE CLEARED');
      setTimeout(()=>{ if(Game.state==='playing') startWave(); },2500);
    }
  }

  /* spin world loot */
  for(const it of Game.items) it.mesh.rotation.y+=dt*1.6;

  /* ---------------- interaction (vehicle > item) ---------------- */
  let promptTxt=null;
  if(Game.inVehicle){
    promptTxt='Exit vehicle'; if(ePressed) exitVehicle();
  } else {
    let nearest=null, nd=2.6;
    for(const it of Game.items){
      const d=BABYLON.Vector3.Distance(p.position,it.mesh.position);
      if(d<nd){ nd=d; nearest=it; }
    }
    Game.nearItem=nearest;
    const vd = Game.vehicle ? BABYLON.Vector3.Distance(p.position,Game.vehicle.body.position) : 999;
    if(vd<3.2){ promptTxt='Enter vehicle'; if(ePressed) enterVehicle(); }
    else if(nearest){ promptTxt='Pick up '+itemLabel(nearest); if(ePressed) collectItem(nearest); }
  }
  setPrompt(promptTxt);

  $('clock').textContent=clockString();
  updateMinimap();
  updateHUD();
  netSend();
}

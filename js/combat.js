"use strict";
/* =====================================================================
   VERDANT — combat: raycast guns, grenades, explosions, damage, death
   ===================================================================== */
let lastShot=0, reloading=false;

function fireRay(spread){
  const ray=Game.scene.createPickingRay(
    Game.engine.getRenderWidth()/2, Game.engine.getRenderHeight()/2,
    BABYLON.Matrix.Identity(), Game.camera);
  ray.direction.x+=rand(-spread,spread);
  ray.direction.y+=rand(-spread,spread);
  ray.direction.normalize();
  const hit=Game.scene.pickWithRay(ray,m=>m.isPickable!==false && m!==Game.player && !m.name.startsWith('flash'));
  if(hit && hit.pickedMesh){
    const e=hit.pickedMesh._enemy;
    if(e && !e.dead) return e;
  }
  return null;
}

function tryShoot(now){
  const w=Game.weapons[Game.currentWeapon];
  if(reloading) return;
  if(now-lastShot < w.rof) return;
  if(w.ammo<=0){ if(w.reserve>0) reload(); else toast('OUT OF AMMO'); return; }
  lastShot=now; w.ammo--; refreshAmmoHUD(); sfx(w.sfx);

  const fl=Game.player._flash; if(fl){ fl.isVisible=true; setTimeout(()=>fl.isVisible=false,45); }
  if(w.id==='shotgun') addShake(0.18);

  let anyHit=false;
  for(let i=0;i<w.pellets;i++){
    const e=fireRay(w.spread);
    if(e){
      anyHit=true;
      e.hp-=w.dmg; flashEnemyHit(e);
      if(e.hp<=0) killEnemy(e); else updateHealthBar(e.hb, e.hp/e.maxHp);
    }
  }
  if(anyHit){ flashHitmark(); sfx('hit'); }
}

function reload(){
  const w=Game.weapons[Game.currentWeapon];
  if(reloading||w.ammo>=w.maxMag||w.reserve<=0) return;
  reloading=true; toast('RELOADING…'); sfx('reload');
  setTimeout(()=>{
    const need=w.maxMag-w.ammo, take=Math.min(need,w.reserve);
    w.ammo+=take; w.reserve-=take; reloading=false; refreshAmmoHUD();
  }, w.reloadMs);
}

function flashHitmark(){ const h=$('hitmark'); h.style.opacity='1'; setTimeout(()=>h.style.opacity='0',90); }

function damagePlayer(d){
  Game.playerData.hp-=d; refreshHP(); sfx('hurt'); addShake(0.12);
  const f=$('hitflash'); f.style.opacity='1'; setTimeout(()=>f.style.opacity='0',120);
  if(Game.playerData.hp<=0) gameOver();
}

function killEnemy(e){
  Game.score+=100; sfx('kill'); e.dead=true;
  if(Math.random()<0.35){
    const type=Math.random()<0.5?'ammo':'health';
    spawnItem(Game.scene,type,e.body.position.x,e.body.position.z);
  }
  const fy=e.body.rotation.y, fx=e.body.position.x, fz=e.body.position.z;
  e.rig.root.setParent(null);
  e.body.dispose(false,true);
  e.rig.root.rotation.set(0,fy,0);
  e.rig.root.position.set(fx, terrainHeight(fx,fz), fz);
  Game.corpses.push({ root:e.rig.root, t:0 });
  Game.enemies=Game.enemies.filter(x=>x!==e);
  updateHUD();
}

/* ----------------------------- grenades ----------------------------- */
function throwGrenade(){
  if(Game.grenadeCount<=0){ toast('NO GRENADES'); return; }
  Game.grenadeCount--; refreshGrenades(); sfx('throw');
  const p=Game.player;
  const fwd=new BABYLON.Vector3(Math.sin(Game.yaw),0,Math.cos(Game.yaw));
  const b=BABYLON.MeshBuilder.CreateSphere('nade',{diameter:0.3,segments:6},Game.scene);
  b.position.set(p.position.x+fwd.x, p.position.y+1.0, p.position.z+fwd.z);
  b.material=lowPolyMat(Game.scene,'nadem',0.15,0.35,0.15,{emissive:[0.05,0.12,0.05]});
  b.isPickable=false;
  const vel=new BABYLON.Vector3(fwd.x*16, 6.5, fwd.z*16);
  Game.grenades.push({ mesh:b, vel, fuse:1.5 });
}

function explode(x,y,z){
  sfx('explosion'); addShake(0.5);
  // expanding flash sphere
  const fxm=BABYLON.MeshBuilder.CreateSphere('boom',{diameter:1,segments:10},Game.scene);
  fxm.position.set(x,y,z); fxm.isPickable=false;
  const mat=new BABYLON.StandardMaterial('boomm',Game.scene);
  mat.emissiveColor=new BABYLON.Color3(1,0.6,0.15); mat.disableLighting=true; mat.alpha=0.9;
  fxm.material=mat;
  Game.fx.push({ mesh:fxm, mat, t:0, dur:0.45, max:9 });
  // area damage to enemies
  const R=7;
  for(const e of [...Game.enemies]){
    const dd=BABYLON.Vector3.Distance(e.body.position,new BABYLON.Vector3(x,y,z));
    if(dd<R){
      const dmg=Math.round(120*(1-dd/R));
      e.hp-=dmg; flashEnemyHit(e);
      if(e.hp<=0) killEnemy(e); else updateHealthBar(e.hb,e.hp/e.maxHp);
    }
  }
  // self damage if too close
  const pd=BABYLON.Vector3.Distance(Game.player.position,new BABYLON.Vector3(x,y,z));
  if(pd<R*0.7) damagePlayer(Math.round(50*(1-pd/(R*0.7))));
}

function updateGrenades(dt){
  for(const g of [...Game.grenades]){
    g.vel.y-=22*dt;
    g.mesh.position.addInPlace(g.vel.scale(dt));
    g.mesh.rotation.x+=dt*8;
    const gy=terrainHeight(g.mesh.position.x,g.mesh.position.z)+0.15;
    if(g.mesh.position.y<=gy){ g.mesh.position.y=gy; g.vel.y*=-0.4; g.vel.x*=0.6; g.vel.z*=0.6; }
    g.fuse-=dt;
    if(g.fuse<=0){
      explode(g.mesh.position.x,g.mesh.position.y,g.mesh.position.z);
      g.mesh.dispose(); Game.grenades=Game.grenades.filter(x=>x!==g);
    }
  }
}

function updateFx(dt){
  for(const f of [...Game.fx]){
    f.t+=dt;
    const k=f.t/f.dur;
    const s=1+k*f.max;
    f.mesh.scaling.set(s,s,s);
    f.mat.alpha=Math.max(0,0.9*(1-k));
    if(f.t>=f.dur){ f.mesh.dispose(); Game.fx=Game.fx.filter(x=>x!==f); }
  }
}

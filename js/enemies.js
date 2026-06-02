"use strict";
/* =====================================================================
   VERDANT — enemies: humanoid chasers + ranged gunners, waves
   ===================================================================== */
function spawnEnemy(scene,shadows){
  const a=rand(0,Math.PI*2), dist=rand(30,55);
  const px=Game.player.position.x+Math.cos(a)*dist;
  const pz=Game.player.position.z+Math.sin(a)*dist;
  const ranged = Game.wave>=2 && Math.random()<0.35;

  const body=BABYLON.MeshBuilder.CreateCapsule('enemy',{height:1.9,radius:0.45},scene);
  const cx=clamp(px,-90,90), cz=clamp(pz,-90,90);
  body.position.set(cx,terrainHeight(cx,cz)+0.95,cz);
  body.checkCollisions=true;
  body.ellipsoid=new BABYLON.Vector3(0.55,0.95,0.55);
  body.isVisible=false; // capsule is the hit volume; rig is the visual

  const pal = ranged
    ? { skin:[0.78,0.6,0.42], shirt:[0.72,0.5,0.12], pants:[0.28,0.22,0.12], em:[0.14,0.08,0.0] }
    : { skin:[0.6,0.52,0.5],  shirt:[0.62,0.14,0.12], pants:[0.22,0.13,0.13], em:[0.14,0.0,0.0] };
  const rig=buildHumanoid(scene,pal);
  rig.root.parent=body; rig.root.position.y=-0.95;
  if(shadows&&Game.shadowGen) rig.root.getChildMeshes().forEach(m=>Game.shadowGen.addShadowCaster(m));

  if(ranged){
    const gm=buildGunModel(scene,'rifle');
    gm.root.parent=rig.handR; gm.root.position.set(0,-0.04,0.24);
  }

  const hb=buildHealthBar(scene,body,1.5);
  const hpBase = ranged ? 45 : 60;
  const e={ body, rig, hb, ranged, dead:false,
            hp:hpBase+Game.wave*8, maxHp:hpBase+Game.wave*8,
            speed:(ranged?2.0:2.4+Game.wave*0.15)+rand(0,0.6),
            atkCd:rand(0.5,1.5), attackT:null,
            baseEms:rig.mats.map(m=>m.emissiveColor.clone()) };
  rig.root.getChildMeshes().forEach(m=>m._enemy=e); body._enemy=e;
  Game.enemies.push(e);
  return e;
}

function enemyFire(e){
  const p=Game.player, origin=e.body.position;
  const dir=new BABYLON.Vector3(p.position.x-origin.x,(p.position.y+0.4)-origin.y,p.position.z-origin.z);
  const dist=dir.length(); if(dist<0.01) return;
  dir.scaleInPlace(1/dist);
  const b=BABYLON.MeshBuilder.CreateSphere('ebul',{diameter:0.35,segments:6},Game.scene);
  b.position.set(origin.x+dir.x, origin.y+0.4+dir.y, origin.z+dir.z);
  const bm=new BABYLON.StandardMaterial('ebm',Game.scene);
  bm.emissiveColor=new BABYLON.Color3(1,0.6,0.15); bm.disableLighting=true;
  b.material=bm; b.isPickable=false;
  Game.eBullets.push({ mesh:b, dir, speed:34, life:2.2, dmg:9+Game.wave });
  sfx('enemyfire');
}

function flashEnemyHit(e){
  const red=new BABYLON.Color3(0.85,0.25,0.18);
  e.rig.mats.forEach(m=>m.emissiveColor=red);
  setTimeout(()=>{ if(e.dead) return;
    e.rig.mats.forEach((m,i)=>{ if(e.baseEms[i]) m.emissiveColor=e.baseEms[i].clone(); }); },90);
}

function startWave(){
  Game.wave++;
  Game.waveActive=true;
  Game.enemiesToSpawn = 4 + Game.wave*2;
  $('waveLbl').textContent='WAVE '+String(Game.wave).padStart(2,'0');
  toast('WAVE '+Game.wave+' — '+Game.enemiesToSpawn+' HOSTILES');
}

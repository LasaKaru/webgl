"use strict";
/* =====================================================================
   VERDANT — items: world pickups (weapons, health, ammo, grenades) and
   loot scatter. Walk near + E to collect; weapons show the real model.
   ===================================================================== */
const PICKUP = {
  health: { ico:'➕', label:'HEALTH PACK', col:[0.9,0.2,0.2] },
  ammo:   { ico:'📦', label:'AMMO',        col:[0.9,0.7,0.2] },
  medkit: { ico:'➕', label:'MEDKIT',      col:[0.9,0.25,0.25] },
  grenade:{ ico:'💣', label:'GRENADES',    col:[0.2,0.5,0.2] },
};

function spawnItem(scene,type,x,z,weaponIdx){
  const root=new BABYLON.TransformNode('item',scene);
  root.position.set(x, terrainHeight(x,z)+1.0, z);

  if(type==='weapon'){
    const w=Game.weapons[weaponIdx];
    const gm=buildGunModel(scene,w.model);
    gm.root.parent=root; gm.root.scaling.set(1.3,1.3,1.3); gm.root.position.y=0.1;
    // glowing base ring
    const base=BABYLON.MeshBuilder.CreateCylinder('base',{height:0.06,diameter:1.1,tessellation:6},scene);
    base.parent=root; base.position.y=-0.6; base.isPickable=false;
    base.material=lowPolyMat(scene,'pbase',w.id==='shotgun'?0.7:0.4,0.35,0.1,{emissive:[0.25,0.18,0.04]});
  } else {
    const c=PICKUP[type].col;
    const box=BABYLON.MeshBuilder.CreateBox('crate',{size:0.7},scene);
    box.parent=root; box.isPickable=false;
    box.material=lowPolyMat(scene,'it',c[0],c[1],c[2],{emissive:[c[0]*0.35,c[1]*0.35,c[2]*0.35]});
    if(type==='health'||type==='medkit'){ // white cross marker
      const cv=lowPolyMat(scene,'cross',0.95,0.95,0.95,{emissive:[0.4,0.4,0.4]});
      const a=BABYLON.MeshBuilder.CreateBox('cx',{width:0.5,height:0.14,depth:0.72},scene); a.parent=box; a.material=cv; a.isPickable=false;
      const b=BABYLON.MeshBuilder.CreateBox('cy',{width:0.14,height:0.5,depth:0.72},scene); b.parent=box; b.material=cv; b.isPickable=false;
    }
  }
  const it={ mesh:root, type, weaponIdx };
  Game.items.push(it);
  return it;
}

// Scatter starting loot across the map (GTA-lite: guns + supplies in the world).
function scatterLoot(scene){
  spawnItem(scene,'weapon', rand(8,20),  rand(-20,20), 1);  // SMG
  spawnItem(scene,'weapon', rand(-22,-8), rand(-22,22), 2);  // RIFLE
  spawnItem(scene,'weapon', rand(-15,15), rand(18,30),  3);  // SHOTGUN
  for(let i=0;i<5;i++) spawnItem(scene,'ammo',    rand(-70,70), rand(-70,70));
  for(let i=0;i<4;i++) spawnItem(scene,'health',  rand(-70,70), rand(-70,70));
  for(let i=0;i<3;i++) spawnItem(scene,'grenade', rand(-70,70), rand(-70,70));
  for(let i=0;i<2;i++) spawnItem(scene,'medkit',  rand(-60,60), rand(-60,60));
}

function itemLabel(it){
  if(it.type==='weapon') return Game.weapons[it.weaponIdx].name;
  return PICKUP[it.type].label;
}

function collectItem(it){
  const w=Game.weapons[Game.currentWeapon];
  if(it.type==='weapon'){
    const tw=Game.weapons[it.weaponIdx];
    if(!tw.owned){ tw.owned=true; toast('ACQUIRED '+tw.name); }
    else { tw.reserve+=tw.maxMag*2; toast('+AMMO '+tw.name); }
    Game.currentWeapon=it.weaponIdx; equipWeaponModel(); sfx('gunpickup');
  } else if(it.type==='ammo'){
    w.reserve+=30; toast('+30 AMMO'); sfx('pickup');
  } else if(it.type==='health'){
    Game.playerData.hp=clamp(Game.playerData.hp+25,0,100); refreshHP(); toast('+25 HP'); sfx('pickup');
  } else if(it.type==='medkit'){
    addToInventory('medkit',1); toast('PICKED UP MEDKIT'); sfx('pickup');
  } else if(it.type==='grenade'){
    Game.grenadeCount+=2; refreshGrenades(); toast('+2 GRENADES'); sfx('pickup');
  }
  it.mesh.dispose();
  Game.items=Game.items.filter(x=>x!==it);
  if(Game.nearItem===it) Game.nearItem=null;
  renderInventory(); refreshAmmoHUD();
}

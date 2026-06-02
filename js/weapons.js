"use strict";
/* =====================================================================
   VERDANT — weapons: stats + multi-part low-poly gun models
   Four weapons (pistol / SMG / rifle / shotgun). Each has an `owned`
   flag; you start with the pistol and pick the rest up in the world.
   buildGunModel() makes a detached gun mesh used both as the in-hand
   weapon and as the spinning world pickup.
   ===================================================================== */
function defaultWeapons(){
  return [
    { id:'pistol',  name:'PISTOL',  model:'pistol',  owned:true,  dmg:34, mag:12, ammo:12, reserve:48,  maxMag:12,
      rof:300, auto:false, pellets:1, spread:0.012, range:120, reloadMs:900,  sfx:'pistol' },
    { id:'smg',     name:'SMG',     model:'smg',     owned:false, dmg:16, mag:30, ammo:30, reserve:120, maxMag:30,
      rof:70,  auto:true,  pellets:1, spread:0.035, range:110, reloadMs:1100, sfx:'smg' },
    { id:'rifle',   name:'RIFLE',   model:'rifle',   owned:false, dmg:24, mag:30, ammo:30, reserve:90,  maxMag:30,
      rof:95,  auto:true,  pellets:1, spread:0.022, range:150, reloadMs:1300, sfx:'rifle' },
    { id:'shotgun', name:'SHOTGUN', model:'shotgun', owned:false, dmg:13, mag:6,  ammo:6,  reserve:24,  maxMag:6,
      rof:650, auto:false, pellets:8, spread:0.09,  range:55,  reloadMs:1500, sfx:'shotgun' },
  ];
}

// shared gun materials (created once per scene)
function gunMats(scene){
  if(!scene._matGunMetal){
    scene._matGunMetal=charMat(scene,'gunMetal',0.10,0.10,0.12,[0.01,0.01,0.012]);
    scene._matGunDark =charMat(scene,'gunDark',0.05,0.05,0.06);
    scene._matGunAcc  =charMat(scene,'gunAcc',0.18,0.16,0.12);
  }
  return scene;
}
function gpart(scene,name,w,h,d,parent,x,y,z,mat){
  const b=BABYLON.MeshBuilder.CreateBox(name,{width:w,height:h,depth:d},scene);
  b.position.set(x,y,z); b.parent=parent; b.material=mat; b.isPickable=false; return b;
}

// Returns { root:TransformNode, flash:Mesh } — the gun points down +Z.
function buildGunModel(scene,type){
  gunMats(scene);
  const M=scene._matGunMetal, D=scene._matGunDark, A=scene._matGunAcc;
  const root=new BABYLON.TransformNode('gun_'+type,scene);
  let muzzleZ=0.4;

  if(type==='pistol'){
    gpart(scene,'slide',0.1,0.13,0.3,root,0,0,0.05,M);
    gpart(scene,'barrel',0.07,0.07,0.16,root,0,0.01,0.24,D); muzzleZ=0.33;
    gpart(scene,'grip',0.09,0.22,0.12,root,0,-0.16,-0.05,A).rotation.x=0.25;
  } else if(type==='smg'){
    gpart(scene,'body',0.1,0.14,0.42,root,0,0,0.04,M);
    gpart(scene,'barrel',0.06,0.06,0.18,root,0,0.01,0.3,D); muzzleZ=0.4;
    gpart(scene,'mag',0.08,0.22,0.1,root,0,-0.17,0.02,A);
    gpart(scene,'grip',0.09,0.18,0.11,root,0,-0.14,-0.16,A).rotation.x=0.3;
    gpart(scene,'stock',0.08,0.1,0.18,root,0,0,-0.28,D);
  } else if(type==='rifle'){
    gpart(scene,'body',0.1,0.15,0.6,root,0,0,0.02,M);
    gpart(scene,'barrel',0.06,0.06,0.32,root,0,0.02,0.42,D); muzzleZ=0.6;
    gpart(scene,'mag',0.09,0.26,0.11,root,0,-0.2,0.0,A).rotation.x=-0.15;
    gpart(scene,'grip',0.09,0.18,0.11,root,0,-0.13,-0.18,A).rotation.x=0.3;
    gpart(scene,'stock',0.09,0.13,0.26,root,0,-0.02,-0.36,D);
    gpart(scene,'sight',0.04,0.06,0.1,root,0,0.12,0.05,D);
  } else { // shotgun
    gpart(scene,'body',0.12,0.14,0.56,root,0,0,0.02,M);
    gpart(scene,'barrelA',0.06,0.06,0.4,root,-0.035,0.03,0.36,D);
    gpart(scene,'barrelB',0.06,0.06,0.4,root,0.035,0.03,0.36,D); muzzleZ=0.58;
    gpart(scene,'pump',0.13,0.09,0.18,root,0,-0.09,0.22,A);
    gpart(scene,'grip',0.1,0.18,0.12,root,0,-0.14,-0.16,A).rotation.x=0.3;
    gpart(scene,'stock',0.1,0.14,0.3,root,0,-0.04,-0.36,D);
  }

  const flash=BABYLON.MeshBuilder.CreatePlane('flash',{size:0.55},scene);
  flash.parent=root; flash.position.set(0,0.02,muzzleZ+0.12); flash.isPickable=false;
  const fm=new BABYLON.StandardMaterial('fm',scene);
  fm.emissiveColor=new BABYLON.Color3(1,0.7,0.2); fm.disableLighting=true; fm.backFaceCulling=false;
  flash.material=fm; flash.isVisible=false;

  return { root, flash };
}

// Build the held weapon for the current selection and wire its muzzle flash.
function equipWeaponModel(){
  const rig=Game.playerRig; if(!rig) return;
  if(Game.heldModel){ Game.heldModel.root.dispose(); Game.heldModel=null; }
  const w=Game.weapons[Game.currentWeapon];
  const gm=buildGunModel(Game.scene, w.model);
  gm.root.parent=rig.handR;
  gm.root.position.set(0,-0.04,0.26);
  gm.root.getChildMeshes && gm.root.getChildMeshes().forEach(m=>m.isPickable=false);
  if(Game.shadowGen) gm.root.getChildMeshes && gm.root.getChildMeshes().forEach(m=>Game.shadowGen.addShadowCaster(m));
  Game.heldModel=gm; Game.player._flash=gm.flash;
}

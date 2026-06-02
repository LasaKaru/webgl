"use strict";
/* =====================================================================
   VERDANT — player: invisible collision capsule + visible humanoid rig
   ===================================================================== */
function buildPlayer(scene){
  const body=BABYLON.MeshBuilder.CreateCapsule('player',{height:1.8,radius:0.4},scene);
  body.position.set(0,1.0,0);
  body.checkCollisions=true;
  body.ellipsoid=new BABYLON.Vector3(0.5,0.9,0.5);
  body.ellipsoidOffset=new BABYLON.Vector3(0,0,0);
  body.isVisible=false; // collision volume only

  const rig=buildHumanoid(scene,{ skin:[0.85,0.68,0.55], shirt:[0.15,0.45,0.52],
    pants:[0.17,0.2,0.26], em:[0.02,0.06,0.07] });
  rig.root.parent=body; rig.root.position.y=-0.95; // feet at the capsule base
  rig.root.getChildMeshes().forEach(m=>{ m.isPickable=false; }); // can't shoot self
  Game.playerRig=rig;

  if(Game.shadowGen) rig.root.getChildMeshes().forEach(m=>Game.shadowGen.addShadowCaster(m));
  return body;
}

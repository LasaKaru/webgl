"use strict";
/* =====================================================================
   VERDANT — characters: articulated humanoid rig, procedural animation,
   floating health bars. Used for the player and every enemy.
   Swappable for a rigged glTF via BABYLON.SceneLoader — the only call
   site that would change is animateHumanoid().
   ===================================================================== */
function charMat(scene,name,r,g,b,em){
  const m=new BABYLON.StandardMaterial(name,scene);
  m.diffuseColor=new BABYLON.Color3(r,g,b);
  m.specularColor=new BABYLON.Color3(0.05,0.05,0.05);
  if(em) m.emissiveColor=new BABYLON.Color3(em[0],em[1],em[2]);
  return m;
}
function jbox(scene,name,w,h,d,parent,py,mat){
  const b=BABYLON.MeshBuilder.CreateBox(name,{width:w,height:h,depth:d},scene);
  b.position.y=py; b.parent=parent; b.material=mat; return b;
}
// pal: { skin:[r,g,b], shirt:[r,g,b], pants:[r,g,b], em:[r,g,b] }
function buildHumanoid(scene,pal){
  // prefer a rigged glTF clone when the asset loaded; fall back to the box rig
  if(Game.gltf && Game.gltf.ready){
    try{ return instantiateGltfRig(scene); }
    catch(e){ console.warn('glTF instance failed, procedural fallback:', e); }
  }
  const skin =charMat(scene,'skin', pal.skin[0],pal.skin[1],pal.skin[2],pal.em);
  const shirt=charMat(scene,'shirt',pal.shirt[0],pal.shirt[1],pal.shirt[2],pal.em);
  const pants=charMat(scene,'pants',pal.pants[0],pal.pants[1],pal.pants[2],pal.em);

  const root=new BABYLON.TransformNode('charRoot',scene);
  const hips=new BABYLON.TransformNode('hips',scene); hips.parent=root; hips.position.y=0.9;
  jbox(scene,'pelvis',0.5,0.3,0.28,hips,0,pants);

  const torso=new BABYLON.TransformNode('torso',scene); torso.parent=hips; torso.position.y=0.1;
  jbox(scene,'chest',0.55,0.6,0.3,torso,0.3,shirt);
  const neck=new BABYLON.TransformNode('neck',scene); neck.parent=torso; neck.position.y=0.62;
  jbox(scene,'head',0.34,0.36,0.34,neck,0.2,skin);

  function arm(side){ // +1 right, -1 left
    const sh=new BABYLON.TransformNode('shoulder',scene); sh.parent=torso; sh.position.set(side*0.36,0.55,0);
    jbox(scene,'upperarm',0.16,0.42,0.16,sh,-0.21,shirt);
    const el=new BABYLON.TransformNode('elbow',scene); el.parent=sh; el.position.y=-0.42;
    jbox(scene,'forearm',0.15,0.4,0.15,el,-0.2,skin);
    const hand=jbox(scene,'hand',0.17,0.17,0.17,el,-0.42,skin);
    return {sh,el,hand};
  }
  function leg(side){
    const hp=new BABYLON.TransformNode('hipJ',scene); hp.parent=hips; hp.position.set(side*0.14,0,0);
    jbox(scene,'thigh',0.19,0.46,0.21,hp,-0.23,pants);
    const kn=new BABYLON.TransformNode('knee',scene); kn.parent=hp; kn.position.y=-0.46;
    jbox(scene,'shin',0.17,0.46,0.18,kn,-0.23,pants);
    const foot=jbox(scene,'foot',0.18,0.12,0.34,kn,-0.46,skin); foot.position.z=0.08;
    return {hp,kn};
  }
  const aR=arm(1), aL=arm(-1), lR=leg(1), lL=leg(-1);

  return { root, hips, torso, neck,
    shoulderR:aR.sh, elbowR:aR.el, handR:aR.hand,
    shoulderL:aL.sh, elbowL:aL.el, handL:aL.hand,
    hipR:lR.hp, kneeR:lR.kn, hipL:lL.hp, kneeL:lL.kn,
    phase:Math.random()*6.28, mats:[skin,shirt,pants], em:pal.em };
}

// Pose the rig for this frame. st: {moving,run,speed,aiming,attack(0..1|null)}
function animateHumanoid(rig,dt,st){
  if(rig.gltf){ driveGltfAnim(rig,st); return; }
  rig.phase += st.moving ? dt*(6 + (st.speed||0)*1.1) : dt*1.4;
  const ph=rig.phase;
  const swing = st.moving ? Math.sin(ph)*(st.run?0.85:0.5) : Math.sin(ph)*0.04;

  rig.hipL.rotation.x =  swing;  rig.hipR.rotation.x = -swing;
  rig.kneeL.rotation.x = Math.max(0,-swing)*0.9;
  rig.kneeR.rotation.x = Math.max(0, swing)*0.9;
  rig.torso.rotation.y = Math.sin(ph*0.5)*0.03;
  rig.torso.rotation.x = st.moving ? 0.08 : 0;

  if(st.aiming){
    rig.shoulderR.rotation.set(-1.4, 0, -0.12);
    rig.shoulderL.rotation.set(-1.2, 0, 0.42);
    rig.elbowR.rotation.x=-0.15; rig.elbowL.rotation.x=-0.65;
  } else if(st.attack!=null){
    const a=Math.sin(Math.min(1,st.attack)*Math.PI);
    rig.shoulderR.rotation.set(-1.9*a - swing*(1-a), 0, 0);
    rig.elbowR.rotation.x=-0.4*a;
    rig.shoulderL.rotation.set(swing,0,0.1); rig.elbowL.rotation.x=0.2;
  } else {
    rig.shoulderL.rotation.set(-swing,0,0.08);
    rig.shoulderR.rotation.set( swing,0,-0.08);
    rig.elbowL.rotation.x=0.15; rig.elbowR.rotation.x=0.15;
  }
}

function buildHealthBar(scene,parent,y){
  const back=BABYLON.MeshBuilder.CreatePlane('hpback',{width:1.0,height:0.14},scene);
  back.parent=parent; back.position.y=y; back.billboardMode=BABYLON.Mesh.BILLBOARDMODE_ALL;
  back.isPickable=false;
  const bm=charMat(scene,'hpbg',0.04,0.05,0.04); bm.disableLighting=true; bm.alpha=0.75; back.material=bm;
  const fill=BABYLON.MeshBuilder.CreatePlane('hpfill',{width:0.94,height:0.08},scene);
  fill.parent=back; fill.position.z=-0.01; fill.isPickable=false;
  const fm=charMat(scene,'hpf',0.6,0.9,0.3); fm.disableLighting=true; fill.material=fm;
  return { back, fill, fm, width:0.94 };
}
function updateHealthBar(hb,ratio){
  ratio=clamp(ratio,0,1);
  hb.fill.scaling.x=ratio;
  hb.fill.position.x=-(1-ratio)*hb.width/2;
  const c=new BABYLON.Color3(1-ratio*0.45, 0.25+ratio*0.65, 0.18);
  hb.fm.emissiveColor=c; hb.fm.diffuseColor=c;
}

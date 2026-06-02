"use strict";
/* =====================================================================
   VERDANT — world: materials, low-poly props, instanced grass, terrain
   ===================================================================== */
function lowPolyMat(scene,name,r,g,b,opts={}){
  const m=new BABYLON.StandardMaterial(name,scene);
  m.diffuseColor=new BABYLON.Color3(r,g,b);
  m.specularColor=new BABYLON.Color3(0.04,0.04,0.04);
  if(opts.emissive) m.emissiveColor=new BABYLON.Color3(opts.emissive[0],opts.emissive[1],opts.emissive[2]);
  return m;
}

function buildTree(scene,x,z,shadows){
  const root=new BABYLON.TransformNode('tree',scene);
  root.position.set(x,terrainHeight(x,z),z);
  const h=rand(3,6);
  const trunk=BABYLON.MeshBuilder.CreateCylinder('trunk',{height:h,diameterTop:.35,diameterBottom:.6,tessellation:6},scene);
  trunk.position.y=h/2; trunk.parent=root; trunk.material=scene._matBark; trunk.checkCollisions=true;
  const tiers=Math.floor(rand(2,4));
  for(let i=0;i<tiers;i++){
    const d=rand(2.6,3.8)-i*0.6;
    const cone=BABYLON.MeshBuilder.CreateCylinder('leaf',{height:1.7,diameterTop:0,diameterBottom:d,tessellation:6},scene);
    cone.position.y=h-0.5+i*1.1; cone.parent=root;
    cone.material=Math.random()<.5?scene._matLeaf:scene._matLeaf2;
    if(shadows&&Game.shadowGen) Game.shadowGen.addShadowCaster(cone);
  }
  if(shadows&&Game.shadowGen) Game.shadowGen.addShadowCaster(trunk);
  return root;
}
function buildRock(scene,x,z,shadows){
  const r=rand(.6,1.8);
  const rock=BABYLON.MeshBuilder.CreatePolyhedron('rock',{type:1,size:r},scene);
  rock.position.set(x,terrainHeight(x,z)+r*0.5,z);
  rock.rotation.set(rand(0,3),rand(0,3),rand(0,3));
  rock.scaling.y=rand(.6,1); rock.material=scene._matRock; rock.checkCollisions=true;
  if(shadows&&Game.shadowGen) Game.shadowGen.addShadowCaster(rock);
  return rock;
}
function buildHouse(scene,x,z,shadows){
  const root=new BABYLON.TransformNode('house',scene); root.position.set(x,terrainHeight(x,z),z);
  root.rotation.y=rand(0,Math.PI*2);
  const w=rand(5,8), d=rand(5,8), wallH=rand(3,4.2);
  const body=BABYLON.MeshBuilder.CreateBox('body',{width:w,depth:d,height:wallH},scene);
  body.position.y=wallH/2; body.parent=root; body.material=scene._matWall; body.checkCollisions=true;
  const roof=BABYLON.MeshBuilder.CreateCylinder('roof',{height:rand(1.6,2.6),diameterTop:0,diameterBottom:Math.max(w,d)*1.25,tessellation:4},scene);
  roof.position.y=wallH+0.8; roof.rotation.y=Math.PI/4; roof.parent=root; roof.material=scene._matRoof;
  for(let i=-1;i<=1;i+=2){
    const glass=BABYLON.MeshBuilder.CreateBox('glass',{width:1.2,height:1.4,depth:.12},scene);
    glass.position.set(i*w*0.28,wallH*0.55,d/2+0.01); glass.parent=root; glass.material=scene._matGlass;
  }
  const door=BABYLON.MeshBuilder.CreateBox('door',{width:1.1,height:2,depth:.14},scene);
  door.position.set(0,1,d/2+0.01); door.parent=root; door.material=scene._matRoof;
  if(shadows&&Game.shadowGen){ Game.shadowGen.addShadowCaster(body); Game.shadowGen.addShadowCaster(roof); }
  return root;
}

// Instanced grass: thousands of crossed quads in a single draw call (thin instances).
function buildGrass(scene,count){
  try{
    const blade=BABYLON.MeshBuilder.CreatePlane('grass',{width:0.4,height:0.6},scene);
    const m=new BABYLON.StandardMaterial('grassMat',scene);
    m.diffuseColor=new BABYLON.Color3(0.16,0.4,0.16);
    m.emissiveColor=new BABYLON.Color3(0.05,0.13,0.05);
    m.specularColor=new BABYLON.Color3(0,0,0);
    m.backFaceCulling=false;
    blade.material=m; blade.isPickable=false;
    const data=new Float32Array(count*16);
    const up=new BABYLON.Vector3(0,0,0);
    for(let i=0;i<count;i++){
      const x=rand(-92,92), z=rand(-92,92), y=terrainHeight(x,z);
      const s=rand(0.6,1.5), ry=rand(0,Math.PI*2);
      const q=BABYLON.Quaternion.RotationYawPitchRoll(ry,0,0);
      const mat=BABYLON.Matrix.Compose(new BABYLON.Vector3(s,s,s), q, new BABYLON.Vector3(x,y+0.3*s,z));
      mat.copyToArray(data,i*16);
    }
    blade.thinInstanceSetBuffer('matrix',data,16);
    blade.receiveShadows=true;
    scene._grass=blade;
  }catch(e){ console.warn('grass unavailable:',e); }
}

function buildWorld(scene,density,shadows){
  // freeze the hill amplitude used for both mesh displacement and runtime clamps
  Game.terrainHills=Game.settings.hills;

  scene._matBark = lowPolyMat(scene,'bark',0.32,0.22,0.13);
  scene._matLeaf = lowPolyMat(scene,'leaf',0.18,0.42,0.16);
  scene._matLeaf2= lowPolyMat(scene,'leaf2',0.12,0.34,0.12);
  scene._matRock = lowPolyMat(scene,'rock',0.4,0.42,0.4);
  scene._matWall = lowPolyMat(scene,'wall',0.72,0.66,0.52);
  scene._matRoof = lowPolyMat(scene,'roof',0.45,0.2,0.18);

  const glass=new BABYLON.PBRMaterial('glass',scene);
  glass.albedoColor=new BABYLON.Color3(0.35,0.55,0.6);
  glass.metallic=0.0; glass.roughness=0.05; glass.alpha=0.35;
  glass.environmentIntensity=0.8; glass.backFaceCulling=false;
  scene._matGlass=glass;

  // hilly ground — displace a subdivided plane with the height field
  const ground=BABYLON.MeshBuilder.CreateGround('ground',{width:200,height:200,subdivisions:120},scene);
  const pos=ground.getVerticesData(BABYLON.VertexBuffer.PositionKind);
  for(let i=0;i<pos.length;i+=3){ pos[i+1]=terrainHeight(pos[i],pos[i+2]); }
  ground.updateVerticesData(BABYLON.VertexBuffer.PositionKind,pos);
  const normals=[];
  BABYLON.VertexData.ComputeNormals(pos, ground.getIndices(), normals);
  ground.updateVerticesData(BABYLON.VertexBuffer.NormalKind, normals);
  const gmat=new BABYLON.StandardMaterial('gmat',scene);
  gmat.diffuseColor=new BABYLON.Color3(0.12,0.26,0.14);
  gmat.specularColor=new BABYLON.Color3(0,0,0);
  ground.material=gmat; ground.receiveShadows=true; ground.checkCollisions=false;

  // boundary walls so player + enemies stay in
  const wallMat=lowPolyMat(scene,'bound',0.1,0.18,0.12);
  const B=98;
  [[0,B,200,2],[0,-B,200,2],[B,0,2,200],[-B,0,2,200]].forEach(([px,pz,w,d])=>{
    const wall=BABYLON.MeshBuilder.CreateBox('bound',{width:w,height:12,depth:d},scene);
    wall.position.set(px,6,pz); wall.material=wallMat; wall.checkCollisions=true; wall.isPickable=false;
  });

  const trees=Math.floor(density), rocks=Math.floor(density*0.4), houses=Math.floor(density*0.06);
  for(let i=0;i<trees;i++) buildTree(scene,rand(-90,90),rand(-90,90),shadows);
  for(let i=0;i<rocks;i++) buildRock(scene,rand(-90,90),rand(-90,90),shadows);
  for(let i=0;i<houses;i++) buildHouse(scene,rand(-80,80),rand(-80,80),shadows);

  if(Game.settings.grass) buildGrass(scene, Math.floor(density*45));

  scene.fogMode=BABYLON.Scene.FOGMODE_EXP2;
  scene.fogColor=new BABYLON.Color3(0.06,0.12,0.09);
  scene.fogDensity=0.012;
}

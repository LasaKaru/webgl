"use strict";
/* =====================================================================
   VERDANT — rigged glTF characters (with procedural fallback)
   Loads a skinned, animated character once into an AssetContainer, then
   clones it per character via instantiateModelsToScene() so each gets its
   own AnimationGroups. If the loader plugin or the asset CDN is
   unavailable, Game.gltf.ready stays false and buildHumanoid() falls back
   to the box-rig humanoid — the rest of the game is unchanged.

   Asset: Babylon's CORS-enabled sample character (Idle / Walking clips).
   Swap GLTF_CFG to point at your own rigged glTF/GLB.
   ===================================================================== */
const GLTF_CFG = {
  base: 'https://assets.babylonjs.com/meshes/',
  file: 'HVGirl.glb',
  scale: 0.10,        // model units -> ~1.8 m tall (tune per asset)
  rotY: Math.PI,      // orient the model to face +Z (forward)
  timeoutMs: 8000,
  // hand-socket for held weapons (tune to your rig)
  handBoneHints: ['mixamorig:RightHand','RightHand','Hand_R','hand.R','wrist_r','hand_r'],
  weaponScale: null,  // null => auto (1/scale) to cancel the model scale on the bone
  weaponOffset: { x:0, y:0, z:0 },
  weaponRot:    { x:0, y:0, z:0 },
};

Game.gltf = { ready:false, container:null };

async function loadCharacterAssets(scene){
  const SL = BABYLON.SceneLoader;
  if(!SL || !SL.LoadAssetContainerAsync){ console.warn('[VERDANT] glTF loader plugin missing — procedural characters.'); return; }
  try{
    const container = await Promise.race([
      SL.LoadAssetContainerAsync(GLTF_CFG.base, GLTF_CFG.file, scene),
      new Promise((_,rej)=>setTimeout(()=>rej(new Error('timeout')), GLTF_CFG.timeoutMs)),
    ]);
    Game.gltf.container = container;
    Game.gltf.ready = true;
    console.log('[VERDANT] glTF character loaded:', GLTF_CFG.file);
  }catch(e){
    console.warn('[VERDANT] glTF characters unavailable, using procedural rig:', (e&&e.message)||e);
  }
}

// Instantiate one animated clone. Returns a rig with the same shape the
// game expects (root, handR, mats, em) plus glTF:true + grouped clips.
function instantiateGltfRig(scene){
  const c = Game.gltf.container;
  const entries = c.instantiateModelsToScene(n=>n, false);
  const root = new BABYLON.TransformNode('gltfChar', scene);
  entries.rootNodes.forEach(n=>{ n.parent = root; });
  root.scaling.set(GLTF_CFG.scale, GLTF_CFG.scale, GLTF_CFG.scale);
  root.rotation.y = GLTF_CFG.rotY;

  const groups = {};
  (entries.animationGroups||[]).forEach(g=>{
    const n = (g.name||'').toLowerCase();
    if(n.includes('idle')) groups.idle = g;
    else if(n.includes('walk')) groups.walk = g;
    else if(n.includes('run')) groups.run = g;
    g.stop();
  });
  if(!groups.run)  groups.run  = groups.walk || groups.idle;
  if(!groups.walk) groups.walk = groups.run  || groups.idle;

  // locate a right-hand bone + its skinned mesh so we can socket weapons
  const skel = (entries.skeletons && entries.skeletons[0]) || null;
  const childMeshes = root.getChildMeshes ? root.getChildMeshes() : [];
  const skinnedMesh = childMeshes.find(m=>m.skeleton) || childMeshes[0] || null;
  let handBone = null;
  if(skel && skel.bones){
    for(const hint of GLTF_CFG.handBoneHints){
      handBone = skel.bones.find(b=>(b.name||'').toLowerCase()===hint.toLowerCase());
      if(handBone) break;
    }
    if(!handBone){
      const hands = skel.bones.filter(b=>/hand/i.test(b.name||''));
      handBone = hands.find(b=>/right|_r\b|\.r\b|r$/i.test(b.name||'')) || hands[0] || null;
    }
  }
  const wScale = (GLTF_CFG.weaponScale!=null) ? GLTF_CFG.weaponScale : (1/GLTF_CFG.scale);

  const rig = { gltf:true, root, handR:root, handBone, skinnedMesh, groups, current:null,
                animGroups:entries.animationGroups||[], mats:[], em:[0,0,0], phase:0 };
  rig.attachHand = function(node){
    const o=GLTF_CFG.weaponOffset, r=GLTF_CFG.weaponRot;
    if(this.handBone && this.skinnedMesh && node.attachToBone){
      node.attachToBone(this.handBone, this.skinnedMesh);
      node.scaling.set(wScale,wScale,wScale);
    } else {
      node.parent=this.root;
    }
    node.position.set(o.x,o.y,o.z);
    node.rotation.set(r.x,r.y,r.z);
  };
  return rig;
}

// Drive a glTF rig by switching looping clips to match the movement state.
function driveGltfAnim(rig, st){
  const key = st.moving ? (st.run ? 'run' : 'walk') : 'idle';
  const grp = rig.groups[key] || rig.groups.idle;
  if(grp && rig.current !== grp){
    if(rig.current) rig.current.stop();
    grp.start(true, key==='run' ? 1.25 : 1.0);
    rig.current = grp;
  }
}
function stopGltfRig(rig){
  if(rig && rig.gltf && rig.current){ rig.current.stop(); rig.current=null; }
}

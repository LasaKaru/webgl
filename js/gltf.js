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

  return { gltf:true, root, handR:root, groups, current:null,
           animGroups:entries.animationGroups||[], mats:[], em:[0,0,0], phase:0 };
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

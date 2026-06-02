"use strict";
/* =====================================================================
   VERDANT — boot: engine/scene, loading sequence, input, UI, entry
   ===================================================================== */
async function boot(){
  const canvas=$('renderCanvas');
  const engine=new BABYLON.Engine(canvas,true,{preserveDrawingBuffer:true,stencil:true});
  Game.engine=engine;
  const scene=new BABYLON.Scene(engine);
  Game.scene=scene;
  scene.clearColor=new BABYLON.Color4(0.04,0.08,0.06,1);
  scene.collisionsEnabled=true;
  scene.gravity=new BABYLON.Vector3(0,-0.5,0);

  const cam=new BABYLON.UniversalCamera('cam',new BABYLON.Vector3(0,5,-10),scene);
  cam.fov=Game.settings.fov; cam.minZ=0.1; cam.maxZ=400;
  Game.camera=cam;

  const hemi=new BABYLON.HemisphericLight('hemi',new BABYLON.Vector3(0,1,0),scene);
  hemi.intensity=0.65; hemi.diffuse=new BABYLON.Color3(0.8,0.95,0.85);
  hemi.groundColor=new BABYLON.Color3(0.1,0.18,0.12); Game.hemi=hemi;
  const sun=new BABYLON.DirectionalLight('sun',new BABYLON.Vector3(-0.5,-1,-0.4),scene);
  sun.position=new BABYLON.Vector3(60,80,60); sun.intensity=1.1; Game.light=sun;

  // try to load rigged glTF characters before anything spawns (falls back silently)
  $('loadTask').textContent='LOADING CHARACTER MODELS';
  await loadCharacterAssets(scene);

  const steps=[
    ['INITIALIZING ENGINE', ()=>{}],
    ['CONFIGURING SHADOWS', ()=>{
      if(Game.settings.shadows){
        const sg=new BABYLON.ShadowGenerator(1024,sun);
        sg.useBlurExponentialShadowMap=true; sg.blurScale=2; Game.shadowGen=sg;
      }
    }],
    ['SCULPTING HILLY TERRAIN', ()=>{ buildWorld(scene,Game.settings.density,Game.settings.shadows); }],
    ['GROWING GRASS & JUNGLE',  ()=>{}],
    ['SPAWNING PLAYER', ()=>{ Game.player=buildPlayer(scene); Game.player.position.y=terrainHeight(0,0)+1.0; }],
    ['FORGING WEAPONS', ()=>{ Game.weapons=defaultWeapons(); equipWeaponModel(); }],
    ['SYNCING SYSTEMS', ()=>{ initInventory(); }],
    ['FINALIZING', ()=>{}],
  ];

  let i=0;
  function nextStep(){
    if(i>=steps.length){ finishLoad(); return; }
    const [task,fn]=steps[i];
    $('loadTask').textContent=task;
    try{ fn(); }catch(e){ console.error('Load step failed:',task,e); }
    i++;
    const pct=Math.round(i/steps.length*100);
    $('loadFill').style.width=pct+'%'; $('loadPct').textContent=pct+'%';
    setTimeout(nextStep, 300);
  }
  function finishLoad(){
    Game.playerData={hp:100,stamina:100};
    renderInventory(); refreshHP(); refreshSP(); refreshAmmoHUD(); refreshGrenades();
    setTimeout(()=>setState('menu'),500);
  }

  let last=performance.now();
  engine.runRenderLoop(()=>{
    const now=performance.now(); const dt=Math.min(0.05,(now-last)/1000); last=now;
    Game.camera.fov=Game.settings.fov;
    if(Game.state==='playing') updateGame(dt,now);
    scene.render();
  });
  window.addEventListener('resize',()=>engine.resize());
  setTimeout(nextStep,400);
}

/* ------------------------------ input ------------------------------ */
function selectWeapon(idx){
  if(!Game.weapons[idx] || !Game.weapons[idx].owned) return;
  Game.currentWeapon=idx; equipWeaponModel(); refreshAmmoHUD(); renderInventory();
}
function bindInput(){
  const canvas=$('renderCanvas');
  window.addEventListener('keydown',e=>{
    const key=e.key.toLowerCase(); Game.keys[key]=true;
    if(Game.state==='playing'){
      if(key==='1') selectWeapon(0);
      if(key==='2') selectWeapon(1);
      if(key==='3') selectWeapon(2);
      if(key==='4') selectWeapon(3);
      if(key==='r') reload();
      if(key==='g') throwGrenade();
      if(key==='tab'){ e.preventDefault(); toggleInventory(); }
      if(key==='escape'){ pauseGame(); }
    } else if(Game.state==='paused' && key==='escape'){ resumeGame(); }
    if(key===' ') e.preventDefault();
  });
  window.addEventListener('keyup',e=>{ Game.keys[e.key.toLowerCase()]=false; });

  canvas.addEventListener('click',()=>{
    if(Game.state==='playing' && document.pointerLockElement!==canvas){ canvas.requestPointerLock(); }
  });
  canvas.addEventListener('mousedown',()=>{
    if(Game.state!=='playing') return;
    if(document.pointerLockElement!==canvas){ canvas.requestPointerLock(); return; }
    Game.mouseDown=true;
    const w=Game.weapons[Game.currentWeapon];
    if(!w.auto) tryShoot(performance.now());
  });
  window.addEventListener('mouseup',()=>{ Game.mouseDown=false; });
  document.addEventListener('mousemove',e=>{
    if(Game.state!=='playing'||document.pointerLockElement==null) return;
    const s=Game.settings.sens*0.0016;
    Game.yaw += e.movementX*s;
    Game.pitch = Math.max(-0.25, Math.min(1.2, Game.pitch + e.movementY*s));
  });
  document.addEventListener('pointerlockchange',()=>{
    if(Game.state==='playing' && document.pointerLockElement==null && Game.playerData.hp>0){
      Game.mouseDown=false;
    }
  });
}
function toggleInventory(){
  if($('inv').classList.contains('show')){ hide('inv'); $('renderCanvas').requestPointerLock(); }
  else { renderInventory(); show('inv'); document.exitPointerLock && document.exitPointerLock(); }
}

/* ------------------------------ flow ------------------------------ */
function startMission(){
  initAudio(); if(Game.audio&&Game.audio.state==='suspended') Game.audio.resume();
  resetGame(); setState('playing');
  $('renderCanvas').requestPointerLock();
}
function pauseGame(){ document.exitPointerLock&&document.exitPointerLock(); setState('paused'); }
function resumeGame(){ setState('playing'); $('renderCanvas').requestPointerLock(); }

function bindUI(){
  document.querySelectorAll('#menu .mbtn').forEach(b=>b.onclick=()=>{
    const a=b.dataset.act;
    if(a==='play') startMission();
    else if(a==='settings') setState('settings');
    else if(a==='multiplayer') setState('mp');
    else if(a==='howto') setState('howto');
  });
  $('setBack').onclick=()=> setState('menu');
  $('howBack').onclick=()=> setState('menu');
  $('mpBack').onclick=()=> setState('menu');
  $('resume').onclick=resumeGame;
  $('pauseSettings').onclick=()=>{ setState('settings'); };
  $('quit').onclick=()=>{ document.exitPointerLock&&document.exitPointerLock(); setState('menu'); };
  $('retry').onclick=()=> startMission();
  $('toMenu').onclick=()=> setState('menu');

  $('segQuality').querySelectorAll('button').forEach(b=>b.onclick=()=>{
    $('segQuality').querySelectorAll('button').forEach(x=>x.classList.remove('active'));
    b.classList.add('active'); Game.settings.quality=b.dataset.q;
    const scale = b.dataset.q==='low'?1.5 : b.dataset.q==='high'?0.85 : 1.1;
    if(Game.engine) Game.engine.setHardwareScalingLevel(scale);
  });
  $('segShadow').querySelectorAll('button').forEach(b=>b.onclick=()=>{
    $('segShadow').querySelectorAll('button').forEach(x=>x.classList.remove('active'));
    b.classList.add('active'); Game.settings.shadows=(b.dataset.s==='on');
    if(Game.light){
      if(Game.settings.shadows && !Game.shadowGen){
        Game.shadowGen=new BABYLON.ShadowGenerator(1024,Game.light);
        Game.shadowGen.useBlurExponentialShadowMap=true;
      } else if(!Game.settings.shadows && Game.shadowGen){
        Game.shadowGen.dispose(); Game.shadowGen=null;
      }
    }
  });
  $('segGrass').querySelectorAll('button').forEach(b=>b.onclick=()=>{
    $('segGrass').querySelectorAll('button').forEach(x=>x.classList.remove('active'));
    b.classList.add('active'); Game.settings.grass=(b.dataset.g==='on');
    if(Game.scene && Game.scene._grass){ Game.scene._grass.setEnabled(Game.settings.grass); }
  });
  $('segCycle').querySelectorAll('button').forEach(b=>b.onclick=()=>{
    $('segCycle').querySelectorAll('button').forEach(x=>x.classList.remove('active'));
    b.classList.add('active'); Game.settings.cycle=(b.dataset.c==='on');
  });
  const sl=(id,fmt,set)=>{ const el=$(id); el.oninput=()=>{ const v=+el.value; set(v); $(id+'Val').textContent=fmt(v); }; };
  sl('sens', v=>(v/100).toFixed(2), v=>Game.settings.sens=v/100);
  sl('vol',  v=>String(v),          v=>Game.settings.volume=v/100);
  sl('fov',  v=>String(v),          v=>Game.settings.fov=v*Math.PI/180);
  sl('density', v=>String(v),       v=>Game.settings.density=v);
  sl('hills', v=>String(v),         v=>Game.settings.hills=v);

  $('mpConnect').onclick=()=> netConnect($('mpUrl').value.trim(), $('mpName').value.trim()||'Operator');
  $('inv').addEventListener('click',e=>{ if(e.target.id==='inv') toggleInventory(); });
}

window.addEventListener('DOMContentLoaded',()=>{ bindUI(); bindInput(); boot(); });

"use strict";
/* =====================================================================
   VERDANT — core: global state, DOM helpers, math utils, audio
   Heleo2 Studio · Babylon.js · classic-script module (shared globals)
   ===================================================================== */

const Game = {
  state: 'loading',  // loading|menu|settings|mp|howto|playing|paused|over
  settings: { quality:'med', shadows:true, grass:true, cycle:true, sens:1.2, volume:0.6,
              fov:75*Math.PI/180, density:120, hills:60 },
  scene:null, engine:null, camera:null, light:null, hemi:null, shadowGen:null,
  player:null, playerData:null, playerRig:null, heldModel:null, aimFov:null,
  enemies:[], items:[], eBullets:[], corpses:[], grenades:[], fx:[], npcs:[],
  vehicle:null, inVehicle:false, vehYaw:0,
  timeOfDay:0.35, daySpeed:1/150, alarm:0,
  yaw:0, pitch:0.35, vy:0, grounded:true,
  score:0, wave:0, waveActive:false, enemiesToSpawn:0,
  weapons:null, currentWeapon:0, inventory:[], grenadeCount:3,
  keys:{}, mouseDown:false, shake:{t:0,mag:0}, _ePrev:false,
  terrainHills:null,
  net:{ ws:null, connected:false, id:null, name:'Operator', peers:{} },
  audio:null,
  nearItem:null,
};

/* ------------------------- DOM helpers ------------------------- */
const $ = id => document.getElementById(id);
const show = id => $(id).classList.add('show');
const hide = id => $(id).classList.remove('show');
function setState(s){
  Game.state = s;
  ['loader','menu','settings','mp','howto','pause','over','inv'].forEach(hide);
  $('hud').classList.remove('show');
  if(s==='menu') show('menu');
  else if(s==='settings') show('settings');
  else if(s==='mp') show('mp');
  else if(s==='howto') show('howto');
  else if(s==='paused') show('pause');
  else if(s==='over') show('over');
  else if(s==='playing'){ $('hud').classList.add('show'); }
}

/* ------------------------- math utils ------------------------- */
function rand(a,b){ return a + Math.random()*(b-a); }
function clamp(v,a,b){ return Math.max(a,Math.min(b,v)); }
function lerp(a,b,t){ return a+(b-a)*t; }

/* ------------------------- Tiny WebAudio SFX ------------------------- */
function initAudio(){ try{ Game.audio = new (window.AudioContext||window.webkitAudioContext)(); }catch(e){} }
function sfx(type){
  if(!Game.audio || Game.settings.volume<=0) return;
  const ac=Game.audio, t=ac.currentTime, o=ac.createOscillator(), g=ac.createGain();
  o.connect(g); g.connect(ac.destination);
  let f=440, dur=.08, vol=Game.settings.volume*0.25;
  if(type==='pistol'){ f=320; dur=.09; o.type='square'; }
  else if(type==='smg'){ f=300; dur=.05; o.type='square'; }
  else if(type==='rifle'){ f=240; dur=.05; o.type='sawtooth'; }
  else if(type==='shotgun'){ f=140; dur=.16; o.type='sawtooth'; vol*=1.3; }
  else if(type==='hit'){ f=720; dur=.06; o.type='triangle'; }
  else if(type==='kill'){ f=520; dur=.18; o.type='sine'; }
  else if(type==='reload'){ f=180; dur=.12; o.type='sine'; }
  else if(type==='pickup'){ f=880; dur=.12; o.type='sine'; }
  else if(type==='gunpickup'){ f=560; dur=.2; o.type='triangle'; }
  else if(type==='hurt'){ f=110; dur=.18; o.type='sawtooth'; vol*=1.4; }
  else if(type==='enemyfire'){ f=160; dur=.07; o.type='square'; vol*=0.8; }
  else if(type==='throw'){ f=300; dur=.12; o.type='sine'; }
  else if(type==='explosion'){ f=90; dur=.45; o.type='sawtooth'; vol*=1.7; }
  o.frequency.setValueAtTime(f,t);
  if(type==='kill'||type==='pickup'||type==='gunpickup') o.frequency.exponentialRampToValueAtTime(f*2,t+dur);
  if(type==='hurt'||type==='explosion'||type==='throw') o.frequency.exponentialRampToValueAtTime(45,t+dur);
  g.gain.setValueAtTime(vol,t); g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
  o.start(t); o.stop(t+dur);
}

/* small camera kick used by explosions / heavy hits */
function addShake(mag){ Game.shake.mag=Math.max(Game.shake.mag,mag); Game.shake.t=Math.max(Game.shake.t,0.35); }

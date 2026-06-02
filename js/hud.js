"use strict";
/* =====================================================================
   VERDANT — HUD: meters, ammo, grenades, toasts, interaction prompt
   ===================================================================== */
let toastT=null;
function toast(msg){ const t=$('toast'); t.textContent=msg; t.classList.add('show');
  clearTimeout(toastT); toastT=setTimeout(()=>t.classList.remove('show'),1600); }
function refreshHP(){ $('hpFill').style.width=Math.max(0,Game.playerData.hp)+'%'; }
function refreshSP(){ $('spFill').style.width=Math.max(0,Game.playerData.stamina)+'%'; }
function refreshGrenades(){ $('nadeCount').textContent=Game.grenadeCount; }
function refreshAmmoHUD(){
  const w=Game.weapons[Game.currentWeapon];
  $('wName').textContent=w.name; $('ammoMag').textContent=w.ammo;
  $('ammoRes').textContent=' / '+w.reserve;
}
function setPrompt(text){
  const el=$('prompt');
  if(text){ $('promptTxt').textContent=text; el.classList.add('show'); }
  else el.classList.remove('show');
}
function updateHUD(){
  $('scoreLbl').textContent=Game.score;
  $('enemyCount').textContent=Game.enemies.length;
}

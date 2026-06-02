"use strict";
/* =====================================================================
   VERDANT — environment: animated day / night cycle
   Drives the sun direction + intensity, hemispheric fill, fog and sky
   colour from Game.timeOfDay (0..1, 0.5 = noon). Cheap, no extra meshes.
   ===================================================================== */
function updateDayNight(dt){
  if(!Game.settings.cycle || !Game.light) return;
  Game.timeOfDay = (Game.timeOfDay + dt*Game.daySpeed) % 1;
  const t = Game.timeOfDay;
  const az = t*Math.PI*2;
  const elev = Math.sin(t*Math.PI*2 - Math.PI/2);   // -1 midnight .. +1 noon
  const up = Math.max(0, elev);
  const horizon = 1 - Math.abs(elev);                // dawn/dusk warmth

  // sun travels across the sky
  Game.light.direction = new BABYLON.Vector3(-Math.cos(az)*0.6, -(0.18+up), -Math.sin(az)*0.6).normalize();
  Game.light.intensity = 0.05 + up*1.05;
  Game.light.diffuse = new BABYLON.Color3(1, 0.78 - horizon*0.2 + up*0.2, 0.55 - horizon*0.25 + up*0.35);

  if(Game.hemi) Game.hemi.intensity = 0.16 + up*0.5;

  // sky + fog lerp between night and day
  const nr=0.02,ng=0.03,nb=0.06, dr=0.05,dg=0.09,db=0.07;
  const r=lerp(nr,dr,up)+horizon*0.04, g=lerp(ng,dg,up)+horizon*0.02, b=lerp(nb,db,up);
  if(Game.scene){
    Game.scene.clearColor = new BABYLON.Color4(r,g,b,1);
    Game.scene.fogColor   = new BABYLON.Color3(r*1.2,g*1.2,b*1.1);
  }
}

// human-readable clock for the HUD (24h from timeOfDay)
function clockString(){
  const mins = Math.floor(Game.timeOfDay*24*60);
  const h = Math.floor(mins/60), m = mins%60;
  return String(h).padStart(2,'0')+':'+String(m).padStart(2,'0');
}

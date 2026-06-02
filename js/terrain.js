"use strict";
/* =====================================================================
   VERDANT — terrain: procedural hilly heightfield
   Cheap deterministic sum-of-waves field. Sampled to displace the ground
   mesh at build time and to keep player / enemies / props / grass glued
   to the surface at runtime. The amplitude is frozen at build time (see
   buildWorld) so the static mesh and the runtime clamps never desync.
   ===================================================================== */
function terrainHeight(x,z){
  const amp = (Game.terrainHills!=null?Game.terrainHills:Game.settings.hills)/60; // 0..~1.7
  if(amp<=0.001) return 0;
  let h = Math.sin(x*0.055)*Math.cos(z*0.05)*3.2
        + Math.sin(x*0.13+1.7)*1.3
        + Math.cos(z*0.105-0.6)*1.5
        + Math.sin((x+z)*0.04)*1.1;
  // flatten a clearing around the origin spawn point
  const d = Math.hypot(x,z);
  const flat = clamp((d-10)/16, 0, 1);
  return h*amp*flat;
}

"use strict";
/* =====================================================================
   VERDANT — minimap / radar (2D canvas overlay, player-up rotation)
   ===================================================================== */
function updateMinimap(){
  const cv=$('minimap'); if(!cv || !cv.getContext) return;
  const ctx=cv.getContext('2d'); if(!ctx) return;
  const S=cv.width, R=S/2, range=85;
  const p=Game.player, yaw=Game.yaw;
  const cy=Math.cos(yaw), sy=Math.sin(yaw);

  ctx.clearRect(0,0,S,S);
  ctx.save();
  ctx.beginPath(); ctx.arc(R,R,R-1,0,Math.PI*2); ctx.clip();
  ctx.fillStyle='rgba(5,12,8,0.72)'; ctx.fillRect(0,0,S,S);

  function plot(wx,wz,color,size){
    const dx=wx-p.position.x, dz=wz-p.position.z;
    const lx=dx*cy - dz*sy;          // into player-local frame
    const lz=dx*sy + dz*cy;
    const mx=R + lx/range*R, my=R - lz/range*R; // forward = up
    if(Math.hypot(mx-R,my-R)>R-3) return;
    ctx.fillStyle=color; ctx.beginPath(); ctx.arc(mx,my,size,0,Math.PI*2); ctx.fill();
  }

  Game.items.forEach(it=>plot(it.mesh.position.x,it.mesh.position.z, it.type==='weapon'?'#ffb347':'#6fbf57',2));
  Game.npcs.forEach(n=>plot(n.body.position.x,n.body.position.z,'#9aa7a0',2));
  if(Game.vehicle && !Game.inVehicle) plot(Game.vehicle.body.position.x,Game.vehicle.body.position.z,'#3fa7ff',3);
  Game.enemies.forEach(e=>plot(e.body.position.x,e.body.position.z, e.ranged?'#ff8a3d':'#ff4d4d',2.6));
  Object.values(Game.net.peers).forEach(pr=>plot(pr.body.position.x,pr.body.position.z,'#9bf067',2.6));
  ctx.restore();

  // rim + player arrow
  ctx.strokeStyle='rgba(155,240,103,0.35)'; ctx.lineWidth=1.5;
  ctx.beginPath(); ctx.arc(R,R,R-1,0,Math.PI*2); ctx.stroke();
  ctx.fillStyle='#9bf067';
  ctx.beginPath(); ctx.moveTo(R,R-7); ctx.lineTo(R-5,R+6); ctx.lineTo(R+5,R+6); ctx.closePath(); ctx.fill();
}

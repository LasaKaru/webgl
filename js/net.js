"use strict";
/* =====================================================================
   VERDANT — multiplayer client (relay server in server.js)
   Protocol (JSON over WebSocket):
     -> {t:'join', name}            (client→server)
     -> {t:'state', x,y,z,ry}       (client→server, ~12/s)
     <- {t:'welcome', id}
     <- {t:'peers', list:[{id,name,x,y,z,ry}]}
     <- {t:'leave', id}
   ===================================================================== */
function netConnect(url,name){
  try{ Game.net.ws=new WebSocket(url); }
  catch(e){ toast('BAD URL'); return; }
  Game.net.name=name;
  const ws=Game.net.ws;
  ws.onopen=()=>{ Game.net.connected=true; ws.send(JSON.stringify({t:'join',name})); setNetUI(true); };
  ws.onclose=()=>{ Game.net.connected=false; setNetUI(false); clearPeers(); };
  ws.onerror=()=>{ toast('CONNECTION FAILED'); };
  ws.onmessage=ev=>{
    let m; try{ m=JSON.parse(ev.data); }catch{ return; }
    if(m.t==='welcome'){ Game.net.id=m.id; }
    else if(m.t==='peers'){ syncPeers(m.list); }
    else if(m.t==='leave'){ removePeer(m.id); }
  };
}
let lastNet=0;
function netSend(){
  const n=Game.net; if(!n.connected||!n.ws) return;
  const now=performance.now(); if(now-lastNet<80) return; lastNet=now;
  const p=Game.player;
  n.ws.send(JSON.stringify({t:'state',x:p.position.x,y:p.position.y,z:p.position.z,ry:p.rotation.y}));
}
function syncPeers(list){
  if(!Game.scene) return;
  for(const pr of list){
    if(pr.id===Game.net.id) continue;
    let peer=Game.net.peers[pr.id];
    if(!peer){
      // remote players are full humanoids too (amber palette)
      const body=new BABYLON.TransformNode('peer',Game.scene);
      const rig=buildHumanoid(Game.scene,{ skin:[0.85,0.68,0.55], shirt:[0.85,0.6,0.18],
        pants:[0.2,0.2,0.24], em:[0.18,0.12,0.02] });
      rig.root.parent=body;
      peer={ body, rig }; Game.net.peers[pr.id]=peer;
    }
    peer.body.position.set(pr.x,pr.y-0.95,pr.z); peer.body.rotation.y=pr.ry;
    animateHumanoid(peer.rig, 0.016, { moving:true, run:false, speed:4, aiming:false, attack:null });
  }
}
function removePeer(id){ const p=Game.net.peers[id]; if(p){ if(p.rig.gltf) stopGltfRig(p.rig); p.body.dispose(false,true); p.rig.root.dispose(); delete Game.net.peers[id]; } }
function clearPeers(){ Object.keys(Game.net.peers).forEach(removePeer); }
function setNetUI(on){
  ['netDot','hudNet'].forEach(id=>$(id).classList.toggle('on',on));
  $('netStat').textContent = on?('Connected as '+Game.net.name):'Offline — single player';
  $('hudNetTxt').textContent = on?'ONLINE':'SOLO';
}

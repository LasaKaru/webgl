"use strict";
/* =====================================================================
   VERDANT — inventory: owned weapons + consumables grid
   ===================================================================== */
const ITEM_DEFS={
  pistol:{ico:'🔫',nm:'PISTOL'}, smg:{ico:'🔫',nm:'SMG'},
  rifle:{ico:'🪖',nm:'RIFLE'},  shotgun:{ico:'🔫',nm:'SHOTGUN'},
  medkit:{ico:'➕',nm:'MEDKIT'}, grenade:{ico:'💣',nm:'GRENADE'},
};
function initInventory(){
  Game.inventory=[ {key:'medkit',qty:2} ];
}
function addToInventory(key,qty){
  const ex=Game.inventory.find(i=>i.key===key);
  if(ex) ex.qty+=qty; else Game.inventory.push({key,qty});
}
function renderInventory(){
  const g=$('invGrid'); if(!g) return; g.innerHTML='';
  // owned weapons first
  const cells=[];
  Game.weapons.forEach((w,idx)=>{ if(w.owned) cells.push({weapon:idx,key:w.id}); });
  Game.inventory.forEach(it=>cells.push(it));
  for(let i=0;i<10;i++){
    const item=cells[i];
    const slot=document.createElement('div'); slot.className='slot';
    if(item){
      const def=ITEM_DEFS[item.key]||{ico:'?',nm:item.key};
      const equipped = item.weapon!==undefined && item.weapon===Game.currentWeapon;
      if(equipped) slot.classList.add('equipped');
      slot.innerHTML=`<span class="nm">${def.nm}</span><span class="ico">${def.ico}</span>`+
        (item.qty>1?`<span class="qty">x${item.qty}</span>`:'');
      slot.onclick=()=>useInventory(item);
    }
    g.appendChild(slot);
  }
}
function useInventory(item){
  if(item.weapon!==undefined){
    Game.currentWeapon=item.weapon; equipWeaponModel(); refreshAmmoHUD(); renderInventory(); sfx('reload');
  } else if(item.key==='medkit' && item.qty>0){
    if(Game.playerData.hp>=100){ toast('HP ALREADY FULL'); return; }
    Game.playerData.hp=clamp(Game.playerData.hp+40,0,100); item.qty--;
    if(item.qty<=0) Game.inventory=Game.inventory.filter(x=>x!==item);
    refreshHP(); renderInventory(); sfx('pickup'); toast('+40 HP');
  }
}

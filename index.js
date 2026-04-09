const canvas = document.getElementById('game'); const ctx = canvas.getContext('2d');
const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

// 🖼️ UI Elements
const screens = { menu: document.getElementById('menu'), hud: document.getElementById('hud'), shop: document.getElementById('shop'), achieve: document.getElementById('achievements'), gameOver: document.getElementById('gameOver') };
const ui = {
  name: document.getElementById('playerName'), start: document.getElementById('startBtn'), shopBtn: document.getElementById('shopBtn'), closeShop: document.getElementById('closeShop'),
  achieveBtn: document.getElementById('achieveBtn'), closeAchieve: document.getElementById('closeAchieve'), menuBtn: document.getElementById('menuBtn'),
  mapSelect: document.getElementById('mapSelect'), timeAttack: document.getElementById('timeAttackToggle'),
  menuCoins: document.getElementById('menuCoins'), hudCoins: document.getElementById('hudCoins'), shopCoinsVal: document.getElementById('shopCoinsVal'),
  hudName: document.getElementById('hudName'), speed: document.getElementById('speed'), lap: document.getElementById('lap'), totalLaps: document.getElementById('totalLaps'),
  nitroBar: document.getElementById('nitroBar'), nitroCount: document.getElementById('nitroCount'), ghostInd: document.getElementById('ghostIndicator'), ghostDiff: document.getElementById('ghostDiff'),
  finalTime: document.getElementById('finalTime'), finalMode: document.getElementById('finalMode'), rewardBase: document.getElementById('rewardBase'), rewardBonus: document.getElementById('rewardBonus'), rewardTotal: document.getElementById('rewardTotal'),
  restart: document.getElementById('restartBtn'), skinGrid: document.getElementById('skinGrid'), buyNitro: document.getElementById('buyNitro'), tabs: document.querySelectorAll('.tab'),
  panels: { skins: document.getElementById('skinsPanel'), nitro: document.getElementById('nitroPanel') }, achieveList: document.getElementById('achieveList'),
  toast: document.getElementById('toast'), toastText: document.getElementById('toastText')
};

function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
window.addEventListener('resize', resize); resize();
if(isMobile) document.getElementById('mobileControls').classList.remove('hidden');

// 💾 Dados & Persistência
let gameData = { coins: 1500, ownedSkins: ['default_car','default_moto'], selectedCar: 'default_car', selectedMoto: 'default_moto', nitro: 3, achievements: {}, bestGhost: {} };
function load() { try { const d = JSON.parse(localStorage.getItem('racing_data')); if(d) Object.assign(gameData, d); } catch {} }
function save() { localStorage.setItem('racing_data', JSON.stringify(gameData)); updateCoinUI(); }
function updateCoinUI() { ui.menuCoins.textContent = gameData.coins; ui.hudCoins.textContent = gameData.coins; ui.shopCoinsVal.textContent = gameData.coins; }

// 🗺️ Mapas
const MAPS = [
  { id: 'classic', name: 'Circuito Clássico', width: 130, laps: 3, theme: '#1a472a', pts: [{x:600,y:600},{x:1400,y:500},{x:1800,y:900},{x:1500,y:1400},{x:800,y:1500},{x:300,y:1000},{x:600,y:600}] },
  { id: 'coast', name: 'Costa Veloz', width: 110, laps: 4, theme: '#0f172a', pts: [{x:500,y:400},{x:1200,y:300},{x:1600,y:600},{x:1400,y:1100},{x:800,y:1300},{x:200,y:1000},{x:300,y:700},{x:500,y:400}] },
  { id: 'city', name: 'Centro Urbano', width: 100, laps: 5, theme: '#18181b', pts: [{x:700,y:700},{x:1100,y:400},{x:1600,y:500},{x:1700,y:1000},{x:1300,y:1400},{x:800,y:1300},{x:400,y:1000},{x:500,y:800},{x:700,y:700}] }
];
MAPS.forEach((m,i)=>{ const opt=document.createElement('option'); opt.value=i; opt.textContent=m.name; ui.mapSelect.appendChild(opt); });
ui.mapSelect.value = gameData.selectedMap || 0;

function buildTrack(mapIdx) {
  const m = MAPS[mapIdx];
  let center = [], pts = m.pts;
  for(let i=0;i<pts.length;i++){
    const p0=pts[(i-1+pts.length)%pts.length], p1=pts[i], p2=pts[(i+1)%pts.length], p3=pts[(i+2)%pts.length];
    for(let t=0;t<=1;t+=0.04){
      const t2=t*t, t3=t2*t;
      const x=0.5*((2*p1.x)+(-p0.x+p2.x)*t+(2*p0.x-5*p1.x+4*p2.x-p3.x)*t2+(-p0.x+3*p1.x-3*p2.x+p3.x)*t3);
      const y=0.5*((2*p1.y)+(-p0.y+p2.y)*t+(2*p0.y-5*p1.y+4*p2.y-p3.y)*t2+(-p0.y+3*p1.y-3*p2.y+p3.y)*t3);
      center.push({x,y});
    }
  }
  return { center, width: m.width, laps: m.laps, theme: m.theme, cps: [{x:center[0].x,y:center[0].y,r:60}, {x:center[Math.floor(center.length/3)].x,y:center[Math.floor(center.length/3)].y,r:50}, {x:center[Math.floor(center.length*2/3)].x,y:center[Math.floor(center.length*2/3)].y,r:50}] };
}

let currentTrack = buildTrack(0);

// 🎨 Skins
const SKINS = [
  {id:'default_car',name:'Padrão',type:'car',price:0,color:'#0284c7'}, {id:'red_car',name:'Racing',type:'car',price:500,color:'#ef4444'},
  {id:'gold_car',name:'Ouro',type:'car',price:1500,color:'#f59e0b'}, {id:'neon_car',name:'Neon',type:'car',price:2000,color:'#10b981'},
  {id:'default_moto',name:'Padrão',type:'moto',price:0,color:'#e11d48'}, {id:'blue_moto',name:'Azul',type:'moto',price:400,color:'#3b82f6'},
  {id:'black_moto',name:'Carbono',type:'moto',price:1200,color:'#111827'}, {id:'white_moto',name:'Pérola',type:'moto',price:1800,color:'#f8fafc'}
];
function renderShop() {
  ui.skinGrid.innerHTML = '';
  const type = vehicle.isMoto ? 'moto' : 'car';
  const sel = vehicle.isMoto ? gameData.selectedMoto : gameData.selectedCar;
  SKINS.filter(s=>s.type===type).forEach(s=>{
    const owned = gameData.ownedSkins.includes(s.id), eq = s.id===sel;
    const card = document.createElement('div');
    card.className = `skin-card ${owned?'owned':''} ${eq?'selected':''}`;
    card.innerHTML = `<div class="skin-preview" style="background:${s.color}"></div><div class="skin-name">${s.name}</div><div class="skin-price">${owned?'✅':'💰 '+s.price}</div><button class="${owned?'equip-btn':'buy-btn'}" ${!owned&&gameData.coins<s.price?'disabled':''}>${owned?(eq?'EQUIPADA':'EQUIPAR'):'COMPRAR'}</button>`;
    card.querySelector('button').onclick = () => {
      if(owned){ if(vehicle.isMoto)gameData.selectedMoto=s.id; else gameData.selectedCar=s.id; save(); renderShop(); }
      else if(gameData.coins>=s.price){ gameData.coins-=s.price; gameData.ownedSkins.push(s.id); if(vehicle.isMoto)gameData.selectedMoto=s.id; else gameData.selectedCar=s.id; save(); renderShop(); }
    };
    ui.skinGrid.appendChild(card);
  });
}

// 🏆 Conquistas
const ACHIEVEMENTS = [
  {id:'first_race',name:'Primeira Volta',desc:'Complete 1 corrida',reward:200,icon:'🏁',check:d=>d.races>=1},
  {id:'drift_master',name:'Rei do Drift',desc:'Faça 600pts de drift',reward:300,icon:'💨',check:d=>d.maxDrift>=600},
  {id:'speed_demon',name:'Demônio Veloz',desc:'Termine em <80s',reward:500,icon:'⚡',check:d=>d.fastest<80},
  {id:'trophy_hunter',name:'Colecionador',desc:'Desbloqueie 3 conquistas',reward:1000,icon:'👑',check:d=>Object.values(gameData.achievements).filter(v=>v).length>=3},
  {id:'nitro_junkie',name:'Viciado em Nitro',desc:'Use nitro 10 vezes',reward:250,icon:'🔥',check:d=>d.nitroUses>=10},
  {id:'map_explorer',name:'Explorador',desc:'Corra em 2 mapas diferentes',reward:400,icon:'🗺️',check:d=>d.mapsPlayed.size>=2}
];
let progress = { races:0, maxDrift:0, fastest:Infinity, nitroUses:0, mapsPlayed:new Set() };
function loadProgress() { try { const p=JSON.parse(localStorage.getItem('racing_prog')); if(p){Object.assign(progress,p); progress.mapsPlayed=new Set(p.mapsPlayed);} } catch {} }
function saveProgress() { const s={...progress, mapsPlayed:Array.from(progress.mapsPlayed)}; localStorage.setItem('racing_prog',JSON.stringify(s)); }
function checkAchievements() {
  ACHIEVEMENTS.forEach(a=>{ if(!gameData.achievements[a.id] && a.check(progress)) { gameData.achievements[a.id]=true; gameData.coins+=a.reward; save(); showToast(`${a.icon} ${a.name}! +${a.reward}💰`); } });
}
function showToast(text) { ui.toastText.textContent=text; ui.toast.classList.remove('hidden'); ui.toast.classList.add('active'); setTimeout(()=>ui.toast.classList.replace('active','hidden'),3000); }
function renderAchievements() {
  ui.achieveList.innerHTML = ACHIEVEMENTS.map(a=>`<div class="achieve-card ${gameData.achievements[a.id]?'unlocked':''}"><div class="achieve-icon">${gameData.achievements[a.id]?a.icon:'🔒'}</div><div class="achieve-info"><h4>${a.name}</h4><p>${a.desc} (+${a.reward}💰)</p></div></div>`).join('');
}

// 📱 Controles Mobile
const keys = {};
window.addEventListener('keydown', e => keys[e.key.toLowerCase()] = true);
window.addEventListener('keyup', e => keys[e.key.toLowerCase()] = false);
const joystick = document.getElementById('joystickArea'), knob = document.getElementById('joystickKnob');
let jx=0, jy=0, jTouch=null;
joystick.addEventListener('touchstart', e=>{ jTouch=e.touches[0].identifier; e.preventDefault(); }, {passive:false});
window.addEventListener('touchmove', e=>{
  for(let t of e.touches){
    if(t.identifier===jTouch){
      const r=joystick.getBoundingClientRect();
      let dx=(t.clientX-r.left-r.width/2)/(r.width/2), dy=(t.clientY-r.top-r.height/2)/(r.height/2);
      const len=Math.hypot(dx,dy); if(len>1){dx/=len; dy/=len;}
      jx=dx; jy=dy; knob.style.transform=`translate(${dx*35}px, ${dy*35}px)`;
      keys['arrowup']=dy<-0.3; keys['arrowdown']=dy>0.3; keys['arrowleft']=dx<-0.3; keys['arrowright']=dx>0.3;
    }
  }
});
window.addEventListener('touchend', e=>{
  for(let t of e.changedTouches) if(t.identifier===jTouch){ jTouch=null; jx=jy=0; knob.style.transform='translate(-50%,-50%)'; keys.arrowup=keys.arrowdown=keys.arrowleft=keys.arrowright=false; }
});
['btnBrake','btnNitro','btnHandbrake'].forEach(id=>{
  const el=document.getElementById(id);
  el.addEventListener('touchstart', e=>{ e.preventDefault(); keys[id==='btnBrake'?'s':id==='btnNitro'?'shift':' ']=true; el.style.transform='scale(0.9)'; });
  el.addEventListener('touchend', e=>{ keys[id==='btnBrake'?'s':id==='btnNitro'?'shift':' ']=false; el.style.transform=''; });
});

// 👻 Ghost & Time Attack
let ghostData = null, ghostIndex = 0, ghostTimer = 0;
let runPositions = [], recording = false;
function saveGhost(trackId, type) {
  const key = `${trackId}_${type}`;
  if(runPositions.length < 10) return;
  const time = performance.now() - raceStartTime;
  if(!gameData.bestGhost[key] || time < gameData.bestGhost[key].time) {
    gameData.bestGhost[key] = { positions: runPositions, time };
    save();
  }
}
function loadGhost(trackId, type) {
  const key = `${trackId}_${type}`;
  return gameData.bestGhost[key] || null;
}

// 🚗 Veículo
class Vehicle {
  constructor(isMoto=false){
    this.isMoto=isMoto; this.pos={x:currentTrack.center[0].x,y:currentTrack.center[0].y}; this.vel={x:0,y:0}; this.heading=0;
    this.rpm=800; this.gear=1; this.maxGear=5; this.gForce=0; this.wallImpact=0; this.driftScore=0; this.driftTimer=0;
    this.mass=isMoto?250:1400; this.power=isMoto?12000:180000; this.drag=0.35; this.rollResistance=0.02;
    this.maxSteer=isMoto?0.055:0.045; this.lateralGrip=isMoto?0.75:0.85; this.driftThreshold=isMoto?2.8:2.2;
    this.nitroActive=false; this.nitroTimer=0; this.nitroCooldown=0;
    applySkin();
  }
  update(dt){
    if(!engineRunning) return;
    const throttle=keys['arrowup']||keys['w']?1:0, brake=keys['arrowdown']||keys['s']?1:0;
    const steer=(keys['arrowleft']||keys['a']?-1:0)+(keys['arrowright']||keys['d']?1:0);
    const handbrake=keys[' ']?1:0;

    if(keys['shift']&&gameData.nitro>0&&!this.nitroActive&&this.nitroCooldown<=0){
      this.nitroActive=true; this.nitroTimer=2.5; gameData.nitro--; progress.nitroUses++; saveProgress(); save();
    }
    if(this.nitroActive){this.nitroTimer-=dt; if(this.nitroTimer<=0){this.nitroActive=false;this.nitroCooldown=4;}}
    if(this.nitroCooldown>0) this.nitroCooldown-=dt;
    const nitroMult=this.nitroActive?1.4:1.0;

    const fx=Math.cos(this.heading), fy=Math.sin(this.heading), rx=-Math.sin(this.heading), ry=Math.cos(this.heading);
    let vLong=this.vel.x*fx+this.vel.y*fy, vLat=this.vel.x*rx+this.vel.y*ry;

    let minD=Infinity, closest=null;
    for(let p of currentTrack.center){let d=Math.hypot(this.pos.x-p.x,this.pos.y-p.y);if(d<minD){minD=d;closest=p;}}
    let onGrass=minD>currentTrack.width*0.65, gripMult=onGrass?0.45:1.0;

    let targetRPM=800+(vLong/(this.isMoto?16:14))*6500; targetRPM=Math.max(800,Math.min(8500,targetRPM)); this.rpm+=(targetRPM-this.rpm)*0.1;
    this.gear=Math.min(this.maxGear,Math.max(1,Math.ceil(this.rpm/1800)));
    let powerForce=throttle*this.power*(1-(this.rpm-800)/7700)/(this.gear*0.8)*nitroMult;
    let engineForce=powerForce-(brake?25000:0)-vLong*this.drag*(onGrass?1.8:1.0)-this.mass*this.rollResistance*Math.sign(vLong);
    let steerFactor=this.maxSteer*(1-Math.abs(vLong)/(this.isMoto?22:18)*0.4);
    this.heading+=steer*steerFactor*dt*60;
    let latForce=-vLat*this.lateralGrip*gripMult*120*(1-handbrake*0.6);
    let newVLong=vLong+(engineForce/this.mass)*dt, newVLat=vLat+(latForce/this.mass)*dt;
    newVLat*=(1-0.08*gripMult); this.gForce=Math.sqrt((engineForce/this.mass)**2+(latForce/this.mass)**2)/9.81;

    if(Math.abs(newVLat)>this.driftThreshold){ this.driftScore+=Math.abs(newVLat)*dt*10; this.driftTimer+=dt; }
    else { if(this.driftTimer>0.3) progress.maxDrift=Math.max(progress.maxDrift, Math.floor(this.driftScore)); this.driftScore*=0.9; this.driftTimer=0; }

    this.vel.x=fx*newVLong+rx*newVLat; this.vel.y=fy*newVLong+ry*newVLat;
    this.pos.x+=this.vel.x*dt*60; this.pos.y+=this.vel.y*dt*60;

    const maxDist=currentTrack.width/2;
    if(minD>maxDist&&closest){
      const to={x:this.pos.x-closest.x,y:this.pos.y-closest.y}, dist=Math.hypot(to.x,to.y);
      const push=(dist-maxDist)+1, nx=to.x/dist, ny=to.y/dist;
      this.pos.x-=nx*push; this.pos.y-=ny*push;
      const dot=this.vel.x*nx+this.vel.y*ny; this.vel.x-=1.6*dot*nx; this.vel.y-=1.6*dot*ny;
      this.wallImpact=1.0; if(audioCtx&&dot>2){gain.gain.setTargetAtTime(0.12,audioCtx.currentTime,0.01);osc.frequency.setTargetAtTime(osc.frequency.value+40,audioCtx.currentTime,0.01);}
    } else this.wallImpact*=0.9;

    if(recording) runPositions.push({x:this.pos.x,y:this.pos.y,h:this.heading,t:performance.now()-raceStartTime});
  }
  draw(ctx, alpha=1){
    ctx.save(); ctx.translate(this.pos.x,this.pos.y); ctx.rotate(this.heading);
    ctx.globalAlpha=alpha;
    if(this.wallImpact>0.05){ctx.fillStyle=`rgba(255,50,50,${this.wallImpact*0.5})`;ctx.beginPath();ctx.arc(0,0,25,0,Math.PI*2);ctx.fill();}
    if(this.nitroActive){ctx.fillStyle='rgba(249,115,22,0.4)';ctx.beginPath();ctx.arc(0,14,16+Math.random()*5,0,Math.PI*2);ctx.fill();}
    ctx.fillStyle=this.color||'#888'; const w=this.isMoto?10:18, h=this.isMoto?26:38;
    ctx.fillRect(-w/2,-h/2,w,h);
    ctx.fillStyle='#fde047';ctx.beginPath();ctx.arc(-5,-h/2-3,3,0,Math.PI*2);ctx.arc(5,-h/2-3,3,0,Math.PI*2);ctx.fill();
    ctx.restore(); ctx.globalAlpha=1;
  }
}
let vehicle = new Vehicle(false);

// 📷 Câmera
const cam={x:0,y:0,zoom:1,rot:0};
function updateCam(dt){
  const spd=Math.hypot(vehicle.vel.x,vehicle.vel.y);
  cam.zoom+=((1.3-Math.min(0.5,spd/35))-cam.zoom)*0.05;
  cam.rot+=(-vehicle.heading*0.15-cam.rot)*0.08;
  cam.x+=(vehicle.pos.x-canvas.width/2/cam.zoom-cam.x)*0.06;
  cam.y+=(vehicle.pos.y-canvas.height/2/cam.zoom-cam.y)*0.06;
}

// 🏁 Lógica
let gameState='menu', playerName='', raceStartTime=0, currentCP=0, laps=0, finished=false, engineRunning=false, timeAttackMode=false;
let audioCtx, osc, gain;
function initAudio(){ if(audioCtx)return; audioCtx=new(window.AudioContext||window.webkitAudioContext)(); osc=audioCtx.createOscillator(); gain=audioCtx.createGain(); osc.type='sawtooth'; osc.frequency.value=80; gain.gain.value=0; osc.connect(gain).connect(audioCtx.destination); osc.start(); engineRunning=true; }

function checkCP(){
  if(finished)return;
  const cp=currentTrack.cps[currentCP], d=Math.hypot(vehicle.pos.x-cp.x, vehicle.pos.y-cp.y);
  if(d<cp.r){ currentCP=(currentCP+1)%currentTrack.cps.length; if(currentCP===0){ laps++; ui.lap.textContent=Math.min(laps,currentTrack.laps); if(laps>=currentTrack.laps) finishRace(); } }
}
function formatTime(ms){const s=ms/1000;return `${Math.floor(s/60).toString().padStart(2,'0')}:${Math.floor(s%60).toString().padStart(2,'0')}.${Math.floor((s%1)*10)}`;}

function finishRace(){
  finished=true; const ms=performance.now()-raceStartTime, timeSec=ms/1000;
  if(timeAttackMode) saveGhost(MAPS[ui.mapSelect.value].id, vehicle.isMoto?'moto':'car');
  progress.races++; progress.fastest=Math.min(progress.fastest, timeSec); progress.mapsPlayed.add(MAPS[ui.mapSelect.value].id); saveProgress();
  let base=500, bonus=Math.round(vehicle.driftScore*2);
  if(timeSec<95)bonus+=250; if(timeSec<80)bonus+=250; if(Object.keys(gameData.bestGhost).length>0&&timeSec<=gameData.bestGhost[`${MAPS[ui.mapSelect.value].id}_${vehicle.isMoto?'moto':'car'}`].time)bonus+=300;
  gameData.coins+=base+bonus; save(); checkAchievements();
  ui.finalTime.textContent=formatTime(ms); ui.finalMode.textContent=timeAttackMode?'⏱️ Time Attack':'🏁 Normal';
  ui.rewardBase.textContent=base; ui.rewardBonus.textContent=bonus; ui.rewardTotal.textContent=base+bonus;
  gameState='finished'; showScreen(screens.gameOver);
}

// 💾 Leaderboard
function loadLB(){try{return JSON.parse(localStorage.getItem('racing_lb')||'[]');}catch{return[];}}
function saveLB(name,time){let lb=loadLB();lb.push({name,time,date:Date.now()});lb.sort((a,b)=>a.time-b.time);lb=lb.slice(0,20);localStorage.setItem('racing_lb',JSON.stringify(lb));renderLB();}
function renderLB(){const lb=loadLB().slice(0,5);document.getElementById('leaderboardBody').innerHTML=lb.map((r,i)=>`<tr><td>${i+1}</td><td>${r.name}</td><td>${formatTime(r.time*1000)}</td></tr>`).join('');}

// 🎮 Telas
function showScreen(s){Object.values(screens).forEach(sc=>{sc.classList.remove('active');sc.classList.add('hidden');});s.classList.remove('hidden');s.classList.add('active');if(s===screens.hud){ui.hudName.textContent=playerName;ui.totalLaps.textContent=currentTrack.laps;}}
function resetRace(){
  const mapIdx=parseInt(ui.mapSelect.value);
  currentTrack=buildTrack(mapIdx);
  timeAttackMode=ui.timeAttack.checked;
  vehicle=new Vehicle(false); laps=0; currentCP=1; finished=false; runPositions=[]; recording=true;
  raceStartTime=performance.now(); ui.lap.textContent='0'; ui.nitroCount.textContent=gameData.nitro; ui.nitroBar.style.width='100%';
  ghostData=null; ghostIndex=0; ghostTimer=0;
  if(timeAttackMode){
    const key=`${MAPS[mapIdx].id}_${vehicle.isMoto?'moto':'car'}`;
    ghostData=gameData.bestGhost[key]||null;
    ui.ghostInd.classList.toggle('hidden',!ghostData);
  } else ui.ghostInd.classList.add('hidden');
}

ui.start.onclick=()=>{playerName=ui.name.value.trim()||'Anônimo';initAudio();resetRace();showScreen(screens.hud);gameState='playing';};
ui.shopBtn.onclick=()=>{renderShop();showScreen(screens.shop);};
ui.achieveBtn.onclick=()=>{renderAchievements();showScreen(screens.achieve);};
ui.closeShop.onclick=()=>showScreen(screens.menu);
ui.closeAchieve.onclick=()=>showScreen(screens.menu);
ui.restart.onclick=()=>{resetRace();showScreen(screens.hud);gameState='playing';};
ui.menuBtn.onclick=()=>{gameState='menu';showScreen(screens.menu);renderLB();};
ui.buyNitro.onclick=()=>{if(gameData.coins>=300){gameData.coins-=300;gameData.nitro+=3;save();renderShop();}};
ui.tabs.forEach(tab=>tab.onclick=()=>{ui.tabs.forEach(t=>t.classList.remove('active'));Object.values(ui.panels).forEach(p=>p.classList.remove('active'));tab.classList.add('active');ui.panels[tab.dataset.tab].classList.add('active');if(tab.dataset.tab==='skins')renderShop();});

window.addEventListener('keydown', e=>{if(gameState==='playing'&&e.key.toLowerCase()==='t'){vehicle=new Vehicle(!vehicle.isMoto);if(timeAttackMode){resetRace();showScreen(screens.hud);gameState='playing';}}});

// 🖼️ Loop
function drawTrack(){
  ctx.fillStyle=currentTrack.theme; ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.save(); ctx.scale(cam.zoom,cam.zoom); ctx.translate(-cam.x,-cam.y); ctx.rotate(cam.rot);
  ctx.strokeStyle='#2d2d35'; ctx.lineWidth=currentTrack.width; ctx.lineCap='round'; ctx.lineJoin='round';
  ctx.beginPath(); currentTrack.center.forEach((p,i)=>i===0?ctx.moveTo(p.x,p.y):ctx.lineTo(p.x,p.y)); ctx.closePath(); ctx.stroke();
  ctx.strokeStyle='#ffffff'; ctx.lineWidth=currentTrack.width+12; ctx.setLineDash([20,20]); ctx.stroke();
  ctx.strokeStyle='#ef4444'; ctx.lineDashOffset=20; ctx.stroke(); ctx.setLineDash([]);
  currentTrack.cps.forEach((cp,i)=>{const a=i===currentCP;ctx.fillStyle=a?'rgba(34,197,94,0.25)':'rgba(255,255,255,0.05)';ctx.beginPath();ctx.arc(cp.x,cp.y,cp.r,0,Math.PI*2);ctx.fill();ctx.strokeStyle=a?'#22c55e':'#555';ctx.lineWidth=2;ctx.stroke();});
  ctx.restore();
}

let lastTime=performance.now();
function loop(now){
  const dt=Math.min((now-lastTime)/1000,0.04); lastTime=now;
  if(gameState==='playing'){
    vehicle.update(dt); checkCP(); updateCam(dt);
    if(ghostData){
      ghostTimer+=dt;
      const targetTime=ghostTimer*1000;
      while(ghostIndex<ghostData.positions.length-1 && ghostData.positions[ghostIndex+1].t<targetTime) ghostIndex++;
      const g=ghostData.positions[ghostIndex];
      if(g){ctx.save();ctx.globalAlpha=0.35;ctx.fillStyle='#8888ff';ctx.translate(g.x,g.y);ctx.rotate(g.h);ctx.fillRect(-9,-13,18,26);ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(-4,-16,3,0,Math.PI*2);ctx.arc(4,-16,3,0,Math.PI*2);ctx.fill();ctx.restore();}
      if(timeAttackMode && ghostData){ const diff=(now-raceStartTime-ghostTimer*1000)/1000; ui.ghostDiff.textContent=(diff>0?'+':'')+diff.toFixed(1); }
    }
    if(laps===0&&currentCP===1&&Math.hypot(vehicle.pos.x-currentTrack.center[0].x,vehicle.pos.y-currentTrack.center[0].y)>30){raceStartTime=now;laps=0;currentCP=1;runPositions=[];}
  }
  ctx.clearRect(0,0,canvas.width,canvas.height);
  drawTrack();
  if(gameState==='playing'){
    ctx.save(); ctx.translate(cam.x,cam.y); ctx.rotate(cam.rot); ctx.scale(cam.zoom,cam.zoom);
    vehicle.draw(ctx); ctx.restore();
  }
  const spd=Math.hypot(vehicle.vel.x,vehicle.vel.y);
  ui.speed.textContent=Math.round(spd*3.6);
  ui.time.textContent=gameState==='playing'?formatTime(now-raceStartTime):'00:00.0';
  ui.nitroBar.style.width=`${vehicle.nitroActive?(vehicle.nitroTimer/2.5)*100:100}%`;
  requestAnimationFrame(loop);
}

load(); loadProgress(); updateCoinUI(); renderLB(); requestAnimationFrame(loop);
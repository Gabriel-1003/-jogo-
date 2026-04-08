const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

// 🖼️ UI
const screens = { menu: document.getElementById('menu'), hud: document.getElementById('hud'), shop: document.getElementById('shop'), gameOver: document.getElementById('gameOver') };
const ui = {
  name: document.getElementById('playerName'), start: document.getElementById('startBtn'), shopBtn: document.getElementById('shopBtn'), closeShop: document.getElementById('closeShop'),
  menuCoins: document.getElementById('menuCoins'), hudCoins: document.getElementById('hudCoins'), shopCoinsVal: document.getElementById('shopCoinsVal'),
  hudName: document.getElementById('hudName'), speed: document.getElementById('speed'), time: document.getElementById('time'), lap: document.getElementById('lap'),
  rpmBar: document.getElementById('rpmBar'), gear: document.getElementById('gear'), nitroBar: document.getElementById('nitroBar'), nitroCount: document.getElementById('nitroCount'),
  vehicleType: document.getElementById('vehicleType'), finalTime: document.getElementById('finalTime'), finalVehicle: document.getElementById('finalVehicle'),
  rewardBase: document.getElementById('rewardBase'), rewardBonus: document.getElementById('rewardBonus'), rewardTotal: document.getElementById('rewardTotal'),
  restart: document.getElementById('restartBtn'), menuBtn: document.getElementById('menuBtn'), buyNitro: document.getElementById('buyNitro'),
  skinGrid: document.getElementById('skinGrid'), tabs: document.querySelectorAll('.tab'), panels: { skins: document.getElementById('skinsPanel'), nitro: document.getElementById('nitroPanel') }
};

function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
window.addEventListener('resize', resize); resize();

const keys = {};
window.addEventListener('keydown', e => keys[e.key.toLowerCase()] = true);
window.addEventListener('keyup', e => keys[e.key.toLowerCase()] = false);

// 💾 Dados Persistentes
let gameData = { coins: 1000, ownedSkins: ['default_car','default_moto'], selectedCar: 'default_car', selectedMoto: 'default_moto', nitro: 3 };
function load() { try { Object.assign(gameData, JSON.parse(localStorage.getItem('racing_data'))); } catch {} }
function save() { localStorage.setItem('racing_data', JSON.stringify(gameData)); updateCoinUI(); }
function updateCoinUI() { ui.menuCoins.textContent = gameData.coins; ui.hudCoins.textContent = gameData.coins; ui.shopCoinsVal.textContent = gameData.coins; }

// 🎨 Skins
const SKINS = [
  { id: 'default_car', name: 'Padrão', type: 'car', price: 0, color: '#0284c7' },
  { id: 'red_car', name: 'Racing Red', type: 'car', price: 500, color: '#ef4444' },
  { id: 'gold_car', name: 'Ouro', type: 'car', price: 1500, color: '#f59e0b' },
  { id: 'neon_car', name: 'Neon', type: 'car', price: 2000, color: '#10b981' },
  { id: 'default_moto', name: 'Padrão', type: 'moto', price: 0, color: '#e11d48' },
  { id: 'blue_moto', name: 'Azul', type: 'moto', price: 400, color: '#3b82f6' },
  { id: 'black_moto', name: 'Carbono', type: 'moto', price: 1200, color: '#111827' },
  { id: 'white_moto', name: 'Pérola', type: 'moto', price: 1800, color: '#f8fafc' }
];

function renderShop() {
  ui.skinGrid.innerHTML = '';
  const type = vehicle.isMoto ? 'moto' : 'car';
  const currentSel = vehicle.isMoto ? gameData.selectedMoto : gameData.selectedCar;
  
  SKINS.filter(s => s.type === type).forEach(s => {
    const owned = gameData.ownedSkins.includes(s.id);
    const sel = s.id === currentSel;
    const canBuy = gameData.coins >= s.price;
    
    const card = document.createElement('div');
    card.className = `skin-card ${owned ? 'owned' : ''} ${sel ? 'selected' : ''}`;
    card.innerHTML = `
      <div class="skin-preview" style="background:${s.color}"></div>
      <div class="skin-name">${s.name}</div>
      <div class="skin-price">${owned ? '✅ Adquirida' : `${s.price} 💰`}</div>
      <button class="${owned ? 'equip-btn' : 'buy-btn'}" ${!owned && !canBuy ? 'disabled' : ''}>
        ${owned ? (sel ? 'EQUIPADA' : 'EQUIPAR') : 'COMPRAR'}
      </button>
    `;
    card.querySelector('button').onclick = () => {
      if (owned) {
        if (vehicle.isMoto) gameData.selectedMoto = s.id; else gameData.selectedCar = s.id;
        applySkin(); save(); renderShop();
      } else if (canBuy) {
        gameData.coins -= s.price; gameData.ownedSkins.push(s.id);
        if (vehicle.isMoto) gameData.selectedMoto = s.id; else gameData.selectedCar = s.id;
        save(); renderShop();
      }
    };
    ui.skinGrid.appendChild(card);
  });
}

function applySkin() {
  const id = vehicle.isMoto ? gameData.selectedMoto : gameData.selectedCar;
  const skin = SKINS.find(s => s.id === id);
  if (skin) vehicle.color = skin.color;
}

ui.tabs.forEach(tab => tab.onclick = () => {
  ui.tabs.forEach(t => t.classList.remove('active'));
  Object.values(ui.panels).forEach(p => p.classList.remove('active'));
  tab.classList.add('active');
  ui.panels[tab.dataset.tab].classList.add('active');
});

ui.buyNitro.onclick = () => {
  if (gameData.coins >= 300) {
    gameData.coins -= 300; gameData.nitro += 3; save(); renderShop();
  }
};

// 🛣️ Pista & Checkpoints
const track = { center: [], width: 130 };
track.build = function() {
  const pts = [{x:600,y:600},{x:1400,y:500},{x:1800,y:900},{x:1500,y:1400},{x:800,y:1500},{x:300,y:1000},{x:600,y:600}];
  this.center = [];
  for(let i=0;i<pts.length;i++){
    const p0=pts[(i-1+pts.length)%pts.length], p1=pts[i], p2=pts[(i+1)%pts.length], p3=pts[(i+2)%pts.length];
    for(let t=0;t<=1;t+=0.04){
      const t2=t*t, t3=t2*t;
      const x=0.5*((2*p1.x)+(-p0.x+p2.x)*t+(2*p0.x-5*p1.x+4*p2.x-p3.x)*t2+(-p0.x+3*p1.x-3*p2.x+p3.x)*t3);
      const y=0.5*((2*p1.y)+(-p0.y+p2.y)*t+(2*p0.y-5*p1.y+4*p2.y-p3.y)*t2+(-p0.y+3*p1.y-3*p2.y+p3.y)*t3);
      this.center.push({x,y});
    }
  }
}; track.build();

const checkpoints = [{x:600,y:600,r:60},{x:1600,y:700,r:50},{x:1100,y:1250,r:50},{x:450,y:1150,r:50}];

// 🚗 Veículo
class Vehicle {
  constructor(isMoto=false){
    this.isMoto = isMoto; this.pos={x:600,y:600}; this.vel={x:0,y:0}; this.heading=0;
    this.rpm=800; this.gear=1; this.maxGear=5; this.gForce=0; this.wallImpact=0;
    this.mass=isMoto?250:1400; this.power=isMoto?12000:180000; this.drag=0.35; this.rollResistance=0.02;
    this.maxSteer=isMoto?0.055:0.045; this.lateralGrip=isMoto?0.75:0.85; this.driftThreshold=isMoto?2.8:2.2;
    this.nitroActive=false; this.nitroTimer=0; this.nitroCooldown=0; this.driftScore=0;
    applySkin();
  }
  update(dt){
    if(!engineRunning) return;
    const throttle=keys['w']||keys['arrowup']?1:0, brake=keys['s']||keys['arrowdown']?1:0;
    const steer=(keys['a']||keys['arrowleft']?-1:0)+(keys['d']||keys['arrowright']?1:0);
    const handbrake=keys[' ']?1:0;

    // Nitro
    if(keys['shift'] && gameData.nitro>0 && !this.nitroActive && this.nitroCooldown<=0){
      this.nitroActive=true; this.nitroTimer=2.5; gameData.nitro--; save();
      if(audioCtx) gainNode.gain.setTargetAtTime(0.12, audioCtx.currentTime, 0.05);
    }
    if(this.nitroActive){ this.nitroTimer-=dt; if(this.nitroTimer<=0){ this.nitroActive=false; this.nitroCooldown=4; } }
    if(this.nitroCooldown>0) this.nitroCooldown-=dt;

    const nitroMult = this.nitroActive ? 1.4 : 1.0;

    const fx=Math.cos(this.heading), fy=Math.sin(this.heading), rx=-Math.sin(this.heading), ry=Math.cos(this.heading);
    let vLong=this.vel.x*fx+this.vel.y*fy, vLat=this.vel.x*rx+this.vel.y*ry;

    let minD=Infinity, closest=null;
    for(let p of track.center){ let d=Math.hypot(this.pos.x-p.x, this.pos.y-p.y); if(d<minD){minD=d;closest=p;} }
    let onGrass=minD>track.width*0.65, gripMult=onGrass?0.45:1.0;

    let targetRPM=800+(vLong/(this.isMoto?16:14))*6500;
    targetRPM=Math.max(800,Math.min(8500,targetRPM)); this.rpm+=(targetRPM-this.rpm)*0.1;
    this.gear=Math.min(this.maxGear,Math.max(1,Math.ceil(this.rpm/1800)));

    let powerForce=throttle*this.power*(1-(this.rpm-800)/7700)/(this.gear*0.8)*nitroMult;
    let brakeForce=brake?25000:0;
    let engineForce=powerForce-brakeForce-vLong*this.drag*(onGrass?1.8:1.0)-this.mass*this.rollResistance*Math.sign(vLong);

    let steerFactor=this.maxSteer*(1-Math.abs(vLong)/(this.isMoto?22:18)*0.4);
    this.heading+=steer*steerFactor*dt*60;

    let slipAngle=Math.atan2(vLat,Math.max(0.1,Math.abs(vLong)));
    let latForce=-vLat*this.lateralGrip*gripMult*120*(1-handbrake*0.6);

    let newVLong=vLong+(engineForce/this.mass)*dt;
    let newVLat=vLat+(latForce/this.mass)*dt;
    newVLat*=(1-0.08*gripMult);
    this.gForce=Math.sqrt((engineForce/this.mass)**2+(latForce/this.mass)**2)/9.81;

    if(Math.abs(newVLat)>this.driftThreshold) this.driftScore+=Math.abs(newVLat)*dt*10;

    this.vel.x=fx*newVLong+rx*newVLat; this.vel.y=fy*newVLong+ry*newVLat;
    this.pos.x+=this.vel.x*dt*60; this.pos.y+=this.vel.y*dt*60;

    // Barreiras
    const maxDist=track.width/2;
    if(minD>maxDist && closest){
      const toCar={x:this.pos.x-closest.x,y:this.pos.y-closest.y}, dist=Math.hypot(toCar.x,toCar.y);
      const pushBack=(dist-maxDist)+1, nx=toCar.x/dist, ny=toCar.y/dist;
      this.pos.x-=nx*pushBack; this.pos.y-=ny*pushBack;
      const dot=this.vel.x*nx+this.vel.y*ny; this.vel.x-=1.6*dot*nx; this.vel.y-=1.6*dot*ny;
      this.wallImpact=1.0; if(audioCtx&&dot>2){gainNode.gain.setTargetAtTime(0.15,audioCtx.currentTime,0.01);osc.frequency.setTargetAtTime(osc.frequency.value+40,audioCtx.currentTime,0.01);}
    } else this.wallImpact*=0.9;

    // Som
    if(audioCtx){
      let bf=60+this.rpm*0.8, vol=0.03+throttle*0.08+(this.rpm/8500)*0.06;
      if(this.nitroActive) vol+=0.08;
      osc.frequency.setTargetAtTime(bf,audioCtx.currentTime,0.05);
      gainNode.gain.setTargetAtTime(Math.max(0.01,vol),audioCtx.currentTime,0.05);
    }
  }
  draw(ctx){
    ctx.save(); ctx.translate(this.pos.x,this.pos.y); ctx.rotate(this.heading);
    if(this.wallImpact>0.05){ctx.fillStyle=`rgba(255,50,50,${this.wallImpact*0.5})`;ctx.beginPath();ctx.arc(0,0,25,0,Math.PI*2);ctx.fill();}
    if(this.nitroActive){ctx.fillStyle='rgba(249,115,22,0.3)';ctx.beginPath();ctx.arc(0,15,18+Math.random()*6,0,Math.PI*2);ctx.fill();}
    ctx.fillStyle=this.color||'#888';
    const w=this.isMoto?10:18, h=this.isMoto?26:38;
    ctx.fillRect(-w/2,-h/2,w,h);
    ctx.fillStyle='#fde047';ctx.beginPath();ctx.arc(-5,-h/2-3,3,0,Math.PI*2);ctx.arc(5,-h/2-3,3,0,Math.PI*2);ctx.fill();
    ctx.restore();
  }
}

let vehicle = new Vehicle(false);
const cam = {x:0,y:0,zoom:1,rot:0};
function updateCam(dt){
  const speed=Math.hypot(vehicle.vel.x,vehicle.vel.y);
  cam.zoom+=((1.4-Math.min(0.6,speed/35))-cam.zoom)*0.05;
  cam.rot+=(-vehicle.heading*0.15-cam.rot)*0.08;
  cam.x+=(vehicle.pos.x-canvas.width/2/cam.zoom-cam.x)*0.06;
  cam.y+=(vehicle.pos.y-canvas.height/2/cam.zoom-cam.y)*0.06;
}

// 🏁 Lógica
let gameState='menu', playerName='', raceStartTime=0, currentCP=0, laps=0, finished=false, engineRunning=false, driftBonus=0;
let audioCtx, osc, gainNode;
function initAudio(){ if(audioCtx)return; audioCtx=new(window.AudioContext||window.webkitAudioContext)(); osc=audioCtx.createOscillator(); gainNode=audioCtx.createGain(); osc.type='sawtooth'; osc.frequency.value=80; gainNode.gain.value=0; osc.connect(gainNode).connect(audioCtx.destination); osc.start(); engineRunning=true; }

function checkCP(){
  if(finished)return;
  const cp=checkpoints[currentCP], d=Math.hypot(vehicle.pos.x-cp.x, vehicle.pos.y-cp.y);
  if(d<cp.r){ currentCP=(currentCP+1)%checkpoints.length; if(currentCP===0){ laps++; ui.lap.textContent=Math.min(laps,3); if(laps>=3) finishRace(); } }
}

function formatTime(ms){ const s=ms/1000; return `${Math.floor(s/60).toString().padStart(2,'0')}:${Math.floor(s%60).toString().padStart(2,'0')}.${Math.floor((s%1)*10)}`; }

function finishRace(){
  finished=true; const ms=performance.now()-raceStartTime, timeSec=ms/1000;
  driftBonus=Math.round(vehicle.driftScore*2);
  let base=500, bonus=driftBonus;
  if(timeSec<100) bonus+=300; if(timeSec<85) bonus+=200;
  let lb=loadLB(); if(lb.length===0||timeSec<lb[0].time) bonus+=300;
  
  gameData.coins+=base+bonus; save();
  saveLB(playerName, timeSec);
  
  ui.finalTime.textContent=formatTime(ms); ui.finalVehicle.textContent=vehicle.isMoto?'🏍️ Moto':'🚗 Carro';
  ui.rewardBase.textContent=base; ui.rewardBonus.textContent=bonus; ui.rewardTotal.textContent=base+bonus;
  gameState='finished'; showScreen(screens.gameOver);
}

// 💾 Leaderboard
function loadLB(){ try{return JSON.parse(localStorage.getItem('racing_lb')||'[]');}catch{return[];} }
function saveLB(name,time){
  let lb=loadLB(); lb.push({name,time,date:Date.now()}); lb.sort((a,b)=>a.time-b.time); lb=lb.slice(0,20);
  localStorage.setItem('racing_lb',JSON.stringify(lb)); renderLB();
}
function renderLB(){
  const lb=loadLB().slice(0,5);
  document.getElementById('leaderboardBody').innerHTML=lb.map((r,i)=>`<tr><td>${i+1}</td><td>${r.name}</td><td>${formatTime(r.time*1000)}</td></tr>`).join('');
}

// 🎮 Telas
function showScreen(s){ Object.values(screens).forEach(sc=>{sc.classList.remove('active');sc.classList.add('hidden');}); s.classList.remove('hidden'); s.classList.add('active'); if(s===screens.hud) ui.hudName.textContent=playerName; }

ui.start.onclick=()=>{ playerName=ui.name.value.trim()||'Anônimo'; initAudio(); resetRace(); showScreen(screens.hud); gameState='playing'; };
ui.shopBtn.onclick=()=>{ renderShop(); showScreen(screens.shop); };
ui.closeShop.onclick=()=>showScreen(screens.menu);
ui.restart.onclick=()=>{ resetRace(); showScreen(screens.hud); gameState='playing'; };
ui.menuBtn.onclick=()=>{ gameState='menu'; showScreen(screens.menu); renderLB(); };

function resetRace(){
  vehicle=new Vehicle(false); laps=0; currentCP=1; finished=false; raceStartTime=performance.now();
  ui.lap.textContent='0'; ui.nitroCount.textContent=gameData.nitro; ui.nitroBar.style.width='100%';
}
ui.nitroCount.textContent=gameData.nitro;

window.addEventListener('keydown', e=>{ if(gameState==='playing'&&e.key.toLowerCase()==='t'){ vehicle=new Vehicle(!vehicle.isMoto); ui.vehicleType.textContent=vehicle.isMoto?'🏍️ Moto':'🚗 Carro'; ui.nitroCount.textContent=gameData.nitro; } });

// 🖼️ Loop
const tireMarks=[]; const MAX_MARKS=1200;
function drawTrack(){
  ctx.fillStyle='#1a472a'; ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.save(); ctx.scale(cam.zoom,cam.zoom); ctx.translate(-cam.x,-cam.y); ctx.rotate(cam.rot);
  ctx.strokeStyle='#2d2d35'; ctx.lineWidth=track.width; ctx.lineCap='round'; ctx.lineJoin='round';
  ctx.beginPath(); track.center.forEach((p,i)=>i===0?ctx.moveTo(p.x,p.y):ctx.lineTo(p.x,p.y)); ctx.closePath(); ctx.stroke();
  ctx.strokeStyle='#ffffff'; ctx.lineWidth=track.width+12; ctx.setLineDash([20,20]); ctx.stroke();
  ctx.strokeStyle='#ef4444'; ctx.lineDashOffset=20; ctx.stroke(); ctx.setLineDash([]);
  ctx.strokeStyle='#ffffff44'; ctx.lineWidth=3; ctx.beginPath(); track.center.forEach((p,i)=>i===0?ctx.moveTo(p.x,p.y):ctx.lineTo(p.x,p.y)); ctx.closePath(); ctx.stroke();
  checkpoints.forEach((cp,i)=>{ const a=i===currentCP; ctx.fillStyle=a?'rgba(34,197,94,0.2)':'rgba(255,255,255,0.05)'; ctx.beginPath(); ctx.arc(cp.x,cp.y,cp.r,0,Math.PI*2); ctx.fill(); ctx.strokeStyle=a?'#22c55e':'#555'; ctx.lineWidth=2; ctx.stroke(); });
  ctx.lineWidth=4; for(let m of tireMarks){ const a=Math.max(0,1-m.age/8); if(a<=0)continue; ctx.strokeStyle=`rgba(30,30,30,${a})`; ctx.beginPath(); ctx.arc(m.x,m.y,1,0,Math.PI*2); ctx.fill(); }
  vehicle.draw(ctx); ctx.restore();
}

let lastTime=performance.now();
function loop(now){
  const dt=Math.min((now-lastTime)/1000,0.04); lastTime=now;
  if(gameState==='playing'){
    vehicle.update(dt); checkCP(); updateCam(dt);
    if(laps===0&&currentCP===1&&Math.hypot(vehicle.pos.x-600,vehicle.pos.y-600)>30){ raceStartTime=now; laps=0; currentCP=1; }
  }
  ctx.clearRect(0,0,canvas.width,canvas.height); drawTrack();
  const spd=Math.hypot(vehicle.vel.x,vehicle.vel.y);
  ui.speed.textContent=Math.round(spd*3.6); ui.time.textContent=gameState==='playing'?formatTime(now-raceStartTime):'00:00.0';
  ui.rpmBar.style.width=`${(vehicle.rpm/8500)*100}%`; ui.gear.textContent=vehicle.gear;
  ui.gBar.style.width=`${Math.min(100,vehicle.gForce*25)}%`; ui.gBar.style.background=vehicle.gForce>1.2?'#ef4444':'#22c55e';
  const nitroPct = vehicle.nitroActive ? (vehicle.nitroTimer/2.5)*100 : 0;
  ui.nitroBar.style.width = `${nitroPct}%`;
  requestAnimationFrame(loop);
}

load(); updateCoinUI(); renderLB(); requestAnimationFrame(loop);
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const uiSpeed = document.getElementById('speed');
const uiLap = document.getElementById('lap');
const uiTime = document.getElementById('time');
const uiRPM = document.getElementById('rpmBar');
const uiGear = document.getElementById('gear');
const uiG = document.getElementById('gBar');
const uiType = document.getElementById('type');
const btnStart = document.getElementById('startBtn');

function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
window.addEventListener('resize', resize); resize();

const keys = {};
window.addEventListener('keydown', e => keys[e.key.toLowerCase()] = true);
window.addEventListener('keyup', e => keys[e.key.toLowerCase()] = false);

// 🎵 Áudio do Motor (Web Audio API)
let audioCtx, osc, gainNode, engineRunning = false;
function initAudio() {
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  osc = audioCtx.createOscillator();
  gainNode = audioCtx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.value = 80;
  gainNode.gain.value = 0;
  osc.connect(gainNode).connect(audioCtx.destination);
  osc.start();
  engineRunning = true;
  btnStart.disabled = true; btnStart.textContent = '✅ Motor Ligado';
}
btnStart.addEventListener('click', () => { if (!engineRunning) initAudio(); });

// 🛣️ Pista (Asfalto + Curbs + Grama)
const track = {
  center: [], width: 120,
  build() {
    const pts = [
      {x: 600, y: 600}, {x: 1400, y: 500}, {x: 1800, y: 900},
      {x: 1500, y: 1400}, {x: 800, y: 1500}, {x: 300, y: 1000}, {x: 600, y: 600}
    ];
    // Interpolação suave (Catmull-Rom simplificada)
    for (let i = 0; i < pts.length; i++) {
      const p0 = pts[(i - 1 + pts.length) % pts.length];
      const p1 = pts[i];
      const p2 = pts[(i + 1) % pts.length];
      const p3 = pts[(i + 2) % pts.length];
      for (let t = 0; t <= 1; t += 0.05) {
        const t2 = t*t, t3 = t2*t;
        const x = 0.5*((2*p1.x)+(-p0.x+p2.x)*t+(2*p0.x-5*p1.x+4*p2.x-p3.x)*t2+(-p0.x+3*p1.x-3*p2.x+p3.x)*t3);
        const y = 0.5*((2*p1.y)+(-p0.y+p2.y)*t+(2*p0.y-5*p1.y+4*p2.y-p3.y)*t2+(-p0.y+3*p1.y-3*p2.y+p3.y)*t3);
        this.center.push({x, y});
      }
    }
  }
};
track.build();

const checkpoints = [
  {x: 600, y: 600, r: 50}, {x: 1600, y: 700, r: 50},
  {x: 1100, y: 1250, r: 50}, {x: 450, y: 1150, r: 50}
];
let currentCP = 0, laps = 0, startTime = 0, finished = false;

// 📍 Marcas de Pneu
const tireMarks = [];
const MAX_MARKS = 2000;

// 🚗 Veículo com Física Realista
class Vehicle {
  constructor(isMoto = false) {
    this.isMoto = isMoto;
    this.pos = {x: 600, y: 600};
    this.vel = {x: 0, y: 0};
    this.heading = 0;
    this.rpm = 800; this.gear = 1; this.maxGear = 5;
    this.gForce = 0;
    
    // Parâmetros
    this.mass = isMoto ? 250 : 1400;
    this.power = isMoto ? 12000 : 180000; // N
    this.drag = 0.35;
    this.rollResistance = 0.02;
    this.maxSteer = isMoto ? 0.055 : 0.045;
    this.lateralGrip = isMoto ? 0.75 : 0.85;
    this.driftThreshold = isMoto ? 2.8 : 2.2;
    this.wheelBase = isMoto ? 1.4 : 2.6;
  }

  update(dt) {
    if (!engineRunning) return;

    const throttle = keys['w'] || keys['arrowup'] ? 1 : 0;
    const brake = keys['s'] || keys['arrowdown'] ? 1 : 0;
    const steer = (keys['a'] || keys['arrowleft'] ? -1 : 0) + (keys['d'] || keys['arrowright'] ? 1 : 0);
    const handbrake = keys[' '] ? 1 : 0;

    // Vetores locais
    const fx = Math.cos(this.heading), fy = Math.sin(this.heading);
    const rx = -Math.sin(this.heading), ry = Math.cos(this.heading);

    // Velocidade longitudinal e lateral
    let vLong = this.vel.x * fx + this.vel.y * fy;
    let vLat = this.vel.x * rx + this.vel.y * ry;

    // Superfície (grama vs asfalto)
    let onGrass = this.getSurface() === 'grass';
    let gripMult = onGrass ? 0.45 : 1.0;
    let dragMult = onGrass ? 1.8 : 1.0;

    // Força do motor (com limitador de RPM)
    let targetRPM = 800 + (vLong / (this.isMoto ? 16 : 14)) * 6500;
    targetRPM = Math.max(800, Math.min(8500, targetRPM));
    this.rpm += (targetRPM - this.rpm) * 0.1;
    this.gear = Math.min(this.maxGear, Math.max(1, Math.ceil(this.rpm / 1800)));

    let powerForce = throttle * this.power * (1 - (this.rpm - 800) / 7700) / (this.gear * 0.8);
    let brakeForce = brake ? 25000 : 0;
    let engineForce = powerForce - brakeForce - vLong * this.drag * dragMult - this.mass * this.rollResistance * Math.sign(vLong);

    // Direção
    let steerFactor = this.maxSteer * (1 - Math.abs(vLong) / (this.isMoto ? 22 : 18) * 0.4);
    this.heading += steer * steerFactor * dt * 60;

    // Atrito lateral (Pacejka simplificado)
    let slipAngle = Math.atan2(vLat, Math.max(0.1, Math.abs(vLong)));
    let latForce = -vLat * this.lateralGrip * gripMult * 120;
    latForce *= (1 - handbrake * 0.6); // Handbrake reduz grip traseiro

    // Força resultante
    let newVLong = vLong + (engineForce / this.mass) * dt;
    let newVLat = vLat + (latForce / this.mass) * dt;

    // Limites de estabilidade
    newVLat *= (1 - 0.08 * gripMult);
    this.gForce = Math.sqrt((engineForce/this.mass)**2 + (latForce/this.mass)**2) / 9.81;

    // Recompor vetor
    this.vel.x = fx * newVLong + rx * newVLat;
    this.vel.y = fy * newVLong + ry * newVLat;

    // Atualizar posição
    this.pos.x += this.vel.x * dt * 60;
    this.pos.y += this.vel.y * dt * 60;

    // Marcas de pneu
    if (Math.abs(newVLat) > this.driftThreshold || handbrake > 0) {
      tireMarks.push({x: this.pos.x, y: this.pos.y, age: 0});
      if (tireMarks.length > MAX_MARKS) tireMarks.shift();
    }
    for (let m of tireMarks) m.age += dt;

    // Som do motor
    if (audioCtx) {
      osc.frequency.setTargetAtTime(60 + this.rpm * 0.8, audioCtx.currentTime, 0.05);
      gainNode.gain.setTargetAtTime(0.03 + throttle * 0.08 + (this.rpm/8500)*0.06, audioCtx.currentTime, 0.05);
    }
  }

  getSurface() {
    let minD = Infinity;
    for (let p of track.center) {
      let d = Math.hypot(this.pos.x - p.x, this.pos.y - p.y);
      if (d < minD) minD = d;
    }
    return minD > track.width * 0.65 ? 'grass' : 'asphalt';
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.pos.x, this.pos.y);
    ctx.rotate(this.heading);

    // Sombra
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(-12, -8, 32, 20);

    // Corpo
    ctx.fillStyle = this.isMoto ? '#e11d48' : '#0284c7';
    const w = this.isMoto ? 10 : 18;
    const h = this.isMoto ? 26 : 38;
    ctx.fillRect(-w/2, -h/2, w, h);

    // Faróis
    ctx.fillStyle = '#fde047';
    ctx.beginPath(); ctx.arc(-6, -h/2, 3, 0, Math.PI*2); ctx.arc(6, -h/2, 3, 0, Math.PI*2); ctx.fill();

    ctx.restore();
  }
}

let vehicle = new Vehicle(false);

// 📷 Câmera Inteligente
const cam = {x: 0, y: 0, zoom: 1, rot: 0};
function updateCam(dt) {
  const speed = Math.hypot(vehicle.vel.x, vehicle.vel.y);
  const targetZoom = 1.4 - Math.min(0.6, speed / 35);
  const targetRot = -vehicle.heading * 0.15;

  cam.zoom += (targetZoom - cam.zoom) * 0.05;
  cam.rot += (targetRot - cam.rot) * 0.08;
  cam.x += (vehicle.pos.x - canvas.width/2/cam.zoom - cam.x) * 0.06;
  cam.y += (vehicle.pos.y - canvas.height/2/cam.zoom - cam.y) * 0.06;
}

// 🏁 Lógica de Voltas
function checkCP() {
  if (finished) return;
  const cp = checkpoints[currentCP];
  const d = Math.hypot(vehicle.pos.x - cp.x, vehicle.pos.y - cp.y);
  if (d < cp.r) {
    currentCP = (currentCP + 1) % checkpoints.length;
    if (currentCP === 0) {
      laps++;
      if (laps >= 3) {
        finished = true;
        const t = formatTime(performance.now() - startTime);
        setTimeout(() => alert(`🏁 CORRIDA FINALIZADA!\nTempo: ${t}`), 50);
      }
    }
  }
}

function formatTime(ms) {
  const s = ms/1000;
  return `${Math.floor(s/60).toString().padStart(2,'0')}:${Math.floor(s%60).toString().padStart(2,'0')}.${Math.floor((s%1)*10)}`;
}

// 🖼️ Renderização
function drawTrack() {
  // Grama
  ctx.fillStyle = '#1a472a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.scale(cam.zoom, cam.zoom);
  ctx.translate(-cam.x, -cam.y);

  // Asfalto
  ctx.strokeStyle = '#2d2d35';
  ctx.lineWidth = track.width;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath();
  track.center.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
  ctx.closePath(); ctx.stroke();

  // Curbs (vermelho/branco)
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = track.width + 12;
  ctx.setLineDash([20, 20]);
  ctx.stroke();
  ctx.strokeStyle = '#ef4444';
  ctx.lineDashOffset = 20;
  ctx.stroke();
  ctx.setLineDash([]);

  // Linha do meio
  ctx.strokeStyle = '#ffffff44';
  ctx.lineWidth = 3;
  ctx.beginPath();
  track.center.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
  ctx.closePath(); ctx.stroke();

  // Checkpoints
  checkpoints.forEach((cp, i) => {
    const active = i === currentCP;
    ctx.fillStyle = active ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.05)';
    ctx.beginPath(); ctx.arc(cp.x, cp.y, cp.r, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle = active ? '#22c55e' : '#555';
    ctx.lineWidth = 2; ctx.stroke();
  });

  // Marcas de pneu
  ctx.lineWidth = 4;
  for (let m of tireMarks) {
    const alpha = Math.max(0, 1 - m.age / 8);
    if (alpha <= 0) continue;
    ctx.strokeStyle = `rgba(30,30,30,${alpha})`;
    ctx.beginPath(); ctx.arc(m.x, m.y, 1, 0, Math.PI*2); ctx.fill();
  }

  vehicle.draw(ctx);
  ctx.restore();
}

// 🔄 Game Loop
let lastTime = performance.now();
function loop(now) {
  const dt = Math.min((now - lastTime) / 1000, 0.04);
  lastTime = now;

  if (!finished && engineRunning) {
    vehicle.update(dt);
    checkCP();
    updateCam(dt);
    if (laps === 0 && currentCP === 0 && Math.hypot(vehicle.pos.x-600, vehicle.pos.y-600) > 20) {
      startTime = now; laps = 0; currentCP = 1;
    }
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawTrack();

  // UI
  uiSpeed.textContent = Math.round(Math.hypot(vehicle.vel.x, vehicle.vel.y) * 3.6);
  uiLap.textContent = `${Math.min(laps, 3)}`;
  uiTime.textContent = finished ? formatTime(now - startTime) : (startTime ? formatTime(now - startTime) : '00:00.0');
  uiRPM.style.width = `${(vehicle.rpm / 8500) * 100}%`;
  uiGear.textContent = vehicle.gear;
  uiG.style.width = `${Math.min(100, vehicle.gForce * 25)}%`;
  uiG.style.background = vehicle.gForce > 1.2 ? '#ef4444' : '#22c55e';

  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// Trocar veículo (tecla T)
window.addEventListener('keydown', e => {
  if (e.key.toLowerCase() === 't') {
    vehicle = new Vehicle(!vehicle.isMoto);
    uiType.textContent = vehicle.isMoto ? '🏍️ Moto' : '🚗 Carro';
  }
});
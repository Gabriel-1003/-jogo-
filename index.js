const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const uiSpeed = document.getElementById('speed');
const uiLap = document.getElementById('lap');
const uiTime = document.getElementById('time');
const uiVehicle = document.getElementById('vehicleType');
const btnToggle = document.getElementById('toggleVehicle');

// 📐 Canvas responsivo
function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

// 🎮 Input
const keys = {};
window.addEventListener('keydown', e => keys[e.key.toLowerCase()] = true);
window.addEventListener('keyup', e => keys[e.key.toLowerCase()] = false);

// 🚗 Classe do Veículo
class Vehicle {
  constructor(isMoto = false) {
    this.isMoto = isMoto;
    this.x = 500; this.y = 500;
    this.angle = 0;
    this.speed = 0;
    this.maxSpeed = isMoto ? 14 : 10;
    this.accel = isMoto ? 10 : 7;
    this.friction = 0.97;
    this.turnSpeed = isMoto ? 3.8 : 2.6;
    this.lean = 0; // Inclinação visual da moto
  }

  update(dt) {
    const up = keys['w'] || keys['arrowup'];
    const down = keys['s'] || keys['arrowdown'];
    const left = keys['a'] || keys['arrowleft'];
    const right = keys['d'] || keys['arrowright'];

    // Aceleração / Freio
    if (up) this.speed += this.accel * dt;
    if (down) this.speed -= this.accel * 1.6 * dt;
    this.speed *= this.friction;
    this.speed = Math.max(-this.maxSpeed * 0.4, Math.min(this.maxSpeed, this.speed));

    // Direção (só vira se estiver em movimento)
    if (Math.abs(this.speed) > 0.3) {
      const turnDir = (left ? -1 : right ? 1 : 0);
      this.angle += turnDir * this.turnSpeed * (Math.abs(this.speed) / this.maxSpeed) * dt;
    }

    // Inclinação visual da moto
    const steerInput = (left ? -1 : right ? 1 : 0);
    const targetLean = steerInput * 0.4 * Math.min(Math.abs(this.speed) / this.maxSpeed, 1);
    this.lean += (targetLean - this.lean) * 0.15;

    // Movimento
    this.x += Math.cos(this.angle) * this.speed;
    this.y += Math.sin(this.angle) * this.speed;
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle + (this.isMoto ? this.lean : 0));

    // Corpo
    ctx.fillStyle = this.isMoto ? '#ef4444' : '#3b82f6';
    const w = this.isMoto ? 36 : 28;
    const h = this.isMoto ? 14 : 46;
    ctx.fillRect(-w/2, -h/2, w, h);

    // Farol
    ctx.fillStyle = '#fde047';
    ctx.beginPath();
    ctx.arc(0, -h/2 - 4, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}

// 🛣️ Pista e Checkpoints
const trackPoints = [
  {x: 500, y: 500}, {x: 1400, y: 500}, {x: 1800, y: 900},
  {x: 1400, y: 1300}, {x: 500, y: 1300}, {x: 100, y: 900}, {x: 500, y: 500}
];

const checkpoints = [
  {x: 500, y: 500, r: 60, passed: false},
  {x: 1600, y: 700, r: 55, passed: false},
  {x: 950, y: 1150, r: 55, passed: false},
  {x: 250, y: 1050, r: 55, passed: false}
];

let currentCP = 0;
let laps = 0;
const totalLaps = 3;
let startTime = performance.now();
let finished = false;

function checkCheckpoints(v) {
  if (finished) return;
  const cp = checkpoints[currentCP];
  const dx = v.x - cp.x;
  const dy = v.y - cp.y;
  if (dx*dx + dy*dy < cp.r*cp.r) {
    cp.passed = true;
    currentCP = (currentCP + 1) % checkpoints.length;
    if (currentCP === 0) {
      laps++;
      uiLap.textContent = `${Math.min(laps, totalLaps)}/${totalLaps}`;
      if (laps >= totalLaps) {
        finished = true;
        const finalTime = formatTime(performance.now() - startTime);
        setTimeout(() => alert(`🏁 CORRIDA FINALIZADA!\nTempo: ${finalTime}`), 100);
      }
    }
  }
}

function formatTime(ms) {
  const totalSec = ms / 1000;
  const min = Math.floor(totalSec / 60).toString().padStart(2, '0');
  const sec = Math.floor(totalSec % 60).toString().padStart(2, '0');
  const ms10 = Math.floor((totalSec % 1) * 10);
  return `${min}:${sec}.${ms10}`;
}

// 📷 Câmera suave
const camera = {x: 0, y: 0};
function updateCamera(v) {
  camera.x += (v.x - canvas.width/2 - camera.x) * 0.08;
  camera.y += (v.y - canvas.height/2 - camera.y) * 0.08;
}

// 🎯 Inicialização
let vehicle = new Vehicle(false);
btnToggle.addEventListener('click', () => {
  vehicle.isMoto = !vehicle.isMoto;
  vehicle.maxSpeed = vehicle.isMoto ? 14 : 10;
  vehicle.accel = vehicle.isMoto ? 10 : 7;
  vehicle.turnSpeed = vehicle.isMoto ? 3.8 : 2.6;
  vehicle.lean = 0;
  btnToggle.textContent = vehicle.isMoto ? 'Trocar para Carro' : 'Trocar para Moto';
  uiVehicle.textContent = vehicle.isMoto ? '🏍️ Moto' : '🚗 Carro';
});

// 🖼️ Desenho
function drawTrack() {
  ctx.strokeStyle = '#3f3f46';
  ctx.lineWidth = 90;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(trackPoints[0].x, trackPoints[0].y);
  for (let i = 1; i < trackPoints.length; i++) ctx.lineTo(trackPoints[i].x, trackPoints[i].y);
  ctx.closePath();
  ctx.stroke();

  // Linha do meio
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 3;
  ctx.setLineDash([24, 24]);
  ctx.stroke();
  ctx.setLineDash([]);

  // Linha de chegada
  ctx.save();
  ctx.translate(trackPoints[0].x, trackPoints[0].y);
  ctx.rotate(0);
  ctx.fillStyle = '#fff';
  for(let i=0; i<10; i++) {
    ctx.fillRect(-45 + i*10, -45, 5, 90);
  }
  ctx.restore();
}

function drawCheckpoints() {
  checkpoints.forEach((cp, i) => {
    const isActive = i === currentCP;
    ctx.fillStyle = isActive ? 'rgba(34,197,94,0.25)' : 'rgba(255,255,255,0.08)';
    ctx.beginPath();
    ctx.arc(cp.x, cp.y, cp.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = isActive ? '#22c55e' : '#555';
    ctx.lineWidth = 2;
    ctx.stroke();
  });
}

// 🔄 Game Loop
let lastTime = performance.now();
function loop(now) {
  const dt = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;

  if (!finished) {
    vehicle.update(dt);
    checkCheckpoints(vehicle);
    updateCamera(vehicle);
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(-camera.x, -camera.y);

  drawTrack();
  drawCheckpoints();
  vehicle.draw(ctx);

  ctx.restore();

  uiSpeed.textContent = Math.abs(Math.round(vehicle.speed * 3.6));
  uiTime.textContent = formatTime(now - startTime);

  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);

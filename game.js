const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const trackImage = new Image();
trackImage.src = "track.png";

// ===== ЗВУКИ =====
const countdownSound = new Audio("countdown.mp3");
const sectorSound = new Audio("sector.mp3");
const finishSound = new Audio("finish.mp3");

countdownSound.volume = 0.7;
sectorSound.volume = 0.8;
finishSound.volume = 1.0;

// ===== ЗВУК ДВИГАТЕЛЯ (бесшовный луп) =====
const engineSoundA = new Audio("engine.mp3");
const engineSoundB = new Audio("engine.mp3");

engineSoundA.volume = 0;
engineSoundB.volume = 0;

let currentEngine = engineSoundA;
let nextEngine = engineSoundB;
let engineStarted = false;

const CAMERA_ZOOM = 1.75; // можешь менять 1.2, 1.5, 2 и т.д.

// ===== СТАРТОВЫЙ ЭКРАН =====
const startImage = new Image();
startImage.src = "start.png";

let gameStarted = false;

// ===== СИСТЕМА ОТСЧЁТА =====
let countdownActive = false;
let countdownValue = 3;
let countdownStartTime = 0;
let lastCountdownSoundValue = null;


function startCountdown() {
  countdownActive = true;
  countdownValue = 3;
  countdownStartTime = Date.now();
}

// ===== НЕВИДИМАЯ КНОПКА START ПОВЕРХ КАРТИНКИ =====
const startBtn = document.createElement("button");
startBtn.innerText = "START";
startBtn.style.position = "absolute";
startBtn.style.left = "37%";
startBtn.style.top = "56%";
startBtn.style.transform = "translate(-50%, -50%)";
startBtn.style.width = "460px";
startBtn.style.height = "128px";
startBtn.style.background = "rgba(0,0,0,0.02)";
startBtn.style.border = "1px solid black";
startBtn.style.color = "rgba(0,0,0,0)";
startBtn.style.cursor = "pointer";
startBtn.style.zIndex = "2000";
document.body.appendChild(startBtn);

// ===== КНОПКА "НАЧАТЬ ЗАНОВО" =====
const restartBtn = document.createElement("button");
restartBtn.innerText = "НАЧАТЬ ЗАНОВО";
restartBtn.style.position = "fixed";
restartBtn.style.top = "20px";
restartBtn.style.left = "50%";
restartBtn.style.transform = "translateX(-50%)";
restartBtn.style.padding = "20px 28px";
restartBtn.style.fontSize = "22px";
restartBtn.style.fontFamily = "monospace";
restartBtn.style.color = "white";
restartBtn.style.background = "linear-gradient(145deg, #1a1a1a, #0f0f0f)";
restartBtn.style.border = "2px solid #ff0000";
restartBtn.style.borderRadius = "12px";
restartBtn.style.boxShadow = "0 0 20px rgba(255,0,0,0.4)";
restartBtn.style.cursor = "pointer";
restartBtn.style.zIndex = "1500";
restartBtn.style.display = "none";
document.body.appendChild(restartBtn);


// ===== UI ПАНЕЛЬ (LAPS + SPEED) =====
const uiContainer = document.createElement("div");
uiContainer.style.position = "fixed";
uiContainer.style.top = "20px";
uiContainer.style.left = "20px";
uiContainer.style.display = "flex";
uiContainer.style.flexDirection = "column";
uiContainer.style.gap = "15px";
uiContainer.style.zIndex = "1500";
uiContainer.style.display = "none";
document.body.appendChild(uiContainer);

function createGamePanel(text) {
  const panel = document.createElement("div");
  panel.innerText = text;

  panel.style.minWidth = "200px";
  panel.style.padding = "20px 28px";
  panel.style.fontSize = "22px";
  panel.style.fontFamily = "monospace";
  panel.style.color = "white";
  panel.style.background = "linear-gradient(145deg, #1a1a1a, #0f0f0f)";
  panel.style.border = "2px solid #ff0000";
  panel.style.borderRadius = "12px";
  panel.style.boxShadow = "0 0 20px rgba(255,0,0,0.4)";
  panel.style.textAlign = "left";

  return panel;
}

const lapsUI = createGamePanel("LAPS: 0");
const speedUI = createGamePanel("SPEED: 0.00");
const lapTimeUI = createGamePanel("TIME: 0.00");


uiContainer.appendChild(lapsUI);
uiContainer.appendChild(speedUI);
uiContainer.appendChild(lapTimeUI);

// ===== ОБРАБОТЧИК START =====
startBtn.addEventListener("click", () => {
  gameStarted = true;
  startBtn.style.display = "none";
  restartBtn.style.display = "block";
  uiContainer.style.display = "flex";
  startCountdown();
  countdownSound.play();
  lastCountdownSoundValue = 3;
  if (!engineStarted) {
    currentEngine.play();
    engineStarted = true;
  }

});

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener("resize", resize);
resize();

const keys = {
  w: false, a: false, s: false, d: false,
  ц: false, ф: false, ы: false, в: false,
  z: false, я: false
};

window.addEventListener("keydown", (e) => {
  const k = e.key.toLowerCase();
  if (k in keys) keys[k] = true;
});

window.addEventListener("keyup", (e) => {
  const k = e.key.toLowerCase();
  if (k in keys) keys[k] = false;
});

const player = {
  x: 2851.7,
  y: 891.3,
  angle: 5 * Math.PI / 180,
  speed: 0,
  maxSpeed: 3,
  minSpeed: -1.5,
  acceleration: 0.035,
  reversePower: 0.025,
  friction: 0.02,
  baseTurnSpeed: 0.03,
  turnSmooth: 0.85,
  turnVelocity: 0
};

function createBot(startX, startY, color, pathPoints) {
  return {
    x: startX,
    y: startY,
    prevX: startX,
    prevY: startY,
    angle: 0,
    speed: 0,

    // Индивидуальные параметры
    maxSpeed: 3.0,
    acceleration: 0.035,

    minSpeed: -1.5,
    reversePower: 0.025,
    friction: 0.02,
    baseTurnSpeed: 0.03,
    turnSmooth: 0.85,
    turnVelocity: 0,

    currentTarget: 0,
    lap: 0,
    finished: false,
    color: color,
    path: pathPoints,
    currentLapTime: 0,
    sectorPassed: [],

    // "пульс газа"
    throttlePhase: Math.random() * Math.PI * 2
  };
}

// ===== БОТ =====
const trackPath = [
  { x: 2899.4, y: 860.2 },
  { x: 3855, y: 1008 },
  { x: 4077, y: 943 },
  { x: 4175, y: 775 },
  { x: 4182, y: 521 },
  { x: 4114, y: 368 },
  { x: 3829, y: 269 },
  { x: 2992, y: 191 },
  { x: 2701, y: 221 },
  { x: 2628, y: 381 },
  { x: 2583, y: 533 },
  { x: 2296, y: 541 },
  { x: 2022, y: 635 },
  { x: 1692, y: 773 },
  { x: 1417, y: 718 },
  { x: 1398, y: 531 },
  { x: 1302, y: 237 },
  { x: 1092, y: 152 },
  { x: 696, y: 141 },
  { x: 332, y: 433 },
  { x: 192, y: 825 },
  { x: 352, y: 1189 },
  { x: 508, y: 1349 },
  { x: 737, y: 1234 },
  { x: 1035, y: 1126 },
  { x: 1249, y: 1045 },
  { x: 1363, y: 907 },
  { x: 2040, y: 785 },
  { x: 2517, y: 841 },
  { x: 2747, y: 862 }
];

const greenBotPath = [
  { x: 2807.7, y: 851.8 },
  { x: 3845, y: 1003 },
  { x: 4073, y: 940 },
  { x: 4177, y: 777 },
  { x: 4186, y: 527 },
  { x: 4110, y: 366 },
  { x: 3831, y: 272 },
  { x: 2999, y: 198 },
  { x: 2711, y: 231 },
  { x: 2618, y: 391 },
  { x: 2589, y: 539 },
  { x: 2286, y: 531 },
  { x: 2032, y: 645 },
  { x: 1682, y: 783 },
  { x: 1427, y: 728 },
  { x: 1388, y: 541 },
  { x: 1312, y: 247 },
  { x: 1082, y: 142 },
  { x: 666, y: 131 },
  { x: 322, y: 443 },
  { x: 182, y: 835 },
  { x: 342, y: 1199 },
  { x: 500, y: 1359 },
  { x: 707, y: 1244 },
  { x: 1015, y: 1116 },
  { x: 1229, y: 1035 },
  { x: 1363, y: 917 },
  { x: 2040, y: 795 },
  { x: 2497, y: 831 },
  { x: 2747, y: 872 }
];

const yellowBotPath = [
  { x: 2754.3, y: 883.2 },
  { x: 3865, y: 1023 },
  { x: 4093, y: 960 },
  { x: 4197, y: 797 },
  { x: 4206, y: 547 },
  { x: 4130, y: 386 },
  { x: 3851, y: 292 },
  { x: 3019, y: 218 },
  { x: 2731, y: 251 },
  { x: 2638, y: 411 },
  { x: 2609, y: 559 },
  { x: 2299, y: 537 },
  { x: 2052, y: 665 },
  { x: 1702, y: 755 },
  { x: 1447, y: 728 },
  { x: 1408, y: 551 },
  { x: 1332, y: 267 },
  { x: 1102, y: 162 },
  { x: 686, y: 151 },
  { x: 342, y: 463 },
  { x: 180, y: 855 },
  { x: 362, y: 1219 },
  { x: 520, y: 1364 },
  { x: 727, y: 1264 },
  { x: 1035, y: 1136 },
  { x: 1249, y: 1055 },
  { x: 1383, y: 905 },
  { x: 2060, y: 815 },
  { x: 2517, y: 851 },
  { x: 2767, y: 892 }
];

const bots = [
  createBot(2899.4, 860.2, "#0044ff", trackPath),      // синий
  createBot(2807.7, 851.8, "#00cc00", greenBotPath),   // зелёный
  createBot(2754.3, 883.2, "#ffcc00", yellowBotPath)   // жёлтый
];

function updateBot(bot) {

  const target = bot.path[bot.currentTarget];

  const dx = target.x - bot.x;
  const dy = target.y - bot.y;

  bot.currentLapTime += frameDelta;

  const distance = Math.sqrt(dx * dx + dy * dy);

  const time = Date.now() * 0.003;

  const microTurn =
    Math.sin(time + bot.x * 0.01) * 0.04 +
    Math.sin(time * 0.6 + bot.currentTarget) * 0.03 +
    Math.sin(time * 1.3 + bot.y * 0.005) * 0.02;

  const desiredAngle = Math.atan2(dy, dx) + microTurn;

  let angleDiff = desiredAngle - bot.angle;
  angleDiff = Math.atan2(Math.sin(angleDiff), Math.cos(angleDiff));

  // Волнообразная работа газа
  bot.throttlePhase += 0.02;
  const throttleWave = Math.sin(bot.throttlePhase) * 0.15;

  const dynamicMaxSpeed = bot.maxSpeed + throttleWave;

  if (bot.speed < dynamicMaxSpeed) {
    bot.speed += bot.acceleration;
  } else {
    bot.speed -= bot.friction;
  }

  bot.speed = Math.max(bot.minSpeed, Math.min(bot.maxSpeed, bot.speed));

  let targetTurn = 0;
  if (angleDiff > 0.05) targetTurn = 1;
  if (angleDiff < -0.05) targetTurn = -1;

  const speedFactor = 1 - (Math.abs(bot.speed) / bot.maxSpeed) * 0.4;
  const desiredTurn = targetTurn * bot.baseTurnSpeed * speedFactor;

  bot.turnVelocity =
    bot.turnVelocity * bot.turnSmooth +
    desiredTurn * (1 - bot.turnSmooth);

  const reverseFactor = bot.speed < 0 ? -1 : 1;
  bot.angle += bot.turnVelocity * reverseFactor;

  if (Math.abs(bot.turnVelocity) > 0.01 && bot.speed > bot.maxSpeed * 0.9) {
    bot.speed -= 0.05 + Math.random() * 0.05;
  }

  bot.prevX = bot.x;
  bot.prevY = bot.y;

  bot.x += Math.cos(bot.angle) * bot.speed;
  bot.y += Math.sin(bot.angle) * bot.speed;

  // === Проверка пересечения секторных линий ботом ===
  for (let i = 0; i < sectorLines.length; i++) {

    const line = sectorLines[i];

    const crossedSector = segmentsIntersect(
      bot.prevX, bot.prevY,
      bot.x, bot.y,
      line.x1, line.y1,
      line.x2, line.y2
    );

    if (crossedSector && !bot.sectorPassed[i]) {
      bot.sectorPassed[i] = true;
    }
  }

  if (distance < 70) {
    bot.currentTarget++;
    if (bot.currentTarget >= bot.path.length) {
      bot.currentTarget = 0;
    }
  }

  const botCrossed = segmentsIntersect(
    bot.prevX, bot.prevY,
    bot.x, bot.y,
    finishLine.x1, finishLine.y1,
    finishLine.x2, finishLine.y2
  );

  if (botCrossed && !bot.finished) {

    // Проверяем, прошёл ли бот все сектора
    const allPassed = bot.sectorPassed.every(v => v === true);

    if (!allPassed) return;

    bot.currentLapTime = 0;
    bot.sectorPassed.fill(false);

    bot.lap++;

    if (bot.lap >= 3) {
      bot.finished = true;
    }
  }
}

function drawBot(bot) {
  ctx.save();

  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.scale(CAMERA_ZOOM, CAMERA_ZOOM);
  ctx.translate(-player.x, -player.y);


  ctx.translate(bot.x, bot.y);
  ctx.rotate(bot.angle);

  const S = 0.6;

  const f = (x, y, w, h, col) => {
    ctx.fillStyle = col;
    ctx.fillRect(x * S, y * S, w * S, h * S);
  };

  const BLK = "#3f3838";
  const RED = "#ff0000";       // бампер
  const BODY = bot.color;      // основной кузов
  const YEL = "#ffff00";
  const AXL = "#777777";
  const TOP = bot.color;       // верхний маленький элемент (как у игрока синий)

  ctx.translate(-32 * S, -18 * S);

  // Передний бампер (красный)
  f(0, 13, 7, 10, RED);

  f(7, 5, 3, 5, AXL);
  f(7, 26, 3, 5, AXL);
  f(4, 1, 14, 8, BLK);
  f(4, 27, 14, 8, BLK);

  // Кузов (синий)
  f(8, 9, 28, 18, BODY);
  f(8, 7, 24, 2, BODY);
  f(8, 27, 24, 2, BODY);
  f(34, 11, 16, 2, BODY);
  f(34, 23, 16, 2, BODY);
  f(34, 12, 22, 12, BODY);
  f(40, 13, 16, 10, BODY);
  f(46, 14, 12, 8, BODY);
  f(50, 15, 8, 6, BODY);
  f(54, 16, 6, 4, BODY);
  f(56, 17, 8, 2, BODY);

  f(20, 11, 16, 14, BLK);
  f(32, 13, 6, 10, BLK);
  f(36, 14, 4, 8, BLK);

  f(15, 14, 6, 2, YEL);
  f(13, 16, 4, 4, YEL);
  f(15, 20, 6, 2, YEL);

  f(50, 6, 3, 5, AXL);
  f(50, 25, 3, 5, AXL);
  f(44, 3, 10, 6, BLK);
  f(44, 27, 10, 6, BLK);

  // Маленькие верхние элементы рисуем В САМОМ КОНЦЕ (поверх)
  f(58, 12, 4, 12, TOP);
  f(57, 14, 1, 8, TOP);

  ctx.restore();
}

const startState = {
  x: player.x,
  y: player.y,
  angle: player.angle
};

restartBtn.addEventListener("click", () => {

  // Сброс состояния финиша
  raceFinished = false;
  raceResult = "";
  fadeAlpha = 0;
  playerPosition = null;

  // Сброс игрока
  player.x = startState.x;
  player.y = startState.y;
  player.angle = startState.angle;
  player.speed = 0;
  player.turnVelocity = 0;
  lapCount = 1;

  // Сброс всех ботов
  for (let bot of bots) {
    bot.x = bot.path[0].x;
    bot.y = bot.path[0].y;
    bot.prevX = bot.x;
    bot.prevY = bot.y;
    bot.angle = 0;
    bot.speed = 0;
    bot.turnVelocity = 0;
    bot.currentTarget = 0;
    bot.lap = 0;
    bot.finished = false;
  }

  startCountdown();
});

let zWasPressed = false;

const finishLine = {
  x1: 2945.8,
  y1: 831.3,
  x2: 2935.6,
  y2: 935.3
};

// ===== ПРОМЕЖУТОЧНЫЕ ЛИНИИ =====
const sectorLines = [
  { x1: 3526, y1: 198, x2: 3512, y2: 309 },
  { x1: 1785, y1: 766, x2: 1756, y2: 663 },
  { x1: 223, y1: 806, x2: 110, y2: 807 },
  { x1: 1405, y1: 951, x2: 1325, y2: 871 }
];

for (let bot of bots) {
  bot.sectorPassed = new Array(sectorLines.length).fill(false);
}

// Хранит время пересечения каждой линии для текущего круга
let sectorCrossTimes = new Array(sectorLines.length).fill(null);
let sectorPassed = new Array(sectorLines.length).fill(false);

let lapCount = 1;

let raceFinished = false;
let playerPosition = null; // 1, 2, 3, 4
let fadeAlpha = 0;
// ===== ТАЙМЕР КРУГА =====
let lapTimer = 0;
let lastFrameTime = Date.now();
let frameDelta = 0;

// ===== СООБЩЕНИЕ СЕКТОРА =====
let sectorMessage = "";
let sectorMessageTimer = 0;

function segmentsIntersect(ax, ay, bx, by, cx, cy, dx, dy) {
  function ccw(x1, y1, x2, y2, x3, y3) {
    return (x3 - x1) * (y2 - y1) - (x2 - x1) * (y3 - y1);
  }

  const d1 = ccw(ax, ay, bx, by, cx, cy);
  const d2 = ccw(ax, ay, bx, by, dx, dy);
  const d3 = ccw(cx, cy, dx, dy, ax, ay);
  const d4 = ccw(cx, cy, dx, dy, bx, by);

  return (d1 * d2 < 0) && (d3 * d4 < 0);
}
function showSectorMessage(text) {
  sectorMessage = text;
  sectorMessageTimer = 2;
}

function drawStartScreen() {
  if (!startImage.complete) return;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(startImage, 0, 0, canvas.width, canvas.height);
}

function drawBackground() {
  ctx.save();

  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.scale(CAMERA_ZOOM, CAMERA_ZOOM);
  ctx.translate(-player.x, -player.y);


  if (!trackImage.complete) {
    ctx.restore();
    return;
  }

  ctx.drawImage(trackImage, 0, 0);

  ctx.strokeStyle = "#d3d3d3";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(finishLine.x1, finishLine.y1);
  ctx.lineTo(finishLine.x2, finishLine.y2);
  ctx.stroke();

  // Рисуем промежуточные линии
  ctx.strokeStyle = "#414242";
  ctx.lineWidth = 2;

  for (let line of sectorLines) {
    ctx.beginPath();
    ctx.moveTo(line.x1, line.y1);
    ctx.lineTo(line.x2, line.y2);
    ctx.stroke();
  }

  ctx.restore();
}

function drawCar() {
  ctx.save();

  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.scale(CAMERA_ZOOM, CAMERA_ZOOM);
  ctx.translate(-player.x, -player.y);


  ctx.translate(player.x, player.y);
  ctx.rotate(player.angle);

  const S = 0.6;

  const f = (x, y, w, h, col) => {
    ctx.fillStyle = col;
    ctx.fillRect(x * S, y * S, w * S, h * S);
  };

  const WHT = "#ffffff";
  const BLK = "#3f3838";
  const RED = "#ff0000";
  const BLU = "#1144ff";
  const YEL = "#ffff00";
  const AXL = "#777777";

  ctx.translate(-32 * S, -18 * S);

  f(0, 13, 7, 10, BLU);
  f(7, 5, 3, 5, AXL);
  f(7, 26, 3, 5, AXL);
  f(4, 1, 14, 8, BLK);
  f(4, 27, 14, 8, BLK);
  f(8, 9, 28, 18, RED);
  f(8, 7, 24, 2, RED);
  f(8, 27, 24, 2, RED);
  f(34, 11, 16, 2, RED);
  f(34, 23, 16, 2, RED);
  f(34, 12, 22, 12, RED);
  f(40, 13, 16, 10, RED);
  f(46, 14, 12, 8, RED);
  f(50, 15, 8, 6, RED);
  f(54, 16, 6, 4, RED);
  f(56, 17, 8, 2, RED);
  f(20, 11, 16, 14, BLK);
  f(32, 13, 6, 10, BLK);
  f(36, 14, 4, 8, BLK);
  f(15, 14, 6, 2, YEL);
  f(13, 16, 4, 4, YEL);
  f(15, 20, 6, 2, YEL);
  f(50, 6, 3, 5, AXL);
  f(50, 25, 3, 5, AXL);
  f(44, 3, 10, 6, BLK);
  f(44, 27, 10, 6, BLK);
  f(58, 12, 4, 12, BLU);
  f(57, 14, 1, 8, BLU);

  ctx.restore();
}

function drawCountdown() {
  if (!countdownActive) return;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "white";
  ctx.font = "bold 120px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(countdownValue, canvas.width / 2, canvas.height / 2);
}

function update() {
  if (!gameStarted) return;

  // расчёт delta времени
  const now = Date.now();
  const delta = (now - lastFrameTime) / 1000;
  lastFrameTime = now;
  frameDelta = delta;

  if (!countdownActive && !raceFinished) {
    lapTimer += delta;
  }

// обновление таймера сообщений
if (sectorMessageTimer > 0) {
  sectorMessageTimer -= delta;
}

  const gas = keys.w || keys.ц;
  const reverse = keys.s || keys.ы;
  const left = keys.a || keys.ф;
  const right = keys.d || keys.в;

  if (countdownActive) {

    const elapsed = Math.floor((Date.now() - countdownStartTime) / 1000);
    const newValue = 3 - elapsed;

    if (newValue > 0 && newValue !== lastCountdownSoundValue) {
      countdownSound.play();
      lastCountdownSoundValue = newValue;
    }

    countdownValue = newValue;

    if (countdownValue <= 0) {
      countdownActive = false;
      lastCountdownSoundValue = null;
    }

    return;
  }



  for (let bot of bots) {
    updateBot(bot);
  }

  if (raceFinished) {
    player.speed *= 0.98; // инерционное торможение
    if (Math.abs(player.speed) < 0.02) {
      player.speed = 0;
    }
  }

  if (gas) player.speed += player.acceleration;
  else if (reverse) player.speed -= player.reversePower;
  else {
    if (player.speed > 0) player.speed -= player.friction;
    if (player.speed < 0) player.speed += player.friction;
  }

  player.speed = Math.max(player.minSpeed, Math.min(player.maxSpeed, player.speed));

  // === Обновление звука двигателя ===
  if (!countdownActive && !raceFinished && engineStarted) {

    const speedRatio = Math.abs(player.speed) / player.maxSpeed;

    const volume = 0.2 + speedRatio * 0.8;
    const rate = 0.8 + speedRatio * 0.7;

    currentEngine.volume = volume;
    currentEngine.playbackRate = rate;
    nextEngine.volume = volume;
    nextEngine.playbackRate = rate;

    // если файл почти закончился — запускаем второй
    if (currentEngine.duration - currentEngine.currentTime < 0.15) {

      nextEngine.currentTime = 0;
      nextEngine.play();

      // меняем местами
      const temp = currentEngine;
      currentEngine = nextEngine;
      nextEngine = temp;
    }

} else if (engineStarted) {

  currentEngine.volume *= 0.95;
  nextEngine.volume *= 0.95;
}


  if (!gas && !reverse && Math.abs(player.speed) < 0.03) player.speed = 0;


  let targetTurn = 0;
  if (left) targetTurn = -1;
  if (right) targetTurn = 1;

  const speedFactor = 1 - (Math.abs(player.speed) / player.maxSpeed) * 0.4;
  const desiredTurn = targetTurn * player.baseTurnSpeed * speedFactor;

  player.turnVelocity =
    player.turnVelocity * player.turnSmooth +
    desiredTurn * (1 - player.turnSmooth);

  const reverseFactor = player.speed < 0 ? -1 : 1;
  player.angle += player.turnVelocity * reverseFactor;
  
  // Снижение скорости в повороте
  if (Math.abs(player.turnVelocity) > 0.01 && player.speed > 2.8) {
  player.speed -= 0.10;
  }

  const oldX = player.x;
  const oldY = player.y;

  player.x += Math.cos(player.angle) * player.speed;
  player.y += Math.sin(player.angle) * player.speed;

  // === Проверка пересечения промежуточных линий ===
for (let i = 0; i < sectorLines.length; i++) {

  const line = sectorLines[i];

  const crossedSector = segmentsIntersect(
    oldX, oldY,
    player.x, player.y,
    line.x1, line.y1,
    line.x2, line.y2
  );

  if (crossedSector && !sectorPassed[i]) {
    sectorPassed[i] = true;

    sectorSound.currentTime = 0;
    sectorSound.play();

    showSectorMessage("LAP TIME: " + lapTimer.toFixed(2));
  }



}

  const crossed = segmentsIntersect(
    oldX, oldY,
    player.x, player.y,
    finishLine.x1, finishLine.y1,
    finishLine.x2, finishLine.y2
  );

  if (crossed && !raceFinished) {

    const allPassed = sectorPassed.every(v => v === true);

    if (!allPassed) {
      return;
    }

    // Сохраняем время круга
    const completedLapTime = lapTimer;

    // Показываем сообщение
    showSectorMessage("LAP " + lapCount + "  " + completedLapTime.toFixed(2) + "s");

    // Сбрасываем таймер
    lapTimer = 0;

    sectorPassed.fill(false);
    sectorCrossTimes.fill(null);

    lapCount++;

    // если это не последний круг — играем звук сектора
    if (lapCount < 3) {
      sectorSound.currentTime = 0;
      sectorSound.play();
    }

    
  if (lapCount >= 3) {

    let position = 1;

    for (let bot of bots) {

      // если бот прошёл больше кругов — он впереди
      if (bot.lap > lapCount - 1) {
        position++;
      }

      // если круг равный — смотрим кто дальше по трассе
      else if (bot.lap === lapCount - 1) {

        // если бот уже прошёл больше точек пути — он впереди
        if (bot.currentTarget > 0) {
          position++;
        }
      }
    }

    playerPosition = position;

    finishSound.currentTime = 0;
    finishSound.play();

    raceFinished = true;
  }


  }

  lapsUI.innerText = "LAPS: " + lapCount;
  speedUI.innerText = "SPEED: " + player.speed.toFixed(2);
  lapTimeUI.innerText = "TIME: " + lapTimer.toFixed(2);

}

function loop() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (!gameStarted) {
    drawStartScreen();
  } else {
    drawBackground();
    drawCar();
    for (let bot of bots) {
      drawBot(bot);
    }

    drawCountdown();
  }

  update();
  if (raceFinished) {
    fadeAlpha += 0.01;
    if (fadeAlpha > 0.8) fadeAlpha = 0.8;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "rgba(0,0,0," + fadeAlpha + ")";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "white";
    ctx.font = "bold 80px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    let text = "";

    if (playerPosition === 1) text = "YOU WON! 1 PLACE";
    if (playerPosition === 2) text = "YOU FINISHED 2ND";
    if (playerPosition === 3) text = "YOU FINISHED 3RD";
    if (playerPosition === 4) text = "YOU FINISHED 4TH";

    ctx.fillText(text, canvas.width / 2, canvas.height / 2);

  }
    if (sectorMessageTimer > 0) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "white";
    ctx.font = "bold 40px monospace";
    ctx.textAlign = "center";
    ctx.fillText(sectorMessage, canvas.width / 2, canvas.height * 0.15);
  }


  requestAnimationFrame(loop);
}

loop();

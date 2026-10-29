// 캔버스 설정
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
let canvasWidth, canvasHeight;
const LANE_Y = window.innerHeight * 0.65;

function resizeCanvas() {
  canvasWidth = window.innerWidth;
  canvasHeight = window.innerHeight;
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
}
window.addEventListener('resize', () => {
  resizeCanvas();
  // T02-C13: 창 크기 변경 뒤 게임 상태 유지 (캔버스 크기만 재조정)
});
resizeCanvas();

// 🖼️ 이미지 로드
const soldierImg = new Image(); soldierImg.src = 'soldier.png'; soldierImg.onerror = () => { soldierImg.src = 'soldier.png.png'; };
const zombieImg = new Image(); zombieImg.src = 'zombie.png'; zombieImg.onerror = () => { zombieImg.src = 'zombie.png.png'; };
const mageImg = new Image(); mageImg.src = 'mage_unit.png'; mageImg.onerror = () => { mageImg.src = mageImg.src.includes('mage_unit.png') ? 'mage.png' : 'mage.png.png'; };
const archerImg = new Image(); archerImg.src = 'archer_unit.png'; archerImg.onerror = () => { archerImg.src = archerImg.src.includes('archer_unit.png') ? 'archer.png' : 'archer.png.png'; };
const bossImg = new Image(); bossImg.src = 'boss.png'; bossImg.onerror = () => { bossImg.src = 'boss.png.png'; };
const backgroundImg = new Image(); backgroundImg.src = 'battlefield_bg.png'; backgroundImg.onerror = () => { backgroundImg.src = backgroundImg.src.includes('battlefield_bg.png') ? 'background.png' : 'background.png.png'; };
const castle1Img = new Image(); castle1Img.src = 'castle1.png'; castle1Img.onerror = () => { castle1Img.src = 'castle1.png.png'; };
const castle2Img = new Image(); castle2Img.src = 'castle2.png'; castle2Img.onerror = () => { castle2Img.src = 'castle2.png.png'; };

let heroType = '';
const heroData = { pantheon: '판테온', mage: '마법사', archer: '궁수' };

const minionStats = {
  pantheon: [
    { name: '보병', hp: 160, atk: 18, speed: 1.2, range: 45, cost: 30, color: '#e74c3c', size: 24, type: 'melee' },
    { name: '중보병', hp: 320, atk: 35, speed: 1.0, range: 45, cost: 50, color: '#c0392b', size: 30, type: 'melee' },
    { name: '정예병', hp: 650, atk: 70, speed: 0.85, range: 45, cost: 70, color: '#8e44ad', size: 38, type: 'melee' }
  ],
  mage: [
    { name: '견습 마법사', hp: 90, atk: 22, speed: 1.0, range: 250, cost: 30, color: '#9b59b6', size: 24, type: 'ranged' },
    { name: '비전 마법사', hp: 140, atk: 45, speed: 0.9, range: 280, cost: 50, color: '#8e44ad', size: 28, type: 'ranged' },
    { name: '대마법사', hp: 220, atk: 85, speed: 0.75, range: 300, cost: 70, color: '#d35400', size: 36, type: 'ranged' }
  ],
  archer: [
    { name: '정찰 궁수', hp: 110, atk: 26, speed: 1.5, range: 190, cost: 30, color: '#2ecc71', size: 24, type: 'ranged' },
    { name: '저격수', hp: 160, atk: 52, speed: 1.3, range: 220, cost: 50, color: '#27ae60', size: 28, type: 'ranged' },
    { name: '명사수', hp: 260, atk: 105, speed: 1.05, range: 250, cost: 70, color: '#1abc9c', size: 36, type: 'ranged' }
  ]
};

let gameActive = false;
let animationId;
let lastTime = 0;

let mana = 0;
const MAX_MANA = 100;

let playerCastleHp = 2000;
let enemyCastleHp = 2000;
const MAX_CASTLE_HP = 2000;

let gameState = 'PLAYING'; // 'PLAYING', 'PAUSED', 'DEFEAT', 'VICTORY'
let gameTime = 0;
const BOSS_SPAWN_TIME = 25000;

// ⭐️ 스테이지 및 레벨 변수
let currentStage = 1;
let currentLevel = 1;
const MAX_STAGE = 5;

let allies = [];
let enemies = [];
let projectiles = [];
let cannonBalls = [];
let effects = [];

let spawnTimer = 0;
let castleCannonTimer = 0;
let bossActive = false;
let boss = null;
let bossWarningTimer = 0;

// T02-C12: 연타 방지
let summonCooldown = false;

// T02-C27: 효과 설정
let isMuted = false;
let isReduceMotion = false;

const PLAYER_CASTLE_X = 120;
const ENEMY_CASTLE_X = 120;

// --- T02-C22 ~ C25: localStorage 저장/불러오기 ---
const STORAGE_KEY = 'paladog_game_records';
function loadRecords() {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return { maxStage: 0 };
    const parsed = JSON.parse(data);
    if (typeof parsed.maxStage !== 'number') return { maxStage: 0 };
    return parsed;
  } catch (e) {
    return { maxStage: 0 };
  }
}
function saveRecord(stage) {
  try {
    const records = loadRecords();
    if (stage > records.maxStage) {
      records.maxStage = stage;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
    }
  } catch (e) { console.warn('저장 실패:', e); }
}

// --- 화면 전환 ---
document.getElementById('start-btn').addEventListener('click', () => {
  document.getElementById('start-screen').style.display = 'none';
  document.getElementById('select-screen').style.display = 'flex';
});

document.querySelectorAll('.hero-card').forEach(card => {
  card.addEventListener('click', () => {
    heroType = card.dataset.hero;
    startGame();
  });
});

document.querySelectorAll('.summon-btn').forEach((btn, index) => {
  btn.addEventListener('click', () => {
    if (!gameActive || gameState !== 'PLAYING' || summonCooldown) return;
    const stat = minionStats[heroType][index];
    if (mana >= stat.cost) {
      mana -= stat.cost;
      updateUI();
      allies.push({
        x: PLAYER_CASTLE_X + 40, y: LANE_Y,
        hp: stat.hp, maxHp: stat.hp, atk: stat.atk, speed: stat.speed,
        range: stat.range, color: stat.color, size: stat.size, type: stat.type,
        lastAttack: 0, isEnemy: false, attackTimer: 0
      });
      effects.push({ x: PLAYER_CASTLE_X + 40, y: LANE_Y, timer: 120, type: 'summon' });
      summonCooldown = true;
      setTimeout(() => { summonCooldown = false; }, 200);
    }
  });
});

document.getElementById('restart-btn').addEventListener('click', () => {
  document.getElementById('game-screen').style.display = 'none';
  document.getElementById('select-screen').style.display = 'flex';
  gameActive = false;
});

// --- T02-C15: 일시정지 ---
function togglePause() {
  if (gameState === 'PLAYING') {
    gameState = 'PAUSED';
    document.getElementById('pause-overlay').style.display = 'flex';
  } else if (gameState === 'PAUSED') {
    gameState = 'PLAYING';
    document.getElementById('pause-overlay').style.display = 'none';
    lastTime = performance.now();
  }
}
document.addEventListener('keydown', (e) => { if (e.key === 'p' || e.key === 'P') togglePause(); });
document.getElementById('pause-btn').addEventListener('click', togglePause);
document.getElementById('resume-btn').addEventListener('click', togglePause);

// --- T02-C27: 음소거 / 움직임 줄이기 ---
document.getElementById('mute-btn').addEventListener('click', (e) => {
  isMuted = !isMuted;
  e.target.textContent = isMuted ? '🔇 소리 끔' : '🔊 소리 켬';
});
document.getElementById('reduce-motion-btn').addEventListener('click', (e) => {
  isReduceMotion = !isReduceMotion;
  e.target.textContent = isReduceMotion ? '🚫 효과 끔' : '✨ 효과 켬';
});

// --- 게임 시작 ---
function startGame() {
  document.getElementById('select-screen').style.display = 'none';
  document.getElementById('game-screen').style.display = 'block';
  document.getElementById('hero-name').textContent = `소환사: ${heroData[heroType]}`;
  const avatarElem = document.getElementById('hero-avatar');
  if (avatarElem) avatarElem.src = `hero_${heroType}.png`;

  gameActive = true;
  gameState = 'PLAYING';
  mana = 0;
  currentStage = 1;
  currentLevel = 1;
  playerCastleHp = MAX_CASTLE_HP;
  enemyCastleHp = MAX_CASTLE_HP;
  
  allies = []; enemies = []; projectiles = []; cannonBalls = []; effects = [];
  spawnTimer = 0; castleCannonTimer = 0; bossActive = false; boss = null; bossWarningTimer = 0; gameTime = 0;
  summonCooldown = false;
  document.getElementById('pause-overlay').style.display = 'none';
  document.getElementById('restart-btn').style.display = 'none';

  updateUI();
  updateStageUI();

  const buttons = document.querySelectorAll('.summon-btn');
  const stats = minionStats[heroType];
  buttons.forEach((btn, index) => {
    const s = stats[index];
    let thumb = 'soldier.png';
    if (heroType === 'mage') thumb = mageImg.src;
    else if (heroType === 'archer') thumb = archerImg.src;
    btn.innerHTML = `
      <span class="cost">${s.cost}</span>
      <div class="summon-thumb"><img src="${thumb}" onerror="this.style.display='none'"></div>
      <span class="unit-name">${s.name}</span>
    `;
    btn.disabled = false;
  });

  lastTime = performance.now();
  if (animationId) cancelAnimationFrame(animationId);
  animationId = requestAnimationFrame(gameLoop);
}

function updateUI() {
  document.getElementById('mana-bar').style.width = `${(mana / MAX_MANA) * 100}%`;
  document.getElementById('mana-text').textContent = `마나: ${Math.floor(mana)}/100`;

  const buttons = document.querySelectorAll('.summon-btn');
  const stats = minionStats[heroType];
  buttons.forEach((btn, index) => {
    btn.disabled = mana < stats[index].cost || gameState !== 'PLAYING';
  });

  document.getElementById('player-castle-hp').style.width = `${Math.max(0, playerCastleHp / MAX_CASTLE_HP) * 100}%`;
  document.getElementById('enemy-castle-hp').style.width = `${Math.max(0, enemyCastleHp / MAX_CASTLE_HP) * 100}%`;
}

function updateStageUI() {
  const stageElem = document.getElementById('stage-level');
  if (stageElem) {
    stageElem.textContent = `스테이지 ${currentStage} (Lv.${currentLevel})`;
  }
}

// --- T02-C16, C17: 메인 루프 ---
function gameLoop(timestamp) {
  if (!gameActive) return;
  const dt = timestamp - lastTime;
  lastTime = timestamp;

  if (dt > 100) {
    lastTime = timestamp;
    animationId = requestAnimationFrame(gameLoop);
    return;
  }

  if (gameState === 'PLAYING') {
    gameTime += dt;
    if (mana < MAX_MANA) {
      mana = Math.min(MAX_MANA, mana + 15 * (dt / 1000));
      updateUI();
    }
    spawnSystem(dt);
    updateUnits(dt);
    updateProjectiles(dt);
    updateCannonBalls(dt);
    checkGameState();
  }
  
  render();
  
  if (gameActive) animationId = requestAnimationFrame(gameLoop);
}

function spawnSystem(dt) {
  spawnTimer += dt;
  if (spawnTimer > 2500) {
    spawnTimer = 0;
    const difficultyMultiplier = 1 + (currentStage - 1) * 0.3;
    const enemyHp = (100 + (gameTime / 1000) * 5) * difficultyMultiplier;
    const enemyAtk = 15 * difficultyMultiplier;
    
    enemies.push({
      x: canvasWidth - ENEMY_CASTLE_X - 40, y: LANE_Y,
      hp: enemyHp, maxHp: enemyHp, atk: enemyAtk, speed: 0.8,
      range: 40, color: '#555', size: 26, type: 'melee',
      lastAttack: 0, isEnemy: true, attackTimer: 0
    });
  }
  if (gameTime > BOSS_SPAWN_TIME && !bossActive) {
    bossActive = true;
    bossWarningTimer = 180;
    const bossMultiplier = 1 + (currentStage - 1) * 0.5;
    boss = {
      x: canvasWidth - ENEMY_CASTLE_X - 60, y: LANE_Y,
      hp: 4000 * bossMultiplier, maxHp: 4000 * bossMultiplier, atk: 60 * bossMultiplier, speed: 0.45, range: 65, size: 60, color: '#8e44ad',
      lastAttack: 0, attackTimer: 0
    };
  }
}

function updateCannonBalls(dt) {
  castleCannonTimer += dt;
  if (castleCannonTimer > 2000) {
    let closestEnemy = enemies.find(e => e.x > PLAYER_CASTLE_X && e.x < PLAYER_CASTLE_X + 400);
    if (!closestEnemy && bossActive && boss && boss.x > PLAYER_CASTLE_X && boss.x < PLAYER_CASTLE_X + 400) closestEnemy = boss;
    if (closestEnemy) {
      castleCannonTimer = 0;
      cannonBalls.push({ x: PLAYER_CASTLE_X, y: LANE_Y - 40, target
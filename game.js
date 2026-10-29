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
window.addEventListener('resize', resizeCanvas);
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

let gameState = 'PLAYING';
let gameTime = 0;
const BOSS_SPAWN_TIME = 25000;

// ⭐️ 스테이지 및 레벨 변수
let currentStage = 1;
let currentLevel = 1;
const MAX_STAGE = 5; // 최대 스테이지 (5 클리어 시 최종 승리)

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

let summonCooldown = false;
let isMuted = false;
let isReduceMotion = false;

const PLAYER_CASTLE_X = 120;
const ENEMY_CASTLE_X = 120;

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

// --- 일시정지 ---
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

document.addEventListener('keydown', (e) => {
  if (e.key === 'p' || e.key === 'P') togglePause();
});
document.getElementById('pause-btn').addEventListener('click', togglePause);
document.getElementById('resume-btn').addEventListener('click', togglePause);

// --- 음소거 / 효과 ---
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

// --- 메인 루프 ---
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
    checkGameState(); // ⭐️ 승리/패배 판정
  }
  
  render();
  
  if (gameActive) animationId = requestAnimationFrame(gameLoop);
}

// ⭐️ 난이도 상승 스폰
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
      cannonBalls.push({ x: PLAYER_CASTLE_X, y: LANE_Y - 40, target: closestEnemy, speed: 15, atk: 50, color: '#f1c40f' });
    }
  }
  const speedMultiplier = dt / 16.67;
  cannonBalls.forEach((cannon, index) => {
    if (cannon.target.hp <= 0) { cannonBalls.splice(index, 1); return; }
    if (cannon.x < cannon.target.x) cannon.x += cannon.speed * speedMultiplier;
    else {
      cannon.target.hp -= cannon.atk;
      effects.push({ x: cannon.target.x, y: cannon.target.y, timer: 150, type: 'cannon' });
      cannonBalls.splice(index, 1);
    }
  });
}

function updateUnits(dt) {
  const speedMultiplier = dt / 16.67;
  const allyStopLine = canvasWidth - ENEMY_CASTLE_X - 60;
  const enemyStopLine = PLAYER_CASTLE_X + 60;

  // 아군
  allies.forEach(ally => {
    let frontEnemy = null;
    enemies.forEach(enemy => { if (enemy.x > ally.x && (!frontEnemy || enemy.x < frontEnemy.x)) frontEnemy = enemy; });
    if (bossActive && boss && boss.hp > 0 && boss.x > ally.x) { if (!frontEnemy || boss.x < frontEnemy.x) frontEnemy = boss; }
    if (ally.attackTimer > 0) ally.attackTimer -= dt;

    if (frontEnemy) {
      if (frontEnemy.x - ally.x <= ally.range) {
        if (performance.now() - ally.lastAttack > 800) {
          ally.lastAttack = performance.now(); ally.attackTimer = 300;
          if (ally.type === 'ranged') {
            projectiles.push({ x: ally.x + ally.size, y: ally.y - 10, target: frontEnemy, atk: ally.atk, speed: 13, color: ally.color, heroType: heroType });
          } else {
            frontEnemy.hp -= ally.atk;
            effects.push({ x: frontEnemy.x, y: frontEnemy.y - 15, timer: 100, type: 'hit' });
          }
        }
      } else if (ally.x < allyStopLine) ally.x += ally.speed * speedMultiplier;
    } else if (ally.x < allyStopLine) {
      ally.x += ally.speed * speedMultiplier;
    } else {
      if (performance.now() - ally.lastAttack > 1000) {
        ally.lastAttack = performance.now(); ally.attackTimer = 300;
        enemyCastleHp = Math.max(0, enemyCastleHp - ally.atk);
        effects.push({ x: canvasWidth - ENEMY_CASTLE_X, y: LANE_Y + (Math.random() * 40 - 20), timer: 100, type: 'hit' });
        updateUI();
      }
    }
  });

  // 적군
  enemies.forEach(enemy => {
    let frontAlly = null;
    allies.forEach(ally => { if (ally.x < enemy.x && (!frontAlly || ally.x > frontAlly.x)) frontAlly = ally; });
    if (enemy.attackTimer > 0) enemy.attackTimer -= dt;

    if (frontAlly) {
      if (enemy.x - frontAlly.x <= enemy.range) {
        if (performance.now() - enemy.lastAttack > 1000) {
          enemy.lastAttack = performance.now(); enemy.attackTimer = 300;
          frontAlly.hp -= enemy.atk;
          effects.push({ x: frontAlly.x, y: frontAlly.y - 15, timer: 100, type: 'hit' });
        }
      } else if (enemy.x > enemyStopLine) {
        enemy.x -= enemy.speed * speedMultiplier;
      }
    } else if (enemy.x > enemyStopLine) {
      enemy.x -= enemy.speed * speedMultiplier;
    } else {
      enemy.x = enemyStopLine;
      if (performance.now() - enemy.lastAttack > 1000) {
        enemy.lastAttack = performance.now(); enemy.attackTimer = 300;
        playerCastleHp = Math.max(0, playerCastleHp - enemy.atk);
        effects.push({ x: PLAYER_CASTLE_X, y: LANE_Y, timer: 100, type: 'hit' });
        updateUI();
      }
    }
  });

  // 보스
  if (bossActive && boss && boss.hp > 0) {
    let frontAlly = null;
    allies.forEach(ally => { if (ally.x < boss.x && (!frontAlly || ally.x > frontAlly.x)) frontAlly = ally; });
    if (boss.attackTimer > 0) boss.attackTimer -= dt;

    if (frontAlly) {
      if (boss.x - frontAlly.x <= boss.range) {
        if (performance.now() - boss.lastAttack > 1200) {
          boss.lastAttack = performance.now(); boss.attackTimer = 400;
          frontAlly.hp -= boss.atk;
          effects.push({ x: frontAlly.x, y: frontAlly.y - 25, timer: 100, type: 'hit' });
        }
      } else if (boss.x > enemyStopLine) {
        boss.x -= boss.speed * speedMultiplier;
      }
    } else if (boss.x > enemyStopLine) {
      boss.x -= boss.speed * speedMultiplier;
    } else {
      boss.x = enemyStopLine;
      if (performance.now() - boss.lastAttack > 1500) {
        boss.lastAttack = performance.now(); boss.attackTimer = 400;
        playerCastleHp = Math.max(0, playerCastleHp - boss.atk * 2);
        effects.push({ x: PLAYER_CASTLE_X, y: LANE_Y, timer: 100, type: 'hit' });
        updateUI();
      }
    }
  }

  allies = allies.filter(ally => ally.hp > 0);
  enemies = enemies.filter(enemy => enemy.hp > 0);
}

function updateProjectiles(dt) {
  const speedMultiplier = dt / 16.67;
  projectiles.forEach((projectile, index) => {
    if (projectile.target.hp <= 0) { projectiles.splice(index, 1); return; }
    if (projectile.x < projectile.target.x) {
      projectile.x += projectile.speed * speedMultiplier;
    } else {
      projectile.target.hp -= projectile.atk;
      effects.push({ x: projectile.target.x, y: projectile.target.y - 15, timer: 100, type: 'hit' });
      projectiles.splice(index, 1);
    }
  });
}

// ⭐️ 승리/패배 및 스테이지 처리
// ⭐️ 승리/패배 및 스테이지 처리
function checkGameState() {
  if (gameState !== 'PLAYING') return;

  // 1. 패배 조건 (내 성 파괴)
  if (playerCastleHp <= 0) {
    playerCastleHp = 0;
    updateUI();
    gameState = 'DEFEAT';
    showEndScreen('패배... 내 성이 파괴되었습니다.');
    return;
  }

  // 2. 승리 조건 (적 성 파괴)
  if (enemyCastleHp <= 0) {
    enemyCastleHp = 0;
    updateUI();

    // ⭐️ 스테이지가 남아있으면 다음 스테이지로 넘어감
    if (currentStage < MAX_STAGE) {
      currentStage++;
      currentLevel++;
      
      // 다음 스테이지 준비 (체력 회복, 적/아군 초기화, 타이머 리셋)
      playerCastleHp = MAX_CASTLE_HP;
      enemyCastleHp = MAX_CASTLE_HP;
      gameTime = 0;
      bossActive = false;
      boss = null;
      bossWarningTimer = 0;
      allies = [];
      enemies = [];
      projectiles = [];
      cannonBalls = [];
      effects = [];
      spawnTimer = 0;
      castleCannonTimer = 0;
      
      updateStageUI();
      updateUI();
      
      // ⭐️ 스테이지 클리어 알림 (게임은 멈추지 않고 계속 진행됨)
      setTimeout(() => {
        alert(`🎉 스테이지 ${currentStage - 1} 클리어!\n다음 스테이지 ${currentStage}로 진입합니다! 난이도가 상승합니다.`);
      }, 50);
      
    } else {
      // ⭐️ 마지막 스테이지까지 클리어한 경우 (최종 승리)
      gameState = 'VICTORY';
      showEndScreen('최종 승리! 모든 스테이지를 클리어했습니다!');
    }
  }
}
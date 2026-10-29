// 캔버스 설정
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
let canvasWidth, canvasHeight;
let LANE_Y = window.innerHeight * 0.65;

function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1;
  canvasWidth = window.innerWidth;
  canvasHeight = window.innerHeight;
  canvas.width = Math.round(canvasWidth * dpr);
  canvas.height = Math.round(canvasHeight * dpr);
  canvas.style.width = canvasWidth + 'px';
  canvas.style.height = canvasHeight + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  LANE_Y = canvasHeight * 0.65;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// 🖼️ 이미지 로드 (대체 이미지가 없거나 로드에 실패해도 무한 재시도하지 않음)
function loadImage(primary, fallback) {
  const img = new Image();
  img.onerror = () => {
    img.onerror = null;
    if (fallback) img.src = fallback;
  };
  img.src = primary;
  return img;
}
const soldierImg = loadImage('soldier.png');
const zombieImg = loadImage('zombie.png');
const mageImg = loadImage('mage_unit.png', 'mage.png');
const archerImg = loadImage('archer_unit.png', 'hero_archer.png');
const bossImg = loadImage('boss.png');
const backgroundImg = loadImage('battlefield_bg.png', 'background.png');
const castle1Img = loadImage('castle1.png');
const castle2Img = loadImage('castle2.png');

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
let endMessage = '';
let stageClearTimer = 0;
const STAGE_CLEAR_DELAY = 2500;
let summonCooldown = false;
let gameSpeed = 1;
let isMuted = false;
let isReduceMotion = false;

const PLAYER_CASTLE_X = 120;
const ENEMY_CASTLE_X = 120;

// --- 이벤트 리스너 ---
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

function togglePause() {
  if (!gameActive) return;
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

document.getElementById('mute-btn').addEventListener('click', (e) => {
  isMuted = !isMuted;
  e.target.textContent = isMuted ? '🔇 소리 끔' : '🔊 소리 켬';
});
document.getElementById('reduce-motion-btn').addEventListener('click', (e) => {
  isReduceMotion = !isReduceMotion;
  e.target.textContent = isReduceMotion ? '🚫 효과 끔' : '✨ 효과 켬';
});

const speedButtons = document.querySelectorAll('.speed-btn');
function setGameSpeed(speed) {
  gameSpeed = speed;
  speedButtons.forEach(btn => btn.classList.toggle('active', Number(btn.dataset.speed) === speed));
}
speedButtons.forEach(btn => {
  btn.addEventListener('click', () => setGameSpeed(Number(btn.dataset.speed)));
});

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
  endMessage = '';
  stageClearTimer = 0;
  summonCooldown = false;
  setGameSpeed(1);
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
    btn.innerHTML = `<span class="cost">${s.cost}</span><div class="summon-thumb"><img src="${thumb}" onerror="this.style.display='none'"></div><span class="unit-name">${s.name}</span>`;
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
  document.getElementById('stage-level').textContent = `스테이지 ${currentStage} (Lv.${currentLevel})`;
}

function gameLoop(timestamp) {
  if (!gameActive) return;
  let dt = timestamp - lastTime;
  lastTime = timestamp;
  if (!Number.isFinite(dt) || dt < 0) dt = 0;
  dt = Math.min(dt, 100);

  if (gameState === 'PLAYING') {
    const step = dt * gameSpeed;
    gameTime += step;
    if (mana < MAX_MANA) {
      mana = Math.min(MAX_MANA, mana + 15 * (step / 1000));
      updateUI();
    }
    spawnSystem(step);
    updateUnits(step);
    updateProjectiles(step);
    updateCannonBalls(step);
    checkGameState();
  } else if (gameState === 'STAGE_CLEAR') {
    stageClearTimer -= dt;
    if (stageClearTimer <= 0) advanceStage();
  }
  
  render();
  
  if (gameActive) animationId = requestAnimationFrame(gameLoop);
}

function spawnSystem(dt) {
  spawnTimer += dt;
  if (spawnTimer > 2500) {
    spawnTimer = 0;
    const diff = 1 + (currentStage - 1) * 0.3;
    enemies.push({
      x: canvasWidth - ENEMY_CASTLE_X - 40, y: LANE_Y,
      hp: (100 + (gameTime / 1000) * 5) * diff, maxHp: (100 + (gameTime / 1000) * 5) * diff, atk: 15 * diff, speed: 0.8,
      range: 40, color: '#555', size: 26, type: 'melee', lastAttack: 0, isEnemy: true, attackTimer: 0
    });
  }
  if (gameTime > BOSS_SPAWN_TIME && !bossActive) {
    bossActive = true;
    bossWarningTimer = 180;
    const bMulti = 1 + (currentStage - 1) * 0.5;
    boss = {
      x: canvasWidth - ENEMY_CASTLE_X - 60, y: LANE_Y,
      hp: 4000 * bMulti, maxHp: 4000 * bMulti, atk: 60 * bMulti, speed: 0.45, range: 65, size: 60, color: '#8e44ad',
      lastAttack: 0, attackTimer: 0
    };
  }
}

function updateCannonBalls(dt) {
  castleCannonTimer += dt;
  if (castleCannonTimer > 2000) {
    let closest = null;
    const inRange = e => e.hp > 0 && e.x > PLAYER_CASTLE_X && e.x < PLAYER_CASTLE_X + 400;
    enemies.forEach(e => { if (inRange(e) && (!closest || e.x < closest.x)) closest = e; });
    if (bossActive && boss && inRange(boss) && (!closest || boss.x < closest.x)) closest = boss;
    if (closest) {
      castleCannonTimer = 0;
      cannonBalls.push({ x: PLAYER_CASTLE_X, y: LANE_Y - 40, target: closest, speed: 15, atk: 50, color: '#f1c40f' });
    }
  }
  const speedMultiplier = dt / 16.67;
  for (let i = cannonBalls.length - 1; i >= 0; i--) {
    const cannon = cannonBalls[i];
    if (!cannon.target || cannon.target.hp <= 0) { cannonBalls.splice(i, 1); continue; }
    if (cannon.x < cannon.target.x) {
      cannon.x += cannon.speed * speedMultiplier;
    } else {
      cannon.target.hp -= cannon.atk;
      effects.push({ x: cannon.target.x, y: cannon.target.y, timer: 150, type: 'cannon' });
      cannonBalls.splice(i, 1);
    }
  }
}

function updateUnits(dt) {
  const speedMultiplier = dt / 16.67;
  const allyStopLine = canvasWidth - ENEMY_CASTLE_X - 60;
  const enemyStopLine = PLAYER_CASTLE_X + 60;

  allies.forEach(ally => {
    let frontEnemy = null;
    enemies.forEach(enemy => { if (enemy.hp > 0 && enemy.x > ally.x && (!frontEnemy || enemy.x < frontEnemy.x)) frontEnemy = enemy; });
    if (bossActive && boss && boss.hp > 0 && boss.x > ally.x) { if (!frontEnemy || boss.x < frontEnemy.x) frontEnemy = boss; }
    if (ally.attackTimer > 0) ally.attackTimer -= dt;

    if (frontEnemy) {
      if (frontEnemy.x - ally.x <= ally.range) {
        if (gameTime - ally.lastAttack > 800) {
          ally.lastAttack = gameTime; ally.attackTimer = 300;
          if (ally.type === 'ranged') projectiles.push({ x: ally.x + ally.size, y: ally.y - 10, target: frontEnemy, atk: ally.atk, speed: 13, color: ally.color, heroType: heroType });
          else if (frontEnemy.hp > 0) { frontEnemy.hp -= ally.atk; effects.push({ x: frontEnemy.x, y: frontEnemy.y - 15, timer: 100, type: 'hit' }); }
        }
      } else if (ally.x < allyStopLine) ally.x += ally.speed * speedMultiplier;
    } else if (ally.x < allyStopLine) {
      ally.x += ally.speed * speedMultiplier;
    } else {
      if (gameTime - ally.lastAttack > 1000) {
        ally.lastAttack = gameTime; ally.attackTimer = 300;
        enemyCastleHp = Math.max(0, enemyCastleHp - ally.atk);
        effects.push({ x: canvasWidth - ENEMY_CASTLE_X, y: LANE_Y + (Math.random() * 40 - 20), timer: 100, type: 'hit' });
        updateUI();
      }
    }
  });

  enemies.forEach(enemy => {
    let frontAlly = null;
    allies.forEach(ally => { if (ally.hp > 0 && ally.x < enemy.x && (!frontAlly || ally.x > frontAlly.x)) frontAlly = ally; });
    if (enemy.attackTimer > 0) enemy.attackTimer -= dt;

    if (frontAlly) {
      if (enemy.x - frontAlly.x <= enemy.range) {
        if (gameTime - enemy.lastAttack > 1000) {
          enemy.lastAttack = gameTime; enemy.attackTimer = 300;
          if (frontAlly.hp > 0) frontAlly.hp -= enemy.atk;
          effects.push({ x: frontAlly.x, y: frontAlly.y - 15, timer: 100, type: 'hit' });
        }
      } else if (enemy.x > enemyStopLine) {
        enemy.x -= enemy.speed * speedMultiplier;
      }
    } else if (enemy.x > enemyStopLine) {
      enemy.x -= enemy.speed * speedMultiplier;
    } else {
      enemy.x = enemyStopLine;
      if (gameTime - enemy.lastAttack > 1000) {
        enemy.lastAttack = gameTime; enemy.attackTimer = 300;
        playerCastleHp = Math.max(0, playerCastleHp - enemy.atk);
        effects.push({ x: PLAYER_CASTLE_X, y: LANE_Y, timer: 100, type: 'hit' });
        updateUI();
      }
    }
  });

  if (bossActive && boss && boss.hp > 0) {
    let frontAlly = null;
    allies.forEach(ally => { if (ally.hp > 0 && ally.x < boss.x && (!frontAlly || ally.x > frontAlly.x)) frontAlly = ally; });
    if (boss.attackTimer > 0) boss.attackTimer -= dt;

    if (frontAlly) {
      if (boss.x - frontAlly.x <= boss.range) {
        if (gameTime - boss.lastAttack > 1200) {
          boss.lastAttack = gameTime; boss.attackTimer = 400;
          if (frontAlly.hp > 0) frontAlly.hp -= boss.atk;
          effects.push({ x: frontAlly.x, y: frontAlly.y - 25, timer: 100, type: 'hit' });
        }
      } else if (boss.x > enemyStopLine) {
        boss.x -= boss.speed * speedMultiplier;
      }
    } else if (boss.x > enemyStopLine) {
      boss.x -= boss.speed * speedMultiplier;
    } else {
      boss.x = enemyStopLine;
      if (gameTime - boss.lastAttack > 1500) {
        boss.lastAttack = gameTime; boss.attackTimer = 400;
        playerCastleHp = Math.max(0, playerCastleHp - boss.atk * 2);
        effects.push({ x: PLAYER_CASTLE_X, y: LANE_Y, timer: 100, type: 'hit' });
        updateUI();
      }
    }
  }

  allies = allies.filter(ally => ally.hp > 0);
  enemies = enemies.filter(enemy => enemy.hp > 0);
}
// 👇 여기서 2부로 이어집니다.
function updateProjectiles(dt) {
  const speedMultiplier = dt / 16.67;
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const projectile = projectiles[i];
    if (!projectile.target || projectile.target.hp <= 0) { projectiles.splice(i, 1); continue; }
    if (projectile.x < projectile.target.x) {
      projectile.x += projectile.speed * speedMultiplier;
    } else {
      projectile.target.hp -= projectile.atk;
      effects.push({ x: projectile.target.x, y: projectile.target.y - 15, timer: 100, type: 'hit' });
      projectiles.splice(i, 1);
    }
  }
}

function checkGameState() {
  if (gameState !== 'PLAYING') return;

  if (playerCastleHp <= 0) {
    playerCastleHp = 0;
    gameState = 'DEFEAT';
    endMessage = '내 성이 파괴되었습니다.';
    updateUI();
    showEndScreen();
    return;
  }

  if (enemyCastleHp <= 0) {
    enemyCastleHp = 0;

    if (currentStage < MAX_STAGE) {
      gameState = 'STAGE_CLEAR';
      stageClearTimer = STAGE_CLEAR_DELAY;
      endMessage = `스테이지 ${currentStage} 클리어!`;
      updateUI();
    } else {
      gameState = 'VICTORY';
      endMessage = '모든 스테이지를 클리어했습니다!';
      updateUI();
      showEndScreen();
    }
  }
}

function advanceStage() {
  currentStage++;
  currentLevel++;
  playerCastleHp = MAX_CASTLE_HP;
  enemyCastleHp = MAX_CASTLE_HP;
  gameTime = 0;
  bossActive = false;
  boss = null;
  bossWarningTimer = 0;
  allies = []; enemies = []; projectiles = []; cannonBalls = []; effects = [];
  spawnTimer = 0; castleCannonTimer = 0;
  stageClearTimer = 0;
  endMessage = '';
  gameState = 'PLAYING';

  updateStageUI();
  updateUI();
}

function showEndScreen() {
  gameActive = false;
  document.getElementById('restart-btn').style.display = 'block';
  document.querySelectorAll('.summon-btn').forEach(btn => btn.disabled = true);
}

function drawResultOverlay() {
  const isWin = gameState === 'VICTORY' || gameState === 'STAGE_CLEAR';
  const overlayAlpha = gameState === 'STAGE_CLEAR' ? 0.6 : 0.82;
  const title = isWin ? 'VICTORY' : 'LOSE';
  const titleColor = isWin ? '#f1c40f' : '#ff4757';
  const titleSize = Math.max(48, Math.min(170, canvasWidth / 7));

  ctx.fillStyle = `rgba(0, 0, 0, ${overlayAlpha})`;
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.shadowColor = titleColor;
  ctx.shadowBlur = 35;
  ctx.fillStyle = titleColor;
  ctx.font = `bold ${titleSize}px 'Arial Black', Malgun Gothic, sans-serif`;
  ctx.fillText(title, canvasWidth / 2, canvasHeight / 2 - titleSize * 0.1);
  ctx.shadowBlur = 0;

  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${Math.max(16, Math.min(28, canvasWidth / 40))}px Malgun Gothic`;
  ctx.fillText(endMessage, canvasWidth / 2, canvasHeight / 2 + titleSize * 0.6);

  if (gameState === 'STAGE_CLEAR') {
    const sec = Math.max(0, stageClearTimer / 1000);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.font = '16px Malgun Gothic';
    ctx.fillText(`다음 스테이지까지 ${sec.toFixed(1)}초`, canvasWidth / 2, canvasHeight / 2 + titleSize * 0.6 + 40);
  } else if (gameState === 'VICTORY' || gameState === 'DEFEAT') {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.font = '16px Malgun Gothic';
    ctx.fillText('아래 "다시 시작" 버튼을 눌러 다시 도전하세요.', canvasWidth / 2, canvasHeight / 2 + titleSize * 0.6 + 40);
  }

  ctx.textBaseline = 'alphabetic';
}

function render() {
  if (backgroundImg.complete && backgroundImg.naturalWidth !== 0) {
    ctx.drawImage(backgroundImg, 0, 0, canvasWidth, canvasHeight);
  } else {
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    ctx.fillStyle = 'rgba(44, 62, 80, 0.8)';
    ctx.fillRect(0, LANE_Y - 40, canvasWidth, 120);
  }

  drawCastles();

  allies.forEach(ally => {
    let renderX = ally.x;
    if (ally.attackTimer > 0) renderX += 10;
    let currentImg = (heroType === 'pantheon') ? soldierImg : (heroType === 'mage') ? mageImg : archerImg;

    if (currentImg && currentImg.complete && currentImg.naturalWidth !== 0) {
      const imgH = ally.size * 2.6;
      const imgW = imgH * (currentImg.naturalWidth / currentImg.naturalHeight);
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.beginPath();
      ctx.ellipse(renderX, ally.y + 4, imgW * 0.35, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.drawImage(currentImg, renderX - imgW / 2, ally.y - imgH + 12, imgW, imgH);
      drawHpBar({ x: renderX, y: ally.y - imgH + 14, size: ally.size, hp: ally.hp, maxHp: ally.maxHp, isEnemy: false });
    } else {
      ctx.fillStyle = ally.color;
      ctx.beginPath();
      ctx.arc(renderX, ally.y - ally.size / 2, ally.size, 0, Math.PI * 2);
      ctx.fill();
      drawHpBar({ x: renderX, y: ally.y - ally.size - 5, size: ally.size, hp: ally.hp, maxHp: ally.maxHp, isEnemy: false });
    }
  });

  enemies.forEach(enemy => {
    let renderX = enemy.x;
    if (enemy.attackTimer > 0) renderX -= 10;
    if (zombieImg.complete && zombieImg.naturalWidth !== 0) {
      const imgH = enemy.size * 2.7;
      const imgW = imgH * (zombieImg.naturalWidth / zombieImg.naturalHeight);
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.beginPath();
      ctx.ellipse(renderX, enemy.y + 4, imgW * 0.35, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.drawImage(zombieImg, renderX - imgW / 2, enemy.y - imgH + 12, imgW, imgH);
      drawHpBar({ x: renderX, y: enemy.y - imgH + 14, size: enemy.size, hp: enemy.hp, maxHp: enemy.maxHp, isEnemy: true });
    } else {
      ctx.fillStyle = enemy.color;
      ctx.beginPath();
      ctx.arc(renderX, enemy.y - enemy.size / 2, enemy.size, 0, Math.PI * 2);
      ctx.fill();
      drawHpBar({ x: renderX, y: enemy.y - enemy.size - 5, size: enemy.size, hp: enemy.hp, maxHp: enemy.maxHp, isEnemy: true });
    }
  });

  if (bossActive && boss && boss.hp > 0) {
    let renderX = boss.x;
    if (boss.attackTimer > 0) renderX -= 18;
    const imgH = boss.size * 2.8;
    if (bossImg.complete && bossImg.naturalWidth !== 0) {
      const imgW = imgH * (bossImg.naturalWidth / bossImg.naturalHeight);
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.beginPath();
      ctx.ellipse(renderX, boss.y + 8, imgW * 0.45, 13, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowColor = 'rgba(231, 76, 60, 0.8)';
      ctx.shadowBlur = 24;
      ctx.drawImage(bossImg, renderX - imgW / 2, boss.y - imgH + 20, imgW, imgH);
      ctx.shadowColor = 'transparent';
      const headTop = boss.y - imgH + 18;
      drawHpBar({ x: renderX, y: headTop, size: boss.size * 1.3, hp: boss.hp, maxHp: boss.maxHp, isEnemy: true });
      ctx.fillStyle = '#ff4757';
      ctx.font = 'bold 22px Malgun Gothic';
      ctx.textAlign = 'center';
      ctx.shadowColor = '#000';
      ctx.shadowBlur = 8;
      ctx.fillText('👑 바이킹 보스', renderX, headTop - 20);
      ctx.shadowColor = 'transparent';
    } else {
      ctx.fillStyle = boss.color;
      ctx.beginPath();
      ctx.arc(renderX, boss.y - boss.size / 2, boss.size, 0, Math.PI * 2);
      ctx.fill();
      drawHpBar({ x: renderX, y: boss.y - boss.size - 10, size: boss.size, hp: boss.hp, maxHp: boss.maxHp, isEnemy: true });
    }
  }

  if (bossWarningTimer > 0) {
    bossWarningTimer--;
    const alpha = Math.min(1, bossWarningTimer / 30);
    ctx.fillStyle = `rgba(0, 0, 0, ${0.65 * alpha})`;
    ctx.fillRect(0, canvasHeight * 0.28, canvasWidth, 70);
    ctx.strokeStyle = `rgba(231, 76, 60, ${alpha})`;
    ctx.lineWidth = 3;
    ctx.strokeRect(0, canvasHeight * 0.28, canvasWidth, 70);
    ctx.font = 'bold 28px Malgun Gothic';
    ctx.textAlign = 'center';
    ctx.fillStyle = `rgba(255, 71, 87, ${alpha})`;
    ctx.fillText('⚠️ WARNING: 거대 바이킹 보스 출현! ⚠️', canvasWidth / 2, canvasHeight * 0.28 + 45);
  }

  cannonBalls.forEach(cannon => {
    ctx.fillStyle = cannon.color;
    ctx.beginPath();
    ctx.arc(cannon.x, cannon.y, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#d35400';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cannon.x - 20, cannon.y);
    ctx.lineTo(cannon.x, cannon.y);
    ctx.stroke();
  });

  projectiles.forEach(projectile => {
    if (projectile.heroType === 'mage') {
      ctx.fillStyle = '#54a0ff';
      ctx.beginPath();
      ctx.arc(projectile.x, projectile.y, 8, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.strokeStyle = '#ecf0f1';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(projectile.x - 18, projectile.y);
      ctx.lineTo(projectile.x, projectile.y);
      ctx.stroke();
    }
  });

  for (let i = effects.length - 1; i >= 0; i--) {
    const effect = effects[i];
    if (isReduceMotion) { effects.splice(i, 1); continue; }
    let radius = 0;
    if (effect.type === 'hit') {
      radius = 25 - effect.timer / 5;
      ctx.fillStyle = `rgba(255, 255, 0, ${effect.timer / 100})`;
    } else if (effect.type === 'cannon') {
      radius = 40 - effect.timer / 3;
      ctx.fillStyle = `rgba(241, 196, 15, ${effect.timer / 150})`;
    } else if (effect.type === 'summon') {
      ctx.strokeStyle = `rgba(52, 152, 219, ${effect.timer / 120})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(effect.x, effect.y + 4, Math.max(0, 30 - effect.timer / 6), 8, 0, 0, Math.PI * 2);
      ctx.stroke();
      effect.timer -= 4;
      if (effect.timer <= 0) effects.splice(i, 1);
      continue;
    }
    if (radius > 0) {
      ctx.beginPath();
      ctx.arc(effect.x, effect.y, radius, 0, Math.PI * 2);
      ctx.fill();
      effect.timer -= 4;
    } else {
      effects.splice(i, 1);
      continue;
    }
    if (effect.timer <= 0) effects.splice(i, 1);
  }

  if (gameState === 'STAGE_CLEAR' || gameState === 'DEFEAT' || gameState === 'VICTORY') {
    drawResultOverlay();
  }
}

function drawCastles() {
  const castleH = Math.min(270, Math.max(190, canvasHeight * 0.38));
  const castleBaseY = LANE_Y + 18;
  const castleY = castleBaseY - castleH;

  if (castle1Img.complete && castle1Img.naturalWidth !== 0) {
    const sw = 305, sh = 325, sx = 30, sy = 25;
    const c1W = castleH * (sw / sh);
    const c1X = 0;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.beginPath();
    ctx.ellipse(c1X + c1W * 0.48, castleBaseY - 2, c1W * 0.44, 16, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.drawImage(castle1Img, sx, sy, sw, sh, c1X, castleY, c1W, castleH);
  } else {
    drawFallbackCastle(PLAYER_CASTLE_X, LANE_Y, '#3498db');
  }

  if (castle2Img.complete && castle2Img.naturalWidth !== 0) {
    const sw = 295, sh = 310, sx = 360, sy = 35;
    const c2W = castleH * (sw / sh);
    const c2X = canvasWidth - c2W;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.beginPath();
    ctx.ellipse(c2X + c2W * 0.52, castleBaseY - 2, c2W * 0.44, 16, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.drawImage(castle2Img, sx, sy, sw, sh, c2X, castleY, c2W, castleH);
  } else {
    drawFallbackCastle(canvasWidth - ENEMY_CASTLE_X, LANE_Y, '#e74c3c');
  }
}

function drawFallbackCastle(x, y, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x - 40, y - 60, 80, 120);
  ctx.fillRect(x - 50, y - 90, 20, 50);
  ctx.fillRect(x + 30, y - 90, 20, 50);
  ctx.fillStyle = '#111';
  ctx.beginPath();
  ctx.arc(x, y + 40, 20, Math.PI, 0);
  ctx.fill();
  ctx.fillRect(x - 20, y + 40, 40, 20);
}

function drawHpBar(entity) {
  const barWidth = entity.size * 2;
  const x = entity.x - barWidth / 2;
  const y = entity.y - 12;
  ctx.fillStyle = 'rgba(0,0,0,0.9)';
  ctx.fillRect(x - 3, y - 3, barWidth + 6, 12);
  ctx.fillStyle = '#333';
  ctx.fillRect(x, y, barWidth, 6);
  ctx.fillStyle = entity.isEnemy ? '#e74c3c' : '#3498db';
  const hpPercent = Math.max(0, entity.hp / entity.maxHp);
  ctx.fillRect(x, y, barWidth * hpPercent, 6);
}
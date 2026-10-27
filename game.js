// 캔버스 및 설정
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

// 🖼️ 이미지 로드 (판테온과 보스만 이미지 사용)
const pantheonImg = new Image(); pantheonImg.src = 'pantheon.png'; 
const bossImg = new Image(); bossImg.src = 'boss.png';
// 좀비는 이미지 대신 코드로 그립니다.

// 게임 데이터
let heroType = '';
const heroData = { pantheon: '판테온', mage: '마법사', archer: '궁수' };

const minionStats = {
  pantheon: [
    { hp: 150, atk: 15, speed: 1.2, range: 40, cost: 30, color: '#e74c3c', size: 20, type: 'melee' },
    { hp: 300, atk: 30, speed: 1.0, range: 40, cost: 50, color: '#c0392b', size: 30, type: 'melee' },
    { hp: 600, atk: 60, speed: 0.8, range: 40, cost: 70, color: '#8e44ad', size: 40, type: 'melee' }
  ],
  mage: [
    { hp: 80, atk: 20, speed: 1.0, range: 250, cost: 30, color: '#9b59b6', size: 20, type: 'ranged' },
    { hp: 120, atk: 40, speed: 0.9, range: 280, cost: 50, color: '#8e44ad', size: 25, type: 'ranged' },
    { hp: 200, atk: 80, speed: 0.7, range: 300, cost: 70, color: '#d35400', size: 35, type: 'ranged' }
  ],
  archer: [
    { hp: 100, atk: 25, speed: 1.5, range: 180, cost: 30, color: '#2ecc71', size: 20, type: 'ranged' },
    { hp: 150, atk: 50, speed: 1.3, range: 200, cost: 50, color: '#27ae60', size: 25, type: 'ranged' },
    { hp: 250, atk: 100, speed: 1.0, range: 250, cost: 70, color: '#1abc9c', size: 35, type: 'ranged' }
  ]
};

// 게임 상태 변수
let gameActive = false;
let animationId, lastTime = 0;
let mana = 0; const MAX_MANA = 100;

let playerCastleHp = 2000, enemyCastleHp = 2000;
const MAX_CASTLE_HP = 2000;

let gameState = 'PLAYING'; 
let gameTime = 0; 
const BOSS_SPAWN_TIME = 30000;

let allies = [];
let enemies = [];
let projectiles = []; 
let cannonBalls = []; 
let effects = []; 

let spawnTimer = 0;
let castleCannonTimer = 0; 
let bossActive = false; 
let boss = null;

// 화면 전환
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

function startGame() {
  document.getElementById('select-screen').style.display = 'none';
  document.getElementById('game-screen').style.display = 'block';
  document.getElementById('hero-name').textContent = `소환사: ${heroData[heroType]}`;
  
  gameActive = true; gameState = 'PLAYING';
  mana = 0; playerCastleHp = MAX_CASTLE_HP; enemyCastleHp = MAX_CASTLE_HP;
  allies = []; enemies = []; projectiles = []; cannonBalls = []; effects = [];
  spawnTimer = 0; castleCannonTimer = 0; bossActive = false; boss = null; gameTime = 0;
  
  document.getElementById('restart-btn').style.display = 'none';
  updateUI();
  
  const buttons = document.querySelectorAll('.summon-btn');
  const stats = minionStats[heroType];
  buttons.forEach((btn, index) => {
    btn.innerHTML = `<span class="cost">${stats[index].cost}</span> 유닛 ${index + 1}`;
    btn.disabled = false;
  });

  lastTime = performance.now();
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

document.querySelectorAll('.summon-btn').forEach((btn, index) => {
  btn.addEventListener('click', () => {
    if (!gameActive || gameState !== 'PLAYING') return;
    const cost = minionStats[heroType][index].cost;
    if (mana >= cost) {
      mana -= cost;
      updateUI();
      const stat = minionStats[heroType][index];
      
      allies.push({
        x: 120, y: LANE_Y,
        hp: stat.hp, maxHp: stat.hp, atk: stat.atk, speed: stat.speed,
        range: stat.range, color: stat.color, size: stat.size, type: stat.type,
        lastAttack: 0, isEnemy: false, attackTimer: 0
      });
    }
  });
});

function gameLoop(timestamp) {
  if (!gameActive) return;
  const dt = timestamp - lastTime;
  lastTime = timestamp;

  if (gameState === 'PLAYING') {
    gameTime += dt;
    if (mana < MAX_MANA) { mana += 15 * (dt / 1000); updateUI(); }
    
    spawnSystem(dt);
    updateUnits(dt);
    updateProjectiles(dt);
    updateCannonBalls(dt); 
    checkGameState();
  }
  
  render();
  animationId = requestAnimationFrame(gameLoop);
}

function spawnSystem(dt) {
  spawnTimer += dt;
  
  if (spawnTimer > 2500) {
    spawnTimer = 0;
    const enemyHp = 100 + (gameTime / 1000) * 5;
    enemies.push({
      x: canvasWidth - 120, y: LANE_Y,
      hp: enemyHp, maxHp: enemyHp, atk: 15, speed: 0.8,
      range: 40, color: '#2ecc71', size: 22, type: 'melee', // 좀비 색상 초록
      lastAttack: 0, isEnemy: true, attackTimer: 0
    });
  }

  if (gameTime > BOSS_SPAWN_TIME && !bossActive) {
    bossActive = true;
    boss = {
      x: canvasWidth - 150, y: LANE_Y,
      hp: 4000, maxHp: 4000, atk: 60, speed: 0.4, range: 60, size: 60, color: '#8e44ad',
      lastAttack: 0, attackTimer: 0
    };
  }
}

function updateCannonBalls(dt) {
  castleCannonTimer += dt;
  if (castleCannonTimer > 2000) {
    let closestEnemy = enemies.find(e => e.x > 120 && e.x < 500);
    if (!closestEnemy && bossActive && boss && boss.x > 120 && boss.x < 500) closestEnemy = boss;
    
    if (closestEnemy) {
      castleCannonTimer = 0;
      cannonBalls.push({ x: 120, y: LANE_Y - 30, target: closestEnemy, speed: 15, atk: 50, color: '#f1c40f' });
    }
  }

  const speedMultiplier = dt / 16.67;
  cannonBalls.forEach((cannon, index) => {
    if (cannon.target.hp <= 0) { cannonBalls.splice(index, 1); return; }
    if (cannon.x < cannon.target.x) {
      cannon.x += cannon.speed * speedMultiplier;
    } else {
      cannon.target.hp -= cannon.atk;
      effects.push({ x: cannon.target.x, y: cannon.target.y, timer: 150, type: 'cannon' });
      cannonBalls.splice(index, 1);
    }
  });
}

function updateUnits(dt) {
  const speedMultiplier = dt / 16.67;

  // 아군 유닛
  allies.forEach(ally => {
    let frontEnemy = null;
    enemies.forEach(e => { if (e.x > ally.x && (!frontEnemy || e.x < frontEnemy.x)) frontEnemy = e; });
    if (bossActive && boss && boss.hp > 0 && boss.x > ally.x) {
      if (!frontEnemy || boss.x < frontEnemy.x) frontEnemy = boss;
    }

    if (ally.attackTimer > 0) ally.attackTimer -= dt;

    if (frontEnemy) {
      const dist = frontEnemy.x - ally.x;
      if (dist <= ally.range) {
        if (performance.now() - ally.lastAttack > 800) {
          ally.lastAttack = performance.now();
          ally.attackTimer = 300;
          if (ally.type === 'ranged') {
            projectiles.push({ x: ally.x + ally.size, y: ally.y, target: frontEnemy, atk: ally.atk, speed: 12, color: ally.color });
          } else {
            frontEnemy.hp -= ally.atk;
            effects.push({ x: frontEnemy.x, y: frontEnemy.y, timer: 100, type: 'hit' });
          }
        }
      } else { ally.x += ally.speed * speedMultiplier; }
    } else {
      ally.x += ally.speed * speedMultiplier;
      if (ally.x >= canvasWidth - 80) {
        if (performance.now() - ally.lastAttack > 1000) {
          ally.lastAttack = performance.now();
          ally.attackTimer = 300;
          enemyCastleHp -= ally.atk;
          effects.push({ x: canvasWidth - 60, y: LANE_Y + (Math.random()*40-20), timer: 100, type: 'hit' });
          updateUI();
        }
      }
    }
  });

  // 적군 일반 몹 (좀비)
  enemies.forEach(enemy => {
    let frontAlly = null;
    allies.forEach(a => { if (a.x < enemy.x && (!frontAlly || a.x > frontAlly.x)) frontAlly = a; });
    if (enemy.attackTimer > 0) enemy.attackTimer -= dt;

    if (frontAlly) {
      const dist = enemy.x - frontAlly.x;
      if (dist <= enemy.range) {
        if (performance.now() - enemy.lastAttack > 1000) {
          enemy.lastAttack = performance.now();
          enemy.attackTimer = 300;
          frontAlly.hp -= enemy.atk;
          effects.push({ x: frontAlly.x, y: frontAlly.y, timer: 100, type: 'hit' });
        }
      } else { enemy.x -= enemy.speed * speedMultiplier; }
    } else {
      enemy.x -= enemy.speed * speedMultiplier;
      if (enemy.x <= 80) {
        if (performance.now() - enemy.lastAttack > 1000) {
          enemy.lastAttack = performance.now();
          enemy.attackTimer = 300;
          playerCastleHp -= enemy.atk;
          effects.push({ x: 60, y: LANE_Y, timer: 100, type: 'hit' });
          updateUI();
        }
      }
    }
  });

  // 보스
  if (bossActive && boss && boss.hp > 0) {
    let frontAlly = null;
    allies.forEach(a => { if (a.x < boss.x && (!frontAlly || a.x > frontAlly.x)) frontAlly = a; });
    if (boss.attackTimer > 0) boss.attackTimer -= dt;

    if (frontAlly) {
      const dist = boss.x - frontAlly.x;
      if (dist <= boss.range) {
        if (performance.now() - boss.lastAttack > 1200) {
          boss.lastAttack = performance.now();
          boss.attackTimer = 400;
          frontAlly.hp -= boss.atk;
          effects.push({ x: frontAlly.x, y: frontAlly.y, timer: 100, type: 'hit' });
        }
      } else { boss.x -= boss.speed * speedMultiplier; }
    } else {
      boss.x -= boss.speed * speedMultiplier;
      if (boss.x <= 80) {
        if (performance.now() - boss.lastAttack > 1500) {
          boss.lastAttack = performance.now();
          boss.attackTimer = 400;
          playerCastleHp -= boss.atk * 2;
          effects.push({ x: 60, y: LANE_Y, timer: 100, type: 'hit' });
          updateUI();
        }
      }
    }
  }

  allies = allies.filter(a => a.hp > 0);
  enemies = enemies.filter(e => e.hp > 0);
}

function updateProjectiles(dt) {
  const speedMultiplier = dt / 16.67;
  projectiles.forEach((proj, index) => {
    if (proj.target.hp <= 0) { projectiles.splice(index, 1); return; }
    if (proj.x < proj.target.x) {
      proj.x += proj.speed * speedMultiplier;
    } else {
      proj.target.hp -= proj.atk;
      effects.push({ x: proj.target.x, y: proj.target.y, timer: 100, type: 'hit' });
      projectiles.splice(index, 1);
    }
  });
}

function checkGameState() {
  if (playerCastleHp <= 0) {
    gameState = 'DEFEAT';
    showEndScreen('패배... 내 성이 파괴되었습니다.');
  } else if (enemyCastleHp <= 0) {
    gameState = 'VICTORY';
    showEndScreen('승리! 적의 성을 파괴했습니다!');
  }
}

function showEndScreen(msg) {
  gameActive = false; 
  document.getElementById('restart-btn').style.display = 'block';
  document.querySelectorAll('.summon-btn').forEach(btn => btn.disabled = true);
  
  ctx.fillStyle = 'rgba(0,0,0,0.8)';
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  ctx.fillStyle = gameState === 'VICTORY' ? 'gold' : 'red';
  ctx.font = 'bold 60px Malgun Gothic';
  ctx.textAlign = 'center';
  ctx.fillText(msg, canvasWidth / 2, canvasHeight / 2);
}

document.getElementById('restart-btn').addEventListener('click', () => {
  document.getElementById('game-screen').style.display = 'none';
  document.getElementById('select-screen').style.display = 'flex';
  gameActive = false;
});

function render() {
  const skyGrad = ctx.createLinearGradient(0, 0, 0, canvasHeight);
  skyGrad.addColorStop(0, '#1a1a2e'); skyGrad.addColorStop(1, '#16213e');
  ctx.fillStyle = skyGrad; ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  ctx.fillStyle = '#2c3e50';
  ctx.fillRect(0, LANE_Y - 40, canvasWidth, 120);
  ctx.strokeStyle = '#1a252f'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(0, LANE_Y - 40); ctx.lineTo(canvasWidth, LANE_Y - 40); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, LANE_Y + 80); ctx.lineTo(canvasWidth, LANE_Y + 80); ctx.stroke();

  drawCastle(80, LANE_Y, '#3498db');
  drawCastle(canvasWidth - 80, LANE_Y, '#e74c3c');

  allies.forEach(ally => {
    ctx.shadowColor = 'rgba(0,0,0,0.8)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 8;
    ctx.fillStyle = ally.color;
    let renderX = ally.x;
    if (ally.attackTimer > 0) renderX += 10;
    ctx.beginPath(); ctx.arc(renderX, ally.y, ally.size, 0, Math.PI * 2); ctx.fill();
    drawHpBar({x: renderX, y: ally.y, size: ally.size, hp: ally.hp, maxHp: ally.maxHp, isEnemy: false}); 
    ctx.shadowColor = 'transparent';
  });

  // ⭐️ 적군 (코드로 그린 좀비)
  enemies.forEach(enemy => {
    let renderX = enemy.x;
    if (enemy.attackTimer > 0) renderX -= 10;
    
    drawZombie(renderX, enemy.y, enemy.size);
    
    ctx.strokeStyle = '#ff0000'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(renderX, enemy.y, enemy.size, 0, Math.PI*2); ctx.stroke();
    drawHpBar({x: renderX, y: enemy.y, size: enemy.size, hp: enemy.hp, maxHp: enemy.maxHp, isEnemy: true}); 
    ctx.shadowColor = 'transparent';
  });

  if (bossActive && boss && boss.hp > 0) {
    let renderX = boss.x;
    if (boss.attackTimer > 0) renderX -= 15;

    if (bossImg.complete && bossImg.naturalWidth !== 0) {
      ctx.save();
      const imgSize = boss.size * 2.5;
      ctx.shadowColor = 'rgba(255,0,0,0.8)'; ctx.shadowBlur = 20; ctx.shadowOffsetY = 10;
      ctx.drawImage(bossImg, renderX - imgSize/2, boss.y - imgSize/2, imgSize, imgSize);
      ctx.restore();
    } else {
      ctx.fillStyle = boss.color; ctx.beginPath(); ctx.arc(renderX, boss.y, boss.size, 0, Math.PI*2); ctx.fill();
    }
    drawHpBar({x: renderX, y: boss.y, size: boss.size, hp: boss.hp, maxHp: boss.maxHp, isEnemy: true}); 
    ctx.fillStyle = '#fff'; ctx.font = 'bold 20px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('👑 보스', renderX, boss.y - boss.size - 15);
  }

  cannonBalls.forEach(cannon => {
    ctx.fillStyle = cannon.color;
    ctx.beginPath(); ctx.arc(cannon.x, cannon.y, 10, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#d35400'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(cannon.x - 20, cannon.y); ctx.lineTo(cannon.x, cannon.y); ctx.stroke();
  });

  projectiles.forEach(proj => {
    ctx.fillStyle = proj.color;
    ctx.beginPath(); ctx.arc(proj.x, proj.y, 6, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = proj.color; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(proj.x - 15, proj.y); ctx.lineTo(proj.x, proj.y); ctx.stroke();
  });

  effects.forEach((effect, index) => {
    if (effect.type === 'hit') {
      ctx.fillStyle = `rgba(255, 255, 0, ${effect.timer / 100})`;
      ctx.beginPath(); ctx.arc(effect.x, effect.y, 25 - effect.timer/5, 0, Math.PI * 2); ctx.fill();
      effect.timer -= 3;
      if (effect.timer <= 0) effects.splice(index, 1);
    } else if (effect.type === 'cannon') {
      ctx.fillStyle = `rgba(241, 196, 15, ${effect.timer / 150})`;
      ctx.beginPath(); ctx.arc(effect.x, effect.y, 40 - effect.timer/3, 0, Math.PI * 2); ctx.fill();
      effect.timer -= 4;
      if (effect.timer <= 0) effects.splice(index, 1);
    }
  });
}

// ⭐️ 코드로 그리는 좀비 함수
function drawZombie(x, y, size) {
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 5;

  // 몸통 (낡은 옷)
  ctx.fillStyle = '#4a5d23'; // 어두운 녹색
  ctx.fillRect(x - size * 0.6, y - size * 0.2, size * 1.2, size * 1.0);

  // 얼굴 (창백한 초록)
  ctx.fillStyle = '#8fbc8f'; 
  ctx.beginPath();
  ctx.arc(x, y - size * 0.5, size * 0.6, 0, Math.PI * 2);
  ctx.fill();

  // 눈 (빨간 점)
  ctx.fillStyle = '#ff0000';
  ctx.beginPath(); ctx.arc(x - size * 0.2, y - size * 0.6, size * 0.15, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(x + size * 0.2, y - size * 0.6, size * 0.15, 0, Math.PI * 2); ctx.fill();

  // 입 (피 묻은 듯한 선)
  ctx.strokeStyle = '#8b0000'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(x - size * 0.3, y - size * 0.35); ctx.lineTo(x + size * 0.3, y - size * 0.35); ctx.stroke();

  // 팔 (앞으로 뻗은 모양)
  ctx.fillStyle = '#8fbc8f';
  ctx.fillRect(x - size * 0.9, y - size * 0.1, size * 0.4, size * 0.2); // 왼팔
  ctx.fillRect(x + size * 0.5, y - size * 0.1, size * 0.4, size * 0.2); // 오른팔

  ctx.restore();
}

function drawCastle(x, y, color) {
  ctx.fillStyle = color; ctx.shadowColor = 'black'; ctx.shadowBlur = 15;
  ctx.fillRect(x - 40, y - 60, 80, 120);
  ctx.fillRect(x - 50, y - 90, 20, 50);
  ctx.fillRect(x + 30, y - 90, 20, 50);
  ctx.fillRect(x - 10, y - 110, 20, 50);
  ctx.shadowColor = 'transparent';
  
  ctx.fillStyle = '#111';
  ctx.beginPath(); ctx.arc(x, y + 40, 20, Math.PI, 0); ctx.fill();
  ctx.fillRect(x - 20, y + 40, 40, 20);
}

function drawHpBar(entity) {
  const barWidth = entity.size * 2;
  const x = entity.x - barWidth / 2;
  const y = entity.y - entity.size - 15;
  
  ctx.fillStyle = 'rgba(0,0,0,0.8)'; ctx.fillRect(x - 2, y - 2, barWidth + 4, 10);
  ctx.fillStyle = 'red'; ctx.fillRect(x, y, barWidth, 6);
  ctx.fillStyle = entity.isEnemy ? '#e74c3c' : '#2ecc71'; 
  const hpPercent = Math.max(0, entity.hp / entity.maxHp);
  ctx.fillRect(x, y, barWidth * hpPercent, 6);
}
// 캔버스 및 설정
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
let canvasWidth, canvasHeight;
const LANE_Y = window.innerHeight * 0.65; // 가로 1자 라인

function resizeCanvas() {
  canvasWidth = window.innerWidth;
  canvasHeight = window.innerHeight;
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// 이미지 로드
const pantheonImg = new Image(); pantheonImg.src = 'pantheon.png'; 
const bossImg = new Image(); bossImg.src = 'boss.png';

// 게임 데이터 정의
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
let playerCastleHp = 1500, enemyCastleHp = 2000; // 성 체력
let gameState = 'PLAYING'; 

// ⭐️ 시간 기반 보스 등장
let gameTime = 0; 
const BOSS_SPAWN_TIME = 30000; // 30초 뒤 보스 등장

let allies = [];
let enemies = [];
let projectiles = [];
let effects = [];

let spawnTimer = 0;
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
  mana = 0; playerCastleHp = 1500; enemyCastleHp = 2000;
  allies = []; enemies = []; projectiles = []; effects = [];
  spawnTimer = 0; bossActive = false; boss = null; gameTime = 0;
  
  document.getElementById('restart-btn').style.display = 'none';
  updateManaUI();
  updateCastleUI();
  
  const buttons = document.querySelectorAll('.summon-btn');
  const stats = minionStats[heroType];
  buttons.forEach((btn, index) => {
    btn.innerHTML = `<span class="cost">${stats[index].cost}</span> 유닛 ${index + 1}`;
    btn.disabled = false;
  });

  lastTime = performance.now();
  animationId = requestAnimationFrame(gameLoop);
}

function updateManaUI() {
  document.getElementById('mana-bar').style.width = `${(mana / MAX_MANA) * 100}%`;
  document.getElementById('mana-text').textContent = `마나: ${Math.floor(mana)}/100`;
  
  const buttons = document.querySelectorAll('.summon-btn');
  const stats = minionStats[heroType];
  buttons.forEach((btn, index) => {
    btn.disabled = mana < stats[index].cost || gameState !== 'PLAYING';
  });
}

// 유닛 소환
document.querySelectorAll('.summon-btn').forEach((btn, index) => {
  btn.addEventListener('click', () => {
    if (!gameActive || gameState !== 'PLAYING') return;
    const cost = minionStats[heroType][index].cost;
    if (mana >= cost) {
      mana -= cost;
      updateManaUI();
      const stat = minionStats[heroType][index];
      
      allies.push({
        x: 120, y: LANE_Y,
        hp: stat.hp, maxHp: stat.hp, atk: stat.atk, speed: stat.speed,
        range: stat.range, color: stat.color, size: stat.size, type: stat.type,
        lastAttack: 0, isEnemy: false
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
    
    if (mana < MAX_MANA) { mana += 15 * (dt / 1000); updateManaUI(); }
    
    spawnSystem(dt);
    updateUnits(dt);
    updateProjectiles(dt);
    checkGameState();
  }
  
  render();
  animationId = requestAnimationFrame(gameLoop);
}

// ⭐️ 스폰 시스템 (일반 몹 + 30초 뒤 보스)
function spawnSystem(dt) {
  spawnTimer += dt;
  
  // 일반 몹 스폰 (2.5초마다)
  if (spawnTimer > 2500) {
    spawnTimer = 0;
    const enemyHp = 100 + (gameTime / 1000) * 5;
    enemies.push({
      x: canvasWidth - 120, y: LANE_Y,
      hp: enemyHp, maxHp: enemyHp, atk: 15, speed: 0.8,
      range: 40, color: '#555', size: 22, type: 'melee',
      lastAttack: 0, isEnemy: true
    });
  }

  // 30초 뒤 보스 등장
  if (gameTime > BOSS_SPAWN_TIME && !bossActive) {
    bossActive = true;
    boss = {
      x: canvasWidth - 150, y: LANE_Y,
      hp: 4000, maxHp: 4000, atk: 60, speed: 0.4, range: 60, size: 60, color: '#8e44ad',
      lastAttack: 0
    };
  }
}

function updateUnits(dt) {
  const speedMultiplier = dt / 16.67;

  // 1. 아군 유닛
  allies.forEach(ally => {
    let target = enemies.find(e => e.x > ally.x && e.hp > 0);
    if (bossActive && boss && boss.hp > 0 && boss.x > ally.x) {
      if (!target || boss.x < target.x) target = boss; 
    }

    if (target) {
      const dist = target.x - ally.x;
      if (dist <= ally.range) {
        if (performance.now() - ally.lastAttack > 800) {
          ally.lastAttack = performance.now();
          if (ally.type === 'ranged') {
            projectiles.push({ x: ally.x + ally.size, y: ally.y, target: target, atk: ally.atk, speed: 12, color: ally.color });
          } else {
            target.hp -= ally.atk;
            effects.push({ x: target.x, y: target.y, timer: 100, type: 'hit' });
          }
        }
      } else {
        ally.x += ally.speed * speedMultiplier;
      }
    } else {
      // 적이 없으면 성 공격
      ally.x += ally.speed * speedMultiplier;
      if (ally.x >= canvasWidth - 80) {
        if (performance.now() - ally.lastAttack > 1000) {
          ally.lastAttack = performance.now();
          enemyCastleHp -= ally.atk;
          effects.push({ x: canvasWidth - 60, y: LANE_Y + (Math.random()*40-20), timer: 100, type: 'hit' });
          updateCastleUI();
        }
      }
    }
  });

  // 2. 적군 일반 몹
  enemies.forEach(enemy => {
    let target = allies.find(a => a.x < enemy.x && a.hp > 0);

    if (target) {
      const dist = enemy.x - target.x;
      if (dist <= enemy.range) {
        if (performance.now() - enemy.lastAttack > 1000) {
          enemy.lastAttack = performance.now();
          target.hp -= enemy.atk;
          effects.push({ x: target.x, y: target.y, timer: 100, type: 'hit' });
        }
      } else {
        enemy.x -= enemy.speed * speedMultiplier;
      }
    } else {
      enemy.x -= enemy.speed * speedMultiplier;
      if (enemy.x <= 80) {
        if (performance.now() - enemy.lastAttack > 1000) {
          enemy.lastAttack = performance.now();
          playerCastleHp -= enemy.atk;
          effects.push({ x: 60, y: LANE_Y, timer: 100, type: 'hit' });
          updateCastleUI();
        }
      }
    }
  });

  // 3. 보스 로직 (공격 가능)
  if (bossActive && boss && boss.hp > 0) {
    let target = allies.find(a => a.x < boss.x && a.hp > 0);
    if (target) {
      const dist = boss.x - target.x;
      if (dist <= boss.range) {
        if (performance.now() - boss.lastAttack > 1200) {
          boss.lastAttack = performance.now();
          target.hp -= boss.atk;
          effects.push({ x: target.x, y: target.y, timer: 100, type: 'hit' });
        }
      } else {
        boss.x -= boss.speed * speedMultiplier;
      }
    } else {
      boss.x -= boss.speed * speedMultiplier;
      if (boss.x <= 80) {
        if (performance.now() - boss.lastAttack > 1500) {
          boss.lastAttack = performance.now();
          playerCastleHp -= boss.atk * 2;
          effects.push({ x: 60, y: LANE_Y, timer: 100, type: 'hit' });
          updateCastleUI();
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

function updateCastleUI() {
  const enemyHpPercent = Math.max(0, enemyCastleHp / 2000) * 100;
  document.getElementById('enemy-castle-hp').style.width = `${enemyHpPercent}%`;
}

document.getElementById('restart-btn').addEventListener('click', () => {
  document.getElementById('game-screen').style.display = 'none';
  document.getElementById('select-screen').style.display = 'flex';
  gameActive = false;
});

// --- 렌더링 ---
function render() {
  // 배경
  const skyGrad = ctx.createLinearGradient(0, 0, 0, canvasHeight);
  skyGrad.addColorStop(0, '#1a1a2e'); skyGrad.addColorStop(1, '#16213e');
  ctx.fillStyle = skyGrad; ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  // 길
  ctx.fillStyle = '#2c3e50';
  ctx.fillRect(0, LANE_Y - 40, canvasWidth, 120);
  ctx.strokeStyle = '#1a252f'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(0, LANE_Y - 40); ctx.lineTo(canvasWidth, LANE_Y - 40); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, LANE_Y + 80); ctx.lineTo(canvasWidth, LANE_Y + 80); ctx.stroke();

  // 성
  drawCastle(80, LANE_Y, '#3498db'); // 내 성
  drawCastle(canvasWidth - 80, LANE_Y, '#e74c3c'); // 적 성

  // 아군 유닛
  allies.forEach(ally => {
    ctx.shadowColor = 'rgba(0,0,0,0.8)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 8;
    ctx.fillStyle = ally.color;
    ctx.beginPath(); ctx.arc(ally.x, ally.y, ally.size, 0, Math.PI * 2); ctx.fill();
    drawHpBar(ally); ctx.shadowColor = 'transparent';
  });

  // 적군 유닛
  enemies.forEach(enemy => {
    ctx.shadowColor = 'rgba(0,0,0,0.8)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 8;
    ctx.fillStyle = enemy.color;
    ctx.beginPath(); ctx.arc(enemy.x, enemy.y, enemy.size, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#ff0000'; ctx.lineWidth = 2; ctx.stroke();
    drawHpBar(enemy); ctx.shadowColor = 'transparent';
  });

  // 보스
  if (bossActive && boss && boss.hp > 0) {
    if (bossImg.complete && bossImg.naturalWidth !== 0) {
      ctx.save();
      const imgSize = boss.size * 2.5;
      ctx.shadowColor = 'rgba(255,0,0,0.8)'; ctx.shadowBlur = 20; ctx.shadowOffsetY = 10;
      ctx.drawImage(bossImg, boss.x - imgSize/2, boss.y - imgSize/2, imgSize, imgSize);
      ctx.restore();
    } else {
      ctx.fillStyle = boss.color; ctx.beginPath(); ctx.arc(boss.x, boss.y, boss.size, 0, Math.PI*2); ctx.fill();
    }
    drawHpBar(boss); 
    ctx.fillStyle = '#fff'; ctx.font = 'bold 20px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('👑 보스', boss.x, boss.y - boss.size - 15);
  }

  // 투사체
  projectiles.forEach(proj => {
    ctx.fillStyle = proj.color;
    ctx.beginPath(); ctx.arc(proj.x, proj.y, 6, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = proj.color; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(proj.x - 15, proj.y); ctx.lineTo(proj.x, proj.y); ctx.stroke();
  });

  // 이펙트
  effects.forEach((effect, index) => {
    if (effect.type === 'hit') {
      ctx.fillStyle = `rgba(255, 255, 0, ${effect.timer / 100})`;
      ctx.beginPath(); ctx.arc(effect.x, effect.y, 25 - effect.timer/5, 0, Math.PI * 2); ctx.fill();
      effect.timer -= 3;
      if (effect.timer <= 0) effects.splice(index, 1);
    }
  });
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
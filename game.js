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

// 🖼️ 이미지 로드 (자동 폴백: battlefield_bg.png / background.png, mage_unit.png / mage.png 모두 호환)
const soldierImg = new Image();
soldierImg.src = 'soldier.png';

const zombieImg = new Image();
zombieImg.src = 'zombie.png';

const mageImg = new Image();
mageImg.src = 'mage_unit.png';
mageImg.onerror = () => { mageImg.src = 'mage.png'; };

const archerImg = new Image();
archerImg.src = 'archer_unit.png';
archerImg.onerror = () => { archerImg.src = 'archer.png'; };

const bossImg = new Image();
bossImg.src = 'boss.png';

const backgroundImg = new Image();
backgroundImg.src = 'battlefield_bg.png';
backgroundImg.onerror = () => { backgroundImg.src = 'background.png'; };

let heroType = '';
const heroData = { pantheon: '판테온', mage: '마법사', archer: '궁수' };

// 영웅별 유닛 설정
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
let animationId, lastTime = 0;
let mana = 0; const MAX_MANA = 100;
let playerCastleHp = 2000, enemyCastleHp = 2000;
const MAX_CASTLE_HP = 2000;
let gameState = 'PLAYING'; 
let gameTime = 0; 
const BOSS_SPAWN_TIME = 25000; // 25초 후 보스 출현

let allies = [];
let enemies = [];
let projectiles = []; 
let cannonBalls = []; 
let effects = []; 

let spawnTimer = 0;
let castleCannonTimer = 0; 
let bossActive = false; 
let boss = null;

// 시작 화면 -> 영웅 선택
document.getElementById('start-btn').addEventListener('click', () => {
  document.getElementById('start-screen').style.display = 'none';
  document.getElementById('select-screen').style.display = 'flex';
});

// 영웅 카드 클릭
document.querySelectorAll('.hero-card').forEach(card => {
  card.addEventListener('click', () => {
    heroType = card.dataset.hero;
    startGame();
  });
});

// 유닛 소환 버튼
document.querySelectorAll('.summon-btn').forEach((btn, index) => {
  btn.addEventListener('click', () => {
    if (!gameActive || gameState !== 'PLAYING') return;
    const stat = minionStats[heroType][index];
    if (mana >= stat.cost) {
      mana -= stat.cost;
      updateUI();
      allies.push({
        x: 120, y: LANE_Y,
        hp: stat.hp, maxHp: stat.hp, atk: stat.atk, speed: stat.speed,
        range: stat.range, color: stat.color, size: stat.size, type: stat.type,
        lastAttack: 0, isEnemy: false, attackTimer: 0
      });
      effects.push({ x: 120, y: LANE_Y, timer: 120, type: 'summon' });
    }
  });
});

// 다시 시작 버튼
document.getElementById('restart-btn').addEventListener('click', () => {
  document.getElementById('game-screen').style.display = 'none';
  document.getElementById('select-screen').style.display = 'flex';
  gameActive = false;
});

function startGame() {
  document.getElementById('select-screen').style.display = 'none';
  document.getElementById('game-screen').style.display = 'block';
  document.getElementById('hero-name').textContent = `소환사: ${heroData[heroType]}`;
  
  // 영웅 아바타 이미지 동기화
  const avatarElem = document.getElementById('hero-avatar');
  if (avatarElem) {
    avatarElem.src = `hero_${heroType}.png`;
  }
  
  gameActive = true; gameState = 'PLAYING';
  mana = 0; playerCastleHp = MAX_CASTLE_HP; enemyCastleHp = MAX_CASTLE_HP;
  allies = []; enemies = []; projectiles = []; cannonBalls = []; effects = [];
  spawnTimer = 0; castleCannonTimer = 0; bossActive = false; boss = null; gameTime = 0;
  
  document.getElementById('restart-btn').style.display = 'none';
  updateUI();
  
  const buttons = document.querySelectorAll('.summon-btn');
  const stats = minionStats[heroType];
  buttons.forEach((btn, index) => {
    const s = stats[index];
    let thumb = 'soldier.png';
    if (heroType === 'mage') thumb = mageImg.src;
    else if (heroType === 'archer') thumb = archerImg.src;
    
    btn.innerHTML = `
      <span class="cost">${s.cost}</span>
      <div class="summon-thumb"><img src="${thumb}" alt="${s.name}" onerror="this.style.display='none'"></div>
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
      range: 40, color: '#555', size: 26, type: 'melee',
      lastAttack: 0, isEnemy: true, attackTimer: 0
    });
  }

  if (gameTime > BOSS_SPAWN_TIME && !bossActive) {
    bossActive = true;
    boss = {
      x: canvasWidth - 150, y: LANE_Y,
      hp: 4000, maxHp: 4000, atk: 60, speed: 0.45, range: 65, size: 60, color: '#8e44ad',
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
      cannonBalls.push({ x: 120, y: LANE_Y - 40, target: closestEnemy, speed: 15, atk: 50, color: '#f1c40f' });
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
            projectiles.push({ 
              x: ally.x + ally.size, 
              y: ally.y - 10, 
              target: frontEnemy, 
              atk: ally.atk, 
              speed: 13, 
              color: ally.color,
              heroType: heroType
            });
          } else {
            frontEnemy.hp -= ally.atk;
            effects.push({ x: frontEnemy.x, y: frontEnemy.y - 15, timer: 100, type: 'hit' });
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

  // 적 일반 몹 (좀비)
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
          effects.push({ x: frontAlly.x, y: frontAlly.y - 15, timer: 100, type: 'hit' });
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

  // 바이킹 보스
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
          effects.push({ x: frontAlly.x, y: frontAlly.y - 25, timer: 100, type: 'hit' });
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
      effects.push({ x: proj.target.x, y: proj.target.y - 15, timer: 100, type: 'hit' });
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
  
  ctx.fillStyle = 'rgba(0,0,0,0.85)';
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  ctx.fillStyle = gameState === 'VICTORY' ? 'gold' : '#ff4757';
  ctx.font = 'bold 50px Malgun Gothic';
  ctx.textAlign = 'center';
  ctx.fillText(msg, canvasWidth / 2, canvasHeight / 2);
}

// 🎨 화면 렌더링
function render() {
  const hasBg = backgroundImg.complete && backgroundImg.naturalWidth !== 0;

  if (hasBg) {
    // 고화질 전장 배경 그리기
    ctx.drawImage(backgroundImg, 0, 0, canvasWidth, canvasHeight);
  } else {
    // 배경 없을 때 기본 그라데이션
    const skyGrad = ctx.createLinearGradient(0, 0, 0, canvasHeight);
    skyGrad.addColorStop(0, '#1a1a2e'); skyGrad.addColorStop(1, '#16213e');
    ctx.fillStyle = skyGrad; ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    ctx.fillStyle = 'rgba(44, 62, 80, 0.8)'; 
    ctx.fillRect(0, LANE_Y - 40, canvasWidth, 120);
    ctx.strokeStyle = '#1a252f'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(0, LANE_Y - 40); ctx.lineTo(canvasWidth, LANE_Y - 40); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, LANE_Y + 80); ctx.lineTo(canvasWidth, LANE_Y + 80); ctx.stroke();
    drawCastle(80, LANE_Y, '#3498db');
    drawCastle(canvasWidth - 80, LANE_Y, '#e74c3c');
  }

  // 아군 유닛 그리기 (판테온/마법사/궁수 모두 지원)
  allies.forEach(ally => {
    let renderX = ally.x;
    if (ally.attackTimer > 0) renderX += 10;
    
    let currentImg = null;
    if (heroType === 'pantheon') currentImg = soldierImg;
    else if (heroType === 'mage') currentImg = mageImg;
    else if (heroType === 'archer') currentImg = archerImg;

    if (currentImg && currentImg.complete && currentImg.naturalWidth !== 0) {
      ctx.save();
      const imgH = ally.size * 2.6;
      const imgW = imgH * (currentImg.naturalWidth / currentImg.naturalHeight);
      
      // 발밑 그림자
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.beginPath();
      ctx.ellipse(renderX, ally.y + 4, imgW * 0.35, 6, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.drawImage(currentImg, renderX - imgW / 2, ally.y - imgH + 12, imgW, imgH);
      ctx.restore();
    } else {
      ctx.shadowColor = 'rgba(0,0,0,0.8)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 8;
      ctx.fillStyle = ally.color;
      ctx.beginPath(); ctx.arc(renderX, ally.y - ally.size / 2, ally.size, 0, Math.PI * 2); ctx.fill();
      ctx.shadowColor = 'transparent';
    }
    
    drawHpBar({x: renderX, y: ally.y - ally.size - 5, size: ally.size, hp: ally.hp, maxHp: ally.maxHp, isEnemy: false}); 
  });

  // 적군 좀비 그리기
  enemies.forEach(enemy => {
    let renderX = enemy.x;
    if (enemy.attackTimer > 0) renderX -= 10;
    
    if (zombieImg.complete && zombieImg.naturalWidth !== 0) {
      ctx.save();
      const imgH = enemy.size * 2.7;
      const imgW = imgH * (zombieImg.naturalWidth / zombieImg.naturalHeight);
      
      // 발밑 그림자
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.beginPath();
      ctx.ellipse(renderX, enemy.y + 4, imgW * 0.35, 6, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.drawImage(zombieImg, renderX - imgW / 2, enemy.y - imgH + 12, imgW, imgH);
      ctx.restore();
    } else {
      ctx.shadowColor = 'rgba(0,0,0,0.8)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 8;
      ctx.fillStyle = enemy.color;
      ctx.beginPath(); ctx.arc(renderX, enemy.y - enemy.size / 2, enemy.size, 0, Math.PI * 2); ctx.fill();
      ctx.shadowColor = 'transparent';
    }
    
    drawHpBar({x: renderX, y: enemy.y - enemy.size - 5, size: enemy.size, hp: enemy.hp, maxHp: enemy.maxHp, isEnemy: true}); 
  });

  // 바이킹 보스 그리기 (플레이어 진영을 바라보도록 수평 반전 적용)
  if (bossActive && boss && boss.hp > 0) {
    let renderX = boss.x;
    if (boss.attackTimer > 0) renderX -= 18;

    if (bossImg.complete && bossImg.naturalWidth !== 0) {
      ctx.save();
      const imgH = boss.size * 2.8;
      const imgW = imgH * (bossImg.naturalWidth / bossImg.naturalHeight);
      
      // 그림자
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.beginPath();
      ctx.ellipse(renderX, boss.y + 8, imgW * 0.45, 12, 0, 0, Math.PI * 2);
      ctx.fill();

      // 플레이어 쪽(왼쪽)으로 수평 반전
      ctx.translate(renderX, boss.y - imgH + 20);
      ctx.scale(-1, 1);
      ctx.shadowColor = 'rgba(231, 76, 60, 0.7)';
      ctx.shadowBlur = 20;
      ctx.drawImage(bossImg, -imgW / 2, 0, imgW, imgH);
      ctx.restore();
    } else {
      ctx.fillStyle = boss.color;
      ctx.beginPath(); ctx.arc(renderX, boss.y - boss.size / 2, boss.size, 0, Math.PI * 2); ctx.fill();
    }

    drawHpBar({x: renderX, y: boss.y - boss.size - 10, size: boss.size, hp: boss.hp, maxHp: boss.maxHp, isEnemy: true}); 
    ctx.fillStyle = '#ff4757';
    ctx.font = 'bold 22px Malgun Gothic, sans-serif';
    ctx.textAlign = 'center';
    ctx.shadowColor = '#000';
    ctx.shadowBlur = 8;
    ctx.fillText('👑 바이킹 보스', renderX, boss.y - boss.size - 30);
    ctx.shadowColor = 'transparent';
  }

  // 대포알
  cannonBalls.forEach(cannon => {
    ctx.fillStyle = cannon.color;
    ctx.beginPath(); ctx.arc(cannon.x, cannon.y, 10, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#d35400'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(cannon.x - 20, cannon.y); ctx.lineTo(cannon.x, cannon.y); ctx.stroke();
  });

  // 투사체 (마법구 / 화살)
  projectiles.forEach(proj => {
    ctx.save();
    if (proj.heroType === 'mage') {
      ctx.shadowColor = '#00d2d3';
      ctx.shadowBlur = 12;
      ctx.fillStyle = '#54a0ff';
      ctx.beginPath(); ctx.arc(proj.x, proj.y, 8, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.strokeStyle = '#ecf0f1';
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(proj.x - 18, proj.y); ctx.lineTo(proj.x, proj.y); ctx.stroke();
    }
    ctx.restore();
  });

  // 이펙트
  effects.forEach((effect, index) => {
    ctx.save();
    if (effect.type === 'hit') {
      ctx.fillStyle = `rgba(255, 255, 0, ${effect.timer / 100})`;
      ctx.beginPath(); ctx.arc(effect.x, effect.y, 25 - effect.timer/5, 0, Math.PI * 2); ctx.fill();
      effect.timer -= 4;
      if (effect.timer <= 0) effects.splice(index, 1);
    } else if (effect.type === 'cannon') {
      ctx.fillStyle = `rgba(241, 196, 15, ${effect.timer / 150})`;
      ctx.beginPath(); ctx.arc(effect.x, effect.y, 40 - effect.timer/3, 0, Math.PI * 2); ctx.fill();
      effect.timer -= 4;
      if (effect.timer <= 0) effects.splice(index, 1);
    } else if (effect.type === 'summon') {
      ctx.strokeStyle = `rgba(52, 152, 219, ${effect.timer / 120})`;
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(effect.x, effect.y + 4, 30 - effect.timer / 6, 8, 0, 0, Math.PI * 2); ctx.stroke();
      effect.timer -= 4;
      if (effect.timer <= 0) effects.splice(index, 1);
    }
    ctx.restore();
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
  const y = entity.y - 12;
  
  ctx.fillStyle = 'rgba(0,0,0,0.8)'; ctx.fillRect(x - 2, y - 2, barWidth + 4, 10);
  ctx.fillStyle = 'red'; ctx.fillRect(x, y, barWidth, 6);
  ctx.fillStyle = entity.isEnemy ? '#e74c3c' : '#2ecc71'; 
  const hpPercent = Math.max(0, entity.hp / entity.maxHp);
  ctx.fillRect(x, y, barWidth * hpPercent, 6);
}
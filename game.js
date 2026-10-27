// 캔버스 및 초기 설정
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
let canvasWidth, canvasHeight;
let LANE_Y = window.innerHeight * 0.70;

function resizeCanvas() {
  canvasWidth = window.innerWidth;
  canvasHeight = window.innerHeight;
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  LANE_Y = canvasHeight * 0.70;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// 🖼️ 게임 이미지 로드
const assets = {
  bg: new Image(),
  pantheon: new Image(),
  mage: new Image(),
  archer: new Image(),
  soldier: new Image(),
  mageUnit: new Image(),
  archerUnit: new Image(),
  zombie: new Image(),
  boss: new Image()
};

assets.bg.src = 'battlefield_bg.png';
assets.pantheon.src = 'hero_pantheon.png';
assets.mage.src = 'hero_mage.png';
assets.archer.src = 'hero_archer.png';
assets.soldier.src = 'soldier.png';
assets.mageUnit.src = 'mage_unit.png';
assets.archerUnit.src = 'archer_unit.png';
assets.zombie.src = 'zombie.png';
assets.boss.src = 'boss.png';

const heroData = {
  pantheon: { name: '판테온', title: '소환사: 판테온', avatar: 'hero_pantheon.png' },
  mage: { name: '마법사', title: '소환사: 대마법사', avatar: 'hero_mage.png' },
  archer: { name: '궁수', title: '소환사: 엘프 궁수', avatar: 'hero_archer.png' }
};

// 각 영웅별 유닛 설정
const minionStats = {
  pantheon: [
    { name: '보병', hp: 180, atk: 20, speed: 1.2, range: 45, cost: 30, height: 68, imgKey: 'soldier', thumbSrc: 'soldier.png', type: 'melee' },
    { name: '중보병', hp: 380, atk: 40, speed: 1.0, range: 45, cost: 50, height: 80, imgKey: 'soldier', thumbSrc: 'soldier.png', type: 'melee' },
    { name: '정예 근위병', hp: 750, atk: 75, speed: 0.85, range: 45, cost: 70, height: 94, imgKey: 'soldier', thumbSrc: 'soldier.png', type: 'melee' }
  ],
  mage: [
    { name: '견습 마법사', hp: 90, atk: 25, speed: 1.05, range: 250, cost: 30, height: 66, imgKey: 'mageUnit', thumbSrc: 'mage_unit.png', type: 'ranged' },
    { name: '비전 마법사', hp: 160, atk: 55, speed: 0.9, range: 280, cost: 50, height: 78, imgKey: 'mageUnit', thumbSrc: 'mage_unit.png', type: 'ranged' },
    { name: '대마법사', hp: 260, atk: 105, speed: 0.75, range: 310, cost: 70, height: 92, imgKey: 'mageUnit', thumbSrc: 'mage_unit.png', type: 'ranged' }
  ],
  archer: [
    { name: '정찰 궁수', hp: 110, atk: 28, speed: 1.5, range: 200, cost: 30, height: 66, imgKey: 'archerUnit', thumbSrc: 'archer_unit.png', type: 'ranged' },
    { name: '저격수', hp: 180, atk: 60, speed: 1.3, range: 230, cost: 50, height: 78, imgKey: 'archerUnit', thumbSrc: 'archer_unit.png', type: 'ranged' },
    { name: '엘프 명사수', hp: 300, atk: 115, speed: 1.05, range: 260, cost: 70, height: 92, imgKey: 'archerUnit', thumbSrc: 'archer_unit.png', type: 'ranged' }
  ]
};

// 게임 상태 변수
let heroType = 'pantheon';
let gameActive = false;
let animationId = null;
let lastTime = 0;
let mana = 0;
const MAX_MANA = 100;

let playerCastleHp = 2000;
let enemyCastleHp = 2000;
const MAX_CASTLE_HP = 2000;

let gameState = 'PLAYING';
let gameTime = 0;
const BOSS_SPAWN_TIME = 25000; // 25초 후 보스 출현

let allies = [];
let enemies = [];
let projectiles = [];
let cannonBalls = [];
let effects = [];
let screenShake = 0;
let bossWarningTimer = 0;

let spawnTimer = 0;
let castleCannonTimer = 0;
let bossActive = false;
let boss = null;

// 화면 전환 이벤트
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

  // 영웅 정보 업데이트
  const currentHero = heroData[heroType];
  document.getElementById('hero-name').textContent = currentHero.title;
  document.getElementById('hero-avatar').src = currentHero.avatar;

  gameActive = true;
  gameState = 'PLAYING';
  mana = 0;
  playerCastleHp = MAX_CASTLE_HP;
  enemyCastleHp = MAX_CASTLE_HP;
  allies = [];
  enemies = [];
  projectiles = [];
  cannonBalls = [];
  effects = [];
  spawnTimer = 0;
  castleCannonTimer = 0;
  bossActive = false;
  boss = null;
  gameTime = 0;
  screenShake = 0;
  bossWarningTimer = 0;

  document.getElementById('restart-btn').style.display = 'none';
  updateUI();

  // 소환 버튼 세팅 (선택된 영웅 유닛으로 세팅)
  const buttons = document.querySelectorAll('.summon-btn');
  const stats = minionStats[heroType];
  buttons.forEach((btn, index) => {
    const s = stats[index];
    btn.innerHTML = `
      <span class="cost">${s.cost}</span>
      <div class="summon-thumb"><img src="${s.thumbSrc}" alt="${s.name}"></div>
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

// 유닛 소환 버튼 클릭 이벤트
document.querySelectorAll('.summon-btn').forEach((btn, index) => {
  btn.addEventListener('click', () => {
    if (!gameActive || gameState !== 'PLAYING') return;
    const stat = minionStats[heroType][index];
    if (mana >= stat.cost) {
      mana -= stat.cost;
      updateUI();

      allies.push({
        x: 130,
        y: LANE_Y,
        name: stat.name,
        hp: stat.hp,
        maxHp: stat.hp,
        atk: stat.atk,
        speed: stat.speed,
        range: stat.range,
        height: stat.height,
        imgKey: stat.imgKey,
        type: stat.type,
        lastAttack: 0,
        isEnemy: false,
        attackTimer: 0
      });

      // 소환 이펙트
      effects.push({ x: 130, y: LANE_Y, timer: 200, type: 'summon' });
    }
  });
});

// 메인 게임 루프
function gameLoop(timestamp) {
  if (!gameActive) return;
  const dt = timestamp - lastTime;
  lastTime = timestamp;

  if (gameState === 'PLAYING') {
    gameTime += dt;
    if (mana < MAX_MANA) {
      mana += 15 * (dt / 1000);
      updateUI();
    }

    if (screenShake > 0) screenShake -= dt;
    if (bossWarningTimer > 0) bossWarningTimer -= dt;

    spawnSystem(dt);
    updateUnits(dt);
    updateProjectiles(dt);
    updateCannonBalls(dt);
    checkGameState();
  }

  render();
  animationId = requestAnimationFrame(gameLoop);
}

// 적 소환 시스템
function spawnSystem(dt) {
  spawnTimer += dt;

  if (spawnTimer > 2500) {
    spawnTimer = 0;
    const enemyHp = 110 + (gameTime / 1000) * 6;
    enemies.push({
      x: canvasWidth - 130,
      y: LANE_Y,
      hp: enemyHp,
      maxHp: enemyHp,
      atk: 16,
      speed: 0.85,
      range: 45,
      height: 75,
      lastAttack: 0,
      isEnemy: true,
      attackTimer: 0
    });
  }

  // 보스 소환
  if (gameTime > BOSS_SPAWN_TIME && !bossActive) {
    bossActive = true;
    bossWarningTimer = 3500; // 3.5초 동안 경고 메시지 표시
    boss = {
      x: canvasWidth - 160,
      y: LANE_Y,
      hp: 4500,
      maxHp: 4500,
      atk: 70,
      speed: 0.45,
      range: 70,
      height: 180,
      lastAttack: 0,
      attackTimer: 0
    };
    effects.push({ x: canvasWidth - 160, y: LANE_Y, timer: 400, type: 'bossSpawn' });
  }
}

// 아군 성채 자동 포탑 시스템
function updateCannonBalls(dt) {
  castleCannonTimer += dt;
  if (castleCannonTimer > 2200) {
    let closestEnemy = enemies.find(e => e.x > 120 && e.x < 550);
    if (!closestEnemy && bossActive && boss && boss.x > 120 && boss.x < 550) {
      closestEnemy = boss;
    }

    if (closestEnemy) {
      castleCannonTimer = 0;
      cannonBalls.push({
        x: 120,
        y: LANE_Y - 80,
        target: closestEnemy,
        speed: 16,
        atk: 60,
        color: '#f1c40f'
      });
    }
  }

  const speedMultiplier = dt / 16.67;
  cannonBalls.forEach((cannon, index) => {
    if (cannon.target.hp <= 0) {
      cannonBalls.splice(index, 1);
      return;
    }
    if (cannon.x < cannon.target.x) {
      cannon.x += cannon.speed * speedMultiplier;
    } else {
      cannon.target.hp -= cannon.atk;
      effects.push({ x: cannon.target.x, y: cannon.target.y - 20, timer: 180, type: 'cannon' });
      cannonBalls.splice(index, 1);
    }
  });
}

// 유닛 업데이트
function updateUnits(dt) {
  const speedMultiplier = dt / 16.67;

  // 아군 유닛
  allies.forEach(ally => {
    let frontEnemy = null;
    enemies.forEach(e => {
      if (e.x > ally.x && (!frontEnemy || e.x < frontEnemy.x)) frontEnemy = e;
    });
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
              x: ally.x + 30,
              y: ally.y - ally.height * 0.55,
              target: frontEnemy,
              atk: ally.atk,
              speed: 14,
              heroType: heroType
            });
          } else {
            frontEnemy.hp -= ally.atk;
            effects.push({ x: frontEnemy.x, y: frontEnemy.y - 30, timer: 120, type: 'slash' });
          }
        }
      } else {
        ally.x += ally.speed * speedMultiplier;
      }
    } else {
      // 적이 없으면 적 성채를 향해 진격
      ally.x += ally.speed * speedMultiplier;
      if (ally.x >= canvasWidth - 100) {
        if (performance.now() - ally.lastAttack > 1000) {
          ally.lastAttack = performance.now();
          ally.attackTimer = 300;
          enemyCastleHp -= ally.atk;
          screenShake = 150;
          effects.push({ x: canvasWidth - 80, y: LANE_Y - 40 + (Math.random() * 40 - 20), timer: 120, type: 'hit' });
          updateUI();
        }
      }
    }
  });

  // 적 일반 몹 (좀비)
  enemies.forEach(enemy => {
    let frontAlly = null;
    allies.forEach(a => {
      if (a.x < enemy.x && (!frontAlly || a.x > frontAlly.x)) frontAlly = a;
    });
    if (enemy.attackTimer > 0) enemy.attackTimer -= dt;

    if (frontAlly) {
      const dist = enemy.x - frontAlly.x;
      if (dist <= enemy.range) {
        if (performance.now() - enemy.lastAttack > 1000) {
          enemy.lastAttack = performance.now();
          enemy.attackTimer = 300;
          frontAlly.hp -= enemy.atk;
          effects.push({ x: frontAlly.x, y: frontAlly.y - 30, timer: 120, type: 'claw' });
        }
      } else {
        enemy.x -= enemy.speed * speedMultiplier;
      }
    } else {
      // 아군이 없으면 아군 성채를 향해 진격
      enemy.x -= enemy.speed * speedMultiplier;
      if (enemy.x <= 100) {
        if (performance.now() - enemy.lastAttack > 1000) {
          enemy.lastAttack = performance.now();
          enemy.attackTimer = 300;
          playerCastleHp -= enemy.atk;
          screenShake = 150;
          effects.push({ x: 80, y: LANE_Y - 40, timer: 120, type: 'hit' });
          updateUI();
        }
      }
    }
  });

  // 바이킹 보스
  if (bossActive && boss && boss.hp > 0) {
    let frontAlly = null;
    allies.forEach(a => {
      if (a.x < boss.x && (!frontAlly || a.x > frontAlly.x)) frontAlly = a;
    });
    if (boss.attackTimer > 0) boss.attackTimer -= dt;

    if (frontAlly) {
      const dist = boss.x - frontAlly.x;
      if (dist <= boss.range) {
        if (performance.now() - boss.lastAttack > 1200) {
          boss.lastAttack = performance.now();
          boss.attackTimer = 400;
          frontAlly.hp -= boss.atk;
          screenShake = 200;
          effects.push({ x: frontAlly.x, y: frontAlly.y - 30, timer: 180, type: 'heavySlash' });
        }
      } else {
        boss.x -= boss.speed * speedMultiplier;
      }
    } else {
      boss.x -= boss.speed * speedMultiplier;
      if (boss.x <= 100) {
        if (performance.now() - boss.lastAttack > 1400) {
          boss.lastAttack = performance.now();
          boss.attackTimer = 400;
          playerCastleHp -= boss.atk * 2.5;
          screenShake = 300;
          effects.push({ x: 80, y: LANE_Y - 50, timer: 200, type: 'heavySlash' });
          updateUI();
        }
      }
    }
  }

  allies = allies.filter(a => a.hp > 0);
  enemies = enemies.filter(e => e.hp > 0);
}

// 투사체 업데이트
function updateProjectiles(dt) {
  const speedMultiplier = dt / 16.67;
  projectiles.forEach((proj, index) => {
    if (proj.target.hp <= 0) {
      projectiles.splice(index, 1);
      return;
    }
    if (proj.x < proj.target.x) {
      proj.x += proj.speed * speedMultiplier;
    } else {
      proj.target.hp -= proj.atk;
      effects.push({
        x: proj.target.x,
        y: proj.target.y - 25,
        timer: 120,
        type: proj.heroType === 'mage' ? 'magicHit' : 'arrowHit'
      });
      projectiles.splice(index, 1);
    }
  });
}

function checkGameState() {
  if (playerCastleHp <= 0) {
    gameState = 'DEFEAT';
    showEndScreen('패배... 아군 성채가 함락되었습니다.');
  } else if (enemyCastleHp <= 0) {
    gameState = 'VICTORY';
    showEndScreen('승리! 적의 요새를 완파했습니다!');
  }
}

function showEndScreen(msg) {
  gameActive = false;
  document.getElementById('restart-btn').style.display = 'block';
  document.querySelectorAll('.summon-btn').forEach(btn => btn.disabled = true);

  ctx.fillStyle = 'rgba(0,0,0,0.85)';
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  ctx.fillStyle = gameState === 'VICTORY' ? '#f1c40f' : '#e74c3c';
  ctx.font = 'bold 50px Malgun Gothic, sans-serif';
  ctx.textAlign = 'center';
  ctx.shadowColor = 'black';
  ctx.shadowBlur = 20;
  ctx.fillText(msg, canvasWidth / 2, canvasHeight / 2 - 20);

  ctx.fillStyle = '#ecf0f1';
  ctx.font = '22px Malgun Gothic, sans-serif';
  ctx.fillText('다시 도전하려면 하단의 [다시 시작] 버튼을 누르세요.', canvasWidth / 2, canvasHeight / 2 + 40);
  ctx.shadowColor = 'transparent';
}

document.getElementById('restart-btn').addEventListener('click', () => {
  document.getElementById('game-screen').style.display = 'none';
  document.getElementById('select-screen').style.display = 'flex';
  gameActive = false;
});

// 그림자 유틸 함수
function drawShadow(x, y, radiusX, radiusY) {
  ctx.save();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
  ctx.beginPath();
  ctx.ellipse(x, y, radiusX, radiusY, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// 🎨 화면 렌더링
function render() {
  ctx.save();

  // 화면 흔들림 효과
  if (screenShake > 0) {
    const intensity = Math.min(8, screenShake / 20);
    ctx.translate((Math.random() - 0.5) * intensity * 2, (Math.random() - 0.5) * intensity * 2);
  }

  // 1. 전장 배경 렌더링 (battlefield_bg.png)
  if (assets.bg.complete && assets.bg.naturalWidth !== 0) {
    ctx.drawImage(assets.bg, 0, 0, canvasWidth, canvasHeight);
  } else {
    // 배경 이미지 로드 전 대체 그라데이션
    const skyGrad = ctx.createLinearGradient(0, 0, 0, canvasHeight);
    skyGrad.addColorStop(0, '#1a1a2e');
    skyGrad.addColorStop(1, '#16213e');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    ctx.fillStyle = '#2c3e50';
    ctx.fillRect(0, LANE_Y - 40, canvasWidth, 120);
  }

  // 2. 아군 유닛 렌더링
  allies.forEach(ally => {
    let renderX = ally.x;
    if (ally.attackTimer > 0) renderX += 12; // 공격 시 전진 찌르기

    const walkBob = Math.sin((gameTime / 160) * ally.speed) * 3;
    const drawH = ally.height;
    const img = assets[ally.imgKey];

    if (img && img.complete && img.naturalWidth !== 0) {
      const drawW = drawH * (img.naturalWidth / img.naturalHeight);
      const drawY = ally.y + walkBob;

      drawShadow(renderX, ally.y + 4, drawW * 0.35, 7);
      ctx.drawImage(img, renderX - drawW / 2, drawY - drawH, drawW, drawH);
      drawHpBar({ x: renderX, y: drawY - drawH, size: drawW * 0.5, hp: ally.hp, maxHp: ally.maxHp, isEnemy: false });
    } else {
      ctx.fillStyle = '#3498db';
      ctx.beginPath(); ctx.arc(renderX, ally.y - drawH / 2, 25, 0, Math.PI * 2); ctx.fill();
    }
  });

  // 3. 적군 일반 몹 (좀비) 렌더링
  enemies.forEach(enemy => {
    let renderX = enemy.x;
    if (enemy.attackTimer > 0) renderX -= 12;

    const walkBob = Math.sin((gameTime / 180) * enemy.speed) * 3;
    const drawH = enemy.height;

    if (assets.zombie.complete && assets.zombie.naturalWidth !== 0) {
      const drawW = drawH * (assets.zombie.naturalWidth / assets.zombie.naturalHeight);
      const drawY = enemy.y + walkBob;

      drawShadow(renderX, enemy.y + 4, drawW * 0.35, 7);
      ctx.drawImage(assets.zombie, renderX - drawW / 2, drawY - drawH, drawW, drawH);
      drawHpBar({ x: renderX, y: drawY - drawH, size: drawW * 0.5, hp: enemy.hp, maxHp: enemy.maxHp, isEnemy: true });
    } else {
      ctx.fillStyle = '#2ecc71';
      ctx.beginPath(); ctx.arc(renderX, enemy.y - drawH / 2, 22, 0, Math.PI * 2); ctx.fill();
    }
  });

  // 4. 바이킹 보스 렌더링
  if (bossActive && boss && boss.hp > 0) {
    let renderX = boss.x;
    if (boss.attackTimer > 0) renderX -= 25; // 도끼 내려찍기 전진

    const walkBob = Math.sin((gameTime / 240) * boss.speed) * 3.5;
    const drawH = boss.height;

    if (assets.boss.complete && assets.boss.naturalWidth !== 0) {
      const drawW = drawH * (assets.boss.naturalWidth / assets.boss.naturalHeight);
      const drawY = boss.y + walkBob;

      drawShadow(renderX, boss.y + 8, drawW * 0.45, 12);

      ctx.save();
      // 보스를 좌측(아군 성채 방향)을 바라보도록 수평 반전
      ctx.translate(renderX, drawY);
      ctx.scale(-1, 1);
      if (boss.attackTimer > 0) {
        ctx.rotate(0.1); // 도끼 타격 시 상체 기울임
      }
      ctx.shadowColor = 'rgba(231, 76, 60, 0.75)';
      ctx.shadowBlur = 25;
      ctx.drawImage(assets.boss, -drawW / 2, -drawH, drawW, drawH);
      ctx.restore();

      drawHpBar({ x: renderX, y: drawY - drawH, size: drawW * 0.45, hp: boss.hp, maxHp: boss.maxHp, isEnemy: true });

      // 보스 네임 배지
      ctx.fillStyle = '#ff4757';
      ctx.font = 'bold 22px Malgun Gothic, sans-serif';
      ctx.textAlign = 'center';
      ctx.shadowColor = '#000';
      ctx.shadowBlur = 8;
      ctx.fillText('👑 바이킹 보스', renderX, drawY - drawH - 18);
      ctx.shadowColor = 'transparent';
    }
  }

  // 5. 성채 대포알
  cannonBalls.forEach(cannon => {
    ctx.save();
    ctx.shadowColor = '#e67e22';
    ctx.shadowBlur = 15;
    ctx.fillStyle = '#f39c12';
    ctx.beginPath(); ctx.arc(cannon.x, cannon.y, 11, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e74c3c';
    ctx.beginPath(); ctx.arc(cannon.x - 3, cannon.y - 2, 7, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  });

  // 6. 원거리 투사체 (화살 / 비전 마법구)
  projectiles.forEach(proj => {
    if (proj.heroType === 'mage') {
      // 신비로운 마법 에너지 구체
      ctx.save();
      ctx.shadowColor = '#00d2d3';
      ctx.shadowBlur = 16;
      const grad = ctx.createRadialGradient(proj.x, proj.y, 2, proj.x, proj.y, 10);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.4, '#54a0ff');
      grad.addColorStop(1, '#5f27cd');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(proj.x, proj.y, 10, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    } else {
      // 날렵한 화살
      ctx.save();
      ctx.strokeStyle = '#ecf0f1';
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(proj.x - 22, proj.y); ctx.lineTo(proj.x, proj.y); ctx.stroke();
      // 화살촉
      ctx.fillStyle = '#bdc3c7';
      ctx.beginPath();
      ctx.moveTo(proj.x, proj.y - 3.5);
      ctx.lineTo(proj.x + 6, proj.y);
      ctx.lineTo(proj.x, proj.y + 3.5);
      ctx.fill();
      // 깃털
      ctx.strokeStyle = '#2ecc71';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(proj.x - 22, proj.y - 3); ctx.lineTo(proj.x - 17, proj.y);
      ctx.moveTo(proj.x - 22, proj.y + 3); ctx.lineTo(proj.x - 17, proj.y);
      ctx.stroke();
      ctx.restore();
    }
  });

  // 7. 이펙트 (타격, 소환, 폭발)
  effects.forEach((effect, index) => {
    ctx.save();
    if (effect.type === 'slash') {
      // 근접 검기 이펙트
      const alpha = effect.timer / 120;
      ctx.strokeStyle = `rgba(255, 230, 0, ${alpha})`;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(effect.x, effect.y, 25, -Math.PI / 3, Math.PI / 3);
      ctx.stroke();
      effect.timer -= 4;
    } else if (effect.type === 'heavySlash') {
      // 보스 대형 도끼 참격
      const alpha = effect.timer / 180;
      ctx.strokeStyle = `rgba(255, 71, 87, ${alpha})`;
      ctx.lineWidth = 7;
      ctx.shadowColor = '#ff4757';
      ctx.shadowBlur = 15;
      ctx.beginPath();
      ctx.arc(effect.x, effect.y, 45, -Math.PI / 2.5, Math.PI / 2.5);
      ctx.stroke();
      effect.timer -= 5;
    } else if (effect.type === 'claw') {
      // 좀비 할퀴기 이펙트
      const alpha = effect.timer / 120;
      ctx.strokeStyle = `rgba(46, 204, 113, ${alpha})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(effect.x - 15, effect.y - 15); ctx.lineTo(effect.x + 15, effect.y + 15);
      ctx.moveTo(effect.x - 8, effect.y - 18); ctx.lineTo(effect.x + 18, effect.y + 12);
      ctx.stroke();
      effect.timer -= 4;
    } else if (effect.type === 'magicHit') {
      // 마법 폭발 이펙트
      const alpha = effect.timer / 120;
      ctx.fillStyle = `rgba(84, 160, 255, ${alpha})`;
      ctx.shadowColor = '#54a0ff';
      ctx.shadowBlur = 20;
      ctx.beginPath(); ctx.arc(effect.x, effect.y, 30 - effect.timer / 5, 0, Math.PI * 2); ctx.fill();
      effect.timer -= 4;
    } else if (effect.type === 'arrowHit') {
      // 화살 피격 이펙트
      const alpha = effect.timer / 120;
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
      ctx.beginPath(); ctx.arc(effect.x, effect.y, 14 - effect.timer / 10, 0, Math.PI * 2); ctx.fill();
      effect.timer -= 4;
    } else if (effect.type === 'cannon') {
      // 대포 폭발 이펙트
      const alpha = effect.timer / 180;
      ctx.fillStyle = `rgba(230, 126, 34, ${alpha})`;
      ctx.shadowColor = '#e67e22';
      ctx.shadowBlur = 25;
      ctx.beginPath(); ctx.arc(effect.x, effect.y, 45 - effect.timer / 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = `rgba(241, 196, 15, ${alpha})`;
      ctx.beginPath(); ctx.arc(effect.x, effect.y, 25 - effect.timer / 8, 0, Math.PI * 2); ctx.fill();
      effect.timer -= 4;
    } else if (effect.type === 'summon') {
      // 소환 마법진 이펙트
      const alpha = effect.timer / 200;
      ctx.strokeStyle = `rgba(52, 152, 219, ${alpha})`;
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(effect.x, effect.y + 4, 35 - effect.timer / 10, 10, 0, 0, Math.PI * 2); ctx.stroke();
      effect.timer -= 4;
    } else if (effect.type === 'bossSpawn') {
      // 보스 등장 마법진
      const alpha = effect.timer / 400;
      ctx.strokeStyle = `rgba(231, 76, 60, ${alpha})`;
      ctx.lineWidth = 5;
      ctx.shadowColor = '#e74c3c';
      ctx.shadowBlur = 25;
      ctx.beginPath(); ctx.ellipse(effect.x, effect.y + 6, 70 - effect.timer / 10, 20, 0, 0, Math.PI * 2); ctx.stroke();
      effect.timer -= 4;
    } else if (effect.type === 'hit') {
      const alpha = effect.timer / 120;
      ctx.fillStyle = `rgba(255, 255, 0, ${alpha})`;
      ctx.beginPath(); ctx.arc(effect.x, effect.y, 20 - effect.timer / 8, 0, Math.PI * 2); ctx.fill();
      effect.timer -= 4;
    }
    ctx.restore();

    if (effect.timer <= 0) effects.splice(index, 1);
  });

  // 8. 보스 출현 경고 메시지 배너
  if (bossWarningTimer > 0) {
    ctx.save();
    const blink = Math.sin(performance.now() * 0.015) > 0;
    ctx.fillStyle = blink ? 'rgba(231, 76, 60, 0.4)' : 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, canvasHeight * 0.28, canvasWidth, 70);

    ctx.fillStyle = '#ff4757';
    ctx.font = '900 36px Malgun Gothic, sans-serif';
    ctx.textAlign = 'center';
    ctx.shadowColor = '#000';
    ctx.shadowBlur = 15;
    ctx.fillText('⚠️ 경고! 바이킹 보스가 전장에 출현했습니다! ⚠️', canvasWidth / 2, canvasHeight * 0.28 + 48);
    ctx.restore();
  }

  ctx.restore();
}

// 체력바 유틸 함수
function drawHpBar(entity) {
  const barWidth = Math.max(35, entity.size * 2);
  const barHeight = 6;
  const x = entity.x - barWidth / 2;
  const y = entity.y - 12;

  ctx.save();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
  ctx.fillRect(x - 2, y - 2, barWidth + 4, barHeight + 4);

  ctx.fillStyle = '#7f1d1d';
  ctx.fillRect(x, y, barWidth, barHeight);

  ctx.fillStyle = entity.isEnemy ? '#ff4757' : '#2ed573';
  const hpPercent = Math.max(0, entity.hp / entity.maxHp);
  ctx.fillRect(x, y, barWidth * hpPercent, barHeight);
  ctx.restore();
}

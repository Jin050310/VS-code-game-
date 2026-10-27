// 캔버스 설정
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
let canvasWidth, canvasHeight;

function resizeCanvas() {
  canvasWidth = window.innerWidth;
  canvasHeight = window.innerHeight;
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// 게임 상태 변수
let gameActive = false;
let animationId;
let lastTime = 0;
let mana = 0;
const MAX_MANA = 100;
let heroType = '';

// 영웅 데이터
const heroData = {
  warrior: { name: '전사', color: '#e74c3c' },
  mage: { name: '마법사', color: '#9b59b6' },
  archer: { name: '궁수', color: '#2ecc71' }
};

// 부하 능력치
const minionStats = {
  warrior: [
    { hp: 100, atk: 10, speed: 1.5, range: 30, cost: 30, color: '#e74c3c', size: 20 },
    { hp: 200, atk: 20, speed: 1.0, range: 30, cost: 50, color: '#c0392b', size: 30 },
    { hp: 500, atk: 50, speed: 0.5, range: 30, cost: 70, color: '#8e44ad', size: 40 }
  ],
  mage: [
    { hp: 50, atk: 15, speed: 1.5, range: 200, cost: 30, color: '#9b59b6', size: 20 },
    { hp: 80, atk: 30, speed: 1.0, range: 250, cost: 50, color: '#8e44ad', size: 30 },
    { hp: 120, atk: 60, speed: 0.5, range: 300, cost: 70, color: '#d35400', size: 40 }
  ],
  archer: [
    { hp: 60, atk: 20, speed: 2.0, range: 150, cost: 30, color: '#2ecc71', size: 20 },
    { hp: 100, atk: 40, speed: 1.5, range: 180, cost: 50, color: '#27ae60', size: 30 },
    { hp: 150, atk: 80, speed: 1.0, range: 220, cost: 70, color: '#1abc9c', size: 40 }
  ]
};

// 게임 오브젝트 배열
let allies = []; // 내 부하들
let enemies = []; // 적 졸병들
let effects = [];

// ⭐️ 새로운 목표 관련 변수
let playerHero = null; // 내 소환사(영웅)
let boss = null;       // 적 보스
let castle = null;     // 적 성
let gamePhase = 'minions'; // 'minions' -> 'boss' -> 'castle'

let enemySpawnTimer = 0;
const enemySpawnInterval = 2500; // 2.5초마다 졸병 스폰

// 화면 전환 제어
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

// 게임 시작 및 초기화
function startGame() {
  document.getElementById('select-screen').style.display = 'none';
  document.getElementById('game-screen').style.display = 'block';
  document.getElementById('hero-name').textContent = `소환사: ${heroData[heroType].name}`;
  
  gameActive = true;
  mana = 0;
  allies = [];
  enemies = [];
  effects = [];
  gamePhase = 'minions';
  enemySpawnTimer = 0;
  
  // ⭐️ 내 소환사(영웅) 생성 (왼쪽 끝)
  playerHero = {
    x: 50, y: canvasHeight / 2,
    hp: 500, maxHp: 500,
    size: 40, color: heroData[heroType].color
  };

  // ⭐️ 적 보스 및 성 초기화 (오른쪽 끝)
  // 보스는 일단 숨겨둠 (졸병 다 죽이면 등장)
  boss = {
    x: canvasWidth - 150, y: canvasHeight / 2 - 100,
    hp: 1500, maxHp: 1500, atk: 30, speed: 0.3, size: 50, color: '#8e44ad',
    active: false, lastAttack: 0
  };
  // 성은 보스 처치 후 등장
  castle = {
    x: canvasWidth - 80, y: canvasHeight / 2 + 100,
    hp: 3000, maxHp: 3000, size: 60, color: '#7f8c8d',
    active: false
  };
  
  // UI 초기화
  document.getElementById('restart-btn').style.display = 'none';
  updateManaUI();
  
  // 소환 버튼 텍스트 설정
  const buttons = document.querySelectorAll('.summon-btn');
  const stats = minionStats[heroType];
  buttons.forEach((btn, index) => {
    btn.textContent = `${index + 1}번 부하 (${stats[index].cost} 마나)`;
    btn.disabled = false;
  });

  lastTime = performance.now();
  animationId = requestAnimationFrame(gameLoop);
}

// 마나 및 버튼 UI 업데이트
function updateManaUI() {
  const manaPercent = (mana / MAX_MANA) * 100;
  document.getElementById('mana-bar').style.width = `${manaPercent}%`;
  document.getElementById('mana-text').textContent = `마나: ${Math.floor(mana)}/100`;
  
  const buttons = document.querySelectorAll('.summon-btn');
  const stats = minionStats[heroType];
  buttons.forEach((btn, index) => {
    btn.disabled = mana < stats[index].cost || !gameActive;
  });
}

// 마나 회복
function regenMana(dt) {
  if (mana < MAX_MANA) {
    mana += 15 * (dt / 1000);
    if (mana > MAX_MANA) mana = MAX_MANA;
    updateManaUI();
  }
}

// 아군 소환
document.querySelectorAll('.summon-btn').forEach((btn, index) => {
  btn.addEventListener('click', () => {
    if (!gameActive) return;
    const cost = minionStats[heroType][index].cost;
    if (mana >= cost) {
      mana -= cost;
      updateManaUI();
      
      const stat = minionStats[heroType][index];
      allies.push({
        x: 100, y: canvasHeight / 2 + (Math.random() * 100 - 50),
        hp: stat.hp, maxHp: stat.hp, atk: stat.atk, speed: stat.speed,
        range: stat.range, color: stat.color, size: stat.size, lastAttack: 0
      });
    }
  });
});

// 게임 루프
function gameLoop(timestamp) {
  if (!gameActive) return;
  const dt = timestamp - lastTime;
  lastTime = timestamp;

  regenMana(dt);
  
  if (gamePhase === 'minions') {
    spawnEnemies(dt);
    // ⭐️ 화면에 적 졸병이 없고, 스폰된 적이 0마리면 보스 등장
    if (enemies.length === 0) {
      gamePhase = 'boss';
      boss.active = true;
    }
  } else if (gamePhase === 'boss') {
    // 보스는 소환사에게 다가감
    if (boss.active && boss.hp > 0) {
      boss.x -= boss.speed;
    }
  } else if (gamePhase === 'castle') {
    // 성은 자동 공격하는 몹(수비병)을 계속 생성
    enemySpawnTimer += dt;
    if (enemySpawnTimer > 1500) { // 1.5초마다 수비병 생성
      enemySpawnTimer = 0;
      enemies.push({
        x: canvasWidth - 150, y: canvasHeight / 2 + (Math.random() * 100 - 50),
        hp: 100, maxHp: 100, atk: 15, speed: 1.0, size: 20, color: '#555', lastAttack: 0
      });
    }
  }

  updateAllies(dt);
  updateEnemies(dt);
  updateBossAndCastle(dt);
  checkGameState();
  render();

  animationId = requestAnimationFrame(gameLoop);
}

// 적 졸병 생성
function spawnEnemies(dt) {
  enemySpawnTimer += dt;
  if (enemySpawnTimer > enemySpawnInterval) {
    enemySpawnTimer = 0;
    enemies.push({
      x: canvasWidth + 50, y: canvasHeight / 2 + (Math.random() * 200 - 100),
      hp: 50, maxHp: 50, atk: 10, speed: 0.8, size: 25, color: '#555', lastAttack: 0
    });
  }
}

// 내 부하 이동 및 공격 로직 (보스/성도 타겟팅에 포함)
function updateAllies(dt) {
  const speedMultiplier = dt / 16.67;
  allies.forEach(ally => {
    let target = null;
    let minDist = Infinity;

    // 현재 타겟이 될 수 있는 적들 리스트업
    let potentialTargets = [...enemies];
    if (boss.active && boss.hp > 0) potentialTargets.push(boss);
    if (castle.active && castle.hp > 0) potentialTargets.push(castle);

    // 가장 가까운 적 찾기
    potentialTargets.forEach(t => {
      const dist = Math.hypot(t.x - ally.x, t.y - ally.y);
      if (dist < minDist) { minDist = dist; target = t; }
    });

    if (target) {
      if (minDist <= ally.range) {
        if (performance.now() - ally.lastAttack > 500) {
          target.hp -= ally.atk;
          ally.lastAttack = performance.now();
          effects.push({ x: target.x, y: target.y, timer: 100, type: 'hit' });
        }
      } else {
        const dx = target.x - ally.x;
        const dy = target.y - ally.y;
        const angle = Math.atan2(dy, dx);
        ally.x += Math.cos(angle) * ally.speed * speedMultiplier;
        ally.y += Math.sin(angle) * ally.speed * speedMultiplier;
      }
    }
  });
}

// 적 졸병 이동 및 공격 로직 (내 소환사 공격)
function updateEnemies(dt) {
  const speedMultiplier = dt / 16.67;
  
  // 죽은 적 제거
  enemies = enemies.filter(e => e.hp > 0);

  enemies.forEach(enemy => {
    let target = null;
    let minDist = Infinity;

    // 타겟: 내 부하들 또는 내 소환사
    let potentialTargets = [...allies, playerHero];

    potentialTargets.forEach(t => {
      const dist = Math.hypot(t.x - enemy.x, t.y - enemy.y);
      if (dist < minDist) { minDist = dist; target = t; }
    });

    if (target) {
      if (minDist <= 40) {
        if (performance.now() - enemy.lastAttack > 1000) {
          target.hp -= enemy.atk;
          enemy.lastAttack = performance.now();
          effects.push({ x: target.x, y: target.y, timer: 100, type: 'hit' });
        }
      } else {
        const dx = target.x - enemy.x;
        const dy = target.y - enemy.y;
        const angle = Math.atan2(dy, dx);
        enemy.x += Math.cos(angle) * enemy.speed * speedMultiplier;
        enemy.y += Math.sin(angle) * enemy.speed * speedMultiplier;
      }
    }
  });
  
  allies = allies.filter(a => a.hp > 0);
}

// 보스 및 성 처리 로직 (보스는 소환사 공격, 성은 수비병만 생성)
function updateBossAndCastle(dt) {
  if (boss.active && boss.hp > 0) {
    // 보스는 내 소환사에게 다가가서 공격
    const distToHero = Math.hypot(playerHero.x - boss.x, playerHero.y - boss.y);
    if (distToHero <= boss.size + playerHero.size) {
      if (performance.now() - boss.lastAttack > 1500) {
        playerHero.hp -= boss.atk;
        boss.lastAttack = performance.now();
        effects.push({ x: playerHero.x, y: playerHero.y, timer: 100, type: 'hit' });
      }
    }
    if (boss.hp <= 0 && gamePhase === 'boss') {
      gamePhase = 'castle'; // 보스 죽으면 성 등장
      boss.active = false;
      castle.active = true;
    }
  }
}

// ⭐️ 승리/패배 조건 검사 (T02 기준)
function checkGameState() {
  // 패배: 내 소환사(영웅)가 죽으면 끝
  if (playerHero.hp <= 0) {
    gameOver('패배... 소환사가 쓰러졌습니다.', 'red');
    return;
  }

  // 승리: 성의 체력이 0이 되면 끝
  if (castle.active && castle.hp <= 0) {
    gameOver('승리! 적의 성을 파괴했습니다!', 'gold');
    return;
  }
}

// 게임 오버 처리
function gameOver(message, color) {
  gameActive = false;
  cancelAnimationFrame(animationId);
  document.getElementById('restart-btn').style.display = 'block';
  
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  ctx.fillStyle = color;
  ctx.font = '50px Malgun Gothic';
  ctx.textAlign = 'center';
  ctx.fillText(message, canvasWidth / 2, canvasHeight / 2 - 50);
  
  // UI 비활성화
  document.querySelectorAll('.summon-btn').forEach(btn => btn.disabled = true);
}

// 다시 시작
document.getElementById('restart-btn').addEventListener('click', () => {
  document.getElementById('game-screen').style.display = 'none';
  document.getElementById('select-screen').style.display = 'flex';
  gameActive = false;
});

// 화면 렌더링 (입체감 및 UI 표시)
function render() {
  // 배경
  const grad = ctx.createLinearGradient(0, 0, 0, canvasHeight);
  grad.addColorStop(0, '#87CEEB'); grad.addColorStop(1, '#2b2b2b');
  ctx.fillStyle = grad; ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  // --- 내 소환사 그리기 ---
  if (playerHero) {
    ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 15; ctx.shadowOffsetY = 5;
    ctx.fillStyle = '#f1c40f'; // 소환사는 눈에 띄게 금색
    ctx.beginPath(); ctx.arc(playerHero.x, playerHero.y, playerHero.size, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#000'; ctx.font = '14px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('소환사', playerHero.x, playerHero.y - playerHero.size - 20);
    drawHpBar(playerHero); ctx.shadowColor = 'transparent';
  }

  // --- 아군 부하 그리기 ---
  allies.forEach(ally => {
    ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 5;
    ctx.fillStyle = ally.color;
    ctx.beginPath(); ctx.arc(ally.x, ally.y, ally.size, 0, Math.PI * 2); ctx.fill();
    drawHpBar(ally); ctx.shadowColor = 'transparent';
  });

  // --- 적 졸병 그리기 ---
  enemies.forEach(enemy => {
    ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 5;
    ctx.fillStyle = enemy.color;
    ctx.beginPath(); ctx.arc(enemy.x, enemy.y, enemy.size, 0, Math.PI * 2); ctx.fill();
    drawHpBar(enemy); ctx.shadowColor = 'transparent';
  });

  // --- 보스 그리기 ---
  if (boss && boss.active && boss.hp > 0) {
    ctx.shadowColor = 'purple'; ctx.shadowBlur = 20; ctx.shadowOffsetY = 10;
    ctx.fillStyle = boss.color;
    ctx.beginPath(); ctx.arc(boss.x, boss.y, boss.size, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = '24px sans-serif';
    ctx.fillText('👑 보스', boss.x, boss.y - boss.size - 20);
    drawHpBar(boss); ctx.shadowColor = 'transparent';
  }

  // --- 성 그리기 ---
  if (castle && castle.active && castle.hp > 0) {
    ctx.shadowColor = 'black'; ctx.shadowBlur = 20; ctx.shadowOffsetY = 10;
    ctx.fillStyle = castle.color;
    ctx.fillRect(castle.x - castle.size, castle.y - castle.size, castle.size * 2, castle.size * 2);
    ctx.fillStyle = '#fff'; ctx.font = '24px sans-serif';
    ctx.fillText('🏰 성', castle.x, castle.y - castle.size - 20);
    drawHpBar(castle); ctx.shadowColor = 'transparent';
  }

  // --- 타격 이펙트 ---
  effects.forEach((effect, index) => {
    if (effect.type === 'hit') {
      ctx.fillStyle = `rgba(255, 0, 0, ${effect.timer / 100})`;
      ctx.beginPath(); ctx.arc(effect.x, effect.y, 30 - effect.timer/5, 0, Math.PI * 2); ctx.fill();
      effect.timer -= 2;
      if (effect.timer <= 0) effects.splice(index, 1);
    }
  });
}

// 체력바 그리기
function drawHpBar(entity) {
  const barWidth = entity.size * 2;
  const barHeight = 6;
  const x = entity.x - barWidth / 2;
  const y = entity.y - entity.size - 10;
  
  ctx.fillStyle = 'red'; ctx.fillRect(x, y, barWidth, barHeight);
  ctx.fillStyle = '#2ecc71'; 
  const hpPercent = Math.max(0, entity.hp / entity.maxHp);
  ctx.fillRect(x, y, barWidth * hpPercent, barHeight);
}
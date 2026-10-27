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

// 데이터 정의 (영웅별 부하 능력치)
const heroData = {
  warrior: { name: '전사', color: '#e74c3c' },
  mage: { name: '마법사', color: '#9b59b6' },
  archer: { name: '궁수', color: '#2ecc71' }
};

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

let allies = [];
let enemies = [];
let effects = [];
let enemySpawnTimer = 0;
let enemySpawnInterval = 3000; // 3초마다 몹 생성

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

function startGame() {
  document.getElementById('select-screen').style.display = 'none';
  document.getElementById('game-screen').style.display = 'block';
  document.getElementById('hero-name').textContent = `영웅: ${heroData[heroType].name}`;
  
  gameActive = true;
  mana = 0;
  allies = [];
  enemies = [];
  effects = [];
  enemySpawnTimer = 0;
  lastTime = performance.now();
  
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

  animationId = requestAnimationFrame(gameLoop);
}

// 마나 업데이트 및 UI
function updateManaUI() {
  const manaPercent = (mana / MAX_MANA) * 100;
  document.getElementById('mana-bar').style.width = `${manaPercent}%`;
  document.getElementById('mana-text').textContent = `마나: ${Math.floor(mana)}/100`;
  
  // 버튼 활성화 상태 업데이트
  const buttons = document.querySelectorAll('.summon-btn');
  const stats = minionStats[heroType];
  buttons.forEach((btn, index) => {
    btn.disabled = mana < stats[index].cost;
  });
}

// 마나 회복 (초당 20)
function regenMana(dt) {
  if (mana < MAX_MANA) {
    mana += 20 * (dt / 1000);
    if (mana > MAX_MANA) mana = MAX_MANA;
    updateManaUI();
  }
}

// 아군(부하) 소환 이벤트
document.querySelectorAll('.summon-btn').forEach((btn, index) => {
  btn.addEventListener('click', () => {
    if (!gameActive) return;
    const cost = minionStats[heroType][index].cost;
    if (mana >= cost) {
      mana -= cost;
      updateManaUI();
      
      const stat = minionStats[heroType][index];
      allies.push({
        x: 50, // 왼쪽에서 시작
        y: canvasHeight / 2 + (Math.random() * 100 - 50), // 약간 랜덤한 y축
        hp: stat.hp, maxHp: stat.hp,
        atk: stat.atk,
        speed: stat.speed,
        range: stat.range,
        color: stat.color,
        size: stat.size,
        lastAttack: 0
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
  spawnEnemies(dt);
  updateAllies(dt);
  updateEnemies(dt);
  render();

  animationId = requestAnimationFrame(gameLoop);
}

// 적(몹) 생성
function spawnEnemies(dt) {
  enemySpawnTimer += dt;
  if (enemySpawnTimer > enemySpawnInterval) {
    enemySpawnTimer = 0;
    enemies.push({
      x: canvasWidth + 50, // 오른쪽에서 시작
      y: canvasHeight / 2 + (Math.random() * 200 - 100),
      hp: 50, maxHp: 50,
      atk: 10,
      speed: 0.8,
      size: 25,
      color: '#555',
      lastAttack: 0
    });
  }
}

// 아군 이동 및 공격 로직
function updateAllies(dt) {
  const speedMultiplier = dt / 16.67; // 60fps 기준 속도 보정
  allies.forEach(ally => {
    // 가장 가까운 적 찾기
    let target = null;
    let minDist = Infinity;
    enemies.forEach(enemy => {
      const dist = Math.hypot(enemy.x - ally.x, enemy.y - ally.y);
      if (dist < minDist) {
        minDist = dist;
        target = enemy;
      }
    });

    if (target) {
      // 사거리 내에 있으면 공격
      if (minDist <= ally.range) {
        if (performance.now() - ally.lastAttack > 500) { // 0.5초 쿨타임
          target.hp -= ally.atk;
          ally.lastAttack = performance.now();
          // 타격 이펙트
          effects.push({ x: target.x, y: target.y, timer: 100, type: 'hit' });
          
          if (target.hp <= 0) {
            target.dead = true;
          }
        }
      } else {
        // 사거리 밖이면 적에게 다가감
        const dx = target.x - ally.x;
        const dy = target.y - ally.y;
        const angle = Math.atan2(dy, dx);
        ally.x += Math.cos(angle) * ally.speed * speedMultiplier;
        ally.y += Math.sin(angle) * ally.speed * speedMultiplier;
      }
    }
  });
}

// 적(몹) 이동 및 공격 로직
function updateEnemies(dt) {
  const speedMultiplier = dt / 16.67;
  
  // 죽은 적 제거
  enemies = enemies.filter(e => e.hp > 0);

  enemies.forEach(enemy => {
    let target = null;
    let minDist = Infinity;
    allies.forEach(ally => {
      const dist = Math.hypot(ally.x - enemy.x, ally.y - enemy.y);
      if (dist < minDist) {
        minDist = dist;
        target = ally;
      }
    });

    if (target) {
      if (minDist <= 40) { // 적의 공격 사거리
        if (performance.now() - enemy.lastAttack > 1000) { // 1초 쿨타임
          target.hp -= enemy.atk;
          enemy.lastAttack = performance.now();
          effects.push({ x: target.x, y: target.y, timer: 100, type: 'hit' });
          
          if (target.hp <= 0) {
            target.dead = true;
          }
        }
      } else {
        const dx = target.x - enemy.x;
        const dy = target.y - enemy.y;
        const angle = Math.atan2(dy, dx);
        enemy.x += Math.cos(angle) * enemy.speed * speedMultiplier;
        enemy.y += Math.sin(angle) * enemy.speed * speedMultiplier;
      }
    } else {
      // 적이 없으면 왼쪽으로 계속 이동
      enemy.x -= enemy.speed * speedMultiplier;
    }
  });

  // 죽은 아군 제거
  allies = allies.filter(a => a.hp > 0);
  
  // 게임 오버 조건 (적이 화면 왼쪽 끝에 닿으면 패배)
  if (enemies.some(e => e.x < -50)) {
    gameOver(false);
  }
}

// 화면 그리기
function render() {
  // 하늘 및 바닥 배경
  const grad = ctx.createLinearGradient(0, 0, 0, canvasHeight);
  grad.addColorStop(0, '#87CEEB');
  grad.addColorStop(1, '#2b2b2b');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  // 바닥 선
  ctx.beginPath();
  ctx.moveTo(0, canvasHeight / 2);
  ctx.lineTo(canvasWidth, canvasHeight / 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.1)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // 아군 그리기 (입체감: 그림자 추가)
  allies.forEach(ally => {
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 5;
    
    ctx.fillStyle = ally.color;
    ctx.beginPath();
    ctx.arc(ally.x, ally.y, ally.size, 0, Math.PI * 2);
    ctx.fill();
    
    // 체력바
    drawHpBar(ally);
    ctx.shadowColor = 'transparent'; // 그림자 해제
  });

  // 적 그리기
  enemies.forEach(enemy => {
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 5;
    
    ctx.fillStyle = enemy.color;
    ctx.beginPath();
    ctx.arc(enemy.x, enemy.y, enemy.size, 0, Math.PI * 2);
    ctx.fill();
    
    drawHpBar(enemy);
    ctx.shadowColor = 'transparent';
  });

  // 이펙트 그리기
  effects.forEach((effect, index) => {
    if (effect.type === 'hit') {
      ctx.fillStyle = `rgba(255, 0, 0, ${effect.timer / 100})`;
      ctx.beginPath();
      ctx.arc(effect.x, effect.y, 30 - effect.timer/5, 0, Math.PI * 2);
      ctx.fill();
      effect.timer -= 2;
      if (effect.timer <= 0) effects.splice(index, 1);
    }
  });
}

// 체력바 그리기 헬퍼 함수
function drawHpBar(entity) {
  const barWidth = entity.size * 2;
  const barHeight = 5;
  const x = entity.x - barWidth / 2;
  const y = entity.y - entity.size - 10;
  
  ctx.fillStyle = 'red';
  ctx.fillRect(x, y, barWidth, barHeight);
  ctx.fillStyle = '#2ecc71';
  const hpPercent = Math.max(0, entity.hp / entity.maxHp);
  ctx.fillRect(x, y, barWidth * hpPercent, barHeight);
}

// 게임 오버 및 초기화
function gameOver(win) {
  gameActive = false;
  cancelAnimationFrame(animationId);
  document.getElementById('restart-btn').style.display = 'block';
  
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  ctx.fillStyle = win ? 'gold' : 'red';
  ctx.font = '50px Malgun Gothic';
  ctx.textAlign = 'center';
  ctx.fillText(win ? '승리!' : '패배...', canvasWidth / 2, canvasHeight / 2);
}

// 다시 시작 버튼
document.getElementById('restart-btn').addEventListener('click', () => {
  document.getElementById('game-screen').style.display = 'none';
  document.getElementById('select-screen').style.display = 'flex';
  
  // 상태 초기화
  gameActive = false;
  allies = [];
  enemies = [];
  effects = [];
  mana = 0;
});
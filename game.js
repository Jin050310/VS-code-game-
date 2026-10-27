let hero = null;
let enemy = null;

// 영웅 카드 클릭 시 게임 시작
document.querySelectorAll('.hero-card').forEach(card => {
  card.addEventListener('click', () => {
    startGame(
      card.dataset.name,
      Number(card.dataset.hp),
      Number(card.dataset.atk)
    );
  });
});

function startGame(name, hp, atk) {
  // 영웅 초기 상태 설정
  hero = { name, hp, maxHp: hp, atk, level: 1 };
  
  // 화면 전환 (영웅 선택 숨기고, 게임 화면 보이기)
  document.getElementById('select').style.display = 'none';
  document.getElementById('game').style.display = 'block';
  
  // 게임 시작 시 버튼 상태 및 로그 초기화
  document.getElementById('attackBtn').style.display = 'inline-block';
  document.getElementById('restartBtn').style.display = 'none';
  document.getElementById('log').textContent = '';
  
  spawnEnemy();
  updateUI();
}

function spawnEnemy() {
  const hp = 30 + hero.level * 10;
  enemy = { hp, maxHp: hp, atk: 5 + hero.level * 2 };
}

function attack() {
  // 이미 게임이 끝났으면 공격 불가 처리
  if (hero.hp <= 0) return; 

  enemy.hp -= hero.atk;
  let log = `몹에게 ${hero.atk} 데미지! `;

  if (enemy.hp <= 0) {
    // 성공(몹 처치) 상태
    log += `처치 완료! 레벨업! `;
    hero.level++;
    hero.maxHp += 20;
    hero.hp = hero.maxHp;
    hero.atk += 5;
    spawnEnemy();
  } else {
    // 몹의 반격
    hero.hp -= enemy.atk;
    log += `몹의 반격! ${enemy.atk} 데미지`;
    
    if (hero.hp <= 0) {
      // 실패(게임 오버) 상태
      hero.hp = 0; // 체력이 음수로 표시되지 않게 0으로 고정
      log = '패배... 게임 오버';
      
      // 공격 버튼 숨기고 다시 시작 버튼 보여주기
      document.getElementById('attackBtn').style.display = 'none';
      document.getElementById('restartBtn').style.display = 'inline-block';
    }
  }
  
  document.getElementById('log').textContent = log;
  updateUI();
}

// '다시 시작' 버튼 클릭 이벤트 (성공/실패 상관없이 언제든 초기화)
document.getElementById('restartBtn').addEventListener('click', () => {
  // 영웅 선택 화면으로 돌아가기
  document.getElementById('select').style.display = 'block';
  document.getElementById('game').style.display = 'none';
  
  // 다시 시작을 위해 변수 초기화 (안전장치)
  hero = null;
  enemy = null;
});

function updateUI() {
  // 영웅 정보 업데이트
  document.getElementById('heroInfo').textContent =
    `${hero.name} Lv.${hero.level} | HP: ${hero.hp}/${hero.maxHp} | ATK: ${hero.atk}`;
  
  // 몹 정보 업데이트 (HP가 0 미만으로 내려가지 않게 처리)
  if (enemy) {
    document.getElementById('enemyHp').textContent =
      `몹 HP: ${Math.max(0, enemy.hp)}/${enemy.maxHp}`;
  }
}
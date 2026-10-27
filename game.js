let hero = null;
let enemy = null;

// 영웅 카드 클릭 시
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
  hero = { name, hp, maxHp: hp, atk, level: 1 };
  document.getElementById('select').style.display = 'none';
  document.getElementById('game').style.display = 'block';
  document.getElementById('attackBtn').addEventListener('click', attack);
  spawnEnemy();
  updateUI();
}

function spawnEnemy() {
  const hp = 30 + hero.level * 10;
  enemy = { hp, maxHp: hp, atk: 5 + hero.level * 2 };
}

function attack() {
  enemy.hp -= hero.atk;
  let log = `몹에게 ${hero.atk} 데미지! `;

  if (enemy.hp <= 0) {
    log += '처치 완료! 레벨업!';
    hero.level++;
    hero.maxHp += 20;
    hero.hp = hero.maxHp;
    hero.atk += 5;
    spawnEnemy();
  } else {
    hero.hp -= enemy.atk;
    log += `몹의 반격! ${enemy.atk} 데미지`;
    if (hero.hp <= 0) {
      alert('패배... 게임 오버');
      location.reload();
      return;
    }
  }
  document.getElementById('log').textContent = log;
  updateUI();
}

function updateUI() {
  document.getElementById('heroInfo').textContent =
    `${hero.name} Lv.${hero.level} | HP: ${hero.hp}/${hero.maxHp} | ATK: ${hero.atk}`;
  document.getElementById('enemyHp').textContent =
    `몹 HP: ${Math.max(0, enemy.hp)}/${enemy.maxHp}`;
}
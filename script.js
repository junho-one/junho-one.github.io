(() => {
  const menuToggle = document.querySelector('.menu-toggle');
  const siteNav = document.querySelector('#site-nav');
  if (menuToggle && siteNav) {
    menuToggle.addEventListener('click', () => {
      const isOpen = menuToggle.getAttribute('aria-expanded') === 'true';
      menuToggle.setAttribute('aria-expanded', String(!isOpen));
      siteNav.classList.toggle('is-open', !isOpen);
    });
    siteNav.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => {
      menuToggle.setAttribute('aria-expanded', 'false');
      siteNav.classList.remove('is-open');
    }));
  }

  const accordionTriggers = document.querySelectorAll('[data-accordion-trigger]');
  const topicCards = document.querySelectorAll('[data-open-target]');

  function setAccordionState(trigger, isOpen, shouldScroll = false) {
    const panelId = trigger.getAttribute('aria-controls');
    const panel = panelId ? document.getElementById(panelId) : null;
    const card = trigger.closest('.accordion-card');
    if (!panel || !card) return;
    trigger.setAttribute('aria-expanded', String(isOpen));
    panel.setAttribute('aria-hidden', String(!isOpen));
    panel.inert = !isOpen;
    card.classList.toggle('is-open', isOpen);
    if (shouldScroll) card.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  accordionTriggers.forEach((trigger) => {
    const panelId = trigger.getAttribute('aria-controls');
    const panel = panelId ? document.getElementById(panelId) : null;
    if (panel) panel.inert = true;
    trigger.addEventListener('click', () => {
      setAccordionState(trigger, trigger.getAttribute('aria-expanded') !== 'true');
    });
  });

  topicCards.forEach((topicCard) => topicCard.addEventListener('click', () => {
    const trigger = document.querySelector(`[aria-controls="${topicCard.dataset.openTarget}"]`);
    if (trigger) setAccordionState(trigger, trigger.getAttribute('aria-expanded') !== 'true', true);
  }));

  if (siteNav) siteNav.querySelectorAll('a[href^="#"]').forEach((link) => link.addEventListener('click', () => {
    const section = document.querySelector(link.getAttribute('href'));
    const trigger = section?.querySelector('[data-accordion-trigger]');
    if (trigger) setAccordionState(trigger, true);
  }));

  const canvas = document.querySelector('#game-canvas');
  const ctx = canvas?.getContext('2d');
  const scoreElement = document.querySelector('#score');
  const highScoreElement = document.querySelector('#high-score');
  const statusElement = document.querySelector('#game-status');
  const overlay = document.querySelector('#game-overlay');
  const startButton = document.querySelector('#start-button');
  const pauseButton = document.querySelector('#pause-button');
  const restartButton = document.querySelector('#restart-button');
  const stopButton = document.querySelector('#stop-button');
  const touchButtons = document.querySelectorAll('[data-direction]');

  if (!canvas || !ctx || !scoreElement || !highScoreElement || !statusElement) return;

  const CELL_SIZE = 20;
  const COLUMNS = canvas.width / CELL_SIZE;
  const ROWS = canvas.height / CELL_SIZE;
  const TICK_MS = 150;
  const ENEMY_COUNT = 5;
  const directions = {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 }
  };
  const directionNames = Object.keys(directions);
  let snake;
  let food;
  let enemies;
  let direction;
  let pendingDirection;
  let score = 0;
  let highScore = readHighScore();
  let gameState = 'ready';
  let timerId = null;

  function readHighScore() {
    try { return Number.parseInt(localStorage.getItem('worm-high-score') || '0', 10) || 0; } catch { return 0; }
  }

  function saveHighScore() {
    try { localStorage.setItem('worm-high-score', String(highScore)); } catch { /* Storage may be disabled. */ }
  }

  function sameCell(a, b) { return a.x === b.x && a.y === b.y; }
  function insideBoard(cell) { return cell.x >= 0 && cell.x < COLUMNS && cell.y >= 0 && cell.y < ROWS; }
  function occupied(cell) { return snake.some((part) => sameCell(part, cell)) || enemies.some((enemy) => sameCell(enemy, cell)); }

  function randomFreeCell() {
    const free = [];
    for (let y = 0; y < ROWS; y += 1) for (let x = 0; x < COLUMNS; x += 1) {
      const cell = { x, y };
      if (!occupied(cell) && (!food || !sameCell(food, cell))) free.push(cell);
    }
    return free.length ? free[Math.floor(Math.random() * free.length)] : { x: 1, y: 1 };
  }

  function resetBoard() {
    snake = [{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }];
    direction = directions.right;
    pendingDirection = directions.right;
    score = 0;
    enemies = [];
    food = null;
    for (let i = 0; i < ENEMY_COUNT; i += 1) enemies.push({ ...randomFreeCell(), direction: directions.left });
    food = randomFreeCell();
    updateScore();
    draw();
  }

  function updateScore() {
    scoreElement.textContent = String(score);
    highScoreElement.textContent = String(highScore);
  }

  function setStatus(message) { statusElement.textContent = message; }

  function setOverlay(message, visible = true) {
    overlay.textContent = message;
    overlay.classList.toggle('is-hidden', !visible);
  }

  function clearTimer() {
    if (timerId !== null) { window.clearInterval(timerId); timerId = null; }
  }

  function beginTimer() {
    if (timerId === null) timerId = window.setInterval(tick, TICK_MS);
  }

  function startGame() {
    if (gameState === 'over' || gameState === 'stopped' || gameState === 'ready') resetBoard();
    gameState = 'running';
    setOverlay('', false);
    setStatus('플레이 중 · 방향키, WASD 또는 터치 버튼을 사용하세요.');
    startButton.disabled = true;
    pauseButton.disabled = false;
    stopButton.disabled = false;
    beginTimer();
    draw();
  }

  function pauseGame() {
    if (gameState !== 'running') return;
    gameState = 'paused';
    setStatus('일시정지됨');
    setOverlay('일시정지', true);
    pauseButton.textContent = '계속하기';
    draw();
  }

  function resumeGame() {
    if (gameState !== 'paused') return;
    gameState = 'running';
    setStatus('플레이 중');
    setOverlay('', false);
    pauseButton.textContent = '일시정지';
    beginTimer();
    draw();
  }

  function restartGame() { clearTimer(); resetBoard(); gameState = 'ready'; startGame(); }

  function stopGame() {
    if (gameState === 'ready' || gameState === 'stopped') return;
    clearTimer();
    gameState = 'stopped';
    snake = [];
    setStatus('게임이 종료되었습니다.');
    setOverlay('종료됨', true);
    startButton.disabled = false;
    pauseButton.disabled = true;
    stopButton.disabled = true;
    draw();
  }

  function endGame(message) {
    clearTimer();
    gameState = 'over';
    snake = [];
    setStatus(message);
    setOverlay('GAME OVER', true);
    startButton.disabled = false;
    pauseButton.disabled = true;
    stopButton.disabled = true;
    if (score > highScore) { highScore = score; saveHighScore(); updateScore(); }
    draw();
  }

  function chooseEnemyDirection(enemy) {
    const choices = directionNames.map((name) => directions[name]);
    const shuffled = choices.sort(() => Math.random() - 0.5);
    return shuffled.find((candidate) => insideBoard({ x: enemy.x + candidate.x, y: enemy.y + candidate.y })) || enemy.direction;
  }

  function moveEnemies() {
    enemies = enemies.map((enemy) => {
      const nextDirection = chooseEnemyDirection(enemy);
      const next = { x: enemy.x + nextDirection.x, y: enemy.y + nextDirection.y, direction: nextDirection };
      return insideBoard(next) ? next : enemy;
    });
  }

  function collidedWithEnemy() { return snake.some((part) => enemies.some((enemy) => sameCell(part, enemy))); }

  function tick() {
    if (gameState !== 'running') return;
    direction = pendingDirection;
    const nextHead = { x: snake[0].x + direction.x, y: snake[0].y + direction.y };
    if (!insideBoard(nextHead) || snake.some((part) => sameCell(part, nextHead))) { endGame('충돌했습니다. 지렁이가 사라졌어요.'); return; }
    snake.unshift(nextHead);
    if (sameCell(nextHead, food)) { score += 1; if (score > highScore) { highScore = score; saveHighScore(); } food = randomFreeCell(); updateScore(); } else snake.pop();
    moveEnemies();
    if (collidedWithEnemy()) { endGame('적과 충돌했습니다. 지렁이가 사라졌어요.'); return; }
    draw();
  }

  function setDirection(name) {
    if (gameState !== 'running' || !directions[name]) return;
    const next = directions[name];
    if (next.x + direction.x === 0 && next.y + direction.y === 0) return;
    pendingDirection = next;
  }

  function drawCell(cell, color, inset = 2) {
    ctx.fillStyle = color;
    ctx.fillRect(cell.x * CELL_SIZE + inset, cell.y * CELL_SIZE + inset, CELL_SIZE - inset * 2, CELL_SIZE - inset * 2);
  }

  function draw() {
    ctx.fillStyle = '#102331';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#1d4552';
    ctx.lineWidth = 1;
    for (let x = 0; x <= COLUMNS; x += 1) { ctx.beginPath(); ctx.moveTo(x * CELL_SIZE, 0); ctx.lineTo(x * CELL_SIZE, canvas.height); ctx.stroke(); }
    for (let y = 0; y <= ROWS; y += 1) { ctx.beginPath(); ctx.moveTo(0, y * CELL_SIZE); ctx.lineTo(canvas.width, y * CELL_SIZE); ctx.stroke(); }
    if (food) drawCell(food, '#ffbf47', 3);
    enemies.forEach((enemy) => drawCell(enemy, '#ff6b8a', 3));
    snake.forEach((part, index) => drawCell(part, index === 0 ? '#eaffdf' : '#7be495', 2));
  }

  document.addEventListener('keydown', (event) => {
    const keyMap = { ArrowUp: 'up', w: 'up', W: 'up', ArrowDown: 'down', s: 'down', S: 'down', ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right' };
    if (keyMap[event.key]) { event.preventDefault(); setDirection(keyMap[event.key]); }
    if (event.key === ' ' || event.key === 'Spacebar') { event.preventDefault(); if (gameState === 'running') pauseGame(); else if (gameState === 'paused') resumeGame(); }
  });
  touchButtons.forEach((button) => button.addEventListener('click', () => setDirection(button.dataset.direction)));
  startButton.addEventListener('click', startGame);
  pauseButton.addEventListener('click', () => (gameState === 'paused' ? resumeGame() : pauseGame()));
  restartButton.addEventListener('click', restartGame);
  stopButton.addEventListener('click', stopGame);

  resetBoard();
  highScoreElement.textContent = String(highScore);
  window.__wormGame = { getState: () => gameState, getEnemyCount: () => enemies.length, getScore: () => score };
})();

(() => {
  try {
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');

    const screens = {
      home: document.getElementById('screen-home'),
      character: document.getElementById('screen-character'),
      game: document.getElementById('screen-game'),
      leaderboard: document.getElementById('screen-leaderboard'),
      settings: document.getElementById('screen-settings')
    };

    const hud = {
      lives: document.getElementById('hud-lives'),
      score: document.getElementById('hud-score'),
      coins: document.getElementById('hud-coins'),
      honey: document.getElementById('hud-honey'),
      distance: document.getElementById('hud-distance'),
      ability: document.getElementById('hud-ability')
    };

    const missionText = document.getElementById('mission-text');
    const missionProgress = document.getElementById('mission-progress');
    const errorBanner = document.getElementById('error-banner');
    const modalOverlay = document.getElementById('modal-overlay');
    const modalTitle = document.getElementById('modal-title');
    const modalContent = document.getElementById('modal-content');
    const modalActions = document.getElementById('modal-actions');
    const touchControls = document.getElementById('touch-controls');
    const leaderboardList = document.getElementById('leaderboardList');

    const settings = {
      sound: true,
      music: true,
      difficulty: 'normal',
      controls: 'keyboard'
    };

    const state = {
      screen: 'home',
      selectedCharacter: 'masha',
      activeLevelIndex: 0,
      running: false,
      paused: false,
      lastTime: 0,
      keys: {},
      touch: { left: false, right: false, jump: false, ability: false },
      jumpQueued: false,
      abilityQueued: false,
      collected: { flower: 0, honey: 0, apple: 0, star: 0, coin: 0 },
      particles: [],
      floatingTexts: [],
      generatedCollectibles: [],
      generatedObstacles: [],
      generatedEnemies: [],
      cameraX: 0,
      score: 0,
      coins: 0,
      honey: 0,
      lives: 3,
      distance: 0,
      totalStars: 0,
      missionComplete: false,
      bestScore: Number(localStorage.getItem('masha-bear-best-score') || '0'),
      achievedFinish: false,
      currentLevel: null,
      player: null,
      animationId: null
    };

    const difficultyMap = {
      easy: { lives: 4, moveSpeed: 4.5, gravity: 0.6, jumpForce: 13.8, enemySpeed: 1 },
      normal: { lives: 3, moveSpeed: 4.1, gravity: 0.7, jumpForce: 13.0, enemySpeed: 1.2 },
      hard: { lives: 3, moveSpeed: 3.7, gravity: 0.76, jumpForce: 12.6, enemySpeed: 1.5 }
    };

    const characters = {
      masha: {
        label: 'MASHA',
        ability: 'Double Jump',
        color: '#ff7ea8',
        accent: '#ffc0d4'
      },
      bear: {
        label: 'BEAR',
        ability: 'Power Smash',
        color: '#8e6c4c',
        accent: '#c39a6b'
      }
    };

    const CHARACTER_ASSET_PATHS = {
      masha: null,
      bear: null
    };
    const characterImages = {};
    Object.entries(CHARACTER_ASSET_PATHS).forEach(([name, path]) => {
      if (!path) return;
      const image = new Image();
      image.src = path;
      characterImages[name] = image;
    });

    const audioContext = window.AudioContext || window.webkitAudioContext;
    const soundReady = (() => {
      try {
        return !!audioContext;
      } catch (error) {
        return false;
      }
    })();
    let audioCtx = null;

    function showError(message) {
      errorBanner.textContent = message;
      errorBanner.classList.remove('hidden');
      setTimeout(() => errorBanner.classList.add('hidden'), 3600);
    }

    function ensureAudio() {
      if (!settings.sound || !soundReady) return null;
      if (!audioCtx) {
        audioCtx = new audioContext();
      }
      if (audioCtx.state === 'suspended') {
        audioCtx.resume();
      }
      return audioCtx;
    }

    function playTone(freq, duration, type = 'sine', gainValue = 0.03) {
      const ctxAudio = ensureAudio();
      if (!ctxAudio) return;
      const oscillator = ctxAudio.createOscillator();
      const gainNode = ctxAudio.createGain();
      oscillator.type = type;
      oscillator.frequency.value = freq;
      gainNode.gain.value = gainValue;
      oscillator.connect(gainNode);
      gainNode.connect(ctxAudio.destination);
      oscillator.start();
      oscillator.stop(ctxAudio.currentTime + duration);
    }

    function saveBestScore() {
      const previousBest = Number(localStorage.getItem('masha-bear-best-score') || '0');
      if (state.score > previousBest) {
        localStorage.setItem('masha-bear-best-score', String(state.score));
        state.bestScore = state.score;
      }
    }

    function reloadLeaderboard() {
      const raw = JSON.parse(localStorage.getItem('masha-bear-leaderboard') || '[]');
      const scores = Array.isArray(raw) ? raw : [];
      scores.sort((a, b) => Number(b.score) - Number(a.score));
      const topFive = scores.slice(0, 5);
      leaderboardList.replaceChildren();
      const entries = topFive.length ? topFive : [{ name: 'No scores yet', score: 0 }];
      entries.forEach((entry, index) => {
        const row = document.createElement('li');
        const place = document.createElement('span');
        const name = document.createElement('span');
        const score = document.createElement('span');
        place.textContent = topFive.length ? `${index + 1}.` : '—';
        name.textContent = String(entry.name || 'Player');
        score.textContent = String(Number(entry.score) || 0);
        row.append(place, name, score);
        leaderboardList.appendChild(row);
      });
    }

    function pushLeaderboardScore(name, score) {
      const raw = JSON.parse(localStorage.getItem('masha-bear-leaderboard') || '[]');
      const entries = Array.isArray(raw) ? raw : [];
      entries.push({ name: String(name || 'Player'), score: Number(score || 0) });
      entries.sort((a, b) => Number(b.score) - Number(a.score));
      localStorage.setItem('masha-bear-leaderboard', JSON.stringify(entries.slice(0, 10)));
      reloadLeaderboard();
    }

    function playerNameFieldMarkup() {
      return '<label class="score-name-label" for="score-player-name">Add your score to the leaderboard<input id="score-player-name" type="text" maxlength="18" autocomplete="nickname" placeholder="Player"></label>';
    }

    function saveCurrentScore(score) {
      const nameInput = document.getElementById('score-player-name');
      const name = nameInput?.value.trim() || localStorage.getItem('masha-bear-player-name') || 'Player';
      localStorage.setItem('masha-bear-player-name', name);
      pushLeaderboardScore(name, score);
    }

    function updateSettingsPanel() {
      const soundToggle = document.getElementById('sound-toggle');
      const musicToggle = document.getElementById('music-toggle');
      const difficultySelect = document.getElementById('difficultySelect');
      const controlsSelect = document.getElementById('controlsSelect');
      soundToggle.textContent = settings.sound ? 'ON' : 'OFF';
      soundToggle.classList.toggle('on', settings.sound);
      musicToggle.textContent = settings.music ? 'ON' : 'OFF';
      musicToggle.classList.toggle('on', settings.music);
      difficultySelect.value = settings.difficulty;
      controlsSelect.value = settings.controls;
      document.querySelector('.game-shell').classList.toggle('touch-preferred', settings.controls === 'touch');
    }

    function setScreen(name) {
      state.screen = name;
      Object.entries(screens).forEach(([key, element]) => {
        element.classList.toggle('hidden', key !== name);
      });
      touchControls.classList.toggle('hidden', name !== 'game');

      if (name === 'leaderboard') {
        reloadLeaderboard();
      }

      if (name === 'game') {
        canvas.focus?.();
      }
    }

    function resetGameValues() {
      state.score = 0;
      state.coins = 0;
      state.honey = 0;
      state.lives = difficultyMap[settings.difficulty].lives;
      state.distance = 0;
      state.totalStars = 0;
      state.collected = { flower: 0, honey: 0, apple: 0, star: 0, coin: 0 };
      state.particles = [];
      state.floatingTexts = [];
      state.missionComplete = false;
      state.achievedFinish = false;
    }

    function createPlayer() {
      const difficulty = difficultyMap[settings.difficulty];
      state.player = {
        x: 80,
        y: 120,
        width: 52,
        height: 68,
        velocityX: 0,
        velocityY: 0,
        onGround: false,
        jumpCount: 0,
        invincible: 0,
        facing: 1,
        abilityCooldown: 0,
        smashTimer: 0,
        walkCycle: 0,
        lastJumpTime: 0,
        speed: difficulty.moveSpeed,
        jumpForce: difficulty.jumpForce,
        gravity: difficulty.gravity
      };
    }

    const LEVELS = [
      {
        name: 'Sunny Forest',
        worldWidth: 3100,
        mission: { type: 'flower', target: 8, label: 'Collect 8 flowers', value: 10 },
        groundY: 440,
        finishX: 2860,
        skyTop: '#88dfff',
        skyBottom: '#dff7ff',
        collectibleList: [
          { type: 'flower', x: 250, y: 320 }, { type: 'flower', x: 430, y: 330 }, { type: 'flower', x: 620, y: 295 },
          { type: 'flower', x: 920, y: 360 }, { type: 'apple', x: 1180, y: 300 }, { type: 'coin', x: 1340, y: 360 },
          { type: 'flower', x: 1500, y: 315 }, { type: 'honey', x: 1730, y: 285 }, { type: 'flower', x: 1920, y: 295 },
          { type: 'flower', x: 2140, y: 330 }, { type: 'star', x: 2300, y: 280 }, { type: 'coin', x: 2480, y: 340 },
          { type: 'flower', x: 2650, y: 310 }, { type: 'apple', x: 2840, y: 300 }
        ],
        obstacleList: [
          { x: 500, y: 426, width: 78, height: 42, type: 'rock', breakable: false },
          { x: 870, y: 417, width: 90, height: 52, type: 'log', breakable: false },
          { x: 1220, y: 422, width: 86, height: 48, type: 'rock', breakable: false },
          { x: 1870, y: 424, width: 110, height: 46, type: 'branch', breakable: false },
          { x: 2140, y: 422, width: 82, height: 48, type: 'rock', breakable: true },
          { x: 2520, y: 420, width: 90, height: 50, type: 'log', breakable: false }
        ],
        enemyList: [
          { x: 1030, y: 388, width: 30, height: 22, type: 'bee', direction: 1 },
          { x: 2080, y: 390, width: 28, height: 20, type: 'bee', direction: -1 },
          { x: 2760, y: 392, width: 30, height: 20, type: 'bee', direction: 1 }
        ]
      },
      {
        name: 'Flower Valley',
        worldWidth: 3400,
        mission: { type: 'honey', target: 3, label: 'Collect 3 honey jars', value: 100 },
        groundY: 440,
        finishX: 3150,
        skyTop: '#8ed5c1',
        skyBottom: '#eefcf4',
        collectibleList: [
          { type: 'flower', x: 240, y: 325 }, { type: 'flower', x: 420, y: 330 }, { type: 'honey', x: 640, y: 290 },
          { type: 'coin', x: 820, y: 330 }, { type: 'flower', x: 1040, y: 320 }, { type: 'apple', x: 1220, y: 310 },
          { type: 'flower', x: 1380, y: 315 }, { type: 'honey', x: 1600, y: 290 }, { type: 'star', x: 1820, y: 270 },
          { type: 'flower', x: 2050, y: 330 }, { type: 'coin', x: 2280, y: 340 }, { type: 'honey', x: 2500, y: 280 },
          { type: 'flower', x: 2700, y: 315 }, { type: 'apple', x: 2930, y: 310 }, { type: 'coin', x: 3100, y: 335 }
        ],
        obstacleList: [
          { x: 610, y: 424, width: 100, height: 46, type: 'rock', breakable: false },
          { x: 1180, y: 422, width: 118, height: 42, type: 'branch', breakable: false },
          { x: 1660, y: 420, width: 138, height: 48, type: 'log', breakable: false },
          { x: 2240, y: 424, width: 106, height: 44, type: 'rock', breakable: true },
          { x: 2800, y: 420, width: 124, height: 52, type: 'branch', breakable: false }
        ],
        enemyList: [
          { x: 900, y: 390, width: 34, height: 24, type: 'bird', direction: -1 },
          { x: 1820, y: 392, width: 34, height: 22, type: 'bird', direction: 1 },
          { x: 2980, y: 392, width: 32, height: 22, type: 'bird', direction: -1 }
        ]
      },
      {
        name: 'River Bridge',
        worldWidth: 3650,
        mission: { type: 'coin', target: 5, label: 'Collect 5 coins', value: 5 },
        groundY: 440,
        finishX: 3380,
        skyTop: '#7ec2ff',
        skyBottom: '#d9f5ff',
        collectibleList: [
          { type: 'coin', x: 180, y: 335 }, { type: 'flower', x: 420, y: 330 }, { type: 'apple', x: 650, y: 315 },
          { type: 'coin', x: 900, y: 325 }, { type: 'honey', x: 1120, y: 285 }, { type: 'flower', x: 1380, y: 335 },
          { type: 'coin', x: 1600, y: 330 }, { type: 'star', x: 1860, y: 270 }, { type: 'apple', x: 2140, y: 315 },
          { type: 'coin', x: 2400, y: 335 }, { type: 'honey', x: 2680, y: 285 }, { type: 'flower', x: 2920, y: 325 },
          { type: 'coin', x: 3180, y: 335 }, { type: 'apple', x: 3340, y: 315 }
        ],
        obstacleList: [
          { x: 510, y: 424, width: 86, height: 50, type: 'rock', breakable: false },
          { x: 980, y: 422, width: 120, height: 48, type: 'log', breakable: false },
          { x: 1560, y: 424, width: 102, height: 46, type: 'branch', breakable: false },
          { x: 2280, y: 424, width: 92, height: 46, type: 'rock', breakable: true },
          { x: 2860, y: 420, width: 138, height: 50, type: 'branch', breakable: false }
        ],
        enemyList: [
          { x: 680, y: 392, width: 30, height: 24, type: 'bee', direction: 1 },
          { x: 2050, y: 390, width: 34, height: 24, type: 'bird', direction: -1 },
          { x: 2990, y: 392, width: 30, height: 22, type: 'bee', direction: -1 }
        ]
      },
      {
        name: 'Deep Forest',
        worldWidth: 3900,
        mission: { type: 'star', target: 3, label: 'Collect 3 stars', value: 50 },
        groundY: 440,
        finishX: 3640,
        skyTop: '#80d4ff',
        skyBottom: '#ebfdff',
        collectibleList: [
          { type: 'flower', x: 250, y: 320 }, { type: 'star', x: 540, y: 280 }, { type: 'apple', x: 790, y: 305 },
          { type: 'honey', x: 990, y: 285 }, { type: 'flower', x: 1270, y: 320 }, { type: 'coin', x: 1460, y: 338 },
          { type: 'star', x: 1740, y: 270 }, { type: 'flower', x: 1980, y: 332 }, { type: 'apple', x: 2220, y: 310 },
          { type: 'coin', x: 2480, y: 340 }, { type: 'flower', x: 2770, y: 320 }, { type: 'star', x: 3030, y: 280 },
          { type: 'honey', x: 3260, y: 285 }, { type: 'coin', x: 3510, y: 340 }, { type: 'apple', x: 3730, y: 310 }
        ],
        obstacleList: [
          { x: 710, y: 424, width: 100, height: 48, type: 'rock', breakable: false },
          { x: 1220, y: 420, width: 130, height: 50, type: 'branch', breakable: true },
          { x: 1770, y: 420, width: 118, height: 52, type: 'log', breakable: false },
          { x: 2450, y: 424, width: 102, height: 50, type: 'rock', breakable: false },
          { x: 3090, y: 420, width: 128, height: 52, type: 'branch', breakable: true },
          { x: 3500, y: 420, width: 112, height: 48, type: 'log', breakable: false }
        ],
        enemyList: [
          { x: 820, y: 390, width: 34, height: 24, type: 'bee', direction: 1 },
          { x: 1960, y: 392, width: 32, height: 22, type: 'bird', direction: -1 },
          { x: 2870, y: 388, width: 34, height: 24, type: 'bee', direction: 1 },
          { x: 3380, y: 392, width: 34, height: 22, type: 'bird', direction: -1 }
        ]
      },
      {
        name: "Bear's Cabin Adventure",
        worldWidth: 4200,
        mission: { type: 'apple', target: 5, label: 'Collect 5 apples', value: 20 },
        groundY: 440,
        finishX: 3920,
        skyTop: '#91d6f7',
        skyBottom: '#ebfef6',
        collectibleList: [
          { type: 'apple', x: 250, y: 315 }, { type: 'flower', x: 470, y: 330 }, { type: 'coin', x: 760, y: 330 },
          { type: 'apple', x: 1010, y: 315 }, { type: 'honey', x: 1300, y: 282 }, { type: 'star', x: 1570, y: 270 },
          { type: 'apple', x: 1850, y: 310 }, { type: 'coin', x: 2140, y: 340 }, { type: 'flower', x: 2450, y: 328 },
          { type: 'apple', x: 2720, y: 300 }, { type: 'honey', x: 2950, y: 285 }, { type: 'star', x: 3240, y: 275 },
          { type: 'apple', x: 3510, y: 310 }, { type: 'coin', x: 3730, y: 340 }, { type: 'flower', x: 4000, y: 326 }
        ],
        obstacleList: [
          { x: 640, y: 424, width: 96, height: 48, type: 'rock', breakable: true },
          { x: 1090, y: 420, width: 116, height: 52, type: 'log', breakable: false },
          { x: 1780, y: 422, width: 132, height: 52, type: 'branch', breakable: false },
          { x: 2520, y: 424, width: 102, height: 48, type: 'rock', breakable: true },
          { x: 3150, y: 420, width: 138, height: 52, type: 'branch', breakable: false },
          { x: 3680, y: 423, width: 110, height: 48, type: 'log', breakable: false }
        ],
        enemyList: [
          { x: 1230, y: 394, width: 32, height: 24, type: 'bee', direction: -1 },
          { x: 2060, y: 392, width: 36, height: 24, type: 'bird', direction: 1 },
          { x: 2850, y: 392, width: 34, height: 24, type: 'bee', direction: 1 },
          { x: 3540, y: 392, width: 36, height: 24, type: 'bird', direction: -1 }
        ]
      }
    ];

    function makeLevel(index) {
      return LEVELS[index] || LEVELS[0];
    }

    function createWorld(levelIndex) {
      const level = makeLevel(levelIndex);
      state.currentLevel = level;
      state.cameraX = 0;
      state.player.x = 80;
      state.player.y = level.groundY - state.player.height;
      state.player.velocityY = 0;
      state.player.onGround = true;
      state.player.jumpCount = 0;
      state.player.smashTimer = 0;
      state.player.abilityCooldown = 0;
      state.generatedCollectibles = level.collectibleList.map((item) => ({ ...item, picked: false, bob: Math.random() * 1000 }));
      state.generatedObstacles = level.obstacleList.map((item) => ({ ...item, broken: false }));
      state.generatedEnemies = level.enemyList.map((enemy) => ({ ...enemy, baseX: enemy.x, phase: Math.random() * 100 }));
      state.achievedFinish = false;
      state.missionComplete = false;
      state.player.abilityCooldown = 0;
      syncMissionUI();
      updateHud();
      return level;
    }

    function syncMissionUI() {
      const current = state.currentLevel.mission;
      let progressValue = 0;
      const collectedCount = state.collected[current.type] || 0;
      progressValue = Math.min(100, (collectedCount / current.target) * 100);
      missionText.textContent = current.label;
      missionProgress.style.width = `${progressValue}%`;
      if (collectedCount >= current.target) {
        state.missionComplete = true;
      }
    }

    function updateHud() {
      hud.lives.textContent = state.lives;
      hud.score.textContent = state.score;
      hud.coins.textContent = state.coins;
      hud.honey.textContent = state.honey;
      hud.distance.textContent = `${Math.max(0, Math.floor(state.distance))}m`;
      const playerState = characters[state.selectedCharacter];
      if (state.player && state.player.abilityCooldown > 0) {
        hud.ability.textContent = `COOLDOWN: ${Math.ceil(state.player.abilityCooldown)}s`;
      } else if (state.selectedCharacter === 'masha') {
        hud.ability.textContent = 'DOUBLE JUMP';
      } else {
        hud.ability.textContent = 'ABILITY READY';
      }
      hud.ability.style.color = state.selectedCharacter === 'bear' ? '#5b4a14' : '#4d3363';
    }

    function showModal(config) {
      modalTitle.textContent = config.title;
      modalContent.innerHTML = config.content || '';
      modalActions.innerHTML = '';
      config.buttons.forEach((button) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = button.className || 'action-btn accent';
        btn.textContent = button.label;
        btn.addEventListener('click', button.onClick);
        modalActions.appendChild(btn);
      });
      modalOverlay.classList.remove('hidden');
    }

    function hideModal() {
      modalOverlay.classList.add('hidden');
      modalActions.innerHTML = '';
    }

    function startLevel(levelIndex) {
      resetGameValues();
      state.activeLevelIndex = levelIndex;
      createPlayer();
      state.currentLevel = createWorld(levelIndex);
      state.running = true;
      state.paused = false;
      hideModal();
      setScreen('game');
      updateHud();
    }

    function loseLife(reason = 'You hit a stump!') {
      if (state.player.invincible > 0) return;
      state.lives -= 1;
      state.player.invincible = 1.3;
      state.player.x = Math.max(80, state.player.x - 80);
      state.player.velocityY = -8;
      playTone(220, 0.12, 'square', 0.05);
      state.floatingTexts.push({ text: '-1 LIFE', x: state.player.x + 18, y: state.player.y - 28, color: '#ff5c6d' });
      if (state.lives <= 0) {
        renderGameOver();
      }
      updateHud();
    }

    function handleCollectible(item) {
      if (item.picked) return;
      item.picked = true;
      const valueMap = {
        flower: { points: 10, label: '+10', color: '#ffd966' },
        apple: { points: 20, label: '+20', color: '#ff9a5f' },
        star: { points: 50, label: '+50', color: '#ffe267' },
        honey: { points: 100, label: '+100', color: '#f8b700' },
        coin: { points: 5, label: '+5', color: '#ffd74c' }
      };
      const entry = valueMap[item.type] || { points: 10, label: '+10', color: '#ffd966' };
      state.score += entry.points;
      state.collected[item.type] = (state.collected[item.type] || 0) + 1;
      if (item.type === 'coin') state.coins += 1;
      if (item.type === 'honey') state.honey += 1;
      if (item.type === 'star') state.totalStars += 1;
      state.floatingTexts.push({ text: entry.label, x: item.x, y: item.y - 18, color: entry.color });
      state.particles.push({ x: item.x, y: item.y, radius: 5, dx: (Math.random() - 0.5) * 4, dy: -1.6, life: 30, color: entry.color });
      playTone(700 + Math.random() * 160, 0.08, 'triangle', 0.04);
      syncMissionUI();
      updateHud();
    }

    function handleObstacleCollision(obstacle) {
      if (state.selectedCharacter === 'bear' && obstacle.breakable && state.player.smashTimer > 0) {
        obstacle.broken = true;
        state.score += 25;
        state.floatingTexts.push({ text: '+25', x: obstacle.x + 20, y: obstacle.y - 18, color: '#7cd66b' });
        playTone(420, 0.12, 'sawtooth', 0.04);
        return;
      }
      loseLife('A stump got in the way!');
    }

    function renderGameOver() {
      state.running = false;
      saveBestScore();
      playTone(120, 0.2, 'sawtooth', 0.05);
      showModal({
        title: 'GAME OVER',
        content: `<div>Your Score: <strong>${state.score}</strong></div><div>Coins: <strong>${state.coins}</strong></div><div>Best Score: <strong>${state.bestScore}</strong></div>${playerNameFieldMarkup()}`,
        buttons: [
          { label: '🔄 SAVE & TRY AGAIN', className: 'action-btn primary', onClick: () => { saveCurrentScore(state.score); hideModal(); startLevel(state.activeLevelIndex); } },
          { label: '🏠 SAVE & HOME', className: 'action-btn accent', onClick: () => { saveCurrentScore(state.score); hideModal(); setScreen('home'); } }
        ]
      });
    }

    function completeLevel() {
      state.running = false;
      playTone(650, 0.12, 'triangle', 0.04);
      state.achievedFinish = true;
      const current = state.currentLevel;
      const summary = `Level ${state.activeLevelIndex + 1}: ${current.name}`;
      const scoreEarned = state.score;
      saveBestScore();
      const nextLevel = state.activeLevelIndex + 1;
      showModal({
        title: 'LEVEL COMPLETE!',
        content: `<div>${summary}</div><div>Score: <strong>${state.score}</strong></div><div>Coins: <strong>${state.coins}</strong></div><div>Stars: <strong>${state.totalStars}</strong></div><div>Time: <strong>${Math.max(0, Math.ceil(state.distance / 8))}s</strong></div><div>Lives remaining: <strong>${state.lives}</strong></div>${playerNameFieldMarkup()}`,
        buttons: [
          { label: nextLevel < LEVELS.length ? 'NEXT LEVEL' : 'PLAY AGAIN', className: 'action-btn primary', onClick: () => {
              saveCurrentScore(scoreEarned);
              hideModal();
              if (nextLevel < LEVELS.length) {
                startLevel(nextLevel);
              } else {
                startLevel(0);
              }
            } },
          { label: 'REPLAY', className: 'action-btn accent', onClick: () => { saveCurrentScore(scoreEarned); hideModal(); startLevel(state.activeLevelIndex); } },
          { label: 'HOME', className: 'action-btn accent', onClick: () => { saveCurrentScore(scoreEarned); hideModal(); setScreen('home'); } }
        ]
      });
    }

    function updatePlayer(dt) {
      const difficulty = difficultyMap[settings.difficulty];
      const player = state.player;
      const runLeft = state.keys.ArrowLeft || state.keys.a || state.keys.A || state.touch.left;
      const runRight = state.keys.ArrowRight || state.keys.d || state.keys.D || state.touch.right;
      const previousX = player.x;
      if (runLeft && !runRight) {
        player.velocityX = -player.speed;
        player.facing = -1;
      } else if (runRight && !runLeft) {
        player.velocityX = player.speed;
        player.facing = 1;
      } else {
        player.velocityX *= 0.76;
        if (Math.abs(player.velocityX) < 0.1) player.velocityX = 0;
      }

      const jumpPressed = state.keys[' '] || state.touch.jump || state.jumpQueued;
      if (jumpPressed && !state.jumpConsumed) {
        if (player.onGround) {
          player.velocityY = -player.jumpForce;
          player.onGround = false;
          player.jumpCount = 1;
          playTone(260, 0.08, 'square', 0.04);
        } else if (state.selectedCharacter === 'masha' && player.jumpCount < 2) {
          player.velocityY = -player.jumpForce * 0.96;
          player.jumpCount += 1;
          playTone(380, 0.08, 'triangle', 0.05);
        }

        if (state.selectedCharacter === 'bear' && state.keys.E) {
          activatePowerSmash();
        }
        state.jumpConsumed = true;
      }
      state.jumpQueued = false;

      if (!jumpPressed) {
        state.jumpConsumed = false;
      }

      if (state.keys.E || state.touch.ability || state.abilityQueued) {
        activatePowerSmash();
      }
      state.abilityQueued = false;

      if (state.player.abilityCooldown > 0) {
        player.abilityCooldown = Math.max(0, player.abilityCooldown - dt);
      }

      if (player.smashTimer > 0) {
        player.smashTimer = Math.max(0, player.smashTimer - dt);
      }

      if (player.invincible > 0) {
        player.invincible = Math.max(0, player.invincible - dt);
      }

      player.velocityY += player.gravity * dt * 60;
      player.x += player.velocityX * dt * 60;
      player.y += player.velocityY * dt * 60;

      const groundY = state.currentLevel.groundY;
      if (player.y + player.height >= groundY) {
        player.y = groundY - player.height;
        player.velocityY = 0;
        player.onGround = true;
        player.jumpCount = 0;
      } else {
        player.onGround = false;
      }

      if (player.x < 40) player.x = 40;
      if (player.x + player.width > state.currentLevel.worldWidth - 30) {
        player.x = state.currentLevel.worldWidth - player.width - 30;
      }

      state.cameraX = Math.max(0, Math.min(player.x - canvas.width * 0.35, state.currentLevel.worldWidth - canvas.width));
      state.distance = Math.max(state.distance, (player.x - 80) / 8);

      const obstacleCollision = state.generatedObstacles.some((obstacle) => {
        if (obstacle.broken) return false;
        const hitBoxX = obstacle.x;
        const hitBoxY = state.currentLevel.groundY - obstacle.height;
        const overlapsX = player.x + player.width > hitBoxX && player.x < hitBoxX + obstacle.width;
        const overlapsY = player.y + player.height > hitBoxY + 2 && player.y < state.currentLevel.groundY;
        if (overlapsX && overlapsY) {
          handleObstacleCollision(obstacle);
          return true;
        }
        return false;
      });

      if (obstacleCollision) {
        player.x = previousX;
        player.velocityX = 0;
      }

      state.generatedEnemies.forEach((enemy) => {
        enemy.x += enemy.direction * difficulty.enemySpeed * dt * 60;
        if (enemy.x < enemy.baseX - 80 || enemy.x > enemy.baseX + 80) {
          enemy.direction *= -1;
        }

        const overlapX = player.x + player.width > enemy.x && player.x < enemy.x + enemy.width;
        const overlapY = player.y + player.height > enemy.y && player.y < enemy.y + enemy.height;
        if (overlapX && overlapY) {
          loseLife('Buzzy buddy bumped you!');
          enemy.x = enemy.baseX;
        }
      });

      state.generatedCollectibles.forEach((item) => {
        if (item.picked) return;
        const overlapX = player.x + player.width > item.x && player.x < item.x + 18;
        const overlapY = player.y + player.height > item.y && player.y < item.y + 18;
        if (overlapX && overlapY) {
          handleCollectible(item);
        }
      });

      if (!state.achievedFinish && player.x >= state.currentLevel.finishX) {
        if (state.missionComplete) {
          state.achievedFinish = true;
          completeLevel();
        } else {
          state.floatingTexts.push({ text: 'MISSION NOT DONE', x: player.x + 18, y: player.y - 18, color: '#ff8c69' });
          player.x = Math.max(10, player.x - 10);
        }
      }

      if (player.y > canvas.height + 120) {
        loseLife('You fell into the forest!');
        player.x = 80;
        player.y = state.currentLevel.groundY - player.height;
        player.velocityY = 0;
        player.onGround = true;
      }

      updateHud();
    }

    function activatePowerSmash() {
      const player = state.player;
      if (state.selectedCharacter !== 'bear' || player.abilityCooldown > 0 || player.smashTimer > 0) {
        return;
      }
      player.smashTimer = 0.8;
      player.abilityCooldown = 3;
      state.generatedObstacles.forEach((obstacle) => {
        if (!obstacle.broken && obstacle.breakable && Math.abs(obstacle.x - player.x) < 125) {
          obstacle.broken = true;
          state.score += 25;
          state.floatingTexts.push({ text: '+25', x: obstacle.x + 20, y: obstacle.y - 20, color: '#7ddf6d' });
        }
      });
      playTone(150, 0.11, 'sawtooth', 0.06);
      updateHud();
    }

    function updateParticles(dt) {
      state.particles = state.particles.filter((particle) => {
        particle.x += particle.dx * dt * 60;
        particle.y += particle.dy * dt * 60;
        particle.life -= 1;
        particle.dy += 0.08;
        return particle.life > 0;
      });

      state.floatingTexts = state.floatingTexts.filter((note) => {
        note.y -= 0.8;
        note.life = (note.life || 42) - 1;
        return note.life > 0;
      });
    }

    function drawBackground() {
      const level = state.currentLevel;
      const sky = ctx.createLinearGradient(0, 0, 0, canvas.height);
      sky.addColorStop(0, level.skyTop);
      sky.addColorStop(1, level.skyBottom);
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = 'rgba(255, 211, 92, 0.9)';
      ctx.beginPath();
      ctx.arc(canvas.width - 110, 95, 44, 0, Math.PI * 2);
      ctx.fill();

      for (let i = 0; i < 5; i++) {
        const cloudX = ((i * 180) - (state.cameraX * 0.2)) % (canvas.width + 220) - 80;
        const cloudY = 60 + (i % 2) * 36;
        ctx.fillStyle = 'rgba(255,255,255,0.76)';
        ctx.beginPath();
        ctx.arc(cloudX, cloudY, 22, 0, Math.PI * 2);
        ctx.arc(cloudX + 22, cloudY - 8, 20, 0, Math.PI * 2);
        ctx.arc(cloudX + 50, cloudY, 24, 0, Math.PI * 2);
        ctx.fill();
      }

      const mountainColors = ['#b7d9a8', '#9cc28d', '#7fb577'];
      mountainColors.forEach((color, idx) => {
        ctx.fillStyle = color;
        const base = canvas.width * (idx + 1) / 3 - (state.cameraX * 0.12);
        ctx.beginPath();
        ctx.moveTo(base - 150, canvas.height);
        ctx.lineTo(base, 220 + idx * 35, 0);
        ctx.lineTo(base + 160, canvas.height);
        ctx.closePath();
        ctx.fill();
      });

      ctx.fillStyle = '#7ac85c';
      ctx.fillRect(0, 440, canvas.width, canvas.height - 440);
      ctx.fillStyle = '#4da957';
      for (let i = 0; i < 30; i++) {
        const x = ((i * 80) - (state.cameraX * 0.8)) % (canvas.width + 80);
        const y = 440 + (i % 3) * 18;
        ctx.fillRect(x, y, 12, 18);
      }

      for (const item of state.generatedCollectibles) {
        if (item.picked) continue;
        const drawX = item.x - state.cameraX;
        if (drawX < -30 || drawX > canvas.width + 30) continue;
        if (item.type === 'flower') {
          ctx.fillStyle = '#f8d75f';
          ctx.beginPath(); ctx.arc(drawX, item.y - 4, 6, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#57bf6a';
          ctx.fillRect(drawX, item.y, 2, 18);
        } else if (item.type === 'apple') {
          ctx.fillStyle = '#ff5f54';
          ctx.beginPath(); ctx.arc(drawX, item.y, 9, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#5ebc5b';
          ctx.fillRect(drawX, item.y + 8, 3, 8);
        } else if (item.type === 'coin') {
          ctx.fillStyle = '#ffcf3f';
          ctx.beginPath(); ctx.arc(drawX, item.y, 9, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = '#fff0a7'; ctx.lineWidth = 2; ctx.stroke();
        } else if (item.type === 'honey') {
          ctx.fillStyle = '#f9bd33';
          ctx.fillRect(drawX - 6, item.y - 8, 12, 16);
          ctx.fillStyle = '#fff3a2';
          ctx.fillRect(drawX - 3, item.y - 11, 6, 6);
        } else if (item.type === 'star') {
          ctx.fillStyle = '#ffd86c';
          ctx.beginPath();
          for (let i = 0; i < 5; i++) {
            const angle = (Math.PI / 180) * (i * 72 - 90);
            ctx.lineTo(drawX + Math.cos(angle) * 9, item.y + Math.sin(angle) * 9);
          }
          ctx.closePath(); ctx.fill();
        }
      }

      state.generatedObstacles.forEach((obstacle) => {
        if (obstacle.broken) return;
        const x = obstacle.x - state.cameraX;
        if (x < -80 || x > canvas.width + 80) return;
        const y = state.currentLevel.groundY - obstacle.height;
        if (obstacle.type === 'rock') {
          ctx.fillStyle = '#8d8d93';
          ctx.beginPath();
          ctx.moveTo(x + 4, y + obstacle.height);
          ctx.lineTo(x + 10, y + 12);
          ctx.lineTo(x + obstacle.width * 0.45, y);
          ctx.lineTo(x + obstacle.width - 6, y + 13);
          ctx.lineTo(x + obstacle.width, y + obstacle.height);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,0.24)';
          ctx.beginPath();
          ctx.ellipse(x + obstacle.width * 0.42, y + obstacle.height * 0.38, 9, 5, -0.3, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillStyle = obstacle.type === 'log' ? '#a77b42' : '#9b7d4c';
          ctx.beginPath();
          ctx.roundRect(x, y + 5, obstacle.width, obstacle.height - 5, 12);
          ctx.fill();
          ctx.strokeStyle = 'rgba(255,238,183,0.45)';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(x + 14, y + 13);
          ctx.lineTo(x + obstacle.width - 12, y + obstacle.height - 12);
          ctx.stroke();
        }
      });

      state.generatedEnemies.forEach((enemy) => {
        const x = enemy.x - state.cameraX;
        if (x < -60 || x > canvas.width + 60) return;
        if (enemy.type === 'bee') {
          ctx.fillStyle = '#f6d970';
          ctx.beginPath();
          ctx.ellipse(x + 18, enemy.y + 10, 18, 12, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#2d1d1b';
          ctx.fillRect(x + 5, enemy.y + 12, 8, 2);
          ctx.fillRect(x + 28, enemy.y + 12, 8, 2);
        } else {
          ctx.fillStyle = '#9d7df3';
          ctx.beginPath(); ctx.arc(x + 16, enemy.y + 12, 13, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#48318a';
          ctx.fillRect(x + 8, enemy.y + 18, 16, 4);
        }
      });

      const finishX = state.currentLevel.finishX - state.cameraX;
      ctx.fillStyle = '#ffb74d';
      ctx.fillRect(finishX, 360, 10, 80);
      ctx.fillStyle = '#e4753a';
      ctx.beginPath();
      ctx.moveTo(finishX + 10, 360);
      ctx.lineTo(finishX + 70, 370);
      ctx.lineTo(finishX + 10, 395);
      ctx.closePath();
      ctx.fill();
    }

    function drawPlayer() {
      const player = state.player;
      const drawX = Math.round(player.x - state.cameraX);
      const drawY = Math.round(player.y);
      const isMasha = state.selectedCharacter === 'masha';
      const image = characterImages[state.selectedCharacter];
      const bob = player.onGround && Math.abs(player.velocityX) > 0.5
        ? Math.sin(performance.now() * 0.018) * 2
        : 0;
      const stride = player.onGround ? Math.sin(performance.now() * 0.018) * 3 : 0;

      ctx.save();
      ctx.translate(drawX + player.width / 2, drawY + bob);
      ctx.scale(player.facing, 1);
      ctx.translate(-player.width / 2, 0);

      if (player.invincible > 0 && Math.floor(player.invincible * 10) % 2 === 0) {
        ctx.globalAlpha = 0.55;
      }

      if (image && image.complete && image.naturalWidth > 0) {
        ctx.drawImage(image, 0, 0, player.width, player.height);
        ctx.restore();
        return;
      }

      if (isMasha) {
        ctx.fillStyle = 'rgba(35,61,55,0.18)';
        ctx.beginPath();
        ctx.ellipse(26, 67, 22, 5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#6f543e';
        ctx.beginPath();
        ctx.ellipse(10, 25, 6, 11, -0.2, 0, Math.PI * 2);
        ctx.ellipse(42, 25, 6, 11, 0.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#f4c9a5';
        ctx.beginPath();
        ctx.ellipse(26, 27, 16, 18, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff5e7';
        ctx.beginPath();
        ctx.arc(20, 28, 4, 0, Math.PI * 2);
        ctx.arc(32, 28, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#392d37';
        ctx.beginPath();
        ctx.arc(21, 28, 2, 0, Math.PI * 2);
        ctx.arc(31, 28, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#d97862';
        ctx.beginPath();
        ctx.arc(26, 35, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#db4d50';
        ctx.beginPath();
        ctx.moveTo(9, 19);
        ctx.quadraticCurveTo(26, -3, 43, 19);
        ctx.lineTo(41, 24);
        ctx.quadraticCurveTo(26, 14, 11, 24);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#f5bf56';
        ctx.beginPath();
        ctx.arc(26, 13, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#458b72';
        ctx.beginPath();
        ctx.roundRect(9, 43, 34, 21, 9);
        ctx.fill();
        ctx.fillStyle = '#f5bf56';
        ctx.fillRect(18, 46, 16, 3);
        ctx.fillStyle = '#805746';
        ctx.beginPath();
        ctx.roundRect(12, 61, 11, 8 + Math.max(0, stride), 4);
        ctx.roundRect(29, 61, 11, 8 + Math.max(0, -stride), 4);
        ctx.fill();
        ctx.fillStyle = '#f8eee0';
        ctx.beginPath();
        ctx.ellipse(12, 69 + Math.max(0, stride), 8, 3, 0, 0, Math.PI * 2);
        ctx.ellipse(35, 69 + Math.max(0, -stride), 8, 3, 0, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = 'rgba(35,61,55,0.18)';
        ctx.beginPath();
        ctx.ellipse(26, 67, 25, 6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#845638';
        ctx.beginPath();
        ctx.arc(12, 13, 9, 0, Math.PI * 2);
        ctx.arc(40, 13, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#d0a174';
        ctx.beginPath();
        ctx.arc(12, 13, 4, 0, Math.PI * 2);
        ctx.arc(40, 13, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#926544';
        ctx.beginPath();
        ctx.ellipse(26, 27, 21, 22, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#f1d6aa';
        ctx.beginPath();
        ctx.ellipse(26, 34, 12, 9, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#2e2523';
        ctx.beginPath();
        ctx.arc(20, 25, 2.5, 0, Math.PI * 2);
        ctx.arc(32, 25, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(26, 31, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#654735';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(26, 34, 5, 0.2, Math.PI - 0.2);
        ctx.stroke();
        ctx.fillStyle = '#95694a';
        ctx.beginPath();
        ctx.ellipse(26, 52, 23, 18, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#b98a62';
        ctx.beginPath();
        ctx.ellipse(26, 52, 10, 12, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#754b35';
        ctx.beginPath();
        ctx.roundRect(8, 61, 15, 9 + Math.max(0, stride), 6);
        ctx.roundRect(29, 61, 15, 9 + Math.max(0, -stride), 6);
        ctx.fill();
      }

      ctx.restore();
    }

    function drawFloatingTexts() {
      state.floatingTexts.forEach((note) => {
        ctx.fillStyle = note.color;
        ctx.font = 'bold 20px Segoe UI';
        ctx.fillText(note.text, note.x - state.cameraX, note.y);
      });
    }

    function drawParticles() {
      state.particles.forEach((particle) => {
        ctx.fillStyle = particle.color;
        ctx.beginPath();
        ctx.arc(particle.x - state.cameraX, particle.y, particle.radius, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    function update(dt) {
      if (!state.running || state.paused) return;
      updatePlayer(dt);
      updateParticles(dt);
      updateHud();
    }

    function render() {
      drawBackground();
      drawParticles();
      drawPlayer();
      drawFloatingTexts();
      if (state.currentLevel && state.player) {
        ctx.fillStyle = '#223954';
        ctx.font = 'bold 18px Segoe UI';
        ctx.fillText(state.currentLevel.name, 18, 32);
      }
    }

    function gameLoop(timestamp) {
      if (!state.lastTime) state.lastTime = timestamp;
      const dt = Math.min(1.5, (timestamp - state.lastTime) / 1000 || 0.016);
      state.lastTime = timestamp;
      update(dt);
      render();
      state.animationId = requestAnimationFrame(gameLoop);
    }

    document.addEventListener('keydown', (event) => {
      if (event.repeat && (event.key === 'p' || event.key === 'P')) return;
      if (event.key === 'p' || event.key === 'P') {
        togglePause();
        return;
      }
      if (event.key === 'e' || event.key === 'E') {
        state.keys.E = true;
      }
      if (event.key === ' ') {
        event.preventDefault();
      }
      state.keys[event.key] = true;
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight' || event.key === ' ') {
        event.preventDefault();
      }
    });

    document.addEventListener('keyup', (event) => {
      if (event.key === 'e' || event.key === 'E') {
        state.keys.E = false;
      }
      state.keys[event.key] = false;
    });

    window.addEventListener('blur', () => {
      state.keys = {};
      state.touch = { left: false, right: false, jump: false, ability: false };
      state.jumpConsumed = false;
      state.jumpQueued = false;
      state.abilityQueued = false;
    });

    function togglePause() {
      if (state.screen !== 'game' || !state.running) return;
      state.paused = !state.paused;
      if (state.paused) {
        showModal({
          title: 'PAUSED',
          content: '<div>Take a breather and continue when ready.</div>',
          buttons: [
            { label: '▶ RESUME', className: 'action-btn primary', onClick: () => { hideModal(); state.paused = false; } },
            { label: '🔄 RESTART', className: 'action-btn accent', onClick: () => { hideModal(); startLevel(state.activeLevelIndex); } },
            { label: '⚙ SETTINGS', className: 'action-btn accent', onClick: () => { hideModal(); setScreen('settings'); } },
            { label: '🏠 HOME', className: 'action-btn accent', onClick: () => { hideModal(); state.paused = false; state.running = false; setScreen('home'); } }
          ]
        });
      } else {
        hideModal();
      }
    }

    function attachGlobalButtons() {
      document.querySelectorAll('[data-action]').forEach((button) => {
        button.addEventListener('click', () => {
          const action = button.dataset.action;
          if (action === 'play') {
            setScreen('character');
          }
          if (action === 'leaderboard') {
            setScreen('leaderboard');
          }
          if (action === 'settings') {
            setScreen('settings');
          }
          if (action === 'how-to-play') {
            showModal({
              title: 'HOW TO PLAY',
              content: '<div>Move with arrow keys or touch controls.</div><div>Jump to collect items and avoid obstacles.</div><div>Masha can double jump. Bear can smash breakable obstacles with E or POWER.</div>',
              buttons: [{ label: 'GOT IT', className: 'action-btn primary', onClick: hideModal }]
            });
          }
          if (action === 'back-home') {
            setScreen('home');
          }
        });
      });

      document.querySelectorAll('.character-card').forEach((card) => {
        card.addEventListener('click', () => {
          state.selectedCharacter = card.dataset.character;
          document.querySelectorAll('.character-card').forEach((item) => item.classList.toggle('selected', item === card));
        });
      });

      document.getElementById('continue-btn').addEventListener('click', () => {
        startLevel(0);
      });

      document.getElementById('sound-toggle').addEventListener('click', () => {
        settings.sound = !settings.sound;
        updateSettingsPanel();
      });

      document.getElementById('music-toggle').addEventListener('click', () => {
        settings.music = !settings.music;
        updateSettingsPanel();
      });

      document.getElementById('difficultySelect').addEventListener('change', (event) => {
        settings.difficulty = event.target.value;
        updateSettingsPanel();
      });

      document.getElementById('controlsSelect').addEventListener('change', (event) => {
        settings.controls = event.target.value;
        updateSettingsPanel();
      });

      document.getElementById('settings-back').addEventListener('click', () => {
        if (state.running) {
          setScreen('game');
          state.paused = false;
        } else {
          setScreen('home');
        }
      });

      document.getElementById('pause-btn').addEventListener('click', togglePause);

      document.querySelectorAll('[data-control]').forEach((button) => {
        const control = button.dataset.control;
        const press = (active) => {
          if (control === 'left') state.touch.left = active;
          if (control === 'right') state.touch.right = active;
          if (control === 'jump') state.touch.jump = active;
          if (control === 'ability') state.touch.ability = active;
          if (active && control === 'jump') {
            state.jumpQueued = true;
            state.keys[' '] = true;
          }
          if (!active && control === 'jump') {
            state.keys[' '] = false;
          }
          if (active && control === 'ability') {
            state.abilityQueued = true;
          }
        };
        button.addEventListener('pointerdown', (event) => {
          button.setPointerCapture(event.pointerId);
          press(true);
        });
        button.addEventListener('pointerup', () => press(false));
        button.addEventListener('pointerleave', () => press(false));
        button.addEventListener('pointercancel', () => press(false));
        button.addEventListener('lostpointercapture', () => press(false));
      });
    }

    function bootstrap() {
      updateSettingsPanel();
      reloadLeaderboard();
      attachGlobalButtons();
      setScreen('home');
      state.player = { x: 80, y: 0, width: 42, height: 54, velocityX: 0, velocityY: 0, onGround: true, jumpCount: 0, invincible: 0, facing: 1, abilityCooldown: 0, smashTimer: 0, speed: 4.1, jumpForce: 13 };
      state.currentLevel = makeLevel(0);
      state.lastTime = 0;
      requestAnimationFrame(gameLoop);
    }

    bootstrap();
  } catch (error) {
    console.error(error);
    const banner = document.getElementById('error-banner');
    if (banner) {
      banner.textContent = 'Something went wrong while loading the game. Please refresh the page.';
      banner.classList.remove('hidden');
    }
  }
})();

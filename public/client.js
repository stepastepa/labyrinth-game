const gameContainer = document.querySelector('.game-container');
const boardElement = document.getElementById('board');
const playerInfoElement = document.getElementById('playerInfo');
const freeTileElement = document.getElementById('freeTile');
const rotateBtn = document.getElementById('rotateBtn');
const shiftButtons = document.querySelectorAll('.shift-btn');
const topCard = document.querySelector('.card');
const howManyElement = document.querySelector('.how-many');
const gameOverOverlay = document.getElementById('game-over-overlay');
const rankingsElement = document.getElementById('rankings');
const buttonHome = document.querySelector('.button-home');
const buttonInfo = document.getElementById('button-info');
const gameInfoOverlay = document.getElementById('game-info-overlay');
let gameState = null;
let localPlayerId = null;
const pickingPlayers = new Set();

const urlParams = new URLSearchParams(window.location.search);
const gameId = urlParams.get('game');
const playerId = parseInt(urlParams.get('hero'));
const numPlayers = parseInt(urlParams.get('players'));
const cardCount = parseInt(urlParams.get('cards'));

let oldBoard = null; // Для хранения предыдущего состояния доски

const gameUrl = `ws://${location.host}?game=${gameId}&hero=${playerId}&players=${numPlayers}&cards=${cardCount}`; // -- auto IP -- //

let ws = new WebSocket(gameUrl);

function setupWebSocket(ws) {
  ws.onopen = () => {
    console.log('Connected to server');
  };

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    console.log(data);
    if (data.type === 'init') {
      gameState = data.gameState;
      localPlayerId = data.playerId;
      renderBoard();
      renderFreeTile();
      renderPlayerInfo();
    } else if (data.type === 'update') {
      gameState = data.gameState;
      renderBoard(data.movedPlayer, data.shiftData);
      renderFreeTile();
      renderPlayerInfo();
      if (data.gameOver) {
        showGameOver(data.winner, data.rankings);
      }
    } else if (data.type === 'rotateUpdate') {
      gameState.freeTile = data.freeTile;
      renderFreeTile();
    } else if (data.type === 'treasureCollected') {
      console.log("Here is my treasure!");
      triggerPickingEffect(data.playerId);
    }
  };

  ws.onclose = () => {
    console.log('WebSocket connection closed');
    setTimeout(()=>{ setupWebSocket(ws) }, 1000);
  };

  ws.onerror = (error) => {
    console.error('WebSocket error:', error);
  };
}

// Инициализация WebSocket при первом подключении
setupWebSocket(ws);

// Переподключение или update при активации вкладки
document.addEventListener('visibilitychange', () => {
  // if (document.visibilityState === 'visible') {
  //   location.reload(); // слишком жестокий способ...
  // }

  if (document.visibilityState === 'visible' && ws.readyState === WebSocket.OPEN) {
    console.log('Вкладка проснулась!');
    ws.send(JSON.stringify({
      type: 'sleepyTab' // запрашиваем update
    }));
  }
});



const treasureEmojis = {
  'gold': '💰', 'key': '🔑', 'gem': '💎', 'coin': '🪙', 'skull': '💀',
  'book': '📖', 'crown': '👑', 'ring': '💍', 'sword': '⚔️', 'shield': '🛡️',
  'map': '🗺️', 'lamp': '🪔', 'chest': '📦', 'potion': '🧪', 'scroll': '📜',
  'wand': '🪄', 'cloak': '🧥', 'boots': '👢', 'gloves': '🧤', 'helmet': '⛑️',
  'mirror': '🪞', 'compass': '🧭', 'amulet': '📿', 'torch': '🔦'
};

function triggerPickingEffect(playerId) {
  console.log("Picking effect!");
  pickingPlayers.add(playerId);
  const playerElement = document.getElementById(`player-${playerId}`);
  if (playerElement) {
    playerElement.classList.add('picking');
  }
  setTimeout(() => {
    pickingPlayers.delete(playerId);
    const updatedPlayerElement = document.getElementById(`player-${playerId}`);
    if (updatedPlayerElement) {
      updatedPlayerElement.classList.remove('picking');
    }
  }, 500);
}

function renderBoard(movedPlayer, shiftData) {
  if (!gameState || !gameState.board) {
    console.log('Game state not ready yet');
    return;
  }

  // Сохраняем старое состояние доски перед обновлением
  if (gameState.board) {
    oldBoard = gameState.board.map(row => row.map(tile => ({ ...tile })));
  }

  boardElement.innerHTML = '';

  for (let y = 0; y < 7; y++) {
    for (let x = 0; x < 7; x++) {
      const tileData = gameState.board[y][x];
      if (!tileData) {
        console.error(`Tile at [${x}, ${y}] is null`);
        continue;
      }

      const tile = document.createElement('div');
      tile.classList.add('tile', tileData.type);
      tile.dataset.x = x;
      tile.dataset.y = y;

      const tileBg = document.createElement('div');
      tileBg.classList.add('tile-bg');
      tileBg.style.transform = `rotate(${tileData.rotation}deg)`;
      tile.appendChild(tileBg);

      if (tileData.treasure) {
        const treasureSpan = document.createElement('span');
        treasureSpan.textContent = treasureEmojis[tileData.treasure] || '?';
        tile.appendChild(treasureSpan);
      }

      // создаём стартовые плитки для существующих игроков
      if (tileData.isStart && tileData.startColor) {
        for (let player of gameState.players) {
          if (tileData.startPlayer === player.textureId) {
            const indicator = document.createElement('div');
            indicator.classList.add('start-indicator', `start-${tileData.startPlayer}`);
            tile.appendChild(indicator);

            // additional motion effects
            const fx = document.createElement('div');
            fx.classList.add('effects');
            indicator.appendChild(fx);

          }
        }
      }

      tile.addEventListener('click', () => {
        if (gameState && localPlayerId === gameState.currentPlayer && gameState.hasShifted) {
          ws.send(JSON.stringify({
            type: 'movePlayer',
            playerId: localPlayerId,
            newPosition: [x, y]
          }));
        }
      });

      boardElement.appendChild(tile);
    }
  }

  gameState.players.forEach((player) => {
    const playerElement = document.createElement('div');
    playerElement.classList.add('player');
    playerElement.id = `player-${player.id}`;
    const sprite = document.createElement('div');
    sprite.style.backgroundImage = `url('./images/player-${player.textureId}.png')`;
    playerElement.appendChild(sprite);

    if (player.id === gameState.currentPlayer) {
      playerElement.classList.add('active');
    }
    if (pickingPlayers.has(player.id)) {
      playerElement.classList.add('picking');
    }

    const tile = boardElement.children[player.position[1] * 7 + player.position[0]];
    if (tile) tile.appendChild(playerElement);

    // изменяем стартовую плитку, если игрок собрал все сокровища
    if (player.cards.length === 0) {
      document.querySelector(`.start-${player.textureId}`).classList.add('activated');
    }
  });

  // делаем анимацию сдвигание плиток
  animateTileShift(shiftData);

  if (document.visibilityState === 'visible') {
  // не анимировать в спящих вкладках, но тогда есть задержка, пока идет анимация, если сразу переключится на спящую вкладку

    if (movedPlayer) {
      const playerElement = document.getElementById(`player-${movedPlayer.id}`);
      if (playerElement) {
        animatePlayer(playerElement, movedPlayer.path, () => {
          if (localPlayerId === movedPlayer.id) {
            ws.send(JSON.stringify({
              type: 'moveAnimationComplete',
              playerId: localPlayerId
            }));
          }
        });
      }
    }
  }

  const localPlayer = gameState.players.find(p => p.id === localPlayerId);
  gameContainer.style.setProperty('--player-color', localPlayer.color);
  shiftButtons.forEach(btn => {
    btn.querySelector('img').src = `./images/triangle-${localPlayer.textureId}.svg`;

    // скрываем кнопочки для рядов, если не твой ход
    btn.classList.add('hidden');
    if(gameState.currentPlayer === localPlayerId) {
      btn.classList.remove('hidden');
    }
  });

  // resize tiles bg to prevent jitter
  resizeTilesBg();
}


// анимация сдвигания плиток
function animateTileShift(shiftData) {
  let row, col, direction = '';
  if (shiftData) {
    if(shiftData.row) row = shiftData.row;
    if(shiftData.col) col = shiftData.col;
    direction = shiftData.direction;
  }

  // Определяем, какие плитки анимировать
  let tilesToAnimate = [];
  if (row !== undefined) {
    // Сдвиг ряда
    for (let x = 0; x < 7; x++) {
      const tile = boardElement.children[row * 7 + x];
      if (tile) tilesToAnimate.push({ tile, x, y: row });
    }
  } else if (col !== undefined) {
    // Сдвиг столбца
    for (let y = 0; y < 7; y++) {
      const tile = boardElement.children[y * 7 + col];
      if (tile) tilesToAnimate.push({ tile, x: col, y });
    }
  }

  // поддерживает ли браузер starting-style
  const supportsStartingStyle = CSS.supports('selector(@starting-style)');

  function addAnimStyles() {
    // Применяем начальное смещение для анимации плиток
    tilesToAnimate.forEach(({ tile }) => {
      if (direction === 'left') {
        tile.classList.add('shift-left');
      } else if (direction === 'right') {
        tile.classList.add('shift-right');
      } else if (direction === 'up') {
        tile.classList.add('shift-up');
      } else if (direction === 'down') {
        tile.classList.add('shift-down');
      }
    });
  }

  function addStartingAnimStyles() {
    // Применяем начальное смещение для анимации плиток
    tilesToAnimate.forEach(({ tile }) => {
      if (direction === 'left') {
        tile.classList.add('shift-left-start');
      } else if (direction === 'right') {
        tile.classList.add('shift-right-start');
      } else if (direction === 'up') {
        tile.classList.add('shift-up-start');
      } else if (direction === 'down') {
        tile.classList.add('shift-down-start');
      }
    });
  }

  if (!supportsStartingStyle) {
    addStartingAnimStyles();
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        addAnimStyles();
      });
    });
  } else {
    addAnimStyles();
  }

  // Удаляем все-все классы анимации после завершения
  setTimeout(() => {
    tilesToAnimate.forEach(({ tile }) => {
      tile.classList.remove('shift-left', 'shift-right', 'shift-up', 'shift-down', 'shift-left-start', 'shift-right-start', 'shift-up-start', 'shift-down-start');
    });
  }, 500); // 5сек
}


function renderFreeTile() {
  if (!gameState || !gameState.freeTile) return;

  freeTileElement.innerHTML = '';
  freeTileElement.className = `tile ${gameState.freeTile.type}`;

  const tileBg = document.createElement('div');
  tileBg.classList.add('tile-bg');
  tileBg.style.transform = `rotate(${gameState.freeTile.rotation}deg)`;
  freeTileElement.appendChild(tileBg);

  if (gameState.freeTile.treasure) {
    const treasureSpan = document.createElement('span');
    treasureSpan.textContent = treasureEmojis[gameState.freeTile.treasure] || '?';
    freeTileElement.appendChild(treasureSpan);
  }
}

function renderPlayerInfo() {
  const localPlayer = gameState.players.find(p => p.id === localPlayerId);

  topCard.innerHTML = '';
  if (localPlayer.cards.length > 0) {
    topCard.textContent = treasureEmojis[localPlayer.cards[0]] || '?';
  } else {
    topCard.innerHTML = `<img src="./images/start-${localPlayer.textureId}.svg">`;
  }

  if (localPlayer.cards.length > 0) {
    howManyElement.textContent = localPlayer.cards.length;
    playerInfoElement.classList.remove('winner');
  } else {
    howManyElement.textContent = '0';
    playerInfoElement.classList.add('winner');
  }

  // эффект стопки:
  const stack = document.querySelector('.cards');
  let shadows = [];
  let howManyToDraw = +localPlayer.cards.length;
  if(howManyToDraw > 5) {
    howManyToDraw = 5; // ограничиваем величину стопки
  }
  for (let i = 1; i < (howManyToDraw-1) * 2; i += 2) {
    shadows.push(`${i}px ${i}px 0px 0px rgb(0, 0, 0)`);
    shadows.push(`${i + 1}px ${i + 1}px 0px 0px var(--player-color)`);
  }
  stack.style.boxShadow = shadows.join(', ');
}

function animatePlayer(playerElement, path, callback) {
  let step = 0;
  const delay = 400;

  function moveStep() {
    if (step >= path.length) {
      if (callback) callback();
      return;
    }

    const [x, y] = path[step];
    const tile = boardElement.children[y * 7 + x];
    if (tile) {
      tile.appendChild(playerElement);
    }
    step++;
    if (step < path.length) {
      setTimeout(moveStep, delay);
    } else {
      setTimeout(moveStep, delay);
    }
  }

  moveStep();
}

function showGameOver(winner, rankings) {
  rankingsElement.innerHTML = ''; // стираем весь рейтинг заранее (но можно просто и в HTML его стереть...)
  // ждем 2сек
  setTimeout(() => {
    gameOverOverlay.classList.remove('hidden');
    // ждём 1сек
    setTimeout(() => {
    // выводим построчно рейтинг
    rankings.forEach((rank, index) => {
      let prize = '';
      if (index === 0) { prize = ' 🏅'; }
      setTimeout(() => {
        const rankElement = document.createElement('p');
        rankElement.innerHTML = `${index + 1}. <span class="player"><div style="background-image: url('./images/player-${rank.texture}.png');"></div></span> ${rank.hero} - ${prize || rank.treasuresCollected}`;
        rankingsElement.appendChild(rankElement);
      }, index * 500);
    });
    }, 750);
  }, 2000);
}

shiftButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    if (!gameState || localPlayerId !== gameState.currentPlayer || gameState.hasShifted) return;

    const row = btn.dataset.row ? parseInt(btn.dataset.row) : undefined;
    const col = btn.dataset.col ? parseInt(btn.dataset.col) : undefined;
    const direction = btn.dataset.direction;

    ws.send(JSON.stringify({ 
      type: 'moveTile', 
      row, 
      col, 
      direction, 
      playerId: localPlayerId 
    }));
  });
});

rotateBtn.addEventListener('click', () => {
  if (!gameState || localPlayerId !== gameState.currentPlayer) return;
  ws.send(JSON.stringify({
    type: 'rotateTile',
    playerId: localPlayerId
  }));
});

// toggle info menu with rules
buttonInfo.addEventListener('click', () => {
  gameInfoOverlay.classList.remove('hidden');
});
gameInfoOverlay.addEventListener('click', () => {
  gameInfoOverlay.classList.add('hidden');
});


// grid subpixel jitter bug solution
function resizeTilesBg() {
  let tilesBg = document.querySelectorAll("#board .tile .tile-bg");
  tilesBg.forEach((el) => {
    el.style.width = Math.ceil(el.closest('.board').offsetWidth / 7) + 'px';
    el.style.height = Math.ceil(el.closest('.board').offsetHeight / 7) + 'px';
  });
}
window.addEventListener('resize', resizeTilesBg);
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.static(path.join(__dirname, 'public')));

const games = new Map();

function createGame(cardCount) {
  const gameState = {
    gameId: null,
    board: [],
    players: [],
    currentPlayer: Math.floor(Math.random() * 4), // случайный первый игрок (0-3)
    freeTile: null,
    unusedTiles: [],
    hasShifted: false,
    allCards: [
      'gold', 'key', 'gem', 'coin', 'skull', 'book', 'crown', 'ring', 'sword', 'shield',
      'map', 'lamp', 'chest', 'potion', 'scroll', 'wand', 'cloak', 'boots', 'gloves', 'helmet',
      'mirror', 'compass', 'amulet', 'torch'
    ]
  };
  initializeGame(gameState, cardCount);
  return gameState;
}

function initializeGame(gameState, cardCount) {
  console.log('Raw cardCount input:', cardCount);
  cardCount = parseInt(cardCount, 10);
  if (isNaN(cardCount) || cardCount <= 0 || cardCount > gameState.allCards.length) {
    console.log(`Invalid cardCount (${cardCount}), defaulting to 5`);
    cardCount = 5;
  }
  console.log(`Initializing game with cardCount: ${cardCount}`);

  gameState.board = Array(7).fill().map(() => Array(7).fill(null));
  const treasures = gameState.allCards.slice();
  // порядок цветов для игроков по часовой стрелке !!!
  const playerColors = ['orange', 'crimson', 'royalblue', '#35b83f'];

  gameState.unusedTiles = [
    ...Array(10).fill().map(() => ({ type: 'L', rotation: Math.floor(Math.random() * 4) * 90, treasure: null, isStart: false })),
    ...Array(12).fill().map(() => ({ type: 'I', rotation: Math.floor(Math.random() * 4) * 90, treasure: null, isStart: false })),
    ...Array(18).fill().map((_, i) => ({ type: 'T', rotation: Math.floor(Math.random() * 4) * 90, treasure: treasures[i], isStart: false })),
    ...Array(6).fill().map((_, i) => ({ type: 'L', rotation: Math.floor(Math.random() * 4) * 90, treasure: treasures[i + 18], isStart: false }))
  ].sort(() => Math.random() - 0.5);

  // стартовые плитки для каждого игрока
  const startTiles = [
    { type: 'L', rotation: 90, treasure: null, isStart: true, startColor: playerColors[0], startPlayer: 0 },
    { type: 'L', rotation: 180, treasure: null, isStart: true, startColor: playerColors[1], startPlayer: 1 },
    { type: 'L', rotation: 270, treasure: null, isStart: true, startColor: playerColors[2], startPlayer: 2 },
    { type: 'L', rotation: 0, treasure: null, isStart: true, startColor: playerColors[3], startPlayer: 3 }
  ];

  gameState.board[0][0] = startTiles[0];
  gameState.board[0][6] = startTiles[1];
  gameState.board[6][6] = startTiles[2];
  gameState.board[6][0] = startTiles[3];

  for (let y = 0; y < 7; y++) {
    for (let x = 0; x < 7; x++) {
      if (!gameState.board[y][x]) {
        gameState.board[y][x] = gameState.unusedTiles.pop();
      }
    }
  }

  gameState.freeTile = gameState.unusedTiles.pop() || { type: 'L', rotation: 0, treasure: null, isStart: false };

  gameState.players = [
    { id: 0, position: [0, 0], treasures: [], color: playerColors[0], cards: shuffleArray([...gameState.allCards]).slice(0, cardCount), isMoving: false },
    { id: 1, position: [6, 0], treasures: [], color: playerColors[1], cards: shuffleArray([...gameState.allCards]).slice(0, cardCount), isMoving: false },
    { id: 2, position: [6, 6], treasures: [], color: playerColors[2], cards: shuffleArray([...gameState.allCards]).slice(0, cardCount), isMoving: false },
    { id: 3, position: [0, 6], treasures: [], color: playerColors[3], cards: shuffleArray([...gameState.allCards]).slice(0, cardCount), isMoving: false }
  ];

  console.log('Player 0 cards:', gameState.players[0].cards);
  gameState.hasShifted = false;
}

function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function updateBoard(row, col, direction, gameState) {
  if (gameState.hasShifted) return;

  let shiftedPlayers = [];
  if (row !== undefined) {
    const boardRow = gameState.board[row];
    if (direction === 'left') {
      const shiftedTile = boardRow.shift();
      boardRow.push(gameState.freeTile);
      gameState.freeTile = shiftedTile;
      shiftedPlayers = gameState.players.filter(p => p.position[1] === row).map(p => {
        const oldX = p.position[0];
        p.position[0] = (p.position[0] - 1 + 7) % 7;
        return { id: p.id, path: [[oldX, row], [p.position[0], row]] };
      });
    } else if (direction === 'right') {
      const shiftedTile = boardRow.pop();
      boardRow.unshift(gameState.freeTile);
      gameState.freeTile = shiftedTile;
      shiftedPlayers = gameState.players.filter(p => p.position[1] === row).map(p => {
        const oldX = p.position[0];
        p.position[0] = (p.position[0] + 1) % 7;
        return { id: p.id, path: [[oldX, row], [p.position[0], row]] };
      });
    }
  } else if (col !== undefined) {
    const column = gameState.board.map(row => row[col]);
    if (direction === 'down') {
      const shiftedTile = column.pop();
      column.unshift(gameState.freeTile);
      gameState.freeTile = shiftedTile;
      shiftedPlayers = gameState.players.filter(p => p.position[0] === col).map(p => {
        const oldY = p.position[1];
        p.position[1] = (p.position[1] + 1) % 7;
        return { id: p.id, path: [[col, oldY], [col, p.position[1]]] };
      });
    } else if (direction === 'up') {
      const shiftedTile = column.shift();
      column.push(gameState.freeTile);
      gameState.freeTile = shiftedTile;
      shiftedPlayers = gameState.players.filter(p => p.position[0] === col).map(p => {
        const oldY = p.position[1];
        p.position[1] = (p.position[1] - 1 + 7) % 7;
        return { id: p.id, path: [[col, oldY], [col, p.position[1]]] };
      });
    }
    for (let y = 0; y < 7; y++) {
      gameState.board[y][col] = column[y];
    }
  }

  // Проверяем всех сдвинутых игроков на сбор сокровищ
  shiftedPlayers.forEach(shifted => {
    const player = gameState.players.find(p => p.id === shifted.id);
    checkTreasure(player, gameState);
  });

  gameState.hasShifted = true;
  broadcastGameState(gameState, { shiftedPlayers });
}

function canMove(fromX, fromY, toX, toY, gameState) {
  const visited = new Set();
  const path = [];
  const targetOccupied = gameState.players.some(p => p.position[0] === toX && p.position[1] === toY && (p.position[0] !== fromX || p.position[1] !== fromY));
  if (targetOccupied) return false;
  return canReach(fromX, fromY, toX, toY, visited, path, gameState);
}

function canReach(fromX, fromY, toX, toY, visited, path, gameState) {
  if (fromX < 0 || fromX >= 7 || fromY < 0 || fromY >= 7) return false;
  if (visited.has(`${fromX},${fromY}`)) return false;
  visited.add(`${fromX},${fromY}`);
  path.push([fromX, fromY]);

  if (fromX === toX && fromY === toY) return true;

  const fromTile = gameState.board[fromY][fromX];
  if (!fromTile) return false;

  const fromPaths = getTilePaths(fromTile);

  const directions = [
    { dx: 0, dy: -1, fromDir: 'top', toDir: 'bottom' },
    { dx: 1, dy: 0, fromDir: 'right', toDir: 'left' },
    { dx: 0, dy: 1, fromDir: 'bottom', toDir: 'top' },
    { dx: -1, dy: 0, fromDir: 'left', toDir: 'right' }
  ];

  for (const { dx, dy, fromDir, toDir } of directions) {
    if (!fromPaths[fromDir]) continue;

    const nextX = fromX + dx;
    const nextY = fromY + dy;
    if (nextX < 0 || nextX >= 7 || nextY < 0 || nextY >= 7) continue;

    const toTile = gameState.board[nextY][nextX];
    if (!toTile) continue;

    const toPaths = getTilePaths(toTile);
    if (toPaths[toDir]) {
      if (canReach(nextX, nextY, toX, toY, visited, path, gameState)) return true;
    }
  }

  path.pop();
  return false;
}

function getMovePath(fromX, fromY, toX, toY, gameState) {
  const visited = new Set();
  const path = [];
  canReach(fromX, fromY, toX, toY, visited, path, gameState);
  return path;
}

function getTilePaths(tile) {
  const { type, rotation } = tile;
  let basePaths;

  if (type === 'I') {
    basePaths = { top: true, right: false, bottom: true, left: false };
  } else if (type === 'L') {
    basePaths = { top: true, right: true, bottom: false, left: false };
  } else if (type === 'T') {
    basePaths = { top: false, right: true, bottom: true, left: true };
  } else {
    return { top: false, right: false, bottom: false, left: false };
  }

  const rotations = (rotation / 90) % 4;
  let paths = { ...basePaths };

  for (let i = 0; i < rotations; i++) {
    const temp = { ...paths };
    paths.top = temp.left;
    paths.right = temp.top;
    paths.bottom = temp.right;
    paths.left = temp.bottom;
  }

  return paths;
}

function checkTreasure(player, gameState) {
  const [x, y] = player.position;
  const tile = gameState.board[y][x];
  if (tile.treasure && tile.treasure === player.cards[0]) {
    player.treasures.push(player.cards.shift());
    console.log(`Player ${player.id} collected ${tile.treasure}. Remaining cards: ${player.cards.length}`);
    // Отправляем уведомление о сборе сокровища
    broadcastTreasureCollected(gameState.gameId, player.id, tile.treasure);
    // if (player.cards.length === 0) {
      // Выигрывает тот, кто после сбора сокровищ первый приходит на свою стартовую плитку -- так в правилах классических указано!!!
    // }
  }
  // была раньше ошибка, когда у первого 0 был... он как false воспринимался и не было финала игры...
  if (tile.startPlayer != null && tile.startPlayer === player.id && player.cards.length === 0) {
    const rankings = gameState.players
        .map(p => ({ id: p.id, cardsLeft: p.cards.length }))
        .sort((a, b) => a.cardsLeft - b.cardsLeft);
      // бывают случаи, когда у двоих игроково по ноль карт и надо в рейтинге поднять на первое место того, кто первый прийдет на свою стартовую плитку!!!
      const index = rankings.findIndex(p => p.id === player.id);
      if (index > -1) {
        const [currentPlayer] = rankings.splice(index, 1); // удаляем
        rankings.unshift(currentPlayer); // и добавляем в начало
      }
    broadcastGameState(gameState, { gameOver: true, winner: player.id, rankings });
  }
}

wss.on('connection', (ws, req) => {
  console.log('New client connected');
  const urlParams = new URLSearchParams(req.url.split('?')[1]);
  const gameId = urlParams.get('game');
  const playerId = parseInt(urlParams.get('player'));
  const rawCardCount = urlParams.get('cards');
  const cardCount = parseInt(rawCardCount, 10);

  console.log(`Raw cards param: ${rawCardCount}`);
  console.log(`Game ID: ${gameId}, Player ID: ${playerId}, Card Count: ${cardCount}`);

  if (!gameId || isNaN(playerId) || playerId < 0 || playerId > 3) {
    ws.close(4000, 'Invalid game or player ID');
    return;
  }

  // --- надо подчищать созданные давно игры, которые уже неактивные !!!
  let gameState = games.get(gameId);
  if (!gameState) {
    gameState = createGame(cardCount);
    gameState.gameId = gameId;
    games.set(gameId, gameState);
  }

  ws.gameId = gameId;
  ws.playerId = playerId;

  ws.send(JSON.stringify({ type: 'init', gameState, playerId }));

  ws.on('message', (message) => {
    const data = JSON.parse(message);
    const gameState = games.get(ws.gameId);
    if (!gameState) return;

    if (data.type === 'rotateTile' && gameState.players[gameState.currentPlayer].id === data.playerId) {
      gameState.freeTile.rotation = (gameState.freeTile.rotation + 90) % 360;
      broadcastRotateUpdate(gameState);
    } else if (data.type === 'moveTile' && gameState.players[gameState.currentPlayer].id === data.playerId) {
      updateBoard(data.row, data.col, data.direction, gameState);
    } else if (data.type === 'movePlayer' && gameState.players[gameState.currentPlayer].id === data.playerId) {
      const player = gameState.players.find(p => p.id === data.playerId);
      if (player && canMove(player.position[0], player.position[1], data.newPosition[0], data.newPosition[1], gameState)) {

        player.isMoving = true; // игрок двигается ??????????

        const path = getMovePath(player.position[0], player.position[1], data.newPosition[0], data.newPosition[1], gameState);
        const moveData = { id: player.id, path, newPosition: data.newPosition };
        player.position = data.newPosition;
        gameState.hasShifted = false;
        broadcastGameState(gameState, { movedPlayer: moveData });
      }
    } else if (data.type === 'moveAnimationComplete' && gameState.players[gameState.currentPlayer].id === data.playerId) {
      const player = gameState.players.find(p => p.id === data.playerId);
      
      player.isMoving = false; // игрок уже не двигается ??????????

      checkTreasure(player, gameState);
      // очередь переходит к следующему игроку, % помогает зациклить процесс в пределах (0-3)
      gameState.currentPlayer = (gameState.currentPlayer + 1) % gameState.players.length;
      broadcastGameState(gameState);
    } else if (data.type === 'sleepyTab') {

      // надо понимать, что идет анимация и не рисовать того игрока...
      // ?????????????????????????????????????????????????????????????

      broadcastGameState(gameState); // состояние игры для спящей вкладки
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected');
  });
});

function broadcastGameState(gameState, extraData = {}) {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN && client.gameId === gameState.gameId) {
      client.send(JSON.stringify({ type: 'update', gameState, ...extraData }));
    }
  });
}

function broadcastRotateUpdate(gameState) {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN && client.gameId === gameState.gameId) {
      client.send(JSON.stringify({ type: 'rotateUpdate', freeTile: gameState.freeTile }));
    }
  });
}

// Новая функция для уведомления о сборе сокровища
function broadcastTreasureCollected(gameId, playerId, treasure) {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN && client.gameId === gameId) {
      client.send(JSON.stringify({ type: 'treasureCollected', playerId, treasure }));
    }
  });
}

server.listen(80, () => {
  console.log('Server running on port 80');
});
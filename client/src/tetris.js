import seedrandom from 'seedrandom';

// ============================================================
// ECS Core
// ============================================================

class World {
  constructor() {
    this.entities = new Map();
    this.systems = [];
    this.nextId = 0;
  }

  createEntity() {
    const id = this.nextId++;
    this.entities.set(id, {});
    return id;
  }

  destroyEntity(id) {
    this.entities.delete(id);
  }

  addComponent(id, name, data) {
    const entity = this.entities.get(id);
    if (entity) entity[name] = data;
    return this;
  }

  getComponent(id, name) {
    const entity = this.entities.get(id);
    return entity ? entity[name] : undefined;
  }

  hasComponent(id, name) {
    const entity = this.entities.get(id);
    return entity ? name in entity : false;
  }

  removeComponent(id, name) {
    const entity = this.entities.get(id);
    if (entity) delete entity[name];
  }

  query(...names) {
    const results = [];
    for (const [id, components] of this.entities) {
      if (names.every(n => n in components)) {
        results.push(id);
      }
    }
    return results;
  }

  addSystem(system) {
    this.systems.push(system);
  }

  update(dt) {
    for (const system of this.systems) {
      system.update(this, dt);
    }
  }
}

// ============================================================
// Piece Definitions
// ============================================================

const PIECE_TYPES = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];

const PIECE_SHAPES = {
  I: [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]],
  O: [[1,1],[1,1]],
  T: [[0,1,0],[1,1,1],[0,0,0]],
  S: [[0,1,1],[1,1,0],[0,0,0]],
  Z: [[1,1,0],[0,1,1],[0,0,0]],
  J: [[1,0,0],[1,1,1],[0,0,0]],
  L: [[0,0,1],[1,1,1],[0,0,0]],
};

const PIECE_COLORS = {
  I: '#00f0f0',
  O: '#f0f000',
  T: '#a000f0',
  S: '#00f000',
  Z: '#f00000',
  J: '#0000f0',
  L: '#f0a000',
};

function rotateMatrix(matrix) {
  const n = matrix.length;
  const result = Array.from({ length: n }, () => Array(n).fill(0));
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++)
      result[x][n - 1 - y] = matrix[y][x];
  return result;
}

function getRotatedShape(type, rotation) {
  let shape = PIECE_SHAPES[type];
  for (let i = 0; i < rotation; i++) shape = rotateMatrix(shape);
  return shape;
}

function getBlocks(type, rotation) {
  const shape = getRotatedShape(type, rotation);
  const blocks = [];
  for (let y = 0; y < shape.length; y++)
    for (let x = 0; x < shape[y].length; x++)
      if (shape[y][x]) blocks.push({ x, y });
  return blocks;
}

// ============================================================
// Component Factories
// ============================================================

const Components = {
  Board(w = 10, h = 20) {
    const bufferHeight = 4;
    const grid = Array.from({ length: h + bufferHeight }, () => Array(w).fill(null));
    return { width: w, height: h, bufferHeight, grid };
  },
  ActivePiece(type, x, y, rotation = 0) {
    return { type, x, y, rotation };
  },
  Drop(interval = 1000) {
    return { timer: 0, interval, softDrop: false };
  },
  Score() {
    return { score: 0, lines: 0, level: 1 };
  },
  NextQueue(rng) {
    return { queue: [], rng };
  },
  HoldPiece() {
    return { type: null, used: false };
  },
  GameState() {
    return {
      phase: 'playing',
      lockTimer: 0,
      lockDelay: 500,
      lockResets: 0,
      maxLockResets: 15,
      hardDropping: false,
    };
  },
  Input() {
    return { actions: [] };
  },
};

// ============================================================
// Shared Helpers
// ============================================================

function collides(board, type, rotation, px, py) {
  const blocks = getBlocks(type, rotation);
  for (const b of blocks) {
    const gx = px + b.x;
    const gy = py + b.y;
    if (gx < 0 || gx >= board.width) return true;
    if (gy >= board.height + board.bufferHeight) return true;
    if (gy >= 0 && board.grid[gy] && board.grid[gy][gx] !== null) return true;
  }
  return false;
}

function canMove(board, type, rotation, px, py) {
  return !collides(board, type, rotation, px, py);
}

function shuffledBag(rng) {
  const bag = [...PIECE_TYPES];
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }
  return bag;
}

function getDropInterval(level) {
  return Math.max(50, 1000 - (level - 1) * 80);
}

// ============================================================
// GAME LOGIC SYSTEMS
// (No rendering code here — purely state manipulation)
// ============================================================

// --- SpawnSystem: creates a new active piece when none exists ---

class SpawnSystem {
  update(world) {
    const boardId = world.query('Board', 'GameState')[0];
    if (boardId === undefined) return;
    const state = world.getComponent(boardId, 'GameState');
    if (state.phase === 'gameover') return;

    if (world.query('ActivePiece').length > 0) return;

    const nextQueue = world.getComponent(boardId, 'NextQueue');
    while (nextQueue.queue.length < 14) nextQueue.queue.push(...shuffledBag(nextQueue.rng));
    const type = nextQueue.queue.shift();

    const board = world.getComponent(boardId, 'Board');
    const hold = world.getComponent(boardId, 'HoldPiece');
    if (hold) hold.used = false;

    const spawnX = Math.floor((board.width - PIECE_SHAPES[type][0].length) / 2);
    const spawnY = board.bufferHeight - 2;

    if (!canMove(board, type, 0, spawnX, spawnY)) {
      state.phase = 'gameover';
      return;
    }

    const score = world.getComponent(boardId, 'Score');
    const pieceId = world.createEntity();
    world.addComponent(pieceId, 'ActivePiece', Components.ActivePiece(type, spawnX, spawnY));
    world.addComponent(pieceId, 'Drop', Components.Drop(getDropInterval(score.level)));

    state.phase = 'playing';
    state.lockTimer = 0;
    state.lockResets = 0;
  }
}

// --- InputSystem: reads keyboard and queues actions ---

class InputSystem {
  constructor() {
    this.keys = {};
    this.das = {};
    this.dasDelay = 170;
    this.dasRepeat = 50;
    this.actionQueue = [];

    document.addEventListener('keydown', e => {
      if (['ArrowLeft','ArrowRight','ArrowDown','ArrowUp',
           'Space','KeyZ','KeyX','KeyC','ShiftLeft','ShiftRight'].includes(e.code)) {
        e.preventDefault();
      }
      if (!this.keys[e.code]) {
        this.keys[e.code] = true;
        this.das[e.code] = { timer: 0, fired: false };
        const action = this.mapKey(e.code);
        if (action) this.actionQueue.push(action);
      }
    });

    document.addEventListener('keyup', e => {
      this.keys[e.code] = false;
      delete this.das[e.code];
      if (e.code === 'ArrowDown') {
        this.actionQueue.push('softdrop_release');
      }
      if (e.code === 'Space') {
        this.actionQueue.push('harddrop_release');
      }
    });
  }

  mapKey(code) {
    const map = {
      ArrowLeft: 'left', ArrowRight: 'right', ArrowDown: 'softdrop',
      ArrowUp: 'rotate_cw', KeyZ: 'rotate_ccw', KeyX: 'rotate_cw',
      Space: 'harddrop', KeyC: 'hold', ShiftLeft: 'hold', ShiftRight: 'hold',
    };
    return map[code] || null;
  }

  update(world, dt) {
    for (const code of ['ArrowLeft', 'ArrowRight']) {
      if (this.keys[code] && this.das[code]) {
        this.das[code].timer += dt;
        if (!this.das[code].fired && this.das[code].timer >= this.dasDelay) {
          this.das[code].fired = true;
          this.das[code].timer = 0;
          this.actionQueue.push(this.mapKey(code));
        } else if (this.das[code].fired && this.das[code].timer >= this.dasRepeat) {
          this.das[code].timer = 0;
          this.actionQueue.push(this.mapKey(code));
        }
      }
    }

    const boardId = world.query('Board', 'Input')[0];
    if (boardId === undefined) return;
    const input = world.getComponent(boardId, 'Input');
    input.actions.push(...this.actionQueue);
    this.actionQueue = [];
  }
}

// --- MovementSystem: processes queued actions ---

class MovementSystem {
  update(world) {
    const boardId = world.query('Board', 'GameState', 'Input')[0];
    if (boardId === undefined) return;
    const state = world.getComponent(boardId, 'GameState');
    if (state.phase === 'gameover') return;

    const board = world.getComponent(boardId, 'Board');
    const input = world.getComponent(boardId, 'Input');
    const pieceIds = world.query('ActivePiece');
    if (pieceIds.length === 0) { input.actions = []; return; }

    const pieceId = pieceIds[0];
    const piece = world.getComponent(pieceId, 'ActivePiece');
    const drop = world.getComponent(pieceId, 'Drop');

    for (const action of input.actions) {
      if (state.phase === 'gameover') break;
      switch (action) {
        case 'left':
          if (canMove(board, piece.type, piece.rotation, piece.x - 1, piece.y)) {
            piece.x--;
            if (state.hardDropping) {
              while (canMove(board, piece.type, piece.rotation, piece.x, piece.y + 1)) piece.y++;
            } else {
              this.resetLock(state);
            }
          }
          break;
        case 'right':
          if (canMove(board, piece.type, piece.rotation, piece.x + 1, piece.y)) {
            piece.x++;
            if (state.hardDropping) {
              while (canMove(board, piece.type, piece.rotation, piece.x, piece.y + 1)) piece.y++;
            } else {
              this.resetLock(state);
            }
          }
          break;
        case 'softdrop':
          drop.softDrop = true;
          break;
        case 'softdrop_release':
          drop.softDrop = false;
          break;
        case 'rotate_cw':
          this.tryRotate(board, piece, state, 1);
          break;
        case 'rotate_ccw':
          this.tryRotate(board, piece, state, -1);
          break;
        case 'harddrop':
          this.hardDrop(world, boardId, piece, state);
          break;
        case 'harddrop_release':
          if (state.hardDropping) {
            state.hardDropping = false;
            state.phase = 'lock_now';
          }
          break;
        case 'hold':
          this.holdPiece(world, boardId, pieceId, board);
          break;
      }
    }
    input.actions = [];
  }

  tryRotate(board, piece, state, dir) {
    const newRot = (piece.rotation + dir + 4) % 4;
    const kicks = [
      { x: 0, y: 0 }, { x: -1, y: 0 }, { x: 1, y: 0 },
      { x: 0, y: -1 }, { x: -1, y: -1 }, { x: 1, y: -1 },
      { x: -2, y: 0 }, { x: 2, y: 0 },
    ];
    for (const kick of kicks) {
      if (canMove(board, piece.type, newRot, piece.x + kick.x, piece.y + kick.y)) {
        piece.x += kick.x;
        piece.y += kick.y;
        piece.rotation = newRot;
        this.resetLock(state);
        return;
      }
    }
  }

  hardDrop(world, boardId, piece, state) {
    const board = world.getComponent(boardId, 'Board');
    const startY = piece.y;
    while (canMove(board, piece.type, piece.rotation, piece.x, piece.y + 1)) {
      piece.y++;
    }
    const score = world.getComponent(boardId, 'Score');
    score.score += (piece.y - startY) * 2;
    state.hardDropping = true;
  }

  holdPiece(world, boardId, pieceId, board) {
    const hold = world.getComponent(boardId, 'HoldPiece');
    if (!hold || hold.used) return;
    const piece = world.getComponent(pieceId, 'ActivePiece');
    const oldType = piece.type;

    if (hold.type === null) {
      hold.type = oldType;
      world.destroyEntity(pieceId);
    } else {
      const swapType = hold.type;
      hold.type = oldType;
      const spawnX = Math.floor((board.width - PIECE_SHAPES[swapType][0].length) / 2);
      const spawnY = board.bufferHeight - 2;
      piece.type = swapType;
      piece.x = spawnX;
      piece.y = spawnY;
      piece.rotation = 0;
    }
    hold.used = true;
  }

  resetLock(state) {
    if (state.phase === 'locking' && state.lockResets < state.maxLockResets) {
      state.lockTimer = 0;
      state.lockResets++;
    }
  }
}

// --- GravitySystem: auto-drops the active piece ---

class GravitySystem {
  update(world, dt) {
    const boardId = world.query('Board', 'GameState')[0];
    if (boardId === undefined) return;
    const state = world.getComponent(boardId, 'GameState');
    if (state.phase === 'gameover' || state.phase === 'lock_now' || state.hardDropping) return;

    const pieceIds = world.query('ActivePiece', 'Drop');
    if (pieceIds.length === 0) return;

    const pieceId = pieceIds[0];
    const piece = world.getComponent(pieceId, 'ActivePiece');
    const drop = world.getComponent(pieceId, 'Drop');
    const board = world.getComponent(boardId, 'Board');
    const score = world.getComponent(boardId, 'Score');

    const interval = drop.softDrop ? Math.min(drop.interval, 50) : drop.interval;
    drop.timer += dt;

    while (drop.timer >= interval) {
      drop.timer -= interval;
      if (canMove(board, piece.type, piece.rotation, piece.x, piece.y + 1)) {
        piece.y++;
        if (drop.softDrop) score.score++;
      } else {
        drop.timer = 0;
        break;
      }
    }
  }
}

// --- LockSystem: locks piece to board when grounded ---

class LockSystem {
  update(world, dt) {
    const boardId = world.query('Board', 'GameState')[0];
    if (boardId === undefined) return;
    const state = world.getComponent(boardId, 'GameState');
    if (state.phase === 'gameover') return;

    const pieceIds = world.query('ActivePiece');
    if (pieceIds.length === 0) return;

    const pieceId = pieceIds[0];
    const piece = world.getComponent(pieceId, 'ActivePiece');
    const board = world.getComponent(boardId, 'Board');
    const grounded = !canMove(board, piece.type, piece.rotation, piece.x, piece.y + 1);

    if (state.phase === 'lock_now' || (state.phase === 'locking' && grounded && state.lockTimer >= state.lockDelay)) {
      const blocks = getBlocks(piece.type, piece.rotation);
      for (const b of blocks) {
        const gx = piece.x + b.x;
        const gy = piece.y + b.y;
        if (gy >= 0 && gy < board.grid.length && gx >= 0 && gx < board.width) {
          board.grid[gy][gx] = piece.type;
        }
      }
      world.destroyEntity(pieceId);
      state.phase = 'playing';
      state.lockTimer = 0;
      state.lockResets = 0;
      state.hardDropping = false;
      return;
    }

    if (state.hardDropping) return;

    if (grounded && state.phase === 'locking') {
      state.lockTimer += dt;
    } else if (grounded && state.phase === 'playing') {
      state.phase = 'locking';
      state.lockTimer = 0;
    } else if (!grounded && state.phase === 'locking') {
      state.phase = 'playing';
      state.lockTimer = 0;
    }
  }
}

// --- LineClearSystem: clears completed rows, updates score ---

class LineClearSystem {
  update(world) {
    const boardId = world.query('Board', 'Score')[0];
    if (boardId === undefined) return;
    if (world.query('ActivePiece').length > 0) return;

    const board = world.getComponent(boardId, 'Board');
    const score = world.getComponent(boardId, 'Score');

    let linesCleared = 0;
    for (let y = board.grid.length - 1; y >= 0; y--) {
      if (board.grid[y].every(cell => cell !== null)) {
        board.grid.splice(y, 1);
        board.grid.unshift(Array(board.width).fill(null));
        linesCleared++;
        y++;
      }
    }

    if (linesCleared > 0) {
      const points = [0, 100, 300, 500, 800];
      score.score += (points[linesCleared] || 800) * score.level;
      score.lines += linesCleared;
      score.level = Math.floor(score.lines / 10) + 1;
    }
  }
}

// ============================================================
// RENDER SYSTEM
// (Completely separate from game logic — reads state only)
// ============================================================

class RenderSystem {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.cellSize = 0;
    this.boardOffsetX = 0;
    this.boardOffsetY = 0;
  }

  update(world) {
    const boardId = world.query('Board')[0];
    if (boardId === undefined) return;

    const board = world.getComponent(boardId, 'Board');
    const score = world.getComponent(boardId, 'Score');
    const state = world.getComponent(boardId, 'GameState');
    const hold = world.getComponent(boardId, 'HoldPiece');
    const nextQueue = world.getComponent(boardId, 'NextQueue');

    this.resize(board);
    const ctx = this.ctx;
    const cs = this.cellSize;
    const ox = this.boardOffsetX;
    const oy = this.boardOffsetY;

    // Background
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Board background
    ctx.fillStyle = '#000';
    ctx.fillRect(ox, oy, board.width * cs, board.height * cs);

    // Grid lines
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 0.5;
    for (let x = 0; x <= board.width; x++) {
      ctx.beginPath();
      ctx.moveTo(ox + x * cs, oy);
      ctx.lineTo(ox + x * cs, oy + board.height * cs);
      ctx.stroke();
    }
    for (let y = 0; y <= board.height; y++) {
      ctx.beginPath();
      ctx.moveTo(ox, oy + y * cs);
      ctx.lineTo(ox + board.width * cs, oy + y * cs);
      ctx.stroke();
    }

    // Locked blocks
    for (let y = board.bufferHeight; y < board.grid.length; y++) {
      for (let x = 0; x < board.width; x++) {
        if (board.grid[y][x] !== null) {
          this.drawBlock(
            ox + x * cs,
            oy + (y - board.bufferHeight) * cs,
            cs, PIECE_COLORS[board.grid[y][x]]
          );
        }
      }
    }

    // Ghost piece + active piece
    const pieceIds = world.query('ActivePiece');
    if (pieceIds.length > 0) {
      const piece = world.getComponent(pieceIds[0], 'ActivePiece');

      // Ghost
      let ghostY = piece.y;
      while (canMove(board, piece.type, piece.rotation, piece.x, ghostY + 1)) ghostY++;
      if (ghostY !== piece.y) {
        const ghostBlocks = getBlocks(piece.type, piece.rotation);
        for (const b of ghostBlocks) {
          const dy = ghostY + b.y - board.bufferHeight;
          if (dy >= 0) {
            this.drawGhostBlock(ox + (piece.x + b.x) * cs, oy + dy * cs, cs, PIECE_COLORS[piece.type]);
          }
        }
      }

      // Active piece
      const blocks = getBlocks(piece.type, piece.rotation);
      for (const b of blocks) {
        const dy = piece.y + b.y - board.bufferHeight;
        if (dy >= 0) {
          this.drawBlock(ox + (piece.x + b.x) * cs, oy + dy * cs, cs, PIECE_COLORS[piece.type]);
        }
      }
    }

    // Board border
    ctx.strokeStyle = '#888';
    ctx.lineWidth = 2;
    ctx.strokeRect(ox, oy, board.width * cs, board.height * cs);

    // Side panel positions
    const rightX = ox + board.width * cs + cs * 1.5;
    const leftX = ox - cs * 5.5;
    const fontSize = Math.max(11, cs * 0.55);
    ctx.font = `bold ${fontSize}px monospace`;
    ctx.textAlign = 'left';

    // Next queue
    ctx.fillStyle = '#aaa';
    ctx.fillText('NEXT', rightX, oy + cs * 0.8);
    if (nextQueue) {
      for (let i = 0; i < Math.min(5, nextQueue.queue.length); i++) {
        this.drawMiniPiece(rightX, oy + cs * 1.2 + i * cs * 2.8, cs * 0.65, nextQueue.queue[i]);
      }
    }

    // Hold piece
    ctx.fillStyle = '#aaa';
    ctx.fillText('HOLD', leftX, oy + cs * 0.8);
    if (hold && hold.type) {
      this.drawMiniPiece(leftX, oy + cs * 1.2, cs * 0.65, hold.type, hold.used ? 0.35 : 1);
    }

    // Score info
    ctx.fillStyle = '#aaa';
    const sy = oy + cs * 6;
    ctx.fillText('SCORE', leftX, sy);
    ctx.fillStyle = '#fff';
    ctx.fillText(score ? score.score.toString() : '0', leftX, sy + fontSize * 1.4);
    ctx.fillStyle = '#aaa';
    ctx.fillText('LINES', leftX, sy + fontSize * 3.2);
    ctx.fillStyle = '#fff';
    ctx.fillText(score ? score.lines.toString() : '0', leftX, sy + fontSize * 4.6);
    ctx.fillStyle = '#aaa';
    ctx.fillText('LEVEL', leftX, sy + fontSize * 6.4);
    ctx.fillStyle = '#fff';
    ctx.fillText(score ? score.level.toString() : '1', leftX, sy + fontSize * 7.8);

    // Controls help
    ctx.fillStyle = '#555';
    const helpSize = Math.max(9, cs * 0.35);
    ctx.font = `${helpSize}px monospace`;
    const hy = oy + board.height * cs - helpSize * 7;
    const helpLines = [
      '\u2190\u2192  Move', '\u2191 X  Rotate CW', 'Z    Rotate CCW',
      '\u2193    Soft Drop', 'Space Hard Drop', 'C    Hold',
    ];
    for (let i = 0; i < helpLines.length; i++) {
      ctx.fillText(helpLines[i], leftX, hy + i * helpSize * 1.5);
    }

    // Game over overlay
    if (state && state.phase === 'gameover') {
      ctx.fillStyle = 'rgba(0,0,0,0.75)';
      ctx.fillRect(ox, oy, board.width * cs, board.height * cs);
      ctx.fillStyle = '#fff';
      ctx.font = `bold ${cs * 1.1}px monospace`;
      ctx.textAlign = 'center';
      ctx.fillText('GAME OVER', ox + board.width * cs / 2, oy + board.height * cs / 2 - cs);
      ctx.font = `${cs * 0.55}px monospace`;
      ctx.fillText('Press R to restart', ox + board.width * cs / 2, oy + board.height * cs / 2 + cs);
      ctx.textAlign = 'left';
    }
  }

  resize(board) {
    const dpr = window.devicePixelRatio || 1;
    const w = window.innerWidth;
    const h = window.innerHeight;

    this.canvas.width = w * dpr;
    this.canvas.height = h * dpr;
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const sideCols = 12;
    const cellW = (w * 0.92) / (board.width + sideCols);
    const cellH = (h * 0.95) / board.height;
    this.cellSize = Math.floor(Math.min(cellW, cellH));

    this.boardOffsetX = Math.floor((w - board.width * this.cellSize) / 2);
    this.boardOffsetY = Math.floor((h - board.height * this.cellSize) / 2);
  }

  drawBlock(x, y, size, color) {
    const ctx = this.ctx;
    const s = size - 1;
    ctx.fillStyle = color;
    ctx.fillRect(x + 0.5, y + 0.5, s, s);
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(x + 0.5, y + 0.5, s, s * 0.12);
    ctx.fillRect(x + 0.5, y + 0.5, s * 0.12, s);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(x + s * 0.88 + 0.5, y + 0.5, s * 0.12, s);
    ctx.fillRect(x + 0.5, y + s * 0.88 + 0.5, s, s * 0.12);
  }

  drawGhostBlock(x, y, size, color) {
    const ctx = this.ctx;
    const s = size - 1;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.3;
    ctx.strokeRect(x + 1.5, y + 1.5, s - 2, s - 2);
    ctx.globalAlpha = 1;
  }

  drawMiniPiece(x, y, cellSize, type, alpha = 1) {
    const ctx = this.ctx;
    ctx.globalAlpha = alpha;
    const blocks = getBlocks(type, 0);
    for (const b of blocks) {
      this.drawBlock(x + b.x * cellSize, y + b.y * cellSize, cellSize, PIECE_COLORS[type]);
    }
    ctx.globalAlpha = 1;
  }
}

// ============================================================
// Game Setup & Main Loop
// ============================================================

export function createGame(canvas, { boardWidth = 10, boardHeight = 20, seed } = {}) {
  const rng = seedrandom(seed);
  const world = new World();
  world.seed = seed;

  const boardId = world.createEntity();
  world.addComponent(boardId, 'Board', Components.Board(boardWidth, boardHeight));
  world.addComponent(boardId, 'Score', Components.Score());
  world.addComponent(boardId, 'GameState', Components.GameState());
  world.addComponent(boardId, 'NextQueue', Components.NextQueue(rng));
  world.addComponent(boardId, 'HoldPiece', Components.HoldPiece());
  world.addComponent(boardId, 'Input', Components.Input());

  world.addSystem(new InputSystem());
  world.addSystem(new SpawnSystem());
  world.addSystem(new MovementSystem());
  world.addSystem(new GravitySystem());
  world.addSystem(new LockSystem());
  world.addSystem(new LineClearSystem());
  world.addSystem(new RenderSystem(canvas));

  function restart(newSeed) {
    for (const id of world.query('ActivePiece')) world.destroyEntity(id);
    const board = world.getComponent(boardId, 'Board');
    for (let y = 0; y < board.grid.length; y++) board.grid[y].fill(null);
    const score = world.getComponent(boardId, 'Score');
    Object.assign(score, { score: 0, lines: 0, level: 1 });
    const state = world.getComponent(boardId, 'GameState');
    Object.assign(state, { phase: 'playing', lockTimer: 0, lockResets: 0, hardDropping: false });
    const nq = world.getComponent(boardId, 'NextQueue');
    nq.queue = [];
    nq.rng = seedrandom(newSeed);
    world.seed = newSeed;
    const hold = world.getComponent(boardId, 'HoldPiece');
    Object.assign(hold, { type: null, used: false });
  }

  world.restart = restart;

  document.addEventListener('keydown', e => {
    if (e.key.toLowerCase() === 'r') {
      const state = world.getComponent(boardId, 'GameState');
      if (state.phase === 'gameover') {
        restart(seed);
      }
    }
  });

  return world;
}


import { PIECE_SHAPES } from './pieces.js';
import { getBlocks } from './pieces.js';
import { Components } from './components.js';
import { canMove, shuffledBag, getDropInterval } from './helpers.js';

// --- SpawnSystem: creates a new active piece when none exists ---

export class SpawnSystem {
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
    const spawnY = board.bufferHeight + Math.max(0, board.height - board.visualHeight) - 2;

    if (!canMove(board, type, 0, spawnX, spawnY)) {
      state.phase = 'gameover';
      return;
    }

    const score = world.getComponent(boardId, 'Score');
    const table = world.getComponent(boardId, 'PieceTable');
    const instanceId = table.freeIds.length > 0 ? table.freeIds.pop() : table.nextId++;
    table.pieces[instanceId] = { type };

    const pieceId = world.createEntity();
    world.addComponent(pieceId, 'ActivePiece', Components.ActivePiece(type, spawnX, spawnY, 0, instanceId));
    world.addComponent(pieceId, 'Drop', Components.Drop(getDropInterval(score.level)));

    state.phase = 'playing';
    state.lockTimer = 0;
    state.lockResets = 0;
  }
}

// --- InputSystem: reads keyboard and queues actions ---

export class InputSystem {
  constructor() {
    this.keys = {};
    this.das = {};
    this.dasDelay = 11;
    this.dasRepeat = 3;
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

  update(world) {
    for (const code of ['ArrowLeft', 'ArrowRight', 'ArrowDown']) {
      if (this.keys[code] && this.das[code]) {
        this.das[code].timer++;
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

export class MovementSystem {
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
          if (canMove(board, piece.type, piece.rotation, piece.x, piece.y + 1)) {
            piece.y++;
            const score = world.getComponent(boardId, 'Score');
            score.score++;
            drop.timer = 0;
          }
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
    const oldPieceId = piece.pieceId;

    if (hold.type === null) {
      hold.type = oldType;
      hold.pieceId = oldPieceId;
      world.destroyEntity(pieceId);
    } else {
      const swapType = hold.type;
      const swapPieceId = hold.pieceId;
      hold.type = oldType;
      hold.pieceId = oldPieceId;
      const spawnX = Math.floor((board.width - PIECE_SHAPES[swapType][0].length) / 2);
      const spawnY = board.bufferHeight + Math.max(0, board.height - board.visualHeight) - 2;
      piece.type = swapType;
      piece.pieceId = swapPieceId;
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

export class GravitySystem {
  update(world) {
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

    drop.timer++;

    while (drop.timer >= drop.interval) {
      drop.timer -= drop.interval;
      if (canMove(board, piece.type, piece.rotation, piece.x, piece.y + 1)) {
        piece.y++;
      } else {
        drop.timer = 0;
        break;
      }
    }
  }
}

// --- LockSystem: locks piece to board when grounded ---

export class LockSystem {
  update(world) {
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
          board.grid[gy][gx] = piece.pieceId;
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
      state.lockTimer++;
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

export class LineClearSystem {
  clearFullRows(board) {
    let linesCleared = 0;
    for (let y = board.grid.length - 1; y >= 0; y--) {
      if (board.grid[y].every(cell => cell !== null)) {
        board.grid.splice(y, 1);
        board.grid.unshift(Array(board.width).fill(null));
        linesCleared++;
        y++;
      }
    }
    return linesCleared;
  }

  findConnectedGroups(board) {
    const visited = Array.from({ length: board.grid.length }, () =>
      Array(board.width).fill(false)
    );
    const groups = [];
    for (let y = 0; y < board.grid.length; y++) {
      for (let x = 0; x < board.width; x++) {
        if (board.grid[y][x] !== null && !visited[y][x]) {
          const pieceId = board.grid[y][x];
          const cells = [];
          const stack = [{ x, y }];
          visited[y][x] = true;
          while (stack.length > 0) {
            const cell = stack.pop();
            cells.push(cell);
            for (const [dx, dy] of [[0,1],[0,-1],[1,0],[-1,0]]) {
              const nx = cell.x + dx;
              const ny = cell.y + dy;
              if (ny >= 0 && ny < board.grid.length && nx >= 0 && nx < board.width &&
                  !visited[ny][nx] && board.grid[ny][nx] === pieceId) {
                visited[ny][nx] = true;
                stack.push({ x: nx, y: ny });
              }
            }
          }
          groups.push(cells);
        }
      }
    }
    return groups;
  }

  compactColumns(board) {
    const cellDrops = {};
    let anyMoved = true;
    while (anyMoved) {
      anyMoved = false;
      const groups = this.findConnectedGroups(board);
      // Sort bottom-first (highest maxY first) for faster convergence
      groups.sort((a, b) => {
        let maxA = 0, maxB = 0;
        for (const c of a) if (c.y > maxA) maxA = c.y;
        for (const c of b) if (c.y > maxB) maxB = c.y;
        return maxB - maxA;
      });
      for (const group of groups) {
        const groupCellSet = new Set(group.map(c => c.x + ',' + c.y));
        let minDrop = board.grid.length;
        for (const cell of group) {
          let drop = 0;
          for (let y = cell.y + 1; y < board.grid.length; y++) {
            if (board.grid[y][cell.x] !== null && !groupCellSet.has(cell.x + ',' + y)) {
              break;
            }
            drop++;
          }
          minDrop = Math.min(minDrop, drop);
        }
        if (minDrop > 0) {
          anyMoved = true;
          const cellData = group.map(c => ({
            x: c.x, y: c.y,
            id: board.grid[c.y][c.x],
            prevDrop: cellDrops[c.x + ',' + c.y] || 0,
          }));
          for (const cell of cellData) {
            delete cellDrops[cell.x + ',' + cell.y];
            board.grid[cell.y][cell.x] = null;
          }
          for (const cell of cellData) {
            const newY = cell.y + minDrop;
            board.grid[newY][cell.x] = cell.id;
            cellDrops[cell.x + ',' + newY] = cell.prevDrop + minDrop;
          }
        }
      }
    }
    return cellDrops;
  }

  recyclePieceIds(world, boardId, board, table) {
    const alive = new Set();
    for (const row of board.grid) {
      for (const cell of row) {
        if (cell !== null) alive.add(cell);
      }
    }
    const hold = world.getComponent(boardId, 'HoldPiece');
    if (hold && hold.pieceId !== null) alive.add(hold.pieceId);
    const activeIds = world.query('ActivePiece');
    for (const id of activeIds) {
      const ap = world.getComponent(id, 'ActivePiece');
      if (ap && ap.pieceId !== null) alive.add(ap.pieceId);
    }
    for (const id of Object.keys(table.pieces)) {
      if (!alive.has(Number(id))) {
        delete table.pieces[id];
        table.freeIds.push(Number(id));
      }
    }
  }

  update(world) {
    const boardId = world.query('Board', 'Score')[0];
    if (boardId === undefined) return;
    if (world.query('ActivePiece').length > 0) return;

    const board = world.getComponent(boardId, 'Board');
    const score = world.getComponent(boardId, 'Score');
    const table = world.getComponent(boardId, 'PieceTable');
    const points = [0, 100, 300, 500, 800];

    if (board.cascadeGravity) {
      let totalLines = 0;
      board.cascadeAnimQueue = [];
      let linesCleared = this.clearFullRows(board);
      while (linesCleared > 0) {
        score.score += (points[linesCleared] || 800) * score.level;
        totalLines += linesCleared;
        const falls = this.compactColumns(board);
        if (Object.keys(falls).length > 0) {
          const snapshot = board.grid.map(row =>
            row.map(cell => cell !== null ? table.pieces[cell].type : null)
          );
          const ids = board.grid.map(row => [...row]);
          board.cascadeAnimQueue.push({ grid: snapshot, ids, falls });
        }
        linesCleared = this.clearFullRows(board);
      }
      if (totalLines > 0) {
        score.lines += totalLines;
        score.level = Math.floor(score.lines / 10) + 1;
        this.recyclePieceIds(world, boardId, board, table);
      }
    } else {
      const linesCleared = this.clearFullRows(board);
      if (linesCleared > 0) {
        score.score += (points[linesCleared] || 800) * score.level;
        score.lines += linesCleared;
        score.level = Math.floor(score.lines / 10) + 1;
        this.recyclePieceIds(world, boardId, board, table);
      }
    }
  }
}

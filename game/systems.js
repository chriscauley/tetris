import { PIECE_SHAPES, G } from './pieces.js';
import { getBlocks } from './pieces.js';
import { Components } from './components.js';
import { canMove, shuffledBag, getDropInterval } from './helpers.js';

// --- SpawnSystem: creates a new active piece when none exists ---

export class SpawnSystem {
  update(world) {
    const boardId = world.query('Board', 'GameState')[0];
    if (boardId === undefined) return;
    const state = world.getComponent(boardId, 'GameState');
    if (state.phase === 'gameover' || state.phase === 'victory') return;

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

export const DEFAULT_KEY_MAP = {
  left: ['ArrowLeft'],
  right: ['ArrowRight'],
  softdrop: ['ArrowDown'],
  rotate_cw: ['ArrowUp', 'KeyX'],
  rotate_ccw: ['KeyZ'],
  harddrop: ['Space'],
  hold: ['KeyC', 'ShiftLeft', 'ShiftRight'],
  shake: ['ControlLeft'],
};

const buildReverseMap = (keyMap) => {
  const rev = {};
  for (const [action, codes] of Object.entries(keyMap)) {
    for (const code of codes) rev[code] = action;
  }
  return rev;
};

export class InputSystem {
  constructor(keyMap) {
    this.keys = {};
    this.das = {};
    this.dasDelay = 11;
    this.dasRepeat = 3;
    this.actionQueue = [];

    const km = keyMap || DEFAULT_KEY_MAP;
    this.reverseMap = buildReverseMap(km);
    this.preventCodes = new Set(Object.keys(this.reverseMap));
    this.dasCodes = new Set(
      Object.keys(this.reverseMap).filter(c => ['left', 'right', 'softdrop'].includes(this.reverseMap[c]))
    );

    this._onKeyDown = e => {
      if (this.preventCodes.has(e.code)) e.preventDefault();
      if (!this.keys[e.code]) {
        this.keys[e.code] = true;
        this.das[e.code] = { timer: 0, fired: false };
        const action = this.reverseMap[e.code];
        if (action) this.actionQueue.push(action);
      }
    };

    this._onKeyUp = e => {
      this.keys[e.code] = false;
      delete this.das[e.code];
      const action = this.reverseMap[e.code];
      if (action === 'softdrop') this.actionQueue.push('softdrop_release');
      if (action === 'harddrop') this.actionQueue.push('harddrop_release');
    };

    document.addEventListener('keydown', this._onKeyDown);
    document.addEventListener('keyup', this._onKeyUp);
  }

  destroy() {
    document.removeEventListener('keydown', this._onKeyDown);
    document.removeEventListener('keyup', this._onKeyUp);
  }

  update(world) {
    for (const code of this.dasCodes) {
      if (this.keys[code] && this.das[code]) {
        this.das[code].timer++;
        if (!this.das[code].fired && this.das[code].timer >= this.dasDelay) {
          this.das[code].fired = true;
          this.das[code].timer = 0;
          this.actionQueue.push(this.reverseMap[code]);
        } else if (this.das[code].fired && this.das[code].timer >= this.dasRepeat) {
          this.das[code].timer = 0;
          this.actionQueue.push(this.reverseMap[code]);
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
    if (state.phase === 'gameover' || state.phase === 'victory') return;

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
        case 'shake':
          board.shakeRequested = true;
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
    if (state.phase === 'gameover' || state.phase === 'victory' || state.phase === 'lock_now' || state.hardDropping) return;

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
    if (state.phase === 'gameover' || state.phase === 'victory') return;

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
      board.gridVersion++;
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
    const clearedRows = [];
    for (let y = board.grid.length - 1; y >= 0; y--) {
      if (board.grid[y].every(cell => cell !== null)) {
        clearedRows.push(y - clearedRows.length);
        board.grid.splice(y, 1);
        board.grid.unshift(Array(board.width).fill(null));
        y++;
      }
    }
    return clearedRows;
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

  compactColumns(board, table) {
    const cellDrops = {};
    for (;;) {
      const groups = this.findConnectedGroups(board);

      // Map each cell position to its group index
      const cellToGroup = {};
      for (let gi = 0; gi < groups.length; gi++) {
        for (const cell of groups[gi]) cellToGroup[cell.x + ',' + cell.y] = gi;
      }

      // Identify ground-supported groups + build support graph
      const supported = new Set();
      const restsOn = {};
      for (let gi = 0; gi < groups.length; gi++) {
        const pieceId = board.grid[groups[gi][0].y][groups[gi][0].x];
        if (table && table.pieces[pieceId] && table.pieces[pieceId].type === G) {
          supported.add(gi);
          continue;
        }
        restsOn[gi] = new Set();
        for (const cell of groups[gi]) {
          if (cell.y + 1 >= board.grid.length) {
            supported.add(gi);
          } else {
            const belowGroup = cellToGroup[cell.x + ',' + (cell.y + 1)];
            if (belowGroup !== undefined && belowGroup !== gi) restsOn[gi].add(belowGroup);
          }
        }
      }

      // Propagate support upward
      let changed = true;
      while (changed) {
        changed = false;
        for (let gi = 0; gi < groups.length; gi++) {
          if (supported.has(gi) || !restsOn[gi]) continue;
          for (const dep of restsOn[gi]) {
            if (supported.has(dep)) { supported.add(gi); changed = true; break; }
          }
        }
      }

      // Collect unsupported non-garbage groups
      const unsupported = [];
      for (let gi = 0; gi < groups.length; gi++) {
        if (!supported.has(gi)) unsupported.push(gi);
      }
      if (unsupported.length === 0) break;

      // Find islands: connected components among unsupported via support edges
      const unsupportedSet = new Set(unsupported);
      const adj = {};
      for (const gi of unsupported) adj[gi] = new Set();
      for (const gi of unsupported) {
        if (!restsOn[gi]) continue;
        for (const dep of restsOn[gi]) {
          if (unsupportedSet.has(dep)) { adj[gi].add(dep); adj[dep].add(gi); }
        }
      }
      const visited = new Set();
      const islands = [];
      for (const gi of unsupported) {
        if (visited.has(gi)) continue;
        const island = [];
        const stack = [gi];
        visited.add(gi);
        while (stack.length > 0) {
          const node = stack.pop();
          island.push(node);
          for (const neighbor of adj[node]) {
            if (!visited.has(neighbor)) { visited.add(neighbor); stack.push(neighbor); }
          }
        }
        islands.push(island);
      }

      // Drop each island
      let anyMoved = false;
      for (const island of islands) {
        const combinedCells = [];
        for (const gi of island) {
          for (const cell of groups[gi]) combinedCells.push(cell);
        }
        const combinedSet = new Set(combinedCells.map(c => c.x + ',' + c.y));
        let minDrop = board.grid.length;
        for (const cell of combinedCells) {
          let drop = 0;
          for (let y = cell.y + 1; y < board.grid.length; y++) {
            if (board.grid[y][cell.x] !== null && !combinedSet.has(cell.x + ',' + y)) break;
            drop++;
          }
          minDrop = Math.min(minDrop, drop);
        }
        if (minDrop > 0) {
          anyMoved = true;
          const cellData = combinedCells.map(c => ({
            x: c.x, y: c.y, id: board.grid[c.y][c.x],
            prevDrop: cellDrops[c.x + ',' + c.y] || 0,
          }));
          for (const cell of cellData) { delete cellDrops[cell.x + ',' + cell.y]; board.grid[cell.y][cell.x] = null; }
          for (const cell of cellData) {
            const newY = cell.y + minDrop;
            board.grid[newY][cell.x] = cell.id;
            cellDrops[cell.x + ',' + newY] = cell.prevDrop + minDrop;
          }
        }
      }
      if (!anyMoved) break;
    }
    return cellDrops;
  }

  mergeByType(board, table) {
    const visited = Array.from({ length: board.grid.length }, () =>
      Array(board.width).fill(false)
    );
    for (let y = 0; y < board.grid.length; y++) {
      for (let x = 0; x < board.width; x++) {
        if (board.grid[y][x] !== null && !visited[y][x]) {
          const pieceId = board.grid[y][x];
          const type = table.pieces[pieceId].type;
          if (type === G) { visited[y][x] = true; continue; }
          const cells = [];
          const ids = new Set();
          const stack = [{ x, y }];
          visited[y][x] = true;
          while (stack.length > 0) {
            const cell = stack.pop();
            cells.push(cell);
            ids.add(board.grid[cell.y][cell.x]);
            for (const [dx, dy] of [[0,1],[0,-1],[1,0],[-1,0]]) {
              const nx = cell.x + dx;
              const ny = cell.y + dy;
              if (ny >= 0 && ny < board.grid.length && nx >= 0 && nx < board.width &&
                  !visited[ny][nx] && board.grid[ny][nx] !== null &&
                  table.pieces[board.grid[ny][nx]].type === type) {
                visited[ny][nx] = true;
                stack.push({ x: nx, y: ny });
              }
            }
          }
          if (ids.size > 1) {
            for (const cell of cells) {
              board.grid[cell.y][cell.x] = pieceId;
            }
          }
        }
      }
    }
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

    const board = world.getComponent(boardId, 'Board');
    if (board.manualShake && board.shakeRequested) {
      board.shakeRequested = false;
      this.performShake(world, boardId);
    }

    if (world.query('ActivePiece').length > 0) return;
    const state = world.getComponent(boardId, 'GameState');
    if (state && (state.phase === 'gameover' || state.phase === 'victory')) return;

    const score = world.getComponent(boardId, 'Score');
    const table = world.getComponent(boardId, 'PieceTable');
    const gm = world.getComponent(boardId, 'GameMode');
    const startLevel = gm ? gm.startLevel : 1;
    const points = [0, 100, 300, 500, 800];

    if (board.gravityMode !== 'normal' && !board.manualShake) {
      let totalLines = 0;
      board.cascadeAnimQueue = [];
      if (board.gravityMode === 'sticky') this.mergeByType(board, table);
      let flashGrid = board.grid.map(row => row.map(cell => cell !== null ? table.pieces[cell].type : null));
      let flashIds = board.grid.map(row => [...row]);
      let clearedRows = this.clearFullRows(board);
      while (clearedRows.length > 0) {
        score.score += (points[clearedRows.length] || 800) * score.level;
        totalLines += clearedRows.length;
        if (board.gravityMode === 'sticky') this.mergeByType(board, table);
        const falls = this.compactColumns(board, table);
        const grid = board.grid.map(row => row.map(cell => cell !== null ? table.pieces[cell].type : null));
        const ids = board.grid.map(row => [...row]);
        board.cascadeAnimQueue.push({ flashGrid, flashIds, clearedRows, grid, ids, falls });
        flashGrid = grid;
        flashIds = ids;
        clearedRows = this.clearFullRows(board);
      }
      if (totalLines > 0) {
        board.gridVersion++;
        score.lines += totalLines;
        if (startLevel > 0) score.level = Math.floor(score.lines / 10) + startLevel;
        this.recyclePieceIds(world, boardId, board, table);
        this.checkVictory(world, boardId, score, gm);
      }
    } else {
      if (board.gravityMode === 'sticky') this.mergeByType(board, table);
      const flashGrid = board.grid.map(row => row.map(cell => cell !== null ? table.pieces[cell].type : null));
      const flashIds = board.grid.map(row => [...row]);
      const clearedRows = this.clearFullRows(board);
      if (clearedRows.length > 0) {
        board.gridVersion++;
        const linesCleared = clearedRows.length;
        score.score += (points[linesCleared] || 800) * score.level;
        score.lines += linesCleared;
        if (startLevel > 0) score.level = Math.floor(score.lines / 10) + startLevel;
        const clearedSet = new Set(clearedRows);
        const survivingOrigYs = [];
        for (let y = 0; y < flashGrid.length; y++) {
          if (!clearedSet.has(y)) survivingOrigYs.push(y);
        }
        const falls = {};
        for (let i = 0; i < survivingOrigYs.length; i++) {
          const postClearY = linesCleared + i;
          const fallDist = postClearY - survivingOrigYs[i];
          if (fallDist > 0) {
            for (let x = 0; x < board.width; x++) {
              if (board.grid[postClearY][x] !== null) falls[x + ',' + postClearY] = fallDist;
            }
          }
        }
        const grid = board.grid.map(row => row.map(cell => cell !== null ? table.pieces[cell].type : null));
        const ids = board.grid.map(row => [...row]);
        board.cascadeAnimQueue = [{ flashGrid, flashIds, clearedRows, grid, ids, falls }];
        this.recyclePieceIds(world, boardId, board, table);
        this.checkVictory(world, boardId, score, gm);
      }
    }
  }

  performShake(world, boardId) {
    const board = world.getComponent(boardId, 'Board');
    if (board.shakeAnimation) board.screenShake = { timer: 0, duration: 12 };
    const table = world.getComponent(boardId, 'PieceTable');
    const score = world.getComponent(boardId, 'Score');
    const gm = world.getComponent(boardId, 'GameMode');
    const startLevel = gm ? gm.startLevel : 1;
    const points = [0, 100, 300, 500, 800];

    if (board.gravityMode === 'sticky') this.mergeByType(board, table);

    const preGrid = board.grid.map(row => row.map(cell => cell !== null ? table.pieces[cell].type : null));
    const preIds = board.grid.map(row => [...row]);
    const falls = this.compactColumns(board, table);
    if (Object.keys(falls).length === 0) return;

    board.gridVersion++;
    const postGrid = board.grid.map(row => row.map(cell => cell !== null ? table.pieces[cell].type : null));
    const postIds = board.grid.map(row => [...row]);

    // Fall-only animation (no clearedRows → state machine skips flash)
    board.cascadeAnimQueue.push({ flashGrid: preGrid, flashIds: preIds, clearedRows: null, grid: postGrid, ids: postIds, falls });

    const clearedRows = this.clearFullRows(board);
    if (clearedRows.length > 0) {
      const linesCleared = clearedRows.length;
      score.score += (points[linesCleared] || 800) * score.level;
      score.lines += linesCleared;
      if (startLevel > 0) score.level = Math.floor(score.lines / 10) + startLevel;

      // Compute splice-falls (same math as normal mode)
      const flashGrid = postGrid;
      const flashIds = postIds;
      const clearedSet = new Set(clearedRows);
      const survivingOrigYs = [];
      for (let y = 0; y < flashGrid.length; y++) {
        if (!clearedSet.has(y)) survivingOrigYs.push(y);
      }
      const spliceFalls = {};
      for (let i = 0; i < survivingOrigYs.length; i++) {
        const postClearY = linesCleared + i;
        const fallDist = postClearY - survivingOrigYs[i];
        if (fallDist > 0) {
          for (let x = 0; x < board.width; x++) {
            if (board.grid[postClearY][x] !== null) spliceFalls[x + ',' + postClearY] = fallDist;
          }
        }
      }
      const grid = board.grid.map(row => row.map(cell => cell !== null ? table.pieces[cell].type : null));
      const ids = board.grid.map(row => [...row]);
      board.cascadeAnimQueue.push({ flashGrid, flashIds, clearedRows, grid, ids, falls: spliceFalls });

      this.recyclePieceIds(world, boardId, board, table);
      this.checkVictory(world, boardId, score, gm);
    }
  }

  checkVictory(world, boardId, score, gm) {
    if (!gm || gm.linesGoal === null) return;
    if (score.lines >= gm.linesGoal) {
      const state = world.getComponent(boardId, 'GameState');
      state.phase = 'victory';
    }
  }
}

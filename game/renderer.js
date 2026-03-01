import { PIECE_COLORS, PIECE_TYPES, getBlocks } from './pieces.js';
import { canMove } from './helpers.js';

// Pre-compute mini piece block positions and neighbor data
const MINI_PIECE_DATA = {};
for (const type of PIECE_TYPES) {
  const blocks = getBlocks(type, 0);
  const blockSet = new Set(blocks.map(b => b.x + ',' + b.y));
  MINI_PIECE_DATA[type] = blocks.map(b => ({
    x: b.x, y: b.y,
    nb: {
      top:    blockSet.has(b.x + ',' + (b.y - 1)),
      bottom: blockSet.has(b.x + ',' + (b.y + 1)),
      left:   blockSet.has((b.x - 1) + ',' + b.y),
      right:  blockSet.has((b.x + 1) + ',' + b.y),
    },
  }));
}

export class RenderSystem {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.cellSize = 0;
    this.boardOffsetX = 0;
    this.boardOffsetY = 0;
    this.scrollTarget = 0;
    this._gradientCache = null;
    this._gradientOy = null;
    this._gradientCs = null;
    this._ghostCache = { ghostY: 0, pieceX: -1, pieceY: -1, pieceType: -1, pieceRotation: -1, boardVersion: -1 };
    this._neighborCache = null;
    this._neighborCacheVersion = -1;
    this._offscreenCanvas = null;
    this._offscreenCtx = null;
    this._offscreenVersion = -1;
    this._offscreenCellSize = 0;
    this._offscreenDpr = 0;
    this._offscreenWidth = 0;
    this._offscreenHeight = 0;
  }

  update(world) {
    const boardId = world.query('Board')[0];
    if (boardId === undefined) return;

    const board = world.getComponent(boardId, 'Board');
    const score = world.getComponent(boardId, 'Score');
    const state = world.getComponent(boardId, 'GameState');
    const hold = world.getComponent(boardId, 'HoldPiece');
    const nextQueue = world.getComponent(boardId, 'NextQueue');
    const pieceTable = world.getComponent(boardId, 'PieceTable');

    this.resize(board);

    const highestRow = this.getHighestRow(board);

    // Scroll for tall boards: when highest placed block exceeds 12 lines from bottom,
    // shift the board down (camera up) so higher rows become visible.
    const VISUAL_HEIGHT = 20;
    if (board.height > VISUAL_HEIGHT) {
      const linesFromBottom = board.height - highestRow;
      const scrollRows = Math.max(0, linesFromBottom - 12);
      const baseY = this.visualTop + (VISUAL_HEIGHT - board.height) * this.cellSize;
      this.scrollTarget = Math.min(baseY + scrollRows * this.cellSize, 0);
      // Lerp toward target
      const diff = this.scrollTarget - this.boardOffsetY;
      if (Math.abs(diff) < 0.5) {
        this.boardOffsetY = this.scrollTarget;
      } else {
        this.boardOffsetY += diff * 0.08;
      }
    }

    world.ui = {
      cellSize: this.cellSize,
      boardX: this.boardOffsetX,
      boardY: this.visualTop,
      highestRow: highestRow < board.height ? board.height - highestRow : 0,
      seed: world.seed,
      boardHeight: board.height,
      gravityMode: board.gravityMode,
      manualShake: board.manualShake,
    };

    const ctx = this.ctx;
    const cs = this.cellSize;
    let ox = this.boardOffsetX;
    const oy = this.boardOffsetY;

    // Screen shake offset
    if (board.screenShake) {
      const s = board.screenShake;
      const t = s.timer / s.duration;
      ox += Math.sin(s.timer * 2.5) * cs * 0.3 * (1 - t);
      s.timer++;
      if (s.timer >= s.duration) board.screenShake = null;
    }

    // Background
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Advance cascade animation state machine
    const slowdown = world.debug?.animSlowdown ?? 1;
    this.advanceCascadeAnim(board, slowdown);

    const dpr = window.devicePixelRatio || 1;
    const anim = board.cascadeAnim;

    if (anim) {
      // During cascade animation: draw directly, mark offscreen stale
      this._offscreenVersion = -1;

      // Board background
      ctx.fillStyle = '#000';
      ctx.fillRect(ox, oy, board.width * cs, board.height * cs);

      // Grid lines
      this._drawGridLines(ctx, ox, oy, board, cs);

      // Draw from appropriate snapshot based on phase
      const snapGrid = anim.phase === 'flash' ? anim.flashGrid : anim.grid;
      const snapIds = anim.phase === 'flash' ? anim.flashIds : anim.ids;
      for (let y = board.bufferHeight; y < snapGrid.length; y++) {
        for (let x = 0; x < board.width; x++) {
          const type = snapGrid[y][x];
          if (type !== null) {
            let drawY = y - board.bufferHeight;
            if (anim.phase === 'fall') {
              const key = x + ',' + y;
              const dist = anim.falls[key];
              if (dist !== undefined) {
                const t = Math.min(anim.timer / anim.fallDuration, 1);
                const eased = t * (2 - t);
                drawY -= dist * (1 - eased);
              }
            }
            const nb = board.gravityMode === 'sticky'
              ? this.gridNeighbors(snapGrid, x, y)
              : this.gridNeighbors(snapIds, x, y);
            this.drawBlock(
              ox + x * cs,
              oy + drawY * cs,
              cs, PIECE_COLORS[type], nb
            );
          }
        }
      }

      // Flash overlay on cleared rows
      if (anim.phase === 'flash' && anim.clearedRows) {
        const t = anim.timer / anim.flashDuration;
        const alpha = 0.8 * (1 - t);
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        for (const row of anim.clearedRows) {
          ctx.fillRect(ox, oy + (row - board.bufferHeight) * cs, board.width * cs, cs);
        }
      }
    } else {
      // No animation: use offscreen canvas
      if (this._neighborCacheVersion !== board.gridVersion) {
        this._buildNeighborCache(board, pieceTable);
      }
      if (this._offscreenVersion !== board.gridVersion ||
          this._offscreenCellSize !== cs ||
          this._offscreenDpr !== dpr) {
        this._buildOffscreenGrid(board, pieceTable, cs, dpr);
      }
      ctx.drawImage(this._offscreenCanvas, 0, 0, this._offscreenCanvas.width, this._offscreenCanvas.height, ox, oy, board.width * cs, board.height * cs);
    }

    // Ghost piece + active piece
    const pieceIds = world.query('ActivePiece');
    if (pieceIds.length > 0) {
      const piece = world.getComponent(pieceIds[0], 'ActivePiece');
      const blocks = getBlocks(piece.type, piece.rotation);
      const blockSet = new Set(blocks.map(b => b.x + ',' + b.y));

      // Ghost (cached position)
      let ghostY;
      const gc = this._ghostCache;
      if (gc.pieceX === piece.x && gc.pieceY === piece.y &&
          gc.pieceType === piece.type && gc.pieceRotation === piece.rotation &&
          gc.boardVersion === board.gridVersion) {
        ghostY = gc.ghostY;
      } else {
        ghostY = piece.y;
        while (canMove(board, piece.type, piece.rotation, piece.x, ghostY + 1)) ghostY++;
        gc.ghostY = ghostY;
        gc.pieceX = piece.x;
        gc.pieceY = piece.y;
        gc.pieceType = piece.type;
        gc.pieceRotation = piece.rotation;
        gc.boardVersion = board.gridVersion;
      }
      if (ghostY !== piece.y) {
        ctx.strokeStyle = PIECE_COLORS[piece.type];
        ctx.lineWidth = 3;
        ctx.globalAlpha = 0.6;
        const gs = cs - 1;
        for (const b of blocks) {
          const dy = ghostY + b.y - board.bufferHeight;
          if (dy >= 0) {
            ctx.strokeRect(ox + (piece.x + b.x) * cs + 1.5, oy + dy * cs + 1.5, gs - 2, gs - 2);
          }
        }
        ctx.globalAlpha = 1;
      }

      // Active piece
      for (const b of blocks) {
        const dy = piece.y + b.y - board.bufferHeight;
        if (dy >= 0) {
          const nb = this.blockSetNeighbors(blockSet, b.x, b.y);
          this.drawBlock(ox + (piece.x + b.x) * cs, oy + dy * cs, cs, PIECE_COLORS[piece.type], nb);
        }
      }
    }

    // Red gradient at top of board (danger zone, 4 lines)
    const gradTop = oy;
    const gradBot = oy + 4 * cs;
    if (this._gradientOy !== oy || this._gradientCs !== cs) {
      const grad = ctx.createLinearGradient(0, gradTop, 0, gradBot);
      grad.addColorStop(0, 'rgba(255, 0, 0, 0.35)');
      grad.addColorStop(1, 'rgba(255, 0, 0, 0)');
      this._gradientCache = grad;
      this._gradientOy = oy;
      this._gradientCs = cs;
    }
    ctx.fillStyle = this._gradientCache;
    ctx.fillRect(ox, gradTop, board.width * cs, 4 * cs);

    // Scroll threshold line (12 lines from bottom)
    if (board.height > VISUAL_HEIGHT) {
      const thresholdY = oy + (board.height - 12) * cs;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(ox, thresholdY);
      ctx.lineTo(ox + board.width * cs, thresholdY);
      ctx.stroke();
    }

    // Board border
    ctx.strokeStyle = '#888';
    ctx.lineWidth = 2;
    ctx.strokeRect(ox, oy, board.width * cs, board.height * cs);

    // Side panel positions
    const rightX = ox + board.width * cs + cs * 1.5;
    const leftX = ox - cs * 5.5;

    // Next queue (mini pieces only) — anchored to visual area, not scrolling board
    const vy = this.visualTop;
    if (nextQueue) {
      for (let i = 0; i < Math.min(5, nextQueue.queue.length); i++) {
        this.drawMiniPiece(rightX, vy + cs * 1.2 + i * cs * 2.8, cs * 0.65, nextQueue.queue[i]);
      }
    }

    // Hold piece (mini piece only) — anchored to visual area
    if (hold && hold.type) {
      this.drawMiniPiece(leftX, vy + cs * 1.2, cs * 0.65, hold.type, hold.used ? 0.35 : 1);
    }
  }

  resize(board) {
    const VISUAL_HEIGHT = 20;
    const dpr = window.devicePixelRatio || 1;
    const parent = this.canvas.parentElement;
    const w = parent ? parent.clientWidth : window.innerWidth;
    const h = parent ? parent.clientHeight : window.innerHeight;

    this.canvas.width = w * dpr;
    this.canvas.height = h * dpr;
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const sideCols = 12;
    const cellW = (w * 0.92) / (board.width + sideCols);
    const cellH = (h * 0.95) / VISUAL_HEIGHT;
    this.cellSize = Math.floor(Math.min(cellW, cellH));

    this.boardOffsetX = Math.floor((w - board.width * this.cellSize) / 2);
    const visualTop = Math.floor((h - VISUAL_HEIGHT * this.cellSize) / 2);
    this.visualTop = visualTop;
    // Base position: board bottom-aligned to the bottom of the visual area
    this.baseBoardOffsetY = visualTop + (VISUAL_HEIGHT - board.height) * this.cellSize;
    // For short boards, set directly (no scroll logic applies)
    if (board.height <= VISUAL_HEIGHT) {
      this.boardOffsetY = this.baseBoardOffsetY;
    }
  }

  getHighestRow(board) {
    for (let y = board.bufferHeight; y < board.grid.length; y++) {
      for (let x = 0; x < board.width; x++) {
        if (board.grid[y][x] !== null) {
          return y - board.bufferHeight;
        }
      }
    }
    return board.height;
  }

  advanceCascadeAnim(board, slowdown) {
    const flashDur = Math.round(10 * slowdown);
    const fallDur = Math.round(8 * slowdown);
    const pauseDur = Math.round(4 * slowdown);
    const startStep = (step) => {
      if (step.clearedRows && step.clearedRows.length > 0) {
        board.cascadeAnim = { ...step, phase: 'flash', timer: 0, flashDuration: flashDur, fallDuration: fallDur };
      } else {
        board.cascadeAnim = { ...step, phase: 'fall', timer: 0, fallDuration: fallDur };
      }
    };
    if (!board.cascadeAnim && board.cascadeAnimQueue.length > 0) {
      startStep(board.cascadeAnimQueue.shift());
      return;
    }
    if (!board.cascadeAnim) return;
    const anim = board.cascadeAnim;
    anim.timer++;
    const endOrPause = () => {
      if (board.cascadeAnimQueue.length > 0) {
        anim.phase = 'pause';
        anim.timer = 0;
        anim.pauseDuration = pauseDur;
      } else {
        board.cascadeAnim = null;
      }
    };
    if (anim.phase === 'flash' && anim.timer >= anim.flashDuration) {
      if (Object.keys(anim.falls).length > 0) {
        anim.phase = 'fall';
        anim.timer = 0;
      } else {
        endOrPause();
      }
    } else if (anim.phase === 'fall' && anim.timer >= anim.fallDuration) {
      endOrPause();
    } else if (anim.phase === 'pause' && anim.timer >= anim.pauseDuration) {
      startStep(board.cascadeAnimQueue.shift());
    }
  }

  _buildNeighborCache(board, pieceTable) {
    const rows = board.grid.length;
    const cols = board.width;
    if (!this._neighborCache || this._neighborCache.length !== rows || this._neighborCache[0].length !== cols) {
      this._neighborCache = Array.from({ length: rows }, () => Array(cols).fill(null));
    }
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        if (board.grid[y][x] !== null) {
          this._neighborCache[y][x] = board.gravityMode === 'sticky'
            ? this.gridNeighborsByType(board.grid, pieceTable, x, y)
            : this.gridNeighbors(board.grid, x, y);
        } else {
          this._neighborCache[y][x] = null;
        }
      }
    }
    this._neighborCacheVersion = board.gridVersion;
  }

  _drawGridLines(ctx, ox, oy, board, cs) {
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    for (let x = 0; x <= board.width; x++) {
      ctx.moveTo(ox + x * cs, oy);
      ctx.lineTo(ox + x * cs, oy + board.height * cs);
    }
    for (let y = 0; y <= board.height; y++) {
      ctx.moveTo(ox, oy + y * cs);
      ctx.lineTo(ox + board.width * cs, oy + y * cs);
    }
    ctx.stroke();
  }

  _buildOffscreenGrid(board, pieceTable, cs, dpr) {
    const w = board.width * cs;
    const h = board.height * cs;
    const pw = Math.ceil(w * dpr);
    const ph = Math.ceil(h * dpr);

    if (!this._offscreenCanvas || this._offscreenCanvas.width !== pw || this._offscreenCanvas.height !== ph) {
      this._offscreenCanvas = document.createElement('canvas');
      this._offscreenCanvas.width = pw;
      this._offscreenCanvas.height = ph;
      this._offscreenCtx = this._offscreenCanvas.getContext('2d');
    }

    const octx = this._offscreenCtx;
    octx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Board background
    octx.fillStyle = '#000';
    octx.fillRect(0, 0, w, h);

    // Grid lines at origin
    this._drawGridLines(octx, 0, 0, board, cs);

    // Locked blocks using cached neighbors
    for (let y = board.bufferHeight; y < board.grid.length; y++) {
      for (let x = 0; x < board.width; x++) {
        const cell = board.grid[y][x];
        if (cell !== null) {
          const entry = pieceTable.pieces[cell];
          this.drawBlock(
            x * cs,
            (y - board.bufferHeight) * cs,
            cs, PIECE_COLORS[entry.type], this._neighborCache[y][x], octx
          );
        }
      }
    }

    this._offscreenVersion = board.gridVersion;
    this._offscreenCellSize = cs;
    this._offscreenDpr = dpr;
    this._offscreenWidth = w;
    this._offscreenHeight = h;
  }

  gridNeighborsByType(grid, pieceTable, x, y) {
    const id = grid[y][x];
    if (id === null) return { top: false, bottom: false, left: false, right: false };
    return {
      top:    y > 0                    && grid[y - 1][x] === id,
      bottom: y < grid.length - 1      && grid[y + 1][x] === id,
      left:   x > 0                    && grid[y][x - 1] === id,
      right:  x < grid[0].length - 1   && grid[y][x + 1] === id,
    };
  }

  gridNeighbors(grid, x, y) {
    const id = grid[y][x];
    return {
      top:    y > 0              && grid[y - 1][x] === id,
      bottom: y < grid.length - 1 && grid[y + 1][x] === id,
      left:   x > 0              && grid[y][x - 1] === id,
      right:  x < grid[0].length - 1 && grid[y][x + 1] === id,
    };
  }

  blockSetNeighbors(set, bx, by) {
    return {
      top:    set.has(bx + ',' + (by - 1)),
      bottom: set.has(bx + ',' + (by + 1)),
      left:   set.has((bx - 1) + ',' + by),
      right:  set.has((bx + 1) + ',' + by),
    };
  }

  drawBlock(x, y, size, color, nb, target) {
    const ctx = target || this.ctx;
    const s = size - 1;
    let fx = x + 0.5, fy = y + 0.5, fw = s, fh = s;
    if (nb) {
      if (nb.left)   { fx = x;     fw += 0.5; }
      if (nb.right)  { fw += 0.5; }
      if (nb.top)    { fy = y;     fh += 0.5; }
      if (nb.bottom) { fh += 0.5; }
    }
    ctx.fillStyle = color;
    ctx.fillRect(fx, fy, fw, fh);
    const drawTop = !nb || !nb.top;
    const drawLeft = !nb || !nb.left;
    if (drawTop || drawLeft) {
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      if (drawTop)  ctx.fillRect(x + 0.5, y + 0.5, s, s * 0.12);
      if (drawLeft) ctx.fillRect(x + 0.5, y + 0.5, s * 0.12, s);
    }
    const drawRight = !nb || !nb.right;
    const drawBottom = !nb || !nb.bottom;
    if (drawRight || drawBottom) {
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      if (drawRight)  ctx.fillRect(x + s * 0.88 + 0.5, y + 0.5, s * 0.12, s);
      if (drawBottom) ctx.fillRect(x + 0.5, y + s * 0.88 + 0.5, s, s * 0.12);
    }
  }

  drawGhostBlock(x, y, size, color) {
    const ctx = this.ctx;
    const s = size - 1;
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.globalAlpha = 0.6;
    ctx.strokeRect(x + 1.5, y + 1.5, s - 2, s - 2);
    ctx.globalAlpha = 1;
  }

  drawMiniPiece(x, y, cellSize, type, alpha = 1) {
    const ctx = this.ctx;
    ctx.globalAlpha = alpha;
    for (const entry of MINI_PIECE_DATA[type]) {
      this.drawBlock(x + entry.x * cellSize, y + entry.y * cellSize, cellSize, PIECE_COLORS[type], entry.nb);
    }
    ctx.globalAlpha = 1;
  }
}

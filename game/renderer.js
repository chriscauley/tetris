import { PIECE_COLORS, getBlocks } from './pieces.js';
import { canMove } from './helpers.js';

export class RenderSystem {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.cellSize = 0;
    this.boardOffsetX = 0;
    this.boardOffsetY = 0;
    this.scrollTarget = 0;
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
    };

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

    // Advance cascade animation state machine
    const slowdown = world.debug?.animSlowdown ?? 1;
    this.advanceCascadeAnim(board, slowdown);

    // Locked blocks
    const anim = board.cascadeAnim;
    if (anim) {
      // Draw from animation snapshot grid
      const snapGrid = anim.grid;
      const snapIds = anim.ids;
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
    } else {
      for (let y = board.bufferHeight; y < board.grid.length; y++) {
        for (let x = 0; x < board.width; x++) {
          const cell = board.grid[y][x];
          if (cell !== null) {
            const entry = pieceTable.pieces[cell];
            const nb = board.gravityMode === 'sticky'
              ? this.gridNeighborsByType(board.grid, pieceTable, x, y)
              : this.gridNeighbors(board.grid, x, y);
            this.drawBlock(
              ox + x * cs,
              oy + (y - board.bufferHeight) * cs,
              cs, PIECE_COLORS[entry.type], nb
            );
          }
        }
      }
    }

    // Ghost piece + active piece
    const pieceIds = world.query('ActivePiece');
    if (pieceIds.length > 0) {
      const piece = world.getComponent(pieceIds[0], 'ActivePiece');
      const blocks = getBlocks(piece.type, piece.rotation);
      const blockSet = new Set(blocks.map(b => b.x + ',' + b.y));

      // Ghost
      let ghostY = piece.y;
      while (canMove(board, piece.type, piece.rotation, piece.x, ghostY + 1)) ghostY++;
      if (ghostY !== piece.y) {
        for (const b of blocks) {
          const dy = ghostY + b.y - board.bufferHeight;
          if (dy >= 0) {
            this.drawGhostBlock(ox + (piece.x + b.x) * cs, oy + dy * cs, cs, PIECE_COLORS[piece.type]);
          }
        }
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
    const grad = ctx.createLinearGradient(0, gradTop, 0, gradBot);
    grad.addColorStop(0, 'rgba(255, 0, 0, 0.35)');
    grad.addColorStop(1, 'rgba(255, 0, 0, 0)');
    ctx.fillStyle = grad;
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
    const w = window.innerWidth;
    const h = window.innerHeight;

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
    const fallDur = Math.round(8 * slowdown);
    const pauseDur = Math.round(4 * slowdown);
    if (!board.cascadeAnim && board.cascadeAnimQueue.length > 0) {
      const step = board.cascadeAnimQueue.shift();
      board.cascadeAnim = { ...step, phase: 'fall', timer: 0, fallDuration: fallDur };
      return;
    }
    if (!board.cascadeAnim) return;
    const anim = board.cascadeAnim;
    anim.timer++;
    if (anim.phase === 'fall' && anim.timer >= anim.fallDuration) {
      if (board.cascadeAnimQueue.length > 0) {
        anim.phase = 'pause';
        anim.timer = 0;
        anim.pauseDuration = pauseDur;
      } else {
        board.cascadeAnim = null;
      }
    } else if (anim.phase === 'pause' && anim.timer >= anim.pauseDuration) {
      const step = board.cascadeAnimQueue.shift();
      board.cascadeAnim = { ...step, phase: 'fall', timer: 0, fallDuration: fallDur };
    }
  }

  gridNeighborsByType(grid, pieceTable, x, y) {
    const id = grid[y][x];
    if (id === null) return { top: false, bottom: false, left: false, right: false };
    const type = pieceTable.pieces[id].type;
    const typeAt = (gy, gx) => {
      const cid = grid[gy][gx];
      return cid !== null ? pieceTable.pieces[cid].type : null;
    };
    return {
      top:    y > 0                    && typeAt(y - 1, x) === type,
      bottom: y < grid.length - 1      && typeAt(y + 1, x) === type,
      left:   x > 0                    && typeAt(y, x - 1) === type,
      right:  x < grid[0].length - 1   && typeAt(y, x + 1) === type,
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

  drawBlock(x, y, size, color, nb) {
    const ctx = this.ctx;
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
    if (!nb || !nb.top) {
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.fillRect(x + 0.5, y + 0.5, s, s * 0.12);
    }
    if (!nb || !nb.left) {
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.fillRect(x + 0.5, y + 0.5, s * 0.12, s);
    }
    if (!nb || !nb.right) {
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(x + s * 0.88 + 0.5, y + 0.5, s * 0.12, s);
    }
    if (!nb || !nb.bottom) {
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(x + 0.5, y + s * 0.88 + 0.5, s, s * 0.12);
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
    const blocks = getBlocks(type, 0);
    const blockSet = new Set(blocks.map(b => b.x + ',' + b.y));
    for (const b of blocks) {
      const nb = this.blockSetNeighbors(blockSet, b.x, b.y);
      this.drawBlock(x + b.x * cellSize, y + b.y * cellSize, cellSize, PIECE_COLORS[type], nb);
    }
    ctx.globalAlpha = 1;
  }
}

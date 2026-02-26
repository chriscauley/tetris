import { PIECE_COLORS, getBlocks } from './pieces.js';
import { canMove } from './helpers.js';

export class RenderSystem {
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

    world.ui = {
      cellSize: this.cellSize,
      boardX: this.boardOffsetX,
      boardY: this.boardOffsetY,
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

    // Next queue (mini pieces only)
    if (nextQueue) {
      for (let i = 0; i < Math.min(5, nextQueue.queue.length); i++) {
        this.drawMiniPiece(rightX, oy + cs * 1.2 + i * cs * 2.8, cs * 0.65, nextQueue.queue[i]);
      }
    }

    // Hold piece (mini piece only)
    if (hold && hold.type) {
      this.drawMiniPiece(leftX, oy + cs * 1.2, cs * 0.65, hold.type, hold.used ? 0.35 : 1);
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

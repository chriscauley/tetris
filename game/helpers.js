import { PIECE_TYPES, G, getBlocks } from './pieces.js';

export function collides(board, type, rotation, px, py) {
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

export function canMove(board, type, rotation, px, py) {
  return !collides(board, type, rotation, px, py);
}

export function shuffledBag(rng) {
  const bag = [...PIECE_TYPES];
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }
  return bag;
}

export function getDropInterval(level) {
  return Math.max(3, 63 - (level - 1) * 5);
}

export function fillGarbage(board, pieceTable, rng, garbageHeight, sparsity = 0) {
  const totalRows = board.grid.length;
  for (let i = 0; i < garbageHeight; i++) {
    const y = totalRows - 1 - i;
    const id = pieceTable.freeIds.length > 0 ? pieceTable.freeIds.pop() : pieceTable.nextId++;
    pieceTable.pieces[id] = { type: G };
    const gap = Math.floor(rng() * board.width);
    for (let x = 0; x < board.width; x++) {
      if (x === gap) continue;
      board.grid[y][x] = id;
    }
  }
  if (sparsity > 0) {
    const removals = sparsity * garbageHeight;
    const filled = [];
    for (let i = 0; i < garbageHeight; i++) {
      const y = totalRows - 1 - i;
      for (let x = 0; x < board.width; x++) {
        if (board.grid[y][x] !== null) filled.push({ x, y });
      }
    }
    for (let i = filled.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [filled[i], filled[j]] = [filled[j], filled[i]];
    }
    for (let i = 0; i < Math.min(removals, filled.length); i++) {
      board.grid[filled[i].y][filled[i].x] = null;
    }
  }
  board.gridVersion++;
}

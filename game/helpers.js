import { PIECE_TYPES, getBlocks } from './pieces.js';

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

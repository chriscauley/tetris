export const Components = {
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

export const Components = {
  Board(w = 10, h = 20, gravityMode = 'normal', visualHeight = 20) {
    const bufferHeight = 4;
    const grid = Array.from({ length: h + bufferHeight }, () => Array(w).fill(null));
    return { width: w, height: h, bufferHeight, visualHeight, grid, gravityMode, cascadeAnimQueue: [], cascadeAnim: null, gridVersion: 0 };
  },
  ActivePiece(type, x, y, rotation = 0, pieceId = null) {
    return { type, x, y, rotation, pieceId };
  },
  Drop(interval = 63) {
    return { timer: 0, interval, softDrop: false };
  },
  Score(startLevel = 1) {
    return { score: 0, lines: 0, level: startLevel };
  },
  GameMode(type = 'a', startLevel = 1, garbageHeight = 0, linesGoal = null, sparsity = 0) {
    return { type, startLevel, garbageHeight, linesGoal, sparsity };
  },
  NextQueue(rng) {
    return { queue: [], rng };
  },
  HoldPiece() {
    return { type: null, pieceId: null, used: false };
  },
  PieceTable() {
    return { pieces: {}, nextId: 1, freeIds: [] };
  },
  GameState() {
    return {
      phase: 'playing',
      lockTimer: 0,
      lockDelay: 31,
      lockResets: 0,
      maxLockResets: 15,
      hardDropping: false,
    };
  },
  Input() {
    return { actions: [] };
  },
};

// Piece IDs (1-indexed; 0/null = empty cell)
export const I = 1;
export const O = 2;
export const T = 3;
export const S = 4;
export const Z = 5;
export const J = 6;
export const L = 7;
export const G = 8;

export const PIECE_TYPES = [I, O, T, S, Z, J, L];

export const PIECE_SHAPES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[1,1],[1,1]],                                // O
  [[0,1,0],[1,1,1],[0,0,0]],                    // T
  [[0,1,1],[1,1,0],[0,0,0]],                    // S
  [[1,1,0],[0,1,1],[0,0,0]],                    // Z
  [[1,0,0],[1,1,1],[0,0,0]],                    // J
  [[0,0,1],[1,1,1],[0,0,0]],                    // L
];

export const PIECE_COLORS = [
  null,
  '#00f0f0', // I
  '#f0f000', // O
  '#a000f0', // T
  '#00f000', // S
  '#f00000', // Z
  '#0000f0', // J
  '#f0a000', // L
  '#808080', // G (garbage)
];

function rotateMatrix(matrix) {
  const n = matrix.length;
  const result = Array.from({ length: n }, () => Array(n).fill(0));
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++)
      result[x][n - 1 - y] = matrix[y][x];
  return result;
}

export function getRotatedShape(type, rotation) {
  let shape = PIECE_SHAPES[type];
  for (let i = 0; i < rotation; i++) shape = rotateMatrix(shape);
  return shape;
}

export function getBlocks(type, rotation) {
  const shape = getRotatedShape(type, rotation);
  const blocks = [];
  for (let y = 0; y < shape.length; y++)
    for (let x = 0; x < shape[y].length; x++)
      if (shape[y][x]) blocks.push({ x, y });
  return blocks;
}

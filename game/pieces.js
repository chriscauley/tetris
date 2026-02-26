export const PIECE_TYPES = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];

export const PIECE_SHAPES = {
  I: [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]],
  O: [[1,1],[1,1]],
  T: [[0,1,0],[1,1,1],[0,0,0]],
  S: [[0,1,1],[1,1,0],[0,0,0]],
  Z: [[1,1,0],[0,1,1],[0,0,0]],
  J: [[1,0,0],[1,1,1],[0,0,0]],
  L: [[0,0,1],[1,1,1],[0,0,0]],
};

export const PIECE_COLORS = {
  I: '#00f0f0',
  O: '#f0f000',
  T: '#a000f0',
  S: '#00f000',
  Z: '#f00000',
  J: '#0000f0',
  L: '#f0a000',
};

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

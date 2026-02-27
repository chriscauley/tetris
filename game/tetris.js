import seedrandom from 'seedrandom/lib/alea';
import { World } from './ecs.js';
import { Components } from './components.js';
import { InputSystem, SpawnSystem, MovementSystem, GravitySystem, LockSystem, LineClearSystem } from './systems.js';
import { RenderSystem } from './renderer.js';
import { RecorderSystem, ReplaySystem } from './recorder.js';

const CELL_CHARS = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

function encodeCell(id) {
  if (id === null) return ' ';
  return CELL_CHARS[id] ?? '?';
}

function decodeCell(ch) {
  if (ch === ' ') return null;
  const i = CELL_CHARS.indexOf(ch);
  return i >= 0 ? i : null;
}

export function createGame(canvas, { boardWidth = 10, boardHeight = 24, seed, mode = 'play', recording, gravityMode = 'normal', cascadeGravity, visualHeight = 20 } = {}) {
  const resolvedGravityMode = gravityMode !== 'normal' ? gravityMode : (cascadeGravity ? 'cascade' : 'normal');
  const rng = seedrandom(seed, { state: true });
  const world = new World();
  world.seed = seed;

  const boardId = world.createEntity();
  world.addComponent(boardId, 'Board', Components.Board(boardWidth, boardHeight, resolvedGravityMode, visualHeight));
  world.addComponent(boardId, 'Score', Components.Score());
  world.addComponent(boardId, 'GameState', Components.GameState());
  world.addComponent(boardId, 'NextQueue', Components.NextQueue(rng));
  world.addComponent(boardId, 'HoldPiece', Components.HoldPiece());
  world.addComponent(boardId, 'PieceTable', Components.PieceTable());
  world.addComponent(boardId, 'Input', Components.Input());

  let recorderSystem = null;
  let replaySystem = null;

  if (mode === 'replay' && recording) {
    replaySystem = new ReplaySystem(recording.frames);
    world.addSystem(replaySystem);
  } else {
    world.addSystem(new InputSystem());
    recorderSystem = new RecorderSystem();
    world.addSystem(recorderSystem);
  }

  world.addSystem(new SpawnSystem());
  world.addSystem(new MovementSystem());
  world.addSystem(new GravitySystem());
  world.addSystem(new LockSystem());
  world.addSystem(new LineClearSystem());
  if (canvas) {
    world.addSystem(new RenderSystem(canvas));
  }

  function restart(newSeed) {
    for (const id of world.query('ActivePiece')) world.destroyEntity(id);
    const board = world.getComponent(boardId, 'Board');
    for (let y = 0; y < board.grid.length; y++) board.grid[y].fill(null);
    const score = world.getComponent(boardId, 'Score');
    Object.assign(score, { score: 0, lines: 0, level: 1 });
    const state = world.getComponent(boardId, 'GameState');
    Object.assign(state, { phase: 'playing', lockTimer: 0, lockResets: 0, hardDropping: false });
    const nq = world.getComponent(boardId, 'NextQueue');
    nq.queue = [];
    nq.rng = seedrandom(newSeed, { state: true });
    world.seed = newSeed;
    const hold = world.getComponent(boardId, 'HoldPiece');
    Object.assign(hold, { type: null, pieceId: null, used: false });
    const table = world.getComponent(boardId, 'PieceTable');
    Object.assign(table, { pieces: {}, nextId: 1, freeIds: [] });
  }

  world.restart = function(newSeed) {
    restart(newSeed);
    if (recorderSystem) recorderSystem.reset();
  };
  world.boardId = boardId;

  world.getRecording = function () {
    if (!recorderSystem) return null;
    const rec = recorderSystem.getRecording(world.seed);
    const board = world.getComponent(boardId, 'Board');
    rec.boardHeight = board.height;
    rec.gravityMode = board.gravityMode;
    return rec;
  };

  world.replayTick = function () {
    if (!replaySystem || replaySystem.done) return false;
    world.update();
    return !replaySystem.done;
  };

  world.exportState = function () {
    const snapshot = {
      seed: world.seed,
      nextId: world.nextId,
      entities: {},
    };
    for (const [id, components] of world.entities) {
      const entity = {};
      for (const [name, data] of Object.entries(components)) {
        if (name === 'NextQueue') {
          entity[name] = {
            queue: [...data.queue],
            rngState: data.rng.state(),
          };
        } else if (name === 'Board') {
          const grid = {};
          data.grid.forEach((row, y) => {
            if (row.some(cell => cell !== null)) grid[y] = row.map(encodeCell).join('');
          });
          entity[name] = {
            width: data.width,
            height: data.height,
            bufferHeight: data.bufferHeight,
            visualHeight: data.visualHeight,
            grid,
            gravityMode: data.gravityMode,
          };
        } else {
          entity[name] = structuredClone(data);
        }
      }
      snapshot.entities[id] = entity;
    }
    return snapshot;
  };

  world.loadState = function (snapshot) {
    world.seed = snapshot.seed;
    world.nextId = snapshot.nextId;
    world.entities.clear();
    for (const [id, entity] of Object.entries(snapshot.entities)) {
      const components = {};
      for (const [name, data] of Object.entries(entity)) {
        if (name === 'NextQueue') {
          components[name] = {
            queue: [...data.queue],
            rng: seedrandom(null, { state: data.rngState }),
          };
        } else if (name === 'Board') {
          const totalRows = data.height + data.bufferHeight;
          const grid = Array.from({ length: totalRows }, (_, y) =>
            data.grid[y] ? [...data.grid[y]].map(decodeCell) : Array(data.width).fill(null)
          );
          components[name] = {
            width: data.width,
            height: data.height,
            bufferHeight: data.bufferHeight,
            visualHeight: data.visualHeight || 20,
            grid,
            gravityMode: data.gravityMode || (data.cascadeGravity ? 'cascade' : 'normal'),
          };
        } else {
          components[name] = structuredClone(data);
        }
      }
      world.entities.set(Number(id), components);
    }
  };

  if (typeof document !== 'undefined' && mode !== 'replay') {
    document.addEventListener('keydown', e => {
      if (e.key.toLowerCase() === 'r') {
        const state = world.getComponent(boardId, 'GameState');
        if (state.phase === 'gameover') {
          restart(seed);
        }
      }
    });
  }

  return world;
}

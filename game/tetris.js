import seedrandom from 'seedrandom/lib/alea';
import { World } from './ecs.js';
import { Components } from './components.js';
import { InputSystem, SpawnSystem, MovementSystem, GravitySystem, LockSystem, LineClearSystem } from './systems.js';
import { RenderSystem } from './renderer.js';

export function createGame(canvas, { boardWidth = 10, boardHeight = 20, seed } = {}) {
  const rng = seedrandom(seed);
  const world = new World();
  world.seed = seed;

  const boardId = world.createEntity();
  world.addComponent(boardId, 'Board', Components.Board(boardWidth, boardHeight));
  world.addComponent(boardId, 'Score', Components.Score());
  world.addComponent(boardId, 'GameState', Components.GameState());
  world.addComponent(boardId, 'NextQueue', Components.NextQueue(rng));
  world.addComponent(boardId, 'HoldPiece', Components.HoldPiece());
  world.addComponent(boardId, 'Input', Components.Input());

  world.addSystem(new InputSystem());
  world.addSystem(new SpawnSystem());
  world.addSystem(new MovementSystem());
  world.addSystem(new GravitySystem());
  world.addSystem(new LockSystem());
  world.addSystem(new LineClearSystem());
  world.addSystem(new RenderSystem(canvas));

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
    nq.rng = seedrandom(newSeed);
    world.seed = newSeed;
    const hold = world.getComponent(boardId, 'HoldPiece');
    Object.assign(hold, { type: null, used: false });
  }

  world.restart = restart;

  document.addEventListener('keydown', e => {
    if (e.key.toLowerCase() === 'r') {
      const state = world.getComponent(boardId, 'GameState');
      if (state.phase === 'gameover') {
        restart(seed);
      }
    }
  });

  return world;
}

// RecorderSystem — runs after InputSystem, snapshots each frame's dt + actions.
export class RecorderSystem {
  constructor() {
    this.frames = [];
  }

  update(world, dt) {
    const boardId = world.query('Board', 'Input')[0];
    if (boardId === undefined) return;
    const input = world.getComponent(boardId, 'Input');
    this.frames.push([dt, ...input.actions]);
  }

  getRecording(seed) {
    return { seed, frames: this.frames };
  }

  reset() {
    this.frames = [];
  }
}

// ReplaySystem — replays a recording by injecting actions into Input each tick.
export class ReplaySystem {
  constructor(frames) {
    this.frames = frames;
    this.tick = 0;
  }

  get done() {
    return this.tick >= this.frames.length;
  }

  getDt() {
    if (this.done) return 0;
    return this.frames[this.tick][0];
  }

  update(world) {
    if (this.done) return;
    const boardId = world.query('Board', 'Input')[0];
    if (boardId === undefined) return;
    const input = world.getComponent(boardId, 'Input');
    const frame = this.frames[this.tick];
    // frame[0] is dt, rest are actions
    for (let i = 1; i < frame.length; i++) {
      input.actions.push(frame[i]);
    }
    this.tick++;
  }
}

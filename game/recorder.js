// RecorderSystem — only records frames with actions, tracking ticks between them.
export class RecorderSystem {
  constructor() {
    this.frames = [];
    this.ticksSinceLastAction = 0;
  }

  update(world) {
    const boardId = world.query('Board', 'Input')[0];
    if (boardId === undefined) return;
    const input = world.getComponent(boardId, 'Input');
    this.ticksSinceLastAction++;
    if (input.actions.length > 0) {
      this.frames.push([this.ticksSinceLastAction, ...input.actions]);
      this.ticksSinceLastAction = 0;
    }
  }

  getRecording(seed) {
    const frames = [...this.frames];
    if (this.ticksSinceLastAction > 0) {
      frames.push([this.ticksSinceLastAction]);
    }
    return { seed, frames };
  }

  reset() {
    this.frames = [];
    this.ticksSinceLastAction = 0;
  }
}

// ReplaySystem — counts down ticks, injects actions when a frame's count is reached.
export class ReplaySystem {
  constructor(frames) {
    this.frames = frames;
    this.frameIndex = 0;
    this.ticksRemaining = frames.length > 0 ? frames[0][0] : 0;
  }

  get done() {
    return this.frameIndex >= this.frames.length;
  }

  update(world) {
    if (this.done) return;
    this.ticksRemaining--;
    if (this.ticksRemaining <= 0) {
      const boardId = world.query('Board', 'Input')[0];
      if (boardId !== undefined) {
        const input = world.getComponent(boardId, 'Input');
        const frame = this.frames[this.frameIndex];
        for (let i = 1; i < frame.length; i++) {
          input.actions.push(frame[i]);
        }
      }
      this.frameIndex++;
      if (this.frameIndex < this.frames.length) {
        this.ticksRemaining = this.frames[this.frameIndex][0];
      }
    }
  }
}

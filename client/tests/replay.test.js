import { readdirSync, readFileSync } from 'node:fs'
import { join, basename } from 'node:path'
import { describe, it, expect } from 'vitest'
import { createGame } from '@game/tetris.js'

const replayDir = new URL('./replays', import.meta.url).pathname
const replayFiles = readdirSync(replayDir).filter(f => f.endsWith('.json'))
const replays = replayFiles.map(f => ({
  name: basename(f, '.json'),
  recording: JSON.parse(readFileSync(join(replayDir, f), 'utf-8')),
}))

function runReplay(recording) {
  const world = createGame(null, {
    seed: recording.seed,
    mode: 'replay',
    recording,
  })
  while (world.replayTick()) { /* advance until done */ }
  return world.exportState()
}

describe('replay determinism', () => {
  if (replays.length === 0) {
    it('no replay files found in tests/replays/', () => {
      expect(replays.length, 'add .json files to tests/replays/').toBeGreaterThan(0)
    })
  }

  it.each(replays.map(r => [r.name, r.recording]))(
    '%s produces identical state on two runs',
    (_name, recording) => {
      const state1 = runReplay(recording)
      const state2 = runReplay(recording)
      expect(state1).toEqual(state2)
    },
  )
})

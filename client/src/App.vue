<script setup>
import { ref, computed, onMounted } from 'vue'
import { createGame, TICK_MS } from '@game/tetris.js'

const canvas = ref(null)
const showSeedDialog = ref(false)
const showStateDialog = ref(false)
const showReplayDialog = ref(false)
const stateJson = ref('')
const replayJson = ref('')
const seedInput = ref('')
let world = null
let paused = false
let gameAnimId = null
let replayAnimId = null
const replaying = ref(false)

const cellSize = ref(0)
const boardX = ref(0)
const boardY = ref(0)
const score = ref(0)
const lines = ref(0)
const level = ref(1)
const gamePhase = ref('playing')
const activePieceId = ref(null)

const BOARD_WIDTH = 10
const BOARD_HEIGHT = 20

const fontSize = computed(() => Math.max(11, cellSize.value * 0.55) + 'px')
const helpFontSize = computed(() => Math.max(9, cellSize.value * 0.35) + 'px')
const gameOverFontSize = computed(() => (cellSize.value * 1.1) + 'px')
const gameOverSubFontSize = computed(() => (cellSize.value * 0.55) + 'px')

const leftPanelStyle = computed(() => ({
  position: 'fixed',
  left: (boardX.value - cellSize.value * 5.5) + 'px',
  top: boardY.value + 'px',
  height: (BOARD_HEIGHT * cellSize.value) + 'px',
  fontFamily: 'monospace',
}))

const rightPanelStyle = computed(() => ({
  position: 'fixed',
  left: (boardX.value + BOARD_WIDTH * cellSize.value + cellSize.value * 1.5) + 'px',
  top: boardY.value + 'px',
  fontFamily: 'monospace',
}))

const gameOverStyle = computed(() => ({
  position: 'fixed',
  left: boardX.value + 'px',
  top: boardY.value + 'px',
  width: (BOARD_WIDTH * cellSize.value) + 'px',
  height: (BOARD_HEIGHT * cellSize.value) + 'px',
}))

function readWorldState() {
  if (!world) return
  const ui = world.ui
  if (ui) {
    cellSize.value = ui.cellSize
    boardX.value = ui.boardX
    boardY.value = ui.boardY
  }
  const boardId = world.query('Board', 'Score', 'GameState')[0]
  if (boardId === undefined) return
  const s = world.getComponent(boardId, 'Score')
  if (s) {
    score.value = s.score
    lines.value = s.lines
    level.value = s.level
  }
  const gs = world.getComponent(boardId, 'GameState')
  if (gs) {
    gamePhase.value = gs.phase
  }
  const apIds = world.query('ActivePiece')
  if (apIds.length > 0) {
    const ap = world.getComponent(apIds[0], 'ActivePiece')
    activePieceId.value = ap ? ap.pieceId : null
  } else {
    activePieceId.value = null
  }
}

function stopGameLoop() {
  if (gameAnimId) {
    cancelAnimationFrame(gameAnimId)
    gameAnimId = null
  }
}

function startGameLoop() {
  stopGameLoop()
  let lastTime = performance.now()
  let accumulator = 0
  function loop(time) {
    const delta = Math.min(time - lastTime, 100)
    lastTime = time
    if (!paused) {
      accumulator += delta
      while (accumulator >= TICK_MS) {
        accumulator -= TICK_MS
        world.update(TICK_MS)
      }
      readWorldState()
    }
    gameAnimId = requestAnimationFrame(loop)
  }
  gameAnimId = requestAnimationFrame(loop)
}

let isPlayWorld = false

function startGame(seed) {
  stopReplay()
  if (world && isPlayWorld) {
    world.restart(seed)
  } else {
    world = createGame(canvas.value, { seed })
    isPlayWorld = true
    startGameLoop()
  }
}

function onNewGame(e) {
  if (e.ctrlKey || e.metaKey) {
    e.preventDefault()
    seedInput.value = ''
    showSeedDialog.value = true
  } else {
    startGame(undefined)
  }
}

function onSeedSubmit() {
  const seed = seedInput.value.trim() || undefined
  showSeedDialog.value = false
  startGame(seed)
}

function onSeedCancel() {
  showSeedDialog.value = false
}

function copyState() {
  if (!world) return
  const json = JSON.stringify(world.exportState(), null, 2)
  navigator.clipboard.writeText(json)
}

function showState() {
  if (!world) return
  paused = true
  stateJson.value = JSON.stringify(world.exportState(), null, 2)
  showStateDialog.value = true
}

function closeState() {
  showStateDialog.value = false
  paused = false
}

function getFullRecording() {
  if (!world) return null
  const rec = world.getRecording()
  if (!rec) return null
  const board = world.getComponent(world.boardId, 'Board')
  const grid = {}
  board.grid.forEach((row, y) => {
    if (row.some(cell => cell !== null)) grid[y] = row.map(c => c ?? 0)
  })
  rec.expectedGrid = grid
  return rec
}

function showReplay() {
  const rec = getFullRecording()
  if (!rec) return
  paused = true
  replayJson.value = JSON.stringify(rec, null, 2)
  showReplayDialog.value = true
}

function closeReplay() {
  showReplayDialog.value = false
  paused = false
}

function copyReplay() {
  const rec = getFullRecording()
  if (!rec) return
  navigator.clipboard.writeText(JSON.stringify(rec))
}

function stopReplay() {
  if (replayAnimId) {
    cancelAnimationFrame(replayAnimId)
    replayAnimId = null
  }
  replaying.value = false
}

function startReplay(recording) {
  stopReplay()
  stopGameLoop()
  isPlayWorld = false
  world = createGame(canvas.value, {
    seed: recording.seed,
    mode: 'replay',
    recording,
  })
  replaying.value = true

  let lastTime = performance.now()
  let accumulator = 0

  function replayLoop(time) {
    const delta = Math.min(time - lastTime, 100)
    lastTime = time
    accumulator += delta

    while (accumulator >= TICK_MS) {
      accumulator -= TICK_MS
      const more = world.replayTick()
      if (!more) {
        readWorldState()
        stopReplay()
        return
      }
    }

    readWorldState()
    replayAnimId = requestAnimationFrame(replayLoop)
  }

  replayAnimId = requestAnimationFrame(replayLoop)
}

async function loadReplay() {
  try {
    const text = await navigator.clipboard.readText()
    const recording = JSON.parse(text)
    if (!recording.frames) {
      alert('Invalid replay data')
      return
    }
    startReplay(recording)
  } catch {
    alert('Could not read replay from clipboard')
  }
}

onMounted(() => {
  startGame(undefined)
})
</script>

<template>
  <canvas ref="canvas"></canvas>

  <!-- Left panel: HOLD, score info, controls -->
  <div class="side-panel" :style="leftPanelStyle" v-if="cellSize > 0">
    <div class="label" :style="{ fontSize }">HOLD</div>
    <div class="score-block" :style="{ marginTop: cellSize * 4.8 + 'px' }">
      <div class="label" :style="{ fontSize }">SCORE</div>
      <div class="value" :style="{ fontSize, marginTop: fontSize }">{{ score }}</div>
      <div class="label" :style="{ fontSize, marginTop: fontSize }">LINES</div>
      <div class="value" :style="{ fontSize, marginTop: fontSize }">{{ lines }}</div>
      <div class="label" :style="{ fontSize, marginTop: fontSize }">LEVEL</div>
      <div class="value" :style="{ fontSize, marginTop: fontSize }">{{ level }}</div>
    </div>
    <table class="controls-help" :style="{
      fontSize: helpFontSize,
      position: 'absolute',
      bottom: 0,
    }">
      <tr><td>&#x2190;&#x2192;</td><td>Move</td></tr>
      <tr><td>&#x2191; X</td><td>Rotate CW</td></tr>
      <tr><td>Z</td><td>Rotate CCW</td></tr>
      <tr><td>&#x2193;</td><td>Soft Drop</td></tr>
      <tr><td>Space</td><td>Hard Drop</td></tr>
      <tr><td>C</td><td>Hold</td></tr>
    </table>
  </div>

  <!-- Right panel: NEXT -->
  <div class="side-panel" :style="rightPanelStyle" v-if="cellSize > 0">
    <div class="label" :style="{ fontSize }">NEXT</div>
  </div>

  <!-- Game over overlay -->
  <div class="game-over-overlay" :style="gameOverStyle" v-if="gamePhase === 'gameover' && cellSize > 0">
    <div class="game-over-text" :style="{ fontSize: gameOverFontSize }">GAME OVER</div>
    <div class="game-over-sub" :style="{ fontSize: gameOverSubFontSize }">Press R to restart</div>
  </div>

  <!-- Debug panel -->
  <div class="debug-panel">
    <span class="debug-label">piece</span> {{ activePieceId ?? '—' }}
  </div>

  <div class="btn-row">
    <button class="new-game-btn" @click="onNewGame">New Game</button>
    <button class="new-game-btn" @click="copyState">Copy State</button>
    <button class="new-game-btn" @click="showState">Show State</button>
    <button class="new-game-btn" @click="copyReplay">Copy Replay</button>
    <button class="new-game-btn" @click="showReplay">Show Replay</button>
    <button class="new-game-btn" @click="loadReplay">Load Replay</button>
  </div>

  <dialog :open="showStateDialog" class="seed-dialog" v-if="showStateDialog">
    <div class="seed-dialog-backdrop" @click="closeState"></div>
    <div class="seed-dialog-content state-dialog-content">
      <h3>Game State</h3>
      <pre class="state-pre">{{ stateJson }}</pre>
      <div class="seed-dialog-actions">
        <button type="button" @click="closeState">Close</button>
      </div>
    </div>
  </dialog>

  <dialog :open="showReplayDialog" class="seed-dialog" v-if="showReplayDialog">
    <div class="seed-dialog-backdrop" @click="closeReplay"></div>
    <div class="seed-dialog-content state-dialog-content">
      <h3>Replay Data</h3>
      <pre class="state-pre">{{ replayJson }}</pre>
      <div class="seed-dialog-actions">
        <button type="button" @click="closeReplay">Close</button>
      </div>
    </div>
  </dialog>

  <dialog :open="showSeedDialog" class="seed-dialog" v-if="showSeedDialog">
    <div class="seed-dialog-backdrop" @click="onSeedCancel"></div>
    <form class="seed-dialog-content" @submit.prevent="onSeedSubmit">
      <h3>New Seeded Game</h3>
      <label>
        Seed
        <input
          v-model="seedInput"
          type="text"
          placeholder="Enter a seed (or leave blank for random)"
          autofocus
        />
      </label>
      <div class="seed-dialog-actions">
        <button type="button" @click="onSeedCancel">Cancel</button>
        <button type="submit">Play</button>
      </div>
    </form>
  </dialog>
</template>

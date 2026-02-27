<script setup>
import { ref, computed, onMounted } from 'vue'
import { createGame } from '@game/tetris.js'

const TICK_MS = 16

const canvas = ref(null)
const showNewGameDialog = ref(false)
const showStateDialog = ref(false)
const showReplayDialog = ref(false)
const stateJson = ref('')
const replayJson = ref('')
const seedInput = ref('')
const linesInput = ref(20)
let world = null
let paused = false
let gameAnimId = null
let replayAnimId = null
let currentBoardHeight = 20
const replaying = ref(false)

const cellSize = ref(0)
const boardX = ref(0)
const boardY = ref(0)
const score = ref(0)
const lines = ref(0)
const level = ref(1)
const gamePhase = ref('playing')
const activePieceId = ref(null)
const highestBlock = ref(0)
const gameSeed = ref('')
const gameBoardHeight = ref(20)

const BOARD_WIDTH = 10
const VISUAL_HEIGHT = 20

const fontSize = computed(() => Math.max(11, cellSize.value * 0.55) + 'px')
const helpFontSize = computed(() => Math.max(9, cellSize.value * 0.35) + 'px')
const gameOverFontSize = computed(() => (cellSize.value * 1.1) + 'px')
const gameOverSubFontSize = computed(() => (cellSize.value * 0.55) + 'px')

const leftPanelStyle = computed(() => ({
  position: 'fixed',
  left: (boardX.value - cellSize.value * 5.5) + 'px',
  top: boardY.value + 'px',
  height: (VISUAL_HEIGHT * cellSize.value) + 'px',
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
  height: (VISUAL_HEIGHT * cellSize.value) + 'px',
}))

function readWorldState() {
  if (!world) return
  const ui = world.ui
  if (ui) {
    cellSize.value = ui.cellSize
    boardX.value = ui.boardX
    boardY.value = ui.boardY
    highestBlock.value = ui.highestRow ?? 0
    gameSeed.value = ui.seed ?? ''
    gameBoardHeight.value = ui.boardHeight ?? 20
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
        world.update()
      }
      readWorldState()
    }
    gameAnimId = requestAnimationFrame(loop)
  }
  gameAnimId = requestAnimationFrame(loop)
}

let isPlayWorld = false

function startGame(seed, boardHeight = 20) {
  stopReplay()
  if (world && isPlayWorld && boardHeight === currentBoardHeight) {
    world.restart(seed)
  } else {
    world = createGame(canvas.value, { seed, boardHeight })
    currentBoardHeight = boardHeight
    isPlayWorld = true
    startGameLoop()
  }
}

function onNewGame() {
  seedInput.value = ''
  linesInput.value = currentBoardHeight
  showNewGameDialog.value = true
}

function onNewGameSubmit() {
  const seed = seedInput.value.trim() || undefined
  const boardHeight = Math.max(15, Math.min(50, Math.floor(Number(linesInput.value) || 20)))
  showNewGameDialog.value = false
  startGame(seed, boardHeight)
}

function onNewGameCancel() {
  showNewGameDialog.value = false
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
  const CELL_CHARS = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const grid = board.grid
    .filter(row => row.some(cell => cell !== null))
    .map(row => row.map(c => c === null ? ' ' : (CELL_CHARS[c] ?? '?')).join(''))
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
    <table>
      <tr><td class="debug-label">piece</td><td>{{ activePieceId ?? '—' }}</td></tr>
      <tr><td class="debug-label">highest</td><td>{{ highestBlock }}</td></tr>
      <tr><td class="debug-label">seed</td><td>{{ gameSeed ?? '—' }}</td></tr>
      <tr><td class="debug-label">height</td><td>{{ gameBoardHeight }}</td></tr>
    </table>
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

  <dialog :open="showNewGameDialog" class="seed-dialog" v-if="showNewGameDialog">
    <div class="seed-dialog-backdrop" @click="onNewGameCancel"></div>
    <form class="seed-dialog-content" @submit.prevent="onNewGameSubmit">
      <h3>New Game</h3>
      <label>
        Lines
        <input
          v-model.number="linesInput"
          type="number"
          min="15"
          max="50"
          autofocus
        />
      </label>
      <label>
        Seed
        <input
          v-model="seedInput"
          type="text"
          placeholder="Leave blank for random"
        />
      </label>
      <div class="seed-dialog-actions">
        <button type="button" @click="onNewGameCancel">Cancel</button>
        <button type="submit">Play</button>
      </div>
    </form>
  </dialog>
</template>

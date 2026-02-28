<script setup>
import { ref, reactive, computed, watch, onMounted } from 'vue'
import { createGame } from '@game/tetris.js'
import UnrestDialog from './components/UnrestDialog.vue'
import NewGameForm from './components/NewGameForm.vue'
import DebugForm from './components/DebugForm.vue'

// Constants
const TICK_MS = 16
const BOARD_WIDTH = 10
const VISUAL_HEIGHT = 20

// Game engine (non-reactive)
let world = null
let gameAnimId = null
let replayAnimId = null
let isPlayWorld = false
let currentSettings = {
  boardHeight: 20,
  gravityMode: 'normal',
  gameMode: 'a',
  startLevel: 1,
  garbageHeight: 0,
  sparsity: 0,
}

// Game state (read from engine each frame)
const game = reactive({
  cellSize: 0,
  boardX: 0,
  boardY: 0,
  score: 0,
  lines: 0,
  level: 1,
  phase: 'playing',
  activePieceId: null,
  highestBlock: 0,
  seed: '',
  boardHeight: 20,
  gravityMode: 'normal',
  gameMode: 'a',
  linesGoal: null,
})

// App UI state
const canvas = ref(null)
const paused = ref(false)
const replaying = ref(false)
const animSlowdown = ref(1)
const dialogs = reactive({
  newGame: false,
  state: false,
  replay: false,
  debug: false,
})
const newGameDefaults = ref({})
const stateJson = ref('')
const replayJson = ref('')

// Computed styles
const linesDisplay = computed(() => {
  if (game.linesGoal !== null) return game.lines + ' / ' + game.linesGoal
  return '' + game.lines
})

const fontSize = computed(() => Math.max(11, game.cellSize * 0.55) + 'px')
const helpFontSize = computed(() => Math.max(9, game.cellSize * 0.35) + 'px')
const gameOverFontSize = computed(() => (game.cellSize * 1.1) + 'px')
const gameOverSubFontSize = computed(() => (game.cellSize * 0.55) + 'px')

const leftPanelStyle = computed(() => ({
  position: 'fixed',
  left: (game.boardX - game.cellSize * 5.5) + 'px',
  top: game.boardY + 'px',
  height: (VISUAL_HEIGHT * game.cellSize) + 'px',
  fontFamily: 'monospace',
}))

const rightPanelStyle = computed(() => ({
  position: 'fixed',
  left: (game.boardX + BOARD_WIDTH * game.cellSize + game.cellSize * 1.5) + 'px',
  top: game.boardY + 'px',
  fontFamily: 'monospace',
}))

const gameOverStyle = computed(() => ({
  position: 'fixed',
  left: game.boardX + 'px',
  top: game.boardY + 'px',
  width: (BOARD_WIDTH * game.cellSize) + 'px',
  height: (VISUAL_HEIGHT * game.cellSize) + 'px',
}))

// Engine sync
function readWorldState() {
  if (!world) return
  const ui = world.ui
  if (ui) {
    game.cellSize = ui.cellSize
    game.boardX = ui.boardX
    game.boardY = ui.boardY
    game.highestBlock = ui.highestRow ?? 0
    game.seed = ui.seed ?? ''
    game.boardHeight = ui.boardHeight ?? 24
    game.gravityMode = ui.gravityMode ?? 'normal'
  }
  const boardId = world.query('Board', 'Score', 'GameState')[0]
  if (boardId === undefined) return
  const s = world.getComponent(boardId, 'Score')
  if (s) {
    game.score = s.score
    game.lines = s.lines
    game.level = s.level
  }
  const gs = world.getComponent(boardId, 'GameState')
  if (gs) {
    game.phase = gs.phase
  }
  const gm = world.getComponent(boardId, 'GameMode')
  if (gm) {
    game.gameMode = gm.type
    game.linesGoal = gm.linesGoal
  }
  const apIds = world.query('ActivePiece')
  if (apIds.length > 0) {
    const ap = world.getComponent(apIds[0], 'ActivePiece')
    game.activePieceId = ap ? ap.pieceId : null
  } else {
    game.activePieceId = null
  }
}

// Game loop
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
    if (!paused.value) {
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

function startGame(seed, boardHeight = 24, gravityMode = 'normal', gameMode = 'a', startLevel = 1, garbageHeight = 0, sparsity = 0) {
  stopReplay()
  const sameConfig = world && isPlayWorld &&
    boardHeight === currentSettings.boardHeight &&
    gravityMode === currentSettings.gravityMode &&
    gameMode === currentSettings.gameMode &&
    startLevel === currentSettings.startLevel &&
    garbageHeight === currentSettings.garbageHeight &&
    sparsity === currentSettings.sparsity
  if (sameConfig) {
    world.restart(seed)
  } else {
    world = createGame(canvas.value, { seed, boardHeight, gravityMode, visualHeight: VISUAL_HEIGHT, gameMode, startLevel, garbageHeight, sparsity })
    Object.assign(currentSettings, { boardHeight, gravityMode, gameMode, startLevel, garbageHeight, sparsity })
    isPlayWorld = true
    startGameLoop()
  }
}

// New game dialog
function onNewGame() {
  newGameDefaults.value = { ...currentSettings }
  dialogs.newGame = true
}

function onNewGameSubmit(data) {
  dialogs.newGame = false
  localStorage.setItem('tetris-settings', JSON.stringify(data))
  startGame(data.seed, data.boardHeight, data.gravityMode, data.gameMode, data.startLevel, data.garbageHeight, data.sparsity)
}

function onNewGameCancel() {
  dialogs.newGame = false
}

// State dialog
function copyState() {
  if (!world) return
  const json = JSON.stringify(world.exportState(), null, 2)
  navigator.clipboard.writeText(json)
}

function showState() {
  if (!world) return
  paused.value = true
  stateJson.value = JSON.stringify(world.exportState(), null, 2)
  dialogs.state = true
}

function closeState() {
  dialogs.state = false
  paused.value = false
}

// Replay
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
  paused.value = true
  replayJson.value = JSON.stringify(rec, null, 2)
  dialogs.replay = true
}

function closeReplay() {
  dialogs.replay = false
  paused.value = false
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
    boardHeight: recording.boardHeight,
    gravityMode: recording.gravityMode || (recording.cascadeGravity ? 'cascade' : 'normal'),
    visualHeight: VISUAL_HEIGHT,
    mode: 'replay',
    recording,
    gameMode: recording.gameMode || 'a',
    startLevel: recording.startLevel || 1,
    garbageHeight: recording.garbageHeight || 0,
    sparsity: recording.sparsity || 0,
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

// Debug
watch(animSlowdown, () => {
  if (!world) return
  if (!world.debug) world.debug = {}
  world.debug.animSlowdown = animSlowdown.value
})

function openDebugSettings() {
  dialogs.debug = true
}

function closeDebugSettings() {
  dialogs.debug = false
}

// Init
onMounted(() => {
  document.addEventListener('keydown', e => {
    if (e.key.toLowerCase() === 'p') {
      if (replaying.value) return
      if (!world) return
      const state = world.getComponent(world.boardId, 'GameState')
      if (state.phase === 'gameover' || state.phase === 'victory') return
      paused.value = !paused.value
    }
  })

  let seed, boardHeight, gravityMode, gameMode, startLevel, garbageHeight, sparsity
  try {
    const saved = JSON.parse(localStorage.getItem('tetris-settings'))
    if (saved) {
      seed = saved.seed
      boardHeight = saved.boardHeight
      gravityMode = saved.gravityMode || (saved.cascadeGravity ? 'cascade' : 'normal')
      gameMode = saved.gameMode
      startLevel = saved.startLevel
      garbageHeight = saved.garbageHeight
      sparsity = saved.sparsity
    }
  } catch {}
  startGame(seed, boardHeight, gravityMode, gameMode, startLevel, garbageHeight, sparsity)
})
</script>

<template>
  <canvas ref="canvas"></canvas>

  <!-- Left panel: HOLD, score info, controls -->
  <div class="side-panel" :style="leftPanelStyle" v-if="game.cellSize > 0">
    <div class="label" :style="{ fontSize }">HOLD</div>
    <div class="score-block" :style="{ marginTop: game.cellSize * 4.8 + 'px' }">
      <div class="label" :style="{ fontSize }">SCORE</div>
      <div class="value" :style="{ fontSize, marginTop: fontSize }">{{ game.score }}</div>
      <div class="label" :style="{ fontSize, marginTop: fontSize }">LINES</div>
      <div class="value" :style="{ fontSize, marginTop: fontSize }">{{ linesDisplay }}</div>
      <div class="label" :style="{ fontSize, marginTop: fontSize }">LEVEL</div>
      <div class="value" :style="{ fontSize, marginTop: fontSize }">{{ game.level }}</div>
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
      <tr><td>P</td><td>Pause</td></tr>
    </table>
  </div>

  <!-- Right panel: NEXT -->
  <div class="side-panel" :style="rightPanelStyle" v-if="game.cellSize > 0">
    <div class="label" :style="{ fontSize }">NEXT</div>
  </div>

  <!-- Game over overlay -->
  <div class="game-over-overlay" :style="gameOverStyle" v-if="game.phase === 'gameover' && game.cellSize > 0">
    <div class="game-over-text" :style="{ fontSize: gameOverFontSize }">GAME OVER</div>
    <div class="game-over-sub" :style="{ fontSize: gameOverSubFontSize }">Press R to restart</div>
  </div>

  <!-- Victory overlay -->
  <div class="game-over-overlay" :style="gameOverStyle" v-if="game.phase === 'victory' && game.cellSize > 0">
    <div class="game-over-text" :style="{ fontSize: gameOverFontSize }">SUCCESS!</div>
    <div class="game-over-sub" :style="{ fontSize: gameOverSubFontSize }">25 Lines Cleared!</div>
    <div class="game-over-sub" :style="{ fontSize: gameOverSubFontSize }">Press R to play again</div>
  </div>

  <!-- Pause overlay -->
  <div class="game-over-overlay" :style="gameOverStyle" v-if="paused && game.phase !== 'gameover' && game.phase !== 'victory' && game.cellSize > 0">
    <div class="game-over-text" :style="{ fontSize: gameOverFontSize }">PAUSED</div>
    <div class="game-over-sub" :style="{ fontSize: gameOverSubFontSize }">Press P to resume</div>
  </div>

  <!-- Debug panel -->
  <div class="debug-panel">
    <table>
      <tr><td class="debug-label">piece</td><td>{{ game.activePieceId ?? '—' }}</td></tr>
      <tr><td class="debug-label">highest</td><td>{{ game.highestBlock }}</td></tr>
      <tr><td class="debug-label">seed</td><td>{{ game.seed ?? '—' }}</td></tr>
      <tr><td class="debug-label">height</td><td>{{ game.boardHeight }}</td></tr>
      <tr><td class="debug-label">gravity</td><td>{{ game.gravityMode }}</td></tr>
    </table>
  </div>

  <div class="btn-row">
    <button class="btn -secondary" @click="onNewGame">New Game</button>
    <button class="btn -secondary" @click="copyState">Copy State</button>
    <button class="btn -secondary" @click="showState">Show State</button>
    <button class="btn -secondary" @click="copyReplay">Copy Replay</button>
    <button class="btn -secondary" @click="showReplay">Show Replay</button>
    <button class="btn -secondary" @click="loadReplay">Load Replay</button>
    <button class="btn -secondary" @click="openDebugSettings">Debug</button>
  </div>

  <UnrestDialog :open="dialogs.state" title="Game State" content-class="modal__content--wide" @close="closeState">
    <pre class="state-pre">{{ stateJson }}</pre>
    <template #actions>
      <button class="btn -secondary" type="button" @click="closeState">Close</button>
    </template>
  </UnrestDialog>

  <UnrestDialog :open="dialogs.replay" title="Replay Data" content-class="modal__content--wide" @close="closeReplay">
    <pre class="state-pre">{{ replayJson }}</pre>
    <template #actions>
      <button class="btn -secondary" type="button" @click="closeReplay">Close</button>
    </template>
  </UnrestDialog>

  <UnrestDialog :open="dialogs.debug" title="Debug Settings" @close="closeDebugSettings">
    <DebugForm v-model:animSlowdown="animSlowdown" @close="closeDebugSettings" />
  </UnrestDialog>

  <UnrestDialog :open="dialogs.newGame" title="New Game" @close="onNewGameCancel">
    <NewGameForm :defaults="newGameDefaults" @submit="onNewGameSubmit" @cancel="onNewGameCancel" />
  </UnrestDialog>
</template>

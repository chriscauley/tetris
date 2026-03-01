<script setup>
import { ref, reactive, computed, watch, onMounted } from 'vue'
import { createGame } from '@game/tetris.js'
import UnrestDialog from './components/UnrestDialog.vue'
import NewGameForm from './components/NewGameForm.vue'
import DebugForm from './components/DebugForm.vue'

const replayTests = Object.entries(
  import.meta.glob('@replays/*.json', { eager: true })
).map(([path, mod]) => ({ name: path.split('/').pop().replace('.json', ''), recording: mod.default }))

// Constants
const TICK_MS = 16
const VISUAL_HEIGHT = 20

// Game engine (non-reactive)
let world = null
let gameAnimId = null
let replayAnimId = null
let isPlayWorld = false
let currentRecording = null
let currentSettings = {
  boardHeight: 20,
  gravityMode: 'normal',
  manualShake: false,
  shakeAnimation: false,
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
  manualShake: false,
  gameMode: 'a',
  linesGoal: null,
})

// App UI state
const canvas = ref(null)
const paused = ref(false)
const replaying = ref(false)
const replayPaused = ref(false)
const replayFastForward = ref(false)
const animSlowdown = ref(1)
const dialogs = reactive({
  newGame: false,
  state: false,
  replay: false,
  debug: false,
  replayTests: false,
})
const newGameDefaults = ref({})
const stateJson = ref('')
const replayJson = ref('')

// Computed styles
const linesDisplay = computed(() => {
  if (game.linesGoal !== null) return game.lines + ' / ' + game.linesGoal
  return '' + game.lines
})

const scoreRows = computed(() => [
  ['SCORE', game.score],
  ['LINES', linesDisplay.value],
  ['LEVEL', game.level],
])

const controlRows = computed(() => {
  const rows = [
    ['\u2190\u2192', 'Move'],
    ['\u2191 X', 'Rotate CW'],
    ['Z', 'Rotate CCW'],
    ['\u2193', 'Soft Drop'],
    ['Space', 'Hard Drop'],
    ['C', 'Hold'],
    ['P', 'Pause'],
  ]
  if (game.gravityMode !== 'normal' && game.manualShake) rows.push(['Ctrl', 'Shake'])
  return rows
})

const gameAreaStyle = computed(() => ({
  '--cell-size': game.cellSize + 'px',
  '--board-x': game.boardX + 'px',
  '--board-y': game.boardY + 'px',
}))

// Engine sync
const readWorldState = () => {
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
    game.manualShake = ui.manualShake ?? false
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
const stopGameLoop = () => {
  if (gameAnimId) {
    cancelAnimationFrame(gameAnimId)
    gameAnimId = null
  }
}

const startGameLoop = () => {
  stopGameLoop()
  let lastTime = performance.now()
  let accumulator = 0
  const loop = (time) => {
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

// Replay (before startGame since it depends on stopReplay)
const stopReplay = () => {
  if (replayAnimId) {
    cancelAnimationFrame(replayAnimId)
    replayAnimId = null
  }
  replaying.value = false
}

const startGame = (settings = {}) => {
  stopReplay()
  const { seed, boardHeight = 24, gravityMode = 'normal', manualShake = false, shakeAnimation = false, gameMode = 'a', startLevel = 1, garbageHeight = 0, sparsity = 0 } = settings
  const sameConfig =
    world &&
    isPlayWorld &&
    boardHeight === currentSettings.boardHeight &&
    gravityMode === currentSettings.gravityMode &&
    manualShake === currentSettings.manualShake &&
    shakeAnimation === currentSettings.shakeAnimation &&
    gameMode === currentSettings.gameMode &&
    startLevel === currentSettings.startLevel &&
    garbageHeight === currentSettings.garbageHeight &&
    sparsity === currentSettings.sparsity
  if (sameConfig) {
    world.restart(seed)
  } else {
    world = createGame(canvas.value, { ...settings, visualHeight: VISUAL_HEIGHT })
    Object.assign(currentSettings, { boardHeight, gravityMode, manualShake, shakeAnimation, gameMode, startLevel, garbageHeight, sparsity })
    isPlayWorld = true
    startGameLoop()
  }
}

// New game dialog
const onNewGame = () => {
  newGameDefaults.value = { ...currentSettings }
  dialogs.newGame = true
}

const onNewGameSubmit = (data) => {
  dialogs.newGame = false
  data.seed = data.seed?.trim() || undefined
  localStorage.setItem('tetris-settings', JSON.stringify(data))
  startGame(data)
}

const onNewGameCancel = () => { dialogs.newGame = false }

// State dialog
const copyState = () => {
  if (!world) return
  const json = JSON.stringify(world.exportState(), null, 2)
  navigator.clipboard.writeText(json)
}

const showState = () => {
  if (!world) return
  paused.value = true
  stateJson.value = JSON.stringify(world.exportState(), null, 2)
  dialogs.state = true
}

const closeState = () => {
  dialogs.state = false
  paused.value = false
}

// Replay
const getFullRecording = () => {
  if (!world) return null
  const rec = world.getRecording()
  if (!rec) return null
  const board = world.getComponent(world.boardId, 'Board')
  const CELL_CHARS = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const grid = board.grid
    .filter((row) => row.some((cell) => cell !== null))
    .map((row) => row.map((c) => (c === null ? ' ' : (CELL_CHARS[c] ?? '?'))).join(''))
  const { frames, ...rest } = rec
  return { expectedGrid: grid, ...rest, frames }
}

const showReplay = () => {
  const rec = getFullRecording()
  if (!rec) return
  paused.value = true
  replayJson.value = JSON.stringify(rec, null, 2)
  dialogs.replay = true
}

const closeReplay = () => {
  dialogs.replay = false
  paused.value = false
}

const copyReplay = () => {
  const rec = getFullRecording()
  if (!rec) return
  navigator.clipboard.writeText(JSON.stringify(rec, null, 2))
}

const startReplay = (recording) => {
  stopReplay()
  stopGameLoop()
  currentRecording = recording
  replayPaused.value = false
  replayFastForward.value = false
  isPlayWorld = false
  world = createGame(canvas.value, { ...recording, visualHeight: VISUAL_HEIGHT, mode: 'replay', recording })
  replaying.value = true

  let lastTime = performance.now()
  let accumulator = 0

  const replayLoop = (time) => {
    const delta = Math.min(time - lastTime, 100)
    lastTime = time
    if (!replayPaused.value) {
      accumulator += delta * (replayFastForward.value ? 5 : 1)

      while (accumulator >= TICK_MS) {
        accumulator -= TICK_MS
        const more = world.replayTick()
        if (!more) {
          readWorldState()
          stopReplay()
          return
        }
      }
    }

    readWorldState()
    replayAnimId = requestAnimationFrame(replayLoop)
  }

  replayAnimId = requestAnimationFrame(replayLoop)
}

const replayRestart = () => startReplay(currentRecording)
const replayJumpToEnd = () => {
  while (world.replayTick()) {}
  readWorldState()
  stopReplay()
}
const replayTogglePause = () => { replayPaused.value = !replayPaused.value }
const replayToggleFastForward = () => { replayFastForward.value = !replayFastForward.value }

const loadReplay = async () => {
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

const startReplayTest = (recording) => {
  dialogs.replayTests = false
  startReplay(recording)
}

const openDebugSettings = () => { dialogs.debug = true }
const closeDebugSettings = () => { dialogs.debug = false }

// Init
onMounted(() => {
  document.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() === 'p') {
      if (replaying.value) return
      if (!world) return
      const state = world.getComponent(world.boardId, 'GameState')
      if (state.phase === 'gameover' || state.phase === 'victory') return
      paused.value = !paused.value
    }
  })

  let settings = {}
  try {
    const saved = JSON.parse(localStorage.getItem('tetris-settings'))
    if (saved) {
      settings = saved
      if (saved.cascadeGravity && !saved.gravityMode) settings.gravityMode = 'cascade'
    }
  } catch {}
  startGame(settings)
})
</script>

<template>
  <div class="game-area" :style="gameAreaStyle">
  <canvas ref="canvas"></canvas>

  <!-- Left panel: HOLD, score info, controls -->
  <div v-if="game.cellSize > 0" class="side-panel --left">
    <div class="label">HOLD</div>
    <table class="score-block">
      <tr v-for="[label, value] in scoreRows" :key="label"><td>{{ label }}</td><td>{{ value }}</td></tr>
    </table>
    <div v-if="replaying" class="replay-controls">
      <button @click="replayRestart">⏮</button>
      <button @click="replayTogglePause">{{ replayPaused ? '▶' : '⏸' }}</button>
      <button @click="replayJumpToEnd">⏭</button>
      <button :class="{ active: replayFastForward }" @click="replayToggleFastForward">⏩</button>
    </div>
    <table class="controls-help">
      <tr v-for="[key, desc] in controlRows" :key><td>{{ key }}</td><td>{{ desc }}</td></tr>
    </table>
  </div>

  <!-- Right panel: NEXT -->
  <div v-if="game.cellSize > 0" class="side-panel --right">
    <div class="label">NEXT</div>
  </div>

  <!-- Game over overlay -->
  <div v-if="game.phase === 'gameover' && game.cellSize > 0" class="game-over-overlay">
    <div class="game-over-text">GAME OVER</div>
    <div class="game-over-sub">Press R to restart</div>
  </div>

  <!-- Victory overlay -->
  <div v-if="game.phase === 'victory' && game.cellSize > 0" class="game-over-overlay">
    <div class="game-over-text">SUCCESS!</div>
    <div class="game-over-sub">25 Lines Cleared!</div>
    <div class="game-over-sub">Press R to play again</div>
  </div>

  <!-- Pause overlay -->
  <div v-if="paused && game.phase !== 'gameover' && game.phase !== 'victory' && game.cellSize > 0" class="game-over-overlay">
    <div class="game-over-text">PAUSED</div>
    <div class="game-over-sub">Press P to resume</div>
  </div>

  <!-- Debug panel -->
  <div class="debug-panel">
    <table>
      <tr>
        <td class="debug-label">piece</td>
        <td>{{ game.activePieceId ?? '—' }}</td>
      </tr>
      <tr>
        <td class="debug-label">highest</td>
        <td>{{ game.highestBlock }}</td>
      </tr>
      <tr>
        <td class="debug-label">seed</td>
        <td>{{ game.seed ?? '—' }}</td>
      </tr>
      <tr>
        <td class="debug-label">height</td>
        <td>{{ game.boardHeight }}</td>
      </tr>
      <tr>
        <td class="debug-label">gravity</td>
        <td>{{ game.gravityMode }}</td>
      </tr>
    </table>
  </div>

  <div class="btn-row">
    <button class="btn -secondary" @click="onNewGame">New Game</button>
    <button class="btn -secondary" @click="copyState">Copy State</button>
    <button class="btn -secondary" @click="showState">Show State</button>
    <button class="btn -secondary" @click="copyReplay">Copy Replay</button>
    <button class="btn -secondary" @click="showReplay">Show Replay</button>
    <button class="btn -secondary" @click="loadReplay">Load Replay</button>
    <button class="btn -secondary" @click="dialogs.replayTests = true">Replay Tests</button>
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
    <DebugForm v-model="animSlowdown" @close="closeDebugSettings" />
  </UnrestDialog>

  <UnrestDialog :open="dialogs.replayTests" title="Replay Tests" @close="dialogs.replayTests = false">
    <div v-for="test in replayTests" :key="test.name">
      <button class="btn -secondary" @click="startReplayTest(test.recording)">{{ test.name }}</button>
    </div>
    <template #actions>
      <button class="btn -secondary" type="button" @click="dialogs.replayTests = false">Close</button>
    </template>
  </UnrestDialog>

  <UnrestDialog :open="dialogs.newGame" title="New Game" @close="onNewGameCancel">
    <NewGameForm :defaults="newGameDefaults" @submit="onNewGameSubmit" @cancel="onNewGameCancel" />
  </UnrestDialog>
  </div>
</template>

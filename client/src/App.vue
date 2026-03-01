<script setup>
import { ref, reactive, computed, watch, onMounted, nextTick } from 'vue'
import { createGame } from '@game/tetris.js'
import { DEFAULT_KEY_MAP } from '@game/systems.js'
import UnrestDialog from './components/UnrestDialog.vue'
import NewGameForm from './components/NewGameForm.vue'
import ControlsForm from './components/ControlsForm.vue'
import DebugForm from './components/DebugForm.vue'

const replayTests = Object.entries(
  import.meta.glob('@replays/*.json', { eager: true })
).map(([path, mod]) => ({ name: path.split('/').pop().replace('.json', ''), recording: mod.default }))

// Constants
const TICK_MS = 16
const VISUAL_HEIGHT = 20

const MULTIPLAYER_P1_KEYS = {
  left: ['KeyA'], right: ['KeyD'], softdrop: ['KeyS'], harddrop: ['KeyF'],
  rotate_cw: ['KeyW', 'KeyX'], rotate_ccw: ['KeyQ', 'KeyZ'],
  hold: ['KeyE', 'KeyC'], shake: ['KeyR', 'KeyV'],
}

const MULTIPLAYER_P2_KEYS = {
  left: ['KeyJ'], right: ['KeyL'], softdrop: ['KeyK'], harddrop: ['KeyH'],
  rotate_cw: ['KeyI', 'Comma'], rotate_ccw: ['KeyO', 'Period'],
  hold: ['KeyU', 'KeyM'], shake: ['KeyY', 'KeyN'],
}

// Game engine (non-reactive)
let worlds = [null, null]
let gameAnimId = null
let replayAnimId = null
let isPlayWorld = false
let currentRecording = null
const currentKeyMap = ref(null)
const playerCount = ref(1)
let currentSettings = {
  playerCount: 1,
  boardHeight: 20,
  gravityMode: 'normal',
  manualShake: false,
  shakeAnimation: false,
  gameMode: 'a',
  startLevel: 1,
  garbageHeight: 0,
  sparsity: 0,
}

const makePlayerState = () => ({
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

// Game state (read from engine each frame)
const players = reactive([makePlayerState(), makePlayerState()])
const activePlayers = computed(() => players.slice(0, playerCount.value))

// App UI state
const canvasRefs = [ref(null), ref(null)]
const paused = ref(false)
const replaying = ref(false)
const replayPaused = ref(false)
const replayFastForward = ref(false)
const animSlowdown = ref(1)
const dialogs = reactive({
  newGame: false,
  controls: false,
  state: false,
  replay: false,
  debug: false,
  replayTests: false,
})
const newGameDefaults = ref({})
const stateJson = ref('')
const replayJson = ref('')

// Computed styles
const CODE_DISPLAY_SHORT = {
  ArrowLeft: '\u2190', ArrowRight: '\u2192', ArrowUp: '\u2191', ArrowDown: '\u2193',
  Space: 'Space', ShiftLeft: 'Shift', ShiftRight: 'Shift',
  ControlLeft: 'Ctrl', ControlRight: 'Ctrl',
  Comma: ',', Period: '.',
}
const shortCode = (c) => CODE_DISPLAY_SHORT[c] || c.replace(/^Key/, '').replace(/^Digit/, '')

const linesDisplay = (p) => p.linesGoal !== null ? p.lines + ' / ' + p.linesGoal : '' + p.lines

const scoreRows = (p) => [
  ['SCORE', p.score],
  ['LINES', linesDisplay(p)],
  ['LEVEL', p.level],
]

const controlRows = (idx) => {
  let km
  if (playerCount.value === 2) {
    km = idx === 0 ? MULTIPLAYER_P1_KEYS : MULTIPLAYER_P2_KEYS
  } else {
    km = currentKeyMap.value || DEFAULT_KEY_MAP
  }
  const row = (action, label) => [km[action]?.map(shortCode).join(' ') || '', label]
  const p = players[idx]
  const rows = [
    row('left', 'Move Left'), row('right', 'Move Right'),
    row('rotate_cw', 'Rotate CW'), row('rotate_ccw', 'Rotate CCW'),
    row('softdrop', 'Soft Drop'), row('harddrop', 'Hard Drop'),
    row('hold', 'Hold'), ['Esc', 'Pause'],
  ]
  if (p.gravityMode !== 'normal' && p.manualShake) rows.push(row('shake', 'Shake'))
  return rows
}

const playerAreaStyle = (idx) => {
  const p = players[idx]
  return {
    '--cell-size': p.cellSize + 'px',
    '--board-x': p.boardX + 'px',
    '--board-y': p.boardY + 'px',
  }
}

// Engine sync
const readWorldState = (idx) => {
  const world = worlds[idx]
  if (!world) return
  const p = players[idx]
  const ui = world.ui
  if (ui) {
    p.cellSize = ui.cellSize
    p.boardX = ui.boardX
    p.boardY = ui.boardY
    p.highestBlock = ui.highestRow ?? 0
    p.seed = ui.seed ?? ''
    p.boardHeight = ui.boardHeight ?? 24
    p.gravityMode = ui.gravityMode ?? 'normal'
    p.manualShake = ui.manualShake ?? false
  }
  const boardId = world.query('Board', 'Score', 'GameState')[0]
  if (boardId === undefined) return
  const s = world.getComponent(boardId, 'Score')
  if (s) {
    p.score = s.score
    p.lines = s.lines
    p.level = s.level
  }
  const gs = world.getComponent(boardId, 'GameState')
  if (gs) p.phase = gs.phase
  const gm = world.getComponent(boardId, 'GameMode')
  if (gm) {
    p.gameMode = gm.type
    p.linesGoal = gm.linesGoal
  }
  const apIds = world.query('ActivePiece')
  p.activePieceId = apIds.length > 0
    ? (world.getComponent(apIds[0], 'ActivePiece')?.pieceId ?? null)
    : null
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
        for (let i = 0; i < playerCount.value; i++) {
          if (worlds[i]) worlds[i].update()
        }
      }
      for (let i = 0; i < playerCount.value; i++) readWorldState(i)
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

const destroyWorlds = () => {
  for (let i = 0; i < worlds.length; i++) {
    if (worlds[i]?.destroy) worlds[i].destroy()
    worlds[i] = null
  }
}

const createWorlds = (settings, pc) => {
  destroyWorlds()
  const baseOpts = { ...settings, visualHeight: VISUAL_HEIGHT }
  if (pc === 2) {
    worlds[0] = createGame(canvasRefs[0].value, { ...baseOpts, keyMap: MULTIPLAYER_P1_KEYS, handleRestart: false })
    worlds[1] = createGame(canvasRefs[1].value, { ...baseOpts, keyMap: MULTIPLAYER_P2_KEYS, handleRestart: false })
  } else {
    worlds[0] = createGame(canvasRefs[0].value, { ...baseOpts, keyMap: currentKeyMap.value })
    worlds[1] = null
  }
  isPlayWorld = true
  startGameLoop()
}

const startGame = async (settings = {}) => {
  stopReplay()
  const { seed, playerCount: rawPc = 1, boardHeight = 24, gravityMode = 'normal', manualShake = false, shakeAnimation = false, gameMode = 'a', startLevel = 1, garbageHeight = 0, sparsity = 0 } = settings
  const pc = Number(rawPc) || 1

  const sameConfig =
    worlds[0] &&
    isPlayWorld &&
    pc === currentSettings.playerCount &&
    boardHeight === currentSettings.boardHeight &&
    gravityMode === currentSettings.gravityMode &&
    manualShake === currentSettings.manualShake &&
    shakeAnimation === currentSettings.shakeAnimation &&
    gameMode === currentSettings.gameMode &&
    startLevel === currentSettings.startLevel &&
    garbageHeight === currentSettings.garbageHeight &&
    sparsity === currentSettings.sparsity

  Object.assign(currentSettings, { playerCount: pc, boardHeight, gravityMode, manualShake, shakeAnimation, gameMode, startLevel, garbageHeight, sparsity })

  if (sameConfig) {
    for (let i = 0; i < pc; i++) worlds[i].restart(seed)
  } else if (pc !== playerCount.value) {
    // Player count changed — need DOM to update before we can grab canvas refs
    playerCount.value = pc
    await nextTick()
    createWorlds(settings, pc)
  } else {
    playerCount.value = pc
    createWorlds(settings, pc)
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

// State dialog (P1 only)
const copyState = () => {
  if (!worlds[0]) return
  const json = JSON.stringify(worlds[0].exportState(), null, 2)
  navigator.clipboard.writeText(json)
}

const showState = () => {
  if (!worlds[0]) return
  paused.value = true
  stateJson.value = JSON.stringify(worlds[0].exportState(), null, 2)
  dialogs.state = true
}

const closeState = () => {
  dialogs.state = false
  paused.value = false
}

// Replay (P1 only)
const getFullRecording = () => {
  if (!worlds[0]) return null
  const rec = worlds[0].getRecording()
  if (!rec) return null
  const board = worlds[0].getComponent(worlds[0].boardId, 'Board')
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
  destroyWorlds()
  currentRecording = recording
  replayPaused.value = false
  replayFastForward.value = false
  isPlayWorld = false
  playerCount.value = 1
  worlds[0] = createGame(canvasRefs[0].value, { ...recording, visualHeight: VISUAL_HEIGHT, mode: 'replay', recording })
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
        const more = worlds[0].replayTick()
        if (!more) {
          readWorldState(0)
          stopReplay()
          return
        }
      }
    }

    readWorldState(0)
    replayAnimId = requestAnimationFrame(replayLoop)
  }

  replayAnimId = requestAnimationFrame(replayLoop)
}

const replayRestart = () => startReplay(currentRecording)
const replayJumpToEnd = () => {
  while (worlds[0].replayTick()) {}
  readWorldState(0)
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
  for (let i = 0; i < playerCount.value; i++) {
    if (!worlds[i]) continue
    if (!worlds[i].debug) worlds[i].debug = {}
    worlds[i].debug.animSlowdown = animSlowdown.value
  }
})

const startReplayTest = (recording) => {
  dialogs.replayTests = false
  startReplay(recording)
}

// Controls dialog
const onControls = () => { dialogs.controls = true }
const onControlsSubmit = (keyMap) => {
  dialogs.controls = false
  currentKeyMap.value = keyMap
  localStorage.setItem('tetris-controls', JSON.stringify(keyMap))
  isPlayWorld = false
}
const onControlsCancel = () => { dialogs.controls = false }

const openDebugSettings = () => { dialogs.debug = true }
const closeDebugSettings = () => { dialogs.debug = false }

// Init
onMounted(() => {
  document.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase()
    if (e.key === 'Escape') {
      if (replaying.value) return
      if (!worlds[0]) return
      // In multiplayer, check if any player is still playing
      let anyPlaying = false
      for (let i = 0; i < playerCount.value; i++) {
        if (!worlds[i]) continue
        const state = worlds[i].getComponent(worlds[i].boardId, 'GameState')
        if (state.phase !== 'gameover' && state.phase !== 'victory') { anyPlaying = true; break }
      }
      if (!anyPlaying) return
      paused.value = !paused.value
    }
    if (key === 'r' && playerCount.value === 2) {
      // In multiplayer, R restarts when all players are done
      let allDone = true
      for (let i = 0; i < playerCount.value; i++) {
        if (!worlds[i]) { allDone = false; break }
        const state = worlds[i].getComponent(worlds[i].boardId, 'GameState')
        if (state.phase !== 'gameover' && state.phase !== 'victory') { allDone = false; break }
      }
      if (allDone) {
        const seed = worlds[0].seed
        for (let i = 0; i < playerCount.value; i++) worlds[i].restart(seed)
      }
    }
  })

  try {
    const savedControls = JSON.parse(localStorage.getItem('tetris-controls'))
    if (savedControls) currentKeyMap.value = savedControls
  } catch {}

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
  <div class="game-container">
  <div v-for="(p, idx) in activePlayers" :key="idx" class="player-area game-area" :style="playerAreaStyle(idx)">
    <canvas :ref="el => canvasRefs[idx].value = el"></canvas>

    <!-- Left panel: HOLD, score info, controls -->
    <div v-if="p.cellSize > 0" class="side-panel --left">
      <div class="label">HOLD</div>
      <table class="score-block">
        <tr v-for="[label, value] in scoreRows(p)" :key="label"><td>{{ label }}</td><td>{{ value }}</td></tr>
      </table>
      <div v-if="replaying && idx === 0" class="replay-controls">
        <button @click="replayRestart">⏮</button>
        <button @click="replayTogglePause">{{ replayPaused ? '▶' : '⏸' }}</button>
        <button @click="replayJumpToEnd">⏭</button>
        <button :class="{ active: replayFastForward }" @click="replayToggleFastForward">⏩</button>
      </div>
      <table class="controls-help">
        <tr v-for="[key, desc] in controlRows(idx)" :key><td>{{ key }}</td><td>{{ desc }}</td></tr>
      </table>
    </div>

    <!-- Right panel: NEXT -->
    <div v-if="p.cellSize > 0" class="side-panel --right">
      <div class="label">NEXT</div>
    </div>

    <!-- Game over overlay -->
    <div v-if="p.phase === 'gameover' && p.cellSize > 0" class="game-over-overlay">
      <div class="game-over-text">GAME OVER</div>
      <div class="game-over-sub">Press R to restart</div>
    </div>

    <!-- Victory overlay -->
    <div v-if="p.phase === 'victory' && p.cellSize > 0" class="game-over-overlay">
      <div class="game-over-text">SUCCESS!</div>
      <div class="game-over-sub">25 Lines Cleared!</div>
      <div class="game-over-sub">Press R to play again</div>
    </div>

    <!-- Pause overlay -->
    <div v-if="paused && p.phase !== 'gameover' && p.phase !== 'victory' && p.cellSize > 0" class="game-over-overlay">
      <div class="game-over-text">PAUSED</div>
      <div class="game-over-sub">Press Esc to resume</div>
    </div>
  </div>
  </div>

  <!-- Debug panel -->
  <div class="debug-panel">
    <table>
      <tr>
        <td class="debug-label">piece</td>
        <td>{{ players[0].activePieceId ?? '—' }}</td>
      </tr>
      <tr>
        <td class="debug-label">highest</td>
        <td>{{ players[0].highestBlock }}</td>
      </tr>
      <tr>
        <td class="debug-label">seed</td>
        <td>{{ players[0].seed ?? '—' }}</td>
      </tr>
      <tr>
        <td class="debug-label">height</td>
        <td>{{ players[0].boardHeight }}</td>
      </tr>
      <tr>
        <td class="debug-label">gravity</td>
        <td>{{ players[0].gravityMode }}</td>
      </tr>
    </table>
  </div>

  <div class="btn-row">
    <button class="btn -secondary" @click="onNewGame">New Game</button>
    <template v-if="playerCount === 1">
      <button  class="btn -secondary" @click="copyState">Copy State</button>
      <button  class="btn -secondary" @click="showState">Show State</button>
      <button  class="btn -secondary" @click="copyReplay">Copy Replay</button>
      <button  class="btn -secondary" @click="showReplay">Show Replay</button>
      <button  class="btn -secondary" @click="loadReplay">Load Replay</button>
      <button  class="btn -secondary" @click="dialogs.replayTests = true">Replay Tests</button>
      <button  class="btn -secondary" @click="onControls">Controls</button>
      <button class="btn -secondary" @click="openDebugSettings">Debug</button>
    </template>
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

  <UnrestDialog :open="dialogs.controls" title="Controls" @close="onControlsCancel">
    <ControlsForm :defaults="currentKeyMap || DEFAULT_KEY_MAP" @submit="onControlsSubmit" @cancel="onControlsCancel" />
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
</template>

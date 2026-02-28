<script setup>
import { ref, computed, onMounted } from 'vue'
import { createGame } from '@game/tetris.js'
import UnrestDialog from './components/UnrestDialog.vue'

const TICK_MS = 16

const canvas = ref(null)
const showNewGameDialog = ref(false)
const showStateDialog = ref(false)
const showReplayDialog = ref(false)
const showDebugDialog = ref(false)
const stateJson = ref('')
const replayJson = ref('')
const seedInput = ref('')
const linesInput = ref(20)
const gravityModeInput = ref('normal')
const gameModeInput = ref('a')
const startLevelInput = ref(1)
const garbageHeightInput = ref(0)
const sparsityInput = ref(0)
let world = null
const paused = ref(false)
let gameAnimId = null
let replayAnimId = null
let currentBoardHeight = 20
let currentGravityMode = 'normal'
let currentGameMode = 'a'
let currentStartLevel = 1
let currentGarbageHeight = 0
let currentSparsity = 0
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
const gameGravityMode = ref('normal')
const activeGameMode = ref('a')
const linesGoal = ref(null)
const animSlowdown = ref(1)

const BOARD_WIDTH = 10
const VISUAL_HEIGHT = 20

const linesDisplay = computed(() => {
  if (linesGoal.value !== null) return lines.value + ' / ' + linesGoal.value
  return '' + lines.value
})

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
    gameBoardHeight.value = ui.boardHeight ?? 24
    gameGravityMode.value = ui.gravityMode ?? 'normal'
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
  const gm = world.getComponent(boardId, 'GameMode')
  if (gm) {
    activeGameMode.value = gm.type
    linesGoal.value = gm.linesGoal
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

let isPlayWorld = false

function startGame(seed, boardHeight = 24, gravityMode = 'normal', gameMode = 'a', startLevel = 1, garbageHeight = 0, sparsity = 0) {
  stopReplay()
  const sameConfig = world && isPlayWorld &&
    boardHeight === currentBoardHeight &&
    gravityMode === currentGravityMode &&
    gameMode === currentGameMode &&
    startLevel === currentStartLevel &&
    garbageHeight === currentGarbageHeight &&
    sparsity === currentSparsity
  if (sameConfig) {
    world.restart(seed)
  } else {
    world = createGame(canvas.value, { seed, boardHeight, gravityMode, visualHeight: VISUAL_HEIGHT, gameMode, startLevel, garbageHeight, sparsity })
    currentBoardHeight = boardHeight
    currentGravityMode = gravityMode
    currentGameMode = gameMode
    currentStartLevel = startLevel
    currentGarbageHeight = garbageHeight
    currentSparsity = sparsity
    isPlayWorld = true
    startGameLoop()
  }
}

function onNewGame() {
  seedInput.value = ''
  linesInput.value = currentBoardHeight
  gravityModeInput.value = currentGravityMode
  gameModeInput.value = currentGameMode
  startLevelInput.value = currentStartLevel
  garbageHeightInput.value = currentGarbageHeight
  sparsityInput.value = currentSparsity
  showNewGameDialog.value = true
}

function onNewGameSubmit() {
  const seed = seedInput.value.trim() || undefined
  const boardHeight = Math.max(15, Math.min(50, Math.floor(Number(linesInput.value) || 24)))
  const gravityMode = gravityModeInput.value
  const gameMode = gameModeInput.value
  const startLevel = Math.max(1, Math.min(10, Math.floor(Number(startLevelInput.value) || 1)))
  const garbageHeight = gameMode === 'b' ? Math.max(0, Math.min(5, Math.floor(Number(garbageHeightInput.value) || 0))) : 0
  const sparsity = gameMode === 'b' ? Math.max(0, Math.floor(Number(sparsityInput.value) || 0)) : 0
  showNewGameDialog.value = false
  localStorage.setItem('tetris-settings', JSON.stringify({ seed, boardHeight, gravityMode, gameMode, startLevel, garbageHeight, sparsity }))
  startGame(seed, boardHeight, gravityMode, gameMode, startLevel, garbageHeight, sparsity)
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
  paused.value = true
  stateJson.value = JSON.stringify(world.exportState(), null, 2)
  showStateDialog.value = true
}

function closeState() {
  showStateDialog.value = false
  paused.value = false
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
  paused.value = true
  replayJson.value = JSON.stringify(rec, null, 2)
  showReplayDialog.value = true
}

function closeReplay() {
  showReplayDialog.value = false
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

function syncDebugSettings() {
  if (!world) return
  if (!world.debug) world.debug = {}
  world.debug.animSlowdown = animSlowdown.value
}

function openDebugSettings() {
  showDebugDialog.value = true
}

function closeDebugSettings() {
  showDebugDialog.value = false
}

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
  <div class="side-panel" :style="leftPanelStyle" v-if="cellSize > 0">
    <div class="label" :style="{ fontSize }">HOLD</div>
    <div class="score-block" :style="{ marginTop: cellSize * 4.8 + 'px' }">
      <div class="label" :style="{ fontSize }">SCORE</div>
      <div class="value" :style="{ fontSize, marginTop: fontSize }">{{ score }}</div>
      <div class="label" :style="{ fontSize, marginTop: fontSize }">LINES</div>
      <div class="value" :style="{ fontSize, marginTop: fontSize }">{{ linesDisplay }}</div>
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
      <tr><td>P</td><td>Pause</td></tr>
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

  <!-- Victory overlay -->
  <div class="game-over-overlay" :style="gameOverStyle" v-if="gamePhase === 'victory' && cellSize > 0">
    <div class="game-over-text" :style="{ fontSize: gameOverFontSize }">SUCCESS!</div>
    <div class="game-over-sub" :style="{ fontSize: gameOverSubFontSize }">25 Lines Cleared!</div>
    <div class="game-over-sub" :style="{ fontSize: gameOverSubFontSize }">Press R to play again</div>
  </div>

  <!-- Pause overlay -->
  <div class="game-over-overlay" :style="gameOverStyle" v-if="paused && gamePhase !== 'gameover' && gamePhase !== 'victory' && cellSize > 0">
    <div class="game-over-text" :style="{ fontSize: gameOverFontSize }">PAUSED</div>
    <div class="game-over-sub" :style="{ fontSize: gameOverSubFontSize }">Press P to resume</div>
  </div>

  <!-- Debug panel -->
  <div class="debug-panel">
    <table>
      <tr><td class="debug-label">piece</td><td>{{ activePieceId ?? '—' }}</td></tr>
      <tr><td class="debug-label">highest</td><td>{{ highestBlock }}</td></tr>
      <tr><td class="debug-label">seed</td><td>{{ gameSeed ?? '—' }}</td></tr>
      <tr><td class="debug-label">height</td><td>{{ gameBoardHeight }}</td></tr>
      <tr><td class="debug-label">gravity</td><td>{{ gameGravityMode }}</td></tr>
    </table>
  </div>

  <div class="btn-row">
    <button class="new-game-btn" @click="onNewGame">New Game</button>
    <button class="new-game-btn" @click="copyState">Copy State</button>
    <button class="new-game-btn" @click="showState">Show State</button>
    <button class="new-game-btn" @click="copyReplay">Copy Replay</button>
    <button class="new-game-btn" @click="showReplay">Show Replay</button>
    <button class="new-game-btn" @click="loadReplay">Load Replay</button>
    <button class="new-game-btn" @click="openDebugSettings">Debug</button>
  </div>

  <UnrestDialog :open="showStateDialog" title="Game State" content-class="state-dialog-content" @close="closeState">
    <pre class="state-pre">{{ stateJson }}</pre>
    <template #actions>
      <button type="button" @click="closeState">Close</button>
    </template>
  </UnrestDialog>

  <UnrestDialog :open="showReplayDialog" title="Replay Data" content-class="state-dialog-content" @close="closeReplay">
    <pre class="state-pre">{{ replayJson }}</pre>
    <template #actions>
      <button type="button" @click="closeReplay">Close</button>
    </template>
  </UnrestDialog>

  <UnrestDialog :open="showDebugDialog" title="Debug Settings" @close="closeDebugSettings">
    <FormKit
      type="range"
      v-model="animSlowdown"
      label="Anim Slowdown"
      :help="`${animSlowdown}x`"
      min="1"
      max="10"
      step="1"
      @input="syncDebugSettings"
    />
    <template #actions>
      <button type="button" @click="closeDebugSettings">Close</button>
    </template>
  </UnrestDialog>

  <UnrestDialog :open="showNewGameDialog" title="New Game" @close="onNewGameCancel">
    <FormKit type="form" @submit="onNewGameSubmit" :actions="false">
      <FormKit
        type="select"
        v-model="gameModeInput"
        label="Mode"
        autofocus
        :options="[
          { value: 'a', label: 'A-Type (Marathon)' },
          { value: 'b', label: 'B-Type (25 Lines)' },
        ]"
      />
      <FormKit
        type="number"
        v-model="startLevelInput"
        label="Starting Level"
        min="1"
        max="10"
      />
      <FormKit
        v-if="gameModeInput === 'b'"
        type="number"
        v-model="garbageHeightInput"
        label="Garbage Height"
        min="0"
        max="5"
      />
      <FormKit
        v-if="gameModeInput === 'b'"
        type="number"
        v-model="sparsityInput"
        label="Sparsity"
        min="0"
        max="5"
      />
      <FormKit
        type="number"
        v-model="linesInput"
        label="Board Height"
        min="15"
        max="50"
      />
      <FormKit
        type="text"
        v-model="seedInput"
        label="Seed"
        placeholder="Leave blank for random"
      />
      <FormKit
        type="select"
        v-model="gravityModeInput"
        label="Gravity"
        :options="[
          { value: 'normal', label: 'Normal' },
          { value: 'cascade', label: 'Cascade' },
          { value: 'sticky', label: 'Sticky' },
        ]"
      />
      <div class="seed-dialog-actions">
        <button type="button" @click="onNewGameCancel">Cancel</button>
        <button type="submit">Play</button>
      </div>
    </FormKit>
  </UnrestDialog>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { createGame } from './tetris.js'

const canvas = ref(null)
const showSeedDialog = ref(false)
const seedInput = ref('')
let world = null

const cellSize = ref(0)
const boardX = ref(0)
const boardY = ref(0)
const score = ref(0)
const lines = ref(0)
const level = ref(1)
const gamePhase = ref('playing')

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
  pointerEvents: 'none',
}))

const rightPanelStyle = computed(() => ({
  position: 'fixed',
  left: (boardX.value + BOARD_WIDTH * cellSize.value + cellSize.value * 1.5) + 'px',
  top: boardY.value + 'px',
  fontFamily: 'monospace',
  pointerEvents: 'none',
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
}

function startGame(seed) {
  if (world) {
    world.restart(seed)
  } else {
    world = createGame(canvas.value, { seed })
    let lastTime = performance.now()
    function loop(time) {
      const dt = Math.min(time - lastTime, 100)
      lastTime = time
      world.update(dt)
      readWorldState()
      requestAnimationFrame(loop)
    }
    requestAnimationFrame(loop)
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

  <button class="new-game-btn" @click="onNewGame">New Game</button>

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

<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { background: #111; overflow: hidden; }
canvas { display: block; }

.side-panel {
  pointer-events: none;
  user-select: none;
  white-space: pre;
}

.side-panel .label {
  color: #aaa;
  font-weight: bold;
}

.side-panel .value {
  color: #fff;
  font-weight: bold;
}

.controls-help {
  color: #555;
  border-collapse: collapse;
}

.controls-help td {
  padding: 0.15em 0;
}

.controls-help td:first-child {
  padding-right: 0.8em;
  text-align: right;
  color: #777;
}

.controls-help td:last-child {
  text-align: left;
}

.game-over-overlay {
  position: fixed;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.75);
  pointer-events: none;
  z-index: 5;
}

.game-over-text {
  color: #fff;
  font-family: monospace;
  font-weight: bold;
}

.game-over-sub {
  color: #fff;
  font-family: monospace;
  margin-top: 1em;
}

.new-game-btn {
  position: fixed;
  top: 12px;
  right: 12px;
  padding: 8px 16px;
  background: #222;
  color: #fff;
  border: 1px solid #555;
  border-radius: 4px;
  font-family: monospace;
  font-size: 14px;
  cursor: pointer;
}
.new-game-btn:hover {
  background: #333;
}

.seed-dialog-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
}

.seed-dialog {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
  border: none;
  background: none;
  padding: 0;
}

.seed-dialog-content {
  position: relative;
  background: #222;
  color: #fff;
  padding: 24px;
  border-radius: 8px;
  border: 1px solid #555;
  font-family: monospace;
  min-width: 300px;
  z-index: 1;
}

.seed-dialog-content h3 {
  margin-bottom: 16px;
}

.seed-dialog-content label {
  display: block;
  margin-bottom: 16px;
  font-size: 13px;
  color: #aaa;
}

.seed-dialog-content input {
  display: block;
  width: 100%;
  margin-top: 6px;
  padding: 8px;
  background: #111;
  color: #fff;
  border: 1px solid #555;
  border-radius: 4px;
  font-family: monospace;
  font-size: 14px;
}

.seed-dialog-content input:focus {
  outline: none;
  border-color: #888;
}

.seed-dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.seed-dialog-actions button {
  padding: 6px 16px;
  border-radius: 4px;
  font-family: monospace;
  font-size: 13px;
  cursor: pointer;
  border: 1px solid #555;
}

.seed-dialog-actions button[type="button"] {
  background: #333;
  color: #ccc;
}

.seed-dialog-actions button[type="submit"] {
  background: #446;
  color: #fff;
}

.seed-dialog-actions button:hover {
  filter: brightness(1.2);
}
</style>

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

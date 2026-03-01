<script setup>
defineProps({
  player: Object,
  canvasRef: Function,
  scoreRows: Array,
  controlRows: Array,
  replaying: Boolean,
  replayPaused: Boolean,
  replayFastForward: Boolean,
  paused: Boolean,
})

defineEmits(['replay-restart', 'replay-toggle-pause', 'replay-jump-to-end', 'replay-toggle-fast-forward'])
</script>

<template>
  <canvas :ref="canvasRef"></canvas>

  <!-- Left panel: HOLD, score info, controls -->
  <div v-if="player.cellSize > 0" class="side-panel --left">
    <div class="label">HOLD</div>
    <table class="score-block">
      <tbody>
        <tr v-for="[label, value] in scoreRows" :key="label">
          <td>{{ label }}</td>
          <td>{{ value }}</td>
        </tr>
      </tbody>
    </table>
    <div v-if="replaying" class="replay-controls">
      <button @click="$emit('replay-restart')">⏮</button>
      <button @click="$emit('replay-toggle-pause')">{{ replayPaused ? '▶' : '⏸' }}</button>
      <button @click="$emit('replay-jump-to-end')">⏭</button>
      <button :class="{ active: replayFastForward }" @click="$emit('replay-toggle-fast-forward')">⏩</button>
    </div>
    <table class="controls-help">
      <tbody>
        <tr v-for="[key, desc] in controlRows" :key>
          <td>{{ key }}</td>
          <td>{{ desc }}</td>
        </tr>
      </tbody>
    </table>
  </div>

  <!-- Right panel: NEXT -->
  <div v-if="player.cellSize > 0" class="side-panel --right">
    <div class="label">NEXT</div>
  </div>

  <!-- Game over overlay -->
  <div v-if="player.phase === 'gameover' && player.cellSize > 0" class="game-over-overlay">
    <div class="game-over-text">GAME OVER</div>
    <div class="game-over-sub">Press R to restart</div>
  </div>

  <!-- Victory overlay -->
  <div v-if="player.phase === 'victory' && player.cellSize > 0" class="game-over-overlay">
    <div class="game-over-text">SUCCESS!</div>
    <div class="game-over-sub">25 Lines Cleared!</div>
    <div class="game-over-sub">Press R to play again</div>
  </div>

  <!-- Pause overlay -->
  <div
    v-if="paused && player.phase !== 'gameover' && player.phase !== 'victory' && player.cellSize > 0"
    class="game-over-overlay"
  >
    <div class="game-over-text">PAUSED</div>
    <div class="game-over-sub">Press Esc to resume</div>
  </div>
</template>

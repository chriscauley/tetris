<script setup>
import { ref, onMounted } from 'vue'
import { createGame } from './tetris.js'

const canvas = ref(null)
const showSeedDialog = ref(false)
const seedInput = ref('')
let world = null

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

<script setup>
import { ref, onMounted } from 'vue'
import { createGame } from './tetris.js'

const canvas = ref(null)

onMounted(() => {
  const world = createGame(canvas.value)

  let lastTime = performance.now()
  function loop(time) {
    const dt = Math.min(time - lastTime, 100)
    lastTime = time
    world.update(dt)
    requestAnimationFrame(loop)
  }
  requestAnimationFrame(loop)
})
</script>

<template>
  <canvas ref="canvas"></canvas>
</template>

<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { background: #111; overflow: hidden; }
canvas { display: block; }
</style>

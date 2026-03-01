<script setup>
defineProps({
  player: Object,
})
</script>

<template>
  <div class="debug-panel">
    <table>
      <tbody>
        <tr>
          <td class="debug-label">piece</td>
          <td>{{ player.activePieceId ?? '—' }}</td>
        </tr>
        <tr>
          <td class="debug-label">highest</td>
          <td>{{ player.highestBlock }}</td>
        </tr>
        <tr>
          <td class="debug-label">seed</td>
          <td>{{ player.seed ?? '—' }}</td>
        </tr>
        <tr>
          <td class="debug-label">height</td>
          <td>{{ player.boardHeight }}</td>
        </tr>
        <tr>
          <td class="debug-label">gravity</td>
          <td>{{ player.gravityMode }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

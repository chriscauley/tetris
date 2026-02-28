<script setup>
const animSlowdown = defineModel('animSlowdown')

defineEmits(['close'])
</script>

<template>
  <FormKit
    type="range"
    v-model="animSlowdown"
    label="Anim Slowdown"
    :help="`${animSlowdown}x`"
    min="1"
    max="10"
    step="1"
  />
  <div class="modal__actions">
    <button class="btn -secondary" type="button" @click="$emit('close')">Close</button>
  </div>
</template>

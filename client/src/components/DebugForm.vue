<script setup>
const model = defineModel()

defineEmits(['close'])
</script>

<template>
  <FormKit
    v-model="model"
    type="range"
    label="Anim Slowdown"
    :help="`${model}x`"
    min="1"
    max="10"
    step="1"
  />
  <div class="modal__actions">
    <button class="btn -secondary" type="button" @click="$emit('close')">
      Close
    </button>
  </div>
</template>

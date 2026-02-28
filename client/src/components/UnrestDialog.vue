<script setup>
defineProps({
  open: Boolean,
  title: String,
  contentClass: String,
})

defineEmits(['close'])
</script>

<template>
  <dialog :open="open" class="seed-dialog" v-if="open">
    <div class="seed-dialog-backdrop" @click="$emit('close')"></div>
    <div class="seed-dialog-content" :class="contentClass">
      <h3>{{ title }}</h3>
      <slot />
      <div class="seed-dialog-actions">
        <slot name="actions" />
      </div>
    </div>
  </dialog>
</template>

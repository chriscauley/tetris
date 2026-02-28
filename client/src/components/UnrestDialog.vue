<script setup>
defineProps({
  open: Boolean,
  title: String,
  contentClass: String,
})

defineEmits(['close'])
</script>

<template>
  <dialog :open="open" class="modal" v-if="open">
    <div class="modal__backdrop" @click="$emit('close')"></div>
    <div class="modal__content" :class="contentClass">
      <h2 v-if="title">{{ title }}</h2>
      <slot />
      <div class="modal__actions">
        <slot name="actions" />
      </div>
    </div>
  </dialog>
</template>

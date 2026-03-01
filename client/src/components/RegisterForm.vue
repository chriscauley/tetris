<script setup>
import { reactive } from 'vue'
import { useRegister } from '@/stores/auth.js'

const emit = defineEmits(['success', 'cancel'])

const form = reactive({ username: '', password: '' })
const { mutate, error, isPending } = useRegister()

const onSubmit = () => mutate(form, { onSuccess: () => emit('success') })
</script>

<template>
  <form class="flex flex-col gap-4" @submit.prevent="onSubmit">
    <div v-if="error" class="text-red-400 text-sm">{{ error.message }}</div>
    <FormKit v-model="form.username" type="text" name="username" label="Username" />
    <FormKit v-model="form.password" type="password" name="password" label="Password" />
  </form>
  <div class="modal__actions">
    <button class="btn -secondary" type="button" @click="$emit('cancel')">Cancel</button>
    <button class="btn -primary" :disabled="isPending" @click="onSubmit">Sign Up</button>
  </div>
</template>

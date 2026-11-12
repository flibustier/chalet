<script setup lang="ts">
import { ref } from 'vue'

import { createClient, normalizeUrl, type Connection } from '@/api/goatcounter'

import AppFooter from './AppFooter.vue'
import ChaletLogo from './ChaletLogo.vue'

const emit = defineEmits<{ connect: [connection: Connection] }>()

const url = ref('')
const token = ref('')
const checking = ref(false)
const error = ref('')

async function submit() {
  error.value = ''
  checking.value = true
  try {
    const connection = { url: normalizeUrl(url.value), token: token.value.trim() }
    const client = createClient(connection.token)
    await client.me(connection.url)
    const sites = await client.sites(connection.url)
    if (sites.length === 0) throw new Error('This key has no site.')
    emit('connect', connection)
  } catch (cause) {
    error.value =
      cause instanceof TypeError
        ? 'GoatCounter could not be reached at this address.'
        : cause instanceof Error
          ? cause.message
          : String(cause)
  } finally {
    checking.value = false
  }
}
</script>

<template>
  <main class="connect">
    <div class="intro">
      <h1><ChaletLogo :size="44" /> Chalet</h1>
      <p class="muted">A calm, minimal dashboard for GoatCounter.</p>
    </div>
    <form class="card form" @submit.prevent="submit">
      <label>
        <span>GoatCounter address</span>
        <input v-model="url" class="input" type="text" inputmode="url" placeholder="stats.example.com" required autocomplete="url" />
      </label>
      <label>
        <span>API key</span>
        <input v-model="token" class="input" type="password" required autocomplete="off" spellcheck="false" />
      </label>
      <p class="hint muted">
        Create a key in GoatCounter under <em>Settings → API</em>, with the <em>Read statistics</em> permission only.
        It stays in this browser and is only ever sent to your GoatCounter.
      </p>
      <p v-if="error" class="error" role="alert">{{ error }}</p>
      <button class="button primary" type="submit" :disabled="checking">
        {{ checking ? 'Checking…' : 'Open the dashboard' }}
      </button>
    </form>
    <AppFooter />
  </main>
</template>

<style scoped>
.connect {
  max-width: 26rem;
  margin: 12vh auto 4rem;
  padding: 0 16px;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.intro h1 {
  font-size: 2.2rem;
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.intro p {
  margin: 0.25rem 0 0;
}

.form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1.5rem;
}

label {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  font-weight: 500;
}

.hint {
  font-size: 0.85rem;
  margin: 0;
}

.error {
  margin: 0;
  color: var(--down);
}
</style>

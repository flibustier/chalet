import { createApp } from 'vue'

import App from './App.vue'
import './styles.css'

createApp(App).mount('#app')

// Off by default. A copy built with VITE_GOATCOUNTER (a GoatCounter address) counts its own
// visits there: the page address and a fixed title only, never which sites people look at.
const counter = import.meta.env.VITE_GOATCOUNTER
if (counter) {
  window.goatcounter = { path: location.pathname, title: 'Chalet' }
  const script = document.createElement('script')
  script.async = true
  script.dataset.goatcounter = `${counter}/count`
  script.src = `${counter}/count.js`
  document.body.append(script)
}

import type { Connection, Transport } from '@/api/goatcounter'

// The demo opens with ?demo in the address. Its figures are made up by a stand-in for
// GoatCounter that runs in the browser, loaded only when the demo is opened.
export const isDemoAddress = () => new URLSearchParams(location.search).has('demo')

// .invalid never resolves: even by mistake, nothing could leave the browser
export const DEMO_CONNECTION: Connection = { url: 'https://demo.chalet.invalid', token: 'demo', demo: true }

export const demoTransport: Transport = {
  fetch: async (url) => (await import('./server')).answer(url),
  spacing: 0,
}

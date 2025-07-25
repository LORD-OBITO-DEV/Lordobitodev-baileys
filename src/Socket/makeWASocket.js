import {
  default as baileys,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  makeInMemoryStore
} from '@whiskeysockets/baileys'

import pino from 'pino'
import { Boom } from '@hapi/boom'
import { join } from 'path'

const logger = pino({ level: 'silent' }).child({ stream: 'store' })
const store = makeInMemoryStore({ logger })

const makeWASocket = async () => {
  const { state, saveCreds } = await useMultiFileAuthState(join('.', 'sessions'))
  const { version } = await fetchLatestBaileysVersion()

  const sock = baileys.default({
    version,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: true,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' }))
    },
    browser: ['Obito WhatsApp', 'Chrome', '121.0.0.0']
  })

  store.bind(sock.ev)

  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('connection.update', ({ connection, lastDisconnect }) => {
    if (connection === 'close') {
      const shouldReconnect =
        (lastDisconnect?.error instanceof Boom &&
          lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut)

      if (shouldReconnect) {
        makeWASocket()
      }
    }
  })

  return sock
}

export default makeWASocket
export { useMultiFileAuthState }

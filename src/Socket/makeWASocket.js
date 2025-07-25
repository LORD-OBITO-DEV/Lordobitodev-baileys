import baileys, {
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  makeInMemoryStore,
  DisconnectReason
} from '@whiskeysockets/baileys'

import { Boom } from '@hapi/boom'
import Pino from 'pino'
import fs from 'fs-extra'
import path from 'path'
import { downloadSessionFromMega } from '../../lib/utils/mega.js'

const logger = Pino({ level: 'silent' })
const store = makeInMemoryStore({ logger })

const SESSION_DIR = './sessions'

// Charge depuis MEGA si un lien est trouvé dans process.env.MEGA_URL
async function loadSessionFromMegaIfNeeded() {
  const megaUrl = process.env.MEGA_URL
  if (!megaUrl) return

  console.log('[OBITO] Téléchargement session MEGA...')
  const buffer = await downloadSessionFromMega(megaUrl)
  await fs.ensureDir(SESSION_DIR)
  await fs.writeFile(path.join(SESSION_DIR, 'creds.json'), buffer)
  console.log('[OBITO] Session MEGA téléchargée et sauvegardée.')
}

const makeWASocket = async () => {
  await loadSessionFromMegaIfNeeded()

  const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR)
  const { version } = await fetchLatestBaileysVersion()

  const sock = baileys.default({
    version,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, logger)
    },
    printQRInTerminal: true,
    logger,
    browser: ['OBITO', 'Chrome', '121.0.0.0']
  })

  store.bind(sock.ev)

  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('connection.update', ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      console.log('[OBITO] QR reçu. Scanne pour connecter.')
    }

    if (connection === 'close') {
      const code = lastDisconnect?.error?.output?.statusCode
      const isLogout = code === DisconnectReason.loggedOut
      if (!isLogout) makeWASocket()
    }

    if (connection === 'open') {
      console.log('[OBITO] ✅ Bot connecté.')
    }
  })

  return sock
}

export default makeWASocket
export { useMultiFileAuthState }

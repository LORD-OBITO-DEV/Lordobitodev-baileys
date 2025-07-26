import * as baileys from '@whiskeysockets/baileys'
import { Boom } from '@hapi/boom'
import Pino from 'pino'
import fs from 'fs-extra'
import path from 'path'
import { downloadSessionFromMega } from './lib/utils/mega.js' // ajuste le chemin si besoin

const {
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  makeInMemoryStore,
  DisconnectReason
} = baileys

const logger = Pino({ level: 'silent' })
const store = makeInMemoryStore({ logger })
const SESSION_DIR = './sessions'

/**
 * Convertit une session ID du type LORD~OBITO~ID#KEY en lien MEGA.
 */
function parseSessionIDToMegaLink(sessionId) {
  try {
    if (!sessionId.includes('~')) return null
    const parts = sessionId.split('~')
    if (parts.length < 3) return null
    const filePart = parts[2]
    if (!filePart.includes('#')) return null
    return `https://mega.nz/file/${filePart}`
  } catch {
    return null
  }
}

/**
 * Télécharge la session depuis MEGA si MEGA_URL est défini.
 */
async function loadSessionFromMegaIfNeeded() {
  const megaUrl = process.env.MEGA_URL
  if (!megaUrl) return

  const megaLink = megaUrl.startsWith('http') ? megaUrl : parseSessionIDToMegaLink(megaUrl)
  if (!megaLink) {
    console.error('[OBITO] ❌ MEGA_URL invalide.')
    return
  }

  console.log('[OBITO] 📥 Téléchargement de la session depuis MEGA...')
  const buffer = await downloadSessionFromMega(megaLink)
  await fs.ensureDir(SESSION_DIR)
  await fs.writeFile(path.join(SESSION_DIR, 'creds.json'), buffer)
  console.log('[OBITO] ✅ Session téléchargée et sauvegardée.')
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
    if (qr) console.log('[OBITO] 🔳 QR reçu. Scanne-le pour connecter.')

    if (connection === 'close') {
      const code = lastDisconnect?.error?.output?.statusCode
      const isLoggedOut = code === DisconnectReason.loggedOut
      if (!isLoggedOut) makeWASocket()
    }

    if (connection === 'open') {
      console.log('[OBITO] ✅ Bot connecté.')
    }
  })

  return sock
}

export default makeWASocket

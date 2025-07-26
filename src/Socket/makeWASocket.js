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

const SESSIONS_DIR = './sessions'

/**
 * Convertit une session ID personnalisée au format LORD~OBITO~ID#KEY
 * en lien MEGA https://mega.nz/file/ID#KEY
 * @param {string} sessionId
 * @returns {string|null}
 */
function parseSessionIDToMegaLink(sessionId) {
  try {
    if (!sessionId.includes('~')) return null
    const parts = sessionId.split('~')
    if (parts.length < 3) return null

    const filePart = parts[2] // Exemple : aVNjiY6Q#IOHcCpQBUsdekcVQKFFZb_tJ-OMBvF17TmClJYho8io
    if (!filePart.includes('#')) return null

    return `https://mega.nz/file/${filePart}`
  } catch {
    return null
  }
}

/**
 * Charge la session depuis MEGA si MEGA_URL est défini.
 * Supporte un lien MEGA complet ou une session ID personnalisée.
 */
async function loadSessionFromMegaIfNeeded() {
  const megaUrl = process.env.MEGA_URL
  if (!megaUrl) return

  const megaLink = megaUrl.startsWith('http') ? megaUrl : parseSessionIDToMegaLink(megaUrl)
  if (!megaLink) {
    console.error('[OBITO] Format de session MEGA invalide dans MEGA_URL.')
    return
  }

  console.log('[OBITO] Téléchargement de la session depuis MEGA...')
  try {
    const buffer = await downloadSessionFromMega(megaLink)
    await fs.ensureDir(SESSIONS_DIR)
    await fs.writeFile(path.join(SESSIONS_DIR, 'creds.json'), buffer)
    console.log('[OBITO] Session MEGA téléchargée et sauvegardée.')
  } catch (error) {
    console.error('[OBITO] Erreur lors du téléchargement ou de la sauvegarde de la session MEGA:', error)
  }
}

const makeWASocket = async () => {
  await loadSessionFromMegaIfNeeded()

  const { state, saveCreds } = await useMultiFileAuthState(SESSIONS_DIR)
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
      if (!isLogout) {
        console.log('[OBITO] Connexion fermée, tentative de reconnexion...')
        makeWASocket()
      } else {
        console.log('[OBITO] Déconnecté (logout). Veuillez vous reconnecter manuellement.')
      }
    }

    if (connection === 'open') {
      console.log('[OBITO] ✅ Bot connecté.')
    }
  })

  return sock
}

export default makeWASocket
export { useMultiFileAuthState }

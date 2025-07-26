import { Boom } from '@hapi/boom'
import makeWASocket from '../src/Socket/index.js'
import { useMultiFileAuthState } from '../src/Socket/makeWASocket.js'
import { DisconnectReason } from '../src/Types/index.js'
import { downloadSessionFromMega } from './utils/mega.js'
import makeWASocket from './connect.js'
makeWASocket()

export {
  makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  Boom,
  downloadSessionFromMega
}

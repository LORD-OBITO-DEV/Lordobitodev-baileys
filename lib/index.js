import { Boom } from '@hapi/boom'
import { default as makeWASocket, useMultiFileAuthState } from '../src/Socket/index.js'
import { DisconnectReason } from '../src/Types/index.js'
import { downloadSessionFromMega } from './utils/mega.js'

export {
  makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  Boom,
  downloadSessionFromMega
}

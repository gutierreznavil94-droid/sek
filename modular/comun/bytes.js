'use strict'
/** Bytes desde base64: Buffer en la compu, Uint8Array en el celu (no hay Buffer). */
function deBase64(texto) {
  if (typeof Buffer !== 'undefined') return Buffer.from(texto, 'base64')
  const bin = atob(texto)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

module.exports = { deBase64 }

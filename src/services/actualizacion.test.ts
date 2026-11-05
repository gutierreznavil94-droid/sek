import { describe, expect, it } from 'vitest'
import { buscarActualizacion, compararVersiones, notasCortas } from './actualizacion'

const respuesta = (j: unknown, status = 200) => (async () => new Response(JSON.stringify(j), { status })) as unknown as typeof fetch

describe('buscar actualización', () => {
  it('compara versiones como números', () => {
    expect(compararVersiones('0.60', '0.52')).toBeGreaterThan(0)
    expect(compararVersiones('v0.52', '0.52')).toBe(0)
    expect(compararVersiones('1.0', '0.99')).toBeGreaterThan(0)
    expect(compararVersiones('0.9', '0.52')).toBeLessThan(0)
  })

  it('avisa solo si el Release es más nuevo, con el link del APK', async () => {
    const r = { tag_name: 'v0.53', body: 'Lluvia nueva\n\n🤖 Generated\nhttps://claude.ai/code/x', assets: [{ name: 'sek.apk', browser_download_url: 'https://x/sek.apk' }] }
    expect(await buscarActualizacion('0.52', respuesta(r))).toEqual({ version: '0.53', notas: 'Lluvia nueva', url: 'https://x/sek.apk' })
    expect(await buscarActualizacion('0.53', respuesta(r))).toBeNull()
    expect(await buscarActualizacion('0.52', respuesta({}, 404))).toBeNull()
  })

  it('las notas quedan cortas', () => {
    expect(notasCortas('a\nb\nc', 2)).toBe('a\nb')
  })
})

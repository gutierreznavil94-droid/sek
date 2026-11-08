/// <reference types="node" />
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const DIR = `${process.cwd()}/src/temas/` // los tests corren desde la raíz del repo
const CSS: Record<string, string> = Object.fromEntries(
  readdirSync(DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(`${DIR}${d.name}/tema.css`))
    .map((d) => [`./${d.name}/tema.css`, readFileSync(`${DIR}${d.name}/tema.css`, 'utf8')]),
)

/** Selectores de las reglas de un CSS (entra en @media; saltea el interior de @keyframes). */
function selectores(css: string): string[] {
  const s = css.replace(/\/\*[\s\S]*?\*\//g, '')
  const out: string[] = []
  let i = 0
  const leer = (fin: number) => {
    while (i < fin) {
      const a = s.indexOf('{', i)
      if (a < 0 || a >= fin) return
      const cab = s.slice(i, a).trim()
      let prof = 1, j = a + 1
      while (prof && j < s.length) { if (s[j] === '{') prof++; else if (s[j] === '}') prof--; j++ }
      if (cab.startsWith('@media') || cab.startsWith('@supports')) { i = a + 1; leer(j - 1) }
      else if (!cab.startsWith('@')) out.push(...cab.split(',').map((x) => x.trim()).filter(Boolean))
      i = j
    }
  }
  leer(s.length)
  return out
}

describe('estilos propios de cada tema (tema.css)', () => {
  it('Shinobi no tiene estilos propios: queda idéntico', () => {
    expect(Object.keys(CSS)).not.toContain('./shinobi/tema.css')
  })

  for (const [ruta, css] of Object.entries(CSS)) {
    const id = ruta.split('/')[1]
    it(`${id}: cada regla solo aplica con su tema activo`, () => {
      const sel = selectores(css)
      expect(sel.length).toBeGreaterThan(0)
      for (const x of sel) expect(x.startsWith(`:root[data-tema="${id}"]`), x).toBe(true)
    })
  }
})

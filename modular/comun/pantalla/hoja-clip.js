/*
 * Reproduce un clip hecho hoja de cuadros (.webp + .json, ver herramientas/video-a-hoja.py) en un <canvas>.
 * Reemplaza a los <video> de las escenas: dentro de la app del celu los videos no arrancaban; una hoja de cuadros
 * se dibuja siempre, igual que el compañero. Mientras carga el que sigue, queda el último cuadro del anterior.
 *
 *   const c = SEK_HOJA_CLIP(canvas)
 *   c.cargar('/m/juego/escenas/juego/jugando')            precarga (sin extensión)
 *   c.tocar('/m/juego/escenas/juego/a-jugar', { bucle: false, alFin: (ok) => … })
 *   c.parar()   c.limpiar()
 */
(function () {
  'use strict'
  window.SEK_HOJA_CLIP = function (canvas) {
    const ctx = canvas.getContext('2d')
    const cache = new Map()
    let id = 0
    let turno = 0

    function cargar(url) {
      if (!cache.has(url)) {
        const imagen = new Promise((ok, mal) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => mal(new Error('sin hoja')); i.src = `${url}.webp` })
        const datos = fetch(`${url}.json`).then((r) => { if (!r.ok) throw new Error('sin datos'); return r.json() })
        const p = Promise.all([imagen, datos]).then(([img, h]) => ({ img, h }))
        p.catch(() => cache.delete(url))
        cache.set(url, p)
      }
      return cache.get(url)
    }

    async function tocar(url, { bucle = false, alFin = null } = {}) {
      const t = ++turno
      let x
      try { x = await cargar(url) } catch (e) { if (t === turno && alFin) alFin(false); return }
      if (t !== turno) return
      cancelAnimationFrame(id)
      const { img, h } = x
      const [w, alto] = h.celda
      if (canvas.width !== w || canvas.height !== alto) { canvas.width = w; canvas.height = alto }
      const dibujar = (k) => ctx.drawImage(img, (k % h.columnas) * w, Math.floor(k / h.columnas) * alto, w, alto, 0, 0, w, alto)
      const t0 = performance.now()
      let ultimo = 0
      dibujar(0)
      const paso = (ahora) => {
        if (t !== turno) return
        let k = Math.floor(((ahora - t0) / 1000) * h.fps)
        if (k >= h.n) {
          if (!bucle) { dibujar(h.n - 1); if (alFin) alFin(true); return }
          k %= h.n
        }
        if (k !== ultimo) { dibujar(k); ultimo = k }
        id = requestAnimationFrame(paso)
      }
      id = requestAnimationFrame(paso)
    }

    function parar() { turno++; cancelAnimationFrame(id) }
    function limpiar() { parar(); ctx.clearRect(0, 0, canvas.width, canvas.height) }
    return { cargar, tocar, parar, limpiar }
  }
})()

/**
 * Organización · las reglas, sin pantalla y sin base. Traído de src/organizacion/modelo.ts y sugerir.ts.
 *
 * Corre en los dos lados con el mismo código:
 *   - en el servidor: `require('./modelo')` (lo usa ventanilla.js para validar, «Hoy me toca a mí» y los avisos);
 *   - en el navegador: `<script src="/m/organizacion/modelo.js">` deja `window.OrgModelo` (lo usa la pantalla).
 *
 * Las funciones que cambian algo modifican los datos que reciben (quien llama guarda después).
 * Formato de los datos: ver LEEME.md.
 */
;(function (raiz, fabrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabrica()
  else raiz.OrgModelo = fabrica()
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict'

  const LIMITE_SUELTAS = 5
  const COLORES = ['#C8102E', '#78BD97', '#e0a23a', '#9b7bd4', '#3fb0ac', '#d9822b', '#c9a227', '#e06c9f']
  const ICONOS_FRENTE = ['💡', '🗺', '🏢', '🎨', '🧮', '🙋', '📦', '🏠', '📚', '🔷']
  const AJUSTES = { limiteHoy: 3, sugerir: true, vista: 'todo' }

  // ---------- Fechas (días «AAAA-MM-DD») ----------

  function diaLocal(d = new Date()) {
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const n = String(d.getDate()).padStart(2, '0')
    return `${d.getFullYear()}-${m}-${n}`
  }

  function sumarDias(dia, n) {
    const [a, m, d] = dia.split('-').map(Number)
    const x = new Date(Date.UTC(a, m - 1, d + n))
    return x.toISOString().slice(0, 10)
  }

  /** Días entre dos fechas (b − a). */
  function diasEntre(a, b) {
    const [a1, m1, d1] = a.split('-').map(Number)
    const [a2, m2, d2] = b.split('-').map(Number)
    return Math.round((Date.UTC(a2, m2 - 1, d2) - Date.UTC(a1, m1 - 1, d1)) / 864e5)
  }

  /** «atrasada», «hoy», «mañana», «en 5 días». */
  function cuando(fecha, hoy) {
    const d = diasEntre(hoy, fecha)
    return d < 0 ? 'atrasada' : d === 0 ? 'hoy' : d === 1 ? 'mañana' : `en ${d} días`
  }

  function nuevoId(prefijo = 't') {
    return prefijo + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
  }

  // ---------- Datos ----------

  function frenteSueltas(hoy) {
    return { id: 'sueltas', nombre: 'Sueltas', tipo: 'sueltas', icono: '', color: '#C8102E', sub: 'Cosas sin proyecto', movido: hoy, tareas: [] }
  }

  /** Lo que ve alguien la primera vez: Sueltas y Personal, vacíos. */
  function datosIniciales(hoy) {
    return {
      formato: 1,
      frentes: [frenteSueltas(hoy), { id: 'personal', nombre: 'Personal', icono: '🙋', color: '#78BD97', sub: 'Cosas mías', movido: hoy, tareas: [] }],
      archivados: [],
      bandeja: [],
      ajustes: { ...AJUSTES },
    }
  }

  const esObj = (x) => !!x && typeof x === 'object' && !Array.isArray(x)

  /**
   * Toma lo que haya guardado (o nada) y devuelve datos válidos. Acá van las migraciones:
   * solo suman lo que falta, nunca borran lo cargado. `ahora` (ms) es para las tareas sin fecha de creación.
   */
  function normalizar(x, hoy, ahora = Date.now()) {
    if (!esObj(x) || !Array.isArray(x.frentes)) return datosIniciales(hoy)
    const d = x
    d.formato = 1
    d.frentes = d.frentes.filter(esObj)
    d.archivados = Array.isArray(d.archivados) ? d.archivados.filter(esObj) : []
    d.bandeja = Array.isArray(d.bandeja) ? d.bandeja.filter((it) => esObj(it) && typeof it.texto === 'string') : []
    d.ajustes = { ...AJUSTES, ...(esObj(d.ajustes) ? d.ajustes : {}) }
    for (const f of [...d.frentes, ...d.archivados]) {
      f.id = String(f.id || nuevoId('f'))
      f.nombre = typeof f.nombre === 'string' && f.nombre.trim() ? f.nombre : 'Frente'
      f.tareas = Array.isArray(f.tareas) ? f.tareas.filter(esObj) : []
      f.movido = f.movido || hoy
      for (const t of f.tareas) {
        t.id = String(t.id || nuevoId())
        t.texto = typeof t.texto === 'string' ? t.texto : ''
        t.quien = t.quien || 'yo'
        t.estado = t.estado === 'hecho' ? 'hecho' : 'por_hacer'
        t.creada = t.creada || ahora
      }
    }
    if (!d.frentes.some((f) => f.tipo === 'sueltas')) d.frentes.unshift(frenteSueltas(hoy))
    return d
  }

  // ---------- Consultas ----------

  const buscarFrente = (d, id) => d.frentes.find((f) => f.id === id) || d.archivados.find((f) => f.id === id)

  function buscarTarea(d, fid, tid) {
    const f = buscarFrente(d, fid)
    const t = f && f.tareas.find((x) => x.id === tid)
    return f && t ? { f, t } : null
  }

  /** «Hoy me toca a mí»: lo mío, con fecha de hoy o vencida, y no hecho. */
  function toca(t, hoy) {
    return t.estado !== 'hecho' && (t.quien || 'yo') === 'yo' && !!t.fecha && t.fecha <= hoy
  }

  function meToca(d, hoy) {
    const r = []
    for (const f of d.frentes) for (const t of f.tareas) if (toca(t, hoy)) r.push({ f, t })
    return r.sort((a, b) => (a.t.fecha < b.t.fecha ? -1 : a.t.fecha > b.t.fecha ? 1 : 0))
  }

  function avance(f) {
    return f.tareas.length ? Math.round((100 * f.tareas.filter((t) => t.estado === 'hecho').length) / f.tareas.length) : 0
  }

  /** Lo que sigue en un frente: primero lo que toca hoy, después lo que tiene fecha, después el resto. */
  function proxima(f, hoy) {
    const peso = (t) => (toca(t, hoy) ? 0 : t.fecha ? 1 : 2)
    return f.tareas.filter((t) => t.estado !== 'hecho').sort((a, b) => peso(a) - peso(b) || (a.fecha || '9').localeCompare(b.fecha || '9'))[0]
  }

  function resumen(d, hoy) {
    const total = d.frentes.reduce((a, f) => a + f.tareas.length, 0)
    const hechas = d.frentes.reduce((a, f) => a + f.tareas.filter((t) => t.estado === 'hecho').length, 0)
    return { meToca: meToca(d, hoy).length, bandeja: d.bandeja.length, hechas, total, porcentaje: total ? Math.round((100 * hechas) / total) : 0 }
  }

  /** Tareas que están hechas en `despues` y no lo estaban en `antes` (para avisar 'organizacion.tarea.hecha'). */
  function recienHechas(antes, despues) {
    const ya = new Set()
    for (const f of [...antes.frentes, ...antes.archivados]) for (const t of f.tareas) if (t.estado === 'hecho') ya.add(t.id)
    const r = []
    for (const f of [...despues.frentes, ...despues.archivados]) for (const t of f.tareas) if (t.estado === 'hecho' && !ya.has(t.id)) r.push({ f, t })
    return r
  }

  // ---------- Sugerir frente ----------
  // Mira toda la frase, solo RESALTA un frente y muestra por qué palabras. Nunca elige sola.
  // Aprende cuando elegís otro. Se puede apagar en Clasificar.

  const VACIAS = new Set('las los que por para con del una uno unos unas sin hay mas como esta este esto ese esa todo toda pero cuando donde porque'.split(' '))

  function palabras(texto) {
    return texto.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').split(/[^a-z0-9ñ]+/).filter((w) => w.length > 1 && !VACIAS.has(w))
  }

  function sugerir(d, texto) {
    if (!d.ajustes.sugerir) return null
    const w = [...new Set(palabras(texto))]
    let mejor = null
    let puntos = 0
    let por = []
    for (const f of d.frentes) {
      const clave = new Set(palabras(`${f.nombre} ${(f.palabras || []).join(' ')}`))
      const vistas = new Set(palabras(f.tareas.map((t) => t.texto).join(' ')).filter((x) => x.length > 3))
      const no = new Set(f.no || [])
      const todas = [...clave, ...vistas]
      let n = 0
      const r = []
      for (const x of w) {
        if (no.has(x)) { n -= 3; continue }
        if (clave.has(x)) { n += 3; r.push(x) }
        else if (vistas.has(x)) { n += 2; r.push(x) }
        else if (x.length > 4 && todas.some((v) => v.length > 4 && v.slice(0, 5) === x.slice(0, 5))) { n += 1; r.push(x) }
      }
      if (n > puntos) { puntos = n; mejor = f; por = r }
    }
    return mejor && puntos >= 3 ? { f: mejor, por } : null
  }

  /** Al clasificar: el frente elegido suma las palabras; si sugirió otro, ese aprende que no eran suyas. */
  function aprender(texto, elegido, sugerida) {
    const w = palabras(texto).filter((x) => x.length > 2)
    if (sugerida && sugerida.f !== elegido) sugerida.f.no = [...new Set([...(sugerida.f.no || []), ...sugerida.por])].slice(-80)
    elegido.palabras = [...new Set([...(elegido.palabras || []), ...w])].slice(-120)
    if (elegido.no) elegido.no = elegido.no.filter((x) => !w.includes(x))
  }

  // ---------- Clasificar ----------

  const CAMPOS_CLASIFICAR = { quien: 'quién', imp: 'importancia', rapidez: 'rapidez', donde: 'dónde', fecha: 'fecha' }

  /** Qué falta para poder elegir frente (todo es obligatorio; «Sin dónde» = 'nada' y «Libre» = 'libre' valen). */
  function faltan(c) {
    return Object.keys(CAMPOS_CLASIFICAR).filter((k) =>
      k === 'quien' ? !c.quien || (c.quien !== 'yo' && !(c.quienNombre || '').trim()) : !c[k],
    )
  }

  /** Lo que ya se sabía de un ítem de la bandeja (si volvió a Clasificar). */
  function clasificacionPrevia(it) {
    const p = it.previo
    if (!p) return { quien: 'yo' }
    return { quien: p.quien || 'yo', quienNombre: p.quienNombre, imp: p.imp, rapidez: p.rapidez, donde: p.donde || 'nada', fecha: p.fecha || 'libre' }
  }

  // ---------- Cambios ----------

  function anotar(d, texto, frente) {
    const it = { id: nuevoId('b'), texto: texto.trim(), creada: Date.now() }
    if (frente && buscarFrente(d, frente)) it.frente = frente
    d.bandeja.push(it)
    return it
  }

  function clasificar(d, itemId, frenteId, c, hoy) {
    const i = d.bandeja.findIndex((x) => x.id === itemId)
    const f = d.frentes.find((x) => x.id === frenteId)
    if (i < 0 || !f || faltan(c).length) return null
    const it = d.bandeja[i]
    aprender(it.texto, f, sugerir(d, it.texto))
    const previo = it.previo || {}
    const t = { ...previo, id: previo.id || nuevoId(), texto: it.texto, estado: 'por_hacer', quien: c.quien, creada: previo.creada || it.creada || Date.now() }
    delete t.quienNombre; delete t.donde; delete t.fecha; delete t.hecha
    if (c.quien !== 'yo' && (c.quienNombre || '').trim()) t.quienNombre = c.quienNombre.trim()
    t.imp = c.imp
    t.rapidez = c.rapidez
    if (c.donde && c.donde !== 'nada') t.donde = c.donde
    if (c.fecha && c.fecha !== 'libre') t.fecha = c.fecha
    f.tareas.push(t)
    f.movido = hoy
    d.bandeja.splice(i, 1)
    return t
  }

  /** «Ya lo hice (menos de 2 min)»: queda anotada como hecha en el frente sugerido, o en Sueltas. */
  function yaLoHice(d, itemId, hoy) {
    const i = d.bandeja.findIndex((x) => x.id === itemId)
    if (i < 0) return null
    const it = d.bandeja[i]
    const sg = sugerir(d, it.texto)
    const f = (it.frente && d.frentes.find((x) => x.id === it.frente)) || (sg && sg.f) || d.frentes.find((x) => x.tipo === 'sueltas') || d.frentes[0]
    const t = { id: nuevoId(), texto: it.texto, estado: 'hecho', quien: 'yo', creada: it.creada || Date.now(), hecha: Date.now() }
    f.tareas.push(t)
    f.movido = hoy
    d.bandeja.splice(i, 1)
    return { f, t }
  }

  function borrarDeBandeja(d, itemId) {
    d.bandeja = d.bandeja.filter((x) => x.id !== itemId)
  }

  function marcar(d, fid, tid, estado, hoy, ahora = Date.now()) {
    const x = buscarTarea(d, fid, tid)
    if (!x) return null
    x.t.estado = estado
    if (estado === 'hecho') x.t.hecha = ahora
    else delete x.t.hecha
    x.f.movido = hoy
    return x.t
  }

  const CAMPOS_TAREA = ['texto', 'quien', 'quienNombre', 'imp', 'rapidez', 'donde', 'fecha']

  /** Cambia campos de una tarea. Un valor vacío ('' o undefined) borra el campo (Sin dónde, Libre, Sin marcar). */
  function cambiarTarea(d, fid, tid, cambios, hoy) {
    const x = buscarTarea(d, fid, tid)
    if (!x) return null
    for (const [k, v] of Object.entries(cambios)) {
      if (!CAMPOS_TAREA.includes(k)) continue
      if (k === 'texto') { if (v && v.trim()) x.t.texto = v.trim(); continue }
      if (v === undefined || v === '') delete x.t[k]
      else x.t[k] = v
    }
    if (!x.t.quien) x.t.quien = 'yo'
    if (x.t.quien === 'yo') delete x.t.quienNombre
    x.f.movido = hoy
    return x.t
  }

  function moverTarea(d, fid, tid, destino, hoy) {
    const x = buscarTarea(d, fid, tid)
    const g = d.frentes.find((f) => f.id === destino)
    if (!x || !g || g === x.f) return false
    x.f.tareas = x.f.tareas.filter((t) => t !== x.t)
    g.tareas.push(x.t)
    x.f.movido = hoy
    g.movido = hoy
    return true
  }

  function nuevoFrente(d, hoy, nombre = 'Frente nuevo') {
    const f = { id: nuevoId('f'), nombre, icono: '💡', color: COLORES[d.frentes.length % COLORES.length], sub: '', movido: hoy, tareas: [] }
    d.frentes.push(f)
    return f
  }

  function cambiarFrente(d, fid, cambios) {
    const f = buscarFrente(d, fid)
    if (!f) return
    const ok = {}
    for (const k of ['nombre', 'icono', 'color', 'sub', 'nota']) if (cambios[k] !== undefined) ok[k] = cambios[k]
    if (ok.nombre !== undefined && !String(ok.nombre).trim()) delete ok.nombre
    Object.assign(f, ok)
  }

  function finalizarFrente(d, fid, hoy) {
    const i = d.frentes.findIndex((f) => f.id === fid)
    if (i < 0 || d.frentes[i].tipo === 'sueltas') return null
    const [f] = d.frentes.splice(i, 1)
    f.finalizado = hoy
    d.archivados.push(f)
    return f
  }

  function reabrirFrente(d, fid, hoy) {
    const i = d.archivados.findIndex((f) => f.id === fid)
    if (i < 0) return null
    const [f] = d.archivados.splice(i, 1)
    delete f.finalizado
    f.movido = hoy
    d.frentes.push(f)
    return f
  }

  /** Elimina el frente y sus tareas (lo confirmó Navil). Sueltas no se elimina. */
  function eliminarFrente(d, fid) {
    const f = buscarFrente(d, fid)
    if (!f || f.tipo === 'sueltas') return null
    d.frentes = d.frentes.filter((x) => x.id !== fid)
    d.archivados = d.archivados.filter((x) => x.id !== fid)
    for (const it of d.bandeja) if (it.frente === fid) delete it.frente
    return f
  }

  function moverFrente(d, fid, dir) {
    const i = d.frentes.findIndex((f) => f.id === fid)
    const j = i + dir
    if (i < 0 || j < 0 || j >= d.frentes.length) return
    ;[d.frentes[i], d.frentes[j]] = [d.frentes[j], d.frentes[i]]
  }

  function cambiarLimite(d, delta) {
    d.ajustes.limiteHoy = Math.min(9, Math.max(1, (d.ajustes.limiteHoy || 3) + delta))
    return d.ajustes.limiteHoy
  }

  return {
    LIMITE_SUELTAS, COLORES, ICONOS_FRENTE, CAMPOS_CLASIFICAR,
    diaLocal, sumarDias, diasEntre, cuando, nuevoId,
    datosIniciales, normalizar,
    buscarFrente, buscarTarea, toca, meToca, avance, proxima, resumen, recienHechas,
    palabras, sugerir, aprender,
    faltan, clasificacionPrevia,
    anotar, clasificar, yaLoHice, borrarDeBandeja, marcar, cambiarTarea, moverTarea,
    nuevoFrente, cambiarFrente, finalizarFrente, reabrirFrente, eliminarFrente, moverFrente, cambiarLimite,
  }
})

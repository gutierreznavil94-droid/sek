'use strict'
/**
 * Hábitos · la única puerta del módulo.
 * - Forja: hábitos nuevos que se vuelven costumbre (piedra que se agrieta, 30 días / 28 válidos).
 * - Mi código: reglas propias que se leen (no se marcan ni dan XP), por momento o por área.
 * - Caídas: «No cumplí mi palabra» → marca del día y −XP (el precio de volver). No reinicia nada.
 * - Fotos de progreso y días marcados (印).
 * Las cuentas puras están en calculo.js. La XP la maneja el módulo xp, por su ventanilla.
 * Todas las funciones aceptan `tx` opcional al final (transacción compartida).
 */
const crypto = globalThis.crypto
const datos = require('./datos')
const calculo = require('./calculo')
const xp = require('../xp/ventanilla')
const { transaccion } = require('../../comun/base')
const { obtenerAjustes, guardarAjustes } = require('../../comun/ajustes')
const { anotar } = require('../../comun/historial')
const { ahora } = require('../../comun/reloj')
const { fechaDe, esFechaValida } = require('../../comun/fechas')
const { datoInvalido, noEncontrado } = require('../../comun/errores')

const nuevoId = (prefijo) => `${prefijo}_${crypto.randomUUID().replace(/-/g, '').slice(0, 14)}`
const hoyDe = async (usuarioId, tx) => fechaDe(ahora(), (await obtenerAjustes(usuarioId, tx)).zonaHoraria)
const sinNulos = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== null && v !== undefined))

const claveXpForjaDia = (id, fecha) => xp.claveXp('forja', [id, fecha])
const claveXpForjado = (id) => xp.claveXp('forja', [id, 'forjado'])
const claveXpCaida = (id) => xp.claveXp('caida', [id])

// =====================================================================
// Forja
// =====================================================================

async function configForja(usuarioId, tx = null) {
  return calculo.configForja((await obtenerAjustes(usuarioId, tx)).forja)
}

const conEstado = (h, hoy, config) => ({
  habito: sinNulos(h),
  // Un hábito forjado queda congelado el día en que se forjó.
  estado: calculo.estadoForja(h, h.forjadoEn && h.forjadoEn < hoy ? h.forjadoEn : hoy, config),
})

/** Todos los hábitos con su estado de hoy: { hoy, enForja, forjados, abandonados, config }. */
async function listarForja(usuarioId, tx = null) {
  const config = await configForja(usuarioId, tx)
  const hoy = await hoyDe(usuarioId, tx)
  const todos = await datos.forjaTodos(usuarioId, tx)
  return {
    hoy,
    enForja: todos.filter((h) => h.estado === 'forja').map((h) => conEstado(h, hoy, config)),
    forjados: todos.filter((h) => h.estado === 'forjado').map((h) => conEstado(h, hoy, config)),
    abandonados: todos.filter((h) => h.estado === 'abandonado').length,
    config,
  }
}

/** Empieza la forja de un hábito hoy. Máximo `config.maximo` (3) a la vez. */
async function crearHabito(usuarioId, { nombre, kanji }, tx = null) {
  const n = String(nombre || '').trim().slice(0, 80)
  const k = calculo.limpiarKanji(kanji)
  if (!n) throw datoInvalido('Poné un nombre al hábito.')
  if (!k) throw datoInvalido('Elegí un kanji.')
  return transaccion(async (t) => {
    const config = await configForja(usuarioId, t)
    if ((await datos.forjaContarEnForja(usuarioId, t)) >= config.maximo) throw datoInvalido('Terminá uno antes de empezar otro.')
    const h = sinNulos(await datos.forjaCrear(usuarioId, { id: nuevoId('forja'), nombre: n, kanji: k, inicio: await hoyDe(usuarioId, t), cumplidos: [], creado: ahora() }, t))
    await anotar(usuarioId, 'habitos', 'forja_crear', { despues: h }, t)
    return h
  }, tx)
}

/**
 * Un toque en la piedra: marca hoy; si ya estaba marcado, lo desmarca (y anula la XP).
 * Devuelve { marcado, xp, pedazo, forjado, nuevoNivel, habito, estado }.
 */
async function alternarDia(usuarioId, id, tx = null) {
  return transaccion(async (t) => {
    if (!(await datos.forjaBloquear(usuarioId, id, t))) throw noEncontrado('Ese hábito')
    const antes = await datos.forjaPorId(usuarioId, id, t)
    const config = await configForja(usuarioId, t)
    const hoy = await hoyDe(usuarioId, t)
    if (antes.estado === 'abandonado') throw datoInvalido('Ese hábito está abandonado.')
    if (antes.estado === 'forjado' && antes.forjadoEn !== hoy) throw datoInvalido('Ya está forjado.')
    const previo = calculo.estadoForja(antes, hoy, config)
    const marcar = !antes.cumplidos.includes(hoy)
    const cumplidos = marcar ? [...antes.cumplidos, hoy].sort() : antes.cumplidos.filter((f) => f !== hoy)
    const estado = calculo.estadoForja({ ...antes, cumplidos }, hoy, config)
    let h = { ...antes, cumplidos, fallas: estado.fallas }
    let ganado = 0
    let nuevoNivel = null
    let forjado = false
    if (marcar) {
      const r = await xp.sumar(usuarioId, { clave: claveXpForjaDia(id, hoy), cantidad: config.xpDia, origen: 'forja', fecha: hoy, descripcion: `Forja · ${antes.nombre}: día cumplido` }, t)
      ganado += r.cantidad
      nuevoNivel = r.nuevoNivel
      if (estado.completo && antes.estado === 'forja') {
        forjado = true
        h = { ...h, estado: 'forjado', forjadoEn: hoy }
        const r2 = await xp.sumar(usuarioId, { clave: claveXpForjado(id), cantidad: config.xpForjado, origen: 'forja', fecha: hoy, descripcion: `Forja · ${antes.nombre}: hábito forjado` }, t)
        ganado += r2.cantidad
        nuevoNivel = r2.nuevoNivel ?? nuevoNivel
      }
    } else {
      await xp.anular(usuarioId, claveXpForjaDia(id, hoy), 'Forja: día desmarcado', t)
      if (antes.estado === 'forjado') {
        await xp.anular(usuarioId, claveXpForjado(id), 'Forja: día desmarcado', t)
        h = { ...h, estado: 'forja', forjadoEn: null }
      }
    }
    h = await datos.forjaGuardar(usuarioId, h, t)
    await anotar(usuarioId, 'habitos', marcar ? 'forja_marcar' : 'forja_desmarcar', { id, fecha: hoy, validos: estado.validos }, t)
    return {
      marcado: marcar,
      xp: ganado,
      pedazo: marcar && calculo.pedazosCaidos(estado.validos, estado.necesarios) > previo.pedazos,
      forjado,
      nuevoNivel,
      habito: sinNulos(h),
      estado,
    }
  }, tx)
}

/** Abandonar: sale de la forja. La XP ganada se queda. */
async function abandonarHabito(usuarioId, id, tx = null) {
  return transaccion(async (t) => {
    const antes = await datos.forjaPorId(usuarioId, id, t)
    if (!antes) throw noEncontrado('Ese hábito')
    if (antes.estado === 'abandonado') return sinNulos(antes)
    const h = await datos.forjaGuardar(usuarioId, { ...antes, estado: 'abandonado', abandonadoEn: await hoyDe(usuarioId, t) }, t)
    await anotar(usuarioId, 'habitos', 'forja_abandonar', { antes: sinNulos(antes) }, t)
    return sinNulos(h)
  }, tx)
}

async function editarHabito(usuarioId, id, { nombre, kanji } = {}, tx = null) {
  return transaccion(async (t) => {
    const antes = await datos.forjaPorId(usuarioId, id, t)
    if (!antes) throw noEncontrado('Ese hábito')
    const n = String(nombre ?? '').trim().slice(0, 80)
    const k = calculo.limpiarKanji(kanji)
    const h = await datos.forjaGuardar(usuarioId, { ...antes, nombre: n || antes.nombre, kanji: k || antes.kanji }, t)
    await anotar(usuarioId, 'habitos', 'forja_editar', { antes: sinNulos(antes), despues: sinNulos(h) }, t)
    return sinNulos(h)
  }, tx)
}

// =====================================================================
// Mi código
// =====================================================================

/** Carga los ejemplos una sola vez por persona (si después se borran, no vuelven). Va en sesion.alCrearCuenta. */
async function sembrar(usuarioId, tx = null) {
  return transaccion(async (t) => {
    const a = await obtenerAjustes(usuarioId, t)
    if (a.codigoSembrado) return 0
    let n = 0
    if ((await datos.codigoContar(usuarioId, t)) === 0) {
      const creado = ahora()
      for (const [i, r] of calculo.CODIGO_INICIAL.entries()) {
        if (await datos.codigoCrear(usuarioId, { id: `cod_${i + 1}`, ...r, orden: i + 1, ordenMomento: i + 1, creado }, t)) n++
      }
    }
    await guardarAjustes(usuarioId, { codigoSembrado: true }, t)
    return n
  }, tx)
}

async function listarCodigo(usuarioId, tx = null) {
  return datos.codigoTodas(usuarioId, tx)
}

function revisarRegla({ texto, grupo, momento }) {
  const limpio = String(texto || '').trim().slice(0, 300)
  if (!limpio) throw datoInvalido('Escribí la regla.')
  if (!calculo.esGrupo(grupo)) throw datoInvalido('Elegí un área: cuerpo, mente, comida o cuidado.')
  if (!calculo.esMomento(momento)) throw datoInvalido('Elegí un momento: mañana, tarde, noche o siempre.')
  return limpio
}

async function agregarRegla(usuarioId, { texto, grupo, momento = 'siempre' }, tx = null) {
  const limpio = revisarRegla({ texto, grupo, momento })
  return transaccion(async (t) => {
    const max = await datos.codigoMaximos(usuarioId, t)
    const r = await datos.codigoCrear(usuarioId, { id: nuevoId('cod'), texto: limpio, grupo, momento, orden: max.orden + 1, ordenMomento: max.ordenMomento + 1, creado: ahora() }, t)
    await anotar(usuarioId, 'habitos', 'codigo_crear', { despues: r }, t)
    return r
  }, tx)
}

async function editarRegla(usuarioId, id, cambios = {}, tx = null) {
  return transaccion(async (t) => {
    const antes = await datos.codigoPorId(usuarioId, id, t)
    if (!antes) throw noEncontrado('Esa regla')
    const despues = { ...antes, ...sinNulos({ texto: cambios.texto, grupo: cambios.grupo, momento: cambios.momento }) }
    despues.texto = revisarRegla(despues)
    const r = await datos.codigoGuardar(usuarioId, despues, t)
    await anotar(usuarioId, 'habitos', 'codigo_editar', { antes, despues: r }, t)
    return r
  }, tx)
}

async function borrarRegla(usuarioId, id, tx = null) {
  return transaccion(async (t) => {
    const antes = await datos.codigoPorId(usuarioId, id, t)
    if (!antes) return false
    await datos.codigoBorrar(usuarioId, id, t)
    await anotar(usuarioId, 'habitos', 'codigo_borrar', { antes }, t)
    return true
  }, tx)
}

/** Sube (-1) o baja (+1) una regla dentro de su grupo, en la vista indicada (el orden de la otra vista no cambia). */
async function moverRegla(usuarioId, id, dir, vista = 'area', tx = null) {
  if (dir !== -1 && dir !== 1) throw datoInvalido('Solo se puede subir o bajar de a uno.')
  if (vista !== 'area' && vista !== 'momento') throw datoInvalido('La vista es «area» o «momento».')
  return transaccion(async (t) => {
    const todas = await datos.codigoTodas(usuarioId, t)
    const r = todas.find((x) => x.id === id)
    if (!r) throw noEncontrado('Esa regla')
    const grupo = calculo.reglasDelGrupo(todas, vista, vista === 'area' ? r.grupo : r.momento)
    const i = grupo.findIndex((x) => x.id === id)
    const otra = grupo[i + dir]
    if (!otra) return false
    const campo = vista === 'area' ? 'orden' : 'ordenMomento'
    const a = calculo.ordenEn(r, vista)
    const b = calculo.ordenEn(otra, vista)
    await datos.codigoGuardar(usuarioId, { ...r, [campo]: b === a ? b + dir : b }, t)
    await datos.codigoGuardar(usuarioId, { ...otra, [campo]: a }, t)
    await anotar(usuarioId, 'habitos', 'codigo_mover', { id, dir, vista }, t)
    return true
  }, tx)
}

// =====================================================================
// Caídas
// =====================================================================

async function xpCaida(usuarioId, tx = null) {
  return calculo.xpCaidaDe((await obtenerAjustes(usuarioId, tx)).caida)
}

/**
 * «No cumplí mi palabra» (o soltar la mano en Tensión): deja la marca del día y saca la XP del precio de volver.
 * Nunca deja el total debajo de 0 (eso lo cuida xp.restar). El día sigue: no se reinicia nada.
 * origen: 'boton' | 'tension'. Devuelve la caída { id, fecha, instante, origen, xp }.
 */
async function registrarCaida(usuarioId, { origen = 'boton', fecha = null } = {}, tx = null) {
  if (origen !== 'boton' && origen !== 'tension') throw datoInvalido('El origen de la caída es «boton» o «tension».')
  if (fecha !== null && !esFechaValida(fecha)) throw datoInvalido('La fecha no es válida.')
  return transaccion(async (t) => {
    const dia = fecha || (await hoyDe(usuarioId, t))
    const id = nuevoId('caida')
    const pedido = await xpCaida(usuarioId, t)
    let quita = 0
    if (pedido > 0) {
      const r = await xp.restar(usuarioId, { clave: claveXpCaida(id), cantidad: pedido, origen: 'caida', fecha: dia, descripcion: `Caída: −${pedido} XP, el precio de volver` }, t)
      quita = r.cantidad
    }
    const c = await datos.caidaCrear(usuarioId, { id, fecha: dia, instante: ahora(), origen, xp: quita }, t)
    await anotar(usuarioId, 'habitos', 'caida', { despues: c, motivo: 'No cumplí mi palabra' }, t)
    return c
  }, tx)
}

/** Deshacer (los segundos después de la caída): quita la marca y devuelve la XP. */
async function deshacerCaida(usuarioId, id, tx = null) {
  return transaccion(async (t) => {
    const c = await datos.caidaPorId(usuarioId, id, t)
    if (!c) return false
    await datos.caidaBorrar(usuarioId, id, t)
    await xp.anular(usuarioId, claveXpCaida(id), 'Deshacer caída', t)
    await anotar(usuarioId, 'habitos', 'caida_deshacer', { antes: c }, t)
    return true
  }, tx)
}

async function caidasDelDia(usuarioId, fecha, tx = null) {
  return datos.caidasEntre(usuarioId, fecha, fecha, tx)
}

/** Caídas por día entre dos fechas (para el Calendario): { 'AAAA-MM-DD': n }. */
async function caidasPorDia(usuarioId, desde, hasta, tx = null) {
  const r = {}
  for (const c of await datos.caidasEntre(usuarioId, desde, hasta, tx)) r[c.fecha] = (r[c.fecha] || 0) + 1
  return r
}

/** Todas las caídas («Caídas superadas: N» en Progreso). */
async function todasLasCaidas(usuarioId, tx = null) {
  return datos.caidasTodas(usuarioId, tx)
}

// =====================================================================
// Fotos de progreso
// =====================================================================

/** Tope de una foto ya achicada (la pantalla la deja en ~1080 px; esto es por las dudas). */
const FOTO_MAX = 3 * 1024 * 1024

/** Lista sin las imágenes: { id, fecha, dia, creada }. La imagen se pide con imagenFoto. */
async function listarFotos(usuarioId, tx = null) {
  return (await datos.fotosLista(usuarioId, tx)).map(sinNulos)
}

async function imagenFoto(usuarioId, id, tx = null) {
  const f = await datos.fotoImagen(usuarioId, id, tx)
  if (!f) throw noEncontrado('Esa foto')
  return f.imagen
}

function revisarImagen(imagen) {
  if (typeof imagen !== 'string' || !/^data:image\/(webp|jpeg|png);base64,/.test(imagen)) throw datoInvalido('Eso no es una imagen.')
  if (imagen.length > FOTO_MAX) throw datoInvalido('La foto es muy grande.')
}

/**
 * Guarda la foto (ya achicada) con el día de hoy; la fecha no se puede cambiar.
 * `dia` (día del ciclo) es opcional: lo pasa quien lo sepa (el módulo ciclo todavía no está conectado acá).
 */
async function agregarFoto(usuarioId, { imagen, dia = null }, tx = null) {
  revisarImagen(imagen)
  return transaccion(async (t) => {
    const f = await datos.fotoCrear(usuarioId, { id: nuevoId('foto'), fecha: await hoyDe(usuarioId, t), dia: Number.isInteger(dia) && dia > 0 ? dia : null, imagen, creada: ahora() }, t)
    await anotar(usuarioId, 'habitos', 'foto_agregar', { id: f.id, fecha: f.fecha }, t)
    return sinNulos(f)
  }, tx)
}

async function borrarFoto(usuarioId, id, tx = null) {
  return transaccion(async (t) => {
    const n = await datos.fotoBorrar(usuarioId, id, t)
    if (!n) throw noEncontrado('Esa foto')
    await anotar(usuarioId, 'habitos', 'foto_borrar', { id }, t)
    return true
  }, tx)
}

// =====================================================================
// Días marcados (印)
// =====================================================================

async function listarMarcas(usuarioId, tx = null) {
  return (await datos.marcasTodas(usuarioId, tx)).map(sinNulos)
}

/** Marca (o cambia el texto de) un día. No se marcan días que todavía no pasaron. */
async function marcarDia(usuarioId, fecha, texto, tx = null) {
  if (!esFechaValida(fecha)) throw datoInvalido('La fecha no es válida.')
  const t0 = String(texto || '').trim().slice(0, 80)
  if (!t0) throw datoInvalido('Escribí qué pasó ese día.')
  return transaccion(async (t) => {
    if (fecha > (await hoyDe(usuarioId, t))) throw datoInvalido('Ese día todavía no pasó.')
    const antes = await datos.marcaDe(usuarioId, fecha, t)
    const m = antes
      ? await datos.marcaActualizar(usuarioId, fecha, t0, ahora(), t)
      : await datos.marcaCrearSiFalta(usuarioId, { fecha, texto: t0, creada: ahora() }, t)
    await anotar(usuarioId, 'habitos', antes ? 'marca_editar' : 'marca_crear', { antes, despues: m }, t)
    return sinNulos(m)
  }, tx)
}

async function quitarMarca(usuarioId, fecha, tx = null) {
  return transaccion(async (t) => {
    const antes = await datos.marcaDe(usuarioId, fecha, t)
    if (!antes) return false
    await datos.marcaBorrar(usuarioId, fecha, t)
    await anotar(usuarioId, 'habitos', 'marca_borrar', { antes }, t)
    return true
  }, tx)
}

// =====================================================================
// Ajustes, resúmenes e importar
// =====================================================================

/** Cambia la forja (días, válidos, XP por día, XP al forjarse, máximo) y/o la XP de la caída. */
async function cambiarConfig(usuarioId, { forja, caidaXp } = {}, tx = null) {
  return transaccion(async (t) => {
    const cambios = {}
    if (forja && typeof forja === 'object') cambios.forja = calculo.configForja({ ...(await configForja(usuarioId, t)), ...forja })
    if (caidaXp !== undefined) cambios.caida = { xp: calculo.xpCaidaDe({ xp: caidaXp }) }
    if (Object.keys(cambios).length) {
      await guardarAjustes(usuarioId, cambios, t)
      await anotar(usuarioId, 'habitos', 'config', cambios, t)
    }
    return { forja: await configForja(usuarioId, t), caidaXp: await xpCaida(usuarioId, t) }
  }, tx)
}

/** Lo que muestra la tarjeta de Hoy: piedras en forja, caídas de hoy y cuántas reglas hay. */
async function resumenHoy(usuarioId, tx = null) {
  const f = await listarForja(usuarioId, tx)
  return {
    hoy: f.hoy,
    enForja: f.enForja.map(({ habito: h, estado: e }) => ({ id: h.id, nombre: h.nombre, kanji: h.kanji, validos: e.validos, necesarios: e.necesarios, pedazos: e.pedazos, hechoHoy: e.hechoHoy })),
    caidasHoy: (await caidasDelDia(usuarioId, f.hoy, tx)).length,
    reglas: (await datos.codigoContar(usuarioId, tx)),
  }
}

/** Todo lo de la pantalla de Hábitos. */
async function resumen(usuarioId, tx = null) {
  const forja = await listarForja(usuarioId, tx)
  return {
    hoy: forja.hoy,
    forja,
    codigo: await listarCodigo(usuarioId, tx),
    grupos: calculo.GRUPOS_CODIGO,
    momentos: calculo.MOMENTOS_CODIGO,
    caida: {
      xp: await xpCaida(usuarioId, tx),
      hoy: await caidasDelDia(usuarioId, forja.hoy, tx),
      total: (await todasLasCaidas(usuarioId, tx)).length,
      deshacerMs: calculo.DESHACER_CAIDA_MS,
    },
  }
}

/**
 * Trae lo de una copia de la app vieja («Copiar todo como texto»): tablas forja, codigo, caidas, fotos, marcas
 * y, de los ajustes, forja, caida y codigoSembrado. Los id se conservan (la XP ya la trae xp.importar con sus claves).
 * Lo repetido no entra. Devuelve cuántos entraron de cada cosa. Lo usa el módulo copia.
 */
async function importar(usuarioId, viejo = {}, tx = null) {
  return transaccion(async (t) => {
    const n = { forja: 0, codigo: 0, caidas: 0, fotos: 0, marcas: 0 }
    const texto = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null)
    for (const h of viejo.forja || []) {
      if (!h || !texto(h.id) || !texto(h.nombre) || !esFechaValida(h.inicio)) continue
      const estado = ['forja', 'forjado', 'abandonado'].includes(h.estado) ? h.estado : 'forja'
      const hecho = await datos.forjaCrear(usuarioId, {
        id: h.id, nombre: h.nombre.trim(), kanji: calculo.limpiarKanji(h.kanji) || '志', inicio: h.inicio,
        cumplidos: (Array.isArray(h.cumplidos) ? h.cumplidos : []).filter(esFechaValida), fallas: Number.isFinite(h.fallas) ? h.fallas : 0,
        estado, forjadoEn: esFechaValida(h.forjadoEn) ? h.forjadoEn : null, abandonadoEn: esFechaValida(h.abandonadoEn) ? h.abandonadoEn : null,
        creado: Number.isFinite(h.creado) ? h.creado : ahora(),
      }, t)
      if (hecho) n.forja++
    }
    for (const r of viejo.codigo || []) {
      if (!r || !texto(r.id) || !texto(r.texto) || !calculo.esGrupo(r.grupo)) continue
      const orden = Number.isFinite(r.orden) ? r.orden : 0
      const hecho = await datos.codigoCrear(usuarioId, {
        id: r.id, texto: r.texto.trim(), grupo: r.grupo, momento: calculo.esMomento(r.momento) ? r.momento : 'siempre',
        orden, ordenMomento: Number.isFinite(r.ordenMomento) ? r.ordenMomento : orden, creado: Number.isFinite(r.creado) ? r.creado : ahora(),
      }, t)
      if (hecho) n.codigo++
    }
    for (const c of viejo.caidas || []) {
      if (!c || !texto(c.id) || !esFechaValida(c.fecha)) continue
      const hecho = await datos.caidaCrear(usuarioId, {
        id: c.id, fecha: c.fecha, instante: Number.isFinite(c.instante) ? c.instante : ahora(),
        origen: c.origen === 'tension' ? 'tension' : 'boton', xp: Number.isFinite(c.xp) ? Math.max(0, Math.round(c.xp)) : 0,
      }, t)
      if (hecho) n.caidas++
    }
    for (const f of viejo.fotos || []) {
      if (!f || !texto(f.id) || !esFechaValida(f.fecha)) continue
      try { revisarImagen(f.imagen) } catch { continue }
      const hecho = await datos.fotoCrear(usuarioId, {
        id: f.id, fecha: f.fecha, dia: Number.isInteger(f.dia) && f.dia > 0 ? f.dia : null, imagen: f.imagen, creada: Number.isFinite(f.creada) ? f.creada : ahora(),
      }, t)
      if (hecho) n.fotos++
    }
    for (const m of viejo.marcas || []) {
      if (!m || !esFechaValida(m.fecha) || !texto(m.texto)) continue
      const hecho = await datos.marcaCrearSiFalta(usuarioId, {
        fecha: m.fecha, texto: m.texto.trim().slice(0, 80), creada: Number.isFinite(m.creada) ? m.creada : ahora(), editada: Number.isFinite(m.editada) ? m.editada : null,
      }, t)
      if (hecho) n.marcas++
    }
    const a = viejo.ajustes || {}
    const cambios = {}
    if (a.forja && typeof a.forja === 'object') cambios.forja = calculo.configForja(a.forja)
    if (a.caida && typeof a.caida === 'object') cambios.caida = { xp: calculo.xpCaidaDe(a.caida) }
    // Si la copia trae reglas (o ya se sembró allá), los ejemplos no se vuelven a cargar.
    if (a.codigoSembrado || n.codigo) cambios.codigoSembrado = true
    if (Object.keys(cambios).length) await guardarAjustes(usuarioId, cambios, t)
    if (Object.values(n).some(Boolean)) await anotar(usuarioId, 'habitos', 'importar', n, t)
    return n
  }, tx)
}

/** Todo lo del módulo (con las fotos), con la forma que recibe `importar`. Lo usa el módulo copia. */
async function exportar(usuarioId, tx = null) {
  const fotos = []
  for (const f of await datos.fotosLista(usuarioId, tx)) {
    const img = await datos.fotoImagen(usuarioId, f.id, tx)
    fotos.push({ ...f, imagen: img ? img.imagen : null })
  }
  const a = await obtenerAjustes(usuarioId, tx)
  return {
    forja: await datos.forjaTodos(usuarioId, tx),
    codigo: await datos.codigoTodas(usuarioId, tx),
    caidas: await datos.caidasTodas(usuarioId, tx),
    fotos,
    marcas: await datos.marcasTodas(usuarioId, tx),
    ajustes: { forja: a.forja, caida: a.caida, codigoSembrado: !!a.codigoSembrado },
  }
}

module.exports = {
  // forja
  configForja, listarForja, crearHabito, alternarDia, abandonarHabito, editarHabito, kanjiSugeridos: calculo.kanjiSugeridos,
  // mi código
  sembrar, listarCodigo, agregarRegla, editarRegla, borrarRegla, moverRegla,
  // caídas
  registrarCaida, deshacerCaida, caidasDelDia, caidasPorDia, todasLasCaidas,
  // fotos y marcas
  listarFotos, imagenFoto, agregarFoto, borrarFoto, listarMarcas, marcarDia, quitarMarca,
  // resto
  cambiarConfig, resumenHoy, resumen, importar, exportar,
}

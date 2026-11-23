'use strict'
/**
 * Dia · parte 2: la pantalla Hoy como tablero. Junta lo de dia (pilares, racha, noche, horario) con la tarjeta chica de
 * cada módulo (cada uno la presta por su ventanilla: resumenHoy). También: «Empezar mi ciclo», «Dejo celu» desde Hoy,
 * la tira «Hoy me toca a mí» y el bloqueo de la app en modo sueño.
 * La puerta del módulo es ventanilla/index.js. Todas aceptan `tx` opcional al final.
 */
const pilares = require('./pilares')
const calendario = require('./calendario')
const xp = require('../../xp/ventanilla')
const ciclo = require('../../ciclo/ventanilla')
const juego = require('../../juego/ventanilla')
const sueno = require('../../sueno/ventanilla')
const comida = require('../../comida/ventanilla')
const entreno = require('../../entreno/ventanilla')
const habitos = require('../../habitos/ventanilla')
const organizacion = require('../../organizacion/ventanilla')
const datos = require('../datos')
const agenda = require('../agenda')
const { obtenerAjustes } = require('../../../comun/ajustes')
const { ahora } = require('../../../comun/reloj')
const { fechaDe, instanteDe, esFechaValida } = require('../../../comun/fechas')
const { datoInvalido } = require('../../../comun/errores')

/**
 * Lo que app.js le conecta para no requerir módulos que llegan después:
 * - `desafiosHoy(u)` → { tension: { ruta, activa, kanji }, noCumpli: { ruta }, tresDosUno: { ruta }, pendientes: [{ texto, ruta }] } (desafios.pendientes).
 */
const fuentes = { desafiosHoy: null }
function conectarTablero(cambios = {}) {
  for (const [k, fn] of Object.entries(cambios)) if (k in fuentes && (fn === null || typeof fn === 'function')) fuentes[k] = fn
}

/** Una tarjeta que falla no rompe Hoy: queda null (y se anota en la consola del servidor). */
async function tarjeta(nombre, fn) {
  try { return await fn() } catch (e) { console.error(`[dia] la tarjeta «${nombre}» falló:`, e.message); return null }
}

/** ¿La app está en modo sueño? (la pantalla de sueño se encarga de cerrarlo a la mañana). */
async function enModoSueno(usuarioId, tx = null) { return !!(await sueno.modoActivo(usuarioId, tx)) }

/** Páginas que el modo sueño no deja ver (todas, salvo la del modo, entrar y los archivos). */
function esPaginaBloqueable(ruta) {
  const r = String(ruta || '').split('?')[0]
  if (r.startsWith('/api/') || r.startsWith('/m/') || r.startsWith('/comun/')) return false
  if (r === '/entrar' || r === '/sueno/modo' || r === '/favicon.ico') return false
  return true
}

/**
 * Todo lo de la pantalla Hoy:
 * { ...resumenHoy de dia, sinCiclo, modoSueno, feriado, fechasClave, horario (momento), nivel, horas (de la noche),
 *   tarjetas: { juego, sueno, comida, entreno, habitos, organizacion, desafios } } (cada tarjeta puede ser null).
 */
async function tableroHoy(usuarioId) {
  const r = await pilares.resumenHoy(usuarioId)
  const a = await obtenerAjustes(usuarioId)
  const todasFc = await datos.fechasClave(usuarioId)
  const h = await tarjeta('horario', () => calendario.horarioDelDia(usuarioId, r.hoy))
  const t = ahora()
  return {
    ...r,
    sinCiclo: !r.ciclo,
    modoSueno: await enModoSueno(usuarioId),
    feriado: await datos.feriado(usuarioId, r.hoy),
    fechasClave: todasFc.filter((fc) => agenda.caeEn(fc, r.hoy)),
    horario: h && h.momento ? { texto: h.momento.texto, ahora: h.momento.ahora, siguiente: h.momento.siguiente, enObligatorio: h.momento.enObligatorio } : null,
    horas: { alistarse: a.horaAlistarse, dejarCelu: a.horaDejarCelu, limiteCelu: a.horaLimiteCelu, dormido: a.horaDormido },
    pasoDejoCelu: t > instanteDe(r.hoy, a.horaDejarCelu, a.zonaHoraria),
    deAlistarse: t >= instanteDe(r.hoy, a.horaAlistarse, a.zonaHoraria) && t <= instanteDe(r.hoy, a.horaLimiteCelu, a.zonaHoraria),
    nivel: await tarjeta('nivel', () => xp.estado(usuarioId)),
    tarjetas: {
      juego: await tarjeta('juego', async () => {
        const j = await juego.resumen(usuarioId)
        return { minutosHoy: j.minutosHoy, limiteHoy: j.limiteHoy, estado: j.estado, activa: !!j.activa, pausada: j.pausada }
      }),
      sueno: await tarjeta('sueno', () => sueno.resumenHoy(usuarioId)),
      comida: await tarjeta('comida', () => comida.resumenHoy(usuarioId)),
      entreno: await tarjeta('entreno', () => entreno.resumenHoy(usuarioId)),
      habitos: await tarjeta('habitos', () => habitos.resumenHoy(usuarioId)),
      organizacion: await tarjeta('organizacion', () => organizacion.resumenHoy(usuarioId)),
      desafios: fuentes.desafiosHoy ? await tarjeta('desafios', () => fuentes.desafiosHoy(usuarioId)) : null,
    },
  }
}

/** «Empezar mi ciclo» (cuenta nueva, sin ciclo). Si ya hay uno, no lo pisa: un ciclo nuevo se empieza desde Ciclo. */
async function empezarCiclo(usuarioId, { inicio = null, duracionDias = 90, diaCero = false } = {}, tx = null) {
  if (await ciclo.cicloActivo(usuarioId, tx)) throw datoInvalido('Ya tenés un ciclo en marcha. Un ciclo nuevo se empieza desde Ciclo.')
  const a = await obtenerAjustes(usuarioId, tx)
  const f = inicio || fechaDe(ahora(), a.zonaHoraria)
  if (!esFechaValida(f)) throw datoInvalido('La fecha de inicio no es válida.')
  return ciclo.iniciarCiclo(usuarioId, { inicio: f, duracionDias, diaCero: !!diaCero }, tx)
}

/**
 * «Dejo celu» desde Hoy: antes del Día 1 no se registra nada. Le pasa a sueno la línea de «Buenas noches»
 * («3 de 5 pilares · racha 4») y sueno da la XP y prende el modo sueño.
 */
async function dejoCeluDesdeHoy(usuarioId, tx = null) {
  const r = await pilares.pilaresDelDia(usuarioId, null, tx)
  const c = await ciclo.diaDelCiclo(usuarioId, null, tx)
  if (!c || c.noEmpezado) throw datoInvalido('Tu ciclo todavía no empezó: «Dejo celu» cuenta desde el Día 1.')
  const racha = await pilares.racha(usuarioId, null, tx)
  const resumen = `${r.cumplidos} de ${r.aplican} pilares${racha ? ` · racha ${racha}` : ''}`
  return sueno.dejoCelu(usuarioId, { resumen }, tx)
}

/** ✓ en la tira «Hoy me toca a mí» (organizacion). Devuelve la tira nueva. */
async function tareaHecha(usuarioId, frenteId, tareaId, tx = null) {
  return organizacion.marcarHecha(usuarioId, frenteId, tareaId, tx)
}

module.exports = { conectarTablero, tableroHoy, empezarCiclo, dejoCeluDesdeHoy, tareaHecha, enModoSueno, esPaginaBloqueable }

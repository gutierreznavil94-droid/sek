'use strict'
/**
 * XP · las cuentas puras (sin base). Traído de src/domain/xp.ts, niveles.ts y resta.ts.
 *
 * Niveles: pasar del nivel n al n+1 cuesta `base × n` XP. Con base 100: nivel 2 a 100 XP,
 * nivel 3 a 300, nivel 5 a 1.000, nivel 10 a 4.500. Sin tope.
 * Lo no cumplido resta: cada cosa que tocaba y no se hizo resta el % de la XP que da (50 % por defecto),
 * redondeado para arriba. La XP total nunca baja de 0.
 */

const BASE_NIVEL_POR_DEFECTO = 100
const RESTA_DEFECTO = { activa: true, porcentaje: 50 }

/** Orígenes que pueden restar (el resto solo suma). */
const ORIGENES_QUE_RESTAN = new Set(['resta', 'caida', 'rival'])
/** El origen dice de dónde vino (compromiso, entrenamiento, suenio, juego, forja, resta…): una palabra corta. */
const origenValido = (o) => typeof o === 'string' && /^[a-z0-9_]{2,30}$/.test(o)

/** Clave única de un evento de XP: 'origen:parte1:parte2'. */
function claveXp(origen, partes = []) {
  return [origen, ...partes.map(String)].join(':')
}

/** Suma de lo no anulado. Lo que no puede restar cuenta como 0 si viniera negativo. Nunca baja de 0. */
function totalXp(registros) {
  let total = 0
  for (const r of registros) if (!r.anulado) total += ORIGENES_QUE_RESTAN.has(r.origen) ? r.cantidad : Math.max(0, r.cantidad)
  return Math.max(0, total)
}

/** XP total para llegar a un nivel (nivel 1 = 0 XP). */
function xpParaNivel(nivel, base = BASE_NIVEL_POR_DEFECTO) {
  if (nivel <= 1) return 0
  return (base * nivel * (nivel - 1)) / 2
}

function nivelDesdeXp(xpTotal, base = BASE_NIVEL_POR_DEFECTO) {
  if (xpTotal <= 0 || base <= 0) return 1
  let nivel = Math.floor((1 + Math.sqrt(1 + (8 * xpTotal) / base)) / 2)
  while (xpParaNivel(nivel + 1, base) <= xpTotal) nivel++
  while (nivel > 1 && xpParaNivel(nivel, base) > xpTotal) nivel--
  return Math.max(1, nivel)
}

/** Etiqueta sobria de etapa; el nivel siempre se muestra como número. */
function etapaDeNivel(nivel) {
  if (nivel < 5) return 'Inicio'
  if (nivel < 10) return 'Constancia'
  if (nivel < 15) return 'Consolidación'
  return 'Sostenido'
}

function estadoNivel(xpTotal, base = BASE_NIVEL_POR_DEFECTO) {
  const xp = Math.max(0, Math.floor(xpTotal))
  const nivel = nivelDesdeXp(xp, base)
  const xpInicioNivel = xpParaNivel(nivel, base)
  const xpInicioSiguiente = xpParaNivel(nivel + 1, base)
  const xpParaSiguiente = xpInicioSiguiente - xpInicioNivel
  const xpEnNivel = xp - xpInicioNivel
  return {
    nivel,
    etapa: etapaDeNivel(nivel),
    xpTotal: xp,
    xpEnNivel,
    xpParaSiguiente,
    xpInicioNivel,
    xpInicioSiguiente,
    progreso: xpParaSiguiente > 0 ? xpEnNivel / xpParaSiguiente : 0,
  }
}

/** Configuración de «lo no cumplido resta» desde los ajustes (lo de siempre si falta). */
function configResta(ajustes) {
  const x = (ajustes && ajustes.xpResta) || {}
  const p = Number(x.porcentaje)
  return {
    activa: x.activa ?? RESTA_DEFECTO.activa,
    porcentaje: Number.isFinite(p) ? Math.max(0, Math.min(100, Math.round(p))) : RESTA_DEFECTO.porcentaje,
    desde: x.desde ?? null,
  }
}

/** Cuánto resta algo que da `xp`: el % redondeado para arriba. */
function cuantoResta(xp, porcentaje) {
  if (!(xp > 0) || !(porcentaje > 0)) return 0
  return Math.ceil((xp * porcentaje) / 100)
}

/** ¿Este día cuenta para restar? Activa, con día de inicio y la fecha desde ese día (nunca hacia atrás). */
function aplicaEnFecha(cfg, fecha) {
  return cfg.activa && !!cfg.desde && fecha >= cfg.desde && cfg.porcentaje > 0
}

/**
 * Las restas de un día. `faltantes`: [{ id, nombre, xp, tipo }]. `totalAntes`: XP total en ese momento;
 * nunca se saca más de lo que hay, así que la última puede quedar más chica (o no estar).
 */
function restasDelDia(faltantes, cfg, fecha, totalAntes) {
  if (!aplicaEnFecha(cfg, fecha)) return []
  let queda = Math.max(0, Math.floor(totalAntes))
  const r = []
  for (const f of faltantes) {
    const cantidad = Math.min(queda, cuantoResta(f.xp, cfg.porcentaje))
    if (cantidad <= 0) continue
    queda -= cantidad
    r.push({ id: f.id, nombre: f.nombre, tipo: f.tipo, cantidad })
  }
  return r
}

/** «Te quedan 2 sin hacer: −15 XP si no los hacés hoy» (null si no falta nada). */
function textoAvisoResta(faltantes, porcentaje) {
  const total = faltantes.reduce((s, f) => s + cuantoResta(f.xp, porcentaje), 0)
  if (!faltantes.length || total <= 0) return null
  const n = faltantes.length
  return `Te ${n === 1 ? 'queda 1' : `quedan ${n}`} sin hacer: −${total} XP si no ${n === 1 ? 'lo hacés' : 'los hacés'} hoy`
}

/** Lo ganado y lo perdido (sin anulados). */
function balanceDe(registros) {
  let mas = 0
  let menos = 0
  for (const r of registros) {
    if (r.anulado) continue
    if (r.cantidad >= 0) mas += r.cantidad
    else menos -= r.cantidad
  }
  return { mas, menos }
}

module.exports = {
  BASE_NIVEL_POR_DEFECTO, RESTA_DEFECTO, ORIGENES_QUE_RESTAN, origenValido,
  claveXp, totalXp, xpParaNivel, nivelDesdeXp, etapaDeNivel, estadoNivel,
  configResta, cuantoResta, aplicaEnFecha, restasDelDia, textoAvisoResta, balanceDe,
}

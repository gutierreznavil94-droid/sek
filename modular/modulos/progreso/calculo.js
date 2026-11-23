'use strict'
/**
 * Progreso · cuentas puras (sin base). Traído de src/ui/paginas/Progreso.tsx y CierreFase.tsx de la app vieja.
 */
const { sumarDias } = require('../../comun/fechas')

const HECHO = new Set(['cumplido', 'tarde'])
const NO_CUENTA = new Set(['pendiente', 'descanso'])

/** Todas las fechas de [desde, hasta], con tope para no colgarse. */
function fechasEntre(desde, hasta, tope = 800) {
  const r = []
  for (let f = desde; f <= hasta && r.length < tope; f = sumarDias(f, 1)) r.push(f)
  return r
}

/**
 * «道 El camino» (la montaña): un punto por día del ciclo con la XP neta del día, lo ganado y lo perdido,
 * el acumulado (nunca menos de 0), qué parte de los pilares se hizo y sus marcas (caída, forja, día marcado).
 * `xpDias`: Map fecha → { ganado, perdido, neto }. `pilares`: Map fecha → [{ estado }].
 */
function armarCamino({ desde, hasta, xpAntes = 0, xpDias, pilares, fechasCaida, fechasForja, marcas }) {
  let acumulado = xpAntes
  return fechasEntre(desde, hasta).map((fecha, i) => {
    const x = xpDias.get(fecha) || { ganado: 0, perdido: 0, neto: 0 }
    acumulado += x.neto
    const cuentan = (pilares.get(fecha) || []).filter((p) => p.estado !== 'descanso')
    const hechos = cuentan.filter((p) => HECHO.has(p.estado)).length
    return {
      fecha, dia: i + 1, neto: x.neto, ganado: x.ganado, perdido: x.perdido, acumulado: Math.max(0, acumulado),
      pilares: cuentan.length ? { hechos, total: cuentan.length } : null,
      caida: fechasCaida.has(fecha), forja: fechasForja.has(fecha), marca: marcas.get(fecha) || null,
    }
  })
}

/** Cada pilar en el rango: { id, nombre, hechos, programados }. Siempre todos, aunque no tengan días todavía. */
function pilaresEnRango(porDia) {
  const porPilar = new Map()
  for (const d of porDia) {
    for (const p of d.pilares) {
      const x = porPilar.get(p.accionId) || { id: p.accionId, nombre: p.nombre, hechos: 0, programados: 0 }
      if (!NO_CUENTA.has(p.estado)) {
        x.programados++
        if (HECHO.has(p.estado)) x.hechos++
      }
      porPilar.set(p.accionId, x)
    }
  }
  return [...porPilar.values()]
}

/** Días cumplidos (porcentaje ≥ umbral) de los días cerrados que cuentan (sin excepción y con algo programado). */
function diasCumplidos(diasCerrados, umbral) {
  const cuentan = diasCerrados.filter((d) => d.porcentaje !== null && !d.excepcion)
  return { cumplidos: cuentan.filter((d) => d.porcentaje >= umbral).length, contados: cuentan.length }
}

/** Serie completa de un rango (los días sin dato van en 0 o null): [{ fecha, valor }]. */
function serieDiaria(desde, hasta, filas, campo, vacio = 0) {
  const m = new Map(filas.map((f) => [f.fecha ?? f.noche, f[campo]]))
  return fechasEntre(desde, hasta).map((fecha) => ({ fecha, valor: m.has(fecha) ? m.get(fecha) : vacio }))
}

/** Promedio de los valores que no son null (redondeado), o null si no hay ninguno. */
function promedio(valores) {
  const v = valores.filter((x) => x !== null && x !== undefined)
  return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null
}

/** Desde dónde arranca cada rango del gráfico de XP. */
function desdeDelRango(rango, hoy, inicioCiclo) {
  if (rango === 'mes') return sumarDias(hoy, -29)
  if (rango === 'ciclo' && inicioCiclo && inicioCiclo <= hoy) return inicioCiclo
  return sumarDias(hoy, -6)
}

/**
 * Los números de un período para el cierre de fase («Base / fase anterior / fase»).
 * Nada se inventa: lo que no tiene registros vuelve null y la pantalla muestra «—».
 */
function numerosDelPeriodo({ diasCerrados, entrenos, noches, xpGanado }) {
  let cumplidos = 0
  let programados = 0
  for (const d of diasCerrados) if (!d.excepcion) { cumplidos += d.cumplidos; programados += d.programados }
  const conJuego = diasCerrados.length
  return {
    cumplimiento: programados ? Math.round((100 * cumplidos) / programados) : null,
    entrenos: { hechos: entrenos.hechos, previstos: entrenos.previstos },
    noches: { cumplidas: noches.filter((n) => n.cumplido).length, total: noches.length },
    juegoPorDia: conJuego ? Math.round(diasCerrados.reduce((s, d) => s + d.minutosJuego, 0) / conJuego) : null,
    xp: xpGanado,
  }
}

module.exports = { fechasEntre, armarCamino, pilaresEnRango, diasCumplidos, serieDiaria, promedio, desdeDelRango, numerosDelPeriodo }

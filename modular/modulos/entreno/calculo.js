'use strict'
/**
 * Entreno · las cuentas puras (sin base). Traído de src/services/entreno.ts y src/domain/cuotas.ts.
 *
 * Progresión (pedido de Navil, 3 nov): cada ejercicio tiene «reps actuales» (la serie 1 de la vez pasada
 * con ese peso) y un tope. El entreno propone actuales + 1. Superar las actuales con el mismo peso es
 * récord (+5 XP) y el número nuevo queda guardado. Al llegar al tope pregunta si sube el peso; al cambiar
 * el peso empieza un tramo nuevo (+10 XP). Tope: 20 XP extra por entreno.
 */

/** +5 por récord: superar las reps actuales con el mismo peso. */
const XP_RECORD = 5
/** +10 por subir el peso (la sesión en que se hace la primera serie con el peso nuevo). */
const XP_SUBIR_PESO = 10
/** Tope de XP extra por entreno. */
const TOPE_XP_EXTRA = 20
/** Segundos de la cuenta 3-2-1 antes de la sombra (se descuentan del descanso). */
const PREPARAR_SOMBRA_S = 3
/** A cuántos segundos del final del descanso se avisa para alistarse. */
const AVISO_FIN_DESCANSO_S = 10
/** Una serie que «dura» más que esto no se mide (la app quedó abierta sin usar). */
const TOPE_SEGUNDOS_SERIE = 30 * 60
/** Segundos para acomodarse antes de un reloj (calentamiento, rondas, colgarse). */
const PREPARACION_S = 5
/** Segundos que se descuentan al tocar «Listo» en el cronómetro (lo que tarda en bajar y tocar). */
const DESCUENTO_S = 3
/** Pausa máxima que cuenta entre dos movimientos al medir la duración del entreno. */
const PAUSA_MAXIMA_S = 15 * 60

const TIPOS_BLOQUE = ['ejercicio', 'calentamiento', 'temporizador', 'rondas', 'casilla']

// ---------- Rutinas ----------

/** Nombre para comparar: sin mayúsculas, tildes ni espacios de más. */
function nombreComparable(n) {
  return String(n || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()
}

/** Errores de una rutina antes de guardarla (lista vacía = está bien). */
function erroresRutina(r) {
  const e = []
  if (!r || typeof r.nombre !== 'string' || !r.nombre.trim()) e.push('Ponele un nombre a la rutina')
  if (!Array.isArray(r && r.bloques)) { e.push('La rutina no tiene bloques'); return e }
  if (!Array.isArray(r.dias) || r.dias.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) e.push('Los días tienen que ir de 0 (domingo) a 6 (sábado)')
  const ids = new Set()
  for (const b of r.bloques) {
    if (!b || typeof b.id !== 'string' || !b.id) { e.push('Hay un bloque sin id'); continue }
    if (ids.has(b.id)) e.push(`El bloque ${b.id} está repetido`)
    ids.add(b.id)
    if (!TIPOS_BLOQUE.includes(b.tipo)) e.push(`${b.nombre || b.id}: tipo de bloque desconocido`)
    if (b.tipo === 'ejercicio') {
      if (!String(b.nombre || '').trim()) e.push('Hay un ejercicio sin nombre')
      else if (!(b.series > 0) || !(b.reps > 0)) e.push(`${b.nombre}: series y repeticiones tienen que ser mayores que 0`)
      else if (b.repsTope < b.reps) e.push(`${b.nombre}: el tope no puede ser menor que las reps actuales`)
      else if (b.sombra > 0 && b.sombra >= b.descanso) e.push(`${b.nombre}: la sombra tiene que ser más corta que el descanso`)
    }
    if ((b.tipo === 'calentamiento' || b.tipo === 'temporizador') && !(b.segundos > 0)) e.push(`${b.nombre || b.id}: el tiempo tiene que ser mayor que 0`)
    if (b.tipo === 'rondas' && (!Array.isArray(b.rondas) || !b.rondas.length)) e.push(`${b.nombre || b.id}: falta al menos una ronda`)
  }
  return e
}

/**
 * Lugar para un bloque copiado en otra rutina: el mismo que tiene en la de origen. Si en el origen va antes
 * del kick boxing (rondas) o de estirar (casilla), en el destino también; si no, al final.
 */
function lugarEnRutina(origen, bloqueId, destino) {
  const i = origen.bloques.findIndex((b) => b.id === bloqueId)
  const despues = origen.bloques.slice(i + 1)
  for (const tipo of ['rondas', 'casilla']) {
    if (!despues.some((b) => b.tipo === tipo)) continue
    const j = destino.bloques.findIndex((b) => b.tipo === tipo)
    if (j >= 0) return j
  }
  return destino.bloques.length
}

/** Días de la semana ordenados de lunes a domingo. */
const ordenLunes = (dias) => [...new Set(dias)].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7))

// ---------- Descanso ----------

/**
 * Fases del descanso después de la serie `n` de un ejercicio.
 * - Serie que no es la última: 3·2·1, sombra y después «Descansá».
 * - Última serie: sin sombra; «Acomodá para el siguiente» todo el descanso.
 */
function fasesDescanso(b, n, siguiente) {
  if (n >= b.series) {
    if (!siguiente) return []
    return [{ tipo: 'acomodar', segundos: b.descanso, texto: `Acomodá para el siguiente: ${siguiente}` }]
  }
  const sombra = Math.max(0, Math.min(b.sombra || 0, b.descanso))
  const fases = []
  const prep = sombra > 0 && b.descanso - sombra >= PREPARAR_SOMBRA_S ? PREPARAR_SOMBRA_S : 0
  if (prep) fases.push({ tipo: 'preparar', segundos: prep, texto: 'Sombra en' })
  if (sombra > 0) fases.push({ tipo: 'sombra', segundos: sombra, texto: 'Sombra' })
  if (b.descanso - sombra - prep > 0) fases.push({ tipo: 'descanso', segundos: b.descanso - sombra - prep, texto: 'Descansá' })
  return fases
}

/** En qué fase está un descanso a cierto instante. `null` si ya terminó. */
function faseActual(descanso, t) {
  let pasado = (t - descanso.inicio) / 1000
  const total = descanso.fases.reduce((s, f) => s + f.segundos, 0)
  const totalRestante = Math.max(0, Math.ceil(total - pasado))
  for (let i = 0; i < descanso.fases.length; i++) {
    const f = descanso.fases[i]
    if (pasado < f.segundos) return { indice: i, fase: f, restante: Math.ceil(f.segundos - pasado), totalRestante }
    pasado -= f.segundos
  }
  return null
}

/** Cuánto duró la serie que se está anotando (desde que terminó el descanso o se pasó al bloque). */
function duracionSerie(s, t) {
  let desde = s.serieDesde
  if (s.descanso) {
    const fin = s.descanso.inicio + s.descanso.fases.reduce((a, f) => a + f.segundos, 0) * 1000
    desde = Math.min(t, fin)
  }
  if (desde === undefined || desde === null) return undefined
  const seg = Math.max(0, Math.round((t - desde) / 1000))
  return seg > TOPE_SEGUNDOS_SERIE ? undefined : seg
}

/** Tramos de un bloque de rondas: cada ronda y, entre ronda y ronda, el descanso (60 s si no se configuró). */
function tramosRondas(b) {
  const entre = b.descansoEntre ?? 60
  return b.rondas.flatMap((x, i) => [
    ...(i > 0 && entre > 0 ? [{ segundos: entre, texto: 'Descanso', descanso: true, ronda: i }] : []),
    { segundos: x.segundos, texto: x.texto, ronda: i },
  ])
}

/** Ronda en curso según el tiempo pasado. */
function rondaActual(rondas, inicio, t) {
  let pasado = (t - inicio) / 1000
  for (let i = 0; i < rondas.length; i++) {
    if (pasado < rondas[i].segundos) return { indice: i, restante: Math.ceil(rondas[i].segundos - pasado) }
    pasado -= rondas[i].segundos
  }
  return null
}

// ---------- Sesión ----------

const seriesDe = (s, bloqueId) => s.series.filter((x) => x.bloqueId === bloqueId)
const bloqueDe = (r, id) => r.bloques.find((b) => b.id === id)

/** Un bloque está terminado si se hizo, se saltó o tiene todas sus series. */
function bloqueTerminado(s, b) {
  if (s.saltados.includes(b.id) || s.hechos.includes(b.id)) return true
  return b.tipo === 'ejercicio' && seriesDe(s, b.id).length >= b.series
}

/** El próximo bloque sin terminar a partir de `desde` (y si no, el primero pendiente). */
function siguientePaso(s, r, desde) {
  for (let i = desde; i < s.orden.length; i++) {
    const b = bloqueDe(r, s.orden[i])
    if (b && !bloqueTerminado(s, b)) return i
  }
  for (let i = 0; i < desde && i < s.orden.length; i++) {
    const b = bloqueDe(r, s.orden[i])
    if (b && !bloqueTerminado(s, b)) return i
  }
  return s.orden.length
}

function nombreSiguiente(s, r) {
  const i = siguientePaso(s, r, s.paso)
  const b = i < s.orden.length ? bloqueDe(r, s.orden[i]) : undefined
  return b && b.nombre
}

/** Segundos totales del reloj de un bloque (calentamiento, colgarse o rondas). */
function segundosReloj(b) {
  if (b.tipo === 'rondas') return tramosRondas(b).reduce((t, x) => t + x.segundos, 0)
  if (b.tipo === 'casilla' || b.tipo === 'ejercicio') return 0
  return b.segundos * (b.veces ?? 1)
}

/** Los relojes que cuentan para abajo arrancan con 5 s de preparación (el cronómetro la lleva adentro). */
const llevaPreparacion = (b) => b.tipo === 'calentamiento' || b.tipo === 'rondas' || (b.tipo === 'temporizador' && b.modo !== 'cronometro')

/** Duración real del entreno (s): desde el primer movimiento; cada hueco cuenta como mucho 15 min. */
function duracionEntreno(s, t) {
  const desde = s.primerMovimiento
  if (!desde) return 0
  const marcas = [desde, ...s.series.map((x) => x.instante), ...(s.tiempos || []).map((x) => x.instante), (s.reloj && s.reloj.inicio) || 0, (s.descanso && s.descanso.inicio) || 0, t]
    .filter((x) => x >= desde && x <= t)
    .sort((a, b) => a - b)
  let total = 0
  for (let i = 1; i < marcas.length; i++) total += Math.min(PAUSA_MAXIMA_S, (marcas[i] - marcas[i - 1]) / 1000)
  return total
}

// ---------- Marcas, progresión y XP ----------

const totalReps = (x) => x.reps + (x.repsExtra ?? 0)

/** Marca de un ejercicio en una sesión: la serie 1 (peso y repeticiones), más totales. */
function marcaDe(series) {
  if (!series.length) return null
  const s1 = series.find((x) => x.n === 1) || series[0]
  return {
    peso: s1.peso,
    reps: totalReps(s1),
    repsTotal: series.reduce((t, x) => t + totalReps(x), 0),
    volumen: series.reduce((t, x) => t + (totalReps(x) + (x.ayuda ?? 0)) * x.peso, 0),
  }
}

/** >0 si `a` es mejor (más peso, o mismo peso y más repeticiones). */
function compararMarcas(a, b) {
  if (a.peso !== b.peso) return a.peso - b.peso
  return a.reps - b.reps
}

/** Mejora frente a la vez pasada (serie con serie). Hacer menos no resta. */
function mejoraDe(hoy, antes) {
  if (!hoy.length || !antes.length) return { mejora: false, igual: false }
  const pesoHoy = Math.max(...hoy.map((x) => x.peso))
  const pesoAntes = Math.max(...antes.map((x) => x.peso))
  if (pesoHoy > pesoAntes) return { mejora: true, motivo: 'más peso', igual: false }
  let igual = pesoHoy === pesoAntes
  for (const x of hoy) {
    const a = antes.find((y) => y.n === x.n)
    if (!a || a.peso !== x.peso) continue
    if (totalReps(x) > totalReps(a)) return { mejora: true, motivo: 'más reps', igual: false }
    if (totalReps(x) < totalReps(a)) igual = false
  }
  return { mejora: false, igual }
}

function kg(peso) {
  if (peso === 0) return 'peso corporal'
  return `${String(peso).replace('.', ',')} kg`
}

/** Peso con el que arranca el ejercicio: el de la vez pasada (serie 1) o el de la rutina. */
function pesoInicial(b, ultima) {
  const s = ultima.find((x) => x.n === 1) || ultima[0]
  return s ? s.peso : b.peso
}

/** Si llegó al tope pregunta si sube el peso; si no, propone actuales + 1. */
function sugerencia(b, ultima) {
  if (!ultima.length) return null
  if (b.reps >= b.repsTope) return { subirPeso: true, texto: `Llegaste a ${b.reps} con ${kg(b.peso)}. ¿Subís el peso?` }
  return { subirPeso: false, texto: `Actual ${b.reps}. Hoy, ${Math.min(b.repsTope, b.reps + 1)}.` }
}

/** Objetivo de repeticiones de la serie `n` con el peso de hoy. */
function objetivoSerie(b, ultima, n, pesoHoy) {
  const misma = ultima.find((x) => x.n === n)
  const s1 = ultima.find((x) => x.n === 1)
  if (pesoHoy !== b.peso) return b.reps
  if (n === 1) return s1 ? Math.min(b.repsTope, b.reps + 1) : b.reps
  return misma && misma.peso === pesoHoy ? misma.reps : b.reps
}

/** Resultado de un ejercicio al terminar: récord (+5) o subió el peso (+10), contra la base de la sesión. */
function resultadoEjercicio(b, hoy, antesSeries, base) {
  const marca = marcaDe(hoy)
  const m = mejoraDe(hoy, antesSeries)
  const s1 = hoy.find((x) => x.n === 1) || hoy[0]
  const subioPeso = s1.peso !== base.peso && antesSeries.length > 0
  const record = s1.peso === base.peso && s1.reps > base.reps && antesSeries.length > 0
  const xp = (record ? XP_RECORD : 0) + (subioPeso ? XP_SUBIR_PESO : 0)
  return { bloqueId: b.id, nombre: b.nombre, marca, antes: marcaDe(antesSeries), mejora: m.mejora, motivo: m.motivo, igual: m.igual, record, subioPeso, actuales: base.reps, xp }
}

// ---------- Cronómetro (colgarse en barra) ----------

/** Preparándose (cuenta 5 → 1) o colgado (segundos para arriba). */
function estadoCronometro(inicio, t) {
  const pasado = (t - inicio) / 1000
  if (pasado < PREPARACION_S) return { preparando: true, prep: Math.ceil(PREPARACION_S - pasado), segundos: 0 }
  return { preparando: false, prep: 0, segundos: pasado - PREPARACION_S }
}

/** Tiempo final: lo colgado menos el descuento, sin negativos. */
const tiempoFinal = (inicio, t) => Math.max(0, Math.round(estadoCronometro(inicio, t).segundos - DESCUENTO_S))

/** Si superó el objetivo, sube 1 s; si no, queda igual. Nunca baja solo. */
const siguienteObjetivo = (objetivo, segundos) => (segundos > objetivo ? objetivo + 1 : objetivo)

// ---------- Series rápidas (contadores) y cuotas ----------

/** Extra por defecto: 1,5 × la cuota, para arriba. */
const extraPorDefecto = (cuota) => Math.ceil(cuota * 1.5)

/** Series por día: lo guardado o cuota ÷ reps por serie (5 si no se puede). */
function seriesPorDiaDe(c) {
  if (c.seriesPorDia && c.seriesPorDia > 0) return c.seriesPorDia
  const n = c.cantidadPorToque > 0 ? Math.round(c.metaDiaria / c.cantidadPorToque) : 0
  return n > 0 ? n : 5
}

const pasoDeSubida = (c) => c.pasoReps ?? 1

function cuotaDeSeries(reps, series) {
  const cuota = reps * series
  return { cuota, extra: extraPorDefecto(cuota) }
}

/** El cambio de cuota que valía ese día. */
function vigente(c, fecha) {
  const h = c.historialCuota
  if (!h || !h.length) return null
  let v = h[0]
  for (const x of h) if (x.desde <= fecha) v = x
  return v
}

/** Cuota y extra que valían ese día. */
function cuotaDelDia(c, fecha) {
  const v = vigente(c, fecha)
  if (!v) return { cuota: c.metaDiaria, extra: c.metaExtra ?? extraPorDefecto(c.metaDiaria) }
  return { cuota: v.cuota, extra: v.extra }
}

/** Reps por serie que valían ese día. */
function repsDelDia(c, fecha) {
  const v = vigente(c, fecha)
  return v ? v.porToque ?? c.cantidadPorToque : c.cantidadPorToque
}

/** Escalones de reps por serie: el valor inicial y cada cambio con su fecha. */
function subidasDeReps(c) {
  const r = []
  for (const x of c.historialCuota || []) {
    const reps = x.porToque ?? c.cantidadPorToque
    if (r.length && r[r.length - 1].reps === reps && r[r.length - 1].cuota === x.cuota) continue
    r.push({ desde: x.desde, reps, cuota: x.cuota })
  }
  if (!r.length) r.push({ desde: '0000-01-01', reps: c.cantidadPorToque, cuota: c.metaDiaria })
  return r
}

function erroresContador(c) {
  const e = []
  if (c.seriesPorDia !== undefined && c.seriesPorDia !== null && !(c.seriesPorDia >= 1 && Number.isInteger(c.seriesPorDia))) e.push('Las series por día tienen que ser 1 o más')
  if (c.metaExtra !== undefined && c.metaExtra !== null && !(c.metaExtra > c.metaDiaria)) e.push('El extra tiene que ser mayor que la cuota')
  if (!String(c.nombre || '').trim()) e.push('Ponele un nombre')
  if (!(c.cantidadPorToque > 0)) e.push('Las reps por serie tienen que ser más que 0')
  if (!(c.metaDiaria > 0)) e.push('La meta diaria tiene que ser mayor que 0')
  if (!(c.xpMetaDiaria >= 0)) e.push('El XP no puede ser negativo')
  return e
}

/** Propuesta de subir las reps por serie (de → a). Con la cuota fijada a mano, la cuota queda como está. */
function propuestaPara(c) {
  const series = seriesPorDiaDe(c)
  const a = c.cantidadPorToque + pasoDeSubida(c)
  const cuota = c.cuotaAMano ? { cuota: c.metaDiaria, extra: c.metaExtra ?? extraPorDefecto(c.metaDiaria) } : cuotaDeSeries(a, series)
  return { contadorId: c.id, nombre: c.nombre, de: c.cantidadPorToque, a, series, ...cuota }
}

module.exports = {
  XP_RECORD, XP_SUBIR_PESO, TOPE_XP_EXTRA, PREPARAR_SOMBRA_S, AVISO_FIN_DESCANSO_S, TOPE_SEGUNDOS_SERIE, PREPARACION_S, DESCUENTO_S, PAUSA_MAXIMA_S, TIPOS_BLOQUE,
  nombreComparable, erroresRutina, lugarEnRutina, ordenLunes,
  fasesDescanso, faseActual, duracionSerie, tramosRondas, rondaActual,
  seriesDe, bloqueDe, bloqueTerminado, siguientePaso, nombreSiguiente, segundosReloj, llevaPreparacion, duracionEntreno,
  totalReps, marcaDe, compararMarcas, mejoraDe, kg, pesoInicial, sugerencia, objetivoSerie, resultadoEjercicio,
  estadoCronometro, tiempoFinal, siguienteObjetivo,
  extraPorDefecto, seriesPorDiaDe, pasoDeSubida, cuotaDeSeries, cuotaDelDia, repsDelDia, subidasDeReps, erroresContador, propuestaPara,
}

'use strict'
/**
 * Cuentas puras del día: cumplimiento, racha, atributos, estado de cada pilar, la regla de XP vigente,
 * la ventana de la noche y el Tajo. Sin base: todo entra por parámetro.
 * Traído de la app vieja: src/domain/cumplimiento.ts, partes de src/services/dia.ts y el Tajo de src/services/ninjas.ts.
 */
const { sumarDias, minutosDe, esHoraValida } = require('../../comun/fechas')

/** Tipos de acción que se programan como compromisos del día. */
const TIPOS = ['compromiso', 'entrenamiento', 'acostarse', 'limite_juego', 'revision_diaria', 'revision_semanal', 'comida_plan']
const ESTADOS = ['pendiente', 'iniciado', 'completado', 'tarde', 'omitido', 'reprogramado', 'no_registrado']
/** Orden fijo de los pilares (pedido de Navil); después, el resto por `orden`. */
const ORDEN_PILARES = ['entrenamiento', 'empresa', 'manga', 'acostarse']
/** El pilar de comida (lo prende la persona). */
const ID_PILAR_COMIDA = 'comer-plan'

const idCompromiso = (accionId, fecha) => `${accionId}:${fecha}`

/** Origen del XP según el tipo de acción (mismas claves que la app vieja). */
function origenDe(tipo) {
  switch (tipo) {
    case 'entrenamiento': return 'entrenamiento'
    case 'acostarse': return 'suenio'
    case 'limite_juego': return 'juego'
    case 'revision_diaria': return 'revision'
    case 'revision_semanal': return 'semana'
    default: return 'compromiso'
  }
}

/** La regla con la fecha de inicio más nueva que ya vale ese día. */
function reglaVigente(reglas, fecha) {
  let mejor = null
  for (const r of reglas) if (r.validaDesde <= fecha && (!mejor || r.validaDesde > mejor.validaDesde)) mejor = r
  return mejor
}

/** HH:MM de una hora límite más su margen (20:50 + 10 → 21:00). */
function horaFinMargen(horaLimite, margenMinutos) {
  const total = minutosDe(horaLimite) + margenMinutos
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

const tieneExtra = (accion) => !!accion.minutosExtra && accion.minutosExtra > 0

function ordenarPilares(lista) {
  const pos = (a) => { const i = ORDEN_PILARES.indexOf(a.id); return i === -1 ? 100 + a.orden : i }
  return [...lista].sort((a, b) => pos(a) - pos(b))
}

// ---------- Cumplimiento ----------

/** Cuenta en el denominador: lo que tocaba ese día. De hoy solo cuenta lo ya resuelto. */
function cuentaComoProgramado(c, esHoy) {
  if (c.excepcion) return false
  if (c.estado === 'reprogramado') return false
  if (esHoy && (c.estado === 'pendiente' || c.estado === 'iniciado')) return false
  return true
}

const cuentaComoCumplido = (c) => c.estado === 'completado'

/** Cumplimiento de una lista de compromisos. Si hay pilares, se mide solo sobre los pilares. */
function cumplimiento(compromisos, hoy = null) {
  let cumplidos = 0
  let programados = 0
  const hayPilares = compromisos.some((c) => c.pilar)
  for (const c of compromisos) {
    if (hayPilares && !c.pilar) continue
    if (!cuentaComoProgramado(c, c.fecha === hoy)) continue
    programados += c.peso ?? 1
    if (cuentaComoCumplido(c)) cumplidos += c.peso ?? 1
  }
  return { cumplidos, programados, porcentaje: programados > 0 ? Math.round((100 * cumplidos) / programados) : null }
}

/** Para el calendario: sin_datos, bajo (rojo), medio (ámbar), alto (verde). */
function nivelCumplimiento(porcentaje, umbralAlto = 80) {
  if (porcentaje === null || porcentaje === undefined) return 'sin_datos'
  if (porcentaje >= umbralAlto) return 'alto'
  if (porcentaje >= 50) return 'medio'
  return 'bajo'
}

/**
 * Racha: días seguidos que terminan en `hasta` con cumplimiento ≥ umbral.
 * Un día de excepción se salta sin contar ni cortar; un día sin datos corta.
 */
function racha(porDia, hasta, umbral = 75, maxDias = 400) {
  let dias = 0
  let f = hasta
  for (let i = 0; i < maxDias; i++) {
    const d = porDia.get(f)
    if (!d) break
    if (d.excepcion) { f = sumarDias(f, -1); continue }
    if (d.porcentaje === null || d.porcentaje < umbral) break
    dias++
    f = sumarDias(f, -1)
  }
  return dias
}

/** Valor de un atributo: % cumplido de sus acciones en una ventana móvil. Con pocos datos, null. */
function calcularAtributo(atributoId, compromisos, hoy, ventanaDias = 14, minimoProgramados = 5) {
  const desde = sumarDias(hoy, -(ventanaDias - 1))
  const porAccion = new Map()
  let cumplidos = 0
  let programados = 0
  for (const c of compromisos) {
    if (!c.atributoIds.includes(atributoId)) continue
    if (c.fecha < desde || c.fecha > hoy) continue
    if (!cuentaComoProgramado(c, c.fecha === hoy)) continue
    const peso = c.peso ?? 1
    const acc = porAccion.get(c.accionId) ?? { cumplidos: 0, programados: 0 }
    acc.programados += peso
    programados += peso
    if (cuentaComoCumplido(c)) { acc.cumplidos += peso; cumplidos += peso }
    porAccion.set(c.accionId, acc)
  }
  return {
    atributoId,
    valor: programados >= minimoProgramados ? Math.round((100 * cumplidos) / programados) : null,
    cumplidos, programados, ventanaDias, desde, hasta: hoy, minimoProgramados,
    porAccion: [...porAccion.entries()].map(([accionId, v]) => ({ accionId, ...v })),
  }
}

/** Estado visible de un pilar: pendiente, cumplido, tarde, omitido o descanso. */
function estadoPilar(accion, compromiso, diaSemana) {
  let estado
  if (!compromiso || compromiso.estado === 'reprogramado') estado = accion.tipo === 'entrenamiento' ? 'descanso' : 'pendiente'
  else if (compromiso.estado === 'completado') estado = 'cumplido'
  else if (compromiso.estado === 'tarde') estado = 'tarde'
  else if (compromiso.estado === 'omitido' || compromiso.estado === 'no_registrado') estado = 'omitido'
  else estado = 'pendiente'
  if (!compromiso && accion.tipo !== 'entrenamiento' && !accion.dias.includes(diaSemana)) estado = 'descanso'
  return estado
}

// ---------- El Tajo ----------

const HORAS_TAJO = 3

/** ¿Toca el Tajo? Volvió después de ≥ 3 h, hay un pilar pendiente, no pasó «Dejo celu» y hoy todavía no salió. */
function debeMostrarTajo({ ultimaVista, ahora, pilarPendiente, pasoDejoCelu, mostradoHoy }) {
  if (mostradoHoy || !pilarPendiente || pasoDejoCelu) return false
  if (ultimaVista === null || ultimaVista === undefined) return false
  return ahora - ultimaVista >= HORAS_TAJO * 3600000
}

// ---------- Acciones: revisar lo que llega ----------

function validarAccion(a) {
  const errores = []
  if (!a.id || !/^[a-z0-9_-]{2,40}$/.test(a.id)) errores.push('El id va con minúsculas, números y guiones (2 a 40).')
  if (!a.nombre || String(a.nombre).trim().length < 2) errores.push('El nombre necesita al menos 2 letras.')
  if (!TIPOS.includes(a.tipo)) errores.push('Ese tipo de acción no existe.')
  if (a.hora && !esHoraValida(a.hora)) errores.push('La hora debe tener formato HH:MM.')
  if (a.horaLimite && !esHoraValida(a.horaLimite)) errores.push('La hora límite debe tener formato HH:MM.')
  if (!Array.isArray(a.dias) || a.dias.length === 0 || a.dias.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) errores.push('Elegí al menos un día de la semana.')
  if (!Array.isArray(a.atributoIds) || a.atributoIds.length === 0) errores.push('Vinculá la acción a al menos un atributo.')
  if (a.peso !== undefined && (!Number.isInteger(a.peso) || a.peso <= 0 || a.peso > 5)) errores.push('El peso va de 1 a 5.')
  if (a.minutosExtra && a.minutosMinimos && a.minutosExtra <= a.minutosMinimos) errores.push('Los minutos del extra tienen que ser más que los mínimos.')
  return errores
}

// ---------- Datos de fábrica (de src/data/semilla.ts) ----------

const TODOS = [0, 1, 2, 3, 4, 5, 6]

const ACCIONES_INICIALES = [
  { id: 'entrenamiento', nombre: 'Entrenamiento', tipo: 'entrenamiento', dias: [1, 2, 3, 4, 5, 6], hora: '07:00', pilar: true, atributoIds: ['fisico'], peso: 1, activa: true, orden: 1,
    condicion: 'Hacer el entrenamiento completo (42 min) el día programado. Los demás días el pilar muestra «Descanso».',
    minutosMinimos: 42, duracionMinutos: 42, horaLimiteInicio: '19:35', avisoInicio: { activo: true, hora: '19:00' } },
  { id: 'empresa', nombre: 'Avanzar en la empresa', tipo: 'compromiso', dias: TODOS, horaLimite: '20:50', pilar: true, atributoIds: ['disciplina'], peso: 1, activa: true, orden: 2,
    condicion: 'Avancé al menos en una cosa importante. Marcar «Sí» hasta las 20:50; después queda como tarde y no da XP.', pregunta: '¿Qué avancé?' },
  { id: 'manga', nombre: 'Dibujar manga', tipo: 'compromiso', dias: TODOS, horaLimite: '20:50', pilar: true, atributoIds: ['claridad'], peso: 1, activa: true, orden: 3,
    condicion: 'Al menos 15 minutos dibujando. Marcar «Sí» hasta las 20:50; después queda como tarde y no da XP.', minutosMinimos: 15, minutosExtra: 30, xpExtra: 10 },
  { id: 'acostarse', nombre: 'Dormir a horario', tipo: 'acostarse', dias: TODOS, hora: '21:15', horaLimite: '21:15', pilar: true, atributoIds: ['autocontrol'], peso: 1, activa: true, orden: 4,
    condicion: 'Tocar «Dejo celu» hasta las 21:15 (celular abajo, fuera del cuarto). Después queda como tarde con los minutos de retraso. Cuenta para la noche planificada aunque sea después de las 00:00.' },
  { id: 'limite_juego', nombre: 'Respetar el límite de juego', tipo: 'limite_juego', dias: TODOS, pilar: false, atributoIds: ['autocontrol'], peso: 1, activa: true, orden: 5,
    condicion: 'Al cerrar el día, el tiempo de juego registrado no supera el límite. Registrar el juego no da XP; respetar el límite sí.' },
  { id: 'revision_diaria', nombre: 'Revisión diaria', tipo: 'revision_diaria', dias: TODOS, hora: '20:50', horaLimite: '20:50', pilar: false, atributoIds: ['claridad', 'confianza'], peso: 1, activa: true, orden: 6,
    condicion: 'Tres pasos en menos de 3 minutos: qué cumplí, el obstáculo principal y un ajuste para mañana. Hasta las 20:50, con 10 minutos de margen.' },
  { id: 'revision_semanal', nombre: 'Revisión semanal', tipo: 'revision_semanal', dias: [0], hora: '19:00', pilar: false, atributoIds: ['claridad', 'confianza'], peso: 1, activa: true, orden: 7,
    condicion: 'Completar la revisión de la semana (domingo).' },
]

/** El pilar opcional de comida (arranca apagado; se prende con `activarPilarComida`). */
const ACCION_COMIDA = {
  id: ID_PILAR_COMIDA, nombre: 'Comer según el plan', tipo: 'comida_plan', dias: TODOS, pilar: true, atributoIds: ['fisico'], peso: 1, activa: true, orden: 9,
  condicion: 'Cerrar el día entre −10 % y +10 % de tus calorías y llegar a tu proteína. Un día sin cargar comidas no cuenta.',
}

const XP_INICIAL = { entrenamiento: 30, acostarse: 20, manga: 15, empresa: 15, limite_juego: 15, revision_diaria: 10, revision_semanal: 25, [ID_PILAR_COMIDA]: 15 }

module.exports = {
  TIPOS, ESTADOS, ORDEN_PILARES, ID_PILAR_COMIDA, HORAS_TAJO, ACCIONES_INICIALES, ACCION_COMIDA, XP_INICIAL,
  idCompromiso, origenDe, reglaVigente, horaFinMargen, tieneExtra, ordenarPilares,
  cuentaComoProgramado, cuentaComoCumplido, cumplimiento, nivelCumplimiento, racha, calcularAtributo, estadoPilar,
  debeMostrarTajo, validarAccion,
}

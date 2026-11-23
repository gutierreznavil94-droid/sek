'use strict'
/**
 * Copia · cuentas puras (sin base): leer el texto de una copia, saber de qué app es y repartirla por módulo.
 *
 * Dos formatos:
 * - **vieja**: «Copiar todo como texto» de la app vieja (React): `{ app: 'sistema-progreso', version: 1, exportado, tablas: { xp: [...], ... } }`.
 * - **nueva**: «Exportar» de esta app: `{ app: 'sek', formato: 'modular', version: 1, exportado, ajustes, modulos: { xp: [...], ... } }`.
 *   Cada `modulos.<m>` tiene la forma exacta que recibe `ventanilla.importar` de ese módulo.
 *
 * Las dos terminan igual: `{ origen, exportado, ajustes, partes: { <modulo>: lo que recibe su importar }, sinUsar }`.
 */

const APP_VIEJA = 'sistema-progreso'
const APP_NUEVA = 'sek'
const VERSION_VIEJA = 1
const VERSION_NUEVA = 1

/** Orden en que se cargan los módulos (ciclo antes que dia: las acciones nombran atributos del ciclo). */
const MODULOS = [
  { clave: 'ciclo', nombre: 'Ciclo, fases, objetivos y metas' },
  { clave: 'dia', nombre: 'Pilares y días' },
  { clave: 'xp', nombre: 'XP' },
  { clave: 'juego', nombre: 'Juego' },
  { clave: 'organizacion', nombre: 'Organización' },
  { clave: 'sueno', nombre: 'Sueño' },
  { clave: 'habitos', nombre: 'Forja, Mi código, caídas y fotos' },
  { clave: 'comida', nombre: 'Comida, agua y fruta' },
  { clave: 'entreno', nombre: 'Rutinas, entrenos y series' },
  { clave: 'desafios', nombre: 'Tensión, 3·2·1 y ninjas' },
  { clave: 'temas', nombre: 'Tema' },
]
const CLAVES = MODULOS.map((m) => m.clave)

/** Qué tablas de la copia vieja van a cada módulo. */
const TABLAS_VIEJAS = {
  ciclo: ['ciclos', 'fases', 'objetivos', 'atributos', 'identidad', 'metas', 'revisiones'],
  dia: ['acciones', 'reglasXp', 'compromisos', 'diasCerrados', 'excepciones', 'atributosDiarios', 'feriados', 'fechasClave'],
  xp: ['xp'],
  juego: ['sesionesJuego'],
  organizacion: ['organizacion'],
  sueno: ['suenio', 'modoSuenio'],
  habitos: ['forja', 'codigo', 'caidas', 'fotos', 'marcas'],
  comida: ['alimentosPropios', 'comidas', 'comidasGuardadas', 'pesos', 'agua', 'frutas'],
  entreno: ['rutinas', 'sesionesEntreno', 'contadores', 'registrosContador'],
  desafios: ['ninjas', 'siguienteAccion'],
  temas: [],
}

/** Tablas de la copia vieja que todavía no tienen dónde ir (y por qué). Se muestran en «Lo que no se trae». */
const SIN_LUGAR = {
  eventos: 'historial de cambios de la app vieja (no hace falta)',
  niveles: 'los niveles se calculan solos',
  temporizador: 'el temporizador en curso no se trae',
  recomendaciones: 'van al formulario, no a la app',
}

/** Ajustes de la app vieja que no son de comun/ajustes (los trae cada módulo o no se usan más). */
const AJUSTES_QUE_NO_SE_COPIAN = new Set(['id', 'tema'])

class CopiaInvalida extends Error {}

/** Lee el texto pegado (o el contenido del archivo). Acepta espacios alrededor. */
function leerTexto(texto) {
  if (typeof texto !== 'string' || !texto.trim()) throw new CopiaInvalida('Pegá el texto de la copia (o elegí el archivo).')
  let o
  try { o = JSON.parse(texto.trim()) } catch { throw new CopiaInvalida('Ese texto no es una copia: no se pudo leer. Fijate de copiarlo entero, desde la primera { hasta la última }.') }
  return separar(o)
}

const esObjeto = (x) => !!x && typeof x === 'object' && !Array.isArray(x)
const lista = (x) => (Array.isArray(x) ? x : [])

/** Recibe el objeto de la copia y devuelve { origen, exportado, ajustes, partes, sinUsar }. */
function separar(o) {
  if (!esObjeto(o)) throw new CopiaInvalida('Ese texto no es una copia de SEK.')
  if (o.app === APP_VIEJA && esObjeto(o.tablas)) {
    if (typeof o.version === 'number' && o.version > VERSION_VIEJA) throw new CopiaInvalida('La copia es de una versión más nueva de la app vieja.')
    return desdeVieja(o)
  }
  if (o.app === APP_NUEVA && esObjeto(o.modulos)) {
    if (typeof o.version === 'number' && o.version > VERSION_NUEVA) throw new CopiaInvalida('La copia es de una versión más nueva de SEK. Actualizá la app.')
    return desdeNueva(o)
  }
  throw new CopiaInvalida('Ese texto no es una copia de SEK.')
}

const exportadoDe = (o) => (Number.isFinite(o.exportado) && o.exportado > 0 ? Math.round(o.exportado) : 0)

/** Ajustes de la app vieja → los de comun/ajustes (los que no existen acá los descarta guardarAjustes). */
function ajustesDeVieja(aj) {
  const r = {}
  for (const [k, v] of Object.entries(aj || {})) if (!AJUSTES_QUE_NO_SE_COPIAN.has(k) && v !== undefined && v !== null) r[k] = v
  // La lluvia: la vieja tenía intensidad y dónde mostrarla; la nueva, un solo valor.
  const lugares = esObjeto(aj && aj.fondoLluvia) ? Object.values(aj.fondoLluvia) : []
  if (lugares.length && lugares.every((x) => x === false)) r.lluvia = 'apagada'
  else if (['llovizna', 'lluvia', 'tormenta'].includes(aj && aj.lluviaIntensidad)) r.lluvia = aj.lluviaIntensidad
  return r
}

function desdeVieja(o) {
  const T = o.tablas
  const L = (k) => lista(T[k])
  const aj = L('ajustes').find((x) => x && x.id === 'unicos') || L('ajustes')[0] || {}
  const tomar = (claves) => Object.fromEntries(claves.map((k) => [k, L(k)]))
  const partes = {
    ciclo: tomar(TABLAS_VIEJAS.ciclo),
    dia: { ...tomar(TABLAS_VIEJAS.dia), horario: esObjeto(aj.horario) ? aj.horario : undefined },
    xp: L('xp'),
    juego: L('sesionesJuego'),
    organizacion: L('organizacion'),
    sueno: tomar(TABLAS_VIEJAS.sueno),
    habitos: { ...tomar(TABLAS_VIEJAS.habitos), ajustes: aj },
    comida: { ...tomar(TABLAS_VIEJAS.comida), ajustes: L('ajustes') },
    entreno: tomar(TABLAS_VIEJAS.entreno),
    desafios: { ...tomar(TABLAS_VIEJAS.desafios), ajustes: aj },
    temas: { tema: typeof aj.tema === 'string' ? aj.tema : undefined },
  }
  const usadas = new Set(['ajustes', ...Object.values(TABLAS_VIEJAS).flat()])
  const sinUsar = Object.entries(T)
    .filter(([k, v]) => !usadas.has(k) && Array.isArray(v) && v.length)
    .map(([k, v]) => ({ tabla: k, filas: v.length, motivo: SIN_LUGAR[k] || 'todavía no tiene módulo en la app nueva' }))
  return { origen: 'vieja', exportado: exportadoDe(o), ajustes: ajustesDeVieja(aj), partes, sinUsar }
}

function desdeNueva(o) {
  const partes = {}
  for (const c of CLAVES) if (o.modulos[c] !== undefined) partes[c] = o.modulos[c]
  const sinUsar = Object.keys(o.modulos).filter((k) => !CLAVES.includes(k))
    .map((k) => ({ tabla: k, filas: cuantas(o.modulos[k]), motivo: 'este módulo no está en esta app' }))
  const ajustes = esObjeto(o.ajustes) ? Object.fromEntries(Object.entries(o.ajustes).filter(([k]) => !AJUSTES_QUE_NO_SE_COPIAN.has(k))) : {}
  return { origen: 'nueva', exportado: exportadoDe(o), ajustes, partes, sinUsar }
}

/** Cuántas filas trae una parte (para mostrar antes de importar). */
function cuantas(parte) {
  // Organización (formato viejo): una fila { id: 'datos', datos }.
  const org = Array.isArray(parte) && parte.find((f) => f && f.id === 'datos' && esObjeto(f.datos) && Array.isArray(f.datos.frentes))
  if (org) return cuantas(org.datos)
  if (Array.isArray(parte)) return parte.filter(Boolean).length
  if (!esObjeto(parte)) return 0
  // Organización (formato nuevo): las tareas de los frentes.
  if (Array.isArray(parte.frentes)) return [...parte.frentes, ...lista(parte.archivados)].reduce((n, f) => n + lista(f && f.tareas).length, 0) + lista(parte.bandeja).length
  let n = 0
  for (const [k, v] of Object.entries(parte)) {
    if (k === 'ajustes') continue
    if (Array.isArray(v)) n += v.filter(Boolean).length
    else if (k === 'identidad' && esObjeto(v)) n += 1
    else if (k === 'tema' && typeof v === 'string') n += 1
  }
  return n
}

/** Lo que devuelve un importar (número u objeto de números) → un solo número. */
function total(resultado) {
  if (Number.isFinite(resultado)) return resultado
  if (esObjeto(resultado)) return Object.values(resultado).reduce((s, v) => s + (Number.isFinite(v) ? v : 0), 0)
  return 0
}

module.exports = { MODULOS, CLAVES, TABLAS_VIEJAS, SIN_LUGAR, APP_NUEVA, VERSION_NUEVA, CopiaInvalida, leerTexto, separar, cuantas, total, ajustesDeVieja }

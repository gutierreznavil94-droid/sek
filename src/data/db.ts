/**
 * Base de datos local (IndexedDB vía Dexie).
 *
 * El índice único `&clave` en `xp` es la garantía física de que un mismo
 * evento nunca suma XP dos veces: la segunda escritura falla.
 */

import Dexie, { type EntityTable } from 'dexie'
import { nombreBaseActual } from './modoPrueba'
import type {
  Caida,
  Accion,
  Ajustes,
  ReglaCodigo,
  FechaClave,
  AlimentoPropio,
  RegistroComida,
  TomaAgua,
  TomaFruta,
  Recomendacion,
  RegistroPeso,
  ComidaGuardada,
  Atributo,
  AtributoDiario,
  Ciclo,
  Compromiso,
  Contador,
  DiaCerrado,
  Evento,
  Excepcion,
  Fase,
  Feriado,
  Identidad,
  Meta,
  ModoSuenio,
  Objetivo,
  RegistroContador,
  Rutina,
  SesionEntreno,
  RegistroNivel,
  RegistroSuenio,
  RegistroXp,
  ReglaXp,
  Revision,
  SesionJuego,
  SiguienteAccion,
  TemporizadorActivo, PeleaNinja, HabitoForja } from './tipos'

export class BaseDatos extends Dexie {
  identidad!: EntityTable<Identidad, 'id'>
  atributos!: EntityTable<Atributo, 'id'>
  ciclos!: EntityTable<Ciclo, 'id'>
  fases!: EntityTable<Fase, 'id'>
  objetivos!: EntityTable<Objetivo, 'id'>
  acciones!: EntityTable<Accion, 'id'>
  reglasXp!: EntityTable<ReglaXp, 'id'>
  metas!: EntityTable<Meta, 'id'>
  ajustes!: EntityTable<Ajustes, 'id'>
  compromisos!: EntityTable<Compromiso, 'id'>
  sesionesJuego!: EntityTable<SesionJuego, 'id'>
  suenio!: EntityTable<RegistroSuenio, 'id'>
  siguienteAccion!: EntityTable<SiguienteAccion, 'id'>
  revisiones!: EntityTable<Revision, 'id'>
  xp!: EntityTable<RegistroXp, 'id'>
  niveles!: EntityTable<RegistroNivel, 'id'>
  atributosDiarios!: EntityTable<AtributoDiario, 'id'>
  diasCerrados!: EntityTable<DiaCerrado, 'fecha'>
  excepciones!: EntityTable<Excepcion, 'fecha'>
  feriados!: EntityTable<Feriado, 'fecha'>
  contadores!: EntityTable<Contador, 'id'>
  registrosContador!: EntityTable<RegistroContador, 'id'>
  rutinas!: EntityTable<Rutina, 'id'>
  sesionesEntreno!: EntityTable<SesionEntreno, 'id'>
  codigo!: EntityTable<ReglaCodigo, 'id'>
  fechasClave!: EntityTable<FechaClave, 'id'>
  alimentosPropios!: EntityTable<AlimentoPropio, 'id'>
  comidas!: EntityTable<RegistroComida, 'id'>
  agua!: EntityTable<TomaAgua, 'id'>
  frutas!: EntityTable<TomaFruta, 'id'>
  caidas!: EntityTable<Caida, 'id'>
  recomendaciones!: EntityTable<Recomendacion, 'id'>
  ninjas!: EntityTable<PeleaNinja, 'id'>
  pesos!: EntityTable<RegistroPeso, 'id'>
  comidasGuardadas!: EntityTable<ComidaGuardada, 'id'>
  eventos!: EntityTable<Evento, 'id'>
  temporizador!: EntityTable<TemporizadorActivo, 'id'>
  modoSuenio!: EntityTable<ModoSuenio, 'id'>
  forja!: EntityTable<HabitoForja, 'id'>

  constructor(nombre = 'sistema-progreso') {
    super(nombre)
    this.version(1).stores({
      identidad: 'id',
      atributos: 'id, orden',
      ciclos: 'id, numero, estado',
      fases: 'id, cicloId, [cicloId+numero]',
      objetivos: 'id, cicloId, atributoId, [cicloId+faseNumero]',
      acciones: 'id, tipo, activa, orden',
      reglasXp: 'id, accionId, validaDesde',
      metas: 'id, fecha, tipo',
      ajustes: 'id',
      compromisos: 'id, fecha, accionId, estado, [accionId+fecha]',
      sesionesJuego: '++id, inicio, fin',
      suenio: '++id, &noche',
      siguienteAccion: '++id, creado',
      revisiones: 'id, tipo, periodo, [tipo+periodo]',
      xp: '++id, &clave, fecha, origen',
      niveles: '++id, nivel',
      atributosDiarios: '++id, fecha, atributoId, [atributoId+fecha]',
      diasCerrados: 'fecha',
      excepciones: 'fecha',
      eventos: '++id, instante, tipo, entidad',
      temporizador: 'id',
    })
    this.version(2).stores({
      feriados: 'fecha',
    })
    this.version(3).stores({
      contadores: 'id, orden',
      registrosContador: '++id, contadorId, fecha, [contadorId+fecha]',
    })
    this.version(4).stores({
      modoSuenio: 'id',
    })
    this.version(5).stores({
      rutinas: 'id, orden',
      sesionesEntreno: '++id, rutinaId, fecha, estado, [rutinaId+fecha]',
    })
    this.version(6).stores({
      codigo: 'id, orden',
    })
    this.version(7).stores({
      fechasClave: 'id, fecha',
    })
    this.version(8).stores({
      alimentosPropios: 'id, codigo',
      comidas: 'id, fecha, alimentoId',
      pesos: 'id, fecha',
      comidasGuardadas: 'id',
    })
    this.version(9).stores({
      agua: 'id, fecha',
    })
    this.version(10).stores({
      recomendaciones: 'id, estado',
    })
    this.version(11).stores({
      ninjas: '++id, fecha',
    })
    // 12 lo usa Organización (otra rama). La fruta solo agrega su tabla.
    this.version(13).stores({
      frutas: 'id, fecha',
    })
    this.version(14).stores({
      caidas: 'id, fecha',
    })
    // Forja de hábitos: solo agrega su tabla.
    this.version(15).stores({
      forja: 'id, estado',
    })
  }

  /** Todas las tablas, para exportar e importar. */
  nombresTablas(): string[] {
    return this.tables.map((t) => t.name)
  }
}

export const TABLAS = [
  'identidad', 'atributos', 'ciclos', 'fases', 'objetivos', 'acciones', 'reglasXp', 'metas', 'ajustes',
  'compromisos', 'sesionesJuego', 'suenio', 'siguienteAccion', 'revisiones', 'xp', 'niveles',
  'atributosDiarios', 'diasCerrados', 'excepciones', 'feriados', 'contadores', 'registrosContador', 'eventos', 'temporizador', 'modoSuenio', 'rutinas', 'sesionesEntreno', 'codigo', 'fechasClave', 'alimentosPropios', 'comidas', 'pesos', 'comidasGuardadas', 'agua', 'recomendaciones', 'ninjas', 'frutas', 'caidas', 'forja',
] as const

let instancia: BaseDatos | null = null

export function db(): BaseDatos {
  if (!instancia) instancia = new BaseDatos(nombreBaseActual())
  return instancia
}

/** Solo para pruebas: usa una base con otro nombre y la deja limpia. */
export async function usarBaseDePruebas(nombre: string): Promise<BaseDatos> {
  if (instancia) {
    instancia.close()
  }
  await Dexie.delete(nombre)
  instancia = new BaseDatos(nombre)
  return instancia
}

/**
 * Forja de hábitos: guardar, marcar el día, XP y forjado. Las reglas están en domain/forja.ts;
 * cómo se ve (la piedra) lo decide el tema.
 */
import { db } from '../data/db'
import type { Ajustes, HabitoForja } from '../data/tipos'
import { estadoForja, FORJA_DEFECTO, limpiarKanji, pedazosCaidos, type ConfigForja, type EstadoForja } from '../domain/forja'
import type { FechaDia } from '../domain/fechas'
import { claveXp } from '../domain/xp'
import { obtenerAjustes, registrarEvento } from './base'
import { ahora, nuevoId } from './reloj'
import { anularXp, concederXp } from './xp'

export function configForja(a: Pick<Ajustes, 'forja'> | null | undefined): ConfigForja {
  const c = { ...FORJA_DEFECTO, ...(a?.forja ?? {}) }
  const dias = Math.max(1, Math.round(c.dias))
  return { dias, validos: Math.max(1, Math.min(dias, Math.round(c.validos))), xpDia: Math.max(0, c.xpDia), xpForjado: Math.max(0, c.xpForjado), maximo: Math.max(1, Math.round(c.maximo)) }
}

export type HabitoConEstado = { habito: HabitoForja; estado: EstadoForja }

const orden = (a: HabitoForja, b: HabitoForja) => a.creado - b.creado

/** Todos los hábitos con su estado de hoy (en forja primero, después los forjados). */
export async function listarForja(hoy: FechaDia): Promise<{ enForja: HabitoConEstado[]; forjados: HabitoConEstado[]; config: ConfigForja }> {
  const config = configForja(await obtenerAjustes())
  const todos = (await db().forja.toArray()).sort(orden)
  const con = (h: HabitoForja): HabitoConEstado => ({ habito: h, estado: estadoForja(h, h.forjadoEn && h.forjadoEn < hoy ? h.forjadoEn : hoy, config) })
  return { enForja: todos.filter((h) => h.estado === 'forja').map(con), forjados: todos.filter((h) => h.estado === 'forjado').map(con), config }
}

export async function crearHabito(nombre: string, kanji: string, hoy: FechaDia): Promise<HabitoForja> {
  const d = db()
  const config = configForja(await obtenerAjustes())
  const n = nombre.trim()
  const k = limpiarKanji(kanji)
  if (!n) throw new Error('Poné un nombre al hábito')
  if (!k) throw new Error('Elegí un kanji')
  const enForja = await d.forja.where('estado').equals('forja').count()
  if (enForja >= config.maximo) throw new Error('Terminá uno antes de empezar otro')
  const h: HabitoForja = { id: nuevoId('forja'), nombre: n, kanji: k, inicio: hoy, cumplidos: [], fallas: 0, estado: 'forja', creado: ahora() }
  await d.forja.add(h)
  await registrarEvento({ tipo: 'crear', entidad: 'forja', entidadId: h.id, despues: h })
  return h
}

export const claveXpForjaDia = (id: string, fecha: FechaDia) => claveXp('forja', [id, fecha])
export const claveXpForjado = (id: string) => claveXp('forja', [id, 'forjado'])

export type ResultadoForja = {
  marcado: boolean
  xp: number
  /** Cayó un pedazo con este toque. */
  pedazo: boolean
  /** Se forjó con este toque. */
  forjado: boolean
  nuevoNivel: number | null
  habito: HabitoForja
  estado: EstadoForja
}

/** Un toque en la piedra: marca hoy; si ya estaba marcado, lo desmarca (y devuelve la XP). */
export async function alternarDiaForja(id: string, hoy: FechaDia): Promise<ResultadoForja> {
  const d = db()
  const config = configForja(await obtenerAjustes())
  const antes = await d.forja.get(id)
  if (!antes) throw new Error('Ese hábito ya no está')
  if (antes.estado === 'abandonado') throw new Error('Ese hábito está abandonado')
  if (antes.estado === 'forjado' && antes.forjadoEn !== hoy) throw new Error('Ya está forjado')
  const previo = estadoForja(antes, hoy, config)
  const marcar = !antes.cumplidos.includes(hoy)
  const cumplidos = marcar ? [...antes.cumplidos, hoy].sort() : antes.cumplidos.filter((f) => f !== hoy)
  const tentativo = { ...antes, cumplidos }
  const estado = estadoForja(tentativo, hoy, config)
  let xp = 0
  let nuevoNivel: number | null = null
  let forjado = false
  let h: HabitoForja = { ...tentativo, fallas: estado.fallas }
  if (marcar) {
    const r = await concederXp({ clave: claveXpForjaDia(id, hoy), cantidad: config.xpDia, origen: 'forja', fecha: hoy, descripcion: `Forja · ${antes.nombre}: día cumplido` })
    xp += r.cantidad
    nuevoNivel = r.nuevoNivel
    if (estado.completo && antes.estado === 'forja') {
      forjado = true
      h = { ...h, estado: 'forjado', forjadoEn: hoy }
      const r2 = await concederXp({ clave: claveXpForjado(id), cantidad: config.xpForjado, origen: 'forja', fecha: hoy, descripcion: `Forja · ${antes.nombre}: hábito forjado` })
      xp += r2.cantidad
      nuevoNivel = r2.nuevoNivel ?? nuevoNivel
    }
  } else {
    await anularXp(claveXpForjaDia(id, hoy), 'Forja: día desmarcado')
    if (antes.estado === 'forjado') {
      await anularXp(claveXpForjado(id), 'Forja: día desmarcado')
      h = { ...h, estado: 'forja', forjadoEn: undefined }
    }
  }
  await d.forja.put(h)
  await registrarEvento({ tipo: 'editar', entidad: 'forja', entidadId: id, antes, despues: h, motivo: marcar ? 'Día cumplido' : 'Día desmarcado' })
  return { marcado: marcar, xp, pedazo: marcar && pedazosCaidos(estado.validos, estado.necesarios) > previo.pedazos, forjado, nuevoNivel, habito: h, estado }
}

/** Abandonar: deja de estar en forja. No resta XP. */
export async function abandonarHabito(id: string, hoy: FechaDia): Promise<void> {
  const d = db()
  const antes = await d.forja.get(id)
  if (!antes) return
  const h: HabitoForja = { ...antes, estado: 'abandonado', abandonadoEn: hoy }
  await d.forja.put(h)
  await registrarEvento({ tipo: 'editar', entidad: 'forja', entidadId: id, antes, despues: h, motivo: 'Abandonado' })
}

export async function editarHabito(id: string, cambios: { nombre?: string; kanji?: string }): Promise<void> {
  const d = db()
  const antes = await d.forja.get(id)
  if (!antes) return
  const h: HabitoForja = { ...antes, ...(cambios.nombre?.trim() ? { nombre: cambios.nombre.trim() } : {}), ...(cambios.kanji && limpiarKanji(cambios.kanji) ? { kanji: limpiarKanji(cambios.kanji) } : {}) }
  await d.forja.put(h)
  await registrarEvento({ tipo: 'editar', entidad: 'forja', entidadId: id, antes, despues: h })
}

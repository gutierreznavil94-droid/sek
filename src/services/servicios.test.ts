import { beforeEach, describe, expect, it } from 'vitest'
import { db, usarBaseDePruebas } from '../data/db'
import { instanteDe } from '../domain/fechas'
import { cambiarXpDeAccion, guardarAccion } from './acciones'
import { guardarAjustes, inicializarSiHaceFalta } from './base'
import { cambiarInicioCiclo, estadoDelCiclo, iniciarCiclo } from './ciclo'
import {
  cerrarDiasPendientes,
  completarCompromiso,
  compromisosDelDia,
  corregirCompromiso,
  deshacerCompromiso,
  generarCompromisosDelDia,
  cumplimientoDelDia,
  deshacerDejoCelu,
  pilaresDelDia,
  pilaresPorDia,
  rachaActual,
  registrarDejoCelu,
  reprogramarCompromiso,
} from './dia'
import { limiteJuegoDelDia, marcarFeriado, quitarFeriado } from './feriados'
import { exportarTodo, importarTodo } from './exportar'
import { registrarInicio } from './inicios'
import { finalizarJuego, iniciarJuego, pausarJuego, reanudarJuego, resumenJuego, sesionActiva } from './juego'
import { fijarAhora, reiniciarReloj, avanzar } from './reloj'
import { guardarRevision } from './revisiones'
import { concederXp, xpAntesDe, xpPorDia, xpTotal } from './xp'
import { crearMeta, estadoDeMeta, metasQueVencen, reabrirMeta, resolverMeta, resumenMetas } from './metas'
import { deshacerUltimoToque, guardarContador, listarContadores, resumenContadores, sumarToque, totalDelDia } from './contadores'

const Z = 'America/Argentina/Cordoba'
const min = 60_000
const hora = 60 * min

let contador = 0

async function preparar(fechaInicio = '2026-11-02', horaInicio = '08:00') {
  await usarBaseDePruebas(`prueba-${++contador}`)
  reiniciarReloj()
  fijarAhora(instanteDe(fechaInicio, horaInicio, Z))
  await inicializarSiHaceFalta()
  // Estas pruebas miden el XP sin «lo no cumplido resta» (tiene sus propias pruebas en restas.test.ts).
  await guardarAjustes({ xpResta: { activa: false } })
  // Estas pruebas usan el calendario anterior (entreno lun, mié y vie) para probar los días de descanso.
  await db().acciones.update('entrenamiento', { dias: [1, 3, 5] })
  await iniciarCiclo(fechaInicio)
  await cerrarDiasPendientes()
}

beforeEach(async () => {
  await preparar()
})

describe('ciclo y día X de 90', () => {
  it('el panel muestra el día correcto y avanza a medianoche', async () => {
    let e = await estadoDelCiclo('2026-11-02')
    expect(e?.dia).toBe(1)
    expect(e?.faseNumero).toBe(1)
    e = await estadoDelCiclo('2026-12-02')
    expect(e?.dia).toBe(31)
    expect(e?.faseNumero).toBe(2)
    e = await estadoDelCiclo('2027-01-30')
    expect(e?.dia).toBe(90)
    expect(e?.terminado).toBe(false)
    e = await estadoDelCiclo('2027-01-31')
    expect(e?.terminado).toBe(true)
  })

  it('crea metas de fin de fase y revisiones semanales', async () => {
    const metas = await db().metas.toArray()
    expect(metas.find((m) => m.tipo === 'fin_fase' && m.fecha === '2026-12-01')).toBeTruthy()
    expect(metas.find((m) => m.tipo === 'fin_ciclo' && m.fecha === '2027-01-30')).toBeTruthy()
    expect(metas.filter((m) => m.tipo === 'revision_semanal').length).toBe(12) // domingos del 8 nov al 24 ene
  })

  it('un nuevo ciclo conserva XP y nivel', async () => {
    await completarCompromiso('acostarse:2026-11-02')
    const antes = await xpTotal()
    expect(antes).toBe(20)
    const c2 = await iniciarCiclo('2027-02-01')
    expect(c2.numero).toBe(2)
    expect(await xpTotal()).toBe(antes)
    expect((await db().ciclos.toArray()).length).toBe(2)
  })
})

describe('cambiar la fecha de inicio', () => {
  it('mueve el Día 1 y las metas sin tocar el XP', async () => {
    await completarCompromiso('acostarse:2026-11-02')
    await cambiarInicioCiclo('2026-11-03')
    expect(await xpTotal()).toBe(20)
    expect((await estadoDelCiclo('2026-11-03'))?.dia).toBe(1)
    expect((await estadoDelCiclo('2026-11-02'))?.noEmpezado).toBe(true)
    const metas = await db().metas.toArray()
    expect(metas.find((m) => m.tipo === 'inicio_ciclo')?.fecha).toBe('2026-11-03')
    expect(metas.filter((m) => m.tipo === 'fin_fase').map((m) => m.fecha).sort()[0]).toBe('2026-12-02')
    expect(metas.filter((m) => m.tipo === 'inicio_ciclo').length).toBe(1)
  })

  it('los días de entrenamiento y la hora por día se reflejan en los compromisos futuros', async () => {
    const e = (await db().acciones.get('entrenamiento'))!
    await guardarAccion({ ...e, dias: [2, 4], hora: '07:00', horasPorDia: { 4: '18:30' } })
    expect(await db().compromisos.get('entrenamiento:2026-11-02')).toBeUndefined() // lunes ya no toca
    fijarAhora(instanteDe('2026-11-05', '08:00', Z)) // jueves
    await cerrarDiasPendientes()
    expect((await db().compromisos.get('entrenamiento:2026-11-03'))?.horaPrevista).toBe('07:00')
    expect((await db().compromisos.get('entrenamiento:2026-11-05'))?.horaPrevista).toBe('18:30')
    expect(await db().compromisos.get('entrenamiento:2026-11-04')).toBeUndefined()
  })
})

describe('XP sin duplicar', () => {
  it('completar dos veces el mismo compromiso da XP una sola vez', async () => {
    const lista = await compromisosDelDia('2026-11-02')
    const entreno = lista.find((c) => c.accionId === 'entrenamiento')!
    expect(entreno.xpPrevisto).toBe(30)
    const r1 = await completarCompromiso(entreno.id, { minutos: 45 })
    expect(r1.xp).toBe(30)
    const r2 = await completarCompromiso(entreno.id, { minutos: 45 })
    expect(r2.xp).toBe(0)
    expect(await xpTotal()).toBe(30)
    expect((await db().xp.toArray()).length).toBe(1)
  })

  it('deshacer anula el XP con historial y volver a completar lo reactiva sin duplicar', async () => {
    await completarCompromiso('entrenamiento:2026-11-02', { minutos: 45 })
    await deshacerCompromiso('entrenamiento:2026-11-02', 'Lo marqué por error')
    expect(await xpTotal()).toBe(0)
    const eventos = await db().eventos.where('tipo').equals('anular_xp').toArray()
    expect(eventos.length).toBe(1)
    await completarCompromiso('entrenamiento:2026-11-02', { minutos: 45 })
    expect(await xpTotal()).toBe(30)
    expect((await db().xp.toArray()).length).toBe(1)
  })

  it('un entrenamiento por debajo del mínimo cuenta como hecho pero no da XP', async () => {
    const r = await completarCompromiso('entrenamiento:2026-11-02', { minutos: 10 })
    expect(r.compromiso.estado).toBe('completado')
    expect(r.xp).toBe(0)
    expect(r.motivoSinXp).toContain('42 minutos')
  })

  it('el mismo inicio con 3-2-1 no cobra dos veces y respeta el tope diario', async () => {
    const a = await registrarInicio({ accionConcreta: 'Abrir el apunte de Álgebra' })
    expect(a.xp).toBe(5)
    const b = await registrarInicio({ accionConcreta: 'abrir el apunte de algebra ' })
    expect(b.xp).toBe(0)
    await registrarInicio({ accionConcreta: 'Tarea 2' })
    await registrarInicio({ accionConcreta: 'Tarea 3' })
    const d = await registrarInicio({ accionConcreta: 'Tarea 4' })
    expect(d.xp).toBe(0)
    expect(d.motivoSinXp).toContain('Tope')
    expect(await xpTotal()).toBe(15)
  })

  it('un compromiso reprogramado no da XP en su fecha original y sí en la nueva', async () => {
    await guardarAccion({ id: 'estudiar', nombre: 'Estudiar 1 h', tipo: 'compromiso', condicion: '1 hora', dias: [0, 1, 2, 3, 4, 5, 6], hora: '10:00', atributoIds: ['disciplina'], objetivoIds: [], peso: 1, activa: true })
    await generarCompromisosDelDia('2026-11-02')
    const nuevo = await reprogramarCompromiso('estudiar:2026-11-02', '2026-11-03')
    expect(nuevo.fecha).toBe('2026-11-03')
    const original = await db().compromisos.get('estudiar:2026-11-02')
    expect(original?.estado).toBe('reprogramado')
    const r = await completarCompromiso(nuevo.id)
    expect(r.xp).toBe(10)
    const regs = await db().xp.toArray()
    expect(regs[0].fecha).toBe('2026-11-03')
  })
})

describe('las reglas solo afectan al futuro', () => {
  it('cambiar el XP del entrenamiento no altera el XP ya ganado', async () => {
    await completarCompromiso('entrenamiento:2026-11-02', { minutos: 45 })
    expect(await xpTotal()).toBe(30)
    await cambiarXpDeAccion('entrenamiento', 50, '2026-11-03')
    expect(await xpTotal()).toBe(30)
    // El día 2 sigue valiendo 30 aunque se complete más tarde.
    fijarAhora(instanteDe('2026-11-04', '09:00', Z))
    await cerrarDiasPendientes()
    const lista = await compromisosDelDia('2026-11-04')
    expect(lista.find((c) => c.accionId === 'entrenamiento')!.xpPrevisto).toBe(50)
    // Al cerrar los días 2 y 3 se concedió el XP de respetar el límite de juego (15 + 15).
    const totalAntes = await xpTotal()
    expect(totalAntes).toBe(60)
    await corregirCompromiso('entrenamiento:2026-11-02', 'completado', 'ya estaba', 45)
    expect(await xpTotal()).toBe(totalAntes)
    const r = await completarCompromiso('entrenamiento:2026-11-04', { minutos: 45 })
    expect(r.xp).toBe(50)
    expect(await xpTotal()).toBe(totalAntes + 50)
    // El registro del día 2 sigue valiendo 30.
    const regDia2 = await db().xp.where('clave').equals('entrenamiento:entrenamiento:2026-11-02').first()
    expect(regDia2?.cantidad).toBe(30)
  })
})

describe('cambio de día a medianoche', () => {
  it('cierra el día anterior, marca lo pendiente y resuelve el límite de juego', async () => {
    await completarCompromiso('entrenamiento:2026-11-02', { minutos: 45 })
    // Nada se cierra antes de la hora de corte del día siguiente.
    fijarAhora(instanteDe('2026-11-03', '01:00', Z))
    expect(await cerrarDiasPendientes()).toEqual([])
    fijarAhora(instanteDe('2026-11-03', '06:30', Z))
    expect(await cerrarDiasPendientes()).toEqual(['2026-11-02'])
    const cerrado = await db().diasCerrados.get('2026-11-02')
    // El cumplimiento se mide sobre los 4 pilares del lunes: solo el entrenamiento se cumplió.
    expect(cerrado?.programados).toBe(4)
    expect(cerrado?.cumplidos).toBe(1)
    expect(cerrado?.porcentaje).toBe(25)
    const limite = await db().compromisos.get('limite_juego:2026-11-02')
    expect(limite?.estado).toBe('completado')
    const rev = await db().compromisos.get('revision_diaria:2026-11-02')
    expect(rev?.estado).toBe('omitido')
    expect(await xpTotal()).toBe(45)
    // Hoy ya tiene sus compromisos.
    expect((await compromisosDelDia('2026-11-03')).length).toBeGreaterThan(0)
  })

  it('el límite de juego superado no da XP', async () => {
    await guardarAjustes({ limiteJuegoSemana: 30, limiteJuegoFinde: 30 })
    fijarAhora(instanteDe('2026-11-02', '20:00', Z))
    await iniciarJuego()
    avanzar(45 * min)
    await finalizarJuego()
    fijarAhora(instanteDe('2026-11-03', '07:00', Z))
    await cerrarDiasPendientes()
    const limite = await db().compromisos.get('limite_juego:2026-11-02')
    expect(limite?.estado).toBe('omitido')
    expect(await xpTotal()).toBe(0)
  })

  it('cierra varios días si la app estuvo cerrada', async () => {
    fijarAhora(instanteDe('2026-11-06', '12:00', Z))
    const cerrados = await cerrarDiasPendientes()
    expect(cerrados).toEqual(['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05'])
    expect(await cerrarDiasPendientes()).toEqual([])
  })

  it('la racha cuenta días seguidos con cumplimiento alto y bonifica cada 7', async () => {
    for (let i = 0; i < 7; i++) {
      const fecha = `2026-11-0${2 + i}`
      fijarAhora(instanteDe(fecha, '10:00', Z))
      await cerrarDiasPendientes()
      for (const c of await compromisosDelDia(fecha)) {
        if (c.accionId !== 'limite_juego') await completarCompromiso(c.id, { minutos: 40 })
      }
    }
    fijarAhora(instanteDe('2026-11-09', '10:00', Z))
    await cerrarDiasPendientes()
    expect(await rachaActual('2026-11-09')).toBe(7)
    const bono = await db().xp.where('origen').equals('racha7').toArray()
    expect(bono.length).toBe(1)
    expect(bono[0].cantidad).toBe(20)
  })
})

describe('«Dejo celu» y la noche que cruza las 00:00', () => {
  it('a las 21:10 cumple y da XP una sola vez', async () => {
    fijarAhora(instanteDe('2026-11-02', '21:10', Z))
    const r = await registrarDejoCelu()
    expect(r.noche).toBe('2026-11-02')
    expect(r.cumplido).toBe(true)
    expect(r.xp).toBe(20)
    expect(r.registro.rutinaRegistrada).toBe(true)
    const r2 = await registrarDejoCelu()
    expect(r2.xp).toBe(0)
    expect(await xpTotal()).toBe(20)
    expect((await db().compromisos.get('acostarse:2026-11-02'))?.estado).toBe('completado')
  })

  it('a las 21:30 queda tarde con 15 min de retraso y sin XP', async () => {
    fijarAhora(instanteDe('2026-11-02', '21:30', Z))
    const r = await registrarDejoCelu()
    expect(r.cumplido).toBe(false)
    expect(r.registro.retrasoMinutos).toBe(15)
    expect(r.xp).toBe(0)
    expect((await db().compromisos.get('acostarse:2026-11-02'))?.estado).toBe('tarde')
  })

  it('a las 22:00 pertenece a la noche con retraso; a las 00:40 ya pasó la ventana (22:15) y no se registra', async () => {
    fijarAhora(instanteDe('2026-11-02', '22:00', Z))
    const r = await registrarDejoCelu()
    expect(r.noche).toBe('2026-11-02')
    expect(r.registro.retrasoMinutos).toBe(45)
    expect(r.cumplido).toBe(false)
    await deshacerDejoCelu('2026-11-02')
    fijarAhora(instanteDe('2026-11-03', '00:40', Z))
    await expect(registrarDejoCelu()).rejects.toThrow('22:15')
  })

  it('la noche no se cierra hasta la hora de corte', async () => {
    fijarAhora(instanteDe('2026-11-03', '00:10', Z))
    await cerrarDiasPendientes()
    expect((await db().compromisos.get('acostarse:2026-11-02'))?.estado).toBe('pendiente')
  })

  it('corregir de tarde a a tiempo reconcede sin duplicar, y deshacer anula', async () => {
    fijarAhora(instanteDe('2026-11-02', '21:30', Z))
    await registrarDejoCelu()
    expect(await xpTotal()).toBe(0)
    fijarAhora(instanteDe('2026-11-02', '21:00', Z))
    await registrarDejoCelu()
    expect(await xpTotal()).toBe(20)
    expect((await db().xp.toArray()).length).toBe(1)
    await deshacerDejoCelu('2026-11-02')
    expect(await xpTotal()).toBe(0)
    expect((await db().compromisos.get('acostarse:2026-11-02'))?.estado).toBe('pendiente')
    expect(await db().suenio.where('noche').equals('2026-11-02').first()).toBeUndefined()
  })

  it('no se puede registrar antes del Día 1', async () => {
    await usarBaseDePruebas('prueba-antes')
    reiniciarReloj()
    fijarAhora(instanteDe('2026-10-27', '21:00', Z))
    await inicializarSiHaceFalta()
    await iniciarCiclo('2026-11-01')
    await expect(registrarDejoCelu()).rejects.toThrow()
  })
})

describe('pilares del día', () => {
  it('el 27 de octubre no hay compromisos ni entrenamiento: solo «Empieza en 5 días»', async () => {
    await usarBaseDePruebas('prueba-pilares-antes')
    reiniciarReloj()
    fijarAhora(instanteDe('2026-10-27', '09:00', Z))
    await inicializarSiHaceFalta()
    await iniciarCiclo('2026-11-01')
    await cerrarDiasPendientes()
    expect((await db().compromisos.toArray()).length).toBe(0)
    const e = await estadoDelCiclo('2026-10-27')
    expect(e?.noEmpezado).toBe(true)
    expect(1 - e!.dia).toBe(5)
    fijarAhora(instanteDe('2026-11-01', '09:00', Z))
    await cerrarDiasPendientes()
    expect((await db().compromisos.where('fecha').equals('2026-11-01').toArray()).length).toBeGreaterThan(0)
    expect((await db().compromisos.where('fecha').below('2026-11-01').toArray()).length).toBe(0)
  })

  it('muestra los 4 pilares; el entrenamiento es «descanso» en días sin entreno', async () => {
    // 2026-11-02 es lunes: toca entrenamiento.
    const lunes = await pilaresDelDia('2026-11-02')
    expect(lunes.pilares.map((p) => p.accion.id)).toEqual(['entrenamiento', 'empresa', 'manga', 'acostarse'])
    expect(lunes.aplican).toBe(4)
    fijarAhora(instanteDe('2026-11-03', '09:00', Z))
    await cerrarDiasPendientes()
    const martes = await pilaresDelDia('2026-11-03')
    expect(martes.pilares.find((p) => p.accion.id === 'entrenamiento')?.estado).toBe('descanso')
    expect(martes.aplican).toBe(3)
  })

  it('manga sin marcar a las 20:51 sigue en margen; a las 21:01 queda vencido; al cerrar el día, omitido', async () => {
    fijarAhora(instanteDe('2026-11-02', '20:51', Z))
    let r = await pilaresDelDia('2026-11-02')
    expect(r.pilares.find((p) => p.accion.id === 'manga')!.vencido).toBe(false)
    fijarAhora(instanteDe('2026-11-02', '21:01', Z))
    r = await pilaresDelDia('2026-11-02')
    const manga = r.pilares.find((p) => p.accion.id === 'manga')!
    expect(manga.estado).toBe('pendiente')
    expect(manga.vencido).toBe(true)
    fijarAhora(instanteDe('2026-11-03', '07:00', Z))
    await cerrarDiasPendientes()
    expect((await db().compromisos.get('manga:2026-11-02'))?.estado).toBe('omitido')
  })

  it('marcar manga después de las 21:00 (20:50 + margen) queda tarde y sin XP; antes, da XP', async () => {
    fijarAhora(instanteDe('2026-11-02', '21:01', Z))
    const tarde = await completarCompromiso('manga:2026-11-02', { minutos: 20 })
    expect(tarde.compromiso.estado).toBe('tarde')
    expect(tarde.xp).toBe(0)
    fijarAhora(instanteDe('2026-11-02', '18:00', Z))
    await deshacerCompromiso('manga:2026-11-02')
    const ok = await completarCompromiso('manga:2026-11-02', { minutos: 20 })
    expect(ok.compromiso.estado).toBe('completado')
    expect(ok.xp).toBe(15)
    const emp = await completarCompromiso('empresa:2026-11-02', { respuesta: 'Cerré el presupuesto' })
    expect(emp.xp).toBe(15)
    expect(emp.compromiso.respuesta).toBe('Cerré el presupuesto')
  })

  it('el cumplimiento del día se calcula sobre los pilares que aplican', async () => {
    fijarAhora(instanteDe('2026-11-03', '09:00', Z)) // martes: 3 pilares
    await cerrarDiasPendientes()
    await completarCompromiso('manga:2026-11-03', { minutos: 20 })
    await completarCompromiso('empresa:2026-11-03')
    await completarCompromiso('revision_diaria:2026-11-03')
    const c = await cumplimientoDelDia('2026-11-03', '2026-11-03')
    expect(c.programados).toBe(2) // acostarse sigue pendiente y no cuenta todavía hoy
    expect(c.cumplidos).toBe(2)
    fijarAhora(instanteDe('2026-11-03', '21:00', Z))
    await registrarDejoCelu()
    const c2 = await cumplimientoDelDia('2026-11-03', '2026-11-03')
    expect(c2).toEqual({ cumplidos: 3, programados: 3, porcentaje: 100 })
  })
})

describe('límite de juego por tipo de día', () => {
  it('martes 60, sábado 120, feriado 120, y los feriados se pueden marcar', async () => {
    expect(await limiteJuegoDelDia('2026-11-03')).toBe(60)
    expect(await limiteJuegoDelDia('2026-11-07')).toBe(120)
    expect(await limiteJuegoDelDia('2026-12-08')).toBe(120) // feriado precargado
    expect(await limiteJuegoDelDia('2026-11-23')).toBe(120) // Soberanía (trasladado)
    await marcarFeriado('2026-11-04', 'Puente')
    expect(await limiteJuegoDelDia('2026-11-04')).toBe(120)
    await quitarFeriado('2026-11-04')
    expect(await limiteJuegoDelDia('2026-11-04')).toBe(60)
  })

  it('al cerrar el día usa el límite de ese día; la semana suma los límites', async () => {
    fijarAhora(instanteDe('2026-11-03', '20:00', Z)) // martes
    await cerrarDiasPendientes()
    await iniciarJuego()
    avanzar(90 * min)
    await finalizarJuego()
    const r = await resumenJuego('2026-11-03')
    expect(r.limiteMinutos).toBe(60)
    expect(r.estado).toBe('superado')
    expect(r.limiteSemana).toBe(5 * 60 + 2 * 120)
    fijarAhora(instanteDe('2026-11-04', '07:00', Z))
    await cerrarDiasPendientes()
    expect((await db().compromisos.get('limite_juego:2026-11-03'))?.estado).toBe('omitido')
  })
})

describe('barra de fases', () => {
  it('avanza con los días y no con el nivel', async () => {
    const antes = await estadoDelCiclo('2026-11-13')
    expect(antes?.dia).toBe(12)
    expect(antes?.faseNumero).toBe(1)
    for (let i = 0; i < 20; i++) await concederXp({ clave: `prueba:${i}`, cantidad: 100, origen: 'manual', fecha: '2026-11-02', descripcion: 'prueba' })
    const despues = await estadoDelCiclo('2026-11-13')
    expect(despues?.dia).toBe(12)
    expect(despues?.faseNumero).toBe(1)
    expect((await estadoDelCiclo('2027-01-01'))?.faseNumero).toBe(3)
  })
})

describe('temporizador de juego', () => {
  it('sobrevive a "cerrar la app": la sesión activa está en la base', async () => {
    fijarAhora(instanteDe('2026-11-02', '20:00', Z))
    await iniciarJuego()
    avanzar(20 * min)
    await pausarJuego()
    avanzar(10 * min)
    await reanudarJuego()
    avanzar(15 * min)
    // "Reabrir": se consulta la base de nuevo.
    const s = await sesionActiva()
    expect(s).toBeTruthy()
    const r = await resumenJuego('2026-11-02')
    expect(Math.round(r.minutosSesion)).toBe(35)
    expect(r.minutosHoy).toBe(35)
    await finalizarJuego()
    expect(await sesionActiva()).toBeUndefined()
    const r2 = await resumenJuego('2026-11-02')
    expect(r2.minutosHoy).toBe(35)
  })

  it('avisa al acercarse y al superar el límite', async () => {
    await guardarAjustes({ limiteJuegoSemana: 60, limiteJuegoFinde: 60 })
    fijarAhora(instanteDe('2026-11-02', '20:00', Z))
    await iniciarJuego()
    avanzar(50 * min)
    expect((await resumenJuego('2026-11-02')).estado).toBe('cerca')
    avanzar(15 * min)
    expect((await resumenJuego('2026-11-02')).estado).toBe('superado')
  })

  it('una sesión que cruza la medianoche se reparte entre los dos días', async () => {
    fijarAhora(instanteDe('2026-11-02', '23:30', Z))
    await iniciarJuego()
    avanzar(hora)
    await finalizarJuego()
    const r = await resumenJuego('2026-11-03')
    expect(Math.round(r.porDia.get('2026-11-02') ?? 0)).toBe(30)
    expect(r.minutosHoy).toBe(30)
  })
})

describe('revisiones', () => {
  it('la revisión diaria da XP solo la primera vez', async () => {
    const r1 = await guardarRevision('diaria', '2026-11-02', { obstaculo: 'Celular', ajuste: 'Dejarlo en otra pieza' }, {})
    expect(r1.xp).toBe(10)
    const r2 = await guardarRevision('diaria', '2026-11-02', { obstaculo: 'Celular', ajuste: 'Otro' }, {})
    expect(r2.xp).toBe(0)
    expect(await xpTotal()).toBe(10)
  })
})

describe('exportar e importar', () => {
  it('una copia exportada se puede importar en una base vacía y conserva el XP', async () => {
    await completarCompromiso('entrenamiento:2026-11-02', { minutos: 45 })
    const copia = await exportarTodo()
    expect(copia.tablas.xp.length).toBe(1)
    await usarBaseDePruebas('prueba-importar')
    expect(await xpTotal()).toBe(0)
    const r = await importarTodo(JSON.parse(JSON.stringify(copia)))
    expect(r.filas).toBeGreaterThan(10)
    expect(await xpTotal()).toBe(30)
    expect((await estadoDelCiclo('2026-11-02'))?.dia).toBe(1)
  })

  it('rechaza un archivo que no es una copia', async () => {
    await expect(importarTodo({ hola: 1 } as never)).rejects.toThrow()
  })
})

describe('racha con 3 de 4 pilares (75 %)', () => {
  async function diaConPilares(fecha: string, cumplir: string[]) {
    fijarAhora(instanteDe(fecha, '10:00', Z))
    await cerrarDiasPendientes()
    for (const id of cumplir) await completarCompromiso(`${id}:${fecha}`, { minutos: 40 })
  }

  it('el umbral inicial es 75 y 3 de 4 pilares mantienen la racha', async () => {
    expect((await db().ajustes.get('unicos'))?.umbralRacha).toBe(75)
    await diaConPilares('2026-11-02', ['entrenamiento', 'manga', 'empresa']) // lunes: 4 pilares, 3 cumplidos
    await diaConPilares('2026-11-03', ['manga', 'empresa', 'acostarse']) // martes: 3 de 3
    await diaConPilares('2026-11-04', ['entrenamiento', 'manga', 'acostarse']) // miércoles: 3 de 4
    fijarAhora(instanteDe('2026-11-05', '10:00', Z))
    await cerrarDiasPendientes()
    expect(await rachaActual('2026-11-05')).toBe(3)
  })

  it('un día sin entrenamiento con 2 de 3 corta la racha, aunque haya otros compromisos cumplidos', async () => {
    await diaConPilares('2026-11-02', ['entrenamiento', 'manga', 'empresa', 'acostarse'])
    // martes: 2 de 3 pilares + revisión diaria (no cuenta para la racha)
    fijarAhora(instanteDe('2026-11-03', '10:00', Z))
    await cerrarDiasPendientes()
    await completarCompromiso('manga:2026-11-03', { minutos: 20 })
    await completarCompromiso('empresa:2026-11-03')
    await completarCompromiso('revision_diaria:2026-11-03')
    fijarAhora(instanteDe('2026-11-04', '10:00', Z))
    await cerrarDiasPendientes()
    expect(await rachaActual('2026-11-04')).toBe(0)
  })
})

describe('datos para calendario y gráfico', () => {
  it('un día con 2 pilares cumplidos y 2 fallados da 2 verdes y 2 rojos, y el futuro queda vacío', async () => {
    fijarAhora(instanteDe('2026-11-02', '10:00', Z))
    await completarCompromiso('entrenamiento:2026-11-02', { minutos: 40 })
    await completarCompromiso('manga:2026-11-02', { minutos: 20 })
    fijarAhora(instanteDe('2026-11-03', '10:00', Z))
    await cerrarDiasPendientes()
    const mapa = await pilaresPorDia('2026-11-01', '2026-11-04', '2026-11-03')
    expect(mapa.get('2026-11-02')!.map((p) => p.estado)).toEqual(['cumplido', 'omitido', 'cumplido', 'omitido'])
    expect(mapa.get('2026-11-03')!.map((p) => p.estado)).toEqual(['descanso', 'pendiente', 'pendiente', 'pendiente'])
    expect(mapa.get('2026-11-04')!.map((p) => p.estado)).toEqual(['pendiente', 'pendiente', 'pendiente', 'pendiente'])
    expect(mapa.get('2026-11-01')!.every((p) => p.estado === 'pendiente' || p.estado === 'descanso')).toBe(true)
  })

  it('el XP por día coincide con el total', async () => {
    fijarAhora(instanteDe('2026-11-02', '10:00', Z))
    await completarCompromiso('entrenamiento:2026-11-02', { minutos: 40 })
    fijarAhora(instanteDe('2026-11-03', '10:00', Z))
    await cerrarDiasPendientes()
    await completarCompromiso('manga:2026-11-03', { minutos: 20 })
    const porDia = await xpPorDia('2026-11-02', '2026-11-03')
    const suma = [...porDia.values()].reduce((a, b) => a + b, 0)
    expect(suma + (await xpAntesDe('2026-11-02'))).toBe(await xpTotal())
    expect(porDia.get('2026-11-03')).toBe(15)
  })
})

describe('metas con fecha', () => {
  it('«Lo logré» la pone cumplida y da su XP una sola vez; «No llegué» la pone roja y anula', async () => {
    const m = await crearMeta({ titulo: 'Terminar el capítulo 1', fecha: '2026-11-05' })
    expect(estadoDeMeta(m)).toBe('pendiente')
    expect((await metasQueVencen('2026-11-04')).length).toBe(0)
    expect((await metasQueVencen('2026-11-05')).map((x) => x.id)).toEqual([m.id])
    const antes = await xpTotal()
    const r1 = await resolverMeta(m.id, true)
    expect(r1.xp).toBe(15)
    const r2 = await resolverMeta(m.id, true)
    expect(r2.xp).toBe(0)
    expect(await xpTotal()).toBe(antes + 15)
    await resolverMeta(m.id, false)
    expect(await xpTotal()).toBe(antes)
    const res = await resumenMetas('2026-11-06')
    expect(res.noCumplidas.map((x) => x.id)).toEqual([m.id])
    await reabrirMeta(m.id)
    expect((await resumenMetas('2026-11-06')).vencidas.map((x) => x.id)).toEqual([m.id])
  })
})

describe('contadores de series rápidas', () => {
  it('cinco toques de +14 llegan a 70 y dan 10 XP una sola vez; el sexto no suma XP; deshacer baja y anula', async () => {
    const antes = await xpTotal()
    let r
    for (let i = 0; i < 5; i++) r = await sumarToque('flexiones')
    expect(r!.total).toBe(70)
    expect(r!.metaLograda).toBe(true)
    expect(await xpTotal()).toBe(antes + 10)
    r = await sumarToque('flexiones')
    expect(r.total).toBe(84)
    expect(r.xp).toBe(0)
    expect(await xpTotal()).toBe(antes + 10)
    await deshacerUltimoToque('flexiones')
    expect(await totalDelDia('flexiones', '2026-11-02')).toBe(70)
    expect(await xpTotal()).toBe(antes + 10)
    await deshacerUltimoToque('flexiones')
    expect(await totalDelDia('flexiones', '2026-11-02')).toBe(56)
    expect(await xpTotal()).toBe(antes)
    const res = await resumenContadores('2026-11-02')
    const flex = res.find((x) => x.contador.id === 'flexiones')!
    expect(flex.hoy).toBe(56)
    expect(flex.toquesHoy).toBe(4)
    expect(flex.record?.total).toBe(56)
  })

  it('no se registra antes del Día 1 y la cantidad por toque se puede subir', async () => {
    fijarAhora(instanteDe('2026-11-01', '10:00', Z))
    await expect(sumarToque('dominadas')).rejects.toThrow()
    fijarAhora(instanteDe('2026-11-02', '10:00', Z))
    const c = (await listarContadores()).find((x) => x.id === 'dominadas')!
    await guardarContador({ ...c, cantidadPorToque: 8 })
    const r = await sumarToque('dominadas')
    expect(r.total).toBe(8)
  })

  it('el entrenamiento se marca en un toque con su duración fija y da XP', async () => {
    const acc = await db().acciones.get('entrenamiento')
    expect(acc?.duracionMinutos).toBe(42)
    const r = await completarCompromiso('entrenamiento:2026-11-02', { minutos: acc!.duracionMinutos })
    expect(r.xp).toBe(30)
    expect(r.compromiso.minutos).toBe(42)
  })
})

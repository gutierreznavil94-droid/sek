'use strict'
const { test, before, beforeEach, after } = require('node:test')
const assert = require('node:assert/strict')
const { prepararBase, personaDePrueba, terminar } = require('../../comun/prueba')
const reloj = require('../../comun/reloj')
const eventos = require('../../comun/eventos')
const entreno = require('./ventanilla')
const calculo = require('./calculo')
const xp = require('../xp/ventanilla')
const { crearApp } = require('../../app')

const MIN = 60000
const DIA = 24 * 60 * MIN
before(prepararBase)
after(terminar)
// Cada prueba arranca el lunes 23 nov 2026, 10:00 en Córdoba.
beforeEach(() => reloj.fijar(Date.UTC(2026, 10, 23, 13, 0, 0)))

const conGimnasio = async (nombre) => {
  const id = await personaDePrueba(nombre)
  await entreno.aplicarEleccion(id, { modo: 'plan', planId: 'plan-gimnasio' })
  return id
}

/** Hace todas las series de un ejercicio con las reps dadas (y saltea el descanso). */
async function series(u, sid, bloqueId, reps, peso) {
  let s
  for (const r of reps) {
    s = await entreno.registrarSerie(u, sid, bloqueId, { reps: r, peso })
    reloj.avanzar(2 * MIN)
    s = await entreno.terminarDescanso(u, sid)
  }
  return s
}

// ---------- Cuentas puras ----------

test('cálculo: descanso con 3·2·1 y sombra; la última serie es para acomodar', () => {
  const b = { series: 2, descanso: 90, sombra: 30 }
  assert.deepEqual(calculo.fasesDescanso(b, 1).map((f) => [f.tipo, f.segundos]), [['preparar', 3], ['sombra', 30], ['descanso', 57]])
  assert.deepEqual(calculo.fasesDescanso(b, 2, 'Press inclinado').map((f) => f.tipo), ['acomodar'])
  assert.deepEqual(calculo.fasesDescanso(b, 2), [])
  const d = { inicio: 0, fases: calculo.fasesDescanso(b, 1) }
  assert.equal(calculo.faseActual(d, 10000).fase.tipo, 'sombra')
  assert.equal(calculo.faseActual(d, 91000), null)
})

test('cálculo: objetivo de la serie y sugerencia de subir peso', () => {
  const b = { reps: 8, repsTope: 12, peso: 50 }
  const ultima = [{ n: 1, reps: 8, peso: 50 }, { n: 2, reps: 6, peso: 50 }]
  assert.equal(calculo.objetivoSerie(b, ultima, 1, 50), 9)
  assert.equal(calculo.objetivoSerie(b, ultima, 2, 50), 6)
  assert.equal(calculo.objetivoSerie(b, ultima, 1, 55), 8) // peso nuevo: arranca en las actuales
  assert.equal(calculo.sugerencia({ ...b, reps: 12 }, ultima).subirPeso, true)
  assert.equal(calculo.kg(12.5), '12,5 kg')
})

test('cálculo: cuota, extra y su historial por fecha', () => {
  const c = { cantidadPorToque: 15, metaDiaria: 75, historialCuota: [{ desde: '0000-01-01', cuota: 70, extra: 105, porToque: 14 }, { desde: '2026-11-20', cuota: 75, extra: 113, porToque: 15 }] }
  assert.deepEqual(calculo.cuotaDelDia(c, '2026-11-19'), { cuota: 70, extra: 105 })
  assert.deepEqual(calculo.cuotaDelDia(c, '2026-11-23'), { cuota: 75, extra: 113 })
  assert.equal(calculo.repsDelDia(c, '2026-11-19'), 14)
  assert.equal(calculo.extraPorDefecto(35), 53)
  assert.deepEqual(calculo.cuotaDeSeries(8, 5), { cuota: 40, extra: 60 })
})

// ---------- Rutinas ----------

test('elegir cómo empezar: plan, sumar sin repetir y reemplazar', async () => {
  const id = await conGimnasio()
  assert.equal((await entreno.listarRutinas(id)).length, 3)
  assert.deepEqual(await entreno.diasDeRutinas(id), [1, 2, 3, 4, 5, 6])
  assert.equal((await entreno.rutinaDelDia(id, '2026-11-23')).id, 'rutina-a') // lunes
  assert.equal(await entreno.rutinaDelDia(id, '2026-11-22'), null) // domingo libre
  const otra = await entreno.aplicarEleccion(id, { modo: 'plan', planId: 'plan-gimnasio' })
  assert.equal(otra.cargadas, 0)
  const poco = await entreno.aplicarEleccion(id, { modo: 'poco' }, { reemplazar: true, diasPilar: [2, 4] })
  assert.deepEqual(poco, { cargadas: 1, borradas: 3 })
  const [r] = await entreno.listarRutinas(id)
  assert.deepEqual(r.dias, [2, 4])
  await assert.rejects(entreno.aplicarEleccion(id, { modo: 'plan', planId: 'no-existe' }), /no existe/)
})

test('guardar rutina: valida, y cambiar el peso a mano empieza un tramo nuevo', async () => {
  const id = await conGimnasio()
  const a = await entreno.obtenerRutina(id, 'rutina-a')
  await assert.rejects(entreno.guardarRutina(id, { ...a, nombre: ' ' }), /nombre/)
  const mal = a.bloques.map((b) => (b.id === 'a-press-banca' ? { ...b, repsTope: 2 } : b))
  await assert.rejects(entreno.guardarRutina(id, { ...a, bloques: mal }), /tope/)
  const bloques = a.bloques.map((b) => (b.id === 'a-press-banca' ? { ...b, peso: 55 } : b))
  const g = await entreno.guardarRutina(id, { ...a, bloques })
  const banca = g.bloques.find((b) => b.id === 'a-press-banca')
  assert.equal(banca.peso, 55)
  assert.equal(banca.tramoDesde, '2026-11-23')
})

test('enlazados: el mismo ejercicio en dos rutinas se copia al guardar; «¿Es el mismo?»', async () => {
  const id = await conGimnasio()
  const n = await entreno.sumarBloqueARutinas(id, 'rutina-a', 'a-vuelos', ['rutina-b', 'rutina-c'])
  assert.equal(n, 2)
  const b = await entreno.obtenerRutina(id, 'rutina-b')
  // va antes del kick boxing, como en la rutina A
  assert.equal(b.bloques[b.bloques.findIndex((x) => x.tipo === 'rondas') - 1].id, 'a-vuelos')
  const a = await entreno.obtenerRutina(id, 'rutina-a')
  await entreno.guardarRutina(id, { ...a, bloques: a.bloques.map((x) => (x.id === 'a-vuelos' ? { ...x, descanso: 75 } : x)) })
  assert.equal((await entreno.obtenerRutina(id, 'rutina-c')).bloques.find((x) => x.id === 'a-vuelos').descanso, 75)
  assert.equal((await entreno.rutinasConBloque(id, 'a-vuelos')).length, 3)

  // Un ejercicio nuevo con el mismo nombre que otro de otra rutina → pregunta.
  const c = await entreno.obtenerRutina(id, 'rutina-c')
  const nuevo = { id: 'c-remo-2', tipo: 'ejercicio', nombre: 'remo con  mancuerna', series: 2, reps: 10, repsTope: 12, peso: 5, descanso: 90, sombra: 30 }
  await entreno.guardarRutina(id, { ...c, bloques: [...c.bloques, nuevo] })
  const m = await entreno.mismoNombreEnOtraRutina(id, 'rutina-c', nuevo)
  assert.equal(m.bloque.id, 'b-remo')
  const enlazada = await entreno.responderEsElMismo(id, 'rutina-c', 'c-remo-2', 'b-remo', true)
  assert.ok(enlazada.bloques.some((x) => x.id === 'b-remo'))
  assert.ok(!enlazada.bloques.some((x) => x.id === 'c-remo-2'))
})

test('borrar una rutina con entrenos la guarda para el historial', async () => {
  const id = await conGimnasio()
  const s = await entreno.iniciarEntreno(id, 'rutina-a')
  await entreno.descartarEntreno(id, s.id)
  assert.equal(await entreno.borrarRutina(id, 'rutina-c'), 'eliminada')
  const s2 = await entreno.iniciarEntreno(id, 'rutina-b')
  await entreno.terminarEntreno(id, s2.id)
  assert.equal(await entreno.borrarRutina(id, 'rutina-b'), 'guardada para el historial')
  assert.equal((await entreno.listarRutinas(id, { inactivas: true })).length, 1)
  assert.equal((await entreno.listarRutinas(id, { inactivas: true, borradas: true })).length, 2)
})

// ---------- Entreno ----------

test('entreno: series, descanso, récord con XP extra, reps actuales y avisos', async () => {
  const id = await conGimnasio()
  const avisos = []
  eventos.escuchar('entreno.terminado', async (d) => { if (d.usuarioId === id) avisos.push(d) })

  // Primera vez: fija la base, sin récord.
  let s = await entreno.iniciarEntreno(id, 'rutina-a')
  assert.equal((await entreno.iniciarEntreno(id, 'rutina-b')).id, s.id) // ya hay uno en curso
  s = await entreno.registrarSerie(id, s.id, 'a-press-banca', { reps: 8 })
  assert.deepEqual(s.descanso.fases.map((f) => f.tipo), ['preparar', 'sombra', 'descanso'])
  reloj.avanzar(90 * 1000)
  s = await entreno.registrarSerie(id, s.id, 'a-press-banca', { reps: 7 })
  assert.equal(s.descanso.fases[0].tipo, 'acomodar')
  assert.equal(s.series[1].segundos, 0) // el descanso recién terminaba
  let r = await entreno.terminarEntreno(id, s.id)
  assert.equal(r.xpExtra, 0)
  assert.equal(avisos.length, 1)
  assert.equal(avisos[0].fecha, '2026-11-23')

  // Jueves: supera las 8 con el mismo peso → récord (+5) y las actuales pasan a 10.
  reloj.avanzar(3 * DIA)
  const xpAntes = await xp.total(id)
  s = await entreno.iniciarEntreno(id, 'rutina-a')
  const vista = await entreno.vistaEntreno(id, s.id)
  const banca = vista.bloques.find((b) => b.id === 'a-press-banca')
  assert.equal(banca.objetivo, 9)
  assert.equal(banca.pesoHoy, 53)
  await series(id, s.id, 'a-press-banca', [10, 7])
  // y en press inclinado sube el peso (+10, pero primera vez = sin comparación)
  r = await entreno.terminarEntreno(id, s.id)
  assert.equal(r.resumen.ejercicios[0].record, true)
  assert.equal(r.xpExtra, 5)
  assert.equal(await xp.total(id), xpAntes + 5)
  assert.equal((await entreno.obtenerRutina(id, 'rutina-a')).bloques.find((b) => b.id === 'a-press-banca').reps, 10)

  // Reabrir quita el XP extra y la rutina vuelve a 8. Volver a terminar no lo suma dos veces.
  await entreno.reabrirEntreno(id, s.id)
  assert.equal(await xp.total(id), xpAntes)
  assert.equal((await entreno.obtenerRutina(id, 'rutina-a')).bloques.find((b) => b.id === 'a-press-banca').reps, 8)
  r = await entreno.terminarEntreno(id, s.id)
  r = await entreno.terminarEntreno(id, s.id)
  assert.equal(await xp.total(id), xpAntes + 5)

  const prog = await entreno.progresionEjercicio(id, 'a-press-banca')
  assert.equal(prog.puntos.length, 2)
  assert.equal(prog.puntos[1].record, true)
  assert.equal(prog.tramos.length, 1)
})

test('entreno: subir el peso da +10 y empieza un tramo nuevo; tope de 20 XP', async () => {
  const id = await conGimnasio()
  let s = await entreno.iniciarEntreno(id, 'rutina-a')
  await series(id, s.id, 'a-press-banca', [8, 7])
  await entreno.terminarEntreno(id, s.id)
  reloj.avanzar(3 * DIA)
  s = await entreno.iniciarEntreno(id, 'rutina-a')
  await entreno.fijarPeso(id, s.id, 'a-press-banca', 55)
  await series(id, s.id, 'a-press-banca', [6, 6])
  const r = await entreno.terminarEntreno(id, s.id)
  assert.equal(r.resumen.ejercicios[0].subioPeso, true)
  assert.equal(r.xpExtra, 10)
  const banca = (await entreno.obtenerRutina(id, 'rutina-a')).bloques.find((b) => b.id === 'a-press-banca')
  assert.deepEqual([banca.peso, banca.reps, banca.tramoDesde], [55, 6, '2026-11-26'])
  assert.equal((await entreno.progresionEjercicio(id, 'a-press-banca')).tramos.length, 2)
})

test('entreno: cronómetro de colgarse sube el objetivo 1 s en todas las rutinas', async () => {
  const id = await conGimnasio()
  let s = await entreno.iniciarEntreno(id, 'rutina-a')
  s = await entreno.iniciarReloj(id, s.id, 'a-colgarse')
  reloj.avanzar((5 + 80 + 3) * 1000) // 5 de preparación, 80 colgado, 3 de descuento
  const r = await entreno.terminarCronometro(id, s.id, 'a-colgarse', 15)
  assert.equal(r.tiempo.segundos, 80)
  assert.equal(r.subio, true)
  assert.equal(r.objetivo, 71)
  assert.equal(r.sesion.descanso.fases[0].segundos, 60)
  assert.equal((await entreno.obtenerRutina(id, 'rutina-c')).bloques.find((b) => b.id === 'c-colgarse').segundos, 71)
  await entreno.terminarEntreno(id, s.id)
  assert.equal((await entreno.historialTiempo(id, 'Colgarse en barra')).record.segundos, 80)
})

test('entreno: saltar, ir a un bloque, mover, deshacer, reiniciar y descartar', async () => {
  const id = await conGimnasio()
  let s = await entreno.iniciarEntreno(id, 'rutina-b')
  let avisoDeshecho = null
  eventos.escuchar('entreno.deshecho', async (d) => { if (d.usuarioId === id) avisoDeshecho = d })
  s = await entreno.saltarBloque(id, s.id, 'b-calentar')
  assert.equal(s.orden[s.paso], 'b-dominadas')
  s = await entreno.moverBloque(id, s.id, 'b-remo', -1)
  assert.equal(s.orden[1], 'b-remo')
  s = await entreno.irABloque(id, s.id, 'b-calentar')
  assert.equal(s.paso, 0)
  assert.equal(s.saltados.length, 0)
  s = await entreno.marcarBloque(id, s.id, 'b-calentar')
  s = await entreno.registrarSerie(id, s.id, 'b-dominadas', { reps: 11 })
  s = await entreno.deshacerSerie(id, s.id)
  assert.equal(s.series.length, 0)
  s = await entreno.registrarSerie(id, s.id, 'b-dominadas', { reps: 11 })
  s = await entreno.reiniciarEntreno(id, s.id)
  assert.equal(s.series.length, 0)
  assert.equal(s.hechos.length, 0)
  assert.equal(avisoDeshecho.quedaIniciado, true)
  await entreno.descartarEntreno(id, s.id)
  assert.equal(await entreno.sesionEnCurso(id), null)
  assert.equal(avisoDeshecho.quedaIniciado, false)
})

test('entreno en un día sin rutina: queda en el historial sin XP extra', async () => {
  const id = await conGimnasio()
  let s = await entreno.iniciarEntreno(id, 'rutina-a', '2026-11-22') // domingo
  await series(id, s.id, 'a-press-banca', [8, 7])
  await entreno.terminarEntreno(id, s.id)
  s = await entreno.iniciarEntreno(id, 'rutina-a', '2026-11-29')
  await series(id, s.id, 'a-press-banca', [11, 7])
  const r = await entreno.terminarEntreno(id, s.id)
  assert.equal(r.xpExtra, 0)
  assert.match(r.motivoSinXp, /no es día de entreno/)
})

// ---------- Series rápidas ----------

test('series rápidas: se siembran, la cuota y el extra dan XP una vez y deshacer lo saca', async () => {
  const id = await personaDePrueba()
  await entreno.sembrar(id)
  const lista = await entreno.listarContadores(id)
  assert.deepEqual(lista.map((c) => c.id), ['flexiones', 'dominadas'])
  assert.deepEqual((await entreno.faltantesDelDia(id, '2026-11-23')).map((f) => f.id), ['serie-flexiones', 'serie-dominadas'])
  for (let i = 0; i < 4; i++) await entreno.sumarToque(id, 'flexiones')
  let r = await entreno.sumarToque(id, 'flexiones')
  assert.equal(r.total, 70)
  assert.equal(r.metaLograda, true)
  assert.equal(r.xp, 10)
  assert.equal(await xp.total(id), 10)
  r = await entreno.sumarToque(id, 'flexiones', 35)
  assert.equal(r.extraLogrado, true)
  assert.equal(await xp.total(id), 15)
  assert.equal(await entreno.repsDe(id, 'flexiones'), 105)
  await entreno.deshacerUltimoToque(id, 'flexiones')
  await entreno.deshacerUltimoToque(id, 'flexiones')
  assert.equal(await xp.total(id), 0)
  assert.equal(await entreno.totalDelDia(id, 'flexiones', '2026-11-23'), 56)
  await assert.rejects(entreno.sumarToque(id, 'flexiones', -3), /mayor que 0/)
})

test('series rápidas: cambiar la cuota vale desde hoy y propone subir tras 3 días cumplidos', async () => {
  const id = await personaDePrueba()
  const c = await entreno.guardarContador(id, { nombre: 'Sentadillas', cantidadPorToque: 10, seriesPorDia: 3, xpMetaDiaria: 5 })
  assert.equal(c.metaDiaria, 30)
  assert.equal(c.metaExtra, 45)
  for (let d = 0; d < 3; d++) {
    reloj.avanzar(DIA)
    for (let i = 0; i < 3; i++) await entreno.sumarToque(id, c.id)
  }
  reloj.avanzar(DIA)
  const [p] = await entreno.propuestasDeSubida(id)
  assert.deepEqual([p.de, p.a, p.cuota], [10, 11, 33])
  const nuevo = await entreno.responderPropuesta(id, c.id, true)
  assert.equal(nuevo.cantidadPorToque, 11)
  assert.equal(nuevo.metaDiaria, 33)
  assert.deepEqual((await entreno.resumenSeries(id)).series.find((x) => x.contador.id === c.id).porDia.at(-2).cuota, 30) // ayer valía 30
  assert.equal((await entreno.propuestasDeSubida(id)).length, 0)
  await assert.rejects(entreno.guardarContador(id, { nombre: '', cantidadPorToque: 0, metaDiaria: 0 }), /nombre/)
})

// ---------- Otros ----------

test('cada persona ve solo lo suyo', async () => {
  const a = await conGimnasio('Ana')
  const b = await personaDePrueba('Beto')
  const s = await entreno.iniciarEntreno(a, 'rutina-a')
  assert.equal((await entreno.listarRutinas(b)).length, 0)
  await assert.rejects(entreno.registrarSerie(b, s.id, 'a-press-banca', { reps: 8 }), /no existe/)
  await assert.rejects(entreno.iniciarEntreno(b, 'rutina-a'), /no existe/)
  assert.equal(await entreno.sesionEnCurso(b), null)
})

test('resumen de Hoy y de fuerza', async () => {
  const id = await conGimnasio()
  await entreno.sembrar(id)
  let h = await entreno.resumenHoy(id)
  assert.equal(h.rutina.id, 'rutina-a')
  assert.equal(h.hecho, false)
  assert.equal(h.series.length, 2)
  const s = await entreno.iniciarEntreno(id, 'rutina-a')
  await series(id, s.id, 'a-press-banca', [8, 7])
  await entreno.terminarEntreno(id, s.id)
  h = await entreno.resumenHoy(id)
  assert.equal(h.hecho, true)
  const f = await entreno.resumenFuerza(id, '2026-11-23', '2026-11-01')
  assert.equal(f.entrenos, 1)
  assert.equal(f.dias.length, 23)
  assert.ok(f.ejercicios.length > 10)
})

test('importa rutinas, entrenos y series rápidas de una copia de la app vieja', async () => {
  const id = await personaDePrueba()
  const t = Date.UTC(2026, 10, 20, 22, 0)
  const n = await entreno.importar(id, {
    rutinas: [{ id: 'rutina-a', nombre: 'Rutina A', dias: [1, 4], bloques: [{ id: 'a-banca', tipo: 'ejercicio', nombre: 'Banca', series: 2, reps: 8, repsTope: 12, peso: 53, descanso: 90, sombra: 30 }], minutos: 40, orden: 1, activa: true, creado: t }],
    sesionesEntreno: [{ id: 7, rutinaId: 'rutina-a', fecha: '2026-11-20', inicio: t, fin: t + 40 * MIN, estado: 'terminada', paso: 1, orden: ['a-banca'], series: [{ bloqueId: 'a-banca', n: 1, reps: 8, peso: 53, instante: t + MIN }], hechos: [], saltados: [], xpExtra: 0 }, { basura: true }],
    contadores: [{ id: 'flexiones', nombre: 'Flexiones', cantidadPorToque: 14, metaDiaria: 70, xpMetaDiaria: 10, orden: 1, activo: true, creado: t }],
    registrosContador: [{ id: 3, contadorId: 'flexiones', fecha: '2026-11-20', instante: t, cantidad: 14 }],
  })
  assert.deepEqual(n, { rutinas: 1, sesionesEntreno: 1, contadores: 1, registrosContador: 1 })
  assert.equal((await entreno.ultimaVez(id, 'rutina-a', 'a-banca'))[0].reps, 8)
  assert.equal(await entreno.totalDelDia(id, 'flexiones', '2026-11-20'), 14)
  const e = await entreno.exportar(id)
  assert.equal(e.sesionesEntreno.length, 1)
  assert.equal(e.registrosContador.length, 1)
})

test('web: pantallas y API de entreno piden sesión y funcionan', async () => {
  const app = crearApp({ logger: false })
  assert.equal((await app.inject({ url: '/api/entreno' })).statusCode, 401)
  const r = await app.inject({ method: 'POST', url: '/api/sesion/crear-cuenta', payload: { nombre: 'Web', email: 'web-entreno@prueba.com', clave: 'clave-segura' } })
  const cookie = r.headers['set-cookie'].split(';')[0]
  const pedir = (method, url, payload) => app.inject({ method, url, headers: { cookie }, payload })
  for (const p of ['/entreno', '/entreno/rutina', '/entreno/sesion', '/entreno/series', '/m/entreno/entreno.js', '/m/entreno/rutina.js', '/m/entreno/sesion.js', '/m/entreno/series.js', '/entreno/historial', '/m/entreno/historial.js']) {
    assert.equal((await pedir('GET', p)).statusCode, 200, p)
  }
  let inicio = (await pedir('GET', '/api/entreno')).json()
  assert.equal(inicio.rutinas.length, 0)
  assert.equal(inicio.hoy.series.length, 2) // sembradas al crear la cuenta
  assert.equal((await pedir('POST', '/api/entreno/eleccion', { eleccion: { modo: 'plan', planId: 'plan-gimnasio' } })).json().cargadas, 3)
  const det = (await pedir('GET', '/api/entreno/rutinas/rutina-a')).json()
  assert.equal(det.otras.length, 2)
  assert.ok(det.enlaces['a-colgarse'] === undefined)
  const guardada = await pedir('PUT', '/api/entreno/rutinas/rutina-a', { ...det.rutina, nombre: 'Rutina A cambiada' })
  assert.equal(guardada.json().rutina.nombre, 'Rutina A cambiada')
  assert.equal((await pedir('PUT', '/api/entreno/rutinas/rutina-a', { ...det.rutina, nombre: '' })).statusCode, 400)
  let v = (await pedir('POST', '/api/entreno/empezar', { rutinaId: 'rutina-a' })).json()
  assert.equal(v.actual, 'a-calentar')
  v = (await pedir('POST', `/api/entreno/sesiones/${v.sesion.id}/serie`, { bloqueId: 'a-press-banca', reps: 8 })).json().vista
  assert.equal(v.descanso.fase.fase.tipo, 'preparar')
  assert.equal((await pedir('POST', `/api/entreno/sesiones/${v.sesion.id}/volar`, {})).statusCode, 400)
  const fin = (await pedir('POST', `/api/entreno/sesiones/${v.sesion.id}/terminar`, {})).json()
  assert.equal(fin.vista.sesion.estado, 'terminada')
  assert.equal((await pedir('GET', '/api/entreno/en-curso')).json().vista, null)
  const toque = (await pedir('POST', '/api/series/flexiones/toque', {})).json()
  assert.equal(toque.toque.total, 14)
  assert.equal((await pedir('GET', '/api/entreno/fuerza')).statusCode, 200)
  await app.close()
})

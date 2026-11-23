'use strict'
const { test, before, after } = require('node:test')
const assert = require('node:assert/strict')
const { prepararBase, personaDePrueba, terminar } = require('../../comun/prueba')
const reloj = require('../../comun/reloj')
const eventos = require('../../comun/eventos')
const xp = require('../xp/ventanilla')
const entreno = require('../entreno/ventanilla')
const habitos = require('../habitos/ventanilla')
const desafios = require('./ventanilla')
const calculo = require('./calculo')
const { crearApp } = require('../../app')

const HORA = 3600000
before(prepararBase)
after(terminar)

/** Persona con las series rápidas de siempre (flexiones y dominadas), como al crear la cuenta. */
async function persona(nombre) {
  const id = await personaDePrueba(nombre)
  await entreno.sembrar(id)
  return id
}

test('cuentas puras: reps del duelo, Tajo, normalizar, ninjas y robo', () => {
  assert.equal(calculo.repsDuelo(14, 'tension'), 14)
  assert.equal(calculo.repsDuelo(14, 'caida'), 21) // la serie más la mitad
  assert.equal(calculo.repsDuelo(null, 'tension', 12), 12)
  assert.equal(calculo.repsDuelo(0, 'caida'), 15)
  const t = Date.UTC(2026, 10, 23, 13)
  const base = { ultimaVista: t - 4 * HORA, ahora: t, pilarPendiente: true, pasoDejoCelu: false, mostradoHoy: false }
  assert.equal(calculo.debeMostrarTajo(base), true)
  assert.equal(calculo.debeMostrarTajo({ ...base, ultimaVista: t - 2 * HORA }), false)
  assert.equal(calculo.debeMostrarTajo({ ...base, pilarPendiente: false }), false)
  assert.equal(calculo.debeMostrarTajo({ ...base, pasoDejoCelu: true }), false)
  assert.equal(calculo.debeMostrarTajo({ ...base, mostradoHoy: true }), false)
  assert.equal(calculo.debeMostrarTajo({ ...base, ultimaVista: null }), false)
  assert.equal(calculo.normalizar('  Léer   UN libro '), 'leer un libro')
  assert.equal(calculo.objetivoBatalla(14), 15)
  assert.equal(calculo.objetivoBatalla(20), 20)
  assert.equal(calculo.sortearEscapes(() => 0.9), 2)
  assert.equal(calculo.roboPosible(4, 10), 4)
  assert.equal(calculo.xpRoboDe({ xpRobo: 99 }), 30)
  const lista = [{ id: 'a', nombre: 'A' }, { id: 'b', nombre: 'B', momento: 'noche' }]
  assert.equal(calculo.elegirNinja(lista, 'noche', [], () => 0).id, 'b')
  assert.equal(calculo.elegirNinja(lista, 'pilar', [], () => 0).id, 'a')
  assert.equal(calculo.puedeAparecer([{ momento: 'pilar' }, { momento: 'noche' }], 'juego'), false)
  assert.equal(calculo.puedeAparecer([{ momento: 'pilar' }, { momento: 'noche' }], 'duda'), true)
  assert.deepEqual(calculo.momentoActivo({ minutoActual: 600, pilaresPendientes: [{ id: 'p', nombre: 'Leer', horaLimite: '10:10' }] }),
    { momento: 'pilar', pilar: { id: 'p', nombre: 'Leer', entreno: false } })
})

test('configuración: arranca con lo de siempre, guarda solo lo válido y no pierde lo demás', async () => {
  const id = await persona()
  const c = await desafios.config(id)
  assert.equal(c.tension.kanji, '進')
  assert.equal(c.ninjas, false) // archivado
  await desafios.cambiarConfig(id, { tension: { frase: 'Igual voy.' }, tajo: { horas: 5 } })
  const d = await desafios.config(id)
  assert.equal(d.tension.frase, 'Igual voy.')
  assert.equal(d.tension.kanji, '進') // lo demás del grupo queda
  assert.equal(d.tajo.horas, 5)
  assert.equal(d.tajo.activo, true)
  await assert.rejects(desafios.cambiarConfig(id, { tajo: { horas: 99 }, tension: { frase: 'no entra' } }), /24 horas/)
  assert.equal((await desafios.config(id)).tension.frase, 'Igual voy.') // si algo está mal no guarda nada
  await assert.rejects(desafios.cambiarConfig(id, { cualquiera: 1 }), /No conozco/)
})

test('duelo: pide la serie de flexiones y la anota como una serie hecha (con su XP)', async () => {
  const id = await persona()
  const flex = (await entreno.listarContadores(id)).find((c) => /flexi/i.test(c.nombre))
  const t = await desafios.configDuelo(id, 'tension')
  assert.equal(t.contadorId, flex.id)
  assert.equal(t.reps, flex.cantidadPorToque)
  const c = await desafios.configDuelo(id, 'caida')
  assert.equal(c.reps, flex.cantidadPorToque + Math.ceil(flex.cantidadPorToque / 2))
  const antes = await entreno.repsDe(id, flex.id)
  const r = await desafios.anotarDuelo(id, 'tension')
  assert.equal(r.anotado, true)
  assert.equal(await entreno.repsDe(id, flex.id), antes + t.reps)
  await assert.rejects(desafios.configDuelo(id, 'otro'), /motivo/)
})

test('duelo sin series rápidas: pide las de la configuración y no anota nada', async () => {
  const id = await personaDePrueba() // sin sembrar series
  await desafios.cambiarConfig(id, { duelo: { repsSinSerie: 12 } })
  const d = await desafios.configDuelo(id, 'tension')
  assert.deepEqual(d, { motivo: 'tension', reps: 12, contadorId: null, nombre: 'Flexiones' })
  assert.equal((await desafios.configDuelo(id, 'caida')).reps, 18)
  assert.equal((await desafios.anotarDuelo(id, 'caida')).anotado, false)
})

test('«No cumplí» y Tensión sin la mano: la caída la guarda habitos (−XP) y se puede deshacer', async () => {
  const id = await persona()
  await xp.sumar(id, { clave: 'manual:prueba', cantidad: 100, origen: 'manual', fecha: '2026-11-23', descripcion: 'base' })
  const r = await desafios.noCumpli(id)
  assert.equal(r.caida.origen, 'boton')
  assert.equal(r.caida.xp, 20)
  assert.equal(r.duelo.motivo, 'caida')
  assert.equal(await xp.total(id), 80)
  const s = await desafios.tensionSoltar(id)
  assert.equal(s.caida.origen, 'tension')
  assert.equal(s.duelo.motivo, 'tension')
  assert.equal((await habitos.caidasDelDia(id, '2026-11-23')).length, 2)
  await desafios.deshacerCaida(id, r.caida.id)
  assert.equal(await xp.total(id), 80) // volvió la de «No cumplí», queda la de Tensión
  assert.equal((await habitos.caidasDelDia(id, '2026-11-23')).length, 1)
  await assert.rejects(desafios.deshacerCaida(id, r.caida.id), /no existe/)
  await assert.rejects(desafios.noCumpli(id, '2026-13-40'), /fecha/)
})

test('3·2·1: da XP una vez por acción y día, con tope diario, y avisa para que dia marque el compromiso', async () => {
  const id = await persona()
  const avisos = []
  eventos.escuchar('desafios.inicio', async (d) => { if (d.usuarioId === id) avisos.push(d) })
  const a = await desafios.registrarInicio(id, { accion: 'Ponerme las zapatillas', compromisoId: 'entreno' })
  assert.equal(a.xp, 5)
  assert.equal(a.inicio.compromisoId, 'entreno')
  assert.equal(avisos[0].compromisoId, 'entreno')
  const b = await desafios.registrarInicio(id, { accion: '  ponerme las ZAPATILLAS ' })
  assert.equal(b.xp, 0) // la misma acción, el mismo día
  await desafios.registrarInicio(id, { accion: 'Leer' })
  await desafios.registrarInicio(id, { accion: 'Lavar los platos' })
  const tope = await desafios.registrarInicio(id, { accion: 'Ordenar' })
  assert.equal(tope.xp, 0)
  assert.match(tope.motivoSinXp, /Tope de 3/)
  reloj.avanzar(24 * HORA)
  assert.equal((await desafios.registrarInicio(id, { accion: 'Leer' })).xp, 5) // otro día
  reloj.avanzar(-24 * HORA)
  assert.equal((await desafios.iniciosEntre(id, '2026-11-23', '2026-11-23')).length, 5)
  await assert.rejects(desafios.registrarInicio(id, { accion: '  ' }), /Escribí/)
})

test('3·2·1 de una acción guardada antes: la marca iniciada y cuenta los segundos hasta empezar', async () => {
  const id = await persona()
  const g = await desafios.guardarAccion(id, { accion: 'Abrir el libro', tareaAmbigua: 'Estudiar' })
  assert.equal(g.iniciado, undefined)
  reloj.avanzar(90000)
  const r = await desafios.registrarInicio(id, { id: g.id, accion: 'Abrir el libro' })
  assert.equal(r.inicio.segundosHastaEmpezar, 90)
  const c = await desafios.cerrarInicio(id, g.id, 'hecha')
  assert.equal(c.resultado, 'hecha')
  await assert.rejects(desafios.cerrarInicio(id, g.id, 'quizas'), /resultado/)
})

test('al llegar: la frase una vez por día; el Tajo solo después de horas con un pilar pendiente', async () => {
  const id = await persona()
  const p1 = await desafios.llegada(id, { pilarPendiente: true })
  assert.equal(p1.frase, true)
  assert.equal(p1.tajo, false) // nunca se vio antes
  assert.equal(p1.tension.kanji, '進')
  assert.equal((await desafios.llegada(id, {})).frase, false) // ya salió hoy
  reloj.avanzar(2 * HORA)
  assert.equal((await desafios.llegada(id, { pilarPendiente: true })).tajo, false) // poco tiempo
  reloj.avanzar(3 * HORA)
  assert.equal((await desafios.llegada(id, { pilarPendiente: false })).tajo, false) // sin pilar pendiente
  reloj.avanzar(3 * HORA)
  assert.equal((await desafios.llegada(id, { pilarPendiente: true, pasoDejoCelu: true })).tajo, false) // de noche
  reloj.avanzar(3 * HORA)
  assert.equal((await desafios.llegada(id, { pilarPendiente: true, modoSueno: true })).tajo, false)
  // «vista» al ocultarse no cuenta como volver
  await desafios.vista(id)
  reloj.avanzar(4 * HORA)
  const t = await desafios.llegada(id, { pilarPendiente: true })
  assert.equal(t.tajo, true)
  reloj.avanzar(4 * HORA)
  assert.equal((await desafios.llegada(id, { pilarPendiente: true })).tajo, false) // una vez por día
  reloj.avanzar(-19 * HORA)
})

test('archivado: ninjas apagados no aparecen; prendidos, batalla con serie y robo sin bajar de nivel', async () => {
  const id = await persona()
  const hoy = '2026-11-23'
  assert.equal(await desafios.prepararPelea(id, hoy, { momento: 'noche' }), null)
  assert.match((await desafios.prepararBatalla(id, hoy)).motivo, /guardados/)
  await desafios.cambiarConfig(id, { ninjas: true })
  const pelea = await desafios.prepararPelea(id, hoy, { momento: 'noche' }, () => 0)
  assert.equal(pelea.distraccion.id, 'celu')
  const { batalla } = await desafios.prepararBatalla(id, hoy, { azar: () => 0 })
  assert.equal(batalla.objetivo % 5, 0)
  const v = await desafios.terminarBatalla(id, batalla)
  assert.equal(v.pelea.resultado, 'vencido')
  assert.equal(v.reps, batalla.objetivo)
  await xp.sumar(id, { clave: 'manual:robo', cantidad: 104, origen: 'manual', fecha: hoy, descripcion: 'base' })
  const estado = await xp.estado(id)
  const robo = await desafios.robarXp(id, pelea, 30)
  assert.equal(robo.robado, Math.min(30, estado.xpEnNivel))
  assert.equal((await xp.estado(id)).nivel, estado.nivel) // nunca baja de nivel
  const chips = await desafios.chipsDelDia(id, hoy)
  assert.deepEqual(chips.map((c) => c.estado), ['duda', robo.robado ? 'robo' : 'escapado'])
  await desafios.registrarInicio(id, { accion: 'Seguir' })
  assert.equal((await desafios.chipsDelDia(id, hoy))[0].estado, 'vencido')
  assert.deepEqual(await desafios.ninjasVencidosSemana(id, hoy), { vencidos: 1, peleas: 2 })
})

test('cada persona ve solo lo suyo', async () => {
  const a = await persona('Ana')
  const b = await persona('Beto')
  const r = await desafios.noCumpli(a)
  await desafios.registrarInicio(a, { accion: 'Leer' })
  await desafios.cambiarConfig(a, { tension: { kanji: '勇' } })
  assert.equal((await desafios.iniciosRecientes(b)).length, 0)
  assert.equal((await desafios.config(b)).tension.kanji, '進')
  await assert.rejects(desafios.deshacerCaida(b, r.caida.id), /no existe/)
})

test('importa de la app vieja: peleas, 3·2·1 y ajustes; lo repetido no entra', async () => {
  const id = await persona()
  const t = Date.UTC(2026, 10, 20, 15)
  const viejo = {
    ninjas: [
      { id: 1, fecha: '2026-11-20', distraccion: 'celu', momento: 'noche', resultado: 'vencido', instante: t, reps: 15 },
      { id: 2, fecha: '2026-11-20', distraccion: 'juego', momento: 'batalla', resultado: 'escapo', instante: t + 60000, robo: 10 },
      { basura: true },
    ],
    siguienteAccion: [
      { id: 7, tareaAmbigua: '', accionConcreta: 'Leer 5 páginas', creado: t, iniciado: t, segundosHastaEmpezar: 0, resultado: 'hecha' },
      { id: 8, accionConcreta: '' },
    ],
    ajustes: { tension: { kanji: '勇', frase: 'Dale.' }, ninjas: false, batalla: { repsSinSerie: 8 }, rival: { xpRobo: 99 }, xpInicio: 3 },
  }
  assert.deepEqual(await desafios.importar(id, viejo), { peleas: 2, inicios: 1 })
  assert.deepEqual(await desafios.importar(id, viejo), { peleas: 0, inicios: 0 })
  const c = await desafios.config(id)
  assert.equal(c.tension.kanji, '勇')
  assert.equal(c.duelo.repsSinSerie, 8)
  assert.equal(c.inicio.xp, 3)
  assert.equal(c.rival.xpRobo, 10) // 99 no pasa la revisión: queda lo de siempre
  const e = await desafios.exportar(id)
  assert.equal(e.ninjas.length, 2)
  assert.equal(e.inicios[0].accion, 'Leer 5 páginas')
  assert.equal(e.inicios[0].fecha, '2026-11-20')
})

test('web: las pantallas y la API de desafíos piden sesión y funcionan', async () => {
  const app = crearApp({ logger: false })
  assert.equal((await app.inject({ url: '/api/desafios' })).statusCode, 401)
  const r = await app.inject({ method: 'POST', url: '/api/sesion/crear-cuenta', payload: { nombre: 'Web', email: 'desafios@prueba.com', clave: 'clave-segura' } })
  const cookie = r.headers['set-cookie'].split(';')[0]
  const pedir = (url, metodo = 'GET', payload) => app.inject({ method: metodo, url, headers: { cookie }, payload })
  for (const u of ['/desafios', '/desafios/321', '/desafios/tension', '/desafios/no-cumpli', '/m/desafios/accion.js', '/m/desafios/capa.js', '/m/desafios/capa.css', '/m/desafios/desafios.js', '/m/desafios/321.js', '/m/desafios/estilo.css']) {
    assert.equal((await pedir(u)).statusCode, 200, u)
  }
  const hoy = (await pedir('/api/desafios/hoy')).json()
  assert.equal(hoy.tension.ruta, '/desafios/tension?volver=/hoy')
  assert.deepEqual(hoy.pendientes, [])
  const res = (await pedir('/api/desafios')).json()
  assert.equal(res.config.tension.activa, true)
  assert.equal(res.xpCaida, 20)
  assert.ok(res.series.length >= 1) // la cuenta nueva trae flexiones (entreno.sembrar)
  const conf = await pedir('/api/desafios/config', 'PUT', { tension: { kanji: '勇' } })
  assert.equal(conf.json().config.tension.kanji, '勇')
  assert.equal((await pedir('/api/desafios/config', 'PUT', { tajo: { horas: 0 } })).statusCode, 400)
  const d = (await pedir('/api/desafios/duelo/caida')).json()
  assert.ok(d.reps > 0)
  assert.equal((await pedir('/api/desafios/duelo/otro')).statusCode, 400)
  assert.equal((await pedir('/api/desafios/duelo', 'POST', { motivo: 'tension' })).json().anotado, true)
  const p = (await pedir('/api/desafios/llegada', 'POST', { pilarPendiente: true })).json()
  assert.equal(p.frase, true)
  assert.equal((await pedir('/api/desafios/vista', 'POST', {})).statusCode, 200)
  const caida = (await pedir('/api/desafios/no-cumpli', 'POST', {})).json()
  assert.equal(caida.duelo.motivo, 'caida')
  assert.equal((await pedir('/api/desafios/caidas/' + caida.caida.id, 'DELETE')).json().ok, true)
  assert.equal((await pedir('/api/desafios/tension/soltar', 'POST', {})).statusCode, 200)
  const i = (await pedir('/api/desafios/inicios', 'POST', { accion: 'Empezar' })).json()
  assert.equal(i.xp, 5)
  assert.equal((await pedir('/api/desafios/inicios/' + i.inicio.id, 'PUT', { resultado: 'parcial' })).json().resultado, 'parcial')
  assert.equal((await pedir('/api/desafios/inicios')).json().inicios.length, 1)
  assert.equal((await pedir('/api/desafios/inicios', 'POST', {})).statusCode, 400)
  await app.close()
})

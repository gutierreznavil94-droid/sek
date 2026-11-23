'use strict'
const { test, before, after } = require('node:test')
const assert = require('node:assert/strict')
const { prepararBase, personaDePrueba, terminar } = require('../../comun/prueba')
const reloj = require('../../comun/reloj')
const eventos = require('../../comun/eventos')
const { guardarAjustes } = require('../../comun/ajustes')
const { ultimos } = require('../../comun/historial')
const sueno = require('./ventanilla')
const calculo = require('./calculo')
const xp = require('../xp/ventanilla')
const { crearApp } = require('../../app')

const MIN = 60000
// Hora local de Córdoba (UTC−3) → instante.
const cba = (dia, h, m = 0) => Date.UTC(2026, 10, dia, h + 3, m)

before(prepararBase)
after(terminar)

test('«Dejo celu» a tiempo: cumple, da su XP una sola vez, avisa y prende el modo sueño', async () => {
  const id = await personaDePrueba()
  let aviso = null
  const quitar = eventos.escuchar('sueno.dejo_celu', async (d) => { aviso = d })
  reloj.fijar(cba(23, 21, 0))
  const r = await sueno.dejoCelu(id)
  quitar()
  assert.equal(r.noche, '2026-11-23')
  assert.equal(r.cumplido, true)
  assert.equal(r.xp, 20)
  assert.equal(aviso.cumplido, true)
  assert.equal((await xp.estado(id)).xpTotal, 20)
  const modo = await sueno.modoActivo(id)
  assert.equal(modo.noche, '2026-11-23')
  assert.equal(modo.hasta, cba(24, 5, 0))
  // Tocarlo otra vez no suma de nuevo.
  reloj.avanzar(2 * MIN)
  const otra = await sueno.dejoCelu(id)
  assert.equal(otra.xp, 0)
  assert.equal((await xp.estado(id)).xpTotal, 20)
  assert.deepEqual(await sueno.dormirAHorario(id, '2026-11-23'), { registrado: true, cumplido: true, retrasoMinutos: 0 })
})

test('«Dejo celu» tarde no da XP; después de la hora límite ya no se registra', async () => {
  const id = await personaDePrueba()
  reloj.fijar(cba(23, 21, 40))
  const r = await sueno.dejoCelu(id, { modo: false })
  assert.equal(r.cumplido, false)
  assert.equal(r.retrasoMinutos, 25)
  assert.equal((await xp.estado(id)).xpTotal, 0)
  assert.equal(await sueno.modoActivo(id), null)
  reloj.fijar(cba(24, 0, 30)) // 00:30: pertenece a la noche del 23, pero pasó las 22:15
  await assert.rejects(sueno.dejoCelu(id), /Pasaron las 22:15/)
})

test('modo sueño: aperturas, «Buenos días» media hora antes y la noche se cierra sola', async () => {
  const id = await personaDePrueba()
  reloj.fijar(cba(23, 21, 0))
  await sueno.dejoCelu(id)
  reloj.fijar(cba(24, 1, 0))
  assert.equal(await sueno.registrarApertura(id), 1)
  reloj.avanzar(20 * 1000) // dos en menos de un minuto cuentan como una
  assert.equal(await sueno.registrarApertura(id), 1)
  assert.equal(await sueno.terminarModoSiCorresponde(id), null) // todavía es de noche
  reloj.fijar(cba(24, 4, 40))
  const fin = await sueno.terminarModoSiCorresponde(id)
  assert.equal(fin.noche, '2026-11-23')
  assert.equal(await sueno.modoActivo(id), null)
  const [n] = await sueno.noches(id, '2026-11-23', '2026-11-23')
  assert.equal(calculo.horaDeMinutos(n.acostado), '21:00')
  assert.equal(calculo.horaDeMinutos(n.dormido), '21:15')
  assert.equal(n.minutos, 473) // de 21:15 a 05:07:30 (centro de 05:00–05:15)
  assert.equal(n.aperturas, 1)
  assert.equal(n.cumplido, true)
  assert.equal(n.estimado, true)
})

test('salir del modo sueño queda en el historial', async () => {
  const id = await personaDePrueba()
  reloj.fijar(cba(23, 21, 0))
  await sueno.dejoCelu(id)
  reloj.avanzar(10 * MIN)
  assert.equal(await sueno.salirModo(id, 'Emergencia'), true)
  assert.equal(await sueno.modoActivo(id), null)
  const h = await ultimos(id, 5)
  assert.equal(h[0].tipo, 'modo_salir')
  assert.equal(h[0].detalle.motivo, 'Emergencia')
})

test('corregir una noche a mano: crea la noche sin XP, valida las horas y vuelve a lo estimado', async () => {
  const id = await personaDePrueba()
  reloj.fijar(cba(23, 10, 0))
  await assert.rejects(sueno.corregirNoche(id, '2026-11-21', { dormido: '23:00' }), /a qué hora te acostaste/)
  await sueno.corregirNoche(id, '2026-11-21', { acostado: '22:30', levantado: '06:00', despertares: 2 })
  let [n] = await sueno.noches(id, '2026-11-21', '2026-11-21')
  assert.equal(n.sinDejoCelu, true)
  assert.equal(n.cumplido, false)
  assert.equal(calculo.horaDeMinutos(n.dormido), '22:45') // 15 min de latencia
  assert.equal(n.minutos, 435)
  assert.equal(n.despertares, 2)
  assert.equal(n.fuentes.acostado, 'corregido')
  assert.equal(n.fuentes.dormido, 'estimado')
  assert.deepEqual(await sueno.dormirAHorario(id, '2026-11-21'), { registrado: false, cumplido: false, retrasoMinutos: null })
  await assert.rejects(sueno.corregirNoche(id, '2026-11-21', { dormido: '22:00' }), /antes de acostarte/)
  await assert.rejects(sueno.corregirNoche(id, '2026-11-21', { levantado: '22:40' }), /después de la de dormirte/)
  await sueno.corregirNoche(id, '2026-11-21', { dormido: '23:30' })
  ;[n] = await sueno.noches(id, '2026-11-21', '2026-11-21')
  assert.equal(n.fuentes.dormido, 'corregido')
  assert.equal(n.minutos, 390)
  await sueno.volverAEstimado(id, '2026-11-21', 'dormido')
  ;[n] = await sueno.noches(id, '2026-11-21', '2026-11-21')
  assert.equal(n.fuentes.dormido, 'estimado')
  assert.equal(n.minutos, 435)
  assert.equal((await xp.estado(id)).xpTotal, 0)
})

test('deshacer «Dejo celu» anula el XP, borra la noche y apaga el modo sueño', async () => {
  const id = await personaDePrueba()
  reloj.fijar(cba(23, 21, 0))
  await sueno.dejoCelu(id)
  assert.equal(await sueno.deshacerDejoCelu(id, '2026-11-23'), true)
  assert.equal((await xp.estado(id)).xpTotal, 0)
  assert.equal(await sueno.modoActivo(id), null)
  assert.equal((await sueno.dormirAHorario(id, '2026-11-23')).registrado, false)
  // Volver a tocarlo reactiva el XP.
  const r = await sueno.dejoCelu(id)
  assert.equal(r.xp, 20)
})

test('resumen: racha, mejora, adaptación y veredicto de anoche', async () => {
  const id = await personaDePrueba()
  for (let d = 16; d <= 22; d++) {
    reloj.fijar(cba(d, 21, 0))
    await sueno.dejoCelu(id)
    reloj.fijar(cba(d + 1, 5, 10))
    await sueno.terminarModoSiCorresponde(id)
  }
  reloj.fijar(cba(23, 10, 0))
  const r = await sueno.resumen(id, { rango: 'semana' })
  assert.equal(r.noche, '2026-11-23')
  assert.equal(r.mejora.racha, 7)
  assert.equal(r.noches.length, 7)
  assert.equal(r.anoche.noche, '2026-11-22')
  assert.equal(r.anoche.veredicto.tono, 'bien')
  assert.equal(r.adaptacion.inicio, '2026-11-16')
  assert.equal(r.adaptacion.actual.semana, 2)
  assert.equal(r.adaptacion.actual.etapa.nombre, 'Acostumbrando')
  assert.equal(r.mejora.regularidad, 0)
  assert.equal(r.estaNoche, null)
  const h = await sueno.resumenHoy(id)
  assert.equal(h.anoche.cumplido, true)
  assert.equal(h.aviso.mostrar, false) // a las 10:00 no toca
  reloj.fijar(cba(23, 20, 50))
  assert.equal((await sueno.avisoDormir(id)).mostrar, true) // 25 min antes de «Dejo celu»
})

test('adaptación editable: valida, acota y vuelve a lo sugerido', async () => {
  const id = await personaDePrueba()
  reloj.fijar(cba(23, 10, 0))
  await assert.rejects(sueno.guardarAdaptacion(id, { desde: '2026-12-01', etapas: calculo.ETAPAS_SUGERIDAS }), /de hoy para atrás/)
  const ad = await sueno.guardarAdaptacion(id, { desde: '2026-11-01', toleranciaMinutos: 500, etapas: [{ nombre: ' ', semanas: 50, horasMin: 1, horasMax: 20, despertaresNormales: 9 }, { nombre: 'Fin', semanas: 0, horasMin: 7, horasMax: 9, despertaresNormales: 0 }] })
  assert.equal(ad.tolerancia, 120)
  assert.deepEqual(ad.etapas[0], { nombre: 'Etapa', semanas: 12, horasMin: 3, horasMax: 14, despertaresNormales: 5 })
  assert.equal(ad.actual.semana, 4)
  const vuelta = await sueno.guardarAdaptacion(id, null)
  assert.equal(vuelta.etapas.length, 3)
  assert.equal(vuelta.tolerancia, 20)
})

test('veredicto: acostarse a horario primero, después depende de la etapa', () => {
  const etapa = (fecha) => calculo.etapaDe(fecha, '2026-11-01')
  const base = { horaDejarCelu: '21:15', tolerancia: 20, minutos: 5 * 60 }
  assert.equal(calculo.veredictoNoche({ ...base, acostado: 22 * 60, etapa: etapa('2026-11-02') }).tono, 'tarde')
  assert.equal(calculo.veredictoNoche({ ...base, acostado: 21 * 60, etapa: etapa('2026-11-02') }).tono, 'normal')
  assert.equal(calculo.veredictoNoche({ ...base, acostado: 21 * 60, etapa: etapa('2026-12-20') }).tono, 'aviso')
  assert.match(calculo.veredictoNoche({ ...base, acostado: 21 * 60, etapa: etapa('2026-11-16'), nochesCortasSeguidas: 3 }).texto, /3 noches seguidas/)
  assert.equal(calculo.discursoDeSemana(1).titulo, 'Semana 1 · Acostumbrando')
  assert.equal(calculo.ultimaSemanaConInfo(calculo.ETAPAS_SUGERIDAS), 5)
})

test('ajustes del sueño: valida «Dejo celu» entre alistarse y dormido', async () => {
  const id = await personaDePrueba()
  await assert.rejects(sueno.guardarAjustesSueno(id, { horaDejarCelu: '23:00', latenciaDormirseMinutos: 15, horaFinSuenio: '05:00', objetivoSuenioHoras: 7.5 }), /entre 20:50/)
  await assert.rejects(sueno.guardarAjustesSueno(id, { horaDejarCelu: '21:00', latenciaDormirseMinutos: 15, horaFinSuenio: '05:00', objetivoSuenioHoras: 20 }), /4 a 12/)
  const a = await sueno.guardarAjustesSueno(id, { horaDejarCelu: '21:00', latenciaDormirseMinutos: 99, horaFinSuenio: '06:00', objetivoSuenioHoras: 8 })
  assert.equal(a.latenciaDormirseMinutos, 30)
  assert.equal(a.finVentana, '06:15')
  reloj.fijar(cba(23, 21, 10))
  assert.equal((await sueno.dejoCelu(id, { modo: false })).retrasoMinutos, 10) // ahora la hora es 21:00
})

test('cada persona ve solo lo suyo', async () => {
  const a = await personaDePrueba('Ana')
  const b = await personaDePrueba('Beto')
  reloj.fijar(cba(23, 21, 0))
  await sueno.dejoCelu(a)
  assert.equal(await sueno.modoActivo(b), null)
  assert.equal((await sueno.dormirAHorario(b, '2026-11-23')).registrado, false)
  await assert.rejects(sueno.volverAEstimado(b, '2026-11-23', 'dormido'), /no existe/)
})

test('importa el sueño de una copia de la app vieja (sin pisar lo que ya está)', async () => {
  const id = await personaDePrueba()
  reloj.fijar(cba(23, 10, 0))
  await sueno.corregirNoche(id, '2026-11-20', { acostado: '21:00' })
  const n = await sueno.importar(id, {
    suenio: [
      { id: 1, noche: '2026-11-19', horaPrevista: '21:15', horaReal: cba(19, 21, 5), retrasoMinutos: 0, cumplido: true, rutinaRegistrada: true, creado: cba(19, 21, 5), dormido: cba(19, 21, 20), levantado: cba(20, 5, 7), levantadoCorregido: true, aperturas: 2, despertares: 1 },
      { id: 2, noche: '2026-11-20', horaPrevista: '21:15', horaReal: cba(20, 22, 0), cumplido: false },
      { basura: true },
    ],
    modoSuenio: [],
  })
  assert.equal(n, 1)
  const [x] = await sueno.noches(id, '2026-11-19', '2026-11-19')
  assert.equal(x.cumplido, true)
  assert.equal(x.fuentes.levantado, 'corregido')
  assert.equal(x.aperturas, 2)
  assert.equal(x.despertares, 1)
  assert.equal(x.minutos, 467)
})

test('web: las pantallas y la API de sueño piden sesión y funcionan', async () => {
  reloj.fijar(cba(23, 21, 0))
  const app = crearApp({ logger: false })
  assert.equal((await app.inject({ url: '/api/sueno' })).statusCode, 401)
  const r = await app.inject({ method: 'POST', url: '/api/sesion/crear-cuenta', payload: { nombre: 'Web', email: 'websueno@prueba.com', clave: 'clave-segura' } })
  const cookie = r.headers['set-cookie'].split(';')[0]
  for (const url of ['/sueno', '/sueno/modo', '/m/sueno/sueno.js', '/m/sueno/modo.js', '/m/sueno/estilo.css']) {
    assert.equal((await app.inject({ url, headers: { cookie } })).statusCode, 200, url)
  }
  const d = await app.inject({ method: 'POST', url: '/api/sueno/dejo-celu', headers: { cookie }, payload: {} })
  assert.equal(d.json().cumplido, true)
  const m = await app.inject({ url: '/api/sueno/modo', headers: { cookie } })
  assert.equal(m.json().modo.noche, '2026-11-23')
  const res = await app.inject({ url: '/api/sueno?rango=mes', headers: { cookie } })
  assert.equal(res.json().estaNoche.cumplido, true)
  assert.equal(res.json().rango, 'mes')
  const mal = await app.inject({ method: 'PUT', url: '/api/sueno/noches/2026-11-20', headers: { cookie }, payload: { acostado: '25:99x' } })
  assert.equal(mal.statusCode, 400)
  const s = await app.inject({ method: 'POST', url: '/api/sueno/modo/salir', headers: { cookie }, payload: {} })
  assert.equal(s.json().ok, true)
  await app.close()
})

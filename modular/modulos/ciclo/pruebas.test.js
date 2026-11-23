'use strict'
const { test, before, after } = require('node:test')
const assert = require('node:assert/strict')
const { prepararBase, personaDePrueba, terminar } = require('../../comun/prueba')
const eventos = require('../../comun/eventos')
const { transaccion } = require('../../comun/base')
const calculo = require('./calculo')
const ciclo = require('./ventanilla')
const xp = require('../xp/ventanilla')
const { crearApp } = require('../../app')

// La hora de prueba es el lunes 23 nov 2026, 10:00 en Córdoba.
const HOY = '2026-11-23'
before(prepararBase)
after(terminar)

async function persona() {
  const id = await personaDePrueba()
  await ciclo.sembrar(id)
  return id
}

test('cuentas: fases de 30, la última más corta, y metas automáticas', () => {
  assert.deepEqual(calculo.planDeFases(90, 30).map((f) => [f.numero, f.diaInicio, f.diaFin]), [[1, 1, 30], [2, 31, 60], [3, 61, 90]])
  assert.deepEqual(calculo.planDeFases(100, 30).map((f) => [f.diaInicio, f.diaFin]), [[1, 30], [31, 60], [61, 90], [91, 100]])
  assert.equal(calculo.planDeFases(120, 30)[3].foco, 'Fase 4', 'más fases que las de fábrica: nombre genérico')
  const fases = calculo.planDeFases(90, 30)
  const metas = calculo.metasAutomaticas({ numero: 1, inicio: HOY, duracionDias: 90 }, fases)
  assert.deepEqual(metas.filter((m) => m.tipo !== 'revision_semanal').map((m) => [m.fecha, m.tipo]), [
    ['2026-12-22', 'fin_fase'], ['2027-01-21', 'fin_fase'], ['2027-02-20', 'fin_ciclo'], [HOY, 'inicio_ciclo'],
  ])
  const domingos = metas.filter((m) => m.tipo === 'revision_semanal').map((m) => m.fecha)
  assert.equal(domingos[0], '2026-11-29')
  assert.equal(domingos.length, 12)
})

test('cuentas: día del ciclo, fase, Día 0 y terminado', () => {
  const c = { inicio: '2026-11-24', diaCero: HOY, duracionDias: 90, diasPorFase: 30 }
  assert.deepEqual(
    (({ dia, faseNumero, diaCero, noEmpezado }) => ({ dia, faseNumero, diaCero, noEmpezado }))(calculo.ubicar(c, HOY)),
    { dia: 0, faseNumero: 1, diaCero: true, noEmpezado: false })
  assert.equal(calculo.ubicar(c, '2026-11-22').noEmpezado, true)
  assert.equal(calculo.ubicar(c, '2026-12-24').faseNumero, 2)
  assert.equal(calculo.ubicar(c, '2027-02-21').dia, 90)
  assert.equal(calculo.ubicar(c, '2027-02-22').terminado, true)
  assert.equal(calculo.sePuedeCerrar({ diaFin: 30 }, 30, false), false)
  assert.equal(calculo.sePuedeCerrar({ diaFin: 30 }, 31, false), true)
  assert.equal(calculo.sePuedeCerrar({ diaInicio: 61, diaFin: 90 }, 70, true), true, 'el ciclo se puede cerrar antes de terminar')
  assert.equal(calculo.sePuedeCerrar({ diaInicio: 61, diaFin: 90 }, 40, true), false, 'pero no desde la fase 2')
})

test('una cuenta nueva trae identidad y los cinco atributos, sin ciclo', async () => {
  const u = await persona()
  await ciclo.sembrar(u) // dos veces no duplica
  const atr = await ciclo.atributos(u)
  assert.deepEqual(atr.map((a) => a.id), ['disciplina', 'fisico', 'autocontrol', 'claridad', 'confianza'])
  assert.match((await ciclo.identidad(u)).vision, /disciplinada/)
  assert.equal(await ciclo.cicloActivo(u), null)
  assert.equal(await ciclo.diaDelCiclo(u), null)
  assert.equal((await ciclo.resumen(u)).ciclo, null)
})

test('iniciar un ciclo arma fases y metas; uno nuevo cierra el anterior', async () => {
  const u = await persona()
  const avisos = []
  const quitar = eventos.escuchar('ciclo.nuevo', (d) => { avisos.push(d) })
  const c1 = await ciclo.iniciarCiclo(u, { inicio: HOY, diaCero: true })
  assert.equal(c1.numero, 1)
  assert.equal(c1.diaCero, '2026-11-22')
  const d = await ciclo.diaDelCiclo(u)
  assert.equal(d.dia, 1)
  assert.equal(d.fase.numero, 1)
  assert.equal(d.fase.foco, 'Disciplina y ejecución')
  assert.equal((await ciclo.fases(u, c1.id)).length, 3)
  const metas = await ciclo.metasEntre(u, HOY, '2027-02-20')
  assert.ok(metas.some((m) => m.tipo === 'fin_ciclo' && m.fecha === '2027-02-20'))

  const c2 = await ciclo.iniciarCiclo(u, { inicio: '2026-11-30', duracionDias: 120 })
  assert.equal(c2.numero, 2)
  assert.equal((await ciclo.cicloActivo(u)).id, c2.id)
  assert.equal((await ciclo.ciclos(u)).find((c) => c.id === c1.id).estado, 'cerrado')
  assert.equal((await ciclo.fases(u, c2.id)).length, 4)
  const r = await ciclo.resumen(u)
  assert.equal(r.noEmpezado, true, 'empieza la semana que viene')
  assert.equal(r.ciclosAnteriores.length, 1)
  assert.equal(avisos.length, 2)
  assert.equal(avisos[1].anterior.id, c1.id)
  quitar()
  await assert.rejects(ciclo.iniciarCiclo(u, { inicio: 'mañana' }), /no es válida/)
  await assert.rejects(ciclo.iniciarCiclo(u, { inicio: HOY, duracionDias: 3 }), /duración/)
})

test('cambiar la fecha de inicio regenera las metas automáticas y deja las propias', async () => {
  const u = await persona()
  await ciclo.iniciarCiclo(u, { inicio: HOY, diaCero: true })
  const propia = await ciclo.crearMeta(u, { titulo: 'Terminar el capítulo 1', fecha: '2026-11-30' })
  let aviso = null
  const quitar = eventos.escuchar('ciclo.inicio_cambiado', (d) => { aviso = d })
  const c = await ciclo.cambiarInicio(u, '2026-11-20')
  quitar()
  assert.equal(c.inicio, '2026-11-20')
  assert.equal(c.diaCero, null, 'el Día 0 se va')
  assert.equal(aviso.inicioAnterior, HOY)
  assert.equal((await ciclo.diaDelCiclo(u)).dia, 4)
  const metas = await ciclo.metasEntre(u, '2026-11-01', '2027-03-01')
  assert.ok(metas.some((m) => m.tipo === 'inicio_ciclo' && m.fecha === '2026-11-20'))
  assert.ok(!metas.some((m) => m.tipo === 'inicio_ciclo' && m.fecha === HOY))
  assert.ok(metas.some((m) => m.id === propia.id))
})

test('objetivos por fase y atributo; fase editable; cierre con resultados', async () => {
  const u = await persona()
  const c = await ciclo.iniciarCiclo(u, { inicio: '2026-10-01' }) // hoy es el día 54: la fase 1 ya terminó
  const [f1, f2] = await ciclo.fases(u, c.id)
  const o = await ciclo.guardarObjetivo(u, { faseNumero: 1, atributoId: 'fisico', titulo: 'Entrenar 3 veces por semana', indicador: 'hechos / previstos', lineaBase: '1/3', meta: '3/3' })
  await assert.rejects(ciclo.guardarObjetivo(u, { faseNumero: 9, atributoId: 'fisico', titulo: 'Algo', indicador: 'algo' }), /fase no existe/)
  await assert.rejects(ciclo.guardarObjetivo(u, { faseNumero: 1, atributoId: 'nada', titulo: 'Algo', indicador: 'algo' }), /atributo/)
  await ciclo.guardarObjetivo(u, { id: o.id, atributoId: 'fisico', titulo: 'Entrenar 4 veces', indicador: 'hechos / previstos' })
  assert.equal((await ciclo.objetivos(u, c.id))[0].titulo, 'Entrenar 4 veces')
  assert.equal((await ciclo.objetivos(u, c.id))[0].lineaBase, null, 'lo que no viene al editar queda vacío, como en el formulario')

  await ciclo.editarFase(u, f1.id, { foco: 'Arrancar', queSeMide: '% cumplido' })
  await assert.rejects(ciclo.cerrarFase(u, f2.id, {}), /desde el día 61/)
  let aviso = null
  const quitar = eventos.escuchar('ciclo.fase_cerrada', (d) => { aviso = d })
  const r = await ciclo.cerrarFase(u, f1.id, { notas: 'Entrenar temprano funciona', resultados: { [o.id]: '3/3' } })
  quitar()
  assert.equal(r.esUltima, false)
  assert.equal(aviso.fase.numero, 1)
  assert.equal((await ciclo.objetivos(u, c.id))[0].resultado, '3/3')
  await assert.rejects(ciclo.cerrarFase(u, f1.id, {}), /ya estaba cerrada/)
  const res = await ciclo.resumen(u)
  assert.equal(res.fases[0].foco, 'Arrancar')
  assert.ok(res.fases[0].cerradaEn)
  assert.equal(res.fases[1].actual, true)
  await ciclo.archivarObjetivo(u, o.id)
  assert.equal((await ciclo.objetivos(u, c.id)).length, 0)
})

test('atributos e identidad se editan; archivar no borra', async () => {
  const u = await persona()
  const a = await ciclo.guardarAtributo(u, { nombre: 'Creatividad', descripcion: 'Dibujar manga', ventanaDias: 21 })
  assert.equal(a.orden, 6)
  await assert.rejects(ciclo.guardarAtributo(u, { nombre: 'X' }), /2 letras/)
  await assert.rejects(ciclo.guardarAtributo(u, { nombre: 'Algo', ventanaDias: 90 }), /3 a 60/)
  await ciclo.guardarAtributo(u, { id: a.id, nombre: 'Creatividad y manga', ventanaDias: 14 })
  await ciclo.archivarAtributo(u, a.id)
  assert.equal((await ciclo.atributos(u)).length, 5)
  assert.equal((await ciclo.atributos(u, { conArchivados: true })).find((x) => x.id === a.id).nombre, 'Creatividad y manga')
  await ciclo.guardarIdentidad(u, { vision: 'Alguien que hace lo que dice', obstaculos: 'El celu' })
  assert.equal((await ciclo.identidad(u)).obstaculos, 'El celu')
  await assert.rejects(ciclo.guardarIdentidad(u, { vision: 'corto' }), /10 letras/)
})

test('metas propias: lo logré da XP una vez, tope de 2 por día, corregir y borrar', async () => {
  const u = await persona()
  await assert.rejects(ciclo.crearMeta(u, { titulo: 'Tarde', fecha: '2026-11-20' }), /días pasados/)
  const m1 = await ciclo.crearMeta(u, { titulo: 'Leer 20 páginas', fecha: HOY })
  const m2 = await ciclo.crearMeta(u, { titulo: 'Ordenar escritorio', fecha: HOY })
  const m3 = await ciclo.crearMeta(u, { titulo: 'Llamar a la abuela', fecha: HOY })
  const futura = await ciclo.crearMeta(u, { titulo: 'Terminar capítulo', fecha: '2026-11-30', xp: 40 })
  assert.equal((await ciclo.metasQueVencen(u)).length, 3)

  const r1 = await ciclo.resolverMeta(u, m1.id, true)
  assert.equal(r1.xp, 15)
  assert.equal((await ciclo.resolverMeta(u, m1.id, true)).xp, 0, 'nunca dos veces')
  assert.equal((await ciclo.resolverMeta(u, m2.id, true)).xp, 15)
  const r3 = await ciclo.resolverMeta(u, m3.id, true)
  assert.equal(r3.xp, 0)
  assert.equal(r3.conTope, true)
  assert.equal(await xp.total(u), 30)

  // Cumplida antes de tiempo: cuenta hoy, no el día que vencía (y ya hay 2 hoy → sin XP).
  const rf = await ciclo.resolverMeta(u, futura.id, true)
  assert.equal(rf.meta.cumplidaEl, HOY)
  assert.equal(rf.conTope, true)

  // «No la logré» anula su XP; «Sí la logré» la reactiva (sin duplicar).
  await ciclo.resolverMeta(u, m1.id, false, 'Me equivoqué')
  assert.equal(await xp.total(u), 15)
  await ciclo.resolverMeta(u, m1.id, true)
  assert.equal(await xp.total(u), 30)
  await ciclo.reabrirMeta(u, m2.id)
  assert.equal(await xp.total(u), 15)
  await ciclo.borrarMeta(u, m1.id)
  assert.equal(await xp.total(u), 0)
  const g = await ciclo.resumenMetas(u)
  assert.deepEqual([g.vencidas.length, g.cumplidas.length, g.noCumplidas.length], [1, 2, 0])
  await ciclo.editarMeta(u, m2.id, { titulo: 'Ordenar todo el cuarto' })
  assert.equal((await ciclo.resumenMetas(u)).vencidas[0].titulo, 'Ordenar todo el cuarto')
})

test('una meta que pasó sin marcarse se ve no cumplida', () => {
  assert.equal(calculo.estadoVisible({ estado: 'pendiente', fecha: '2026-11-20' }, HOY), 'no_cumplida')
  assert.equal(calculo.estadoVisible({ estado: 'pendiente', fecha: HOY }, HOY), 'pendiente')
})

test('revisiones: guardar, actualizar sin pisar la foto, aviso solo la primera vez y ajuste para mañana', async () => {
  const u = await persona()
  const avisos = []
  const quitar = eventos.escuchar('ciclo.revision', (d) => { avisos.push(d) })
  const r1 = await ciclo.guardarRevision(u, 'diaria', HOY, { obstaculo: 'Postergué', ajuste: 'Entrenar apenas llego' }, { cumplidos: 3, programados: 5 })
  assert.equal(r1.nueva, true)
  const r2 = await ciclo.guardarRevision(u, 'diaria', HOY, { obstaculo: 'Cansancio', ajuste: 'Dormir antes' }, { cumplidos: 5 })
  assert.equal(r2.nueva, false)
  assert.equal(r2.revision.respuestas.obstaculo, 'Cansancio')
  assert.equal(r2.revision.foto.cumplidos, 3, 'la foto queda la primera')
  await ciclo.guardarRevision(u, 'semanal', '2026-11-18', { queFunciono: 'Entrenar temprano' })
  assert.deepEqual(avisos.map((a) => [a.tipo, a.periodo, a.fecha]), [['diaria', HOY, HOY], ['semanal', '2026-11-16', '2026-11-22']])
  assert.equal((await ciclo.revision(u, 'semanal', '2026-11-20')).respuestas.queFunciono, 'Entrenar temprano')
  await assert.rejects(ciclo.guardarRevision(u, 'diaria', '2026-11-24', {}), /no llegó/)
  quitar()
  // Mañana, el ajuste aparece arriba de Hoy.
  assert.equal(await ciclo.ajusteParaHoy(u, '2026-11-24'), 'Dormir antes')
  assert.equal(await ciclo.ajusteParaHoy(u, HOY), null)
})

test('importar la copia de la app vieja: respeta id, no duplica', async () => {
  const u = await personaDePrueba()
  const vieja = {
    identidad: [{ id: 'unica', vision: 'Visión importada de la app vieja', obstaculos: 'Juego', actualizado: 1 }],
    atributos: [{ id: 'disciplina', nombre: 'Disciplina', descripcion: '', orden: 1, ventanaDias: 14, creado: 1 }, { id: 'atr_x', nombre: 'Manga', descripcion: '', orden: 2, ventanaDias: 7, creado: 1, archivado: true }],
    ciclos: [
      { id: 'ciclo_a', numero: 1, inicio: '2026-08-01', duracionDias: 90, diasPorFase: 30, estado: 'cerrado', creado: 1, cerrado: 2 },
      { id: 'ciclo_b', numero: 2, inicio: '2026-11-02', diaCero: '2026-11-01', duracionDias: 90, diasPorFase: 30, estado: 'activo', creado: 3 },
    ],
    fases: [
      { id: 'fase_1', cicloId: 'ciclo_b', numero: 1, diaInicio: 1, diaFin: 30, foco: 'Disciplina', queSeMide: 'x' },
      { id: 'fase_2', cicloId: 'ciclo_b', numero: 2, diaInicio: 31, diaFin: 60, foco: 'Constancia', queSeMide: '' },
      { id: 'fase_3', cicloId: 'ciclo_b', numero: 3, diaInicio: 61, diaFin: 90, foco: 'Yo ideal', queSeMide: '' },
      { id: 'fase_huerfana', cicloId: 'no_existe', numero: 1, diaInicio: 1, diaFin: 30, foco: 'x', queSeMide: '' },
    ],
    objetivos: [{ id: 'obj_1', cicloId: 'ciclo_b', faseNumero: 1, atributoId: 'disciplina', titulo: 'Cumplir 80 %', indicador: '% cumplido', creado: 5 }],
    metas: [
      { id: 'meta_1', fecha: '2026-11-30', titulo: 'Capítulo 1', tipo: 'propia', estado: 'pendiente', xp: 15, creado: 6 },
      { id: 'meta_2', fecha: '2026-11-10', titulo: 'Vieja', tipo: 'propia', cumplida: true, creado: 6 },
      { id: 'meta_3', fecha: '2026-11-02', titulo: 'Día 1 del ciclo 2', tipo: 'inicio_ciclo', creado: 6 },
    ],
    revisiones: [{ id: 'rev_1', tipo: 'diaria', periodo: '2026-11-22', respuestas: { ajuste: 'Levantarme 7:00' }, foto: { cumplidos: 4 }, creado: 7, actualizado: 7 }],
  }
  const n = await transaccion((tx) => ciclo.importar(u, vieja, tx))
  assert.deepEqual(n, { ciclos: 2, fases: 3, objetivos: 1, atributos: 2, identidad: 1, metas: 3, revisiones: 1 })
  const d = await ciclo.diaDelCiclo(u)
  assert.equal(d.ciclo.id, 'ciclo_b')
  assert.equal(d.dia, 22)
  assert.equal(d.fase.foco, 'Disciplina')
  assert.equal((await ciclo.resumenMetas(u)).cumplidas[0].id, 'meta_2')
  assert.equal(await ciclo.ajusteParaHoy(u), 'Levantarme 7:00')
  const otra = await ciclo.importar(u, vieja)
  assert.deepEqual([otra.ciclos, otra.fases, otra.objetivos, otra.atributos, otra.metas, otra.revisiones], [0, 0, 0, 0, 0, 0], 'lo repetido no entra')
})

test('rutas: pantallas y API con sesión', async () => {
  const app = crearApp({ logger: false })
  assert.equal((await app.inject({ url: '/api/ciclo' })).statusCode, 401)
  const r = await app.inject({ method: 'POST', url: '/api/sesion/crear-cuenta', payload: { nombre: 'Web', email: 'webciclo@prueba.com', clave: 'clave-segura' } })
  const cookie = r.headers['set-cookie'].split(';')[0]
  const pide = (method, url, payload) => app.inject({ method, url, payload, headers: { cookie } })
  for (const p of ['/ciclo', '/ciclo/metas', '/ciclo/identidad', '/ciclo/revision', '/m/ciclo/ciclo.js', '/m/ciclo/estilo.css']) {
    assert.equal((await pide('GET', p)).statusCode, 200, p)
  }
  const vacio = (await pide('GET', '/api/ciclo')).json()
  assert.equal(vacio.ciclo, null)
  assert.equal(vacio.atributos.length, 5, 'la cuenta nueva se sembró')
  const con = (await pide('POST', '/api/ciclo/iniciar', { inicio: HOY })).json()
  assert.equal(con.dia, 1)
  assert.equal(con.fases.length, 3)
  assert.equal((await pide('POST', '/api/ciclo/iniciar', { inicio: 'ayer' })).statusCode, 400)
  const conObj = (await pide('POST', '/api/ciclo/objetivos', { faseNumero: 1, atributoId: 'disciplina', titulo: 'Cumplir 80 %', indicador: '% cumplido' })).json()
  assert.equal(conObj.fases[0].objetivos.length, 1)
  assert.equal((await pide('POST', `/api/ciclo/fases/${con.fases[0].id}/cerrar`, { notas: 'x' })).statusCode, 400)
  const m = (await pide('POST', '/api/ciclo/metas', { titulo: 'Leer', fecha: HOY })).json()
  const res = (await pide('POST', `/api/ciclo/metas/${m.vencidas[0].id}/resolver`, { lograda: true })).json()
  assert.equal(res.resultado.xp, 15)
  const rev = (await pide('POST', '/api/ciclo/revision', { tipo: 'diaria', periodo: HOY, respuestas: { obstaculo: 'Ninguno', ajuste: 'Seguir' } })).json()
  assert.equal(rev.nueva, true)
  const leida = (await pide('GET', `/api/ciclo/revision?tipo=diaria&fecha=${HOY}`)).json()
  assert.equal(leida.revision.respuestas.ajuste, 'Seguir')
  assert.ok(leida.obstaculos.includes('Ninguno'))
  // Desde que existe dia, guardar la revisión completa su pilar y da 10 XP (escucha `ciclo.revision`).
  assert.deepEqual(leida.hechos, [{ que: 'Meta: Leer', xp: 15 }, { que: 'Revisión diaria', xp: 10 }], 'lo que sumó XP hoy')
  assert.equal(leida.revision.foto.balance.mas, 15, 'la foto sale de xp si no viene')
  const semana = (await pide('GET', '/api/ciclo/revision?tipo=semanal')).json()
  assert.equal(semana.periodo, HOY, 'hoy es lunes')
  assert.equal(semana.xpTotal, 25) // meta 15 + revisión diaria 10 (dia)
  assert.equal(semana.porDia[1].xp, null, 'el martes todavía no llegó')
  const dia = (await pide('GET', '/api/ciclo/dia?fecha=2026-12-24')).json()
  assert.equal(dia.dia.faseNumero, 2)
  await app.close()
})

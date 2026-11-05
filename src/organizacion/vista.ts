/**
 * Pantalla de Organización, en JavaScript simple (sin React). La app madre la monta así:
 *
 *   const o = montarOrganizacion(lugar, { almacen, tema, nombre, hoy, alAvisar })
 *   …
 *   o.desmontar()
 *
 * Basada en el prototipo «Frentes» v14 (v0.6.4). Todo se dibuja con plantillas de texto y un solo
 * manejador de clics por capa, para que sea fácil de leer y cambiar.
 */
import './estilos.css'
import type { Almacen } from './almacen'
import type { Aviso, DatosOrganizacion, Dia, Frente, ItemBandeja, Tarea } from './tipos'
import { prepararTema, type TemaListo, type TemaOrganizacion } from './tema'
import * as M from './modelo'
import { sugerir } from './sugerir'

export interface OpcionesOrganizacion {
  almacen: Almacen
  tema?: Partial<TemaOrganizacion>
  /** Nombre de la persona («Navil → Facu»). */
  nombre?: string
  /** Día de hoy («AAAA-MM-DD»). Por defecto, el del teléfono. */
  hoy?: () => Dia
  /** Avisos para la app madre (tarea hecha, creada…). */
  alAvisar?: (aviso: Aviso, detalle: { frente?: Frente; tarea?: Tarea }) => void
  /** Distancia del botón «+» al borde de abajo (para no tapar la barra de la app). CSS. */
  abajo?: string
  /** Abrir algo al entrar: 'anotar' o el id de un frente. */
  abrir?: string
}

export interface Montado {
  desmontar(): void
  /** Vuelve a leer del almacén y redibuja. */
  refrescar(): Promise<void>
}

export const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)

const DONDE = { celu: ['icono-celu', 'Con el celular', 'Celu'], compu: ['icono-compu', 'Compu o taller', 'Compu'], calle: ['icono-calle', 'En la calle', 'Calle'] } as const
const IMP = { alta: ['icono-importancia-alta', 'Importante'], media: ['icono-importancia-media', 'Medio'], baja: ['icono-importancia-baja', 'Operativo'] } as const
const RAP = { rapida: ['icono-rapida', 'Rápida'], lenta: ['icono-lenta', 'Lleva tiempo'] } as const
const QUIEN = { yo: ['icono-yo', 'Yo'], delegar: ['icono-delegar', 'Delegar'], alguien: ['icono-con-alguien', 'Con alguien'] } as const

// ---------- Piezas compartidas con la tira de Hoy ----------

export function icoFrente(T: TemaListo, f: Frente): string {
  return f.tipo === 'sueltas' ? T.I('icono-sueltas') : esc(f.icono)
}

export function chipTarea(T: TemaListo, f: Frente, t: Tarea, hoy: Dia): string {
  const c = t.fecha ? M.cuando(t.fecha, hoy) : ''
  return `<div class="fr-chip-tarea" style="--c:${esc(f.color)}" data-tarea="${esc(f.id)}|${esc(t.id)}">
    <div class="fr-txt"><div class="fr-de"><span>${icoFrente(T, f)}</span>${esc(f.nombre)}${c ? ` · <span class="${c === 'hoy' || c === 'atrasada' ? 'fr-vence' : ''}">${c}</span>` : ''}</div><div class="fr-t">${esc(t.texto)}</div></div>
    <button class="fr-btn-ok" data-hecho="${esc(f.id)}|${esc(t.id)}" aria-label="Marcar hecha: ${esc(t.texto)}">${T.I('icono-hecho')}</button></div>`
}

function cargar(almacen: Almacen, hoy: Dia): Promise<DatosOrganizacion> {
  return almacen.leer().then((x) => M.normalizar(x, hoy), () => M.datosIniciales(hoy))
}

// ---------- Pantalla completa ----------

export function montarOrganizacion(lugar: HTMLElement, op: OpcionesOrganizacion): Montado {
  const T = prepararTema(op.tema)
  const hoyDe = op.hoy ?? (() => M.diaLocal())
  const yo = () => esc(op.nombre?.trim() || 'Yo')
  let datos: DatosOrganizacion = M.datosIniciales(hoyDe())
  let listo = false
  const ui: { editando: boolean; abierto: string | null; verHoy: boolean; clas: M.Clasificacion; clasId: string | null; cargaFrente: string; confirmar: string | null } =
    { editando: false, abierto: null, verHoy: false, clas: { quien: 'yo' }, clasId: null, cargaFrente: '', confirmar: null }
  const pila: string[] = []

  // Raíz en el lugar, y una capa aparte en <body> para la hoja, el «+» y el aviso (así nada los tapa).
  const raiz = document.createElement('div')
  raiz.className = 'fr'
  const capas = document.createElement('div')
  capas.className = 'fr fr-capas'
  capas.style.setProperty('--fr-abajo', op.abajo ?? '18px')
  T.pintar(raiz)
  T.pintar(capas)
  capas.innerHTML = `<button class="fr-fab" data-anotar aria-label="Anotar algo">+</button><div class="fr-velo" data-cerrar></div>
    <div class="fr-hoja" role="dialog" aria-modal="true"><div class="fr-hoja-in"></div></div>
    <div class="fr-toast" role="status"><span class="fr-toast-t"></span><button data-deshacer>↩ Deshacer</button></div>`
  lugar.appendChild(raiz)
  document.body.appendChild(capas)
  const hojaIn = capas.querySelector('.fr-hoja-in') as HTMLElement

  const fr = (id: string) => M.buscarFrente(datos, id)
  const avisar = (a: Aviso, detalle: { frente?: Frente; tarea?: Tarea }) => { try { op.alAvisar?.(a, detalle) } catch { /* la app madre no rompe esto */ } }

  function guardar() {
    op.almacen.guardar(datos).catch(() => toast('No se pudo guardar. Probá de nuevo.', false))
  }
  function snap() {
    pila.push(JSON.stringify(datos))
    if (pila.length > 60) pila.shift()
  }
  function deshacer() {
    const v = pila.pop()
    if (!v) return
    datos = JSON.parse(v)
    guardar()
    todo()
    toast('Listo, volví atrás', false)
  }
  let tt: ReturnType<typeof setTimeout> | undefined
  function toast(m: string, conDeshacer = true) {
    const el = capas.querySelector('.fr-toast') as HTMLElement
    ;(el.querySelector('.fr-toast-t') as HTMLElement).textContent = m
    ;(el.querySelector('button') as HTMLElement).hidden = !conDeshacer
    el.classList.add('on')
    clearTimeout(tt)
    tt = setTimeout(() => el.classList.remove('on'), 3200)
  }

  // ---------- Partes de la pantalla ----------

  const resp = (t: Tarea) => {
    const q = t.quien || 'yo'
    const o = t.quienNombre ? esc(t.quienNombre) : '¿quién?'
    return q === 'delegar' ? `<span class="fr-resp fr-delegada">${yo()}${T.I('icono-flecha')}<b>${o}</b></span>`
      : q === 'alguien' ? `<span class="fr-resp fr-lazo">${yo()}${T.I('icono-con-alguien')}<b>${o}</b></span>`
      : `<span class="fr-resp">${T.I('icono-yo')}${yo()}</span>`
  }

  function tareaHTML(f: Frente, t: Tarea) {
    const hoy = hoyDe()
    const hecho = t.estado === 'hecho'
    const meToca = M.toca(t, hoy)
    return `<div class="fr-tarea${hecho ? ' fr-hecha' : ' fr-pendiente'}${meToca ? ' fr-toca' : ''}">
      <button class="fr-est" data-ciclo="${esc(f.id)}|${esc(t.id)}" aria-label="${hecho ? 'Hecha. Tocá para volver a por hacer' : 'Por hacer. Tocá para marcar hecha'}">${T.I(hecho ? 'icono-hecho' : 'icono-por-hacer')}</button>
      <div class="fr-tx" data-ficha="${esc(f.id)}|${esc(t.id)}" role="button" tabindex="0"><span>${esc(t.texto)}</span>
      <small class="fr-sub">${resp(t)}${t.fecha && !hecho ? `<span>· ${M.cuando(t.fecha, hoy)}</span>` : ''}</small></div>
      ${hecho ? `<span class="fr-hanko" aria-hidden="true">${T.K('icono-sello-hecho') || '✓'}</span>` : ''}</div>`
  }

  function enso(p: number, c: string) {
    const L = 138
    return `<div class="fr-enso"><svg width="52" height="52" viewBox="0 0 52 52" aria-hidden="true"><circle cx="26" cy="26" r="22" fill="none" stroke="var(--fr-tarjeta-2)" stroke-width="5"/><circle class="fr-arco" cx="26" cy="26" r="22" fill="none" stroke="${esc(c)}" stroke-width="5" stroke-linecap="round" stroke-dasharray="${L}" stroke-dashoffset="${L - (L * p) / 100}" transform="rotate(-100 26 26)"/></svg><b>${p}%</b></div>`
  }

  function cabecera() {
    const hoy = hoyDe()
    const m = M.meToca(datos, hoy)
    const r = M.resumen(datos, hoy)
    const [a, mes, d] = hoy.split('-').map(Number)
    const f = new Intl.DateTimeFormat('es-AR', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(a, mes - 1, d))
    const lista = m.slice(0, 3).map((x) => x.t.texto.charAt(0).toLowerCase() + x.t.texto.slice(1))
    const kj = T.K('icono-organizacion')
    return `<header class="fr-cab">
      <div class="fr-barra"><div class="fr-marca">${kj ? `<span class="fr-kj fr-sombra" aria-hidden="true">${kj}</span>` : ''}Organización</div>
        ${pila.length ? '<button class="fr-pill" data-deshacer>↩ Deshacer</button>' : ''}
        <button class="fr-pill" data-personalizar aria-pressed="${ui.editando}">${ui.editando ? '✔ Listo' : '✏ Personalizar'}</button></div>
      <div class="fr-fecha">${esc(f.charAt(0).toUpperCase() + f.slice(1))}</div>
      <p class="fr-saludo">${m.length ? `Hoy tenés <em>${m.length} ${m.length === 1 ? 'cosa' : 'cosas'}</em>: ${esc(lista.join(', '))}${m.length > 3 ? ' y más' : ''}.` : 'Hoy no te toca nada. <em>Buen día para adelantar.</em>'}</p>
    </header>
    <section class="fr-stats" aria-label="Resumen">
      <div><b class="${r.meToca ? 'fr-rojo' : ''}">${r.meToca}</b><span>Me toca a mí</span><small>hoy</small></div>
      <div><b>${r.bandeja}</b><span>Bandeja</span><small>sin clasificar</small></div>
      <div><b>${r.porcentaje}<small class="fr-pc">%</small></b><span>Hecho</span><small>${r.hechas} de ${r.total}</small></div>
      <div class="fr-barra-av"><i style="width:${r.porcentaje}%"></i></div></section>`
  }

  function bandeja() {
    const B = datos.bandeja
    if (!B.length) return ''
    const kj = T.K('icono-bandeja')
    return `<div class="fr-bandeja">${kj ? `<span class="fr-kj" aria-hidden="true">${kj}</span>` : ''}<div class="fr-bt"><b>Bandeja · ${B.length} sin clasificar</b><span>${esc(B[0].texto)}</span></div><button class="fr-primario" data-clasificar>Clasificar</button></div>`
  }

  function hoyMeToca() {
    const hoy = hoyDe()
    const L = datos.ajustes.limiteHoy || 3
    const todas = M.meToca(datos, hoy)
    const m = ui.verHoy ? todas : todas.slice(0, L)
    const resto = todas.length - L
    const kj = T.K('icono-hoy')
    return `<section class="fr-hoy"><div class="fr-hoy-cab">${kj ? `<span class="fr-kj fr-sombra" aria-hidden="true">${kj}</span>` : ''}<h2 class="fr-subr">Hoy me toca a mí</h2><span class="fr-etq">${todas.length ? todas.length + ' en total' : ''}</span>
      <span class="fr-limite" aria-label="Cuántas mostrar a la vez"><button data-limite="-1" aria-label="Mostrar una menos">−</button><span>muestra ${L}</span><button data-limite="1" aria-label="Mostrar una más">+</button></span></div>
      <div class="fr-tira">${m.length ? m.map(({ f, t }) => chipTarea(T, f, t, hoy)).join('') + (resto > 0 ? `<button class="fr-mas" data-verhoy>${ui.verHoy ? 'Mostrar ' + L : '+' + resto + ' después'}</button>` : '') : '<div class="fr-vacio">Nada urgente de tu lado. Mirá los frentes de abajo.</div>'}</div></section>`
  }

  function controles() {
    const v = datos.ajustes.vista
    return `<div class="fr-controles"><div class="fr-seg" role="group" aria-label="Qué mostrar"><button data-vista="todo" aria-pressed="${v === 'todo'}">Todo</button><button data-vista="solo" aria-pressed="${v === 'solo'}">Me toca a mí</button></div></div>`
  }

  function tablero() {
    const hoy = hoyDe()
    const solo = datos.ajustes.vista === 'solo'
    const tocaF = (f: Frente) => f.tareas.some((t) => M.toca(t, hoy))
    const visibles = solo ? datos.frentes.filter(tocaF) : datos.frentes
    const SU = visibles.find((f) => f.tipo === 'sueltas')
    const fs = visibles.filter((f) => f.tipo !== 'sueltas')
    let h = ''
    if (SU) {
      const ts = (solo ? SU.tareas.filter((t) => M.toca(t, hoy)) : SU.tareas.filter((t) => t.estado !== 'hecho')).sort((a, b) => (a.fecha ?? '9').localeCompare(b.fecha ?? '9'))
      const kj = T.K('icono-sueltas-fondo')
      h += `<section class="fr-sueltas" data-abrir="${SU.id}" role="button" tabindex="0" aria-label="Sueltas: ${ts.length} cosas sin proyecto">${kj ? `<span class="fr-kj fr-s-kj" aria-hidden="true">${kj}</span>` : ''}
        <div class="fr-s-cab"><span class="fr-s-ic">${T.I('icono-sueltas')}</span><span class="fr-s-nom">${esc(SU.nombre)}<small>cosas sin proyecto · ${ts.length}</small></span></div>
        <div class="fr-s-lista">${ts.length ? ts.slice(0, M.LIMITE_SUELTAS).map((t) => tareaHTML(SU, t)).join('') : '<p class="fr-s-vacio">Nada suelto. Volá libre.</p>'}</div>${ts.length > M.LIMITE_SUELTAS ? `<div class="fr-s-mas">+${ts.length - M.LIMITE_SUELTAS} más</div>` : ''}</section>`
    }
    if (!fs.length && !SU) h = '<div class="fr-vacio">Ningún frente tiene algo que te toque. Tocá «Todo».</div>'
    else {
      h += '<div class="fr-grid">' + fs.map((f) => {
        const p = M.proxima(f, hoy)
        const quieto = M.diasEntre(f.movido, hoy)
        return `<div class="fr-frente" role="button" tabindex="0" style="--c:${esc(f.color)}" data-abrir="${esc(f.id)}">
          <div class="fr-f-cab"><span class="fr-f-ic">${icoFrente(T, f)}</span><span class="fr-f-nom">${esc(f.nombre)}<small>${esc(f.sub || '')}</small></span>${enso(M.avance(f), f.color)}</div>
          <div class="fr-prox"><span class="fr-etq">Sigue</span><span>${p ? `<strong>${esc(p.texto)}</strong>` : 'Todo hecho'}</span></div>
          <div class="fr-f-pie">${quieto >= 7 ? `<span class="fr-quieto">${quieto} días quieto</span>` : '<span></span>'}<span class="fr-mover"><button data-mover="${esc(f.id)}|-1" aria-label="Subir ${esc(f.nombre)}">↑</button><button data-mover="${esc(f.id)}|1" aria-label="Bajar ${esc(f.nombre)}">↓</button></span></div></div>`
      }).join('') + (ui.editando ? '<button class="fr-nuevo-frente" data-nuevofrente>+ Nuevo frente</button>' : '') + '</div>'
    }
    const A = datos.archivados
    if (A.length) h += `<details class="fr-finalizados"><summary>Finalizados · ${A.length}</summary>${A.map((f) => `<div class="fr-fin-fila"><span>${icoFrente(T, f)} ${esc(f.nombre)} · ${f.tareas.filter((t) => t.estado === 'hecho').length}/${f.tareas.length} hechas</span><span class="fr-acc-elim">${confirmarHTML(f) || `<button class="fr-secundario" data-reabrir="${esc(f.id)}">Reabrir</button><button class="fr-peligro fr-mini" data-eliminar="${esc(f.id)}" aria-label="Eliminar ${esc(f.nombre)}">✕</button>`}</span></div>`).join('')}</details>`
    return `<section class="fr-tablero${ui.editando ? ' fr-editando' : ''}" aria-label="Tablero de frentes">${h}</section>`
  }

  function leyenda() {
    const fila = (ic: string, n: string, cl = '') => `<div><span class="${cl}">${T.I(ic)}</span>${n}</div>`
    return `<details class="fr-leyenda-caja"><summary>¿Qué significa cada ícono?</summary><div class="fr-leyenda">
      <h4>Estado (tocá el círculo para marcar hecha)</h4>${fila('icono-por-hacer', 'Por hacer')}${fila('icono-hecho', 'Hecho')}
      <h4>Importancia</h4>${Object.entries(IMP).map(([k, [ic, n]]) => fila(ic, n, 'fr-imp-' + k)).join('')}
      <h4>Rapidez</h4>${Object.values(RAP).map(([ic, n]) => fila(ic, n)).join('')}
      <h4>Quién</h4>${fila('icono-yo', 'Yo')}${fila('icono-delegar', 'Delegar')}${fila('icono-con-alguien', 'Necesito a alguien')}
      <h4>Dónde se hace</h4>${Object.values(DONDE).map(([ic, n]) => fila(ic, n)).join('')}${fila('icono-sin-donde', 'Sin dónde')}
      <h4>Fecha</h4>${fila('icono-punto', 'Hoy, mañana o vencida', 'fr-f-rojo')}${fila('icono-punto', 'En 2 o 3 días', 'fr-f-amar')}${fila('icono-punto', 'Más adelante', 'fr-f-verde')}${fila('icono-libre', 'Libre, sin apuro')}
    </div></details>`
  }

  function confirmarHTML(f: Frente) {
    if (ui.confirmar !== f.id) return ''
    const n = f.tareas.length
    return `<span class="fr-confirmar"><span>¿Eliminar «${esc(f.nombre)}»${n ? ` y sus ${n} tareas` : ''}?</span><button class="fr-peligro" data-eliminar-si="${esc(f.id)}">Sí, eliminar</button><button class="fr-secundario" data-eliminar-no>Cancelar</button></span>`
  }

  // ---------- Hojas (lo que sube desde abajo) ----------

  const KJ = (campo: string) => {
    const k = T.K('kanji-' + campo)
    return k ? `<span class="fr-kj fr-sombra fr-sec-kj" aria-hidden="true">${k}</span>` : ''
  }
  const seccion = (campo: string, kanji: string, titulo: string, inner: string) =>
    `<section class="fr-seccion fr-req" data-campo="${campo}"><div class="fr-sec-cab">${KJ(kanji)}<span class="fr-sec-t">${titulo}</span><span class="fr-tilde" aria-hidden="true">✔</span></div>${inner}</section>`

  function hojaFrente(f: Frente) {
    const hoy = hoyDe()
    const pend = f.tareas.filter((t) => t.estado !== 'hecho').sort((a, b) => (M.toca(b, hoy) ? 1 : 0) - (M.toca(a, hoy) ? 1 : 0))
    const hechas = f.tareas.filter((t) => t.estado === 'hecho')
    const kj = T.K('icono-sueltas-fondo')
    hojaIn.innerHTML = `<div class="fr-asa"></div><div class="fr-h-cab"><span class="fr-f-ic" style="--c:${esc(f.color)}">${icoFrente(T, f)}</span><h3>${ui.editando && f.tipo !== 'sueltas' ? `<input class="fr-linea fr-nombre" data-nombre-frente="${esc(f.id)}" value="${esc(f.nombre)}" aria-label="Nombre del frente">` : esc(f.nombre)}</h3>${f.tipo === 'sueltas' ? (kj ? `<span class="fr-kj fr-sombra fr-sec-kj" aria-hidden="true">${kj}</span>` : '') : enso(M.avance(f), f.color)}<button class="fr-cerrar" data-cerrar aria-label="Cerrar">✕</button></div>
      ${ui.editando && f.tipo !== 'sueltas' ? `<div class="fr-grupo"><span class="fr-etq">Color</span><div class="fr-chips">${M.COLORES.map((c) => `<button class="fr-swatch" style="--c:${c}" data-color="${esc(f.id)}|${c}" aria-pressed="${c === f.color}" aria-label="Color ${c}"></button>`).join('')}</div><span class="fr-etq">Ícono</span><div class="fr-chips">${M.ICONOS_FRENTE.map((e) => `<button class="fr-chip" data-icono="${esc(f.id)}|${e}" aria-pressed="${e === f.icono}">${e}</button>`).join('')}</div></div>` : ''}
      <form class="fr-agregar" data-agregar="${esc(f.id)}" autocomplete="off"><input class="fr-linea" name="texto" placeholder="${f.tipo === 'sueltas' ? 'Agregar algo suelto…' : 'Agregar una parte o tarea…'}" aria-label="Nueva tarea en ${esc(f.nombre)}"><button class="fr-primario" type="submit">Agregar</button></form>
      ${pend.length ? `<div class="fr-grupo"><span class="fr-etq">Por hacer · ${pend.length}</span>${pend.map((t) => tareaHTML(f, t)).join('')}</div>` : ''}
      ${hechas.length ? `<details class="fr-historial"><summary>${T.I('icono-hecho')} Historial · ${hechas.length} hechas</summary><div class="fr-grupo">${hechas.map((t) => tareaHTML(f, t)).join('')}</div></details>` : ''}
      <div class="fr-grupo"><span class="fr-etq">Nota rápida</span><textarea class="fr-nota" data-nota="${esc(f.id)}" placeholder="Algo para acordarte de este frente…">${esc(f.nota || '')}</textarea></div>
      <p class="fr-ayuda">Tocá el círculo para marcarla hecha. Tocá el texto para ver y cambiar todo: quién, dónde, importancia, rapidez y fecha.</p>
      ${f.tipo === 'sueltas' ? '' : `<div class="fr-acc-f">${f.finalizado ? `<button class="fr-secundario" data-reabrir="${esc(f.id)}">Reabrir frente</button>` : `<button class="fr-secundario" data-finalizar="${esc(f.id)}">${T.I('icono-hecho')} Finalizar frente</button>`}<span class="fr-acc-elim">${confirmarHTML(f) || `<button class="fr-peligro" data-eliminar="${esc(f.id)}">✕ Eliminar frente</button>`}</span></div>`}`
  }

  function hojaTarea(fid: string, tid: string) {
    const x = M.buscarTarea(datos, fid, tid)
    if (!x) { cerrar(); return }
    const { f, t } = x
    const hoy = hoyDe()
    const botones = (campo: string, ops: [string, string][], val: string) =>
      ops.map(([k, txt]) => `<button class="fr-chip" data-set="${campo}|${k}" aria-pressed="${val === k}">${txt}</button>`).join('')
    const chips = (campo: string, ops: [string, string][], val: string) => `<div class="fr-chips">${botones(campo, ops, val)}</div>`
    const dias = t.fecha ? M.diasEntre(hoy, t.fecha) : null
    const fk = dias === null ? '' : dias === 0 ? 'hoy' : dias === 1 ? 'manana' : 'otra'
    hojaIn.innerHTML = `<div class="fr-asa"></div><div class="fr-h-cab"><button class="fr-volver" data-abrir="${esc(f.id)}">← ${icoFrente(T, f)} ${esc(f.nombre)}</button><span style="flex:1"></span><button class="fr-cerrar" data-cerrar aria-label="Cerrar">✕</button></div>
      <input class="fr-linea" data-ficha-texto="${esc(f.id)}|${esc(t.id)}" value="${esc(t.texto)}" aria-label="Texto de la tarea">
      ${t.estado === 'hecho' ? `<button class="fr-secundario fr-marcar" data-set="estado|por_hacer">${T.I('icono-por-hacer')} Volver a por hacer</button>` : `<button class="fr-primario fr-marcar" data-set="estado|hecho">${T.I('icono-hecho')} Marcar hecha</button>`}
      ${seccion('quien', 'quien', 'Quién', chips('quien', Object.entries(QUIEN).map(([k, [ic, n]]) => [k, T.I(ic) + ' ' + (k === 'alguien' ? 'Necesito a alguien' : n)]), t.quien || 'yo'))}
      ${t.quien && t.quien !== 'yo' ? `<input class="fr-linea" data-ficha-quien="${esc(f.id)}|${esc(t.id)}" value="${esc(t.quienNombre || '')}" placeholder="${t.quien === 'delegar' ? '¿A quién se la delegás?' : '¿A quién necesitás?'}">` : ''}
      ${seccion('donde', 'donde', 'Dónde se hace', chips('donde', [...Object.entries(DONDE).map(([k, [ic, n]]) => [k, T.I(ic) + ' ' + n] as [string, string]), ['', T.I('icono-sin-donde') + ' Sin dónde']], t.donde || ''))}
      ${seccion('imp', 'importancia', 'Importancia', chips('imp', [...Object.entries(IMP).map(([k, [ic, n]]) => [k, `<span class="fr-imp-${k}">${T.I(ic)}</span> ${n}`] as [string, string]), ['', 'Sin marcar']], t.imp || ''))}
      ${seccion('rapidez', 'rapidez', 'Rapidez', chips('rapidez', [...Object.entries(RAP).map(([k, [ic, n]]) => [k, T.I(ic) + ' ' + n] as [string, string]), ['', 'Sin marcar']], t.rapidez || ''))}
      ${seccion('fecha', 'fecha', 'Fecha', `<div class="fr-chips">${botones('fecha', [['hoy', 'Hoy'], ['manana', 'Mañana'], ['', T.I('icono-libre') + ' Libre']], fk)}<label class="fr-chip fr-fecha-otra" aria-pressed="${fk === 'otra'}">📅 <input type="date" data-ficha-fecha="${esc(f.id)}|${esc(t.id)}" value="${fk === 'otra' ? esc(t.fecha) : ''}" aria-label="Elegir fecha"></label></div>`)}
      ${seccion('frente', 'frente', 'Frente', chips('frente', datos.frentes.map((x) => [x.id, icoFrente(T, x) + ' ' + esc(x.nombre)]), f.id))}`
  }

  function hojaAnotar() {
    const sel = ui.cargaFrente
    hojaIn.innerHTML = `<div class="fr-asa"></div><div class="fr-h-cab"><h3>Anotar</h3><button class="fr-cerrar" data-cerrar aria-label="Cerrar">✕</button></div>
      <form class="fr-grupo" data-anotar-form autocomplete="off"><input class="fr-linea" name="texto" placeholder="Escribí y listo…" aria-label="Qué hay que hacer">
      <span class="fr-etq">¿De qué frente? (opcional)</span><div class="fr-chips"><button type="button" class="fr-chip" data-elegir="" aria-pressed="${!sel}">${T.K('icono-bandeja') || '▢'} Bandeja</button>${datos.frentes.map((f) => `<button type="button" class="fr-chip" style="--c:${esc(f.color)}" data-elegir="${esc(f.id)}" aria-pressed="${f.id === sel}">${icoFrente(T, f)} ${esc(f.nombre)}</button>`).join('')}</div>
      <button class="fr-primario" type="submit">Anotar</button>
      <p class="fr-ayuda">Todo va a Clasificar. Si elegís frente, ya queda marcado ahí. Podés anotar varias seguidas.</p></form>`
    setTimeout(() => (hojaIn.querySelector('input[name="texto"]') as HTMLInputElement | null)?.focus(), 250)
  }

  function hojaClasificar() {
    const B = datos.bandeja
    if (!B.length) {
      hojaIn.innerHTML = `<div class="fr-asa"></div><div class="fr-h-cab"><h3>Bandeja vacía</h3><button class="fr-cerrar" data-cerrar aria-label="Cerrar">✕</button></div><p class="fr-item-b">Todo clasificado. La cabeza, libre.</p><button class="fr-primario" data-cerrar>Listo</button>`
      return
    }
    const it: ItemBandeja = B[0]
    if (ui.clasId !== it.id) { ui.clasId = it.id; ui.clas = M.clasificacionPrevia(it) }
    const C = ui.clas
    const sg = sugerir(datos, it.texto)
    const chips = (campo: keyof M.Clasificacion, ops: [string, string][]) =>
      `<div class="fr-chips">${ops.map(([k, t]) => `<button type="button" class="fr-chip" data-clas="${campo}|${k}" aria-pressed="${C[campo] === k}">${t}</button>`).join('')}</div>`
    const fechaElegida = C.fecha && /-/.test(C.fecha) ? C.fecha : ''
    const hoy = hoyDe()
    hojaIn.innerHTML = `<div class="fr-asa"></div><div class="fr-h-cab"><h3>Clasificar</h3><span class="fr-cuenta">1 de ${B.length}</span><button class="fr-cerrar" data-cerrar aria-label="Cerrar">✕</button></div>
      <div class="fr-item-actual"><p class="fr-item-b">${esc(it.texto)}</p></div>
      <div class="fr-compacto">
      ${seccion('quien', 'quien', 'Quién', chips('quien', [['yo', T.I('icono-yo') + ' Yo'], ['delegar', T.I('icono-delegar') + ' Delegar'], ['alguien', T.I('icono-con-alguien') + ' Con alguien']]) + `<input class="fr-mini" data-clas-quien placeholder="¿A quién?" value="${esc(C.quienNombre || '')}" ${C.quien === 'yo' ? 'hidden' : ''} aria-label="Nombre de la persona">`)}
      ${seccion('imp', 'importancia', 'Importancia', chips('imp', Object.entries(IMP).map(([k, [ic, n]]) => [k, `<span class="fr-imp-${k}">${T.I(ic)}</span> ${n}`])))}
      ${seccion('rapidez', 'rapidez', 'Rapidez', chips('rapidez', Object.entries(RAP).map(([k, [ic, n]]) => [k, T.I(ic) + ' ' + n])))}
      ${seccion('donde', 'donde', 'Dónde', chips('donde', [...Object.entries(DONDE).map(([k, [ic, , c]]) => [k, T.I(ic) + ' ' + c] as [string, string]), ['nada', T.I('icono-sin-donde') + ' Sin dónde']]))}
      ${seccion('fecha', 'fecha', 'Fecha', `<div class="fr-chips">${[[hoy, 'Hoy'], [M.sumarDias(hoy, 1), 'Mañana'], ['libre', T.I('icono-libre') + ' Libre']].map(([k, t]) => `<button type="button" class="fr-chip" data-clas="fecha|${k}" aria-pressed="${C.fecha === k}">${t}</button>`).join('')}<label class="fr-chip fr-fecha-otra" aria-pressed="${!!fechaElegida && fechaElegida !== hoy && fechaElegida !== M.sumarDias(hoy, 1)}">📅 <input type="date" data-clas-fecha value="${esc(fechaElegida)}" aria-label="Elegir fecha"></label></div>`)}
      </div>
      <section class="fr-seccion fr-req"><div class="fr-sec-cab">${KJ('frente')}<span class="fr-sec-t">¿A qué frente va?</span><small class="fr-clas-aviso">al tocar se guarda</small></div>
      <div class="fr-destinos">${datos.frentes.map((f) => {
        const pre = it.frente === f.id
        const es = !pre && !it.frente && sg?.f === f
        return `<button class="fr-destino${es ? ' fr-sug' : ''}${pre ? ' fr-pre' : ''}" style="--c:${esc(f.color)}" data-a="${esc(f.id)}"><span>${icoFrente(T, f)}</span><span>${esc(f.nombre)}${pre ? '<small>lo elegiste al anotar</small>' : es ? `<small>¿será este? por «${esc(sg!.por.slice(0, 2).join('», «'))}»</small>` : ''}</span></button>`
      }).join('')}</div></section>
      <div class="fr-chips"><button class="fr-secundario" data-yalohice>✔ Ya lo hice (menos de 2 min)</button><button class="fr-secundario" data-tirar>Borrar</button></div>
      <label class="fr-interruptor"><input type="checkbox" data-sugerir ${datos.ajustes.sugerir ? 'checked' : ''}> Sugerir frente (aprende cuando elegís otro)</label>`
    marcarFaltas()
  }

  function marcarFaltas(fuerte = false) {
    const F = M.faltan(ui.clas)
    hojaIn.querySelectorAll<HTMLElement>('.fr-compacto .fr-seccion').forEach((sec) => {
      const mal = F.includes(sec.dataset.campo as M.CampoClasificar)
      sec.classList.toggle('fr-ok', !mal)
      sec.classList.toggle('fr-falta', mal && fuerte)
    })
    const a = hojaIn.querySelector('.fr-clas-aviso')
    if (a) a.textContent = F.length ? 'falta ' + F.length : 'listo, tocá uno'
    hojaIn.querySelector('.fr-destinos')?.classList.toggle('fr-bloq', F.length > 0)
    if (fuerte) {
      const p = hojaIn.querySelector('.fr-seccion.fr-falta')
      if (p) T.evento('alerta', { elemento: p })
    }
  }

  function abrir(cual: string) {
    ui.abierto = cual
    ui.confirmar = null
    if (cual === 'anotar') hojaAnotar()
    else if (cual === 'clasificar') hojaClasificar()
    else if (cual.startsWith('t:')) { const [a, b] = cual.slice(2).split('|'); hojaTarea(a, b) }
    else { const f = fr(cual); if (!f) return; hojaFrente(f) }
    const hoja = capas.querySelector('.fr-hoja') as HTMLElement
    const yaAbierta = hoja.classList.contains('on')
    hoja.classList.add('on')
    capas.querySelector('.fr-velo')!.classList.add('on')
    if (!yaAbierta) T.evento('aparecer', { elemento: hojaIn })
  }
  function cerrar() {
    ui.abierto = null
    ui.confirmar = null
    capas.querySelector('.fr-hoja')!.classList.remove('on')
    capas.querySelector('.fr-velo')!.classList.remove('on')
  }
  function redibujarHoja() {
    const a = ui.abierto
    if (!a) return
    if (a === 'anotar' || a === 'clasificar') return
    if (a.startsWith('t:')) { const [x, y] = a.slice(2).split('|'); hojaTarea(x, y) }
    else { const f = fr(a); if (f) hojaFrente(f); else cerrar() }
  }

  function todo() {
    if (!listo) { raiz.innerHTML = '<p class="fr-cargando">Cargando…</p>'; return }
    raiz.innerHTML = cabecera() + bandeja() + hoyMeToca() + controles() + tablero() + leyenda()
    redibujarHoja()
  }

  function cambio(fn: () => void, redibujar = true) {
    snap()
    fn()
    guardar()
    if (redibujar) todo()
  }

  function setEstado(fid: string, tid: string, estado: 'hecho' | 'por_hacer', el?: Element | null) {
    const hoy = hoyDe()
    const antes = M.meToca(datos, hoy).length
    if (!M.buscarTarea(datos, fid, tid)) return
    // El efecto va antes de redibujar: toma el lugar del elemento mientras todavía está en pantalla.
    if (estado === 'hecho') T.evento('completar', { elemento: el ?? null })
    let t: Tarea | null = null
    cambio(() => { t = M.marcar(datos, fid, tid, estado, hoy) })
    if (!t) return
    const tarea = t as Tarea
    avisar(estado === 'hecho' ? 'tarea.hecha' : 'tarea.cambiada', { frente: fr(fid), tarea })
    if (estado === 'hecho') {
      toast('Hecho: ' + tarea.texto)
      if (antes > 0 && !M.meToca(datos, hoy).length) { T.evento('logro', { texto: 'Terminaste todo lo de hoy' }); setTimeout(() => toast('¡Terminaste todo lo de hoy!', false), 900) }
    }
  }

  // ---------- Manejadores ----------

  function alClic(ev: Event) {
    const objetivo = ev.target as HTMLElement
    const b = objetivo.closest<HTMLElement>('button,[data-abrir],[data-ficha],[data-cerrar]')
    if (!b) return
    const d = b.dataset
    const hoy = hoyDe()
    if (d.mover) { ev.stopPropagation(); const [fid, dir] = d.mover.split('|'); cambio(() => M.moverFrente(datos, fid, Number(dir) as -1 | 1)); return }
    if (d.hecho) { const [f, t] = d.hecho.split('|'); setEstado(f, t, 'hecho', b.closest('.fr-chip-tarea')); return }
    if (d.ciclo) { ev.stopPropagation(); const [f, t] = d.ciclo.split('|'); const x = M.buscarTarea(datos, f, t); if (x) setEstado(f, t, x.t.estado === 'hecho' ? 'por_hacer' : 'hecho', b.closest('.fr-tarea')); return }
    if (d.ficha) { ev.stopPropagation(); abrir('t:' + d.ficha); return }
    if ('eliminarNo' in d) { ui.confirmar = null; todo(); return }
    if (d.eliminarSi) {
      const f = fr(d.eliminarSi)
      if (!f) return
      const n = f.nombre
      ui.confirmar = null
      cambio(() => M.eliminarFrente(datos, f.id))
      if (ui.abierto === f.id) cerrar()
      avisar('frente.cambiado', { frente: f })
      toast('Eliminado: ' + n)
      return
    }
    if (d.eliminar) { ev.stopPropagation(); ui.confirmar = d.eliminar; todo(); return }
    if (d.reabrir) { ev.stopPropagation(); let f: Frente | null = null; cambio(() => { f = M.reabrirFrente(datos, d.reabrir!, hoy) }); if (f) { toast('Reabierto: ' + (f as Frente).nombre); avisar('frente.cambiado', { frente: f }) } return }
    if (d.abrir) { if (ui.editando && objetivo.closest('input')) return; abrir(d.abrir); return }
    if ('cerrar' in d) { cerrar(); return }
    if ('anotar' in d) { ui.cargaFrente = ''; abrir('anotar'); return }
    if ('deshacer' in d) { deshacer(); capas.querySelector('.fr-toast')!.classList.remove('on'); return }
    if ('personalizar' in d) { ui.editando = !ui.editando; todo(); return }
    if (d.vista) { cambio(() => { datos.ajustes.vista = d.vista === 'solo' ? 'solo' : 'todo' }); return }
    if (d.limite) { cambio(() => M.cambiarLimite(datos, Number(d.limite))); return }
    if ('verhoy' in d) { ui.verHoy = !ui.verHoy; todo(); return }
    if ('clasificar' in d) { abrir('clasificar'); return }
    if ('nuevofrente' in d) { let f: Frente | null = null; cambio(() => { f = M.nuevoFrente(datos, hoy) }); if (f) { abrir((f as Frente).id); setTimeout(() => (hojaIn.querySelector('[data-nombre-frente]') as HTMLInputElement | null)?.select(), 300) } return }
    if (d.finalizar) { let f: Frente | null = null; cambio(() => { f = M.finalizarFrente(datos, d.finalizar!, hoy) }); if (f) { cerrar(); todo(); toast('Frente finalizado: ' + (f as Frente).nombre); avisar('frente.cambiado', { frente: f }) } return }
    if (d.color) { const [f, c] = d.color.split('|'); cambio(() => M.cambiarFrente(datos, f, { color: c })); return }
    if (d.icono) { const [f, c] = d.icono.split('|'); cambio(() => M.cambiarFrente(datos, f, { icono: c })); return }
    if (d.elegir !== undefined) { ui.cargaFrente = d.elegir; hojaIn.querySelectorAll('[data-elegir]').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); return }
    if (d.set) {
      if (!ui.abierto?.startsWith('t:')) return
      const [fid, tid] = ui.abierto.slice(2).split('|')
      const [campo, val] = d.set.split('|')
      if (campo === 'estado') { setEstado(fid, tid, val === 'hecho' ? 'hecho' : 'por_hacer', b); return }
      if (campo === 'frente') {
        if (val === fid) return
        let ok = false
        cambio(() => { ok = M.moverTarea(datos, fid, tid, val, hoy) })
        if (ok) { ui.abierto = 't:' + val + '|' + tid; redibujarHoja(); toast('Movida a ' + fr(val)?.nombre) }
        return
      }
      const v = campo === 'fecha' ? (val === 'hoy' ? hoy : val === 'manana' ? M.sumarDias(hoy, 1) : '') : val
      let t: Tarea | null = null
      cambio(() => { t = M.cambiarTarea(datos, fid, tid, { [campo]: v }, hoy) })
      if (t) avisar('tarea.cambiada', { frente: fr(fid), tarea: t })
      return
    }
    if (d.clas) {
      const [c, v] = d.clas.split('|') as [keyof M.Clasificacion, string]
      const C = ui.clas as Record<string, string | undefined>
      C[c] = c === 'quien' ? v : C[c] === v ? undefined : v
      hojaIn.querySelectorAll(`[data-clas^="${c}|"]`).forEach((x) => x.setAttribute('aria-pressed', String((x as HTMLElement).dataset.clas === c + '|' + C[c])))
      if (c === 'quien') { const q = hojaIn.querySelector<HTMLInputElement>('[data-clas-quien]'); if (q) { q.hidden = v === 'yo'; if (v !== 'yo') q.focus() } }
      if (c === 'fecha') { const o = hojaIn.querySelector('.fr-fecha-otra'); if (o) { o.setAttribute('aria-pressed', 'false'); (o.querySelector('input') as HTMLInputElement).value = '' } }
      marcarFaltas()
      return
    }
    if (d.a || 'yalohice' in d || 'tirar' in d) {
      const it = datos.bandeja[0]
      if (!it) return
      if (d.a && M.faltan(ui.clas).length) { marcarFaltas(true); toast('Falta: ' + M.faltan(ui.clas).map((k) => M.CAMPOS_CLASIFICAR[k]).join(', '), false); return }
      let msg = 'Borrada'
      let nueva: Tarea | null = null
      let destino: Frente | undefined
      cambio(() => {
        if (d.a) { nueva = M.clasificar(datos, it.id, d.a, ui.clas, hoy); destino = fr(d.a); msg = 'A ' + destino?.nombre }
        else if ('yalohice' in d) { const r = M.yaLoHice(datos, it.id, hoy); if (r) { nueva = r.t; destino = r.f; msg = 'Hecho y anotado en ' + r.f.nombre } }
        else M.borrarDeBandeja(datos, it.id)
      }, false)
      ui.clas = { quien: 'yo' }
      ui.clasId = null
      if (nueva) avisar((nueva as Tarea).estado === 'hecho' ? 'tarea.hecha' : 'tarea.creada', { frente: destino, tarea: nueva })
      const el = hojaIn.querySelector('.fr-item-actual')
      el?.classList.add('fr-sale')
      setTimeout(() => { hojaClasificar(); todo() }, 220)
      toast(msg)
      return
    }
  }

  function alEnviar(ev: Event) {
    const form = ev.target as HTMLFormElement
    if (!form.matches('[data-agregar],[data-anotar-form]')) return
    ev.preventDefault()
    const i = form.querySelector('input[name="texto"]') as HTMLInputElement
    const tx = i.value.trim()
    if (!tx) { i.focus(); return }
    const fid = form.dataset.agregar ?? (ui.cargaFrente || undefined)
    cambio(() => M.anotar(datos, tx, fid))
    i.value = ''
    if (form.dataset.agregar) { const f = fr(form.dataset.agregar); redibujarHoja(); setTimeout(() => (hojaIn.querySelector('input[name="texto"]') as HTMLInputElement | null)?.focus(), 30); toast('A Clasificar · ' + f?.nombre) }
    else { i.focus(); toast(fid ? 'A Clasificar · ' + fr(fid)?.nombre : 'A la Bandeja') }
  }

  function alEscribir(ev: Event) {
    const el = ev.target as HTMLInputElement
    if (el.matches('[data-clas-quien]')) { ui.clas.quienNombre = el.value.trim(); marcarFaltas() }
  }

  function alCambiar(ev: Event) {
    const el = ev.target as HTMLInputElement
    const hoy = hoyDe()
    if (el.matches('[data-clas-fecha]')) {
      ui.clas.fecha = el.value || undefined
      hojaIn.querySelectorAll('[data-clas^="fecha|"]').forEach((x) => x.setAttribute('aria-pressed', 'false'))
      el.closest('.fr-fecha-otra')?.setAttribute('aria-pressed', String(!!el.value))
      marcarFaltas()
      return
    }
    if (el.dataset.fichaFecha) { const [a, b] = el.dataset.fichaFecha.split('|'); cambio(() => M.cambiarTarea(datos, a, b, { fecha: el.value || undefined }, hoy)); return }
    if (el.matches('[data-sugerir]')) { cambio(() => { datos.ajustes.sugerir = el.checked }, false); hojaClasificar(); return }
  }

  function alSalir(ev: Event) {
    const el = ev.target as HTMLInputElement
    const hoy = hoyDe()
    if (el.dataset.fichaTexto) { const [a, b] = el.dataset.fichaTexto.split('|'); const x = M.buscarTarea(datos, a, b); const v = el.value.trim(); if (x && v && v !== x.t.texto) cambio(() => M.cambiarTarea(datos, a, b, { texto: v }, hoy)); return }
    if (el.dataset.fichaQuien) { const [a, b] = el.dataset.fichaQuien.split('|'); const x = M.buscarTarea(datos, a, b); const v = el.value.trim(); if (x && v !== (x.t.quienNombre || '')) cambio(() => M.cambiarTarea(datos, a, b, { quienNombre: v }, hoy)); return }
    if (el.dataset.nombreFrente) { const f = fr(el.dataset.nombreFrente); const v = el.value.trim(); if (f && v && v !== f.nombre) cambio(() => M.cambiarFrente(datos, f.id, { nombre: v })); return }
    if (el.dataset.nota) { const f = fr(el.dataset.nota); if (f && (f.nota || '') !== el.value) cambio(() => M.cambiarFrente(datos, f.id, { nota: el.value }), false); return }
  }

  function alTecla(ev: KeyboardEvent) {
    const el = ev.target as HTMLElement
    if (ev.key === 'Escape') { cerrar(); return }
    if ((ev.key === 'Enter' || ev.key === ' ') && el.tagName !== 'INPUT' && el.tagName !== 'TEXTAREA' && el.tagName !== 'BUTTON') {
      if (el.dataset.ficha) { ev.preventDefault(); abrir('t:' + el.dataset.ficha); return }
      if (el.dataset.abrir) { ev.preventDefault(); abrir(el.dataset.abrir); return }
    }
    if (ev.key === 'Enter' && el.tagName === 'INPUT' && !el.closest('form')) { ev.preventDefault(); (el as HTMLInputElement).blur() }
  }

  const escuchas: [string, (e: Event) => void][] = [['click', alClic], ['submit', alEnviar], ['input', alEscribir], ['change', alCambiar], ['focusout', alSalir], ['keydown', alTecla as (e: Event) => void]]
  for (const el of [raiz, capas]) for (const [n, fn] of escuchas) el.addEventListener(n, fn)

  async function refrescar() {
    datos = await cargar(op.almacen, hoyDe())
    listo = true
    todo()
  }

  todo()
  void refrescar().then(() => {
    if (op.abrir === 'anotar') abrir('anotar')
    else if (op.abrir && fr(op.abrir)) abrir(op.abrir)
  })

  return {
    desmontar() {
      clearTimeout(tt)
      for (const el of [raiz, capas]) for (const [n, fn] of escuchas) el.removeEventListener(n, fn)
      raiz.remove()
      capas.remove()
    },
    refrescar,
  }
}

// ---------- Tira compacta (para Hoy de SEK, o la pantalla de inicio de Tumi) ----------

export interface OpcionesTira extends Omit<OpcionesOrganizacion, 'abajo' | 'abrir'> {
  /** Qué hacer al tocar «Ver todo» (por ejemplo, ir a la pantalla de Organización). */
  alAbrir?: () => void
}

export function montarTiraHoy(lugar: HTMLElement, op: OpcionesTira): Montado {
  const T = prepararTema(op.tema)
  const hoyDe = op.hoy ?? (() => M.diaLocal())
  const raiz = document.createElement('div')
  raiz.className = 'fr fr-solo-tira'
  T.pintar(raiz)
  lugar.appendChild(raiz)
  let datos: DatosOrganizacion | null = null

  function dibujar() {
    if (!datos) { raiz.innerHTML = ''; return }
    const hoy = hoyDe()
    const L = datos.ajustes.limiteHoy || 3
    const m = M.meToca(datos, hoy)
    const kj = T.K('icono-organizacion')
    raiz.innerHTML = `<section class="fr-hoy fr-hoy-chica"><div class="fr-hoy-cab">${kj ? `<span class="fr-kj fr-sombra" aria-hidden="true">${kj}</span>` : ''}<h2 class="fr-subr">Hoy me toca a mí</h2><span class="fr-etq">${m.length ? m.length + ' en total' : ''}</span><button class="fr-pill fr-ver" data-ver>Organización ›</button></div>
      <div class="fr-tira">${m.length ? m.slice(0, L).map(({ f, t }) => chipTarea(T, f, t, hoy)).join('') + (m.length > L ? `<button class="fr-mas" data-ver>+${m.length - L} más</button>` : '') : `<div class="fr-vacio">Nada te toca hoy${datos.bandeja.length ? ` · ${datos.bandeja.length} en la Bandeja` : ''}.</div>`}</div></section>`
  }

  async function alClic(ev: Event) {
    const b = (ev.target as HTMLElement).closest<HTMLElement>('button')
    if (!b || !datos) return
    if ('ver' in b.dataset) { op.alAbrir?.(); return }
    if (b.dataset.hecho) {
      const [fid, tid] = b.dataset.hecho.split('|')
      const hoy = hoyDe()
      const t = M.marcar(datos, fid, tid, 'hecho', hoy)
      if (!t) return
      T.evento('completar', { elemento: b.closest('.fr-chip-tarea') })
      try { op.alAvisar?.('tarea.hecha', { frente: M.buscarFrente(datos, fid), tarea: t }) } catch { /* nada */ }
      await op.almacen.guardar(datos).catch(() => undefined)
      if (!M.meToca(datos, hoy).length) T.evento('logro', { texto: 'Terminaste todo lo de hoy' })
      setTimeout(dibujar, 650)
    }
  }
  raiz.addEventListener('click', alClic)

  async function refrescar() {
    datos = await cargar(op.almacen, hoyDe())
    dibujar()
  }
  void refrescar()
  return {
    desmontar() { raiz.removeEventListener('click', alClic); raiz.remove() },
    refrescar,
  }
}

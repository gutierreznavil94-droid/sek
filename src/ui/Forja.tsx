/**
 * Forja de hábitos en pantalla: fila de Hoy, sección de Mi código y línea de Progreso.
 * Las reglas están en services/forja; cómo se ve la piedra lo decide el tema (temas/forja.tsx).
 * SEK avisa con eventos genéricos: forja-paso, forja-pedazo y forja-completa.
 */
import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import type { HabitoForja } from '../data/tipos'
import { kanjiSugeridos, pedazosPara } from '../domain/forja'
import { abandonarHabito, alternarDiaForja, crearHabito, listarForja, type HabitoConEstado } from '../services/forja'
import { disparar } from '../temas/eventos'
import { PiedraHabito } from '../temas/forja'
import { celebrarNivel } from './animaciones/logros'
import { Confirmar, Hoja, movimientoReducido } from './componentes'
import { avisar, mutar, useDatos } from './estado'

const Juramento = lazy(() => import('./paginas/Juramento'))

/** Tocar = marcar (o desmarcar) hoy; mantener apretado = opciones. Devuelve los manejadores para el botón. */
function useToqueForja(h: HabitoForja, hoy: string, onForjado: (h: HabitoForja) => void, onOpciones: () => void) {
  const largo = useRef<number | null>(null)
  const fueLargo = useRef(false)
  useEffect(() => () => { if (largo.current) window.clearTimeout(largo.current) }, [])
  const soltar = () => { if (largo.current) { window.clearTimeout(largo.current); largo.current = null } }
  const tocar = async (el: Element | null) => {
    try {
      const r = await mutar(() => alternarDiaForja(h.id, hoy))
      if (r.marcado) {
        disparar('forja-paso', { elemento: el, texto: h.nombre })
        if (r.forjado) {
          disparar('forja-completa', { elemento: el, texto: h.nombre })
          avisar(`${h.kanji} ${h.nombre}: forjado. +${r.xp} XP`, { tipo: 'ok' })
          window.setTimeout(() => onForjado(r.habito), movimientoReducido() ? 200 : 1700)
        } else {
          if (r.pedazo) disparar('forja-pedazo', { elemento: el, texto: h.nombre })
          avisar(`${h.nombre}: día ${r.estado.validos} de ${r.estado.necesarios}${r.xp ? ` · +${r.xp} XP` : ''}`, { tipo: 'ok' })
        }
        if (r.nuevoNivel) celebrarNivel(r.nuevoNivel)
      } else avisar(`${h.nombre}: desmarcado hoy`)
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'No se pudo marcar')
    }
  }
  return {
    onPointerDown: () => { fueLargo.current = false; largo.current = window.setTimeout(() => { fueLargo.current = true; largo.current = null; onOpciones() }, 550) },
    onPointerUp: soltar,
    onPointerLeave: soltar,
    onPointerCancel: soltar,
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
    onClick: (e: React.MouseEvent) => { if (fueLargo.current) { fueLargo.current = false; return } void tocar(e.currentTarget) },
  }
}

function Opciones({ h, hoy, onCerrar }: { h: HabitoForja | null; hoy: string; onCerrar: () => void }) {
  const [abandonar, setAbandonar] = useState(false)
  return (
    <>
      <Hoja abierta={!!h && !abandonar} onCerrar={onCerrar} titulo={h ? `${h.kanji} ${h.nombre}` : ''}>
        <p className="chico texto-2">Tocá la piedra para marcar el día; tocá de nuevo hoy para desmarcarlo.</p>
        <button className="boton suave ancho" onClick={() => setAbandonar(true)}>Abandonar este hábito</button>
      </Hoja>
      <Confirmar
        abierta={abandonar}
        titulo="¿Abandonar este hábito?"
        texto="Sale de la forja. La XP que ganaste se queda."
        confirmar="Abandonar"
        peligro
        onConfirmar={async () => { if (h) await mutar(() => abandonarHabito(h.id, hoy)); setAbandonar(false); onCerrar(); avisar('Hábito abandonado') }}
        onCancelar={() => setAbandonar(false)}
      />
    </>
  )
}

function JuramentoForja({ h, onFin }: { h: HabitoForja | null; onFin: () => void }) {
  if (!h) return null
  return <Suspense fallback={null}><Juramento texto={h.nombre} grupo="鍛 Hábito forjado" kanjiSello={h.kanji} onFin={onFin} /></Suspense>
}

// ---------- Hoy: fila chica «鍛 En forja» ----------

function PiedraChica({ x, hoy, onForjado, onOpciones }: { x: HabitoConEstado; hoy: string; onForjado: (h: HabitoForja) => void; onOpciones: (h: HabitoForja) => void }) {
  const t = useToqueForja(x.habito, hoy, onForjado, () => onOpciones(x.habito))
  const e = x.estado
  return (
    <button type="button" className={`forja-chica ${e.hechoHoy ? 'hecho' : ''}`} {...t} aria-label={`${x.habito.nombre}: ${e.validos} de ${e.necesarios}. ${e.hechoHoy ? 'Hecho hoy' : 'Tocá si lo hiciste hoy'}`}>
      <PiedraHabito id={x.habito.id} kanji={x.habito.kanji} validos={e.validos} necesarios={e.necesarios} tam={42} reducido={movimientoReducido()} />
      <span className="forja-nombre">{x.habito.nombre}</span>
      <span className="forja-cuenta mono">{e.hechoHoy ? '✓ ' : ''}{e.validos} / {e.necesarios}</span>
    </button>
  )
}

export function FilaForjaHoy({ hoy }: { hoy: string }) {
  const datos = useDatos(() => listarForja(hoy), [hoy])
  const [opciones, setOpciones] = useState<HabitoForja | null>(null)
  const [jurado, setJurado] = useState<HabitoForja | null>(null)
  const lista = datos.datos?.enForja ?? []
  if (!lista.length && !jurado) return null
  return (
    <section className="forja-hoy" aria-label="Hábitos en forja">
      <span className="seccion-titulo"><span className="forja-kanji-titulo" aria-hidden>鍛</span>En forja <span className="seccion-nota">(tocá la piedra si lo hiciste hoy)</span></span>
      <div className="forja-fila">
        {lista.map((x) => <PiedraChica key={x.habito.id} x={x} hoy={hoy} onForjado={setJurado} onOpciones={setOpciones} />)}
      </div>
      <Opciones h={opciones} hoy={hoy} onCerrar={() => setOpciones(null)} />
      <JuramentoForja h={jurado} onFin={() => setJurado(null)} />
    </section>
  )
}

// ---------- Mi código: «鍛 En forja» grande + «誓 Ya forjados» ----------

function Camino({ x }: { x: HabitoConEstado }) {
  const marcas = new Set(pedazosPara(x.estado.necesarios))
  let validos = 0
  return (
    <div className="forja-camino" role="list" aria-label="Camino de la forja">
      {x.estado.camino.map((d, i) => {
        if (d.estado === 'cumplido' || d.estado === 'perdonado') validos++
        const pedazo = (d.estado === 'cumplido' || d.estado === 'perdonado') && marcas.has(validos)
        return <i key={d.fecha} role="listitem" className={`fc-dia ${d.estado} ${pedazo ? 'pedazo' : ''} ${i >= x.estado.duracion ? 'extra' : ''}`} title={`${d.fecha}: ${d.estado}`} />
      })}
    </div>
  )
}

function PiedraGrande({ x, hoy, onForjado, onOpciones }: { x: HabitoConEstado; hoy: string; onForjado: (h: HabitoForja) => void; onOpciones: (h: HabitoForja) => void }) {
  const t = useToqueForja(x.habito, hoy, onForjado, () => onOpciones(x.habito))
  const e = x.estado
  return (
    <div className="forja-grande">
      <button type="button" className="forja-grande-piedra" {...t} aria-label={`${x.habito.nombre}: tocá si lo hiciste hoy; mantené apretado para opciones`}>
        <PiedraHabito id={x.habito.id} kanji={x.habito.kanji} validos={e.validos} necesarios={e.necesarios} tam={96} reducido={movimientoReducido()} />
      </button>
      <div className="forja-grande-texto">
        <b>{x.habito.nombre}</b>
        <span className="chico texto-2">Día {Math.min(e.diaActual, e.duracion)} de {e.duracion} · <b className="texto">{e.validos}</b> / {e.necesarios} válidos</span>
        <span className="muy-chico texto-3">{e.completo ? 'Forjado' : `Faltan ${e.faltan}`} · {e.hechoHoy ? 'hoy ✓' : 'hoy sin marcar'} · {e.perdonUsadoSemana ? 'falla perdonada usada esta semana' : 'tenés 1 falla perdonada esta semana'}{e.cerradas ? ` · ${e.cerradas} grieta${e.cerradas > 1 ? 's' : ''} cerrada${e.cerradas > 1 ? 's' : ''}` : ''}</span>
        <Camino x={x} />
      </div>
    </div>
  )
}

function NuevoHabito({ abierta, hoy, onCerrar }: { abierta: boolean; hoy: string; onCerrar: () => void }) {
  const [nombre, setNombre] = useState('')
  const [kanji, setKanji] = useState('')
  const sugeridos = kanjiSugeridos(nombre)
  const elegido = kanji || sugeridos[0]
  const guardar = async () => {
    try {
      await mutar(() => crearHabito(nombre, elegido, hoy))
      avisar(`${elegido} ${nombre.trim()}: empieza la forja`, { tipo: 'ok' })
      setNombre(''); setKanji(''); onCerrar()
    } catch (e) { avisar(e instanceof Error ? e.message : 'No se pudo crear') }
  }
  return (
    <Hoja abierta={abierta} onCerrar={onCerrar} titulo="鍛 Forjar hábito">
      <div className="campo"><label>El hábito</label><input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej.: Leer 10 minutos" autoFocus /></div>
      <div className="campo">
        <label>Su kanji (queda escondido en la piedra)</label>
        <div className="forja-kanjis" role="radiogroup" aria-label="Kanji">
          {sugeridos.map((k) => <button key={k} type="button" role="radio" aria-checked={elegido === k} className={elegido === k ? 'activa' : ''} onClick={() => setKanji(k)}>{k}</button>)}
          <input className="forja-kanji-propio" value={sugeridos.includes(kanji) ? '' : kanji} onChange={(e) => setKanji([...e.target.value.trim()].slice(-1).join(''))} placeholder="Otro" aria-label="Escribir otro kanji" />
        </div>
      </div>
      <p className="ayuda">Dura 30 días. Se forja con 28 días válidos: cada semana te perdona 1 falla. +5 XP por día y +50 al forjarse.</p>
      <button className="boton primario ancho" disabled={!nombre.trim() || !elegido} onClick={() => void guardar()}>鍛 Empezar la forja</button>
    </Hoja>
  )
}

export function SeccionForjaCodigo({ hoy }: { hoy: string }) {
  const datos = useDatos(() => listarForja(hoy), [hoy])
  const [nuevo, setNuevo] = useState(false)
  const [opciones, setOpciones] = useState<HabitoForja | null>(null)
  const [jurado, setJurado] = useState<HabitoForja | null>(null)
  const d = datos.datos
  if (!d) return null
  const lleno = d.enForja.length >= d.config.maximo
  return (
    <>
      <section className="codigo-grupo forja-codigo" aria-label="En forja">
        <div className="codigo-grupo-titulo"><span className="codigo-grupo-kanji" aria-hidden>鍛</span><span className="codigo-grupo-nombre">En forja</span><svg className="codigo-grupo-trazo" viewBox="0 0 200 8" preserveAspectRatio="none" aria-hidden><path d="M2,5 C40,2 90,7 140,4 C170,2 190,5 198,4" /></svg></div>
        {d.enForja.map((x) => <PiedraGrande key={x.habito.id} x={x} hoy={hoy} onForjado={setJurado} onOpciones={setOpciones} />)}
        {!d.enForja.length && <p className="av-nota">Un hábito nuevo es una piedra dura. Cada día cumplido la agrieta; a los 28 días válidos se rompe y queda su kanji.</p>}
        <button type="button" className="boton ancho forja-nueva" onClick={() => (lleno ? avisar('Terminá uno antes de empezar otro') : setNuevo(true))}>+ Forjar hábito</button>
      </section>
      {d.forjados.length > 0 && (
        <section className="codigo-grupo forja-forjados" aria-label="Ya forjados">
          <div className="codigo-grupo-titulo"><span className="codigo-grupo-kanji" aria-hidden>誓</span><span className="codigo-grupo-nombre">Ya forjados</span><svg className="codigo-grupo-trazo" viewBox="0 0 200 8" preserveAspectRatio="none" aria-hidden><path d="M2,5 C40,2 90,7 140,4 C170,2 190,5 198,4" /></svg></div>
          {d.forjados.map((x) => (
            <div key={x.habito.id} className="codigo-regla forja-regla">
              <span className="forja-regla-kanji" aria-hidden>{x.habito.kanji}</span>
              <span className="codigo-texto">{x.habito.nombre}</span>
              <span className="codigo-otra">鍛 · forjado {x.habito.forjadoEn?.slice(8)}/{x.habito.forjadoEn?.slice(5, 7)}</span>
            </div>
          ))}
        </section>
      )}
      <NuevoHabito abierta={nuevo} hoy={hoy} onCerrar={() => setNuevo(false)} />
      <Opciones h={opciones} hoy={hoy} onCerrar={() => setOpciones(null)} />
      <JuramentoForja h={jurado} onFin={() => setJurado(null)} />
    </>
  )
}

// ---------- Progreso: «Códigos forjados: N» ----------

export function LineaForjados({ hoy }: { hoy: string }) {
  const datos = useDatos(() => listarForja(hoy), [hoy])
  const d = datos.datos
  if (!d || (!d.enForja.length && !d.forjados.length)) return null
  const todos = [...d.forjados, ...d.enForja]
  return (
    <div className="av-tarjeta forja-progreso" aria-label={`Códigos forjados: ${d.forjados.length}`}>
      <span className="chico"><span className="forja-kanji-titulo" aria-hidden>鍛</span>Códigos forjados: <b>{d.forjados.length}</b></span>
      <div className="forja-progreso-fila">
        {todos.map((x) => <PiedraHabito key={x.habito.id} id={x.habito.id} kanji={x.habito.kanji} validos={x.estado.validos} necesarios={x.estado.necesarios} tam={44} reducido conSonido={false} />)}
      </div>
    </div>
  )
}

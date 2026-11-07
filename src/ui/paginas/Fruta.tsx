/**
 * Fruta del día: la manzana chica al lado de la cantimplora, en la tarjeta de Comida.
 * Un toque suma 1 fruta (se muerde más); mantener apretado deshace la última. El dibujo es del tema.
 */
import { useEffect, useRef, useState } from 'react'
import type { FechaDia } from '../../domain/fechas'
import type { ConfigFruta } from '../../data/tipos'
import { comerFruta, configFruta, deshacerFruta, frutaDelDia, guardarConfigFruta, historialFruta, type EstadoFruta } from '../../services/fruta'
import { Manzana } from '../../temas/shinobi/Manzana'
import { brillo, type EstadoBrillo } from '../brillo'
import { Tarjeta } from '../componentes'
import { avisar, mutar, useDatos } from '../estado'

const BRILLO: Record<EstadoFruta, EstadoBrillo> = { pendiente: 'pendiente', cumplido: 'parcial', superado: 'maximo' }

export function TarjetaFruta({ hoy, conBrillo = true, indice = 0 }: { hoy: FechaDia; conBrillo?: boolean; indice?: number }) {
  const datos = useDatos(() => frutaDelDia(hoy), [hoy])
  const [suma, setSuma] = useState(false)
  const largo = useRef<number | null>(null)
  const fueLargo = useRef(false)
  useEffect(() => () => { if (largo.current) window.clearTimeout(largo.current) }, [])
  const d = datos.datos
  if (!d) return null
  const comer = async () => {
    const r = await mutar(() => comerFruta(hoy))
    setSuma(true)
    window.setTimeout(() => setSuma(false), 1400)
    if (r.recienSuperado) avisar(`${r.dia.objetivo2} ${r.dia.objetivo2 === 1 ? 'fruta' : 'frutas'} hoy: segundo objetivo. 果`, { tipo: 'ok' })
    else if (r.recienCumplido) avisar(`${r.dia.nombre}: primer objetivo cumplido`, { tipo: 'ok' })
  }
  const deshacer = async () => {
    if (d.n === 0) return
    const r = await mutar(() => deshacerFruta(hoy))
    avisar(`${r.nombre}: ${r.n} de ${r.objetivo2} (deshecha la última)`)
  }
  const empezar = () => {
    fueLargo.current = false
    largo.current = window.setTimeout(() => { fueLargo.current = true; void deshacer() }, 480)
  }
  const soltar = () => { if (largo.current) { window.clearTimeout(largo.current); largo.current = null } }
  const click = () => { if (fueLargo.current) { fueLargo.current = false; return } void comer() }
  const b = brillo(BRILLO[d.estado], indice, conBrillo)
  return (
    <button
      type="button"
      className={`agua-boton agua-chica fruta-chica fruta-${d.estado}`}
      {...b}
      onPointerDown={empezar}
      onPointerUp={soltar}
      onPointerLeave={soltar}
      onPointerCancel={soltar}
      onContextMenu={(e) => e.preventDefault()}
      onClick={click}
      aria-label={`${d.nombre}: ${d.n} de ${d.objetivo2}. Tocá para sumar una; mantené apretado para deshacer`}
    >
      <Manzana mordido={d.mordido} ancho={20} />
      <span className={`agua-chica-ml mono ${suma ? 'suma' : ''}`}>{suma ? '+1' : `${d.n}/${d.objetivo2}`}</span>
    </button>
  )
}

/** Más → Comida: nombre de la fruta y los dos objetivos (el dibujo sigue siendo la manzana). */
export function ConfigFrutaTarjeta() {
  const datos = useDatos(() => configFruta(), [])
  const d = datos.datos
  if (!d) return null
  const guardar = async (c: Partial<ConfigFruta>) => {
    try { await mutar(() => guardarConfigFruta(c)); avisar('Fruta guardada', { tipo: 'ok' }) } catch (e) { avisar(e instanceof Error ? e.message : String(e)) }
  }
  return (
    <Tarjeta titulo="Fruta del día">
      <p className="chico texto-2">La manzana de Hoy, al lado del agua: cada toque suma una y se muerde más. Mantené apretado para deshacer.</p>
      <div className="campo">
        <label htmlFor="fruta-nombre">Nombre</label>
        <input id="fruta-nombre" defaultValue={d.nombre} onBlur={(e) => { if (e.target.value.trim() !== d.nombre) void guardar({ nombre: e.target.value }) }} />
      </div>
      <div className="fila" style={{ gap: 10 }}>
        <div className="campo crece">
          <label htmlFor="fruta-o1">1.er objetivo</label>
          <input id="fruta-o1" type="number" inputMode="numeric" min={1} value={d.objetivo1} onChange={(e) => { const v = Number(e.target.value); if (v > 0) void guardar({ objetivo1: v, objetivo2: Math.max(v, d.objetivo2) }) }} />
        </div>
        <div className="campo crece">
          <label htmlFor="fruta-o2">2.º objetivo</label>
          <input id="fruta-o2" type="number" inputMode="numeric" min={d.objetivo1} value={d.objetivo2} onChange={(e) => { const v = Number(e.target.value); if (v > 0) void guardar({ objetivo2: v }) }} />
        </div>
      </div>
      <p className="ayuda">Con el 1.º la manzana queda bastante mordida y brilla verde titilando; con el 2.º queda solo el centro y brilla fijo.</p>
    </Tarjeta>
  )
}

/** Historial: últimos 14 días de fruta (en la pantalla de resumen de Comida). */
export function SeccionFruta({ hoy }: { hoy: FechaDia }) {
  const datos = useDatos(async () => ({ dias: await historialFruta(hoy), cfg: await configFruta() }), [hoy])
  const d = datos.datos
  if (!d) return null
  const semana = d.dias.slice(-7)
  const total = semana.reduce((s, x) => s + x.n, 0)
  return (
    <section className="av-tarjeta">
      <div className="fila entre"><b>{d.cfg.nombre}</b><span className="chico texto-2">objetivo {d.cfg.objetivo1} · extra {d.cfg.objetivo2}</span></div>
      <div className="sr-dias" aria-label="Últimos 14 días de fruta">
        {d.dias.map((x) => <span key={x.fecha} className={`sr-dia ${x.estado === 'superado' ? 'extra' : x.estado === 'cumplido' ? 'cuota' : x.n > 0 ? 'parcial' : 'no'} ${x.fecha === hoy ? 'hoy' : ''}`} title={`${x.fecha}: ${x.n}`} />)}
      </div>
      <p className="chico texto-2" style={{ margin: 0 }}>Últimos 7 días: <b>{total}</b> {total === 1 ? 'fruta' : 'frutas'}.</p>
    </section>
  )
}

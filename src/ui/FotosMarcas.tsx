/**
 * Progreso: «写 Fotos» (opcionales, con el día en que se cargan) y «印 Días marcados».
 * Calendario: mantener apretado un día → marcarlo con un texto corto.
 */
import { useRef, useState } from 'react'
import type { FotoProgreso, MarcaDia } from '../data/tipos'
import { fechaLegible } from '../domain/fechas'
import { agregarFoto, borrarFoto, listarFotos, marcarDia, quitarMarca } from '../services/fotos'
import { Confirmar, Hoja } from './componentes'
import { avisar, mutar, useDatos } from './estado'

/** Achica la foto antes de guardarla (máx. 1080 px de lado), en webp (o jpg si el celu no puede). */
async function achicar(archivo: File, lado = 1080): Promise<string> {
  const url = URL.createObjectURL(archivo)
  try {
    const img = await new Promise<HTMLImageElement>((ok, mal) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => mal(new Error('No se pudo leer la foto.')); i.src = url })
    const k = Math.min(1, lado / Math.max(img.naturalWidth, img.naturalHeight))
    const c = document.createElement('canvas')
    c.width = Math.round(img.naturalWidth * k)
    c.height = Math.round(img.naturalHeight * k)
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
    const webp = c.toDataURL('image/webp', 0.8)
    return webp.startsWith('data:image/webp') ? webp : c.toDataURL('image/jpeg', 0.82)
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** Toque corto / mantener apretado (550 ms). */
function useToque(corto: () => void, largo: () => void) {
  const t = useRef<number | null>(null)
  const fue = useRef(false)
  return {
    onPointerDown: () => { fue.current = false; t.current = window.setTimeout(() => { fue.current = true; t.current = null; largo() }, 550) },
    onPointerUp: () => { if (t.current) { window.clearTimeout(t.current); t.current = null } },
    onPointerLeave: () => { if (t.current) { window.clearTimeout(t.current); t.current = null } },
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
    onClick: () => { if (!fue.current) corto() },
  }
}

function Miniatura({ f, elegida, onAbrir, onBorrar }: { f: FotoProgreso; elegida: boolean; onAbrir: () => void; onBorrar: () => void }) {
  const t = useToque(onAbrir, onBorrar)
  return (
    <button type="button" className={`foto-mini ${elegida ? 'elegida' : ''}`} {...t} aria-label={`Foto del día ${f.dia || '—'}, ${fechaLegible(f.fecha)}`}>
      <img src={f.imagen} alt="" loading="lazy" />
      <span className="foto-dia">{f.dia ? `Día ${f.dia}` : fechaLegible(f.fecha)}</span>
    </button>
  )
}

export function TarjetaFotos({ hoy }: { hoy: string }) {
  const datos = useDatos(listarFotos, [])
  const entrada = useRef<HTMLInputElement>(null)
  const [vista, setVista] = useState<FotoProgreso | null>(null)
  const [borrar, setBorrar] = useState<FotoProgreso | null>(null)
  const [comparar, setComparar] = useState(false)
  const [elegidas, setElegidas] = useState<string[]>([])
  const fotos = datos.datos ?? []
  const subir = async (a: File | undefined) => {
    if (!a) return
    try {
      const img = await achicar(a)
      const f = await mutar(() => agregarFoto(img, hoy))
      avisar(`Foto guardada${f.dia ? ` · Día ${f.dia}` : ''}`, { tipo: 'ok' })
    } catch (e) {
      avisar(e instanceof Error ? e.message : String(e), { tipo: 'bajo' })
    }
    if (entrada.current) entrada.current.value = ''
  }
  const tocar = (f: FotoProgreso) => {
    if (!comparar) { setVista(f); return }
    setElegidas((l) => (l.includes(f.id) ? l.filter((x) => x !== f.id) : [...l.slice(-1), f.id]))
  }
  const par = elegidas.map((id) => fotos.find((f) => f.id === id)).filter((f): f is FotoProgreso => !!f)
  return (
    <section className="av-tarjeta fotos-tarjeta" aria-label="Fotos de progreso">
      <div className="av-tarjeta-titulo">
        <span><span className="camino-titulo-k" aria-hidden>写</span> Fotos</span>
        <span className="fila" style={{ gap: 6 }}>
          {fotos.length >= 2 && <button type="button" className={`boton chico ${comparar ? 'primario' : 'suave'}`} onClick={() => { setComparar(!comparar); setElegidas([]) }}>{comparar ? 'Listo' : 'Comparar'}</button>}
          <button type="button" className="boton chico" onClick={() => entrada.current?.click()}>+ Foto de hoy</button>
        </span>
      </div>
      <input ref={entrada} type="file" accept="image/*" hidden onChange={(e) => void subir(e.target.files?.[0])} />
      {fotos.length === 0 ? (
        <p className="av-nota" style={{ margin: 0 }}>Opcional: una foto el Día 1, otra el Día 20… queda con el día en que la cargás. Solo en este celu.</p>
      ) : (
        <>
          {comparar && <p className="av-nota" style={{ margin: '0 0 6px' }}>Elegí dos fotos para verlas lado a lado.</p>}
          <div className="fotos-fila">
            {fotos.map((f) => <Miniatura key={f.id} f={f} elegida={elegidas.includes(f.id)} onAbrir={() => tocar(f)} onBorrar={() => setBorrar(f)} />)}
          </div>
          {comparar && par.length === 2 && (
            <div className="fotos-par">
              {par.map((f) => <figure key={f.id}><img src={f.imagen} alt="" /><figcaption>{f.dia ? `Día ${f.dia}` : ''} · {fechaLegible(f.fecha)}</figcaption></figure>)}
            </div>
          )}
          {!comparar && <p className="av-nota muy-chico" style={{ margin: '4px 0 0' }}>Tocá para verla grande · mantené apretado para borrar.</p>}
        </>
      )}
      <Hoja abierta={!!vista} onCerrar={() => setVista(null)} titulo={vista ? `${vista.dia ? `Día ${vista.dia} · ` : ''}${fechaLegible(vista.fecha)}` : ''}>
        {vista && <img className="foto-grande" src={vista.imagen} alt="" />}
      </Hoja>
      <Confirmar abierta={!!borrar} titulo="¿Borrar esta foto?" texto="Se borra de este celu." confirmar="Borrar" peligro onCancelar={() => setBorrar(null)} onConfirmar={() => { const f = borrar!; setBorrar(null); void mutar(() => borrarFoto(f.id)).then(() => avisar('Foto borrada')) }} />
    </section>
  )
}

/** «印 Días marcados: N» en Progreso; abre la lista. */
export function LineaMarcas({ marcas }: { marcas: MarcaDia[] }) {
  const [abierta, setAbierta] = useState(false)
  if (!marcas.length) return null
  return (
    <>
      <button type="button" className="av-ninjas av-nota marcas-linea" onClick={() => setAbierta(true)}>
        <span className="marca-sello" aria-hidden>印</span> Días marcados: <b>{marcas.length}</b><span className="texto-3"> ›</span>
      </button>
      <Hoja abierta={abierta} onCerrar={() => setAbierta(false)} titulo="印 Días marcados">
        {marcas.map((m) => (
          <div key={m.fecha} className="fila chico marcas-item"><span className="marca-sello" aria-hidden>印</span><b>{fechaLegible(m.fecha)}</b><span className="texto-2">{m.texto}</span></div>
        ))}
      </Hoja>
    </>
  )
}

/** Hoja para marcar (o editar / quitar) un día desde el Calendario. */
export function HojaMarcar({ fecha, marca, onCerrar }: { fecha: string | null; marca?: MarcaDia; onCerrar: () => void }) {
  const [texto, setTexto] = useState(marca?.texto ?? '')
  const [clave, setClave] = useState(fecha)
  if (clave !== fecha) { setClave(fecha); setTexto(marca?.texto ?? '') }
  const guardar = async () => {
    if (!fecha) return
    try {
      await mutar(() => marcarDia(fecha, texto))
      avisar('Día marcado 印', { tipo: 'ok' })
      onCerrar()
    } catch (e) {
      avisar(e instanceof Error ? e.message : String(e), { tipo: 'bajo' })
    }
  }
  return (
    <Hoja abierta={!!fecha} onCerrar={onCerrar} titulo={fecha ? `印 ${marca ? 'Día marcado' : 'Marcar este día'} · ${fechaLegible(fecha)}` : ''}>
      <div className="campo">
        <label>¿Qué pasó ese día?</label>
        <input autoFocus maxLength={80} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Ej.: cambié de estilo, primer día sin celu" />
      </div>
      <button type="button" className="boton primario ancho" disabled={!texto.trim()} onClick={() => void guardar()}>{marca ? 'Guardar' : 'Marcar'}</button>
      {marca && <button type="button" className="boton suave ancho" style={{ marginTop: 6 }} onClick={() => { if (fecha) void mutar(() => quitarMarca(fecha)).then(() => { avisar('Marca quitada'); onCerrar() }) }}>Quitar la marca</button>}
    </Hoja>
  )
}

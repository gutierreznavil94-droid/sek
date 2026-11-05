/**
 * Recomendar algo: una pantalla, tres campos, un toque. Se manda al formulario de Google del
 * dueño de la app; si no hay internet, queda esperando y sale cuando vuelve.
 */
import { useState } from 'react'
import type { Recomendacion } from '../../data/tipos'
import { fechaDe, fechaLegible } from '../../domain/fechas'
import { PARTES, borrarRecomendacion, configRecomendaciones, enviarRecomendacion, listarRecomendaciones, reintentarPendientes } from '../../services/recomendaciones'
import { Atras, Tarjeta } from '../componentes'
import { avisar, mutar, useDatos } from '../estado'

export function Recomendar() {
  const datos = useDatos(async () => ({ config: await configRecomendaciones(), lista: await listarRecomendaciones() }), [])
  const [texto, setTexto] = useState('')
  const [parte, setParte] = useState<string>('Hoy')
  const [contacto, setContacto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [sello, setSello] = useState<Recomendacion | null>(null)
  const d = datos.datos
  if (!d) return null
  const enviar = async () => {
    setEnviando(true)
    try {
      const r = await mutar(() => enviarRecomendacion({ texto, parte, contacto }))
      setSello(r)
      setTexto(''); setContacto('')
    } catch (e) {
      avisar(e instanceof Error ? e.message : String(e))
    } finally { setEnviando(false) }
  }
  const pendientes = d.lista.filter((r) => r.estado === 'pendiente').length
  return (
    <>
      <Atras />
      <h1>Recomendar algo</h1>
      {!d.config && <p className="ayuda">Esta versión todavía no tiene a dónde mandar recomendaciones. El dueño de la app lo activa pegando el link de su formulario en Más → Ajustes.</p>}
      {sello ? (
        <section className="rec-sello col centro" aria-live="polite">
          <span className="rec-kanji" aria-hidden>願</span>
          <b className="grande">{sello.estado === 'enviada' ? 'Enviado. Gracias.' : 'Guardado. Sale cuando haya internet.'}</b>
          <span className="chico texto-2">Lo lee el dueño de la app y decide si lo hace.</span>
          <button className="boton" onClick={() => setSello(null)}>Otra recomendación</button>
        </section>
      ) : (
        <Tarjeta>
          <div className="campo">
            <label htmlFor="rec-texto">¿Qué recomendás?</label>
            <textarea id="rec-texto" rows={4} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Ej.: que el entreno avise 10 minutos antes" maxLength={1000} autoFocus />
          </div>
          <span className="seccion-titulo">¿De qué parte de la app?</span>
          <div className="chips">
            {PARTES.map((p) => <button key={p} type="button" className={parte === p ? 'activo' : ''} onClick={() => setParte(p)}>{p}</button>)}
          </div>
          <div className="campo">
            <label htmlFor="rec-contacto">Tu nombre o correo (opcional)</label>
            <input id="rec-contacto" value={contacto} onChange={(e) => setContacto(e.target.value)} placeholder="Para avisarte si se hace" maxLength={120} />
          </div>
          <button className="boton primario grande ancho" disabled={!d.config || enviando || texto.trim().length < 3} onClick={enviar}>{enviando ? 'Enviando…' : 'Enviar'}</button>
          <p className="ayuda">Se envía a un formulario de Google del dueño de la app, junto con la versión y el tema que usás. Nada más: ni tus datos ni tu historial.</p>
        </Tarjeta>
      )}
      {d.lista.length > 0 && (
        <Tarjeta titulo="Mis recomendaciones" derecha={pendientes > 0 ? <button className="boton chico" onClick={async () => { const n = await mutar(() => reintentarPendientes()); avisar(n ? `Salieron ${n}` : 'Todavía sin internet') }}>Reintentar {pendientes}</button> : undefined}>
          <div className="col" style={{ gap: 6 }}>
            {d.lista.map((r) => (
              <div key={r.id} className="rec-fila">
                <span className="crece col" style={{ gap: 1 }}>
                  <span className="chico">{r.texto}</span>
                  <span className="muy-chico texto-3">{r.parte} · {fechaLegible(fechaDe(r.creada))} · {r.estado === 'enviada' ? 'enviada' : 'esperando internet'}</span>
                </span>
                <button className="boton chico suave" aria-label="Borrar de la lista" onClick={() => mutar(() => borrarRecomendacion(r.id))}>✕</button>
              </div>
            ))}
          </div>
        </Tarjeta>
      )}
    </>
  )
}

import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { compromisosDelDia } from '../../services/dia'
import { registrarInicio } from '../../services/inicios'
import { Tarjeta } from '../componentes'
import { avisar, mutar, useDatos } from '../estado'
import { celebrarNivel } from '../animaciones/logros'
import { animar } from '../animaciones/motor'
import { momento } from '../../services/horario'

/**
 * Protocolo 3-2-1: elegís qué vas a empezar, cuenta atrás grande, «Empieza ahora».
 * Al tocar «Empecé» se registra el inicio (y el compromiso pasa a iniciado).
 */
export function Protocolo321({ hoy }: { hoy: string }) {
  const navegar = useNavigate()
  const [params] = useSearchParams()
  const [texto, setTexto] = useState(params.get('accion') ?? '')
  const [compromisoId, setCompromisoId] = useState<string | undefined>(params.get('compromiso') ?? undefined)
  const [fase, setFase] = useState<'elegir' | 'cuenta' | 'ahora'>('elegir')
  const [n, setN] = useState(3)
  const pendientes = useDatos(async () => (await compromisosDelDia(hoy)).filter((c) => (c.estado === 'pendiente' || c.estado === 'iniciado') && c.accion.tipo !== 'limite_juego' && c.accion.tipo !== 'acostarse'), [hoy])
  const hueco = useDatos(() => momento(hoy, Date.now()), [hoy])

  useEffect(() => {
    if (fase !== 'cuenta') return
    if (n === 0) {
      setFase('ahora')
      animar({ tipo: 'postura', modo: '321' })
      if ('vibrate' in navigator) try { navigator.vibrate(200) } catch { /* sin vibración */ }
      return
    }
    const t = setTimeout(() => setN(n - 1), 1000)
    return () => clearTimeout(t)
  }, [fase, n])

  const empezar = async () => {
    const id = params.get('id')
    const r = await mutar(() => registrarInicio({ id: id ? Number(id) : undefined, accionConcreta: texto.trim(), compromisoId }))
    try { localStorage.setItem(`usado-321:${hoy}`, String(Date.now())) } catch { /* sin almacenamiento */ }
    celebrarNivel(r.nuevoNivel)
    avisar(r.xp > 0 ? `Empezaste. +${r.xp} XP${r.nuevoNivel ? ` · ¡Nivel ${r.nuevoNivel}!` : ''}` : `Empezaste. ${r.motivoSinXp ?? ''}`, { tipo: 'ok' })
    navegar('/')
  }

  if (fase === 'elegir') {
    return (
      <div className="app">
        <div className="contenido" style={{ paddingTop: 24 }}>
          <div className="fila entre">
            <h1>3 · 2 · 1</h1>
            <button className="boton chico suave" onClick={() => navegar(-1)}>Cerrar</button>
          </div>
          <p className="texto-2">Cuando aparece la resistencia, no negociás: contás 3, 2, 1 y empezás. ¿Qué vas a empezar?</p>
          <Tarjeta>
            <div className="campo">
              <label>Acción</label>
              <input autoFocus value={texto} onChange={(e) => { setTexto(e.target.value); setCompromisoId(undefined) }} placeholder="Ej.: ponerme las zapatillas" />
            </div>
            {hueco.datos && (hueco.datos.siguiente || hueco.datos.ahora) && <p className="hor-hueco chico">{hueco.datos.ahora ? <>Estás en <b>{hueco.datos.ahora.nombre}</b> hasta {hueco.datos.ahora.hasta}.</> : <>Tenés <b>{hueco.datos.libres >= 60 ? `${Math.floor(hueco.datos.libres / 60)} h ${hueco.datos.libres % 60 || ''}`.trim() : `${hueco.datos.libres} min`}</b> libres hasta {hueco.datos.siguiente ? `${hueco.datos.siguiente.nombre} ${hueco.datos.siguiente.desde}` : hueco.datos.libreHasta}.</>}</p>}
            {pendientes.datos && pendientes.datos.length > 0 && (
              <div className="chips">
                {pendientes.datos.map((c) => (
                  <button key={c.id} type="button" className={compromisoId === c.id ? 'activo' : ''} onClick={() => { setTexto(c.accion.nombre); setCompromisoId(c.id) }}>{c.accion.nombre}{hueco.datos && !hueco.datos.ahora && c.accion.minutosMinimos && c.accion.minutosMinimos <= hueco.datos.libres ? <span className="texto-3"> · entra</span> : null}</button>
                ))}
              </div>
            )}
            <button className="boton primario grande ancho" disabled={!texto.trim()} onClick={() => { setN(3); setFase('cuenta') }}>Contar</button>
          </Tarjeta>
        </div>
      </div>
    )
  }

  return (
    <div className="app">
      <div className="contenido cuenta">
        {fase === 'cuenta' ? (
          <>
            <div className="numero acento">{n}</div>
            <p className="texto-2">{texto}</p>
          </>
        ) : (
          <>
            <div className="grande" style={{ fontSize: '2.6rem' }}>Empieza ahora</div>
            <p className="texto-2">{texto}</p>
            <button className="boton ok grande ancho" onClick={empezar}>Empecé</button>
            <button className="boton suave" onClick={() => navegar('/')}>No empecé</button>
          </>
        )}
      </div>
    </div>
  )
}

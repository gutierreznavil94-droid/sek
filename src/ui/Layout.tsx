import { useRef, useState } from 'react'
import { NavLink, Outlet, Link } from 'react-router-dom'
import { fechaDelDiaDelCiclo, fechaLegible } from '../domain/fechas'
import { estadoDelCiclo, fasesDelCiclo, objetivosDelCiclo } from '../services/ciclo'
import { Hoja } from './componentes'
import { Divisor } from './Divisor'
import { Desintegracion } from './Desintegrar'
import { useDatos } from './estado'
import { VERSION_APP } from '../version'
import { enModoPrueba, salirModoPrueba } from '../data/modoPrueba'

const ICONOS = {
  hoy: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 11l9-8 9 8v10a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" /></svg>,
  calendario: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M3 9h18M8 2v4M16 2v4" /></svg>,
  juego: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2.5 2.5M9 2h6" /></svg>,
  progreso: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19V5M4 19h16M8 15l4-5 3 3 5-7" /></svg>,
  mas: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 7h16M4 12h16M4 17h16" /></svg>,
}

const NOMBRES_FASE = ['Disciplina', 'Constancia', 'Mi yo ideal']

export function Layout({ hoy }: { hoy: string }) {
  const estado = useDatos(async () => {
    const e = await estadoDelCiclo(hoy)
    if (!e) return null
    const fases = await fasesDelCiclo(e.ciclo.id)
    const objetivos = await objetivosDelCiclo(e.ciclo.id)
    return { e, fases, objetivos }
  }, [hoy])
  const [detalle, setDetalle] = useState(false)
  const cabRef = useRef<HTMLElement>(null)
  const d = estado.datos
  const e = d?.e
  const diasFaltan = e ? 1 - e.dia : 0
  return (
    <div className="app" data-fase={e && !e.noEmpezado && !e.terminado ? e.faseNumero : 1}>
      {enModoPrueba() && (
        <div className="banda-prueba" role="status">
          <span><b>MODO PRUEBA</b> · fechas simuladas: el Día 1 es hoy. Nada de esto cuenta ni toca tu ciclo real.</span>
          <button onClick={salirModoPrueba}>Salir</button>
        </div>
      )}
      <header className="cabecera" ref={cabRef}>
        <div className="cabecera-int">
          <div>
            <div className="dia">
              {e ? (e.noEmpezado ? `Empieza en ${diasFaltan} día${diasFaltan === 1 ? '' : 's'}` : e.terminado ? `Ciclo terminado (día ${e.dia})` : `Día ${e.dia} de ${e.ciclo.duracionDias}`) : '…'}
            </div>
            <div className="fecha">{fechaLegible(hoy)}{e?.noEmpezado && <span className="texto-3"> · Día 1: {fechaLegible(e.ciclo.inicio)}</span>}<Link to="/mas" className="texto-3 mono" style={{ fontSize: '0.75rem', marginLeft: 8 }}>v{VERSION_APP}</Link></div>
          </div>
          <div className="fase" style={{ textAlign: 'right' }}>
            {e && e.ciclo.numero > 1 && <div>Ciclo {e.ciclo.numero}</div>}
          </div>
        </div>
        {/* Barra de fases: mide tiempo (días del ciclo), no esfuerzo. El nivel va aparte. */}
        {d && e && (
          <button className="barra-fases" onClick={() => setDetalle(true)} aria-label="Ver detalle de la fase">
            {d.fases.map((f) => {
              const total = f.diaFin - f.diaInicio + 1
              const hechos = Math.max(0, Math.min(total, e.dia - f.diaInicio + 1))
              const actual = !e.noEmpezado && !e.terminado && f.numero === e.faseNumero
              return (
                <div key={f.id} className={`tramo ${actual ? 'actual' : ''} ${f.numero === d.fases.length ? 'final' : ''}`} style={{ flex: total }}>
                  <div className="lleno" style={{ width: `${(100 * hechos) / total}%` }} />
                  <span className="etq">{f.numero} · {NOMBRES_FASE[f.numero - 1] ?? f.foco}</span>
                </div>
              )
            })}
          </button>
        )}
        {/* Franja de pincel: separa la cabecera de papel del contenido en tinta */}
        <Divisor className="divisor-cabecera" />
      </header>
      <Desintegracion cabecera={cabRef} texto={e ? (e.noEmpezado ? `Día 1 en ${diasFaltan} día${diasFaltan === 1 ? '' : 's'}` : e.terminado ? 'Ciclo terminado' : `Día ${e.dia}`) : ''} />
      <main className="contenido">
        <Outlet />
      </main>
      <nav className="nav" aria-label="Secciones">
        <NavLink to="/" end className={({ isActive }) => (isActive ? 'activo' : '')}>{ICONOS.hoy}Hoy</NavLink>
        <NavLink to="/calendario" className={({ isActive }) => (isActive ? 'activo' : '')}>{ICONOS.calendario}Calendario</NavLink>
        <NavLink to="/juego" className={({ isActive }) => (isActive ? 'activo' : '')}>{ICONOS.juego}Juego</NavLink>
        <NavLink to="/progreso" className={({ isActive }) => (isActive ? 'activo' : '')}>{ICONOS.progreso}Progreso</NavLink>
        <NavLink to="/mas" className={({ isActive }) => (isActive ? 'activo' : '')}>{ICONOS.mas}Más</NavLink>
      </nav>

      {d && e && (
        <Hoja abierta={detalle} onCerrar={() => setDetalle(false)} titulo="Fases del ciclo">
          <p className="chico texto-2">La barra avanza con los días del ciclo. El nivel y el XP miden esfuerzo y van aparte.</p>
          {d.fases.map((f) => {
            const actual = !e.noEmpezado && !e.terminado && f.numero === e.faseNumero
            const restantes = Math.max(0, f.diaFin - e.dia)
            const objs = d.objetivos.filter((o) => o.faseNumero === f.numero)
            return (
              <div key={f.id} className="col" style={{ gap: 4, borderTop: '1px solid var(--borde)', paddingTop: 8 }}>
                <div className="fila entre">
                  <b className={actual ? 'acento' : ''}>Fase {f.numero} · {NOMBRES_FASE[f.numero - 1] ?? f.foco}</b>
                  <span className="chico texto-3">días {f.diaInicio}–{f.diaFin}</span>
                </div>
                <span className="chico texto-2">{f.foco}. {f.queSeMide}</span>
                <span className="chico texto-3">{fechaLegible(fechaDelDiaDelCiclo(e.ciclo.inicio, f.diaInicio))} a {fechaLegible(fechaDelDiaDelCiclo(e.ciclo.inicio, f.diaFin))}{actual && ` · faltan ${restantes} día${restantes === 1 ? '' : 's'}`}</span>
                {f.numero === d.fases.length && <span className="chico acento">Etapa final: donde me acerco a la persona que quiero ser.</span>}
                {objs.map((o) => <span key={o.id} className="chico" style={{ paddingLeft: 10, borderLeft: '2px solid var(--borde)' }}>{o.titulo}{o.meta ? ` · meta ${o.meta}` : ''}</span>)}
                {objs.length === 0 && <Link to="/mas/objetivos" className="chico" onClick={() => setDetalle(false)}>Definir objetivos</Link>}
              </div>
            )
          })}
        </Hoja>
      )}
    </div>
  )
}

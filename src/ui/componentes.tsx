import { Divisor } from './Divisor'
import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { nivelCumplimiento } from '../domain/cumplimiento'
import { useAvisos, quitarAviso } from './estado'

export function Tarjeta({ titulo, children, derecha, compacta, onClick }: { titulo?: ReactNode; children?: ReactNode; derecha?: ReactNode; compacta?: boolean; onClick?: () => void }) {
  return (
    <section className={`tarjeta${compacta ? ' compacta' : ''}`} onClick={onClick}>
      {(titulo || derecha) && (
        <div className="tarjeta-cab">
          {titulo && <h2>{titulo}</h2>}
          {derecha}
        </div>
      )}
      {children}
    </section>
  )
}

export function Barra({ valor, clase }: { valor: number; clase?: string }) {
  const v = Math.max(0, Math.min(100, valor))
  return (
    <div className={`barra ${clase ?? ''}`}>
      <div style={{ width: `${v}%` }} />
    </div>
  )
}

export function clasePorcentaje(p: number | null): string {
  const n = nivelCumplimiento(p)
  return n === 'sin_datos' ? '' : n === 'alto' ? 'ok' : n
}

export function Porcentaje({ valor }: { valor: number | null }) {
  if (valor === null) return <span className="texto-3">—</span>
  return <span className={clasePorcentaje(valor)}>{valor} %</span>
}

export function Hoja({ abierta, onCerrar, children, titulo }: { abierta: boolean; onCerrar: () => void; children: ReactNode; titulo?: ReactNode }) {
  useEffect(() => {
    if (!abierta) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCerrar()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [abierta, onCerrar])
  if (!abierta) return null
  // Se dibuja al nivel de la app (no dentro del contenido) para quedar por encima de la barra de abajo.
  const destino = (typeof document !== 'undefined' && (document.querySelector('.app') ?? document.body)) || null
  const hoja = (
    <div className="fondo-modal" onClick={onCerrar}>
      <div className="hoja" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        {titulo ? (
          <div className="hoja-titulo">
            <div className="asa" />
            <div className="fila entre">
              <h2>{titulo}</h2>
              <button className="boton chico suave cerrar" onClick={onCerrar} aria-label="Cerrar">
                ✕
              </button>
            </div>
            <Divisor className="divisor-hoja" />
          </div>
        ) : (
          <div className="asa" />
        )}
        {children}
      </div>
    </div>
  )
  return destino ? createPortal(hoja, destino) : hoja
}

/** Botón (i) que abre una explicación de de dónde sale un número. */
export function Explicacion({ titulo, children }: { titulo: ReactNode; children: ReactNode }) {
  const [abierta, setAbierta] = useState(false)
  return (
    <>
      <button className="boton chico suave icono" aria-label={`Explicar ${typeof titulo === 'string' ? titulo : ''}`} onClick={(e) => { e.stopPropagation(); setAbierta(true) }} style={{ minWidth: 32, minHeight: 32, padding: 4, color: 'var(--texto-3)' }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" /></svg>
      </button>
      <Hoja abierta={abierta} onCerrar={() => setAbierta(false)} titulo={titulo}>
        {children}
      </Hoja>
    </>
  )
}

export function Avisos() {
  const avisos = useAvisos()
  const a = avisos[avisos.length - 1]
  if (!a) return null
  return (
    <div className={`aviso ${a.tipo ?? ''}`} role="status">
      <span className="crece">{a.texto}</span>
      {a.accion && (
        <button className="boton chico" onClick={() => { a.accion!.fn(); quitarAviso(a.id) }}>
          {a.accion.texto}
        </button>
      )}
      <button className="boton chico suave icono" onClick={() => quitarAviso(a.id)} aria-label="Cerrar aviso" style={{ minWidth: 32 }}>
        ✕
      </button>
    </div>
  )
}

export function Atras({ a = '/mas', texto = 'Más' }: { a?: string; texto?: string }) {
  return (
    <Link to={a} className="atras">
      ← {texto}
    </Link>
  )
}

export function Confirmar({ abierta, titulo, texto, confirmar = 'Confirmar', peligro, onConfirmar, onCancelar }: { abierta: boolean; titulo: string; texto: ReactNode; confirmar?: string; peligro?: boolean; onConfirmar: () => void; onCancelar: () => void }) {
  return (
    <Hoja abierta={abierta} onCerrar={onCancelar} titulo={titulo}>
      <div className="texto-2">{texto}</div>
      <div className="botonera">
        <button className="boton" onClick={onCancelar}>Cancelar</button>
        <button className={`boton ${peligro ? 'peligro' : 'primario'}`} onClick={onConfirmar}>{confirmar}</button>
      </div>
    </Hoja>
  )
}

export function DiasSemana({ valor, onChange }: { valor: number[]; onChange: (v: number[]) => void }) {
  const nombres = ['D', 'L', 'M', 'X', 'J', 'V', 'S']
  // Mostrar de lunes a domingo
  const orden = [1, 2, 3, 4, 5, 6, 0]
  return (
    <div className="dias-semana">
      {orden.map((d) => (
        <button key={d} type="button" className={valor.includes(d) ? 'activo' : ''} onClick={() => onChange(valor.includes(d) ? valor.filter((x) => x !== d) : [...valor, d].sort())}>
          {nombres[d]}
        </button>
      ))}
    </div>
  )
}

export function Chips<T extends string>({ opciones, valor, onChange, multiple }: { opciones: { id: T; nombre: string }[]; valor: T[]; onChange: (v: T[]) => void; multiple?: boolean }) {
  return (
    <div className="chips">
      {opciones.map((o) => (
        <button key={o.id} type="button" className={valor.includes(o.id) ? 'activo' : ''} onClick={() => {
          if (multiple) onChange(valor.includes(o.id) ? valor.filter((x) => x !== o.id) : [...valor, o.id])
          else onChange([o.id])
        }}>
          {o.nombre}
        </button>
      ))}
    </div>
  )
}

export function Cargando() {
  return <p className="vacio">Cargando…</p>
}

// ===== Cambios 04: piezas visuales =====

/** true si el teléfono pide «reducir movimiento». */
/** «siempre»: animaciones y video aunque el teléfono pida reducir movimiento (o lo active el ahorro de batería). */
export type PreferenciaMovimiento = 'sistema' | 'siempre'
export function preferenciaMovimiento(): PreferenciaMovimiento {
  try { return localStorage.getItem('movimiento') === 'sistema' ? 'sistema' : 'siempre' } catch { return 'siempre' }
}
export function aplicarMovimiento(): void {
  if (typeof document !== 'undefined') document.documentElement.classList.toggle('movimiento-siempre', preferenciaMovimiento() === 'siempre')
}
export function elegirMovimiento(v: PreferenciaMovimiento): void {
  try { localStorage.setItem('movimiento', v) } catch { /* sin almacenamiento */ }
  aplicarMovimiento()
}
/** El teléfono pide reducir movimiento (sin contar «siempre con movimiento» elegido en Ajustes). */
export function sistemaPideReducir(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function movimientoReducido(): boolean {
  if (preferenciaMovimiento() === 'siempre') return false
  return sistemaPideReducir()
}

/** Número que sube con animación corta cuando cambia el valor (sin movimiento si el sistema lo pide). */
export function useContador(valor: number, ms = 600): number {
  const [mostrado, setMostrado] = useState(valor)
  useEffect(() => {
    if (movimientoReducido() || typeof requestAnimationFrame !== 'function') {
      setMostrado(valor)
      return
    }
    const desde = mostrado
    if (desde === valor) return
    const t0 = performance.now()
    let id = 0
    const paso = (t: number) => {
      const p = Math.min(1, (t - t0) / ms)
      const e = 1 - Math.pow(1 - p, 3)
      setMostrado(Math.round(desde + (valor - desde) * e))
      if (p < 1) id = requestAnimationFrame(paso)
    }
    id = requestAnimationFrame(paso)
    return () => cancelAnimationFrame(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valor])
  return mostrado
}

/** Anillo de nivel: el número grande adentro y el XP del nivel como arco con degradado. */
export function Anillo({ nivel, progreso, etiqueta = 'NIVEL' }: { nivel: number; progreso: number; etiqueta?: string }) {
  const r = 40
  const c = 2 * Math.PI * r
  const [p, setP] = useState(0)
  useEffect(() => {
    const id = requestAnimationFrame(() => setP(Math.max(0, Math.min(1, progreso))))
    return () => cancelAnimationFrame(id)
  }, [progreso])
  return (
    <div className="anillo" role="img" aria-label={`Nivel ${nivel}, ${Math.round(progreso * 100)} % del nivel`}>
      <svg viewBox="0 0 100 100">
        <defs>
          <linearGradient id="gradAnillo" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--acento-2)" />
            <stop offset="100%" stopColor="var(--acento)" />
          </linearGradient>
        </defs>
        <circle className="fondo" cx="50" cy="50" r={r} />
        <circle className="valor" cx="50" cy="50" r={r} strokeDasharray={c} strokeDashoffset={c * (1 - p)} />
      </svg>
      <div className="centro-anillo">
        <span className="etq">{etiqueta}</span>
        <span className="num">{nivel}</span>
      </div>
    </div>
  )
}

export function Llama({ dias, texto }: { dias: number; texto?: string }) {
  return (
    <span className={`llama ${dias > 0 ? '' : 'apagada'}`} aria-label={`Racha de ${dias} días`}>
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M12 2c.5 3.5-1.5 5-3 7-1.6 2.2-2 4-1.5 6A6.5 6.5 0 0 0 12 22a6.5 6.5 0 0 0 6.5-6.5c0-3-1.5-5-3-6.5 0 2-1 3-2 3.5.5-3-1-6-1.5-8.5z" /></svg>
      {dias}{texto && <small>{texto}</small>}
    </span>
  )
}

/** Celebración breve al subir de nivel (1,3 s, sin sonido). */
export function Celebracion({ nivel, onFin }: { nivel: number | null; onFin: () => void }) {
  useEffect(() => {
    if (nivel === null) return
    const id = setTimeout(onFin, movimientoReducido() ? 900 : 1400)
    return () => clearTimeout(id)
  }, [nivel, onFin])
  if (nivel === null) return null
  return (
    <div className="celebracion" aria-live="polite">
      <div>
        <div className="muy-chico texto-2" style={{ letterSpacing: '0.1em', fontWeight: 700 }}>SUBISTE A</div>
        <div className="num">Nivel {nivel}</div>
      </div>
    </div>
  )
}

/** Íconos de los pilares: pesa, pincel, maletín, luna. */
export function IconoPilar({ id, tipo }: { id: string; tipo: string }) {
  const comun = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true }
  if (tipo === 'entrenamiento') return <svg {...comun}><path d="M6 8v8M18 8v8M3 10v4M21 10v4M6 12h12" /></svg>
  if (tipo === 'acostarse') return <svg {...comun}><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" /></svg>
  if (id === 'manga' || /dibuj|manga|pint/i.test(id)) return <svg {...comun}><path d="M14 4l6 6-9 9H5v-6z" /><path d="M12 6l6 6" /></svg>
  if (tipo === 'comida_plan') return <svg {...comun}><path d="M7 3v8a2 2 0 0 0 2 2v8M5 3v5M9 3v5M17 21V3c-2 1-3 4-3 8h3" /></svg>
  if (/leer/.test(id)) return <svg {...comun}><path d="M3 5h6a3 3 0 0 1 3 3v12a2 2 0 0 0-2-2H3zM21 5h-6a3 3 0 0 0-3 3v12a2 2 0 0 1 2-2h7z" /></svg>
  if (/estudiar/.test(id)) return <svg {...comun}><path d="M2 9l10-5 10 5-10 5z" /><path d="M6 11v5c3 2 9 2 12 0v-5" /></svg>
  if (/meditar/.test(id)) return <svg {...comun}><circle cx="12" cy="5" r="2" /><path d="M12 8v5M5 19c2-3 4-4 7-4s5 1 7 4M8 12l4 1 4-1" /></svg>
  if (/pantalla/.test(id)) return <svg {...comun}><rect x="7" y="2" width="10" height="20" rx="2" /><path d="M4 4l16 16" /></svg>
  if (/^p-otro/.test(id)) return <svg {...comun}><path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6-5.3-3-5.3 3 1.2-6L3.4 9.3l6-.7z" /></svg>
  return <svg {...comun}><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 12h18" /></svg>
}

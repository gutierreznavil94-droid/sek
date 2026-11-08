import { PLANES, planPorId, type EleccionEntreno } from '../data/planes'
import { nombreDiaSemana } from '../domain/fechas'

/** Días de lunes a domingo, cortitos: «mar, mié, jue y sáb». */
export function diasCortos(d: number[]): string {
  const n = [...d].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)).map((x) => nombreDiaSemana(x, true))
  return n.length > 1 ? `${n.slice(0, -1).join(', ')} y ${n[n.length - 1]}` : n.join('')
}

const OPCIONES: { modo: EleccionEntreno['modo']; titulo: string; texto: string }[] = [
  { modo: 'plan', titulo: 'Mi plan completo', texto: 'Un plan listo desde el día 1, con todos sus días y ejercicios.' },
  { modo: 'poco', titulo: 'De a poco', texto: 'Una rutina cortita para arrancar, con ideas para agrandarla cuando quieras.' },
  { modo: 'cero', titulo: 'Desde cero', texto: 'Sin rutinas: armás tus días y ejercicios a tu manera.' },
]

/** Las tres formas de empezar a entrenar y, en «Mi plan completo», los planes. Todo se edita después. */
export function ComoEmpezar({ valor, onChange }: { valor: EleccionEntreno; onChange: (e: EleccionEntreno) => void }) {
  const elegir = (modo: EleccionEntreno['modo']) => onChange(modo === 'plan' ? { modo, planId: valor.modo === 'plan' ? valor.planId : PLANES[0].id } : { modo })
  return (
    <div className="ce" role="radiogroup" aria-label="Cómo empezar a entrenar">
      {OPCIONES.map((o) => (
        <div key={o.modo} className={`ce-opcion ${valor.modo === o.modo ? 'elegida' : ''}`}>
          <button role="radio" aria-checked={valor.modo === o.modo} className="ce-opcion-cab" onClick={() => elegir(o.modo)}>
            <span className="ce-punto" aria-hidden />
            <span className="ce-opcion-texto"><b>{o.titulo}</b><span className="chico texto-2">{o.texto}</span></span>
          </button>
          {o.modo === 'plan' && valor.modo === 'plan' && (
            <div className="ce-planes">
              {PLANES.map((p) => (
                <button key={p.id} className={`ce-plan ${valor.planId === p.id ? 'elegido' : ''}`} aria-pressed={valor.planId === p.id} onClick={() => onChange({ modo: 'plan', planId: p.id })}>
                  <b>{p.nombre}</b>
                  <span className="chico texto-2">{p.descripcion}</span>
                  <span className="chico texto-3">{p.rutinas.map((r) => r.nombre.split(' · ')[0]).join(' · ')}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

/** Nombre cortito de lo elegido, para resúmenes. */
export function nombreEleccion(e: EleccionEntreno): string {
  if (e.modo === 'plan') return planPorId(e.planId)?.nombre ?? 'Plan'
  return e.modo === 'poco' ? 'De a poco' : 'Desde cero'
}

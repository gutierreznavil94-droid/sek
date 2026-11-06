/**
 * Más → Ver animaciones: las animaciones nuevas del tema Shinobi, agrupadas (Compañero, Rival, Juego, Noche).
 * Cada una se repite sola; Juego y Noche tienen botones para pasar por sus estados.
 */
import { useState } from 'react'
import { Tarjeta, movimientoReducido } from '../../ui/componentes'
import { temaActivo } from '../temas'
import { PiedraShinobi } from './Piedra'
import { BolitaDorada, HOJA_RIVAL, JuegoShinobi, NocheShinobi, Pregunta, SpriteClip, SuenoShinobi, useHoja } from './Escenas'

const BASE = import.meta.env.BASE_URL

const COMPANERO: { clip: string; titulo: string }[] = [
  { clip: 'trepa', titulo: 'Trepa a una tarjeta' },
  { clip: 'saltoGiro', titulo: 'Completar · salto con giro' },
  { clip: 'voltereta', titulo: 'Logro · voltereta' },
  { clip: 'estirarse', titulo: 'Quieto · se estira' },
  { clip: 'alerta', titulo: 'Alerta · desenvaina' },
]
const RIVAL: { clip: string; titulo: string }[] = [
  { clip: 'asoma', titulo: 'Dudando · se asoma' },
  { clip: 'corre', titulo: 'Corre' },
  { clip: 'salta', titulo: 'Salta entre tarjetas' },
  { clip: 'desenvaina', titulo: 'Atrapado · desenvaina' },
  { clip: 'roba', titulo: 'Robo · se lleva la bolita' },
]

/** Un clip de una hoja en bucle (los de una sola vez vuelven a empezar). */
function Vista({ hoja, clip, titulo, escala, extra }: { hoja: string; clip: string; titulo: string; escala: number; extra?: (fin: boolean) => React.ReactNode }) {
  const datos = useHoja(hoja)
  const [vuelta, setVuelta] = useState(0)
  const [fin, setFin] = useState(false)
  const reducido = movimientoReducido()
  if (!datos || !datos.clips[clip]) return null
  const [cw, ch] = datos.celda
  const unaVez = datos.clips[clip].unaVez
  return (
    <figure className="ga-vista">
      <div className="ga-caja" style={{ height: ch * escala + 8 }}>
        <div style={{ width: cw, height: ch, transform: `scale(${escala})`, transformOrigin: '50% 100%', position: 'relative' }}>
          <SpriteClip
            key={vuelta}
            hoja={hoja}
            datos={datos}
            clip={fin && clip === 'roba' ? 'corre' : clip}
            reducido={reducido}
            onFin={unaVez ? () => window.setTimeout(() => { if (clip === 'roba' && !fin) { setFin(true); window.setTimeout(() => { setFin(false); setVuelta((v) => v + 1) }, 2000) } else setVuelta((v) => v + 1) }, 900) : undefined}
          />
          {extra?.(fin)}
        </div>
      </div>
      <figcaption>{titulo}</figcaption>
    </figure>
  )
}

export function GaleriaShinobi() {
  const reducido = movimientoReducido()
  const [juego, setJuego] = useState<'pelea' | 'jugando' | 'te'>('pelea')
  const [noche, setNoche] = useState(0)
  const [forja, setForja] = useState(0)
  const hojaCompanero = `${BASE}${temaActivo().sprite}`
  return (
    <>
      <Tarjeta titulo="Animaciones · Compañero">
        <div className="ga-grilla">
          {COMPANERO.map((c) => <Vista key={c.clip} hoja={hojaCompanero} clip={c.clip} titulo={c.titulo} escala={2} />)}
        </div>
      </Tarjeta>
      <Tarjeta titulo="Animaciones · Rival">
        <div className="ga-grilla">
          {RIVAL.map((c) => (
            <Vista
              key={c.clip}
              hoja={HOJA_RIVAL}
              clip={c.clip}
              titulo={c.titulo}
              escala={1.5}
              extra={(fin) => (c.clip === 'asoma' ? <Pregunta /> : c.clip === 'roba' && fin ? <BolitaDorada style={{ left: '58%', top: '50%' }} /> : null)}
            />
          ))}
        </div>
      </Tarjeta>
      <Tarjeta titulo="Animaciones · Juego">
        <div className="juego-shoji"><JuegoShinobi activa={juego !== 'pelea'} pausada={juego === 'te'} reducido={!!reducido} /></div>
        <div className="fila" style={{ gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
          <button type="button" className="boton chico" onClick={() => setJuego('pelea')}>Sin jugar</button>
          <button type="button" className="boton chico" onClick={() => setJuego('jugando')}>▶ A jugar</button>
          <button type="button" className="boton chico" onClick={() => setJuego('te')}>❚❚ Pausa (té)</button>
        </div>
      </Tarjeta>
      <Tarjeta titulo="Animaciones · Forja">
        <p className="chico texto-2" style={{ margin: 0 }}>Mové los días: cada día nuevo es un tajo y una grieta; a los 7, 12, 17, 21 y 25 cae un pedazo; a los 28 se forja.</p>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0' }}><PiedraShinobi id="vista-previa" kanji="読" validos={forja} necesarios={28} tam={150} reducido={!!reducido} /></div>
        <div className="fila" style={{ gap: 8, alignItems: 'center' }}>
          <button type="button" className="boton chico" onClick={() => setForja((n) => Math.max(0, n - 1))}>−</button>
          <input type="range" min={0} max={28} value={forja} onChange={(e) => setForja(Number(e.target.value))} style={{ flex: 1 }} aria-label="Días válidos" />
          <button type="button" className="boton chico" onClick={() => setForja((n) => Math.min(28, n + 1))}>+ 1 día</button>
          <span className="mono chico" style={{ minWidth: 44, textAlign: 'right' }}>{forja} / 28</span>
        </div>
      </Tarjeta>
      <Tarjeta titulo="Animaciones · Noche">
        <p className="chico texto-2" style={{ margin: 0 }}>En Sueño, sentado junto a la cama:</p>
        <SuenoShinobi reducido={!!reducido} />
        <p className="chico texto-2" style={{ margin: 0 }}>Al marcar que te vas a dormir: buenas noches y después durmiendo.</p>
        <NocheShinobi key={noche} reducido={!!reducido} />
        <button type="button" className="boton chico" onClick={() => setNoche((n) => n + 1)}>Repetir buenas noches</button>
      </Tarjeta>
    </>
  )
}

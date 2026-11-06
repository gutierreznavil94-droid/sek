import { useEffect, useState } from 'react'
import { CLIMA_ACTIVO, elegirModoFondo, useModoFondo, type ModoFondo } from '../../fondos/elegir'
import type { Ajustes as TipoAjustes } from '../../data/tipos'
import { fechaHoy, guardarAjustes, obtenerAjustes } from '../../services/base'
import { Atras, Tarjeta, elegirMovimiento, preferenciaMovimiento, sistemaPideReducir, type PreferenciaMovimiento } from '../componentes'
import { avisar, mutar, useDatos } from '../estado'
import { FRASES_DORMIR_DEFECTO, MINUTOS_AVISO_DORMIR } from '../../services/dormir'
import { frasesCompanero } from '../../services/companero'
import { FORJA_DEFECTO } from '../../domain/forja'
import { configResta, cuantoResta } from '../../domain/resta'
import { cambiarResta } from '../../services/restas'
import { Divisor, elegirDivisor, useVarianteDivisor, type VarianteDivisor } from '../Divisor'

const ZONAS = ['America/Argentina/Cordoba', 'America/Argentina/Buenos_Aires', 'America/Montevideo', 'America/Santiago', 'America/Sao_Paulo', 'America/Lima', 'America/Bogota', 'America/Mexico_City', 'Europe/Madrid', 'UTC']

const FRANJAS: { v: VarianteDivisor; t: string }[] = [
  { v: 'pincel', t: 'Pincel seco' },
  { v: 'trama', t: 'Trama de manga' },
  { v: 'diagonal', t: 'Corte diagonal' },
]

/** Elegir la franja que separa la parte clara (papel) de la oscura (tinta). Se aplica al tocar. */
function ElegirFranja() {
  const actual = useVarianteDivisor()
  return (
    <Tarjeta titulo="Franja entre lo claro y lo oscuro">
      <p className="chico texto-2">Tocá una para usarla en toda la app.</p>
      <div className="franjas">
        {FRANJAS.map((f) => (
          <button key={f.v} className={`franja-opcion ${actual === f.v ? 'activo' : ''}`} aria-pressed={actual === f.v} onClick={() => { elegirDivisor(f.v); avisar(`Franja: ${f.t.toLowerCase()}`) }}>
            <span className="franja-muestra"><Divisor variante={f.v} /></span>
            <span>{f.t}</span>
          </button>
        ))}
      </div>
    </Tarjeta>
  )
}

const MODOS_FONDO: { v: ModoFondo; t: string; nota?: string }[] = [
  { v: 'intercalado', t: 'Intercalado', nota: 'lluvia y rayos, un día cada uno' },
  { v: 'clima', t: 'Según el clima', nota: 'próximamente' },
  { v: 'lluvia', t: 'Siempre lluvia' },
  { v: 'rayos', t: 'Siempre rayos' },
]

function ElegirVideoFondo() {
  const actual = useModoFondo()
  return (
    <Tarjeta titulo="Apariencia · video de fondo de Progreso">
      <div className="fondos-opciones" role="radiogroup" aria-label="Video de fondo">
        {MODOS_FONDO.map((m) => {
          const proximamente = m.v === 'clima' && !CLIMA_ACTIVO
          return (
            <button key={m.v} role="radio" aria-checked={actual === m.v} disabled={proximamente} className={`fondo-opcion ${actual === m.v ? 'activo' : ''}`} onClick={() => { elegirModoFondo(m.v); avisar(`Video de fondo: ${m.t.toLowerCase()}`) }}>
              <span>{m.t}</span>
              {m.nota && <span className="chico texto-3">{m.nota}</span>}
            </button>
          )
        })}
      </div>
    </Tarjeta>
  )
}

function ElegirMovimiento() {
  const [v, setV] = useState<PreferenciaMovimiento>(() => preferenciaMovimiento())
  const pide = sistemaPideReducir()
  const opciones: { v: PreferenciaMovimiento; t: string; nota: string }[] = [
    { v: 'siempre', t: 'Siempre con movimiento', nota: 'video y animaciones aunque el teléfono pida quieto' },
    { v: 'sistema', t: 'Según el teléfono', nota: pide ? 'tu teléfono ahora pide quieto' : 'tu teléfono ahora deja animar' },
  ]
  return (
    <Tarjeta titulo="Movimiento">
      <div className="fondos-opciones" role="radiogroup" aria-label="Movimiento">
        {opciones.map((o) => (
          <button key={o.v} role="radio" aria-checked={v === o.v} className={`fondo-opcion ${v === o.v ? 'activo' : ''}`} onClick={() => { elegirMovimiento(o.v); setV(o.v); avisar(o.t) }}>
            <span>{o.t}</span>
            <span className="chico texto-3">{o.nota}</span>
          </button>
        ))}
      </div>
    </Tarjeta>
  )
}

/** «Lo no cumplido resta»: prendido/apagado y el %. Se guarda al tocar; vale desde hoy, nunca hacia atrás. */
function TarjetaResta({ a, onCambio }: { a: TipoAjustes; onCambio: (a: TipoAjustes) => void }) {
  const cfg = configResta(a)
  const [pct, setPct] = useState(String(cfg.porcentaje))
  const guardar = async (cambios: { activa?: boolean; porcentaje?: number }) => {
    const hoy = await fechaHoy()
    const nuevo = await mutar(() => cambiarResta(cambios, hoy))
    onCambio(nuevo)
    setPct(String(configResta(nuevo).porcentaje))
    return nuevo
  }
  return (
    <Tarjeta titulo="Lo no cumplido resta">
      <label className="fila chico" style={{ gap: 8 }}><input type="checkbox" checked={cfg.activa} onChange={async (e) => { await guardar({ activa: e.target.checked }); avisar(e.target.checked ? 'Lo no cumplido resta, desde hoy' : 'Lo no cumplido ya no resta') }} /> Lo no cumplido resta</label>
      <div className="rejilla-2">
        <div className="campo"><label>Cuánto resta (% de la XP que da)</label><input type="number" inputMode="numeric" min={10} max={100} disabled={!cfg.activa} value={pct} onChange={(e) => setPct(e.target.value)} onBlur={async () => { const v = Number(pct); if (Number.isFinite(v) && v !== cfg.porcentaje) { await guardar({ porcentaje: v }); avisar('Guardado') } else setPct(String(cfg.porcentaje)) }} /></div>
      </div>
      <p className="ayuda">Al cerrar el día, cada pilar o serie rápida que tocaba y no hiciste resta {cfg.porcentaje} % de su XP (Entrenamiento da 30 → −{cuantoResta(30, cfg.porcentaje)}). Con doble meta, la primera ya te cubre. No resta en descanso, lo pausado ni la falla perdonada de la forja. La XP nunca baja de 0.{cfg.desde ? ` Vale desde el ${cfg.desde.split('-').reverse().join('/')}; los días de antes no se tocan.` : ''}</p>
    </Tarjeta>
  )
}

export function Ajustes() {
  const datos = useDatos(() => obtenerAjustes(), [])
  const [a, setA] = useState<TipoAjustes | null>(null)
  useEffect(() => {
    if (datos.datos) setA(datos.datos)
  }, [datos.datos])
  if (!a) return <p className="vacio">Cargando…</p>
  const set = <K extends keyof TipoAjustes>(k: K, v: TipoAjustes[K]) => setA({ ...a, [k]: v })
  const num = (k: keyof TipoAjustes, min: number, max: number) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = Number(e.target.value)
    if (Number.isFinite(v)) set(k, Math.max(min, Math.min(max, v)) as never)
  }
  const guardar = async () => {
    await mutar(() => guardarAjustes(a))
    avisar('Ajustes guardados', { tipo: 'ok' })
  }
  return (
    <>
      <Atras />
      <h1>Ajustes</h1>
      <ElegirFranja />
      <ElegirVideoFondo />
      <Tarjeta titulo="Fondo con lluvia">
        <p className="chico texto-2">Lluvia dibujada detrás de la pantalla (sin video, casi no gasta), distinta en cada lugar. Con «reducir movimiento» queda quieta.</p>
        {([
          ['hoy', 'En Hoy: lluvia en diagonal con un relámpago tenue cada tanto'],
          ['calendario', 'En Calendario: llovizna con nubes a tinta que pasan'],
          ['juego', 'En Juego: gotas que resbalan por el vidrio y un charco (más lenta mientras jugás)'],
          ['sueno', 'En Sueño: la habitación con el futón y la lluvia por la ventana'],
          ['comida', 'En Comida: lluvia fina sobre hojas de bambú'],
          ['entreno', 'En Entreno y Rutinas: tormenta en diagonal que se calma en el descanso'],
          ['mas', 'En Más y sus pantallas: lluvia con viento y alguna hoja volando'],
        ] as const).map(([k, texto]) => (
          <label key={k} className="fila chico" style={{ gap: 8 }}><input type="checkbox" checked={a.fondoLluvia?.[k] !== false} onChange={async (e) => { const v = { ...a.fondoLluvia, [k]: e.target.checked }; set('fondoLluvia', v); await mutar(() => guardarAjustes({ fondoLluvia: v })); avisar(e.target.checked ? 'Lluvia encendida' : 'Lluvia apagada') }} /> {texto}</label>
        ))}
      </Tarjeta>
      <Tarjeta titulo="Brillo de pendientes">
        <label className="fila chico" style={{ gap: 8 }}><input type="checkbox" checked={a.brilloPendientes !== false} onChange={async (e) => { set('brilloPendientes', e.target.checked); await mutar(() => guardarAjustes({ brilloPendientes: e.target.checked })); avisar(e.target.checked ? 'Brillo de pendientes encendido' : 'Brillo de pendientes apagado') }} /> En Hoy, lo que falta titila en gris y lo hecho brilla en verde</label>
        <p className="ayuda">Pilares, Revisión diaria, 3·2·1, Siguiente acción, series rápidas y la fruta. Con «reducir movimiento» no titila: queda el color fijo.</p>
      </Tarjeta>
      <ElegirMovimiento />
      <Tarjeta titulo="Fondo de las animaciones">
        <div className="fondos-opciones" role="radiogroup" aria-label="Fondo de las animaciones">
          {([['epico', 'Épico', 'papel gris suave con nubes y lluvia'], ['claro', 'Papel', 'tinta sobre papel claro'], ['oscuro', 'Oscuro liso', 'fondo carbón sin cielo']] as const).map(([v, t, nota]) => (
            <button key={v} role="radio" aria-checked={(a.temaAnimaciones ?? 'epico') === v} className={`fondo-opcion ${(a.temaAnimaciones ?? 'epico') === v ? 'activo' : ''}`} onClick={async () => { set('temaAnimaciones', v); await mutar(() => guardarAjustes({ temaAnimaciones: v })); avisar(`Animaciones: ${t.toLowerCase()}`) }}>
              <span>{t}</span>
              <span className="chico texto-3">{nota}</span>
            </button>
          ))}
        </div>
        <p className="ayuda">Se ve en Más → Ver animaciones.</p>
      </Tarjeta>
      <Tarjeta titulo="Frases del compañero">
        <div className="campo"><label>Una por línea (rotan, no se repiten en el día)</label><textarea rows={6} value={(a.frasesCompanero ?? frasesCompanero(a)).join('\n')} onChange={(e) => set('frasesCompanero', e.target.value.split('\n'))} /></div>
        <p className="ayuda">Las dice el shinobi que se pasea por Hoy. Si borrás todas, vuelven las del tema. Los consejos según tus datos (agua, pilares, racha) van aparte y no se editan acá.</p>
      </Tarjeta>
      <Tarjeta titulo="Recordatorio para dormir">
        <div className="campo"><label>Minutos antes de «Dejo celu»</label><input type="number" inputMode="numeric" min={5} max={180} value={a.minutosAvisoDormir ?? MINUTOS_AVISO_DORMIR} onChange={num('minutosAvisoDormir', 5, 180)} /></div>
        <div className="campo"><label>Frases (una por línea, rotan cada noche)</label><textarea rows={4} value={(a.frasesDormir ?? FRASES_DORMIR_DEFECTO).join('\n')} onChange={(e) => set('frasesDormir', e.target.value.split('\n'))} /></div>
        <p className="ayuda">En Hoy aparece una franja oscura al pie, sin brillo. Un toque la cierra por esa noche; si ya marcaste «Dejo celu», no aparece.</p>
      </Tarjeta>
      <Tarjeta titulo="Juego">
        <div className="rejilla-2">
          <div className="campo"><label>Lunes a viernes (min)</label><input type="number" inputMode="numeric" value={a.limiteJuegoSemana} onChange={num('limiteJuegoSemana', 0, 1440)} /></div>
          <div className="campo"><label>Sáb, dom y feriados (min)</label><input type="number" inputMode="numeric" value={a.limiteJuegoFinde} onChange={num('limiteJuegoFinde', 0, 1440)} /></div>
          <div className="campo"><label>Aviso al (%)</label><input type="number" inputMode="numeric" value={a.avisoJuegoPorcentaje} onChange={num('avisoJuegoPorcentaje', 10, 100)} /></div>
        </div>
        <p className="ayuda">Los feriados se marcan desde el Calendario. El cambio vale de hoy en adelante; los días ya cerrados no se recalculan.</p>
      </Tarjeta>
      <TarjetaResta a={a} onCambio={(x) => setA({ ...a, xpResta: x.xpResta })} />
      <Tarjeta titulo="鍛 Forja de hábitos">
        <div className="rejilla-2">
          {([['dias', 'Días de forja', 1, 120], ['validos', 'Días válidos necesarios', 1, 120], ['xpDia', 'XP por día cumplido', 0, 100], ['xpForjado', 'XP al forjarse', 0, 500]] as const).map(([k, t, mn, mx]) => (
            <div key={k} className="campo"><label>{t}</label><input type="number" inputMode="numeric" value={{ ...FORJA_DEFECTO, ...(a.forja ?? {}) }[k]} onChange={(e) => { const v = Number(e.target.value); if (Number.isFinite(v)) set('forja', { ...(a.forja ?? {}), [k]: Math.max(mn, Math.min(mx, v)) }) }} /></div>
          ))}
        </div>
        <p className="ayuda">Cada semana de la forja perdona 1 falla. Si los válidos son más que los días, se usan los días. La XP ya ganada no cambia.</p>
      </Tarjeta>
      <Tarjeta titulo="XP y niveles">
        <div className="rejilla-2">
          <div className="campo"><label>Base de nivel</label><input type="number" inputMode="numeric" value={a.baseNivel} onChange={num('baseNivel', 10, 1000)} /><span className="ayuda">Subir del nivel n al n+1 cuesta base × n XP.</span></div>
          <div className="campo"><label>XP compromiso nuevo</label><input type="number" inputMode="numeric" value={a.xpCompromisoPorDefecto} onChange={num('xpCompromisoPorDefecto', 0, 200)} /></div>
          <div className="campo"><label>Máx. compromisos con XP / día</label><input type="number" inputMode="numeric" value={a.maxCompromisosXpPorDia} onChange={num('maxCompromisosXpPorDia', 1, 50)} /></div>
          <div className="campo"><label>XP por inicio 3-2-1</label><input type="number" inputMode="numeric" value={a.xpInicio} onChange={num('xpInicio', 0, 100)} /></div>
          <div className="campo"><label>Máx. inicios con XP / día</label><input type="number" inputMode="numeric" value={a.maxIniciosXpPorDia} onChange={num('maxIniciosXpPorDia', 0, 20)} /></div>
          <div className="campo"><label>XP racha de 7 días</label><input type="number" inputMode="numeric" value={a.xpRacha7} onChange={num('xpRacha7', 0, 200)} /></div>
        </div>
        <p className="ayuda">Cambiar estos valores no recalcula el XP ya ganado.</p>
      </Tarjeta>
      <Tarjeta titulo="Racha y atributos">
        <div className="rejilla-2">
          <div className="campo"><label>Umbral de racha (%)</label><input type="number" inputMode="numeric" value={a.umbralRacha} onChange={num('umbralRacha', 1, 100)} /></div>
          <div className="campo"><label>Mínimo de datos para atributo</label><input type="number" inputMode="numeric" value={a.minimoProgramadosAtributo} onChange={num('minimoProgramadosAtributo', 1, 50)} /></div>
        </div>
      </Tarjeta>
      <Tarjeta titulo="Fechas y copias">
        <div className="campo">
          <label>Zona horaria</label>
          <select value={a.zonaHoraria} onChange={(e) => set('zonaHoraria', e.target.value)}>
            {ZONAS.map((z) => <option key={z} value={z}>{z}</option>)}
          </select>
          <span className="ayuda">El día va de 00:00 a 00:00 en esta zona, aunque el teléfono esté en otra.</span>
        </div>
        <div className="campo"><label>Avisar copia de seguridad cada (días)</label><input type="number" inputMode="numeric" value={a.diasAvisoCopia} onChange={num('diasAvisoCopia', 1, 60)} /></div>
      </Tarjeta>
      <Tarjeta titulo="Recomendaciones de usuarios">
        <div className="campo">
          <label>Link del formulario de Google</label>
          <input value={a.formularioRecomendaciones ?? ''} onChange={(e) => set('formularioRecomendaciones', e.target.value)} placeholder="https://docs.google.com/forms/d/e/…/formResponse entry.1 entry.2 entry.3 entry.4" />
          <span className="ayuda">Pegá el link y, separados por espacios, los cuatro ids de los campos (entry.NNN) en este orden: qué recomendás, parte, contacto, app. Vacío: el botón «Recomendar algo» no se muestra. Cómo crear el formulario: recomendaciones-formulario-google.md.</span>
        </div>
      </Tarjeta>
      <button className="boton primario ancho" onClick={guardar}>Guardar ajustes</button>
    </>
  )
}

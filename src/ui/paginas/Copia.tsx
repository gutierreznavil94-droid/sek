import { useRef, useState } from 'react'
import { fechaDe, fechaLegible } from '../../domain/fechas'
import { obtenerAjustes } from '../../services/base'
import { borrarTodo, exportarCsv, exportarTodo, importarTodo, validarExportacion, type Exportacion } from '../../services/exportar'
import { ahora } from '../../services/reloj'
import { Atras, Confirmar, Tarjeta } from '../componentes'
import { avisar, mutar, useDatos } from '../estado'

function descargar(nombre: string, contenido: string, tipo: string) {
  const blob = new Blob([contenido], { type: tipo })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nombre
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}

export function Copia() {
  const ajustes = useDatos(() => obtenerAjustes(), [])
  const [pendiente, setPendiente] = useState<Exportacion | null>(null)
  const [confirmarBorrar, setConfirmarBorrar] = useState(false)
  const [error, setError] = useState('')
  const [texto, setTexto] = useState('')
  const [pegado, setPegado] = useState('')
  const archivo = useRef<HTMLInputElement>(null)

  const exportar = async () => {
    const datos = await mutar(exportarTodo)
    const fecha = fechaDe(ahora())
    descargar(`sek-${fecha}.json`, JSON.stringify(datos, null, 1), 'application/json')
    avisar('Copia exportada. Guardala en Drive, Telegram o el correo.', { tipo: 'ok' })
  }
  // Para cuando el navegador no deja descargar archivos (por ejemplo, dentro de Claude): la copia como texto.
  const copiarTexto = async () => {
    const datos = await mutar(exportarTodo)
    const json = JSON.stringify(datos)
    setTexto(json)
    try {
      await navigator.clipboard.writeText(json)
      avisar('Copia copiada. Pegala en un mail o una nota para guardarla.', { tipo: 'ok' })
    } catch {
      avisar('Seleccioná todo el texto de abajo y copialo.')
    }
  }
  const exportarCsvs = async () => {
    const csvs = await exportarCsv()
    for (const [nombre, contenido] of Object.entries(csvs)) if (contenido) descargar(nombre, contenido, 'text/csv')
    avisar('CSV exportados')
  }
  const leer = async (f: File) => leerTexto(await f.text())
  const leerTexto = (contenido: string) => {
    setError('')
    try {
      const datos = JSON.parse(contenido.trim())
      if (!validarExportacion(datos)) throw new Error('El archivo no es una copia de esta app.')
      setPendiente(datos)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }
  const importar = async () => {
    if (!pendiente) return
    try {
      const r = await mutar(() => importarTodo(pendiente))
      avisar(`Importado: ${r.filas} filas`, { tipo: 'ok' })
      setPendiente(null)
      setTimeout(() => location.reload(), 500)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }
  const ultima = ajustes.datos?.ultimaExportacion

  return (
    <>
      <Atras />
      <h1>Copia de seguridad</h1>
      <Tarjeta titulo="Exportar">
        <p className="chico texto-2">Los datos viven solo en este teléfono. Si borrás los datos del navegador (Chrome → Configuración → Privacidad → Borrar datos), desinstalás la app o perdés el teléfono, se pierden. Una copia por semana alcanza.</p>
        <div className="fila entre chico"><span className="texto-2">Última copia</span><b>{ultima ? fechaLegible(fechaDe(ultima)) : 'nunca'}</b></div>
        <button className="boton primario ancho" onClick={exportar}>Exportar todo (JSON)</button>
        <button className="boton ancho" onClick={copiarTexto}>Copiar todo como texto</button>
        {texto && (
          <>
            <p className="chico texto-2">Si no se copió solo: tocá el cuadro, «Seleccionar todo» y «Copiar». Pegalo en un mail o una nota.</p>
            <textarea readOnly value={texto} rows={5} style={{ width: '100%', fontSize: 12 }} onFocus={(e) => e.currentTarget.select()} />
          </>
        )}
        <button className="boton ancho" onClick={exportarCsvs}>Exportar registros (CSV)</button>
      </Tarjeta>
      <Tarjeta titulo="Importar">
        <p className="chico texto-2">Reemplaza <b>todo</b> lo que hay en la app por el contenido del archivo. Pedí confirmación antes.</p>
        <input ref={archivo} type="file" accept="application/json,.json" style={{ display: 'none' }} onChange={(e) => e.target.files?.[0] && leer(e.target.files[0])} />
        <button className="boton ancho" onClick={() => archivo.current?.click()}>Elegir archivo JSON</button>
        <p className="chico texto-2">O pegá acá el texto de la copia:</p>
        <textarea value={pegado} rows={4} style={{ width: '100%', fontSize: 12 }} placeholder="Pegá la copia acá" onChange={(e) => setPegado(e.target.value)} />
        <button className="boton ancho" disabled={!pegado.trim()} onClick={() => leerTexto(pegado)}>Importar texto pegado</button>
        {error && <p className="error">{error}</p>}
      </Tarjeta>
      <Tarjeta titulo="Zona peligrosa">
        <button className="boton peligro ancho" onClick={() => setConfirmarBorrar(true)}>Borrar todos los datos</button>
      </Tarjeta>
      <Confirmar abierta={!!pendiente} titulo="¿Reemplazar todos los datos?" texto={pendiente ? `Copia del ${fechaLegible(fechaDe(pendiente.exportado), false)} con ${Object.values(pendiente.tablas).reduce((s, t) => s + (Array.isArray(t) ? t.length : 0), 0)} filas. Lo que hay ahora se pierde.` : ''} confirmar="Reemplazar" peligro onConfirmar={importar} onCancelar={() => setPendiente(null)} />
      <Confirmar abierta={confirmarBorrar} titulo="¿Borrar todo?" texto="Se borra todo el historial, el XP y la configuración. No se puede deshacer. Exportá una copia antes." confirmar="Borrar todo" peligro onConfirmar={async () => { await mutar(borrarTodo); setConfirmarBorrar(false); location.reload() }} onCancelar={() => setConfirmarBorrar(false)} />
    </>
  )
}

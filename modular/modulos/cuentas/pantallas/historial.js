// Más → Historial de cambios, como la v0.88.27 (Historial.tsx): todo lo que anotan los módulos (qué, cuándo y
// el detalle), del más nuevo al más viejo, con filtros. Nada se borra. Pide a /api/cuentas/historial.
(function () {
  'use strict'
  const { api, $, seguro } = SEK
  const { esc, fechaLegible } = SEK.v88
  SEK.v88.montar({ activo: 'mas', companero: 'esquina' })
  const MODULOS = { dia: 'día', xp: 'XP', sueno: 'sueño', juego: 'juego', habitos: 'código y forja', entreno: 'entreno', comida: 'comida', ciclo: 'ciclo', temas: 'tema', organizacion: 'organización', desafios: 'desafíos', copia: 'copia', cuentas: 'ajustes' }
  /** Nombre del cambio a partir del tipo que anota cada módulo (crear_rutina → Creado, corregir → Corregido…). */
  function nombre(e) {
    const t = e.tipo
    if (e.modulo === 'xp' && t === 'anular') return 'XP anulado'
    if (t === 'subir_nivel') return 'Subida de nivel'
    if (t === 'cerrar_dia') return 'Día cerrado'
    if (/^crear|_crear$|agregar/.test(t)) return 'Creado'
    if (/^borrar|_borrar$|descartar/.test(t)) return 'Borrado'
    if (/corregir|deshacer/.test(t)) return 'Corregido'
    if (/^editar|_editar$|config|ajustes|ajustar|_mover$/.test(t)) return 'Editado'
    if (t === 'importar') return 'Importación'
    if (t === 'exportar') return 'Exportación'
    return t.charAt(0).toUpperCase() + t.slice(1).replace(/_/g, ' ')
  }
  const FILTROS = [['todos', 'Todos'], ['Corregido', 'Corregido'], ['XP anulado', 'XP anulado'], ['Subida de nivel', 'Subida de nivel'], ['Día cerrado', 'Día cerrado'], ['Editado', 'Editado']]
  let filtro = 'todos', limite = 60, d = null
  const hora = (ms) => new Date(Number(ms)).toTimeString().slice(0, 5)
  const fecha = (ms) => new Date(Number(ms)).toLocaleDateString('en-CA')
  /** El detalle en una línea corta: los textos y números de adentro, sin llaves. */
  function detalle(x) {
    if (x === null || x === undefined) return ''
    if (typeof x !== 'object') return String(x)
    return Object.entries(x).filter(([, v]) => v !== null && v !== undefined && typeof v !== 'object').map(([k, v]) => `${k}: ${v}`).join(' · ').slice(0, 160)
  }

  function pintar() {
    $('#total').textContent = `${d.total} evento${d.total === 1 ? '' : 's'}. Nada se borra: cada cambio, corrección o anulación queda aquí.`
    $('#filtros').innerHTML = FILTROS.map(([id, t]) => `<button type="button" class="${filtro === id ? 'activo' : ''}" data-f="${esc(id)}">${t}</button>`).join('')
    document.querySelectorAll('[data-f]').forEach((b) => { b.onclick = () => { filtro = b.dataset.f; pintar() } })
    const lista = d.eventos.filter((e) => filtro === 'todos' || nombre(e) === filtro)
    $('#lista').innerHTML = lista.map((e) => {
      const det = detalle(e.detalle)
      const conAntes = e.detalle && typeof e.detalle === 'object' && (e.detalle.antes !== undefined || e.detalle.despues !== undefined)
      return `<div class="col chico" style="padding: 8px 0; border-top: 1px solid var(--borde); gap: 2px;">
        <div class="fila entre"><b>${esc(nombre(e))} · ${esc(MODULOS[e.modulo] || e.modulo)}</b><span class="texto-3 muy-chico">${fechaLegible(fecha(e.instante))} ${hora(e.instante)}</span></div>
        ${det ? `<span class="texto-3 muy-chico">${esc(det)}</span>` : ''}
        ${conAntes ? `<details class="muy-chico texto-3"><summary>Antes / después</summary><pre style="white-space: pre-wrap; margin: 0;">${esc(JSON.stringify({ antes: e.detalle.antes, despues: e.detalle.despues }, null, 1))}</pre></details>` : ''}
      </div>`
    }).join('') || '<p class="chico texto-2">Nada con ese filtro.</p>'
    $('#mas').hidden = d.eventos.length < limite
  }

  const cargar = seguro(async () => { d = await api(`/api/cuentas/historial?limite=${limite}`); pintar() })
  $('#mas').onclick = () => { limite += 100; cargar() }
  cargar()
})()

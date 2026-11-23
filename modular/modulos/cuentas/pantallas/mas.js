// Pantalla Más, igual que la v0.88.27 (Mas.tsx de la app vieja) pero en HTML+JS: buscador, aviso de copia,
// la grilla de la app y tres grupos cortos. Solo están las secciones que ya andan en la app nueva (lo que no
// funciona no se muestra). Cada pantalla es de su módulo: acá va solo el link.
(function () {
  'use strict'
  const { api, $, seguro } = SEK
  const { esc } = SEK.v88
  SEK.v88.montar({ activo: 'mas', companero: 'esquina' })

  /** Lo de la app en sí: la grilla de arriba. */
  const SISTEMA = [
    { a: '/organizacion', icono: 'icono-organizacion', k: '陣', t: 'Organización', d: 'Notas y tareas', claves: 'organizacion tareas notas pendientes frentes bandeja anotar me toca hoy' },
    { a: '/mas/copia', icono: 'icono-copia', k: '写', t: 'Copia', d: 'Exportar e importar', claves: 'copia seguridad backup exportar importar json texto guardar datos app vieja traer' },
    { a: '/temas', icono: 'icono-tema', k: '彩', t: 'Tema', d: 'Cómo se ve y lluvia', claves: 'tema temas colores apariencia lluvia fondo shinobi subir propio' },
    { a: '/mas/ajustes', icono: 'icono-ajustes', k: '設', t: 'Ajustes', d: 'Juego, semana, zona', claves: 'ajustes configuracion limite juego racha zona horaria semana lunes aviso minutos' },
    { a: '/mas/historial', icono: 'icono-historial', k: '歴', t: 'Historial', d: 'Lo que cambió', claves: 'historial cambios registro corregir anulado' },
    { a: '/mas/nombres', icono: 'icono-nombres', k: '名', t: 'Nombres', d: 'App, vos y fases', claves: 'nombres nombre app fases disciplina constancia' },
    { a: '/ciclo', icono: 'icono-ciclo', k: '始', t: 'Nuevo ciclo', d: 'Día 1 y otros 90', claves: 'fecha inicio nuevo ciclo dia 1 empezar 90 dias reiniciar' },
  ]

  /** El resto, en tres grupos cortos (la explicación larga va adentro de cada pantalla). */
  const GRUPOS = [
    { titulo: 'Yo', items: [
      { a: '/ciclo/identidad', t: 'Identidad', d: 'Visión y obstáculos', claves: 'identidad vision obstaculos quien soy' },
      { a: '/ciclo/atributos', t: 'Atributos', d: 'Tus cinco áreas', claves: 'atributos areas stats fuerza' },
      { a: '/ciclo/metas', t: 'Metas con fecha', d: 'Qué querés lograr y cuándo', claves: 'metas fecha objetivo lograr verde rojo' },
      { a: '/ciclo/objetivos', t: 'Objetivos y fases', d: 'Qué buscás en cada etapa', claves: 'objetivos fases etapas 30 dias disciplina constancia' },
      { a: '/habitos', t: 'Mi código y forja', d: 'Reglas y hábitos en forja', claves: 'codigo reglas habitos forja piedra caidas okite' },
    ] },
    { titulo: 'Día a día', items: [
      { a: '/horario', t: 'Mi horario', d: 'Bloques fijos de la semana', claves: 'horario bloques colegio facultad trabajo cursada semana' },
      { a: '/comida/ajustes', t: 'Comida', d: 'Calorías, proteína y agua', claves: 'comida calorias proteina peso agua botella dieta plan' },
      { a: '/entreno/series', t: 'Contadores', d: 'Flexiones y dominadas', claves: 'contadores flexiones dominadas series cuota extra' },
      { a: '/desafios', t: 'Desafíos', d: 'Tensión, No cumplí, 3·2·1 y Tajo', claves: 'desafios tension no cumpli caida duelo tajo 321 tres dos uno empezar frase' },
      { a: '/xp', t: 'Nivel y XP', d: 'Historial y restas', claves: 'nivel xp puntos experiencia historial restas' },
    ] },
    { titulo: 'Entreno y descanso', items: [
      { a: '/entreno', t: 'Mis rutinas', d: 'Rutinas, ejercicios y días', claves: 'rutinas ejercicios entreno gimnasio colgarse barra historial series' },
      { a: '/sueno', t: 'Sueño', d: 'Noches, adaptación y ajustes', claves: 'sueno dormir descanso acostarse hora noche' },
    ] },
  ]

  const normalizar = (x) => String(x).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
  const coincide = (s, q) => !normalizar(q) || normalizar(q).split(/\s+/).every((p) => normalizar(`${s.t} ${s.d} ${s.claves}`).includes(p))
  const icono = (s) => { try { const i = SEK.icono && SEK.icono(s.icono); if (i && i !== s.icono) return i } catch (e) { /* respaldo */ } return s.k }

  let copiaPendiente = false
  function pintar() {
    const q = $('#buscar').value
    $('#borrar').hidden = !q
    const sistema = SISTEMA.filter((s) => coincide(s, q))
    const grupos = GRUPOS.map((g) => ({ ...g, items: g.items.filter((s) => coincide(s, q)) })).filter((g) => g.items.length)
    $('#aviso-copia').hidden = !copiaPendiente || !!q
    $('#sistema').hidden = !sistema.length
    $('#sistema').innerHTML = sistema.map((s) => `<a class="mas-sis ${s.a === '/mas/copia' && copiaPendiente ? 'pendiente' : ''}" href="${s.a}"><span class="mas-sis-icono" aria-hidden="true">${icono(s)}</span><span class="mas-sis-nombre">${esc(s.t)}</span><span class="mas-sis-desc">${esc(s.d)}</span></a>`).join('')
    $('#grupos').innerHTML = grupos.map((g) => `<section class="tarjeta compacta"><div class="tarjeta-cab"><h2>${esc(g.titulo)}</h2></div><div class="lista-nav">${g.items.map((s) => `<a href="${s.a}"><span>${esc(s.t)}<span class="desc">${esc(s.d)}</span></span><span class="flecha">›</span></a>`).join('')}</div></section>`).join('')
    $('#nada').hidden = sistema.length + grupos.length > 0
  }

  $('#buscar').addEventListener('input', pintar)
  $('#borrar').onclick = () => { $('#buscar').value = ''; pintar(); $('#buscar').focus() }
  $('#version').textContent = `v${SEK.v88.VERSION}`
  pintar()
  // Aviso de copia: si nunca exportaste, o hace 7 días o más.
  seguro(async () => {
    const r = await api('/api/copia')
    const dias = r.ultimaExportacion ? Math.floor((Date.now() - r.ultimaExportacion) / 86400000) : null
    copiaPendiente = dias === null || dias >= 7
    $('#aviso-copia-texto').textContent = dias === null ? 'Todavía no hiciste ninguna copia de seguridad.' : `Última copia hace ${dias} días.`
    pintar()
  })()
})()

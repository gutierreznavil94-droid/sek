// Pantalla Más: la lista de secciones (con buscador) y salir. Pide a /api/cuentas (las rutas de su módulo).
(function () {
  'use strict'
  const { api, $, seguro, barra } = SEK

  /**
   * Secciones de Más. Cuando un módulo nuevo tenga una pantalla que va en Más, se suma acá su fila
   * (solo el link: la pantalla es de su módulo).
   */
  const SECCIONES = [
    { ruta: '/mas/ajustes', kanji: '設', t: 'Ajustes', d: 'Zona horaria, semana y límites de juego', claves: 'ajustes configuracion zona horaria semana lunes domingo limite juego minutos aviso' },
    { ruta: '/mas/nombres', kanji: '名', t: 'Nombres', d: 'De la app, el tuyo y las fases', claves: 'nombres nombre app fases ciclo disciplina constancia' },
    { ruta: '/temas', kanji: '彩', t: 'Tema', d: 'Cómo se ve, lluvia y temas propios', claves: 'tema temas colores apariencia lluvia fondo shinobi subir propio sektema' },
    { ruta: '/juego', kanji: '遊', t: 'Juego', d: 'Temporizador y semana', claves: 'juego temporizador jugar semana limite' },
    { ruta: '/mas/cuenta', kanji: '鍵', t: 'Cuenta', d: 'Contraseña y salir', claves: 'cuenta contraseña clave email salir cerrar sesion' },
  ]

  const normalizar = (x) => String(x).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
  const coincide = (s, q) => !q || normalizar(q).split(/\s+/).every((p) => normalizar(`${s.t} ${s.d} ${s.claves}`).includes(p))
  const escapar = (x) => String(x).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))

  function pintar() {
    const q = $('#buscar').value
    const visibles = SECCIONES.filter((s) => coincide(s, q))
    $('#lista').innerHTML = visibles.map((s) => `
      <a href="${s.ruta}"><span class="kanji" aria-hidden="true">${s.kanji}</span><span class="nombre">${escapar(s.t)}</span><span class="desc">${escapar(s.d)}</span></a>`).join('')
    $('#nada').hidden = visibles.length > 0
  }

  $('#buscar').addEventListener('input', pintar)
  $('#salir').addEventListener('click', seguro(async () => { await api('/api/sesion/salir', {}); location.href = '/entrar' }))
  barra('mas')
  pintar()
  seguro(async () => {
    const r = await api('/api/cuentas')
    $('#quien').textContent = r.usuario.email
  })()
})()

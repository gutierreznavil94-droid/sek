// Pantalla Más: la lista de secciones (con buscador) y salir. Pide a /api/cuentas (las rutas de su módulo).
(function () {
  'use strict'
  const { api, $, seguro, barra } = SEK

  /**
   * Secciones de Más. Cuando un módulo nuevo tenga una pantalla que va en Más, se suma acá su fila
   * (solo el link: la pantalla es de su módulo).
   */
  const SECCIONES = [
    // Pantallas principales que no están en la barra de abajo (la barra tiene 5 fijos: Hoy, Calendario, Juego, Sueño, Más).
    { ruta: '/entreno', kanji: '鍛', t: 'Entreno', d: 'Rutinas, entrenar y series rápidas', claves: 'entreno entrenamiento rutinas ejercicios series flexiones dominadas gimnasio' },
    { ruta: '/comida', kanji: '食', t: 'Comida', d: 'Lo que comí, agua, fruta y peso', claves: 'comida comer calorias proteina agua fruta peso dieta' },
    { ruta: '/ciclo', kanji: '道', t: 'Ciclo', d: 'Los 90 días, fases, objetivos y metas', claves: 'ciclo 90 dias fases objetivos atributos identidad metas revision' },
    { ruta: '/organizacion', kanji: '陣', t: 'Tareas', d: 'Frentes y lo que me toca hoy', claves: 'tareas organizacion frentes anotar clasificar sueltas pendientes' },
    { ruta: '/habitos', kanji: '掟', t: 'Código y forja', d: 'Mi código, forja de hábitos y fotos', claves: 'codigo reglas habitos forja piedra fotos caidas' },
    { ruta: '/xp', kanji: '段', t: 'Nivel', d: 'XP, niveles e historial', claves: 'nivel xp puntos experiencia historial restas' },
    { ruta: '/horario', kanji: '時', t: 'Mi horario', d: 'Bloques fijos de la semana', claves: 'horario mi horario bloques colegio facultad trabajo cursada semana' },
    { ruta: '/mas/ajustes', kanji: '設', t: 'Ajustes', d: 'Zona horaria, semana y límites de juego', claves: 'ajustes configuracion zona horaria semana lunes domingo limite juego minutos aviso' },
    { ruta: '/mas/nombres', kanji: '名', t: 'Nombres', d: 'De la app, el tuyo y las fases', claves: 'nombres nombre app fases ciclo disciplina constancia' },
    { ruta: '/temas', kanji: '彩', t: 'Tema', d: 'Cómo se ve, lluvia y temas propios', claves: 'tema temas colores apariencia lluvia fondo shinobi subir propio sektema' },
    { ruta: '/desafios', kanji: '進', t: 'Desafíos', d: 'Tensión, No cumplí, 3·2·1, Tajo y la frase', claves: 'desafios tension no cumpli caida flexiones duelo tajo 321 tres dos uno empezar frase dudar fracasar' },
    { ruta: '/progreso', kanji: '進', t: 'Progreso', d: 'La montaña de XP, pilares, sueño, fuerza, comida y cierre de fase', claves: 'progreso montaña camino xp grafico estadisticas pilares atributos sueño fuerza entreno comida agua peso series caidas fase cierre' },
    { ruta: '/juego', kanji: '遊', t: 'Juego', d: 'Temporizador y semana', claves: 'juego temporizador jugar semana limite' },
    { ruta: '/mas/copia', kanji: '写', t: 'Copia de seguridad', d: 'Traer datos de la app vieja y guardar una copia', claves: 'copia seguridad backup exportar importar pegar texto json app vieja traer datos guardar' },
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

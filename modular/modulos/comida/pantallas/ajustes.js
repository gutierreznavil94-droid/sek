// Más → Comida, igual que la v0.88.27 (MasComida): tu objetivo (calorías y proteína), el peso de hoy, el agua
// (envases, cómo se ve en Hoy y objetivo), la fruta del día, el pilar «Comer según el plan» y de dónde salen
// los datos. Pide a /api/comida/ajustes; el pilar a /api/dia/comida.
(function () {
  'use strict'
  const { api, $, seguro } = SEK
  const { esc, avisar, confirmar, litros } = SEK.v88
  SEK.v88.montar({ activo: 'mas', companero: 'esquina' })
  const num = (n) => Math.round(n).toLocaleString('es-AR')
  const FACTOR = { sedentario: 1.2, ligero: 1.375, moderado: 1.55, alto: 1.725 }
  const ACTIVIDAD = [['sedentario', 'Sedentario'], ['ligero', 'Ligero'], ['moderado', 'Moderado'], ['alto', 'Alto']]
  const META = [['bajar', 'Bajar grasa'], ['mantener', 'Mantener'], ['ganar', 'Ganar músculo']]

  // La misma cuenta que calculo.js (para mostrar mientras se escribe; la que vale es la del servidor).
  function calcular(d) {
    const basal = 10 * d.peso + 6.25 * d.altura - 5 * d.edad + (d.sexo === 'hombre' ? 5 : -161)
    const mant = basal * (FACTOR[d.actividad] || 1.2)
    const kcal = mant * (d.meta === 'bajar' ? 0.8 : d.meta === 'ganar' ? 1.1 : 1)
    return { kcal: Math.max(0, Math.round(kcal / 50) * 50), proteina: Math.max(0, Math.round((d.peso * (d.meta === 'mantener' ? 1.4 : 1.8)) / 5) * 5), mantenimiento: Math.max(0, Math.round(mant / 50) * 50) }
  }

  let a = null // /api/comida/ajustes
  let pilarActivo = false
  let f = { peso: 70, altura: 170, edad: 25, sexo: 'hombre', actividad: 'moderado', meta: 'mantener' }
  let manual = null // { kcal, proteina } como texto, o null = el cálculo

  const tarjeta = (id, titulo, html) => `<section class="tarjeta" id="${id}"><div class="tarjeta-cab"><h2>${titulo}</h2></div>${html}</section>`

  // ---------- Tu objetivo ----------
  function objetivoHtml() {
    const c = calcular(f)
    const kcal = manual ? Number(manual.kcal) || c.kcal : c.kcal
    const proteina = manual ? Number(manual.proteina) || c.proteina : c.proteina
    const campo = (k, etq, modo) => `<div class="campo"><label for="mc-${k}">${etq}</label><input id="mc-${k}" type="number" inputmode="${modo}" value="${f[k] || ''}" data-n="${k}"></div>`
    return `<div class="co-dos">${campo('peso', 'Peso (kg)', 'decimal')}${campo('altura', 'Altura (cm)', 'numeric')}</div>
      <div class="co-dos">${campo('edad', 'Edad', 'numeric')}<div class="campo"><label for="mc-sexo">Sexo</label><select id="mc-sexo"><option value="hombre"${f.sexo === 'hombre' ? ' selected' : ''}>Hombre</option><option value="mujer"${f.sexo === 'mujer' ? ' selected' : ''}>Mujer</option></select></div></div>
      <span class="seccion-titulo">Actividad</span>
      <div class="co-franjas">${ACTIVIDAD.map(([id, n]) => `<button type="button" class="${f.actividad === id ? 'activo' : ''}" data-actividad="${id}">${n}</button>`).join('')}</div>
      <span class="seccion-titulo">Meta</span>
      <div class="co-franjas">${META.map(([id, n]) => `<button type="button" class="${f.meta === id ? 'activo' : ''}" data-meta="${id}">${n}</button>`).join('')}</div>
      <div class="co-objetivo"><b>${num(kcal)} kcal</b> y <b>${proteina} g de proteína</b> por día.
        <span class="chico texto-3">Mantenimiento ≈ ${num(c.mantenimiento)} kcal (Mifflin-St Jeor × actividad${f.meta === 'bajar' ? ', −20 %' : f.meta === 'ganar' ? ', +10 %' : ''}).</span></div>
      ${manual ? `<div class="co-dos"><div class="campo"><label for="mc-k">Calorías a mano</label><input id="mc-k" type="number" inputmode="numeric" value="${esc(manual.kcal)}"></div><div class="campo"><label for="mc-p">Proteína a mano</label><input id="mc-p" type="number" inputmode="numeric" value="${esc(manual.proteina)}"></div></div>
        <button type="button" class="enlace chico" data-al-calculo>Volver al cálculo</button>`
        : '<button type="button" class="enlace chico" data-a-mano>Corregir a mano</button>'}
      <button type="button" class="boton primario ancho" data-guardar-objetivo>Guardar objetivo</button>`
  }
  function pintarObjetivo() {
    const el = $('#objetivo')
    el.innerHTML = '<div class="tarjeta-cab"><h2>Tu objetivo</h2></div>' + objetivoHtml()
    const q = (s) => el.querySelector(s)
    // Escribir solo cambia el texto del resultado (sin redibujar, para no perder el foco).
    const resultado = () => {
      const c = calcular(f)
      const kcal = manual ? Number(manual.kcal) || c.kcal : c.kcal
      const proteina = manual ? Number(manual.proteina) || c.proteina : c.proteina
      q('.co-objetivo').innerHTML = `<b>${num(kcal)} kcal</b> y <b>${proteina} g de proteína</b> por día.
        <span class="chico texto-3">Mantenimiento ≈ ${num(c.mantenimiento)} kcal (Mifflin-St Jeor × actividad${f.meta === 'bajar' ? ', −20 %' : f.meta === 'ganar' ? ', +10 %' : ''}).</span>`
    }
    el.querySelectorAll('[data-n]').forEach((i) => { i.oninput = () => { f[i.dataset.n] = Number(i.value); resultado() } })
    q('#mc-sexo').onchange = (e) => { f.sexo = e.target.value; resultado() }
    el.querySelectorAll('[data-actividad]').forEach((b) => { b.onclick = () => { f.actividad = b.dataset.actividad; pintarObjetivo() } })
    el.querySelectorAll('[data-meta]').forEach((b) => { b.onclick = () => { f.meta = b.dataset.meta; pintarObjetivo() } })
    const am = q('[data-a-mano]')
    if (am) am.onclick = () => { const c = calcular(f); manual = { kcal: String(c.kcal), proteina: String(c.proteina) }; pintarObjetivo() }
    const ac = q('[data-al-calculo]')
    if (ac) ac.onclick = () => { manual = null; pintarObjetivo() }
    if (manual) { q('#mc-k').oninput = (e) => { manual.kcal = e.target.value; resultado() }; q('#mc-p').oninput = (e) => { manual.proteina = e.target.value; resultado() } }
    q('[data-guardar-objetivo]').onclick = seguro(async () => {
      const c = calcular(f)
      const cuerpo = { ...f, ...(manual ? { manual: true, kcal: Number(manual.kcal) || c.kcal, proteina: Number(manual.proteina) || c.proteina } : {}) }
      a = await api('/api/comida/objetivo', cuerpo, 'PUT')
      avisar('Objetivo guardado', { tipo: 'ok' })
      pintar()
    })
  }

  // ---------- Peso de hoy ----------
  function pintarPeso() {
    const el = $('#peso')
    if (!a.objetivo) { el.hidden = true; return }
    el.hidden = false
    el.innerHTML = `<div class="tarjeta-cab"><h2>Peso de hoy</h2></div>
      <p class="chico texto-2">Queda en la curva de Progreso → 食. Último: ${String(a.objetivo.peso).replace('.', ',')} kg.</p>
      <div class="co-dos"><input type="number" inputmode="decimal" placeholder="kg" aria-label="Peso de hoy" id="peso-kg"><button type="button" class="boton" data-guardar-peso disabled>Guardar</button></div>`
    const kg = $('#peso-kg'), b = el.querySelector('[data-guardar-peso]')
    kg.oninput = () => { b.disabled = !Number(String(kg.value).replace(',', '.')) }
    b.onclick = seguro(async () => {
      a = await api('/api/comida/peso', { kg: Number(String(kg.value).replace(',', '.')) })
      f.peso = a.objetivo ? a.objetivo.peso : f.peso
      avisar('Peso guardado', { tipo: 'ok' })
      pintar()
    })
  }

  // ---------- Agua ----------
  async function guardarAgua(cambios, aviso = 'Agua guardada') {
    try {
      a = await api('/api/comida/agua/config', { ...a.agua.config, ...cambios }, 'PUT')
      avisar(aviso, { tipo: 'ok' })
    } catch (e) { avisar(e.message) }
    pintarAgua()
  }
  function pintarAgua() {
    const d = a.agua, envases = d.config.envases, enHoy = d.config.enHoy || 'chica'
    const el = $('#agua')
    el.innerHTML = `<div class="tarjeta-cab"><h2>Agua</h2></div>
      <p class="chico texto-2">La cantimplora de Hoy suma el envase principal con un toque. Mantené apretado para los otros.</p>
      <div class="col" style="gap: 4px;"><span class="seccion-titulo">En Hoy</span>
        <div class="fila" style="gap: 6px; flex-wrap: wrap;">${[['chica', 'Chiquita, en Comida'], ['tarjeta', 'Tarjeta aparte'], ['no', 'No usar']].map(([v, t]) => `<button type="button" class="boton chico ${enHoy === v ? 'primario' : 'suave'}" aria-pressed="${enHoy === v}" data-en-hoy="${v}">${t}</button>`).join('')}</div></div>
      <div class="col" style="gap: 6px;">
        ${envases.map((e, i) => `<div class="agua-envase-fila">
          <input aria-label="Nombre del envase" value="${esc(e.nombre)}" maxlength="30" data-env-nombre="${i}">
          <input aria-label="Mililitros" type="number" inputmode="numeric" value="${e.ml}" data-env-ml="${i}">
          <button type="button" class="boton chico ${e.id === d.config.principal ? 'primario' : 'suave'}" aria-pressed="${e.id === d.config.principal}" data-principal="${i}">${e.id === d.config.principal ? 'Toque' : 'Usar'}</button>
          <button type="button" class="boton chico suave" aria-label="Borrar ${esc(e.nombre)}" data-env-borrar="${i}" ${envases.length <= 1 ? 'disabled' : ''}>✕</button></div>`).join('')}
        <div class="agua-envase-fila nuevo">
          <input placeholder="Nuevo envase" aria-label="Nombre del envase nuevo" maxlength="30" id="env-nombre">
          <input placeholder="ml" type="number" inputmode="numeric" aria-label="Mililitros del envase nuevo" id="env-ml">
          <button type="button" class="boton chico" data-env-agregar disabled>+ Agregar</button></div>
      </div>
      <div class="col" style="gap: 4px; margin-top: 6px;"><span class="seccion-titulo">Objetivo por día</span>
        <p class="chico texto-2" style="margin: 0;">${d.pesoUsado ? `${num(d.calculado)} ml: 35 ml por kilo × ${String(d.pesoUsado).replace('.', ',')} kg, redondeado a 250.` : `${num(d.calculado)} ml mientras no haya peso en tu objetivo de comida.`}</p>
        ${d.config.objetivoMl ? `<div class="co-dos"><input type="number" inputmode="numeric" value="${d.config.objetivoMl}" aria-label="Objetivo en ml" id="agua-obj">
            <div class="fila" style="gap: 6px;"><button type="button" class="boton chico" data-obj-guardar>Guardar</button><button type="button" class="boton chico suave" data-obj-calculo>Al cálculo</button></div></div>`
          : '<button type="button" class="enlace chico" data-obj-mano>Corregir a mano</button>'}
      </div>`
    const q = (s) => el.querySelector(s)
    const copia = () => envases.map((e) => ({ ...e }))
    el.querySelectorAll('[data-en-hoy]').forEach((b) => { b.onclick = () => guardarAgua({ enHoy: b.dataset.enHoy }, b.dataset.enHoy === 'chica' ? 'Agua chiquita en Comida' : b.dataset.enHoy === 'tarjeta' ? 'Agua como tarjeta' : 'Agua: no se usa') })
    el.querySelectorAll('[data-env-nombre]').forEach((i) => { i.onchange = () => { const e = copia(); e[Number(i.dataset.envNombre)].nombre = i.value; guardarAgua({ envases: e }, 'Envase guardado') } })
    el.querySelectorAll('[data-env-ml]').forEach((i) => { i.onchange = () => { const e = copia(); e[Number(i.dataset.envMl)].ml = Number(i.value); guardarAgua({ envases: e }, 'Envase guardado') } })
    el.querySelectorAll('[data-principal]').forEach((b) => { b.onclick = () => { const e = envases[Number(b.dataset.principal)]; guardarAgua({ principal: e.id }, `${e.nombre}: el del toque`) } })
    el.querySelectorAll('[data-env-borrar]').forEach((b) => { b.onclick = () => guardarAgua({ envases: envases.filter((_, i) => i !== Number(b.dataset.envBorrar)) }, 'Envase borrado') })
    const nn = q('#env-nombre'), nm = q('#env-ml'), ag = q('[data-env-agregar]')
    const revisar = () => { ag.disabled = !nn.value.trim() || !(Number(nm.value) > 0) }
    nn.oninput = revisar; nm.oninput = revisar
    ag.onclick = () => guardarAgua({ envases: [...copia(), { id: `env-${Date.now().toString(36)}`, nombre: nn.value.trim(), ml: Number(nm.value) }] }, 'Envase agregado')
    const mano = q('[data-obj-mano]')
    if (mano) mano.onclick = () => { a.agua.config.objetivoMl = d.objetivo; pintarAgua(); q('#agua-obj') && $('#agua-obj').focus() }
    const og = q('[data-obj-guardar]')
    if (og) og.onclick = () => { const v = Number($('#agua-obj').value); if (!(v > 0)) return avisar('Poné los ml.'); guardarAgua({ objetivoMl: v }, `Objetivo: ${litros(v)}`) }
    const oc = q('[data-obj-calculo]')
    if (oc) oc.onclick = () => guardarAgua({ objetivoMl: null }, 'Vuelve al cálculo')
  }

  // ---------- Fruta del día ----------
  async function guardarFruta(cambios) {
    try { a = await api('/api/comida/fruta/config', cambios, 'PUT'); avisar('Fruta guardada', { tipo: 'ok' }) } catch (e) { avisar(e.message) }
    pintarFruta()
  }
  function pintarFruta() {
    const d = a.fruta
    const el = $('#fruta')
    el.innerHTML = `<div class="tarjeta-cab"><h2>Fruta del día</h2></div>
      <p class="chico texto-2">La manzana de Hoy, al lado del agua: cada toque suma una y se muerde más. Mantené apretado para deshacer.</p>
      <label class="fila entre chico"><span>Usar la fruta del día</span><input type="checkbox" id="fruta-usar" ${d.usar !== false ? 'checked' : ''}></label>
      <div class="campo"><label for="fruta-nombre">Nombre</label><input id="fruta-nombre" value="${esc(d.nombre)}" maxlength="30"></div>
      <div class="fila" style="gap: 10px;">
        <div class="campo crece"><label for="fruta-o1">1.er objetivo</label><input id="fruta-o1" type="number" inputmode="numeric" min="1" value="${d.objetivo1}"></div>
        <div class="campo crece"><label for="fruta-o2">2.º objetivo</label><input id="fruta-o2" type="number" inputmode="numeric" min="${d.objetivo1}" value="${d.objetivo2}"></div></div>
      <p class="ayuda">Con el 1.º la manzana queda bastante mordida y brilla verde titilando; con el 2.º queda solo el centro y brilla fijo.</p>`
    $('#fruta-usar').onchange = (e) => guardarFruta({ usar: e.target.checked })
    $('#fruta-nombre').onchange = (e) => { if (e.target.value.trim() !== d.nombre) guardarFruta({ nombre: e.target.value }) }
    $('#fruta-o1').onchange = (e) => { const v = Number(e.target.value); if (v > 0) guardarFruta({ objetivo1: v, objetivo2: Math.max(v, d.objetivo2) }) }
    $('#fruta-o2').onchange = (e) => { const v = Number(e.target.value); if (v > 0) guardarFruta({ objetivo2: v }) }
  }

  // ---------- Pilar «Comer según el plan» ----------
  function pintarPilar() {
    const el = $('#pilar'), o = a.objetivo
    el.innerHTML = `<div class="tarjeta-cab"><h2>Pilar «Comer según el plan»</h2></div>
      <p class="chico texto-2">Se cumple si el día cierra entre −10 % y +10 % de tus calorías y llegás a tu proteína. 15 XP. Un día sin cargar comidas no cuenta: retomás sin castigo.</p>
      <button type="button" class="boton ancho ${pilarActivo ? '' : 'primario'}" data-pilar ${o ? '' : 'disabled'}>${pilarActivo ? 'Apagar el pilar' : o ? 'Activar el pilar' : 'Primero guardá tu objetivo'}</button>`
    const cambiar = async (activo) => { await api('/api/dia/comida', { activo }); pilarActivo = activo; pintarPilar() }
    el.querySelector('[data-pilar]').onclick = seguro(async () => {
      if (pilarActivo) return confirmar('¿Apagar el pilar de comida?', 'Lo ya ganado no cambia. Desde hoy deja de contar.', 'Apagar', () => cambiar(false))
      await cambiar(true)
      avisar('Pilar de comida activado', { tipo: 'ok' })
    })
  }

  function pintar() {
    if (!$('#objetivo')) {
      $('#tarjetas').innerHTML = ['<section class="tarjeta" id="objetivo"></section>', '<section class="tarjeta" id="peso" hidden></section>', '<section class="tarjeta" id="agua"></section>', '<section class="tarjeta" id="fruta"></section>', '<section class="tarjeta" id="pilar"></section>',
        tarjeta('fuentes', 'De dónde salen los datos', `<ul class="chico texto-2" style="margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 4px;">
          <li>Tabla local de ${a.alimentosEnTabla} alimentos: ${esc(a.fuentes.U)}</li><li>${esc(a.fuentes.A)}</li>
          <li>Códigos de barras: Open Food Facts (openfoodfacts.org), base abierta bajo licencia ODbL.</li>
          <li>Objetivo: fórmula de Mifflin-St Jeor; proteína 1,8 g/kg (1,4 si mantenés).</li></ul>`)].join('')
    }
    pintarObjetivo(); pintarPeso(); pintarAgua(); pintarFruta(); pintarPilar()
  }

  seguro(async () => {
    const [aj, ac] = await Promise.all([api('/api/comida/ajustes'), api('/api/dia/acciones').catch(() => null)])
    a = aj
    const p = ac && ac.acciones.find((x) => x.tipo === 'comida_plan')
    pilarActivo = !!(p && p.activa)
    const o = a.objetivo
    if (o) {
      f = { peso: o.peso, altura: o.altura, edad: o.edad, sexo: o.sexo, actividad: o.actividad, meta: o.meta }
      if (o.manual) manual = { kcal: String(o.kcal), proteina: String(o.proteina) }
    }
    pintar()
  })()
})()

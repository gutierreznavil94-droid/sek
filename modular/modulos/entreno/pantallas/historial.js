// Historial de entrenos, igual que la v0.88.27 (HistorialEntrenos de Rutinas.tsx): cada entreno terminado con
// sus series ejercicio por ejercicio y los tiempos. Pide a /api/entreno/historial.
(function () {
  'use strict'
  const { api, $, seguro } = SEK
  const { esc, fechaLegible } = SEK.v88
  SEK.v88.montar({ activo: 'mas', companero: 'esquina' })
  const kg = (p) => (p === 0 ? 'peso corporal' : `${String(p).replace('.', ',')} kg`)
  const reloj = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
  const reps = (x) => `${x.reps}${x.repsExtra ? `+${x.repsExtra}` : ''}${x.ayuda ? ` +${x.ayuda} ayuda` : ''}`

  seguro(async () => {
    const { entrenos } = await api('/api/entreno/historial')
    $('#lista').innerHTML = entrenos.length ? entrenos.map((s) => `<section class="tarjeta compacta">
        <div class="fila entre"><b>${esc(fechaLegible(s.fecha))}</b><span class="texto-3 chico">${esc(s.rutina.split(' · ')[0])} · ${s.minutos} min${s.xpExtra ? ` · +${s.xpExtra} XP` : ''}</span></div>
        ${s.ejercicios.map((e) => `<div class="hist-ejercicio"><span class="chico">${esc(e.nombre)}</span>
          <div class="chips-mini">${e.series.sort((a, b) => a.n - b.n).map((x) => `<span class="hist-serie mono">S${x.n} ${reps(x)} × ${kg(x.peso)}</span>`).join('')}</div></div>`).join('')}
        ${s.tiempos.map((x) => `<div class="fila entre chico"><span>${esc(x.nombre)}</span><span class="mono">${reloj(x.segundos)} · ${kg(x.peso)}</span></div>`).join('')}
      </section>`).join('') : '<p class="vacio">Todavía no terminaste ningún entreno.</p>'
  })()
})()

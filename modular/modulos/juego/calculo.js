'use strict'
/**
 * Cálculo del tiempo de juego a partir de marcas (inicio, pausas, fin). Una sesión que cruza la medianoche se reparte.
 * Traído de la app vieja (src/domain) tal cual, sin tipos.
 */
const { fechaDe, inicioDelDia, sumarDias, ZONA_POR_DEFECTO } = require("../../comun/fechas");
function tramosActivos(sesion, ahora) {
  const fin = sesion.fin ?? ahora;
  const tramos = [];
  let cursor = sesion.inicio;
  const pausas = [...sesion.pausas].sort((a, b) => a.desde - b.desde);
  for (const p of pausas) {
    const pDesde = Math.max(p.desde, cursor);
    const pHasta = Math.min(p.hasta ?? fin, fin);
    if (pDesde > cursor) tramos.push({ desde: cursor, hasta: Math.min(pDesde, fin) });
    cursor = Math.max(cursor, pHasta);
  }
  if (cursor < fin) tramos.push({ desde: cursor, hasta: fin });
  return tramos;
}
function duracionMs(sesion, ahora) {
  return tramosActivos(sesion, ahora).reduce((s, t) => s + (t.hasta - t.desde), 0);
}
function estaPausada(sesion) {
  if (sesion.fin) return false;
  const ultima = sesion.pausas[sesion.pausas.length - 1];
  return !!ultima && ultima.hasta === void 0;
}
function minutosPorDia(sesiones, ahora, zona = ZONA_POR_DEFECTO) {
  const mapa = /* @__PURE__ */ new Map();
  for (const s of sesiones) {
    for (const t of tramosActivos(s, ahora)) {
      let cursor = t.desde;
      let guardia = 0;
      while (cursor < t.hasta && guardia++ < 100) {
        const fecha = fechaDe(cursor, zona);
        const finDia = inicioDelDia(sumarDias(fecha, 1), zona);
        const hasta = Math.min(finDia, t.hasta);
        mapa.set(fecha, (mapa.get(fecha) ?? 0) + (hasta - cursor) / 6e4);
        cursor = hasta;
      }
    }
  }
  return mapa;
}
function minutosDelDia(sesiones, fecha, ahora, zona = ZONA_POR_DEFECTO) {
  return minutosPorDia(sesiones, ahora, zona).get(fecha) ?? 0;
}
function estadoLimite(minutos, limiteMinutos, avisoPorcentaje = 80) {
  if (limiteMinutos <= 0) return "ok";
  if (minutos >= limiteMinutos) return "superado";
  if (minutos >= limiteMinutos * avisoPorcentaje / 100) return "cerca";
  return "ok";
}
function unirTramos(tramos) {
  const orden = tramos.filter((t) => t.hasta > t.desde).sort((a, b) => a.desde - b.desde);
  const r = [];
  for (const t of orden) {
    const u = r[r.length - 1];
    if (u && t.desde <= u.hasta) u.hasta = Math.max(u.hasta, t.hasta);
    else r.push({ ...t });
  }
  return r;
}
function minutosPorDiaDeTramos(tramos, zona = ZONA_POR_DEFECTO) {
  const mapa = /* @__PURE__ */ new Map();
  for (const t of tramos) {
    let cursor = t.desde;
    let guardia = 0;
    while (cursor < t.hasta && guardia++ < 100) {
      const fecha = fechaDe(cursor, zona);
      const hasta = Math.min(inicioDelDia(sumarDias(fecha, 1), zona), t.hasta);
      mapa.set(fecha, (mapa.get(fecha) ?? 0) + (hasta - cursor) / 6e4);
      cursor = hasta;
    }
  }
  return mapa;
}
function minutosPorDiaConCelu(sesiones, celu, ahora, zona = ZONA_POR_DEFECTO) {
  if (!celu.length) return minutosPorDia(sesiones, ahora, zona);
  return minutosPorDiaDeTramos(unirTramos([...sesiones.flatMap((s) => tramosActivos(s, ahora)), ...celu]), zona);
}
module.exports = {
  duracionMs,
  estaPausada,
  estadoLimite,
  minutosDelDia,
  minutosPorDia,
  minutosPorDiaConCelu,
  minutosPorDiaDeTramos,
  tramosActivos,
  unirTramos
}

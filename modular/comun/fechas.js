'use strict'
/**
 * Fechas: un día es una fecha AAAA-MM-DD en la zona horaria de la persona (por defecto Córdoba). Todo cálculo de qué día es pasa por acá.
 * Traído de la app vieja (src/domain) tal cual, sin tipos.
 */
const ZONA_POR_DEFECTO = "America/Argentina/Cordoba";
const cacheFormateadores = /* @__PURE__ */ new Map();
function formateador(zona) {
  let f = cacheFormateadores.get(zona);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: zona,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      weekday: "short"
    });
    cacheFormateadores.set(zona, f);
  }
  return f;
}
const DIAS_SEMANA_EN = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6
}
function partesLocales(instante, zona = ZONA_POR_DEFECTO) {
  const d = typeof instante === "number" ? new Date(instante) : instante;
  const partes = formateador(zona).formatToParts(d);
  const v = {};
  for (const p of partes) v[p.type] = p.value;
  const anio = Number(v.year);
  const mes = Number(v.month);
  const dia = Number(v.day);
  return {
    fecha: `${v.year}-${v.month}-${v.day}`,
    anio,
    mes,
    dia,
    hora: Number(v.hour) % 24,
    minuto: Number(v.minute),
    segundo: Number(v.second),
    diaSemana: DIAS_SEMANA_EN[v.weekday] ?? 0
  };
}
function fechaDe(instante, zona = ZONA_POR_DEFECTO) {
  return partesLocales(instante, zona).fecha;
}
function esFechaValida(fecha) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return false;
  const [a, m, d] = fecha.split("-").map(Number);
  const dt = new Date(Date.UTC(a, m - 1, d));
  return dt.getUTCFullYear() === a && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}
function ordinal(fecha) {
  const [a, m, d] = fecha.split("-").map(Number);
  return Math.round(Date.UTC(a, m - 1, d) / 864e5);
}
function diferenciaDias(desde, hasta) {
  return ordinal(hasta) - ordinal(desde);
}
function sumarDias(fecha, dias) {
  const [a, m, d] = fecha.split("-").map(Number);
  const dt = new Date(Date.UTC(a, m - 1, d + dias));
  const aa = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${aa}-${mm}-${dd}`;
}
function compararFechas(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}
function diaDelCiclo(inicio, hoy) {
  return diferenciaDias(inicio, hoy) + 1;
}
function fechaDelDiaDelCiclo(inicio, dia) {
  return sumarDias(inicio, dia - 1);
}
function faseDelDia(dia, diasPorFase = 30) {
  if (dia < 1) return 1;
  return Math.floor((dia - 1) / diasPorFase) + 1;
}
function diaSemanaDe(fecha) {
  const [a, m, d] = fecha.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d)).getUTCDay();
}
function lunesDe(fecha) {
  const ds = diaSemanaDe(fecha);
  const desdeLunes = (ds + 6) % 7;
  return sumarDias(fecha, -desdeLunes);
}
function domingoDe(fecha) {
  return sumarDias(lunesDe(fecha), 6);
}
function inicioDelDia(fecha, zona = ZONA_POR_DEFECTO) {
  const [a, m, d] = fecha.split("-").map(Number);
  const aproximado = Date.UTC(a, m - 1, d);
  let candidato = aproximado - desfaseMinutos(aproximado, zona) * 6e4;
  const p = partesLocales(candidato, zona);
  if (p.fecha !== fecha || p.hora !== 0 || p.minuto !== 0) {
    candidato = aproximado - desfaseMinutos(candidato, zona) * 6e4;
  }
  return candidato;
}
function desfaseMinutos(instante, zona = ZONA_POR_DEFECTO) {
  const p = partesLocales(instante, zona);
  const comoUtc = Date.UTC(p.anio, p.mes - 1, p.dia, p.hora, p.minuto, p.segundo);
  const ms = instante - Math.floor(instante / 1e3) * 1e3;
  return Math.round((comoUtc - (instante - ms)) / 6e4);
}
function proximaMedianoche(instante, zona = ZONA_POR_DEFECTO) {
  return inicioDelDia(sumarDias(fechaDe(instante, zona), 1), zona);
}
function instanteDe(fecha, horaMinuto, zona = ZONA_POR_DEFECTO) {
  const [h, mi] = horaMinuto.split(":").map(Number);
  return inicioDelDia(fecha, zona) + (h * 60 + mi) * 6e4;
}
function esHoraValida(hm) {
  if (!/^\d{2}:\d{2}$/.test(hm)) return false;
  const [h, m] = hm.split(":").map(Number);
  return h >= 0 && h <= 23 && m >= 0 && m <= 59;
}
function minutosDe(hm) {
  const [h, m] = hm.split(":").map(Number);
  return h * 60 + m;
}
function formatoHora(instante, zona = ZONA_POR_DEFECTO) {
  const p = partesLocales(instante, zona);
  return `${String(p.hora).padStart(2, "0")}:${String(p.minuto).padStart(2, "0")}`;
}
function nocheDeSuenio(instante, zona = ZONA_POR_DEFECTO, horaCorte = "06:00") {
  const p = partesLocales(instante, zona);
  const minutos = p.hora * 60 + p.minuto;
  if (minutos < minutosDe(horaCorte)) return sumarDias(p.fecha, -1);
  return p.fecha;
}
function retrasoAcostarse(noche, horaPrevista, instanteReal, zona = ZONA_POR_DEFECTO) {
  const previsto = instanteDe(noche, horaPrevista, zona);
  return Math.round((instanteReal - previsto) / 6e4);
}
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const MESES_CORTOS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const DIAS = ["domingo", "lunes", "martes", "mi\xE9rcoles", "jueves", "viernes", "s\xE1bado"];
const DIAS_CORTOS = ["dom", "lun", "mar", "mi\xE9", "jue", "vie", "s\xE1b"];
function nombreMes(mes, corto = false) {
  return (corto ? MESES_CORTOS : MESES)[mes - 1] ?? "";
}
function nombreDiaSemana(ds, corto = false) {
  return (corto ? DIAS_CORTOS : DIAS)[ds] ?? "";
}
function fechaLegible(fecha, corto = true) {
  const [, m, d] = fecha.split("-").map(Number);
  const ds = diaSemanaDe(fecha);
  return `${nombreDiaSemana(ds, corto)} ${d} ${nombreMes(m, corto)}`;
}
function duracionLegible(minutos) {
  const m = Math.max(0, Math.round(minutos));
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h === 0) return `${r} min`;
  return `${h} h ${String(r).padStart(2, "0")} min`;
}
module.exports = {
  ZONA_POR_DEFECTO,
  compararFechas,
  desfaseMinutos,
  diaDelCiclo,
  diaSemanaDe,
  diferenciaDias,
  domingoDe,
  duracionLegible,
  esFechaValida,
  esHoraValida,
  faseDelDia,
  fechaDe,
  fechaDelDiaDelCiclo,
  fechaLegible,
  formatoHora,
  inicioDelDia,
  instanteDe,
  lunesDe,
  minutosDe,
  nocheDeSuenio,
  nombreDiaSemana,
  nombreMes,
  partesLocales,
  proximaMedianoche,
  retrasoAcostarse,
  sumarDias
}

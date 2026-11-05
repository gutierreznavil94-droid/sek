/**
 * Pájaro torpe del tema Shinobi: silueta de tinta clara (cuerpo, cabeza con pico y ojo, cola, alas que aletean),
 * con borde de papel para que se lea sobre el fondo oscuro. Mira a la derecha. Autocontenido (solo canvas).
 * - cuadro: 0 ala arriba, 1 al medio, 2 abajo.
 * - mareado: después del choque, el ojo es una «x».
 */
const TINTA = '#121110'
const PAPEL = 'rgba(241, 235, 223, 0.95)'

export function dibujarPajaroTorpe(c: CanvasRenderingContext2D, e: number, cuadro: number, mareado = false): void {
  c.save()
  c.lineJoin = 'round'
  c.lineCap = 'round'
  const trazo = () => { c.strokeStyle = PAPEL; c.lineWidth = Math.max(1.6, e * 0.05); c.stroke(); c.fillStyle = TINTA; c.fill() }
  // Ala de atrás (más chica, un poco más clara)
  const alzada = [-0.75, -0.2, 0.45][cuadro]
  c.save()
  c.globalAlpha *= 0.85
  c.beginPath()
  c.moveTo(-e * 0.05, -e * 0.05)
  c.quadraticCurveTo(-e * 0.25, e * alzada * 0.6 - e * 0.1, -e * 0.42, e * alzada * 0.7)
  c.quadraticCurveTo(-e * 0.2, e * alzada * 0.25, e * 0.1, e * 0.02)
  c.closePath()
  trazo()
  c.restore()
  // Cola en abanico
  c.beginPath()
  c.moveTo(-e * 0.3, 0)
  c.lineTo(-e * 0.62, -e * 0.14)
  c.lineTo(-e * 0.56, e * 0.02)
  c.lineTo(-e * 0.64, e * 0.14)
  c.closePath()
  trazo()
  // Cuerpo
  c.beginPath()
  c.ellipse(0, 0, e * 0.36, e * 0.19, -0.08, 0, Math.PI * 2)
  trazo()
  // Cabeza
  const hx = e * 0.34, hy = -e * 0.1
  c.beginPath()
  c.arc(hx, hy, e * 0.14, 0, Math.PI * 2)
  trazo()
  // Pico
  c.beginPath()
  c.moveTo(hx + e * 0.12, hy - e * 0.04)
  c.lineTo(hx + e * 0.3, hy + e * 0.01)
  c.lineTo(hx + e * 0.12, hy + e * 0.05)
  c.closePath()
  c.fillStyle = PAPEL; c.fill()
  // Ojo
  c.strokeStyle = PAPEL
  c.fillStyle = PAPEL
  if (mareado) {
    const r = e * 0.045
    c.lineWidth = Math.max(1.2, e * 0.03)
    c.beginPath()
    c.moveTo(hx + e * 0.03 - r, hy - e * 0.03 - r); c.lineTo(hx + e * 0.03 + r, hy - e * 0.03 + r)
    c.moveTo(hx + e * 0.03 + r, hy - e * 0.03 - r); c.lineTo(hx + e * 0.03 - r, hy - e * 0.03 + r)
    c.stroke()
  } else {
    c.beginPath(); c.arc(hx + e * 0.04, hy - e * 0.03, e * 0.035, 0, Math.PI * 2); c.fill()
  }
  // Ala de adelante (la grande, pincelada)
  c.beginPath()
  c.moveTo(-e * 0.12, -e * 0.04)
  c.quadraticCurveTo(-e * 0.05, e * alzada - e * 0.12, e * 0.2, e * alzada * 1.05)
  c.quadraticCurveTo(e * 0.08, e * alzada * 0.4, e * 0.14, e * 0.04)
  c.closePath()
  trazo()
  c.restore()
}

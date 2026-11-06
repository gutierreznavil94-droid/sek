/** «xp-perdida» en Común: un −N rojo que sube un poco y se va. */
export function XpMenosComun({ texto, x, y }: { texto: string; x: number; y: number }) {
  return <div className="xpc-menos" style={{ left: x, top: y }} role="status">{texto}</div>
}

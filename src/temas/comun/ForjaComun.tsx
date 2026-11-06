/** Forja de hábitos, tema Común: un círculo que se llena día a día y deja ver el kanji al completarse. */
export function ForjaComun({ kanji, validos, necesarios, tam = 96 }: { kanji: string; validos: number; necesarios: number; tam?: number }) {
  const f = Math.max(0, Math.min(1, validos / Math.max(1, necesarios)))
  const r = 42
  const l = 2 * Math.PI * r
  return (
    <svg className={`forja-comun ${f >= 1 ? 'forjada' : ''}`} viewBox="0 0 100 100" width={tam} height={tam} role="img" aria-label={f >= 1 ? `Forjado: ${kanji}` : `${validos} de ${necesarios} días`}>
      <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(var(--papel-rgb), 0.15)" strokeWidth="7" />
      <circle cx="50" cy="50" r={r} fill="none" stroke="var(--acento)" strokeWidth="7" strokeLinecap="round" strokeDasharray={l} strokeDashoffset={l * (1 - f)} transform="rotate(-90 50 50)" style={{ transition: 'stroke-dashoffset 0.5s ease' }} />
      <text x="50" y="52" textAnchor="middle" dominantBaseline="central" fontSize="40" fill={f >= 1 ? 'var(--acento)' : 'rgba(var(--papel-rgb), 0.25)'} style={{ fontFamily: "'Pincel', 'Noto Serif JP', serif" }}>{kanji}</text>
    </svg>
  )
}

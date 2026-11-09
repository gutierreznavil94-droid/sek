/**
 * Temas subidos: ningún kanji de Shinobi a la vista. Cada kanji se cambia por el emoji que eligió el tema
 * (`simbolos`) o, si no eligió, por uno de esta lista. Lo hace sobre lo que ya está en pantalla (textos y
 * dibujos SVG) y sobre lo que va apareciendo, así no hace falta tocar cada pantalla. Shinobi no se toca.
 */
export const EMOJI_POR_KANJI: Record<string, string> = {
  鍛: '💪', 印: '🎀', 誓: '💗', 眠: '🌙', 進: '🚀', 力: '💪', 食: '🍓', 斬: '🪄', 忍: '🎨', 弾: '💗', 遊: '🎮',
  水: '💧', 墓: '🥀', 静: '🌙', 掟: '📖', 描: '🎨', 始: '🌷', 昇: '⭐', 連: '💞', 段: '🎁', 甦: '🌱', 体: '🤸',
  心: '💭', 写: '💾', 志: '🌟', 願: '💌', 今: '📍', 朝: '☀️', 逃: '🏃', 盗: '🦝', 次: '➡️', 目: '🎯', 柱: '🌸',
  祝: '🎉', 果: '🍎', 整: '🛁', 昼: '🌤️', 夜: '🌙', 常: '✨', 済: '✅', 道: '🌈', 学: '📚', 書: '✍️', 陣: '🗂️',
  勝: '🏆', 家: '🏡', 選: '☑️', 鈴: '🔔', 的: '💫', 暦: '📅', 減: '💔', 時: '⏰', 走: '🏃', 歩: '🚶', 音: '🎵',
  健: '💚', 早: '🌅', 律: '📏', 耐: '🛡️', 動: '🎬', 彩: '🎨', 設: '⚙️', 歴: '🕰️', 同: '🔄', 新: '✨', 炎: '🔥',
  箱: '📥', 散: '🍃', 人: '👤', 重: '⭐', 速: '⚡', 所: '🏠', 日: '🗓️', 読: '📖',
  一: '1', 二: '2', 三: '3', 四: '4', 五: '5', 六: '6', 七: '7', 八: '8', 九: '9', 十: '10',
}

const KANJI = /[一-鿿]/
const KANJIS = /[一-鿿]/g
const NO_TOCAR = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT', 'CODE'])

let observador: MutationObserver | null = null
let mapa: Record<string, string> = {}

function cambiar(n: Node): void {
  if (n.nodeType === Node.TEXT_NODE) {
    const t = n.nodeValue
    if (!t || !KANJI.test(t)) return
    const p = n.parentElement
    if (!p || NO_TOCAR.has(p.tagName) || p.isContentEditable) return
    n.nodeValue = t.replace(KANJIS, (k) => mapa[k] ?? EMOJI_POR_KANJI[k] ?? '✿')
    return
  }
  if (n.nodeType !== Node.ELEMENT_NODE || NO_TOCAR.has((n as Element).tagName)) return
  const w = document.createTreeWalker(n, NodeFilter.SHOW_TEXT)
  const textos: Node[] = []
  while (w.nextNode()) textos.push(w.currentNode)
  for (const x of textos) cambiar(x)
}

/** Prende (con el mapa del tema) o apaga el cambio de kanjis. */
export function sinKanjis(prender: boolean, simbolos: Record<string, string> = {}): void {
  observador?.disconnect()
  observador = null
  if (!prender || typeof document === 'undefined' || typeof MutationObserver === 'undefined') return
  mapa = simbolos
  cambiar(document.body)
  observador = new MutationObserver((cambios) => {
    for (const c of cambios) {
      if (c.type === 'characterData') cambiar(c.target)
      else c.addedNodes.forEach(cambiar)
    }
  })
  observador.observe(document.body, { childList: true, subtree: true, characterData: true })
}

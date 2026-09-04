/** Utilitários puros de geometria SVG para os gráficos de linha do produto. */

export type PontoSvg = { x: number; y: number }

/**
 * Curva suave (Catmull-Rom convertida para Bézier cúbica) passando por todos
 * os pontos, sem overshoot perceptível. Com 2 pontos degenera numa reta —
 * comportamento correto, não um caso especial a tratar.
 */
export function caminhoSuave(pontos: PontoSvg[]): string {
  if (pontos.length === 0) return ''
  if (pontos.length === 1) return `M ${pontos[0].x},${pontos[0].y}`

  let d = `M ${pontos[0].x},${pontos[0].y}`
  for (let i = 0; i < pontos.length - 1; i++) {
    const p0 = pontos[i - 1] ?? pontos[i]
    const p1 = pontos[i]
    const p2 = pontos[i + 1]
    const p3 = pontos[i + 2] ?? p2
    const cp1x = p1.x + (p2.x - p0.x) / 6
    const cp1y = p1.y + (p2.y - p0.y) / 6
    const cp2x = p2.x - (p3.x - p1.x) / 6
    const cp2y = p2.y - (p3.y - p1.y) / 6
    d += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`
  }
  return d
}

/** Mesma curva, fechada até `baseY` para virar uma área preenchível. */
export function caminhoArea(pontos: PontoSvg[], baseY: number): string {
  if (pontos.length === 0) return ''
  const linha = caminhoSuave(pontos)
  const primeiro = pontos[0]
  const ultimo = pontos[pontos.length - 1]
  return `${linha} L ${ultimo.x},${baseY} L ${primeiro.x},${baseY} Z`
}

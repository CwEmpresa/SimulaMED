/**
 * Conjunto de ícones do produto (traçados no estilo Lucide, 24x24).
 *
 * São inline em vez de virem de uma biblioteca por três motivos: mantêm o
 * bundle sem mais uma dependência, herdam `currentColor` (então respondem aos
 * tokens de tema automaticamente) e ficam com traço uniforme — misturar
 * espessuras é o que faz um app parecer montado com peças de origens
 * diferentes. Emoji nunca é usado como ícone.
 */

type PropsIcone = {
  className?: string
  /** Ícones decorativos ficam ocultos ao leitor de tela; dar um rótulo os torna visíveis. */
  rotulo?: string
}

function Base({
  className = 'size-5',
  rotulo,
  children,
}: PropsIcone & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      role={rotulo ? 'img' : undefined}
      aria-label={rotulo}
      aria-hidden={rotulo ? undefined : true}
    >
      {children}
    </svg>
  )
}

/** Prancheta com marca — os simulados. */
export function IconeSimulado(p: PropsIcone) {
  return (
    <Base {...p}>
      <path d="M9 4h6a1 1 0 0 1 1 1v1H8V5a1 1 0 0 1 1-1Z" />
      <path d="M8 6H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-2" />
      <path d="m9 14 2 2 4-4" />
    </Base>
  )
}

/** Camadas — o banco de questões. */
export function IconeBanco(p: PropsIcone) {
  return (
    <Base {...p}>
      <path d="m12 3 9 5-9 5-9-5 9-5Z" />
      <path d="m3 13 9 5 9-5" />
      <path d="m3 17 9 5 9-5" />
    </Base>
  )
}

/** Caderno com marcador — os erros salvos. */
export function IconeCaderno(p: PropsIcone) {
  return (
    <Base {...p}>
      <path d="M5 4a2 2 0 0 1 2-2h11a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H7a2 2 0 0 1-2-2V4Z" />
      <path d="M5 17.5A2 2 0 0 1 7 16h12" />
      <path d="M13 2v7l-2.5-1.7L8 9V2" />
    </Base>
  )
}

/** Pulso — o diagnóstico. */
export function IconeDiagnostico(p: PropsIcone) {
  return (
    <Base {...p}>
      <path d="M3 12h3.5l2-6 3.5 12 2.5-7 1.5 3H21" />
    </Base>
  )
}

/** Cronômetro — o modo prova. */
export function IconeCronometro(p: PropsIcone) {
  return (
    <Base {...p}>
      <circle cx="12" cy="13" r="8" />
      <path d="M12 9v4l2.5 2" />
      <path d="M9 2h6" />
    </Base>
  )
}

export function IconeUsuario(p: PropsIcone) {
  return (
    <Base {...p}>
      <circle cx="12" cy="8" r="4" />
      <path d="M5 21a7 7 0 0 1 14 0" />
    </Base>
  )
}

export function IconeEstrela({ preenchida = false, ...p }: PropsIcone & { preenchida?: boolean }) {
  return (
    <Base {...p}>
      <path
        d="m12 3.5 2.6 5.3 5.9.9-4.25 4.15 1 5.85L12 16.9l-5.25 2.8 1-5.85L3.5 9.7l5.9-.9L12 3.5Z"
        fill={preenchida ? 'currentColor' : 'none'}
      />
    </Base>
  )
}

export function IconeCerto(p: PropsIcone) {
  return (
    <Base {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="m8.5 12.5 2.5 2.5 4.5-5" />
    </Base>
  )
}

export function IconeErrado(p: PropsIcone) {
  return (
    <Base {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="m9 9 6 6M15 9l-6 6" />
    </Base>
  )
}

export function IconeSeta({ direcao = 'direita', ...p }: PropsIcone & { direcao?: 'esquerda' | 'direita' }) {
  return (
    <Base {...p}>
      {direcao === 'direita' ? (
        <>
          <path d="M5 12h14" />
          <path d="m13 6 6 6-6 6" />
        </>
      ) : (
        <>
          <path d="M19 12H5" />
          <path d="m11 18-6-6 6-6" />
        </>
      )}
    </Base>
  )
}

export function IconeSair(p: PropsIcone) {
  return (
    <Base {...p}>
      <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" />
      <path d="M10 8 6 12l4 4" />
      <path d="M6 12h9" />
    </Base>
  )
}

export function IconeFiltro(p: PropsIcone) {
  return (
    <Base {...p}>
      <path d="M4 5h16l-6.2 7.3V19l-3.6-2v-4.7L4 5Z" />
    </Base>
  )
}

/** Ampulheta — conteúdo em produção. */
export function IconeEmProducao(p: PropsIcone) {
  return (
    <Base {...p}>
      <path d="M7 3h10M7 21h10" />
      <path d="M7 3c0 4 3.5 5.2 3.5 9S7 17 7 21" />
      <path d="M17 3c0 4-3.5 5.2-3.5 9S17 17 17 21" />
    </Base>
  )
}

export function IconeBusca(p: PropsIcone) {
  return (
    <Base {...p}>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m20 20-4.35-4.35" />
    </Base>
  )
}

export function IconeSino(p: PropsIcone) {
  return (
    <Base {...p}>
      <path d="M6 9a6 6 0 0 1 12 0c0 4.5 1.5 6 2 6.5H4c.5-.5 2-2 2-6.5Z" />
      <path d="M9.5 18a2.5 2.5 0 0 0 5 0" />
    </Base>
  )
}

/** Seta de tendência — selo de comparação com a média (acima/abaixo). */
export function IconeTendencia({
  direcao,
  ...p
}: PropsIcone & { direcao: 'alta' | 'baixa' }) {
  return (
    <Base {...p}>
      {direcao === 'alta' ? (
        <>
          <path d="m4 16 6-6 4 4 6-9" />
          <path d="M15 5h5v5" />
        </>
      ) : (
        <>
          <path d="m4 8 6 6 4-4 6 9" />
          <path d="M15 19h5v-5" />
        </>
      )}
    </Base>
  )
}

/** Prancheta com lista marcada — o gabarito completo do simulado. */
export function IconeGabarito(p: PropsIcone) {
  return (
    <Base {...p}>
      <path d="M8 4h8a1 1 0 0 1 1 1v15a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z" />
      <path d="M9 3.5h6a1 1 0 0 1 1 1V6H8V4.5a1 1 0 0 1 1-1Z" />
      <path d="m9.5 11 1.5 1.5 2-3" />
      <path d="M13.5 14.5h3" />
      <path d="m9.5 17 1.5 1.5 2-3" />
    </Base>
  )
}

/** Setas para fora — expandir/ampliar imagem. */
export function IconeExpandir(p: PropsIcone) {
  return (
    <Base {...p}>
      <path d="M9 4H4v5" />
      <path d="m4 4 6 6" />
      <path d="M15 20h5v-5" />
      <path d="m20 20-6-6" />
    </Base>
  )
}

export function IconeAlerta(p: PropsIcone) {
  return (
    <Base {...p}>
      <path d="M12 4.5 21 19H3l9-14.5Z" />
      <path d="M12 10v4M12 16.5v.5" />
    </Base>
  )
}

/** Raio — o Modo Combo. */
export function IconeRaio(p: PropsIcone) {
  return (
    <Base {...p}>
      <path d="M13 3 5 13.5h5.5L11 21l8-10.5h-5.5L13 3Z" />
    </Base>
  )
}

/** Traçado em zigue-zague — alterna gráfico de linha nos cartões de métrica. */
export function IconeGraficoLinha(p: PropsIcone) {
  return (
    <Base {...p}>
      <path d="M4 15.5 8.5 10l3 3 3.5-6 5 5.5" />
    </Base>
  )
}

/** Barras verticais — alterna gráfico de barras nos cartões de métrica. */
export function IconeGraficoBarra(p: PropsIcone) {
  return (
    <Base {...p}>
      <path d="M5 19V13" />
      <path d="M12 19V6" />
      <path d="M19 19v-8" />
    </Base>
  )
}

/** Chevron simples para baixo — indicador de seletor/expansível. */
export function IconeChevronBaixo(p: PropsIcone) {
  return (
    <Base {...p}>
      <path d="m6 9 6 6 6-6" />
    </Base>
  )
}

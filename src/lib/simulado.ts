export const DURACAO_PROVA_SEGUNDOS = 5 * 60 * 60 // 5 horas, como na prova real
export const TOTAL_QUESTOES = 100

/** Faixas de urgência do cronômetro. */
export const ALERTA_SEGUNDOS = 30 * 60
export const CRITICO_SEGUNDOS = 5 * 60

export const SIMULADOS = [1, 2, 3] as const
export type NumeroSimulado = (typeof SIMULADOS)[number]

export const ALTERNATIVAS = ['A', 'B', 'C', 'D'] as const
export type Alternativa = (typeof ALTERNATIVAS)[number]

/**
 * `questoes.tabela_dados`: colunas livres por design — ora 3 (Exame/
 * Resultado/Referência), ora 4 (Parâmetro/Pré-BD/Pós-BD/Previsto). `colunas`
 * e `linhas` são arrays (não um objeto {coluna: valor} por linha) de
 * propósito: o Postgres normaliza jsonb reordenando as chaves de um objeto
 * (por tamanho, depois lexicograficamente) — só arrays preservam a ordem de
 * inserção, e a ordem das colunas importa aqui.
 */
export type TabelaDados = {
  colunas: string[]
  linhas: string[][]
}

/** Uma imagem de `questoes.imagens` — sempre fonte real e licenciada, nunca gerada por IA. */
export type ImagemApoio = {
  url: string
  legenda?: string
}

/**
 * Segundos restantes a partir do início registrado no banco.
 * O relógio do cliente nunca é a fonte da verdade — ele só interpola entre
 * renders; quem decide se a prova acabou é sempre o servidor.
 */
export function segundosRestantes(iniciadoEm: string, agora: number = Date.now()): number {
  const fim = new Date(iniciadoEm).getTime() + DURACAO_PROVA_SEGUNDOS * 1000
  return Math.max(0, Math.floor((fim - agora) / 1000))
}

export function formatarTempo(segundos: number): string {
  const h = Math.floor(segundos / 3600)
  const m = Math.floor((segundos % 3600) / 60)
  const s = segundos % 60
  return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':')
}

/** Tempo por extenso, para leitores de tela — "02:14:09" não é lido de forma útil. */
export function tempoParaLeitorDeTela(segundos: number): string {
  const h = Math.floor(segundos / 3600)
  const m = Math.floor((segundos % 3600) / 60)
  if (h > 0) return `${h} ${h === 1 ? 'hora' : 'horas'} e ${m} ${m === 1 ? 'minuto' : 'minutos'} restantes`
  if (m > 0) return `${m} ${m === 1 ? 'minuto' : 'minutos'} restantes`
  return `menos de um minuto restante`
}

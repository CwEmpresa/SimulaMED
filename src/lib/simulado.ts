export const DURACAO_PROVA_SEGUNDOS = 5 * 60 * 60 // 5 horas, como na prova real
export const TOTAL_QUESTOES = 100

/** Faixas de urgência do cronômetro. */
export const ALERTA_SEGUNDOS = 30 * 60
export const CRITICO_SEGUNDOS = 5 * 60

export const SIMULADOS = [1, 2, 3] as const
export type NumeroSimulado = (typeof SIMULADOS)[number]

/**
 * Horas após o primeiro login em que cada simulado se libera — pacing para o
 * aluno não fazer os três de uma vez. Simulado 1 é sempre livre (0h).
 */
export const HORAS_LIBERACAO: Record<NumeroSimulado, number> = {
  1: 0,
  2: 12,
  3: 24,
}

/**
 * Instante em que um simulado se libera, a partir do primeiro login real do
 * aluno (`usuarios.primeiro_login_em`, marcado só pelo servidor em
 * `entrarComEmail`). `null` quando ainda não há primeiro login registrado —
 * não deveria acontecer para quem já está autenticado, mas nesse caso o
 * simulado fica liberado (falha aberta: não é uma defesa de segurança, é só
 * ritmo de estudo, e travar o aluno para sempre por falta de dado seria pior).
 */
export function instanteDeLiberacao(
  numero: number,
  primeiroLoginEm: string | null,
): Date | null {
  if (!primeiroLoginEm) return null
  const horas = HORAS_LIBERACAO[numero as NumeroSimulado] ?? 0
  if (horas <= 0) return null
  return new Date(new Date(primeiroLoginEm).getTime() + horas * 3600 * 1000)
}

export function simuladoLiberado(
  numero: number,
  primeiroLoginEm: string | null,
  agora: number = Date.now(),
): boolean {
  const alvo = instanteDeLiberacao(numero, primeiroLoginEm)
  return alvo === null || agora >= alvo.getTime()
}

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

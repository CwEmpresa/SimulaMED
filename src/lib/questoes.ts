/**
 * Colunas de `questoes` liberadas para `authenticated` fora do Modo Prova.
 *
 * NUNCA usar `select('*')` aqui: o papel `authenticated` não tem privilégio
 * sobre `resposta_correta`, `comentario_correta` e `comentario_erros`, e
 * `select('*')` pede todas as colunas — isso falha em SILÊNCIO (count nulo,
 * sem erro) em vez de recusar a query. Já produziu um dashboard afirmando
 * "nenhuma questão importada" com 100 questões no banco. Ver AGENTS.md.
 *
 * Compartilhada entre `/banco` e `/combo`, que leem o mesmo acervo
 * (`tipo = 'banco'`) com o mesmo formato de card de questão.
 */
export const COLUNAS_SEGURAS_BANCO =
  'id, area, subtema, dificuldade, ano_origem, fonte, enunciado, alternativa_a, alternativa_b, alternativa_c, alternativa_d, tabela_dados, grafico_svg, imagens'

/**
 * Gate por status: os importadores gravam toda questão como `'Em revisão'`
 * por padrão (leem a coluna de status direto da planilha de produção — ver
 * scripts/import-questoes.ts e scripts/import-banco.ts). Sem este filtro,
 * qualquer questão em rascunho ficaria visível para os alunos assim que a
 * linha existisse na tabela. `'Aprovada'` é a marca de que já passou pela
 * validação do importador (rebalanceamento de gabarito, checagem de
 * equilíbrio) — toda query que serve questão a aluno precisa filtrar por ela.
 *
 * Reimportar reseta o status para o que estiver na planilha: rode
 * `npm run questoes:aprovar` depois de qualquer reimportação.
 */
export const STATUS_APROVADA = 'Aprovada'

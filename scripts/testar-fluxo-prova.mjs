/**
 * Teste ponta a ponta do fluxo de prova, rodando como um ALUNO REAL (chave anon
 * + sessão), de modo que o RLS valha em cada passo — e não como service_role,
 * que ignoraria exatamente aquilo que queremos testar.
 *
 * Cobre o caminho feliz (tentativa → respostas → correção → caderno de erros) e
 * as defesas: gabarito inacessível durante a prova, liberado só depois, escrita
 * bloqueada após finalizar e após o prazo de 5 horas, e isolamento entre alunos.
 *
 *   node --env-file=.env.local scripts/testar-fluxo-prova.mjs
 *
 * Os usuários de teste são apagados no fim, com ou sem falha.
 */

import { createClient } from '@supabase/supabase-js'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY

const admin = createClient(URL, SERVICE, { auth: { persistSession: false } })

const falhas = []
function checar(condicao, descricao, detalhe = '') {
  if (condicao) console.log(`  ok    ${descricao}`)
  else {
    console.log(`  FALHA ${descricao} ${detalhe}`)
    falhas.push(descricao)
  }
}

async function criarAluno(sufixo) {
  const email = `teste-${sufixo}-${Date.now()}@exemplo-reta-final.test`
  const senha = `Teste!${Math.random().toString(36).slice(2)}Aa1`
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: senha,
    email_confirm: true,
  })
  if (error) throw error
  const cliente = createClient(URL, ANON, { auth: { persistSession: false } })
  const { error: erroLogin } = await cliente.auth.signInWithPassword({ email, password: senha })
  if (erroLogin) throw erroLogin
  return { id: data.user.id, email, cliente }
}

const criados = []

try {
  // ── 1. usuário e trigger ──────────────────────────────────────────────────
  const aluno = await criarAluno('a')
  criados.push(aluno.id)
  console.log('\n1. Usuário e sessão')

  const { data: espelho } = await admin
    .from('usuarios')
    .select('id, email')
    .eq('id', aluno.id)
    .maybeSingle()
  checar(!!espelho && espelho.email === aluno.email, 'trigger espelhou auth.users em public.usuarios')

  // ── 2. leitura de questões sem gabarito ───────────────────────────────────
  console.log('\n2. Leitura das questões durante a prova')

  const { data: questoesAluno } = await aluno.cliente
    .from('questoes')
    .select('id, numero_na_prova, area, enunciado, alternativa_a')
    .eq('simulado_numero', 1)
    .order('numero_na_prova')
  checar(questoesAluno?.length === 100, 'aluno lê as 100 questões (colunas permitidas)')

  const { error: erroGabarito } = await aluno.cliente
    .from('questoes')
    .select('id, resposta_correta')
    .eq('simulado_numero', 1)
    .limit(1)
  checar(!!erroGabarito, 'coluna resposta_correta é inacessível na tabela questoes',
    erroGabarito ? '' : '(LEITURA PERMITIDA!)')

  const { error: erroComentario } = await aluno.cliente
    .from('questoes')
    .select('id, comentario_correta')
    .limit(1)
  checar(!!erroComentario, 'comentários também ficam inacessíveis durante a prova')

  const { data: liberadosAntes } = await aluno.cliente
    .from('gabaritos_liberados')
    .select('questao_id')
  checar((liberadosAntes ?? []).length === 0, 'nenhum gabarito liberado antes de finalizar')

  // Armadilha do privilégio por coluna: contar com select('*') em `questoes`
  // devolve count nulo e NÃO levanta erro — a tela mostra "nenhuma questão"
  // com o banco cheio. Contagens têm de usar uma coluna permitida.
  //
  // Filtra por simulado_numero=1 (não só tipo='simulado'): os 3 simulados já
  // estão importados (300 questões no total), mas este teste só exercita o
  // Simulado 1.
  const { count: contagemPorId } = await aluno.cliente
    .from('questoes')
    .select('id', { count: 'exact', head: true })
    .eq('tipo', 'simulado')
    .eq('simulado_numero', 1)
  checar(contagemPorId === 100, 'contagem por coluna permitida funciona', `(veio ${contagemPorId})`)

  const { count: contagemPorEstrela } = await aluno.cliente
    .from('questoes')
    .select('*', { count: 'exact', head: true })
    .eq('tipo', 'simulado')
    .eq('simulado_numero', 1)
  checar(
    contagemPorEstrela === null,
    "select('*') em questoes segue indisponível ao aluno (se isso mudar, o revoke de coluna caiu)",
    `(veio ${contagemPorEstrela})`,
  )

  // ── 3. tentativa ──────────────────────────────────────────────────────────
  const { data: tentativa, error: erroTentativa } = await aluno.cliente
    .from('tentativas_simulado')
    .insert({ usuario_id: aluno.id, simulado_numero: 1 })
    .select('id, iniciado_em, status')
    .single()
  if (erroTentativa) throw erroTentativa
  console.log('\n3. Tentativa iniciada')
  checar(tentativa.status === 'em_andamento', 'tentativa começa em andamento')

  const { error: erroDuplicada } = await aluno.cliente
    .from('tentativas_simulado')
    .insert({ usuario_id: aluno.id, simulado_numero: 1 })
  checar(!!erroDuplicada, 'índice impede duas tentativas em andamento do mesmo simulado')

  // ── 4. respostas ──────────────────────────────────────────────────────────
  const { data: gabarito } = await admin
    .from('questoes')
    .select('id, numero_na_prova, area, resposta_correta')
    .eq('simulado_numero', 1)
    .order('numero_na_prova')

  const CERTAS = 60
  const ERRADAS = 30
  const letras = ['A', 'B', 'C', 'D']
  const respostas = []
  const acertosPorArea = {}
  const totalPorArea = {}

  gabarito.forEach((q, i) => {
    totalPorArea[q.area] = (totalPorArea[q.area] ?? 0) + 1
    if (i < CERTAS) {
      respostas.push({ tentativa_id: tentativa.id, questao_id: q.id, alternativa_escolhida: q.resposta_correta })
      acertosPorArea[q.area] = (acertosPorArea[q.area] ?? 0) + 1
    } else if (i < CERTAS + ERRADAS) {
      respostas.push({
        tentativa_id: tentativa.id,
        questao_id: q.id,
        alternativa_escolhida: letras.find((l) => l !== q.resposta_correta),
      })
    }
  })

  const { error: erroRespostas } = await aluno.cliente
    .from('respostas_simulado')
    .upsert(respostas, { onConflict: 'tentativa_id,questao_id' })
  if (erroRespostas) throw erroRespostas
  console.log(`\n4. ${respostas.length} respostas gravadas (${CERTAS} certas, ${ERRADAS} erradas, 10 em branco)`)

  // ── 5. correção ───────────────────────────────────────────────────────────
  const { data: resultado, error: erroFinalizar } = await aluno.cliente.rpc('finalizar_tentativa', {
    p_tentativa_id: tentativa.id,
  })
  if (erroFinalizar) throw erroFinalizar
  const r = Array.isArray(resultado) ? resultado[0] : resultado
  console.log('\n5. Prova finalizada e corrigida')
  checar(Number(r.nota) === CERTAS, `nota = ${CERTAS}`, `(veio ${r.nota})`)
  checar(r.tempo_usado_segundos >= 0 && r.tempo_usado_segundos < 120, 'tempo usado plausível')

  const { data: finalizada } = await aluno.cliente
    .from('tentativas_simulado')
    .select('status, finalizado_em, percentual_por_area')
    .eq('id', tentativa.id)
    .single()
  checar(finalizada.status === 'finalizado' && !!finalizada.finalizado_em, 'status e finalizado_em gravados')

  const areas = finalizada.percentual_por_area ?? {}
  checar(Object.keys(areas).length === 5, 'as 5 áreas aparecem no desempenho')
  const areasOk = Object.entries(areas).every(
    ([area, d]) => d.acertos === (acertosPorArea[area] ?? 0) && d.total === totalPorArea[area],
  )
  checar(areasOk, 'acertos e totais por área conferem com o gabarito')
  checar(
    Object.values(areas).reduce((s, d) => s + d.total, 0) === 100,
    'soma dos totais por área = 100 (em branco contam como erro)',
  )

  // Caderno de Erros: só o que foi respondido e saiu errado. As 10 em branco
  // (100 - CERTAS - ERRADAS) NÃO entram — é exatamente o bug relatado.
  const { count: totalCaderno } = await aluno.cliente
    .from('caderno_erros')
    .select('*', { count: 'exact', head: true })
  checar(totalCaderno === ERRADAS, `caderno recebe só as ${ERRADAS} erradas, não as em branco`, `(veio ${totalCaderno})`)

  const idsErradas = respostas
    .filter((r) => r.alternativa_escolhida !== gabarito.find((q) => q.id === r.questao_id).resposta_correta)
    .map((r) => r.questao_id)
  const { data: itensCaderno } = await aluno.cliente.from('caderno_erros').select('questao_id')
  const idsNoCaderno = new Set((itensCaderno ?? []).map((i) => i.questao_id))
  checar(
    idsErradas.every((id) => idsNoCaderno.has(id)) && idsNoCaderno.size === idsErradas.length,
    'o caderno contém exatamente as questões erradas respondidas, nem uma a mais',
  )

  const idsEmBranco = gabarito.map((q) => q.id).filter((id) => !respostas.some((r) => r.questao_id === id))
  checar(
    idsEmBranco.every((id) => !idsNoCaderno.has(id)),
    'nenhuma questão em branco entrou no caderno',
  )

  // A resposta marcada precisa estar disponível via a view de detalhe, para a
  // tela de Cadernos poder mostrar "sua resposta" em cada erro.
  const { data: detalhes } = await aluno.cliente
    .from('respostas_simulado_detalhadas')
    .select('questao_id, alternativa_escolhida, correta')
    .in('questao_id', idsErradas)
  checar(
    (detalhes ?? []).length === idsErradas.length &&
      detalhes.every((d) => d.correta === false && !!d.alternativa_escolhida),
    'respostas_simulado_detalhadas devolve a resposta marcada de cada erro',
  )

  // ── 6. gabarito liberado só depois ────────────────────────────────────────
  console.log('\n6. Liberação do gabarito após finalizar')
  const { data: liberadosDepois } = await aluno.cliente
    .from('gabaritos_liberados')
    .select('questao_id, resposta_correta, comentario_correta')
  checar(liberadosDepois?.length === 100, 'as 100 questões do simulado concluído ficam liberadas')
  checar(
    (liberadosDepois ?? []).every((g) => !!g.resposta_correta && !!g.comentario_correta),
    'gabarito e comentários vêm preenchidos na liberação',
  )
  const conferem = (liberadosDepois ?? []).every((g) => {
    const original = gabarito.find((q) => q.id === g.questao_id)
    return original && original.resposta_correta === g.resposta_correta
  })
  checar(conferem, 'gabarito liberado bate com o gabarito real')

  // ── 7. idempotência ───────────────────────────────────────────────────────
  console.log('\n7. Envio duplicado')
  const { data: reenvio } = await aluno.cliente.rpc('finalizar_tentativa', { p_tentativa_id: tentativa.id })
  const r2 = Array.isArray(reenvio) ? reenvio[0] : reenvio
  checar(Number(r2.nota) === CERTAS, 'reenvio devolve a mesma nota sem recorrigir')
  const { count: cadernoDepois } = await aluno.cliente
    .from('caderno_erros')
    .select('*', { count: 'exact', head: true })
  checar(cadernoDepois === totalCaderno, 'reenvio não duplica o caderno de erros')

  // ── 8. escrita após finalizar ─────────────────────────────────────────────
  console.log('\n8. Escrita após a prova encerrada')
  const { error: erroPosFinal, count: alteradas } = await aluno.cliente
    .from('respostas_simulado')
    .update({ alternativa_escolhida: 'A' }, { count: 'exact' })
    .eq('tentativa_id', tentativa.id)
  checar(
    !!erroPosFinal || alteradas === 0,
    'aluno não consegue alterar respostas depois de finalizada',
    `(erro=${!!erroPosFinal}, linhas=${alteradas})`,
  )

  // ── 9. escrita após o prazo de 5 horas ────────────────────────────────────
  console.log('\n9. Escrita após o prazo de 5 horas')
  const { data: tentativa2 } = await aluno.cliente
    .from('tentativas_simulado')
    .insert({ usuario_id: aluno.id, simulado_numero: 2 })
    .select('id')
    .single()

  // Empurra o início para 6 horas atrás: a prova continua "em andamento",
  // mas o prazo já venceu.
  await admin
    .from('tentativas_simulado')
    .update({ iniciado_em: new Date(Date.now() - 6 * 3600 * 1000).toISOString() })
    .eq('id', tentativa2.id)

  const { error: erroPrazo, count: gravadas } = await aluno.cliente
    .from('respostas_simulado')
    .insert(
      { tentativa_id: tentativa2.id, questao_id: gabarito[0].id, alternativa_escolhida: 'A' },
      { count: 'exact' },
    )
  checar(!!erroPrazo, 'resposta é rejeitada depois de vencido o prazo', `(erro=${!!erroPrazo}, linhas=${gravadas})`)

  // Mesmo vencida, a correção automática precisa funcionar.
  const { data: corrigidaTarde, error: erroCorrigirTarde } = await aluno.cliente.rpc(
    'finalizar_tentativa',
    { p_tentativa_id: tentativa2.id },
  )
  const r3 = Array.isArray(corrigidaTarde) ? corrigidaTarde[0] : corrigidaTarde
  checar(!erroCorrigirTarde, 'prova vencida ainda pode ser corrigida (envio automático)')
  checar(r3?.tempo_usado_segundos === 5 * 3600, 'tempo usado é limitado às 5 horas', `(veio ${r3?.tempo_usado_segundos})`)

  // ── 10. isolamento entre alunos ───────────────────────────────────────────
  console.log('\n10. Isolamento entre alunos')
  const outro = await criarAluno('b')
  criados.push(outro.id)

  const { data: tentativasDoOutro } = await outro.cliente.from('tentativas_simulado').select('id')
  checar((tentativasDoOutro ?? []).length === 0, 'outro aluno não enxerga tentativas alheias')

  const { data: cadernoDoOutro } = await outro.cliente.from('caderno_erros').select('id')
  checar((cadernoDoOutro ?? []).length === 0, 'outro aluno não enxerga o caderno alheio')

  const { data: gabaritoDoOutro } = await outro.cliente.from('gabaritos_liberados').select('questao_id')
  checar(
    (gabaritoDoOutro ?? []).length === 0,
    'aluno que não fez a prova não recebe gabarito liberado',
  )

  const { error: erroEscritaAlheia } = await outro.cliente
    .from('respostas_simulado')
    .insert({ tentativa_id: tentativa.id, questao_id: gabarito[0].id, alternativa_escolhida: 'A' })
  checar(!!erroEscritaAlheia, 'aluno não escreve na tentativa de outro')

  // ── 11. finalizar_tentativa: posse em TODOS os caminhos ───────────────────
  // A função é SECURITY DEFINER, então o RLS não a protege: a checagem de posse
  // é feita à mão e precisa valer em cada saída, não só no fluxo principal.
  console.log('\n11. finalizar_tentativa — posse em todos os caminhos')

  // (a) tentativa de outro, JÁ FINALIZADA — exercita o early-return
  const { error: erroAlheiaFinalizada } = await outro.cliente.rpc('finalizar_tentativa', {
    p_tentativa_id: tentativa.id,
  })
  checar(
    !!erroAlheiaFinalizada,
    'caminho "já finalizada": recusa tentativa de outro dono',
    erroAlheiaFinalizada ? '' : '(NOTA ALHEIA VAZOU!)',
  )

  // (b) tentativa de outro, EM ANDAMENTO — exercita o fluxo de correção
  const { data: emAberto } = await aluno.cliente
    .from('tentativas_simulado')
    .insert({ usuario_id: aluno.id, simulado_numero: 3 })
    .select('id')
    .single()

  const { error: erroAlheiaAberta } = await outro.cliente.rpc('finalizar_tentativa', {
    p_tentativa_id: emAberto.id,
  })
  checar(!!erroAlheiaAberta, 'caminho "em andamento": recusa tentativa de outro dono')

  const { data: aindaAberta } = await aluno.cliente
    .from('tentativas_simulado')
    .select('status')
    .eq('id', emAberto.id)
    .single()
  checar(
    aindaAberta.status === 'em_andamento',
    'a tentativa alheia continua intacta após a recusa',
  )

  // (c) id inexistente — não pode revelar existência nem quebrar de outro jeito
  const { error: erroInexistente } = await outro.cliente.rpc('finalizar_tentativa', {
    p_tentativa_id: '00000000-0000-0000-0000-000000000000',
  })
  checar(!!erroInexistente, 'caminho "não encontrada": recusa id inexistente')

  // (d) sem sessão — auth.uid() nulo
  const anonimo = createClient(URL, ANON, { auth: { persistSession: false } })
  const { error: erroAnon } = await anonimo.rpc('finalizar_tentativa', {
    p_tentativa_id: tentativa.id,
  })
  checar(!!erroAnon, 'sem sessão (auth.uid() nulo): execução recusada')

  // ── 12. simulado finalizado sem responder nada ────────────────────────────
  // O bug relatado era exatamente este: com zero respostas, todas as áreas
  // ficam em 0% e o caderno acabava recebendo as 100 questões como "erro".
  console.log('\n12. Simulado finalizado sem nenhuma resposta')
  const { data: tentativaZero } = await outro.cliente
    .from('tentativas_simulado')
    .insert({ usuario_id: outro.id, simulado_numero: 1 })
    .select('id')
    .single()

  const { data: resultadoZero } = await outro.cliente.rpc('finalizar_tentativa', {
    p_tentativa_id: tentativaZero.id,
  })
  const rZero = Array.isArray(resultadoZero) ? resultadoZero[0] : resultadoZero
  checar(Number(rZero.nota) === 0, 'nota = 0 quando nada é respondido')

  const { count: cadernoZero } = await outro.cliente
    .from('caderno_erros')
    .select('*', { count: 'exact', head: true })
  checar(cadernoZero === 0, 'caderno de erros fica vazio quando nada foi respondido', `(veio ${cadernoZero})`)

  const { data: tentativaZeroFinal } = await outro.cliente
    .from('tentativas_simulado')
    .select('percentual_por_area')
    .eq('id', tentativaZero.id)
    .single()
  const areasZero = Object.values(tentativaZeroFinal.percentual_por_area ?? {})
  checar(
    areasZero.length === 5 && areasZero.every((a) => a.percentual === 0),
    'as 5 áreas ficam em 0% quando nada foi respondido',
  )
} finally {
  for (const id of criados) await admin.auth.admin.deleteUser(id)
  if (criados.length) console.log(`\n${criados.length} usuário(s) de teste removido(s).`)
}

console.log('')
if (falhas.length) {
  console.error(`FALHAS (${falhas.length}):`)
  falhas.forEach((f) => console.error(`  - ${f}`))
  process.exit(1)
}
console.log('Todas as verificações do fluxo de prova passaram.')

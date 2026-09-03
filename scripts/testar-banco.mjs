/**
 * Teste ponta a ponta do Banco de Questões, como aluno real (chave anon + RLS).
 *
 * Como a tabela ainda não tem conteúdo do tipo 'banco', o teste semeia algumas
 * questões descartáveis, exercita o fluxo e apaga tudo no fim — o banco volta
 * exatamente ao estado anterior.
 *
 *   node --env-file=.env.local scripts/testar-banco.mjs
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

const SEMENTES = [
  {
    id_planilha: 'TESTE-BANCO-1',
    tipo: 'banco',
    area: 'Clínica Médica',
    subtema: 'Teste automatizado',
    dificuldade: 'Fácil',
    ano_origem: 2024,
    fonte: 'Fonte de teste',
    enunciado: 'Questão semeada para teste automatizado. Qual alternativa é a correta?',
    alternativa_a: 'Alternativa A (errada)',
    alternativa_b: 'Alternativa B (correta)',
    alternativa_c: 'Alternativa C (errada)',
    alternativa_d: 'Alternativa D (errada)',
    resposta_correta: 'B',
    comentario_correta: 'Comentário da correta, semeado para teste.',
    comentario_erros: 'A, C e D: erradas por serem semeadas assim.',
    status: 'Teste',
  },
  {
    id_planilha: 'TESTE-BANCO-2',
    tipo: 'banco',
    area: 'Pediatria',
    subtema: 'Teste automatizado',
    dificuldade: 'Médio',
    ano_origem: 2023,
    fonte: 'Fonte de teste',
    enunciado: 'Segunda questão semeada. Qual alternativa é a correta?',
    alternativa_a: 'Alternativa A (correta)',
    alternativa_b: 'Alternativa B (errada)',
    alternativa_c: 'Alternativa C (errada)',
    alternativa_d: 'Alternativa D (errada)',
    resposta_correta: 'A',
    comentario_correta: 'Comentário da correta da segunda questão.',
    comentario_erros: 'B, C e D: erradas.',
    status: 'Teste',
  },
]

let userId = null
let idsSemeados = []

try {
  const { data: inseridas, error: erroSemear } = await admin
    .from('questoes')
    .upsert(SEMENTES, { onConflict: 'id_planilha' })
    .select('id, id_planilha, resposta_correta')
  if (erroSemear) throw erroSemear
  idsSemeados = inseridas.map((q) => q.id)
  console.log(`\n0. ${inseridas.length} questões de banco semeadas (temporárias)`)

  const q1 = inseridas.find((q) => q.id_planilha === 'TESTE-BANCO-1')
  const q2 = inseridas.find((q) => q.id_planilha === 'TESTE-BANCO-2')

  const email = `banco-${Date.now()}@exemplo-reta-final.test`
  const senha = `Teste!${Math.random().toString(36).slice(2)}Aa1`
  const { data: criado, error: erroUser } = await admin.auth.admin.createUser({
    email,
    password: senha,
    email_confirm: true,
  })
  if (erroUser) throw erroUser
  userId = criado.user.id

  const aluno = createClient(URL, ANON, { auth: { persistSession: false } })
  await aluno.auth.signInWithPassword({ email, password: senha })
  console.log('\n1. Aluno autenticado')

  // ── leitura sem gabarito ──────────────────────────────────────────────────
  const { data: lidas } = await aluno
    .from('questoes')
    .select('id, area, subtema, ano_origem, enunciado, alternativa_a')
    .eq('tipo', 'banco')
  checar(lidas?.length === 2, 'aluno lê as questões do banco (colunas seguras)')

  const { error: erroGabarito } = await aluno
    .from('questoes')
    .select('id, resposta_correta')
    .eq('tipo', 'banco')
    .limit(1)
  checar(!!erroGabarito, 'gabarito do banco é inacessível na tabela questoes')

  // ── favoritar ANTES de responder não pode liberar gabarito ────────────────
  console.log('\n2. Favoritar antes de responder')
  const { error: erroFav } = await aluno
    .from('respostas_banco')
    .upsert(
      { usuario_id: userId, questao_id: q1.id, favorito: true },
      { onConflict: 'usuario_id,questao_id' },
    )
  checar(!erroFav, 'aluno consegue favoritar sem ter respondido')

  const { data: liberadoAposFavoritar } = await aluno
    .from('gabaritos_liberados')
    .select('questao_id')
    .eq('questao_id', q1.id)
  checar(
    (liberadoAposFavoritar ?? []).length === 0,
    'favoritar NÃO libera o gabarito',
    liberadoAposFavoritar?.length ? '(GABARITO VAZOU!)' : '',
  )

  // ── responder errado ──────────────────────────────────────────────────────
  console.log('\n3. Resposta errada com correção imediata')
  const { data: erradaData, error: erroErrada } = await aluno.rpc('responder_banco', {
    p_questao_id: q1.id,
    p_alternativa: 'A', // a correta é B
  })
  if (erroErrada) throw erroErrada
  const errada = Array.isArray(erradaData) ? erradaData[0] : erradaData
  checar(errada.acertou === false, 'devolve acertou = false')
  checar(errada.resposta_correta === 'B', 'devolve a alternativa correta')
  checar(!!errada.comentario_correta, 'devolve o comentário da correta')
  checar(!!errada.comentario_erros, 'devolve o comentário dos erros')

  const { data: registro } = await aluno
    .from('respostas_banco')
    .select('alternativa_escolhida, correta, favorito')
    .eq('questao_id', q1.id)
    .single()
  checar(registro.alternativa_escolhida === 'A' && registro.correta === false, 'resposta registrada')
  checar(registro.favorito === true, 'responder não apaga o favorito marcado antes')

  const { data: noCaderno } = await aluno
    .from('caderno_erros')
    .select('origem')
    .eq('questao_id', q1.id)
  checar(noCaderno?.[0]?.origem === 'banco', 'erro do banco entra no caderno com origem correta')

  const { data: liberadoAposResponder } = await aluno
    .from('gabaritos_liberados')
    .select('questao_id, resposta_correta')
    .eq('questao_id', q1.id)
  checar(
    liberadoAposResponder?.[0]?.resposta_correta === 'B',
    'gabarito é liberado depois de responder',
  )

  // a outra questão, não respondida, continua fechada
  const { data: outraAindaFechada } = await aluno
    .from('gabaritos_liberados')
    .select('questao_id')
    .eq('questao_id', q2.id)
  checar((outraAindaFechada ?? []).length === 0, 'questão não respondida segue sem gabarito')

  // ── responder certo ───────────────────────────────────────────────────────
  console.log('\n4. Resposta certa')
  const { data: certaData } = await aluno.rpc('responder_banco', {
    p_questao_id: q2.id,
    p_alternativa: 'A',
  })
  const certa = Array.isArray(certaData) ? certaData[0] : certaData
  checar(certa.acertou === true, 'devolve acertou = true')

  const { data: cadernoQ2 } = await aluno
    .from('caderno_erros')
    .select('id')
    .eq('questao_id', q2.id)
  checar((cadernoQ2 ?? []).length === 0, 'acerto não entra no caderno de erros')

  // ── trocar a resposta ─────────────────────────────────────────────────────
  console.log('\n5. Refazer a mesma questão')
  const { data: refeitaData } = await aluno.rpc('responder_banco', {
    p_questao_id: q1.id,
    p_alternativa: 'B',
  })
  const refeita = Array.isArray(refeitaData) ? refeitaData[0] : refeitaData
  checar(refeita.acertou === true, 'acerta ao refazer com a alternativa correta')

  const { count: totalRespostas } = await aluno
    .from('respostas_banco')
    .select('*', { count: 'exact', head: true })
    .eq('questao_id', q1.id)
  checar(totalRespostas === 1, 'refazer atualiza a linha em vez de duplicar')

  // ── validações e isolamento ───────────────────────────────────────────────
  console.log('\n6. Validações e isolamento')
  const { error: erroAlternativa } = await aluno.rpc('responder_banco', {
    p_questao_id: q1.id,
    p_alternativa: 'X',
  })
  checar(!!erroAlternativa, 'alternativa inválida é recusada')

  const { error: erroQuestaoSimulado } = await aluno.rpc('responder_banco', {
    p_questao_id: (
      await admin.from('questoes').select('id').eq('tipo', 'simulado').limit(1).single()
    ).data.id,
    p_alternativa: 'A',
  })
  checar(!!erroQuestaoSimulado, 'questão de simulado não pode ser respondida pelo banco')

  const anonimo = createClient(URL, ANON, { auth: { persistSession: false } })
  const { error: erroAnon } = await anonimo.rpc('responder_banco', {
    p_questao_id: q1.id,
    p_alternativa: 'B',
  })
  checar(!!erroAnon, 'sem sessão: execução recusada')
} finally {
  if (userId) await admin.auth.admin.deleteUser(userId)
  if (idsSemeados.length) {
    await admin.from('caderno_erros').delete().in('questao_id', idsSemeados)
    await admin.from('respostas_banco').delete().in('questao_id', idsSemeados)
    await admin.from('questoes').delete().in('id', idsSemeados)
  }
  const { count } = await admin
    .from('questoes')
    .select('*', { count: 'exact', head: true })
    .eq('tipo', 'banco')
  console.log(`\nLimpeza concluída. Questões tipo 'banco' restantes: ${count}`)
}

console.log('')
if (falhas.length) {
  console.error(`FALHAS (${falhas.length}):`)
  falhas.forEach((f) => console.error(`  - ${f}`))
  process.exit(1)
}
console.log('Todas as verificações do banco de questões passaram.')

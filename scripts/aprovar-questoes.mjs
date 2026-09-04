/**
 * Marca como 'Aprovada' toda questão hoje em 'Em revisão'.
 *
 * Os importadores (scripts/import-questoes.ts, scripts/import-banco.ts) leem
 * o status direto de uma coluna da planilha de produção e escrevem
 * 'Em revisão' quando ela vem vazia — ou seja, toda reimportação reseta o
 * status para o que estiver na planilha naquele momento, mesmo que a questão
 * já tivesse sido aprovada antes. Até essa coluna virar um controle editorial
 * de verdade na própria planilha, rode este script depois de qualquer
 * reimportação para reaprovar o que já passou pela validação do importador
 * (ver src/lib/questoes.ts, STATUS_APROVADA, e a migração
 * 11_gate_de_status_das_questoes).
 *
 *   node --env-file=.env.local scripts/aprovar-questoes.mjs
 */

import { createClient } from '@supabase/supabase-js'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!URL || !SERVICE) {
  console.error('Faltam NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY no .env.local')
  process.exit(1)
}

const admin = createClient(URL, SERVICE, { auth: { persistSession: false } })

const { data, error } = await admin
  .from('questoes')
  .update({ status: 'Aprovada' })
  .eq('status', 'Em revisão')
  .select('id')

if (error) {
  console.error('Falhou:', error.message)
  process.exit(1)
}

console.log(`${data.length} questão(ões) marcada(s) como 'Aprovada'.`)

/**
 * Envia um arquivo de imagem para o bucket privado `imagens-questoes` e
 * imprime uma URL assinada de longa duração — cole essa URL na coluna de
 * imagens da planilha de produção (campo `url` de cada item da lista, ver
 * `imagensTexto` em scripts/import-questoes.ts / import-banco.ts).
 *
 * O bucket é privado (RLS: só `authenticated` lê, só quem importa escreve),
 * então uma URL pública direta não funcionaria — a assinatura embute a
 * permissão de leitura. 10 anos de validade evita ter que gerar de novo depois.
 *
 * Lembrete do AGENTS.md: isto é só transporte. Nunca gerar a imagem em si por
 * IA — precisa ser uma imagem clínica real licenciada.
 *
 *   node --env-file=.env.local scripts/enviar-imagem-questao.mjs <arquivo-local> <nome-no-bucket>
 *   node --env-file=.env.local scripts/enviar-imagem-questao.mjs ./ecg-01.png simulado-1/questao-42/ecg-01.png
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY
const BUCKET = 'imagens-questoes'
const DEZ_ANOS_EM_SEGUNDOS = 60 * 60 * 24 * 365 * 10

const [, , arquivoLocal, nomeNoBucket] = process.argv

if (!arquivoLocal || !nomeNoBucket) {
  console.error(
    'Uso: node --env-file=.env.local scripts/enviar-imagem-questao.mjs <arquivo-local> <nome-no-bucket>',
  )
  process.exit(1)
}
if (!URL || !SERVICE) {
  console.error('Faltam NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY no .env.local')
  process.exit(1)
}

const admin = createClient(URL, SERVICE, { auth: { persistSession: false } })

const conteudo = readFileSync(arquivoLocal)
const { error: erroEnvio } = await admin.storage
  .from(BUCKET)
  .upload(nomeNoBucket, conteudo, { upsert: true })
if (erroEnvio) {
  console.error('Falha no envio:', erroEnvio.message)
  process.exit(1)
}

const { data, error: erroAssinatura } = await admin.storage
  .from(BUCKET)
  .createSignedUrl(nomeNoBucket, DEZ_ANOS_EM_SEGUNDOS)
if (erroAssinatura) {
  console.error('Falha ao gerar URL assinada:', erroAssinatura.message)
  process.exit(1)
}

console.log(`Enviado para ${BUCKET}/${nomeNoBucket}.`)
console.log('URL para colar na planilha (coluna de imagens):')
console.log(data.signedUrl)

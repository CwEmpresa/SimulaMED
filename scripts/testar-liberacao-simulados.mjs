/**
 * Teste unitário puro de `instanteDeLiberacao`/`simuladoLiberado`
 * (src/lib/simulado.ts) — a régua de 12h/24h após o primeiro login que libera
 * os Simulados 2 e 3. Sem banco: são funções puras, e é essa aritmética de
 * data que decide se `iniciarSimulado` aceita ou recusa criar a tentativa.
 *
 *   npm run testar:liberacao
 */

import { instanteDeLiberacao, simuladoLiberado } from '../src/lib/simulado.ts'

const falhas = []
function checar(condicao, descricao, detalhe = '') {
  if (condicao) console.log(`  ok    ${descricao}`)
  else {
    console.log(`  FALHA ${descricao} ${detalhe}`)
    falhas.push(descricao)
  }
}

const HORA = 3600 * 1000
const agora = Date.now()

console.log('\n1. Sem primeiro login registrado — falha aberta (não é defesa de segurança)')
checar(simuladoLiberado(1, null), 'simulado 1 liberado mesmo sem primeiro login')
checar(simuladoLiberado(2, null), 'simulado 2 liberado mesmo sem primeiro login')
checar(simuladoLiberado(3, null), 'simulado 3 liberado mesmo sem primeiro login')
checar(instanteDeLiberacao(2, null) === null, 'instanteDeLiberacao(2, null) é null')

console.log('\n2. Simulado 1 é sempre livre, não importa quando foi o primeiro login')
checar(simuladoLiberado(1, new Date(agora).toISOString(), agora), 'liberado no exato instante do primeiro login')
checar(instanteDeLiberacao(1, new Date(agora).toISOString()) === null, 'instanteDeLiberacao(1, ...) é null (sem trava)')

console.log('\n3. Simulado 2 — libera exatamente 12h após o primeiro login')
const login2 = new Date(agora - 11 * HORA).toISOString()
checar(!simuladoLiberado(2, login2, agora), '11h depois: ainda bloqueado')
const alvo2 = instanteDeLiberacao(2, login2)
checar(alvo2 !== null && alvo2.getTime() === new Date(login2).getTime() + 12 * HORA, 'alvo = primeiro login + 12h')
checar(simuladoLiberado(2, login2, new Date(login2).getTime() + 12 * HORA), 'liberado exatamente às 12h (inclusivo)')
checar(simuladoLiberado(2, login2, new Date(login2).getTime() + 12 * HORA + 1000), 'liberado depois das 12h')
checar(!simuladoLiberado(2, login2, new Date(login2).getTime() + 12 * HORA - 1000), 'ainda bloqueado 1s antes das 12h')

console.log('\n4. Simulado 3 — libera exatamente 24h após o primeiro login, independente do simulado 2')
const login3 = new Date(agora - 23 * HORA).toISOString()
checar(!simuladoLiberado(3, login3, agora), '23h depois: ainda bloqueado')
checar(simuladoLiberado(2, login3, agora), 'simulado 2 já liberado com 23h (regra de 12h já passou)')
checar(
  simuladoLiberado(3, login3, new Date(login3).getTime() + 24 * HORA),
  'simulado 3 liberado exatamente às 24h',
)

console.log('\n5. primeiro login no futuro (relógio adulterado) não libera antes da hora')
const loginFuturo = new Date(agora + HORA).toISOString()
checar(!simuladoLiberado(2, loginFuturo, agora), 'simulado 2 continua bloqueado se o primeiro login "ainda não aconteceu"')

console.log('')
if (falhas.length) {
  console.error(`FALHAS (${falhas.length}):`)
  falhas.forEach((f) => console.error(`  - ${f}`))
  process.exit(1)
}
console.log('Todas as verificações de liberação dos simulados passaram.')

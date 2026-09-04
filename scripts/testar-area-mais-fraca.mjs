/**
 * Teste unitário puro de `analisarAreaMaisFraca` e `formatarListaDeAreas`
 * (src/lib/diagnostico.ts). Sem banco — são funções puras, e é exatamente
 * essa lógica de empate que motivou a correção do bug relatado (a "área mais
 * fraca" escolhida arbitrariamente quando duas ou mais empatavam no fundo).
 *
 *   npm run testar:area-fraca
 */

import { analisarAreaMaisFraca, formatarListaDeAreas } from '../src/lib/diagnostico.ts'

const falhas = []
function checar(condicao, descricao, detalhe = '') {
  if (condicao) console.log(`  ok    ${descricao}`)
  else {
    console.log(`  FALHA ${descricao} ${detalhe}`)
    falhas.push(descricao)
  }
}

const a = (area, percentual) => ({ area, percentual })

console.log('\n1. Sem dados nenhum')
checar(
  analisarAreaMaisFraca([]).tipo === 'sem_dados',
  'lista vazia → sem_dados',
)

console.log('\n2. Todas empatadas em 0% (o bug relatado: zero respondido)')
const r2 = analisarAreaMaisFraca([a('Cirurgia', 0), a('Pediatria', 0), a('Clínica Médica', 0)])
checar(r2.tipo === 'empatado', 'todas em 0% → empatado, nenhuma escolhida arbitrariamente', JSON.stringify(r2))

console.log('\n3. Todas empatadas num valor bom (ex.: 100%)')
const r3 = analisarAreaMaisFraca([a('A', 100), a('B', 100)])
checar(r3.tipo === 'tudo_bem', 'todas em 100% → tudo_bem (não é "empate ruim")', JSON.stringify(r3))

console.log('\n4. Nenhuma área mal o bastante (todas ≥70%, sem empate)')
const r4 = analisarAreaMaisFraca([a('A', 70), a('B', 85), a('C', 100)])
checar(r4.tipo === 'tudo_bem', 'pior = 70% (limite) → tudo_bem', JSON.stringify(r4))

console.log('\n5. Uma única área mais fraca, sem empate')
const r5 = analisarAreaMaisFraca([a('Cirurgia', 20), a('Pediatria', 60), a('Clínica Médica', 90)])
checar(r5.tipo === 'ok' && r5.areas.length === 1 && r5.areas[0] === 'Cirurgia', 'escolhe a única mais fraca', JSON.stringify(r5))
checar(r5.percentual === 20, 'percentual correto', JSON.stringify(r5))

console.log('\n6. Empate PARCIAL — duas piores empatadas, o resto não (o bug real)')
const r6 = analisarAreaMaisFraca([a('Cirurgia', 0), a('Pediatria', 0), a('Clínica Médica', 50), a('GO', 100)])
checar(
  r6.tipo === 'ok' && r6.areas.length === 2 && r6.areas.includes('Cirurgia') && r6.areas.includes('Pediatria'),
  'lista as DUAS empatadas na pior posição, não escolhe uma por ordem de array',
  JSON.stringify(r6),
)
checar(!r6.areas.includes('Clínica Médica') && !r6.areas.includes('GO'), 'não inclui áreas que não empatam no pior', JSON.stringify(r6))

console.log('\n7. Empate parcial de três, ordem de entrada não deveria importar')
// Mesmo conjunto, ordem diferente de entrada — o resultado tem de ser o mesmo.
const base7 = [a('D', 90), a('A', 10), a('C', 10), a('B', 10)]
const r7 = analisarAreaMaisFraca(base7)
checar(
  r7.tipo === 'ok' && r7.areas.length === 3 && ['A', 'B', 'C'].every((x) => r7.areas.includes(x)),
  'empate de 3 áreas identificado independente da ordem de entrada',
  JSON.stringify(r7),
)

console.log('\n8. formatarListaDeAreas — concordância em português')
checar(formatarListaDeAreas(['Cirurgia']) === 'Cirurgia', '1 área: sem conectivo')
checar(formatarListaDeAreas(['Cirurgia', 'Pediatria']) === 'Cirurgia e Pediatria', '2 áreas: "X e Y"')
checar(
  formatarListaDeAreas(['Cirurgia', 'Pediatria', 'Clínica Médica']) === 'Cirurgia, Pediatria e Clínica Médica',
  '3 áreas: "X, Y e Z"',
)

console.log('')
if (falhas.length) {
  console.error(`FALHAS (${falhas.length}):`)
  falhas.forEach((f) => console.error(`  - ${f}`))
  process.exit(1)
}
console.log('Todas as verificações de área mais fraca passaram.')

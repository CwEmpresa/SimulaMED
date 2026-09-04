import Link from 'next/link'
import { redirect } from 'next/navigation'

import { AvisoConteudo } from '@/components/aviso-conteudo'
import { PraticarBanco, type QuestaoBanco } from '@/components/banco/praticar-banco'
import { CascaApp } from '@/components/casca-app'
import { IconeEmProducao, IconeFiltro } from '@/components/ui/icones'
import { EstadoVazio, botaoPrimario, botaoSecundario } from '@/components/ui/primitivos'
import { createClient } from '@/lib/supabase/server'

const COLUNAS_SEGURAS =
  'id, area, subtema, dificuldade, ano_origem, fonte, enunciado, alternativa_a, alternativa_b, alternativa_c, alternativa_d, tabela_dados, grafico_svg, imagens'

function texto(valor: string | string[] | undefined) {
  return typeof valor === 'string' && valor !== '' ? valor : undefined
}

export default async function BancoPage({ searchParams }: PageProps<'/banco'>) {
  const params = await searchParams
  const fArea = texto(params.area)
  const fSubtema = texto(params.subtema)
  const fAno = texto(params.ano)
  const fStatus = texto(params.status) // 'respondida' | 'nao_respondida'
  const fFavoritas = texto(params.favoritas) === '1'

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Metadados dos filtros. São poucas centenas de linhas no total, então vale
  // trazer e agrupar aqui em vez de manter uma view só para isso.
  const { data: catalogo } = await supabase
    .from('questoes')
    .select('id, area, subtema, ano_origem')
    .eq('tipo', 'banco')

  const totalNoBanco = catalogo?.length ?? 0

  if (totalNoBanco === 0) {
    return (
      <Moldura>
        <BancoVazio />
      </Moldura>
    )
  }

  const { data: respostas } = await supabase
    .from('respostas_banco')
    .select('questao_id, alternativa_escolhida, favorito')
    .eq('usuario_id', user.id)

  const respondidas = new Set(
    (respostas ?? []).filter((r) => r.alternativa_escolhida).map((r) => r.questao_id),
  )
  const favoritadas = new Set((respostas ?? []).filter((r) => r.favorito).map((r) => r.questao_id))

  const areas = [...new Set((catalogo ?? []).map((q) => q.area))].sort()
  const subtemas = [
    ...new Set(
      (catalogo ?? [])
        .filter((q) => !fArea || q.area === fArea)
        .map((q) => q.subtema)
        .filter((s): s is string => !!s),
    ),
  ].sort()
  const anos = [
    ...new Set((catalogo ?? []).map((q) => q.ano_origem).filter((a): a is number => !!a)),
  ].sort((a, b) => b - a)

  let query = supabase.from('questoes').select(COLUNAS_SEGURAS).eq('tipo', 'banco')
  if (fArea) query = query.eq('area', fArea)
  if (fSubtema) query = query.eq('subtema', fSubtema)
  if (fAno) query = query.eq('ano_origem', Number(fAno))

  const { data: encontradas } = await query.order('area').order('subtema')

  let questoes = (encontradas ?? []) as QuestaoBanco[]
  if (fStatus === 'respondida') questoes = questoes.filter((q) => respondidas.has(q.id))
  if (fStatus === 'nao_respondida') questoes = questoes.filter((q) => !respondidas.has(q.id))
  if (fFavoritas) questoes = questoes.filter((q) => favoritadas.has(q.id))

  // Correções já conquistadas: sem isso, ao voltar à tela uma questão
  // respondida reapareceria "em branco" e o aluno perderia o comentário.
  // A view só devolve o gabarito de questões que ele de fato respondeu.
  const idsRespondidasNaTela = questoes.map((q) => q.id).filter((id) => respondidas.has(id))
  const { data: gabaritos } = idsRespondidasNaTela.length
    ? await supabase
        .from('gabaritos_liberados')
        .select('questao_id, resposta_correta, comentario_correta, comentario_erros')
        .in('questao_id', idsRespondidasNaTela)
    : { data: [] }

  const escolhaPorQuestao = new Map(
    (respostas ?? []).map((r) => [r.questao_id, r.alternativa_escolhida]),
  )

  const correcoesIniciais = (gabaritos ?? [])
    .filter((g) => g.questao_id && g.resposta_correta)
    .map((g) => ({
      questao_id: g.questao_id!,
      escolhida: escolhaPorQuestao.get(g.questao_id!) ?? null,
      resposta_correta: g.resposta_correta!,
      comentario_correta: g.comentario_correta,
      comentario_erros: g.comentario_erros,
    }))

  return (
    <Moldura>
      <p className="text-sm text-texto-suave">
        <span className="tabular-nums">{respondidas.size}</span> de{' '}
        <span className="tabular-nums">{totalNoBanco}</span> questões já respondidas.
      </p>

      {/* No telefone a questão vem primeiro: rolar por cinco filtros antes de
          ver qualquer conteúdo é atrito puro. No desktop os filtros voltam a
          ser a coluna da esquerda. */}
      <div className="mt-6 grid gap-6 lg:grid-cols-[220px_1fr]">
        <div className="order-2 lg:order-1">
          <Filtros
            areas={areas}
            subtemas={subtemas}
            anos={anos}
            selecionados={{ fArea, fSubtema, fAno, fStatus, fFavoritas }}
          />
        </div>

        <div className="order-1 lg:order-2">
          {questoes.length === 0 ? (
            <EstadoVazio
              icone={<IconeFiltro className="size-7" />}
              titulo="Nenhuma questão com esses filtros"
              descricao="Nenhuma questão do banco combina com a seleção atual. Afrouxe um dos filtros ou limpe todos para ver o acervo inteiro."
              acoes={
                <Link href="/banco" className={botaoPrimario}>
                  Limpar filtros
                </Link>
              }
            />
          ) : (
            <PraticarBanco
              key={`${fArea}-${fSubtema}-${fAno}-${fStatus}-${fFavoritas}`}
              questoes={questoes}
              estadoInicial={(respostas ?? []).map((r) => ({
                questao_id: r.questao_id,
                alternativa_escolhida: r.alternativa_escolhida,
                favorito: r.favorito,
              }))}
              correcoesIniciais={correcoesIniciais}
            />
          )}
        </div>
      </div>
    </Moldura>
  )
}

function Moldura({ children }: { children: React.ReactNode }) {
  return (
    <CascaApp>
      <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-8 sm:py-10">
        <header className="mb-6">
          <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
            Banco de questões
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-texto-suave">
            Treino avulso, com correção e comentário na hora — ao contrário do simulado, aqui
            você descobre na mesma hora se acertou.
          </p>
        </header>

        {children}

        <AvisoConteudo className="mt-12" />
      </main>
    </CascaApp>
  )
}

/**
 * Estado vazio do banco. O aluno pagou pelo produto e precisa entender que isto
 * é conteúdo a caminho, não uma falha — e sair daqui com algo útil para fazer.
 */
function BancoVazio() {
  return (
    <EstadoVazio
      icone={<IconeEmProducao className="size-7" />}
      titulo="Banco de questões em produção"
      descricao="São 500 questões comentadas sendo escritas e revisadas agora, com filtros por área, subtema e ano. Elas aparecem aqui automaticamente assim que ficarem prontas — sem precisar de nada da sua parte."
      acoes={
        <>
          <Link href="/simulados" className={botaoPrimario}>
            Fazer um simulado
          </Link>
          <Link href="/cadernos" className={botaoSecundario}>
            Revisar meus erros
          </Link>
        </>
      }
    />
  )
}

function Filtros({
  areas,
  subtemas,
  anos,
  selecionados,
}: {
  areas: string[]
  subtemas: string[]
  anos: number[]
  selecionados: {
    fArea?: string
    fSubtema?: string
    fAno?: string
    fStatus?: string
    fFavoritas: boolean
  }
}) {
  const { fArea, fSubtema, fAno, fStatus, fFavoritas } = selecionados
  const temFiltro = !!(fArea || fSubtema || fAno || fStatus || fFavoritas)

  return (
    // Formulário GET: os filtros ficam na URL, então o estado é compartilhável,
    // sobrevive ao refresh e funciona sem JavaScript.
    <form
      method="get"
      className="flex flex-col gap-4 rounded-2xl border border-borda bg-superficie p-5
                 shadow-[var(--sombra-1)] lg:sticky lg:top-24 lg:h-fit"
    >
      <p className="flex items-center gap-2 font-display text-sm font-semibold tracking-tight">
        <IconeFiltro className="size-4 text-texto-suave" />
        Filtros
      </p>

      <Campo rotulo="Área" nome="area" valor={fArea} opcoes={areas} />
      <Campo rotulo="Subtema" nome="subtema" valor={fSubtema} opcoes={subtemas} />
      <Campo
        rotulo="Ano de origem"
        nome="ano"
        valor={fAno}
        opcoes={anos.map((a) => String(a))}
      />
      <Campo
        rotulo="Status"
        nome="status"
        valor={fStatus}
        opcoes={[
          { valor: 'nao_respondida', rotulo: 'Não respondidas' },
          { valor: 'respondida', rotulo: 'Respondidas' },
        ]}
      />

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="favoritas"
          value="1"
          defaultChecked={fFavoritas}
          className="size-4 rounded border-borda accent-[var(--cor-acento)]"
        />
        Só favoritas
      </label>

      <div className="flex flex-col gap-2">
        <button type="submit" className={botaoPrimario}>
          Aplicar filtros
        </button>
        {temFiltro && (
          <Link href="/banco" className={botaoSecundario}>
            Limpar
          </Link>
        )}
      </div>
    </form>
  )
}

function Campo({
  rotulo,
  nome,
  valor,
  opcoes,
}: {
  rotulo: string
  nome: string
  valor?: string
  opcoes: (string | { valor: string; rotulo: string })[]
}) {
  if (opcoes.length === 0) return null

  return (
    <div>
      <label htmlFor={`filtro-${nome}`} className="block text-xs font-medium text-texto-suave">
        {rotulo}
      </label>
      <select
        id={`filtro-${nome}`}
        name={nome}
        defaultValue={valor ?? ''}
        className="mt-1.5 w-full cursor-pointer rounded-xl border border-borda bg-superficie
                   px-3 py-2.5 text-sm transition-colors hover:border-borda-forte
                   focus:border-acento focus:outline-none"
      >
        <option value="">Todas</option>
        {opcoes.map((o) => {
          const v = typeof o === 'string' ? o : o.valor
          const r = typeof o === 'string' ? o : o.rotulo
          return (
            <option key={v} value={v}>
              {r}
            </option>
          )
        })}
      </select>
    </div>
  )
}

import Link from 'next/link'

import { AvisoConteudo } from '@/components/aviso-conteudo'
import { NOME_PRODUTO } from '@/lib/site'

export const metadata = {
  title: 'Termos de Uso',
}

/**
 * MINUTA — rascunho de partida, não revisado por advogado. Todo trecho entre
 * colchetes precisa ser preenchido (razão social, CNPJ, endereço, foro) e o
 * texto inteiro precisa passar por revisão jurídica antes de valer como termo
 * vinculante de verdade. Ver relatório da sessão que criou este arquivo.
 */
export default function TermosDeUsoPage() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-12">
      <header className="mb-8">
        <Link href="/login" className="text-sm text-texto-suave hover:text-texto">
          ← Voltar
        </Link>
        <h1 className="mt-4 font-display text-2xl font-semibold tracking-tight sm:text-3xl">
          Termos de Uso
        </h1>
        <p className="mt-2 text-sm text-texto-suave">Última atualização: [DATA].</p>
      </header>

      <div className="space-y-6 text-sm leading-relaxed text-texto">
        <p>
          Estes Termos de Uso regulam o acesso e uso da plataforma {NOME_PRODUTO} ("Plataforma"),
          operada por [RAZÃO SOCIAL], CNPJ [CNPJ], com sede em [ENDEREÇO] ("nós"). Ao criar uma
          conta ou usar a Plataforma, você ("aluno") concorda com estes termos.
        </p>

        <section>
          <h2 className="font-display text-base font-semibold">1. O que é a Plataforma</h2>
          <p className="mt-2">
            A {NOME_PRODUTO} é uma ferramenta de treino para exames de conhecimentos médicos
            (ENAMED/ENARE), com simulados cronometrados, banco de questões e cadernos de erro.
            O material tem finalidade exclusivamente educacional.
          </p>
        </section>

        <section>
          <h2 className="font-display text-base font-semibold">2. Cadastro e acesso</h2>
          <p className="mt-2">
            O acesso é vinculado à sua compra do produto correspondente. O login é feito por
            link de acesso enviado ao e-mail cadastrado ("magic link"), sem senha. Você é
            responsável por manter o acesso à caixa de e-mail usada no cadastro e por toda
            atividade realizada na sua conta.
          </p>
        </section>

        <section>
          <h2 className="font-display text-base font-semibold">3. Uso permitido</h2>
          <p className="mt-2">
            A conta é pessoal e intransferível. Não é permitido compartilhar credenciais de
            acesso, revender ou redistribuir o conteúdo da Plataforma, nem tentar automatizar,
            copiar em massa ou extrair o banco de questões por meios não oferecidos pela própria
            Plataforma.
          </p>
        </section>

        <section>
          <h2 className="font-display text-base font-semibold">4. Propriedade intelectual</h2>
          <p className="mt-2">
            Enunciados, alternativas, comentários e demais materiais da Plataforma são de nossa
            titularidade ou usados sob licença, e protegidos por direitos autorais. Questões
            baseadas em provas de exames anteriores têm a fonte identificada (instituição, ano,
            número do caderno) quando aplicável.
          </p>
        </section>

        <section>
          <h2 className="font-display text-base font-semibold">5. Sem afiliação institucional</h2>
          <AvisoConteudo className="mt-2" />
        </section>

        <section>
          <h2 className="font-display text-base font-semibold">6. Pagamento e reembolso</h2>
          <p className="mt-2">
            A compra é processada por um parceiro de pagamentos (Lowify). Prazos e condições de
            reembolso seguem [POLÍTICA DE REEMBOLSO — prazo, condições e onde solicitar] e a
            legislação aplicável (Código de Defesa do Consumidor, incluindo o direito de
            arrependimento em compras online).
          </p>
        </section>

        <section>
          <h2 className="font-display text-base font-semibold">7. Sem garantia de resultado</h2>
          <p className="mt-2">
            A Plataforma é uma ferramenta de treino. Não garantimos aprovação em nenhum exame:
            o resultado depende do seu próprio estudo e desempenho.
          </p>
        </section>

        <section>
          <h2 className="font-display text-base font-semibold">8. Disponibilidade e mudanças</h2>
          <p className="mt-2">
            Podemos alterar, suspender ou descontinuar funcionalidades da Plataforma, e podemos
            atualizar estes Termos a qualquer momento — a versão vigente é sempre a publicada
            nesta página, com a data de atualização no topo.
          </p>
        </section>

        <section>
          <h2 className="font-display text-base font-semibold">9. Encerramento de conta</h2>
          <p className="mt-2">
            Você pode pedir o encerramento da sua conta e a exclusão dos seus dados a qualquer
            momento pelo contato abaixo. Podemos suspender contas que violem estes Termos.
          </p>
        </section>

        <section>
          <h2 className="font-display text-base font-semibold">10. Lei aplicável e foro</h2>
          <p className="mt-2">
            Estes Termos são regidos pela lei brasileira. Fica eleito o foro da comarca de
            [CIDADE/UF] para dirimir eventuais controvérsias, com renúncia a qualquer outro, por
            mais privilegiado que seja.
          </p>
        </section>

        <section>
          <h2 className="font-display text-base font-semibold">11. Contato</h2>
          <p className="mt-2">
            Dúvidas sobre estes Termos: [E-MAIL DE CONTATO]. Veja também a nossa{' '}
            <Link href="/privacidade" className="text-acento underline underline-offset-4">
              Política de Privacidade
            </Link>
            .
          </p>
        </section>
      </div>
    </main>
  )
}

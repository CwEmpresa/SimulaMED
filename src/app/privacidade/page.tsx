import Link from 'next/link'

import { NOME_PRODUTO } from '@/lib/site'

export const metadata = {
  title: 'Política de Privacidade',
}

/**
 * MINUTA — rascunho de partida, não revisado por advogado. Todo trecho entre
 * colchetes precisa ser preenchido (razão social, CNPJ, endereço, contato do
 * encarregado de dados) e o texto inteiro precisa passar por revisão jurídica
 * (LGPD) antes de valer como política vinculante de verdade. Ver relatório da
 * sessão que criou este arquivo.
 */
export default function PoliticaDePrivacidadePage() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-12">
      <header className="mb-8">
        <Link href="/login" className="text-sm text-texto-suave hover:text-texto">
          ← Voltar
        </Link>
        <h1 className="mt-4 font-display text-2xl font-semibold tracking-tight sm:text-3xl">
          Política de Privacidade
        </h1>
        <p className="mt-2 text-sm text-texto-suave">Última atualização: [DATA].</p>
      </header>

      <div className="space-y-6 text-sm leading-relaxed text-texto">
        <p>
          Esta política explica quais dados a {NOME_PRODUTO}, operada por [RAZÃO SOCIAL], CNPJ
          [CNPJ] (“nós”), coleta, para que usa e quais direitos você tem sobre eles, em linha com
          a Lei Geral de Proteção de Dados (LGPD, Lei 13.709/2018).
        </p>

        <section>
          <h2 className="font-display text-base font-semibold">1. Dados que coletamos</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Cadastro: nome e e-mail.</li>
            <li>
              Uso da Plataforma: respostas de simulados e do banco de questões, tempo de prova,
              notas e progresso — para gerar seu diagnóstico de desempenho e caderno de erros.
            </li>
            <li>
              Compra: quando processada pelo nosso parceiro de pagamentos (Lowify), recebemos
              e-mail, status e identificador da compra para liberar seu acesso — não recebemos
              dados de cartão.
            </li>
            <li>Dados técnicos: cookies de sessão necessários para manter você conectado.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-display text-base font-semibold">2. Para que usamos</h2>
          <p className="mt-2">
            Para viabilizar o acesso à Plataforma, corrigir simulados e questões, calcular seu
            desempenho e diagnóstico, manter seu caderno de erros, vincular sua compra à sua
            conta e cumprir obrigações legais e contratuais.
          </p>
        </section>

        <section>
          <h2 className="font-display text-base font-semibold">3. Base legal</h2>
          <p className="mt-2">
            Tratamos seus dados com base na execução do contrato de uso da Plataforma (art. 7º,
            V, LGPD) e, quando aplicável, no cumprimento de obrigação legal ou regulatória.
          </p>
        </section>

        <section>
          <h2 className="font-display text-base font-semibold">4. Com quem compartilhamos</h2>
          <p className="mt-2">
            Usamos os seguintes prestadores de serviço para operar a Plataforma, cada um agindo
            como operador dos dados que processa em nosso nome:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Supabase — hospedagem do banco de dados e autenticação.</li>
            <li>Vercel — hospedagem da aplicação.</li>
            <li>Lowify — processamento do pagamento da sua compra.</li>
            <li>
              [Sentry, quando ativado — monitoramento de erros técnicos da aplicação; recebe
              detalhes técnicos do erro, não recebe suas respostas de prova].
            </li>
          </ul>
          <p className="mt-2">
            Não vendemos seus dados nem os compartilhamos com terceiros para fins de publicidade.
          </p>
        </section>

        <section>
          <h2 className="font-display text-base font-semibold">5. Por quanto tempo guardamos</h2>
          <p className="mt-2">
            Guardamos seus dados enquanto sua conta estiver ativa e pelo prazo adicional
            necessário para cumprir obrigação legal ou exercício regular de direitos. Ao pedir o
            encerramento da conta, excluímos ou anonimizamos os dados não sujeitos a retenção
            legal obrigatória.
          </p>
        </section>

        <section>
          <h2 className="font-display text-base font-semibold">6. Seus direitos (LGPD)</h2>
          <p className="mt-2">
            Você pode pedir a confirmação do tratamento, acesso, correção, anonimização,
            portabilidade ou eliminação dos seus dados, e a revogação de consentimento quando
            aplicável, pelo contato abaixo.
          </p>
        </section>

        <section>
          <h2 className="font-display text-base font-semibold">7. Segurança</h2>
          <p className="mt-2">
            Seus dados ficam protegidos por controle de acesso por linha (Row Level Security) no
            banco de dados — cada aluno só acessa as próprias tentativas, respostas e caderno de
            erros — e o login não usa senha (link de acesso único por e-mail).
          </p>
        </section>

        <section>
          <h2 className="font-display text-base font-semibold">8. Menores de idade</h2>
          <p className="mt-2">
            A Plataforma se destina a candidatos a exames de graduação/residência médica, em
            regra maiores de 18 anos. Não coletamos intencionalmente dados de crianças.
          </p>
        </section>

        <section>
          <h2 className="font-display text-base font-semibold">9. Alterações</h2>
          <p className="mt-2">
            Podemos atualizar esta política — a versão vigente é sempre a publicada nesta página,
            com a data de atualização no topo.
          </p>
        </section>

        <section>
          <h2 className="font-display text-base font-semibold">10. Contato</h2>
          <p className="mt-2">
            Para exercer seus direitos de titular de dados ou tirar dúvidas sobre esta política:
            [E-MAIL DO ENCARREGADO/DPO OU CONTATO]. Veja também os nossos{' '}
            <Link href="/termos" className="text-acento underline underline-offset-4">
              Termos de Uso
            </Link>
            .
          </p>
        </section>
      </div>
    </main>
  )
}

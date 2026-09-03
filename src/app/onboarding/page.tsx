import { redirect } from 'next/navigation'

import { AvisoConteudo } from '@/components/aviso-conteudo'
import { PassosOnboarding } from '@/components/onboarding/passos-onboarding'
import { createClient } from '@/lib/supabase/server'

export default async function OnboardingPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: perfil } = await supabase
    .from('usuarios')
    .select('nome, onboarding_concluido_em')
    .eq('id', user.id)
    .maybeSingle()

  // Quem já viu não é obrigado a rever — evita também o pingue-pongue com o
  // redirecionamento que o painel faz no sentido contrário.
  if (perfil?.onboarding_concluido_em) redirect('/dashboard')

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-6 px-5 py-12">
      <header>
        <h1 className="text-sm font-medium text-texto-suave">Reta Final ENAMED/ENARE</h1>
        <p className="mt-1 text-lg">
          {perfil?.nome ? `Boas-vindas, ${perfil.nome.split(' ')[0]}.` : 'Boas-vindas.'}{' '}
          <span className="text-texto-suave">São quatro ferramentas, e elas se conectam.</span>
        </p>
      </header>

      <PassosOnboarding />

      <AvisoConteudo />
    </main>
  )
}

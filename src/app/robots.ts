import type { MetadataRoute } from 'next'

import { SITE_URL } from '@/lib/site'

/**
 * Hoje o produto não tem página pública de marketing — `/` só redireciona
 * para `/login` ou `/dashboard` (ver src/app/page.tsx) e todo o resto exige
 * sessão (ver ROTAS_PUBLICAS em src/lib/supabase/middleware.ts). Ainda assim
 * vale excluir explicitamente as rotas autenticadas e o webhook do rastreio
 * — nenhuma delas tem conteúdo indexável, e é melhor não gastar orçamento de
 * rastreio de bots nelas.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: ['/login', '/termos', '/privacidade'],
      disallow: [
        '/dashboard',
        '/onboarding',
        '/simulados',
        '/banco',
        '/combo',
        '/cadernos',
        '/diagnostico',
        '/perfil',
        '/dev',
        '/api',
        '/auth',
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  }
}

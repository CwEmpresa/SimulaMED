import type { MetadataRoute } from 'next'

import { SITE_URL } from '@/lib/site'

/**
 * Só `/login`, `/termos` e `/privacidade` são públicas hoje (ver
 * src/app/robots.ts) — `/` sempre redireciona antes de renderizar qualquer
 * coisa indexável. Crescer este array quando existir uma página de marketing
 * de verdade.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: `${SITE_URL}/login`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 1,
    },
    {
      url: `${SITE_URL}/termos`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${SITE_URL}/privacidade`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.3,
    },
  ]
}

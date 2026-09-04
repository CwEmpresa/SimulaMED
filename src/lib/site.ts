/**
 * URL pública do site, usada em metadados (Open Graph, robots.txt, sitemap).
 *
 * Preencher `NEXT_PUBLIC_SITE_URL` com o domínio final assim que ele existir
 * (custom domain ou o *.vercel.app do projeto) — sem isso os links de Open
 * Graph caem no domínio de preview da Vercel (`VERCEL_URL`) ou, em
 * desenvolvimento, em localhost.
 */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')

export const NOME_PRODUTO = 'SimulaMed'
export const DESCRICAO_PRODUTO =
  'Faça a prova antes da prova. Simulados cronometrados, banco de questões e cadernos de erro para o ENAMED/ENARE.'

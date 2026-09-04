import type { NextConfig } from "next";

import { withSentryConfig } from "@sentry/nextjs/config";

const nextConfig: NextConfig = {
  /* config options here */
};

// Sem SENTRY_AUTH_TOKEN/SENTRY_ORG/SENTRY_PROJECT (dev local, CI sem os
// segredos configurados), o plugin só pula o upload de source maps — não
// quebra o build. `silent` evita log de aviso nesses casos. `disableLogger`
// não é suportado com Turbopack (usado neste projeto), por isso não está
// aqui — ver webpack.treeshake.removeDebugLogging se um dia migrar pro
// bundler webpack.
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: true,
});

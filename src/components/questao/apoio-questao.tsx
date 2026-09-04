'use client'

import { useEffect, useState } from 'react'

import { IconeExpandir } from '@/components/ui/icones'
import type { ImagemApoio, TabelaDados } from '@/lib/simulado'

/**
 * Tabela de dados (`questoes.tabela_dados`), entre o enunciado e as
 * alternativas — a mesma posição em Modo Prova, Banco, Gabarito e Cadernos.
 * Colunas são livres (`colunas`/`linhas` como arrays, nunca objeto por linha
 * — ver comentário do tipo `TabelaDados` sobre reordenação de chaves no
 * jsonb) — nunca fixas em "Exame/Resultado/Referência", porque a prova real
 * também usa tabelas de 4+ colunas (ex. espirometria pré/pós-BD).
 */
export function TabelaDadosQuestao({ tabela }: { tabela: TabelaDados | null | undefined }) {
  if (!tabela?.linhas?.length) return null
  const { colunas, linhas } = tabela

  return (
    <div className="mt-4 overflow-x-auto rounded-xl border border-borda">
      <table className="w-full min-w-[420px] border-collapse text-sm">
        <thead>
          <tr className="bg-superficie-2 text-left text-xs font-semibold tracking-wide text-texto-suave">
            {colunas.map((coluna, ci) => (
              <th key={ci} className="px-3 py-2">
                {coluna}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {linhas.map((linha, i) => (
            <tr key={i} className={i % 2 === 1 ? 'bg-superficie-2/50' : undefined}>
              {linha.map((valor, ci) => (
                <td key={ci} className={`px-3 py-2 ${ci === 0 ? 'font-medium' : 'tabular-nums'}`}>
                  {valor ?? '—'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/**
 * Gráfico/traçado esquemático (`questoes.grafico_svg`) — ECG, curva de
 * espirometria etc. É uma representação de padrão fisiológico (não foto de
 * paciente real), então o SVG pode vir de conteúdo gerado e é renderizado
 * como marcação confiável, na mesma família de conteúdo de `enunciado`.
 * `[&_svg]` trava o tamanho de exibição independente das dimensões próprias
 * do SVG injetado.
 */
export function GraficoSvgQuestao({ svg }: { svg: string | null | undefined }) {
  if (!svg) return null

  return (
    <div
      className="mt-4 flex justify-center overflow-x-auto rounded-xl border border-borda
                 bg-superficie-2 p-4 [&_svg]:h-auto [&_svg]:max-h-64 [&_svg]:w-auto"
      // conteúdo autoral (questoes), nunca de usuário
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}

/**
 * 0 a N imagens clínicas reais (`questoes.imagens`), lado a lado — ex. uma
 * sequência radiológica evolutiva "1 hora / 12 horas / 24 horas". Cada uma
 * abre em lightbox própria: em foto de pele ou radiografia o detalhe importa,
 * então o tamanho no card nunca é o tamanho final de leitura.
 */
export function ImagensQuestao({ imagens }: { imagens: ImagemApoio[] | null | undefined }) {
  const [ampliada, setAmpliada] = useState<number | null>(null)

  useEffect(() => {
    if (ampliada === null) return
    function aoTeclar(e: KeyboardEvent) {
      if (e.key === 'Escape') setAmpliada(null)
    }
    window.addEventListener('keydown', aoTeclar)
    return () => window.removeEventListener('keydown', aoTeclar)
  }, [ampliada])

  if (!imagens?.length) return null
  const atual = ampliada !== null ? imagens[ampliada] : null

  return (
    <>
      <div className="mt-4 flex gap-3 overflow-x-auto">
        {imagens.map((imagem, i) => (
          <figure key={i} className="shrink-0">
            <button
              type="button"
              onClick={() => setAmpliada(i)}
              className="group relative block cursor-zoom-in overflow-hidden rounded-xl border border-borda"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imagem.url}
                alt={imagem.legenda ?? `Imagem clínica ${i + 1} da questão`}
                className="h-48 w-auto"
              />
              <span
                aria-hidden="true"
                className="absolute right-2 bottom-2 flex items-center gap-1 rounded-lg bg-contraste-fundo/80
                           px-2 py-1 text-[11px] text-contraste-texto opacity-0 backdrop-blur-sm transition-opacity
                           duration-200 group-hover:opacity-100"
              >
                <IconeExpandir className="size-3.5" />
                Ampliar
              </span>
            </button>
            {imagem.legenda && (
              <figcaption className="mt-2 text-center text-xs text-texto-suave">
                {imagem.legenda}
              </figcaption>
            )}
          </figure>
        ))}
      </div>

      {atual && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={atual.legenda ?? 'Imagem clínica ampliada'}
          onClick={() => setAmpliada(null)}
          className="fixed inset-0 z-50 flex cursor-zoom-out items-center justify-center
                     bg-[#0b1119]/80 p-4 backdrop-blur-sm"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={atual.url}
            alt={atual.legenda ?? 'Imagem clínica da questão, ampliada'}
            className="max-h-[90vh] max-w-full rounded-lg object-contain"
          />
        </div>
      )}
    </>
  )
}

/**
 * Os três apoios são independentes e opcionais — uma questão pode não ter
 * nenhum, ter só um, ou combinar os três.
 */
export function ApoioQuestao({
  tabelaDados,
  graficoSvg,
  imagens,
}: {
  tabelaDados: TabelaDados | null | undefined
  graficoSvg: string | null | undefined
  imagens: ImagemApoio[] | null | undefined
}) {
  if (!tabelaDados?.linhas?.length && !graficoSvg && !imagens?.length) return null

  return (
    <>
      <TabelaDadosQuestao tabela={tabelaDados} />
      <GraficoSvgQuestao svg={graficoSvg} />
      <ImagensQuestao imagens={imagens} />
    </>
  )
}

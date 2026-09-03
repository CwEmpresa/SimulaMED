/**
 * Aviso legal exigido no rodapé do produto. O texto é fixo por decisão jurídica —
 * não reescrever sem aprovação.
 */
export function AvisoConteudo({ className = '' }: { className?: string }) {
  return (
    <p className={`text-xs leading-relaxed text-texto-fraco ${className}`}>
      O material disponibilizado nesta plataforma tem finalidade exclusivamente educacional e
      de treino para exames de conhecimentos médicos (ENAMED/ENARE). Questões baseadas em
      provas anteriores têm sua fonte identificada (instituição, ano, número do caderno)
      quando aplicável. Esta plataforma é independente e não possui vínculo, afiliação,
      patrocínio ou endosso por parte do INEP, do MEC ou de qualquer instituição responsável
      pelos exames citados.
    </p>
  )
}

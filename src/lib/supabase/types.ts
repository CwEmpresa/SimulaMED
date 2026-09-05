// Gerado a partir do schema do Supabase (projeto reta-final-enamed).
// Para regenerar: supabase gen types typescript --project-id jwaarcrlhvtuydepwavk
// Não editar à mão.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      acesso_tentativas: {
        Row: {
          criado_em: string
          email: string
          id: string
          ip: string | null
        }
        Insert: {
          criado_em?: string
          email: string
          id?: string
          ip?: string | null
        }
        Update: {
          criado_em?: string
          email?: string
          id?: string
          ip?: string | null
        }
        Relationships: []
      }
      caderno_erros: {
        Row: {
          criado_em: string
          id: string
          origem: string
          questao_id: string
          usuario_id: string
        }
        Insert: {
          criado_em?: string
          id?: string
          origem: string
          questao_id: string
          usuario_id: string
        }
        Update: {
          criado_em?: string
          id?: string
          origem?: string
          questao_id?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "caderno_erros_questao_id_fkey"
            columns: ["questao_id"]
            isOneToOne: false
            referencedRelation: "gabaritos_liberados"
            referencedColumns: ["questao_id"]
          },
          {
            foreignKeyName: "caderno_erros_questao_id_fkey"
            columns: ["questao_id"]
            isOneToOne: false
            referencedRelation: "questoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "caderno_erros_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      compras: {
        Row: {
          criado_em: string
          email: string
          evento_id: string | null
          id: string
          payload_bruto: Json
          produto: string | null
          status: string
          usuario_id: string | null
        }
        Insert: {
          criado_em?: string
          email: string
          evento_id?: string | null
          id?: string
          payload_bruto: Json
          produto?: string | null
          status: string
          usuario_id?: string | null
        }
        Update: {
          criado_em?: string
          email?: string
          evento_id?: string | null
          id?: string
          payload_bruto?: Json
          produto?: string | null
          status?: string
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "compras_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      questoes: {
        Row: {
          alternativa_a: string
          alternativa_b: string
          alternativa_c: string
          alternativa_d: string
          ano_origem: number | null
          area: string
          comentario_correta: string | null
          comentario_erros: string | null
          criado_em: string
          dificuldade: string | null
          enunciado: string
          fonte: string | null
          grafico_svg: string | null
          id: string
          id_planilha: string | null
          imagens: Json | null
          numero_na_prova: number | null
          resposta_correta: string
          simulado_numero: number | null
          status: string
          subtema: string | null
          tabela_dados: Json | null
          tipo: string
        }
        Insert: {
          alternativa_a: string
          alternativa_b: string
          alternativa_c: string
          alternativa_d: string
          ano_origem?: number | null
          area: string
          comentario_correta?: string | null
          comentario_erros?: string | null
          criado_em?: string
          dificuldade?: string | null
          enunciado: string
          fonte?: string | null
          grafico_svg?: string | null
          id?: string
          id_planilha?: string | null
          imagens?: Json | null
          numero_na_prova?: number | null
          resposta_correta: string
          simulado_numero?: number | null
          status?: string
          subtema?: string | null
          tabela_dados?: Json | null
          tipo: string
        }
        Update: {
          alternativa_a?: string
          alternativa_b?: string
          alternativa_c?: string
          alternativa_d?: string
          ano_origem?: number | null
          area?: string
          comentario_correta?: string | null
          comentario_erros?: string | null
          criado_em?: string
          dificuldade?: string | null
          enunciado?: string
          fonte?: string | null
          grafico_svg?: string | null
          id?: string
          id_planilha?: string | null
          imagens?: Json | null
          numero_na_prova?: number | null
          resposta_correta?: string
          simulado_numero?: number | null
          status?: string
          subtema?: string | null
          tabela_dados?: Json | null
          tipo?: string
        }
        Relationships: []
      }
      respostas_banco: {
        Row: {
          alternativa_escolhida: string | null
          correta: boolean | null
          favorito: boolean
          id: string
          questao_id: string
          respondido_em: string
          usuario_id: string
        }
        Insert: {
          alternativa_escolhida?: string | null
          correta?: boolean | null
          favorito?: boolean
          id?: string
          questao_id: string
          respondido_em?: string
          usuario_id: string
        }
        Update: {
          alternativa_escolhida?: string | null
          correta?: boolean | null
          favorito?: boolean
          id?: string
          questao_id?: string
          respondido_em?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "respostas_banco_questao_id_fkey"
            columns: ["questao_id"]
            isOneToOne: false
            referencedRelation: "gabaritos_liberados"
            referencedColumns: ["questao_id"]
          },
          {
            foreignKeyName: "respostas_banco_questao_id_fkey"
            columns: ["questao_id"]
            isOneToOne: false
            referencedRelation: "questoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "respostas_banco_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      respostas_simulado: {
        Row: {
          alternativa_escolhida: string | null
          correta: boolean | null
          id: string
          marcada_para_revisao: boolean
          questao_id: string
          respondido_em: string
          tentativa_id: string
        }
        Insert: {
          alternativa_escolhida?: string | null
          correta?: boolean | null
          id?: string
          marcada_para_revisao?: boolean
          questao_id: string
          respondido_em?: string
          tentativa_id: string
        }
        Update: {
          alternativa_escolhida?: string | null
          correta?: boolean | null
          id?: string
          marcada_para_revisao?: boolean
          questao_id?: string
          respondido_em?: string
          tentativa_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "respostas_simulado_questao_id_fkey"
            columns: ["questao_id"]
            isOneToOne: false
            referencedRelation: "gabaritos_liberados"
            referencedColumns: ["questao_id"]
          },
          {
            foreignKeyName: "respostas_simulado_questao_id_fkey"
            columns: ["questao_id"]
            isOneToOne: false
            referencedRelation: "questoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "respostas_simulado_tentativa_id_fkey"
            columns: ["tentativa_id"]
            isOneToOne: false
            referencedRelation: "tentativas_com_prazo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "respostas_simulado_tentativa_id_fkey"
            columns: ["tentativa_id"]
            isOneToOne: false
            referencedRelation: "tentativas_simulado"
            referencedColumns: ["id"]
          },
        ]
      }
      tentativas_simulado: {
        Row: {
          finalizado_em: string | null
          id: string
          iniciado_em: string
          nota: number | null
          percentual_por_area: Json | null
          simulado_numero: number
          status: string
          tempo_usado_segundos: number | null
          usuario_id: string
        }
        Insert: {
          finalizado_em?: string | null
          id?: string
          iniciado_em?: string
          nota?: number | null
          percentual_por_area?: Json | null
          simulado_numero: number
          status?: string
          tempo_usado_segundos?: number | null
          usuario_id: string
        }
        Update: {
          finalizado_em?: string | null
          id?: string
          iniciado_em?: string
          nota?: number | null
          percentual_por_area?: Json | null
          simulado_numero?: number
          status?: string
          tempo_usado_segundos?: number | null
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tentativas_simulado_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      usuarios: {
        Row: {
          acesso_liberado_em: string | null
          criado_em: string
          email: string
          id: string
          nome: string | null
          onboarding_concluido_em: string | null
          recorde_combo: number
        }
        Insert: {
          acesso_liberado_em?: string | null
          criado_em?: string
          email: string
          id: string
          nome?: string | null
          onboarding_concluido_em?: string | null
          recorde_combo?: number
        }
        Update: {
          acesso_liberado_em?: string | null
          criado_em?: string
          email?: string
          id?: string
          nome?: string | null
          onboarding_concluido_em?: string | null
          recorde_combo?: number
        }
        Relationships: []
      }
    }
    Views: {
      gabaritos_liberados: {
        Row: {
          comentario_correta: string | null
          comentario_erros: string | null
          questao_id: string | null
          resposta_correta: string | null
        }
        Insert: {
          comentario_correta?: string | null
          comentario_erros?: string | null
          questao_id?: string | null
          resposta_correta?: string | null
        }
        Update: {
          comentario_correta?: string | null
          comentario_erros?: string | null
          questao_id?: string | null
          resposta_correta?: string | null
        }
        Relationships: []
      }
      respostas_simulado_detalhadas: {
        Row: {
          alternativa_escolhida: string | null
          correta: boolean | null
          questao_id: string | null
          respondido_em: string | null
          simulado_numero: number | null
          tentativa_id: string | null
          usuario_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "respostas_simulado_questao_id_fkey"
            columns: ["questao_id"]
            isOneToOne: false
            referencedRelation: "gabaritos_liberados"
            referencedColumns: ["questao_id"]
          },
          {
            foreignKeyName: "respostas_simulado_questao_id_fkey"
            columns: ["questao_id"]
            isOneToOne: false
            referencedRelation: "questoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "respostas_simulado_tentativa_id_fkey"
            columns: ["tentativa_id"]
            isOneToOne: false
            referencedRelation: "tentativas_com_prazo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "respostas_simulado_tentativa_id_fkey"
            columns: ["tentativa_id"]
            isOneToOne: false
            referencedRelation: "tentativas_simulado"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tentativas_simulado_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      tentativas_com_prazo: {
        Row: {
          finalizado_em: string | null
          id: string | null
          iniciado_em: string | null
          nota: number | null
          percentual_por_area: Json | null
          prazo_vencido: boolean | null
          segundos_restantes: number | null
          simulado_numero: number | null
          status: string | null
          tempo_usado_segundos: number | null
          usuario_id: string | null
        }
        Insert: {
          finalizado_em?: string | null
          id?: string | null
          iniciado_em?: string | null
          nota?: number | null
          percentual_por_area?: Json | null
          prazo_vencido?: never
          segundos_restantes?: never
          simulado_numero?: number | null
          status?: string | null
          tempo_usado_segundos?: number | null
          usuario_id?: string | null
        }
        Update: {
          finalizado_em?: string | null
          id?: string | null
          iniciado_em?: string | null
          nota?: number | null
          percentual_por_area?: Json | null
          prazo_vencido?: never
          segundos_restantes?: never
          simulado_numero?: number | null
          status?: string | null
          tempo_usado_segundos?: number | null
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tentativas_simulado_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      finalizar_tentativa: {
        Args: { p_tentativa_id: string }
        Returns: {
          acertos: number
          nota: number
          tempo_usado_segundos: number
        }[]
      }
      media_geral_plataforma: { Args: never; Returns: number }
      media_simulado: { Args: { p_simulado_numero: number }; Returns: number }
      registrar_recorde_combo: { Args: { p_combo: number }; Returns: number }
      responder_banco: {
        Args: { p_alternativa: string; p_questao_id: string }
        Returns: {
          acertou: boolean
          comentario_correta: string
          comentario_erros: string
          resposta_correta: string
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const

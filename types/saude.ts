/** Resumo diário normalizado — gravado em usuarios/{uid}.saude */
export type SaudeResumo = {
  passos?: number;
  kcalAtivas?: number;
  freqCardiacaMedia?: number;
  sonoMinutos?: number;
  atualizadoEm?: unknown;
  fontes?: {
    appleHealth?: boolean;
    healthConnect?: boolean;
    strava?: boolean;
  };
  stravaAthleteId?: string;
  stravaNome?: string;
  /** Resumo do dia via Strava (treinos — não traz passos/sono do dia a dia). */
  stravaAtividadesHoje?: number;
  stravaKmHoje?: number;
  stravaMinutosHoje?: number;
  stravaKcalHoje?: number;
  /** Treinos de hoje (amostra para a UI). */
  stravaAtividadesLista?: StravaAtividadeResumo[];
};

export type StravaAtividadeResumo = {
  id?: string;
  nome: string;
  tipo: string;
  km: number;
  minutos: number;
  kcal: number;
  /** HH:mm local */
  horario?: string;
};

export type FonteSaude = 'appleHealth' | 'healthConnect' | 'strava';

export type MetricasDispositivo = {
  passos: number | null;
  kcalAtivas: number | null;
  freqCardiacaMedia: number | null;
  sonoMinutos: number | null;
};

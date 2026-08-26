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
};

export type FonteSaude = 'appleHealth' | 'healthConnect' | 'strava';

export type MetricasDispositivo = {
  passos: number | null;
  kcalAtivas: number | null;
  freqCardiacaMedia: number | null;
  sonoMinutos: number | null;
};

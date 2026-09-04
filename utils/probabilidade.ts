/**
 * Chance de vitória estilo apps de tênis/padel (Playtomic / UTR simplificado):
 * logistic sobre diferença de win rate + ajuste leve de H2H e nível.
 */

const NIVEL_SCORE: Record<string, number> = {
  iniciante: 1,
  intermediario: 2,
  avancado: 3,
  profissional: 4,
  Iniciante: 1,
  Intermediário: 2,
  Avançado: 3,
  Profissional: 4,
};

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function winRate(v: number, d: number): number {
  const t = v + d;
  if (t === 0) return 0.5;
  // Shrinkage bayesiano (evita 100% com 1 jogo) — comum em ranking amador
  return (v + 2) / (t + 4);
}

export function calcularProbabilidadeVitoria(input: {
  vitoriasA: number;
  derrotasA: number;
  vitoriasB: number;
  derrotasB: number;
  nivelA?: string;
  nivelB?: string;
  /** Vitórias de A no H2H */
  h2hA?: number;
  h2hB?: number;
}): number {
  const wrA = winRate(input.vitoriasA, input.derrotasA);
  const wrB = winRate(input.vitoriasB, input.derrotasB);
  let score = (wrA - wrB) * 3.2;

  const nA = NIVEL_SCORE[input.nivelA ?? ''] ?? 2;
  const nB = NIVEL_SCORE[input.nivelB ?? ''] ?? 2;
  score += (nA - nB) * 0.35;

  const hA = input.h2hA ?? 0;
  const hB = input.h2hB ?? 0;
  const hTot = hA + hB;
  if (hTot > 0) {
    score += ((hA - hB) / hTot) * 0.55;
  }

  const p = 1 / (1 + Math.exp(-score));
  return Math.round(clamp(p * 100, 8, 92));
}

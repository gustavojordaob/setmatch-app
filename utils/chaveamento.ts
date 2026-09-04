/** Padrão mercado (UTR / clubes): chave single-elim com bye até potência de 2. */

export function proximaPotenciaDe2(n: number): number {
  if (n <= 1) return 2;
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

export function shuffleFisherYates<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function nomeRodada(round: number, totalRounds: number): string {
  const restante = totalRounds - round + 1;
  if (restante === 1) return 'Final';
  if (restante === 2) return 'Semifinal';
  if (restante === 3) return 'Quartas';
  if (restante === 4) return 'Oitavas';
  return `Rodada ${round}`;
}

export type SlotInscrito = {
  uid: string;
  nome: string;
  fotoUrl?: string;
};

/** Distribui jogadores + byes nos slots (estilo chave de clube). */
export function montarSlotsComByes(
  inscritos: SlotInscrito[],
  tamanhoChave: number,
  sortear: boolean
): (SlotInscrito | null)[] {
  const size = Math.max(proximaPotenciaDe2(inscritos.length), tamanhoChave);
  const power = proximaPotenciaDe2(Math.max(inscritos.length, 2));
  const finalSize = Math.max(size, power);
  const ordered = sortear ? shuffleFisherYates(inscritos) : [...inscritos];
  const slots: (SlotInscrito | null)[] = Array.from({ length: finalSize }, () => null);
  ordered.forEach((p, i) => {
    if (i < finalSize) slots[i] = p;
  });
  return slots;
}

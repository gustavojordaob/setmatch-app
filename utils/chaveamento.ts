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
  parceiroUid?: string;
  parceiroNome?: string;
  parceiroFoto?: string;
};

/**
 * Posições clássicas de cabeça de chave (índices 0-based no draw).
 * Ex.: tamanho 8 → seeds em 0, 7, 4, 3…
 */
export function posicoesCabecaDeChave(tamanho: number, qtd: number): number[] {
  if (tamanho < 2 || qtd <= 0) return [];
  const n = Math.min(qtd, tamanho);
  const candidates = [
    0,
    tamanho - 1,
    Math.floor(tamanho / 2),
    Math.floor(tamanho / 2) - 1,
  ];
  for (let step = 4; step < tamanho; step *= 2) {
    for (let i = 0; i < step; i++) {
      candidates.push(Math.floor(((i * 2 + 1) * tamanho) / (step * 2)));
    }
  }
  const out: number[] = [];
  const used = new Set<number>();
  for (const raw of candidates) {
    if (out.length >= n) break;
    const idx = ((raw % tamanho) + tamanho) % tamanho;
    if (used.has(idx)) continue;
    used.add(idx);
    out.push(idx);
  }
  for (let i = 0; i < tamanho && out.length < n; i++) {
    if (!used.has(i)) {
      used.add(i);
      out.push(i);
    }
  }
  return out;
}

/** Distribui jogadores + byes; cabeças ocupam posições de seed. */
export function montarSlotsComByes(
  inscritos: SlotInscrito[],
  tamanhoChave: number,
  sortear: boolean,
  cabecasUids?: string[]
): (SlotInscrito | null)[] {
  const power = proximaPotenciaDe2(Math.max(inscritos.length, 2));
  const finalSize = Math.max(proximaPotenciaDe2(Math.max(inscritos.length, tamanhoChave)), power);
  const slots: (SlotInscrito | null)[] = Array.from({ length: finalSize }, () => null);

  const cabecaSet = new Set((cabecasUids ?? []).filter(Boolean));
  const cabecas = (cabecasUids ?? [])
    .map((uid) => inscritos.find((p) => p.uid === uid))
    .filter((p): p is SlotInscrito => !!p);
  const resto = inscritos.filter((p) => !cabecaSet.has(p.uid));
  const orderedResto = sortear ? shuffleFisherYates(resto) : [...resto];

  const seedPos = posicoesCabecaDeChave(finalSize, cabecas.length);
  cabecas.forEach((p, i) => {
    const idx = seedPos[i];
    if (idx != null) slots[idx] = p;
  });

  let ri = 0;
  for (let i = 0; i < finalSize && ri < orderedResto.length; i++) {
    if (slots[i] == null) {
      slots[i] = orderedResto[ri++];
    }
  }
  return slots;
}

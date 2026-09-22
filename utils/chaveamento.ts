/** Padrão mercado (UTR / clubes): chave single-elim com bye até potência de 2. */

export function proximaPotenciaDe2(n: number): number {
  if (n <= 1) return 2;
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

export function tamanhoChaveEfetivo(
  nInscritos: number,
  estruturaMata?: number
): number {
  return proximaPotenciaDe2(Math.max(nInscritos, estruturaMata ?? 2, 2));
}

export function qtdByesNecessarios(
  nInscritos: number,
  estruturaMata?: number
): number {
  const t = tamanhoChaveEfetivo(nInscritos, estruturaMata);
  return Math.max(0, t - nInscritos);
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

/**
 * Índices de slot preferidos para quem recebe bye (sozinho no jogo R1).
 * Coloca o jogador em 2*m e deixa 2*m+1 vazio.
 */
function posicoesByePreferidas(tamanho: number, qtd: number): number[] {
  const matches = tamanho / 2;
  const order: number[] = [];
  // Prioriza confrontos das pontas (onde costumam cair byes de seed)
  for (let m = 0; m < matches; m++) order.push(m);
  order.sort((a, b) => {
    const da = Math.min(a, matches - 1 - a);
    const db = Math.min(b, matches - 1 - b);
    return da - db;
  });
  return order.slice(0, qtd).map((m) => m * 2);
}

/**
 * Distribui jogadores + byes; cabeças ocupam posições de seed.
 * `byeUids` (opcional) = quem o admin quer com bye na 1ª rodada.
 */
export function montarSlotsComByes(
  inscritos: SlotInscrito[],
  tamanhoChave: number,
  sortear: boolean,
  cabecasUids?: string[],
  byeUids?: string[]
): (SlotInscrito | null)[] {
  const finalSize = tamanhoChaveEfetivo(inscritos.length, tamanhoChave);
  const slots: (SlotInscrito | null)[] = Array.from({ length: finalSize }, () => null);
  const nByes = Math.max(0, finalSize - inscritos.length);

  const byUid = new Map(inscritos.map((p) => [p.uid, p]));
  const cabecaSet = new Set((cabecasUids ?? []).filter((u) => byUid.has(u)));
  const byeSet = new Set(
    (byeUids ?? []).filter((u) => byUid.has(u)).slice(0, nByes)
  );

  const cabecas = (cabecasUids ?? [])
    .map((uid) => byUid.get(uid))
    .filter((p): p is SlotInscrito => !!p);

  // 1) Cabeças nas posições clássicas
  const seedPos = posicoesCabecaDeChave(finalSize, cabecas.length);
  cabecas.forEach((p, i) => {
    const idx = seedPos[i];
    if (idx != null) slots[idx] = p;
  });

  // 2) Quem recebe bye: sozinho no confronto (slot par livre + ímpar vazio)
  const reservedEmpty = new Set<number>();
  const byePlayers = [...byeSet]
    .map((uid) => byUid.get(uid))
    .filter((p): p is SlotInscrito => !!p);

  const byeSlots = posicoesByePreferidas(finalSize, byePlayers.length);
  byePlayers.forEach((p, i) => {
    // Se já está em um slot (cabeça), garante parceiro vazio
    const atual = slots.findIndex((s) => s?.uid === p.uid);
    if (atual >= 0) {
      const match = Math.floor(atual / 2);
      const partner = atual % 2 === 0 ? match * 2 + 1 : match * 2;
      if (slots[partner] && slots[partner]!.uid !== p.uid) {
        // empurra parceiro para outro lugar depois
        slots[partner] = null;
      }
      reservedEmpty.add(partner);
      return;
    }
    const prefer = byeSlots[i] ?? i * 2;
    let placed = false;
    for (const start of [prefer, ...byeSlots, ...Array.from({ length: finalSize }, (_, x) => x)]) {
      const match = Math.floor(start / 2);
      const a = match * 2;
      const b = match * 2 + 1;
      if (slots[a] == null && slots[b] == null && !reservedEmpty.has(a) && !reservedEmpty.has(b)) {
        slots[a] = p;
        reservedEmpty.add(b);
        placed = true;
        break;
      }
    }
    if (!placed) {
      // fallback: primeiro slot vazio
      const idx = slots.findIndex((s, si) => s == null && !reservedEmpty.has(si));
      if (idx >= 0) {
        slots[idx] = p;
        const partner = idx % 2 === 0 ? idx + 1 : idx - 1;
        if (partner >= 0 && partner < finalSize) reservedEmpty.add(partner);
      }
    }
  });

  // 3) Demais jogadores
  const usados = new Set(
    slots.filter((s): s is SlotInscrito => !!s).map((s) => s.uid)
  );
  const resto = inscritos.filter((p) => !usados.has(p.uid));
  const orderedResto = sortear ? shuffleFisherYates(resto) : [...resto];

  let ri = 0;
  for (let i = 0; i < finalSize && ri < orderedResto.length; i++) {
    if (slots[i] == null && !reservedEmpty.has(i)) {
      slots[i] = orderedResto[ri++];
    }
  }
  // se ainda sobrou (reserved demais), preenche reserved vazios
  for (let i = 0; i < finalSize && ri < orderedResto.length; i++) {
    if (slots[i] == null) {
      slots[i] = orderedResto[ri++];
    }
  }

  return slots;
}

/**
 * Montagem 100% manual: array de uids (null = bye) no tamanho da chave.
 * Valida: cada uid no máximo 1x; todos inscritos presentes.
 */
export function montarSlotsManuais(
  inscritos: SlotInscrito[],
  slotsUids: (string | null)[]
): (SlotInscrito | null)[] {
  const finalSize = tamanhoChaveEfetivo(inscritos.length, slotsUids.length);
  if (slotsUids.length !== finalSize) {
    throw new Error(
      `A chave precisa de ${finalSize} posições (hoje: ${slotsUids.length}).`
    );
  }
  const byUid = new Map(inscritos.map((p) => [p.uid, p]));
  const seen = new Set<string>();
  const slots: (SlotInscrito | null)[] = slotsUids.map((uid) => {
    if (!uid) return null;
    if (seen.has(uid)) throw new Error('Jogador repetido na chave.');
    const p = byUid.get(uid);
    if (!p) throw new Error('Jogador inválido na chave.');
    seen.add(uid);
    return p;
  });
  for (const p of inscritos) {
    if (!seen.has(p.uid)) {
      throw new Error(`${p.nome} não foi colocado na chave.`);
    }
  }
  return slots;
}

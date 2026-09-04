/** Helpers de exibição para times de dupla (rótulo "A / B"). */

export function splitDuplaLabel(nome?: string | null): { a: string; b?: string } {
  const raw = (nome ?? '').trim();
  if (!raw) return { a: 'Jogador' };
  const parts = raw.split(/\s*\/\s*/).map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) return { a: parts[0], b: parts.slice(1).join(' / ') };
  return { a: raw };
}

export function labelDupla(nomeA: string, nomeB?: string | null): string {
  const a = nomeA.trim() || 'Jogador';
  const b = (nomeB ?? '').trim();
  return b ? `${a} / ${b}` : a;
}

export function isDuplaLabel(nome?: string | null): boolean {
  return Boolean(nome && /\s*\/\s*/.test(nome));
}

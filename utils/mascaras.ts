/** Máscaras de digitação BR (só dígitos → formatação). */

/** DD/MM/AAAA — digita só números. */
export function maskDateBR(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}

/** HH:MM — digita só números. */
export function maskTimeHHMM(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 4);
  if (d.length <= 2) return d;
  return `${d.slice(0, 2)}:${d.slice(2)}`;
}

export function isDateBRCompleta(v: string): boolean {
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(v)) return false;
  const [dd, mm, yyyy] = v.split('/').map(Number);
  const d = new Date(yyyy, mm - 1, dd);
  return d.getFullYear() === yyyy && d.getMonth() === mm - 1 && d.getDate() === dd;
}

/**
 * Moeda pt-BR na digitação: só dígitos → "1.234,56" (centavos pela direita).
 * Máx. ~R$ 99.999.999,99
 */
export function maskMoneyBR(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 10);
  if (!digits) return '';
  const cents = Number(digits);
  const reais = Math.floor(cents / 100);
  const c = cents % 100;
  return `${reais.toLocaleString('pt-BR')},${String(c).padStart(2, '0')}`;
}

/** Número → string de input mascarada ("80,00"). */
export function toMoneyInputBR(n: number): string {
  const cents = Math.round((Number(n) || 0) * 100);
  if (!Number.isFinite(cents) || cents < 0) return '';
  return maskMoneyBR(String(cents));
}

/** "1.234,56" | "1234,56" | "1234.56" → number. */
export function parseMoneyBR(masked: string): number {
  const t = String(masked ?? '').trim();
  if (!t) return 0;
  let normalized = t;
  if (t.includes(',')) {
    normalized = t.replace(/\./g, '').replace(',', '.');
  }
  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
}

/** Exibição: R$ 1.234,56 (pt-BR). */
export function formatMoneyBR(
  value: number | string | null | undefined,
  opts?: { withSymbol?: boolean }
): string {
  const n = typeof value === 'string' ? parseMoneyBR(value) : Number(value);
  const safe = Number.isFinite(n) ? n : 0;
  const formatted = safe.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return opts?.withSymbol === false ? formatted : `R$ ${formatted}`;
}

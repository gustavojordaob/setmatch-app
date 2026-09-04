/** Desconto 0–100% e preço final (arredonda 2 casas). */

export function clampDescontoPercent(p?: number | null): number {
  const n = Number(p);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(100, Math.max(0, n));
}

export function valorComDesconto(valorBase: number, descontoPercent?: number | null): number {
  const base = Math.max(0, Number(valorBase) || 0);
  const d = clampDescontoPercent(descontoPercent);
  if (d <= 0) return Math.round(base * 100) / 100;
  return Math.round(base * (1 - d / 100) * 100) / 100;
}

export type MeioPagamento = 'pix' | 'cartao';

export type RegrasPrecoPagamento = {
  valor: number;
  permitePix?: boolean;
  permiteCartao?: boolean;
  /** % off no PIX (ex.: 10 = 10% mais barato no PIX) */
  descontoPixPercent?: number;
  /** % off no cartão */
  descontoCartaoPercent?: number;
  ciclo?: 'unico' | 'mensal';
};

export function precoPorMeio(
  regras: RegrasPrecoPagamento,
  meio: MeioPagamento
): { valorFinal: number; descontoPercent: number; valorBase: number } {
  const valorBase = Number(regras.valor) || 0;
  const descontoPercent =
    meio === 'pix'
      ? clampDescontoPercent(regras.descontoPixPercent)
      : clampDescontoPercent(regras.descontoCartaoPercent);
  return {
    valorBase,
    descontoPercent,
    valorFinal: valorComDesconto(valorBase, descontoPercent),
  };
}

export function textoPromoMeio(regras: RegrasPrecoPagamento): string {
  const parts: string[] = [];
  const pix = clampDescontoPercent(regras.descontoPixPercent);
  const card = clampDescontoPercent(regras.descontoCartaoPercent);
  if (regras.permitePix !== false && pix > 0) {
    parts.push(`PIX −${pix}% → R$ ${valorComDesconto(regras.valor, pix).toFixed(2)}`);
  }
  if (regras.permiteCartao !== false && card > 0) {
    parts.push(`Cartão −${card}% → R$ ${valorComDesconto(regras.valor, card).toFixed(2)}`);
  }
  return parts.join(' · ');
}

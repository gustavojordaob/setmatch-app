export function calcularProbabilidade(
  vitoriasA: number,
  derrotasA: number,
  vitoriasB: number,
  derrotasB: number
): number {
  const taxaA = vitoriasA / Math.max(vitoriasA + derrotasA, 1);
  const taxaB = vitoriasB / Math.max(vitoriasB + derrotasB, 1);
  const soma = taxaA + taxaB;
  if (soma === 0) return 50;
  return Math.round((taxaA / soma) * 100);
}

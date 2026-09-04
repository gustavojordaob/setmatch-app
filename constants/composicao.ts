import type { EsporteId } from './esportes';

/** Simples (1 jogador) ou dupla (2 jogadores = 1 unidade na chave/ranking). */
export type ComposicaoId = 'simples' | 'dupla';

export function composicaoPadraoPorEsporte(esporte: EsporteId): ComposicaoId {
  if (esporte === 'tenis') return 'simples';
  return 'dupla';
}

export function labelComposicao(c: ComposicaoId): string {
  return c === 'dupla' ? 'Duplas' : 'Simples';
}

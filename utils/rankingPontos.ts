import {
  normalizarRegrasJogo,
  type RankingRegrasJogo,
} from '../types/ranking';
import { labelFormatoRanking, labelModeloRanking } from '../types/ranking';

/** Games cedidos pelo vencedor nos sets (ex.: 6-0 6-1 → 1). */
export function gamesPerdidosPeloVencedor(
  sets: { j1: number; j2: number }[],
  vencedorEhJ1: boolean
): number {
  return sets.reduce((acc, s) => {
    const meus = vencedorEhJ1 ? s.j1 : s.j2;
    const deles = vencedorEhJ1 ? s.j2 : s.j1;
    if (meus < deles) return acc + meus;
    return acc + deles;
  }, 0);
}

/**
 * Quem joga pontua sempre.
 * - Perdedor: ptsParticipacao
 * - Vencedor: ptsJogoCompleto − games cedidos (+ ptsParticipacao se ligado)
 */
export function calcularPtsRanking(
  sets: { j1: number; j2: number }[],
  vencedorUid: string,
  j1Uid: string,
  regras?: Partial<RankingRegrasJogo> | null
): { ptsVencedor: number; ptsPerdedor: number } {
  const r = normalizarRegrasJogo(regras);
  const vencedorEhJ1 = vencedorUid === j1Uid;
  const cedidos = gamesPerdidosPeloVencedor(sets, vencedorEhJ1);
  const baseVitoria = Math.max(0, r.ptsJogoCompleto - cedidos);
  const bonus = Math.max(0, r.ptsParticipacao);
  const ptsVencedor = baseVitoria + (r.participacaoTambemVencedor ? bonus : 0);
  const ptsPerdedor = bonus;
  return { ptsVencedor, ptsPerdedor };
}

export function resumoRegrasJogo(regras?: Partial<RankingRegrasJogo> | null): string {
  const r = normalizarRegrasJogo(regras);
  const linhas = [
    `${labelModeloRanking(r.modelo)} · ${labelFormatoRanking(r.formatoPartidaId)}`,
    `${r.jogosPorMes} jogo(s)/mês · ${r.enfrentaAcima}↑ ${r.enfrentaAbaixo}↓`,
    `Vitória limpa ${r.ptsJogoCompleto} pts (−1/game) · jogar +${r.ptsParticipacao}`,
  ];
  if (r.modelo === 'grupos' && r.qtdGrupos) {
    linhas.push(`${r.qtdGrupos} grupos × ${r.jogadoresPorGrupo ?? '?'} jogadores`);
  }
  if (r.textoLivre?.trim()) linhas.push(r.textoLivre.trim());
  return linhas.join('\n');
}

import { Platform, Share } from 'react-native';
import { getShareBaseUrl } from './compartilharTorneio';

export function linkExternoRanking(rankingId: string): string {
  const base = getShareBaseUrl();
  return `${base}/abrir/ranking?id=${encodeURIComponent(rankingId)}`;
}

export function deepLinkRanking(rankingId: string): string {
  return `setmatch://ranking/${rankingId}`;
}

export async function compartilharRankingFora(input: {
  rankingId: string;
  nome: string;
  clubeNome: string;
}): Promise<void> {
  const link = linkExternoRanking(input.rankingId);
  const mensagem =
    `Ranking ${input.nome} · ${input.clubeNome}\n\n` +
    `Abra no Rally Up (só pelo app):\n${link}`;

  await Share.share({
    message: mensagem,
    title: input.nome,
    url: Platform.OS === 'ios' ? link : undefined,
  });
}

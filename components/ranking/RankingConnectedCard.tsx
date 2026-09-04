import { RankingCard } from './RankingCard';
import { useClassificacao } from '../../hooks/useRankings';
import type { Ranking } from '../../types/ranking';

interface Props {
  ranking: Ranking;
  pinned?: boolean;
  onVerMais?: () => void;
  onConfrontos?: () => void;
}

/** Card de ranking já conectado à subcoleção classificacao/{uid}. */
export function RankingConnectedCard({
  ranking,
  pinned,
  onVerMais,
  onConfrontos,
}: Props) {
  const { rows } = useClassificacao(ranking.id);

  const mapped = rows.slice(0, 5).map((r) => ({
    id: r.uid,
    nome: r.nome,
    pts: r.pts,
  }));

  return (
    <RankingCard
      title={ranking.nome}
      subtitle={ranking.clubeNome}
      rows={mapped}
      pinned={pinned}
      logoUrl={ranking.clubeLogoUrl}
      badge={ranking.clubeNome.charAt(0).toUpperCase()}
      onVerMais={onVerMais}
      onConfrontos={onConfrontos}
    />
  );
}

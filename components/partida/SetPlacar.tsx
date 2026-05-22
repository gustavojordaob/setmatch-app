import { StyleSheet, Text, View } from 'react-native';
import { Colors } from '../../constants/colors';
import type { SetPlacar as SetPlacarType } from '../../hooks/usePartidas';

export interface SetPlacarProps {
  index: number;
  placar: SetPlacarType;
  /** true se o jogador da esquerda (j1) é o usuário logado */
  viewerIsJ1: boolean;
}

export function SetPlacar({ index, placar, viewerIsJ1 }: SetPlacarProps) {
  const j1Won = placar.j1 > placar.j2;
  const j2Won = placar.j2 > placar.j1;
  const viewerWonSet = viewerIsJ1 ? j1Won : j2Won;
  const opponentWonSet = viewerIsJ1 ? j2Won : j1Won;

  const leftScore = viewerIsJ1 ? placar.j1 : placar.j2;
  const rightScore = viewerIsJ1 ? placar.j2 : placar.j1;

  return (
    <View style={styles.row}>
      <Text style={styles.setLabel}>Set {index + 1}</Text>
      <View style={styles.scores}>
        <Text
          style={[
            styles.score,
            viewerWonSet && styles.scoreWin,
            !viewerWonSet && !opponentWonSet && styles.scoreTie,
          ]}
        >
          {leftScore}
        </Text>
        <Text style={styles.sep}>×</Text>
        <Text
          style={[
            styles.score,
            opponentWonSet && styles.scoreWin,
            !viewerWonSet && !opponentWonSet && styles.scoreTie,
          ]}
        >
          {rightScore}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  setLabel: {
    color: Colors.textSecondary,
    fontWeight: '600',
    fontSize: 13,
  },
  scores: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  score: {
    color: Colors.textSecondary,
    fontWeight: '700',
    fontSize: 16,
    minWidth: 24,
    textAlign: 'center',
  },
  scoreWin: {
    color: Colors.accent,
    fontWeight: '900',
    fontSize: 18,
  },
  scoreTie: {
    color: Colors.textPrimary,
  },
  sep: {
    color: Colors.textSecondary,
    fontWeight: '600',
  },
});

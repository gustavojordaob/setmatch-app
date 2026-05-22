import { StyleSheet, Text, View } from 'react-native';
import { Colors } from '../../constants/colors';
import type { Partida } from '../../hooks/usePartidas';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { SetPlacar } from './SetPlacar';

export interface ResultadoCardProps {
  partida: Partida;
  uid: string;
}

export function ResultadoCard({ partida, uid }: ResultadoCardProps) {
  const venceu = partida.vencedor === uid;
  const viewerIsJ1 = partida.jogador1 === uid;

  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.esporte}>{partida.esporte}</Text>
        <Badge label={venceu ? 'Vitória' : 'Derrota'} variant={venceu ? 'vitoria' : 'derrota'} />
      </View>
      <Text style={styles.quadra}>{partida.quadra}</Text>
      {partida.sets.map((s, i) => (
        <SetPlacar key={i} index={i} placar={s} viewerIsJ1={viewerIsJ1} />
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  esporte: {
    color: Colors.textPrimary,
    fontWeight: '800',
    textTransform: 'capitalize',
  },
  quadra: {
    color: Colors.textSecondary,
    marginBottom: 8,
  },
});

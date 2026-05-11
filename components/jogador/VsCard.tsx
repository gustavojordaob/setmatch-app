import { StyleSheet, Text, View } from 'react-native';
import { Colors } from '../../constants/colors';
import { Card } from '../ui/Card';
import { Avatar } from '../ui/Avatar';

export interface VsCardProps {
  nomeA: string;
  fotoA?: string | null;
  nomeB: string;
  fotoB?: string | null;
  probabilidadeA: number;
}

export function VsCard({ nomeA, fotoA, nomeB, fotoB, probabilidadeA }: VsCardProps) {
  return (
    <Card>
      <View style={styles.row}>
        <View style={styles.side}>
          <Avatar uri={fotoA} nome={nomeA} size={56} />
          <Text style={styles.nome} numberOfLines={1}>
            {nomeA}
          </Text>
        </View>
        <Text style={styles.vs}>VS</Text>
        <View style={styles.side}>
          <Avatar uri={fotoB} nome={nomeB} size={56} />
          <Text style={styles.nome} numberOfLines={1}>
            {nomeB}
          </Text>
        </View>
      </View>
      <Text style={styles.prob}>
        Chance de vitória ({nomeA.split(' ')[0]}): {probabilidadeA}%
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  side: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
  },
  nome: {
    color: Colors.textPrimary,
    fontWeight: '700',
    textAlign: 'center',
  },
  vs: {
    color: Colors.secondary,
    fontWeight: '900',
    fontSize: 18,
  },
  prob: {
    marginTop: 14,
    textAlign: 'center',
    color: Colors.textSecondary,
    fontWeight: '600',
  },
});

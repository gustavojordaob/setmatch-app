import { StyleSheet, Text, View } from 'react-native';
import { Colors } from '../../constants/colors';

type Props = {
  count: number;
  /** Bolinha sem número quando count > 0 */
  dotOnly?: boolean;
};

/** Badge de não lidas — some se count <= 0. */
export function UnreadBadge({ count, dotOnly }: Props) {
  if (!count || count <= 0) return null;
  if (dotOnly) {
    return <View style={styles.dot} />;
  }
  const label = count > 99 ? '99+' : String(count);
  return (
    <View style={styles.badge}>
      <Text style={styles.txt}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  txt: { color: Colors.white, fontSize: 10, fontWeight: 'bold' },
  dot: {
    position: 'absolute',
    top: 8,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.accent,
  },
});

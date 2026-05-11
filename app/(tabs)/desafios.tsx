import { FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../constants/colors';
import { Card } from '../../components/ui/Card';
import { useDesafios } from '../../hooks/useDesafios';

export default function DesafiosScreen() {
  const { desafios, loading } = useDesafios();

  return (
    <SafeAreaView style={styles.safe}>
      <Text style={styles.title}>Desafios</Text>
      <FlatList
        data={desafios}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={styles.empty}>
            {loading ? 'Carregando…' : 'Nenhum desafio ainda.'}
          </Text>
        }
        renderItem={({ item }) => (
          <Card style={styles.card}>
            <Text style={styles.esporte}>{item.esporte}</Text>
            <Text style={styles.meta}>Quadra sugerida: {item.quadra}</Text>
            <Text style={styles.status}>Status: {item.status}</Text>
          </Card>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background, paddingHorizontal: 16 },
  title: {
    color: Colors.textPrimary,
    fontSize: 26,
    fontWeight: '900',
    marginBottom: 12,
  },
  list: { paddingBottom: 24, gap: 10 },
  card: { marginBottom: 4 },
  esporte: { color: Colors.secondary, fontWeight: '900', textTransform: 'capitalize' },
  meta: { color: Colors.textSecondary, marginTop: 6 },
  status: { color: Colors.textPrimary, marginTop: 8, fontWeight: '700' },
  empty: { color: Colors.textSecondary, textAlign: 'center', marginTop: 32 },
});

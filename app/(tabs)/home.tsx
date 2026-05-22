import { useMemo, useState } from 'react';
import {
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../constants/colors';
import { Radius } from '../../constants/radius';
import { Typography } from '../../constants/typography';
import { Avatar } from '../../components/ui/Avatar';
import { Card } from '../../components/ui/Card';
import { ResultadoCard } from '../../components/partida/ResultadoCard';
import { useAuth } from '../../hooks/useAuth';
import { usePartidas } from '../../hooks/usePartidas';

type TabKey = 'resultados' | 'proximas';

export default function HomeScreen() {
  const { user, perfil } = useAuth();
  const { partidas, loading } = usePartidas();
  const [aba, setAba] = useState<TabKey>('resultados');

  const record = useMemo(() => {
    const v = perfil?.vitorias ?? 0;
    const d = perfil?.derrotas ?? 0;
    return `${v}xV - ${d}xD`;
  }, [perfil?.vitorias, perfil?.derrotas]);

  const nome = perfil?.nome ?? user?.displayName ?? 'Jogador';

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Avatar uri={perfil?.fotoUrl ?? user?.photoURL} nome={nome} size="md" />
        <View style={styles.headerText}>
          <Text style={styles.hello}>Olá,</Text>
          <Text style={styles.nome} numberOfLines={1}>
            {nome}
          </Text>
          <Text style={styles.record}>{record}</Text>
        </View>
      </View>

      <View style={styles.toggleRow}>
        <TouchableOpacity
          onPress={() => setAba('resultados')}
          style={[styles.toggleBtn, aba === 'resultados' && styles.toggleOn]}
        >
          <Text style={[styles.toggleTxt, aba === 'resultados' && styles.toggleTxtOn]}>
            Resultados
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setAba('proximas')}
          style={[styles.toggleBtn, aba === 'proximas' && styles.toggleOn]}
        >
          <Text style={[styles.toggleTxt, aba === 'proximas' && styles.toggleTxtOn]}>
            Próximas
          </Text>
        </TouchableOpacity>
      </View>

      {aba === 'resultados' ? (
        <FlatList
          data={partidas}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <Text style={styles.empty}>
              {loading ? 'Carregando partidas…' : 'Nenhuma partida registrada ainda.'}
            </Text>
          }
          renderItem={({ item }) =>
            user ? <ResultadoCard partida={item} uid={user.uid} /> : null
          }
        />
      ) : (
        <View style={styles.proximas}>
          <Card>
            <Text style={styles.feedTitle}>Próximas partidas</Text>
            <Text style={styles.empty}>Sem partidas agendadas no momento.</Text>
          </Card>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background, paddingHorizontal: 16 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  headerText: { flex: 1 },
  hello: { color: Colors.textSecondary, fontWeight: '600' },
  nome: { ...Typography.userName, color: Colors.textPrimary, fontSize: 26 },
  record: { ...Typography.score, color: Colors.accent, marginTop: 2 },
  toggleRow: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: Radius.chip,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 4,
    marginBottom: 12,
  },
  toggleBtn: { flex: 1, paddingVertical: 10, borderRadius: Radius.chip, alignItems: 'center' },
  toggleOn: { backgroundColor: Colors.primary },
  toggleTxt: { color: Colors.textSecondary, fontWeight: '800' },
  toggleTxtOn: { color: Colors.accent },
  list: { paddingBottom: 24 },
  proximas: { flex: 1 },
  feedTitle: { color: Colors.textPrimary, fontWeight: '900', marginBottom: 8 },
  empty: { color: Colors.textSecondary, textAlign: 'center', marginTop: 12 },
});

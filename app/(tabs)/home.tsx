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
    return `${v}V - ${d}D`;
  }, [perfil?.vitorias, perfil?.derrotas]);

  const nome = perfil?.nome ?? user?.displayName ?? 'Jogador';

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Avatar uri={perfil?.fotoUrl ?? user?.photoURL} nome={nome} size={52} />
        <View style={styles.headerText}>
          <Text style={styles.hello}>Olá,</Text>
          <Text style={styles.nome} numberOfLines={1}>
            {nome}
          </Text>
          <Text style={styles.record}>{record}</Text>
        </View>
      </View>

      <Card style={styles.feedCard}>
        <Text style={styles.feedTitle}>Novidades</Text>
        <Text style={styles.feedBody}>
          MVP Setmatch: desafie jogadores, registre sets e acompanhe seu histórico.
        </Text>
      </Card>

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
          <Text style={styles.empty}>Sem partidas agendadas no MVP.</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background, paddingHorizontal: 16 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  headerText: { flex: 1 },
  hello: { color: Colors.textSecondary, fontWeight: '600' },
  nome: { color: Colors.textPrimary, fontSize: 22, fontWeight: '900' },
  record: { color: Colors.secondary, fontWeight: '800', marginTop: 2 },
  feedCard: { marginBottom: 14 },
  feedTitle: { color: Colors.textPrimary, fontWeight: '900', marginBottom: 6 },
  feedBody: { color: Colors.textSecondary, lineHeight: 20 },
  toggleRow: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 4,
    marginBottom: 12,
  },
  toggleBtn: { flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center' },
  toggleOn: { backgroundColor: Colors.primary },
  toggleTxt: { color: Colors.textSecondary, fontWeight: '800' },
  toggleTxtOn: { color: Colors.secondary },
  list: { paddingBottom: 24, gap: 0 },
  proximas: { flex: 1, paddingTop: 12 },
  empty: { color: Colors.textSecondary, textAlign: 'center', marginTop: 24 },
});

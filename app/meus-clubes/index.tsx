import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { useMeusClubes } from '../../hooks/useMeusClubes';
import { useEsporte } from '../../contexts/EsporteContext';
import { ESPORTES } from '../../constants/esportes';
import { EsporteSwitcher } from '../../components/EsporteSwitcher';

export default function MeusClubesScreen() {
  const router = useRouter();
  const { esporteAtivo } = useEsporte();
  const { clubes, loading } = useMeusClubes();
  const esporteNome = ESPORTES.find((e) => e.id === esporteAtivo)?.nome ?? '';

  const filtrados = clubes.filter(
    (c) => c.esportes.includes(esporteAtivo) || c.esportes.length === 0
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={26} color={Colors.accent} />
        </TouchableOpacity>
        <Text style={styles.title}>Meus clubes</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.hint}>
          Clubes onde você faz aulas, joga ranking ou tem pagamentos — filtrados por {esporteNome}.
        </Text>
        <EsporteSwitcher variant="chips" />

        {loading ? (
          <ActivityIndicator color={Colors.accent} style={{ marginTop: 24 }} />
        ) : filtrados.length === 0 ? (
          <Text style={styles.empty}>
            Você ainda não está ligado a um clube de {esporteNome}. Solicite um ranking ou aulas na
            aba Clubes.
          </Text>
        ) : (
          filtrados.map((c) => (
            <TouchableOpacity
              key={c.id}
              style={styles.card}
              onPress={() => router.push(`/meu-clube/${c.id}`)}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.nome}>{c.nome}</Text>
                <Text style={styles.meta}>{c.cidade}</Text>
                <Text style={styles.tags}>
                  {c.vinculos
                    .map((v) => (v === 'aula' ? 'Aulas' : v === 'ranking' ? 'Ranking' : 'Pagamento'))
                    .join(' · ')}
                </Text>
                {c.rankingNomes.length > 0 ? (
                  <Text style={styles.meta}>{c.rankingNomes.join(', ')}</Text>
                ) : null}
              </View>
              <Ionicons name="chevron-forward" size={22} color={Colors.accent} />
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  title: { color: Colors.textPrimary, fontWeight: 'bold', fontSize: 18 },
  body: { padding: 16, paddingBottom: 40 },
  hint: { color: Colors.textSecondary, fontSize: 13, marginBottom: 12, lineHeight: 18 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    gap: 8,
  },
  nome: { color: Colors.textPrimary, fontWeight: 'bold', fontSize: 16 },
  meta: { color: Colors.textSecondary, fontSize: 12, marginTop: 2 },
  tags: { color: Colors.accent, fontSize: 12, fontWeight: '700', marginTop: 6 },
  empty: { color: Colors.textSecondary, textAlign: 'center', marginTop: 32, lineHeight: 20 },
});

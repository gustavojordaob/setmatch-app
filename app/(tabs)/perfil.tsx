import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../constants/colors';
import { Radius } from '../../constants/radius';
import { Typography } from '../../constants/typography';
import { ESPORTES } from '../../constants/esportes';
import { NIVEIS } from '../../constants/niveis';
import { Avatar } from '../../components/ui/Avatar';
import { Button } from '../../components/ui/Button';
import { StatsCard } from '../../components/jogador/StatsCard';
import { ResultadoCard } from '../../components/partida/ResultadoCard';
import { useAuth } from '../../hooks/useAuth';
import { usePartidas } from '../../hooks/usePartidas';

export default function PerfilScreen() {
  const { user, perfil, signOut } = useAuth();
  const { partidas, loading } = usePartidas();

  const nome = perfil?.nome ?? user?.displayName ?? 'Jogador';
  const nivelLabel =
    NIVEIS.find((n) => n.id === perfil?.nivel)?.label ?? '—';
  const esportesLabel =
    perfil?.esportes
      ?.map((id) => ESPORTES.find((e) => e.id === id)?.nome)
      .filter(Boolean)
      .join(', ') || '—';

  async function sair() {
    try {
      await signOut();
    } catch (e: unknown) {
      Alert.alert('Sair', e instanceof Error ? e.message : 'Erro ao sair.');
    }
  }

  function editarPerfil() {
    Alert.alert('Editar perfil', 'Em breve: alterar foto e dados do wizard.');
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Avatar uri={perfil?.fotoUrl ?? user?.photoURL} nome={nome} size="lg" />
          <Text style={styles.nome}>{nome}</Text>
          <Text style={styles.esportes}>{esportesLabel}</Text>
          <View style={styles.nivelBadge}>
            <Text style={styles.nivelTxt}>{nivelLabel}</Text>
          </View>
        </View>

        <StatsCard vitorias={perfil?.vitorias ?? 0} derrotas={perfil?.derrotas ?? 0} />

        <Button title="Editar perfil" variant="primary" onPress={editarPerfil} />

        <Text style={styles.section}>Histórico de partidas</Text>
        {loading ? (
          <Text style={styles.empty}>Carregando…</Text>
        ) : partidas.length === 0 ? (
          <Text style={styles.empty}>Nenhuma partida ainda.</Text>
        ) : (
          partidas.slice(0, 8).map((p) =>
            user ? <ResultadoCard key={p.id} partida={p} uid={user.uid} /> : null
          )
        )}

        <View style={{ height: 12 }} />
        <Button title="Sair da conta" variant="outline" onPress={sair} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 16, gap: 14, paddingBottom: 40 },
  header: { alignItems: 'center', gap: 8, marginBottom: 4 },
  nome: { ...Typography.userName, color: Colors.textPrimary, fontSize: 24 },
  esportes: { color: Colors.accent, fontWeight: '700' },
  nivelBadge: {
    backgroundColor: Colors.surfaceGreen,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: Radius.pill,
    marginTop: 4,
  },
  nivelTxt: { color: Colors.accent, fontWeight: '800' },
  section: { ...Typography.sectionTitle, color: Colors.textPrimary, marginTop: 8 },
  empty: { color: Colors.textSecondary, textAlign: 'center' },
});

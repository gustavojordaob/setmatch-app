import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../constants/colors';
import { Avatar } from '../../components/ui/Avatar';
import { Button } from '../../components/ui/Button';
import { StatsCard } from '../../components/jogador/StatsCard';
import { useAuth } from '../../hooks/useAuth';

export default function PerfilScreen() {
  const { user, perfil, signOut } = useAuth();

  async function sair() {
    try {
      await signOut();
    } catch (e: unknown) {
      Alert.alert('Sair', e instanceof Error ? e.message : 'Erro ao sair.');
    }
  }

  const nome = perfil?.nome ?? user?.displayName ?? 'Jogador';

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Avatar uri={perfil?.fotoUrl ?? user?.photoURL} nome={nome} size={72} />
          <Text style={styles.nome}>{nome}</Text>
          <Text style={styles.email}>{user?.email}</Text>
        </View>

        <StatsCard vitorias={perfil?.vitorias ?? 0} derrotas={perfil?.derrotas ?? 0} />

        <View style={{ height: 16 }} />

        <Button title="Sair da conta" variant="ghost" onPress={sair} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 16, gap: 12, paddingBottom: 40 },
  header: { alignItems: 'center', marginBottom: 8, gap: 6 },
  nome: { color: Colors.textPrimary, fontSize: 22, fontWeight: '900' },
  email: { color: Colors.textSecondary },
});

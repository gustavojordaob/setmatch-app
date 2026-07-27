import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { Typography } from '../../constants/typography';
import { Avatar } from '../../components/ui/Avatar';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../hooks/useAuth';

const TAB_PAD_BOTTOM = 88;

export default function PerfilScreen() {
  const router = useRouter();
  const { user, perfil, signOut } = useAuth();

  const nome = perfil?.nome ?? user?.displayName ?? 'Gustavo';
  const email = perfil?.email ?? user?.email ?? 'gustavo@setmatch.com';
  const v = perfil?.vitorias ?? 0;
  const d = perfil?.derrotas ?? 0;
  const torneios = 0;

  function confirmarLogout() {
    Alert.alert('Sair da conta', 'Deseja encerrar sua sessão?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Sair',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            try {
              await signOut();
              router.replace('/onboarding');
            } catch (e: unknown) {
              Alert.alert(
                'Sair',
                e instanceof Error ? e.message : 'Não foi possível sair.'
              );
            }
          })();
        },
      },
    ]);
  }

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.safe}>
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>Perfil</Text>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.headerIconBtn}
              onPress={() => router.push('/(tabs)/notificacoes')}
              accessibilityLabel="Notificações"
            >
              <Ionicons name="notifications-outline" size={22} color={Colors.white} />
              <View style={styles.bellDot} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.headerIconBtn}
              onPress={confirmarLogout}
              accessibilityLabel="Sair da conta"
            >
              <Ionicons name="log-out-outline" size={22} color={Colors.white} />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: TAB_PAD_BOTTOM }]}>
          <View style={styles.profileHeader}>
            <Avatar
              uri={perfil?.fotoUrl ?? user?.photoURL}
              nome={nome}
              size="xl"
              verified
            />
            <Text style={styles.nome}>{nome}</Text>
            <Text style={styles.email}>{email}</Text>
          </View>

          <View style={styles.statsRow}>
            <StatCircle value={String(v)} label="Vitórias" />
            <StatCircle value={String(d)} label="Derrotas" />
            <StatCircle value={String(torneios)} label="Torneios" />
          </View>

          {perfil?.cidade ? (
            <Text style={styles.cidade}>
              📍 {[perfil.bairro, perfil.cidade, perfil.estado].filter(Boolean).join(' · ')}
            </Text>
          ) : null}
          {perfil?.telefone ? (
            <Text style={styles.cidade}>📱 {perfil.telefone}</Text>
          ) : null}
          {perfil?.setmatchId ? (
            <Text style={styles.cidade}>ID: {perfil.setmatchId}</Text>
          ) : null}

          <Button label="Editar perfil" onPress={() => router.push('/perfil/editar')} />
          <Button
            label="Minhas estatísticas"
            variant="outline"
            onPress={() => router.push('/(tabs)/estatisticas')}
          />
          <Button label="Meus clubes" onPress={() => router.push('/meus-clubes')} />
          <Button label="Meus pagamentos" onPress={() => router.push('/pagamentos')} />
          <Button label="Amigos" variant="outline" onPress={() => router.push('/(tabs)/amigos')} />
          <Button label="Meus Badges" variant="outline" onPress={() => {}} />

          <View style={styles.badgeGrid}>
            {Array.from({ length: 8 }).map((_, i) => (
              <View key={i} style={styles.badgeCell}>
                {i === 0 ? (
                  <Ionicons name="trophy" size={32} color={Colors.accent} />
                ) : null}
              </View>
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function StatCircle({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.statCircle}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  safe: { flex: 1 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
  },
  headerTitle: {
    ...Typography.sectionTitle,
    color: Colors.textPrimary,
    fontSize: 22,
    fontWeight: 'bold',
  },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerIconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellDot: {
    position: 'absolute',
    top: 8,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.accent,
  },
  scroll: { paddingHorizontal: 20, alignItems: 'center', gap: 20 },
  profileHeader: { alignItems: 'center', gap: 8, marginTop: 8 },
  nome: { ...Typography.userName, color: Colors.textPrimary, fontSize: 30 },
  email: { color: Colors.textPrimary, opacity: 0.85, fontSize: 14 },
  cidade: { color: Colors.accent, fontSize: 13, fontWeight: '600', textAlign: 'center' },
  statsRow: { flexDirection: 'row', gap: 16, marginVertical: 8 },
  statCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 2,
    borderColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
  },
  statValue: { color: Colors.accent, fontSize: 22, fontWeight: 'bold' },
  statLabel: { color: Colors.textPrimary, fontSize: 11, textAlign: 'center', marginTop: 4 },
  badgeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    width: '100%',
    justifyContent: 'center',
  },
  badgeCell: {
    width: '22%',
    aspectRatio: 1,
    backgroundColor: Colors.surfaceDark,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 72,
  },
});

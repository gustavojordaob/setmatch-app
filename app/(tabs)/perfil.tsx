import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { Typography } from '../../constants/typography';
import { Avatar } from '../../components/ui/Avatar';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../hooks/useAuth';
import { useT } from '../../hooks/useI18n';
import { useEffect, useMemo, useState } from 'react';
import { badgesConquistados } from '../../constants/badges';
import { jogadorFoiCampeao } from '../../services/partidasHistorico';
import { AccountComplianceLinks } from '../../components/legal/AccountComplianceLinks';
import { useTotalNaoLidas } from '../../hooks/useTotalNaoLidas';
import { UnreadBadge } from '../../components/ui/UnreadBadge';

import { TAB_BAR_CLEARANCE } from '../../constants/tabBar';
const TAB_PAD_BOTTOM = TAB_BAR_CLEARANCE;

export default function PerfilScreen() {
  const router = useRouter();
  const { user, perfil, signOut } = useAuth();
  const t = useT();
  const msgsNaoLidas = useTotalNaoLidas();
  const [campeao, setCampeao] = useState(false);

  useEffect(() => {
    if (!user) return;
    void jogadorFoiCampeao(user.uid).then(setCampeao);
  }, [user?.uid]);

  const nome = perfil?.nome ?? user?.displayName ?? 'Gustavo';
  const email = perfil?.email ?? user?.email ?? 'gustavo@setmatch.com';
  const v = perfil?.vitorias ?? 0;
  const d = perfil?.derrotas ?? 0;
  const torneios = campeao ? 1 : 0;

  const badges = useMemo(
    () =>
      badgesConquistados({
        vitorias: v,
        derrotas: d,
        temFoto: Boolean(perfil?.fotoUrl ?? user?.photoURL),
        temCidade: Boolean(perfil?.cidade),
        campeaoTorneio: campeao,
      }),
    [v, d, perfil?.fotoUrl, perfil?.cidade, user?.photoURL, campeao]
  );

  function confirmarLogout() {
    Alert.alert(t('perfil.logoutTitle'), t('perfil.logoutConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('perfil.logout'),
        style: 'destructive',
        onPress: () => {
          void (async () => {
            try {
              await signOut();
              router.replace('/onboarding');
            } catch (e: unknown) {
              Alert.alert(
                t('perfil.logout'),
                e instanceof Error ? e.message : t('common.logoutFailed')
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
          <Text style={styles.headerTitle}>{t('perfil.title')}</Text>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.headerIconBtn}
              onPress={() => router.push('/(tabs)/notificacoes')}
              accessibilityLabel={t('nav.notifications')}
            >
              <Ionicons name="notifications-outline" size={22} color={Colors.white} />
              <UnreadBadge count={msgsNaoLidas} dotOnly />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.headerIconBtn}
              onPress={confirmarLogout}
              accessibilityLabel={t('perfil.logoutTitle')}
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
            <StatCircle value={String(v)} label={t('perfil.wins')} />
            <StatCircle value={String(d)} label={t('perfil.losses')} />
            <StatCircle value={String(torneios)} label={t('perfil.tournaments')} />
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

          <Button label={t('perfil.edit')} onPress={() => router.push('/perfil/editar')} />
          <Button
            label={t('perfil.myStats')}
            variant="outline"
            onPress={() => router.push('/(tabs)/estatisticas')}
          />
          <Button label={t('perfil.myClubs')} onPress={() => router.push('/meus-clubes')} />
          <Button label={t('perfil.myPayments')} onPress={() => router.push('/pagamentos')} />
          <Button
            label={t('perfil.friends')}
            variant="outline"
            onPress={() => router.push('/(tabs)/amigos')}
          />
          <Button
            label={t('perfil.searchPlayers')}
            variant="outline"
            onPress={() => router.push('/buscar')}
          />

          <Text style={styles.badgeSection}>{t('perfil.myBadges')}</Text>
          <View style={styles.badgeGrid}>
            {badges.length === 0 ? (
              <Text style={styles.cidade}>{t('perfil.unlockBadges')}</Text>
            ) : (
              badges.map((b) => (
                <View key={b.id} style={styles.badgeCell}>
                  <Ionicons name={b.icon} size={28} color={Colors.accent} />
                  <Text style={styles.badgeLabel}>{b.nome}</Text>
                </View>
              ))
            )}
          </View>

          <AccountComplianceLinks onLogout={confirmarLogout} />
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
  badgeSection: {
    color: Colors.textPrimary,
    fontWeight: '800',
    fontSize: 16,
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  badgeCell: {
    width: '22%',
    aspectRatio: 1,
    backgroundColor: Colors.surfaceDark,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 72,
    padding: 6,
  },
  badgeLabel: {
    color: Colors.textPrimary,
    fontSize: 9,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 4,
  },
});

import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { useAuth } from '../../hooks/useAuth';
import { useT } from '../../hooks/useI18n';
import type { SaudeResumo } from '../../types/saude';
import { isExpoGo, plataformaSaudeNativa } from '../../services/saude/dispositivo';
import {
  carregarSaudeResumo,
  formatNumero,
  formatSono,
  salvarSaudeResumo,
  sincronizarDispositivo,
} from '../../services/saude/sync';
import {
  conectarStrava,
  desconectarStrava,
  syncStravaAtividades,
} from '../../services/saude/strava';

export default function SaudeScreen() {
  const router = useRouter();
  const t = useT();
  const { user } = useAuth();
  const [saude, setSaude] = useState<SaudeResumo | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const plataforma = plataformaSaudeNativa();
  const expoGo = isExpoGo();
  const nativoOk = !expoGo && plataforma != null;

  const reload = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      setSaude(await carregarSaudeResumo(user.uid));
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function toggleDispositivo(ligar: boolean) {
    if (!user) return;
    if (!nativoOk) {
      Alert.alert(
        t('saude.needsDevBuildTitle'),
        t('saude.needsDevBuildBody')
      );
      return;
    }
    setBusy('device');
    try {
      if (!ligar) {
        await salvarSaudeResumo(user.uid, {
          fontes: {
            appleHealth: false,
            healthConnect: false,
          },
        });
        await reload();
        return;
      }
      await sincronizarDispositivo(user.uid);
      await reload();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '';
      if (msg === 'HEALTH_CONNECT_NOT_INSTALLED') {
        Alert.alert(t('saude.hcMissingTitle'), t('saude.hcMissingBody'));
      } else if (msg === 'NATIVE_HEALTH_REQUIRES_DEV_BUILD') {
        Alert.alert(t('saude.needsDevBuildTitle'), t('saude.needsDevBuildBody'));
      } else {
        Alert.alert(t('saude.title'), msg || t('saude.syncFailed'));
      }
    } finally {
      setBusy(null);
    }
  }

  async function toggleStrava(ligar: boolean) {
    if (!user) return;
    setBusy('strava');
    try {
      if (!ligar) {
        await desconectarStrava(user.uid);
      } else {
        await conectarStrava(user.uid);
        try {
          await syncStravaAtividades(user.uid);
        } catch {
          /* sync opcional na primeira conexão */
        }
      }
      await reload();
    } catch (e: unknown) {
      Alert.alert(
        'Strava',
        e instanceof Error ? e.message : t('saude.syncFailed')
      );
    } finally {
      setBusy(null);
    }
  }

  async function atualizarAgora() {
    if (!user) return;
    setBusy('sync');
    try {
      if (nativoOk && (saude?.fontes?.appleHealth || saude?.fontes?.healthConnect)) {
        await sincronizarDispositivo(user.uid);
      }
      if (saude?.fontes?.strava) {
        await syncStravaAtividades(user.uid);
      }
      await reload();
    } catch (e: unknown) {
      Alert.alert(t('saude.title'), e instanceof Error ? e.message : t('saude.syncFailed'));
    } finally {
      setBusy(null);
    }
  }

  const deviceOn =
    Platform.OS === 'ios'
      ? Boolean(saude?.fontes?.appleHealth)
      : Boolean(saude?.fontes?.healthConnect);
  const stravaOn = Boolean(saude?.fontes?.strava);

  const deviceLabel =
    Platform.OS === 'ios' ? t('saude.appleHealth') : t('saude.healthConnect');
  const deviceIcon =
    Platform.OS === 'ios' ? 'logo-apple' : 'fitness-outline';

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={26} color={Colors.accent} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('saude.title')}</Text>
        <TouchableOpacity onPress={() => void atualizarAgora()} hitSlop={12}>
          {busy === 'sync' ? (
            <ActivityIndicator color={Colors.accent} />
          ) : (
            <Ionicons name="refresh" size={22} color={Colors.accent} />
          )}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <Text style={styles.hero}>{t('saude.hero')}</Text>
        <Text style={styles.sub}>{t('saude.sub')}</Text>

        {expoGo ? (
          <View style={styles.banner}>
            <Ionicons name="construct-outline" size={22} color={Colors.accent} />
            <Text style={styles.bannerTxt}>{t('saude.needsDevBuildBody')}</Text>
          </View>
        ) : null}

        <Text style={styles.section}>{t('saude.connectSection')}</Text>

        {plataforma ? (
          <View style={styles.rowCard}>
            <View style={[styles.iconBubble, styles.iconApple]}>
              <Ionicons name={deviceIcon as keyof typeof Ionicons.glyphMap} size={22} color="#fff" />
            </View>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>{deviceLabel}</Text>
              <Text style={styles.rowSub}>
                {Platform.OS === 'ios' ? t('saude.appleHint') : t('saude.hcHint')}
              </Text>
            </View>
            {busy === 'device' ? (
              <ActivityIndicator color={Colors.accent} />
            ) : (
              <Switch
                value={deviceOn}
                onValueChange={(v) => void toggleDispositivo(v)}
                trackColor={{ false: '#3a4a40', true: Colors.accent }}
                thumbColor={Colors.white}
              />
            )}
          </View>
        ) : (
          <Text style={styles.muted}>{t('saude.webOnly')}</Text>
        )}

        <View style={styles.rowCard}>
          <View style={[styles.iconBubble, styles.iconStrava]}>
            <Ionicons name="bicycle" size={22} color="#fff" />
          </View>
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>Strava</Text>
            <Text style={styles.rowSub}>
              {stravaOn && saude?.stravaNome
                ? saude.stravaNome
                : t('saude.stravaHint')}
            </Text>
          </View>
          {busy === 'strava' ? (
            <ActivityIndicator color={Colors.accent} />
          ) : (
            <Switch
              value={stravaOn}
              onValueChange={(v) => void toggleStrava(v)}
              trackColor={{ false: '#3a4a40', true: Colors.accent }}
              thumbColor={Colors.white}
            />
          )}
        </View>

        <Text style={styles.section}>{t('saude.todaySection')}</Text>

        {loading ? (
          <ActivityIndicator color={Colors.accent} style={{ marginTop: 20 }} />
        ) : (
          <View style={styles.grid}>
            <MetricCard
              icon="footsteps"
              value={formatNumero(saude?.passos)}
              label={t('saude.steps')}
            />
            <MetricCard
              icon="flame"
              value={formatNumero(saude?.kcalAtivas)}
              label={t('saude.kcal')}
            />
            <MetricCard
              icon="heart"
              value={
                saude?.freqCardiacaMedia != null
                  ? String(saude.freqCardiacaMedia)
                  : '—'
              }
              label={t('saude.hr')}
            />
            <MetricCard
              icon="moon"
              value={formatSono(saude?.sonoMinutos)}
              label={t('saude.sleep')}
            />
          </View>
        )}

        <Text style={styles.privacy}>{t('saude.privacyNote')}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function MetricCard({
  icon,
  value,
  label,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  value: string;
  label: string;
}) {
  return (
    <View style={styles.metric}>
      <Ionicons name={icon} size={18} color={Colors.accent} />
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    marginBottom: 8,
  },
  headerTitle: { color: Colors.textPrimary, fontWeight: '800', fontSize: 18 },
  body: { padding: 20, paddingBottom: 48 },
  hero: {
    color: Colors.textPrimary,
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  sub: {
    color: Colors.textSecondary,
    marginTop: 8,
    marginBottom: 20,
    lineHeight: 20,
    fontSize: 14,
  },
  banner: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: Colors.surfaceDark,
    borderRadius: 16,
    padding: 14,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: 'rgba(199,217,65,0.35)',
  },
  bannerTxt: { flex: 1, color: Colors.textSecondary, fontSize: 13, lineHeight: 18 },
  section: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 12,
    marginTop: 8,
  },
  rowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 14,
    marginBottom: 10,
  },
  iconBubble: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconApple: { backgroundColor: '#2E7D4F' },
  iconStrava: { backgroundColor: '#FC4C02' },
  rowText: { flex: 1 },
  rowTitle: { color: Colors.textPrimary, fontWeight: '800', fontSize: 16 },
  rowSub: { color: Colors.textSecondary, fontSize: 12, marginTop: 2 },
  muted: { color: Colors.textSecondary, marginBottom: 12 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metric: {
    width: '48%',
    flexGrow: 1,
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 16,
    minHeight: 110,
    justifyContent: 'space-between',
    gap: 6,
  },
  metricValue: {
    color: Colors.textPrimary,
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  metricLabel: { color: Colors.textSecondary, fontSize: 12, fontWeight: '600' },
  privacy: {
    color: Colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 24,
    opacity: 0.85,
  },
});

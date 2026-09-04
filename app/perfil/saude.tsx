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
import type { SaudeResumo, StravaAtividadeResumo } from '../../types/saude';
import { isExpoGo, plataformaSaudeNativa } from '../../services/saude/dispositivo';
import { iconeEsporteStrava, rotuloEsporteStrava } from '../../services/saude/stravaFormat';
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
import { alertaErroSaudeDesconhecido } from '../../services/saude/errosSaude';

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
      const { title, body } = alertaErroSaudeDesconhecido(e, t, 'toggle-dispositivo');
      Alert.alert(title, body);
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
        await reload();
        return;
      }
      // No Android o OAuth costuma voltar via deep link → app/setmatch.tsx
      const result = await conectarStrava(user.uid);
      if (!result.completedInBrowser) {
        // Aguarda callback setmatch://setmatch?code=… (até ~5s)
        for (let i = 0; i < 5; i++) {
          await new Promise((r) => setTimeout(r, 1000));
          const s = await carregarSaudeResumo(user.uid);
          if (s?.fontes?.strava) break;
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
      const { title, body } = alertaErroSaudeDesconhecido(e, t, 'atualizar-saude');
      Alert.alert(title, body);
    } finally {
      setBusy(null);
    }
  }

  const deviceOn =
    Platform.OS === 'ios'
      ? Boolean(saude?.fontes?.appleHealth)
      : Boolean(saude?.fontes?.healthConnect);
  const stravaOn = Boolean(saude?.fontes?.strava);
  const stravaLista = saude?.stravaAtividadesLista ?? [];

  const stravaSubtitulo = ((): string => {
    if (!stravaOn) return t('saude.stravaHint');
    const titulo = stravaLista[0]?.nome?.trim();
    const n = saude?.stravaAtividadesHoje ?? stravaLista.length;
    if (titulo) {
      if (n <= 1) return titulo;
      return `${titulo} · +${n - 1} ${t('saude.stravaAtividades')}`;
    }
    if (saude?.stravaNome) {
      return n > 0
        ? `${saude.stravaNome} · ${n} ${t('saude.stravaAtividades')}`
        : saude.stravaNome;
    }
    return t('saude.stravaHint');
  })();

  const statusHintKey = ((): string | null => {
    if (loading) return null;
    if (!deviceOn && !stravaOn) return 'saude.statusHintNotConnected';
    if (deviceOn && metricasDispositivoVazias(saude)) {
      return Platform.OS === 'ios'
        ? 'saude.statusHintNoDataTodayIos'
        : 'saude.statusHintNoDataToday';
    }
    if (
      stravaOn &&
      !deviceOn &&
      (saude?.stravaAtividadesHoje ?? 0) === 0
    ) {
      return 'saude.statusHintStravaNoWorkout';
    }
    return null;
  })();

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
            <Text style={styles.rowSub} numberOfLines={2}>
              {stravaSubtitulo}
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
        <Text style={styles.sourcesNote}>{t('saude.sourcesNote')}</Text>

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

        {statusHintKey ? (
          <View style={styles.statusHint}>
            <Ionicons name="information-circle-outline" size={20} color={Colors.accent} />
            <Text style={styles.statusHintTxt}>{t(statusHintKey)}</Text>
          </View>
        ) : null}

        {stravaOn ? (
          <StravaTodaySection saude={saude} t={t} />
        ) : null}

        <Text style={styles.privacy}>{t('saude.privacyNote')}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function StravaTodaySection({
  saude,
  t,
}: {
  saude: SaudeResumo | null;
  t: (key: string, params?: Record<string, string>) => string;
}) {
  const lista = saude?.stravaAtividadesLista ?? [];
  const n = saude?.stravaAtividadesHoje ?? lista.length;
  const km = saude?.stravaKmHoje ?? 0;
  const min = saude?.stravaMinutosHoje ?? 0;
  const kcal = saude?.stravaKcalHoje ?? 0;

  return (
    <View style={styles.stravaBox}>
      <Text style={styles.stravaBoxTitle}>{t('saude.stravaToday')}</Text>
      {saude?.stravaNome ? (
        <Text style={styles.stravaAthlete}>{saude.stravaNome}</Text>
      ) : null}

      <View style={styles.stravaStatsRow}>
        <StravaStatChip label={t('saude.stravaStatWorkouts')} value={String(n)} />
        <StravaStatChip label={t('saude.stravaStatKm')} value={km.toLocaleString('pt-BR')} />
        <StravaStatChip label={t('saude.stravaStatMin')} value={String(min)} />
        <StravaStatChip label={t('saude.stravaStatKcal')} value={String(kcal)} />
      </View>

      <Text style={styles.stravaListTitle}>{t('saude.stravaActivitiesTitle')}</Text>

      {lista.length === 0 ? (
        <Text style={styles.stravaEmpty}>{t('saude.stravaNoWorkoutsToday')}</Text>
      ) : (
        lista.map((a, i) => (
          <StravaActivityRow key={a.id ?? `strava-${i}`} activity={a} t={t} />
        ))
      )}

      <Text style={styles.stravaFootnote}>{t('saude.stravaFootnote')}</Text>
    </View>
  );
}

function StravaStatChip({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stravaStatChip}>
      <Text style={styles.stravaStatValue}>{value}</Text>
      <Text style={styles.stravaStatLabel}>{label}</Text>
    </View>
  );
}

function StravaActivityRow({
  activity,
  t,
}: {
  activity: StravaAtividadeResumo;
  t: (key: string, params?: Record<string, string>) => string;
}) {
  const icon = iconeEsporteStrava(activity.tipo);
  const tipoLabel = rotuloEsporteStrava(activity.tipo);
  const meta = t('saude.stravaActivityMeta', {
    km: activity.km.toLocaleString('pt-BR'),
    min: String(activity.minutos),
    kcal: String(activity.kcal),
  });
  const detalhe = [activity.horario, tipoLabel, meta].filter(Boolean).join(' · ');

  return (
    <View style={styles.stravaActivityRow}>
      <View style={styles.stravaActivityIcon}>
        <Ionicons name={icon} size={18} color="#FC4C02" />
      </View>
      <View style={styles.stravaActivityBody}>
        <Text style={styles.stravaActivityTitle} numberOfLines={2}>
          {activity.nome || t('saude.stravaUntitledActivity')}
        </Text>
        <Text style={styles.stravaActivitySub}>{detalhe}</Text>
      </View>
    </View>
  );
}

function metricasDispositivoVazias(s?: SaudeResumo | null): boolean {
  if (!s) return true;
  const n = (v?: number | null) => v == null || v === 0;
  return (
    n(s.passos) && n(s.kcalAtivas) && n(s.freqCardiacaMedia) && n(s.sonoMinutos)
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
  sourcesNote: {
    color: Colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    marginTop: -6,
    marginBottom: 14,
  },
  stravaBox: {
    marginTop: 12,
    backgroundColor: Colors.surfaceDark,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(252,76,2,0.35)',
  },
  stravaBoxTitle: {
    color: '#FC4C02',
    fontWeight: '800',
    fontSize: 12,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  stravaAthlete: {
    color: Colors.textPrimary,
    fontWeight: '700',
    fontSize: 15,
    marginBottom: 12,
  },
  stravaStatsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  stravaStatChip: {
    flexGrow: 1,
    minWidth: '22%',
    backgroundColor: Colors.surface,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  stravaStatValue: {
    color: Colors.textPrimary,
    fontWeight: '900',
    fontSize: 18,
  },
  stravaStatLabel: {
    color: Colors.textSecondary,
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
    textAlign: 'center',
  },
  stravaListTitle: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  stravaEmpty: {
    color: Colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 8,
  },
  stravaActivityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
  },
  stravaActivityIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(252,76,2,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stravaActivityBody: { flex: 1 },
  stravaActivityTitle: {
    color: Colors.textPrimary,
    fontWeight: '800',
    fontSize: 15,
    lineHeight: 20,
  },
  stravaActivitySub: {
    color: Colors.textSecondary,
    fontSize: 12,
    marginTop: 3,
  },
  stravaFootnote: {
    color: Colors.textSecondary,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 6,
    opacity: 0.9,
  },
  stravaBoxLine: {
    color: Colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
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
  statusHint: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
    backgroundColor: Colors.surfaceDark,
    borderRadius: 16,
    padding: 14,
    marginTop: 14,
    borderWidth: 1,
    borderColor: 'rgba(199,217,65,0.25)',
  },
  statusHintTxt: {
    flex: 1,
    color: Colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
  privacy: {
    color: Colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 24,
    opacity: 0.85,
  },
});

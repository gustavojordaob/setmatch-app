import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { Avatar } from '../../components/ui/Avatar';
import { Button } from '../../components/ui/Button';
import { DualAvatar } from '../../components/ui/DualAvatar';
import { useAuth } from '../../hooks/useAuth';
import { labelDupla } from '../../utils/duplaDisplay';
import {
  atualizarStatusDesafio,
  buscarDesafio,
  registrarPartidaDoDesafio,
} from '../../services/desafios';
import { ESPORTES, type EsporteId } from '../../constants/esportes';
import { labelFormato, type FormatoPartidaId } from '../../constants/formatosPartida';
import {
  quantosSetsVisiveis,
  rotuloSet,
  validarPlacarPartida,
} from '../../utils/placarTorneio';

type DesafioDoc = {
  id: string;
  desafiante: string;
  desafianteNome?: string;
  desafianteFoto?: string;
  desafianteParceiroUid?: string;
  desafianteParceiroNome?: string;
  desafianteParceiroFoto?: string;
  desafiado: string;
  desafiadoNome?: string;
  desafiadoFoto?: string;
  desafiadoParceiroUid?: string;
  desafiadoParceiroNome?: string;
  desafiadoParceiroFoto?: string;
  esporte: string;
  quadra: string;
  status: string;
  mensagem?: string;
  formato?: string;
  dataSugerida?: string;
  clubeId?: string;
  clubeNome?: string;
  rankingId?: string;
  rankingNome?: string;
};

function emptySetsDraft(): { j1: string; j2: string }[] {
  return Array.from({ length: 5 }, () => ({ j1: '', j2: '' }));
}

export default function DesafioDetalheScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user, perfil } = useAuth();
  const [d, setD] = useState<DesafioDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [setsDraft, setSetsDraft] = useState(emptySetsDraft);
  const [publicarFeed, setPublicarFeed] = useState(true);

  const carregar = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const raw = await buscarDesafio(id);
    if (raw) {
      const r = raw as Record<string, unknown>;
      setD({
        id: String(r.id),
        desafiante: String(r.desafiante ?? ''),
        desafianteNome: r.desafianteNome ? String(r.desafianteNome) : undefined,
        desafianteFoto: r.desafianteFoto ? String(r.desafianteFoto) : undefined,
        desafianteParceiroUid: r.desafianteParceiroUid
          ? String(r.desafianteParceiroUid)
          : undefined,
        desafianteParceiroNome: r.desafianteParceiroNome
          ? String(r.desafianteParceiroNome)
          : undefined,
        desafianteParceiroFoto: r.desafianteParceiroFoto
          ? String(r.desafianteParceiroFoto)
          : undefined,
        desafiado: String(r.desafiado ?? ''),
        desafiadoNome: r.desafiadoNome ? String(r.desafiadoNome) : undefined,
        desafiadoFoto: r.desafiadoFoto ? String(r.desafiadoFoto) : undefined,
        desafiadoParceiroUid: r.desafiadoParceiroUid
          ? String(r.desafiadoParceiroUid)
          : undefined,
        desafiadoParceiroNome: r.desafiadoParceiroNome
          ? String(r.desafiadoParceiroNome)
          : undefined,
        desafiadoParceiroFoto: r.desafiadoParceiroFoto
          ? String(r.desafiadoParceiroFoto)
          : undefined,
        esporte: String(r.esporte ?? 'tenis'),
        quadra: String(r.quadra ?? ''),
        status: String(r.status ?? 'pendente'),
        mensagem: r.mensagem ? String(r.mensagem) : undefined,
        formato: r.formato ? String(r.formato) : undefined,
        dataSugerida: r.dataSugerida ? String(r.dataSugerida) : undefined,
        clubeId: r.clubeId ? String(r.clubeId) : undefined,
        clubeNome: r.clubeNome ? String(r.clubeNome) : undefined,
        rankingId: r.rankingId ? String(r.rankingId) : undefined,
        rankingNome: r.rankingNome ? String(r.rankingNome) : undefined,
      });
    } else setD(null);
    setLoading(false);
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      void carregar();
    }, [carregar])
  );

  const setsParciais = useMemo(
    () =>
      setsDraft.map((s) => ({
        j1: Number(s.j1) || 0,
        j2: Number(s.j2) || 0,
      })),
    [setsDraft]
  );
  const nSets = quantosSetsVisiveis(d?.formato, setsParciais);

  async function setStatus(status: 'aceito' | 'recusado') {
    if (!id) return;
    setBusy(true);
    try {
      await atualizarStatusDesafio(id, status);
      await carregar();
    } catch (e: unknown) {
      Alert.alert('Desafio', e instanceof Error ? e.message : 'Erro');
    } finally {
      setBusy(false);
    }
  }

  function pedirConfirmacaoPlacar() {
    if (!user || !perfil || !d) return;
    const valid = validarPlacarPartida({
      formatoId: d.formato,
      sets: setsParciais,
    });
    if (!valid.ok) {
      Alert.alert('Placar', valid.erro);
      return;
    }
    const n1 = labelDupla(d.desafianteNome ?? 'Jogador 1', d.desafianteParceiroNome);
    const n2 = labelDupla(d.desafiadoNome ?? 'Jogador 2', d.desafiadoParceiroNome);
    const nomeVenc = valid.vencedor === 'j1' ? n1 : n2;
    const resumo = valid.sets.map((s) => `${s.j1}–${s.j2}`).join('  ');
    Alert.alert(
      'Confirmar placar',
      `${n1} × ${n2}\n${resumo}\n\nVencedor: ${nomeVenc}\n\nConfirma o lançamento?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Confirmar', onPress: () => void executarRegistrar(valid) },
      ]
    );
  }

  async function executarRegistrar(
    valid: Extract<ReturnType<typeof validarPlacarPartida>, { ok: true }>
  ) {
    if (!user || !perfil || !d) return;
    setBusy(true);
    try {
      const vencedor =
        valid.vencedor === 'j1' ? d.desafiante : d.desafiado;
      await registrarPartidaDoDesafio({
        desafioId: d.id,
        jogador1: d.desafiante,
        jogador1Nome: d.desafianteNome ?? 'Jogador 1',
        jogador1Foto: d.desafianteFoto,
        jogador1ParceiroUid: d.desafianteParceiroUid,
        jogador1ParceiroNome: d.desafianteParceiroNome,
        jogador1ParceiroFoto: d.desafianteParceiroFoto,
        jogador2: d.desafiado,
        jogador2Nome: d.desafiadoNome ?? 'Jogador 2',
        jogador2Foto: d.desafiadoFoto,
        jogador2ParceiroUid: d.desafiadoParceiroUid,
        jogador2ParceiroNome: d.desafiadoParceiroNome,
        jogador2ParceiroFoto: d.desafiadoParceiroFoto,
        sets: valid.sets,
        vencedor,
        esporte: (d.esporte as EsporteId) || 'tenis',
        quadra: d.quadra,
        clubeId: d.clubeId,
        clubeNome: d.clubeNome,
        formato: d.formato as FormatoPartidaId | undefined,
        rankingId: d.rankingId || undefined,
        publicarNoFeed: publicarFeed,
      });
      const msgs = [
        'Resultado registrado.',
        publicarFeed ? 'Publicado no feed.' : 'Sem post no feed.',
        d.rankingId ? 'Pontos do ranking atualizados.' : '',
      ]
        .filter(Boolean)
        .join(' ');
      if (d.rankingId) {
        Alert.alert('Partida', msgs, [
          { text: 'OK', style: 'cancel' },
          {
            text: 'Ver confrontos',
            onPress: () => router.push(`/ranking/${d.rankingId}/confrontos`),
          },
        ]);
      } else {
        Alert.alert('Partida', msgs);
      }
      await carregar();
    } catch (e: unknown) {
      Alert.alert('Partida', e instanceof Error ? e.message : 'Erro');
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator color={Colors.accent} style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  if (!d) {
    return (
      <SafeAreaView style={styles.safe}>
        <Text style={styles.empty}>Desafio não encontrado.</Text>
      </SafeAreaView>
    );
  }

  const souDesafiado = user?.uid === d.desafiado;
  const souParte = user?.uid === d.desafiante || user?.uid === d.desafiado;
  const esporteNome = ESPORTES.find((e) => e.id === d.esporte)?.nome ?? d.esporte;
  const nome1 = labelDupla(d.desafianteNome ?? 'Jogador 1', d.desafianteParceiroNome);
  const nome2 = labelDupla(d.desafiadoNome ?? 'Jogador 2', d.desafiadoParceiroNome);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors.accent} />
        </TouchableOpacity>
        <Text style={styles.title}>Desafio</Text>
        <View style={{ width: 24 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
      <ScrollView
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.vsRow}>
          <DualAvatar
            fotoA={d.desafianteFoto}
            fotoB={d.desafianteParceiroFoto}
            nomeA={d.desafianteNome ?? 'Jogador 1'}
            nomeB={d.desafianteParceiroNome}
            size="lg"
          />
          <Text style={styles.vs}>VS</Text>
          <DualAvatar
            fotoA={d.desafiadoFoto}
            fotoB={d.desafiadoParceiroFoto}
            nomeA={d.desafiadoNome ?? 'Jogador 2'}
            nomeB={d.desafiadoParceiroNome}
            size="lg"
          />
        </View>
        <Text style={styles.names}>
          {nome1} × {nome2}
        </Text>

        <InfoRow icon="tennisball-outline" label="Esporte" value={esporteNome} />
        <InfoRow icon="location-outline" label="Local" value={d.quadra || '—'} />
        <InfoRow icon="trophy-outline" label="Formato" value={labelFormato(d.formato)} />
        {d.rankingNome ? (
          <InfoRow icon="podium-outline" label="Ranking" value={d.rankingNome} />
        ) : null}
        {d.dataSugerida ? (
          <InfoRow icon="calendar-outline" label="Quando" value={d.dataSugerida} />
        ) : null}
        <InfoRow icon="flag-outline" label="Status" value={d.status} />
        {d.mensagem ? <Text style={styles.msg}>{d.mensagem}</Text> : null}

        {d.status === 'pendente' && souDesafiado ? (
          <View style={styles.actions}>
            <Button label="Aceitar" loading={busy} onPress={() => void setStatus('aceito')} />
            <Button
              label="Recusar"
              variant="outline"
              loading={busy}
              onPress={() => void setStatus('recusado')}
            />
          </View>
        ) : null}

        {d.status === 'aceito' && souParte ? (
          <View style={styles.box}>
            <Text style={styles.boxTitle}>Registrar placar</Text>
            <Text style={styles.hint}>
              Formato: {labelFormato(d.formato)} · fotos + placar por set (mesma regra do torneio)
            </Text>

            <View style={styles.placarHeader}>
              <View style={styles.placarSide}>
                <Avatar uri={d.desafianteFoto} nome={nome1} size="sm" />
                <Text style={styles.placarNome} numberOfLines={2}>
                  {nome1}
                </Text>
              </View>
              <Text style={styles.placarVs}>×</Text>
              <View style={[styles.placarSide, styles.placarSideRight]}>
                <Text style={styles.placarNome} numberOfLines={2}>
                  {nome2}
                </Text>
                <Avatar uri={d.desafiadoFoto} nome={nome2} size="sm" />
              </View>
            </View>

            {Array.from({ length: nSets }, (_, idx) => (
              <View key={`set-${idx}`} style={styles.setBlock}>
                <Text style={styles.setLabel}>
                  {rotuloSet(d.formato, idx, setsParciais)}
                </Text>
                <View style={styles.scoreRow}>
                  <TextInput
                    style={styles.placarInput}
                    keyboardType="number-pad"
                    placeholder="0"
                    placeholderTextColor={Colors.textSecondary}
                    value={setsDraft[idx]?.j1 ?? ''}
                    onChangeText={(t) =>
                      setSetsDraft((prev) => {
                        const next = [...prev];
                        next[idx] = {
                          ...(next[idx] ?? { j1: '', j2: '' }),
                          j1: t.replace(/\D/g, '').slice(0, 2),
                        };
                        return next;
                      })
                    }
                  />
                  <Text style={styles.dash}>–</Text>
                  <TextInput
                    style={styles.placarInput}
                    keyboardType="number-pad"
                    placeholder="0"
                    placeholderTextColor={Colors.textSecondary}
                    value={setsDraft[idx]?.j2 ?? ''}
                    onChangeText={(t) =>
                      setSetsDraft((prev) => {
                        const next = [...prev];
                        next[idx] = {
                          ...(next[idx] ?? { j1: '', j2: '' }),
                          j2: t.replace(/\D/g, '').slice(0, 2),
                        };
                        return next;
                      })
                    }
                  />
                </View>
              </View>
            ))}

            <View style={styles.feedRow}>
              <Text style={styles.feedLabel}>Publicar no feed</Text>
              <Switch
                value={publicarFeed}
                onValueChange={setPublicarFeed}
                trackColor={{ true: Colors.accent, false: Colors.surface }}
              />
            </View>
            <Button
              label="Salvar resultado"
              loading={busy}
              onPress={pedirConfirmacaoPlacar}
            />
          </View>
        ) : null}
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon} size={18} color={Colors.accent} />
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
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
  },
  title: { color: Colors.textPrimary, fontSize: 18, fontWeight: '800' },
  body: { padding: 20, gap: 10, paddingBottom: 40 },
  empty: { color: Colors.textSecondary, textAlign: 'center', marginTop: 40 },
  vsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    marginVertical: 12,
  },
  vs: { color: Colors.accent, fontWeight: '900', fontSize: 18 },
  names: {
    color: Colors.textPrimary,
    textAlign: 'center',
    fontWeight: '700',
    marginBottom: 8,
  },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  infoLabel: { color: Colors.textSecondary, width: 72 },
  infoValue: { color: Colors.textPrimary, flex: 1, fontWeight: '600' },
  msg: { color: Colors.textSecondary, marginTop: 8, lineHeight: 20 },
  actions: { gap: 10, marginTop: 16 },
  box: {
    marginTop: 16,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    gap: 10,
  },
  boxTitle: { color: Colors.accent, fontWeight: '900', fontSize: 16 },
  hint: { color: Colors.textSecondary, fontSize: 13, lineHeight: 18 },
  placarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  placarSide: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  placarSideRight: { justifyContent: 'flex-end' },
  placarNome: { color: Colors.textPrimary, fontWeight: '700', flexShrink: 1, fontSize: 12 },
  placarVs: { color: Colors.accent, fontWeight: '900', fontSize: 16 },
  setBlock: { gap: 4 },
  setLabel: { color: Colors.textSecondary, fontWeight: '700', fontSize: 12 },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  placarInput: {
    width: 56,
    backgroundColor: Colors.surfaceDark,
    borderRadius: 12,
    color: Colors.textPrimary,
    textAlign: 'center',
    paddingVertical: 10,
    fontWeight: '800',
    fontSize: 18,
  },
  dash: { color: Colors.textSecondary, fontWeight: '700' },
  feedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  feedLabel: { color: Colors.textPrimary, fontWeight: '600' },
});

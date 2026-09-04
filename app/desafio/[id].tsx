import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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

export default function DesafioDetalheScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user, perfil } = useAuth();
  const [d, setD] = useState<DesafioDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [s1, setS1] = useState('6');
  const [s2, setS2] = useState('4');
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

  async function registrar() {
    if (!user || !perfil || !d) return;
    const j1 = Number(s1);
    const j2 = Number(s2);
    if (Number.isNaN(j1) || Number.isNaN(j2)) {
      Alert.alert('Placar', 'Informe números válidos nos sets.');
      return;
    }
    setBusy(true);
    try {
      const vencedor = j1 > j2 ? d.desafiante : d.desafiado;
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
        sets: [{ j1, j2 }],
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
  const souParticipante = user?.uid === d.desafiante || souDesafiado;
  const esp = ESPORTES.find((e) => e.id === d.esporte);
  const statusLabel: Record<string, string> = {
    pendente: 'Aguardando resposta',
    aceito: 'Aceito — bora jogar!',
    recusado: 'Recusado',
    finalizado: 'Finalizado',
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={26} color={Colors.accent} />
        </TouchableOpacity>
        <Text style={styles.title}>Confronto</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <View style={styles.vsCard}>
          <Text style={styles.esporteBadge}>
            {esp?.emoji} {esp?.nome ?? d.esporte}
            {d.clubeNome ? ` · ${d.clubeNome}` : ''}
          </Text>
          <View style={styles.vsRow}>
            <View style={styles.playerCol}>
              <DualAvatar
                nomeA={d.desafianteNome ?? 'Jogador'}
                fotoA={d.desafianteFoto}
                nomeB={d.desafianteParceiroNome}
                fotoB={d.desafianteParceiroFoto}
                size="lg"
              />
              <Text style={styles.playerName} numberOfLines={2}>
                {labelDupla(d.desafianteNome ?? 'Jogador', d.desafianteParceiroNome)}
              </Text>
            </View>
            <Text style={styles.vsText}>VS</Text>
            <View style={styles.playerCol}>
              <DualAvatar
                nomeA={d.desafiadoNome ?? 'Jogador'}
                fotoA={d.desafiadoFoto}
                nomeB={d.desafiadoParceiroNome}
                fotoB={d.desafiadoParceiroFoto}
                size="lg"
              />
              <Text style={styles.playerName} numberOfLines={2}>
                {labelDupla(d.desafiadoNome ?? 'Jogador', d.desafiadoParceiroNome)}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <InfoRow icon="trophy-outline" label="Formato" value={labelFormato(d.formato)} />
          <InfoRow icon="location-outline" label="Local" value={d.quadra || 'A combinar'} />
          {d.dataSugerida ? (
            <InfoRow icon="calendar-outline" label="Quando" value={d.dataSugerida} />
          ) : null}
          <InfoRow
            icon="flag-outline"
            label="Status"
            value={statusLabel[d.status] ?? d.status}
            accent
          />
          {d.rankingNome ? (
            <InfoRow icon="podium-outline" label="Ranking" value={d.rankingNome} accent />
          ) : null}
          {d.mensagem ? (
            <Text style={styles.msg}>“{d.mensagem}”</Text>
          ) : null}
        </View>

        {souDesafiado && d.status === 'pendente' ? (
          <View style={styles.actions}>
            <Button label="Aceitar desafio" onPress={() => void setStatus('aceito')} loading={busy} />
            <Button
              label="Recusar"
              variant="outline"
              onPress={() => void setStatus('recusado')}
              loading={busy}
            />
          </View>
        ) : null}

        {souParticipante && d.status === 'aceito' ? (
          <View style={styles.card}>
            <Text style={styles.boxTitle}>Registrar placar</Text>
            <Text style={styles.meta}>
              Formato: {labelFormato(d.formato)} · informe o placar dos sets
            </Text>
            <View style={styles.placarRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.placarNome} numberOfLines={2}>
                  {labelDupla(
                    d.desafianteNome ?? 'J1',
                    d.desafianteParceiroNome
                  )}
                </Text>
                <TextInput
                  style={styles.placarInput}
                  keyboardType="number-pad"
                  value={s1}
                  onChangeText={setS1}
                />
              </View>
              <Text style={styles.vsSmall}>×</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.placarNome} numberOfLines={2}>
                  {labelDupla(d.desafiadoNome ?? 'J2', d.desafiadoParceiroNome)}
                </Text>
                <TextInput
                  style={styles.placarInput}
                  keyboardType="number-pad"
                  value={s2}
                  onChangeText={setS2}
                />
              </View>
            </View>
            <View style={styles.feedRow}>
              <Text style={styles.feedLabel}>Publicar no meu feed</Text>
              <Switch
                value={publicarFeed}
                onValueChange={setPublicarFeed}
                trackColor={{ true: Colors.accent }}
              />
            </View>
            <Button label="Salvar resultado" onPress={() => void registrar()} loading={busy} />
          </View>
        ) : null}

        {d.status === 'finalizado' ? (
          <Text style={styles.done}>
            Partida finalizada{d.rankingId ? ' · pontos do ranking aplicados' : ''}.
          </Text>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoRow({
  icon,
  label,
  value,
  accent,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon} size={18} color={Colors.accent} />
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, accent && { color: Colors.accent }]} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background, paddingHorizontal: 16 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    marginBottom: 12,
  },
  title: { color: Colors.textPrimary, fontWeight: 'bold', fontSize: 18 },
  vsCard: {
    backgroundColor: Colors.surfaceDark,
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(199,217,65,0.35)',
  },
  esporteBadge: {
    color: Colors.accent,
    fontWeight: '700',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 16,
  },
  vsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  playerCol: { flex: 1, alignItems: 'center', gap: 8 },
  playerName: {
    color: Colors.textPrimary,
    fontWeight: '800',
    fontSize: 14,
    textAlign: 'center',
  },
  vsText: { color: Colors.accent, fontWeight: '900', fontSize: 26, paddingHorizontal: 8 },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    gap: 10,
    marginBottom: 16,
  },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  infoLabel: { color: Colors.textSecondary, fontSize: 12, width: 64 },
  infoValue: { flex: 1, color: Colors.textPrimary, fontWeight: '600', fontSize: 14 },
  meta: { color: Colors.textSecondary, fontSize: 13 },
  msg: { color: Colors.textPrimary, marginTop: 4, fontStyle: 'italic', lineHeight: 20 },
  actions: { gap: 10, marginBottom: 16 },
  boxTitle: { color: Colors.textPrimary, fontWeight: 'bold', fontSize: 16 },
  placarRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 12, marginVertical: 12 },
  placarNome: { color: Colors.textSecondary, fontSize: 12, textAlign: 'center', marginBottom: 6 },
  placarInput: {
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: 14,
    color: Colors.textPrimary,
    textAlign: 'center',
    fontSize: 22,
    fontWeight: 'bold',
  },
  vsSmall: { color: Colors.textPrimary, fontSize: 20, fontWeight: 'bold', marginBottom: 14 },
  feedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  feedLabel: { color: Colors.textPrimary, fontWeight: '600', flex: 1, marginRight: 12 },
  done: { color: Colors.accent, textAlign: 'center', fontWeight: '700' },
  empty: { color: Colors.textSecondary, textAlign: 'center', marginTop: 40 },
});

import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { doc, getDoc } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { db } from '../../../utils/firebaseConfig';
import { Colors } from '../../../constants/colors';
import { Button } from '../../../components/ui/Button';
import { ButtonFooter } from '../../../components/ui/ButtonFooter';
import { Avatar } from '../../../components/ui/Avatar';
import { DiaAgendaPicker } from '../../../components/agenda/DiaAgendaPicker';
import { AgendaVisaoSemanal } from '../../../components/agenda/AgendaVisaoSemanal';
import { AgendaVisaoMensal } from '../../../components/agenda/AgendaVisaoMensal';
import { AgendaGradeDia } from '../../../components/agenda/AgendaGradeDia';
import { useAuth } from '../../../hooks/useAuth';
import { useLocale } from '../../../contexts/LocaleContext';
import {
  carregarAgendaDoClube,
  criarReservaRanking,
  jaMarcouComAdversario,
  listarQuadrasClube,
  listarReservasClubeDia,
  montarGradeDia,
} from '../../../services/agenda';
import {
  normalizarRegrasJogo,
  type Ranking,
} from '../../../types/ranking';
import type {
  AgendaClubeConfig,
  GradeSlot,
  QuadraClube,
  SlotLivre,
} from '../../../types/agenda';
import type { EsporteId } from '../../../constants/esportes';
import type { FormatoPartidaId } from '../../../constants/formatosPartida';
import {
  dataLimiteMeses,
  diaDentroDaJanela,
  parseDiaISO,
  toDiaISO,
  todayISO,
} from '../../../utils/agendaDatas';

type Modo = 'mes' | 'semana' | 'dia';

export default function RankingReservarScreen() {
  const {
    id,
    advUid,
    advNome,
    advFoto,
  } = useLocalSearchParams<{
    id: string;
    advUid?: string;
    advNome?: string;
    advFoto?: string;
  }>();
  const router = useRouter();
  const { locale } = useLocale();
  const { user, perfil } = useAuth();
  const [ranking, setRanking] = useState<Ranking | null>(null);
  const [agenda, setAgenda] = useState<AgendaClubeConfig | null>(null);
  const [quadras, setQuadras] = useState<QuadraClube[]>([]);
  const [quadraId, setQuadraId] = useState<string | 'todas'>('todas');
  const [modo, setModo] = useState<Modo>('mes');
  const [diaISO, setDiaISO] = useState(todayISO());
  const [grade, setGrade] = useState<GradeSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [slotSel, setSlotSel] = useState<SlotLivre | null>(null);
  const [bloqueado, setBloqueado] = useState(false);
  const [msgAgenda, setMsgAgenda] = useState('');

  const regras = useMemo(
    () => normalizarRegrasJogo(ranking?.regrasJogo),
    [ranking?.regrasJogo]
  );

  const maxISO = useMemo(() => {
    if (!agenda) return undefined;
    return toDiaISO(dataLimiteMeses(agenda.mesesAntecipacao));
  }, [agenda]);

  const carregar = useCallback(async () => {
    if (!id || !user || !advUid) return;
    setLoading(true);
    setSlotSel(null);
    setMsgAgenda('');
    try {
      const rSnap = await getDoc(doc(db, 'rankings', id));
      if (!rSnap.exists()) {
        Alert.alert('Ranking', 'Não encontrado.');
        return;
      }
      const raw = rSnap.data();
      const r: Ranking = {
        id: rSnap.id,
        nome: String(raw.nome ?? ''),
        clubeId: String(raw.clubeId ?? ''),
        clubeNome: String(raw.clubeNome ?? ''),
        cidade: String(raw.cidade ?? ''),
        esporte: (raw.esporte as EsporteId) ?? 'tenis',
        donoUid: String(raw.donoUid ?? ''),
        membros: (raw.membros as string[]) ?? [],
        totalMembros: Number(raw.totalMembros ?? 0),
        regrasJogo: raw.regrasJogo as Ranking['regrasJogo'],
      };
      setRanking(r);

      if (await jaMarcouComAdversario({ rankingId: id, uidA: user.uid, uidB: advUid })) {
        setBloqueado(true);
        setGrade([]);
        return;
      }
      setBloqueado(false);

      if (!r.clubeId) {
        setMsgAgenda('Ranking sem clube — sem agenda de quadras.');
        setGrade([]);
        return;
      }

      const ag = await carregarAgendaDoClube(r.clubeId);
      setAgenda(ag);
      if (!ag.ativo) {
        setMsgAgenda('O clube ainda não ativou a agenda de quadras.');
        setGrade([]);
        return;
      }

      const qs = await listarQuadrasClube(r.clubeId);
      setQuadras(qs);

      if (modo === 'semana' || modo === 'mes') {
        setGrade([]);
        return;
      }

      if (!diaDentroDaJanela(diaISO, ag.mesesAntecipacao)) {
        setMsgAgenda(
          `O clube liberou só ${ag.mesesAntecipacao} ${ag.mesesAntecipacao === 1 ? 'mês' : 'meses'} à frente.`
        );
        setGrade([]);
        return;
      }

      const dia = parseDiaISO(diaISO);
      const reservas = await listarReservasClubeDia(r.clubeId, dia);
      setGrade(
        montarGradeDia({
          agenda: ag,
          quadras: qs,
          reservas,
          dia,
          quadraId: quadraId === 'todas' ? undefined : quadraId,
        })
      );
    } finally {
      setLoading(false);
    }
  }, [id, user, advUid, diaISO, quadraId, modo]);

  useFocusEffect(
    useCallback(() => {
      void carregar();
    }, [carregar])
  );

  async function confirmar() {
    if (!user || !perfil || !ranking || !advUid || !slotSel) return;
    if (!ranking.clubeId) {
      Alert.alert('Reserva', 'Este ranking não está ligado a um clube com agenda.');
      return;
    }
    setSaving(true);
    try {
      const [euSnap, advSnap] = await Promise.all([
        getDoc(doc(db, 'rankings', ranking.id, 'classificacao', user.uid)),
        getDoc(doc(db, 'rankings', ranking.id, 'classificacao', advUid)),
      ]);
      const eu = euSnap.data() || {};
      const advC = advSnap.data() || {};
      const { desafioId } = await criarReservaRanking({
        clubeId: ranking.clubeId,
        clubeNome: ranking.clubeNome,
        quadraId: slotSel.quadraId,
        quadraNome: slotSel.quadraNome,
        inicio: slotSel.inicio,
        fim: slotSel.fim,
        rankingId: ranking.id,
        rankingNome: ranking.nome,
        esporte: ranking.esporte,
        formato: regras.formatoPartidaId as FormatoPartidaId,
        desafiante: user.uid,
        desafianteNome: perfil.nome,
        desafianteFoto: perfil.fotoUrl,
        desafianteParceiroUid: eu.parceiroUid ? String(eu.parceiroUid) : undefined,
        desafianteParceiroNome: eu.parceiroNome ? String(eu.parceiroNome) : undefined,
        desafianteParceiroFoto: eu.parceiroFoto ? String(eu.parceiroFoto) : undefined,
        desafiado: advUid,
        desafiadoNome: String(advNome ?? 'Jogador'),
        desafiadoFoto: advFoto ? String(advFoto) : undefined,
        desafiadoParceiroUid: advC.parceiroUid ? String(advC.parceiroUid) : undefined,
        desafiadoParceiroNome: advC.parceiroNome
          ? String(advC.parceiroNome)
          : undefined,
        desafiadoParceiroFoto: advC.parceiroFoto
          ? String(advC.parceiroFoto)
          : undefined,
      });
      Alert.alert(
        'Reserva enviada',
        'O adversário precisa confirmar o horário. Você será avisado nos desafios.',
        [{ text: 'OK', onPress: () => router.replace(`/desafio/${desafioId}`) }]
      );
    } catch (e: unknown) {
      Alert.alert('Reserva', e instanceof Error ? e.message : 'Não foi possível reservar');
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={Colors.accent} />
        </TouchableOpacity>
        <Text style={styles.title}>Marcar horário</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.adv}>
          <Avatar uri={advFoto ? String(advFoto) : undefined} nome={String(advNome ?? '')} size="md" />
          <View style={{ flex: 1 }}>
            <Text style={styles.advNome}>{advNome ?? 'Adversário'}</Text>
            <Text style={styles.meta}>
              {ranking?.nome ?? '…'} · adversário confirma a reserva
            </Text>
          </View>
        </View>

        {agenda?.ativo ? (
          <Text style={styles.metaAccent}>
            Slots de {agenda.duracaoSlotMin} min · clube liberou {agenda.mesesAntecipacao}{' '}
            {agenda.mesesAntecipacao === 1 ? 'mês' : 'meses'}
          </Text>
        ) : null}

        {bloqueado ? (
          <Text style={styles.empty}>
            Vocês já marcaram ou jogaram neste ranking. Escolha outro adversário.
          </Text>
        ) : (
          <>
            <Text style={styles.label}>1. Quadra</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <TouchableOpacity
                style={[styles.chip, quadraId === 'todas' && styles.chipOn]}
                onPress={() => setQuadraId('todas')}
              >
                <Text style={[styles.chipTxt, quadraId === 'todas' && styles.chipTxtOn]}>
                  Todas
                </Text>
              </TouchableOpacity>
              {quadras.map((q) => (
                <TouchableOpacity
                  key={q.id}
                  style={[styles.chip, quadraId === q.id && styles.chipOn]}
                  onPress={() => setQuadraId(q.id)}
                >
                  <Text style={[styles.chipTxt, quadraId === q.id && styles.chipTxtOn]}>
                    {q.nome}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.modos}>
              {(
                [
                  { id: 'mes' as const, label: 'Mês' },
                  { id: 'semana' as const, label: 'Semana' },
                  { id: 'dia' as const, label: 'Um dia' },
                ] as const
              ).map((m) => (
                <TouchableOpacity
                  key={m.id}
                  style={[styles.modoChip, modo === m.id && styles.chipOn]}
                  onPress={() => setModo(m.id)}
                >
                  <Text style={[styles.chipTxt, modo === m.id && styles.chipTxtOn]}>
                    {m.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {loading && !agenda ? (
              <ActivityIndicator color={Colors.accent} style={{ marginTop: 24 }} />
            ) : msgAgenda && !agenda?.ativo ? (
              <Text style={styles.empty}>{msgAgenda}</Text>
            ) : agenda && ranking?.clubeId ? (
              modo === 'mes' ? (
                <AgendaVisaoMensal
                  clubeId={ranking.clubeId}
                  agenda={agenda}
                  quadras={quadras}
                  locale={locale}
                  quadraId={quadraId === 'todas' ? undefined : quadraId}
                  selecionavel
                  slotSel={slotSel}
                  onSelectLivre={setSlotSel}
                />
              ) : modo === 'semana' ? (
                <AgendaVisaoSemanal
                  clubeId={ranking.clubeId}
                  agenda={agenda}
                  quadras={quadras}
                  locale={locale}
                  quadraId={quadraId === 'todas' ? undefined : quadraId}
                  selecionavel
                  slotSel={slotSel}
                  onSelectLivre={setSlotSel}
                />
              ) : (
                <>
                  <Text style={styles.label}>2. Dia</Text>
                  <DiaAgendaPicker
                    locale={locale}
                    diaISO={diaISO}
                    onChange={setDiaISO}
                    maxISO={maxISO}
                  />
                  {msgAgenda ? <Text style={styles.empty}>{msgAgenda}</Text> : null}
                  {loading ? (
                    <ActivityIndicator color={Colors.accent} />
                  ) : (
                    <AgendaGradeDia
                      grade={grade}
                      selecionavel
                      slotSel={slotSel}
                      onSelectLivre={setSlotSel}
                    />
                  )}
                </>
              )
            ) : null}

            {slotSel ? (
              <Text style={styles.sel}>
                Selecionado: {slotSel.quadraNome} ·{' '}
                {slotSel.inicio.toLocaleTimeString(locale === 'en-US' ? 'en-US' : locale === 'es' ? 'es-ES' : 'pt-BR', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Text>
            ) : null}
          </>
        )}
      </ScrollView>

      <ButtonFooter>
        <Button
          label="Solicitar reserva"
          loading={saving}
          disabled={!slotSel || bloqueado}
          onPress={() => void confirmar()}
        />
      </ButtonFooter>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  title: { color: Colors.white, fontSize: 18, fontWeight: '700' },
  body: { padding: 16, paddingBottom: 120, gap: 10 },
  adv: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 14,
  },
  advNome: { color: Colors.white, fontWeight: '700', fontSize: 16 },
  meta: { color: Colors.textSecondary, fontSize: 12, marginTop: 4 },
  metaAccent: { color: Colors.accent, fontSize: 13, fontWeight: '600' },
  label: { color: Colors.textSecondary, fontSize: 13, marginTop: 8 },
  empty: { color: Colors.textSecondary, fontSize: 14, lineHeight: 20, marginTop: 12 },
  sel: { color: Colors.accent, fontWeight: '700', marginTop: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 60,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    marginRight: 8,
  },
  modos: { flexDirection: 'row', gap: 8 },
  modoChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 60,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  chipOn: { borderColor: Colors.accent, backgroundColor: 'rgba(199,217,65,0.15)' },
  chipTxt: { color: Colors.textSecondary, fontWeight: '600', fontSize: 13 },
  chipTxtOn: { color: Colors.accent },
});

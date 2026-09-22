import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../../constants/colors';
import { DiaAgendaPicker } from '../../../components/agenda/DiaAgendaPicker';
import { AgendaVisaoSemanal } from '../../../components/agenda/AgendaVisaoSemanal';
import { AgendaVisaoMensal } from '../../../components/agenda/AgendaVisaoMensal';
import { AgendaGradeDia } from '../../../components/agenda/AgendaGradeDia';
import { useLocale } from '../../../contexts/LocaleContext';
import {
  carregarAgendaDoClube,
  listarQuadrasClube,
  listarReservasClubeDia,
  montarGradeDia,
} from '../../../services/agenda';
import type { AgendaClubeConfig, GradeSlot, QuadraClube } from '../../../types/agenda';
import { horarioEfetivoQuadra } from '../../../types/agenda';
import {
  dataLimiteMeses,
  diaDentroDaJanela,
  parseDiaISO,
  toDiaISO,
  todayISO,
} from '../../../utils/agendaDatas';

type Modo = 'mes' | 'semana' | 'dia';

export default function MeuClubeAgendaScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { locale } = useLocale();
  const [modo, setModo] = useState<Modo>('mes');
  const [diaISO, setDiaISO] = useState(todayISO());
  const [quadraId, setQuadraId] = useState<string | 'todas'>('todas');
  const [agenda, setAgenda] = useState<AgendaClubeConfig | null>(null);
  const [quadras, setQuadras] = useState<QuadraClube[]>([]);
  const [grade, setGrade] = useState<GradeSlot[]>([]);
  const [loading, setLoading] = useState(true);

  const maxISO = useMemo(() => {
    if (!agenda) return undefined;
    return toDiaISO(dataLimiteMeses(agenda.mesesAntecipacao));
  }, [agenda]);

  const carregarBase = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const ag = await carregarAgendaDoClube(id);
      setAgenda(ag);
      const qs = await listarQuadrasClube(id);
      setQuadras(qs);
      if (!ag.ativo || modo === 'semana' || modo === 'mes') {
        setGrade([]);
        return;
      }
      if (!diaDentroDaJanela(diaISO, ag.mesesAntecipacao)) {
        setGrade([]);
        return;
      }
      const dia = parseDiaISO(diaISO);
      const reservas = await listarReservasClubeDia(id, dia);
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
  }, [id, diaISO, quadraId, modo]);

  useFocusEffect(
    useCallback(() => {
      void carregarBase();
    }, [carregarBase])
  );

  const resumo = useMemo(() => {
    if (!agenda?.ativo) return 'Agenda desativada pelo clube.';
    const q =
      quadraId !== 'todas' ? quadras.find((x) => x.id === quadraId) : undefined;
    const hor = q
      ? horarioEfetivoQuadra(agenda, q)
      : {
          abertura: agenda.abertura,
          fechamento: agenda.fechamento,
          duracaoSlotMin: agenda.duracaoSlotMin,
        };
    return `${hor.abertura}–${hor.fechamento} · ${hor.duracaoSlotMin} min · liberado ${agenda.mesesAntecipacao} ${agenda.mesesAntecipacao === 1 ? 'mês' : 'meses'}`;
  }, [agenda, quadraId, quadras]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={Colors.accent} />
        </TouchableOpacity>
        <Text style={styles.title}>Agenda das quadras</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.hint}>
          Escolha a quadra e veja livres e ocupados (Ranking, Amistoso, Torneio). A
          liberação de meses para reservar é definida pelo clube.
        </Text>
        <Text style={styles.meta}>{resumo}</Text>

        <Text style={styles.label}>Quadra</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chips}>
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

        {!agenda?.ativo ? (
          <Text style={styles.empty}>Agenda desativada pelo clube.</Text>
        ) : modo === 'mes' && id ? (
          <AgendaVisaoMensal
            clubeId={id}
            agenda={agenda}
            quadras={quadras}
            locale={locale}
            quadraId={quadraId === 'todas' ? undefined : quadraId}
          />
        ) : modo === 'semana' && id ? (
          <AgendaVisaoSemanal
            clubeId={id}
            agenda={agenda}
            quadras={quadras}
            locale={locale}
            quadraId={quadraId === 'todas' ? undefined : quadraId}
          />
        ) : (
          <>
            <DiaAgendaPicker
              locale={locale}
              diaISO={diaISO}
              onChange={setDiaISO}
              maxISO={maxISO}
            />
            {loading ? (
              <ActivityIndicator color={Colors.accent} style={{ marginTop: 24 }} />
            ) : (
              <AgendaGradeDia grade={grade} />
            )}
          </>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  title: { color: Colors.white, fontSize: 18, fontWeight: '700' },
  body: { padding: 16, paddingBottom: 40, gap: 10 },
  hint: { color: Colors.textSecondary, fontSize: 13, lineHeight: 18 },
  meta: { color: Colors.accent, fontSize: 13, fontWeight: '600' },
  label: { color: Colors.textSecondary, fontSize: 13, marginTop: 4 },
  chips: { flexGrow: 0, marginBottom: 4 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 60,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    marginRight: 8,
  },
  modos: { flexDirection: 'row', gap: 8, marginTop: 4 },
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
  empty: { color: Colors.textSecondary, marginTop: 12 },
});

import { useCallback, useMemo, useState } from 'react';
import {
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
import { Radius } from '../../constants/radius';
import { ESPORTES, type EsporteId } from '../../constants/esportes';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { ButtonFooter } from '../../components/ui/ButtonFooter';
import { useAuth } from '../../hooks/useAuth';
import { listarClubesDoDono } from '../../services/clubes';
import {
  MESES_ANTECIPACAO_OPCOES,
  DURACOES_SLOT_OPCOES,
  DURACOES_BLOQUEIO_OPCOES,
  BLOQUEIO_DIAS_OPCOES,
  TIPOS_BLOQUEIO,
  labelDuracaoMin,
  labelTipoReserva,
  normalizarAgenda,
  normalizarDuracaoMin,
  type AgendaClubeConfig,
  type GradeSlot,
  type QuadraClube,
  type ReservaQuadra,
  type ReservaTipo,
} from '../../types/agenda';
import { AgendaGradeDia } from '../../components/agenda/AgendaGradeDia';
import { DiaAgendaPicker } from '../../components/agenda/DiaAgendaPicker';
import { AgendaVisaoSemanal } from '../../components/agenda/AgendaVisaoSemanal';
import { AgendaVisaoMensal } from '../../components/agenda/AgendaVisaoMensal';
import { QuadraConfigCard } from '../../components/agenda/QuadraConfigCard';
import { horarioEfetivoQuadra } from '../../types/agenda';
import { useLocale } from '../../contexts/LocaleContext';
import { addDiasISO, formatDiaCurto, todayISO } from '../../utils/agendaDatas';
import {
  atualizarQuadraClube,
  carregarAgendaDoClube,
  criarBloqueioDono,
  criarBloqueiosDonoRange,
  criarQuadraClube,
  cancelarReserva,
  listarQuadrasClube,
  listarReservasClubeDia,
  montarGradeDia,
  reservaToDate,
  salvarAgendaClube,
  type QuadraClubeUpdate,
} from '../../services/agenda';

const DIAS = [
  { id: 0, label: 'Dom' },
  { id: 1, label: 'Seg' },
  { id: 2, label: 'Ter' },
  { id: 3, label: 'Qua' },
  { id: 4, label: 'Qui' },
  { id: 5, label: 'Sex' },
  { id: 6, label: 'Sáb' },
];

type Aba = 'geral' | 'quadras' | 'bloqueios' | 'grade';

const ABAS: { id: Aba; label: string; icon: keyof typeof Ionicons.glyphMap }[] =
  [
    { id: 'geral', label: 'Geral', icon: 'settings-outline' },
    { id: 'quadras', label: 'Quadras', icon: 'grid-outline' },
    { id: 'bloqueios', label: 'Bloquear', icon: 'lock-closed-outline' },
    { id: 'grade', label: 'Grade', icon: 'calendar-outline' },
  ];

function parseDiaHora(diaISO: string, hhmm: string): Date {
  const [y, m, day] = diaISO.split('-').map(Number);
  const [h, min] = hhmm.split(':').map((x) => Number(x) || 0);
  return new Date(y, (m || 1) - 1, day || 1, h, min, 0, 0);
}

export default function ClubeAgendaScreen() {
  const router = useRouter();
  const { locale } = useLocale();
  const { clubeId: clubeIdParam } = useLocalSearchParams<{ clubeId?: string }>();
  const { user } = useAuth();
  const [aba, setAba] = useState<Aba>('geral');
  const [clubeId, setClubeId] = useState<string | null>(null);
  const [agenda, setAgenda] = useState<AgendaClubeConfig>(normalizarAgenda(null));
  const [quadras, setQuadras] = useState<QuadraClube[]>([]);
  const [quadraExpandida, setQuadraExpandida] = useState<string | null>(null);
  const [novaQuadra, setNovaQuadra] = useState('');
  const [novaQuadraDuracao, setNovaQuadraDuracao] = useState('');
  const [esporteQuadra, setEsporteQuadra] = useState<EsporteId>('tenis');
  const [diaISO, setDiaISO] = useState(todayISO());
  const [modoGrade, setModoGrade] = useState<'mes' | 'semana' | 'dia'>('mes');
  const [reservas, setReservas] = useState<ReservaQuadra[]>([]);
  const [grade, setGrade] = useState<GradeSlot[]>([]);
  const [bloqueioQuadraId, setBloqueioQuadraId] = useState<string | null>(null);
  const [bloqueioInicio, setBloqueioInicio] = useState('09:00');
  const [bloqueioFim, setBloqueioFim] = useState('10:00');
  const [bloqueioModoTempo, setBloqueioModoTempo] = useState<'duracao' | 'ate'>(
    'duracao'
  );
  const [bloqueioAlcance, setBloqueioAlcance] = useState<'slot' | 'periodo'>(
    'slot'
  );
  const [bloqueioQtdDias, setBloqueioQtdDias] = useState(2);
  const [bloqueioDiaInteiro, setBloqueioDiaInteiro] = useState(true);
  const [bloqueioTipo, setBloqueioTipo] = useState<Exclude<ReservaTipo, 'ranking'>>(
    'bloqueio_aula'
  );
  const [bloqueioMotivo, setBloqueioMotivo] = useState('');
  const [bloqueioDuracao, setBloqueioDuracao] = useState(60);
  const [duracaoCustom, setDuracaoCustom] = useState('');
  const [saving, setSaving] = useState(false);

  const carregar = useCallback(async () => {
    if (!user) return;
    const clubes = await listarClubesDoDono(user.uid);
    const preferred =
      typeof clubeIdParam === 'string' && clubeIdParam
        ? clubes.find((x) => x.id === clubeIdParam)
        : undefined;
    const c = preferred ?? clubes[0];
    if (!c) return;
    setClubeId(c.id);
    const ag = await carregarAgendaDoClube(c.id);
    setAgenda(ag);
    setBloqueioDuracao(ag.duracaoSlotMin);
    const qs = await listarQuadrasClube(c.id);
    setQuadras(qs);
    if (qs[0] && !bloqueioQuadraId) setBloqueioQuadraId(qs[0].id);
    const dia = parseDiaHora(diaISO, '00:00');
    const rs = await listarReservasClubeDia(c.id, dia);
    setReservas(rs);
    setGrade(montarGradeDia({ agenda: ag, quadras: qs, reservas: rs, dia }));
  }, [user, diaISO, bloqueioQuadraId, clubeIdParam]);

  useFocusEffect(
    useCallback(() => {
      void carregar();
    }, [carregar])
  );

  const duracao = agenda.duracaoSlotMin;

  function duracaoParaBloqueio(): number {
    const q = quadras.find((x) => x.id === bloqueioQuadraId);
    const padrao = q
      ? horarioEfetivoQuadra(agenda, q).duracaoSlotMin
      : agenda.duracaoSlotMin;
    return normalizarDuracaoMin(bloqueioDuracao, padrao);
  }

  function fimBloqueioAPartirDe(inicio: Date): Date {
    if (bloqueioModoTempo === 'ate') {
      const f = new Date(inicio);
      const [h, min] = bloqueioFim.split(':').map((x) => Number(x) || 0);
      f.setHours(h, min, 0, 0);
      return f;
    }
    return new Date(inicio.getTime() + duracaoParaBloqueio() * 60_000);
  }

  async function salvarConfig() {
    if (!clubeId) return;
    setSaving(true);
    try {
      await salvarAgendaClube(clubeId, agenda);
      Alert.alert('Agenda', 'Padrão do clube salvo.');
    } catch (e: unknown) {
      Alert.alert('Agenda', e instanceof Error ? e.message : 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  }

  async function addQuadra() {
    if (!clubeId || !novaQuadra.trim()) return;
    try {
      const id = await criarQuadraClube({
        clubeId,
        nome: novaQuadra.trim(),
        esporte: esporteQuadra,
        ordem: quadras.length,
      });
      const custom = Number(novaQuadraDuracao.replace(/\D/g, ''));
      if (custom >= 15) {
        await atualizarQuadraClube(clubeId, id, {
          duracaoSlotMin: normalizarDuracaoMin(custom),
        });
      }
      setNovaQuadra('');
      setNovaQuadraDuracao('');
      setQuadraExpandida(id);
      await carregar();
    } catch (e: unknown) {
      Alert.alert('Quadra', e instanceof Error ? e.message : 'Erro');
    }
  }

  async function toggleQuadra(q: QuadraClube) {
    if (!clubeId) return;
    await atualizarQuadraClube(clubeId, q.id, { ativa: !q.ativa });
    await carregar();
  }

  async function salvarQuadra(quadraId: string, patch: QuadraClubeUpdate) {
    if (!clubeId) return;
    try {
      await atualizarQuadraClube(clubeId, quadraId, patch);
      await carregar();
      Alert.alert('Quadra', 'Configuração da quadra salva.');
    } catch (e: unknown) {
      Alert.alert('Quadra', e instanceof Error ? e.message : 'Erro ao salvar');
    }
  }

  async function bloquear() {
    if (!clubeId || !user || !bloqueioQuadraId) {
      Alert.alert('Bloqueio', 'Selecione uma quadra.');
      return;
    }
    const q = quadras.find((x) => x.id === bloqueioQuadraId);
    if (!q) return;

    setSaving(true);
    try {
      if (bloqueioAlcance === 'periodo') {
        let fimHHmm = bloqueioFim;
        if (!bloqueioDiaInteiro && bloqueioModoTempo === 'duracao') {
          const ini = parseDiaHora(diaISO, bloqueioInicio);
          const fim = new Date(ini.getTime() + duracaoParaBloqueio() * 60_000);
          fimHHmm = `${String(fim.getHours()).padStart(2, '0')}:${String(fim.getMinutes()).padStart(2, '0')}`;
        }
        const { ids, pulados } = await criarBloqueiosDonoRange({
          clubeId,
          quadraId: q.id,
          quadraNome: q.nome,
          agenda,
          quadra: q,
          diaInicioISO: diaISO,
          qtdDias: bloqueioQtdDias,
          diaInteiro: bloqueioDiaInteiro,
          inicioHHmm: bloqueioInicio,
          fimHHmm,
          tipo: bloqueioTipo,
          criadoPorUid: user.uid,
          motivo: bloqueioMotivo,
        });
        setBloqueioMotivo('');
        await carregar();
        const ate = formatDiaCurto(
          addDiasISO(diaISO, bloqueioQtdDias - 1),
          locale
        );
        Alert.alert(
          'Agenda',
          `${ids.length} dia(s) bloqueado(s) até ${ate}.${
            pulados ? ` ${pulados} dia(s) pulado(s) (quadra fechada).` : ''
          }`
        );
        return;
      }

      const inicio = parseDiaHora(diaISO, bloqueioInicio);
      const fim = fimBloqueioAPartirDe(inicio);
      if (fim.getTime() <= inicio.getTime()) {
        Alert.alert('Bloqueio', 'O fim precisa ser depois do início.');
        return;
      }
      const mins = Math.max(
        5,
        Math.round((fim.getTime() - inicio.getTime()) / 60_000)
      );
      await criarBloqueioDono({
        clubeId,
        quadraId: q.id,
        quadraNome: q.nome,
        inicio,
        fim,
        tipo: bloqueioTipo,
        criadoPorUid: user.uid,
        motivo: bloqueioMotivo,
        duracaoMin: mins,
      });
      setBloqueioMotivo('');
      await carregar();
      Alert.alert('Agenda', 'Horário bloqueado.');
    } catch (e: unknown) {
      Alert.alert('Bloqueio', e instanceof Error ? e.message : 'Erro');
    } finally {
      setSaving(false);
    }
  }

  async function liberar(r: ReservaQuadra) {
    if (!clubeId) return;
    Alert.alert('Cancelar reserva', 'Liberar este horário?', [
      { text: 'Não', style: 'cancel' },
      {
        text: 'Sim',
        style: 'destructive',
        onPress: () => {
          void cancelarReserva(clubeId, r.id).then(carregar);
        },
      },
    ]);
  }

  function toggleDia(id: number) {
    setAgenda((a) => {
      const has = a.diasSemana.includes(id);
      return {
        ...a,
        diasSemana: has
          ? a.diasSemana.filter((d) => d !== id)
          : [...a.diasSemana, id].sort(),
      };
    });
  }

  const reservasVisiveis = useMemo(
    () => reservas.filter((r) => r.status === 'pendente' || r.status === 'confirmado'),
    [reservas]
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={Colors.white} />
        </TouchableOpacity>
        <Text style={styles.title}>Agenda de quadras</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.tabs}>
        {ABAS.map((t) => {
          const on = aba === t.id;
          return (
            <TouchableOpacity
              key={t.id}
              style={[styles.tab, on && styles.tabOn]}
              onPress={() => setAba(t.id)}
              activeOpacity={0.85}
            >
              <Ionicons
                name={t.icon}
                size={16}
                color={on ? Colors.textOnAccent : Colors.textSecondary}
              />
              <Text style={[styles.tabTxt, on && styles.tabTxtOn]}>{t.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
      >
        {aba === 'geral' ? (
          <View style={styles.panel}>
            <Text style={styles.panelTitle}>1. Padrão do clube</Text>
            <Text style={styles.hint}>
              Vale para todas as quadras, a menos que a quadra tenha horário ou
              duração próprios (aba Quadras).
            </Text>

            <View style={styles.card}>
              <View style={styles.rowBetween}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>Agenda ativa</Text>
                  <Text style={styles.hint}>
                    Membros veem livres e ocupados (Ranking, aula, torneio…)
                  </Text>
                </View>
                <Switch
                  value={agenda.ativo}
                  onValueChange={(v) => setAgenda((a) => ({ ...a, ativo: v }))}
                  trackColor={{ true: Colors.accent, false: Colors.border }}
                />
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Horário de funcionamento</Text>
              <Text style={styles.label}>Abertura → fechamento</Text>
              <View style={styles.row}>
                <TextInput
                  style={styles.timeInput}
                  value={agenda.abertura}
                  onChangeText={(t) => setAgenda((a) => ({ ...a, abertura: t }))}
                  placeholder="07:00"
                  placeholderTextColor={Colors.textSecondary}
                />
                <Text style={styles.sep}>→</Text>
                <TextInput
                  style={styles.timeInput}
                  value={agenda.fechamento}
                  onChangeText={(t) =>
                    setAgenda((a) => ({ ...a, fechamento: t }))
                  }
                  placeholder="22:00"
                  placeholderTextColor={Colors.textSecondary}
                />
              </View>

              <Text style={styles.label}>Dias da semana</Text>
              <View style={styles.chips}>
                {DIAS.map((d) => {
                  const on = agenda.diasSemana.includes(d.id);
                  return (
                    <TouchableOpacity
                      key={d.id}
                      style={[styles.chip, on && styles.chipOn]}
                      onPress={() => toggleDia(d.id)}
                    >
                      <Text style={[styles.chipTxt, on && styles.chipTxtOn]}>
                        {d.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Duração padrão de cada jogo</Text>
              <Text style={styles.hint}>
                Grade livre usa este tempo. Cada quadra ou bloqueio pode
                sobrescrever.
              </Text>
              <View style={styles.chips}>
                {DURACOES_SLOT_OPCOES.map((m) => (
                  <TouchableOpacity
                    key={m}
                    style={[
                      styles.chip,
                      agenda.duracaoSlotMin === m && styles.chipOn,
                    ]}
                    onPress={() => {
                      setAgenda((a) => ({ ...a, duracaoSlotMin: m }));
                      setDuracaoCustom('');
                    }}
                  >
                    <Text
                      style={[
                        styles.chipTxt,
                        agenda.duracaoSlotMin === m && styles.chipTxtOn,
                      ]}
                    >
                      {labelDuracaoMin(m)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Input
                label="Outra duração (minutos)"
                value={duracaoCustom}
                onChangeText={(t) => {
                  setDuracaoCustom(t);
                  const n = Number(t.replace(/\D/g, ''));
                  if (n >= 15) {
                    setAgenda((a) => ({
                      ...a,
                      duracaoSlotMin: normalizarDuracaoMin(n),
                    }));
                  }
                }}
                placeholder="Ex.: 100"
                keyboardType="number-pad"
              />
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Até quando liberar reservas</Text>
              <Text style={styles.hint}>
                Jogadores só marcam dentro desta janela.
              </Text>
              <View style={styles.chips}>
                {MESES_ANTECIPACAO_OPCOES.map((m) => (
                  <TouchableOpacity
                    key={`mes-${m}`}
                    style={[
                      styles.chip,
                      agenda.mesesAntecipacao === m && styles.chipOn,
                    ]}
                    onPress={() =>
                      setAgenda((a) => ({
                        ...a,
                        mesesAntecipacao: m,
                        antecipacaoDias: m * 30,
                      }))
                    }
                  >
                    <Text
                      style={[
                        styles.chipTxt,
                        agenda.mesesAntecipacao === m && styles.chipTxtOn,
                      ]}
                    >
                      {m} {m === 1 ? 'mês' : 'meses'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Prazo da pré-reserva</Text>
              <Text style={styles.hint}>
                Se o adversário não confirmar o horário de ranking, a quadra
                libera sozinha. Padrão: 48 horas.
              </Text>
              <View style={styles.chips}>
                {[12, 24, 48, 72].map((h) => (
                  <TouchableOpacity
                    key={`exp-${h}`}
                    style={[
                      styles.chip,
                      agenda.horasExpiracaoPreReserva === h && styles.chipOn,
                    ]}
                    onPress={() =>
                      setAgenda((a) => ({
                        ...a,
                        horasExpiracaoPreReserva: h,
                      }))
                    }
                  >
                    <Text
                      style={[
                        styles.chipTxt,
                        agenda.horasExpiracaoPreReserva === h && styles.chipTxtOn,
                      ]}
                    >
                      {h}h
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <Button
              label="Salvar padrão do clube"
              loading={saving}
              onPress={() => void salvarConfig()}
            />
            <TouchableOpacity
              style={styles.nextLink}
              onPress={() => setAba('quadras')}
            >
              <Text style={styles.nextLinkTxt}>
                Próximo: configurar cada quadra →
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {aba === 'quadras' ? (
          <View style={styles.panel}>
            <Text style={styles.panelTitle}>2. Cada quadra</Text>
            <Text style={styles.hint}>
              Toque na quadra para abrir. Ative horário, dias ou duração próprios
              só se forem diferentes do padrão do clube.
            </Text>

            {quadras.length === 0 ? (
              <Text style={styles.empty}>Nenhuma quadra ainda. Adicione abaixo.</Text>
            ) : (
              quadras.map((q) => (
                <QuadraConfigCard
                  key={q.id}
                  quadra={q}
                  agenda={agenda}
                  expanded={quadraExpandida === q.id}
                  onToggleExpand={() =>
                    setQuadraExpandida((id) => (id === q.id ? null : q.id))
                  }
                  onToggleAtiva={() => void toggleQuadra(q)}
                  onSalvar={(patch) => salvarQuadra(q.id, patch)}
                />
              ))
            )}

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Adicionar quadra</Text>
              <Input
                label="Nome"
                value={novaQuadra}
                onChangeText={setNovaQuadra}
                placeholder="Ex.: Quadra 1"
              />
              <Text style={styles.label}>Esporte</Text>
              <View style={styles.chips}>
                {ESPORTES.map((e) => (
                  <TouchableOpacity
                    key={e.id}
                    style={[styles.chip, esporteQuadra === e.id && styles.chipOn]}
                    onPress={() => setEsporteQuadra(e.id)}
                  >
                    <Text
                      style={[
                        styles.chipTxt,
                        esporteQuadra === e.id && styles.chipTxtOn,
                      ]}
                    >
                      {e.nome}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Input
                label="Duração só desta quadra (opcional)"
                value={novaQuadraDuracao}
                onChangeText={setNovaQuadraDuracao}
                placeholder={`Vazio = padrão (${agenda.duracaoSlotMin} min)`}
                keyboardType="number-pad"
              />
              <Button
                label="Adicionar quadra"
                variant="outline"
                onPress={() => void addQuadra()}
              />
            </View>
          </View>
        ) : null}

        {aba === 'bloqueios' ? (
          <View style={styles.panel}>
            <Text style={styles.panelTitle}>3. Bloquear horário</Text>
            <Text style={styles.hint}>
              Slot curto (15 min+) ou vários dias a partir da data — aula, torneio,
              amistoso…
            </Text>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Alcance</Text>
              <View style={styles.chips}>
                <TouchableOpacity
                  style={[
                    styles.chip,
                    bloqueioAlcance === 'slot' && styles.chipOn,
                  ]}
                  onPress={() => setBloqueioAlcance('slot')}
                >
                  <Text
                    style={[
                      styles.chipTxt,
                      bloqueioAlcance === 'slot' && styles.chipTxtOn,
                    ]}
                  >
                    Um horário
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.chip,
                    bloqueioAlcance === 'periodo' && styles.chipOn,
                  ]}
                  onPress={() => setBloqueioAlcance('periodo')}
                >
                  <Text
                    style={[
                      styles.chipTxt,
                      bloqueioAlcance === 'periodo' && styles.chipTxtOn,
                    ]}
                  >
                    Vários dias
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>
                {bloqueioAlcance === 'periodo'
                  ? 'A partir deste dia'
                  : 'Quando'}
              </Text>
              <DiaAgendaPicker
                locale={locale}
                diaISO={diaISO}
                onChange={setDiaISO}
              />

              {bloqueioAlcance === 'periodo' ? (
                <>
                  <Text style={styles.label}>Quantos dias (incluindo o 1º)</Text>
                  <View style={styles.chips}>
                    {BLOQUEIO_DIAS_OPCOES.map((n) => (
                      <TouchableOpacity
                        key={`d-${n}`}
                        style={[
                          styles.chip,
                          bloqueioQtdDias === n && styles.chipOn,
                        ]}
                        onPress={() => setBloqueioQtdDias(n)}
                      >
                        <Text
                          style={[
                            styles.chipTxt,
                            bloqueioQtdDias === n && styles.chipTxtOn,
                          ]}
                        >
                          {n} {n === 1 ? 'dia' : 'dias'}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <Text style={styles.hint}>
                    Até {formatDiaCurto(addDiasISO(diaISO, bloqueioQtdDias - 1), locale)}
                    {' · '}dias fechados da quadra são pulados
                  </Text>
                  <View style={styles.rowBetween}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardTitle}>Dia inteiro</Text>
                      <Text style={styles.hint}>
                        Usa abertura→fechamento de cada dia
                      </Text>
                    </View>
                    <Switch
                      value={bloqueioDiaInteiro}
                      onValueChange={setBloqueioDiaInteiro}
                      trackColor={{ true: Colors.accent, false: Colors.border }}
                    />
                  </View>
                </>
              ) : null}

              {bloqueioAlcance === 'slot' || !bloqueioDiaInteiro ? (
                <>
                  <Input
                    label="Início (HH:MM)"
                    value={bloqueioInicio}
                    onChangeText={setBloqueioInicio}
                  />
                  <Text style={styles.label}>Definir fim por</Text>
                  <View style={styles.chips}>
                    <TouchableOpacity
                      style={[
                        styles.chip,
                        bloqueioModoTempo === 'duracao' && styles.chipOn,
                      ]}
                      onPress={() => setBloqueioModoTempo('duracao')}
                    >
                      <Text
                        style={[
                          styles.chipTxt,
                          bloqueioModoTempo === 'duracao' && styles.chipTxtOn,
                        ]}
                      >
                        Duração
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.chip,
                        bloqueioModoTempo === 'ate' && styles.chipOn,
                      ]}
                      onPress={() => setBloqueioModoTempo('ate')}
                    >
                      <Text
                        style={[
                          styles.chipTxt,
                          bloqueioModoTempo === 'ate' && styles.chipTxtOn,
                        ]}
                      >
                        Até horário
                      </Text>
                    </TouchableOpacity>
                  </View>
                  {bloqueioModoTempo === 'ate' ? (
                    <Input
                      label="Fim (HH:MM)"
                      value={bloqueioFim}
                      onChangeText={setBloqueioFim}
                      placeholder="10:00"
                    />
                  ) : (
                    <>
                      <Text style={styles.label}>Duração</Text>
                      <View style={styles.chips}>
                        {DURACOES_BLOQUEIO_OPCOES.map((m) => (
                          <TouchableOpacity
                            key={`b-${m}`}
                            style={[
                              styles.chip,
                              bloqueioDuracao === m && styles.chipOn,
                            ]}
                            onPress={() => setBloqueioDuracao(m)}
                          >
                            <Text
                              style={[
                                styles.chipTxt,
                                bloqueioDuracao === m && styles.chipTxtOn,
                              ]}
                            >
                              {labelDuracaoMin(m)}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                      <Input
                        label="Outra duração (min) — ex.: 15, 20, 40"
                        value={
                          DURACOES_BLOQUEIO_OPCOES.includes(bloqueioDuracao)
                            ? ''
                            : String(bloqueioDuracao)
                        }
                        onChangeText={(t) => {
                          const n = Number(t.replace(/\D/g, ''));
                          if (n >= 5) {
                            setBloqueioDuracao(
                              Math.min(12 * 60, Math.round(n))
                            );
                          }
                        }}
                        placeholder={`Padrão: ${duracao} min`}
                        keyboardType="number-pad"
                      />
                    </>
                  )}
                </>
              ) : null}
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Quadra e tipo</Text>
              <Text style={styles.label}>Quadra</Text>
              <View style={styles.chips}>
                {quadras
                  .filter((q) => q.ativa)
                  .map((q) => (
                    <TouchableOpacity
                      key={q.id}
                      style={[
                        styles.chip,
                        bloqueioQuadraId === q.id && styles.chipOn,
                      ]}
                      onPress={() => {
                        setBloqueioQuadraId(q.id);
                        setBloqueioDuracao(
                          horarioEfetivoQuadra(agenda, q).duracaoSlotMin
                        );
                      }}
                    >
                      <Text
                        style={[
                          styles.chipTxt,
                          bloqueioQuadraId === q.id && styles.chipTxtOn,
                        ]}
                      >
                        {q.nome}
                      </Text>
                    </TouchableOpacity>
                  ))}
              </View>
              <Text style={styles.label}>Tipo</Text>
              <View style={styles.chips}>
                {TIPOS_BLOQUEIO.map((t) => (
                  <TouchableOpacity
                    key={t.id}
                    style={[styles.chip, bloqueioTipo === t.id && styles.chipOn]}
                    onPress={() => setBloqueioTipo(t.id)}
                  >
                    <Text
                      style={[
                        styles.chipTxt,
                        bloqueioTipo === t.id && styles.chipTxtOn,
                      ]}
                    >
                      {t.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Input
                label="Motivo (opcional)"
                value={bloqueioMotivo}
                onChangeText={setBloqueioMotivo}
                placeholder="Ex.: Aula professor João"
              />
              <Button
                label={
                  bloqueioAlcance === 'periodo'
                    ? `Bloquear ${bloqueioQtdDias} dia(s)`
                    : 'Bloquear horário'
                }
                loading={saving}
                onPress={() => void bloquear()}
              />
            </View>

            {reservasVisiveis.length > 0 ? (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>
                  Liberar no dia selecionado
                </Text>
                <Text style={styles.hint}>
                  Toque para cancelar e liberar o slot.
                </Text>
                {reservasVisiveis.map((r) => {
                  const ini = reservaToDate(r.inicio);
                  return (
                    <TouchableOpacity
                      key={r.id}
                      onPress={() => liberar(r)}
                      style={styles.reservaCard}
                    >
                      <Text style={styles.quadraNome}>
                        {r.quadraNome} · {labelTipoReserva(r.tipo)}
                      </Text>
                      <Text style={styles.meta}>
                        {ini?.toLocaleTimeString('pt-BR', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}{' '}
                        · {r.status}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : null}
          </View>
        ) : null}

        {aba === 'grade' ? (
          <View style={styles.panel}>
            <Text style={styles.panelTitle}>4. Ver grade</Text>
            <Text style={styles.hint}>
              Só consulta — livres e ocupados. Para bloquear, use a aba Bloquear.
            </Text>
            <View style={styles.chips}>
              {(
                [
                  { id: 'mes' as const, label: 'Mês' },
                  { id: 'semana' as const, label: 'Semana' },
                  { id: 'dia' as const, label: 'Um dia' },
                ] as const
              ).map((m) => (
                <TouchableOpacity
                  key={m.id}
                  style={[styles.chip, modoGrade === m.id && styles.chipOn]}
                  onPress={() => setModoGrade(m.id)}
                >
                  <Text
                    style={[
                      styles.chipTxt,
                      modoGrade === m.id && styles.chipTxtOn,
                    ]}
                  >
                    {m.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {modoGrade === 'mes' && clubeId ? (
              <AgendaVisaoMensal
                clubeId={clubeId}
                agenda={agenda}
                quadras={quadras}
                locale={locale}
              />
            ) : modoGrade === 'semana' && clubeId ? (
              <AgendaVisaoSemanal
                clubeId={clubeId}
                agenda={agenda}
                quadras={quadras}
                locale={locale}
              />
            ) : (
              <>
                <DiaAgendaPicker
                  locale={locale}
                  diaISO={diaISO}
                  onChange={setDiaISO}
                />
                <AgendaGradeDia grade={grade} />
              </>
            )}
          </View>
        ) : null}
      </ScrollView>

      <ButtonFooter>
        <Button
          label="Voltar ao painel"
          variant="outline"
          onPress={() => router.back()}
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
  tabs: {
    flexDirection: 'row',
    marginHorizontal: 12,
    gap: 6,
    paddingBottom: 8,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tabOn: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  tabTxt: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },
  tabTxtOn: { color: Colors.textOnAccent },
  body: { padding: 16, paddingBottom: 120, gap: 12 },
  panel: { gap: 12 },
  panelTitle: {
    color: Colors.accent,
    fontSize: 18,
    fontWeight: '800',
  },
  hint: { color: Colors.textSecondary, fontSize: 13, lineHeight: 18 },
  label: { color: Colors.textSecondary, fontSize: 13, marginTop: 8 },
  empty: { color: Colors.textSecondary, marginVertical: 8 },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    gap: 10,
  },
  cardTitle: { color: Colors.white, fontWeight: '800', fontSize: 15 },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  timeInput: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 12,
    padding: 14,
    color: Colors.white,
    fontSize: 16,
  },
  sep: { color: Colors.textSecondary },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  chipOn: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  chipTxt: { color: Colors.white, fontWeight: '600', fontSize: 13 },
  chipTxtOn: { color: Colors.textOnAccent },
  nextLink: { paddingVertical: 8, alignItems: 'flex-end' },
  nextLinkTxt: { color: Colors.accent, fontWeight: '700', fontSize: 14 },
  quadraNome: { color: Colors.white, fontWeight: '700', fontSize: 15 },
  meta: { color: Colors.textSecondary, fontSize: 12, marginTop: 2 },
  reservaCard: {
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 12,
    padding: 12,
    gap: 2,
  },
});

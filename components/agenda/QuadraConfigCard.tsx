import { useEffect, useState } from 'react';
import {
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { Radius } from '../../constants/radius';
import { ESPORTES } from '../../constants/esportes';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import {
  DURACOES_SLOT_OPCOES,
  labelDuracaoMin,
  normalizarDuracaoMin,
  type AgendaClubeConfig,
  type QuadraClube,
} from '../../types/agenda';
import type { QuadraClubeUpdate } from '../../services/agenda';

const DIAS = [
  { id: 0, label: 'Dom' },
  { id: 1, label: 'Seg' },
  { id: 2, label: 'Ter' },
  { id: 3, label: 'Qua' },
  { id: 4, label: 'Qui' },
  { id: 5, label: 'Sex' },
  { id: 6, label: 'Sáb' },
];

type Props = {
  quadra: QuadraClube;
  agenda: AgendaClubeConfig;
  expanded: boolean;
  onToggleExpand: () => void;
  onToggleAtiva: () => void;
  onSalvar: (patch: QuadraClubeUpdate) => Promise<void>;
};

export function QuadraConfigCard({
  quadra,
  agenda,
  expanded,
  onToggleExpand,
  onToggleAtiva,
  onSalvar,
}: Props) {
  const [nome, setNome] = useState(quadra.nome);
  const [usaHorarioProprio, setUsaHorarioProprio] = useState(
    Boolean(quadra.abertura || quadra.fechamento)
  );
  const [abertura, setAbertura] = useState(quadra.abertura ?? agenda.abertura);
  const [fechamento, setFechamento] = useState(
    quadra.fechamento ?? agenda.fechamento
  );
  const [usaDiasProprios, setUsaDiasProprios] = useState(
    Array.isArray(quadra.diasSemana) && quadra.diasSemana.length > 0
  );
  const [diasSemana, setDiasSemana] = useState<number[]>(
    quadra.diasSemana?.length ? [...quadra.diasSemana] : [...agenda.diasSemana]
  );
  const [usaDuracaoPropria, setUsaDuracaoPropria] = useState(
    typeof quadra.duracaoSlotMin === 'number'
  );
  const [duracaoSlotMin, setDuracaoSlotMin] = useState(
    quadra.duracaoSlotMin ?? agenda.duracaoSlotMin
  );
  const [customDur, setCustomDur] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!expanded) return;
    setNome(quadra.nome);
    setUsaHorarioProprio(Boolean(quadra.abertura || quadra.fechamento));
    setAbertura(quadra.abertura ?? agenda.abertura);
    setFechamento(quadra.fechamento ?? agenda.fechamento);
    setUsaDiasProprios(
      Array.isArray(quadra.diasSemana) && quadra.diasSemana.length > 0
    );
    setDiasSemana(
      quadra.diasSemana?.length ? [...quadra.diasSemana] : [...agenda.diasSemana]
    );
    setUsaDuracaoPropria(typeof quadra.duracaoSlotMin === 'number');
    setDuracaoSlotMin(quadra.duracaoSlotMin ?? agenda.duracaoSlotMin);
    setCustomDur('');
  }, [expanded, quadra, agenda]);

  const esporteNome =
    ESPORTES.find((e) => e.id === quadra.esporte)?.nome ?? quadra.esporte;

  const resumoHorario = `${quadra.abertura || agenda.abertura}–${
    quadra.fechamento || agenda.fechamento
  }`;
  const resumoDur = labelDuracaoMin(quadra.duracaoSlotMin ?? agenda.duracaoSlotMin);
  const temOverride =
    Boolean(quadra.abertura || quadra.fechamento) ||
    (Array.isArray(quadra.diasSemana) && quadra.diasSemana.length > 0) ||
    typeof quadra.duracaoSlotMin === 'number';

  function toggleDia(id: number) {
    setDiasSemana((prev) => {
      const has = prev.includes(id);
      return has ? prev.filter((d) => d !== id) : [...prev, id].sort();
    });
  }

  async function salvar() {
    setSaving(true);
    try {
      const patch: QuadraClubeUpdate = {
        nome: nome.trim() || quadra.nome,
        abertura: usaHorarioProprio ? abertura.trim() || agenda.abertura : null,
        fechamento: usaHorarioProprio
          ? fechamento.trim() || agenda.fechamento
          : null,
        diasSemana: usaDiasProprios
          ? diasSemana.length
            ? diasSemana
            : [...agenda.diasSemana]
          : null,
        duracaoSlotMin: usaDuracaoPropria
          ? normalizarDuracaoMin(duracaoSlotMin, agenda.duracaoSlotMin)
          : null,
      };
      await onSalvar(patch);
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={[styles.card, !quadra.ativa && styles.cardOff]}>
      <TouchableOpacity
        style={styles.header}
        onPress={onToggleExpand}
        activeOpacity={0.85}
      >
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.nome}>{quadra.nome}</Text>
          <Text style={styles.meta}>
            {esporteNome} · {resumoHorario} · {resumoDur}
            {temOverride ? ' · personalizada' : ' · padrão do clube'}
            {quadra.ativa ? '' : ' · inativa'}
          </Text>
        </View>
        <Switch
          value={quadra.ativa}
          onValueChange={onToggleAtiva}
          trackColor={{ true: Colors.accent, false: Colors.border }}
        />
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={20}
          color={Colors.accent}
          style={{ marginLeft: 4 }}
        />
      </TouchableOpacity>

      {expanded ? (
        <View style={styles.body}>
          <Input label="Nome da quadra" value={nome} onChangeText={setNome} />

          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.switchTitle}>Horário próprio</Text>
              <Text style={styles.hint}>
                Desligado = usa {agenda.abertura}–{agenda.fechamento} do clube
              </Text>
            </View>
            <Switch
              value={usaHorarioProprio}
              onValueChange={setUsaHorarioProprio}
              trackColor={{ true: Colors.accent, false: Colors.border }}
            />
          </View>
          {usaHorarioProprio ? (
            <View style={styles.row}>
              <TextInput
                style={styles.timeInput}
                value={abertura}
                onChangeText={setAbertura}
                placeholder={agenda.abertura}
                placeholderTextColor={Colors.textSecondary}
              />
              <Text style={styles.sep}>→</Text>
              <TextInput
                style={styles.timeInput}
                value={fechamento}
                onChangeText={setFechamento}
                placeholder={agenda.fechamento}
                placeholderTextColor={Colors.textSecondary}
              />
            </View>
          ) : null}

          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.switchTitle}>Dias próprios</Text>
              <Text style={styles.hint}>Desligado = mesmos dias do clube</Text>
            </View>
            <Switch
              value={usaDiasProprios}
              onValueChange={setUsaDiasProprios}
              trackColor={{ true: Colors.accent, false: Colors.border }}
            />
          </View>
          {usaDiasProprios ? (
            <View style={styles.chips}>
              {DIAS.map((d) => {
                const on = diasSemana.includes(d.id);
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
          ) : null}

          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.switchTitle}>Duração própria</Text>
              <Text style={styles.hint}>
                Desligado = {labelDuracaoMin(agenda.duracaoSlotMin)} do clube
              </Text>
            </View>
            <Switch
              value={usaDuracaoPropria}
              onValueChange={setUsaDuracaoPropria}
              trackColor={{ true: Colors.accent, false: Colors.border }}
            />
          </View>
          {usaDuracaoPropria ? (
            <>
              <View style={styles.chips}>
                {DURACOES_SLOT_OPCOES.map((m) => (
                  <TouchableOpacity
                    key={m}
                    style={[styles.chip, duracaoSlotMin === m && styles.chipOn]}
                    onPress={() => {
                      setDuracaoSlotMin(m);
                      setCustomDur('');
                    }}
                  >
                    <Text
                      style={[
                        styles.chipTxt,
                        duracaoSlotMin === m && styles.chipTxtOn,
                      ]}
                    >
                      {labelDuracaoMin(m)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Input
                label="Outra duração (min)"
                value={customDur}
                onChangeText={(t) => {
                  setCustomDur(t);
                  const n = Number(t.replace(/\D/g, ''));
                  if (n >= 15) setDuracaoSlotMin(normalizarDuracaoMin(n));
                }}
                placeholder="Ex.: 100"
                keyboardType="number-pad"
              />
            </>
          ) : null}

          <Button
            label="Salvar esta quadra"
            loading={saving}
            onPress={() => void salvar()}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  cardOff: { opacity: 0.72 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 8,
  },
  nome: { color: Colors.white, fontWeight: '800', fontSize: 16 },
  meta: { color: Colors.textSecondary, fontSize: 12, lineHeight: 16 },
  body: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 12,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
  },
  switchTitle: { color: Colors.white, fontWeight: '700', fontSize: 14 },
  hint: { color: Colors.textSecondary, fontSize: 12, marginTop: 2 },
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
});

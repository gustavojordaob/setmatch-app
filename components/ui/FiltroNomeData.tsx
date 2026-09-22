import { StyleSheet, Text, TextInput, View } from 'react-native';
import { Colors } from '../../constants/colors';
import { maskDateBR } from '../../utils/mascaras';
import { parseDataBR } from '../../utils/financeiroRelatorio';

export type FiltroNomeDataState = {
  nome: string;
  dataDe: string;
  dataAte: string;
};

type Props = {
  value: FiltroNomeDataState;
  onChange: (next: FiltroNomeDataState) => void;
  nomePlaceholder?: string;
};

/** Barra de filtro: nome + datas DD/MM/AAAA (máscara). */
export function FiltroNomeData({
  value,
  onChange,
  nomePlaceholder = 'Buscar por nome…',
}: Props) {
  return (
    <View style={styles.wrap}>
      <TextInput
        style={styles.input}
        placeholder={nomePlaceholder}
        placeholderTextColor={Colors.textSecondary}
        value={value.nome}
        onChangeText={(nome) => onChange({ ...value, nome })}
        autoCapitalize="none"
        autoCorrect={false}
      />
      <Text style={styles.hint}>Período (DD/MM/AAAA)</Text>
      <View style={styles.row}>
        <View style={styles.col}>
          <Text style={styles.label}>De</Text>
          <TextInput
            style={styles.input}
            placeholder="DD/MM/AAAA"
            placeholderTextColor={Colors.textSecondary}
            value={value.dataDe}
            onChangeText={(dataDe) => onChange({ ...value, dataDe: maskDateBR(dataDe) })}
            keyboardType="number-pad"
            maxLength={10}
          />
        </View>
        <View style={styles.col}>
          <Text style={styles.label}>Até</Text>
          <TextInput
            style={styles.input}
            placeholder="DD/MM/AAAA"
            placeholderTextColor={Colors.textSecondary}
            value={value.dataAte}
            onChangeText={(dataAte) => onChange({ ...value, dataAte: maskDateBR(dataAte) })}
            keyboardType="number-pad"
            maxLength={10}
          />
        </View>
      </View>
    </View>
  );
}

/** Timestamp Firestore-like ou Date → ms. */
export function toMs(
  v?: { seconds?: number } | Date | number | string | null
): number {
  if (v == null) return 0;
  if (typeof v === 'number') return v;
  if (v instanceof Date) return v.getTime();
  if (typeof v === 'string') {
    // YYYY-MM-DD ou DD/MM/AAAA
    if (/^\d{4}-\d{2}-\d{2}/.test(v)) {
      const d = new Date(v.slice(0, 10) + 'T12:00:00');
      return Number.isNaN(d.getTime()) ? 0 : d.getTime();
    }
    const br = parseDataBR(v);
    return br ? br.getTime() : 0;
  }
  if (typeof v === 'object' && typeof v.seconds === 'number') {
    return v.seconds * 1000;
  }
  return 0;
}

export function passaFiltroNomeData(opts: {
  nome: string;
  buscaNome: string;
  dataMs: number;
  dataDeTxt: string;
  dataAteTxt: string;
}): boolean {
  const q = opts.buscaNome.trim().toLowerCase();
  if (q && !opts.nome.toLowerCase().includes(q)) return false;

  const de = opts.dataDeTxt.length === 10 ? parseDataBR(opts.dataDeTxt) : null;
  const ate = opts.dataAteTxt.length === 10 ? parseDataBR(opts.dataAteTxt) : null;
  if (!de && !ate) return true;
  if (!opts.dataMs) return false;

  if (de) {
    const start = new Date(de);
    start.setHours(0, 0, 0, 0);
    if (opts.dataMs < start.getTime()) return false;
  }
  if (ate) {
    const end = new Date(ate);
    end.setHours(23, 59, 59, 999);
    if (opts.dataMs > end.getTime()) return false;
  }
  return true;
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 16, gap: 8, marginBottom: 4 },
  row: { flexDirection: 'row', gap: 8 },
  col: { flex: 1 },
  label: { color: Colors.textSecondary, fontSize: 11, fontWeight: '600', marginBottom: 4 },
  hint: { color: Colors.textSecondary, fontSize: 11 },
  input: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: Colors.textPrimary,
    fontSize: 14,
  },
});

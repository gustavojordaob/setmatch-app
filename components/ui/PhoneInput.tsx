import { useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import {
  formatarNacionalDigitando,
  montarTelefoneE164,
  PAISES_TELEFONE,
  paisPorDdi,
  parseTelefoneSalvo,
  soDigitos,
  type PaisTelefone,
} from '../../utils/telefoneInternacional';

type Props = {
  label?: string;
  value: string;
  onChangeValue: (e164Digits: string) => void;
  placeholder?: string;
};

export function PhoneInput({ label, value, onChangeValue, placeholder }: Props) {
  const initial = useMemo(() => parseTelefoneSalvo(value), []);
  const [ddi, setDdi] = useState(initial.ddi || '55');
  const [nacional, setNacional] = useState(initial.nacional);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [busca, setBusca] = useState('');

  useEffect(() => {
    const p = parseTelefoneSalvo(value);
    if (p.ddi !== ddi || soDigitos(p.nacional) !== soDigitos(nacional)) {
      setDdi(p.ddi);
      setNacional(p.nacional);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  function emitir(nextDdi: string, nextNacional: string) {
    onChangeValue(montarTelefoneE164(nextDdi, nextNacional));
  }

  function onNacionalChange(text: string) {
    const formatted = formatarNacionalDigitando(ddi, text);
    setNacional(formatted);
    emitir(ddi, formatted);
  }

  function escolherPais(p: PaisTelefone) {
    setDdi(p.ddi);
    setPickerOpen(false);
    setBusca('');
    emitir(p.ddi, nacional);
  }

  const pais = paisPorDdi(ddi);
  const lista = PAISES_TELEFONE.filter((p) => {
    const q = busca.trim().toLowerCase();
    if (!q) return true;
    return (
      p.nome.toLowerCase().includes(q) ||
      p.ddi.includes(q) ||
      p.iso.toLowerCase().includes(q)
    );
  });

  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={styles.row}>
        <TouchableOpacity style={styles.ddiBtn} onPress={() => setPickerOpen(true)}>
          <Text style={styles.ddiTxt}>
            {pais.iso} +{ddi}
          </Text>
          <Ionicons name="chevron-down" size={14} color={Colors.textSecondary} />
        </TouchableOpacity>
        <TextInput
          style={styles.input}
          value={formatarNacionalDigitando(ddi, nacional)}
          onChangeText={onNacionalChange}
          keyboardType="phone-pad"
          placeholder={placeholder ?? (ddi === '55' ? '(11) 99999-9999' : 'Número')}
          placeholderTextColor={Colors.textSecondary}
        />
      </View>

      <Modal visible={pickerOpen} animationType="slide" transparent>
        <Pressable style={styles.backdrop} onPress={() => setPickerOpen(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.sheetTitle}>Código do país</Text>
            <TextInput
              style={styles.search}
              value={busca}
              onChangeText={setBusca}
              placeholder="Buscar país ou DDI"
              placeholderTextColor={Colors.textSecondary}
              autoCapitalize="none"
            />
            <FlatList
              data={lista}
              keyExtractor={(item) => `${item.iso}-${item.ddi}`}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.paisRow} onPress={() => escolherPais(item)}>
                  <Text style={styles.paisNome}>
                    {item.nome} ({item.iso})
                  </Text>
                  <Text style={styles.paisDdi}>+{item.ddi}</Text>
                </TouchableOpacity>
              )}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  label: { color: Colors.textSecondary, fontSize: 13, marginLeft: 4 },
  row: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  ddiBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.surface,
    borderRadius: 60,
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  ddiTxt: { color: Colors.textPrimary, fontWeight: '700', fontSize: 13 },
  input: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 60,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: Colors.textPrimary,
    fontSize: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.surfaceDark,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
    padding: 16,
    paddingBottom: 32,
  },
  sheetTitle: {
    color: Colors.textPrimary,
    fontWeight: 'bold',
    fontSize: 18,
    marginBottom: 10,
  },
  search: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  paisRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  paisNome: { color: Colors.textPrimary, fontSize: 15 },
  paisDdi: { color: Colors.accent, fontWeight: '700' },
});

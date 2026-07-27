import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors } from '../constants/colors';
import { useClube } from '../contexts/ClubeContext';

type Props = {
  /** Se true, inclui opção "Todos" */
  allowTodos?: boolean;
};

/** Seletor de clube ativo (persiste). Usar junto com EsporteSwitcher. */
export function ClubeSwitcher({ allowTodos = true }: Props) {
  const { clubeAtivoId, setClubeAtivoId, clubesDisponiveis } = useClube();

  if (clubesDisponiveis.length === 0) {
    return (
      <Text style={styles.empty}>
        Nenhum clube neste esporte ainda. Explore rankings ou peça aulas.
      </Text>
    );
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>Clube</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {allowTodos ? (
          <TouchableOpacity
            style={[styles.chip, !clubeAtivoId && styles.chipOn]}
            onPress={() => setClubeAtivoId(null)}
          >
            <Text style={[styles.chipTxt, !clubeAtivoId && styles.chipTxtOn]}>Todos</Text>
          </TouchableOpacity>
        ) : null}
        {clubesDisponiveis.map((c) => {
          const on = c.id === clubeAtivoId;
          return (
            <TouchableOpacity
              key={c.id}
              style={[styles.chip, on && styles.chipOn]}
              onPress={() => setClubeAtivoId(c.id)}
            >
              <Text style={[styles.chipTxt, on && styles.chipTxtOn]} numberOfLines={1}>
                {c.vinculo ? '★ ' : ''}
                {c.nome}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 12 },
  label: {
    color: Colors.textPrimary,
    fontSize: 12,
    fontWeight: '700',
    opacity: 0.85,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  row: { gap: 8, paddingRight: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.12)',
    maxWidth: 180,
  },
  chipOn: { backgroundColor: Colors.accent },
  chipTxt: { color: Colors.white, fontSize: 12, fontWeight: '600' },
  chipTxtOn: { color: Colors.textOnAccent },
  empty: {
    color: Colors.textPrimary,
    opacity: 0.7,
    fontSize: 12,
    marginTop: 10,
    paddingHorizontal: 4,
  },
});

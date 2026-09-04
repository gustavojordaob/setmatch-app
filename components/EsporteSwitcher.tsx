import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors } from '../constants/colors';
import { ESPORTES } from '../constants/esportes';
import { useEsporte } from '../contexts/EsporteContext';
import { useT } from '../hooks/useI18n';
import { EsporteIcon } from './EsporteIcon';

type Props = {
  /** compact = círculos iguais à Home; chips = com nome */
  variant?: 'circles' | 'chips';
};

export function EsporteSwitcher({ variant = 'circles' }: Props) {
  const { esporteAtivo, setEsporteAtivo, esporteIndex, setEsporteIndex } = useEsporte();
  const t = useT();

  if (variant === 'chips') {
    return (
      <View style={styles.chipsRow}>
        {ESPORTES.map((e) => {
          const on = e.id === esporteAtivo;
          return (
            <TouchableOpacity
              key={e.id}
              style={[styles.chip, on && styles.chipOn]}
              onPress={() => setEsporteAtivo(e.id)}
            >
              <EsporteIcon
                id={e.id}
                size={16}
                color={on ? Colors.textOnAccent : Colors.white}
              />
              <Text style={[styles.chipTxt, on && styles.chipTxtOn]}>
                {t(`esporte.${e.id}`)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  }

  return (
    <View style={styles.sportsRow}>
      {ESPORTES.map((e, i) => {
        const on = i === esporteIndex;
        return (
          <TouchableOpacity
            key={e.id}
            onPress={() => setEsporteIndex(i)}
            style={[styles.sportCircle, on && styles.sportCircleOn]}
            accessibilityLabel={t(`esporte.${e.id}`)}
          >
            <EsporteIcon
              id={e.id}
              size={26}
              color={on ? Colors.textOnAccent : Colors.white}
            />
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  sportsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    paddingHorizontal: 8,
  },
  sportCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sportCircleOn: {
    backgroundColor: Colors.accent,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  chipOn: { backgroundColor: Colors.accent },
  chipTxt: { color: Colors.white, fontSize: 12, fontWeight: '600' },
  chipTxtOn: { color: Colors.textOnAccent },
});

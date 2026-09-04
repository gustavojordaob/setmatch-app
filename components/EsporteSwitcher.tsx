import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors } from '../constants/colors';
import { Radius } from '../constants/radius';
import { ESPORTES, type EsporteId } from '../constants/esportes';
import { useEsporte } from '../contexts/EsporteContext';
import { useT } from '../hooks/useI18n';
import { EsporteIcon } from './EsporteIcon';

type Props = {
  /**
   * circles — Home: ícone + nome (padrão Figma)
   * chips — telas internas: chip com ícone + nome
   */
  variant?: 'circles' | 'chips';
};

/** Labels curtos sob o ícone (Home) — cabem em 5 colunas. */
const SHORT: Record<EsporteId, string> = {
  tenis: 'Tênis',
  raquetinha: 'Raquetinha',
  padel: 'Padel',
  pickleball: 'Pickleball',
  beachtennis: 'Beach',
};

export function EsporteSwitcher({ variant = 'circles' }: Props) {
  const { esporteAtivo, setEsporteAtivo, esporteIndex, setEsporteIndex } =
    useEsporte();
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
              accessibilityLabel={t(`esporte.${e.id}`)}
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

  // Home: 5 modalidades sempre visíveis (sem scroll que esconde Beach)
  return (
    <View style={styles.labeledRow}>
      {ESPORTES.map((e, i) => {
        const on = i === esporteIndex;
        return (
          <TouchableOpacity
            key={e.id}
            onPress={() => setEsporteIndex(i)}
            style={styles.labeledItem}
            accessibilityLabel={t(`esporte.${e.id}`)}
            accessibilityState={{ selected: on }}
          >
            <View style={[styles.sportCircle, on && styles.sportCircleOn]}>
              <EsporteIcon id={e.id} size={24} color={Colors.white} />
            </View>
            <Text
              style={[styles.sportLabel, on && styles.sportLabelOn]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.75}
            >
              {SHORT[e.id]}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  labeledRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginTop: 14,
    paddingHorizontal: 0,
    paddingBottom: 2,
    gap: 4,
  },
  labeledItem: {
    flex: 1,
    alignItems: 'center',
    minWidth: 0,
  },
  sportCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  /** Selecionado = borda lime, fundo continua escuro */
  sportCircleOn: {
    borderColor: Colors.accent,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  sportLabel: {
    marginTop: 6,
    color: Colors.textSecondary,
    fontSize: 9,
    fontWeight: '700',
    textAlign: 'center',
    width: '100%',
  },
  sportLabelOn: {
    color: Colors.accent,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    paddingVertical: 2,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  chipOn: { backgroundColor: Colors.accent },
  chipTxt: { color: Colors.white, fontSize: 12, fontWeight: '600' },
  chipTxtOn: { color: Colors.textOnAccent },
});

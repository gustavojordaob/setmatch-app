import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '../../constants/colors';
import { Radius } from '../../constants/radius';
import { ESPORTES, type EsporteId } from '../../constants/esportes';
import { WizardLayout } from '../../components/wizard/WizardLayout';
import { useWizard } from '../../contexts/WizardContext';
import { useT } from '../../hooks/useI18n';

const ORDER: EsporteId[] = ['tenis', 'beachtennis', 'padel', 'raquetinha'];

export default function WizardEsportesScreen() {
  const router = useRouter();
  const t = useT();
  const { draft, setDraft } = useWizard();
  const selecionados = draft.esportes ?? [];

  function toggle(id: EsporteId) {
    const next = selecionados.includes(id)
      ? selecionados.filter((x) => x !== id)
      : [...selecionados, id];
    setDraft({ esportes: next });
  }

  return (
    <WizardLayout
      title={t('wizard.sportsTitle')}
      onContinue={() => router.push('/wizard/nivel')}
      continueDisabled={selecionados.length === 0}
    >
      <View style={styles.list}>
        {ORDER.map((id) => {
          const e = ESPORTES.find((x) => x.id === id)!;
          const on = selecionados.includes(id);
          return (
            <TouchableOpacity
              key={id}
              onPress={() => toggle(id)}
              style={[styles.pill, on ? styles.pillOn : styles.pillOff]}
            >
              <Text style={styles.emoji}>{e.emoji}</Text>
              <Text style={[styles.pillText, on && styles.pillTextOn]}>
                {t(`esporte.${id}`)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </WizardLayout>
  );
}

const styles = StyleSheet.create({
  list: { gap: 12, marginTop: 16 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: Radius.pill,
    borderWidth: 2,
  },
  pillOn: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  pillOff: {
    backgroundColor: 'transparent',
    borderColor: Colors.accent,
  },
  emoji: { fontSize: 22 },
  pillText: { color: Colors.textPrimary, fontWeight: 'bold', fontSize: 18 },
  pillTextOn: { color: Colors.textOnAccent },
});

import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '../../constants/colors';
import { Radius } from '../../constants/radius';
import { ESPORTES, type EsporteId } from '../../constants/esportes';
import { WizardLayout } from '../../components/wizard/WizardLayout';
import { useWizard } from '../../contexts/WizardContext';

export default function WizardEsportesScreen() {
  const router = useRouter();
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
      step={5}
      title="Quais esportes você joga?"
      onContinue={() => router.push('/wizard/nivel')}
      continueDisabled={selecionados.length === 0}
    >
      <View style={styles.pills}>
        {ESPORTES.map((e) => {
          const on = selecionados.includes(e.id);
          return (
            <TouchableOpacity
              key={e.id}
              onPress={() => toggle(e.id)}
              style={[styles.pill, on && styles.pillOn]}
            >
              <Text style={styles.emoji}>{e.emoji}</Text>
              <Text style={[styles.pillText, on && styles.pillTextOn]}>{e.nome}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </WizardLayout>
  );
}

const styles = StyleSheet.create({
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  pillOn: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  emoji: { fontSize: 18 },
  pillText: { color: Colors.textPrimary, fontWeight: '700' },
  pillTextOn: { color: Colors.textOnAccent },
});

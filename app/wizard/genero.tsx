import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '../../constants/colors';
import { Radius } from '../../constants/radius';
import { WizardLayout } from '../../components/wizard/WizardLayout';
import { useWizard } from '../../contexts/WizardContext';
import type { Genero } from '../../types/usuario';

const OPCOES: { id: Genero; label: string }[] = [
  { id: 'masculino', label: 'Masculino' },
  { id: 'feminino', label: 'Feminino' },
  { id: 'outro', label: 'Outro' },
  { id: 'prefiro_nao_dizer', label: 'Prefiro não dizer' },
];

export default function WizardGeneroScreen() {
  const router = useRouter();
  const { draft, setDraft } = useWizard();
  const selecionado = draft.genero;

  return (
    <WizardLayout
      step={2}
      title="Como você se identifica?"
      onContinue={() => router.push('/wizard/peso')}
      continueDisabled={!selecionado}
    >
      <View style={styles.list}>
        {OPCOES.map((o) => {
          const on = selecionado === o.id;
          return (
            <TouchableOpacity
              key={o.id}
              style={[styles.option, on && styles.optionOn]}
              onPress={() => setDraft({ genero: o.id })}
            >
              <Text style={[styles.label, on && styles.labelOn]}>{o.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </WizardLayout>
  );
}

const styles = StyleSheet.create({
  list: { gap: 10 },
  option: {
    padding: 16,
    borderRadius: Radius.chip,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  optionOn: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  label: { color: Colors.textPrimary, fontWeight: '700', textAlign: 'center' },
  labelOn: { color: Colors.textOnAccent },
});

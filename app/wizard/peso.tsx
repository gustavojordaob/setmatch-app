import { useState } from 'react';
import { StyleSheet, Text, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '../../constants/colors';
import { Radius } from '../../constants/radius';
import { WizardLayout } from '../../components/wizard/WizardLayout';
import { useWizard } from '../../contexts/WizardContext';

export default function WizardPesoScreen() {
  const router = useRouter();
  const { draft, setDraft } = useWizard();
  const [peso, setPeso] = useState(draft.peso ? String(draft.peso) : '');

  function continuar() {
    const n = parseFloat(peso.replace(',', '.'));
    if (!n || n < 30 || n > 250) return;
    setDraft({ peso: n });
    router.push('/wizard/altura');
  }

  return (
    <WizardLayout step={3} title="Qual seu peso (kg)?" onContinue={continuar} continueDisabled={!peso}>
      <TextInput
        style={styles.input}
        placeholder="Ex: 75"
        placeholderTextColor={Colors.textSecondary}
        keyboardType="decimal-pad"
        value={peso}
        onChangeText={setPeso}
      />
      <Text style={styles.hint}>kg</Text>
    </WizardLayout>
  );
}

const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    borderRadius: Radius.chip,
    padding: 16,
    color: Colors.textPrimary,
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
  },
  hint: { color: Colors.textSecondary, textAlign: 'center', marginTop: 8 },
});

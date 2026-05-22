import { useState } from 'react';
import { StyleSheet, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '../../constants/colors';
import { Radius } from '../../constants/radius';
import { WizardLayout } from '../../components/wizard/WizardLayout';
import { useWizard } from '../../contexts/WizardContext';

export default function WizardIdadeScreen() {
  const router = useRouter();
  const { draft, setDraft } = useWizard();
  const [idade, setIdade] = useState(draft.idade ? String(draft.idade) : '');

  function continuar() {
    const n = parseInt(idade, 10);
    if (!n || n < 10 || n > 99) return;
    setDraft({ idade: n });
    router.push('/wizard/genero');
  }

  return (
    <WizardLayout
      step={1}
      title="Quantos anos você tem?"
      onContinue={continuar}
      continueDisabled={!idade.trim()}
    >
      <TextInput
        style={styles.input}
        placeholder="Ex: 28"
        placeholderTextColor={Colors.textSecondary}
        keyboardType="number-pad"
        maxLength={2}
        value={idade}
        onChangeText={setIdade}
      />
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
});

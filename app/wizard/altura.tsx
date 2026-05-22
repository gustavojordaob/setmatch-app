import { useState } from 'react';
import { StyleSheet, Text, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '../../constants/colors';
import { Radius } from '../../constants/radius';
import { WizardLayout } from '../../components/wizard/WizardLayout';
import { useWizard } from '../../contexts/WizardContext';

export default function WizardAlturaScreen() {
  const router = useRouter();
  const { draft, setDraft } = useWizard();
  const [altura, setAltura] = useState(draft.altura ? String(draft.altura) : '');

  function continuar() {
    const n = parseInt(altura, 10);
    if (!n || n < 100 || n > 230) return;
    setDraft({ altura: n });
    router.push('/wizard/esportes');
  }

  return (
    <WizardLayout
      step={4}
      title="Qual sua altura (cm)?"
      onContinue={continuar}
      continueDisabled={!altura}
    >
      <TextInput
        style={styles.input}
        placeholder="Ex: 175"
        placeholderTextColor={Colors.textSecondary}
        keyboardType="number-pad"
        maxLength={3}
        value={altura}
        onChangeText={setAltura}
      />
      <Text style={styles.hint}>cm</Text>
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

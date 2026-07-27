import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { WizardLayout } from '../../components/wizard/WizardLayout';
import { Input } from '../../components/ui/Input';
import { useWizard } from '../../contexts/WizardContext';
import { Colors } from '../../constants/colors';
import { formatarTelefoneExibicao } from '../../utils/whatsapp';

export default function WizardTelefoneScreen() {
  const router = useRouter();
  const { draft, setDraft } = useWizard();
  const [telefone, setTelefone] = useState(draft.telefone ?? '');

  function onChange(t: string) {
    setTelefone(formatarTelefoneExibicao(t));
  }

  function continuar() {
    const digits = telefone.replace(/\D/g, '');
    if (digits.length < 10) return;
    setDraft({ telefone: telefone.trim() });
    router.push('/wizard/endereco');
  }

  const digits = telefone.replace(/\D/g, '');

  return (
    <WizardLayout
      title="Qual o seu celular?"
      onContinue={continuar}
      continueDisabled={digits.length < 10}
    >
      <Text style={styles.hint}>
        Usado para WhatsApp com amigos, clubes e confirmações de torneio.
      </Text>
      <View style={styles.form}>
        <Input
          label="Celular com DDD"
          placeholder="(11) 99999-9999"
          value={telefone}
          onChangeText={onChange}
          keyboardType="phone-pad"
        />
      </View>
    </WizardLayout>
  );
}

const styles = StyleSheet.create({
  hint: { color: Colors.textSecondary, marginTop: 8, marginBottom: 4, lineHeight: 20 },
  form: { gap: 14, marginTop: 12 },
});

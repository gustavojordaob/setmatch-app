import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { WizardLayout } from '../../components/wizard/WizardLayout';
import { PhoneInput } from '../../components/ui/PhoneInput';
import { useWizard } from '../../contexts/WizardContext';
import { Colors } from '../../constants/colors';
import { useT } from '../../hooks/useI18n';
import { telefoneSalvoValido } from '../../utils/telefoneInternacional';

export default function WizardTelefoneScreen() {
  const router = useRouter();
  const t = useT();
  const { draft, setDraft } = useWizard();
  const [telefone, setTelefone] = useState(draft.telefone ?? '');

  function continuar() {
    if (!telefoneSalvoValido(telefone)) return;
    setDraft({ telefone: telefone.replace(/\D/g, '') });
    router.push('/wizard/endereco');
  }

  return (
    <WizardLayout
      title={t('wizard.phoneTitle')}
      onContinue={continuar}
      continueDisabled={!telefoneSalvoValido(telefone)}
    >
      <Text style={styles.hint}>{t('wizard.phoneHint')}</Text>
      <View style={styles.form}>
        <PhoneInput
          label={t('wizard.phoneLabel')}
          value={telefone}
          onChangeValue={setTelefone}
        />
      </View>
    </WizardLayout>
  );
}

const styles = StyleSheet.create({
  hint: { color: Colors.textSecondary, marginTop: 8, marginBottom: 4, lineHeight: 20 },
  form: { gap: 14, marginTop: 12 },
});

import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { WizardLayout } from '../../components/wizard/WizardLayout';
import { Input } from '../../components/ui/Input';
import { useWizard } from '../../contexts/WizardContext';
import { useT } from '../../hooks/useI18n';

export default function WizardEnderecoScreen() {
  const router = useRouter();
  const t = useT();
  const { draft, setDraft } = useWizard();
  const [cidade, setCidade] = useState(draft.cidade ?? '');
  const [bairro, setBairro] = useState(draft.bairro ?? '');
  const [estado, setEstado] = useState(draft.estado ?? '');
  const [cep, setCep] = useState(draft.cep ?? '');
  const [rua, setRua] = useState(draft.rua ?? '');

  function continuar() {
    setDraft({
      cidade: cidade.trim(),
      bairro: bairro.trim(),
      estado: estado.trim().toUpperCase(),
      cep: cep.trim(),
      rua: rua.trim(),
    });
    router.push('/wizard/peso');
  }

  return (
    <WizardLayout
      title={t('wizard.addressTitle')}
      onContinue={continuar}
      continueDisabled={!cidade.trim()}
    >
      <View style={styles.form}>
        <Input
          label={t('wizard.city')}
          placeholder={t('wizard.cityPlaceholder')}
          value={cidade}
          onChangeText={setCidade}
        />
        <Input
          label={t('wizard.neighborhood')}
          placeholder={t('wizard.neighborhoodPlaceholder')}
          value={bairro}
          onChangeText={setBairro}
        />
        <Input
          label={t('wizard.stateUf')}
          placeholder={t('wizard.statePlaceholder')}
          value={estado}
          onChangeText={setEstado}
          maxLength={2}
          autoCapitalize="characters"
        />
        <Input
          label={t('wizard.zip')}
          placeholder={t('wizard.zipPlaceholder')}
          value={cep}
          onChangeText={setCep}
          keyboardType="number-pad"
        />
        <Input
          label={t('wizard.street')}
          placeholder={t('wizard.streetPlaceholder')}
          value={rua}
          onChangeText={setRua}
        />
      </View>
    </WizardLayout>
  );
}

const styles = StyleSheet.create({
  form: { gap: 14, marginTop: 12 },
});

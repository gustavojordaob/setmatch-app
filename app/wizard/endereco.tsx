import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { WizardLayout } from '../../components/wizard/WizardLayout';
import { Input } from '../../components/ui/Input';
import { useWizard } from '../../contexts/WizardContext';

export default function WizardEnderecoScreen() {
  const router = useRouter();
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
      title="Onde você joga?"
      onContinue={continuar}
      continueDisabled={!cidade.trim()}
    >
      <View style={styles.form}>
        <Input
          label="Cidade"
          placeholder="Ex: São Paulo"
          value={cidade}
          onChangeText={setCidade}
        />
        <Input
          label="Bairro"
          placeholder="Ex: Pinheiros"
          value={bairro}
          onChangeText={setBairro}
        />
        <Input
          label="Estado (UF)"
          placeholder="SP"
          value={estado}
          onChangeText={setEstado}
          maxLength={2}
          autoCapitalize="characters"
        />
        <Input
          label="CEP"
          placeholder="00000-000"
          value={cep}
          onChangeText={setCep}
          keyboardType="number-pad"
        />
        <Input
          label="Rua / referência"
          placeholder="Opcional — perto de qual quadra?"
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

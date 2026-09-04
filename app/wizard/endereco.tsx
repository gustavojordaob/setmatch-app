import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { WizardLayout } from '../../components/wizard/WizardLayout';
import { Input } from '../../components/ui/Input';
import { KEYBOARD_DONE_NATIVE_ID } from '../../components/ui/KeyboardDoneBar';
import { useWizard } from '../../contexts/WizardContext';
import { Colors } from '../../constants/colors';
import { useT } from '../../hooks/useI18n';
import {
  buscarEnderecoPorCep,
  formatarCepDigitando,
  soDigitosCep,
} from '../../utils/viacep';

export default function WizardEnderecoScreen() {
  const router = useRouter();
  const t = useT();
  const { draft, setDraft } = useWizard();
  const [cep, setCep] = useState(
    draft.cep ? formatarCepDigitando(draft.cep) : ''
  );
  const [cidade, setCidade] = useState(draft.cidade ?? '');
  const [bairro, setBairro] = useState(draft.bairro ?? '');
  const [estado, setEstado] = useState(draft.estado ?? '');
  const [rua, setRua] = useState(draft.rua ?? '');
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [cepErro, setCepErro] = useState('');
  const ultimoCepBuscado = useRef('');

  useEffect(() => {
    const digitos = soDigitosCep(cep);
    if (digitos.length !== 8) {
      setCepErro('');
      return;
    }
    if (digitos === ultimoCepBuscado.current) return;

    let cancelled = false;
    void (async () => {
      setBuscandoCep(true);
      setCepErro('');
      const end = await buscarEnderecoPorCep(digitos);
      if (cancelled) return;
      setBuscandoCep(false);
      ultimoCepBuscado.current = digitos;
      if (!end) {
        setCepErro(t('wizard.zipNotFound'));
        return;
      }
      setCidade(end.localidade);
      setEstado(end.uf);
      if (end.bairro) setBairro(end.bairro);
      if (end.logradouro) setRua(end.logradouro);
    })();

    return () => {
      cancelled = true;
    };
  }, [cep, t]);

  function onCepChange(text: string) {
    const formatted = formatarCepDigitando(text);
    setCep(formatted);
    if (soDigitosCep(formatted).length < 8) {
      ultimoCepBuscado.current = '';
      setCepErro('');
    }
  }

  function continuar() {
    setDraft({
      cidade: cidade.trim(),
      bairro: bairro.trim(),
      estado: estado.trim().toUpperCase(),
      cep: soDigitosCep(cep),
      rua: rua.trim(),
    });
    router.push('/wizard/peso');
  }

  return (
    <WizardLayout
      title={t('wizard.addressTitle')}
      onContinue={continuar}
      continueDisabled={!cidade.trim() || buscandoCep}
    >
      <View style={styles.form}>
        <View>
          <Input
            label={t('wizard.zip')}
            placeholder={t('wizard.zipPlaceholder')}
            value={cep}
            onChangeText={onCepChange}
            keyboardType="number-pad"
            inputAccessoryViewID={KEYBOARD_DONE_NATIVE_ID}
            maxLength={9}
          />
          {buscandoCep ? (
            <View style={styles.cepStatus}>
              <ActivityIndicator size="small" color={Colors.accent} />
              <Text style={styles.cepStatusTxt}>{t('wizard.zipLookingUp')}</Text>
            </View>
          ) : null}
          {cepErro && !buscandoCep ? (
            <Text style={styles.cepErro}>{cepErro}</Text>
          ) : null}
        </View>

        <Input
          label={t('wizard.city')}
          placeholder={t('wizard.cityPlaceholder')}
          value={cidade}
          onChangeText={setCidade}
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
          label={t('wizard.neighborhood')}
          placeholder={t('wizard.neighborhoodPlaceholder')}
          value={bairro}
          onChangeText={setBairro}
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
  cepStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    marginLeft: 4,
  },
  cepStatusTxt: { color: Colors.textSecondary, fontSize: 13 },
  cepErro: { color: Colors.danger, fontSize: 13, marginTop: 8, marginLeft: 4 },
});

import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '../../constants/colors';
import { Radius } from '../../constants/radius';
import { WizardLayout } from '../../components/wizard/WizardLayout';
import { useWizard } from '../../contexts/WizardContext';
import { useT } from '../../hooks/useI18n';
import type { Genero } from '../../types/usuario';

export default function WizardGeneroScreen() {
  const router = useRouter();
  const t = useT();
  const { draft, setDraft } = useWizard();
  const selecionado = draft.genero;

  return (
    <WizardLayout
      title={t('wizard.genderTitle')}
      onContinue={() => router.push('/wizard/telefone')}
      continueDisabled={!selecionado}
    >
      <View style={styles.row}>
        <GenderCircle
          symbol="♂"
          label={t('wizard.genderMale')}
          selected={selecionado === 'masculino'}
          onPress={() => setDraft({ genero: 'masculino' as Genero })}
        />
        <GenderCircle
          symbol="♀"
          label={t('wizard.genderFemale')}
          selected={selecionado === 'feminino'}
          onPress={() => setDraft({ genero: 'feminino' as Genero })}
        />
      </View>

      <TouchableOpacity
        style={[
          styles.skipBtn,
          selecionado === 'prefiro_nao_dizer' && styles.skipBtnOn,
        ]}
        onPress={() => setDraft({ genero: 'prefiro_nao_dizer' as Genero })}
      >
        <Text
          style={[
            styles.skipTxt,
            selecionado === 'prefiro_nao_dizer' && styles.skipTxtOn,
          ]}
        >
          {t('wizard.genderPreferNot')}
        </Text>
      </TouchableOpacity>
    </WizardLayout>
  );
}

function GenderCircle({
  symbol,
  label,
  selected,
  onPress,
}: {
  symbol: string;
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.col}>
      <View style={[styles.circle, selected && styles.circleOn]}>
        <Text style={[styles.symbol, selected && styles.symbolOn]}>{symbol}</Text>
      </View>
      <Text style={styles.label}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 40,
    marginTop: 40,
  },
  col: { alignItems: 'center', gap: 12 },
  circle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleOn: { borderColor: Colors.accent },
  symbol: { fontSize: 48, color: Colors.white },
  symbolOn: { color: Colors.accent },
  label: { color: Colors.textPrimary, fontWeight: 'bold', fontSize: 16 },
  skipBtn: {
    alignSelf: 'center',
    marginTop: 36,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: Radius.pill,
    borderWidth: 1.5,
    borderColor: Colors.white,
    minHeight: 48,
    justifyContent: 'center',
  },
  skipBtnOn: {
    borderColor: Colors.accent,
    backgroundColor: Colors.accent,
  },
  skipTxt: {
    color: Colors.textPrimary,
    fontWeight: '700',
    fontSize: 15,
    textAlign: 'center',
  },
  skipTxtOn: { color: Colors.textOnAccent },
});

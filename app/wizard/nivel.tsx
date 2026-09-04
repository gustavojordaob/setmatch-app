import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '../../constants/colors';
import { Radius } from '../../constants/radius';
import { NIVEIS } from '../../constants/niveis';
import { WizardLayout } from '../../components/wizard/WizardLayout';
import { useWizard } from '../../contexts/WizardContext';
import { useT } from '../../hooks/useI18n';
import type { NivelAtividade } from '../../types/usuario';

const NIVEL_KEYS: Record<
  NivelAtividade,
  { label: string; desc: string }
> = {
  iniciante: {
    label: 'wizard.level.beginner',
    desc: 'wizard.level.beginnerDesc',
  },
  intermediario: {
    label: 'wizard.level.intermediate',
    desc: 'wizard.level.intermediateDesc',
  },
  avancado: {
    label: 'wizard.level.advanced',
    desc: 'wizard.level.advancedDesc',
  },
};

export default function WizardNivelScreen() {
  const router = useRouter();
  const t = useT();
  const { draft, setDraft } = useWizard();
  const selecionado = draft.nivel ?? 'intermediario';

  return (
    <WizardLayout
      title={t('wizard.levelTitle')}
      continueLabel={t('wizard.finish')}
      onContinue={() => router.push('/wizard/foto')}
    >
      <View style={styles.list}>
        {NIVEIS.map((n) => {
          const on = selecionado === n.id;
          const keys = NIVEL_KEYS[n.id];
          return (
            <TouchableOpacity
              key={n.id}
              style={[styles.card, on && styles.cardOn]}
              onPress={() => setDraft({ nivel: n.id as NivelAtividade })}
            >
              <View style={[styles.radio, on && styles.radioOn]} />
              <View style={styles.texts}>
                <Text style={styles.label}>{t(keys.label)}</Text>
                <Text style={styles.desc}>{t(keys.desc)}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </WizardLayout>
  );
}

const styles = StyleSheet.create({
  list: { gap: 12, marginTop: 8 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: Colors.surface,
    borderRadius: Radius.card,
    padding: 16,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  cardOn: { borderColor: Colors.accent },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: Colors.white,
  },
  radioOn: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  texts: { flex: 1 },
  label: { color: Colors.textPrimary, fontWeight: 'bold', fontSize: 17 },
  desc: { color: Colors.textSecondary, fontSize: 13, marginTop: 4 },
});

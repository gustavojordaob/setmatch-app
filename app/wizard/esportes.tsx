import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '../../constants/colors';
import { Radius } from '../../constants/radius';
import { ESPORTES_ORDEM, type EsporteId } from '../../constants/esportes';
import { EsporteIcon } from '../../components/EsporteIcon';
import { WizardLayout } from '../../components/wizard/WizardLayout';
import { useWizard } from '../../contexts/WizardContext';
import { useT } from '../../hooks/useI18n';

export default function WizardEsportesScreen() {
  const router = useRouter();
  const t = useT();
  const { draft, setDraft } = useWizard();
  const selecionados = draft.esportes ?? [];

  function toggle(id: EsporteId) {
    const next = selecionados.includes(id)
      ? selecionados.filter((x) => x !== id)
      : [...selecionados, id];
    setDraft({ esportes: next });
  }

  return (
    <WizardLayout
      title={t('wizard.sportsTitle')}
      onContinue={() => router.push('/wizard/nivel')}
      continueDisabled={selecionados.length === 0}
    >
      <Text style={styles.hint}>{t('wizard.sportsHint')}</Text>
      <View style={styles.list}>
        {ESPORTES_ORDEM.map((id) => {
          const on = selecionados.includes(id);
          return (
            <TouchableOpacity
              key={id}
              onPress={() => toggle(id)}
              style={[styles.card, on ? styles.cardOn : styles.cardOff]}
              activeOpacity={0.85}
            >
              <View style={styles.row}>
                <View style={[styles.iconWrap, on && styles.iconWrapOn]}>
                  <EsporteIcon
                    id={id}
                    size={26}
                    color={on ? Colors.textOnAccent : Colors.accent}
                  />
                </View>
                <View style={styles.texts}>
                  <Text style={[styles.name, on && styles.nameOn]}>
                    {t(`esporte.${id}`)}
                  </Text>
                  <Text style={[styles.desc, on && styles.descOn]}>
                    {t(`esporte.${id}Desc`)}
                  </Text>
                </View>
                <View style={[styles.check, on && styles.checkOn]}>
                  {on ? <Text style={styles.checkMark}>✓</Text> : null}
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </WizardLayout>
  );
}

const styles = StyleSheet.create({
  hint: {
    color: Colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
    marginBottom: 4,
  },
  list: { gap: 12, marginTop: 12 },
  card: {
    borderRadius: Radius.card,
    borderWidth: 2,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  cardOn: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  cardOff: {
    backgroundColor: Colors.surface,
    borderColor: 'transparent',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(199,217,65,0.15)',
  },
  iconWrapOn: {
    backgroundColor: 'rgba(26,26,26,0.15)',
  },
  texts: { flex: 1, gap: 4 },
  name: { color: Colors.textPrimary, fontWeight: 'bold', fontSize: 17 },
  nameOn: { color: Colors.textOnAccent },
  desc: { color: Colors.textSecondary, fontSize: 13, lineHeight: 18 },
  descOn: { color: Colors.textOnAccent, opacity: 0.85 },
  check: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: {
    backgroundColor: Colors.surfaceDark,
    borderColor: Colors.surfaceDark,
  },
  checkMark: { color: Colors.accent, fontWeight: 'bold', fontSize: 14 },
});

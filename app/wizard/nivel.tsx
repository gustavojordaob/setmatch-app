import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '../../constants/colors';
import { Radius } from '../../constants/radius';
import { NIVEIS } from '../../constants/niveis';
import { WizardLayout } from '../../components/wizard/WizardLayout';
import { useWizard } from '../../contexts/WizardContext';
import type { NivelAtividade } from '../../types/usuario';

export default function WizardNivelScreen() {
  const router = useRouter();
  const { draft, setDraft } = useWizard();
  const selecionado = draft.nivel ?? 'intermediario';

  return (
    <WizardLayout
      title="Qual o seu nível?"
      continueLabel="Finalizar"
      onContinue={() => router.push('/wizard/foto')}
    >
      <View style={styles.list}>
        {NIVEIS.map((n) => {
          const on = selecionado === n.id;
          return (
            <TouchableOpacity
              key={n.id}
              style={[styles.card, on && styles.cardOn]}
              onPress={() => setDraft({ nivel: n.id as NivelAtividade })}
            >
              <View style={[styles.radio, on && styles.radioOn]} />
              <View style={styles.texts}>
                <Text style={styles.label}>{n.label}</Text>
                <Text style={styles.desc}>{n.desc}</Text>
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

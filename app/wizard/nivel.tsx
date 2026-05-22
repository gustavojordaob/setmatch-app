import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '../../constants/colors';
import { Radius } from '../../constants/radius';
import { NIVEIS } from '../../constants/niveis';
import { WizardLayout } from '../../components/wizard/WizardLayout';
import { useWizard } from '../../contexts/WizardContext';

export default function WizardNivelScreen() {
  const router = useRouter();
  const { draft, setDraft } = useWizard();
  const selecionado = draft.nivel;

  return (
    <WizardLayout
      step={6}
      title="Qual seu nível de jogo?"
      onContinue={() => router.push('/wizard/foto')}
      continueDisabled={!selecionado}
    >
      <View style={styles.list}>
        {NIVEIS.map((n) => {
          const on = selecionado === n.id;
          return (
            <TouchableOpacity
              key={n.id}
              style={[styles.card, on && styles.cardOn]}
              onPress={() => setDraft({ nivel: n.id })}
            >
              <Text style={[styles.label, on && styles.labelOn]}>{n.label}</Text>
              <Text style={[styles.desc, on && styles.descOn]}>{n.desc}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </WizardLayout>
  );
}

const styles = StyleSheet.create({
  list: { gap: 10 },
  card: {
    padding: 16,
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  cardOn: { backgroundColor: Colors.surfaceGreen, borderColor: Colors.accent },
  label: { color: Colors.textPrimary, fontWeight: '800', fontSize: 17 },
  labelOn: { color: Colors.accent },
  desc: { color: Colors.textSecondary, marginTop: 4, fontSize: 13 },
  descOn: { color: Colors.textSecondary },
});

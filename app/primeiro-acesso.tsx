import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../constants/colors';
import { Typography } from '../constants/typography';
import { Button } from '../components/ui/Button';
import { useAuth } from '../hooks/useAuth';

export default function PrimeiroAcessoScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const nome = user?.displayName?.split(' ')[0] ?? 'Jogador';

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.content}>
        <Text style={styles.emoji}>👋</Text>
        <Text style={styles.title}>Olá, {nome}!</Text>
        <Text style={styles.sub}>
          Vamos montar seu perfil de jogador em poucos passos para personalizar desafios e
          estatísticas.
        </Text>
      </View>
      <Button
        title="Começar"
        variant="primary"
        onPress={() => router.push('/wizard/idade')}
        style={styles.cta}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  content: { flex: 1, paddingHorizontal: 28, justifyContent: 'center', alignItems: 'center' },
  emoji: { fontSize: 64, marginBottom: 16 },
  title: { ...Typography.userName, color: Colors.textPrimary, textAlign: 'center' },
  sub: { color: Colors.textSecondary, textAlign: 'center', lineHeight: 24, marginTop: 12 },
  cta: { marginHorizontal: 24, marginBottom: 24 },
});

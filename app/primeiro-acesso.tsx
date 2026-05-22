import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../constants/colors';
import { Button } from '../components/ui/Button';
import { useAuth } from '../hooks/useAuth';

export default function PrimeiroAcessoScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const nome = user?.displayName?.split(' ')[0] ?? 'Jogador';

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.content}>
        <Text style={styles.title}>Bem Vindo {nome}</Text>
        <Text style={styles.sub}>
          Chegou a sua hora de subir de nível. Precisamos de algumas informações sobre você para
          prepararmos uma experiência personalizada. Não perca tempo, chegou a hora de se desafiar
          com SetMatch.
        </Text>
      </View>
      <Button
        label="Vamos Lá"
        onPress={() => router.push('/wizard/idade')}
        style={styles.cta}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  content: {
    flex: 1,
    paddingHorizontal: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    color: Colors.textPrimary,
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  sub: {
    color: Colors.textPrimary,
    textAlign: 'center',
    lineHeight: 24,
    marginTop: 20,
    fontSize: 16,
  },
  cta: { marginHorizontal: 24, marginBottom: 24 },
});

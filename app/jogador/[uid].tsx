import { StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../constants/colors';

export default function JogadorScreen() {
  const { uid } = useLocalSearchParams<{ uid: string }>();

  return (
    <SafeAreaView style={styles.safe}>
      <Text style={styles.title}>Jogador</Text>
      <Text style={styles.sub}>UID: {uid}</Text>
      <View style={styles.box}>
        <Text style={styles.hint}>MVP: análise do oponente, VS e desafiar virão aqui.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background, padding: 16 },
  title: { color: Colors.textPrimary, fontSize: 24, fontWeight: '900' },
  sub: { color: Colors.textSecondary, marginTop: 8 },
  box: {
    marginTop: 20,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  hint: { color: Colors.textSecondary, lineHeight: 20 },
});

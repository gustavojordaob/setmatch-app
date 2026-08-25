import { StyleSheet, Text, View, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../constants/colors';

export default function PagamentoCanceladoScreen() {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.box}>
        <Text style={styles.title}>Pagamento cancelado</Text>
        <Text style={styles.sub}>
          Nada foi cobrado. Volte ao app e tente de novo quando quiser.
        </Text>
        <Text
          style={styles.link}
          onPress={() => void Linking.openURL('setmatch://pagamentos')}
        >
          Abrir Rally Up
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background, justifyContent: 'center' },
  box: { padding: 28, gap: 12 },
  title: { color: Colors.textPrimary, fontSize: 24, fontWeight: 'bold' },
  sub: { color: Colors.textSecondary, fontSize: 16, lineHeight: 22 },
  link: { color: Colors.accent, fontWeight: 'bold', marginTop: 16, fontSize: 16 },
});

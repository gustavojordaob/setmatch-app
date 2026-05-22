import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../constants/colors';

const TAB_PAD_BOTTOM = 88;

export default function EstatisticasScreen() {
  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe}>
        <Text style={styles.title}>Estatísticas</Text>
        <Text style={styles.sub}>Em breve: gráficos e evolução do seu jogo.</Text>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background, paddingBottom: TAB_PAD_BOTTOM },
  safe: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  title: { color: Colors.textPrimary, fontSize: 28, fontWeight: 'bold' },
  sub: { color: Colors.textSecondary, marginTop: 12, textAlign: 'center' },
});

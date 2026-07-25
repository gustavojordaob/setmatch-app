import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { RankingCard, type RankingRow } from '../../components/ranking/RankingCard';

const TAB_PAD_BOTTOM = 100;

const GLOBAL: RankingRow[] = [
  { id: '1', nome: 'Username', pts: 800 },
  { id: '2', nome: 'Username', pts: 800 },
  { id: '3', nome: 'Username', pts: 800 },
];

const WINNER: RankingRow[] = [
  { id: '4', nome: 'Username', pts: 800 },
  { id: '5', nome: 'Username', pts: 800 },
  { id: '6', nome: 'Username', pts: 800 },
];

export default function TrofeuScreen() {
  const router = useRouter();

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.safe}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} accessibilityLabel="Voltar">
            <Ionicons name="arrow-back" size={26} color={Colors.accent} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.bell}
            onPress={() => router.push('/(tabs)/notificacoes')}
            accessibilityLabel="Notificações"
          >
            <Ionicons name="notifications-outline" size={22} color={Colors.white} />
            <View style={styles.bellDot} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: TAB_PAD_BOTTOM }]}>
          <View style={styles.titleRow}>
            <Ionicons name="trophy" size={36} color={Colors.accent} />
            <Text style={styles.title}>RANKINGS</Text>
          </View>

          <RankingCard title="Global" rows={GLOBAL} />
          <RankingCard title="Winner" rows={WINNER} pinned badge="B" />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  safe: { flex: 1 },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  bell: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellDot: {
    position: 'absolute',
    top: 10,
    right: 12,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.accent,
  },
  scroll: { paddingHorizontal: 20, paddingTop: 12 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 28,
  },
  title: {
    color: Colors.accent,
    fontSize: 36,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
});

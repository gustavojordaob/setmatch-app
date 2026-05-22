import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { Radius } from '../../constants/radius';

type TabNotif = 'lembretes' | 'sistema';

const TAB_PAD_BOTTOM = 88;

const MOCK_HOJE = [
  { hora: '10:30 AM', id: '1' },
  { hora: '9:00 AM', id: '2' },
];

const MOCK_ONTEM = [{ hora: '6:15 PM', id: '3' }];

export default function NotificacoesScreen() {
  const router = useRouter();
  const [aba, setAba] = useState<TabNotif>('lembretes');

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.safe}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.back}>←</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Notificações</Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.toggleRow}>
          <TouchableOpacity
            style={[styles.toggleBtn, aba === 'lembretes' && styles.toggleOn]}
            onPress={() => setAba('lembretes')}
          >
            <Text style={[styles.toggleTxt, aba === 'lembretes' && styles.toggleTxtOn]}>
              LEMBRETES
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, aba === 'sistema' && styles.toggleOn]}
            onPress={() => setAba('sistema')}
          >
            <Text style={[styles.toggleTxt, aba === 'sistema' && styles.toggleTxtOn]}>
              SISTEMA
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={{ paddingBottom: TAB_PAD_BOTTOM, paddingHorizontal: 20 }}>
          <Text style={styles.section}>Hoje</Text>
          {MOCK_HOJE.map((n) => (
            <NotifCard key={n.id} hora={n.hora} />
          ))}

          <Text style={[styles.section, { marginTop: 20 }]}>Ontem</Text>
          {MOCK_ONTEM.map((n) => (
            <NotifCard key={n.id} hora={n.hora} />
          ))}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function NotifCard({ hora }: { hora: string }) {
  return (
    <View style={styles.card}>
      <View style={styles.iconBox}>
        <Ionicons name="trophy" size={22} color={Colors.accent} />
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.cardTitle}>Notificação</Text>
        <Text style={styles.cardSub}>Texto Placeholder para as notificações.</Text>
      </View>
      <Text style={styles.hora}>{hora}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  safe: { flex: 1 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    marginBottom: 16,
  },
  back: { color: Colors.accent, fontSize: 28, fontWeight: 'bold', width: 40 },
  title: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  headerSpacer: { width: 40 },
  toggleRow: {
    flexDirection: 'row',
    marginHorizontal: 20,
    backgroundColor: Colors.surfaceDark,
    borderRadius: Radius.pill,
    padding: 4,
    marginBottom: 20,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: Radius.pill,
    alignItems: 'center',
  },
  toggleOn: { backgroundColor: Colors.accent },
  toggleTxt: { color: Colors.white, fontWeight: 'bold', fontSize: 13 },
  toggleTxtOn: { color: Colors.textOnAccent },
  section: { color: Colors.textPrimary, fontWeight: 'bold', fontSize: 16, marginBottom: 10 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceDark,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    gap: 12,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: { flex: 1 },
  cardTitle: { color: Colors.textPrimary, fontWeight: 'bold' },
  cardSub: { color: Colors.textSecondary, fontSize: 12, marginTop: 4 },
  hora: { color: Colors.textSecondary, fontSize: 11 },
});

import { useMemo, useState } from 'react';
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { ESPORTES } from '../../constants/esportes';
import { Radius } from '../../constants/radius';
import { Typography } from '../../constants/typography';
import { Avatar } from '../../components/ui/Avatar';
import { RecentMatchCard } from '../../components/home/RecentMatchCard';
import { useAuth } from '../../hooks/useAuth';

type TabKey = 'resultados' | 'proximas';

const TAB_PAD_BOTTOM = 88;

export default function HomeScreen() {
  const router = useRouter();
  const { user, perfil } = useAuth();
  const [aba, setAba] = useState<TabKey>('resultados');
  const [esporteAtivo, setEsporteAtivo] = useState(0);

  const nome = perfil?.nome ?? user?.displayName ?? 'Gustavo';
  const record = useMemo(() => {
    const v = perfil?.vitorias ?? 30;
    const d = perfil?.derrotas ?? 7;
    return `${v}V ${d}D`;
  }, [perfil?.vitorias, perfil?.derrotas]);

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.headerSafe}>
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View style={styles.headerLeft}>
              <Avatar
                uri={perfil?.fotoUrl ?? user?.photoURL}
                nome={nome}
                size="md"
                verified
              />
              <View>
                <Text style={styles.nome}>
                  {nome} ✓
                </Text>
                <Text style={styles.record}>{record}</Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.bell}
              onPress={() => router.push('/(tabs)/notificacoes')}
            >
              <Ionicons name="notifications-outline" size={22} color={Colors.white} />
              <View style={styles.bellDot} />
            </TouchableOpacity>
          </View>

          <View style={styles.sportsRow}>
            {ESPORTES.map((e, i) => {
              const on = i === esporteAtivo;
              return (
                <TouchableOpacity
                  key={e.id}
                  onPress={() => setEsporteAtivo(i)}
                  style={[styles.sportCircle, on && styles.sportCircleOn]}
                >
                  <Text style={[styles.sportEmoji, !on && styles.sportEmojiOff]}>{e.emoji}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </SafeAreaView>

      <ScrollView
        style={styles.bodyScroll}
        contentContainerStyle={{ paddingBottom: TAB_PAD_BOTTOM }}
      >
        <View style={styles.toggleRow}>
          <TouchableOpacity
            onPress={() => setAba('resultados')}
            style={[styles.toggleBtn, aba === 'resultados' && styles.toggleOn]}
          >
            <Text style={[styles.toggleTxt, aba === 'resultados' && styles.toggleTxtOn]}>
              Resultados
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setAba('proximas')}
            style={[styles.toggleBtn, aba === 'proximas' && styles.toggleOn]}
          >
            <Text style={[styles.toggleTxt, aba === 'proximas' && styles.toggleTxtOn]}>
              Próximas partidas
            </Text>
          </TouchableOpacity>
        </View>

        {aba === 'resultados' ? (
          <>
            <Text style={styles.section}>Partidas recentes</Text>
            <RecentMatchCard
              vitoria
              jogador1={{ nome: 'Gustavo', sets: [6, 6, 6], winner: true }}
              jogador2={{ nome: 'Guilherme', sets: [4, 3, 0] }}
              data="7 de Maio 26"
            />
          </>
        ) : (
          <Text style={styles.empty}>Sem partidas agendadas.</Text>
        )}

        <Text style={[styles.section, { marginTop: 20 }]}>Feed</Text>
        <View style={styles.feedCard}>
          <Image
            source={require('../../assets/onboarding/Onboarding_1.png')}
            style={styles.feedImg}
            resizeMode="cover"
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bodyLight },
  headerSafe: { backgroundColor: Colors.background },
  header: {
    backgroundColor: Colors.background,
    paddingHorizontal: 16,
    paddingBottom: 20,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  nome: { ...Typography.userName, color: Colors.textPrimary, fontSize: 30 },
  record: { color: Colors.textPrimary, fontSize: 14, marginTop: 2, opacity: 0.9 },
  bell: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellDot: {
    position: 'absolute',
    top: 8,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.accent,
  },
  sportsRow: { flexDirection: 'row', gap: 12 },
  sportCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sportCircleOn: { borderWidth: 2, borderColor: Colors.accent },
  sportEmoji: { fontSize: 22 },
  sportEmojiOff: { opacity: 0.45 },
  bodyScroll: { flex: 1, paddingHorizontal: 16, paddingTop: 16 },
  toggleRow: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    borderRadius: 30,
    padding: 4,
    marginBottom: 16,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 26,
    alignItems: 'center',
  },
  toggleOn: { backgroundColor: Colors.background },
  toggleTxt: { color: Colors.textDark, fontWeight: '700', fontSize: 13 },
  toggleTxtOn: { color: Colors.textPrimary },
  section: { color: Colors.textDark, fontWeight: 'bold', fontSize: 16, marginBottom: 10 },
  empty: { color: Colors.textMutedDark, textAlign: 'center', marginTop: 24 },
  feedCard: {
    borderRadius: 16,
    overflow: 'hidden',
    height: 160,
  },
  feedImg: { width: '100%', height: '100%' },
});

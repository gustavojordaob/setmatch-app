import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { Radius } from '../../constants/radius';
import { RecentMatchCard } from '../../components/home/RecentMatchCard';
import { useAuth } from '../../hooks/useAuth';
import { formatDataPartida, usePartidas } from '../../hooks/usePartidas';

type AbaCal = 'proximas' | 'historico';

const TAB_PAD_BOTTOM = 100;

export default function EstatisticasScreen() {
  const router = useRouter();
  const { user, perfil } = useAuth();
  const { partidas } = usePartidas();
  const [aba, setAba] = useState<AbaCal>('historico');
  const meuNome = perfil?.nome ?? user?.displayName ?? 'Você';

  const porData = useMemo(() => {
    const map = new Map<string, typeof partidas>();
    partidas.forEach((p) => {
      const key = formatDataPartida(p) || 'Sem data';
      const list = map.get(key) ?? [];
      list.push(p);
      map.set(key, list);
    });
    return Array.from(map.entries());
  }, [partidas]);

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
            <Text style={styles.title}>CALENDÁRIO</Text>
          </View>

          <View style={styles.toggleRow}>
            <TouchableOpacity
              style={[styles.toggleBtn, aba === 'proximas' && styles.toggleOn]}
              onPress={() => setAba('proximas')}
            >
              <Text style={[styles.toggleTxt, aba === 'proximas' && styles.toggleTxtOn]}>
                PRÓXIMAS
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleBtn, aba === 'historico' && styles.toggleOn]}
              onPress={() => setAba('historico')}
            >
              <Text style={[styles.toggleTxt, aba === 'historico' && styles.toggleTxtOn]}>
                HISTÓRICO
              </Text>
            </TouchableOpacity>
          </View>

          {aba === 'historico' ? (
            porData.length === 0 ? (
              <Text style={styles.empty}>Sem partidas no histórico.</Text>
            ) : (
              porData.map(([data, lista]) => (
                <View key={data}>
                  <Text style={styles.dateHead}>{data}</Text>
                  {lista.map((p) => {
                    const vitoria = p.vencedor === user?.uid;
                    return (
                      <RecentMatchCard
                        key={p.id}
                        vitoria={vitoria}
                        jogador1={{
                          nome: p.jogador1Nome ?? (p.jogador1 === user?.uid ? meuNome : 'Jogador'),
                          sets: p.sets.map((s) => s.j1),
                          winner: p.vencedor === p.jogador1,
                        }}
                        jogador2={{
                          nome: p.jogador2Nome ?? (p.jogador2 === user?.uid ? meuNome : 'Adversário'),
                          sets: p.sets.map((s) => s.j2),
                          winner: p.vencedor === p.jogador2,
                        }}
                        showMeta={false}
                      />
                    );
                  })}
                </View>
              ))
            )
          ) : (
            <Text style={styles.empty}>Sem partidas próximas agendadas.</Text>
          )}
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
    marginBottom: 20,
  },
  title: {
    color: Colors.accent,
    fontSize: 32,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  toggleRow: {
    flexDirection: 'row',
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
  dateHead: {
    color: Colors.textPrimary,
    fontWeight: 'bold',
    fontSize: 16,
    marginBottom: 10,
    marginTop: 8,
  },
  empty: {
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 40,
    fontSize: 15,
  },
});

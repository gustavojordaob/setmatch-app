import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { Radius } from '../../constants/radius';
import { TAB_BAR_CLEARANCE } from '../../constants/tabBar';
import { Avatar } from '../../components/ui/Avatar';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../hooks/useAuth';
import { formatDistanciaKm } from '../../utils/geo';
import {
  listarPessoasProximas,
  listarQuadrasProximas,
  obterCoordsAtuais,
  RAIO_PADRAO_KM,
  salvarLocalizacaoUsuario,
  type PessoaProxima,
  type QuadraProxima,
} from '../../services/localizacao';

type Aba = 'pessoas' | 'quadras';

export default function ProximosScreen() {
  const router = useRouter();
  const { user, perfil } = useAuth();
  const [aba, setAba] = useState<Aba>('pessoas');
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [pessoas, setPessoas] = useState<PessoaProxima[]>([]);
  const [quadras, setQuadras] = useState<QuadraProxima[]>([]);

  const carregar = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setErro('');
    try {
      const coords = await obterCoordsAtuais();
      if (!coords) {
        setErro('Permita o acesso à localização para ver quem está perto.');
        setPessoas([]);
        setQuadras([]);
        return;
      }
      await salvarLocalizacaoUsuario(user.uid, coords);
      const estado = perfil?.estado?.trim().toUpperCase() || undefined;
      const [p, q] = await Promise.all([
        listarPessoasProximas({
          meuUid: user.uid,
          lat: coords.lat,
          lng: coords.lng,
          estado,
          raioKm: RAIO_PADRAO_KM,
        }),
        listarQuadrasProximas({
          lat: coords.lat,
          lng: coords.lng,
          estado,
          raioKm: RAIO_PADRAO_KM,
        }),
      ]);
      setPessoas(p);
      setQuadras(q);
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : 'Falha ao carregar.');
    } finally {
      setLoading(false);
    }
  }, [user, perfil?.estado]);

  useFocusEffect(
    useCallback(() => {
      void carregar();
    }, [carregar])
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors.accent} />
        </TouchableOpacity>
        <Text style={styles.title}>Perto de mim</Text>
        <TouchableOpacity onPress={() => void carregar()}>
          <Ionicons name="refresh" size={22} color={Colors.accent} />
        </TouchableOpacity>
      </View>

      <Text style={styles.sub}>Raio de {RAIO_PADRAO_KM} km · pessoas e quadras/clubes</Text>

      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, aba === 'pessoas' && styles.tabOn]}
          onPress={() => setAba('pessoas')}
        >
          <Text style={[styles.tabTxt, aba === 'pessoas' && styles.tabTxtOn]}>Pessoas</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, aba === 'quadras' && styles.tabOn]}
          onPress={() => setAba('quadras')}
        >
          <Text style={[styles.tabTxt, aba === 'quadras' && styles.tabTxtOn]}>Quadras</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color={Colors.accent} style={{ marginTop: 40 }} />
      ) : erro ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTxt}>{erro}</Text>
          <Button label="Tentar de novo" onPress={() => void carregar()} />
        </View>
      ) : aba === 'pessoas' ? (
        <FlatList
          data={pessoas}
          keyExtractor={(i) => i.uid}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <Text style={styles.emptyTxt}>
              Nenhuma pessoa com localização no raio. Peça aos amigos para abrir esta tela.
            </Text>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => router.push(`/jogador/${item.uid}`)}
            >
              <Avatar uri={item.fotoUrl} nome={item.nome} size="md" />
              <View style={styles.cardBody}>
                <Text style={styles.cardTitle}>{item.nome}</Text>
                <Text style={styles.cardSub}>
                  {[item.cidade, item.estado].filter(Boolean).join(' · ') || '—'}
                </Text>
              </View>
              <Text style={styles.dist}>{formatDistanciaKm(item.distanciaKm)}</Text>
            </TouchableOpacity>
          )}
        />
      ) : (
        <FlatList
          data={quadras}
          keyExtractor={(i) => `${i.tipo}-${i.id}`}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <Text style={styles.emptyTxt}>
              Nenhum clube/quadra com coordenadas no raio.
            </Text>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => {
                if (item.tipo === 'clube') router.push(`/meu-clube/${item.id}`);
              }}
            >
              <View style={styles.iconBox}>
                <Ionicons name="location" size={22} color={Colors.textOnAccent} />
              </View>
              <View style={styles.cardBody}>
                <Text style={styles.cardTitle}>{item.nome}</Text>
                <Text style={styles.cardSub}>
                  {item.tipo === 'clube' ? 'Clube' : 'Quadra'}
                  {item.cidade ? ` · ${item.cidade}` : ''}
                </Text>
              </View>
              <Text style={styles.dist}>{formatDistanciaKm(item.distanciaKm)}</Text>
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  title: { color: Colors.accent, fontSize: 22, fontWeight: '900' },
  sub: {
    color: Colors.textSecondary,
    paddingHorizontal: 16,
    marginTop: 6,
    marginBottom: 12,
  },
  tabs: {
    flexDirection: 'row',
    marginHorizontal: 16,
    backgroundColor: Colors.surface,
    borderRadius: Radius.pill,
    padding: 4,
    marginBottom: 8,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: Radius.pill,
    alignItems: 'center',
  },
  tabOn: { backgroundColor: Colors.accent },
  tabTxt: { color: Colors.textPrimary, fontWeight: '700' },
  tabTxtOn: { color: Colors.textOnAccent },
  list: { padding: 16, paddingBottom: TAB_BAR_CLEARANCE, gap: 10 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 12,
    gap: 12,
    marginBottom: 10,
  },
  cardBody: { flex: 1 },
  cardTitle: { color: Colors.textPrimary, fontWeight: '800', fontSize: 16 },
  cardSub: { color: Colors.textSecondary, marginTop: 2, fontSize: 13 },
  dist: { color: Colors.accent, fontWeight: '800', fontSize: 13 },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: { padding: 24, gap: 16, alignItems: 'center' },
  emptyTxt: {
    color: Colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 24,
    marginTop: 24,
    lineHeight: 20,
  },
});

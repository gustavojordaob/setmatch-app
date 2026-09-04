import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Linking,
  StyleSheet,
  Text,
  TextInput,
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
import { useT } from '../../hooks/useI18n';

type Aba = 'pessoas' | 'quadras';

export default function ProximosScreen() {
  const router = useRouter();
  const t = useT();
  const { user, perfil } = useAuth();
  const [aba, setAba] = useState<Aba>('pessoas');
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [pessoas, setPessoas] = useState<PessoaProxima[]>([]);
  const [quadras, setQuadras] = useState<QuadraProxima[]>([]);
  const [buscaQuadra, setBuscaQuadra] = useState('');
  const coordsRef = useRef<{ lat: number; lng: number } | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const carregar = useCallback(
    async (queryMaps?: string) => {
      if (!user) return;
      setLoading(true);
      setErro('');
      try {
        let coords = coordsRef.current;
        if (!coords) {
          coords = await obterCoordsAtuais();
          if (!coords) {
            setErro('Permita o acesso à localização para ver quem está perto.');
            setPessoas([]);
            setQuadras([]);
            return;
          }
          coordsRef.current = coords;
          await salvarLocalizacaoUsuario(user.uid, coords);
        }
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
            queryMaps: queryMaps?.trim() || undefined,
            incluirMaps: true,
          }),
        ]);
        setPessoas(p);
        setQuadras(q);
      } catch (e: unknown) {
        setErro(e instanceof Error ? e.message : t('common.loadFailed'));
      } finally {
        setLoading(false);
      }
    },
    [user, perfil?.estado, t]
  );

  useFocusEffect(
    useCallback(() => {
      coordsRef.current = null;
      void carregar(buscaQuadra);
    }, [carregar])
  );

  function onChangeBusca(txt: string) {
    setBuscaQuadra(txt);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void carregar(txt);
    }, 450);
  }

  async function abrirItem(item: QuadraProxima) {
    if (item.tipo === 'clube') {
      router.push(`/meu-clube/${item.id}`);
      return;
    }
    if (item.fonte === 'maps') {
      const url =
        item.mapsUrl ||
        (item.lat != null && item.lng != null
          ? `https://www.google.com/maps/search/?api=1&query=${item.lat},${item.lng}`
          : undefined);
      if (url) await Linking.openURL(url);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors.accent} />
        </TouchableOpacity>
        <Text style={styles.title}>{t('home.nearMeTitle')}</Text>
        <TouchableOpacity
          onPress={() => {
            coordsRef.current = null;
            void carregar(buscaQuadra);
          }}
        >
          <Ionicons name="refresh" size={22} color={Colors.accent} />
        </TouchableOpacity>
      </View>

      <Text style={styles.sub}>{t('proximos.peopleCourts')}</Text>

      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, aba === 'pessoas' && styles.tabOn]}
          onPress={() => setAba('pessoas')}
        >
          <Text style={[styles.tabTxt, aba === 'pessoas' && styles.tabTxtOn]}>
            {t('proximos.people')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, aba === 'quadras' && styles.tabOn]}
          onPress={() => setAba('quadras')}
        >
          <Text style={[styles.tabTxt, aba === 'quadras' && styles.tabTxtOn]}>
            {t('proximos.courts')}
          </Text>
        </TouchableOpacity>
      </View>

      {aba === 'quadras' ? (
        <View style={styles.searchRow}>
          <Ionicons name="search" size={18} color={Colors.textSecondary} />
          <TextInput
            style={styles.searchInput}
            value={buscaQuadra}
            onChangeText={onChangeBusca}
            placeholder="Filtrar / buscar no Maps…"
            placeholderTextColor={Colors.textSecondary}
            returnKeyType="search"
            onSubmitEditing={() => void carregar(buscaQuadra)}
          />
        </View>
      ) : null}

      {loading ? (
        <ActivityIndicator color={Colors.accent} style={{ marginTop: 40 }} />
      ) : erro ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTxt}>{erro}</Text>
          <Button label="Tentar de novo" onPress={() => void carregar(buscaQuadra)} />
        </View>
      ) : aba === 'pessoas' ? (
        <FlatList
          data={pessoas}
          keyExtractor={(i) => i.uid}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <Text style={styles.emptyTxt}>{t('proximos.noPeople')}</Text>
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
          keyExtractor={(i) => `${i.fonte}-${i.id}`}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <Text style={styles.emptyTxt}>
              Nenhuma quadra neste raio. Tente outro termo na busca (Maps) ou
              aumente o alcance depois.
            </Text>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => void abrirItem(item)}
            >
              <View
                style={[
                  styles.iconBox,
                  item.fonte === 'maps' && styles.iconBoxMaps,
                ]}
              >
                <Ionicons
                  name={item.fonte === 'maps' ? 'map' : 'location'}
                  size={22}
                  color={Colors.textOnAccent}
                />
              </View>
              <View style={styles.cardBody}>
                <View style={styles.titleRow}>
                  <Text style={styles.cardTitle} numberOfLines={1}>
                    {item.nome}
                  </Text>
                  <View
                    style={[
                      styles.badge,
                      item.fonte === 'maps' ? styles.badgeMaps : styles.badgeRally,
                    ]}
                  >
                    <Text
                      style={
                        item.fonte === 'maps' ? styles.badgeTxt : styles.badgeTxtRally
                      }
                    >
                      {item.fonte === 'maps' ? 'Maps' : 'Rally Up'}
                    </Text>
                  </View>
                </View>
                <Text style={styles.cardSub} numberOfLines={2}>
                  {item.fonte === 'rally'
                    ? item.tipo === 'clube'
                      ? 'Clube'
                      : 'Quadra'
                    : 'Abrir no Google Maps'}
                  {item.endereco
                    ? ` · ${item.endereco}`
                    : item.cidade
                      ? ` · ${item.cidade}`
                      : ''}
                  {item.rating != null ? ` · ★ ${item.rating.toFixed(1)}` : ''}
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
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: Colors.surface,
    borderRadius: Radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  searchInput: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: 15,
    padding: 0,
  },
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
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cardTitle: {
    color: Colors.textPrimary,
    fontWeight: '800',
    fontSize: 16,
    flexShrink: 1,
  },
  cardSub: { color: Colors.textSecondary, marginTop: 2, fontSize: 13 },
  dist: { color: Colors.accent, fontWeight: '800', fontSize: 13 },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  badgeRally: { backgroundColor: Colors.accent },
  badgeMaps: {
    backgroundColor: Colors.surfaceDark,
    borderWidth: 1,
    borderColor: Colors.accent,
  },
  badgeTxt: {
    color: Colors.textPrimary,
    fontSize: 10,
    fontWeight: '800',
  },
  badgeTxtRally: {
    color: Colors.textOnAccent,
    fontSize: 10,
    fontWeight: '800',
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBoxMaps: { backgroundColor: Colors.surfaceDark },
  empty: { padding: 24, gap: 16, alignItems: 'center' },
  emptyTxt: {
    color: Colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 24,
    marginTop: 24,
    lineHeight: 20,
  },
});

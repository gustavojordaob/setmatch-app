import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { Radius } from '../../constants/radius';
import { formatDistanciaKm } from '../../utils/geo';
import {
  listarQuadrasProximas,
  obterCoordsAtuais,
  RAIO_PADRAO_KM,
  type QuadraProxima,
} from '../../services/localizacao';

type Props = {
  visible: boolean;
  onClose: () => void;
  onSelect: (quadra: QuadraProxima) => void;
};

export function BuscarQuadraModal({ visible, onClose, onSelect }: Props) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [itens, setItens] = useState<QuadraProxima[]>([]);

  const carregar = useCallback(async (q?: string) => {
    setLoading(true);
    setErro('');
    try {
      const coords = await obterCoordsAtuais();
      if (!coords) {
        setErro('Permita a localização para buscar quadras perto de você.');
        setItens([]);
        return;
      }
      const lista = await listarQuadrasProximas({
        lat: coords.lat,
        lng: coords.lng,
        raioKm: RAIO_PADRAO_KM,
        queryMaps: q?.trim() || undefined,
        incluirMaps: true,
      });
      setItens(lista);
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : 'Falha ao buscar');
      setItens([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!visible) return;
    void carregar(query);
    // só na abertura — busca por texto via botão/enter
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.safe}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} hitSlop={12}>
            <Ionicons name="close" size={26} color={Colors.accent} />
          </TouchableOpacity>
          <Text style={styles.title}>Quadras perto de mim</Text>
          <View style={{ width: 26 }} />
        </View>

        <View style={styles.searchRow}>
          <TextInput
            style={styles.search}
            value={query}
            onChangeText={setQuery}
            placeholder="Buscar (ex.: padel, Winner…)"
            placeholderTextColor={Colors.textSecondary}
            returnKeyType="search"
            onSubmitEditing={() => void carregar(query)}
          />
          <TouchableOpacity
            style={styles.searchBtn}
            onPress={() => void carregar(query)}
          >
            <Ionicons name="search" size={20} color={Colors.textOnAccent} />
          </TouchableOpacity>
        </View>

        <Text style={styles.hint}>
          Clubes no Rally Up + locais do Google Maps perto de você.
        </Text>

        {loading ? (
          <ActivityIndicator color={Colors.accent} style={{ marginTop: 32 }} />
        ) : erro ? (
          <Text style={styles.erro}>{erro}</Text>
        ) : (
          <FlatList
            data={itens}
            keyExtractor={(i) => `${i.fonte}-${i.id}`}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <Text style={styles.erro}>Nenhuma quadra neste raio.</Text>
            }
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.card}
                onPress={() => {
                  onSelect(item);
                  onClose();
                }}
              >
                <View
                  style={[
                    styles.iconBox,
                    item.fonte === 'maps' && styles.iconMaps,
                  ]}
                >
                  <Ionicons
                    name={item.fonte === 'maps' ? 'map' : 'business'}
                    size={20}
                    color={Colors.textOnAccent}
                  />
                </View>
                <View style={styles.body}>
                  <Text style={styles.nome} numberOfLines={1}>
                    {item.nome}
                  </Text>
                  <Text style={styles.sub} numberOfLines={2}>
                    {item.fonte === 'maps' ? 'Maps' : 'Rally Up'}
                    {item.endereco
                      ? ` · ${item.endereco}`
                      : item.cidade
                        ? ` · ${item.cidade}`
                        : ''}
                  </Text>
                </View>
                <Text style={styles.dist}>
                  {formatDistanciaKm(item.distanciaKm)}
                </Text>
              </TouchableOpacity>
            )}
          />
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background, paddingTop: 48 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  title: { color: Colors.accent, fontSize: 18, fontWeight: '900' },
  searchRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  search: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: Radius.pill,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: Colors.textPrimary,
    fontSize: 15,
  },
  searchBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hint: {
    color: Colors.textSecondary,
    fontSize: 12,
    paddingHorizontal: 16,
    marginTop: 8,
    marginBottom: 4,
  },
  list: { padding: 16, paddingBottom: 40 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 12,
    gap: 12,
    marginBottom: 10,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconMaps: { backgroundColor: Colors.surfaceDark },
  body: { flex: 1 },
  nome: { color: Colors.textPrimary, fontWeight: '800', fontSize: 15 },
  sub: { color: Colors.textSecondary, fontSize: 12, marginTop: 2 },
  dist: { color: Colors.accent, fontWeight: '800', fontSize: 12 },
  erro: {
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 32,
    paddingHorizontal: 24,
  },
});

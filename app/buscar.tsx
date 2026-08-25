import { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/colors';
import { ESPORTES, type EsporteId } from '../constants/esportes';
import { Avatar } from '../components/ui/Avatar';
import { useAuth } from '../hooks/useAuth';
import { useEsporte } from '../contexts/EsporteContext';
import { buscarJogadoresAvancado, type JogadorBusca } from '../services/buscaJogadores';

const NIVEIS = ['', 'iniciante', 'intermediario', 'avancado'];

export default function BuscarJogadoresScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { esporteAtivo } = useEsporte();
  const [texto, setTexto] = useState('');
  const [cidade, setCidade] = useState('');
  const [nivel, setNivel] = useState('');
  const [filtrarEsporte, setFiltrarEsporte] = useState(true);
  const [loading, setLoading] = useState(false);
  const [resultados, setResultados] = useState<JogadorBusca[]>([]);
  const [buscou, setBuscou] = useState(false);

  async function buscar() {
    setLoading(true);
    setBuscou(true);
    try {
      const list = await buscarJogadoresAvancado({
        texto,
        cidade,
        nivel: nivel || undefined,
        esporte: filtrarEsporte ? (esporteAtivo as EsporteId) : undefined,
        excluirUid: user?.uid,
      });
      setResultados(list);
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={26} color={Colors.accent} />
        </TouchableOpacity>
        <Text style={styles.title}>Buscar jogadores</Text>
        <View style={{ width: 26 }} />
      </View>

      <View style={styles.filters}>
        <TextInput
          style={styles.input}
          placeholder="Nome ou ID SM-XXXXXX"
          placeholderTextColor={Colors.textMutedDark}
          value={texto}
          onChangeText={setTexto}
          autoCapitalize="none"
        />
        <TextInput
          style={styles.input}
          placeholder="Cidade"
          placeholderTextColor={Colors.textMutedDark}
          value={cidade}
          onChangeText={setCidade}
        />
        <Text style={styles.label}>Nível</Text>
        <View style={styles.chips}>
          {NIVEIS.map((n) => (
            <TouchableOpacity
              key={n || 'todos'}
              style={[styles.chip, nivel === n && styles.chipOn]}
              onPress={() => setNivel(n)}
            >
              <Text style={[styles.chipTxt, nivel === n && styles.chipTxtOn]}>
                {n ? n : 'Todos'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity
          style={[styles.chip, filtrarEsporte && styles.chipOn]}
          onPress={() => setFiltrarEsporte((v) => !v)}
        >
          <Text style={[styles.chipTxt, filtrarEsporte && styles.chipTxtOn]}>
            Só{' '}
            {ESPORTES.find((e) => e.id === esporteAtivo)?.nome ?? 'esporte ativo'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btn} onPress={() => void buscar()}>
          <Text style={styles.btnTxt}>Buscar</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color={Colors.accent} style={{ marginTop: 24 }} />
      ) : (
        <FlatList
          data={resultados}
          keyExtractor={(i) => i.uid}
          contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 }}
          ListEmptyComponent={
            buscou ? (
              <Text style={styles.empty}>Nenhum jogador encontrado.</Text>
            ) : (
              <Text style={styles.empty}>
                Busca estilo apps de clube: nome, cidade, nível ou ID Rally Up.
              </Text>
            )
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => router.push(`/jogador/${item.uid}`)}
            >
              <Avatar uri={item.fotoUrl} nome={item.nome} size="md" />
              <View style={{ flex: 1 }}>
                <Text style={styles.nome}>{item.nome}</Text>
                <Text style={styles.meta}>
                  {item.vitorias}V · {item.derrotas}D
                  {item.nivel ? ` · ${item.nivel}` : ''}
                  {item.cidade ? ` · ${item.cidade}` : ''}
                </Text>
                {item.setmatchId ? (
                  <Text style={styles.id}>{item.setmatchId}</Text>
                ) : null}
              </View>
              <Ionicons name="chevron-forward" size={20} color={Colors.accent} />
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
    paddingVertical: 10,
  },
  title: { color: Colors.textPrimary, fontWeight: '900', fontSize: 17 },
  filters: { paddingHorizontal: 16, gap: 8 },
  input: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: Colors.textPrimary,
  },
  label: { color: Colors.textSecondary, fontWeight: '700', marginTop: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 60,
    backgroundColor: Colors.surface,
  },
  chipOn: { backgroundColor: Colors.accent },
  chipTxt: { color: Colors.textPrimary, fontWeight: '700', fontSize: 12 },
  chipTxtOn: { color: Colors.textOnAccent },
  btn: {
    marginTop: 8,
    backgroundColor: Colors.accent,
    borderRadius: 60,
    paddingVertical: 14,
    alignItems: 'center',
  },
  btnTxt: { color: Colors.textOnAccent, fontWeight: '900' },
  empty: {
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 24,
    lineHeight: 20,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 12,
  },
  nome: { color: Colors.textPrimary, fontWeight: '800' },
  meta: { color: Colors.textSecondary, fontSize: 12, marginTop: 2 },
  id: { color: Colors.accent, fontSize: 11, fontWeight: '700', marginTop: 2 },
});

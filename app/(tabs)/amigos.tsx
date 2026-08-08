import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  collection,
  getDocs,
  limit,
  query,
  where,
} from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { db } from '../../utils/firebaseConfig';
import { Colors } from '../../constants/colors';
import { Radius } from '../../constants/radius';
import { Avatar } from '../../components/ui/Avatar';
import { useAuth } from '../../hooks/useAuth';
import { useAmigos } from '../../hooks/useAmigos';
import { useConversas } from '../../hooks/useConversas';
import {
  aceitarAmizade,
  recusarAmizade,
  solicitarAmizade,
} from '../../services/amigos';
import { abrirOuCriarConversaAmigo } from '../../services/mensagens';

import { TAB_BAR_CLEARANCE } from '../../constants/tabBar';
const TAB_PAD = TAB_BAR_CLEARANCE;

export default function AmigosScreen() {
  const router = useRouter();
  const { user, perfil } = useAuth();
  const { amigos, pendentesRecebidas } = useAmigos();
  const conversas = useConversas();
  const [busca, setBusca] = useState('');
  const [resultados, setResultados] = useState<
    { uid: string; nome: string; fotoUrl?: string; cidade?: string }[]
  >([]);
  const [buscando, setBuscando] = useState(false);

  const conversasAmigo = useMemo(
    () => conversas.filter((c) => c.tipo === 'amigo'),
    [conversas]
  );

  async function buscar() {
    const t = busca.trim().toLowerCase();
    if (t.length < 2) {
      Alert.alert('Amigos', 'Digite ao menos 2 letras.');
      return;
    }
    setBuscando(true);
    try {
      const snap = await getDocs(query(collection(db, 'usuarios'), limit(40)));
      const list = snap.docs
        .map((d) => {
          const raw = d.data();
          return {
            uid: d.id,
            nome: String(raw.nome ?? ''),
            fotoUrl: raw.fotoUrl ? String(raw.fotoUrl) : undefined,
            cidade: raw.cidade ? String(raw.cidade) : undefined,
            role: String(raw.role ?? 'jogador'),
          };
        })
        .filter(
          (u) =>
            u.uid !== user?.uid &&
            u.role !== 'admin_clube' &&
            u.role !== 'professor' &&
            u.nome.toLowerCase().includes(t)
        );
      setResultados(list);
    } finally {
      setBuscando(false);
    }
  }

  async function adicionar(alvo: { uid: string; nome: string; fotoUrl?: string }) {
    if (!user) return;
    await solicitarAmizade({
      deUid: user.uid,
      deNome: perfil?.nome ?? 'Jogador',
      deFoto: perfil?.fotoUrl,
      paraUid: alvo.uid,
      paraNome: alvo.nome,
      paraFoto: alvo.fotoUrl,
    });
    Alert.alert('Amigos', 'Solicitação enviada!');
  }

  async function abrirChat(amigoUid: string, amigoNome: string) {
    if (!user) return;
    const id = await abrirOuCriarConversaAmigo({
      uidA: user.uid,
      nomeA: perfil?.nome ?? 'Você',
      uidB: amigoUid,
      nomeB: amigoNome,
    });
    router.push(`/chat/${id}`);
  }

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.safe}>
        <View style={styles.header}>
          <Text style={styles.title}>Amigos</Text>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="close" size={26} color={Colors.white} />
          </TouchableOpacity>
        </View>

        <View style={styles.search}>
          <TextInput
            style={styles.input}
            placeholder="Buscar jogador por nome"
            placeholderTextColor={Colors.textSecondary}
            value={busca}
            onChangeText={setBusca}
          />
          <TouchableOpacity style={styles.searchBtn} onPress={buscar}>
            {buscando ? (
              <ActivityIndicator color={Colors.textOnAccent} />
            ) : (
              <Ionicons name="search" size={20} color={Colors.textOnAccent} />
            )}
          </TouchableOpacity>
        </View>

        <FlatList
          data={amigos}
          keyExtractor={(i) => i.uid}
          contentContainerStyle={{ paddingBottom: TAB_PAD, paddingHorizontal: 16 }}
          ListHeaderComponent={
            <>
              {pendentesRecebidas.length > 0 ? (
                <View style={styles.box}>
                  <Text style={styles.section}>Solicitações</Text>
                  {pendentesRecebidas.map((s) => (
                    <View key={s.id} style={styles.row}>
                      <Avatar uri={s.deFoto} nome={s.deNome} size="sm" />
                      <Text style={styles.nome}>{s.deNome}</Text>
                      <TouchableOpacity
                        style={styles.ok}
                        onPress={() => void aceitarAmizade(s.id)}
                      >
                        <Ionicons name="checkmark" size={18} color={Colors.textOnAccent} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.no}
                        onPress={() => void recusarAmizade(s.id)}
                      >
                        <Ionicons name="close" size={18} color={Colors.white} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              ) : null}

              {resultados.length > 0 ? (
                <View style={styles.box}>
                  <Text style={styles.section}>Resultados</Text>
                  {resultados.map((r) => (
                    <View key={r.uid} style={styles.row}>
                      <Avatar uri={r.fotoUrl} nome={r.nome} size="sm" />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.nome}>{r.nome}</Text>
                        {r.cidade ? <Text style={styles.meta}>{r.cidade}</Text> : null}
                      </View>
                      <TouchableOpacity style={styles.add} onPress={() => void adicionar(r)}>
                        <Text style={styles.addTxt}>Adicionar</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              ) : null}

              <Text style={styles.section}>Meus amigos</Text>
            </>
          }
          ListEmptyComponent={<Text style={styles.empty}>Nenhum amigo ainda. Busque e adicione!</Text>}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10 }}
                onPress={() => router.push(`/jogador/${item.uid}`)}
              >
                <Avatar uri={item.fotoUrl} nome={item.nome} size="sm" />
                <Text style={styles.nome}>{item.nome}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.msg}
                onPress={() => void abrirChat(item.uid, item.nome)}
              >
                <Ionicons name="chatbubble-ellipses" size={18} color={Colors.textOnAccent} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.jogo}
                onPress={() =>
                  void abrirChat(item.uid, item.nome).then(() =>
                    Alert.alert('Marcar jogo', 'Envie uma mensagem sugerindo dia e horário.')
                  )
                }
              >
                <Text style={styles.jogoTxt}>Jogo</Text>
              </TouchableOpacity>
            </View>
          )}
          ListFooterComponent={
            conversasAmigo.length > 0 ? (
              <View style={{ marginTop: 20 }}>
                <Text style={styles.section}>Conversas recentes</Text>
                {conversasAmigo.map((c) => {
                  const outro = c.participantes.find((p) => p !== user?.uid);
                  const nome = (outro && c.nomes?.[outro]) || 'Conversa';
                  return (
                    <TouchableOpacity
                      key={c.id}
                      style={styles.row}
                      onPress={() => router.push(`/chat/${c.id}`)}
                    >
                      <Ionicons name="chatbubbles-outline" size={22} color={Colors.accent} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.nome}>{nome}</Text>
                        <Text style={styles.meta} numberOfLines={1}>
                          {c.ultimoTexto || 'Sem mensagens'}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : null
          }
        />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    marginBottom: 12,
  },
  title: { color: Colors.accent, fontSize: 28, fontWeight: 'bold' },
  search: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  input: {
    flex: 1,
    height: 48,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 16,
    color: Colors.textPrimary,
  },
  searchBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  box: { marginBottom: 16 },
  section: { color: Colors.textPrimary, fontWeight: 'bold', fontSize: 16, marginBottom: 10 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  nome: { color: Colors.textPrimary, fontWeight: '600' },
  meta: { color: Colors.textSecondary, fontSize: 12 },
  empty: { color: Colors.textSecondary, textAlign: 'center', marginTop: 20 },
  ok: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  no: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1.5,
    borderColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  add: {
    backgroundColor: Colors.accent,
    borderRadius: Radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  addTxt: { color: Colors.textOnAccent, fontWeight: 'bold', fontSize: 12 },
  msg: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  jogo: {
    borderWidth: 1.5,
    borderColor: Colors.accent,
    borderRadius: Radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  jogoTxt: { color: Colors.accent, fontWeight: 'bold', fontSize: 12 },
});

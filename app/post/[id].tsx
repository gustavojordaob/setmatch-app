import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { Avatar } from '../../components/ui/Avatar';
import { useAuth } from '../../hooks/useAuth';
import { useAmigos } from '../../hooks/useAmigos';
import {
  comentarPost,
  getPost,
  ouvirComentarios,
  type ComentarioPost,
} from '../../services/feed';
import { abrirOuCriarConversaAmigo, enviarMensagem } from '../../services/mensagens';
import { compartilharPostFora, linkExternoPost } from '../../utils/compartilharPost';

type PostView = {
  id: string;
  autorUid: string;
  autorNome: string;
  autorFoto?: string;
  texto: string;
  imagemUrl?: string;
  comentariosCount?: number;
};

export default function PostDetalheScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, perfil } = useAuth();
  const { amigos } = useAmigos();
  const [post, setPost] = useState<PostView | null>(null);
  const [comentarios, setComentarios] = useState<ComentarioPost[]>([]);
  const [texto, setTexto] = useState('');
  const [loading, setLoading] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  useEffect(() => {
    if (!id) return;
    void (async () => {
      try {
        const raw = await getPost(id);
        if (!raw) {
          setPost(null);
          return;
        }
        setPost({
          id: raw.id,
          autorUid: String(raw.autorUid ?? ''),
          autorNome: String(raw.autorNome ?? 'Jogador'),
          autorFoto: raw.autorFoto ? String(raw.autorFoto) : undefined,
          texto: String(raw.texto ?? ''),
          imagemUrl: raw.imagemUrl ? String(raw.imagemUrl) : undefined,
          comentariosCount: Number(raw.comentariosCount ?? 0),
        });
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  useEffect(() => {
    if (!id) return;
    return ouvirComentarios(id, setComentarios);
  }, [id]);

  async function enviarComentario() {
    if (!user || !perfil || !id || !texto.trim()) return;
    setEnviando(true);
    try {
      await comentarPost({
        postId: id,
        autorUid: user.uid,
        autorNome: perfil.nome || user.displayName || 'Jogador',
        autorFoto: perfil.fotoUrl ?? user.photoURL ?? '',
        texto,
      });
      setTexto('');
    } catch (e: unknown) {
      Alert.alert('Erro', e instanceof Error ? e.message : 'Não foi possível comentar.');
    } finally {
      setEnviando(false);
    }
  }

  async function compartilharComAmigo(amigoUid: string, amigoNome: string) {
    if (!user || !perfil || !post) return;
    try {
      const conversaId = await abrirOuCriarConversaAmigo({
        uidA: user.uid,
        nomeA: perfil.nome || 'Jogador',
        uidB: amigoUid,
        nomeB: amigoNome,
      });
      await enviarMensagem({
        conversaId,
        deUid: user.uid,
        deNome: perfil.nome || 'Jogador',
        texto: `Compartilhei uma publicação: ${linkExternoPost(post.id)}\n\n"${post.texto.slice(0, 100)}"`,
      });
      setShareOpen(false);
      Alert.alert('Enviado', `Compartilhado com ${amigoNome} no chat.`, [
        { text: 'Abrir chat', onPress: () => router.push(`/chat/${conversaId}`) },
        { text: 'OK' },
      ]);
    } catch (e: unknown) {
      Alert.alert('Erro', e instanceof Error ? e.message : 'Falha ao compartilhar.');
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.top}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors.accent} />
        </TouchableOpacity>
        <Text style={styles.topTitle}>Publicação</Text>
        <TouchableOpacity onPress={() => setShareOpen(true)} disabled={!post}>
          <Ionicons name="share-outline" size={22} color={Colors.accent} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color={Colors.accent} style={{ marginTop: 40 }} />
      ) : !post ? (
        <Text style={styles.empty}>
          Publicação não encontrada. Instale o Rally Up e faça login para ver conteúdos
          compartilhados.
        </Text>
      ) : (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <FlatList
            data={comentarios}
            keyExtractor={(c) => c.id}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={
              <View style={styles.card}>
                <TouchableOpacity
                  style={styles.head}
                  onPress={() => router.push(`/jogador/${post.autorUid}`)}
                  activeOpacity={0.8}
                >
                  <Avatar uri={post.autorFoto} nome={post.autorNome} size="sm" />
                  <Text style={styles.autor}>{post.autorNome}</Text>
                </TouchableOpacity>
                {post.texto ? <Text style={styles.texto}>{post.texto}</Text> : null}
                {post.imagemUrl ? (
                  <Image source={{ uri: post.imagemUrl }} style={styles.img} />
                ) : null}
                <Text style={styles.comentTitle}>
                  Comentários ({comentarios.length})
                </Text>
              </View>
            }
            renderItem={({ item }) => (
              <View style={styles.coment}>
                <TouchableOpacity
                  onPress={() => router.push(`/jogador/${item.autorUid}`)}
                  activeOpacity={0.8}
                >
                  <Avatar uri={item.autorFoto} nome={item.autorNome} size="sm" />
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                  <TouchableOpacity onPress={() => router.push(`/jogador/${item.autorUid}`)}>
                    <Text style={styles.comentAutor}>{item.autorNome}</Text>
                  </TouchableOpacity>
                  <Text style={styles.comentTxt}>{item.texto}</Text>
                </View>
              </View>
            )}
            ListEmptyComponent={
              <Text style={styles.emptyComent}>Seja o primeiro a comentar.</Text>
            }
            contentContainerStyle={{ paddingBottom: 16 }}
          />

          <View
            style={[
              styles.composer,
              { paddingBottom: Math.max(insets.bottom, 10) + 8 },
            ]}
          >
            <TextInput
              style={styles.input}
              placeholder="Escreva um comentário…"
              placeholderTextColor={Colors.textMutedDark}
              value={texto}
              onChangeText={setTexto}
            />
            <TouchableOpacity
              style={[styles.send, !texto.trim() && styles.sendOff]}
              onPress={() => void enviarComentario()}
              disabled={!texto.trim() || enviando}
            >
              {enviando ? (
                <ActivityIndicator color={Colors.textOnAccent} size="small" />
              ) : (
                <Ionicons name="send" size={18} color={Colors.textOnAccent} />
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      )}

      <Modal visible={shareOpen} transparent animationType="slide">
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Compartilhar</Text>
            <TouchableOpacity
              style={styles.modalBtn}
              onPress={() => {
                if (!post) return;
                void compartilharPostFora({
                  postId: post.id,
                  autorNome: post.autorNome,
                  texto: post.texto,
                });
                setShareOpen(false);
              }}
            >
              <Ionicons name="logo-whatsapp" size={20} color={Colors.textOnAccent} />
              <Text style={styles.modalBtnTxt}>Fora do app (precisa instalar)</Text>
            </TouchableOpacity>
            <Text style={styles.modalSub}>Ou envie para um amigo no Rally Up</Text>
            {amigos.length === 0 ? (
              <Text style={styles.emptyComent}>Você ainda não tem amigos.</Text>
            ) : (
              amigos.map((a) => (
                <View key={a.uid} style={styles.amigoRow}>
                  <TouchableOpacity
                    onPress={() => {
                      setShareOpen(false);
                      router.push(`/jogador/${a.uid}`);
                    }}
                  >
                    <Avatar uri={a.fotoUrl} nome={a.nome} size="sm" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={{ flex: 1 }}
                    onPress={() => void compartilharComAmigo(a.uid, a.nome)}
                  >
                    <Text style={styles.amigoNome}>{a.nome}</Text>
                    <Text style={styles.amigoHint}>Enviar no chat</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
            <TouchableOpacity onPress={() => setShareOpen(false)}>
              <Text style={styles.cancel}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bodyLight },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.background,
  },
  topTitle: { color: Colors.textPrimary, fontWeight: '800', fontSize: 16 },
  empty: {
    color: Colors.textMutedDark,
    textAlign: 'center',
    marginTop: 40,
    paddingHorizontal: 24,
    lineHeight: 22,
  },
  card: {
    backgroundColor: Colors.white,
    margin: 16,
    borderRadius: 16,
    padding: 14,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  autor: { color: Colors.textDark, fontWeight: '800', fontSize: 15 },
  texto: { color: Colors.textDark, fontSize: 15, lineHeight: 22 },
  img: {
    marginTop: 12,
    width: '100%',
    height: 220,
    borderRadius: 14,
    backgroundColor: Colors.surfaceDark,
  },
  comentTitle: {
    marginTop: 18,
    color: Colors.textDark,
    fontWeight: '800',
    fontSize: 14,
  },
  coment: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: 'flex-start',
  },
  comentAutor: { color: Colors.textDark, fontWeight: '800', fontSize: 13 },
  comentTxt: { color: Colors.textMutedDark, marginTop: 2, lineHeight: 18 },
  emptyComent: {
    color: Colors.textMutedDark,
    textAlign: 'center',
    padding: 16,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 12,
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  input: {
    flex: 1,
    backgroundColor: Colors.bodyLight,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: Colors.textDark,
  },
  send: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendOff: { opacity: 0.4 },
  modalBg: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '70%',
  },
  modalTitle: { fontWeight: '900', fontSize: 18, color: Colors.textDark, marginBottom: 12 },
  modalBtn: {
    backgroundColor: Colors.accent,
    borderRadius: 60,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  modalBtnTxt: { color: Colors.textOnAccent, fontWeight: '800' },
  modalSub: {
    marginTop: 16,
    marginBottom: 8,
    color: Colors.textMutedDark,
    fontWeight: '600',
  },
  amigoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
  },
  amigoNome: { color: Colors.textDark, fontWeight: '700' },
  amigoHint: { color: Colors.textMutedDark, fontSize: 12, marginTop: 2 },
  cancel: {
    textAlign: 'center',
    marginTop: 16,
    color: Colors.textMutedDark,
    fontWeight: '700',
  },
});

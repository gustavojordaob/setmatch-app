import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { doc, onSnapshot } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { Radius } from '../../constants/radius';
import { db } from '../../utils/firebaseConfig';
import { useAuth } from '../../hooks/useAuth';
import { useMensagens, type Mensagem } from '../../hooks/useConversas';
import {
  enviarMensagem,
  marcarConversaComoLida,
  obterNaoLidasConversa,
} from '../../services/mensagens';

/** Índice da primeira mensagem “nova” (não lida ao abrir). -1 = nenhuma. */
function indicePrimeiraNova(
  msgs: Mensagem[],
  myUid: string,
  unreadCount: number
): number {
  if (unreadCount <= 0 || msgs.length === 0) return -1;
  let left = unreadCount;
  for (let i = msgs.length - 1; i >= 0; i--) {
    if (msgs[i].deUid !== myUid) {
      left -= 1;
      if (left <= 0) return i;
    }
  }
  return 0;
}

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, perfil } = useAuth();
  const mensagens = useMensagens(id ?? null);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [titulo, setTitulo] = useState('Mensagens');
  /** Quantas não lidas havia ao entrar — mantém o destaque visual nesta sessão. */
  const [novasAoAbrir, setNovasAoAbrir] = useState(0);
  const listRef = useRef<FlatList>(null);
  const focusedRef = useRef(false);
  const capturouUnreadRef = useRef(false);

  useFocusEffect(
    useCallback(() => {
      focusedRef.current = true;
      capturouUnreadRef.current = false;
      if (!user?.uid || !id) return;

      let cancelled = false;
      void (async () => {
        try {
          const n = await obterNaoLidasConversa(id, user.uid);
          if (cancelled) return;
          setNovasAoAbrir(n);
          capturouUnreadRef.current = true;
          // Zera badge depois de capturar o número (lista + sino)
          await marcarConversaComoLida(id, user.uid);
        } catch (e) {
          console.warn('[chat] marcar lida', e);
        }
      })();

      return () => {
        cancelled = true;
        focusedRef.current = false;
        setNovasAoAbrir(0);
        capturouUnreadRef.current = false;
      };
    }, [id, user?.uid])
  );

  // Meta da conversa (nome do outro / clube)
  useEffect(() => {
    if (!id || !user?.uid) return;
    return onSnapshot(doc(db, 'conversas', id), (snap) => {
      if (!snap.exists()) return;
      const raw = snap.data();
      const tipo = String(raw.tipo ?? 'amigo');
      if (tipo === 'clube') {
        const clubeNome = String(raw.clubeNome ?? 'Clube');
        const participantes = (raw.participantes as string[]) ?? [];
        const nomes = (raw.nomes as Record<string, string>) ?? {};
        const souAdminDoClube = nomes[user.uid] === clubeNome;
        if (souAdminDoClube) {
          const outro = participantes.find((p) => p !== user.uid);
          setTitulo((outro && nomes[outro]) || 'Jogador');
        } else {
          setTitulo(clubeNome);
        }
      } else {
        const outro = ((raw.participantes as string[]) ?? []).find((p) => p !== user.uid);
        const nomes = (raw.nomes as Record<string, string>) ?? {};
        setTitulo((outro && nomes[outro]) || 'Jogador');
      }

      // Se chegou mensagem nova enquanto o chat está aberto, zera de novo
      if (focusedRef.current && capturouUnreadRef.current) {
        const n = Number(
          (raw.naoLidas as Record<string, number> | undefined)?.[user.uid] ?? 0
        );
        if (n > 0) {
          void marcarConversaComoLida(id, user.uid).catch(() => undefined);
        }
      }
    });
  }, [id, user?.uid]);

  useEffect(() => {
    const show = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => {
        setKeyboardOpen(true);
        requestAnimationFrame(() => {
          listRef.current?.scrollToEnd({ animated: true });
        });
      }
    );
    const hide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardOpen(false)
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  useEffect(() => {
    if (mensagens.length === 0) return;
    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated: true });
    });
  }, [mensagens.length]);

  const idxNova = useMemo(
    () =>
      user?.uid ? indicePrimeiraNova(mensagens, user.uid, novasAoAbrir) : -1,
    [mensagens, user?.uid, novasAoAbrir]
  );

  async function enviar() {
    if (!user || !id || !texto.trim()) return;
    setEnviando(true);
    try {
      await enviarMensagem({
        conversaId: id,
        deUid: user.uid,
        deNome: perfil?.nome ?? 'Você',
        texto,
      });
      setTexto('');
    } catch (e: unknown) {
      Alert.alert(
        'Mensagem',
        e instanceof Error ? e.message : 'Não foi possível enviar. Tente de novo.'
      );
    } finally {
      setEnviando(false);
    }
  }

  const composerPadBottom = keyboardOpen ? 10 : Math.max(insets.bottom, 10);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={26} color={Colors.accent} />
          </TouchableOpacity>
          <Text style={styles.title} numberOfLines={1}>
            {titulo}
          </Text>
          <View style={{ width: 26 }} />
        </View>

        {novasAoAbrir > 0 ? (
          <View style={styles.bannerNovas}>
            <Ionicons name="mail-unread-outline" size={16} color={Colors.textOnAccent} />
            <Text style={styles.bannerNovasTxt}>
              {novasAoAbrir === 1
                ? '1 mensagem nova'
                : `${novasAoAbrir} mensagens novas`}
            </Text>
          </View>
        ) : null}

        <FlatList
          ref={listRef}
          data={mensagens}
          keyExtractor={(m) => m.id}
          style={styles.flex}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          renderItem={({ item, index }) => {
            const mine = item.deUid === user?.uid;
            const isNova = !mine && idxNova >= 0 && index >= idxNova;
            return (
              <View>
                {index === idxNova ? (
                  <View style={styles.dividerNovas}>
                    <View style={styles.dividerLine} />
                    <Text style={styles.dividerTxt}>Novas mensagens</Text>
                    <View style={styles.dividerLine} />
                  </View>
                ) : null}
                <View
                  style={[
                    styles.bubble,
                    mine ? styles.mine : styles.theirs,
                    isNova && styles.bubbleNova,
                  ]}
                >
                  {!mine ? (
                    <Text style={styles.author}>
                      {item.deNome}
                      {isNova ? ' · nova' : ''}
                    </Text>
                  ) : null}
                  <Text style={[styles.txt, mine && styles.txtMine]}>{item.texto}</Text>
                </View>
              </View>
            );
          }}
          ListEmptyComponent={
            <Text style={styles.empty}>
              Combine um jogo: dia, horário e quadra. Ou fale com o clube.
            </Text>
          }
        />

        <View style={[styles.composer, { paddingBottom: composerPadBottom }]}>
          <TextInput
            style={styles.input}
            value={texto}
            onChangeText={setTexto}
            placeholder="Mensagem…"
            placeholderTextColor={Colors.textSecondary}
            multiline
            textAlignVertical="center"
            onFocus={() => {
              setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
            }}
          />
          <TouchableOpacity
            style={[styles.send, (!texto.trim() || enviando) && { opacity: 0.4 }]}
            onPress={() => void enviar()}
            disabled={!texto.trim() || enviando}
          >
            <Ionicons name="send" size={18} color={Colors.textOnAccent} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 8,
    gap: 12,
  },
  title: {
    flex: 1,
    color: Colors.textPrimary,
    fontWeight: 'bold',
    fontSize: 18,
    textAlign: 'center',
  },
  bannerNovas: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.accent,
    marginHorizontal: 16,
    marginBottom: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: Radius.pill,
  },
  bannerNovasTxt: {
    color: Colors.textOnAccent,
    fontWeight: '800',
    fontSize: 13,
  },
  list: { padding: 16, paddingBottom: 8, flexGrow: 1, justifyContent: 'flex-end' },
  dividerNovas: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginVertical: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.accent,
    opacity: 0.5,
  },
  dividerTxt: {
    color: Colors.accent,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  bubble: {
    maxWidth: '80%',
    borderRadius: 16,
    padding: 12,
    marginBottom: 8,
  },
  mine: {
    alignSelf: 'flex-end',
    backgroundColor: Colors.accent,
  },
  theirs: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  bubbleNova: {
    borderWidth: 1.5,
    borderColor: Colors.accent,
    backgroundColor: 'rgba(199,217,65,0.18)',
  },
  author: { color: Colors.accent, fontSize: 11, fontWeight: 'bold', marginBottom: 4 },
  txt: { color: Colors.textPrimary, fontSize: 14 },
  txtMine: { color: Colors.textOnAccent },
  empty: { color: Colors.textSecondary, textAlign: 'center', marginTop: 40 },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    backgroundColor: Colors.background,
  },
  input: {
    flex: 1,
    maxHeight: 100,
    minHeight: 44,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: Colors.textPrimary,
  },
  send: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

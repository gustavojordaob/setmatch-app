import { useEffect, useRef, useState } from 'react';
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
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { Radius } from '../../constants/radius';
import { useAuth } from '../../hooks/useAuth';
import { useMensagens } from '../../hooks/useConversas';
import { enviarMensagem } from '../../services/mensagens';

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, perfil } = useAuth();
  const mensagens = useMensagens(id ?? null);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const listRef = useRef<FlatList>(null);

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
          <Text style={styles.title}>Mensagens</Text>
          <View style={{ width: 26 }} />
        </View>

        <FlatList
          ref={listRef}
          data={mensagens}
          keyExtractor={(m) => m.id}
          style={styles.flex}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          renderItem={({ item }) => {
            const mine = item.deUid === user?.uid;
            return (
              <View style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
                {!mine ? <Text style={styles.author}>{item.deNome}</Text> : null}
                <Text style={[styles.txt, mine && styles.txtMine]}>{item.texto}</Text>
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
  },
  title: { color: Colors.textPrimary, fontWeight: 'bold', fontSize: 18 },
  list: { padding: 16, paddingBottom: 8, flexGrow: 1, justifyContent: 'flex-end' },
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

import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
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
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useAuth } from '../../hooks/useAuth';
import {
  concluirAcessoAdminTemporario,
  listarPerfisPorCodigo,
  type PerfilAdminTemp,
} from '../../utils/adminsTemporarios';

export default function AdminPerfisScreen() {
  const router = useRouter();
  const { signInWithEmail } = useAuth();
  const [codigo, setCodigo] = useState('');
  const [clubeNome, setClubeNome] = useState('');
  const [perfis, setPerfis] = useState<PerfilAdminTemp[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<PerfilAdminTemp | null>(null);
  const [senha, setSenha] = useState('');
  const [senha2, setSenha2] = useState('');
  const [busy, setBusy] = useState(false);

  async function buscar() {
    if (!codigo.trim()) {
      Alert.alert('Código', 'Digite o código que o organizador te passou.');
      return;
    }
    setLoading(true);
    try {
      const data = await listarPerfisPorCodigo(codigo.trim());
      setClubeNome(data.clubeNome);
      setPerfis(data.perfis || []);
      if (!(data.perfis || []).length) {
        Alert.alert('Perfis', 'Nenhum perfil ativo neste código.');
      }
    } catch (e: unknown) {
      setPerfis([]);
      Alert.alert('Código', e instanceof Error ? e.message : 'Não encontrado');
    } finally {
      setLoading(false);
    }
  }

  async function entrar() {
    if (!selected) return;
    if (!senha || senha.length < 6) {
      Alert.alert('Senha', 'Use pelo menos 6 caracteres.');
      return;
    }
    if (selected.precisaSenha && senha !== senha2) {
      Alert.alert('Senha', 'As senhas não conferem.');
      return;
    }
    setBusy(true);
    try {
      const result = await concluirAcessoAdminTemporario({
        inviteId: selected.id,
        senha,
        modo: selected.precisaSenha ? 'definir_senha' : 'entrar',
      });
      await signInWithEmail(result.email, senha);
      setSelected(null);
      setSenha('');
      setSenha2('');
      router.replace('/clube/painel');
    } catch (e: unknown) {
      Alert.alert(
        'Acesso',
        e instanceof Error
          ? e.message
          : 'Não foi possível entrar. Confira a senha.'
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <TouchableOpacity onPress={() => router.back()} style={styles.backRow}>
            <Ionicons name="arrow-back" size={22} color={Colors.accent} />
            <Text style={styles.backTxt}>Voltar</Text>
          </TouchableOpacity>

          <Text style={styles.badge}>Admin temporário</Text>
          <Text style={styles.title}>Escolha seu perfil</Text>
          <Text style={styles.sub}>
            Digite o código do clube, toque no seu perfil e {''}
            {perfis.some((p) => p.precisaSenha)
              ? 'termine de definir a senha.'
              : 'entre com a senha.'}
          </Text>

          <Input
            label="Código do clube"
            value={codigo}
            onChangeText={(t) => setCodigo(t.toUpperCase())}
            autoCapitalize="characters"
            placeholder="Ex.: A3K9P2"
          />
          <Button label="Ver perfis" onPress={() => void buscar()} loading={loading} />

          {clubeNome ? (
            <Text style={styles.clubeNome}>{clubeNome}</Text>
          ) : null}

          <View style={styles.grid}>
            {perfis.map((p) => (
              <TouchableOpacity
                key={p.id}
                style={styles.perfilCard}
                onPress={() => {
                  setSelected(p);
                  setSenha('');
                  setSenha2('');
                }}
              >
                <View style={styles.avatar}>
                  <Text style={styles.avatarLetter}>
                    {(p.nome || '?').charAt(0).toUpperCase()}
                  </Text>
                </View>
                <Text style={styles.perfilNome} numberOfLines={2}>
                  {p.nome}
                </Text>
                <Text style={styles.perfilMeta}>
                  {p.precisaSenha ? 'Definir senha' : 'Entrar'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={!!selected} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{selected?.nome}</Text>
            <Text style={styles.modalSub}>
              {selected?.precisaSenha
                ? 'Crie sua senha para acessar o painel do organizador.'
                : 'Digite sua senha para entrar.'}
            </Text>
            <Input
              label="Senha"
              value={senha}
              onChangeText={setSenha}
              showPasswordToggle
              placeholder="Mínimo 6 caracteres"
            />
            {selected?.precisaSenha ? (
              <Input
                label="Confirmar senha"
                value={senha2}
                onChangeText={setSenha2}
                showPasswordToggle
                placeholder="Repita a senha"
              />
            ) : null}
            <Button
              label={selected?.precisaSenha ? 'Salvar senha e entrar' : 'Entrar'}
              onPress={() => void entrar()}
              loading={busy}
            />
            <TouchableOpacity onPress={() => setSelected(null)}>
              <Text style={styles.cancel}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 40, gap: 14 },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  backTxt: { color: Colors.accent, fontWeight: '600' },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.accent,
    color: Colors.textOnAccent,
    fontWeight: 'bold',
    fontSize: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    overflow: 'hidden',
  },
  title: { color: Colors.textPrimary, fontSize: 28, fontWeight: 'bold' },
  sub: { color: Colors.textSecondary, fontSize: 14, lineHeight: 20 },
  clubeNome: {
    color: Colors.accent,
    fontWeight: '700',
    fontSize: 16,
    marginTop: 8,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 8,
  },
  perfilCard: {
    width: '47%',
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    gap: 8,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    color: Colors.textOnAccent,
    fontWeight: '800',
    fontSize: 28,
  },
  perfilNome: {
    color: Colors.textPrimary,
    fontWeight: '700',
    textAlign: 'center',
    fontSize: 14,
  },
  perfilMeta: { color: Colors.textSecondary, fontSize: 11 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: Colors.surfaceDark,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    gap: 12,
  },
  modalTitle: { color: Colors.textPrimary, fontWeight: 'bold', fontSize: 20 },
  modalSub: { color: Colors.textSecondary, fontSize: 13, lineHeight: 18 },
  cancel: { color: Colors.textSecondary, textAlign: 'center', padding: 8 },
});

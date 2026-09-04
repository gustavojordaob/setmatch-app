import { useEffect, useState } from 'react';
import {
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { doc, getDoc } from 'firebase/firestore';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { db } from '../../utils/firebaseConfig';
import { Colors } from '../../constants/colors';
import { Input } from '../../components/ui/Input';
import { PhoneInput } from '../../components/ui/PhoneInput';
import { Button } from '../../components/ui/Button';
import { ButtonFooter } from '../../components/ui/ButtonFooter';
import { atualizarClube, salvarLogoClube } from '../../services/clubes';
import { telefoneSalvoValido } from '../../utils/telefoneInternacional';
import { uploadLogoClube } from '../../utils/uploadFoto';

export default function EditarClubeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [nome, setNome] = useState('');
  const [cidade, setCidade] = useState('');
  const [bairro, setBairro] = useState('');
  const [estado, setEstado] = useState('');
  const [cep, setCep] = useState('');
  const [endereco, setEndereco] = useState('');
  const [telefone, setTelefone] = useState('');
  const [descricao, setDescricao] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  useEffect(() => {
    if (!id) return;
    void (async () => {
      const snap = await getDoc(doc(db, 'clubes', id));
      if (!snap.exists()) return;
      const d = snap.data();
      setNome(String(d.nome ?? ''));
      setCidade(String(d.cidade ?? ''));
      setBairro(String(d.bairro ?? ''));
      setEstado(String(d.estado ?? ''));
      setCep(String(d.cep ?? ''));
      setEndereco(String(d.endereco ?? ''));
      setTelefone(String(d.telefone ?? ''));
      setDescricao(String(d.descricao ?? ''));
      setLogoUrl(String(d.logoUrl ?? ''));
    })();
  }, [id]);

  async function escolherLogo() {
    if (!id) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Logo', 'Permita acesso às fotos para enviar o logo.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (result.canceled || !result.assets[0]?.uri) return;

    const uri = result.assets[0].uri;
    setPreviewUri(uri);
    setUploadingLogo(true);
    try {
      const url = await uploadLogoClube(id, uri);
      await salvarLogoClube(id, url);
      setLogoUrl(url);
      setPreviewUri(null);
      Alert.alert('Logo', 'Logo salvo — aparece nos rankings do clube.');
    } catch (e: unknown) {
      setPreviewUri(null);
      Alert.alert('Logo', e instanceof Error ? e.message : 'Falha no upload.');
    } finally {
      setUploadingLogo(false);
    }
  }

  async function salvar() {
    if (!id) return;
    if (telefone && !telefoneSalvoValido(telefone)) {
      Alert.alert('Clube', 'Telefone inválido — use código do país + DDD.');
      return;
    }
    setLoading(true);
    try {
      await atualizarClube(id, {
        nome: nome.trim(),
        cidade: cidade.trim(),
        bairro: bairro.trim(),
        estado: estado.trim().toUpperCase(),
        cep: cep.trim(),
        endereco: endereco.trim(),
        telefone: telefone.replace(/\D/g, ''),
        descricao: descricao.trim(),
      });
      router.back();
    } catch (e: unknown) {
      Alert.alert('Clube', e instanceof Error ? e.message : 'Erro ao salvar.');
    } finally {
      setLoading(false);
    }
  }

  const logoExibida = previewUri || logoUrl || null;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={26} color={Colors.accent} />
        </TouchableOpacity>
        <Text style={styles.title}>Editar clube</Text>
        <View style={{ width: 26 }} />
      </View>
      <ScrollView
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="never"
        keyboardDismissMode="on-drag"
      >
        <View style={styles.logoCard}>
          <Text style={styles.logoLabel}>Logo do clube</Text>
          <Text style={styles.logoHint}>
            Aparece ao lado do nome do ranking e do clube na aba Troféu.
          </Text>
          <TouchableOpacity
            style={styles.logoBtn}
            onPress={() => void escolherLogo()}
            disabled={uploadingLogo}
            activeOpacity={0.85}
          >
            {logoExibida ? (
              <Image source={{ uri: logoExibida }} style={styles.logoImg} />
            ) : (
              <View style={styles.logoPlaceholder}>
                <Ionicons name="image-outline" size={32} color={Colors.accent} />
                <Text style={styles.logoPlaceholderTxt}>Escolher logo</Text>
              </View>
            )}
          </TouchableOpacity>
          <Button
            label={uploadingLogo ? 'Enviando…' : logoUrl ? 'Trocar logo' : 'Adicionar logo'}
            variant="outline"
            loading={uploadingLogo}
            onPress={() => void escolherLogo()}
          />
        </View>

        <Input label="Nome" value={nome} onChangeText={setNome} />
        <Input label="Endereço" value={endereco} onChangeText={setEndereco} />
        <Input label="Bairro" value={bairro} onChangeText={setBairro} />
        <Input label="Cidade" value={cidade} onChangeText={setCidade} />
        <Input label="UF" value={estado} onChangeText={setEstado} maxLength={2} />
        <Input label="CEP" value={cep} onChangeText={setCep} />
        <PhoneInput
          label="Telefone (WhatsApp)"
          value={telefone}
          onChangeValue={setTelefone}
        />
        <Input label="Descrição" value={descricao} onChangeText={setDescricao} />
      </ScrollView>
      <ButtonFooter>
        <Button label="Salvar" onPress={salvar} loading={loading} />
      </ButtonFooter>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  title: { color: Colors.textPrimary, fontWeight: 'bold', fontSize: 18 },
  body: { padding: 20, gap: 14, paddingBottom: 120 },
  logoCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    gap: 10,
    alignItems: 'center',
  },
  logoLabel: {
    alignSelf: 'flex-start',
    color: Colors.white,
    fontWeight: '800',
    fontSize: 15,
  },
  logoHint: {
    alignSelf: 'flex-start',
    color: Colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  logoBtn: { marginVertical: 4 },
  logoImg: {
    width: 96,
    height: 96,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: Colors.accent,
  },
  logoPlaceholder: {
    width: 96,
    height: 96,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  logoPlaceholderTxt: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontWeight: '600',
  },
});

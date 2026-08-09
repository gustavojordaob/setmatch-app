import { useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Colors } from '../../constants/colors';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { ButtonFooter } from '../../components/ui/ButtonFooter';
import { useAuth } from '../../hooks/useAuth';
import { uploadFotoPerfil } from '../../utils/uploadFoto';
import { telefoneSalvoValido } from '../../utils/telefoneInternacional';
import { PhoneInput } from '../../components/ui/PhoneInput';

export default function PerfilEditarScreen() {
  const router = useRouter();
  const { perfil, updatePerfil, isAdminClube } = useAuth();
  const [nome, setNome] = useState(perfil?.nome ?? '');
  const [telefone, setTelefone] = useState(perfil?.telefone ?? '');
  const [cidade, setCidade] = useState(perfil?.cidade ?? '');
  const [bairro, setBairro] = useState(perfil?.bairro ?? '');
  const [estado, setEstado] = useState(perfil?.estado ?? '');
  const [cep, setCep] = useState(perfil?.cep ?? '');
  const [rua, setRua] = useState(perfil?.rua ?? '');
  const [fotoUrl, setFotoUrl] = useState(perfil?.fotoUrl ?? '');
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [uploadingFoto, setUploadingFoto] = useState(false);
  const [loading, setLoading] = useState(false);

  async function escolherFoto() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Foto', 'Permita acesso à galeria.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;

    const uri = result.assets[0].uri;
    setPreviewUri(uri);
    setUploadingFoto(true);
    try {
      const url = await uploadFotoPerfil(uri);
      setFotoUrl(url);
    } catch (e: unknown) {
      setPreviewUri(null);
      Alert.alert('Upload', e instanceof Error ? e.message : 'Não foi possível enviar a foto.');
    } finally {
      setUploadingFoto(false);
    }
  }

  async function salvar() {
    if (!nome.trim() || !telefoneSalvoValido(telefone)) {
      Alert.alert('Perfil', 'Nome e celular com código do país são obrigatórios.');
      return;
    }
    if (uploadingFoto) {
      Alert.alert('Perfil', 'Aguarde o envio da foto.');
      return;
    }
    setLoading(true);
    try {
      await updatePerfil({
        nome: nome.trim(),
        telefone: telefone.replace(/\D/g, ''),
        cidade: cidade.trim(),
        bairro: bairro.trim(),
        estado: estado.trim().toUpperCase(),
        cep: cep.trim(),
        rua: rua.trim(),
        fotoUrl: fotoUrl.trim(),
      });
      Alert.alert('Perfil', 'Dados atualizados.', [
        {
          text: 'OK',
          onPress: () =>
            router.replace(isAdminClube ? '/clube/painel' : '/(tabs)/perfil'),
        },
      ]);
    } catch (e: unknown) {
      Alert.alert('Perfil', e instanceof Error ? e.message : 'Erro ao salvar.');
    } finally {
      setLoading(false);
    }
  }

  const fotoExibida = previewUri || fotoUrl || null;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={26} color={Colors.accent} />
        </TouchableOpacity>
        <Text style={styles.title}>Editar perfil</Text>
        <View style={{ width: 26 }} />
      </View>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <TouchableOpacity
            style={styles.fotoWrap}
            onPress={() => void escolherFoto()}
            disabled={uploadingFoto}
          >
            {fotoExibida ? (
              <Image source={{ uri: fotoExibida }} style={styles.foto} />
            ) : (
              <View style={[styles.foto, styles.fotoPlaceholder]}>
                <Ionicons name="person" size={48} color={Colors.textSecondary} />
              </View>
            )}
            <View style={styles.fotoBadge}>
              {uploadingFoto ? (
                <ActivityIndicator size="small" color={Colors.textOnAccent} />
              ) : (
                <Ionicons name="camera" size={16} color={Colors.textOnAccent} />
              )}
            </View>
          </TouchableOpacity>
          <Text style={styles.fotoHint}>
            {uploadingFoto ? 'Enviando foto…' : 'Toque para alterar a foto'}
          </Text>

          <Input label="Nome" value={nome} onChangeText={setNome} />
          <PhoneInput
            label="Celular (WhatsApp)"
            value={telefone}
            onChangeValue={setTelefone}
          />
          <Input label="Cidade" value={cidade} onChangeText={setCidade} />
          <Input label="Bairro" value={bairro} onChangeText={setBairro} />
          <Input
            label="UF"
            value={estado}
            onChangeText={setEstado}
            maxLength={2}
            autoCapitalize="characters"
          />
          <Input label="CEP" value={cep} onChangeText={setCep} keyboardType="number-pad" />
          <Input label="Rua / referência" value={rua} onChangeText={setRua} />
        </ScrollView>
        <ButtonFooter>
          <Button
            label="Salvar"
            onPress={() => void salvar()}
            loading={loading}
            disabled={uploadingFoto}
          />
        </ButtonFooter>
      </KeyboardAvoidingView>
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
  body: { padding: 20, gap: 14, paddingBottom: 40, alignItems: 'stretch' },
  fotoWrap: { alignSelf: 'center', marginBottom: 4 },
  foto: {
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 3,
    borderColor: Colors.accent,
  },
  fotoPlaceholder: {
    backgroundColor: Colors.surfaceDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fotoBadge: {
    position: 'absolute',
    right: 2,
    bottom: 2,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.background,
  },
  fotoHint: {
    color: Colors.textSecondary,
    textAlign: 'center',
    fontSize: 13,
    marginBottom: 8,
  },
});

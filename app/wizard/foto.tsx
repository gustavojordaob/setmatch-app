import { useState } from 'react';
import { Alert, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Colors } from '../../constants/colors';
import { Radius } from '../../constants/radius';
import { WizardLayout } from '../../components/wizard/WizardLayout';
import { useAuth } from '../../hooks/useAuth';
import { useWizard } from '../../contexts/WizardContext';
import { uploadFotoPerfil } from '../../utils/uploadFoto';

export default function WizardFotoScreen() {
  const router = useRouter();
  const { user, saveWizardProfile } = useAuth();
  const { draft, setDraft, resetDraft } = useWizard();
  const [uri, setUri] = useState<string | null>(draft.fotoUrl ?? null);
  const [loading, setLoading] = useState(false);

  async function escolherFoto() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Foto', 'Permita acesso à galeria para escolher uma foto.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setUri(result.assets[0].uri);
    }
  }

  async function finalizar() {
    if (!user) return;
    setLoading(true);
    try {
      let fotoUrl = uri ?? user.photoURL ?? '';
      if (uri && !uri.startsWith('http')) {
        fotoUrl = await uploadFotoPerfil(user.uid, uri);
      }
      await saveWizardProfile({ ...draft, fotoUrl });
      resetDraft();
      router.replace('/(tabs)/home');
    } catch (e: unknown) {
      Alert.alert('Perfil', e instanceof Error ? e.message : 'Não foi possível salvar.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <WizardLayout
      step={7}
      title="Adicione uma foto de perfil"
      onContinue={finalizar}
      continueLabel="Concluir"
      loading={loading}
    >
      <TouchableOpacity style={styles.avatarWrap} onPress={escolherFoto}>
        {uri ? (
          <Image source={{ uri }} style={styles.avatar} />
        ) : (
          <View style={styles.placeholder}>
            <Text style={styles.placeholderIcon}>📷</Text>
            <Text style={styles.placeholderText}>Toque para escolher</Text>
          </View>
        )}
      </TouchableOpacity>
      <Text style={styles.skip} onPress={finalizar}>
        Pular por agora
      </Text>
    </WizardLayout>
  );
}

const styles = StyleSheet.create({
  avatarWrap: { alignSelf: 'center', marginTop: 24 },
  avatar: { width: 160, height: 160, borderRadius: 80 },
  placeholder: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: Colors.surface,
    borderWidth: 2,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderIcon: { fontSize: 40 },
  placeholderText: { color: Colors.textSecondary, marginTop: 8 },
  skip: {
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 20,
    textDecorationLine: 'underline',
  },
});

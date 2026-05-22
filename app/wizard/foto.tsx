import { useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { Button } from '../../components/ui/Button';
import { WizardLayout } from '../../components/wizard/WizardLayout';
import { useAuth } from '../../hooks/useAuth';
import { useWizard } from '../../contexts/WizardContext';
import { uploadFotoPerfil } from '../../utils/uploadFoto';

export default function WizardFotoScreen() {
  const router = useRouter();
  const { user, saveWizardProfile } = useAuth();
  const { draft, setDraft, resetDraft } = useWizard();
  const [uri, setUri] = useState<string | null>(null);
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
        fotoUrl = await uploadFotoPerfil(uri);
      }
      await saveWizardProfile({ ...draft, fotoUrl });
      resetDraft();
      router.replace('/(tabs)/home');
    } catch (e: unknown) {
      Alert.alert('Upload', e instanceof Error ? e.message : 'Não foi possível concluir.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <WizardLayout
      title="Faça o upload da sua foto"
      continueLabel="Fazer Upload"
      onContinue={finalizar}
      loading={loading}
    >
      <TouchableOpacity style={styles.cameraWrap} onPress={escolherFoto}>
        <View style={styles.cameraCircle}>
          <Ionicons name="camera" size={48} color={Colors.accent} />
        </View>
      </TouchableOpacity>
      <Text style={styles.link} onPress={escolherFoto}>
        Selecionar imagem no dispositivo
      </Text>
    </WizardLayout>
  );
}

const styles = StyleSheet.create({
  cameraWrap: { alignItems: 'center', marginTop: 48 },
  cameraCircle: {
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 3,
    borderColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  link: {
    color: Colors.textPrimary,
    textAlign: 'center',
    marginTop: 24,
    textDecorationLine: 'underline',
    fontSize: 15,
  },
});

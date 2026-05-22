import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { useAuth } from '../../hooks/useAuth';

interface AuthSocialRowProps {
  loading?: boolean;
  onGoogleStart?: () => void;
  onGoogleEnd?: () => void;
}

export function AuthSocialRow({ loading, onGoogleStart, onGoogleEnd }: AuthSocialRowProps) {
  const { signInWithGoogle } = useAuth();

  async function onGoogle() {
    onGoogleStart?.();
    try {
      await signInWithGoogle();
    } catch (e: unknown) {
      Alert.alert('Google', e instanceof Error ? e.message : 'Falha no Google.');
    } finally {
      onGoogleEnd?.();
    }
  }

  function emBreve(rede: string) {
    Alert.alert(rede, 'Em breve');
  }

  return (
    <View style={styles.row}>
      <TouchableOpacity
        style={styles.circle}
        onPress={onGoogle}
        disabled={loading}
        accessibilityLabel="Google"
      >
        <Text style={styles.letter}>G</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.circle} onPress={() => emBreve('Apple')}>
        <Ionicons name="logo-apple" size={24} color={Colors.white} />
      </TouchableOpacity>
      <TouchableOpacity style={styles.circle} onPress={() => emBreve('Facebook')}>
        <Ionicons name="logo-facebook" size={24} color={Colors.white} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    marginVertical: 8,
  },
  circle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  letter: {
    color: Colors.white,
    fontSize: 22,
    fontWeight: 'bold',
  },
});

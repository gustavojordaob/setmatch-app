import { Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors } from '../../constants/colors';
import { PRIVACY_PAGE_URL, TERMS_PAGE_URL } from '../../constants/legal';

type Props = {
  accepted: boolean;
  onToggle: () => void;
};

export function LegalConsent({ accepted, onToggle }: Props) {
  return (
    <TouchableOpacity style={styles.row} onPress={onToggle} activeOpacity={0.8}>
      <View style={[styles.box, accepted && styles.boxOn]}>
        {accepted ? <Text style={styles.check}>✓</Text> : null}
      </View>
      <Text style={styles.text}>
        Li e concordo com os{' '}
        <Text style={styles.link} onPress={() => void Linking.openURL(TERMS_PAGE_URL)}>
          Termos de Uso
        </Text>{' '}
        e a{' '}
        <Text style={styles.link} onPress={() => void Linking.openURL(PRIVACY_PAGE_URL)}>
          Política de Privacidade
        </Text>
        .
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginVertical: 4 },
  box: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  boxOn: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  check: { color: Colors.textOnAccent, fontWeight: '900', fontSize: 12 },
  text: { flex: 1, color: Colors.textPrimary, fontSize: 13, lineHeight: 18, opacity: 0.95 },
  link: { color: Colors.accent, fontWeight: '700', textDecorationLine: 'underline' },
});

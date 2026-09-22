import { Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/colors';
import { Radius } from '../constants/radius';
import {
  SUPPORT_EMAIL,
  SUPPORT_PAGE_URL,
  SUPPORT_PHONE_DISPLAY,
} from '../constants/support';
import { Button } from '../components/ui/Button';
import { openSupportWhatsApp } from '../utils/supportContact';
import { useT } from '../hooks/useI18n';

const FAQ = [
  {
    q: 'Como desafiar outro jogador?',
    a: 'Na Home ou em Partidas, toque em desafiar e escolha o adversário, local e horário.',
  },
  {
    q: 'Como falar com um clube ou professor?',
    a: 'Abra o perfil do clube/professor ou a aula e envie uma mensagem pelo chat do app. A notificação aparece em Notificações → Mensagens.',
  },
  {
    q: 'Sou dono de clube ou professor — onde vejo mensagens?',
    a: 'No painel do clube em “Mensagens do clube”, e também em Notificações (aba Mensagens), com indicador de não lidas.',
  },
  {
    q: 'Como solicitar ser professor ou admin?',
    a: 'Na tela de login admin, use “Solicitar ser professor” ou “Solicitar admin” e envie seus dados.',
  },
];

export default function AjudaScreen() {
  const router = useRouter();
  const t = useT();

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8} style={styles.back}>
          <Ionicons name="arrow-back" size={26} color={Colors.accent} />
        </TouchableOpacity>
        <Text style={styles.title}>{t('ajuda.title')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.card}>
          <View style={styles.iconWrap}>
            <Ionicons name="headset-outline" size={28} color={Colors.textOnAccent} />
          </View>
          <Text style={styles.cardTitle}>{t('ajuda.contactTitle')}</Text>
          <Text style={styles.cardSub}>{t('ajuda.contactSub')}</Text>
          <Text style={styles.meta}>{SUPPORT_PHONE_DISPLAY}</Text>
          <Text style={styles.meta}>{SUPPORT_EMAIL}</Text>
          <Button
            label={t('ajuda.whatsappCta')}
            onPress={() => void openSupportWhatsApp()}
          />
          <Button
            label={t('ajuda.openWebPage')}
            variant="outline"
            onPress={() => void Linking.openURL(SUPPORT_PAGE_URL)}
          />
        </View>

        <Text style={styles.section}>{t('ajuda.faq')}</Text>
        {FAQ.map((item) => (
          <View key={item.q} style={styles.faqCard}>
            <Text style={styles.faqQ}>{item.q}</Text>
            <Text style={styles.faqA}>{item.a}</Text>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  back: { width: 40, height: 40, justifyContent: 'center' },
  title: {
    color: Colors.textPrimary,
    fontSize: 20,
    fontWeight: 'bold',
  },
  body: { padding: 20, gap: 12, paddingBottom: 40 },
  card: {
    backgroundColor: Colors.surfaceDark,
    borderRadius: Radius.card,
    padding: 20,
    gap: 10,
    alignItems: 'center',
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  cardTitle: {
    color: Colors.textPrimary,
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  cardSub: {
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 4,
  },
  meta: { color: Colors.accent, fontWeight: '600' },
  section: {
    color: Colors.textPrimary,
    fontWeight: 'bold',
    fontSize: 16,
    marginTop: 12,
  },
  faqCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 14,
    gap: 6,
  },
  faqQ: { color: Colors.textPrimary, fontWeight: 'bold' },
  faqA: { color: Colors.textSecondary, fontSize: 13, lineHeight: 18 },
});

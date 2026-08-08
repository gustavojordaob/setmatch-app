import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { Radius } from '../../constants/radius';
import { useAuth } from '../../hooks/useAuth';
import { useConversas, type Conversa } from '../../hooks/useConversas';
import { useDesafios } from '../../hooks/useDesafios';
import { Avatar } from '../../components/ui/Avatar';

type TabNotif = 'confrontos' | 'mensagens' | 'lembretes' | 'sistema';

import { TAB_BAR_CLEARANCE } from '../../constants/tabBar';
const TAB_PAD_BOTTOM = TAB_BAR_CLEARANCE;

const MOCK_HOJE = [
  { hora: '10:30 AM', id: '1' },
  { hora: '9:00 AM', id: '2' },
];

const MOCK_ONTEM = [{ hora: '6:15 PM', id: '3' }];

function formatHora(seconds?: number): string {
  if (!seconds) return '';
  const d = new Date(seconds * 1000);
  const hoje = new Date();
  const mesmoDia =
    d.getDate() === hoje.getDate() &&
    d.getMonth() === hoje.getMonth() &&
    d.getFullYear() === hoje.getFullYear();
  if (mesmoDia) {
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

export default function NotificacoesScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const conversas = useConversas();
  const { recebidosPendentes, agendados } = useDesafios();
  const [aba, setAba] = useState<TabNotif>('confrontos');

  const comMensagem = conversas.filter((c) => c.ultimoTexto);

  function tituloDa(c: Conversa): string {
    if (c.tipo === 'clube') return c.clubeNome ?? 'Clube';
    const outroUid = c.participantes.find((p) => p !== user?.uid);
    return (outroUid && c.nomes?.[outroUid]) || 'Jogador';
  }

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.safe}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.back}>←</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Notificações</Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.toggleRow}>
          <TouchableOpacity
            style={[styles.toggleBtn, aba === 'confrontos' && styles.toggleOn]}
            onPress={() => setAba('confrontos')}
          >
            <Text style={[styles.toggleTxt, aba === 'confrontos' && styles.toggleTxtOn]}>
              CONFRONTOS
            </Text>
            {recebidosPendentes.length > 0 ? (
              <View style={styles.tabBadge}>
                <Text style={styles.tabBadgeTxt}>{recebidosPendentes.length}</Text>
              </View>
            ) : null}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, aba === 'mensagens' && styles.toggleOn]}
            onPress={() => setAba('mensagens')}
          >
            <Text style={[styles.toggleTxt, aba === 'mensagens' && styles.toggleTxtOn]}>
              MENSAGENS
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, aba === 'lembretes' && styles.toggleOn]}
            onPress={() => setAba('lembretes')}
          >
            <Text style={[styles.toggleTxt, aba === 'lembretes' && styles.toggleTxtOn]}>
              LEMBRETES
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, aba === 'sistema' && styles.toggleOn]}
            onPress={() => setAba('sistema')}
          >
            <Text style={[styles.toggleTxt, aba === 'sistema' && styles.toggleTxtOn]}>
              SISTEMA
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={{ paddingBottom: TAB_PAD_BOTTOM, paddingHorizontal: 20 }}>
          {aba === 'confrontos' ? (
            recebidosPendentes.length === 0 && agendados.length === 0 ? (
              <View style={styles.emptyBox}>
                <Ionicons name="tennisball-outline" size={36} color={Colors.textSecondary} />
                <Text style={styles.empty}>Nenhum confronto no momento.</Text>
                <TouchableOpacity onPress={() => router.push('/(tabs)/desafios')}>
                  <Text style={styles.emptyLink}>Ver partidas</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                {recebidosPendentes.length > 0 ? (
                  <Text style={styles.section}>Convites recebidos</Text>
                ) : null}
                {recebidosPendentes.map((d) => (
                  <TouchableOpacity
                    key={d.id}
                    style={styles.card}
                    onPress={() => router.push(`/desafio/${d.id}`)}
                  >
                    <Avatar uri={d.desafianteFoto} nome={d.desafianteNome} size="sm" />
                    <View style={styles.cardBody}>
                      <Text style={styles.cardTitle} numberOfLines={1}>
                        {d.desafianteNome} te desafiou
                      </Text>
                      <Text style={styles.cardSub} numberOfLines={1}>
                        {d.quadra || 'Local a combinar'}
                      </Text>
                    </View>
                    <View style={styles.respTag}>
                      <Text style={styles.respTagTxt}>RESPONDER</Text>
                    </View>
                  </TouchableOpacity>
                ))}

                {agendados.length > 0 ? (
                  <Text style={[styles.section, { marginTop: 16 }]}>Partidas marcadas</Text>
                ) : null}
                {agendados.map((d) => {
                  const outroNome = d.desafiante === user?.uid ? d.desafiadoNome : d.desafianteNome;
                  const outroFoto = d.desafiante === user?.uid ? d.desafiadoFoto : d.desafianteFoto;
                  return (
                    <TouchableOpacity
                      key={d.id}
                      style={styles.card}
                      onPress={() => router.push(`/desafio/${d.id}`)}
                    >
                      <Avatar uri={outroFoto} nome={outroNome} size="sm" />
                      <View style={styles.cardBody}>
                        <Text style={styles.cardTitle} numberOfLines={1}>
                          vs {outroNome}
                        </Text>
                        <Text style={styles.cardSub} numberOfLines={1}>
                          {d.dataSugerida || d.quadra || 'Registrar placar'}
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={18} color={Colors.accent} />
                    </TouchableOpacity>
                  );
                })}
              </>
            )
          ) : aba === 'mensagens' ? (
            comMensagem.length === 0 ? (
              <View style={styles.emptyBox}>
                <Ionicons name="chatbubbles-outline" size={36} color={Colors.textSecondary} />
                <Text style={styles.empty}>Nenhuma mensagem recente.</Text>
                <TouchableOpacity onPress={() => router.push('/(tabs)/mensagens')}>
                  <Text style={styles.emptyLink}>Ir para Mensagens</Text>
                </TouchableOpacity>
              </View>
            ) : (
              comMensagem.map((c) => (
                <TouchableOpacity
                  key={c.id}
                  style={styles.card}
                  onPress={() => router.push(`/chat/${c.id}`)}
                >
                  <View style={styles.iconBox}>
                    <Ionicons
                      name={c.tipo === 'clube' ? 'business' : 'chatbubble-ellipses'}
                      size={20}
                      color={Colors.accent}
                    />
                  </View>
                  <View style={styles.cardBody}>
                    <Text style={styles.cardTitle} numberOfLines={1}>
                      {tituloDa(c)}
                    </Text>
                    <Text style={styles.cardSub} numberOfLines={1}>
                      {c.ultimoTexto}
                    </Text>
                  </View>
                  <Text style={styles.hora}>{formatHora(c.atualizadoEm?.seconds)}</Text>
                </TouchableOpacity>
              ))
            )
          ) : (
            <>
              <Text style={styles.section}>Hoje</Text>
              {MOCK_HOJE.map((n) => (
                <NotifCard key={n.id} hora={n.hora} />
              ))}

              <Text style={[styles.section, { marginTop: 20 }]}>Ontem</Text>
              {MOCK_ONTEM.map((n) => (
                <NotifCard key={n.id} hora={n.hora} />
              ))}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function NotifCard({ hora }: { hora: string }) {
  return (
    <View style={styles.card}>
      <View style={styles.iconBox}>
        <Ionicons name="trophy" size={22} color={Colors.accent} />
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.cardTitle}>Notificação</Text>
        <Text style={styles.cardSub}>Texto Placeholder para as notificações.</Text>
      </View>
      <Text style={styles.hora}>{hora}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  safe: { flex: 1 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    marginBottom: 16,
  },
  back: { color: Colors.accent, fontSize: 28, fontWeight: 'bold', width: 40 },
  title: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  headerSpacer: { width: 40 },
  toggleRow: {
    flexDirection: 'row',
    marginHorizontal: 20,
    backgroundColor: Colors.surfaceDark,
    borderRadius: Radius.pill,
    padding: 4,
    marginBottom: 20,
  },
  toggleBtn: {
    flex: 1,
    flexDirection: 'row',
    gap: 4,
    paddingVertical: 12,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleOn: { backgroundColor: Colors.accent },
  toggleTxt: { color: Colors.white, fontWeight: 'bold', fontSize: 11 },
  toggleTxtOn: { color: Colors.textOnAccent },
  tabBadge: {
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  tabBadgeTxt: { color: Colors.white, fontSize: 9, fontWeight: 'bold' },
  respTag: {
    backgroundColor: Colors.accent,
    borderRadius: Radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  respTagTxt: { color: Colors.textOnAccent, fontSize: 10, fontWeight: 'bold' },
  section: { color: Colors.textPrimary, fontWeight: 'bold', fontSize: 16, marginBottom: 10 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceDark,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    gap: 12,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: { flex: 1 },
  cardTitle: { color: Colors.textPrimary, fontWeight: 'bold' },
  cardSub: { color: Colors.textSecondary, fontSize: 12, marginTop: 4 },
  hora: { color: Colors.textSecondary, fontSize: 11 },
  emptyBox: { alignItems: 'center', gap: 10, marginTop: 40 },
  empty: { color: Colors.textSecondary },
  emptyLink: { color: Colors.accent, fontWeight: 'bold' },
});

import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { Radius } from '../../constants/radius';
import { useAuth } from '../../hooks/useAuth';
import {
  naoLidasDaConversa,
  totalNaoLidas,
  useConversas,
  type Conversa,
} from '../../hooks/useConversas';
import { useDesafios } from '../../hooks/useDesafios';
import { useNotificacoes } from '../../hooks/useNotificacoes';
import { marcarNotificacaoLida, type NotificacaoApp } from '../../services/notificacoes';
import { Avatar } from '../../components/ui/Avatar';
import { UnreadBadge } from '../../components/ui/UnreadBadge';
import { useT } from '../../hooks/useI18n';
import { TAB_BAR_CLEARANCE } from '../../constants/tabBar';

const TAB_PAD_BOTTOM = TAB_BAR_CLEARANCE;

type TabNotif = 'confrontos' | 'mensagens' | 'lembretes' | 'sistema';

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

function iconForTipo(tipo: NotificacaoApp['tipo']): keyof typeof Ionicons.glyphMap {
  switch (tipo) {
    case 'desafio':
      return 'tennisball-outline';
    case 'reserva_ranking':
      return 'calendar-outline';
    case 'chave_torneio':
      return 'git-branch-outline';
    case 'convite_dupla':
      return 'people-outline';
    case 'pagamento':
      return 'card-outline';
    default:
      return 'notifications-outline';
  }
}

export default function NotificacoesScreen() {
  const router = useRouter();
  const t = useT();
  const { user } = useAuth();
  const conversas = useConversas();
  const { recebidosPendentes, agendados } = useDesafios();
  const { itens: notifs } = useNotificacoes();
  const [aba, setAba] = useState<TabNotif>('confrontos');
  const [autoAba, setAutoAba] = useState(false);

  const msgsNaoLidas = totalNaoLidas(conversas, user?.uid);

  const lembretes = useMemo(
    () =>
      notifs.filter((n) =>
        ['desafio', 'reserva_ranking', 'convite_dupla'].includes(n.tipo)
      ),
    [notifs]
  );
  const sistema = useMemo(
    () =>
      notifs.filter((n) =>
        ['chave_torneio', 'pagamento', 'sistema'].includes(n.tipo)
      ),
    [notifs]
  );

  const comMensagem = useMemo(() => {
    const list = conversas.filter((c) => c.ultimoTexto);
    list.sort((a, b) => {
      const ua = naoLidasDaConversa(a, user?.uid);
      const ub = naoLidasDaConversa(b, user?.uid);
      if (ub !== ua) return ub - ua;
      return (b.atualizadoEm?.seconds ?? 0) - (a.atualizadoEm?.seconds ?? 0);
    });
    return list;
  }, [conversas, user?.uid]);

  useEffect(() => {
    if (autoAba) return;
    if (msgsNaoLidas > 0) {
      setAba('mensagens');
      setAutoAba(true);
    }
  }, [msgsNaoLidas, autoAba]);

  function tituloDa(c: Conversa): string {
    if (c.tipo === 'clube') return c.clubeNome ?? 'Clube';
    const outroUid = c.participantes.find((p) => p !== user?.uid);
    return (outroUid && c.nomes?.[outroUid]) || 'Jogador';
  }

  async function abrirNotif(n: NotificacaoApp) {
    if (user?.uid && !n.lida) {
      void marcarNotificacaoLida(user.uid, n.id);
    }
    if (n.rota) router.push(n.rota as never);
  }

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.safe}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.back}>←</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{t('notificacoes.title')}</Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.toggleRow}>
          <TouchableOpacity
            style={[styles.toggleBtn, aba === 'confrontos' && styles.toggleOn]}
            onPress={() => setAba('confrontos')}
          >
            <Text style={[styles.toggleTxt, aba === 'confrontos' && styles.toggleTxtOn]}>
              {t('home.confrontos').toUpperCase()}
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
              {t('mensagens.title').toUpperCase()}
            </Text>
            {msgsNaoLidas > 0 ? (
              <View style={styles.tabBadge}>
                <Text style={styles.tabBadgeTxt}>
                  {msgsNaoLidas > 99 ? '99+' : msgsNaoLidas}
                </Text>
              </View>
            ) : null}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, aba === 'lembretes' && styles.toggleOn]}
            onPress={() => setAba('lembretes')}
          >
            <Text style={[styles.toggleTxt, aba === 'lembretes' && styles.toggleTxtOn]}>
              LEMBRETES
            </Text>
            {lembretes.filter((n) => !n.lida).length > 0 ? (
              <View style={styles.tabBadge}>
                <Text style={styles.tabBadgeTxt}>{lembretes.filter((n) => !n.lida).length}</Text>
              </View>
            ) : null}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, aba === 'sistema' && styles.toggleOn]}
            onPress={() => setAba('sistema')}
          >
            <Text style={[styles.toggleTxt, aba === 'sistema' && styles.toggleTxtOn]}>
              SISTEMA
            </Text>
            {sistema.filter((n) => !n.lida).length > 0 ? (
              <View style={styles.tabBadge}>
                <Text style={styles.tabBadgeTxt}>{sistema.filter((n) => !n.lida).length}</Text>
              </View>
            ) : null}
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
                      <Text style={styles.respTagTxt}>{t('home.respond')}</Text>
                    </View>
                  </TouchableOpacity>
                ))}

                {agendados.length > 0 ? (
                  <Text style={[styles.section, { marginTop: 16 }]}>
                    {t('desafios.scheduled')}
                  </Text>
                ) : null}
                {agendados.map((d) => {
                  const outroNome =
                    d.desafiante === user?.uid ? d.desafiadoNome : d.desafianteNome;
                  const outroFoto =
                    d.desafiante === user?.uid ? d.desafiadoFoto : d.desafianteFoto;
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
                <Text style={styles.empty}>{t('mensagens.noneRecent')}</Text>
                <TouchableOpacity onPress={() => router.push('/(tabs)/mensagens')}>
                  <Text style={styles.emptyLink}>Ir para Mensagens</Text>
                </TouchableOpacity>
              </View>
            ) : (
              comMensagem.map((c) => {
                const outroUid = c.participantes.find((p) => p !== user?.uid);
                const fotoUri = outroUid ? c.fotos?.[outroUid] : undefined;
                const unread = naoLidasDaConversa(c, user?.uid);
                return (
                  <TouchableOpacity
                    key={c.id}
                    style={[styles.card, unread > 0 && styles.cardUnread]}
                    onPress={() => router.push(`/chat/${c.id}`)}
                  >
                    <Avatar uri={fotoUri} nome={tituloDa(c)} size="sm" />
                    <View style={styles.cardBody}>
                      <Text
                        style={[styles.cardTitle, unread > 0 && styles.cardTitleUnread]}
                        numberOfLines={1}
                      >
                        {tituloDa(c)}
                      </Text>
                      <Text
                        style={[styles.cardSub, unread > 0 && styles.cardSubUnread]}
                        numberOfLines={1}
                      >
                        {c.ultimoTexto}
                      </Text>
                    </View>
                    <View style={styles.rightCol}>
                      <Text style={styles.hora}>{formatHora(c.atualizadoEm?.seconds)}</Text>
                      <UnreadBadge count={unread} />
                    </View>
                  </TouchableOpacity>
                );
              })
            )
          ) : aba === 'lembretes' ? (
            lembretes.length === 0 ? (
              <View style={styles.emptyBox}>
                <Ionicons name="alarm-outline" size={36} color={Colors.textSecondary} />
                <Text style={styles.empty}>{t('notificacoes.placeholder')}</Text>
              </View>
            ) : (
              lembretes.map((n) => (
                <TouchableOpacity
                  key={n.id}
                  style={[styles.card, !n.lida && styles.cardUnread]}
                  onPress={() => void abrirNotif(n)}
                >
                  <View style={styles.iconBox}>
                    <Ionicons name={iconForTipo(n.tipo)} size={22} color={Colors.accent} />
                  </View>
                  <View style={styles.cardBody}>
                    <Text style={[styles.cardTitle, !n.lida && styles.cardTitleUnread]}>
                      {n.titulo}
                    </Text>
                    <Text style={styles.cardSub} numberOfLines={2}>
                      {n.corpo}
                    </Text>
                  </View>
                  <Text style={styles.hora}>{formatHora(n.criadoEm?.seconds)}</Text>
                </TouchableOpacity>
              ))
            )
          ) : sistema.length === 0 ? (
            <View style={styles.emptyBox}>
              <Ionicons name="notifications-outline" size={36} color={Colors.textSecondary} />
              <Text style={styles.empty}>{t('notificacoes.placeholder')}</Text>
            </View>
          ) : (
            sistema.map((n) => (
              <TouchableOpacity
                key={n.id}
                style={[styles.card, !n.lida && styles.cardUnread]}
                onPress={() => void abrirNotif(n)}
              >
                <View style={styles.iconBox}>
                  <Ionicons name={iconForTipo(n.tipo)} size={22} color={Colors.accent} />
                </View>
                <View style={styles.cardBody}>
                  <Text style={[styles.cardTitle, !n.lida && styles.cardTitleUnread]}>
                    {n.titulo}
                  </Text>
                  <Text style={styles.cardSub} numberOfLines={2}>
                    {n.corpo}
                  </Text>
                </View>
                <Text style={styles.hora}>{formatHora(n.criadoEm?.seconds)}</Text>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      </SafeAreaView>
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
    marginHorizontal: 12,
    backgroundColor: Colors.surfaceDark,
    borderRadius: Radius.pill,
    padding: 4,
    marginBottom: 20,
  },
  toggleBtn: {
    flex: 1,
    flexDirection: 'row',
    gap: 2,
    paddingVertical: 10,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleOn: { backgroundColor: Colors.accent },
  toggleTxt: { color: Colors.white, fontWeight: 'bold', fontSize: 9 },
  toggleTxtOn: { color: Colors.textOnAccent },
  tabBadge: {
    minWidth: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: Colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  tabBadgeTxt: { color: Colors.white, fontSize: 8, fontWeight: 'bold' },
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
  cardUnread: {
    borderWidth: 1,
    borderColor: Colors.accent,
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
  cardTitleUnread: { color: Colors.accent },
  cardSub: { color: Colors.textSecondary, fontSize: 12, marginTop: 4 },
  cardSubUnread: { color: Colors.textPrimary, fontWeight: '600' },
  rightCol: { alignItems: 'flex-end', gap: 6 },
  hora: { color: Colors.textSecondary, fontSize: 11 },
  emptyBox: { alignItems: 'center', gap: 10, marginTop: 40 },
  empty: { color: Colors.textSecondary, textAlign: 'center', paddingHorizontal: 24 },
  emptyLink: { color: Colors.accent, fontWeight: 'bold' },
});

import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
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
import { Avatar } from '../../components/ui/Avatar';
import { useAuth } from '../../hooks/useAuth';
import { useDesafios, type Desafio } from '../../hooks/useDesafios';
import { useConfrontosTorneio } from '../../hooks/useConfrontosTorneio';
import { ESPORTES } from '../../constants/esportes';
import { labelFormato } from '../../constants/formatosPartida';
import { atualizarStatusDesafio } from '../../services/desafios';
import { useT } from '../../hooks/useI18n';
import type { ConfrontoTorneioUsuario } from '../../services/confrontosUsuario';

import { TAB_BAR_CLEARANCE } from '../../constants/tabBar';
const TAB_PAD_BOTTOM = TAB_BAR_CLEARANCE;

type Aba = 'recebidos' | 'enviados' | 'agendados' | 'historico';

const ABAS: { id: Aba; label: string }[] = [
  { id: 'recebidos', label: 'Recebidos' },
  { id: 'enviados', label: 'Enviados' },
  { id: 'agendados', label: 'Agendados' },
  { id: 'historico', label: 'Histórico' },
];

export default function PartidasScreen() {
  const router = useRouter();
  const t = useT();
  const { user } = useAuth();
  const {
    loading,
    recebidosPendentes,
    enviadosPendentes,
    agendados,
    historico,
  } = useDesafios();
  const { proximos: proximosTorneio, loading: loadingTorneio } = useConfrontosTorneio();
  const [aba, setAba] = useState<Aba>('recebidos');
  const [busyId, setBusyId] = useState<string | null>(null);

  const lista = useMemo(() => {
    if (aba === 'recebidos') return recebidosPendentes;
    if (aba === 'enviados') return enviadosPendentes;
    if (aba === 'agendados') return agendados;
    return historico;
  }, [aba, recebidosPendentes, enviadosPendentes, agendados, historico]);

  const badgeAgendados = agendados.length + proximosTorneio.length;

  async function responder(d: Desafio, status: 'aceito' | 'recusado') {
    setBusyId(d.id);
    try {
      await atualizarStatusDesafio(d.id, status);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('desafios.title')}</Text>
        <TouchableOpacity
          style={styles.novoBtn}
          onPress={() => router.push('/desafio/novo')}
        >
          <Ionicons name="add" size={20} color={Colors.textOnAccent} />
          <Text style={styles.novoTxt}>Novo</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.tabsRow}>
        {ABAS.map((tab) => {
          const on = aba === tab.id;
              const badge =
            tab.id === 'recebidos'
              ? recebidosPendentes.length
              : tab.id === 'agendados'
                ? badgeAgendados
                : 0;
          return (
            <TouchableOpacity
              key={tab.id}
              style={[styles.tab, on && styles.tabOn]}
              onPress={() => setAba(tab.id)}
            >
              <Text style={[styles.tabTxt, on && styles.tabTxtOn]}>{tab.label}</Text>
              {badge > 0 ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeTxt}>{badge}</Text>
                </View>
              ) : null}
            </TouchableOpacity>
          );
        })}
      </View>

      {loading || (aba === 'agendados' && loadingTorneio) ? (
        <ActivityIndicator color={Colors.accent} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: TAB_PAD_BOTTOM }}>
          {aba === 'agendados' &&
          lista.length === 0 &&
          proximosTorneio.length === 0 ? (
            <View style={styles.emptyBox}>
              <Ionicons name="tennisball-outline" size={40} color={Colors.textSecondary} />
              <Text style={styles.empty}>
                Nenhuma partida marcada. Aceite um convite, desafie alguém ou
                aguarde o chaveamento do torneio.
              </Text>
            </View>
          ) : aba !== 'agendados' && lista.length === 0 ? (
            <View style={styles.emptyBox}>
              <Ionicons name="tennisball-outline" size={40} color={Colors.textSecondary} />
              <Text style={styles.empty}>
                {aba === 'recebidos'
                  ? 'Nenhum convite recebido. Quando alguém te desafiar, aparece aqui.'
                  : aba === 'enviados'
                    ? 'Você não enviou convites pendentes.'
                    : 'Sem histórico ainda.'}
              </Text>
              {aba === 'recebidos' && (
                <TouchableOpacity
                  style={styles.ctaBtn}
                  onPress={() => router.push('/desafio/novo')}
                >
                  <Text style={styles.ctaTxt}>{t('desafios.challengeSomeone')}</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <>
              {aba === 'agendados' && proximosTorneio.length > 0 ? (
                <>
                  <Text style={styles.sectionLabel}>Torneios</Text>
                  {proximosTorneio.map((c) => (
                    <TorneioConfrontoCard
                      key={`${c.torneioId}-${c.id}`}
                      c={c}
                      onOpen={() => router.push(c.rota as never)}
                    />
                  ))}
                  {lista.length > 0 ? (
                    <Text style={[styles.sectionLabel, { marginTop: 12 }]}>Desafios</Text>
                  ) : null}
                </>
              ) : null}
              {lista.map((d) => (
                <ConfrontoCard
                  key={d.id}
                  d={d}
                  meuUid={user?.uid}
                  busy={busyId === d.id}
                  onOpen={() => router.push(`/desafio/${d.id}`)}
                  onAceitar={() => void responder(d, 'aceito')}
                  onRecusar={() => void responder(d, 'recusado')}
                />
              ))}
            </>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function TorneioConfrontoCard({
  c,
  onOpen,
}: {
  c: ConfrontoTorneioUsuario;
  onOpen: () => void;
}) {
  return (
    <TouchableOpacity style={styles.card} onPress={onOpen} activeOpacity={0.85}>
      <View style={styles.cardTop}>
        <View style={[styles.statusTag, { backgroundColor: '#4ade8022' }]}>
          <View style={[styles.statusDot, { backgroundColor: '#4ade80' }]} />
          <Text style={[styles.statusTxt, { color: '#4ade80' }]}>Torneio</Text>
        </View>
        <Text style={styles.esp}>{c.labelRodada || 'Chave'}</Text>
      </View>
      <View style={styles.vsRow}>
        <Avatar uri={c.j1Foto} nome={c.j1Nome} size="sm" />
        <Text style={styles.vsNome} numberOfLines={1}>
          {c.j1Nome}
        </Text>
        <Text style={styles.vsX}>×</Text>
        <Text style={[styles.vsNome, { textAlign: 'right' }]} numberOfLines={1}>
          {c.j2Nome}
        </Text>
        <Avatar uri={c.j2Foto} nome={c.j2Nome} size="sm" />
      </View>
      <Text style={styles.metaLine}>
        {c.torneioNome}
        {c.dataHoraInicio ? ` · ${c.dataHoraInicio}` : ''}
        {c.quadraNome ? ` · ${c.quadraNome}` : ''}
      </Text>
    </TouchableOpacity>
  );
}

function ConfrontoCard({
  d,
  meuUid,
  busy,
  onOpen,
  onAceitar,
  onRecusar,
}: {
  d: Desafio;
  meuUid?: string;
  busy: boolean;
  onOpen: () => void;
  onAceitar: () => void;
  onRecusar: () => void;
}) {
  const t = useT();
  const esp = ESPORTES.find((e) => e.id === d.esporte);
  const euDesafiei = d.desafiante === meuUid;
  const souDesafiado = d.desafiado === meuUid;
  const statusMeta: Record<string, { label: string; color: string }> = {
    pendente: { label: euDesafiei ? 'Aguardando resposta' : 'Convite recebido', color: Colors.accent },
    aceito: { label: 'Marcada', color: '#4ade80' },
    recusado: { label: 'Recusada', color: Colors.danger },
    finalizado: { label: 'Finalizada', color: Colors.textSecondary },
  };
  const st = statusMeta[d.status] ?? statusMeta.pendente;

  return (
    <TouchableOpacity style={styles.card} onPress={onOpen} activeOpacity={0.85}>
      <View style={styles.cardTop}>
        <View style={[styles.statusTag, { backgroundColor: `${st.color}22` }]}>
          <View style={[styles.statusDot, { backgroundColor: st.color }]} />
          <Text style={[styles.statusTxt, { color: st.color }]}>{st.label}</Text>
        </View>
        <Text style={styles.espTxt}>
          {esp?.emoji} {d.esporte ? t(`esporte.${d.esporte}`) : esp?.nome}
        </Text>
      </View>

      <View style={styles.vsRow}>
        <View style={styles.player}>
          <Avatar uri={d.desafianteFoto} nome={d.desafianteNome} size="md" />
          <Text style={styles.playerNome} numberOfLines={1}>
            {euDesafiei ? 'Você' : d.desafianteNome.split(' ')[0]}
          </Text>
        </View>
        <Text style={styles.vs}>VS</Text>
        <View style={styles.player}>
          <Avatar uri={d.desafiadoFoto} nome={d.desafiadoNome} size="md" />
          <Text style={styles.playerNome} numberOfLines={1}>
            {souDesafiado ? 'Você' : d.desafiadoNome.split(' ')[0]}
          </Text>
        </View>
      </View>

      <View style={styles.metaRow}>
        <Ionicons name="trophy-outline" size={14} color={Colors.textSecondary} />
        <Text style={styles.metaTxt}>{labelFormato(d.formato)}</Text>
        <Ionicons
          name="location-outline"
          size={14}
          color={Colors.textSecondary}
          style={{ marginLeft: 10 }}
        />
        <Text style={styles.metaTxt} numberOfLines={1}>
          {d.quadra || 'A combinar'}
        </Text>
      </View>
      {d.dataSugerida ? (
        <View style={styles.metaRow}>
          <Ionicons name="calendar-outline" size={14} color={Colors.textSecondary} />
          <Text style={styles.metaTxt}>{d.dataSugerida}</Text>
        </View>
      ) : null}

      {souDesafiado && d.status === 'pendente' ? (
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.actBtn, styles.actAccept]}
            onPress={onAceitar}
            disabled={busy}
          >
            {busy ? (
              <ActivityIndicator size="small" color={Colors.textOnAccent} />
            ) : (
              <Text style={styles.actAcceptTxt}>{t('desafios.accept')}</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actBtn, styles.actReject]}
            onPress={onRecusar}
            disabled={busy}
          >
            <Text style={styles.actRejectTxt}>{t('desafios.decline')}</Text>
          </TouchableOpacity>
        </View>
      ) : d.status === 'aceito' ? (
        <View style={styles.openHint}>
          <Text style={styles.openHintTxt}>Toque para registrar o placar</Text>
          <Ionicons name="chevron-forward" size={16} color={Colors.accent} />
        </View>
      ) : null}
    </TouchableOpacity>
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
  title: { color: Colors.textPrimary, fontSize: 26, fontWeight: 'bold' },
  novoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.accent,
    borderRadius: 60,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  novoTxt: { color: Colors.textOnAccent, fontWeight: 'bold', fontSize: 13 },
  tabsRow: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 16,
    marginTop: 14,
    marginBottom: 4,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 10,
    borderRadius: 60,
    backgroundColor: Colors.surface,
  },
  tabOn: { backgroundColor: Colors.accent },
  tabTxt: { color: Colors.textPrimary, fontWeight: '700', fontSize: 12 },
  tabTxtOn: { color: Colors.textOnAccent },
  badge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeTxt: { color: Colors.white, fontSize: 10, fontWeight: 'bold' },
  emptyBox: { alignItems: 'center', gap: 14, marginTop: 50, paddingHorizontal: 24 },
  empty: { color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  ctaBtn: {
    backgroundColor: Colors.accent,
    borderRadius: 60,
    paddingHorizontal: 22,
    paddingVertical: 12,
  },
  ctaTxt: { color: Colors.textOnAccent, fontWeight: 'bold' },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  statusTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 60,
  },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusTxt: { fontWeight: '700', fontSize: 11 },
  espTxt: { color: Colors.textSecondary, fontSize: 12, fontWeight: '600' },
  vsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  player: { flex: 1, alignItems: 'center', gap: 6 },
  playerNome: { color: Colors.textPrimary, fontWeight: '700', fontSize: 13 },
  vs: { color: Colors.accent, fontWeight: '900', fontSize: 18, paddingHorizontal: 8 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  metaTxt: { color: Colors.textSecondary, fontSize: 12, flexShrink: 1 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  actBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 60,
    alignItems: 'center',
  },
  actAccept: { backgroundColor: Colors.accent },
  actAcceptTxt: { color: Colors.textOnAccent, fontWeight: 'bold' },
  actReject: { borderWidth: 1, borderColor: Colors.textSecondary },
  actRejectTxt: { color: Colors.textPrimary, fontWeight: '700' },
  openHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: 12,
  },
  openHintTxt: { color: Colors.accent, fontWeight: '700', fontSize: 13 },
  sectionLabel: {
    color: Colors.accent,
    fontWeight: '800',
    fontSize: 13,
    marginBottom: 8,
    letterSpacing: 0.3,
  },
  esp: { color: Colors.textSecondary, fontSize: 12, fontWeight: '600' },
  vsNome: { flex: 1, color: Colors.textPrimary, fontWeight: '700', fontSize: 12 },
  vsX: { color: Colors.accent, fontWeight: '900', marginHorizontal: 6 },
  metaLine: { color: Colors.textSecondary, fontSize: 12, marginTop: 4 },
});

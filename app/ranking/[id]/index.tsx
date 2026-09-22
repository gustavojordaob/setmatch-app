import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
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
import { Ionicons } from '@expo/vector-icons';
import { db } from '../../../utils/firebaseConfig';
import { Colors } from '../../../constants/colors';
import { Radius } from '../../../constants/radius';
import { Avatar } from '../../../components/ui/Avatar';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { useAuth } from '../../../hooks/useAuth';
import { useClassificacao } from '../../../hooks/useRankings';
import { adicionarMembroRankingPorDono, estenderPrazoJogosRanking, formatarDataBR, iniciarEtapaMensalRanking, mesCivilAtual } from '../../../services/rankings';
import {
  labelFormatoRanking,
  labelModeloRanking,
  normalizarEtapaMes,
  normalizarNiveisConfig,
  normalizarRegrasJogo,
  type Ranking,
  type RankingEtapaMes,
  type RankingNiveisConfig,
  type RankingRegrasJogo,
} from '../../../types/ranking';
import type { EsporteId } from '../../../constants/esportes';
import { resumoPromoCurto, textoCicloPagamento } from '../../../utils/checkoutComMeio';
import { compartilharRankingFora } from '../../../utils/compartilharRanking';

export default function RankingDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const [ranking, setRanking] = useState<Ranking | null>(null);
  const [nivelAtivo, setNivelAtivo] = useState<string | null>(null);
  const { rows, loading } = useClassificacao(id ?? null);
  const [buscaJogador, setBuscaJogador] = useState('');
  const [buscaParceiro, setBuscaParceiro] = useState('');
  const [cadastrando, setCadastrando] = useState(false);
  const [etapaBusy, setEtapaBusy] = useState(false);

  const reloadRanking = useCallback(async () => {
    if (!id) return;
    const snap = await getDoc(doc(db, 'rankings', id));
    if (!snap.exists()) return;
    const raw = snap.data();
    const niveis = raw.niveis
      ? normalizarNiveisConfig(raw.niveis as RankingNiveisConfig)
      : undefined;
    setRanking({
      id: snap.id,
      nome: String(raw.nome ?? ''),
      clubeId: String(raw.clubeId ?? ''),
      clubeNome: String(raw.clubeNome ?? ''),
      clubeLogoUrl: raw.clubeLogoUrl ? String(raw.clubeLogoUrl) : undefined,
      cidade: String(raw.cidade ?? ''),
      esporte: (raw.esporte as EsporteId) ?? 'tenis',
      donoUid: String(raw.donoUid ?? ''),
      membros: (raw.membros as string[]) ?? [],
      totalMembros: Number(raw.totalMembros ?? 0),
      composicao: raw.composicao as Ranking['composicao'],
      regrasJogo: raw.regrasJogo as RankingRegrasJogo | undefined,
      etapa: normalizarEtapaMes(raw.etapa as RankingEtapaMes | undefined),
      niveis,
      pagamento: raw.pagamento
        ? {
            ativo: Boolean((raw.pagamento as { ativo?: boolean }).ativo),
            valor: Number((raw.pagamento as { valor?: number }).valor ?? 0),
            ciclo:
              ((raw.pagamento as { ciclo?: string }).ciclo as 'unico' | 'mensal') ??
              'mensal',
            regras: String((raw.pagamento as { regras?: string }).regras ?? ''),
            exigeParaEntrar: Boolean(
              (raw.pagamento as { exigeParaEntrar?: boolean }).exigeParaEntrar
            ),
            permitePix: Boolean(
              (raw.pagamento as { permitePix?: boolean }).permitePix ?? true
            ),
            permiteCartao: Boolean(
              (raw.pagamento as { permiteCartao?: boolean }).permiteCartao ?? true
            ),
            descontoPixPercent: Number(
              (raw.pagamento as { descontoPixPercent?: number }).descontoPixPercent ?? 0
            ),
            descontoCartaoPercent: Number(
              (raw.pagamento as { descontoCartaoPercent?: number }).descontoCartaoPercent ??
                0
            ),
          }
        : undefined,
    });
    if (niveis?.ativo && niveis.niveis[0]) {
      setNivelAtivo((prev) => prev ?? niveis.niveis[0].id);
    }
  }, [id]);

  useEffect(() => {
    void reloadRanking();
  }, [reloadRanking]);

  const regras = normalizarRegrasJogo(ranking?.regrasJogo);
  const niveisCfg = ranking?.niveis;
  const niveisOn = Boolean(niveisCfg?.ativo && (niveisCfg?.niveis.length ?? 0) >= 2);
  const souMembro = !!(user && ranking?.membros.includes(user.uid));
  const souDono = !!(user && ranking && user.uid === ranking.donoUid);
  const isDupla = ranking?.composicao === 'dupla';
  const mesAtual = mesCivilAtual();
  const etapa = ranking?.etapa;
  const etapaDoMes = etapa?.mes === mesAtual ? etapa : undefined;
  const jogosLiberadosMes = Boolean(etapaDoMes?.jogosLiberados);

  function onLiberarJogosMes() {
    if (!ranking || !user || !souDono) return;
    const dias = regras.prazoPadraoDias ?? 28;
    Alert.alert(
      'Liberar jogos do mês',
      `Inicia a etapa de ${mesAtual} e avisa todos os participantes por push. Prazo padrão: ${dias} dias (você pode estender depois).`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Liberar',
          onPress: () => {
            void (async () => {
              setEtapaBusy(true);
              try {
                const e = await iniciarEtapaMensalRanking({
                  rankingId: ranking.id,
                  porUid: user.uid,
                  origem: 'manual',
                });
                await reloadRanking();
                Alert.alert(
                  'Jogos liberados',
                  `Prazo até ${formatarDataBR(e.prazoJogosAte)}. Os membros foram notificados.`
                );
              } catch (err: unknown) {
                Alert.alert(
                  'Ranking',
                  err instanceof Error ? err.message : 'Falha ao liberar.'
                );
              } finally {
                setEtapaBusy(false);
              }
            })();
          },
        },
      ]
    );
  }

  function onEstenderPrazo() {
    if (!ranking || !user || !souDono) return;
    Alert.alert('Estender prazo dos jogos', 'Por quantos dias a mais?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: '+3 dias',
        onPress: () => void estenderPorDias(3),
      },
      {
        text: '+7 dias',
        onPress: () => void estenderPorDias(7),
      },
      {
        text: '+14 dias',
        onPress: () => void estenderPorDias(14),
      },
    ]);
  }

  async function estenderPorDias(extra: number) {
    if (!ranking || !user) return;
    setEtapaBusy(true);
    try {
      const base =
        etapaDoMes?.prazoJogosAte &&
        new Date(etapaDoMes.prazoJogosAte + 'T12:00:00').getTime() > Date.now()
          ? new Date(etapaDoMes.prazoJogosAte + 'T12:00:00')
          : new Date();
      const d = new Date(base.getFullYear(), base.getMonth(), base.getDate());
      d.setDate(d.getDate() + extra);
      const nova = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const e = await estenderPrazoJogosRanking({
        rankingId: ranking.id,
        donoUid: user.uid,
        novaDataYYYYMMDD: nova,
      });
      await reloadRanking();
      Alert.alert('Prazo estendido', `Novo prazo: ${formatarDataBR(e.prazoJogosAte)}. Membros notificados.`);
    } catch (err: unknown) {
      Alert.alert('Ranking', err instanceof Error ? err.message : 'Falha ao estender.');
    } finally {
      setEtapaBusy(false);
    }
  }

  const rowsVisiveis = useMemo(() => {
    if (!niveisOn || !nivelAtivo) return rows;
    return rows.filter((r) => (r.nivelId || '') === nivelAtivo);
  }, [rows, niveisOn, nivelAtivo]);

  function onCadastrarJogador() {
    if (!ranking || !user || !souDono) return;
    if (!buscaJogador.trim()) {
      Alert.alert('Ranking', 'Informe e-mail ou ID do jogador.');
      return;
    }
    if (isDupla && !buscaParceiro.trim()) {
      Alert.alert('Ranking', 'Informe o parceiro da dupla.');
      return;
    }
    const nivelLabel =
      niveisOn && nivelAtivo
        ? niveisCfg?.niveis.find((n) => n.id === nivelAtivo)?.nome
        : undefined;
    Alert.alert(
      'Cadastrar no ranking',
      [
        'Adicionar este jogador sem solicitação?',
        nivelLabel ? `Nível: ${nivelLabel}` : '',
        ranking.pagamento?.ativo && ranking.pagamento.exigeParaEntrar
          ? 'Se houver taxa de entrada, a cobrança será criada para o jogador.'
          : '',
      ]
        .filter(Boolean)
        .join('\n'),
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cadastrar',
          onPress: () => {
            void (async () => {
              setCadastrando(true);
              try {
                const r = await adicionarMembroRankingPorDono({
                  rankingId: ranking.id,
                  donoUid: user.uid,
                  buscaJogador,
                  buscaParceiro: isDupla ? buscaParceiro : undefined,
                  nivelId: niveisOn && nivelAtivo ? nivelAtivo : undefined,
                });
                setBuscaJogador('');
                setBuscaParceiro('');
                await reloadRanking();
                Alert.alert(
                  'Ranking',
                  r.parceiroNome
                    ? `${r.nome} e ${r.parceiroNome} foram adicionados.`
                    : `${r.nome} foi adicionado ao ranking.`
                );
              } catch (e: unknown) {
                Alert.alert(
                  'Ranking',
                  e instanceof Error ? e.message : 'Falha ao cadastrar.'
                );
              } finally {
                setCadastrando(false);
              }
            })();
          },
        },
      ]
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={26} color={Colors.accent} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {ranking?.nome ?? 'Ranking'}
        </Text>
        <TouchableOpacity
          onPress={() => {
            if (!ranking) return;
            void compartilharRankingFora({
              rankingId: ranking.id,
              nome: ranking.nome,
              clubeNome: ranking.clubeNome,
            }).catch((e: unknown) =>
              Alert.alert(
                'Compartilhar',
                e instanceof Error ? e.message : 'Falha ao compartilhar.'
              )
            );
          }}
          disabled={!ranking}
          hitSlop={8}
        >
          <Ionicons name="share-outline" size={24} color={Colors.accent} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
      >
        {ranking ? (
          <View style={styles.clubeBox}>
            {ranking.clubeLogoUrl ? (
              <Image source={{ uri: ranking.clubeLogoUrl }} style={styles.clubeLogo} />
            ) : (
              <Ionicons name="trophy" size={28} color={Colors.accent} />
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.rankingNome}>{ranking.nome}</Text>
              <Text style={styles.clubeNome}>{ranking.clubeNome}</Text>
              <Text style={styles.clubeMeta}>
                {ranking.cidade} · {ranking.totalMembros} jogadores
              </Text>
              <Text style={styles.rulesMeta}>
                {labelModeloRanking(regras.modelo)} · {labelFormatoRanking(regras.formatoPartidaId)}{' '}
                · {regras.jogosPorMes} jogos/mês · limpa {regras.ptsJogoCompleto} pts · jogar +
                {regras.ptsParticipacao}
                {'\n'}Sem jogo no mês civil → pontos zerados.
                {jogosLiberadosMes && etapaDoMes?.prazoJogosAte
                  ? `\nJogos liberados até ${formatarDataBR(etapaDoMes.prazoJogosAte)}.`
                  : '\nJogos do mês ainda não liberados.'}
                {niveisOn
                  ? `\nNíveis: ${niveisCfg!.niveis.map((n) => n.nome).join(' · ')}${
                      niveisCfg!.autoAtivo ? ` · auto dia ${niveisCfg!.autoDiaMes}` : ''
                    }`
                  : ''}
              </Text>
              {ranking.pagamento?.ativo ? (
                <Text style={styles.payMeta}>
                  Taxa R$ {ranking.pagamento.valor.toFixed(2)} ·{' '}
                  {ranking.pagamento.ciclo === 'mensal' ? 'mensal' : 'única'}
                  {`\n${textoCicloPagamento(ranking.pagamento.ciclo)}`}
                  {resumoPromoCurto(ranking.pagamento)
                    ? `\n${resumoPromoCurto(ranking.pagamento)}`
                    : ''}
                  {ranking.pagamento.regras ? `\n${ranking.pagamento.regras}` : ''}
                </Text>
              ) : null}
            </View>
          </View>
        ) : null}

        {souMembro && id ? (
          <TouchableOpacity
            style={styles.cta}
            onPress={() => router.push(`/ranking/${id}/confrontos`)}
          >
            <Ionicons name="people-outline" size={22} color={Colors.textOnAccent} />
            <Text style={styles.ctaTxt}>Meus confrontos</Text>
            <Ionicons name="chevron-forward" size={20} color={Colors.textOnAccent} />
          </TouchableOpacity>
        ) : null}

        {souDono && id ? (
          <>
            <TouchableOpacity
              style={styles.cta}
              onPress={onLiberarJogosMes}
              disabled={etapaBusy}
            >
              <Ionicons name="play-circle-outline" size={22} color={Colors.textOnAccent} />
              <Text style={styles.ctaTxt}>
                {jogosLiberadosMes ? 'Reliberar jogos do mês' : 'Liberar jogos do mês'}
              </Text>
              <Ionicons name="chevron-forward" size={20} color={Colors.textOnAccent} />
            </TouchableOpacity>
            {jogosLiberadosMes ? (
              <TouchableOpacity
                style={styles.ctaGhost}
                onPress={onEstenderPrazo}
                disabled={etapaBusy}
              >
                <Ionicons name="time-outline" size={20} color={Colors.accent} />
                <Text style={styles.ctaGhostTxt}>
                  Estender prazo
                  {etapaDoMes?.prazoJogosAte
                    ? ` (até ${formatarDataBR(etapaDoMes.prazoJogosAte)})`
                    : ''}
                </Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              style={styles.ctaGhost}
              onPress={() =>
                router.push({ pathname: '/clube/ranking-regras', params: { rankingId: id } })
              }
            >
              <Ionicons name="settings-outline" size={20} color={Colors.accent} />
              <Text style={styles.ctaGhostTxt}>Editar regras do ranking</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.ctaGhost}
              onPress={() =>
                router.push({ pathname: '/clube/ranking-niveis', params: { rankingId: id } })
              }
            >
              <Ionicons name="layers-outline" size={20} color={Colors.accent} />
              <Text style={styles.ctaGhostTxt}>Níveis · sobe / desce</Text>
            </TouchableOpacity>

            <View style={styles.cadBox}>
              <Text style={styles.cadTitle}>Cadastrar jogador</Text>
              <Text style={styles.cadHint}>
                Adiciona sem solicitação — por e-mail ou ID (SM-…). O jogador recebe
                notificação.
                {niveisOn
                  ? ' Entra no nível selecionado nos chips abaixo (ou no mais baixo).'
                  : ''}
              </Text>
              <Input
                label="Jogador (e-mail ou ID SM-…)"
                value={buscaJogador}
                onChangeText={setBuscaJogador}
                placeholder="jogador@email.com ou SM-JOG001"
                autoCapitalize="none"
              />
              {isDupla ? (
                <Input
                  label="Parceiro da dupla"
                  value={buscaParceiro}
                  onChangeText={setBuscaParceiro}
                  placeholder="parceiro@email.com ou SM-…"
                  autoCapitalize="none"
                />
              ) : null}
              <Button
                label="Cadastrar no ranking"
                loading={cadastrando}
                onPress={onCadastrarJogador}
              />
            </View>
          </>
        ) : null}

        {niveisOn ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.chipsScroll}
            contentContainerStyle={styles.chipsRow}
          >
            {niveisCfg!.niveis.map((n) => {
              const on = nivelAtivo === n.id;
              return (
                <TouchableOpacity
                  key={n.id}
                  style={[styles.chip, on && styles.chipOn]}
                  onPress={() => setNivelAtivo(n.id)}
                >
                  <Text style={[styles.chipTxt, on && styles.chipTxtOn]}>{n.nome}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        ) : null}

        <View style={styles.tableHead}>
          <Text style={styles.thPos}>#</Text>
          <Text style={styles.thNome}>Jogador</Text>
          <Text style={styles.thStat}>V/D</Text>
          <Text style={styles.thPts}>PTS</Text>
        </View>

        {loading ? (
          <ActivityIndicator color={Colors.accent} style={{ marginTop: 24 }} />
        ) : rowsVisiveis.length === 0 ? (
          <Text style={styles.empty}>Nenhum jogador neste nível ainda.</Text>
        ) : (
          rowsVisiveis.map((r, i) => (
            <TouchableOpacity
              key={r.uid}
              style={styles.row}
              onPress={() => router.push(`/jogador/${r.uid}`)}
            >
              <Text style={styles.pos}>{i + 1}</Text>
              <View style={styles.nomeWrap}>
                <Avatar uri={r.fotoUrl} nome={r.nome} size="sm" />
                <Text style={styles.nome} numberOfLines={1}>
                  {r.nome}
                </Text>
              </View>
              <Text style={styles.stat}>
                {r.vitorias}/{r.derrotas}
              </Text>
              <Text style={styles.pts}>{r.pts}</Text>
            </TouchableOpacity>
          ))
        )}
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
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    color: Colors.textPrimary,
    fontSize: 18,
    fontWeight: 'bold',
  },
  body: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40 },
  clubeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1.5,
    borderColor: Colors.accent,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  clubeLogo: {
    width: 56,
    height: 56,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.white,
    backgroundColor: Colors.surfaceDark,
  },
  rankingNome: { color: Colors.accent, fontWeight: '800', fontSize: 18 },
  clubeNome: { color: Colors.textPrimary, fontWeight: 'bold', fontSize: 15, marginTop: 2 },
  clubeMeta: { color: Colors.textSecondary, fontSize: 12, marginTop: 2 },
  rulesMeta: { color: Colors.accent, fontSize: 12, marginTop: 6, lineHeight: 16 },
  payMeta: { color: Colors.accent, fontSize: 12, marginTop: 6, lineHeight: 16 },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.accent,
    borderRadius: Radius.pill,
    paddingVertical: 14,
    paddingHorizontal: 18,
    marginBottom: 10,
  },
  ctaTxt: { flex: 1, color: Colors.textOnAccent, fontWeight: '800', fontSize: 15 },
  ctaGhost: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1.5,
    borderColor: Colors.accent,
    borderRadius: Radius.pill,
    paddingVertical: 12,
    paddingHorizontal: 18,
    marginBottom: 10,
  },
  ctaGhostTxt: { color: Colors.accent, fontWeight: '700', fontSize: 14 },
  cadBox: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.accent,
    padding: 14,
    gap: 10,
    marginBottom: 14,
  },
  cadTitle: { color: Colors.textPrimary, fontWeight: '800', fontSize: 16 },
  cadHint: { color: Colors.textSecondary, fontSize: 13, lineHeight: 18 },
  chipsScroll: { marginBottom: 12, marginTop: 4 },
  chipsRow: { gap: 8, paddingRight: 8 },
  chip: {
    borderWidth: 1.5,
    borderColor: Colors.accent,
    borderRadius: Radius.pill,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  chipOn: { backgroundColor: Colors.accent },
  chipTxt: { color: Colors.accent, fontWeight: '800' },
  chipTxtOn: { color: Colors.textOnAccent },
  tableHead: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.2)',
  },
  thPos: { width: 24, color: Colors.textSecondary, fontSize: 12, fontWeight: 'bold' },
  thNome: {
    flex: 1,
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  thStat: {
    width: 48,
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  thPts: {
    width: 44,
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'right',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  pos: { width: 24, color: Colors.accent, fontWeight: 'bold', fontSize: 15 },
  nomeWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, marginLeft: 8 },
  nome: { flex: 1, color: Colors.textPrimary, fontWeight: '600', fontSize: 14 },
  stat: { width: 48, color: Colors.textSecondary, fontSize: 13, textAlign: 'center' },
  pts: {
    width: 44,
    color: Colors.textPrimary,
    fontWeight: 'bold',
    fontSize: 14,
    textAlign: 'right',
  },
  empty: { color: Colors.textSecondary, textAlign: 'center', marginTop: 24 },
});

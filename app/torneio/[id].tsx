import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { doc, getDoc } from 'firebase/firestore';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { db } from '../../utils/firebaseConfig';
import { Colors } from '../../constants/colors';
import { Radius } from '../../constants/radius';
import { Avatar } from '../../components/ui/Avatar';
import { Button } from '../../components/ui/Button';
import { ChaveamentoBracket } from '../../components/torneio/ChaveamentoBracket';
import { useAuth } from '../../hooks/useAuth';
import {
  atualizarAgendaTorneio,
  atualizarMidiaTorneio,
  inscreverTorneio,
  jaInscrito,
  ouvirInscritosTorneio,
  type InscricaoTorneio,
  type Torneio,
} from '../../services/torneios';
import {
  uploadBannerTorneio,
  uploadLogoTorneio,
} from '../../utils/uploadFoto';
import {
  gerarChaveamento,
  ouvirConfrontos,
  registrarResultadoConfronto,
  atualizarAgendaConfronto,
  type ConfrontoTorneio,
} from '../../services/chaveamentoTorneio';
import { pagarComEscolhaDeMeio, resumoPromoCurto } from '../../utils/checkoutComMeio';
import { abrirOuCriarConversaClube, enviarMensagem } from '../../services/mensagens';
import type { EsporteId } from '../../constants/esportes';
import { composicaoPadraoPorEsporte, type ComposicaoId } from '../../constants/composicao';
import { buscarUsuarioPorEmailOuId } from '../../services/duplas';
import { Input } from '../../components/ui/Input';

export default function TorneioDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user, perfil } = useAuth();
  const [torneio, setTorneio] = useState<Torneio | null>(null);
  const [inscrito, setInscrito] = useState(false);
  const [inscritos, setInscritos] = useState<InscricaoTorneio[]>([]);
  const [loading, setLoading] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [gerando, setGerando] = useState(false);
  const [confrontos, setConfrontos] = useState<ConfrontoTorneio[]>([]);
  const [edit, setEdit] = useState<ConfrontoTorneio | null>(null);
  const [set1a, setSet1a] = useState('6');
  const [set1b, setSet1b] = useState('4');
  const [set2a, setSet2a] = useState('6');
  const [set2b, setSet2b] = useState('3');
  const [vencedor, setVencedor] = useState<'j1' | 'j2'>('j1');
  const [salvandoPlacar, setSalvandoPlacar] = useState(false);
  const [editHora, setEditHora] = useState('');
  const [editQuadra, setEditQuadra] = useState('');
  const [salvandoAgenda, setSalvandoAgenda] = useState(false);
  const [evHora, setEvHora] = useState('');
  const [evQuadra, setEvQuadra] = useState('');
  const [salvandoEv, setSalvandoEv] = useState(false);
  const [uploadingMidia, setUploadingMidia] = useState(false);
  const [parceiroBusca, setParceiroBusca] = useState('');

  async function reloadTorneio() {
    if (!id) return;
    const snap = await getDoc(doc(db, 'torneios', id));
    if (!snap.exists()) return;
    const raw = snap.data();
    const horarioPadrao = raw.horarioPadrao ? String(raw.horarioPadrao) : undefined;
    const quadraNome = raw.quadraNome ? String(raw.quadraNome) : undefined;
    setEvHora(horarioPadrao ?? '');
    setEvQuadra(quadraNome ?? '');
    setTorneio({
      id: snap.id,
      clubeId: String(raw.clubeId ?? ''),
      clubeNome: String(raw.clubeNome ?? ''),
      cidade: String(raw.cidade ?? ''),
      nome: String(raw.nome ?? ''),
      esporte: (raw.esporte as EsporteId) ?? 'tenis',
      composicao:
        (raw.composicao as ComposicaoId) ??
        composicaoPadraoPorEsporte((raw.esporte as EsporteId) ?? 'tenis'),
      dataInicio: raw.dataInicio ? String(raw.dataInicio) : undefined,
      dataFim: raw.dataFim ? String(raw.dataFim) : undefined,
      descricao: raw.descricao ? String(raw.descricao) : undefined,
      local: raw.local ? String(raw.local) : undefined,
      horarioPadrao,
      quadraNome,
      donoUid: String(raw.donoUid ?? ''),
      status: (raw.status as Torneio['status']) ?? 'aberto',
      totalInscritos: Number(raw.totalInscritos ?? 0),
      estruturaMata: raw.estruturaMata != null ? (Number(raw.estruturaMata) as Torneio['estruturaMata']) : undefined,
      definicaoChave: raw.definicaoChave as Torneio['definicaoChave'],
      campeaoUid: raw.campeaoUid ? String(raw.campeaoUid) : undefined,
      campeaoNome: raw.campeaoNome ? String(raw.campeaoNome) : undefined,
      chaveLiberada: Boolean(raw.chaveLiberada),
      clubeLogoUrl: raw.clubeLogoUrl ? String(raw.clubeLogoUrl) : undefined,
      logoUrl: raw.logoUrl ? String(raw.logoUrl) : undefined,
      bannerUrl: raw.bannerUrl ? String(raw.bannerUrl) : undefined,
      pagamento: raw.pagamento
        ? {
            ativo: Boolean((raw.pagamento as { ativo?: boolean }).ativo),
            valor: Number((raw.pagamento as { valor?: number }).valor ?? 0),
            regras: String((raw.pagamento as { regras?: string }).regras ?? ''),
            prazoPagamento: (raw.pagamento as { prazoPagamento?: string }).prazoPagamento
              ? String((raw.pagamento as { prazoPagamento?: string }).prazoPagamento)
              : undefined,
            permitePix: Boolean((raw.pagamento as { permitePix?: boolean }).permitePix ?? true),
            permiteCartao: Boolean(
              (raw.pagamento as { permiteCartao?: boolean }).permiteCartao ?? true
            ),
            descontoPixPercent: Number(
              (raw.pagamento as { descontoPixPercent?: number }).descontoPixPercent ?? 0
            ),
            descontoCartaoPercent: Number(
              (raw.pagamento as { descontoCartaoPercent?: number }).descontoCartaoPercent ?? 0
            ),
          }
        : undefined,
    });
  }

  useEffect(() => {
    if (!id) return;
    void (async () => {
      setLoading(true);
      try {
        await reloadTorneio();
        if (user) setInscrito(await jaInscrito(id, user.uid));
      } finally {
        setLoading(false);
      }
    })();
  }, [id, user]);

  useEffect(() => {
    if (!id) return;
    return ouvirInscritosTorneio(id, setInscritos);
  }, [id]);

  useEffect(() => {
    if (!id) return;
    return ouvirConfrontos(id, setConfrontos);
  }, [id]);

  const souDono = Boolean(user && torneio && user.uid === torneio.donoUid);
  const chaveVisivel =
    Boolean(torneio?.chaveLiberada) ||
    (confrontos.length > 0 && (souDono || torneio?.status !== 'aberto'));

  const confrontosVisiveis = useMemo(
    () => (chaveVisivel ? confrontos : []),
    [chaveVisivel, confrontos]
  );

  async function onInscrever() {
    if (!user || !torneio || !perfil) return;
    if (torneio.status !== 'aberto') {
      Alert.alert('Torneio', 'Inscrições fechadas.');
      return;
    }
    setEnviando(true);
    try {
      let parceiroUid: string | undefined;
      let parceiroNome: string | undefined;
      if (torneio.composicao === 'dupla') {
        const p = await buscarUsuarioPorEmailOuId(parceiroBusca);
        if (!p) {
          Alert.alert('Dupla', 'Parceiro não encontrado. Use e-mail ou ID (SM-…).');
          return;
        }
        parceiroUid = p.uid;
        parceiroNome = p.nome;
      }

      const result = await inscreverTorneio({
        torneioId: torneio.id,
        uid: user.uid,
        nome: perfil.nome,
        fotoUrl: perfil.fotoUrl,
        telefone: perfil.telefone,
        setmatchId: perfil.setmatchId,
        parceiroUid,
        parceiroNome,
        parceiroBusca,
      });
      setInscrito(true);
      await reloadTorneio();

      try {
        const conversaId = await abrirOuCriarConversaClube({
          uid: user.uid,
          nome: perfil.nome,
          clubeId: torneio.clubeId,
          clubeNome: torneio.clubeNome,
          donoUid: torneio.donoUid,
        });
        await enviarMensagem({
          conversaId,
          deUid: user.uid,
          deNome: perfil.nome,
          texto: `Me inscrevi no torneio "${torneio.nome}"${
            parceiroNome ? ` com ${parceiroNome}` : ''
          }. ID: ${perfil.setmatchId}. WhatsApp: ${perfil.telefone || '—'}.`,
        });
      } catch {
        // inscrição já gravada
      }

      if (result.status === 'aguardando_parceiro') {
        Alert.alert(
          'Convite enviado',
          'Seu parceiro precisa aceitar o convite. Depois cada um paga a própria inscrição (se houver taxa).'
        );
      } else if (result.pagamentoId && torneio.pagamento) {
        Alert.alert(
          'Quase lá',
          [
            `Pague R$ ${torneio.pagamento.valor.toFixed(2)} para confirmar a inscrição.`,
            resumoPromoCurto(torneio.pagamento) || '',
          ]
            .filter(Boolean)
            .join('\n'),
          [
            {
              text: 'Pagar agora',
              onPress: () =>
                void pagarComEscolhaDeMeio({
                  pagamentoId: result.pagamentoId!,
                  titulo: `Inscrição · ${torneio.nome}`,
                  ciclo: 'unico',
                  regras: {
                    valor: torneio.pagamento!.valor,
                    permitePix: torneio.pagamento!.permitePix,
                    permiteCartao: torneio.pagamento!.permiteCartao,
                    descontoPixPercent: torneio.pagamento!.descontoPixPercent,
                    descontoCartaoPercent: torneio.pagamento!.descontoCartaoPercent,
                    ciclo: 'unico',
                  },
                }),
            },
            { text: 'OK' },
          ]
        );
      } else if (result.status === 'confirmado') {
        Alert.alert('Inscrição feita', 'Você entrou no torneio.');
      } else {
        Alert.alert(
          'Inscrição iniciada',
          'Aguarde o parceiro e/ou conclua o pagamento em Pagamentos.'
        );
      }
    } catch (e: unknown) {
      Alert.alert('Torneio', e instanceof Error ? e.message : 'Falha na inscrição.');
    } finally {
      setEnviando(false);
    }
  }

  async function onGerarChave() {
    if (!torneio || !user) return;
    Alert.alert(
      'Liberar chaveamento',
      'Sorteia os confrontos, fecha as inscrições e publica a chave para todos os inscritos. Continuar?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Liberar agora',
          onPress: () =>
            void (async () => {
              setGerando(true);
              try {
                const n = await gerarChaveamento({
                  torneioId: torneio.id,
                  donoUid: user.uid,
                  estruturaMata: torneio.estruturaMata,
                  sortear: torneio.definicaoChave !== 'manual',
                });
                await reloadTorneio();
                Alert.alert(
                  'Chave liberada',
                  `${n} jogadores na chave. Todos os inscritos já podem ver o chaveamento.`
                );
              } catch (e: unknown) {
                Alert.alert('Chave', e instanceof Error ? e.message : 'Falha ao gerar.');
              } finally {
                setGerando(false);
              }
            })(),
        },
      ]
    );
  }

  function abrirPlacar(c: ConfrontoTorneio) {
    if (c.status === 'bye') return;
    const podePlacar =
      c.status === 'pronto' &&
      (souDono || user?.uid === c.j1Uid || user?.uid === c.j2Uid);
    if (!souDono && !podePlacar) {
      Alert.alert('Confronto', 'Só os jogadores ou o organizador registram o placar.');
      return;
    }
    if (!souDono && c.status !== 'pronto') return;
    setEdit(c);
    setEditHora(c.dataHoraInicio ?? '');
    setEditQuadra(c.quadraNome ?? '');
    setVencedor('j1');
    setSet1a('6');
    setSet1b('4');
    setSet2a('6');
    setSet2b('3');
  }

  async function salvarAgendaConfronto() {
    if (!edit || !torneio || !souDono) return;
    setSalvandoAgenda(true);
    try {
      await atualizarAgendaConfronto(torneio.id, edit.id, {
        dataHoraInicio: editHora,
        quadraNome: editQuadra,
      });
      Alert.alert('Agenda', 'Horário do confronto atualizado.');
      if (edit.status !== 'pronto') setEdit(null);
    } catch (e: unknown) {
      Alert.alert('Agenda', e instanceof Error ? e.message : 'Falha ao salvar.');
    } finally {
      setSalvandoAgenda(false);
    }
  }

  async function salvarAgendaEvento() {
    if (!torneio || !souDono) return;
    setSalvandoEv(true);
    try {
      await atualizarAgendaTorneio(torneio.id, {
        horarioPadrao: evHora,
        quadraNome: evQuadra,
      });
      await reloadTorneio();
      Alert.alert('Torneio', 'Horário / quadra do evento atualizados.');
    } catch (e: unknown) {
      Alert.alert('Torneio', e instanceof Error ? e.message : 'Falha ao salvar.');
    } finally {
      setSalvandoEv(false);
    }
  }

  async function uploadMidia(kind: 'logo' | 'banner') {
    if (!torneio || !souDono) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Mídia', 'Permita acesso às fotos.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: kind === 'logo' ? [1, 1] : [16, 9],
      quality: 0.85,
    });
    if (result.canceled || !result.assets[0]?.uri) return;
    setUploadingMidia(true);
    try {
      if (kind === 'logo') {
        const url = await uploadLogoTorneio(torneio.id, result.assets[0].uri);
        await atualizarMidiaTorneio(torneio.id, { logoUrl: url });
      } else {
        const url = await uploadBannerTorneio(torneio.id, result.assets[0].uri);
        await atualizarMidiaTorneio(torneio.id, { bannerUrl: url });
      }
      await reloadTorneio();
      Alert.alert('Torneio', kind === 'logo' ? 'Logo atualizado.' : 'Banner atualizado.');
    } catch (e: unknown) {
      Alert.alert('Mídia', e instanceof Error ? e.message : 'Falha no upload.');
    } finally {
      setUploadingMidia(false);
    }
  }

  async function salvarPlacar() {
    if (!edit || !user || !torneio) return;
    setSalvandoPlacar(true);
    try {
      const sets = [
        { j1: Number(set1a) || 0, j2: Number(set1b) || 0 },
        { j1: Number(set2a) || 0, j2: Number(set2b) || 0 },
      ];
      await registrarResultadoConfronto({
        torneioId: torneio.id,
        confrontoId: edit.id,
        sets,
        vencedorUid: vencedor === 'j1' ? edit.j1Uid : edit.j2Uid,
        esporte: torneio.esporte,
        registradoPor: user.uid,
      });
      setEdit(null);
      await reloadTorneio();
      Alert.alert('Resultado', 'Placar salvo e vencedor avançou na chave.');
    } catch (e: unknown) {
      Alert.alert('Placar', e instanceof Error ? e.message : 'Falha ao salvar.');
    } finally {
      setSalvandoPlacar(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator color={Colors.accent} style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  if (!torneio) {
    return (
      <SafeAreaView style={styles.safe}>
        <Text style={styles.empty}>Torneio não encontrado.</Text>
      </SafeAreaView>
    );
  }

  const pag = torneio.pagamento;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={26} color={Colors.accent} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {torneio.nome}
        </Text>
        <View style={{ width: 26 }} />
      </View>
      <ScrollView contentContainerStyle={styles.body}>
        {torneio.bannerUrl ? (
          <Image source={{ uri: torneio.bannerUrl }} style={styles.banner} />
        ) : null}
        <View style={styles.tituloRow}>
          {torneio.logoUrl || torneio.clubeLogoUrl ? (
            <Image
              source={{ uri: torneio.logoUrl || torneio.clubeLogoUrl }}
              style={styles.torneioLogo}
            />
          ) : (
            <View style={styles.torneioLogoFallback}>
              <Ionicons name="trophy" size={22} color={Colors.accent} />
            </View>
          )}
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.torneioNome}>{torneio.nome}</Text>
            <Text style={styles.clube}>{torneio.clubeNome}</Text>
          </View>
        </View>
        <Text style={styles.meta}>
          {torneio.cidade}
          {torneio.local ? ` · ${torneio.local}` : ''}
        </Text>
        <Text style={styles.meta}>
          {torneio.dataInicio || '—'} → {torneio.dataFim || '—'} · {torneio.status} ·{' '}
          {torneio.totalInscritos} inscritos
        </Text>
        {(torneio.horarioPadrao || torneio.quadraNome) && !souDono ? (
          <Text style={styles.meta}>
            {[torneio.horarioPadrao, torneio.quadraNome].filter(Boolean).join(' · ')}
          </Text>
        ) : null}
        {torneio.campeaoNome ? (
          <Text style={styles.campeao}>🏆 Campeão: {torneio.campeaoNome}</Text>
        ) : null}
        {torneio.descricao ? <Text style={styles.desc}>{torneio.descricao}</Text> : null}

        {souDono ? (
          <View style={styles.payBox}>
            <Text style={styles.payTitle}>Logo e banner de divulgação</Text>
            <Text style={styles.desc}>
              Logo pode ser do patrocinador. Banner aparece no topo para os jogadores.
            </Text>
            <View style={styles.midiaBtns}>
              <Button
                label="Trocar logo"
                variant="outline"
                loading={uploadingMidia}
                onPress={() => void uploadMidia('logo')}
              />
              <Button
                label="Trocar banner"
                variant="outline"
                loading={uploadingMidia}
                onPress={() => void uploadMidia('banner')}
              />
            </View>
          </View>
        ) : null}

        {souDono ? (
          <View style={styles.payBox}>
            <Text style={styles.payTitle}>Horário e quadra (organizador)</Text>
            <Text style={styles.desc}>
              Jogadores não reservam jogo de torneio na agenda — só visualizam.
            </Text>
            <TextInput
              style={styles.scoreInputWide}
              placeholder="Horário ref. (ex: 09:00)"
              placeholderTextColor={Colors.textSecondary}
              value={evHora}
              onChangeText={setEvHora}
            />
            <TextInput
              style={styles.scoreInputWide}
              placeholder="Quadra opcional"
              placeholderTextColor={Colors.textSecondary}
              value={evQuadra}
              onChangeText={setEvQuadra}
            />
            <Button
              label="Salvar horário do evento"
              variant="outline"
              loading={salvandoEv}
              onPress={() => void salvarAgendaEvento()}
            />
          </View>
        ) : null}

        {pag?.ativo ? (
          <View style={styles.payBox}>
            <Text style={styles.payTitle}>
              Inscrição R$ {pag.valor.toFixed(2)} · PIX ou cartão
              {torneio.composicao === 'dupla' ? ' (por atleta)' : ''}
            </Text>
            {resumoPromoCurto(pag) ? (
              <Text style={styles.desc}>{resumoPromoCurto(pag)}</Text>
            ) : null}
          </View>
        ) : null}

        {!inscrito && torneio.composicao === 'dupla' ? (
          <View style={{ marginBottom: 12 }}>
            <Input
              label="Dupla (e-mail ou ID SM-…)"
              value={parceiroBusca}
              onChangeText={setParceiroBusca}
              placeholder="parceiro@email.com ou SM-JOG001"
              autoCapitalize="none"
            />
          </View>
        ) : null}

        <View style={styles.badge}>
          <Text style={styles.badgeTxt}>
            {inscrito
              ? 'Inscrição iniciada'
              : torneio.composicao === 'dupla'
                ? 'Inscrição em duplas'
                : 'Inscrições'}
          </Text>
        </View>
        <Button
          label={
            inscrito
              ? pag?.ativo
                ? 'Ver pagamentos'
                : 'Já inscrito'
              : 'Inscrever-me'
          }
          onPress={() => {
            if (inscrito && pag?.ativo) router.push('/pagamentos');
            else if (!inscrito) void onInscrever();
          }}
          loading={enviando}
          disabled={inscrito ? !pag?.ativo : torneio.status !== 'aberto'}
        />

        <View style={styles.inscritosBox}>
          <Text style={styles.chaveTitle}>
            Inscritos ({inscritos.filter((i) => !i.status || i.status === 'confirmado').length})
          </Text>
          {inscritos.length === 0 ? (
            <Text style={styles.chaveHint}>Ninguém inscrito ainda.</Text>
          ) : (
            inscritos.map((i) => (
              <View key={i.uid} style={styles.inscritoRow}>
                <Avatar uri={i.fotoUrl} nome={i.nome} size="sm" />
                <Text style={styles.inscritoNome} numberOfLines={2}>
                  {i.parceiroNome ? `${i.nome} / ${i.parceiroNome}` : i.nome}
                  {user?.uid === i.uid ? ' (você)' : ''}
                  {i.status && i.status !== 'confirmado' ? ` · ${i.status}` : ''}
                </Text>
              </View>
            ))
          )}
        </View>

        {souDono && confrontos.length === 0 ? (
          <Button
            label="Liberar chaveamento (sortear)"
            variant="outline"
            loading={gerando}
            onPress={() => void onGerarChave()}
            disabled={inscritos.length < 2}
          />
        ) : null}
        {souDono && confrontos.length === 0 && inscritos.length < 2 ? (
          <Text style={styles.chaveHint}>
            Precisa de pelo menos 2 inscritos para liberar o chaveamento.
          </Text>
        ) : null}

        {confrontosVisiveis.length > 0 ? (
          <ChaveamentoBracket
            confrontos={confrontosVisiveis}
            onPressMatch={abrirPlacar}
            highlightUid={user?.uid}
            pressEnabled={(c) => {
              if (c.status === 'bye') return false;
              if (souDono) return true;
              return c.status === 'pronto';
            }}
          />
        ) : (
          <Text style={styles.chaveHint}>
            {souDono
              ? 'Quando houver 2+ inscritos, toque em Liberar chaveamento para sortear e publicar a chave.'
              : 'O chaveamento aparece para todos quando o organizador liberar o sorteio.'}
          </Text>
        )}
      </ScrollView>

      <Modal visible={!!edit} transparent animationType="slide">
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {souDono && edit?.status !== 'pronto'
                ? 'Horário do confronto'
                : 'Registrar placar'}
            </Text>
            {edit ? (
              <>
                <Text style={styles.meta}>
                  {edit.j1Nome} vs {edit.j2Nome}
                </Text>
                {souDono ? (
                  <>
                    <Text style={styles.modalLabel}>Data/hora</Text>
                    <TextInput
                      style={styles.scoreInputWide}
                      placeholder="Ex: 12/09 10:00"
                      placeholderTextColor={Colors.textSecondary}
                      value={editHora}
                      onChangeText={setEditHora}
                    />
                    <Text style={styles.modalLabel}>Quadra (opcional)</Text>
                    <TextInput
                      style={styles.scoreInputWide}
                      placeholder="Ex: Quadra 2"
                      placeholderTextColor={Colors.textSecondary}
                      value={editQuadra}
                      onChangeText={setEditQuadra}
                    />
                    <Button
                      label="Salvar horário"
                      variant="outline"
                      loading={salvandoAgenda}
                      onPress={() => void salvarAgendaConfronto()}
                    />
                  </>
                ) : edit.dataHoraInicio || edit.quadraNome ? (
                  <Text style={styles.meta}>
                    {[edit.dataHoraInicio, edit.quadraNome].filter(Boolean).join(' · ')}
                  </Text>
                ) : null}
                {edit.status === 'pronto' &&
                (souDono ||
                  user?.uid === edit.j1Uid ||
                  user?.uid === edit.j2Uid) ? (
                  <>
                    <Text style={styles.modalLabel}>Set 1</Text>
                    <View style={styles.scoreRow}>
                      <TextInput
                        style={styles.scoreInput}
                        keyboardType="number-pad"
                        value={set1a}
                        onChangeText={setSet1a}
                      />
                      <Text style={styles.meta}>–</Text>
                      <TextInput
                        style={styles.scoreInput}
                        keyboardType="number-pad"
                        value={set1b}
                        onChangeText={setSet1b}
                      />
                    </View>
                    <Text style={styles.modalLabel}>Set 2</Text>
                    <View style={styles.scoreRow}>
                      <TextInput
                        style={styles.scoreInput}
                        keyboardType="number-pad"
                        value={set2a}
                        onChangeText={setSet2a}
                      />
                      <Text style={styles.meta}>–</Text>
                      <TextInput
                        style={styles.scoreInput}
                        keyboardType="number-pad"
                        value={set2b}
                        onChangeText={setSet2b}
                      />
                    </View>
                    <Text style={styles.modalLabel}>Vencedor</Text>
                    <View style={styles.winnerRow}>
                      <TouchableOpacity
                        style={[styles.winnerChip, vencedor === 'j1' && styles.winnerOn]}
                        onPress={() => setVencedor('j1')}
                      >
                        <Text style={styles.winnerTxt}>{edit.j1Nome.split(' ')[0]}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.winnerChip, vencedor === 'j2' && styles.winnerOn]}
                        onPress={() => setVencedor('j2')}
                      >
                        <Text style={styles.winnerTxt}>{edit.j2Nome.split(' ')[0]}</Text>
                      </TouchableOpacity>
                    </View>
                    <Button
                      label="Salvar e avançar"
                      loading={salvandoPlacar}
                      onPress={() => void salvarPlacar()}
                    />
                  </>
                ) : null}
                <TouchableOpacity onPress={() => setEdit(null)}>
                  <Text style={styles.cancel}>Cancelar</Text>
                </TouchableOpacity>
              </>
            ) : null}
          </View>
        </View>
      </Modal>
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
  body: { padding: 20, gap: 12, paddingBottom: 40 },
  banner: {
    width: '100%',
    height: 140,
    borderRadius: 16,
    backgroundColor: Colors.surfaceDark,
  },
  tituloRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  torneioLogo: {
    width: 56,
    height: 56,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.white,
  },
  torneioLogoFallback: {
    width: 56,
    height: 56,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  torneioNome: {
    color: Colors.textPrimary,
    fontSize: 20,
    fontWeight: '800',
  },
  midiaBtns: { gap: 8, marginTop: 4 },
  clube: { color: Colors.accent, fontSize: 16, fontWeight: 'bold' },
  meta: { color: Colors.textSecondary },
  campeao: { color: Colors.accent, fontWeight: '900', fontSize: 16 },
  desc: { color: Colors.textPrimary, lineHeight: 22, marginTop: 4 },
  payBox: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 14,
    gap: 6,
    marginTop: 8,
  },
  payTitle: { color: Colors.accent, fontWeight: 'bold' },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.surface,
    borderRadius: Radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginVertical: 8,
  },
  badgeTxt: { color: Colors.textPrimary, fontWeight: '600' },
  empty: { color: Colors.textSecondary, textAlign: 'center', marginTop: 40 },
  inscritosBox: {
    marginTop: 8,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 14,
    gap: 10,
  },
  inscritoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  inscritoNome: { color: Colors.textPrimary, fontWeight: '600', flex: 1 },
  chaveTitle: { color: Colors.textPrimary, fontWeight: '900', fontSize: 18 },
  chaveHint: { color: Colors.textSecondary, fontSize: 13, lineHeight: 18 },
  modalBg: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    gap: 10,
  },
  modalTitle: { color: Colors.textPrimary, fontWeight: '900', fontSize: 18 },
  modalLabel: { color: Colors.textSecondary, fontWeight: '700', marginTop: 6 },
  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  scoreInput: {
    width: 56,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    color: Colors.textPrimary,
    textAlign: 'center',
    paddingVertical: 10,
    fontWeight: '800',
    fontSize: 18,
  },
  scoreInputWide: {
    width: '100%',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    color: Colors.textPrimary,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontWeight: '600',
    fontSize: 15,
  },
  winnerRow: { flexDirection: 'row', gap: 10 },
  winnerChip: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 60,
    backgroundColor: Colors.surface,
    alignItems: 'center',
  },
  winnerOn: { backgroundColor: Colors.accent },
  winnerTxt: { color: Colors.textPrimary, fontWeight: '800' },
  cancel: {
    textAlign: 'center',
    color: Colors.textSecondary,
    fontWeight: '700',
    marginTop: 8,
    marginBottom: 12,
  },
});

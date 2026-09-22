import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { doc, getDoc } from 'firebase/firestore';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { db } from '../../utils/firebaseConfig';
import { Colors } from '../../constants/colors';
import { Radius } from '../../constants/radius';
import { Avatar } from '../../components/ui/Avatar';
import { Button } from '../../components/ui/Button';
import { ChaveamentoBracket } from '../../components/torneio/ChaveamentoBracket';
import { GruposTorneioPainel } from '../../components/torneio/GruposTorneioPainel';
import { useAuth } from '../../hooks/useAuth';
import {
  atualizarAgendaTorneio,
  atualizarCategoriasTorneio,
  atualizarMidiaTorneio,
  encerrarInscricoesTorneio,
  excluirTorneio,
  cancelarInscricaoTorneio,
  inscreverTorneio,
  inscreverTorneioPorOrganizador,
  jaInscrito,
  novaCategoriaId,
  ouvirInscritosTorneio,
  sincronizarTotalInscritos,
  type CategoriaTorneio,
  type CampeaoCategoria,
  type InscricaoTorneio,
  type Torneio,
} from '../../services/torneios';
import { compartilharTorneioFora } from '../../utils/compartilharTorneio';
import {
  qtdByesNecessarios,
  tamanhoChaveEfetivo,
} from '../../utils/chaveamento';
import {
  uploadBannerTorneio,
  uploadLogoTorneio,
} from '../../utils/uploadFoto';
import {
  gerarChaveamento,
  ouvirConfrontos,
  registrarResultadoConfronto,
  registrarWO,
  trocarSlotsChave,
  atualizarAgendaConfronto,
  aplicarHorarioPadraoConfrontos,
  detectarConflitosAgendaConfronto,
  remarcarConfrontosPendentes,
  type ConfrontoTorneio,
} from '../../services/chaveamentoTorneio';
import {
  gerarFaseGrupos,
  tentarPromoverClassificados,
} from '../../services/gruposTorneio';
import { maskDateBR, maskTimeHHMM, isDateBRCompleta, formatMoneyBR } from '../../utils/mascaras';
import {
  INTERVALOS_JOGO_OPCOES,
  parseListaQuadras,
} from '../../utils/agendaTorneio';
import { pagarComEscolhaDeMeio, resumoPromoCurto } from '../../utils/checkoutComMeio';
import { abrirOuCriarConversaClube, enviarMensagem } from '../../services/mensagens';
import type { EsporteId } from '../../constants/esportes';
import {
  composicaoPadraoPorEsporte,
  labelComposicao,
  type ComposicaoId,
} from '../../constants/composicao';
import { buscarUsuarioPorEmailOuId } from '../../services/duplas';
import { Input } from '../../components/ui/Input';
import {
  draftParaSets,
  quantosSetsVisiveis,
  rotuloSet,
  statusPlacarProgressivo,
  validarPlacarTorneio,
} from '../../utils/placarTorneio';
import { labelFormatoPartidaTorneio } from '../../constants/chaveamentosTorneio';

function emptySetsDraft(): { j1: string; j2: string }[] {
  return Array.from({ length: 5 }, () => ({ j1: '', j2: '' }));
}

function ensureDraftSlots(
  prev: { j1: string; j2: string }[],
  idx: number
): { j1: string; j2: string }[] {
  const next = [...prev];
  while (next.length <= idx) next.push({ j1: '', j2: '' });
  return next;
}

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
  const [setsDraft, setSetsDraft] = useState(emptySetsDraft);
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
  const [categoriaSel, setCategoriaSel] = useState<string>('');
  const [catDraft, setCatDraft] = useState<CategoriaTorneio[]>([]);
  const [novaCatNome, setNovaCatNome] = useState('');
  const [novaCatComp, setNovaCatComp] = useState<ComposicaoId>('simples');
  const [salvandoCats, setSalvandoCats] = useState(false);
  const [compartilhando, setCompartilhando] = useState(false);
  const [modalCabecas, setModalCabecas] = useState(false);
  const [cabecasSel, setCabecasSel] = useState<string[]>([]);
  const [byeSel, setByeSel] = useState<string[]>([]);
  /** sorteio | ordem | montar */
  const [modoChave, setModoChave] = useState<'sorteio' | 'ordem' | 'montar'>('sorteio');
  const [slotsManuais, setSlotsManuais] = useState<(string | null)[]>([]);
  const [pickerSlot, setPickerSlot] = useState<number | null>(null);
  const [refazerChave, setRefazerChave] = useState(false);
  const [modoEditarChave, setModoEditarChave] = useState(false);
  const [swapOrigem, setSwapOrigem] = useState<{
    confrontoId: string;
    slot: 'j1' | 'j2';
    nome: string;
  } | null>(null);
  const [excluindo, setExcluindo] = useState(false);
  const [orgBuscaJogador, setOrgBuscaJogador] = useState('');
  const [orgBuscaParceiro, setOrgBuscaParceiro] = useState('');
  const [cadastrandoOrg, setCadastrandoOrg] = useState(false);
  const [agendaRapida, setAgendaRapida] = useState(false);
  const [agendaDrafts, setAgendaDrafts] = useState<
    Record<string, { hora: string; quadra: string }>
  >({});
  const [salvandoAgendaId, setSalvandoAgendaId] = useState<string | null>(null);
  const [aplicandoPadrao, setAplicandoPadrao] = useState(false);
  const [novaDataRemarc, setNovaDataRemarc] = useState('');
  const [novaHoraRemarc, setNovaHoraRemarc] = useState('');
  const [remarcando, setRemarcando] = useState(false);
  const [intervaloJogosMin, setIntervaloJogosMin] = useState(60);
  const [quadrasTexto, setQuadrasTexto] = useState('');
  const [atribuirQuadras, setAtribuirQuadras] = useState(false);
  const insets = useSafeAreaInsets();

  async function reloadTorneio() {
    if (!id) return;
    const snap = await getDoc(doc(db, 'torneios', id));
    if (!snap.exists()) return;
    const raw = snap.data();
    const horarioPadrao = raw.horarioPadrao ? String(raw.horarioPadrao) : undefined;
    const quadraNome = raw.quadraNome ? String(raw.quadraNome) : undefined;
    setEvHora(horarioPadrao ?? '');
    setEvQuadra(quadraNome ?? '');
    setIntervaloJogosMin(Number(raw.intervaloJogosMin) || 60);
    setAtribuirQuadras(Boolean(raw.atribuirQuadrasAoSortear));
    setQuadrasTexto(
      Array.isArray(raw.quadrasDisponiveis)
        ? (raw.quadrasDisponiveis as unknown[])
            .map((q) => String(q ?? '').trim())
            .filter(Boolean)
            .join('\n')
        : ''
    );
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
      cep: raw.cep ? String(raw.cep) : undefined,
      endereco: raw.endereco ? String(raw.endereco) : undefined,
      bairro: raw.bairro ? String(raw.bairro) : undefined,
      estado: raw.estado ? String(raw.estado) : undefined,
      horarioPadrao,
      quadraNome,
      intervaloJogosMin: Number(raw.intervaloJogosMin) || 60,
      quadrasDisponiveis: Array.isArray(raw.quadrasDisponiveis)
        ? (raw.quadrasDisponiveis as unknown[])
            .map((q) => String(q ?? '').trim())
            .filter(Boolean)
        : undefined,
      atribuirQuadrasAoSortear: Boolean(raw.atribuirQuadrasAoSortear),
      donoUid: String(raw.donoUid ?? ''),
      status: (raw.status as Torneio['status']) ?? 'aberto',
      totalInscritos: Number(raw.totalInscritos ?? 0),
      estruturaMata: raw.estruturaMata != null ? (Number(raw.estruturaMata) as Torneio['estruturaMata']) : undefined,
      definicaoChave: raw.definicaoChave as Torneio['definicaoChave'],
      formatoChaves: raw.formatoChaves as Torneio['formatoChaves'],
      gruposConfig: raw.gruposConfig
        ? {
            qtdGrupos: Number((raw.gruposConfig as { qtdGrupos?: number }).qtdGrupos) || 2,
            jogadoresPorGrupo:
              Number((raw.gruposConfig as { jogadoresPorGrupo?: number }).jogadoresPorGrupo) || 4,
            classificadosPorGrupo:
              Number((raw.gruposConfig as { classificadosPorGrupo?: number }).classificadosPorGrupo) ||
              2,
          }
        : undefined,
      campeaoUid: raw.campeaoUid ? String(raw.campeaoUid) : undefined,
      campeaoNome: raw.campeaoNome ? String(raw.campeaoNome) : undefined,
      campeoesPorCategoria: (() => {
        const src = raw.campeoesPorCategoria;
        if (!src || typeof src !== 'object') return undefined;
        const out: Record<string, CampeaoCategoria> = {};
        for (const [k, v] of Object.entries(src as Record<string, unknown>)) {
          if (!v || typeof v !== 'object') continue;
          const o = v as Record<string, unknown>;
          out[k] = {
            uid: String(o.uid ?? ''),
            nome: String(o.nome ?? ''),
            categoriaId: o.categoriaId != null ? String(o.categoriaId) : null,
            categoriaNome: o.categoriaNome != null ? String(o.categoriaNome) : null,
          };
        }
        return out;
      })(),
      chaveLiberada: Boolean(raw.chaveLiberada),
      inscricoesEncerradas: Boolean(raw.inscricoesEncerradas),
      clubeLogoUrl: raw.clubeLogoUrl ? String(raw.clubeLogoUrl) : undefined,
      logoUrl: raw.logoUrl ? String(raw.logoUrl) : undefined,
      bannerUrl: raw.bannerUrl ? String(raw.bannerUrl) : undefined,
      formatoPartidaId: raw.formatoPartidaId as Torneio['formatoPartidaId'],
      categorias: Array.isArray(raw.categorias)
        ? (raw.categorias as { id?: string; nome?: string; composicao?: string }[])
            .map((c) => ({
              id: String(c.id ?? '').trim(),
              nome: String(c.nome ?? '').trim(),
              ...(c.composicao === 'dupla' || c.composicao === 'simples'
                ? { composicao: c.composicao as ComposicaoId }
                : {}),
            }))
            .filter((c) => c.id && c.nome)
        : [],
      resultadoSoOrganizador: Boolean(raw.resultadoSoOrganizador),
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
            descontoMultiCategoriaValor: Number(
              (raw.pagamento as { descontoMultiCategoriaValor?: number })
                .descontoMultiCategoriaValor ?? 0
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
    if (!torneio) return;
    const cats = torneio.categorias ?? [];
    setCatDraft(cats);
    setCategoriaSel((prev) => {
      if (prev && cats.some((c) => c.id === prev)) return prev;
      return cats[0]?.id ?? '';
    });
  }, [torneio]);

  useEffect(() => {
    if (!id) return;
    return ouvirInscritosTorneio(id, setInscritos);
  }, [id]);

  const totalConfirmadosReais = useMemo(
    () =>
      inscritos.filter((i) => !i.status || i.status === 'confirmado').length,
    [inscritos]
  );

  const souDonoSync = Boolean(user && torneio && user.uid === torneio.donoUid);

  // Corrige contador desatualizado (só o dono pode gravar; UI já usa a lista real)
  useEffect(() => {
    if (!id || !torneio || !souDonoSync) return;
    const gravado = Number(torneio.totalInscritos ?? 0);
    if (gravado === totalConfirmadosReais) return;
    void sincronizarTotalInscritos(id)
      .then((n) => {
        setTorneio((prev) => (prev ? { ...prev, totalInscritos: n } : prev));
      })
      .catch((e) => console.warn('[torneio] sync totalInscritos', e));
  }, [id, souDonoSync, torneio, totalConfirmadosReais]);

  // Mantém flag local sincronizada com a lista em tempo real (após exclusão/reentrada)
  useEffect(() => {
    if (!user?.uid) {
      setInscrito(false);
      return;
    }
    setInscrito(inscritos.some((i) => i.uid === user.uid));
  }, [inscritos, user?.uid]);

  // Repara inscrição presa em "pagamento pendente" após Stripe já aprovado
  // (docs multi-categoria uid__cat não eram liberados pelo CF antigo).
  useEffect(() => {
    if (!id || !user?.uid || inscritos.length === 0) return;
    const pendentes = inscritos.filter(
      (i) =>
        i.uid === user.uid &&
        i.status === 'aguardando_pagamento' &&
        !i.pago
    );
    if (pendentes.length === 0) return;

    let cancelled = false;
    void (async () => {
      try {
        const { collection, getDocs, query, where, limit } = await import(
          'firebase/firestore'
        );
        const { db } = await import('../../utils/firebaseConfig');
        const snap = await getDocs(
          query(
            collection(db, 'pagamentos'),
            where('uid', '==', user.uid),
            limit(40)
          )
        );
        if (cancelled) return;
        const ok = snap.docs.find((d) => {
          const raw = d.data();
          if (String(raw.torneioId || '') !== id) return false;
          const s = String(raw.status || '');
          return s === 'aprovado' || s === 'liberado_admin';
        });
        if (!ok) return;
        const { marcarPagamentoInscricaoTorneio } = await import(
          '../../services/duplas'
        );
        await marcarPagamentoInscricaoTorneio({
          torneioId: id,
          uid: user.uid,
          pagamentoId: ok.id,
        });
      } catch (e) {
        console.warn('[torneio] reparar inscrição pós-pago', e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id, user?.uid, inscritos]);

  useEffect(() => {
    if (!id) return;
    return ouvirConfrontos(id, setConfrontos);
  }, [id]);

  const souDono = Boolean(user && torneio && user.uid === torneio.donoUid);
  const podeEditarCategorias =
    souDono &&
    torneio?.status === 'aberto' &&
    !torneio?.chaveLiberada &&
    !torneio?.inscricoesEncerradas;
  const categoriaTemChave = useMemo(() => {
    if (!categoriaSel) {
      return confrontos.some((c) => !c.categoriaId);
    }
    return confrontos.some((c) => c.categoriaId === categoriaSel);
  }, [confrontos, categoriaSel]);
  const inscricoesAbertas =
    Boolean(torneio) &&
    torneio!.status !== 'finalizado' &&
    !torneio!.inscricoesEncerradas &&
    !categoriaTemChave;
  const categorias = torneio?.categorias ?? [];
  const catAtual = categorias.find((c) => c.id === categoriaSel);
  const composicaoEfetiva: ComposicaoId =
    catAtual?.composicao ?? torneio?.composicao ?? 'simples';
  const campeoesLista = useMemo(() => {
    const map = torneio?.campeoesPorCategoria;
    if (map && Object.keys(map).length > 0) {
      return Object.values(map).filter((c) => c.nome);
    }
    if (torneio?.campeaoNome) {
      return [{ uid: torneio.campeaoUid ?? '', nome: torneio.campeaoNome }];
    }
    return [];
  }, [torneio]);
  const minhasInscricoes = useMemo(
    () => (user ? inscritos.filter((i) => i.uid === user.uid) : []),
    [inscritos, user]
  );
  const inscritoNaCategoriaSel = useMemo(
    () =>
      minhasInscricoes.some((i) => {
        const cat = (i.categoriaId || '').trim();
        if (categoriaSel) return cat === categoriaSel;
        return !cat && categorias.length === 0;
      }),
    [minhasInscricoes, categoriaSel, categorias.length]
  );
  const inscritosFiltrados = useMemo(() => {
    if (!categoriaSel) return inscritos;
    return inscritos.filter((i) => i.categoriaId === categoriaSel);
  }, [inscritos, categoriaSel]);
  const confrontosFiltrados = useMemo(() => {
    if (!categoriaSel) return confrontos;
    const hasCat = confrontos.some((c) => c.categoriaId);
    if (!hasCat) return confrontos;
    return confrontos.filter((c) => c.categoriaId === categoriaSel);
  }, [confrontos, categoriaSel]);

  const chaveVisivel =
    Boolean(torneio?.chaveLiberada) ||
    (confrontosFiltrados.length > 0 && (souDono || torneio?.status !== 'aberto'));

  const confrontosVisiveis = useMemo(
    () => (chaveVisivel ? confrontosFiltrados : []),
    [chaveVisivel, confrontosFiltrados]
  );
  const confrontosGrupo = useMemo(
    () => confrontosVisiveis.filter((c) => (c.fase ?? 'mata') === 'grupo'),
    [confrontosVisiveis]
  );
  const confrontosMata = useMemo(
    () => confrontosVisiveis.filter((c) => (c.fase ?? 'mata') === 'mata'),
    [confrontosVisiveis]
  );
  const ehGruposMata = torneio?.formatoChaves === 'grupos_mata';

  async function onCompartilhar() {
    if (!torneio) return;
    setCompartilhando(true);
    try {
      await compartilharTorneioFora({
        torneioId: torneio.id,
        nome: torneio.nome,
        clubeNome: torneio.clubeNome,
        bannerUrl: torneio.bannerUrl,
      });
    } catch (e: unknown) {
      Alert.alert('Compartilhar', e instanceof Error ? e.message : 'Falha ao compartilhar.');
    } finally {
      setCompartilhando(false);
    }
  }

  async function onSalvarCategorias() {
    if (!torneio || !souDono) return;
    setSalvandoCats(true);
    try {
      await atualizarCategoriasTorneio(torneio.id, catDraft);
      await reloadTorneio();
      Alert.alert('Categorias', 'Categorias atualizadas.');
    } catch (e: unknown) {
      Alert.alert('Categorias', e instanceof Error ? e.message : 'Falha ao salvar.');
    } finally {
      setSalvandoCats(false);
    }
  }

  async function onInscrever() {
    if (!user || !torneio || !perfil) return;
    if (!inscricoesAbertas) {
      Alert.alert('Torneio', 'Inscrições encerradas.');
      return;
    }
    if (categorias.length > 0 && !categoriaSel) {
      Alert.alert('Torneio', 'Escolha a categoria.');
      return;
    }
    if (inscritoNaCategoriaSel) {
      Alert.alert('Torneio', 'Você já está inscrito nesta categoria.');
      return;
    }
    setEnviando(true);
    try {
      let parceiroUid: string | undefined;
      let parceiroNome: string | undefined;
      if (composicaoEfetiva === 'dupla') {
        const p = await buscarUsuarioPorEmailOuId(parceiroBusca);
        if (!p) {
          Alert.alert('Dupla', 'Parceiro não encontrado. Use e-mail ou ID (SM-…).');
          return;
        }
        parceiroUid = p.uid;
        parceiroNome = p.nome;
      }

      const catNome = categorias.find((c) => c.id === categoriaSel)?.nome;
      const result = await inscreverTorneio({
        torneioId: torneio.id,
        uid: user.uid,
        nome: perfil.nome,
        fotoUrl: perfil.fotoUrl,
        telefone: perfil.telefone,
        email: perfil.email || user.email || undefined,
        setmatchId: perfil.setmatchId,
        categoriaId: categoriaSel || undefined,
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
            catNome ? ` · categoria ${catNome}` : ''
          }${parceiroNome ? ` com ${parceiroNome}` : ''}. ID: ${perfil.setmatchId}. WhatsApp: ${
            perfil.telefone || '—'
          }.`,
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
        const valorPago = result.valorCobrando ?? torneio.pagamento.valor;
        const descExtra =
          (result.descontoMultiCategoriaAplicado ?? 0) > 0
            ? `Desconto 2ª categoria: −${formatMoneyBR(result.descontoMultiCategoriaAplicado!)}`
            : '';
        Alert.alert(
          'Quase lá',
          [
            `Pague ${formatMoneyBR(valorPago)} para confirmar a inscrição.`,
            descExtra,
            resumoPromoCurto(torneio.pagamento) || '',
          ]
            .filter(Boolean)
            .join('\n'),
          [
            {
              text: 'Pagar agora',
              onPress: () =>
                void (async () => {
                  const r = await pagarComEscolhaDeMeio({
                    pagamentoId: result.pagamentoId!,
                    titulo: `Inscrição · ${torneio.nome}`,
                    ciclo: 'unico',
                    regras: {
                      valor: valorPago,
                      permitePix: torneio.pagamento!.permitePix,
                      permiteCartao: torneio.pagamento!.permiteCartao,
                      descontoPixPercent: torneio.pagamento!.descontoPixPercent,
                      descontoCartaoPercent: torneio.pagamento!.descontoCartaoPercent,
                      ciclo: 'unico',
                    },
                  });
                  if (r === 'aprovado' || r === 'pendente') {
                    router.replace({
                      pathname: '/(tabs)/trofeu',
                      params: { aba: 'torneios' },
                    });
                  }
                })(),
            },
            { text: 'OK' },
          ]
        );
      } else if (result.status === 'confirmado') {
        Alert.alert(
          'Inscrição feita',
          catNome ? `Você entrou na categoria ${catNome}.` : 'Você entrou no torneio.'
        );
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

  async function onTapSlotEdicao(c: ConfrontoTorneio) {
    if (!torneio || !souDono) return;
    if (c.status === 'finalizado') {
      Alert.alert('Chave', 'Jogo já finalizado — use W.O. só antes ou refaça.');
      return;
    }
    const escolherSlot = (): Promise<'j1' | 'j2' | null> =>
      new Promise((resolve) => {
        const ops: { text: string; onPress?: () => void; style?: 'cancel' }[] = [];
        if (c.j1Uid) {
          ops.push({ text: c.j1Nome || 'Jogador 1', onPress: () => resolve('j1') });
        }
        if (c.j2Uid) {
          ops.push({ text: c.j2Nome || 'Jogador 2', onPress: () => resolve('j2') });
        }
        if (ops.length === 0) {
          resolve(null);
          return;
        }
        if (ops.length === 1) {
          resolve(c.j1Uid ? 'j1' : 'j2');
          return;
        }
        ops.push({ text: 'Cancelar', style: 'cancel', onPress: () => resolve(null) });
        Alert.alert('Qual jogador mover?', `${c.labelRodada}`, ops);
      });

    const slot = await escolherSlot();
    if (!slot) return;
    const nome = slot === 'j1' ? c.j1Nome : c.j2Nome;
    if (!swapOrigem) {
      setSwapOrigem({ confrontoId: c.id, slot, nome });
      Alert.alert('Mover na chave', `Selecione o destino de ${nome}.`);
      return;
    }
    if (swapOrigem.confrontoId === c.id && swapOrigem.slot === slot) {
      setSwapOrigem(null);
      return;
    }
    try {
      await trocarSlotsChave({
        torneioId: torneio.id,
        a: { confrontoId: swapOrigem.confrontoId, slot: swapOrigem.slot },
        b: { confrontoId: c.id, slot },
      });
      setSwapOrigem(null);
      await reloadTorneio();
      Alert.alert('Chave', `${swapOrigem.nome} ↔ ${nome}`);
    } catch (e: unknown) {
      Alert.alert('Chave', e instanceof Error ? e.message : 'Falha ao trocar');
    }
  }

  async function onGerarChave(opts?: { forcar?: boolean }) {
    if (!torneio || !user) return;

    // Grupos + mata: gera fase de grupos direto (sorteio nos grupos)
    if (torneio.formatoChaves === 'grupos_mata') {
      const cat = categorias.find((c) => c.id === categoriaSel);
      const cfg = torneio.gruposConfig ?? {
        qtdGrupos: 2,
        jogadoresPorGrupo: 4,
        classificadosPorGrupo: 2,
      };
      setGerando(true);
      try {
        const r = await gerarFaseGrupos({
          torneioId: torneio.id,
          categoriaId: cat?.id,
          categoriaNome: cat?.nome,
          gruposConfig: cfg,
          sortear: torneio.definicaoChave !== 'manual',
          forcar: Boolean(opts?.forcar),
        });
        await reloadTorneio();
        Alert.alert(
          'Grupos liberados',
          `${r.grupos} grupo(s) · ${r.jogos} jogo(s). Classificam ${cfg.classificadosPorGrupo} por grupo; ao terminar todos, a chave é gerada.`
        );
      } catch (e: unknown) {
        Alert.alert('Grupos', e instanceof Error ? e.message : 'Falha ao gerar.');
      } finally {
        setGerando(false);
      }
      return;
    }

    setRefazerChave(Boolean(opts?.forcar));
    setCabecasSel([]);
    setByeSel([]);
    const confirmados = inscritosFiltrados.filter(
      (i) => !i.status || i.status === 'confirmado'
    );
    const tam = tamanhoChaveEfetivo(confirmados.length, torneio.estruturaMata);
    setSlotsManuais(Array.from({ length: tam }, () => null));
    setModoChave(torneio.definicaoChave === 'manual' ? 'ordem' : 'sorteio');
    setPickerSlot(null);
    setModalCabecas(true);
  }

  async function confirmarGerarChave() {
    if (!torneio || !user) return;
    const cat = categorias.find((c) => c.id === categoriaSel);
    const catLabel = cat ? ` (${cat.nome})` : '';
    const confirmados = inscritosFiltrados.filter(
      (i) => !i.status || i.status === 'confirmado'
    );
    const nByes = qtdByesNecessarios(confirmados.length, torneio.estruturaMata);

    if (modoChave === 'montar') {
      const preenchidos = slotsManuais.filter(Boolean).length;
      if (preenchidos !== confirmados.length) {
        Alert.alert(
          'Chave',
          `Coloque todos os ${confirmados.length} inscritos na chave (posições vazias = bye). Agora: ${preenchidos}.`
        );
        return;
      }
    } else if (byeSel.length > nByes) {
      Alert.alert('Chave', `Só há ${nByes} bye(s) nesta chave.`);
      return;
    }

    setGerando(true);
    setModalCabecas(false);
    try {
      const n = await gerarChaveamento({
        torneioId: torneio.id,
        donoUid: user.uid,
        estruturaMata: torneio.estruturaMata,
        sortear: modoChave === 'sorteio',
        categoriaId: cat?.id,
        categoriaNome: cat?.nome,
        cabecasUids: modoChave === 'montar' ? undefined : cabecasSel,
        byeUids: modoChave === 'montar' ? undefined : byeSel,
        slotsManuais: modoChave === 'montar' ? slotsManuais : undefined,
        forcar: refazerChave,
      });
      await reloadTorneio();
      Alert.alert(
        'Chave liberada',
        `${n} jogadores na chave${catLabel}${
          modoChave === 'montar'
            ? ' · montagem manual'
            : cabecasSel.length
              ? ` · ${cabecasSel.length} cabeça(s)`
              : ''
        }${byeSel.length && modoChave !== 'montar' ? ` · ${byeSel.length} bye(s)` : ''}.`
      );
    } catch (e: unknown) {
      Alert.alert('Chave', e instanceof Error ? e.message : 'Falha ao gerar.');
    } finally {
      setGerando(false);
      setRefazerChave(false);
    }
  }

  async function onEncerrarInscricoes() {
    if (!torneio || !souDono) return;
    Alert.alert(
      'Encerrar inscrições',
      'Ninguém mais poderá se inscrever. Continuar?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Encerrar',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              try {
                await encerrarInscricoesTorneio(torneio.id);
                await reloadTorneio();
                Alert.alert('Inscrições', 'Inscrições encerradas.');
              } catch (e: unknown) {
                Alert.alert(
                  'Inscrições',
                  e instanceof Error ? e.message : 'Falha ao encerrar.'
                );
              }
            })();
          },
        },
      ]
    );
  }

  function onExcluirTorneio() {
    if (!torneio || !user || !souDono) return;
    const n = Math.max(torneio.totalInscritos ?? 0, inscritos.length);
    const aviso =
      n > 0
        ? `Já há ${n} pessoa${n === 1 ? '' : 's'} inscrita${n === 1 ? '' : 's'}. Excluir remove o torneio, as inscrições e o chaveamento. Essa ação não pode ser desfeita.`
        : 'Excluir este torneio permanentemente? Essa ação não pode ser desfeita.';
    Alert.alert('Excluir torneio', aviso, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            setExcluindo(true);
            try {
              await excluirTorneio(torneio.id, user.uid);
              Alert.alert('Torneio', 'Torneio excluído.');
              router.replace('/clube/torneios');
            } catch (e: unknown) {
              Alert.alert(
                'Torneio',
                e instanceof Error ? e.message : 'Falha ao excluir.'
              );
            } finally {
              setExcluindo(false);
            }
          })();
        },
      },
    ]);
  }

  function onCadastrarInscritoOrg() {
    if (!torneio || !user || !souDono) return;
    if (torneio.status === 'finalizado') {
      Alert.alert('Torneio', 'Torneio encerrado.');
      return;
    }
    if (categorias.length > 0 && !categoriaSel) {
      Alert.alert('Torneio', 'Escolha a categoria antes de cadastrar.');
      return;
    }
    if (!orgBuscaJogador.trim()) {
      Alert.alert('Cadastrar', 'Informe o e-mail ou ID (SM-…) do jogador.');
      return;
    }
    if (composicaoEfetiva === 'dupla' && !orgBuscaParceiro.trim()) {
      Alert.alert('Cadastrar', 'Em dupla, informe também o parceiro.');
      return;
    }
    const catNome = categorias.find((c) => c.id === categoriaSel)?.nome;
    Alert.alert(
      'Cadastrar inscrito',
      `Confirma a inscrição${catNome ? ` em ${catNome}` : ''}?\nO jogador recebe notificação push no celular.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cadastrar',
          onPress: () => {
            void (async () => {
              setCadastrandoOrg(true);
              try {
                const r = await inscreverTorneioPorOrganizador({
                  torneioId: torneio.id,
                  organizadorUid: user.uid,
                  buscaJogador: orgBuscaJogador,
                  categoriaId: categoriaSel || undefined,
                  buscaParceiro:
                    composicaoEfetiva === 'dupla' ? orgBuscaParceiro : undefined,
                });
                setOrgBuscaJogador('');
                setOrgBuscaParceiro('');
                await reloadTorneio();
                Alert.alert(
                  'Inscrito',
                  r.parceiroNome
                    ? `${r.nome} / ${r.parceiroNome} cadastrados. Notificação enviada.`
                    : `${r.nome} cadastrado. Notificação enviada.`
                );
              } catch (e: unknown) {
                Alert.alert(
                  'Cadastrar',
                  e instanceof Error ? e.message : 'Falha ao cadastrar.'
                );
              } finally {
                setCadastrandoOrg(false);
              }
            })();
          },
        },
      ]
    );
  }

  async function executarWO(vencedorUid: string) {
    if (!edit || !user || !torneio || !vencedorUid) return;
    const nome =
      vencedorUid === edit.j1Uid
        ? edit.j1Nome
        : vencedorUid === edit.j2Uid
          ? edit.j2Nome
          : 'Jogador';
    Alert.alert('W.O.', `${nome} avança por W.O.?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Confirmar',
        onPress: () =>
          void (async () => {
            if (!edit || !user || !torneio) return;
            setSalvandoPlacar(true);
            try {
              await registrarWO({
                torneioId: torneio.id,
                confrontoId: edit.id,
                vencedorUid,
                registradoPor: user.uid,
                esporte: torneio.esporte,
              });
              setEdit(null);
              await reloadTorneio();
              Alert.alert('W.O.', `${nome} avançou.`);
            } catch (e: unknown) {
              Alert.alert('W.O.', e instanceof Error ? e.message : 'Falha');
            } finally {
              setSalvandoPlacar(false);
            }
          })(),
      },
    ]);
  }

  function abrirPlacar(c: ConfrontoTorneio) {
    if (c.status === 'finalizado') {
      Alert.alert('Confronto', 'Este jogo já foi finalizado.');
      return;
    }

    // Organizador: abre placar/agenda/W.O. mesmo em bye ou aguardando
    if (souDono) {
      setEdit(c);
      setEditHora(c.dataHoraInicio ?? '');
      setEditQuadra(c.quadraNome ?? '');
      setVencedor(c.j1Uid ? 'j1' : c.j2Uid ? 'j2' : 'j1');
      setSetsDraft(emptySetsDraft());
      return;
    }

    if (c.status === 'bye') return;

    if (c.status !== 'pronto') {
      Alert.alert(
        'Confronto',
        'Ainda não é a fase deste jogo. Aguarde o resultado da rodada anterior para lançar o placar.'
      );
      return;
    }

    const soOrg = Boolean(torneio?.resultadoSoOrganizador);
    const isPlayer =
      user?.uid === c.j1Uid ||
      user?.uid === c.j2Uid ||
      user?.uid === c.j1ParceiroUid ||
      user?.uid === c.j2ParceiroUid;
    if (!souDono && (soOrg || !isPlayer)) {
      Alert.alert(
        'Confronto',
        soOrg
          ? 'Neste torneio só o organizador registra o placar.'
          : 'Só os jogadores ou o organizador registram o placar.'
      );
      return;
    }

    setEdit(c);
    setEditHora(c.dataHoraInicio ?? '');
    setEditQuadra(c.quadraNome ?? '');
    setVencedor('j1');
    setSetsDraft(emptySetsDraft());
  }

  async function salvarAgendaConfronto() {
    if (!edit || !torneio || !souDono) return;
    const salvar = async () => {
      setSalvandoAgenda(true);
      try {
        await atualizarAgendaConfronto(torneio.id, edit.id, {
          dataHoraInicio: editHora,
          quadraNome: editQuadra,
        });
        Alert.alert('Agenda', 'Horário do confronto atualizado.');
        // Mantém modal aberto em bye/aguardando para o organizador poder dar W.O.
      } catch (e: unknown) {
        Alert.alert('Agenda', e instanceof Error ? e.message : 'Falha ao salvar.');
      } finally {
        setSalvandoAgenda(false);
      }
    };

    const conflitos = detectarConflitosAgendaConfronto(
      confrontos,
      edit.id,
      editHora
    );
    if (conflitos.length > 0) {
      const linhas = conflitos
        .slice(0, 4)
        .map(
          (c) =>
            `• ${c.jogadorNome}: ${c.labelRodada}${
              c.categoriaNome ? ` (${c.categoriaNome})` : ''
            } — ${c.j1Nome} vs ${c.j2Nome}`
        )
        .join('\n');
      Alert.alert(
        'Conflito de horário',
        `Mesmo horário em outra categoria/jogo:\n${linhas}\n\nSalvar mesmo assim?`,
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Salvar mesmo', style: 'destructive', onPress: () => void salvar() },
        ]
      );
      return;
    }
    await salvar();
  }

  function draftAgenda(c: ConfrontoTorneio) {
    return (
      agendaDrafts[c.id] ?? {
        hora: c.dataHoraInicio ?? '',
        quadra: c.quadraNome ?? '',
      }
    );
  }

  function setDraftAgenda(
    id: string,
    patch: Partial<{ hora: string; quadra: string }>,
    base: ConfrontoTorneio
  ) {
    setAgendaDrafts((prev) => ({
      ...prev,
      [id]: {
        hora: patch.hora ?? prev[id]?.hora ?? base.dataHoraInicio ?? '',
        quadra: patch.quadra ?? prev[id]?.quadra ?? base.quadraNome ?? '',
      },
    }));
  }

  async function salvarAgendaRapida(c: ConfrontoTorneio) {
    if (!torneio || !souDono) return;
    const d = draftAgenda(c);
    const salvar = async () => {
      setSalvandoAgendaId(c.id);
      try {
        await atualizarAgendaConfronto(torneio.id, c.id, {
          dataHoraInicio: d.hora,
          quadraNome: d.quadra,
        });
        setAgendaDrafts((prev) => {
          const next = { ...prev };
          delete next[c.id];
          return next;
        });
      } catch (e: unknown) {
        Alert.alert('Agenda', e instanceof Error ? e.message : 'Falha ao salvar.');
      } finally {
        setSalvandoAgendaId(null);
      }
    };
    const conflitos = detectarConflitosAgendaConfronto(confrontos, c.id, d.hora);
    if (conflitos.length > 0) {
      const linhas = conflitos
        .slice(0, 4)
        .map(
          (x) =>
            `• ${x.jogadorNome}: ${x.labelRodada}${
              x.categoriaNome ? ` (${x.categoriaNome})` : ''
            }`
        )
        .join('\n');
      Alert.alert(
        'Conflito de horário',
        `Atleta em 2+ categorias no mesmo horário:\n${linhas}\n\nSalvar mesmo assim?`,
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Salvar mesmo', style: 'destructive', onPress: () => void salvar() },
        ]
      );
      return;
    }
    await salvar();
  }

  async function onAplicarHorarioPadrao() {
    if (!torneio || !souDono) return;
    const hora = (evHora || torneio.horarioPadrao || '').trim();
    if (!hora) {
      Alert.alert('Agenda', 'Defina o horário do evento acima antes de aplicar.');
      return;
    }
    Alert.alert(
      'Aplicar horário',
      `Preenche "${hora}" só nos jogos ainda sem horário (todas as categorias). Confrontos com horário definido não mudam.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Aplicar',
          onPress: () => {
            void (async () => {
              setAplicandoPadrao(true);
              try {
                const n = await aplicarHorarioPadraoConfrontos(
                  torneio.id,
                  {
                    dataHoraInicio: hora,
                    quadraNome: evQuadra || torneio.quadraNome || '',
                  },
                  confrontos
                );
                Alert.alert(
                  'Agenda',
                  n > 0
                    ? `${n} jogo${n === 1 ? '' : 's'} atualizado${n === 1 ? '' : 's'}.`
                    : 'Nenhum jogo sem horário para preencher.'
                );
              } catch (e: unknown) {
                Alert.alert(
                  'Agenda',
                  e instanceof Error ? e.message : 'Falha ao aplicar.'
                );
              } finally {
                setAplicandoPadrao(false);
              }
            })();
          },
        },
      ]
    );
  }

  function onRemarcarPendentes(redistribuir: boolean) {
    if (!torneio || !souDono) return;
    if (!isDateBRCompleta(novaDataRemarc)) {
      Alert.alert('Remarcar', 'Informe a nova data (DD/MM/AAAA).');
      return;
    }
    const hora = (novaHoraRemarc || evHora || '09:00').trim();
    if (redistribuir && !/^\d{1,2}:\d{2}$/.test(hora)) {
      Alert.alert('Remarcar', 'Informe o horário inicial (HH:MM) para redistribuir.');
      return;
    }
    const pendentes = confrontos.filter(
      (c) => c.status !== 'bye' && c.status !== 'finalizado'
    ).length;
    if (pendentes === 0) {
      Alert.alert('Remarcar', 'Não há jogos pendentes — só jogos já finalizados.');
      return;
    }
    Alert.alert(
      redistribuir ? 'Nova agenda do torneio' : 'Remarcar data',
      redistribuir
        ? `${pendentes} jogo(s) pendente(s) vão para ${novaDataRemarc} a partir de ${hora} (espaçados por rodada). Jogos já realizados NÃO mudam.`
        : `${pendentes} jogo(s) pendente(s) mudam só a data para ${novaDataRemarc} (mantém o horário de cada um). Jogos já realizados NÃO mudam.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: () => {
            void (async () => {
              setRemarcando(true);
              try {
                const n = await remarcarConfrontosPendentes(
                  torneio.id,
                  confrontos,
                  {
                    novaDataBR: novaDataRemarc,
                    novoHorarioHHMM: hora,
                    quadraNome: evQuadra || torneio.quadraNome || '',
                    redistribuir,
                    intervaloJogosMin,
                    atribuirQuadras,
                    quadrasDisponiveis: parseListaQuadras(quadrasTexto),
                  }
                );
                await atualizarAgendaTorneio(torneio.id, {
                  horarioPadrao: hora,
                  quadraNome: evQuadra || torneio.quadraNome || '',
                  intervaloJogosMin,
                  quadrasDisponiveis: parseListaQuadras(quadrasTexto),
                  atribuirQuadrasAoSortear: atribuirQuadras,
                }).catch(() => undefined);
                setEvHora(hora);
                await reloadTorneio();
                Alert.alert(
                  'Agenda',
                  n > 0
                    ? `${n} jogo(s) remarcado(s). Jogadores foram notificados.`
                    : 'Nada a remarcar.'
                );
              } catch (e: unknown) {
                Alert.alert(
                  'Remarcar',
                  e instanceof Error ? e.message : 'Falha ao remarcar.'
                );
              } finally {
                setRemarcando(false);
              }
            })();
          },
        },
      ]
    );
  }

  async function salvarAgendaEvento() {
    if (!torneio || !souDono) return;
    setSalvandoEv(true);
    try {
      await atualizarAgendaTorneio(torneio.id, {
        horarioPadrao: evHora,
        quadraNome: evQuadra,
        intervaloJogosMin,
        quadrasDisponiveis: parseListaQuadras(quadrasTexto),
        atribuirQuadrasAoSortear: atribuirQuadras,
      });
      await reloadTorneio();
      Alert.alert('Torneio', 'Horário, espaçamento e quadras atualizados.');
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

  function pedirConfirmacaoPlacar() {
    if (!edit || !user || !torneio) return;
    const setsNum = draftParaSets(setsDraft);
    const valid = validarPlacarTorneio({
      formatoId: torneio.formatoPartidaId,
      sets: setsNum,
    });
    if (!valid.ok) {
      Alert.alert('Placar', valid.erro);
      return;
    }
    const vencedorNome =
      valid.vencedor === 'j1' ? edit.j1Nome : edit.j2Nome;
    const resumo = valid.sets
      .map((s) => `${s.j1}–${s.j2}`)
      .join('  ');
    Alert.alert(
      'Confirmar placar',
      `${edit.j1Nome} vs ${edit.j2Nome}\n${resumo}\n\nVencedor: ${vencedorNome}\n\nConfirma o lançamento?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: () => void executarSalvarPlacar(valid),
        },
      ]
    );
  }

  async function executarSalvarPlacar(
    valid: Extract<ReturnType<typeof validarPlacarTorneio>, { ok: true }>
  ) {
    if (!edit || !user || !torneio) return;
    setSalvandoPlacar(true);
    try {
      setVencedor(valid.vencedor);
      await registrarResultadoConfronto({
        torneioId: torneio.id,
        confrontoId: edit.id,
        sets: valid.sets,
        vencedorUid: valid.vencedor === 'j1' ? edit.j1Uid : edit.j2Uid,
        esporte: torneio.esporte,
        registradoPor: user.uid,
      });
      setEdit(null);
      await reloadTorneio();
      Alert.alert('Resultado', 'Placar salvo e vencedor avançou na chave.');
    } catch (e: unknown) {
      const raw = e instanceof Error ? e.message : String(e ?? '');
      const msg =
        /permission|insufficient|Permission/i.test(raw)
          ? 'Sem permissão para salvar o placar. Entre como organizador do torneio e tente de novo.'
          : raw || 'Falha ao salvar.';
      Alert.alert('Placar', msg);
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
        <TouchableOpacity
          onPress={() => void onCompartilhar()}
          disabled={compartilhando}
          accessibilityLabel="Compartilhar torneio"
        >
          <Ionicons name="share-outline" size={24} color={Colors.accent} />
        </TouchableOpacity>
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
            <Text style={styles.clube}>{torneio.local || torneio.clubeNome}</Text>
            {torneio.local && torneio.clubeNome && torneio.local !== torneio.clubeNome ? (
              <Text style={styles.meta}>{torneio.clubeNome}</Text>
            ) : null}
          </View>
        </View>
        <Text style={styles.meta}>
          {[
            torneio.endereco,
            torneio.bairro,
            [torneio.cidade, torneio.estado].filter(Boolean).join('/'),
            torneio.cep,
          ]
            .filter(Boolean)
            .join(' · ') || torneio.cidade}
        </Text>
        <Text style={styles.meta}>
          {torneio.dataInicio || '—'} → {torneio.dataFim || '—'} ·{' '}
          {torneio.status === 'finalizado'
            ? 'encerrado'
            : torneio.status === 'em_andamento'
              ? 'em andamento'
              : 'aberto'}{' '}
          · {totalConfirmadosReais} inscrito
          {totalConfirmadosReais === 1 ? '' : 's'}
          {torneio.inscricoesEncerradas ? ' · inscrições encerradas' : ''}
        </Text>
        {torneio.status === 'finalizado' ? (
          <View style={styles.encerradoBanner}>
            <Text style={styles.encerradoTxt}>Torneio encerrado</Text>
          </View>
        ) : null}
        {campeoesLista.length > 0 ? (
          <View style={styles.campeoesBox}>
            <Text style={styles.campeao}>
              {campeoesLista.length > 1 ? '🏆 Campeões por categoria' : '🏆 Campeão'}
            </Text>
            {campeoesLista.map((ch, i) => (
              <Text key={`${ch.uid}-${i}`} style={styles.campeaoLinha}>
                {ch.categoriaNome ? `${ch.categoriaNome}: ` : ''}
                {ch.nome}
              </Text>
            ))}
          </View>
        ) : null}
        {souDono ? (
          <View style={{ marginTop: 10, marginBottom: 4, gap: 10 }}>
            <Button
              label="Editar torneio"
              variant="outline"
              onPress={() =>
                router.push({
                  pathname: '/clube/torneio-editar',
                  params: { id: torneio.id },
                })
              }
            />
            <Button
              label="Excluir torneio"
              variant="outline"
              loading={excluindo}
              onPress={onExcluirTorneio}
            />
          </View>
        ) : null}
        {(torneio.horarioPadrao || torneio.quadraNome) && !souDono ? (
          <Text style={styles.meta}>
            {[torneio.horarioPadrao, torneio.quadraNome].filter(Boolean).join(' · ')}
          </Text>
        ) : null}
        {torneio.descricao ? <Text style={styles.desc}>{torneio.descricao}</Text> : null}

        {categorias.length > 0 ? (
          <View style={styles.catBlock}>
            <Text style={styles.chaveTitle}>Categorias</Text>
            <View style={styles.catChips}>
              {categorias.map((c) => (
                <TouchableOpacity
                  key={c.id}
                  style={[styles.catChip, categoriaSel === c.id && styles.catChipOn]}
                  onPress={() => setCategoriaSel(c.id)}
                >
                  <Text
                    style={[styles.catChipTxt, categoriaSel === c.id && styles.catChipTxtOn]}
                  >
                    {c.nome}
                    {c.composicao ? ` · ${labelComposicao(c.composicao)}` : ''}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {minhasInscricoes.length > 0 ? (
              <Text style={styles.chaveHint}>
                Suas categorias:{' '}
                {minhasInscricoes
                  .map((i) => i.categoriaNome || 'Geral')
                  .join(', ')}
              </Text>
            ) : null}
          </View>
        ) : null}

        {podeEditarCategorias ? (
          <View style={styles.payBox}>
            <Text style={styles.payTitle}>Gerenciar categorias</Text>
            <Text style={styles.desc}>
              Defina as divisões do torneio. Cada categoria pode ser simples ou dupla.
            </Text>
            {catDraft.map((c, idx) => (
              <View key={c.id} style={styles.catEditBlock}>
                <View style={styles.catEditRow}>
                  <TextInput
                    style={styles.catInput}
                    value={c.nome}
                    onChangeText={(t) =>
                      setCatDraft((prev) =>
                        prev.map((x, i) => (i === idx ? { ...x, nome: t } : x))
                      )
                    }
                    placeholder="Nome da categoria"
                    placeholderTextColor={Colors.textSecondary}
                  />
                  {catDraft.length > 1 ? (
                    <TouchableOpacity
                      style={styles.catIconBtn}
                      onPress={() => setCatDraft((prev) => prev.filter((_, i) => i !== idx))}
                      hitSlop={8}
                    >
                      <Ionicons name="close-circle" size={22} color={Colors.textSecondary} />
                    </TouchableOpacity>
                  ) : null}
                </View>
                <View style={styles.compRow}>
                  {(['simples', 'dupla'] as ComposicaoId[]).map((comp) => (
                    <TouchableOpacity
                      key={comp}
                      style={[
                        styles.compChip,
                        (c.composicao ?? torneio.composicao) === comp && styles.compChipOn,
                      ]}
                      onPress={() =>
                        setCatDraft((prev) =>
                          prev.map((x, i) => (i === idx ? { ...x, composicao: comp } : x))
                        )
                      }
                    >
                      <Text
                        style={[
                          styles.compChipTxt,
                          (c.composicao ?? torneio.composicao) === comp && styles.compChipTxtOn,
                        ]}
                      >
                        {labelComposicao(comp)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ))}
            <View style={styles.catEditRow}>
              <TextInput
                style={styles.catInput}
                value={novaCatNome}
                onChangeText={setNovaCatNome}
                placeholder="Nova categoria"
                placeholderTextColor={Colors.textSecondary}
              />
              <TouchableOpacity
                style={styles.catAddBtn}
                onPress={() => {
                  const n = novaCatNome.trim();
                  if (!n) {
                    Alert.alert('Categoria', 'Digite o nome da nova categoria.');
                    return;
                  }
                  setCatDraft((prev) => [
                    ...prev,
                    { id: novaCategoriaId(), nome: n, composicao: novaCatComp },
                  ]);
                  setNovaCatNome('');
                }}
              >
                <Text style={styles.catAddTxt}>+ Add</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.compRow}>
              {(['simples', 'dupla'] as ComposicaoId[]).map((comp) => (
                <TouchableOpacity
                  key={comp}
                  style={[styles.compChip, novaCatComp === comp && styles.compChipOn]}
                  onPress={() => setNovaCatComp(comp)}
                >
                  <Text
                    style={[styles.compChipTxt, novaCatComp === comp && styles.compChipTxtOn]}
                  >
                    Nova: {labelComposicao(comp)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Button
              label="Salvar categorias"
              variant="outline"
              loading={salvandoCats}
              onPress={() => void onSalvarCategorias()}
            />
          </View>
        ) : souDono && (torneio.chaveLiberada || torneio.inscricoesEncerradas || torneio.status !== 'aberto') ? (
          <Text style={styles.chaveHint}>
            Categorias bloqueadas — o torneio já começou ou as inscrições foram encerradas.
          </Text>
        ) : null}

        {souDono && !torneio.inscricoesEncerradas && torneio.status !== 'finalizado' ? (
          <View style={{ marginBottom: 12 }}>
            <Button
              label="Encerrar inscrições"
              variant="outline"
              onPress={() => void onEncerrarInscricoes()}
            />
          </View>
        ) : null}

        {souDono && torneio.status !== 'finalizado' ? (
          <View style={styles.payBox}>
            <Text style={styles.payTitle}>Cadastrar inscrito</Text>
            <Text style={styles.desc}>
              Busque por e-mail ou ID Rally Up (SM-…). A inscrição fica confirmada e a
              pessoa recebe notificação push no celular.
              {pag?.ativo
                ? ' Use quando o pagamento foi feito fora do app (ex.: no clube).'
                : ''}
            </Text>
            {categorias.length > 0 && !categoriaSel ? (
              <Text style={styles.chaveHint}>
                Selecione a categoria acima antes de cadastrar.
              </Text>
            ) : null}
            <Input
              label="Jogador (e-mail ou ID SM-…)"
              value={orgBuscaJogador}
              onChangeText={setOrgBuscaJogador}
              placeholder="jogador@email.com ou SM-JOG001"
              autoCapitalize="none"
            />
            {composicaoEfetiva === 'dupla' ? (
              <Input
                label="Parceiro da dupla"
                value={orgBuscaParceiro}
                onChangeText={setOrgBuscaParceiro}
                placeholder="parceiro@email.com ou SM-…"
                autoCapitalize="none"
              />
            ) : null}
            <Button
              label={
                categorias.length > 0 && categoriaSel
                  ? `Cadastrar na categoria`
                  : 'Cadastrar no torneio'
              }
              loading={cadastrandoOrg}
              onPress={onCadastrarInscritoOrg}
              disabled={categorias.length > 0 && !categoriaSel}
            />
          </View>
        ) : null}

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
              Ao sortear a chave, os jogos já recebem data/hora a partir do início do
              torneio. Em chuva: remarque um jogo na lista ou mova todos os pendentes
              para outra data (jogos já realizados ficam como estão).
            </Text>
            <TextInput
              style={styles.scoreInputWide}
              placeholder="Horário ref. (ex: 09:00)"
              placeholderTextColor={Colors.textSecondary}
              value={evHora}
              onChangeText={(t) => setEvHora(maskTimeHHMM(t))}
              keyboardType="number-pad"
            />
            <TextInput
              style={styles.scoreInputWide}
              placeholder="Quadra ref. opcional"
              placeholderTextColor={Colors.textSecondary}
              value={evQuadra}
              onChangeText={setEvQuadra}
            />
            <Text style={styles.payTitle}>Espaçamento entre jogos</Text>
            <Text style={styles.desc}>
              No sorteio da chave e ao redistribuir agenda (ex.: 1h ou 2h).
            </Text>
            <View style={styles.intervalRow}>
              {INTERVALOS_JOGO_OPCOES.map((op) => (
                <TouchableOpacity
                  key={op.min}
                  style={[
                    styles.intervalChip,
                    intervaloJogosMin === op.min && styles.intervalChipOn,
                  ]}
                  onPress={() => setIntervaloJogosMin(op.min)}
                >
                  <Text
                    style={[
                      styles.intervalChipTxt,
                      intervaloJogosMin === op.min && styles.intervalChipTxtOn,
                    ]}
                  >
                    {op.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.switchRowAgenda}>
              <Text style={styles.desc}>Sortear quadras nos jogos</Text>
              <TouchableOpacity
                onPress={() => setAtribuirQuadras((v) => !v)}
                style={[styles.intervalChip, atribuirQuadras && styles.intervalChipOn]}
              >
                <Text
                  style={[
                    styles.intervalChipTxt,
                    atribuirQuadras && styles.intervalChipTxtOn,
                  ]}
                >
                  {atribuirQuadras ? 'Sim' : 'Não'}
                </Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.desc}>
              Não = jogos sem quadra (você define na hora). Sim = distribui as quadras
              abaixo no sorteio.
            </Text>
            {atribuirQuadras ? (
              <TextInput
                style={[styles.scoreInputWide, { minHeight: 80, textAlignVertical: 'top' }]}
                placeholder={'Quadra 1\nQuadra 2\nQuadra 3'}
                placeholderTextColor={Colors.textSecondary}
                value={quadrasTexto}
                onChangeText={setQuadrasTexto}
                multiline
              />
            ) : null}
            <Button
              label="Salvar horário / espaçamento / quadras"
              variant="outline"
              loading={salvandoEv}
              onPress={() => void salvarAgendaEvento()}
            />
            {confrontos.length > 0 ? (
              <>
                <Button
                  label={agendaRapida ? 'Ocultar agenda dos jogos' : 'Remarcar jogos (chuva)'}
                  variant="outline"
                  onPress={() => {
                    setAgendaRapida((v) => {
                      const next = !v;
                      if (next && !novaDataRemarc) {
                        setNovaDataRemarc(torneio.dataInicio || '');
                        setNovaHoraRemarc(
                          maskTimeHHMM(evHora || torneio.horarioPadrao || '09:00')
                        );
                      }
                      return next;
                    });
                  }}
                />
                {agendaRapida ? (
                  <>
                    <Text style={styles.payTitle}>Mover torneio (só pendentes)</Text>
                    <Text style={styles.desc}>
                      Jogos finalizados não mudam. Pendentes vão para a nova data.
                    </Text>
                    <TextInput
                      style={styles.scoreInputWide}
                      placeholder="Nova data DD/MM/AAAA"
                      placeholderTextColor={Colors.textSecondary}
                      value={novaDataRemarc}
                      onChangeText={(t) => setNovaDataRemarc(maskDateBR(t))}
                      keyboardType="number-pad"
                    />
                    <TextInput
                      style={styles.scoreInputWide}
                      placeholder="Horário inicial HH:MM"
                      placeholderTextColor={Colors.textSecondary}
                      value={novaHoraRemarc}
                      onChangeText={(t) => setNovaHoraRemarc(maskTimeHHMM(t))}
                      keyboardType="number-pad"
                    />
                    <Button
                      label="Só trocar a data (mantém horários)"
                      variant="outline"
                      loading={remarcando}
                      onPress={() => onRemarcarPendentes(false)}
                    />
                    <Button
                      label="Nova agenda completa (redistribuir)"
                      loading={remarcando}
                      onPress={() => onRemarcarPendentes(true)}
                    />
                    <Button
                      label="Aplicar horário só nos sem agenda"
                      variant="outline"
                      loading={aplicandoPadrao}
                      onPress={() => void onAplicarHorarioPadrao()}
                    />
                    <Text style={[styles.payTitle, { marginTop: 8 }]}>
                      Jogos pendentes (toque e salve)
                    </Text>
                    {confrontos
                      .filter((c) => c.status !== 'bye' && c.status !== 'finalizado')
                      .sort((a, b) => {
                        const ca = (a.categoriaNome || '').localeCompare(
                          b.categoriaNome || '',
                          'pt-BR'
                        );
                        if (ca !== 0) return ca;
                        return (a.labelRodada || '').localeCompare(
                          b.labelRodada || '',
                          'pt-BR'
                        );
                      })
                      .map((c) => {
                        const d = draftAgenda(c);
                        const dirty =
                          d.hora !== (c.dataHoraInicio ?? '') ||
                          d.quadra !== (c.quadraNome ?? '');
                        return (
                          <View key={c.id} style={styles.agendaRow}>
                            <Text style={styles.agendaTitulo} numberOfLines={2}>
                              {c.categoriaNome ? `${c.categoriaNome} · ` : ''}
                              {c.labelRodada}
                              {c.status === 'pronto' ? ' · pronto' : ''}
                            </Text>
                            <Text style={styles.desc} numberOfLines={1}>
                              {c.j1Nome} vs {c.j2Nome}
                            </Text>
                            <TextInput
                              style={styles.scoreInputWide}
                              placeholder="Data/hora (ex: 14/09 10:00)"
                              placeholderTextColor={Colors.textSecondary}
                              value={d.hora}
                              onChangeText={(t) =>
                                setDraftAgenda(c.id, { hora: t }, c)
                              }
                            />
                            <TextInput
                              style={styles.scoreInputWide}
                              placeholder="Quadra"
                              placeholderTextColor={Colors.textSecondary}
                              value={d.quadra}
                              onChangeText={(t) =>
                                setDraftAgenda(c.id, { quadra: t }, c)
                              }
                            />
                            <Button
                              label={dirty ? 'Salvar novo horário' : 'Horário ok'}
                              variant="outline"
                              loading={salvandoAgendaId === c.id}
                              disabled={!dirty}
                              onPress={() => void salvarAgendaRapida(c)}
                            />
                          </View>
                        );
                      })}
                    {confrontos.some((c) => c.status === 'finalizado') ? (
                      <Text style={styles.desc}>
                        {confrontos.filter((c) => c.status === 'finalizado').length} jogo(s)
                        já realizado(s) — permanecem com o horário original.
                      </Text>
                    ) : null}
                  </>
                ) : null}
              </>
            ) : null}
          </View>
        ) : null}

        {pag?.ativo ? (
          <View style={styles.payBox}>
            <Text style={styles.payTitle}>
              Inscrição {formatMoneyBR(pag.valor)} · PIX ou cartão
              {torneio.composicao === 'dupla' ? ' (por atleta)' : ''}
            </Text>
            {(pag.descontoMultiCategoriaValor ?? 0) > 0 ? (
              <Text style={styles.desc}>
                2ª+ categoria: −{formatMoneyBR(pag.descontoMultiCategoriaValor!)} na inscrição.
              </Text>
            ) : null}
            {resumoPromoCurto(pag) ? (
              <Text style={styles.desc}>{resumoPromoCurto(pag)}</Text>
            ) : null}
            {torneio.resultadoSoOrganizador ? (
              <Text style={styles.desc}>Placar só pelo organizador.</Text>
            ) : null}
          </View>
        ) : null}

        {!inscritoNaCategoriaSel && composicaoEfetiva === 'dupla' ? (
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
            {!inscricoesAbertas
              ? 'Inscrições encerradas'
              : inscritoNaCategoriaSel
                ? 'Inscrito nesta categoria'
                : categorias.length > 0
                  ? `Inscrever nesta categoria (${labelComposicao(composicaoEfetiva)})`
                  : composicaoEfetiva === 'dupla'
                    ? 'Inscrição em duplas'
                    : 'Inscrições'}
          </Text>
        </View>
        <Button
          label={
            !inscricoesAbertas && !inscritoNaCategoriaSel
              ? 'Inscrições encerradas'
              : inscritoNaCategoriaSel
                ? minhasInscricoes.some(
                    (i) =>
                      (!categoriaSel || i.categoriaId === categoriaSel) &&
                      !i.pago &&
                      i.status === 'aguardando_pagamento'
                  )
                  ? 'Ver pagamentos'
                  : 'Já inscrito nesta categoria'
                : categorias.length > 0
                  ? 'Inscrever-me nesta categoria'
                  : 'Inscrever-me'
          }
          onPress={() => {
            const precisaPagar = minhasInscricoes.some(
              (i) =>
                (!categoriaSel || i.categoriaId === categoriaSel) &&
                !i.pago &&
                i.status === 'aguardando_pagamento'
            );
            if (inscritoNaCategoriaSel && precisaPagar) router.push('/pagamentos');
            else if (!inscritoNaCategoriaSel) void onInscrever();
          }}
          loading={enviando}
          disabled={
            inscritoNaCategoriaSel
              ? !minhasInscricoes.some(
                  (i) =>
                    (!categoriaSel || i.categoriaId === categoriaSel) &&
                    !i.pago &&
                    i.status === 'aguardando_pagamento'
                )
              : !inscricoesAbertas || (categorias.length > 0 && !categoriaSel)
          }
        />
        {inscritoNaCategoriaSel &&
        user &&
        minhasInscricoes.some(
          (i) =>
            (!categoriaSel || i.categoriaId === categoriaSel) &&
            !i.pago &&
            i.status !== 'confirmado'
        ) ? (
          <Button
            label="Cancelar minha inscrição"
            variant="outline"
            style={{ marginTop: 10 }}
            onPress={() => {
              const minha = minhasInscricoes.find(
                (i) => !categoriaSel || i.categoriaId === categoriaSel
              );
              if (!minha?.id || !torneio) return;
              Alert.alert(
                'Cancelar inscrição',
                'Remover sua inscrição nesta categoria? (só se ainda não pagou)',
                [
                  { text: 'Voltar', style: 'cancel' },
                  {
                    text: 'Cancelar inscrição',
                    style: 'destructive',
                    onPress: () => {
                      void (async () => {
                        try {
                          await cancelarInscricaoTorneio({
                            torneioId: torneio.id,
                            inscricaoId: minha.id!,
                            solicitanteUid: user.uid,
                          });
                          Alert.alert('Inscrição', 'Inscrição cancelada.');
                        } catch (e: unknown) {
                          Alert.alert(
                            'Inscrição',
                            e instanceof Error ? e.message : 'Falha ao cancelar'
                          );
                        }
                      })();
                    },
                  },
                ]
              );
            }}
          />
        ) : null}

        <View style={styles.inscritosBox}>
          <Text style={styles.chaveTitle}>
            Inscritos
            {categoriaSel
              ? ` · ${categorias.find((c) => c.id === categoriaSel)?.nome ?? ''}`
              : ''}{' '}
            (
            {
              inscritosFiltrados.filter((i) => !i.status || i.status === 'confirmado')
                .length
            }
            )
          </Text>
          <Text style={styles.chaveHint}>
            Confirmados no torneio: {totalConfirmadosReais}
            {categoriaSel
              ? ` · Nesta categoria: ${inscritosFiltrados.length}`
              : ''}
          </Text>
          {inscritosFiltrados.length === 0 ? (
            <Text style={styles.chaveHint}>Ninguém inscrito ainda nesta categoria.</Text>
          ) : (
            inscritosFiltrados.map((i) => (
              <View
                key={i.id || `${i.uid}-${i.categoriaId || 'x'}`}
                style={styles.inscritoRow}
              >
                <TouchableOpacity
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}
                  onPress={() => {
                    if (i.uid) router.push(`/jogador/${i.uid}`);
                  }}
                  activeOpacity={0.7}
                >
                  <Avatar uri={i.fotoUrl} nome={i.nome} size="sm" />
                  <Text style={styles.inscritoNome} numberOfLines={2}>
                    {i.parceiroNome ? `${i.nome} / ${i.parceiroNome}` : i.nome}
                    {user?.uid === i.uid ? ' (você)' : ''}
                    {i.status && i.status !== 'confirmado'
                      ? ` · ${
                          i.status === 'aguardando_pagamento'
                            ? 'pagamento pendente'
                            : i.status === 'aguardando_parceiro'
                              ? 'aguardando parceiro'
                              : i.status
                        }`
                      : ''}
                  </Text>
                </TouchableOpacity>
                {souDono && i.id ? (
                  <TouchableOpacity
                    onPress={() => {
                      Alert.alert(
                        'Remover inscrito',
                        `Remover ${i.nome} da inscrição${
                          i.pago ? ' (já pagou — a cobrança aprovada não é estornada automaticamente)' : ''
                        }?`,
                        [
                          { text: 'Voltar', style: 'cancel' },
                          {
                            text: 'Remover',
                            style: 'destructive',
                            onPress: () => {
                              void (async () => {
                                try {
                                  await cancelarInscricaoTorneio({
                                    torneioId: torneio.id,
                                    inscricaoId: i.id!,
                                    solicitanteUid: user!.uid,
                                  });
                                } catch (e: unknown) {
                                  Alert.alert(
                                    'Inscrição',
                                    e instanceof Error ? e.message : 'Falha ao remover'
                                  );
                                }
                              })();
                            },
                          },
                        ]
                      );
                    }}
                    hitSlop={8}
                    accessibilityLabel={`Remover ${i.nome}`}
                  >
                    <Ionicons name="trash-outline" size={20} color={Colors.accent} />
                  </TouchableOpacity>
                ) : (
                  <Ionicons name="chevron-forward" size={16} color={Colors.textSecondary} />
                )}
              </View>
            ))
          )}
        </View>

        {souDono &&
        confrontosFiltrados.length === 0 &&
        (!categoriaSel || categorias.some((c) => c.id === categoriaSel)) ? (
          <Button
            label={
              ehGruposMata
                ? categoriaSel
                  ? `Liberar grupos · ${categorias.find((c) => c.id === categoriaSel)?.nome ?? ''}`
                  : 'Liberar fase de grupos'
                : categoriaSel
                  ? `Liberar chave · ${categorias.find((c) => c.id === categoriaSel)?.nome ?? ''}`
                  : 'Liberar chaveamento'
            }
            variant="outline"
            loading={gerando}
            onPress={() => void onGerarChave()}
            disabled={
              inscritosFiltrados.filter((i) => !i.status || i.status === 'confirmado')
                .length < 2
            }
          />
        ) : null}
        {souDono && confrontosFiltrados.length > 0 ? (
          <Button
            label={
              ehGruposMata
                ? 'Refazer grupos desta categoria'
                : 'Refazer chaveamento desta categoria'
            }
            variant="outline"
            loading={gerando}
            onPress={() =>
              Alert.alert(
                ehGruposMata ? 'Refazer grupos' : 'Refazer chave',
                ehGruposMata
                  ? 'Apaga grupos e confrontos desta categoria e gera de novo. Continuar?'
                  : 'Apaga confrontos desta categoria e gera de novo (cabeças + byes). Continuar?',
                [
                  { text: 'Cancelar', style: 'cancel' },
                  {
                    text: 'Refazer',
                    style: 'destructive',
                    onPress: () => void onGerarChave({ forcar: true }),
                  },
                ]
              )
            }
          />
        ) : null}
        {souDono &&
        confrontosGrupo.length > 0 &&
        confrontosMata.length === 0 &&
        confrontosGrupo.every((c) => c.status === 'finalizado' || c.status === 'bye') ? (
          <Button
            label="Gerar mata-mata com classificados"
            loading={gerando}
            onPress={() => {
              void (async () => {
                if (!torneio || !user) return;
                setGerando(true);
                try {
                  const cat = categorias.find((c) => c.id === categoriaSel);
                  const r = await tentarPromoverClassificados({
                    torneioId: torneio.id,
                    categoriaId: cat?.id,
                    categoriaNome: cat?.nome,
                    classificadosPorGrupo:
                      torneio.gruposConfig?.classificadosPorGrupo ?? 2,
                    estruturaMata: torneio.estruturaMata,
                    forcar: true,
                  });
                  await reloadTorneio();
                  Alert.alert(
                    'Mata-mata',
                    r.promoveu
                      ? `${r.classificados} classificados na chave.`
                      : r.motivo ?? 'Não foi possível gerar.'
                  );
                } catch (e: unknown) {
                  Alert.alert(
                    'Mata-mata',
                    e instanceof Error ? e.message : 'Falha ao gerar.'
                  );
                } finally {
                  setGerando(false);
                }
              })();
            }}
          />
        ) : null}
        {souDono &&
        confrontosFiltrados.length === 0 &&
        inscritosFiltrados.filter((i) => !i.status || i.status === 'confirmado').length <
          2 ? (
          <Text style={styles.chaveHint}>
            Precisa de pelo menos 2 inscritos confirmados nesta categoria. Se faltar gente
            para completar a potência de 2, a chave usa bye automaticamente.
          </Text>
        ) : null}

        {confrontosGrupo.length > 0 ? (
          <GruposTorneioPainel
            confrontos={confrontosGrupo}
            onPressJogo={abrirPlacar}
            classificadosPorGrupo={torneio.gruposConfig?.classificadosPorGrupo ?? 2}
          />
        ) : null}

        {confrontosMata.length > 0 ? (
          <>
            {souDono ? (
              <Button
                label={modoEditarChave ? 'Concluir edição da chave' : 'Mover jogadores na chave'}
                variant="outline"
                onPress={() => {
                  setModoEditarChave((v) => !v);
                  setSwapOrigem(null);
                }}
              />
            ) : null}
            {modoEditarChave ? (
              <Text style={styles.chaveHint}>
                Toque no 1º jogador e depois no 2º para trocar de lugar na chave. W.O. no placar
                do confronto.
              </Text>
            ) : null}
            <ChaveamentoBracket
              confrontos={confrontosMata}
              onPressMatch={(c) => {
                if (modoEditarChave && souDono) {
                  void onTapSlotEdicao(c);
                  return;
                }
                abrirPlacar(c);
              }}
              highlightUid={user?.uid}
              pressEnabled={(c) =>
                modoEditarChave
                  ? c.status !== 'finalizado'
                  : souDono
                    ? c.status !== 'finalizado'
                    : c.status !== 'bye' && c.status !== 'finalizado'
              }
            />
          </>
        ) : confrontosGrupo.length === 0 ? (
          <Text style={styles.chaveHint}>
            {souDono
              ? ehGruposMata
                ? 'Quando houver 2+ inscritos, libere a fase de grupos.'
                : 'Quando houver 2+ inscritos, toque em Liberar chaveamento para definir cabeças, byes e confrontos.'
              : 'O chaveamento aparece para todos quando o organizador liberar.'}
          </Text>
        ) : null}
      </ScrollView>

      <Modal visible={!!edit} transparent animationType="slide">
        <KeyboardAvoidingView
          style={styles.modalBg}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}
        >
          <TouchableOpacity
            style={styles.modalDismiss}
            activeOpacity={1}
            onPress={() => setEdit(null)}
          />
          <View
            style={[
              styles.modalCard,
              { paddingBottom: Math.max(insets.bottom, 16) },
            ]}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {edit?.status === 'bye'
                  ? 'Bye · W.O.'
                  : souDono && edit?.status !== 'pronto'
                    ? 'Horário / W.O.'
                    : 'Registrar placar'}
              </Text>
              <TouchableOpacity
                onPress={() => setEdit(null)}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={24} color={Colors.textPrimary} />
              </TouchableOpacity>
            </View>
            {edit ? (
              <ScrollView
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.modalScroll}
              >
                <Text style={styles.meta}>
                  {edit.j1Nome || '—'}
                  {edit.status === 'bye' && !edit.j2Uid
                    ? ' · bye (sem adversário)'
                    : ` vs ${edit.j2Nome || '—'}`}
                </Text>
                {edit.status === 'bye' && souDono ? (
                  <Text style={styles.chaveHint}>
                    Bye automático na chave. Confirme o W.O. para marcar o avanço e
                    registrar no histórico, ou troque o jogador em “Mover na chave”.
                  </Text>
                ) : null}
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
                  (!torneio.resultadoSoOrganizador &&
                    (user?.uid === edit.j1Uid ||
                      user?.uid === edit.j2Uid ||
                      user?.uid === edit.j1ParceiroUid ||
                      user?.uid === edit.j2ParceiroUid))) ? (
                  <>
                    <View style={styles.placarHeader}>
                      <View style={styles.placarSide}>
                        <Avatar uri={edit.j1Foto} nome={edit.j1Nome} size="sm" />
                        <Text style={styles.placarNome} numberOfLines={2}>
                          {edit.j1Nome}
                        </Text>
                      </View>
                      <Text style={styles.placarVs}>×</Text>
                      <View style={[styles.placarSide, styles.placarSideRight]}>
                        <Text style={styles.placarNome} numberOfLines={2}>
                          {edit.j2Nome}
                        </Text>
                        <Avatar uri={edit.j2Foto} nome={edit.j2Nome} size="sm" />
                      </View>
                    </View>
                    <Text style={styles.chaveHint}>
                      Formato: {labelFormatoPartidaTorneio(torneio.formatoPartidaId)}
                    </Text>
                    {(() => {
                      const partial = draftParaSets(setsDraft);
                      const nVis = quantosSetsVisiveis(torneio.formatoPartidaId, partial);
                      return (
                        <>
                          <Text style={[styles.chaveHint, { marginBottom: 4 }]}>
                            {statusPlacarProgressivo(torneio.formatoPartidaId, partial)}
                          </Text>
                          {Array.from({ length: nVis }, (_, idx) => (
                            <View key={`set-${idx}`} style={styles.setBlock}>
                              <Text style={styles.modalLabel}>
                                {rotuloSet(torneio.formatoPartidaId, idx, partial)}
                              </Text>
                              <View style={styles.scoreRowAvatars}>
                                <TextInput
                                  style={styles.scoreInput}
                                  keyboardType="number-pad"
                                  placeholder="0"
                                  placeholderTextColor={Colors.textSecondary}
                                  value={setsDraft[idx]?.j1 ?? ''}
                                  onChangeText={(t) =>
                                    setSetsDraft((prev) => {
                                      const next = ensureDraftSlots(prev, idx);
                                      next[idx] = {
                                        ...(next[idx] ?? { j1: '', j2: '' }),
                                        j1: t.replace(/\D/g, '').slice(0, 2),
                                      };
                                      return next;
                                    })
                                  }
                                />
                                <Text style={styles.meta}>–</Text>
                                <TextInput
                                  style={styles.scoreInput}
                                  keyboardType="number-pad"
                                  placeholder="0"
                                  placeholderTextColor={Colors.textSecondary}
                                  value={setsDraft[idx]?.j2 ?? ''}
                                  onChangeText={(t) =>
                                    setSetsDraft((prev) => {
                                      const next = ensureDraftSlots(prev, idx);
                                      next[idx] = {
                                        ...(next[idx] ?? { j1: '', j2: '' }),
                                        j2: t.replace(/\D/g, '').slice(0, 2),
                                      };
                                      return next;
                                    })
                                  }
                                />
                              </View>
                            </View>
                          ))}
                        </>
                      );
                    })()}
                    <Text style={styles.chaveHint}>
                      Preencha set a set. Se ninguém fechou ainda, aparece o próximo placar
                      automaticamente.
                    </Text>
                    <Button
                      label="Salvar e avançar"
                      loading={salvandoPlacar}
                      onPress={pedirConfirmacaoPlacar}
                    />
                  </>
                ) : null}
                {souDono &&
                edit &&
                edit.status !== 'finalizado' &&
                (edit.j1Uid || edit.j2Uid) ? (
                  <View style={{ gap: 8, marginTop: 8 }}>
                    <Text style={styles.chaveHint}>
                      {edit.status === 'bye'
                        ? 'W.O. — confirma o avanço do jogador sem adversário.'
                        : 'W.O. — avança o jogador sem placar (falta / desistência).'}
                    </Text>
                    {edit.status === 'bye' && edit.vencedorUid ? (
                      <Button
                        label={`Confirmar W.O. · ${
                          edit.vencedorUid === edit.j1Uid
                            ? edit.j1Nome
                            : edit.vencedorUid === edit.j2Uid
                              ? edit.j2Nome
                              : 'Jogador'
                        }`}
                        loading={salvandoPlacar}
                        onPress={() => void executarWO(edit.vencedorUid)}
                      />
                    ) : (
                      <>
                        {edit.j1Uid ? (
                          <Button
                            label={`W.O. · vence ${edit.j1Nome}`}
                            variant={edit.status === 'bye' ? 'primary' : 'outline'}
                            loading={salvandoPlacar}
                            onPress={() => void executarWO(edit.j1Uid)}
                          />
                        ) : null}
                        {edit.j2Uid ? (
                          <Button
                            label={`W.O. · vence ${edit.j2Nome}`}
                            variant={edit.status === 'bye' ? 'primary' : 'outline'}
                            loading={salvandoPlacar}
                            onPress={() => void executarWO(edit.j2Uid)}
                          />
                        ) : null}
                      </>
                    )}
                  </View>
                ) : null}
                <TouchableOpacity
                  onPress={() => setEdit(null)}
                  style={styles.cancelBtn}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={styles.cancel}>Cancelar</Text>
                </TouchableOpacity>
              </ScrollView>
            ) : null}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={modalCabecas} transparent animationType="slide">
        <View style={styles.modalBg}>
          <View style={[styles.modalCard, { maxHeight: '92%' }]}>
            <Text style={styles.modalTitle}>
              {refazerChave ? 'Refazer chave' : 'Liberar chaveamento'}
            </Text>
            {(() => {
              const confirmados = inscritosFiltrados.filter(
                (i) => !i.status || i.status === 'confirmado'
              );
              const nByes = qtdByesNecessarios(
                confirmados.length,
                torneio?.estruturaMata
              );
              const tam = tamanhoChaveEfetivo(
                confirmados.length,
                torneio?.estruturaMata
              );
              const labelJog = (uid: string | null) => {
                if (!uid) return 'BYE';
                const i = confirmados.find((x) => x.uid === uid);
                if (!i) return '—';
                return i.parceiroNome ? `${i.nome} / ${i.parceiroNome}` : i.nome;
              };
              const uidsLivres = confirmados
                .map((i) => i.uid)
                .filter((u) => !slotsManuais.includes(u));

              return (
                <>
                  <Text style={styles.desc}>
                    Chave de {tam} (com {nByes} bye
                    {nByes === 1 ? '' : 's'}). Escolha o modo:
                  </Text>
                  <View style={styles.modoRow}>
                    {(
                      [
                        ['sorteio', 'Sorteio'],
                        ['ordem', 'Ordem'],
                        ['montar', 'Montar'],
                      ] as const
                    ).map(([id, label]) => (
                      <TouchableOpacity
                        key={id}
                        style={[styles.modoChip, modoChave === id && styles.modoChipOn]}
                        onPress={() => setModoChave(id)}
                      >
                        <Text
                          style={[
                            styles.modoChipTxt,
                            modoChave === id && styles.modoChipTxtOn,
                          ]}
                        >
                          {label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <Text style={[styles.desc, { marginTop: 4 }]}>
                    {modoChave === 'sorteio'
                      ? 'Cabeças fixos; demais sorteados. Opcional: quem recebe bye.'
                      : modoChave === 'ordem'
                        ? 'Cabeças fixos; demais na ordem de inscrição. Opcional: bye.'
                        : 'Monte cada jogo da 1ª rodada. Posição vazia = bye.'}
                  </Text>

                  <ScrollView style={{ maxHeight: 340 }} keyboardShouldPersistTaps="handled">
                    {modoChave !== 'montar' ? (
                      <>
                        <Text style={styles.modalSection}>Cabeças de chave (toque na ordem)</Text>
                        {confirmados.map((i) => {
                          const on = cabecasSel.includes(i.uid);
                          return (
                            <TouchableOpacity
                              key={i.id}
                              style={[styles.cabecaRow, on && styles.cabecaRowOn]}
                              onPress={() =>
                                setCabecasSel((prev) =>
                                  on
                                    ? prev.filter((u) => u !== i.uid)
                                    : [...prev, i.uid]
                                )
                              }
                            >
                              <Avatar uri={i.fotoUrl} nome={i.nome} size="sm" />
                              <Text style={styles.inscritoNome}>
                                {i.parceiroNome
                                  ? `${i.nome} / ${i.parceiroNome}`
                                  : i.nome}
                              </Text>
                              {on ? (
                                <Text style={styles.seedBadge}>
                                  #{cabecasSel.indexOf(i.uid) + 1}
                                </Text>
                              ) : null}
                            </TouchableOpacity>
                          );
                        })}
                        {nByes > 0 ? (
                          <>
                            <Text style={styles.modalSection}>
                              Quem recebe bye (até {nByes})
                            </Text>
                            {confirmados.map((i) => {
                              const on = byeSel.includes(i.uid);
                              return (
                                <TouchableOpacity
                                  key={`bye-${i.id}`}
                                  style={[styles.cabecaRow, on && styles.cabecaRowOn]}
                                  onPress={() =>
                                    setByeSel((prev) => {
                                      if (on) return prev.filter((u) => u !== i.uid);
                                      if (prev.length >= nByes) return prev;
                                      return [...prev, i.uid];
                                    })
                                  }
                                >
                                  <Avatar uri={i.fotoUrl} nome={i.nome} size="sm" />
                                  <Text style={styles.inscritoNome}>
                                    {i.parceiroNome
                                      ? `${i.nome} / ${i.parceiroNome}`
                                      : i.nome}
                                  </Text>
                                  {on ? (
                                    <Text style={styles.seedBadge}>BYE</Text>
                                  ) : null}
                                </TouchableOpacity>
                              );
                            })}
                          </>
                        ) : null}
                      </>
                    ) : (
                      <>
                        {Array.from({ length: tam / 2 }, (_, m) => {
                          const a = m * 2;
                          const b = m * 2 + 1;
                          return (
                            <View key={`m-${m}`} style={styles.matchMontar}>
                              <Text style={styles.modalSection}>Jogo {m + 1}</Text>
                              <TouchableOpacity
                                style={styles.slotPick}
                                onPress={() => setPickerSlot(a)}
                              >
                                <Text style={styles.slotPickTxt}>{labelJog(slotsManuais[a])}</Text>
                              </TouchableOpacity>
                              <Text style={styles.vsTxt}>vs</Text>
                              <TouchableOpacity
                                style={styles.slotPick}
                                onPress={() => setPickerSlot(b)}
                              >
                                <Text style={styles.slotPickTxt}>{labelJog(slotsManuais[b])}</Text>
                              </TouchableOpacity>
                            </View>
                          );
                        })}
                        {pickerSlot != null ? (
                          <View style={styles.pickerBox}>
                            <Text style={styles.modalSection}>
                              Escolher posição {pickerSlot + 1}
                            </Text>
                            <TouchableOpacity
                              style={styles.cabecaRow}
                              onPress={() => {
                                setSlotsManuais((prev) => {
                                  const next = [...prev];
                                  next[pickerSlot] = null;
                                  return next;
                                });
                                setPickerSlot(null);
                              }}
                            >
                              <Text style={styles.inscritoNome}>BYE (vazio)</Text>
                            </TouchableOpacity>
                            {slotsManuais[pickerSlot]
                              ? (
                                  <TouchableOpacity
                                    style={styles.cabecaRow}
                                    onPress={() => {
                                      setSlotsManuais((prev) => {
                                        const next = [...prev];
                                        next[pickerSlot] = null;
                                        return next;
                                      });
                                      setPickerSlot(null);
                                    }}
                                  >
                                    <Text style={styles.inscritoNome}>Limpar slot</Text>
                                  </TouchableOpacity>
                                )
                              : null}
                            {uidsLivres.map((uid) => {
                              const i = confirmados.find((x) => x.uid === uid)!;
                              return (
                                <TouchableOpacity
                                  key={uid}
                                  style={styles.cabecaRow}
                                  onPress={() => {
                                    setSlotsManuais((prev) => {
                                      const next = prev.map((u) => (u === uid ? null : u));
                                      next[pickerSlot] = uid;
                                      return next;
                                    });
                                    setPickerSlot(null);
                                  }}
                                >
                                  <Avatar uri={i.fotoUrl} nome={i.nome} size="sm" />
                                  <Text style={styles.inscritoNome}>
                                    {i.parceiroNome
                                      ? `${i.nome} / ${i.parceiroNome}`
                                      : i.nome}
                                  </Text>
                                </TouchableOpacity>
                              );
                            })}
                          </View>
                        ) : null}
                      </>
                    )}
                  </ScrollView>
                </>
              );
            })()}
            <Button
              label={refazerChave ? 'Refazer agora' : 'Liberar agora'}
              loading={gerando}
              onPress={() => void confirmarGerarChave()}
            />
            <TouchableOpacity
              onPress={() => {
                setModalCabecas(false);
                setRefazerChave(false);
                setPickerSlot(null);
              }}
            >
              <Text style={styles.cancel}>Cancelar</Text>
            </TouchableOpacity>
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
  campeoesBox: { gap: 4, marginTop: 8 },
  campeaoLinha: { color: Colors.textPrimary, fontWeight: '700', fontSize: 15 },
  encerradoBanner: {
    marginTop: 10,
    marginBottom: 4,
    backgroundColor: Colors.accent,
    borderRadius: Radius.card,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  encerradoTxt: {
    color: Colors.textOnAccent,
    fontWeight: '800',
    fontSize: 15,
    textAlign: 'center',
  },
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
  catBlock: { gap: 10, marginTop: 8 },
  catChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  catChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: Colors.surfaceDark,
    borderWidth: 1,
    borderColor: Colors.surface,
  },
  catChipOn: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  catChipTxt: { color: Colors.textPrimary, fontWeight: '700', fontSize: 13 },
  catChipTxtOn: { color: Colors.textOnAccent },
  catEditBlock: { gap: 8, marginBottom: 8 },
  catEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  compRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  compChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: Colors.surfaceDark,
    borderWidth: 1,
    borderColor: Colors.surface,
  },
  compChipOn: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  compChipTxt: { color: Colors.textPrimary, fontWeight: '700', fontSize: 12 },
  compChipTxtOn: { color: Colors.textOnAccent },
  placarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 8,
  },
  placarSide: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  placarSideRight: { justifyContent: 'flex-end' },
  placarNome: { color: Colors.textPrimary, fontWeight: '700', flexShrink: 1, fontSize: 13 },
  placarVs: { color: Colors.accent, fontWeight: '900', fontSize: 18 },
  setBlock: { gap: 4 },
  scoreRowAvatars: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  cabecaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 12,
    marginBottom: 4,
  },
  cabecaRowOn: { backgroundColor: Colors.surface },
  seedBadge: {
    color: Colors.textOnAccent,
    backgroundColor: Colors.accent,
    fontWeight: '900',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: 'hidden',
    fontSize: 12,
  },
  modalSection: {
    color: Colors.textSecondary,
    fontWeight: '800',
    fontSize: 13,
    marginTop: 12,
    marginBottom: 6,
  },
  modoRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
    marginBottom: 4,
  },
  modoChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 60,
    backgroundColor: Colors.surfaceDark,
    borderWidth: 1,
    borderColor: Colors.surface,
  },
  modoChipOn: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  modoChipTxt: {
    color: Colors.textPrimary,
    fontWeight: '800',
    fontSize: 13,
  },
  modoChipTxtOn: { color: Colors.textOnAccent },
  matchMontar: {
    marginBottom: 12,
    gap: 6,
  },
  slotPick: {
    backgroundColor: Colors.surfaceDark,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: Colors.surface,
  },
  slotPickTxt: {
    color: Colors.textPrimary,
    fontWeight: '700',
    fontSize: 14,
  },
  vsTxt: {
    color: Colors.accent,
    fontWeight: '900',
    textAlign: 'center',
    fontSize: 12,
  },
  pickerBox: {
    marginTop: 8,
    marginBottom: 16,
    padding: 10,
    borderRadius: 16,
    backgroundColor: Colors.surfaceDark,
    borderWidth: 1,
    borderColor: Colors.surface,
  },
  catInput: {
    flex: 1,
    minWidth: 0,
    backgroundColor: Colors.surfaceDark,
    borderRadius: 12,
    color: Colors.textPrimary,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontWeight: '600',
    fontSize: 15,
  },
  catIconBtn: {
    padding: 4,
  },
  catAddBtn: {
    backgroundColor: Colors.accent,
    borderRadius: 60,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  catAddTxt: {
    color: Colors.textOnAccent,
    fontWeight: '800',
  },
  modalBg: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalDismiss: {
    flex: 1,
  },
  modalCard: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 16,
    maxHeight: '88%',
    gap: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  modalCloseBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalScroll: {
    gap: 10,
    paddingBottom: 8,
  },
  modalTitle: {
    color: Colors.textPrimary,
    fontWeight: '900',
    fontSize: 18,
    flex: 1,
    paddingRight: 8,
  },
  modalLabel: { color: Colors.textSecondary, fontWeight: '700', marginTop: 6 },
  cancelBtn: {
    alignItems: 'center',
    paddingVertical: 14,
    minHeight: 48,
    justifyContent: 'center',
  },
  agendaRow: {
    marginTop: 8,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
    gap: 8,
  },
  agendaTitulo: {
    color: Colors.accent,
    fontWeight: '800',
    fontSize: 13,
  },
  intervalRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  intervalChip: {
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  intervalChipOn: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  intervalChipTxt: {
    color: Colors.textPrimary,
    fontWeight: '700',
    fontSize: 12,
  },
  intervalChipTxtOn: { color: Colors.textOnAccent },
  switchRowAgenda: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
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

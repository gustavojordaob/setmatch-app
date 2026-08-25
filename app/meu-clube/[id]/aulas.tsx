import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../../utils/firebaseConfig';
import { Colors } from '../../../constants/colors';
import { Button } from '../../../components/ui/Button';
import { useAuth } from '../../../hooks/useAuth';
import { useMeusClubes } from '../../../hooks/useMeusClubes';
import { useMeusPagamentos } from '../../../hooks/usePagamentos';
import { garantirCobrancaMatriculaAluno } from '../../../services/pagamentos';
import { abrirOuCriarConversaClube, enviarMensagem } from '../../../services/mensagens';
import {
  TIPOS_MODALIDADE_AULA,
  listarModalidadesAula,
  type ModalidadeAula,
} from '../../../services/aulas';
import { ESPORTES } from '../../../constants/esportes';
import type { ClubeCompleto } from '../../../services/clubes';
import { abrirWhatsApp } from '../../../utils/whatsapp';
import { pagarComEscolhaDeMeio, resumoPromoCurto, textoCicloPagamento } from '../../../utils/checkoutComMeio';

/** Aluno NÃO se matricula sozinho — manda mensagem; o clube cadastra pelo Rally Up ID. */
export default function MinhasAulasClubeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user, perfil } = useAuth();
  const { matriculas } = useMeusClubes();
  const { pagamentos } = useMeusPagamentos();
  const [clube, setClube] = useState<ClubeCompleto | null>(null);
  const [mods, setMods] = useState<ModalidadeAula[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [paying, setPaying] = useState(false);

  const matricula = useMemo(
    () => matriculas.find((m) => m.clubeId === id),
    [matriculas, id]
  );

  const cobrancaAberta = useMemo(() => {
    if (!id || !user) return null;
    return (
      pagamentos.find(
        (p) =>
          p.clubeId === id &&
          p.tipo === 'aula' &&
          (p.status === 'aguardando_pagamento' ||
            p.status === 'pendente' ||
            p.status === 'atrasado' ||
            p.status === 'recusado')
      ) ?? null
    );
  }, [pagamentos, id, user]);

  // Matrícula antiga sem cobrança: gera pagamento automaticamente
  useEffect(() => {
    if (!user || !perfil || !matricula || !clube) return;
    const valor = Number(matricula.valorFinal ?? 0);
    if (!(valor > 0) || cobrancaAberta) return;
    if (matricula.status === 'inativo') return;
    void garantirCobrancaMatriculaAluno({
      matriculaId: matricula.id,
      clubeId: clube.id,
      clubeNome: clube.nome,
      donoUid: matricula.donoUid || clube.donoUid,
      uid: user.uid,
      setmatchId: perfil.setmatchId || '',
      nome: perfil.nome,
      telefone: perfil.telefone,
      modalidadeNome: matricula.modalidadeNome,
      valor,
    }).catch(() => {
      /* rules antigas / rede — usuário ainda pode pedir no chat */
    });
  }, [user, perfil, matricula, clube, cobrancaAberta]);

  useEffect(() => {
    if (!id) return;
    void (async () => {
      setLoading(true);
      const snap = await getDoc(doc(db, 'clubes', id));
      if (snap.exists()) {
        const raw = snap.data();
        setClube({
          id: snap.id,
          nome: String(raw.nome ?? ''),
          cidade: String(raw.cidade ?? ''),
          bairro: raw.bairro ? String(raw.bairro) : undefined,
          telefone: raw.telefone ? String(raw.telefone) : undefined,
          esportes: (raw.esportes as ClubeCompleto['esportes']) ?? ['tenis'],
          donoUid: String(raw.donoUid ?? ''),
          donoNome: String(raw.donoNome ?? ''),
          regrasGerais: raw.regrasGerais ? String(raw.regrasGerais) : undefined,
          aulas: raw.aulas as ClubeCompleto['aulas'],
        });
      }
      setMods((await listarModalidadesAula(id)).filter((m) => m.ativo));
      setLoading(false);
    })();
  }, [id]);

  function mensagemInteresse(mod?: ModalidadeAula): string {
    const sid = perfil?.setmatchId ? `\nMeu Rally Up ID: *${perfil.setmatchId}*` : '';
    if (mod) {
      return (
        `Olá! Tenho interesse na aula "${mod.nome}" ` +
        `(${TIPOS_MODALIDADE_AULA.find((t) => t.id === mod.tipo)?.label}, ` +
        `R$ ${mod.valorMensal.toFixed(2)}/mês).` +
        `${sid}\nPode me matricular nessa modalidade?`
      );
    }
    return (
      `Olá! Quero saber mais sobre as aulas do clube.` +
      `${sid}\nPodem me orientar e matricular pelo meu ID?`
    );
  }

  async function falarNoApp(mod?: ModalidadeAula) {
    if (!user || !perfil || !clube) return;
    setBusy(true);
    try {
      const conversaId = await abrirOuCriarConversaClube({
        uid: user.uid,
        nome: perfil.nome,
        clubeId: clube.id,
        clubeNome: clube.nome,
        donoUid: clube.donoUid,
      });
      await enviarMensagem({
        conversaId,
        deUid: user.uid,
        deNome: perfil.nome,
        texto: mensagemInteresse(mod).replace(/\*/g, ''),
      });
      router.push(`/chat/${conversaId}`);
    } catch (e: unknown) {
      Alert.alert('Aulas', e instanceof Error ? e.message : 'Não foi possível abrir o chat.');
    } finally {
      setBusy(false);
    }
  }

  async function falarWhats(mod?: ModalidadeAula) {
    if (!clube?.telefone) {
      Alert.alert('WhatsApp', 'Este clube ainda não cadastrou telefone. Use a mensagem no app.');
      return;
    }
    await abrirWhatsApp(clube.telefone, mensagemInteresse(mod));
  }

  if (loading || !clube) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator color={Colors.accent} style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={26} color={Colors.accent} />
        </TouchableOpacity>
        <Text style={styles.title}>Minhas aulas</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.clube}>{clube.nome}</Text>
        <Text style={styles.meta}>
          {[clube.bairro, clube.cidade].filter(Boolean).join(' · ')}
        </Text>

        <View style={styles.hintCard}>
          <Ionicons name="information-circle" size={22} color={Colors.accent} />
          <Text style={styles.hintTxt}>
            Você não se cadastra sozinho. Envie mensagem (app ou WhatsApp) e o clube te coloca na
            aula pelo seu Rally Up ID
            {perfil?.setmatchId ? ` (${perfil.setmatchId})` : ''}.
          </Text>
        </View>

        <View style={styles.statusCard}>
          <Text style={styles.statusLabel}>Sua matrícula</Text>
          {matricula ? (
            <>
              <Text style={styles.statusValue}>Status: {matricula.status}</Text>
              {matricula.modalidadeNome ? (
                <Text style={styles.regras}>
                  {matricula.modalidadeNome}
                  {matricula.valorFinal != null
                    ? ` · R$ ${Number(matricula.valorFinal).toFixed(2)}/mês`
                    : ''}
                </Text>
              ) : null}
            </>
          ) : (
            <Text style={styles.statusValue}>Você ainda não é aluno neste clube.</Text>
          )}
          {clube.aulas?.regras ? (
            <Text style={styles.regras}>{clube.aulas.regras}</Text>
          ) : null}

          {cobrancaAberta ? (
            <View style={styles.payBox}>
              <Text style={styles.payTitle}>
                Mensalidade em aberto · R$ {cobrancaAberta.valor.toFixed(2)}
              </Text>
              <Text style={styles.regras}>
                {cobrancaAberta.aulaTitulo || 'Aulas'} · {cobrancaAberta.status}
                {`\n${textoCicloPagamento('mensal')}`}
                {clube.aulas && resumoPromoCurto({
                  valor: cobrancaAberta.valor,
                  permitePix: clube.aulas.permitePix,
                  permiteCartao: clube.aulas.permiteCartao,
                  descontoPixPercent: clube.aulas.descontoPixPercent,
                  descontoCartaoPercent: clube.aulas.descontoCartaoPercent,
                })
                  ? `\n${resumoPromoCurto({
                      valor: cobrancaAberta.valor,
                      permitePix: clube.aulas.permitePix,
                      permiteCartao: clube.aulas.permiteCartao,
                      descontoPixPercent: clube.aulas.descontoPixPercent,
                      descontoCartaoPercent: clube.aulas.descontoCartaoPercent,
                    })}`
                  : ''}
              </Text>
              <Button
                label={paying ? 'Abrindo…' : 'Pagar mensalidade'}
                loading={paying}
                onPress={() =>
                  void (async () => {
                    setPaying(true);
                    try {
                      await pagarComEscolhaDeMeio({
                        pagamentoId: cobrancaAberta.id,
                        titulo: `Aulas · ${clube.nome}`,
                        ciclo: 'mensal',
                        regras: {
                          valor: cobrancaAberta.valorBase ?? cobrancaAberta.valor,
                          permitePix: clube.aulas?.permitePix ?? true,
                          permiteCartao: clube.aulas?.permiteCartao ?? true,
                          descontoPixPercent: clube.aulas?.descontoPixPercent,
                          descontoCartaoPercent: clube.aulas?.descontoCartaoPercent,
                          ciclo: 'mensal',
                        },
                      });
                    } catch (e: unknown) {
                      Alert.alert(
                        'Pagamento',
                        e instanceof Error ? e.message : 'Falha no checkout'
                      );
                    } finally {
                      setPaying(false);
                    }
                  })()
                }
                style={{ marginTop: 10 }}
              />
            </View>
          ) : null}
        </View>

        <Text style={styles.section}>Modalidades disponíveis</Text>
        {mods.length === 0 ? (
          <Text style={styles.empty}>
            O clube ainda não cadastrou modalidades. Fale com eles para combinar aulas.
          </Text>
        ) : (
          mods.map((m) => (
            <View key={m.id} style={styles.modCard}>
              <Text style={styles.modNome}>{m.nome}</Text>
              <Text style={styles.modMeta}>
                {TIPOS_MODALIDADE_AULA.find((t) => t.id === m.tipo)?.label} ·{' '}
                {ESPORTES.find((e) => e.id === m.esporte)?.emoji}{' '}
                {ESPORTES.find((e) => e.id === m.esporte)?.nome}
              </Text>
              <Text style={styles.preco}>R$ {m.valorMensal.toFixed(2)} / mês</Text>
              {m.descricao ? <Text style={styles.modDesc}>{m.descricao}</Text> : null}
              <Button
                label="Mensagem no app"
                onPress={() => void falarNoApp(m)}
                loading={busy}
                style={{ marginTop: 10 }}
              />
              <Button
                label="WhatsApp do clube"
                variant="outline"
                onPress={() => void falarWhats(m)}
                style={{ marginTop: 8 }}
              />
            </View>
          ))
        )}

        <Button
          label="Falar com o clube (app)"
          variant="outline"
          onPress={() => void falarNoApp()}
          loading={busy}
          style={{ marginTop: 8 }}
        />
        <Button
          label="WhatsApp do clube"
          variant="outline"
          onPress={() => void falarWhats()}
          style={{ marginTop: 10 }}
        />
        <Button
          label="Ver pagamentos de aulas"
          variant="outline"
          onPress={() =>
            router.push({ pathname: '/pagamentos', params: { clubeId: id } })
          }
          style={{ marginTop: 10 }}
        />
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
  },
  title: { color: Colors.textPrimary, fontWeight: 'bold', fontSize: 18 },
  body: { padding: 16, paddingBottom: 40 },
  clube: { color: Colors.textPrimary, fontSize: 22, fontWeight: 'bold' },
  meta: { color: Colors.textSecondary, marginTop: 4, marginBottom: 12 },
  hintCard: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: 'rgba(199,217,65,0.12)',
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
    alignItems: 'flex-start',
  },
  hintTxt: { flex: 1, color: Colors.textPrimary, fontSize: 13, lineHeight: 18 },
  statusCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: Colors.accent,
  },
  statusLabel: { color: Colors.accent, fontWeight: 'bold', fontSize: 12, marginBottom: 4 },
  statusValue: { color: Colors.textPrimary, fontWeight: '600', fontSize: 15 },
  regras: { color: Colors.textSecondary, marginTop: 8, fontSize: 13, lineHeight: 18 },
  payBox: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.2)',
  },
  payTitle: { color: Colors.accent, fontWeight: '900', fontSize: 15 },
  section: { color: Colors.textPrimary, fontWeight: 'bold', fontSize: 16, marginBottom: 12 },
  modCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  modNome: { color: Colors.textPrimary, fontWeight: 'bold', fontSize: 16 },
  modMeta: { color: Colors.textSecondary, fontSize: 13, marginTop: 4 },
  preco: { color: Colors.accent, fontWeight: 'bold', fontSize: 18, marginTop: 8 },
  modDesc: { color: Colors.textSecondary, fontSize: 13, marginTop: 6, lineHeight: 18 },
  empty: { color: Colors.textSecondary, marginBottom: 16, lineHeight: 20 },
});

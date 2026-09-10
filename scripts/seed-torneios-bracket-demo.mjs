/**
 * Seed de 2 torneios demo (chave 4 jogadores):
 * - demoTorneioFinal: semis ok, falta placar da final
 * - demoTorneioSemi: nas semifinais (pronto para placar)
 * Placar só organizador. Usa Application Default Credentials do Firebase CLI.
 */
import { initializeApp, getApps, cert, applicationDefault } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const PROJECT = 'setmatch-app-fabrica';
const CLUBE = {
  id: 'clubeAdminTeste',
  nome: 'Arena Tennis Admin Demo',
  cidade: 'São Paulo',
  donoUid: 'IeyzJM3xiHSOswqQLCSWcIpI7Nr1',
};

const PLAYERS = [
  { uid: 'seedJogA', nome: 'Ana Silva' },
  { uid: 'seedJogB', nome: 'Bruno Costa' },
  { uid: 'seedJogC', nome: 'Carla Mendes' },
  { uid: 'seedJogD', nome: 'Diego Rocha' },
];

const CAT = { id: 'cdemoA', nome: 'Categoria A' };

if (!getApps().length) {
  try {
    initializeApp({ credential: applicationDefault(), projectId: PROJECT });
  } catch {
    initializeApp({ projectId: PROJECT });
  }
}

const db = getFirestore();

function confrontoBase(extra) {
  return {
    torneioId: extra.torneioId,
    categoriaId: CAT.id,
    categoriaNome: CAT.nome,
    sets: [],
    j1ParceiroUid: '',
    j1ParceiroNome: '',
    j1ParceiroFoto: '',
    j2ParceiroUid: '',
    j2ParceiroNome: '',
    j2ParceiroFoto: '',
    j1Foto: '',
    j2Foto: '',
    criadoEm: FieldValue.serverTimestamp(),
    ...extra,
  };
}

async function seedTorneio(id, { nome, modo }) {
  const tRef = db.collection('torneios').doc(id);
  await tRef.set(
    {
      clubeId: CLUBE.id,
      clubeNome: CLUBE.nome,
      cidade: CLUBE.cidade,
      donoUid: CLUBE.donoUid,
      nome,
      esporte: 'tenis',
      composicao: 'simples',
      dataInicio: '20/09/2026',
      dataFim: '21/09/2026',
      descricao:
        modo === 'final'
          ? 'Demo: chave nas semifinais concluídas — falta o placar da final (só organizador).'
          : 'Demo: chave na semifinal — organizador lança os placares.',
      local: CLUBE.nome,
      status: 'em_andamento',
      totalInscritos: 4,
      categorias: [CAT],
      formatoChaves: 'simples',
      definicaoChave: 'sorteio',
      estruturaMata: 4,
      chaveLiberada: true,
      chaveGeradaEm: FieldValue.serverTimestamp(),
      resultadoSoOrganizador: true,
      pagamento: {
        ativo: true,
        valor: 80,
        regras: 'Demo seed',
        prazoPagamento: '',
        permitePix: true,
        permiteCartao: true,
        descontoPixPercent: 0,
        descontoCartaoPercent: 0,
        descontoMultiCategoriaValor: 20,
      },
      criadoEm: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  // inscritos
  for (const p of PLAYERS) {
    await tRef
      .collection('inscritos')
      .doc(`${p.uid}__${CAT.id}`)
      .set({
        uid: p.uid,
        nome: p.nome,
        fotoUrl: '',
        telefone: '',
        categoriaId: CAT.id,
        categoriaNome: CAT.nome,
        status: 'confirmado',
        pago: true,
        contabilizado: true,
        criadoEm: FieldValue.serverTimestamp(),
      });
  }

  // limpa confrontos antigos
  const old = await tRef.collection('confrontos').get();
  const batchDel = db.batch();
  old.docs.forEach((d) => batchDel.delete(d.ref));
  if (!old.empty) await batchDel.commit();

  const [a, b, c, d] = PLAYERS;
  const prefix = `${CAT.id}-`;

  if (modo === 'final') {
    // Semi 1: Ana beat Bruno
    await tRef.collection('confrontos').doc(`${prefix}r1-p0`).set(
      confrontoBase({
        torneioId: id,
        round: 1,
        pos: 0,
        labelRodada: 'Semifinal',
        j1Uid: a.uid,
        j1Nome: a.nome,
        j2Uid: b.uid,
        j2Nome: b.nome,
        status: 'finalizado',
        vencedorUid: a.uid,
        sets: [
          { j1: 6, j2: 3 },
          { j1: 6, j2: 4 },
        ],
        nextConfrontoId: `${prefix}r2-p0`,
        nextSlot: 'j1',
        finalizadoEm: FieldValue.serverTimestamp(),
      })
    );
    // Semi 2: Carla beat Diego
    await tRef.collection('confrontos').doc(`${prefix}r1-p1`).set(
      confrontoBase({
        torneioId: id,
        round: 1,
        pos: 1,
        labelRodada: 'Semifinal',
        j1Uid: c.uid,
        j1Nome: c.nome,
        j2Uid: d.uid,
        j2Nome: d.nome,
        status: 'finalizado',
        vencedorUid: c.uid,
        sets: [
          { j1: 7, j2: 5 },
          { j1: 6, j2: 2 },
        ],
        nextConfrontoId: `${prefix}r2-p0`,
        nextSlot: 'j2',
        finalizadoEm: FieldValue.serverTimestamp(),
      })
    );
    // Final pronta — falta placar
    await tRef.collection('confrontos').doc(`${prefix}r2-p0`).set(
      confrontoBase({
        torneioId: id,
        round: 2,
        pos: 0,
        labelRodada: 'Final',
        j1Uid: a.uid,
        j1Nome: a.nome,
        j2Uid: c.uid,
        j2Nome: c.nome,
        status: 'pronto',
        vencedorUid: '',
        nextConfrontoId: '',
        nextSlot: '',
      })
    );
  } else {
    // Semis prontas
    await tRef.collection('confrontos').doc(`${prefix}r1-p0`).set(
      confrontoBase({
        torneioId: id,
        round: 1,
        pos: 0,
        labelRodada: 'Semifinal',
        j1Uid: a.uid,
        j1Nome: a.nome,
        j2Uid: b.uid,
        j2Nome: b.nome,
        status: 'pronto',
        vencedorUid: '',
        nextConfrontoId: `${prefix}r2-p0`,
        nextSlot: 'j1',
      })
    );
    await tRef.collection('confrontos').doc(`${prefix}r1-p1`).set(
      confrontoBase({
        torneioId: id,
        round: 1,
        pos: 1,
        labelRodada: 'Semifinal',
        j1Uid: c.uid,
        j1Nome: c.nome,
        j2Uid: d.uid,
        j2Nome: d.nome,
        status: 'pronto',
        vencedorUid: '',
        nextConfrontoId: `${prefix}r2-p0`,
        nextSlot: 'j2',
      })
    );
    await tRef.collection('confrontos').doc(`${prefix}r2-p0`).set(
      confrontoBase({
        torneioId: id,
        round: 2,
        pos: 0,
        labelRodada: 'Final',
        j1Uid: '',
        j1Nome: '',
        j2Uid: '',
        j2Nome: '',
        status: 'aguardando',
        vencedorUid: '',
        nextConfrontoId: '',
        nextSlot: '',
      })
    );
  }

  console.log(`OK ${id} (${modo})`);
}

async function main() {
  await seedTorneio('demoTorneioFinal', {
    nome: 'Demo Open — Final',
    modo: 'final',
  });
  await seedTorneio('demoTorneioSemi', {
    nome: 'Demo Open — Semifinal',
    modo: 'semi',
  });
  console.log('Seed concluído.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

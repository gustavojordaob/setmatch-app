/**
 * Seed via Firestore REST + token do firebase-tools (sem ADC).
 */
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import os from 'os';

const PROJECT = 'setmatch-app-fabrica';
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;

const CLUBE = {
  id: 'clubeAdminTeste',
  nome: 'Arena Tennis Admin Demo',
  cidade: 'São Paulo',
  donoUid: 'IeyzJM3xiHSOswqQLCSWcIpI7Nr1',
};
const CAT_A = { id: 'catA', nome: 'Categoria A' };
const CAT_B = { id: 'catB', nome: 'Categoria B' };
const CAT_C = { id: 'catC', nome: 'Categoria C' };

const NAMES = [
  'Ana Silva', 'Bruno Costa', 'Carla Mendes', 'Diego Rocha', 'Elena Prado',
  'Felipe Nunes', 'Gabi Torres', 'Hugo Almeida', 'Iris Campos', 'João Pires',
  'Karen Dias', 'Leo Martins', 'Marina Souza', 'Nico Barbosa', 'Olívia Freitas',
  'Paulo Reis', 'Quinn Andrade', 'Rita Lopes', 'Sérgio Vaz', 'Tati Melo',
  'Ugo Ramos', 'Vera Pinto', 'Will Castro',
];

function players(prefix, n, offset = 0) {
  return Array.from({ length: n }, (_, i) => {
    const idx = offset + i;
    return {
      uid: `${prefix}${String(idx + 1).padStart(2, '0')}`,
      nome: NAMES[idx % NAMES.length] + (idx >= NAMES.length ? ` ${idx}` : ''),
    };
  });
}

function s(v) {
  return { stringValue: String(v ?? '') };
}
function b(v) {
  return { booleanValue: Boolean(v) };
}
function i(v) {
  return { integerValue: String(Math.trunc(Number(v) || 0)) };
}
function tsNow() {
  return { timestampValue: new Date().toISOString() };
}
function arrMaps(items) {
  return {
    arrayValue: {
      values: items.map((it) => ({
        mapValue: {
          fields: Object.fromEntries(
            Object.entries(it).map(([k, v]) => [k, s(v)])
          ),
        },
      })),
    },
  };
}

async function getAccessToken() {
  const cfgPath = join(os.homedir(), '.config', 'configstore', 'firebase-tools.json');
  const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
  const tokens = cfg.tokens || {};
  if (tokens.access_token) return tokens.access_token;
  throw new Error('Sem access_token — rode: npx firebase-tools login');
}

async function commit(writes, token) {
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents:commit`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ writes }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`commit ${res.status}: ${t}`);
  }
}

function docWrite(path, fields) {
  return {
    update: {
      name: `projects/${PROJECT}/databases/(default)/documents/${path}`,
      fields,
    },
  };
}

function emptyConfrontoFields(extra) {
  return {
    sets: { arrayValue: { values: [] } },
    j1ParceiroUid: s(''),
    j1ParceiroNome: s(''),
    j1ParceiroFoto: s(''),
    j2ParceiroUid: s(''),
    j2ParceiroNome: s(''),
    j2ParceiroFoto: s(''),
    j1Foto: s(''),
    j2Foto: s(''),
    criadoEm: tsNow(),
    ...extra,
  };
}

function chaveQuartasWrites(torneioId, cat, plist) {
  const prefix = `${cat.id}-`;
  const [p0, p1, p2, p3, p4, p5, p6, p7] = plist;
  const quartas = [
    [p0, p1, 0, 'j1'],
    [p2, p3, 1, 'j2'],
    [p4, p5, 2, 'j1'],
    [p6, p7, 3, 'j2'],
  ];
  const writes = [];
  for (const [j1, j2, pos, nextSlot] of quartas) {
    const nextPos = Math.floor(pos / 2);
    writes.push(
      docWrite(`torneios/${torneioId}/confrontos/${prefix}r1-p${pos}`, emptyConfrontoFields({
        torneioId: s(torneioId),
        categoriaId: s(cat.id),
        categoriaNome: s(cat.nome),
        round: i(1),
        pos: i(pos),
        labelRodada: s('Quartas'),
        j1Uid: s(j1.uid),
        j1Nome: s(j1.nome),
        j2Uid: s(j2.uid),
        j2Nome: s(j2.nome),
        status: s('pronto'),
        vencedorUid: s(''),
        nextConfrontoId: s(`${prefix}r2-p${nextPos}`),
        nextSlot: s(nextSlot),
      }))
    );
  }
  for (let pos = 0; pos < 2; pos++) {
    writes.push(
      docWrite(`torneios/${torneioId}/confrontos/${prefix}r2-p${pos}`, emptyConfrontoFields({
        torneioId: s(torneioId),
        categoriaId: s(cat.id),
        categoriaNome: s(cat.nome),
        round: i(2),
        pos: i(pos),
        labelRodada: s('Semifinal'),
        j1Uid: s(''),
        j1Nome: s(''),
        j2Uid: s(''),
        j2Nome: s(''),
        status: s('aguardando'),
        vencedorUid: s(''),
        nextConfrontoId: s(`${prefix}r3-p0`),
        nextSlot: s(pos === 0 ? 'j1' : 'j2'),
      }))
    );
  }
  writes.push(
    docWrite(`torneios/${torneioId}/confrontos/${prefix}r3-p0`, emptyConfrontoFields({
      torneioId: s(torneioId),
      categoriaId: s(cat.id),
      categoriaNome: s(cat.nome),
      round: i(3),
      pos: i(0),
      labelRodada: s('Final'),
      j1Uid: s(''),
      j1Nome: s(''),
      j2Uid: s(''),
      j2Nome: s(''),
      status: s('aguardando'),
      vencedorUid: s(''),
      nextConfrontoId: s(''),
      nextSlot: s(''),
    }))
  );
  return writes;
}

async function commitChunks(writes, token) {
  const size = 400;
  for (let i0 = 0; i0 < writes.length; i0 += size) {
    await commit(writes.slice(i0, i0 + size), token);
  }
}

async function listSubdocs(torneioId, sub, token) {
  const url = `${BASE}/torneios/${torneioId}/${sub}?pageSize=300`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) return [];
  const data = await res.json();
  return data.documents || [];
}

async function seedTorneio(token, id, { nome, categorias, packs }) {
  const totalInscritos = packs.reduce((n, p) => n + p.players.length, 0);

  // limpa subcoleções
  for (const sub of ['inscritos', 'confrontos']) {
    const docs = await listSubdocs(id, sub, token);
    const dels = docs.map((d) => ({ delete: d.name }));
    if (dels.length) await commitChunks(dels, token);
  }

  const writes = [];
  writes.push(
    docWrite(`torneios/${id}`, {
      clubeId: s(CLUBE.id),
      clubeNome: s(CLUBE.nome),
      cidade: s(CLUBE.cidade),
      donoUid: s(CLUBE.donoUid),
      nome: s(nome),
      esporte: s('tenis'),
      composicao: s('simples'),
      dataInicio: s('25/09/2026'),
      dataFim: s('28/09/2026'),
      descricao: s(
        'Demo multi-categoria: B (e C) nas quartas. Categoria A com 7 inscritos — falta 1 para testar inscrição.'
      ),
      local: s(CLUBE.nome),
      status: s('em_andamento'),
      totalInscritos: i(totalInscritos),
      categorias: arrMaps(categorias),
      formatoChaves: s('simples'),
      definicaoChave: s('sorteio'),
      estruturaMata: i(8),
      chaveLiberada: b(true),
      chaveGeradaEm: tsNow(),
      inscricoesEncerradas: b(false),
      resultadoSoOrganizador: b(true),
      pagamento: {
        mapValue: {
          fields: {
            ativo: b(false),
            valor: i(0),
            regras: s('Demo seed — inscrição grátis'),
            prazoPagamento: s(''),
            permitePix: b(true),
            permiteCartao: b(true),
            descontoPixPercent: i(0),
            descontoCartaoPercent: i(0),
            descontoMultiCategoriaValor: i(0),
          },
        },
      },
      criadoEm: tsNow(),
    })
  );

  for (const pack of packs) {
    for (const p of pack.players) {
      writes.push(
        docWrite(`usuarios/${p.uid}`, {
          nome: s(p.nome),
          email: s(`${p.uid}@seed.setmatch.local`),
          fotoUrl: s(''),
          onboardingOk: b(true),
          seed: b(true),
          atualizadoEm: tsNow(),
        })
      );
      writes.push(
        docWrite(`torneios/${id}/inscritos/${p.uid}__${pack.cat.id}`, {
          uid: s(p.uid),
          nome: s(p.nome),
          fotoUrl: s(''),
          telefone: s(''),
          categoriaId: s(pack.cat.id),
          categoriaNome: s(pack.cat.nome),
          status: s('confirmado'),
          pago: b(true),
          contabilizado: b(true),
          criadoEm: tsNow(),
        })
      );
    }
    if (pack.withChave) {
      writes.push(...chaveQuartasWrites(id, pack.cat, pack.players));
    }
  }

  await commitChunks(writes, token);
  console.log(`OK ${id} — inscritos=${totalInscritos}`);
}

async function main() {
  const token = await getAccessToken();
  await seedTorneio(token, 'demoTorneioQuartas1', {
    nome: 'Demo Quartas — A+B',
    categorias: [CAT_A, CAT_B],
    packs: [
      { cat: CAT_A, players: players('seedQ1a', 7, 0), withChave: false },
      { cat: CAT_B, players: players('seedQ1b', 8, 7), withChave: true },
    ],
  });
  await seedTorneio(token, 'demoTorneioQuartas2', {
    nome: 'Demo Quartas — A+B+C',
    categorias: [CAT_A, CAT_B, CAT_C],
    packs: [
      { cat: CAT_A, players: players('seedQ2a', 7, 0), withChave: false },
      { cat: CAT_B, players: players('seedQ2b', 8, 7), withChave: true },
      { cat: CAT_C, players: players('seedQ2c', 8, 15), withChave: true },
    ],
  });
  console.log('\nLinks:');
  console.log('https://rallyup.app.br/abrir/torneio?id=demoTorneioQuartas1');
  console.log('https://rallyup.app.br/abrir/torneio?id=demoTorneioQuartas2');
  console.log('Seed concluído.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

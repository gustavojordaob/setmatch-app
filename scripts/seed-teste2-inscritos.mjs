/**
 * Seed inscritos no torneio Teste 2 (9H4pWKb13uiFs08UkZs7).
 */
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import os from 'os';

const PROJECT = 'setmatch-app-fabrica';
const TORNEIO_ID = '9H4pWKb13uiFs08UkZs7';
const CAT_A = { id: 'cmtuwe4yyhlqh', nome: 'Categoria A' };
const CAT_B = { id: 'cmtuwe4yyi0ys', nome: 'B' };

const PLAYERS_A = [
  { uid: 'seedT2a01', nome: 'Ana Teste' },
  { uid: 'seedT2a02', nome: 'Bruno Teste' },
  { uid: 'seedT2a03', nome: 'Carla Teste' },
  { uid: 'seedT2a04', nome: 'Diego Teste' },
];
const PLAYERS_B = [
  { uid: 'seedT2b01', nome: 'Elena Teste' },
  { uid: 'seedT2b02', nome: 'Felipe Teste' },
  { uid: 'seedT2b03', nome: 'Gabi Teste' },
];

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

async function getAccessToken() {
  const cfgPath = join(os.homedir(), '.config', 'configstore', 'firebase-tools.json');
  const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
  if (!cfg.tokens?.access_token) throw new Error('firebase login necessário');
  return cfg.tokens.access_token;
}

async function commit(writes, token) {
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents:commit`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ writes }),
  });
  if (!res.ok) throw new Error(`commit ${res.status}: ${await res.text()}`);
}

function docWrite(path, fields) {
  return {
    update: {
      name: `projects/${PROJECT}/databases/(default)/documents/${path}`,
      fields,
    },
  };
}

async function main() {
  const token = await getAccessToken();
  const writes = [];
  const all = [...PLAYERS_A, ...PLAYERS_B];

  for (const p of all) {
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
  }

  for (const p of PLAYERS_A) {
    writes.push(
      docWrite(`torneios/${TORNEIO_ID}/inscritos/${p.uid}__${CAT_A.id}`, {
        uid: s(p.uid),
        nome: s(p.nome),
        fotoUrl: s(''),
        telefone: s(''),
        categoriaId: s(CAT_A.id),
        categoriaNome: s(CAT_A.nome),
        status: s('confirmado'),
        pago: b(true),
        contabilizado: b(true),
        criadoEm: tsNow(),
      })
    );
  }
  for (const p of PLAYERS_B) {
    writes.push(
      docWrite(`torneios/${TORNEIO_ID}/inscritos/${p.uid}__${CAT_B.id}`, {
        uid: s(p.uid),
        nome: s(p.nome),
        fotoUrl: s(''),
        telefone: s(''),
        categoriaId: s(CAT_B.id),
        categoriaNome: s(CAT_B.nome),
        status: s('confirmado'),
        pago: b(true),
        contabilizado: b(true),
        criadoEm: tsNow(),
      })
    );
  }

  writes.push(
    docWrite(`torneios/${TORNEIO_ID}`, {
      totalInscritos: i(all.length),
      inscricoesEncerradas: b(false),
    })
  );

  // updateMask only total for torneio merge — use update with field paths via commit update
  // Firestore commit update replaces whole doc unless we use updateMask — so fetch+merge
  const getUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/torneios/${TORNEIO_ID}`;
  const cur = await fetch(getUrl, { headers: { Authorization: `Bearer ${token}` } }).then((r) =>
    r.json()
  );
  const fields = { ...(cur.fields || {}), totalInscritos: i(all.length), inscricoesEncerradas: b(false) };
  // remove the last write and do full fields
  writes.pop();
  writes.push({
    update: {
      name: `projects/${PROJECT}/databases/(default)/documents/torneios/${TORNEIO_ID}`,
      fields,
    },
  });

  await commit(writes, token);
  console.log(`OK Teste 2 (${TORNEIO_ID}): ${PLAYERS_A.length} na A + ${PLAYERS_B.length} na B`);
  console.log(`https://rallyup.app.br/abrir/torneio?id=${TORNEIO_ID}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

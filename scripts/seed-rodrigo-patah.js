/**
 * Seed professor Rodrigo Joaquim Patah Batista (Orlando, FL) + aulas online.
 * Uso (na raiz, com firebase login / ADC):
 *   node scripts/seed-rodrigo-patah.js
 */
const admin = require('../functions/node_modules/firebase-admin');

const PROJECT = 'setmatch-app-fabrica';
const EMAIL = 'rodrigo.patah@setmatch.app';
const PASSWORD = 'SetmatchRodrigo2026!';
const NOME = 'Rodrigo Joaquim Patah Batista';

if (!admin.apps.length) {
  admin.initializeApp({ projectId: PROJECT });
}

const db = admin.firestore();
const auth = admin.auth();

async function main() {
  let user;
  try {
    user = await auth.getUserByEmail(EMAIL);
    console.log('Auth já existe:', user.uid);
  } catch {
    user = await auth.createUser({
      email: EMAIL,
      password: PASSWORD,
      displayName: NOME,
      emailVerified: true,
    });
    console.log('Auth criado:', user.uid);
  }

  const uid = user.uid;
  await db
    .collection('usuarios')
    .doc(uid)
    .set(
      {
        nome: NOME,
        email: EMAIL,
        role: 'professor',
        tipoAdmin: 'professor',
        setmatchId: 'SM-RPATAH',
        fotoUrl: '',
        esportes: ['tenis', 'padel'],
        idade: 0,
        genero: '',
        peso: 0,
        altura: 0,
        nivel: 'avancado',
        cidade: 'Orlando',
        bairro: '',
        estado: 'FL',
        cep: '',
        rua: '',
        telefone: '',
        lat: 28.5383,
        lng: -81.3792,
        vitorias: 0,
        derrotas: 0,
        onboardingOk: true,
        criadoEm: admin.firestore.FieldValue.serverTimestamp(),
        ultimoAcesso: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

  const existentes = await db
    .collection('aulasPublicadas')
    .where('donoUid', '==', uid)
    .where('modo', '==', 'online')
    .get();

  if (!existentes.empty) {
    console.log('Aulas online já existem:', existentes.size);
  } else {
    const aulas = [
      {
        titulo: 'Forehand — base e timing',
        modulo: 'Módulo 1',
        ordem: 1,
        descricao: 'Exemplo: 4 passos para transformar o forehand (aula demo pública).',
        videoUrl: 'https://www.youtube.com/watch?v=gHd9MY9Ra5Q',
        pago: false,
        valorOnline: 0,
      },
      {
        titulo: 'Backhand — duas mãos',
        modulo: 'Módulo 1',
        ordem: 2,
        descricao: 'Exemplo: tutorial de backhand para iniciantes (aula demo pública).',
        videoUrl: 'https://www.youtube.com/watch?v=6MsC9dmT7xI',
        pago: false,
        valorOnline: 0,
      },
      {
        titulo: 'Saque — progressões para iniciantes',
        modulo: 'Módulo 1',
        ordem: 3,
        descricao: 'Exemplo: 6 progressões fáceis de saque (aula demo pública).',
        videoUrl: 'https://www.youtube.com/watch?v=iHs_UfrXsMc',
        pago: false,
        valorOnline: 0,
      },
      {
        titulo: 'Voleio — técnica em 5 passos',
        modulo: 'Módulo 2',
        ordem: 4,
        descricao: 'Exemplo pago: master class de voleio.',
        videoUrl: 'https://www.youtube.com/watch?v=Jf8hbFah-o0',
        pago: true,
        valorOnline: 29.9,
      },
    ];

    for (const a of aulas) {
      await db.collection('aulasPublicadas').add({
        origemTipo: 'professor',
        origemId: uid,
        origemNome: 'Rodrigo Patah',
        donoUid: uid,
        modo: 'online',
        esporte: 'tenis',
        titulo: a.titulo,
        descricao: a.descricao,
        bannerUrl: '',
        modulo: a.modulo,
        ordem: a.ordem,
        videoUrl: a.videoUrl,
        pago: Boolean(a.pago),
        valorOnline: Number(a.valorOnline) || 0,
        duracaoMin: 15,
        cidade: 'Orlando',
        local: '',
        valorMensal: 0,
        modalidadeTipo: '',
        ativo: true,
        criadoEm: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
    console.log('Aulas online criadas:', aulas.length);
  }

  console.log('\nLogin professor:');
  console.log('  email:', EMAIL);
  console.log('  senha:', PASSWORD);
  console.log('  uid:', uid);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

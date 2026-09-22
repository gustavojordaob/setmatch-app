"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listarAdminsTemporariosDono = exports.revogarAdminTemporario = exports.concluirAcessoAdminTemporario = exports.listarPerfisAdminTemporario = exports.convidarAdminTemporario = void 0;
const firestore_1 = require("firebase-admin/firestore");
const auth_1 = require("firebase-admin/auth");
const https_1 = require("firebase-functions/v2/https");
const crypto_1 = require("crypto");
const FN_OPTS = { cors: true, region: 'southamerica-east1' };
function db() {
    return (0, firestore_1.getFirestore)();
}
async function requireUid(req) {
    const authHeader = String(req.headers.authorization || '');
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    if (!token)
        throw new Error('UNAUTHORIZED');
    const decoded = await (0, auth_1.getAuth)().verifyIdToken(token);
    return decoded.uid;
}
function codigoCurto(len = 6) {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const bytes = (0, crypto_1.randomBytes)(len);
    let out = '';
    for (let i = 0; i < len; i++)
        out += alphabet[bytes[i] % alphabet.length];
    return out;
}
function normalizeEmail(email) {
    return String(email || '').trim().toLowerCase();
}
/** Dono convida admin temporário (nome + e-mail). Gera código de acesso do clube se faltar. */
exports.convidarAdminTemporario = (0, https_1.onRequest)(FN_OPTS, async (req, res) => {
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Método não permitido' });
        return;
    }
    try {
        const uid = await requireUid(req);
        const { clubeId, nome, email } = req.body || {};
        if (!clubeId || !nome || !email) {
            res.status(400).json({ error: 'clubeId, nome e email são obrigatórios' });
            return;
        }
        const emailNorm = normalizeEmail(String(email));
        if (!emailNorm.includes('@')) {
            res.status(400).json({ error: 'E-mail inválido' });
            return;
        }
        const clubeRef = db().collection('clubes').doc(String(clubeId));
        const clubeSnap = await clubeRef.get();
        if (!clubeSnap.exists || clubeSnap.data()?.donoUid !== uid) {
            res.status(403).json({ error: 'Só o organizador pode convidar' });
            return;
        }
        const clube = clubeSnap.data();
        let codigoAcessoAdmin = String(clube.codigoAcessoAdmin || '');
        if (!codigoAcessoAdmin) {
            codigoAcessoAdmin = codigoCurto(6);
            await clubeRef.update({
                codigoAcessoAdmin,
                atualizadoEm: firestore_1.FieldValue.serverTimestamp(),
            });
        }
        // Evita duplicar convite pendente/ativo para o mesmo e-mail no clube
        const existentes = await db()
            .collection('adminsTemporarios')
            .where('clubeId', '==', String(clubeId))
            .where('email', '==', emailNorm)
            .limit(5)
            .get();
        const ativo = existentes.docs.find((d) => {
            const s = String(d.data().status || '');
            return s === 'pendente_senha' || s === 'ativo';
        });
        if (ativo) {
            res.status(409).json({
                error: 'Já existe convite para este e-mail',
                inviteId: ativo.id,
                codigoAcessoAdmin,
            });
            return;
        }
        const inviteRef = db().collection('adminsTemporarios').doc();
        const codigoPerfil = codigoCurto(6);
        await inviteRef.set({
            clubeId: String(clubeId),
            clubeNome: String(clube.nome || ''),
            donoUid: uid,
            nome: String(nome).trim().slice(0, 80),
            email: emailNorm,
            codigoPerfil,
            codigoAcessoAdmin,
            status: 'pendente_senha',
            uid: null,
            criadoEm: firestore_1.FieldValue.serverTimestamp(),
            atualizadoEm: firestore_1.FieldValue.serverTimestamp(),
        });
        res.json({
            ok: true,
            inviteId: inviteRef.id,
            codigoPerfil,
            codigoAcessoAdmin,
            nome: String(nome).trim(),
            email: emailNorm,
        });
    }
    catch (e) {
        const msg = e instanceof Error ? e.message : 'Erro';
        if (msg === 'UNAUTHORIZED') {
            res.status(401).json({ error: 'Não autenticado' });
            return;
        }
        console.error('convidarAdminTemporario', e);
        res.status(500).json({ error: msg.slice(0, 300) });
    }
});
/** Lista perfis do clube pelo código de acesso (sem login) — tela de perfis. */
exports.listarPerfisAdminTemporario = (0, https_1.onRequest)(FN_OPTS, async (req, res) => {
    if (req.method !== 'POST' && req.method !== 'GET') {
        res.status(405).json({ error: 'Método não permitido' });
        return;
    }
    try {
        const codigo = String(req.method === 'GET' ? req.query.codigo : req.body?.codigo || '')
            .trim()
            .toUpperCase();
        if (codigo.length < 4) {
            res.status(400).json({ error: 'Informe o código do clube' });
            return;
        }
        const clubes = await db()
            .collection('clubes')
            .where('codigoAcessoAdmin', '==', codigo)
            .limit(1)
            .get();
        if (clubes.empty) {
            res.status(404).json({ error: 'Código não encontrado' });
            return;
        }
        const clubeDoc = clubes.docs[0];
        const clube = clubeDoc.data();
        const invites = await db()
            .collection('adminsTemporarios')
            .where('clubeId', '==', clubeDoc.id)
            .limit(40)
            .get();
        const perfis = invites.docs
            .map((d) => {
            const raw = d.data();
            const status = String(raw.status || '');
            if (status === 'revogado')
                return null;
            return {
                id: d.id,
                nome: String(raw.nome || ''),
                emailMascara: mascararEmail(String(raw.email || '')),
                status,
                precisaSenha: status === 'pendente_senha',
            };
        })
            .filter(Boolean);
        res.json({
            clubeId: clubeDoc.id,
            clubeNome: String(clube.nome || ''),
            codigo,
            perfis,
        });
    }
    catch (e) {
        const msg = e instanceof Error ? e.message : 'Erro';
        console.error('listarPerfisAdminTemporario', e);
        res.status(500).json({ error: msg.slice(0, 300) });
    }
});
function mascararEmail(email) {
    const [user, domain] = email.split('@');
    if (!user || !domain)
        return '***';
    const u = user.length <= 2 ? '*' : user[0] + '***' + user[user.length - 1];
    return `${u}@${domain}`;
}
/**
 * Pessoa escolhe o perfil e define a senha (primeiro acesso) ou valida senha (já ativo).
 * Cria Auth + role admin_temporario no primeiro acesso.
 */
exports.concluirAcessoAdminTemporario = (0, https_1.onRequest)(FN_OPTS, async (req, res) => {
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Método não permitido' });
        return;
    }
    try {
        const { inviteId, senha, modo } = req.body || {};
        if (!inviteId || !senha || String(senha).length < 6) {
            res.status(400).json({ error: 'Senha com pelo menos 6 caracteres' });
            return;
        }
        const inviteRef = db().collection('adminsTemporarios').doc(String(inviteId));
        const inviteSnap = await inviteRef.get();
        if (!inviteSnap.exists) {
            res.status(404).json({ error: 'Perfil não encontrado' });
            return;
        }
        const invite = inviteSnap.data();
        const status = String(invite.status || '');
        if (status === 'revogado') {
            res.status(403).json({ error: 'Acesso revogado pelo organizador' });
            return;
        }
        const email = String(invite.email || '');
        const nome = String(invite.nome || 'Admin');
        const clubeId = String(invite.clubeId || '');
        const donoUid = String(invite.donoUid || '');
        const authApi = (0, auth_1.getAuth)();
        if (status === 'pendente_senha' || modo === 'definir_senha') {
            // Cria ou atualiza usuário Auth
            let uid = invite.uid ? String(invite.uid) : '';
            if (!uid) {
                try {
                    const existing = await authApi.getUserByEmail(email);
                    uid = existing.uid;
                    await authApi.updateUser(uid, { password: String(senha), displayName: nome });
                }
                catch {
                    const created = await authApi.createUser({
                        email,
                        password: String(senha),
                        displayName: nome,
                        emailVerified: false,
                    });
                    uid = created.uid;
                }
            }
            else {
                await authApi.updateUser(uid, { password: String(senha), displayName: nome });
            }
            await db()
                .collection('usuarios')
                .doc(uid)
                .set({
                nome,
                email,
                role: 'admin_temporario',
                clubeId,
                organizadorUid: donoUid,
                onboardingOk: true,
                precisaDefinirSenha: false,
                telefone: '',
                fotoUrl: '',
                atualizadoEm: firestore_1.FieldValue.serverTimestamp(),
                criadoEm: firestore_1.FieldValue.serverTimestamp(),
            }, { merge: true });
            await inviteRef.update({
                status: 'ativo',
                uid,
                precisaDefinirSenha: false,
                ativadoEm: firestore_1.FieldValue.serverTimestamp(),
                atualizadoEm: firestore_1.FieldValue.serverTimestamp(),
            });
            // Libera regras do clube
            await db()
                .collection('clubes')
                .doc(clubeId)
                .set({
                adminsTemporariosUids: firestore_1.FieldValue.arrayUnion(uid),
                atualizadoEm: firestore_1.FieldValue.serverTimestamp(),
            }, { merge: true });
            res.json({ ok: true, email, uid, status: 'ativo', primeiroAcesso: true });
            return;
        }
        if (status === 'ativo') {
            // Só confirma que o perfil existe — login é no cliente com e-mail/senha
            const uid = String(invite.uid || '');
            if (!uid) {
                res.status(400).json({ error: 'Perfil incompleto — defina a senha novamente' });
                return;
            }
            res.json({ ok: true, email, uid, status: 'ativo', primeiroAcesso: false });
            return;
        }
        res.status(400).json({ error: `Status inválido: ${status}` });
    }
    catch (e) {
        const msg = e instanceof Error ? e.message : 'Erro';
        console.error('concluirAcessoAdminTemporario', e);
        res.status(500).json({ error: msg.slice(0, 300) });
    }
});
/** Organizador revoga acesso. */
exports.revogarAdminTemporario = (0, https_1.onRequest)(FN_OPTS, async (req, res) => {
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Método não permitido' });
        return;
    }
    try {
        const uid = await requireUid(req);
        const { inviteId } = req.body || {};
        if (!inviteId) {
            res.status(400).json({ error: 'inviteId obrigatório' });
            return;
        }
        const ref = db().collection('adminsTemporarios').doc(String(inviteId));
        const snap = await ref.get();
        if (!snap.exists || snap.data()?.donoUid !== uid) {
            res.status(403).json({ error: 'Sem permissão' });
            return;
        }
        const data = snap.data();
        const tempUid = data.uid ? String(data.uid) : '';
        await ref.update({
            status: 'revogado',
            revogadoEm: firestore_1.FieldValue.serverTimestamp(),
            atualizadoEm: firestore_1.FieldValue.serverTimestamp(),
        });
        if (tempUid) {
            await db()
                .collection('clubes')
                .doc(String(data.clubeId))
                .set({
                adminsTemporariosUids: firestore_1.FieldValue.arrayRemove(tempUid),
                atualizadoEm: firestore_1.FieldValue.serverTimestamp(),
            }, { merge: true });
            await db()
                .collection('usuarios')
                .doc(tempUid)
                .set({
                role: 'jogador',
                clubeId: firestore_1.FieldValue.delete(),
                organizadorUid: firestore_1.FieldValue.delete(),
                atualizadoEm: firestore_1.FieldValue.serverTimestamp(),
            }, { merge: true });
        }
        res.json({ ok: true });
    }
    catch (e) {
        const msg = e instanceof Error ? e.message : 'Erro';
        if (msg === 'UNAUTHORIZED') {
            res.status(401).json({ error: 'Não autenticado' });
            return;
        }
        res.status(500).json({ error: msg });
    }
});
/** Lista convites do clube (organizador autenticado). */
exports.listarAdminsTemporariosDono = (0, https_1.onRequest)(FN_OPTS, async (req, res) => {
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Método não permitido' });
        return;
    }
    try {
        const uid = await requireUid(req);
        const { clubeId } = req.body || {};
        if (!clubeId) {
            res.status(400).json({ error: 'clubeId obrigatório' });
            return;
        }
        const clubeSnap = await db().collection('clubes').doc(String(clubeId)).get();
        if (!clubeSnap.exists || clubeSnap.data()?.donoUid !== uid) {
            res.status(403).json({ error: 'Sem permissão' });
            return;
        }
        const snap = await db()
            .collection('adminsTemporarios')
            .where('clubeId', '==', String(clubeId))
            .limit(50)
            .get();
        const list = snap.docs.map((d) => {
            const raw = d.data();
            return {
                id: d.id,
                nome: String(raw.nome || ''),
                email: String(raw.email || ''),
                status: String(raw.status || ''),
                codigoPerfil: String(raw.codigoPerfil || ''),
            };
        });
        res.json({
            codigoAcessoAdmin: String(clubeSnap.data()?.codigoAcessoAdmin || ''),
            admins: list,
        });
    }
    catch (e) {
        const msg = e instanceof Error ? e.message : 'Erro';
        if (msg === 'UNAUTHORIZED') {
            res.status(401).json({ error: 'Não autenticado' });
            return;
        }
        res.status(500).json({ error: msg });
    }
});
//# sourceMappingURL=adminsTemporariosHandlers.js.map
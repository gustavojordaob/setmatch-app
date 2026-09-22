import { auth } from './firebaseConfig';

const REGION = 'southamerica-east1';
const PROJECT = 'setmatch-app-fabrica';
const FN = (name: string) =>
  `https://${REGION}-${PROJECT}.cloudfunctions.net/${name}`;

async function authHeaders(): Promise<Record<string, string>> {
  const user = auth.currentUser;
  if (!user) throw new Error('Usuário não autenticado');
  const token = await user.getIdToken();
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

export type PerfilAdminTemp = {
  id: string;
  nome: string;
  emailMascara: string;
  status: string;
  precisaSenha: boolean;
};

export async function convidarAdminTemporario(input: {
  clubeId: string;
  nome: string;
  email: string;
}): Promise<{ inviteId: string; codigoAcessoAdmin: string }> {
  const headers = await authHeaders();
  const resp = await fetch(FN('convidarAdminTemporario'), {
    method: 'POST',
    headers,
    body: JSON.stringify(input),
  });
  const body = (await resp.json().catch(() => ({}))) as {
    error?: string;
    inviteId?: string;
    codigoAcessoAdmin?: string;
  };
  if (!resp.ok) throw new Error(body.error || 'Falha ao convidar');
  return {
    inviteId: String(body.inviteId || ''),
    codigoAcessoAdmin: String(body.codigoAcessoAdmin || ''),
  };
}

export async function listarAdminsTemporariosDono(clubeId: string): Promise<{
  codigoAcessoAdmin: string;
  admins: { id: string; nome: string; email: string; status: string }[];
}> {
  const headers = await authHeaders();
  const resp = await fetch(FN('listarAdminsTemporariosDono'), {
    method: 'POST',
    headers,
    body: JSON.stringify({ clubeId }),
  });
  const body = await resp.json();
  if (!resp.ok) throw new Error(body.error || 'Falha ao listar');
  return body;
}

export async function revogarAdminTemporario(inviteId: string): Promise<void> {
  const headers = await authHeaders();
  const resp = await fetch(FN('revogarAdminTemporario'), {
    method: 'POST',
    headers,
    body: JSON.stringify({ inviteId }),
  });
  if (!resp.ok) {
    const body = await resp.json().catch(() => ({}));
    throw new Error(body.error || 'Falha ao revogar');
  }
}

/** Sem login — código do clube. */
export async function listarPerfisPorCodigo(codigo: string): Promise<{
  clubeId: string;
  clubeNome: string;
  codigo: string;
  perfis: PerfilAdminTemp[];
}> {
  const resp = await fetch(FN('listarPerfisAdminTemporario'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ codigo: codigo.trim().toUpperCase() }),
  });
  const body = await resp.json();
  if (!resp.ok) throw new Error(body.error || 'Código inválido');
  return body;
}

export async function concluirAcessoAdminTemporario(input: {
  inviteId: string;
  senha: string;
  modo?: 'definir_senha' | 'entrar';
}): Promise<{ email: string; primeiroAcesso: boolean }> {
  const resp = await fetch(FN('concluirAcessoAdminTemporario'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const body = await resp.json();
  if (!resp.ok) throw new Error(body.error || 'Falha ao concluir acesso');
  return {
    email: String(body.email || ''),
    primeiroAcesso: Boolean(body.primeiroAcesso),
  };
}

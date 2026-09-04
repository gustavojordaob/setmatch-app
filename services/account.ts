import { auth } from '../utils/firebaseConfig';
import { getExcluirContaUrl } from '../utils/config';

export async function deleteMyAccount(): Promise<{ ok: boolean; error?: string }> {
  const user = auth.currentUser;
  if (!user) return { ok: false, error: 'Sessão expirada. Entre novamente.' };

  const idToken = await user.getIdToken();
  const resp = await fetch(getExcluirContaUrl(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({}),
  });

  const raw = await resp.text();
  let data: { ok?: boolean; error?: string } = {};
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    data = { error: raw.slice(0, 200) };
  }

  if (!resp.ok || !data.ok) {
    return { ok: false, error: data.error || 'Não foi possível excluir a conta.' };
  }

  return { ok: true };
}

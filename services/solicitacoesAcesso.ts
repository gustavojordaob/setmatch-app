import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../utils/firebaseConfig';
import { parseTelefoneSalvo, telefoneSalvoValido } from '../utils/telefoneInternacional';

export type TipoSolicitacaoAcesso = 'professor' | 'admin_clube';

export async function criarSolicitacaoAcesso(input: {
  tipo: TipoSolicitacaoAcesso;
  nome: string;
  email: string;
  telefone: string;
  cidade?: string;
  esporte?: string;
  mensagem?: string;
  uid?: string | null;
}): Promise<string> {
  const telefone = input.telefone.replace(/\D/g, '');
  if (!telefoneSalvoValido(telefone)) {
    throw new Error('Informe o celular com código do país e DDD válidos.');
  }
  const { ddi } = parseTelefoneSalvo(telefone);
  const ref = await addDoc(collection(db, 'solicitacoesAcesso'), {
    tipo: input.tipo,
    nome: input.nome.trim(),
    email: input.email.trim().toLowerCase(),
    telefone,
    telefoneDdi: ddi,
    cidade: input.cidade?.trim() ?? '',
    esporte: input.esporte?.trim() ?? '',
    mensagem: input.mensagem?.trim() ?? '',
    uid: input.uid ?? null,
    status: 'pendente',
    criadoEm: serverTimestamp(),
  });
  return ref.id;
}

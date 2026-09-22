/** Endereço do local do torneio (visível ao jogador). */

export type EnderecoTorneioFields = {
  /** Nome do local / clube (visível) */
  local?: string;
  cep?: string;
  endereco?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
};

/** Linha única para listas / meta. */
export function resumoLocalTorneio(t: EnderecoTorneioFields): string {
  const partes: string[] = [];
  if (t.local?.trim()) partes.push(t.local.trim());
  const cidadeUf = [t.cidade?.trim(), t.estado?.trim()].filter(Boolean).join('/');
  if (cidadeUf) partes.push(cidadeUf);
  else if (t.bairro?.trim()) partes.push(t.bairro.trim());
  return partes.join(' · ');
}

/** Endereço completo (várias linhas / texto). */
export function enderecoCompletoTorneio(t: EnderecoTorneioFields): string {
  const linhas: string[] = [];
  if (t.local?.trim()) linhas.push(t.local.trim());
  const ruaBairro = [t.endereco?.trim(), t.bairro?.trim()].filter(Boolean).join(' — ');
  if (ruaBairro) linhas.push(ruaBairro);
  const cidadeUfCep = [
    [t.cidade?.trim(), t.estado?.trim()].filter(Boolean).join(' / '),
    t.cep?.trim(),
  ]
    .filter(Boolean)
    .join(' · ');
  if (cidadeUfCep) linhas.push(cidadeUfCep);
  return linhas.join('\n');
}

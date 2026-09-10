# DNS — rallyup.app.br → Firebase Hosting

Domínio real no Registro.br: **rallyup.app.br** (não .com.br)

## Erro "Nome do record inválido - @"

No Registro.br, o campo **NOME** da raiz deve ficar **vazio** (não use `@` nem `@.rallyup.app.br`).

| Errado | Certo |
|--------|--------|
| `@` | *(deixar em branco)* |
| `@.rallyup.app.br` | *(deixar em branco)* |
| `www.rallyup.app.br` | `www` |
| `_acme-challenge.rallyup.app.br` | `_acme-challenge` |
| `_acme-challenge.www.rallyup.app.br` | `_acme-challenge.www` |

## Registros para salvar

| TIPO | NOME | DADOS |
|------|------|--------|
| A | *(vazio)* | `199.36.158.100` |
| TXT | *(vazio)* | `hosting-site=setmatch-app-fabrica` |
| CNAME | `www` | `setmatch-app-fabrica.web.app.` |

Se o Firebase pedir depois (SSL), adicione também:

| TIPO | NOME | DADOS |
|------|------|--------|
| TXT | `_acme-challenge` | *(valor que aparecer no Firebase)* |
| TXT | `_acme-challenge.www` | *(valor que aparecer no Firebase)* |

## Remover
- Linha A vazia
- Qualquer NOME com `@` ou com o domínio completo colado no final
- TXT de verificação do `.com.br` antigo, se não for o domínio certo

## URLs finais
- https://rallyup.app.br
- https://www.rallyup.app.br

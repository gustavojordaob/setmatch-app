# PROJECT.md — setmatch-app

## 1. Visao geral
- **Nome:** setmatch-app
- **Descricao:** App de tênis, padel, raquetinha e beachtênis — desafie jogadores e acompanhe seus resultados
- **Publico-alvo:** Jogadores amadores de raquete em Santa Bárbara e região
- **Stack:** React Native + Expo Router + Firebase + twrnc

## 2. Paleta de cores
```typescript
const COLORS = {
  primary:    '#1B4332',
  background: '#0F2D1F',
  surface:    '#1F3D2B',
  border:     '#333333',
  text:       '#FFFFFF',
  textMuted:  '#9e9e9e',
};
```

## 3. Telas
| # | Tela | Descrição |
|---|------|-----------|
| 1 | Splash | Logo Setmatch, fundo verde escuro |
| 2 | Onboarding | 4 esportes (tênis, padel, raquetinha, beachtênis) |
| 3 | Login/Cadastro | Google + Email/senha |
| 4 | Home | Avatar, record, toggle Resultados/Próximas, lista partidas |
| 5 | Jogador | VS, probabilidade, desafiar |
| 6 | Desafios | Criar, aceitar/recusar |
| 7 | Partida | Registrar placar por sets |
| 8 | Perfil | Stats e histórico |

## 4. Schema Firestore
```
usuarios/{uid}: nome, fotoUrl, esportes[], vitorias, derrotas, criadoEm, ultimoAcesso
desafios/{id}: desafiante, desafiado, esporte, quadra, status, criadoEm, atualizadoEm
partidas/{id}: desafioId, jogador1, jogador2, sets[], vencedor, esporte, quadra, dataPartida, criadoEm
```

## 5. Regras de negocio
Desafio pendente → aceito/recusado; após partida registrar resultado, atualizar vitórias/derrotas, desafio finalizado.

## 6. Integracoes
Firebase Auth (Google + email/senha), Firestore, Storage, Expo Router, Google Sign-In

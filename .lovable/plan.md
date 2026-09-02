## Objetivo
Criar um sistema unificado de cards de compartilhamento (Stories 1080×1920) gerados a partir de dados reais do usuário, com prévia, personalização e download/share nativo — sem publicação automática.

## Escopo desta entrega (5 modelos prioritários)
1. Check-in concluído
2. Sequência de consistência
3. Nível magnético
4. Resultado gerado
5. Evolução semanal

Modelos 6–12 ficam como estrutura extensível para próximas iterações.

## Arquitetura

### 1. Núcleo de renderização
Novo arquivo `src/lib/share-cards/renderer.ts`:
- Função `drawCard(canvas, template, data, options)` que despacha para renderers por template.
- Cada template = função pura `(ctx, data, opts) => void` recebendo canvas 1080×1920.
- Helpers comuns: `drawLogo`, `drawHalo`, `drawFooter`, `drawBadge`, tipografia SF/system sans, paleta iMAG (ink `#0A0A0A`, azul `#1E3A8A`, muted `#6B6B70`, hairline `#EDECE8`).
- Reaproveita a linguagem visual já refinada de `ShareEvolutionModal.tsx` (halo sutil, badge cinza-claro com check azul, "Menos ruído. Mais direção.", rodapé `imag.net.br`).

### 2. Tipos e dados
`src/lib/share-cards/types.ts`:
```ts
type ShareTemplateId = "checkin" | "streak" | "level" | "result" | "week";
type ShareOptions = { background: "white" | "blue"; showNumbers: boolean; onlyPhrase: boolean; hideMetaText: boolean };
type ShareData = { level: {name,rings}, streak, missionsTotal, missionsWeek, actionsWeek, opportunitiesWeek, metaText, resultKind, dateISO, userFirstName };
```

### 3. Componente unificado `ShareCardModal`
Substitui/estende `ShareEvolutionModal.tsx`:
- Props: `open`, `onClose`, `initialTemplate`, `data`.
- Header: seletor horizontal de 5 templates (chips minimalistas).
- Corpo: prévia canvas com aspecto 9:16 responsivo.
- Painel de opções (colapsável, abaixo da prévia):
  - Toggle "Mostrar números" (impacta streak/missions/opportunities)
  - Toggle "Somente frase" (esconde números e substitui por frase-chave do template)
  - Toggle "Ocultar texto da meta" (apenas template Check-in / Direção)
  - Escolha de fundo: branco / azul (azul = `#1E3A8A` com tipografia branca)
- Ações: **Compartilhar** (Web Share API com file), **Baixar imagem**. Sempre requer clique — nunca publica sozinho.
- Redesenho reaproveita a estética já aprovada do modal atual.

### 4. Triggers automáticos
Novo hook `src/lib/share-cards/useShareTriggers.ts`:
- Escuta mudanças em check-in, streak, nível, resultado semanal.
- Decide qual template abrir quando o usuário completa uma conquista.
- Nunca abre modal automaticamente — apenas expõe estado `pendingShare` que a UI usa para renderizar o botão **Compartilhar evolução**.

Botão **Compartilhar evolução** aparece em:
- `src/components/PaidHome.tsx` — após check-in (template = `checkin` ou `result` conforme o outcome).
- `src/routes/_authenticated/campo-magnetico.tsx` — no card de nível e no card "Você fortaleceu seu campo hoje" (templates `level`, `streak`, `week`).
- `src/routes/_authenticated/evolucao.tsx` — botão global de compartilhar (todos templates).
- Marco automático: quando streak atinge 7/15/30/60/90 → destaque visual + CTA.

### 5. Fonte de dados
- `streak`, `missionsWeek`, `actionsWeek`, `opportunitiesWeek`: derivar de `listRecentReflections()` já existente.
- `level`: reutilizar `LEVELS` de `evolucao.tsx` (extrair para `src/lib/mag-level.ts`).
- `metaText`: da meta ativa do dia (já presente em `PaidHome`).
- `userFirstName`: profile.
- **Regra**: se um valor não existir, o toggle correspondente é desabilitado e o template usa fallback textual — nunca inventa números.

### 6. Privacidade
- Toggle "Ocultar texto da meta" substitui texto por frase genérica ("Uma direção clara para hoje").
- Modelo "Resultado gerado" tem modo sem números (frase apenas) para dados sensíveis.

## Arquivos

**Criar**
- `src/lib/share-cards/types.ts`
- `src/lib/share-cards/renderer.ts` (helpers + 5 templates)
- `src/lib/share-cards/useShareTriggers.ts`
- `src/lib/mag-level.ts` (extração de LEVELS)
- `src/components/ShareCardModal.tsx`

**Editar**
- `src/components/PaidHome.tsx` — trocar botão pós-check-in por "Compartilhar evolução" abrindo `ShareCardModal` com template certo.
- `src/routes/_authenticated/campo-magnetico.tsx` — botões contextuais.
- `src/routes/_authenticated/evolucao.tsx` — importar de `mag-level.ts`, adicionar botão global.
- `src/components/ShareEvolutionModal.tsx` — manter como wrapper fino sobre `ShareCardModal` para não quebrar imports, ou remover e substituir usos.

## Visual (todos templates)
- 9:16, 1080×1920.
- Fundo branco `#FFFFFF` (ou `#1E3A8A` no modo azul, tipografia branca).
- Logo iMAG topo, tintado azul (ou branco no fundo azul), pequeno.
- Halo magnético radial sutil atrás do elemento hero.
- Tipografia sans do sistema, pesos 500/600.
- Badge cinza `#F5F6F8` com check azul para métricas.
- Frase-marca inferior + `imag.net.br`.
- Nunca serifas, nunca emojis grandes, nunca ornamentos.

## Regras não-negociáveis
- Zero publicação automática — sempre confirmação por clique.
- Zero inventar dados — usar apenas o que existe em `reflections`, `profile`, `progress`.
- Marca iMAG discreta.
- Design segue estética Apple já estabelecida.

## Fora de escopo (próxima iteração)
- Templates 6–12 (conversa iniciada, antes/depois, frase, curiosidade, privacidade agregada, marco 30d dedicado).
- Deep-link para stories específicos de Instagram/TikTok além do Web Share API.
- Analytics de conversão dos cards.

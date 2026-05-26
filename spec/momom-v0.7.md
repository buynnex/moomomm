# MOMOM v0.7

## Objetivo

Evoluir o Language Server da linguagem Momom com inteligencia contextual mais forte para completion, hover, go to definition, find references, rename inicial e document symbols melhorados, sem quebrar a compatibilidade das versoes v0.1 ate v0.6.

## Contexto de cursor

- `packages/language-server/src/context.ts` adiciona um analisador heuristico de contexto por linha.
- O contexto identifica cenarios como `input-type`, `node-type`, `edge-target-port`, `branch-source` e `output-reference-property`.
- O analisador tolera arquivos parcialmente invalidos e evita crash do servidor.

## Completion contextual

- Sugestoes top-level para `input`, `node`, `edge`, `branch` e `output`
- Tipos de input com `string`, `number`, `boolean`, `unknown`, `any`, `User`, `Token`, `Product`, `Product[]`
- Node types conhecidos com documentacao curta
- Propriedades por node type
- Valores guiados para `risk`, `deterministic` e `template`
- Referencias contextuais para edge sources, edge targets, edge target ports, branch sources e output references

## Hover

- Inputs com snippet `input name: string`
- Node ids com tipo, `deterministic`, `risk`, inputs conectados e outputs
- Node types com contrato do node
- Referencias como `greeting.text` com tipo resolvido
- Edges com tipo de source, target node, target port, accepted types e `inferred`
- Branch source com tipo resolvido e aviso booleano
- `risk` e `deterministic` com explicacoes enriquecidas

## Definition

- F12 em inputs usados em edges ou referencias simples
- F12 em node ids usados em edges, outputs e branches
- Implementacao baseada em ranges simples derivados de `loc`

## References

- Shift+F12 para inputs, node ids e referencias `node.output`
- Busca declaracao, edges, templates, outputs e branches quando aplicavel
- Implementacao semantica simples, sem indexador global

## Rename

- `prepareRename` para inputs e node ids
- Bloqueio para keywords, node types e properties
- Validacao do novo nome com `^[A-Za-z_][A-Za-z0-9_]*$`
- `WorkspaceEdit` simples no documento atual para declaracoes e referencias principais

## Symbols

- Outline agrupado por `Inputs`, `Nodes`, `Branches`, `Edges` e `Outputs`
- Nodes mostram outputs conhecidos como filhos

## Diagnostics

- Debounce simples de 250ms em `onDidChangeContent`
- Open e save continuam validando imediatamente
- O servidor segue reutilizando `@momom/core` como fonte unica de verdade

## Limites da v0.7

- Sem IA
- Sem OpenClaw
- Sem Qwen
- Sem Marketplace
- Sem runtime completo de branch
- Sem Mermaid SVG avancado
- Sem document links internos dedicados nesta iteracao
- Rename ainda opera apenas no documento atual
- Completion contextual ainda e heuristico

## Proximos passos

- v0.8: snippets e quick fixes
- v0.9: editor visual Mermaid/SVG real
- v1.0: `momom-ai-adapter`
- Integracao futura com Qwen e OpenClaw como camadas opcionais

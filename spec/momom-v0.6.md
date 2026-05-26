# MOMOM v0.6

## Objetivo

Adicionar um Language Server basico para a linguagem Momom e fazer a extensao VS Code usar esse servidor para diagnostics, hover, completion e document symbols, sem quebrar a compatibilidade das versoes v0.1 ate v0.5.

## Arquitetura LSP

- `packages/language-server/src/server.ts` inicializa o servidor LSP com sync incremental.
- `packages/language-server/src/documents.ts` gerencia documentos abertos e eventos de open, change, save e close.
- `packages/language-server/src/diagnostics.ts` reutiliza `@momom/core` para parse, validate, typecheck e flowcheck.
- `packages/language-server/src/completion.ts` entrega autocomplete basico com heuristicas contextuais leves.
- `packages/language-server/src/hover.ts` entrega hover em Markdown para tokens conhecidos.
- `packages/language-server/src/symbols.ts` gera `DocumentSymbol` para Outline.
- `packages/vscode-extension/src/extension.ts` sobe o cliente LSP com `vscode-languageclient`.

## Capabilities

- `textDocumentSync` incremental com open/close/save
- `completionProvider` com gatilhos `:`, `.` e espaco
- `hoverProvider`
- `documentSymbolProvider`

## Diagnostics

- Arquivos `.momom` sao revalidados ao abrir, alterar e salvar.
- O servidor usa `@momom/core` como fonte unica de verdade para parser, validator, typechecker e flowchecker.
- Diagnostics Momom sao convertidos para diagnostics LSP com `source: "momom"`.
- Falhas de parser viram `MOMOM001` controlado e nao derrubam o servidor.
- A extensao evita diagnostics automaticos duplicados deixando o LSP como fonte principal.

## Completion

- Keywords: `graph`, `input`, `node`, `edge`, `branch`, `output`, `true`, `false`
- Tipos nativos: `string`, `number`, `boolean`, `unknown`, `any`, `void`
- Nodes conhecidos: `Text.Template`, `Auth.VerifyToken`, `ML.RecommendProducts`, `Action.TriggerAnomaly`
- Risk values: `low`, `medium`, `high`, `critical`
- Propriedades comuns: `intent`, `risk`, `deterministic`, `template`, `topK`
- Sugestoes contextuais quando possivel para portas de nodes, outputs conhecidos e branches booleanos

## Hover

- Keywords basicas da linguagem
- Node types conhecidos
- Node ids conhecidos
- Inputs conhecidos
- Outputs conhecidos em referencias como `verify.valid`
- Valores de `risk`
- Propriedade `deterministic`

## Document Symbols

- Graph no topo do arquivo
- Inputs como variables
- Nodes como objects
- Branches como events
- Outputs como properties

## Limites da v0.6

- Sem IA
- Sem OpenClaw
- Sem Qwen
- Sem runtime completo de branch
- Sem semantic tokens
- Sem renderizacao Mermaid SVG avancada
- Sem publicacao no Marketplace
- Autocomplete ainda e heuristico, nao um analisador contextual completo

## Proximos passos

- v0.7: autocomplete contextual mais forte
- v0.8: renderizacao grafica real do Mermaid
- v0.9: `momom-ai-adapter`
- Integracao futura com Qwen e OpenClaw como camadas opcionais

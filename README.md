# MOMOM

MOMOM e uma linguagem declarativa baseada em grafo semantico. Programas sao descritos como grafos com `inputs`, `nodes`, `edges`, `branches` e `outputs`, com parser, validator, type checker, flow checker, compiler deterministicos e suporte de Language Server local no VS Code.

## O que e Momom

- Uma linguagem para modelar fluxos como grafos semanticos.
- Um nucleo deterministico, sem dependencia de IA em runtime.
- Uma base preparada para humanos, compiladores e futuras ferramentas de IA.

## O que Momom nao e

- Nao e um runtime de IA.
- Nao e um executor autonomo de comandos externos.
- Nao e uma DSL probabilistica no nucleo.

## Garantias atuais

- `momom-core` e deterministico.
- Parser, validator, type checker, flow checker e compiler funcionam sem IA.
- IA continuara como camada opcional futura.

## Instalar

```bash
npm install
npm run build
npm test
npm run build:language-server
npm run build:vscode
```

## Rodar testes

```bash
npm test
```

## CLI

Depois do build:

```bash
npm run momom -- parse examples/hello.momom
npm run momom -- parse examples/hello.momom --format ast
npm run momom -- parse examples/hello.momom --format ir
npm run momom -- validate examples/hello.momom
npm run momom -- compile examples/hello.momom --target typescript
npm run momom -- compile examples/hello.momom --target typescript --out generated/hello.ts
npm run momom -- graph examples/auth_recommend.momom --format mermaid
npm run momom -- inspect examples/auth_recommend.momom --format flow
```

## O que a v0.5 adiciona

- Extensao experimental do VS Code em `packages/vscode-extension`.
- Reconhecimento de arquivos `.momom`.
- Syntax highlighting basico e configuracao de linguagem.
- Diagnostics no editor usando `momom-core` diretamente.
- Comandos para validate, show IR, show flow, preview graph e compile current file.
- Preview offline sem CDN.

## Momom v0.6 Language Server

O MOMOM v0.6 adicionou o primeiro Language Server basico em `packages/language-server` e passou a usar esse servidor na extensao VS Code para recursos de edicao em tempo real.

## Momom v0.7 LSP Context Intelligence

O MOMOM v0.7 fortalece o Language Server com leitura de contexto por cursor e navegacao basica dentro do arquivo.

Recursos da v0.7:

- completion contextual para top-level, input type, node type, propriedades, references e ports
- hover enriquecido para contratos, edges, branch sources, referencias e node ids
- go to definition basico para inputs e node ids
- find references basico para inputs, nodes e `node.output`
- rename inicial para inputs e node ids
- document symbols agrupados por `Inputs`, `Nodes`, `Branches`, `Edges` e `Outputs`
- diagnostics com debounce para evitar revalidacao agressiva ao digitar
- comandos da v0.5 continuam funcionando

Builds principais:

```bash
npm run build
npm test
npm run build:language-server
npm run build:vscode
```

## Referencias e edges

Referencias semanticas:

- `name`
- `greeting.text`
- `verify.valid`
- `recommend.items`

Edges continuam aceitando a forma antiga:

```momom
edge token -> verify
edge products -> recommend
edge name -> greeting
```

Agora tambem aceitam portas explicitas:

```momom
edge token -> verify.token
edge products -> recommend.products
edge customerName -> message.customerName
edge greeting.text -> otherNode.message
```

Em grafos maiores, portas explicitas sao a forma preferida.

## Nodes conhecidos

- `Text.Template`
  - outputs conhecidos: `text: string`
  - portas dinamicas derivadas de `{variaveis}` no template
- `Auth.VerifyToken`
  - espera `token`
  - output conhecido: `valid: boolean`
- `ML.RecommendProducts`
  - espera `products`
  - output conhecido: `items: Product[]`
- `Action.TriggerAnomaly`
  - output conhecido: `triggered: boolean`

Nodes desconhecidos nao quebram a estrutura do grafo por si so, mas geram warning `MOMOM018`.

## Validacao e flow checker

O comando `validate` roda:

1. validacoes estruturais
2. type checker semantico
3. flow checker

Se houver warnings apenas, a CLI responde com `Validation succeeded with warnings.`. Se houver erros, a validacao falha.

## VS Code Extension Experimental

Build da extensao:

```bash
npm run build:vscode
```

Como testar manualmente:

1. Abrir o repositorio no VS Code.
2. Ir para Run and Debug.
3. Escolher `Run Momom VS Code Extension`.
4. Abrir `examples/hello.momom`.
5. Testar no editor:
   - erros em tempo real
   - `Ctrl+Space` para autocomplete
   - `Ctrl+Space` em `input name:` para tipos
   - `Ctrl+Space` depois de `node greeting:` para node types
   - `Ctrl+Space` depois de `edge name -> greeting.` para ports
   - hover sobre `Text.Template`
   - hover sobre node ids e referencias como `greeting.text`
   - `F12` em `greeting` dentro de `output message: greeting.text`
   - `Shift+F12` em `input name`
   - `F2` em `greeting` ou `name`
   - Outline com grupos laterais
6. Rodar no Command Palette:
   - `Momom: Validate Current File`
   - `Momom: Show IR`
   - `Momom: Show Flow`
   - `Momom: Preview Graph`
   - `Momom: Compile Current File to TypeScript`

Estado atual da extensao:

- experimental
- usa Language Server local e offline
- autocomplete contextual ainda heuristico
- sem semantic tokens
- sem IA
- diagnostics automaticos vem do LSP e reutilizam `momom-core`
- preview e offline e nao usa CDN
- document links internos ainda nao foram implementados

## Estrutura

- `packages/core`: AST, parser, diagnostics, validator, type system, references resolver, flow checker, IR, Mermaid e compiler.
- `packages/cli`: comandos `parse`, `validate`, `compile`, `graph` e `inspect`.
- `packages/language-server`: servidor LSP com diagnostics, completion contextual, hover, definition, references, rename e symbols.
- `packages/vscode-extension`: extensao experimental do VS Code.
- `examples`: grafos validos e invalidos.
- `spec`: especificacoes da linguagem.

## Estado do projeto

MOMOM v0.7 ainda nao implementa IA, OpenClaw, Qwen, runtime completo de branch, Mermaid SVG avancado, document links internos dedicados ou publicacao no Marketplace. Esta etapa fortalece a experiencia do editor mantendo o nucleo deterministico intacto.

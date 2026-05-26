# MOMOM

MOMOM e uma linguagem declarativa baseada em grafo semantico. Programas sao descritos como grafos com `inputs`, `nodes`, `edges`, `branches` e `outputs`, com parser, validator, type checker, flow checker e compiler deterministicos.

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
5. Rodar no Command Palette:
   - `Momom: Validate Current File`
   - `Momom: Show IR`
   - `Momom: Show Flow`
   - `Momom: Preview Graph`
   - `Momom: Compile Current File to TypeScript`

Estado atual da extensao:

- experimental
- sem Language Server
- sem autocomplete avancado
- sem semantic tokens
- sem IA
- diagnostics usam `momom-core` diretamente
- preview e offline e nao usa CDN

## Estrutura

- `packages/core`: AST, parser, diagnostics, validator, type system, references resolver, flow checker, IR, Mermaid e compiler.
- `packages/cli`: comandos `parse`, `validate`, `compile`, `graph` e `inspect`.
- `packages/vscode-extension`: extensao experimental do VS Code.
- `examples`: grafos validos e invalidos.
- `spec`: especificacoes da linguagem.

## Estado do projeto

MOMOM v0.5 ainda nao implementa IA, OpenClaw, Qwen, Language Server, autocomplete avancado ou publicacao no Marketplace. Esta etapa prepara a primeira integracao local com VS Code mantendo o nucleo deterministico intacto.

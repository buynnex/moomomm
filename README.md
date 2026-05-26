# MOMOM

MOMOM e uma linguagem declarativa baseada em grafo semantico. Programas sao descritos como grafos com `inputs`, `nodes`, `edges`, `branches` e `outputs`, com parser, validator, type checker e compiler deterministicos.

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
- Parser, validator, flow checker e compiler funcionam sem IA.
- IA continuara como uma camada opcional futura.

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

## O que a v0.4 adiciona

- Contratos de input por node na registry.
- Edge com porta opcional, mantendo compatibilidade com a sintaxe antiga.
- Inferencia de portas para `edge token -> verify` e casos equivalentes.
- Flow checker com conexoes resolvidas e plano de execucao topologico.
- IR canonica `momom.graph` v0.4 com `executionPlan`, `nodes[].inputs` e `edges[]` enriquecidos.
- `momom inspect --format flow`.
- Compiler TypeScript usando conexoes resolvidas e placeholders seguros.

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

Registry inicial:

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

## Text.Template

`Text.Template` extrai variaveis como `{customerName}` e transforma cada variavel em uma porta dinamica do node.

Regras atuais:

- cada variavel precisa existir
- cada variavel precisa resolver para `string`, `number` ou `boolean`
- arrays e tipos semanticos nao simples falham na validacao de template

## Validacao e flow checker

O comando `validate` agora roda:

1. validacoes estruturais
2. type checker semantico
3. flow checker

Se houver warnings apenas, a CLI responde com `Validation succeeded with warnings.`. Se houver erros, a validacao falha.

Exemplo de falha nova:

- `ML.RecommendProducts` sem `products` conectado gera `MOMOM020`
- `edge age -> verify.token` gera `MOMOM021`
- `edge token -> verify.password` gera `MOMOM023`

## Diagnostics v0.4

Novos diagnostics desta versao:

- `MOMOM020`: input obrigatorio ausente no node
- `MOMOM021`: tipo de edge incompativel com porta do node
- `MOMOM022`: edge source nao resolvido
- `MOMOM023`: porta de node inexistente
- `MOMOM024`: porta de node conectada mais de uma vez
- `MOMOM025`: propriedade obrigatoria ausente no node
- `MOMOM026`: tipo invalido de propriedade do node
- `MOMOM027`: nao foi possivel inferir porta do edge
- `MOMOM028`: node possivelmente inalcancavel
- `MOMOM029`: input declarado mas nao usado

## Estrutura

- `packages/core`: AST, parser, diagnostics, validator, type system, references resolver, flow checker, IR, Mermaid e compiler.
- `packages/cli`: comandos `parse`, `validate`, `compile`, `graph` e `inspect`.
- `examples`: grafos validos e invalidos.
- `spec`: especificacoes da linguagem.

## Estado do projeto

MOMOM v0.4 ainda nao implementa IA, OpenClaw, Qwen, extensao VS Code, Language Server ou publicacao npm. Esta etapa prepara a base deterministica da linguagem para essas camadas futuras sem depender delas agora.

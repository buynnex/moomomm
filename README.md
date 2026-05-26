# MOMOM

MOMOM e a base de uma linguagem declarativa orientada a grafo semantico. Programas sao descritos como grafos compostos por `inputs`, `nodes`, `edges`, `branches` e `outputs`, com foco em leitura humana, compilacao deterministica e evolucao segura.

## O que e Momom

- Uma linguagem declarativa para descrever fluxos como grafos semanticos.
- Um nucleo deterministicamente parseavel, validavel e compilavel.
- Uma base pensada para humanos, compiladores e futuras ferramentas de IA sem depender delas.

## O que Momom nao e

- Nao e um runtime dependente de IA.
- Nao e um executor autonomo de comandos externos.
- Nao e uma DSL probabilistica no nucleo da linguagem.

## Garantias da v0.3

- `momom-core` e deterministico.
- Parser, validador e compilador funcionam sem IA.
- IA sera apenas uma camada opcional futura.

## Instalar

```bash
npm install
npm run build
```

## Rodar testes

```bash
npm test
```

## Usar a CLI

Depois do build, voce pode executar:

```bash
npm run momom -- parse examples/hello.momom
npm run momom -- parse examples/hello.momom --format ast
npm run momom -- parse examples/hello.momom --format ir
npm run momom -- validate examples/hello.momom
npm run momom -- compile examples/hello.momom --target typescript
npm run momom -- compile examples/hello.momom --target typescript --out generated/hello.ts
npm run momom -- graph examples/auth_recommend.momom --format mermaid
```

## Estrutura do monorepo

- `packages/core`: AST, parser, diagnostics, validator, type checker semantico, IR canonica, registry de nodes, export Mermaid e compilador TypeScript.
- `packages/cli`: interface de linha de comando.
- `examples`: exemplos `.momom`.
- `spec`: especificacoes da linguagem.

## O que a v0.3 adiciona

- Type checker semantico inicial.
- IR canonica `momom.graph` v0.3 com tipos resolvidos em `outputs`.
- Resolucao semantica de referencias `input` e `node.output`.
- Contratos de outputs conhecidos por node na registry.
- Validacoes novas para propriedades inexistentes, branch booleana, variaveis de template e tipos incompativeis.
- `momom graph --format mermaid`.
- `momom compile --out`.
- Placeholders seguros para nodes ainda nao implementados completamente.

## Referencias semanticas

- `name`: referencia direta a um `input`.
- `greeting.text`: referencia ao output `text` de um `node`.
- `verify.valid`: referencia ao output `valid` de um `node`.

O parser continua gerando AST deterministica, e a camada semantica da v0.3 resolve o tipo dessas referencias quando possivel.

## Nodes conhecidos

Na registry inicial, Momom conhece os contratos de:

- `Text.Template` -> `text: string`
- `Auth.VerifyToken` -> `valid: boolean`
- `ML.RecommendProducts` -> `items: Product[]`
- `Action.TriggerAnomaly` -> `triggered: boolean`

Nodes desconhecidos nao quebram o grafo por si so, mas geram warning `MOMOM018`.

## Text.Template

`Text.Template` extrai variaveis no formato `{nome}` ou `{node.output}`.

Regras atuais:

- cada variavel precisa existir
- cada variavel precisa resolver para `string`, `number` ou `boolean`
- tipos como `Product[]` ou referencias nao resolvidas falham na validacao

## Diagnostics v0.3

- `MOMOM013`: propriedade inexistente na referencia
- `MOMOM014`: branch precisa usar expressao booleana
- `MOMOM015`: variavel de template inexistente
- `MOMOM016`: variavel de template possui tipo incompativel
- `MOMOM017`: tipo incompativel para node
- `MOMOM018`: node desconhecido na registry
- `MOMOM019`: tipo nao resolvido

## Estado atual

Esta versao implementa a base real da linguagem Momom v0.3 sem depender de IA. Integracoes com IA, OpenClaw, extensao VS Code, Language Server e adaptadores externos continuam deliberadamente fora desta etapa.

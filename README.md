# MOMOM

MOMOM e a primeira base de uma linguagem declarativa orientada a grafo semantico. Programas sao descritos como grafos compostos por `inputs`, `nodes`, `edges`, `branches` e `outputs`, com foco em leitura humana, compilacao deterministica e evolucao segura.

## O que e Momom

- Uma linguagem declarativa para descrever fluxos como grafos semanticos.
- Um nucleo deterministicamente parseavel, validavel e compilavel.
- Uma base pensada para humanos, compiladores e futuras ferramentas de IA sem depender delas.

## O que Momom nao e

- Nao e um runtime dependente de IA.
- Nao e um executor autonomo de comandos externos.
- Nao e uma DSL probabilistica no nucleo da linguagem.

## Garantias da v0.1

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
npm run momom -- validate examples/hello.momom
npm run momom -- compile examples/hello.momom --target typescript
```

## Estrutura do monorepo

- `packages/core`: AST, parser, diagnostics, validator, IR e compilador TypeScript.
- `packages/cli`: interface de linha de comando.
- `examples`: exemplos `.momom`.
- `spec`: especificacao inicial da linguagem.

## Estado atual

Esta versao implementa a base real da linguagem Momom v0.1. Integracoes com IA, OpenClaw, extensao VS Code e adaptadores externos ficam deliberadamente fora desta etapa.

# Momom v0.1

## Filosofia da linguagem

Momom modela programas como grafos semanticos legiveis e deterministically processaveis. O objetivo e permitir que a mesma representacao sirva para leitura humana, validacao estatica e compilacao segura, sem acoplar o nucleo a modelos de IA.

## Sintaxe v0.1

Um grafo e declarado com:

```momom
graph NomeDoGrafo {
  input name: string

  node greeting: Text.Template {
    intent: "Criar mensagem"
    template: "Ola, {name}"
  }

  edge name -> greeting

  output message: greeting.text
}
```

## Estrutura do grafo

- `graph`: unidade principal.
- `input`: entrada nomeada e tipada.
- `node`: passo nomeado com tipo e propriedades declarativas.
- `edge`: ligacao entre inputs e nodes.
- `branch`: bifurcacao declarativa baseada em uma referencia.
- `output`: valor exposto pelo grafo.

## Tipos basicos

- Escalares: `string`, `number`, `boolean`
- Tipos nomeados: `User`, `Token`, `Product`
- Arrays: `Product[]`

Nesta v0.1, os tipos sao preservados como anotacoes declarativas. O compilador TypeScript inicial traduz esses tipos diretamente quando possivel.

## Regras de seguranca

- O parser e deterministico.
- O validador e deterministico.
- O compilador e deterministico.
- Nenhum passo do compilador executa comandos externos.
- Nodes nao implementados geram saida TypeScript segura com `TODO`, sem comportamento perigoso.

## `deterministic: true` vs `deterministic: false`

- `deterministic: true` indica que, dado o mesmo input, o node deve produzir o mesmo comportamento observavel.
- `deterministic: false` indica um node potencialmente heuristico, probabilistico ou dependente de mecanismos nao estritamente reprodutiveis.

Essa distincao e metadado semantico do grafo. O nucleo da linguagem continua deterministicamente parseado e validado em ambos os casos.

## Por que nodes criticos nao podem ser probabilisticos

Um node com `risk: "critical"` representa uma etapa cujo erro pode trazer impacto alto em seguranca, autorizacao, conformidade ou integridade do fluxo. Por isso, `risk: "critical"` combinado com `deterministic: false` e proibido na validacao v0.1. O objetivo e evitar que decisoes criticas dependam de comportamento nao reprodutivel.

## Proximos passos

- Extensao VS Code para highlight, autocomplete e diagnostics.
- `momom-ai-adapter` como camada opcional fora do nucleo.
- Integracoes futuras com OpenClaw e Qwen como tooling adicional, nunca como dependencia do parser, validador ou compilador.

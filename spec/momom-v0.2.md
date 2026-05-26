# Momom v0.2

## Filosofia da linguagem

Momom continua sendo uma linguagem declarativa para descrever programas como grafos semanticos legiveis, deterministically parseaveis e seguros para compilacao automatizada. A v0.2 fortalece a representacao interna e a validacao, mas mantem o nucleo sem dependencia de IA.

## IR v0.2

A IR canonica da linguagem passa a usar:

```json
{
  "kind": "momom.graph",
  "version": "0.2",
  "name": "Example",
  "inputs": [],
  "nodes": [],
  "edges": [],
  "branches": [],
  "outputs": []
}
```

Cada node em IR v0.2 promove metadados semanticos para campos de primeira classe:

- `intent`
- `risk`
- `deterministic`

As demais propriedades continuam em `properties`.

## Registry de nodes

Momom v0.2 introduz um registry inicial de nodes conhecidos:

- `Text.Template`
- `Auth.VerifyToken`
- `ML.RecommendProducts`
- `Action.TriggerAnomaly`

O registry informa:

- outputs conhecidos
- tipos de output
- estrategia de compilacao TypeScript quando suportada

Nodes fora do registry continuam permitidos. Eles nao invalidam o grafo so por serem desconhecidos.

## Placeholders e seguranca do compiler

O compilador TypeScript continua deterministico e seguro:

- nao executa comandos externos
- nao usa `eval`
- nao usa `Function`
- nao gera imports perigosos automaticamente

Quando um node ainda nao possui implementacao real, o compilador gera placeholders seguros com comentarios `TODO`.

Exemplos:

- `Auth.VerifyToken`: placeholder baseado em `Boolean(input.token)`
- `ML.RecommendProducts`: placeholder baseado em `input.products.slice(0, topK)`
- `Action.TriggerAnomaly`: placeholder booleano seguro

## Risk levels

Quando `risk` existir em um node, os valores aceitos sao:

- `low`
- `medium`
- `high`
- `critical`

Valores fora dessa lista geram `MOMOM011`.

## Deterministic

Quando `deterministic` existir em um node, ele precisa ser booleano:

- `true`
- `false`

Valores nao booleanos geram `MOMOM012`.

Nodes com `risk: "critical"` continuam proibidos quando `deterministic: false`, gerando `MOMOM007`.

## Diagnostics novos

- `MOMOM010`: ciclo detectado no grafo
- `MOMOM011`: valor de risk invalido
- `MOMOM012`: deterministic precisa ser booleano

## Mermaid graph export

A CLI passa a suportar export Mermaid:

```bash
momom graph examples/auth_recommend.momom --format mermaid
```

O formato gerado e um `flowchart TD` simples com inputs, nodes, edges, branches e outputs.

## Compatibilidade

- A sintaxe e os exemplos v0.1 continuam validos.
- O parser AST continua estavel.
- A v0.2 adiciona IR canonica, nao substitui a AST.

## Proximos passos

- Extensao VS Code
- Language Server
- `momom-ai-adapter`
- Integracoes futuras com Qwen e OpenClaw fora do nucleo deterministico

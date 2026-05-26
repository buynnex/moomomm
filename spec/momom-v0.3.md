# Momom v0.3

## Objetivo da v0.3

A v0.3 adiciona uma primeira camada de tipagem semantica, resolucao de referencias e contratos de input/output por node, mantendo o parser, o validator e o compiler deterministicos.

## Type system inicial

Momom introduz um tipo interno simples:

- `name`
- `isArray`
- `raw`

Exemplos:

- `string`
- `number`
- `boolean`
- `Product`
- `Product[]`

Regras iniciais:

- `any` e compativel com tudo
- `unknown` aceita tudo como destino
- tipos iguais sao compativeis
- arrays so sao compativeis com arrays do mesmo tipo base

## Referencias

Referencias podem apontar para:

- `input`
- `node.output`

Exemplos:

- `name`
- `greeting.text`
- `verify.valid`
- `recommend.items`

Essa resolucao e usada pela IR, pela validacao e pelo compiler.

## Node registry contracts

Nodes conhecidos na v0.3:

- `Text.Template`
  - category: `text`
  - deterministic: `true`
  - outputs:
    - `text: string`
  - compileStrategy: `template`

- `Auth.VerifyToken`
  - category: `auth`
  - deterministic: `true`
  - outputs:
    - `valid: boolean`
  - compileStrategy: `placeholder-auth`

- `ML.RecommendProducts`
  - category: `ml`
  - deterministic: `false`
  - outputs:
    - `items: Product[]`
  - compileStrategy: `placeholder-recommend`

- `Action.TriggerAnomaly`
  - category: `action`
  - deterministic: `true`
  - outputs:
    - `triggered: boolean`
  - compileStrategy: `placeholder-action`

## Type checker

O type checker v0.3 verifica:

- referencias de `output`
- referencias de `branch`
- propriedade inexistente em referencias
- variaveis de `Text.Template`
- compatibilidade de tipos simples para template
- compatibilidade basica de nodes conhecidos como `Auth.VerifyToken` e `ML.RecommendProducts`
- warnings para nodes desconhecidos

## Diagnostics novos

- `MOMOM013`: propriedade inexistente na referencia
- `MOMOM014`: branch precisa usar expressao booleana
- `MOMOM015`: variavel de template inexistente
- `MOMOM016`: variavel de template possui tipo incompativel
- `MOMOM017`: tipo incompativel para node
- `MOMOM018`: node desconhecido na registry
- `MOMOM019`: tipo nao resolvido

## IR v0.3

A IR canonica continua com `kind: "momom.graph"` e agora usa `version: "0.3"`.

Novidades:

- outputs podem incluir `type`
- nodes podem incluir `outputs` conhecidos pela registry

Exemplo:

```json
{
  "name": "message",
  "reference": "greeting.text",
  "type": "string"
}
```

## Exemplos validos

- `examples/hello.momom`
- `examples/auth_recommend.momom`
- `examples/customer_offer.momom`

## Exemplos invalidos

- `examples/invalid/critical_probabilistic.momom`
- `examples/invalid/missing_output_reference.momom`
- `examples/invalid/missing_output_property.momom`
- `examples/invalid/branch_non_boolean.momom`
- `examples/invalid/template_missing_variable.momom`
- `examples/invalid/template_incompatible_type.momom`
- `examples/invalid/cycle_simple.momom`

## Seguranca do compiler

O compiler continua:

- deterministico
- sem `eval`
- sem `Function constructor`
- sem imports perigosos
- sem execucao de comandos externos

Se houver diagnostics de erro, a compilacao falha de forma controlada.

## Proximos passos

- v0.4: VS Code extension
- v0.5: `momom-ai-adapter`
- integracao futura com Qwen e OpenClaw fora do nucleo deterministico

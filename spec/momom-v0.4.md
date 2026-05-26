# Momom v0.4

## Objetivo da v0.4

A v0.4 adiciona contratos de fluxo entre nodes, validacao de edges por porta, inferencia simples de conexoes, plano de execucao topologico e IR canonica v0.4, mantendo parser, validator, type checker e compiler deterministicos.

## Edge ports

A sintaxe antiga continua valida:

```momom
edge token -> verify
edge products -> recommend
edge name -> greeting
```

A v0.4 adiciona portas explicitas:

```momom
edge token -> verify.token
edge products -> recommend.products
edge customerName -> message.customerName
edge greeting.text -> otherNode.message
```

O lado esquerdo de um edge e sempre uma referencia semantica. O lado direito pode ser `node` ou `node.port`.

## Flow checker

O flow checker resolve:

- tipo do source do edge
- node de destino
- porta de destino
- compatibilidade de tipo com o contrato da porta
- inputs obrigatorios ausentes
- conexoes duplicadas
- propriedades obrigatorias e seus tipos
- ordem topologica de execucao entre nodes

O resultado principal inclui:

- `connections`
- `executionPlan`
- `diagnostics`

## Node input contracts

Cada node conhecido possui contrato:

- categoria
- determinismo
- inputs aceitos
- outputs conhecidos
- propriedades suportadas
- compile strategy
- efeitos declarados
- risco default

### Text.Template

- category: `text`
- deterministic: `true`
- inputs: dinamicos, derivados de `{variaveis}` no template
- outputs: `text: string`
- compileStrategy: `template`

### Auth.VerifyToken

- category: `auth`
- deterministic: `true`
- inputs:
  - `token`: `Token | string | unknown`, obrigatorio
  - `user`: `User | unknown`, opcional
- outputs: `valid: boolean`
- compileStrategy: `placeholder-auth`

### ML.RecommendProducts

- category: `ml`
- deterministic: `false`
- inputs:
  - `products`: `Product[]`, obrigatorio
  - `user`: `User | unknown`, opcional
- outputs: `items: Product[]`
- compileStrategy: `placeholder-recommend`

### Action.TriggerAnomaly

- category: `action`
- deterministic: `true`
- inputs:
  - `reason`: `string`, opcional
- outputs: `triggered: boolean`
- compileStrategy: `placeholder-action`

Nodes desconhecidos continuam aceitos estruturalmente, mas geram warning `MOMOM018`.

## Dynamic inputs de Text.Template

`Text.Template` transforma cada variavel encontrada em `template` em uma porta dinamica obrigatoria.

Exemplo:

```momom
node message: Text.Template {
  template: "Ola, {customerName}"
}
```

Esse node passa a aceitar a porta `customerName`.

## Inferencia de portas

Quando um edge nao declara porta explicita, Momom tenta inferir a porta:

1. usa a porta explicita, se existir
2. tenta casar o nome do source com um input conhecido
3. para `Text.Template`, tenta casar com a variavel do template
4. se houver exatamente um input obrigatorio ainda nao conectado, usa esse input
5. se ainda assim nao der, gera `MOMOM027`

## Execution plan

A v0.4 gera um plano topologico de execucao com:

- `nodeId`
- `order`
- `dependsOn`

Esse plano nao e um runtime completo, mas define uma ordem canonica para compiladores e ferramentas.

## IR v0.4

A IR canonica agora usa `version: "0.4"` e inclui conexoes resolvidas.

Exemplo:

```json
{
  "kind": "momom.graph",
  "version": "0.4",
  "name": "AuthRecommend",
  "executionPlan": [
    {
      "nodeId": "verify",
      "order": 0,
      "dependsOn": []
    }
  ]
}
```

Novidades:

- `nodes[].inputs`
- `edges[].fromType`
- `edges[].toNode`
- `edges[].toPort`
- `edges[].acceptedTypes`
- `edges[].inferred`
- `outputs[].type`
- `executionPlan`

## Diagnostics MOMOM020 a MOMOM029

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

## Exemplos validos

- `examples/hello.momom`
- `examples/auth_recommend.momom`
- `examples/customer_offer.momom`
- `examples/flow_explicit_ports.momom`

## Exemplos invalidos

- `examples/invalid/missing_required_node_input.momom`
- `examples/invalid/incompatible_edge_type.momom`
- `examples/invalid/invalid_target_port.momom`
- `examples/invalid/duplicate_port_connection.momom`
- `examples/invalid/missing_required_property.momom`
- `examples/invalid/invalid_property_type.momom`
- `examples/invalid/cannot_infer_port.momom`

## Seguranca do compiler

O compiler TypeScript da v0.4 continua:

- deterministico
- sem `eval`
- sem `Function constructor`
- sem imports automaticos perigosos
- sem execucao de comandos externos

Branches ainda nao executam runtime completo; o compiler gera comentarios TODO seguros e previsiveis.

## Proximos passos

- v0.5: extensao VS Code basica
- v0.6: Language Server
- v0.7: `momom-ai-adapter`
- integracao futura com Qwen e OpenClaw fora do nucleo deterministico

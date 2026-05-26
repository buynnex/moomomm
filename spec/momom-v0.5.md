# Momom v0.5

## Objetivo da v0.5

A v0.5 introduz uma extensao basica do VS Code para a linguagem Momom, sem Language Server ainda. O foco desta etapa e tornar o nucleo da linguagem utilizavel dentro do editor com validacao local, previews e compilacao segura.

## Escopo da extensao VS Code

A extensao oferece:

- reconhecimento de arquivos `.momom`
- syntax highlighting basico
- configuracao de linguagem
- comandos no Command Palette
- diagnostics usando `@momom/core`
- preview do grafo
- preview do flow analysis
- preview da IR
- compilacao do arquivo atual para TypeScript

## Comandos disponiveis

- `Momom: Validate Current File`
- `Momom: Show IR`
- `Momom: Show Flow`
- `Momom: Preview Graph`
- `Momom: Compile Current File to TypeScript`

## Syntax highlighting

A grammar da v0.5 reconhece:

- keywords: `graph`, `input`, `node`, `edge`, `branch`, `output`, `true`, `false`
- tipos comuns como `string`, `number`, `boolean`, `unknown`, `any`, `void`, `User`, `Token`, `Product`, `Product[]`
- strings
- numeros
- operadores como `->`, `:`, `.`
- comentarios de linha `//`

Comentarios de linha sao reconhecidos pelo editor e o parser atual tambem os ignora.

## Diagnostics

Os diagnostics da extensao usam `momom-core` diretamente:

1. parse
2. validate
3. type check
4. flow analysis

O editor atualiza diagnostics:

- ao abrir o arquivo
- ao salvar
- ao alterar o conteudo com debounce simples
- ao fechar, limpando a colecao

## Preview Graph

`Momom: Preview Graph` abre um Webview offline com:

- Mermaid source em texto
- inputs
- nodes
- edges
- branches
- outputs
- execution plan

Nao ha renderizacao remota nem dependencia de CDN nesta versao.

## Show IR

`Momom: Show IR` abre a IR canonica como JSON em um documento virtual somente leitura.

## Show Flow

`Momom: Show Flow` abre o resultado do flow checker como JSON com:

- `diagnostics`
- `connections`
- `executionPlan`

## Compile Current File

`Momom: Compile Current File to TypeScript`:

- valida o documento atual
- falha se houver erros
- permite warnings
- abre `showSaveDialog`
- salva o TypeScript gerado localmente

## Seguranca do Webview

O preview usa HTML estatico com:

- escaping de texto
- CSP simples
- sem scripts remotos
- sem CDN
- sem `eval`

## Limites da versao

A v0.5 ainda nao implementa:

- Language Server
- autocomplete avancado
- hover
- go-to-definition
- semantic tokens
- IA
- OpenClaw
- Qwen
- runtime completo de branch
- publicacao no Marketplace

## Proximos passos

- v0.6: Language Server
- v0.7: autocomplete, hover e go-to-definition
- v0.8: `momom-ai-adapter`
- integracao futura com Qwen e OpenClaw fora do nucleo deterministico

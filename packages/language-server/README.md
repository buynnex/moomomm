# Momom Language Server

Language Server local e offline da linguagem Momom para uso no VS Code.

Recursos da v0.7:

- diagnostics com debounce usando `@momom/core`
- completion contextual por posicao do cursor
- hover enriquecido para contratos, referencias e edges
- go to definition basico
- find references basico
- rename inicial para inputs e nodes
- document symbols agrupados para Outline

Build:

```bash
npm run build:language-server
```

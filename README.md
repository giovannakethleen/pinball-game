# Cosmic Pinball

## Estrutura

```text
apps/
  web/  # Angular: interface, controles, motor do jogo e ranking local
```

O motor TypeScript e as regras de pontuação foram preservados durante a troca
da interface. O ranking fica salvo no `localStorage` do navegador e não é
compartilhado entre jogadores.

## Requisitos

- Node.js 20.19+, 22.12+ ou 24+

## Desenvolvimento local

Instale as dependências a partir da raiz do repositório:

```sh
npm install
npm run dev
```

O jogo Angular fica disponível em `http://localhost:4200`.

## Testes e build

```sh
npm test
npm run build
```

## Publicação

O frontend Angular pode ser publicado como conteúdo estático em uma hospedagem
ou CDN para sites estáticos. O build de produção é gerado por `npm run build`;
o diretório de saída é `apps/web/dist/cosmic-pinball/browser`.

# termo

Um clone do jogo Termo/Wordle em português, feito com HTML, CSS e JavaScript puro (sem build, sem dependências).

## Como rodar

É um site estático — qualquer servidor HTTP serve. Algumas opções:

- **XAMPP**: coloque a pasta em `htdocs` (já é o caso) e acesse `http://localhost/termo.oo/`.
- **Servidor simples**: na raiz do projeto, rode `python -m http.server 8000` e acesse `http://localhost:8000`.

Não abra o `index.html` direto com `file://` — o carregamento das palavras usa `fetch`, que exige um servidor HTTP.

## Estrutura

```
index.html          página principal
css/style.css        estilos e temas (claro/escuro)
js/script.js          lógica do jogo
data/palavras.json    lista de palavras válidas (991 palavras de 5 letras)
```

## Funcionalidades

- Tabuleiro e teclado que se ajustam ao tamanho da tela, sem rolagem.
- Tema claro/escuro (alternável, salvo no navegador).
- Palavra sorteada aleatoriamente a cada partida — pode jogar quantas vezes quiser, sem limite de tempo.
- Estatísticas (jogos, vitórias, sequência, distribuição de tentativas) salvas em `localStorage`.
- Compartilhamento do resultado (copiado para a área de transferência).

## Palavras

As palavras válidas ficam em [data/palavras.json](data/palavras.json), como uma lista simples em `palavras`. Para adicionar ou remover palavras, edite esse arquivo — todas devem ter 5 letras (acentos são normalizados automaticamente pelo jogo).

# letrio

Um clone do jogo Termo/Wordle em português, sem limite de tentativas, feito com HTML, CSS e JavaScript puro (sem build, sem dependências).

## Como rodar

É um site estático — qualquer servidor HTTP serve. Algumas opções:

- **XAMPP**: coloque a pasta em `htdocs` (já é o caso) e acesse `http://localhost/termo.oo/`.
- **Servidor simples**: na raiz do projeto, rode `python -m http.server 8000` e acesse `http://localhost:8000`.

Não abra o `index.html` direto com `file://` — o carregamento das palavras usa `fetch`, que exige um servidor HTTP.

## Estrutura

```
index.html                    página principal
sobre/index.html               página "sobre" (créditos e privacidade)
css/style.css                  estilos e temas (claro/escuro)
js/script.js                   lógica do jogo
data/palavras.json             palavras que podem ser sorteadas como resposta
data/dicionario_extra.json     palavras extras aceitas como palpite (nunca sorteadas)
```

## Funcionalidades

- Modos **letrio** (1 palavra), **dueto** (2), **trio** (3) e **quarteto** (4), todos compartilhando as mesmas tentativas entre os tabuleiros.
- Tabuleiro e teclado que se ajustam ao tamanho da tela, sem rolagem.
- Tema claro/escuro (alternável, salvo no navegador).
- Clique em qualquer casinha da linha atual pra posicionar o cursor e sobrescrever uma letra.
- Palavra sorteada aleatoriamente a cada partida — pode jogar quantas vezes quiser, sem limite de tempo.
- Estatísticas por modo (jogos, vitórias, sequência, distribuição de tentativas) salvas em `localStorage`.
- Compartilhamento do resultado (copiado para a área de transferência).

## Palavras

- [data/palavras.json](data/palavras.json): lista curada de palavras comuns de 5 letras — são as únicas que podem virar a resposta do dia.
- [data/dicionario_extra.json](data/dicionario_extra.json): palavras adicionais (baixadas do [léxico pt-br](https://github.com/fserb/pt-br)) aceitas como palpite válido, mas que nunca são sorteadas como resposta.

Para adicionar ou remover uma palavra da lista de respostas, edite `palavras.json`; todas devem ter 5 letras (acentos são normalizados automaticamente pelo jogo). Para só aceitar uma palavra como palpite sem que ela vire resposta, adicione em `dicionario_extra.json`.

## Créditos

Veja a página [/sobre/](sobre/index.html) dentro do próprio jogo.

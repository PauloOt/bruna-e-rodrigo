# Bruna & Rodrigo · fotos dos convidados

Site para o casamento de 16/01/2027. Os convidados escaneiam o QR code do cartão da mesa, escolhem fotos (ou tiram na hora), deixam um recado opcional e enviam. Tudo vai direto para uma pasta no Google Drive dos noivos.

- `index.html` + `app.js` + `styles.css`: a página que o convidado abre.
- `cartao.html`: o cartãozinho da mesa (10 × 15 cm) com o QR code gerado na hora.
- `apps-script/Code.gs`: o "servidor". Roda no Google Apps Script da conta dos noivos e grava no Drive deles.
- `config.js`: a URL do Apps Script. Vazia, o site roda em **modo demonstração** (simula o envio).

Não há banco de dados nem login próprio: o Drive guarda as fotos e a conta Google dos noivos é o acesso.

## O que os noivos recebem

Uma pasta **Casamento Bruna & Rodrigo — fotos dos convidados** no Drive, com:

- uma subpasta por envio, por exemplo `21h13 - Tia Cida`, com as fotos dentro;
- o recado gravado na descrição de cada foto (aparece em "Detalhes" no Drive);
- a planilha **Recados dos convidados**, com uma linha por envio: quando, nome, recado, quantas fotos e o link da subpasta.

As fotos chegam redimensionadas para 2560 px no lado maior (JPEG, ~1 MB cada), o que já é ótimo para imprimir 20 × 30. Vídeos vão no original, até 30 MB.

## Colocar no ar

### 1. Apps Script (na conta Google dos noivos)

O ideal é fazer logado na conta de um dos noivos, para as fotos já caírem no Drive deles.

1. Abra <https://script.google.com> → **Novo projeto**. Dê o nome "Fotos do casamento".
2. Apague o conteúdo do `Código.gs` e cole o conteúdo de [`apps-script/Code.gs`](apps-script/Code.gs).
3. No menu de funções lá em cima, escolha **setup** e clique em **Executar**. O Google pede autorização (Drive e Planilhas): aceite. Em "app não verificado", clique em *Avançado → Acessar*.
4. O log mostra o link da pasta criada. A planilha de recados fica dentro dela.
5. **Implantar → Nova implantação** → engrenagem → **App da Web**:
   - Executar como: **Eu**
   - Quem pode acessar: **Qualquer pessoa**
6. Copie a **URL do app da Web** (termina em `/exec`).

> Se mudar o `Code.gs` depois, use **Implantar → Gerenciar implantações → editar → Nova versão**. Assim a URL continua a mesma e o QR code impresso não quebra.

### 2. Ligar o site ao script

Em `config.js`, cole a URL no `SCRIPT_URL`. O `EVENT_KEY` precisa ser igual ao do `Code.gs`.

### 3. Publicar o site

Qualquer hospedagem estática serve. Com GitHub Pages: suba este repositório, vá em **Settings → Pages**, escolha a branch `main` e a pasta `/ (root)`. O endereço sai como `https://<usuario>.github.io/<repo>/`.

### 4. Cartão e QR code

Abra `cartao.html` **no endereço publicado** (`https://…/cartao.html`). O QR já aponta para a página de envio ao lado dele. Se quiser outro link, digite no campo do topo. Depois é só clicar em **Imprimir / salvar PDF** (papel 10 × 15, margens "Nenhuma") e mandar o PDF para a gráfica.

### 5. Testar antes do dia

Pelo celular, escaneie o cartão, envie 2 ou 3 fotos com um recado e confira a pasta e a planilha no Drive.

## Rodar localmente

```bash
python -m http.server 5180
```

Abra <http://localhost:5180>. Sem `SCRIPT_URL`, aparece a faixa "Modo demonstração".

## Limites

- Drive grátis: 15 GB (divididos com o Gmail da conta). Mil fotos a ~1 MB ocupam ~1 GB.
- Apps Script: até 30 execuções simultâneas por conta. Cada celular manda 2 fotos por vez, então uns 15 convidados enviando ao mesmo tempo. Se passar disso, o site tenta de novo sozinho.
- Fotos HEIC do Android, que o navegador não consegue abrir, vão no original, sem reduzir.

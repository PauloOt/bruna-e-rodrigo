(() => {
  const { SCRIPT_URL, EVENT_KEY } = window.CONFIG;
  const DEMO = !SCRIPT_URL;

  // Foto vai redimensionada (lado maior) e em JPEG: fica com ~1 MB e sobe rápido no 4G do salão.
  const MAX_LADO = 2560;
  const QUALIDADE = 0.86;
  // O Apps Script aceita no máximo ~50 MB por requisição, e o base64 engorda 1/3.
  const MAX_VIDEO = 30 * 1024 * 1024;
  const SIMULTANEOS = 2;

  const $ = (id) => document.getElementById(id);
  const form = $('form');
  const input = $('arquivos');
  const lista = $('miniaturas');
  const nome = $('nome');
  const recado = $('recado');
  const enviar = $('enviar');
  const aviso = $('aviso');

  let itens = []; // { file, url, li }

  $('demo').hidden = !DEMO;

  try { nome.value = localStorage.getItem('nome') || ''; } catch {}

  input.addEventListener('change', () => {
    for (const file of input.files) adicionar(file);
    input.value = '';
    atualizar();
  });

  recado.addEventListener('input', atualizar);

  function adicionar(file) {
    const video = file.type.startsWith('video/');
    if (!video && !file.type.startsWith('image/') && !/\.(heic|heif)$/i.test(file.name)) return;
    if (video && file.size > MAX_VIDEO) {
      mostrarAviso(`O vídeo “${file.name}” passa de 30 MB. Tente um trecho mais curto.`, true);
      return;
    }
    const url = URL.createObjectURL(file);
    const li = document.createElement('li');
    const midia = document.createElement(video ? 'video' : 'img');
    midia.src = url;
    if (video) { midia.muted = true; midia.playsInline = true; }
    else midia.alt = '';
    const tirar = document.createElement('button');
    tirar.type = 'button';
    tirar.className = 'tirar';
    tirar.setAttribute('aria-label', 'Remover');
    tirar.textContent = '×';
    const item = { file, url, li };
    tirar.onclick = () => {
      URL.revokeObjectURL(url);
      li.remove();
      itens = itens.filter((i) => i !== item);
      atualizar();
    };
    li.append(midia, tirar);
    lista.append(li);
    itens.push(item);
  }

  function atualizar() {
    const n = itens.length;
    const temRecado = recado.value.trim().length > 0;
    enviar.disabled = n === 0 && !temRecado;
    enviar.textContent = n === 0 ? (temRecado ? 'Enviar recado' : 'Enviar para os noivos')
      : n === 1 ? 'Enviar 1 foto' : `Enviar ${n} fotos`;
    mostrarAviso(n || temRecado ? '' : 'Escolha ao menos uma foto ou escreva um recado.');
  }

  function mostrarAviso(texto, erro = false) {
    aviso.textContent = texto;
    aviso.classList.toggle('erro', erro);
  }

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    if (enviar.disabled) return;
    try { localStorage.setItem('nome', nome.value.trim()); } catch {}

    const base = { key: EVENT_KEY, name: nome.value.trim(), message: recado.value.trim() };
    const pendentes = itens.filter((i) => !i.li.classList.contains('enviada'));
    const totalLote = itens.length;

    form.hidden = true;
    $('progresso').hidden = false;
    let feitos = 0;
    const total = pendentes.length;
    const progresso = () => {
      $('progresso-texto').textContent = total ? `Enviando ${Math.min(feitos + 1, total)} de ${total}…` : 'Enviando recado…';
      $('barra').style.width = total ? `${(feitos / total) * 100}%` : '60%';
    };
    progresso();

    const falhas = [];
    if (total === 0) {
      const ok = await postar({ ...base });
      if (!ok) falhas.push(null);
    } else {
      // O recado vai junto de cada arquivo; a planilha ganha a linha quando chega o arquivo 0.
      let proximo = 0;
      const trabalhador = async () => {
        while (proximo < total) {
          const item = pendentes[proximo++];
          const ok = await enviarArquivo(item, base, itens.indexOf(item), totalLote);
          item.li.classList.toggle('enviada', ok);
          item.li.classList.toggle('falhou', !ok);
          if (!ok) falhas.push(item);
          feitos++;
          progresso();
        }
      };
      await Promise.all(Array.from({ length: Math.min(SIMULTANEOS, total) }, trabalhador));
    }

    $('barra').style.width = '100%';
    $('progresso').hidden = true;

    if (falhas.length) {
      form.hidden = false;
      mostrarAviso(total
        ? `${falhas.length} de ${total} não foram. Confira a internet e toque em enviar de novo.`
        : 'O recado não foi. Confira a internet e tente de novo.', true);
      enviar.textContent = 'Tentar de novo';
      return;
    }

    $('obrigado-texto').textContent = total === 0 ? 'Seu recado já está com a gente.'
      : total === 1 ? 'Sua foto já está com a gente.' : `Suas ${total} fotos já estão com a gente.`;
    $('tela-envio').hidden = true;
    $('tela-obrigado').hidden = false;
    window.scrollTo({ top: $('tela-obrigado').offsetTop - 20, behavior: 'smooth' });
  });

  $('mais').addEventListener('click', () => {
    for (const i of itens) URL.revokeObjectURL(i.url);
    itens = [];
    lista.replaceChildren();
    recado.value = '';
    $('tela-obrigado').hidden = true;
    $('tela-envio').hidden = false;
    form.hidden = false;
    atualizar();
    input.click();
  });

  async function enviarArquivo(item, base, index, total) {
    let blob = item.file;
    let nomeArq = item.file.name || 'foto.jpg';
    if (blob.type.startsWith('image/') || /\.(heic|heif)$/i.test(nomeArq)) {
      const reduzida = await reduzir(blob);
      if (reduzida) {
        blob = reduzida;
        nomeArq = nomeArq.replace(/\.[^.]+$/, '') + '.jpg';
      }
    }
    const data = await paraBase64(blob);
    const mime = blob.type || (/\.(heic|heif)$/i.test(nomeArq) ? 'image/heic' : 'application/octet-stream');
    return postar({ ...base, index, total, filename: nomeArq, mime, data });
  }

  // Devolve null quando o navegador não sabe decodificar (ex.: HEIC no Android); aí vai o original.
  async function reduzir(file) {
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
      const escala = Math.min(1, MAX_LADO / Math.max(bmp.width, bmp.height));
      if (escala === 1 && file.type === 'image/jpeg' && file.size < 2.5 * 1024 * 1024) {
        bmp.close();
        return null;
      }
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(bmp.width * escala);
      canvas.height = Math.round(bmp.height * escala);
      canvas.getContext('2d').drawImage(bmp, 0, 0, canvas.width, canvas.height);
      bmp.close();
      return await new Promise((ok) => canvas.toBlob(ok, 'image/jpeg', QUALIDADE));
    } catch {
      return null;
    }
  }

  function paraBase64(blob) {
    return new Promise((ok, falha) => {
      const r = new FileReader();
      r.onload = () => ok(String(r.result).split(',')[1]);
      r.onerror = falha;
      r.readAsDataURL(blob);
    });
  }

  async function postar(payload, tentativas = 3) {
    if (DEMO) {
      await new Promise((r) => setTimeout(r, 700 + Math.random() * 700));
      return true;
    }
    for (let t = 1; t <= tentativas; t++) {
      try {
        // Corpo em texto puro: o navegador não faz preflight de CORS e o Apps Script aceita.
        const resp = await fetch(SCRIPT_URL, { method: 'POST', body: JSON.stringify(payload) });
        const json = await resp.json();
        if (json.ok) return true;
        console.warn('Apps Script recusou:', json.error);
        if (/inválida|grande|não aceito/.test(json.error || '')) return false;
      } catch (err) {
        console.warn('Falha no envio, tentativa', t, err);
      }
      await new Promise((r) => setTimeout(r, 1500 * t));
    }
    return false;
  }
})();

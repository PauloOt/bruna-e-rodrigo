/**
 * Recebe as fotos dos convidados e grava numa pasta do Google Drive dos noivos.
 * Cada mensagem também vira uma linha na planilha "Recados", na mesma pasta.
 *
 * Implantação: veja o README do projeto (Implantar > Nova implantação > App da Web,
 * "Executar como: eu" e "Quem pode acessar: qualquer pessoa").
 */

// Precisa ser igual ao EVENT_KEY do config.js do site.
const EVENT_KEY = 'bruna-rodrigo-2027';

// ID de uma pasta que já existe no Drive: é o trecho depois de /folders/ no link dela.
// Vazio = setup() cria uma pasta nova com o FOLDER_NAME.
const PASTA_ID = '';
const FOLDER_NAME = 'Casamento Bruna & Rodrigo — fotos dos convidados';

const MAX_BYTES = 40 * 1024 * 1024;
const TZ = 'America/Sao_Paulo';

/** Rode uma vez pelo editor: cria a pasta e a planilha e guarda os IDs. */
function setup() {
  const props = PropertiesService.getScriptProperties();
  let folderId = PASTA_ID || props.getProperty('FOLDER_ID');
  if (!folderId) folderId = DriveApp.createFolder(FOLDER_NAME).getId();
  props.setProperty('FOLDER_ID', folderId);
  const folder = DriveApp.getFolderById(folderId);

  if (!props.getProperty('SHEET_ID')) {
    const ss = SpreadsheetApp.create('Recados dos convidados');
    ss.getSheets()[0].setName('Recados')
      .appendRow(['Quando', 'Nome', 'Recado', 'Fotos enviadas', 'Primeira foto']);
    DriveApp.getFileById(ss.getId()).moveTo(folder);
    props.setProperty('SHEET_ID', ss.getId());
  }
  Logger.log('Pasta: ' + folder.getUrl());
}

function doGet() {
  return json_({ ok: true, msg: 'Envio de fotos no ar.' });
}

function doPost(e) {
  try {
    const req = JSON.parse(e.postData.contents);
    if (req.key !== EVENT_KEY) return json_({ ok: false, error: 'chave inválida' });

    const name = clean_(req.name, 60) || 'Convidado';
    const message = String(req.message || '').trim().slice(0, 2000);
    let link = '';

    if (req.data) {
      const bytes = Utilities.base64Decode(req.data);
      if (bytes.length > MAX_BYTES) return json_({ ok: false, error: 'arquivo grande demais' });
      const mime = String(req.mime || '');
      if (!/^(image|video)\//.test(mime)) return json_({ ok: false, error: 'tipo não aceito' });

      const ext = (String(req.filename || '').match(/\.[a-z0-9]{2,5}$/i) || ['.jpg'])[0].toLowerCase();
      const num = ('0' + ((req.index || 0) + 1)).slice(-2);
      // Tudo direto na pasta; a hora no começo do nome deixa as fotos em ordem e mostra quem mandou.
      const when = Utilities.formatDate(new Date(), TZ, "HH'h'mm");
      const folder = DriveApp.getFolderById(prop_('FOLDER_ID'));
      const file = folder.createFile(Utilities.newBlob(bytes, mime, when + ' - ' + name + ' - ' + num + ext));
      if (message) file.setDescription(name + ': ' + message);
      link = file.getUrl();
    }

    // Uma linha por envio: no primeiro arquivo (ou no recado sem foto).
    if (!req.data || !req.index) {
      const sheet = SpreadsheetApp.openById(prop_('SHEET_ID')).getSheetByName('Recados');
      sheet.appendRow([new Date(), cell_(name), cell_(message), req.data ? (req.total || 1) : 0, link]);
    }

    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

function prop_(k) {
  const v = PropertiesService.getScriptProperties().getProperty(k);
  if (!v) throw new Error('Rode setup() no editor do Apps Script antes de implantar.');
  return v;
}

function clean_(s, max) {
  return String(s || '').replace(/[\u0000-\u001f\/\\]/g, ' ').trim().slice(0, max);
}

// Impede que um recado começando com "=" vire fórmula na planilha.
function cell_(s) {
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// =====================================================
// GOOGLE APPS SCRIPT - API AGENDA DA PREFEITURA
// Cole este código em script.google.com → Novo Projeto
// Depois: Implantar → Nova Implantação → App da Web
//   - Executar como: Eu
//   - Quem pode acessar: Qualquer pessoa
// =====================================================

// Cole aqui o ID da sua planilha Google Sheets
const SPREADSHEET_ID = '1lBUTNecr5eylEn7958UQz8rUFLlHIcFeKcAf0--Jswo';

function doGet(e) { return handleRequest(e); }
function doPost(e) { return handleRequest(e); }

function handleRequest(e) {
  const output = ContentService.createTextOutput();
  output.setMimeType(ContentService.MimeType.JSON);

  try {
    const p = e.parameter || {};
    const action = p.action || '';

    switch (action) {
      case 'login':          return responder(handleLogin(p), output);
      case 'getEventos':     return responder(handleGetEventos(p), output);
      case 'criarEvento':    return responder(handleCriarEvento(p), output);
      case 'atualizarEvento':return responder(handleAtualizarEvento(p), output);
      case 'excluirEvento':  return responder(handleExcluirEvento(p), output);
      case 'getUsuarios':    return responder(handleGetUsuarios(p), output);
      case 'criarUsuario':   return responder(handleCriarUsuario(p), output);
      case 'resetarSenha':   return responder(handleResetarSenha(p), output);
      case 'excluirUsuario': return responder(handleExcluirUsuario(p), output);
      case 'debug':          return responder(handleDebug(), output);
      default:
        return responder({ error: 'Ação não encontrada: ' + action }, output);
    }
  } catch (err) {
    return responder({ error: err.toString() }, output);
  }
}

function responder(data, output) {
  output.setContent(JSON.stringify(data));
  return output;
}

// ── Helpers de planilha ──────────────────────────────────────────────────────

function getSheet(nome) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  return ss.getSheetByName(nome);
}

function lerAba(nome) {
  const sheet = getSheet(nome);
  if (!sheet) return { headers: [], rows: [] };
  const vals = sheet.getDataRange().getValues();
  if (vals.length < 1) return { headers: [], rows: [] };
  const headers = vals[0].map(String);
  const rows = vals.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = row[i]; });
    return obj;
  });
  return { headers, rows, sheet };
}

function proximoId(nome) {
  const { rows } = lerAba(nome);
  if (!rows.length) return 1;
  const ids = rows.map(r => Number(r.id) || 0);
  return Math.max(...ids) + 1;
}

function registrarLog(usuario, acao, detalhes) {
  try {
    const sheet = getSheet('logs');
    if (!sheet) return;
    sheet.appendRow([proximoId('logs'), new Date().toISOString(), usuario, acao, detalhes || '']);
  } catch (e) {}
}

// ── Token simples (Base64 JSON) ──────────────────────────────────────────────

function gerarToken(user) {
  const payload = {
    id: user.id, login: user.login, nome: user.nome,
    email: user.email, tipo: user.tipo, orgao: user.orgao,
    is_prefeito: String(user.is_prefeito).toUpperCase() === 'TRUE',
    exp: Date.now() + 86400000
  };
  return Utilities.base64Encode(JSON.stringify(payload));
}

function verificarToken(token) {
  if (!token) return null;
  try {
    const decoded = JSON.parse(Utilities.newBlob(Utilities.base64Decode(token)).getDataAsString());
    if (decoded.exp < Date.now()) return null;
    return decoded;
  } catch (e) {
    return null;
  }
}

// ── Login ────────────────────────────────────────────────────────────────────

function handleLogin(data) {
  const usuario = (data.usuario || '').trim();
  const senha   = (data.senha   || '').trim();
  if (!usuario || !senha) return { error: 'Usuário e senha são obrigatórios' };

  const { rows } = lerAba('usuarios');
  const usuarioLower = usuario.toLowerCase();
  const user = rows.find(r => {
    const loginOk = r.login === usuario ||
                    (r.email || '').toLowerCase() === usuarioLower ||
                    r.nome === usuario;
    const senhaOk  = (String(r.senha || '')).trim() === senha;
    const ativoVal = String(r.ativo || '').trim().toUpperCase();
    const ativoOk  = ativoVal === 'TRUE' || ativoVal === '1' || ativoVal === 'SIM';
    return loginOk && senhaOk && ativoOk;
  });

  if (!user) {
    registrarLog(usuario, 'login_falhou', 'Credenciais inválidas');
    return { error: 'Usuário ou senha incorretos' };
  }

  registrarLog(user.email, 'login', 'Login com sucesso');
  return {
    success: true,
    token: gerarToken(user),
    usuario: {
      id: user.id, nome: user.nome, email: user.email,
      tipo: user.tipo, orgao: user.orgao,
      is_prefeito: String(user.is_prefeito).toUpperCase() === 'TRUE'
    }
  };
}

// ── Eventos ──────────────────────────────────────────────────────────────────

function handleGetEventos(params) {
  const usuario = verificarToken(params.token);
  if (!usuario) return { error: 'Não autorizado' };

  const { rows } = lerAba('eventos');
  const filtrados = rows.filter(e => {
    if (!e.id) return false;
    if (usuario.tipo !== 'admin' && e.orgao !== usuario.orgao) return false;
    return true;
  });

  return filtrados;
}

function handleCriarEvento(data) {
  const usuario = verificarToken(data.token);
  if (!usuario) return { error: 'Não autorizado' };

  const { titulo, data_evento, local, responsavel, telefone, observacao, anexo_url, anexo_nome } = data;
  if (!titulo || !data_evento || !observacao) return { error: 'Título, data e observação são obrigatórios' };

  const sheet = getSheet('eventos');
  if (!sheet) return { error: 'Aba eventos não encontrada' };

  const id = proximoId('eventos');
  const now = new Date().toISOString();
  sheet.appendRow([
    id, titulo, data_evento, local || '', responsavel || '',
    telefone || '', observacao, anexo_url || '', anexo_nome || '',
    usuario.orgao,
    usuario.is_prefeito ? 'TRUE' : 'FALSE',
    usuario.nome, usuario.email, now, now, 'ativo'
  ]);

  registrarLog(usuario.email, 'criar_evento', titulo);
  return { success: true, id, message: 'Evento criado com sucesso' };
}

function handleAtualizarEvento(data) {
  const usuario = verificarToken(data.token);
  if (!usuario) return { error: 'Não autorizado' };

  const { rows, headers, sheet } = lerAba('eventos');
  const idx = rows.findIndex(r => String(r.id) === String(data.id));
  if (idx === -1) return { error: 'Evento não encontrado' };

  const evento = rows[idx];
  if (usuario.tipo !== 'admin' && evento.orgao !== usuario.orgao) return { error: 'Acesso negado' };

  const rowNum = idx + 2;
  const campos = ['titulo', 'data_evento', 'local', 'responsavel', 'telefone', 'observacao'];
  campos.forEach(campo => {
    if (data[campo] !== undefined) {
      const col = headers.indexOf(campo) + 1;
      if (col > 0) sheet.getRange(rowNum, col).setValue(data[campo]);
    }
  });
  const colAtu = headers.indexOf('data_atualizacao') + 1;
  if (colAtu > 0) sheet.getRange(rowNum, colAtu).setValue(new Date().toISOString());

  registrarLog(usuario.email, 'atualizar_evento', 'ID: ' + data.id);
  return { success: true, message: 'Evento atualizado' };
}

function handleExcluirEvento(data) {
  const usuario = verificarToken(data.token);
  if (!usuario) return { error: 'Não autorizado' };

  const { rows, sheet } = lerAba('eventos');
  const idx = rows.findIndex(r => String(r.id) === String(data.id));
  if (idx === -1) return { error: 'Evento não encontrado' };

  const evento = rows[idx];
  if (usuario.tipo !== 'admin' && evento.orgao !== usuario.orgao) return { error: 'Acesso negado' };

  sheet.deleteRow(idx + 2);
  registrarLog(usuario.email, 'excluir_evento', 'ID: ' + data.id);
  return { success: true, message: 'Evento excluído' };
}

// ── Usuários (admin only) ────────────────────────────────────────────────────

function handleGetUsuarios(data) {
  const admin = verificarToken(data.token);
  if (!admin || admin.tipo !== 'admin') return { error: 'Acesso negado' };

  const { rows } = lerAba('usuarios');
  return rows.map(u => { const c = Object.assign({}, u); delete c.senha; return c; });
}

function handleCriarUsuario(data) {
  const admin = verificarToken(data.token);
  if (!admin || admin.tipo !== 'admin') return { error: 'Acesso negado' };

  const login  = (data.login  || '').trim();
  const nome   = (data.nome   || '').trim();
  const email  = (data.email  || '').trim();
  const senha  = (data.senha  || '').trim();
  const orgao  = (data.orgao  || '').trim();
  // URL params chegam como string; 'false' é truthy — comparar explicitamente
  const isPref = String(data.is_prefeito).toLowerCase() === 'true' || orgao === 'Gabinete do Prefeito';

  if (!login || !nome || !email || !senha || !orgao) return { error: 'Todos os campos são obrigatórios' };

  const { rows, sheet } = lerAba('usuarios');
  if (rows.find(r => r.login === login || (r.email || '').toLowerCase() === email.toLowerCase())) {
    return { error: 'Login ou e-mail já existe' };
  }

  sheet.appendRow([
    proximoId('usuarios'), login, nome, email, senha, 'orgao', orgao,
    isPref ? 'TRUE' : 'FALSE', 'TRUE', new Date().toISOString()
  ]);

  registrarLog(admin.email, 'criar_usuario', login);
  return { success: true, message: 'Usuário criado' };
}

function handleResetarSenha(data) {
  const admin = verificarToken(data.token);
  if (!admin || admin.tipo !== 'admin') return { error: 'Acesso negado' };

  const { rows, headers, sheet } = lerAba('usuarios');
  const idx = rows.findIndex(r => String(r.id) === String(data.usuarioId));
  if (idx === -1) return { error: 'Usuário não encontrado' };

  const col = headers.indexOf('senha') + 1;
  sheet.getRange(idx + 2, col).setValue(data.novaSenha);

  registrarLog(admin.email, 'resetar_senha', 'ID: ' + data.usuarioId);
  return { success: true, message: 'Senha alterada' };
}

function handleExcluirUsuario(data) {
  const admin = verificarToken(data.token);
  if (!admin || admin.tipo !== 'admin') return { error: 'Acesso negado' };

  const { rows, sheet } = lerAba('usuarios');
  const idx = rows.findIndex(r => String(r.id) === String(data.id));
  if (idx === -1) return { error: 'Usuário não encontrado' };

  sheet.deleteRow(idx + 2);
  registrarLog(admin.email, 'excluir_usuario', 'ID: ' + data.id);
  return { success: true, message: 'Usuário excluído' };
}

// ── Função de teste (rodar manualmente para verificar conexão) ───────────────
function testarConexao() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  Logger.log('Planilha conectada: ' + ss.getName());
  const abas = ss.getSheets().map(s => s.getName());
  Logger.log('Abas encontradas: ' + abas.join(', '));
}

function testarLogin() {
  const { rows } = lerAba('usuarios');
  Logger.log('Total de usuários encontrados: ' + rows.length);
  rows.forEach((r, i) => {
    Logger.log(`Linha ${i+1}: login="${r.login}" | senha="${r.senha}" | ativo="${r.ativo}" (tipo: ${typeof r.ativo})`);
  });
  const resultado = handleLogin({ usuario: 'admin', senha: 'admin123' });
  Logger.log('Resultado do login: ' + JSON.stringify(resultado));
}

function handleDebug() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const abas = ss.getSheets().map(s => s.getName());
  const { headers, rows } = lerAba('usuarios');
  return {
    abas: abas,
    headers_usuarios: headers,
    total_usuarios: rows.length,
    primeiro_usuario: rows[0] ? {
      login: rows[0].login,
      senha: rows[0].senha,
      ativo: rows[0].ativo,
      tipo_ativo: typeof rows[0].ativo
    } : null
  };
}

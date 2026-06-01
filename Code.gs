// =====================================================
// GOOGLE APPS SCRIPT - API AGENDA DA PREFEITURA
// =====================================================

const SPREADSHEET_ID = '1lBUTNecr5eylEn7958UQz8rUFLlHIcFeKcAf0--Jswo';
const LIMITE_POR_SESSAO = 5;

function doGet(e)  { return handleRequest(e); }
function doPost(e) { return handleRequest(e); }

function handleRequest(e) {
  const output = ContentService.createTextOutput();
  output.setMimeType(ContentService.MimeType.JSON);
  try {
    const p = e.parameter || {};
    const action = p.action || '';
    switch (action) {
      case 'login':               return responder(handleLogin(p), output);
      case 'getEventos':          return responder(handleGetEventos(p), output);
      case 'criarEvento':         return responder(handleCriarEvento(p), output);
      case 'atualizarEvento':     return responder(handleAtualizarEvento(p), output);
      case 'excluirEvento':       return responder(handleExcluirEvento(p), output);
      case 'getUsuarios':         return responder(handleGetUsuarios(p), output);
      case 'criarUsuario':        return responder(handleCriarUsuario(p), output);
      case 'resetarSenha':        return responder(handleResetarSenha(p), output);
      case 'excluirUsuario':      return responder(handleExcluirUsuario(p), output);
      case 'solicitarAcesso':     return responder(handleSolicitarAcesso(p), output);
      case 'recuperarSenha':      return responder(handleRecuperarSenha(p), output);
      case 'getSolicitacoes':     return responder(handleGetSolicitacoes(p), output);
      case 'atualizarSolicitacao':return responder(handleAtualizarSolicitacao(p), output);
      default: return responder({ error: 'Ação não encontrada: ' + action }, output);
    }
  } catch (err) {
    return responder({ error: err.toString() }, output);
  }
}

function responder(data, output) {
  output.setContent(JSON.stringify(data));
  return output;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function getSheet(nome) {
  return SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(nome);
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
  return Math.max(...rows.map(r => Number(r.id) || 0)) + 1;
}

function registrarLog(usuario, acao, detalhes) {
  try {
    const sheet = getSheet('logs');
    if (!sheet) return;
    sheet.appendRow([proximoId('logs'), new Date().toISOString(), usuario, acao, detalhes || '']);
  } catch (e) {}
}

// ── Token ────────────────────────────────────────────────────────────────────

function gerarToken(user) {
  const payload = {
    id: user.id, login: user.login, nome: user.nome, email: user.email,
    tipo: user.tipo, orgao: user.orgao,
    is_prefeito: user.tipo === 'prefeito' || String(user.is_prefeito).toUpperCase() === 'TRUE',
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
  } catch (e) { return null; }
}

// ── Login ────────────────────────────────────────────────────────────────────

function handleLogin(data) {
  const { usuario, senha } = data;
  if (!usuario || !senha) return { error: 'Usuário e senha são obrigatórios' };

  const { rows } = lerAba('usuarios');
  const user = rows.find(r =>
    (r.login === usuario || r.email === usuario || r.nome === usuario) &&
    r.senha === senha && String(r.ativo).toUpperCase() === 'TRUE'
  );

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
      is_prefeito: user.tipo === 'prefeito' || String(user.is_prefeito).toUpperCase() === 'TRUE'
    }
  };
}

// ── Eventos ──────────────────────────────────────────────────────────────────

function handleGetEventos(params) {
  const usuario = verificarToken(params.token);
  if (!usuario) return { error: 'Não autorizado' };

  const { rows } = lerAba('eventos');
  return rows.filter(e => {
    if (!e.id) return false;
    if (usuario.tipo === 'admin' || usuario.tipo === 'prefeito') return true;
    return e.orgao === usuario.orgao;
  });
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
  const orgaoEvento = usuario.tipo === 'prefeito' ? 'Gabinete do Prefeito' : usuario.orgao;

  sheet.appendRow([
    id, titulo, data_evento, local || '', responsavel || '',
    telefone || '', observacao, anexo_url || '', anexo_nome || '',
    orgaoEvento,
    (usuario.tipo === 'prefeito' || usuario.is_prefeito) ? 'TRUE' : 'FALSE',
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
  ['titulo', 'data_evento', 'local', 'responsavel', 'telefone', 'observacao'].forEach(campo => {
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

  if (usuario.tipo !== 'admin' && rows[idx].orgao !== usuario.orgao) return { error: 'Acesso negado' };

  sheet.deleteRow(idx + 2);
  registrarLog(usuario.email, 'excluir_evento', 'ID: ' + data.id);
  return { success: true, message: 'Evento excluído' };
}

// ── Usuários ─────────────────────────────────────────────────────────────────

function handleGetUsuarios(data) {
  const admin = verificarToken(data.token);
  if (!admin || admin.tipo !== 'admin') return { error: 'Acesso negado' };

  const { rows } = lerAba('usuarios');
  return rows.map(u => { const c = Object.assign({}, u); delete c.senha; return c; });
}

function handleCriarUsuario(data) {
  const admin = verificarToken(data.token);
  if (!admin || admin.tipo !== 'admin') return { error: 'Acesso negado' };

  const { login, nome, email, senha, tipo, orgao } = data;
  if (!login || !nome || !email || !senha || !tipo) return { error: 'Todos os campos são obrigatórios' };

  const tiposValidos = ['admin', 'prefeito', 'orgao'];
  if (!tiposValidos.includes(tipo)) return { error: 'Tipo de sessão inválido. Use: admin, prefeito ou orgao' };
  if (tipo === 'orgao' && !orgao) return { error: 'Órgão é obrigatório para sessão de órgão' };

  const { rows, sheet } = lerAba('usuarios');
  if (rows.find(r => r.login === login || r.email === email)) return { error: 'Login ou e-mail já existe' };

  // Limite de 5 usuários por sessão
  let count;
  if (tipo === 'admin')    count = rows.filter(r => r.tipo === 'admin').length;
  else if (tipo === 'prefeito') count = rows.filter(r => r.tipo === 'prefeito').length;
  else count = rows.filter(r => r.tipo === 'orgao' && r.orgao === orgao).length;

  if (count >= LIMITE_POR_SESSAO) {
    const label = tipo === 'admin' ? 'Administrador' : tipo === 'prefeito' ? 'Prefeito' : `"${orgao}"`;
    return { error: `Limite de ${LIMITE_POR_SESSAO} usuários atingido para a sessão ${label}` };
  }

  const orgaoFinal = tipo === 'prefeito' ? 'Gabinete do Prefeito' : (tipo === 'admin' ? '' : orgao);

  sheet.appendRow([
    proximoId('usuarios'), login, nome, email, senha,
    tipo, orgaoFinal,
    tipo === 'prefeito' ? 'TRUE' : 'FALSE',
    'TRUE', new Date().toISOString()
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

// ── Solicitar Acesso (público, sem autenticação) ──────────────────────────────

function handleSolicitarAcesso(data) {
  const { nome, email, login, telefone, orgao, justificativa } = data;
  if (!nome || !email || !login || !orgao) return { error: 'Nome, e-mail, login e órgão são obrigatórios' };

  const { rows } = lerAba('usuarios');
  if (rows.find(r => r.login === login || r.email === email)) {
    return { error: 'Login ou e-mail já está em uso' };
  }

  let sheet = getSheet('solicitacoes');
  if (!sheet) {
    sheet = SpreadsheetApp.openById(SPREADSHEET_ID).insertSheet('solicitacoes');
    sheet.appendRow(['id','nome','email','login','telefone','orgao','justificativa','status','tipoSolicitacao','data_solicitacao']);
  }

  sheet.appendRow([
    proximoId('solicitacoes'), nome, email, login,
    telefone || '', orgao, justificativa || '',
    'pendente', 'acesso', new Date().toISOString()
  ]);

  return { success: true, message: 'Solicitação registrada com sucesso' };
}

// ── Recuperar Senha (público, sem autenticação) ───────────────────────────────

function handleRecuperarSenha(data) {
  const { login } = data;
  if (!login) return { error: 'Informe seu login ou e-mail' };

  const { rows } = lerAba('usuarios');
  const user = rows.find(r => r.login === login || r.email === login);
  if (!user) return { error: 'Usuário não encontrado. Verifique o login ou contate o administrador.' };

  let sheet = getSheet('solicitacoes');
  if (!sheet) {
    sheet = SpreadsheetApp.openById(SPREADSHEET_ID).insertSheet('solicitacoes');
    sheet.appendRow(['id','nome','email','login','telefone','orgao','justificativa','status','tipoSolicitacao','data_solicitacao']);
  }

  sheet.appendRow([
    proximoId('solicitacoes'), user.nome, user.email, user.login,
    '', user.orgao || '', 'Recuperação de senha solicitada pelo usuário',
    'pendente', 'recuperacao', new Date().toISOString()
  ]);

  return { success: true, message: 'Solicitação registrada. O administrador entrará em contato.' };
}

// ── Gerenciar Solicitações (admin) ────────────────────────────────────────────

function handleGetSolicitacoes(data) {
  const admin = verificarToken(data.token);
  if (!admin || admin.tipo !== 'admin') return { error: 'Acesso negado' };

  const { rows } = lerAba('solicitacoes');
  return rows.sort((a, b) => new Date(b.data_solicitacao) - new Date(a.data_solicitacao));
}

function handleAtualizarSolicitacao(data) {
  const admin = verificarToken(data.token);
  if (!admin || admin.tipo !== 'admin') return { error: 'Acesso negado' };

  const { rows, headers, sheet } = lerAba('solicitacoes');
  const idx = rows.findIndex(r => String(r.id) === String(data.id));
  if (idx === -1) return { error: 'Solicitação não encontrada' };

  const col = headers.indexOf('status') + 1;
  if (col > 0) sheet.getRange(idx + 2, col).setValue(data.status);

  registrarLog(admin.email, 'atualizar_solicitacao', `ID ${data.id} → ${data.status}`);
  return { success: true };
}

// ── Testes ────────────────────────────────────────────────────────────────────

function testarConexao() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  Logger.log('Planilha: ' + ss.getName());
  Logger.log('Abas: ' + ss.getSheets().map(s => s.getName()).join(', '));
}

function testarLogin() {
  const { rows } = lerAba('usuarios');
  Logger.log('Usuários: ' + rows.length);
  rows.forEach((r, i) => Logger.log(`${i+1}: login="${r.login}" tipo="${r.tipo}" ativo="${r.ativo}"`));
  Logger.log('Teste admin: ' + JSON.stringify(handleLogin({ usuario: 'admin', senha: 'admin123' })));
}

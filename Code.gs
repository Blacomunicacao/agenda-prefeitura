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
    let p = Object.assign({}, e.parameter || {});
    if (e.postData && e.postData.contents) {
      try { p = Object.assign({}, p, JSON.parse(e.postData.contents)); } catch(ex) {}
    }
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
      case 'setup':               return responder(criarAbas(), output);
      case 'primeiroAdmin':       return responder(handlePrimeiroAdmin(p), output);
      default: return responder({ error: 'Acao nao encontrada: ' + action }, output);
    }
  } catch (err) {
    return responder({ error: err.toString() }, output);
  }
}

function responder(data, output) {
  output.setContent(JSON.stringify(data));
  return output;
}

// ── Organograma oficial: nome completo → sigla ───────────────────────────────
var SIGLAS_ORGAOS = {
  'Gabinete do Prefeito':'PREFEITO','Chefia de Gabinete':'GABINETE',
  'Secretaria de Administração':'SECAD','Secretaria de Agricultura e Abastecimento':'SEAGRI',
  'Secretaria de Assistência Social':'SAS','Secretaria de Assuntos Jurídicos e Legislativos':'SEAJUR',
  'Secretaria de Comunicação':'SECOM','Secretaria de Cultura':'SECULT',
  'Secretaria de Desenvolvimento Econômico':'SEDEPP','Secretaria de Educação':'SEDUC',
  'Secretaria de Esporte':'SEMEPP','Secretaria de Finanças':'SEFIN',
  'Secretaria de Meio Ambiente':'SEMEA',
  'Secretaria de Mobilidade Urbana e Cooperação em Segurança Pública':'SEMOB',
  'Secretaria de Obras e Serviços Públicos':'SOSP',
  'Secretaria de Planejamento, Desenvolvimento Urbano e Habitação':'SEPLAN',
  'Secretaria de Saúde':'SESAU','Secretaria de Tecnologia da Informação':'SETEC',
  'Secretaria de Turismo':'SETUR',
  'Conselho de Acompanhamento e Controle Social do FUNDEB e de Valorização dos Professores da Educação':'CACS-FUNDEB',
  'Conselho de Governança Pública':'CGOV','Conselho Deliberativo do Fundo Social de Solidariedade':'CDFSS',
  'Conselho Municipal Antidrogas':'COMAD','Conselho Municipal da Assistência Social de Presidente Prudente':'CMAS',
  'Conselho Municipal da Condição Feminina':'CMCF','Conselho Municipal da Habitação de Interesse Social':'CMHIS',
  'Conselho Municipal da Igualdade Racial':'COMIR','Conselho Municipal da Juventude':'COMJUVE',
  'Conselho Municipal da Pessoa com Deficiência':'COMDEF','Conselho Municipal de Alimentação Escolar':'CAE',
  'Conselho Municipal de Ciência, Tecnologia e Inovação':'CMCTI','Conselho Municipal de Desenvolvimento Rural':'CMDR',
  'Conselho Municipal de Educação de Presidente Prudente':'COMED',
  'Conselho Municipal de Patrimônio Histórico, Artístico, Arqueológico e Turístico':'CMPHAAT',
  'Conselho Municipal de Planejamento':'CMP','Conselho Municipal de Política Cultural de Presidente Prudente':'CMPC',
  'Conselho Municipal de Saúde':'CMS','Conselho Municipal de Segurança Alimentar e Nutricional':'COMSEA',
  'Conselho Municipal de Turismo':'COMTUR','Conselho Municipal do Idoso':'CMI',
  'Conselho Municipal do Meio Ambiente':'CMMA',
  'Conselho Municipal dos Direitos da Criança e do Adolescente':'CMDCA',
  'Conselho Tutelar de Presidente Prudente':'CTPP',
  'Comissão Interna de Prevenção de Acidentes e Assédio':'CIPA','Comitê Gestor da Praça CEU':'CGPCEU',
  'Controladoria Geral do Município':'CGM','Controladoria-Geral do Município':'CGM',
  'Coordenadoria da Juventude':'JUVENTUDE','Coordenadoria da Pessoa com Deficiência':'CPD',
  'Coordenadoria de Proteção e Defesa Civil':'COMPDEC','Coordenadoria Municipal do Idoso':'IDOSOPP',
  'Instituto do Idoso de Presidente Prudente':'IDOSOPP',
  'Fundo Municipal de Defesa dos Interesses Difusos':'FMDID',
  'Fundo Social de Solidariedade de Presidente Prudente':'FUNDO',
  'Núcleo da Escola Federativa do Município de Presidente Prudente':'NEF',
  'Serviço Especializado em Engenharia de Segurança e em Medicina do Trabalho':'SESMT'
};

function getSiglaOrgao(orgao) {
  if (!orgao) return '';
  // NFC normaliza representações diferentes de acentos (ã, ç, é…) vindos da planilha
  var norm = String(orgao).trim().normalize('NFC');
  if (SIGLAS_ORGAOS[norm]) return SIGLAS_ORGAOS[norm];
  var lower = norm.toLowerCase();
  var keys = Object.keys(SIGLAS_ORGAOS);
  for (var i = 0; i < keys.length; i++) {
    if (keys[i].normalize('NFC').toLowerCase() === lower) return SIGLAS_ORGAOS[keys[i]];
  }
  // Retorna '' para que o frontend use seu próprio lookup com fallback
  return '';
}

// Helpers
function getSheet(nome) {
  return SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(nome);
}

function lerAba(nome) {
  const sheet = getSheet(nome);
  if (!sheet) return { headers: [], rows: [] };
  const vals = sheet.getDataRange().getValues();
  if (vals.length < 1) return { headers: [], rows: [] };
  const headers = vals[0].map(String);
  const rows = vals.slice(1).map(function(row) {
    const obj = {};
    headers.forEach(function(h, i) { obj[h] = row[i]; });
    return obj;
  });
  return { headers: headers, rows: rows, sheet: sheet };
}

function proximoId(nome) {
  const data = lerAba(nome);
  if (!data.rows.length) return 1;
  return Math.max.apply(null, data.rows.map(function(r) { return Number(r.id) || 0; })) + 1;
}

function registrarLog(usuario, acao, detalhes) {
  try {
    const sheet = getSheet('logs');
    if (!sheet) return;
    sheet.appendRow([proximoId('logs'), new Date().toISOString(), usuario, acao, detalhes || '']);
  } catch (e) {}
}

// Token
function gerarToken(user) {
  const payload = {
    id: user.id, login: user.login, nome: user.nome, email: user.email,
    tipo: user.tipo, orgao: user.orgao,
    is_prefeito: user.tipo === 'prefeito' || String(user.is_prefeito).toUpperCase() === 'TRUE',
    exp: Date.now() + 86400000
  };
  // Charset.UTF_8 garante que acentos/ç sejam corretamente codificados
  return Utilities.base64Encode(JSON.stringify(payload), Utilities.Charset.UTF_8);
}

function verificarToken(token) {
  if (!token) return null;
  try {
    const bytes = Utilities.base64Decode(token);
    const decoded = JSON.parse(Utilities.newBlob(bytes).getDataAsString('UTF-8'));
    if (decoded.exp < Date.now()) return null;
    return decoded;
  } catch (e) { return null; }
}

// Login
function handleLogin(data) {
  const usuario = data.usuario;
  const senha = data.senha;
  if (!usuario || !senha) return { error: 'Usuário e senha são obrigatórios' };

  const u = String(usuario).toLowerCase().trim();
  const rows = lerAba('usuarios').rows;
  var user = null;
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    var rLogin = String(r.login || '').normalize('NFC').toLowerCase().trim();
    var rEmail = String(r.email || '').normalize('NFC').toLowerCase().trim();
    var rNome  = String(r.nome  || '').normalize('NFC').toLowerCase().trim();
    if ((rLogin === u || rEmail === u || rNome === u) &&
        String(r.senha || '').trim() === String(senha || '').trim() &&
        String(r.ativo).toUpperCase() === 'TRUE') {
      user = r;
      break;
    }
  }

  if (!user) {
    registrarLog(usuario, 'login_falhou', 'Credenciais invalidas');
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

// Eventos
function handleGetEventos(params) {
  const usuario = verificarToken(params.token);
  if (!usuario) return { error: 'Não autorizado' };

  const eventosRows = lerAba('eventos').rows;
  const usuariosRows = lerAba('usuarios').rows;

  const filtrados = eventosRows.filter(function(e) {
    if (!e.id) return false;
    if (usuario.tipo === 'admin' || usuario.tipo === 'prefeito') return true;
    return String(e.orgao || '').trim() === String(usuario.orgao || '').trim();
  });

  // Enriquece publicado_por com o login atual (coluna B da aba usuarios)
  return filtrados.map(function(e) {
    const emailRef = String(e.email_publicado || '').trim().toLowerCase();
    const loginRef = String(e.publicado_por  || '').trim().toLowerCase();
    var pubUser = null;
    for (var i = 0; i < usuariosRows.length; i++) {
      var u = usuariosRows[i];
      const uEmail = String(u.email || '').toLowerCase();
      const uLogin = String(u.login || '').toLowerCase();
      if ((emailRef && uEmail === emailRef) || (loginRef && uLogin === loginRef)) {
        pubUser = u;
        break;
      }
    }
    var ev = {};
    for (var k in e) { ev[k] = e[k]; }
    ev.sigla_orgao = getSiglaOrgao(e.orgao); // coluna do organograma
    if (pubUser) {
      ev.publicado_por = pubUser.login; // coluna B da planilha de usuarios
    }
    return ev;
  });
}

function handleCriarEvento(data) {
  const usuario = verificarToken(data.token);
  if (!usuario) return { error: 'Não autorizado' };

  const titulo = data.titulo;
  const data_evento = data.data_evento;
  const local = data.local;
  const responsavel = data.responsavel;
  const telefone = data.telefone;
  const observacao = data.observacao;

  if (!titulo || !data_evento || !observacao) return { error: 'Título, data e observação são obrigatórios' };

  const dataEvt = new Date(data_evento);
  if (dataEvt < new Date()) return { error: 'Não é permitido criar eventos com data ou hora retroativa.' };

  const sheet = getSheet('eventos');
  if (!sheet) return { error: 'Aba eventos não encontrada' };

  var anexo_url = '', anexo_nome = '';
  if (data.arquivo_base64 && data.arquivo_nome) {
    try {
      const bytes = Utilities.base64Decode(data.arquivo_base64);
      const mimeType = data.arquivo_tipo || 'application/octet-stream';
      const blob = Utilities.newBlob(bytes, mimeType, data.arquivo_nome);
      const pastaNome = 'Agenda Prefeitura Anexos';
      const pastas = DriveApp.getFoldersByName(pastaNome);
      const pasta = pastas.hasNext() ? pastas.next() : DriveApp.createFolder(pastaNome);
      const file = pasta.createFile(blob);
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      anexo_url = 'https://drive.google.com/file/d/' + file.getId() + '/view';
      anexo_nome = data.arquivo_nome;
    } catch(driveErr) {
      return { error: 'Erro ao salvar anexo. Execute autorizarDrive() no editor para liberar permissões.' };
    }
  }

  const id = proximoId('eventos');
  const now = new Date().toISOString();
  const orgaoEvento = usuario.tipo === 'prefeito' ? 'Gabinete do Prefeito' : usuario.orgao;

  sheet.appendRow([
    id, titulo, data_evento, local || '', responsavel || '',
    telefone || '', observacao, anexo_url, anexo_nome,
    orgaoEvento,
    (usuario.tipo === 'prefeito' || usuario.is_prefeito) ? 'TRUE' : 'FALSE',
    usuario.login, usuario.email, now, now, 'ativo'
  ]);

  registrarLog(usuario.email, 'criar_evento', titulo);
  return { success: true, id: id, message: 'Evento criado com sucesso' };
}

function handleAtualizarEvento(data) {
  const usuario = verificarToken(data.token);
  if (!usuario) return { error: 'Não autorizado' };

  const aba = lerAba('eventos');
  const rows = aba.rows;
  const headers = aba.headers;
  const sheet = aba.sheet;
  var idx = -1;
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i].id) === String(data.id)) { idx = i; break; }
  }
  if (idx === -1) return { error: 'Evento não encontrado' };

  if (usuario.tipo !== 'admin' && rows[idx].orgao !== usuario.orgao) return { error: 'Acesso negado' };

  const rowNum = idx + 2;
  const campos = ['titulo', 'data_evento', 'local', 'responsavel', 'telefone', 'observacao'];
  for (var c = 0; c < campos.length; c++) {
    var campo = campos[c];
    if (data[campo] !== undefined) {
      const col = headers.indexOf(campo) + 1;
      if (col > 0) sheet.getRange(rowNum, col).setValue(data[campo]);
    }
  }
  const colAtu = headers.indexOf('data_atualizacao') + 1;
  if (colAtu > 0) sheet.getRange(rowNum, colAtu).setValue(new Date().toISOString());

  registrarLog(usuario.email, 'atualizar_evento', 'ID: ' + data.id);
  return { success: true, message: 'Evento atualizado' };
}

function handleExcluirEvento(data) {
  const usuario = verificarToken(data.token);
  if (!usuario) return { error: 'Não autorizado' };

  const aba = lerAba('eventos');
  const rows = aba.rows;
  const sheet = aba.sheet;
  var idx = -1;
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i].id) === String(data.id)) { idx = i; break; }
  }
  if (idx === -1) return { error: 'Evento não encontrado' };

  if (usuario.tipo !== 'admin' && rows[idx].orgao !== usuario.orgao) return { error: 'Acesso negado' };

  sheet.deleteRow(idx + 2);
  registrarLog(usuario.email, 'excluir_evento', 'ID: ' + data.id);
  return { success: true, message: 'Evento excluído' };
}

// Usuarios
function handleGetUsuarios(data) {
  const admin = verificarToken(data.token);
  if (!admin || admin.tipo !== 'admin') return { error: 'Acesso negado' };

  const rows = lerAba('usuarios').rows;
  return rows.map(function(u) { const c = Object.assign({}, u); delete c.senha; return c; });
}

function handleCriarUsuario(data) {
  const admin = verificarToken(data.token);
  if (!admin || admin.tipo !== 'admin') return { error: 'Acesso negado' };

  const login = data.login;
  const nome = data.nome;
  const email = data.email;
  const senha = data.senha;
  const tipo = data.tipo;
  const orgao = data.orgao;

  if (!login || !nome || !email || !senha || !tipo) return { error: 'Todos os campos são obrigatórios' };

  const tiposValidos = ['admin', 'prefeito', 'orgao'];
  if (tiposValidos.indexOf(tipo) === -1) return { error: 'Tipo inválido. Use: admin, prefeito ou orgao' };
  if (tipo === 'orgao' && !orgao) return { error: 'Órgão é obrigatório para sessão de órgão' };

  const aba = lerAba('usuarios');
  const rows = aba.rows;
  const sheet = aba.sheet;
  for (var i = 0; i < rows.length; i++) {
    if (rows[i].login === login || rows[i].email === email) return { error: 'Login ou e-mail já existe' };
  }

  var count = 0;
  for (var j = 0; j < rows.length; j++) {
    if (tipo === 'admin' && rows[j].tipo === 'admin') count++;
    else if (tipo === 'prefeito' && rows[j].tipo === 'prefeito') count++;
    else if (tipo === 'orgao' && rows[j].tipo === 'orgao' && rows[j].orgao === orgao) count++;
  }

  if (count >= LIMITE_POR_SESSAO) {
    const label = tipo === 'admin' ? 'Administrador' : tipo === 'prefeito' ? 'Prefeito' : orgao;
    return { error: 'Limite de ' + LIMITE_POR_SESSAO + ' usuários atingido para ' + label };
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

  const aba = lerAba('usuarios');
  const rows = aba.rows;
  const headers = aba.headers;
  const sheet = aba.sheet;
  var idx = -1;
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i].id) === String(data.usuarioId)) { idx = i; break; }
  }
  if (idx === -1) return { error: 'Usuário não encontrado' };

  const col = headers.indexOf('senha') + 1;
  sheet.getRange(idx + 2, col).setValue(data.novaSenha);
  registrarLog(admin.email, 'resetar_senha', 'ID: ' + data.usuarioId);
  return { success: true, message: 'Senha alterada' };
}

function handleExcluirUsuario(data) {
  const admin = verificarToken(data.token);
  if (!admin || admin.tipo !== 'admin') return { error: 'Acesso negado' };

  const aba = lerAba('usuarios');
  const rows = aba.rows;
  const sheet = aba.sheet;
  var idx = -1;
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i].id) === String(data.id)) { idx = i; break; }
  }
  if (idx === -1) return { error: 'Usuário não encontrado' };

  sheet.deleteRow(idx + 2);
  registrarLog(admin.email, 'excluir_usuario', 'ID: ' + data.id);
  return { success: true, message: 'Usuário excluído' };
}

// Solicitar Acesso (publico)
function handleSolicitarAcesso(data) {
  const nome = data.nome;
  const email = data.email;
  const login = data.login;
  const telefone = data.telefone;
  const orgao = data.orgao;
  const justificativa = data.justificativa;
  const senha = data.senha || '';
  if (!nome || !email || !login || !orgao) return { error: 'Nome, e-mail, login e orgao sao obrigatorios' };

  const rows = lerAba('usuarios').rows;
  for (var i = 0; i < rows.length; i++) {
    if (rows[i].login === login || rows[i].email === email) return { error: 'Login ou e-mail já está em uso' };
  }

  var sheet = getSheet('solicitacoes');
  if (!sheet) {
    sheet = SpreadsheetApp.openById(SPREADSHEET_ID).insertSheet('solicitacoes');
    sheet.appendRow(['id','nome','email','login','telefone','orgao','justificativa','status','tipoSolicitacao','data_solicitacao','senha']);
  } else {
    // Garante que a coluna 'senha' existe no cabeçalho (aba pode ter sido criada sem ela)
    var headerRow = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
    if (headerRow.indexOf('senha') === -1) {
      sheet.getRange(1, sheet.getLastColumn() + 1).setValue('senha');
    }
  }

  // Usa lerAba para garantir que a senha vai para a coluna certa
  var aba = lerAba('solicitacoes');
  var headers = aba.headers;
  var rowData = new Array(headers.length).fill('');
  rowData[headers.indexOf('id')]               = proximoId('solicitacoes');
  rowData[headers.indexOf('nome')]             = nome;
  rowData[headers.indexOf('email')]            = email;
  rowData[headers.indexOf('login')]            = login;
  rowData[headers.indexOf('telefone')]         = telefone || '';
  rowData[headers.indexOf('orgao')]            = orgao;
  rowData[headers.indexOf('justificativa')]    = justificativa || '';
  rowData[headers.indexOf('status')]           = 'pendente';
  rowData[headers.indexOf('tipoSolicitacao')]  = 'acesso';
  rowData[headers.indexOf('data_solicitacao')] = new Date().toISOString();
  rowData[headers.indexOf('senha')]            = senha;
  sheet.appendRow(rowData);

  return { success: true, message: 'Solicitação registrada com sucesso' };
}

// Recuperar Senha (publico)
function handleRecuperarSenha(data) {
  const login = data.login;
  if (!login) return { error: 'Informe seu login ou e-mail' };

  const rows = lerAba('usuarios').rows;
  var user = null;
  for (var i = 0; i < rows.length; i++) {
    if (rows[i].login === login || rows[i].email === login) { user = rows[i]; break; }
  }
  if (!user) return { error: 'Usuário não encontrado. Verifique o login ou contate o administrador.' };

  var sheet = getSheet('solicitacoes');
  if (!sheet) {
    sheet = SpreadsheetApp.openById(SPREADSHEET_ID).insertSheet('solicitacoes');
    sheet.appendRow(['id','nome','email','login','telefone','orgao','justificativa','status','tipoSolicitacao','data_solicitacao']);
  }

  sheet.appendRow([
    proximoId('solicitacoes'), user.nome, user.email, user.login,
    '', user.orgao || '', 'Recuperacao de senha solicitada pelo usuario',
    'pendente', 'recuperacao', new Date().toISOString()
  ]);

  return { success: true, message: 'Solicitação registrada. O administrador entrará em contato.' };
}

// Gerenciar Solicitacoes (admin)
function handleGetSolicitacoes(data) {
  const admin = verificarToken(data.token);
  if (!admin || admin.tipo !== 'admin') return { error: 'Acesso negado' };

  const rows = lerAba('solicitacoes').rows;
  return rows.sort(function(a, b) { return new Date(b.data_solicitacao) - new Date(a.data_solicitacao); });
}

function handleAtualizarSolicitacao(data) {
  const admin = verificarToken(data.token);
  if (!admin || admin.tipo !== 'admin') return { error: 'Acesso negado' };

  const aba = lerAba('solicitacoes');
  const rows = aba.rows;
  const headers = aba.headers;
  const sheet = aba.sheet;
  var idx = -1;
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i].id) === String(data.id)) { idx = i; break; }
  }
  if (idx === -1) return { error: 'Solicitação não encontrada' };

  const col = headers.indexOf('status') + 1;
  if (col > 0) sheet.getRange(idx + 2, col).setValue(data.status);

  registrarLog(admin.email, 'atualizar_solicitacao', 'ID ' + data.id + ' -> ' + data.status);
  return { success: true };
}

// Primeiro Admin
function handlePrimeiroAdmin(data) {
  const login = data.login;
  const senha = data.senha;
  const nome = data.nome;
  const email = data.email;
  if (!login || !senha) return { error: 'Login e senha são obrigatórios' };

  const aba = lerAba('usuarios');
  const rows = aba.rows;
  const sheet = aba.sheet;
  for (var i = 0; i < rows.length; i++) {
    if (rows[i].tipo === 'admin') return { error: 'Já existe um administrador. Use o painel para criar novos usuários.' };
  }

  sheet.appendRow([
    1, login, nome || login, email || (login + '@prefeitura.gov.br'),
    senha, 'admin', '', 'FALSE', 'TRUE', new Date().toISOString()
  ]);

  return { success: true, message: 'Administrador "' + login + '" criado com sucesso!' };
}

// Setup inicial das abas
function criarAbas() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const config = {
    usuarios:     ['id','login','nome','email','senha','tipo','orgao','is_prefeito','ativo','data_criacao'],
    eventos:      ['id','titulo','data_evento','local','responsavel','telefone','observacao','anexo_url','anexo_nome','orgao','is_prefeito','publicado_por','email_publicado','data_publicacao','data_atualizacao','status'],
    logs:         ['id','data','usuario','acao','detalhes'],
    solicitacoes: ['id','nome','email','login','telefone','orgao','justificativa','status','tipoSolicitacao','data_solicitacao','senha']
  };
  const resultado = [];
  const nomes = Object.keys(config);
  for (var i = 0; i < nomes.length; i++) {
    const nome = nomes[i];
    if (!ss.getSheetByName(nome)) {
      const s = ss.insertSheet(nome);
      s.appendRow(config[nome]);
      resultado.push('criada: ' + nome);
    } else {
      resultado.push('ja existe: ' + nome);
    }
  }
  return { success: true, abas: resultado };
}

// Autorizar Drive (execute manualmente uma vez)
function autorizarDrive() {
  const pastaNome = 'Agenda Prefeitura Anexos';
  const pastas = DriveApp.getFoldersByName(pastaNome);
  const pasta = pastas.hasNext() ? pastas.next() : DriveApp.createFolder(pastaNome);
  Logger.log('Drive autorizado. Pasta: ' + pasta.getName() + ' | ID: ' + pasta.getId());
}

// Testes
function testarConexao() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  Logger.log('Planilha: ' + ss.getName());
  const abas = ss.getSheets();
  const nomes = [];
  for (var i = 0; i < abas.length; i++) { nomes.push(abas[i].getName()); }
  Logger.log('Abas: ' + nomes.join(', '));
}

function testarLogin() {
  const rows = lerAba('usuarios').rows;
  Logger.log('Usuarios: ' + rows.length);
  for (var i = 0; i < rows.length; i++) {
    Logger.log((i+1) + ': login="' + rows[i].login + '" tipo="' + rows[i].tipo + '" ativo="' + rows[i].ativo + '"');
  }
  Logger.log('Teste admin: ' + JSON.stringify(handleLogin({ usuario: 'admin', senha: 'admin123' })));
}

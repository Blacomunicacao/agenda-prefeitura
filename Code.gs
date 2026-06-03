// =====================================================
// GOOGLE APPS SCRIPT - API AGENDA DA PREFEITURA
// =====================================================

const SPREADSHEET_ID = '1lBUTNecr5eylEn7958UQz8rUFLlHIcFeKcAf0--Jswo';
const LIMITE_POR_SESSAO = 5;

function getLimitePorOrgao(orgao) {
  if (getSiglaOrgao(orgao) === 'SECOM') return 12;
  return LIMITE_POR_SESSAO;
}

// ── LockService: serializa escritas concorrentes ─────────────────────────────
function comLock(fn) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    return fn();
  } catch (e) {
    if (e.message && e.message.indexOf('Timed out') !== -1) {
      return { error: 'Servidor ocupado. Tente novamente em instantes.' };
    }
    throw e;
  } finally {
    try { lock.releaseLock(); } catch (e2) {}
  }
}

// ── CacheService: invalida cache após escritas ────────────────────────────────
function invalidarCache(nomes) {
  try {
    var cache = CacheService.getScriptCache();
    cache.removeAll(nomes.map(function(n) { return 'aba_' + n; }));
  } catch (e) {}
}

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
  var norm = String(orgao).trim().normalize('NFC');
  if (SIGLAS_ORGAOS[norm]) return SIGLAS_ORGAOS[norm];
  var lower = norm.toLowerCase();
  var keys = Object.keys(SIGLAS_ORGAOS);
  for (var i = 0; i < keys.length; i++) {
    if (keys[i].normalize('NFC').toLowerCase() === lower) return SIGLAS_ORGAOS[keys[i]];
  }
  return '';
}

// ── Helpers de planilha ──────────────────────────────────────────────────────

function getSheet(nome) {
  return SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(nome);
}

// lerAba com CacheService: serve dados do cache (TTL 5 min) e só lê
// a planilha quando o cache estiver vazio ou após uma escrita invalidá-lo.
function lerAba(nome) {
  var cache = CacheService.getScriptCache();
  var cacheKey = 'aba_' + nome;
  var cached = cache.get(cacheKey);
  if (cached) {
    try {
      var parsed = JSON.parse(cached);
      return { headers: parsed.headers, rows: parsed.rows, sheet: getSheet(nome) };
    } catch (e) {}
  }
  var sheet = getSheet(nome);
  if (!sheet) return { headers: [], rows: [], sheet: null };
  var vals = sheet.getDataRange().getValues();
  if (vals.length < 1) return { headers: [], rows: [], sheet: sheet };
  var headers = vals[0].map(String);
  var rows = vals.slice(1).map(function(row) {
    var obj = {};
    headers.forEach(function(h, i) { obj[h] = row[i]; });
    return obj;
  });
  try { cache.put(cacheKey, JSON.stringify({ headers: headers, rows: rows }), 300); } catch (e) {}
  return { headers: headers, rows: rows, sheet: sheet };
}

function registrarLog(usuario, acao, detalhes) {
  try {
    var sheet = getSheet('logs');
    if (!sheet) return;
    sheet.appendRow([Utilities.getUuid(), new Date().toISOString(), usuario, acao, detalhes || '']);
  } catch (e) {}
}

// ── Token ────────────────────────────────────────────────────────────────────

function gerarToken(user) {
  var payload = {
    id: user.id, login: user.login, nome: user.nome, email: user.email,
    tipo: user.tipo, orgao: user.orgao,
    is_prefeito: user.tipo === 'prefeito' || String(user.is_prefeito).toUpperCase() === 'TRUE',
    exp: Date.now() + 86400000
  };
  return Utilities.base64Encode(JSON.stringify(payload), Utilities.Charset.UTF_8);
}

function verificarToken(token) {
  if (!token) return null;
  try {
    var bytes = Utilities.base64Decode(token);
    var decoded = JSON.parse(Utilities.newBlob(bytes).getDataAsString('UTF-8'));
    if (decoded.exp < Date.now()) return null;
    return decoded;
  } catch (e) { return null; }
}

// ── Login ────────────────────────────────────────────────────────────────────

function handleLogin(data) {
  var usuario = data.usuario;
  var senha = data.senha;
  if (!usuario || !senha) return { error: 'Usuário e senha são obrigatórios' };

  var u = String(usuario).toLowerCase().trim();
  var rows = lerAba('usuarios').rows;
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

// ── Eventos ──────────────────────────────────────────────────────────────────

function handleGetEventos(params) {
  var usuario = verificarToken(params.token);
  if (!usuario) return { error: 'Não autorizado' };

  var eventosRows = lerAba('eventos').rows;
  var usuariosRows = lerAba('usuarios').rows;

  var verTodos = params.todos === 'true' || params.todos === true;
  var filtrados = eventosRows.filter(function(e) {
    if (!e.id) return false;
    if (usuario.tipo === 'admin' || usuario.tipo === 'prefeito' || verTodos) return true;
    return String(e.orgao || '').trim() === String(usuario.orgao || '').trim();
  });

  return filtrados.map(function(e) {
    var emailRef = String(e.email_publicado || '').trim().toLowerCase();
    var loginRef = String(e.publicado_por  || '').trim().toLowerCase();
    var pubUser = null;
    for (var i = 0; i < usuariosRows.length; i++) {
      var u = usuariosRows[i];
      var uEmail = String(u.email || '').toLowerCase();
      var uLogin = String(u.login || '').toLowerCase();
      if ((emailRef && uEmail === emailRef) || (loginRef && uLogin === loginRef)) {
        pubUser = u; break;
      }
    }
    var ev = {};
    for (var k in e) { ev[k] = e[k]; }
    ev.sigla_orgao = getSiglaOrgao(e.orgao);
    if (pubUser) ev.publicado_por = pubUser.login;
    return ev;
  });
}

function handleCriarEvento(data) {
  var usuario = verificarToken(data.token);
  if (!usuario) return { error: 'Não autorizado' };

  var titulo      = data.titulo;
  var data_evento = data.data_evento;
  var local       = data.local;
  var responsavel = data.responsavel;
  var telefone    = data.telefone;
  var observacao  = data.observacao;

  if (!titulo || !data_evento || !observacao) return { error: 'Título, data e observação são obrigatórios' };
  if (new Date(data_evento) < new Date()) return { error: 'Não é permitido criar eventos com data ou hora retroativa.' };

  var anexo_url = '', anexo_nome = '';
  if (data.arquivo_base64 && data.arquivo_nome) {
    try {
      var bytes    = Utilities.base64Decode(data.arquivo_base64);
      var mimeType = data.arquivo_tipo || 'application/octet-stream';
      var blob     = Utilities.newBlob(bytes, mimeType, data.arquivo_nome);
      var pastaNome = 'Agenda Prefeitura Anexos';
      var pastas   = DriveApp.getFoldersByName(pastaNome);
      var pasta    = pastas.hasNext() ? pastas.next() : DriveApp.createFolder(pastaNome);
      var file     = pasta.createFile(blob);
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      anexo_url  = 'https://drive.google.com/file/d/' + file.getId() + '/view';
      anexo_nome = data.arquivo_nome;
    } catch(driveErr) {
      return { error: 'Erro ao salvar anexo. Execute autorizarDrive() no editor para liberar permissões.' };
    }
  }

  return comLock(function() {
    var sheet = getSheet('eventos');
    if (!sheet) return { error: 'Aba eventos não encontrada' };
    var id  = Utilities.getUuid();
    var now = new Date().toISOString();
    var orgaoEvento = usuario.tipo === 'prefeito' ? 'Gabinete do Prefeito' : usuario.orgao;
    sheet.appendRow([
      id, titulo, data_evento, local || '', responsavel || '',
      telefone || '', observacao, anexo_url, anexo_nome,
      orgaoEvento,
      (usuario.tipo === 'prefeito' || usuario.is_prefeito) ? 'TRUE' : 'FALSE',
      usuario.login, usuario.email, now, now, 'ativo'
    ]);
    invalidarCache(['eventos']);
    registrarLog(usuario.email, 'criar_evento', titulo);
    return { success: true, id: id, message: 'Evento criado com sucesso' };
  });
}

function handleAtualizarEvento(data) {
  var usuario = verificarToken(data.token);
  if (!usuario) return { error: 'Não autorizado' };

  var aba = lerAba('eventos');
  var rows = aba.rows, headers = aba.headers;
  var idx = -1;
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i].id) === String(data.id)) { idx = i; break; }
  }
  if (idx === -1) return { error: 'Evento não encontrado' };
  if (usuario.tipo !== 'admin' && rows[idx].orgao !== usuario.orgao) return { error: 'Acesso negado' };

  return comLock(function() {
    var sheet  = getSheet('eventos');
    var rowNum = idx + 2;
    var campos = ['titulo', 'data_evento', 'local', 'responsavel', 'telefone', 'observacao'];
    for (var c = 0; c < campos.length; c++) {
      var campo = campos[c];
      if (data[campo] !== undefined) {
        var col = headers.indexOf(campo) + 1;
        if (col > 0) sheet.getRange(rowNum, col).setValue(data[campo]);
      }
    }
    var colAtu = headers.indexOf('data_atualizacao') + 1;
    if (colAtu > 0) sheet.getRange(rowNum, colAtu).setValue(new Date().toISOString());
    invalidarCache(['eventos']);
    registrarLog(usuario.email, 'atualizar_evento', 'ID: ' + data.id);
    return { success: true, message: 'Evento atualizado' };
  });
}

function handleExcluirEvento(data) {
  var usuario = verificarToken(data.token);
  if (!usuario) return { error: 'Não autorizado' };

  var aba = lerAba('eventos');
  var rows = aba.rows;
  var idx = -1;
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i].id) === String(data.id)) { idx = i; break; }
  }
  if (idx === -1) return { error: 'Evento não encontrado' };
  if (usuario.tipo !== 'admin' && rows[idx].orgao !== usuario.orgao) return { error: 'Acesso negado' };

  return comLock(function() {
    var sheet = getSheet('eventos');
    sheet.deleteRow(idx + 2);
    invalidarCache(['eventos']);
    registrarLog(usuario.email, 'excluir_evento', 'ID: ' + data.id);
    return { success: true, message: 'Evento excluído' };
  });
}

// ── Usuários ─────────────────────────────────────────────────────────────────

function handleGetUsuarios(data) {
  var admin = verificarToken(data.token);
  if (!admin || admin.tipo !== 'admin') return { error: 'Acesso negado' };
  var rows = lerAba('usuarios').rows;
  return rows.map(function(u) { var c = Object.assign({}, u); delete c.senha; return c; });
}

function handleCriarUsuario(data) {
  var admin = verificarToken(data.token);
  if (!admin || admin.tipo !== 'admin') return { error: 'Acesso negado' };

  var login = data.login, nome = data.nome, email = data.email;
  var senha = data.senha, tipo = data.tipo, orgao = data.orgao;

  if (!login || !nome || !email || !senha || !tipo) return { error: 'Todos os campos são obrigatórios' };
  var tiposValidos = ['admin', 'prefeito', 'orgao'];
  if (tiposValidos.indexOf(tipo) === -1) return { error: 'Tipo inválido. Use: admin, prefeito ou orgao' };
  if (tipo === 'orgao' && !orgao) return { error: 'Órgão é obrigatório para sessão de órgão' };

  var aba  = lerAba('usuarios');
  var rows = aba.rows;
  for (var i = 0; i < rows.length; i++) {
    if (rows[i].login === login || rows[i].email === email) return { error: 'Login ou e-mail já existe' };
  }

  var count = 0;
  for (var j = 0; j < rows.length; j++) {
    if      (tipo === 'admin'   && rows[j].tipo === 'admin') count++;
    else if (tipo === 'prefeito'&& rows[j].tipo === 'prefeito') count++;
    else if (tipo === 'orgao'   && rows[j].tipo === 'orgao' && rows[j].orgao === orgao) count++;
  }
  var limiteOrgao = (tipo === 'orgao') ? getLimitePorOrgao(orgao) : LIMITE_POR_SESSAO;
  if (count >= limiteOrgao) {
    var label = tipo === 'admin' ? 'Administrador' : tipo === 'prefeito' ? 'Prefeito' : orgao;
    return { error: 'Limite de ' + limiteOrgao + ' usuários atingido para ' + label };
  }

  var orgaoFinal = tipo === 'prefeito' ? 'Gabinete do Prefeito' : (tipo === 'admin' ? '' : orgao);

  return comLock(function() {
    var sheet = getSheet('usuarios');
    sheet.appendRow([
      Utilities.getUuid(), login, nome, email, senha,
      tipo, orgaoFinal,
      tipo === 'prefeito' ? 'TRUE' : 'FALSE',
      'TRUE', new Date().toISOString()
    ]);
    invalidarCache(['usuarios']);
    registrarLog(admin.email, 'criar_usuario', login);
    return { success: true, message: 'Usuário criado' };
  });
}

function handleResetarSenha(data) {
  var admin = verificarToken(data.token);
  if (!admin || admin.tipo !== 'admin') return { error: 'Acesso negado' };

  var aba = lerAba('usuarios');
  var rows = aba.rows, headers = aba.headers;
  var idx = -1;
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i].id) === String(data.usuarioId)) { idx = i; break; }
  }
  if (idx === -1) return { error: 'Usuário não encontrado' };

  return comLock(function() {
    var sheet = getSheet('usuarios');
    var col   = headers.indexOf('senha') + 1;
    sheet.getRange(idx + 2, col).setValue(data.novaSenha);
    invalidarCache(['usuarios']);
    registrarLog(admin.email, 'resetar_senha', 'ID: ' + data.usuarioId);
    return { success: true, message: 'Senha alterada' };
  });
}

function handleExcluirUsuario(data) {
  var admin = verificarToken(data.token);
  if (!admin || admin.tipo !== 'admin') return { error: 'Acesso negado' };

  var aba = lerAba('usuarios');
  var rows = aba.rows;
  var idx = -1;
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i].id) === String(data.id)) { idx = i; break; }
  }
  if (idx === -1) return { error: 'Usuário não encontrado' };

  return comLock(function() {
    var sheet = getSheet('usuarios');
    sheet.deleteRow(idx + 2);
    invalidarCache(['usuarios']);
    registrarLog(admin.email, 'excluir_usuario', 'ID: ' + data.id);
    return { success: true, message: 'Usuário excluído' };
  });
}

// ── Solicitar Acesso (público) ────────────────────────────────────────────────

function handleSolicitarAcesso(data) {
  var nome = data.nome, email = data.email, login = data.login;
  var telefone = data.telefone, orgao = data.orgao;
  var justificativa = data.justificativa, senha = data.senha || '';

  if (!nome || !email || !login || !orgao) return { error: 'Nome, e-mail, login e orgao sao obrigatorios' };

  var rows = lerAba('usuarios').rows;
  for (var i = 0; i < rows.length; i++) {
    if (rows[i].login === login || rows[i].email === email) return { error: 'Login ou e-mail já está em uso' };
  }

  var orgaoCount = 0;
  for (var j = 0; j < rows.length; j++) {
    if (rows[j].tipo === 'orgao' &&
        String(rows[j].orgao || '').trim() === String(orgao || '').trim() &&
        String(rows[j].ativo).toUpperCase() === 'TRUE') {
      orgaoCount++;
    }
  }
  var limiteSolic = getLimitePorOrgao(orgao);
  if (orgaoCount >= limiteSolic) {
    return { error: 'Limite de ' + limiteSolic + ' usuários atingido para o órgão "' + orgao + '". Não é possível enviar nova solicitação.' };
  }

  return comLock(function() {
    var solSheet = getSheet('solicitacoes');
    if (!solSheet) {
      solSheet = SpreadsheetApp.openById(SPREADSHEET_ID).insertSheet('solicitacoes');
      solSheet.appendRow(['id','nome','email','login','telefone','orgao','justificativa','status','tipoSolicitacao','data_solicitacao','senha']);
    } else {
      var headerRow = solSheet.getRange(1, 1, 1, solSheet.getLastColumn()).getValues()[0].map(String);
      if (headerRow.indexOf('senha') === -1) {
        solSheet.getRange(1, solSheet.getLastColumn() + 1).setValue('senha');
      }
    }

    var aba = lerAba('solicitacoes');
    var headers = aba.headers;
    var rowData = new Array(headers.length).fill('');
    rowData[headers.indexOf('id')]               = Utilities.getUuid();
    rowData[headers.indexOf('nome')]             = nome;
    rowData[headers.indexOf('email')]            = email;
    rowData[headers.indexOf('login')]            = login;
    rowData[headers.indexOf('telefone')]         = telefone || '';
    rowData[headers.indexOf('orgao')]            = orgao;
    rowData[headers.indexOf('justificativa')]    = justificativa || '';
    rowData[headers.indexOf('status')]           = 'aprovado';
    rowData[headers.indexOf('tipoSolicitacao')]  = 'acesso';
    rowData[headers.indexOf('data_solicitacao')] = new Date().toISOString();
    rowData[headers.indexOf('senha')]            = senha;
    solSheet.appendRow(rowData);

    var usuariosSheet = getSheet('usuarios');
    if (!usuariosSheet) return { error: 'Aba usuarios não encontrada. Contate o administrador.' };
    usuariosSheet.appendRow([
      Utilities.getUuid(), login, nome, email, senha,
      'orgao', orgao, 'FALSE', 'TRUE', new Date().toISOString()
    ]);

    invalidarCache(['solicitacoes', 'usuarios']);
    registrarLog(email, 'auto_aprovado', 'Conta criada automaticamente via solicitacao');
    return { success: true, aprovado: true, message: 'Conta criada com sucesso! Você já pode fazer login.' };
  });
}

// ── Recuperar Senha (público) ─────────────────────────────────────────────────

function handleRecuperarSenha(data) {
  var login = data.login;
  var novaSenha = data.novaSenha;
  if (!login) return { error: 'Informe seu login ou e-mail' };
  if (!novaSenha || novaSenha.length < 6) return { error: 'A nova senha deve ter pelo menos 6 caracteres' };

  var aba = lerAba('usuarios');
  var rows = aba.rows, headers = aba.headers;
  var idx = -1;
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    var rLogin = String(r.login || '').normalize('NFC').toLowerCase().trim();
    var rEmail = String(r.email || '').normalize('NFC').toLowerCase().trim();
    var loginNorm = String(login).normalize('NFC').toLowerCase().trim();
    if ((rLogin === loginNorm || rEmail === loginNorm) && String(r.ativo).toUpperCase() === 'TRUE') {
      idx = i; break;
    }
  }
  if (idx === -1) return { error: 'Usuário não encontrado. Verifique o login ou e-mail.' };

  return comLock(function() {
    var sheet = getSheet('usuarios');
    var col = headers.indexOf('senha') + 1;
    sheet.getRange(idx + 2, col).setValue(novaSenha);
    invalidarCache(['usuarios']);
    registrarLog(rows[idx].email, 'redefinir_senha', 'Senha redefinida pelo proprio usuario');
    return { success: true, message: 'Senha redefinida com sucesso!' };
  });
}

// ── Gerenciar Solicitações (admin) ────────────────────────────────────────────

function handleGetSolicitacoes(data) {
  var admin = verificarToken(data.token);
  if (!admin || admin.tipo !== 'admin') return { error: 'Acesso negado' };
  var rows = lerAba('solicitacoes').rows;
  return rows.sort(function(a, b) { return new Date(b.data_solicitacao) - new Date(a.data_solicitacao); });
}

function handleAtualizarSolicitacao(data) {
  var admin = verificarToken(data.token);
  if (!admin || admin.tipo !== 'admin') return { error: 'Acesso negado' };

  var aba = lerAba('solicitacoes');
  var rows = aba.rows, headers = aba.headers;
  var idx = -1;
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i].id) === String(data.id)) { idx = i; break; }
  }
  if (idx === -1) return { error: 'Solicitação não encontrada' };

  return comLock(function() {
    var sheet = getSheet('solicitacoes');
    var col   = headers.indexOf('status') + 1;
    if (col > 0) sheet.getRange(idx + 2, col).setValue(data.status);
    invalidarCache(['solicitacoes']);
    registrarLog(admin.email, 'atualizar_solicitacao', 'ID ' + data.id + ' -> ' + data.status);
    return { success: true };
  });
}

// ── Primeiro Admin ────────────────────────────────────────────────────────────

function handlePrimeiroAdmin(data) {
  var login = data.login, senha = data.senha;
  var nome  = data.nome,  email = data.email;
  if (!login || !senha) return { error: 'Login e senha são obrigatórios' };

  var rows = lerAba('usuarios').rows;
  for (var i = 0; i < rows.length; i++) {
    if (rows[i].tipo === 'admin') return { error: 'Já existe um administrador. Use o painel para criar novos usuários.' };
  }

  return comLock(function() {
    var sheet = getSheet('usuarios');
    sheet.appendRow([
      Utilities.getUuid(), login, nome || login, email || (login + '@prefeitura.gov.br'),
      senha, 'admin', '', 'FALSE', 'TRUE', new Date().toISOString()
    ]);
    invalidarCache(['usuarios']);
    return { success: true, message: 'Administrador "' + login + '" criado com sucesso!' };
  });
}

// ── Setup inicial das abas ────────────────────────────────────────────────────

function criarAbas() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var config = {
    usuarios:     ['id','login','nome','email','senha','tipo','orgao','is_prefeito','ativo','data_criacao'],
    eventos:      ['id','titulo','data_evento','local','responsavel','telefone','observacao','anexo_url','anexo_nome','orgao','is_prefeito','publicado_por','email_publicado','data_publicacao','data_atualizacao','status'],
    logs:         ['id','data','usuario','acao','detalhes'],
    solicitacoes: ['id','nome','email','login','telefone','orgao','justificativa','status','tipoSolicitacao','data_solicitacao','senha']
  };
  var resultado = [];
  var nomes = Object.keys(config);
  for (var i = 0; i < nomes.length; i++) {
    var nome = nomes[i];
    if (!ss.getSheetByName(nome)) {
      var s = ss.insertSheet(nome);
      s.appendRow(config[nome]);
      resultado.push('criada: ' + nome);
    } else {
      resultado.push('ja existe: ' + nome);
    }
  }
  return { success: true, abas: resultado };
}

// ── Autorizar Drive (execute manualmente uma vez) ─────────────────────────────

function autorizarDrive() {
  var pastaNome = 'Agenda Prefeitura Anexos';
  var pastas = DriveApp.getFoldersByName(pastaNome);
  var pasta  = pastas.hasNext() ? pastas.next() : DriveApp.createFolder(pastaNome);
  Logger.log('Drive autorizado. Pasta: ' + pasta.getName() + ' | ID: ' + pasta.getId());
}

// ── Testes ────────────────────────────────────────────────────────────────────

function testarConexao() {
  var ss   = SpreadsheetApp.openById(SPREADSHEET_ID);
  var abas = ss.getSheets();
  var nomes = [];
  for (var i = 0; i < abas.length; i++) { nomes.push(abas[i].getName()); }
  Logger.log('Planilha: ' + ss.getName());
  Logger.log('Abas: ' + nomes.join(', '));
}

function testarLogin() {
  var rows = lerAba('usuarios').rows;
  Logger.log('Usuarios: ' + rows.length);
  for (var i = 0; i < rows.length; i++) {
    Logger.log((i+1) + ': login="' + rows[i].login + '" tipo="' + rows[i].tipo + '" ativo="' + rows[i].ativo + '"');
  }
  Logger.log('Teste admin: ' + JSON.stringify(handleLogin({ usuario: 'admin', senha: 'admin123' })));
}

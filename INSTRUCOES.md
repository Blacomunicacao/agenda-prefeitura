# Agenda da Prefeitura — Passo a Passo

## Arquivos do Projeto
- `index.html` → frontend (vai para o GitHub Pages)
- `Code.gs`    → API backend (vai para o Google Apps Script)

---

## PASSO 1 — Google Sheets

1. Acesse **sheets.google.com** e crie uma nova planilha
2. Renomeie a aba padrão para `eventos`
3. Na linha 1, coloque estes cabeçalhos exatamente assim:

```
id | titulo | data_evento | local | responsavel | telefone | observacao | anexo_url | anexo_nome | orgao | is_prefeito | publicado_por | publicado_email | data_publicacao | data_atualizacao | status
```

4. Crie uma segunda aba: clique no `+` → renomeie para `usuarios`
5. Cabeçalhos da aba `usuarios`:
```
id | login | nome | email | senha | tipo | orgao | is_prefeito | ativo | data_criacao
```

6. Crie uma terceira aba: `logs`
7. Cabeçalhos da aba `logs`:
```
id | data_hora | usuario | acao | detalhes
```

8. **Copie o ID da planilha** — está na URL entre `/d/` e `/edit`:
   - Ex: `https://docs.google.com/spreadsheets/d/1BxiM...ABC/edit`
   - O ID é: `1BxiM...ABC`

---

## PASSO 2 — Usuários Iniciais

Na aba `usuarios`, adicione estas linhas:

| id | login | nome | email | senha | tipo | orgao | is_prefeito | ativo | data_criacao |
|----|-------|------|-------|-------|------|-------|-------------|-------|--------------|
| 1 | admin | Administrador | admin@pp.sp.gov.br | admin123 | admin | | FALSE | TRUE | 2026-01-01 |
| 2 | prefeito | Gabinete do Prefeito | prefeito@pp.sp.gov.br | prefeito123 | orgao | Gabinete do Prefeito | TRUE | TRUE | 2026-01-01 |
| 3 | educacao | Secretaria de Educação | educacao@pp.sp.gov.br | educ123 | orgao | Secretaria de Educação | FALSE | TRUE | 2026-01-01 |

---

## PASSO 3 — Google Apps Script

1. Acesse **script.google.com**
2. Clique em **"Novo projeto"**
3. Apague o código padrão e cole todo o conteúdo de `Code.gs`
4. Encontre a linha `const SPREADSHEET_ID = 'COLE_O_ID_DA_SUA_PLANILHA_AQUI';`
5. Substitua `COLE_O_ID_DA_SUA_PLANILHA_AQUI` pelo ID copiado no Passo 1
6. Salve (Ctrl+S)
7. Clique em **"Executar"** → escolha `testarConexao` → autorize as permissões
8. Verifique no log que aparece o nome da planilha

### Publicar como App da Web:
1. Clique em **"Implantar"** → **"Nova implantação"**
2. Tipo: **Aplicativo da Web**
3. Executar como: **Eu**
4. Quem pode acessar: **Qualquer pessoa**
5. Clique em **"Implantar"**
6. **Copie a URL** — começa com `https://script.google.com/macros/s/...`

> ⚠️ Toda vez que editar o Code.gs, deve criar uma **nova implantação** (não pode reutilizar a mesma URL para mudanças de código)

---

## PASSO 4 — Configurar o Frontend

Abra o `index.html` e encontre esta linha:

```javascript
const API_URL = localStorage.getItem('apiUrl') ||
  'https://script.google.com/macros/s/SEU_ID_AQUI/exec';
```

Substitua `SEU_ID_AQUI` pelo ID da URL copiada no Passo 3.

Ou deixe como está e configure pela interface: ao abrir o site, clique em **"⚙️ Configurar URL da API"** no rodapé do login.

---

## PASSO 5 — GitHub Pages

1. Crie uma conta no **github.com** (se não tiver)
2. Clique em **"New repository"**
3. Nome: `agenda-prefeitura` (ou qualquer nome)
4. Marque **"Public"**
5. Clique em **"Create repository"**
6. Faça upload do arquivo `index.html`
7. Vá em **Settings** → **Pages**
8. Source: **Deploy from a branch** → branch: **main** → pasta: **/ (root)**
9. Salve — em alguns minutos o site estará em:
   `https://SEU-USUARIO.github.io/agenda-prefeitura/`

---

## Logins Padrão

| Usuário | Senha | Acesso |
|---------|-------|--------|
| admin | admin123 | Administrador geral |
| prefeito | prefeito123 | Gabinete do Prefeito |
| educacao | educ123 | Secretaria de Educação |

> ⚠️ Troque as senhas após o primeiro acesso usando o painel de Usuários do Admin!

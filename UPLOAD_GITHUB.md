# 🚀 Guia Completo: Upload do SKBORGES para GitHub

## 📋 Pré-requisitos

1. **Conta no GitHub**: Se não tiver, crie em [github.com](https://github.com)
2. **Git instalado**: Baixe em [git-scm.com](https://git-scm.com/) se não tiver
3. **Terminal/PowerShell**: Que você já tem no Windows

## 🎯 Passo a Passo

### 1️⃣ Criar Repositório no GitHub

1. Acesse [github.com](https://github.com) e faça login
2. Clique no botão **"New"** (ou ícone +) no canto superior direito
3. Preencha:
   - **Repository name**: `skborges-formularios-arquitetonicos`
   - **Description**: `Sistema Profissional de Formulários Arquitetônicos - SKBORGES`
   - **Visibility**: Public (ou Private se preferir)
   - ❌ **NÃO** marque "Add a README file" (já temos um)
   - ❌ **NÃO** marque "Add .gitignore" (já temos um)
   - ❌ **NÃO** marque "Choose a license" (já temos um)
4. Clique em **"Create repository"**

### 2️⃣ Configurar Git Local (se não configurado)

Abra o PowerShell e execute:

```powershell
# Configure seu nome (substituir "Seu Nome")
git config --global user.name "Seu Nome"

# Configure seu email (substituir por seu email do GitHub)
git config --global user.email "seu-email@gmail.com"
```

### 3️⃣ Preparar o Projeto

No PowerShell, navegue até a pasta do projeto:

```powershell
# Navegar até a pasta
cd "C:\Users\PC\Desktop\RELAT_SKB"

# Verificar se está na pasta correta
Get-ChildItem
```

### 4️⃣ Inicializar e Configurar o Repositório

```powershell
# Inicializar Git (se ainda não estiver)
git init

# Adicionar o repositório remoto (SUBSTITUIR pelo SEU repositório)
git remote add origin https://github.com/SEU_USUARIO/skborges-formularios-arquitetonicos.git

# Verificar se foi adicionado corretamente
git remote -v
```

### 5️⃣ Adicionar Arquivos e Fazer o Primeiro Commit

```powershell
# Adicionar todos os arquivos
git add .

# Verificar o que será commitado
git status

# Fazer o primeiro commit
git commit -m "🚀 Initial commit: SKBORGES Sistema de Formulários Arquitetônicos v4.0.1

✨ Funcionalidades principais:
- Formulário completo de projeto arquitetônico
- Geração automática de relatórios PDF
- Sistema dinâmico de ambientes e necessidades
- Cálculo automático de prazos
- Interface responsiva e moderna
- Validação completa de dados

🛠️ Tecnologias: HTML5, CSS3, JavaScript ES6+, Node.js, Express
🎨 Design: Sistema profissional com identidade visual SKBORGES
📱 Responsivo: Funciona em desktop, tablet e mobile

Ready for production! 🎉"
```

### 6️⃣ Fazer o Upload (Push) para o GitHub

```powershell
# Definir a branch principal como main
git branch -M main

# Fazer o upload para o GitHub
git push -u origin main
```

## 🔐 Autenticação do GitHub

Se for a primeira vez ou pedir autenticação:

### Opção A: Token de Acesso Pessoal (Recomendado)
1. No GitHub, vá em **Settings** > **Developer settings** > **Personal access tokens** > **Tokens (classic)**
2. Clique **"Generate new token"** > **"Generate new token (classic)"**
3. Dê um nome: `SKBORGES Project`
4. Selecione escopo: `repo` (marque todas as opções de repo)
5. Clique **"Generate token"**
6. **COPIE O TOKEN** (só aparece uma vez!)
7. Quando o Git pedir senha, use o TOKEN como senha

### Opção B: GitHub CLI (Alternativa)
```powershell
# Instalar GitHub CLI
winget install --id GitHub.cli

# Fazer login
gh auth login
```

## ✅ Verificação Final

Após o upload, verifique:

1. **No GitHub**: Acesse seu repositório e veja se todos os arquivos estão lá
2. **README.md**: Deve aparecer formatado na página principal
3. **Estrutura**: Verifique se a estrutura de pastas está correta

## 🎉 Próximos Passos

### Configurar GitHub Pages (Opcional)
Para hospedar o site gratuitamente:

1. No repositório, vá em **Settings** > **Pages**
2. Em **Source**, selecione **Deploy from a branch**
3. Escolha branch **main** e pasta **/ (root)**
4. Clique **Save**
5. Seu site estará em: `https://SEU_USUARIO.github.io/skborges-formularios-arquitetonicos`

### Adicionar Badges ao README (Opcional)
```markdown
![GitHub stars](https://img.shields.io/github/stars/SEU_USUARIO/skborges-formularios-arquitetonicos)
![GitHub forks](https://img.shields.io/github/forks/SEU_USUARIO/skborges-formularios-arquitetonicos)
![GitHub issues](https://img.shields.io/github/issues/SEU_USUARIO/skborges-formularios-arquitetonicos)
```

## 🆘 Resolução de Problemas

### Erro de Autenticação
- Use um token de acesso pessoal em vez de senha
- Verifique se o token tem permissões corretas

### Erro "Repository not found"
- Verifique se o nome do repositório está correto
- Confirme se o repositório foi criado no GitHub

### Arquivos muito grandes
- Verifique o `.gitignore` para excluir `node_modules/`
- Use `git rm --cached nome-do-arquivo` para remover arquivos grandes

## 📞 Suporte

Se tiver problemas:
1. Verifique os comandos digitados
2. Consulte a documentação do Git: [git-scm.com/docs](https://git-scm.com/docs)
3. Documentação do GitHub: [docs.github.com](https://docs.github.com)

---

**🎯 Após seguir este guia, seu projeto SKBORGES estará no GitHub e pronto para ser compartilhado!** 🚀

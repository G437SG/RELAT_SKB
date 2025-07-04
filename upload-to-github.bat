@echo off
chcp 65001 >nul
echo ========================================
echo    SKBORGES - GitHub Upload Script
echo ========================================
echo.

:: Check if git is installed
git --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Git não está instalado ou não está no PATH.
    echo Por favor, instale o Git: https://git-scm.com/download/win
    pause
    exit /b 1
)

echo ✅ Git encontrado. Iniciando upload...
echo.

:: Navigate to the project directory
cd /d "%~dp0"

:: Initialize git if not already initialized
if not exist ".git" (
    echo 📁 Inicializando repositório Git...
    git init
    echo.
)

:: Configure git user (change these if needed)
echo ⚙️ Configurando usuário Git...
git config user.name "G437SG"
git config user.email "g437sg@gmail.com"
echo.

:: Add remote origin if not exists
git remote get-url origin >nul 2>&1
if errorlevel 1 (
    echo 🔗 Adicionando repositório remoto...
    git remote add origin https://github.com/G437SG/RELAT_SKB.git
    echo.
)

:: Add all files
echo 📦 Adicionando arquivos ao controle de versão...
git add .
echo.

:: Create commit with current date and time
for /f "tokens=1-4 delims=/ " %%a in ('date /t') do (
    set DATE=%%c-%%b-%%a
)
for /f "tokens=1-2 delims=: " %%a in ('time /t') do (
    set TIME=%%a:%%b
)

echo 💾 Criando commit...
git commit -m "✨ Versão atualizada do SKBORGES - %DATE% %TIME%"
echo.

:: Push to GitHub
echo 🚀 Enviando para GitHub...
echo.
echo ⚠️ IMPORTANTE: Você será solicitado a fazer login no GitHub.
echo    Se você tem autenticação de dois fatores ativada,
echo    use um Personal Access Token como senha.
echo.
pause

git branch -M main
git push -u origin main

if errorlevel 1 (
    echo.
    echo ❌ Erro ao enviar para GitHub.
    echo.
    echo 🔧 Possíveis soluções:
    echo    1. Verifique se o repositório existe: https://github.com/G437SG/RELAT_SKB
    echo    2. Verifique suas credenciais do GitHub
    echo    3. Se você tem 2FA ativado, use um Personal Access Token
    echo.
    echo 📝 Para criar um Personal Access Token:
    echo    1. Vá para: https://github.com/settings/tokens
    echo    2. Clique em "Generate new token (classic)"
    echo    3. Marque as opções: repo, workflow, write:packages
    echo    4. Use o token como senha quando solicitado
    echo.
) else (
    echo.
    echo ✅ SUCESSO! Projeto enviado para GitHub!
    echo.
    echo 🌐 Seu repositório: https://github.com/G437SG/RELAT_SKB
    echo 📱 GitHub Pages (se ativado): https://g437sg.github.io/RELAT_SKB
    echo.
)

echo.
echo Pressione qualquer tecla para fechar...
pause >nul

@echo off
chcp 65001 >nul
title SKBORGES - Sistema de Formulário Arquitetônico

echo.
echo ████████████████████████████████████████████████████████████
echo    ███████  ██   ██ ██████   ██████  ██████   ██████  ███████
echo    ██       ██  ██  ██   ██ ██    ██ ██   ██ ██       ██     
echo    ███████  █████   ██████  ██    ██ ██████  ██   ███ ███████
echo         ██  ██  ██  ██   ██ ██    ██ ██   ██ ██    ██      ██
echo    ███████  ██   ██ ██████   ██████  ██   ██  ██████  ███████
echo.
echo    🏢 ARQUITETURA CORPORATIVA - SISTEMA DE FORMULÁRIOS
echo ████████████████████████████████████████████████████████████
echo.
echo 📋 Iniciando Sistema de Relatório de Clientes Online...
echo.

:: Navegar para o diretório do script
cd /d "%~dp0"

:: Verificar se Node.js está instalado
echo ⚙️  Verificando Node.js...
node --version >nul 2>&1
if errorlevel 1 (
    echo.
    echo ❌ ERRO: Node.js não encontrado!
    echo.
    echo 📥 Para instalar o Node.js:
    echo    1. Acesse: https://nodejs.org/
    echo    2. Baixe a versão LTS
    echo    3. Execute o instalador
    echo    4. Reinicie o prompt de comando
    echo.
    echo 🔄 Pressione qualquer tecla para tentar novamente...
    pause >nul
    echo.
    echo 🌐 Abrindo site do Node.js...
    start https://nodejs.org/
    echo.
    echo 🔄 Pressione qualquer tecla para fechar...
    pause >nul
    exit /b 1
)

:: Exibir versão do Node.js
for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
echo ✅ Node.js %NODE_VERSION% encontrado!

:: Verificar se npm está disponível
echo ⚙️  Verificando npm...
npm --version >nul 2>&1
if errorlevel 1 (
    echo ❌ ERRO: npm não encontrado!
    echo 💡 O npm geralmente vem com o Node.js. Reinstale o Node.js.
    echo.
    echo 🔄 Pressione qualquer tecla para fechar...
    pause >nul
    exit /b 1
)

for /f "tokens=*" %%i in ('npm --version') do set NPM_VERSION=%%i
echo ✅ npm %NPM_VERSION% encontrado!

:: Verificar se package.json existe
if not exist "package.json" (
    echo.
    echo ❌ ERRO: package.json não encontrado!
    echo 💡 Certifique-se de estar na pasta correta do projeto.
    echo 📂 Pasta atual: %CD%
    echo.
    echo 🔄 Pressione qualquer tecla para fechar...
    pause >nul
    exit /b 1
)

echo ✅ package.json encontrado!

:: Verificar e instalar dependências
echo.
echo 📦 Verificando dependências...
if not exist "node_modules" (
    echo.
    echo 🔄 Pasta node_modules não encontrada.
    echo 📥 Instalando dependências do projeto...
    echo.
    npm install
    if errorlevel 1 (
        echo.
        echo ❌ ERRO: Falha ao instalar dependências!
        echo 💡 Verifique sua conexão com a internet e tente novamente.
        echo.
        echo 🔄 Pressione qualquer tecla para fechar...
        pause >nul
        exit /b 1
    )
    echo ✅ Dependências instaladas com sucesso!
) else (
    echo ✅ Dependências já instaladas!
    
    :: Verificar se há atualizações disponíveis
    echo 🔍 Verificando atualizações...
    npm outdated >nul 2>&1
    if not errorlevel 1 (
        echo 💡 Algumas dependências podem ter atualizações disponíveis.
        echo    Execute 'npm update' se necessário.
    )
)

:: Verificar se as pastas necessárias existem
echo.
echo 📁 Verificando estrutura do projeto...

if not exist "public" (
    echo ⚠️  Pasta 'public' não encontrada. Criando...
    mkdir public
)

if not exist "public\js" (
    echo ⚠️  Pasta 'public\js' não encontrada. Criando...
    mkdir "public\js"
)

if not exist "public\css" (
    echo ⚠️  Pasta 'public\css' não encontrada. Criando...
    mkdir "public\css"
)

if not exist "data" (
    echo ⚠️  Pasta 'data' não encontrada. Criando...
    mkdir data
)

echo ✅ Estrutura do projeto verificada!

:: Verificar se arquivos críticos existem
echo.
echo 📄 Verificando arquivos essenciais...

if not exist "server.js" (
    echo ❌ ERRO: server.js não encontrado!
    echo 💡 Arquivo principal do servidor está ausente.
    echo.
    echo 🔄 Pressione qualquer tecla para fechar...
    pause >nul
    exit /b 1
)

if not exist "public\index.html" (
    echo ⚠️  public\index.html não encontrado!
    echo 💡 Página principal pode estar ausente.
)

if not exist "public\js\script.js" (
    echo ⚠️  public\js\script.js não encontrado!
    echo 💡 Script principal pode estar ausente.
)

echo ✅ Arquivos verificados!

:: Verificar se a porta 3000 está disponível
echo.
echo 🌐 Verificando disponibilidade da porta 3000...
netstat -an | find "3000" | find "LISTENING" >nul
if not errorlevel 1 (
    echo.
    echo ⚠️  ATENÇÃO: Porta 3000 já está em uso!
    echo.
    echo 💡 Opções disponíveis:
    echo    1. Fechar a aplicação que está usando a porta 3000
    echo    2. Usar uma porta diferente (será definida automaticamente)
    echo.
    echo 🔄 Pressione qualquer tecla para continuar mesmo assim...
    pause >nul
    echo.
    echo 🚀 Tentando iniciar na porta 3000 (pode usar porta alternativa)...
) else (
    echo ✅ Porta 3000 disponível!
)

:: Limpar cache se necessário (opcional)
echo.
echo 🧹 Limpando caches temporários...
if exist "public\js\script.js.tmp" del "public\js\script.js.tmp" >nul 2>&1
if exist "public\css\style.css.tmp" del "public\css\style.css.tmp" >nul 2>&1
echo ✅ Cache limpo!

:: Definir variáveis de ambiente para otimização
set NODE_ENV=development
set DEBUG=app:*

:: Iniciar servidor
echo.
echo ████████████████████████████████████████████████████████████
echo.
echo 🚀 INICIANDO SERVIDOR SKBORGES...
echo.
echo ████████████████████████████████████████████████████████████
echo.
echo 📊 Informações do Sistema:
echo    🖥️  Sistema: Windows
echo    📂 Projeto: SKBORGES - Formulário Arquitetônico  
echo    🌐 URL Principal: http://localhost:3000
echo    📋 Formulário: /formulario
echo    📊 API: /api/*
echo    💾 Dados: /data/projetos.json
echo.
echo 🎯 Funcionalidades Disponíveis:
echo    ✅ Sistema de Demandas Inteligente
echo    ✅ Subopções Dinâmicas por Tipo de Imóvel
echo    ✅ Validação em Tempo Real
echo    ✅ Máscaras Automáticas (Telefone, Metragem)
echo    ✅ Exportação PDF e Excel
echo    ✅ Salvamento e Edição de Projetos
echo    ✅ Demandas Rápidas
echo    ✅ Interface Responsiva
echo.
echo ████████████████████████████████████████████████████████████
echo.
echo ⚡ Status: CARREGANDO...
echo.

:: Aguardar um momento para estabilizar
timeout /t 3 /nobreak >nul

:: Tentar abrir o navegador automaticamente
echo 🌐 Preparando para abrir navegador...
echo.

:: Verificar se o comando npm start existe no package.json
findstr /c:"start" package.json >nul
if errorlevel 1 (
    echo ❌ ERRO: Script 'start' não encontrado no package.json!
    echo 💡 Tentando executar servidor diretamente...
    echo.
    
    :: Tentar node server.js diretamente
    if exist "server.js" (
        echo 🚀 Executando: node server.js
        echo.
        
        :: Abrir navegador em background antes de iniciar servidor
        start /b cmd /c "timeout /t 5 /nobreak >nul && start http://localhost:3000"
        
        :: Iniciar servidor e manter janela aberta
        node server.js
        
        :: Se chegou aqui, algo deu errado
        echo.
        echo ████████████████████████████████████████████████████████████
        echo.
        echo 🛑 SERVIDOR PARADO OU ERRO OCORREU
        echo.
        goto :servidor_parado
    ) else (
        echo ❌ ERRO: Nem server.js nem script start encontrados!
        echo.
        echo 🔄 Pressione qualquer tecla para fechar...
        pause >nul
        exit /b 1
    )
) else (
    echo ✅ Script 'start' encontrado no package.json
    echo.
    echo 🚀 Executando: npm start
    echo.
    
    :: Abrir navegador em background antes de iniciar servidor
    start /b cmd /c "timeout /t 8 /nobreak >nul && echo Abrindo navegador... && start http://localhost:3000"
    
    echo ████████████████████████████████████████████████████████████
    echo.
    echo 🎉 SERVIDOR SKBORGES INICIADO COM SUCESSO!
    echo.
    echo 🌐 Acesse: http://localhost:3000
    echo 📋 Formulário direto: http://localhost:3000/formulario
    echo.
    echo 🛑 Para parar o servidor: Pressione Ctrl+C
    echo 🔄 Para reiniciar: Feche esta janela e execute start.bat novamente
    echo.
    echo 💡 Dicas:
    echo    • Mantenha esta janela aberta enquanto usa o sistema
    echo    • Se houver erros, verifique as mensagens nesta janela
    echo    • Para debug, abra o console do navegador (F12)
    echo    • O navegador será aberto automaticamente em alguns segundos
    echo.
    echo ████████████████████████████████████████████████████████████
    echo.
    
    :: Iniciar o servidor Node.js (isto mantém a janela aberta)
    npm start
)

:: Se chegou aqui, o servidor foi interrompido
:servidor_parado
echo.
echo ████████████████████████████████████████████████████████████
echo.
echo 🛑 SERVIDOR PARADO
echo.
echo 💡 Se foi um erro inesperado:
echo    1. Verifique as mensagens de erro acima
echo    2. Tente executar 'npm install' novamente
echo    3. Verifique se não há conflitos de porta
echo    4. Confirme se o arquivo server.js existe
echo    5. Verifique se o package.json tem o script 'start' configurado
echo.
echo 🔧 Para diagnosticar problemas:
echo    • Execute: npm run debug
echo    • Ou execute: node server.js
echo    • Verifique os logs acima para erros específicos
echo.
echo 🔄 Pressione qualquer tecla para fechar...
echo.
echo ████████████████████████████████████████████████████████████

:: Aguardar input do usuário antes de fechar
pause >nul

:: Garantir que a janela não feche imediatamente
timeout /t 1 /nobreak >nul
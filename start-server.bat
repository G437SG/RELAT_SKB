@echo off
echo ========================================
echo    SKBORGES - Sistema de Formularios
echo    Versao 4.0.1 - Iniciando Servidor
echo ========================================
echo.

echo Verificando porta 3001...
netstat -ano | findstr :3001 >nul
if %errorlevel% == 0 (
    echo Porta 3001 em uso. Tentando liberar...
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3001') do (
        echo Finalizando processo %%a...
        taskkill /PID %%a /F >nul 2>&1
    )
    timeout /t 2 >nul
)

echo Iniciando servidor na porta 3001...
echo.
echo ==========================================
echo  Servidor disponivel em: http://localhost:3001
echo  Pressione Ctrl+C para parar o servidor
echo ==========================================
echo.

node server.js

echo.
echo Servidor finalizado.
pause

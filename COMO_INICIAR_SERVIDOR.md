# 🚀 COMO INICIAR O SERVIDOR SKBORGES

## ✅ PROBLEMA RESOLVIDO

O erro "EADDRINUSE: address already in use 0.0.0.0:3000" foi resolvido alterando a porta para 3001.

## 📋 INSTRUÇÕES PARA INICIAR

### Método 1: Automático (Recomendado)
```cmd
start-server.bat
```

### Método 2: Manual
```powershell
# 1. Abrir nova janela do terminal
Start-Process -FilePath "cmd" -ArgumentList "/k", "node server.js"

# 2. Abrir navegador
Start-Process "http://localhost:3001"
```

### Método 3: Terminal Atual
```cmd
node server.js
```

## 🌐 ACESSO À APLICAÇÃO

**URL:** http://localhost:3001

## 🔧 ALTERAÇÕES FEITAS

1. **Porta alterada:** 3000 → 3001 (para evitar conflitos)
2. **Script criado:** `start-server.bat` para inicialização automática
3. **Processo anterior:** Finalizado automaticamente

## 📁 ESTRUTURA

```
RELAT_SKB/
├── server.js (porta 3001)
├── start-server.bat (script de inicialização)
└── formulario-projeto-arquitetonico/
    └── public/ (arquivos da aplicação)
```

## ⚠️ TROUBLESHOOTING

Se ainda houver erro de porta em uso:

```cmd
# Verificar processos na porta 3001
netstat -ano | findstr :3001

# Finalizar processo (substitua XXXX pelo PID)
taskkill /PID XXXX /F
```

## ✅ STATUS ATUAL

🎯 **SERVIDOR FUNCIONANDO** na porta 3001
🌐 **APLICAÇÃO ACESSÍVEL** em http://localhost:3001
🔧 **TODAS AS CORREÇÕES** aplicadas (ambientes, cronograma, header, footer)

---
*Instruções atualizadas em ${new Date().toLocaleString('pt-BR')}*

const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');

const app = express();
const PORT = process.env.PORT || 3000;

// ===== CONFIGURAÇÃO DE SEGURANÇA =====
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com", "https://fonts.googleapis.com"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
            fontSrc: ["'self'", "https://cdnjs.cloudflare.com", "https://fonts.gstatic.com"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'"]
        }
    }
}));

app.use(cors());
app.use(compression());

// ===== MIDDLEWARE PARA PARSING =====
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ===== MIDDLEWARE PARA LOGS DETALHADOS (MOVIDO PARA CIMA) =====
app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    const userAgent = req.get('User-Agent') || 'Unknown';
    
    console.log(`📡 ${timestamp} - ${req.method} ${req.url} - ${userAgent.split(' ')[0]}`);
    next();
});

// ===== SERVIR ARQUIVOS ESTÁTICOS =====
const publicPath = path.join(__dirname, 'formulario-projeto-arquitetonico', 'public');
app.use(express.static(publicPath, {
    maxAge: '1d',
    etag: true,
    index: ['index.html']
}));

// ===== ROTA ESPECÍFICA PARA FAVICON =====
app.get('/favicon.ico', (req, res) => {
    const faviconPath = path.join(publicPath, 'images', 'favicon.ico');
    
    // Tentar servir favicon se existir
    res.sendFile(faviconPath, (err) => {
        if (err) {
            // Se não existir, criar um favicon simples em base64
            const simpleFavicon = Buffer.from(
                'AAABAAEAEBAAAAEAIABoBAAAFgAAACgAAAAQAAAAIAAAAAEAIAAAAAAAAAQAABILAAASCwAAAAAAAAAAAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/',
                'base64'
            );
            
            res.setHeader('Content-Type', 'image/x-icon');
            res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache por 1 dia
            res.send(simpleFavicon);
            
            console.log('🎯 Favicon padrão servido');
        } else {
            console.log('✅ Favicon customizado servido');
        }
    });
});

// ===== ROTAS PARA ARQUIVOS COMUNS =====
const commonRoutes = [
    '/robots.txt',
    '/sitemap.xml',
    '/manifest.json',
    '/sw.js'
];

commonRoutes.forEach(route => {
    app.get(route, (req, res) => {
        const filePath = path.join(publicPath, route.substring(1));
        
        res.sendFile(filePath, (err) => {
            if (err) {
                res.status(404).send(`Arquivo ${route} não encontrado`);
            }
        });
    });
});

// ===== ROTA PRINCIPAL =====
app.get('/', (req, res) => {
    try {
        const indexPath = path.join(publicPath, 'index.html');
        console.log('📁 Servindo página principal:', indexPath);
        
        res.sendFile(indexPath, (err) => {
            if (err) {
                console.error('❌ Erro ao servir index.html:', err);
                res.status(500).send(`
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <title>SKBORGES - Erro</title>
                        <meta charset="UTF-8">
                        <style>
                            body { font-family: Arial, sans-serif; padding: 2rem; text-align: center; }
                            .error { color: #ef4444; }
                            .info { color: #64748b; }
                        </style>
                    </head>
                    <body>
                        <h1 class="error">❌ Erro no Servidor SKBORGES</h1>
                        <p>Não foi possível encontrar o arquivo index.html</p>
                        <p class="info">Caminho esperado: ${indexPath}</p>
                        <p class="info">Verifique se a estrutura de arquivos está correta.</p>
                    </body>
                    </html>
                `);
            }
        });
    } catch (error) {
        console.error('❌ Erro crítico:', error);
        res.status(500).send('Erro interno do servidor');
    }
});

// ===== API PARA GERAR RELATÓRIO =====
app.post('/api/gerar-relatorio', (req, res) => {
    try {
        console.log('📄 Gerando relatório SKBORGES...');
        console.log('📦 Dados recebidos:', Object.keys(req.body));
        
        const dadosFormulario = req.body;
        
        // Validação básica
        if (!dadosFormulario || Object.keys(dadosFormulario).length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Nenhum dado fornecido para o relatório'
            });
        }
        
        // Processar dados do formulário
        const {
            nomeCliente,
            nomeProjeto,
            detalhamentoEspecifico = [],
            observacaoCliente,
            observacaoProjeto,
            observacaoEscopo,
            observacaoDemandas,
            observacaoFinal
        } = dadosFormulario;
        
        // Criar relatório estruturado
        const relatorio = {
            id: `SKBORGES_${Date.now()}`,
            timestamp: new Date().toISOString(),
            cliente: {
                nome: nomeCliente || 'N/A',
                cnpjCpf: dadosFormulario.cnpjCpf || '',
                telefone: dadosFormulario.telefone || '',
                email: dadosFormulario.email || '',
                endereco: dadosFormulario.endereco || '',
                observacoes: observacaoCliente || ''
            },
            projeto: {
                nome: nomeProjeto || 'N/A',
                observacoes: observacaoProjeto || ''
            },
            escopo: {
                projetoArquitetura: !!dadosFormulario.projetoArquitetura,
                detalhamento: {
                    ativo: !!dadosFormulario.detalhamento,},
                observacoes: observacaoEscopo || ''
            },
            demandas: {
                lista: extrairDemandas(dadosFormulario),
                observacoes: observacaoDemandas || ''
            },
            observacoes: {
                finais: observacaoFinal || ''
            },
            formularioCompleto: dadosFormulario
        };
        
        console.log('✅ Relatório SKBORGES criado:', relatorio.id);
        
        res.json({
            success: true,
            message: 'Relatório gerado com sucesso!',
            data: relatorio,
            metadata: {
                totalCampos: Object.keys(dadosFormulario).length,
                temObservacoes: !!(observacaoCliente || observacaoProjeto || observacaoEscopo || observacaoDemandas || observacaoFinal),
                totalDemandas: relatorio.demandas.lista.length,
            }
        });

    } catch (error) {
        console.error('❌ Erro ao gerar relatório:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor ao gerar relatório',
            error: error.message
        });
    }
});

// ===== FUNÇÃO PARA EXTRAIR DEMANDAS =====
function extrairDemandas(dados) {
    const demandas = [];
    
    // Extrair arrays de nomes e descrições
    let nomes = [];
    let descricoes = [];
    
    // Verificar se existem dados de demandas
    if (dados['demandaNome[]']) {
        nomes = Array.isArray(dados['demandaNome[]']) ? 
                dados['demandaNome[]'] : 
                [dados['demandaNome[]']];
    }
    
    if (dados['demandaDescricao[]']) {
        descricoes = Array.isArray(dados['demandaDescricao[]']) ? 
                     dados['demandaDescricao[]'] : 
                     [dados['demandaDescricao[]']];
    }
    
    // Criar lista de demandas
    const maxLength = Math.max(nomes.length, descricoes.length);
    for (let i = 0; i < maxLength; i++) {
        const nome = nomes[i] || '';
        const descricao = descricoes[i] || '';
        
        // Só adicionar se pelo menos um campo tiver conteúdo
        if (nome.trim() || descricao.trim()) {
            demandas.push({
                numero: i + 1,
                ambiente: nome.trim(),
                descricao: descricao.trim(),
                indice: i
            });
        }
    }
    
    return demandas;
}

// ===== API PARA SALVAR RASCUNHO =====
app.post('/api/salvar-rascunho', (req, res) => {
    try {
        console.log('💾 Salvando rascunho SKBORGES...');
        
        const rascunho = {
            id: `DRAFT_SKBORGES_${Date.now()}`,
            timestamp: new Date().toISOString(),
            dados: req.body,
            versao: '3.0.0'
        };
        
        res.json({
            success: true,
            message: 'Rascunho salvo com sucesso!',
            data: rascunho
        });
        
    } catch (error) {
        console.error('❌ Erro ao salvar rascunho:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao salvar rascunho',
            error: error.message
        });
    }
});

// ===== API DE STATUS DO SISTEMA =====
app.get('/api/status', (req, res) => {
    res.json({
        sistema: 'SKBORGES',
        versao: '3.0.0',
        status: 'online',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memoria: process.memoryUsage(),
        ambiente: process.env.NODE_ENV || 'development',
        estrutura: {
            publicPath: publicPath,
            indexExists: require('fs').existsSync(path.join(publicPath, 'index.html')),
            jsExists: require('fs').existsSync(path.join(publicPath, 'js', 'script.js')),
            cssExists: require('fs').existsSync(path.join(publicPath, 'css', 'styles.css'))
        }
    });
});

// ===== API PARA VALIDAR FORMULÁRIO =====
app.post('/api/validar-formulario', (req, res) => {
    try {
        const dados = req.body;
        const erros = [];
        
        // Validações básicas
        if (!dados.nomeCliente || dados.nomeCliente.trim().length < 2) {
            erros.push('Nome do cliente é obrigatório (mínimo 2 caracteres)');
        }
        
        if (!dados.nomeProjeto || dados.nomeProjeto.trim().length < 2) {
            erros.push('Nome do projeto é obrigatório (mínimo 2 caracteres)');
        }
        
        // Validar email se fornecido
        if (dados.email && dados.email.trim()) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(dados.email)) {
                erros.push('Email inválido');
            }
        }
        
        // Validar demandas
        const demandas = extrairDemandas(dados);
        if (demandas.length === 0) {
            erros.push('Pelo menos uma demanda deve ser informada');
        }
        
        res.json({
            success: erros.length === 0,
            message: erros.length === 0 ? 'Formulário válido' : 'Erros encontrados',
            erros: erros,
            totalDemandas: demandas.length
        });
        
    } catch (error) {
        console.error('❌ Erro na validação:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno na validação',
            error: error.message
        });
    }
});

// ===== MIDDLEWARE DE ERRO 404 PERSONALIZADO =====
app.use((req, res) => {
    console.log(`❌ Rota não encontrada: ${req.method} ${req.url}`);
    
    res.status(404).json({
        success: false,
        message: `Rota não encontrada: ${req.method} ${req.url}`,
        sistema: 'SKBORGES v3.0.0',
        timestamp: new Date().toISOString(),
        sugestoes: [
            'Verifique se a URL está correta',
            'Consulte a documentação da API',
            'Acesse / para a página principal'
        ]
    });
});

// ===== MIDDLEWARE DE ERRO GLOBAL =====
app.use((error, req, res, next) => {
    console.error('❌ Erro global SKBORGES:', error);
    
    res.status(500).json({
        success: false,
        message: 'Erro interno do servidor SKBORGES',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Erro interno',
        sistema: 'SKBORGES v3.0.0',
        timestamp: new Date().toISOString()
    });
});

// ===== INICIAR SERVIDOR =====
app.listen(PORT, () => {
    console.log('==========================================');
    console.log(`🚀 SKBORGES v3.0.0 iniciado com sucesso!`);
    console.log(`📡 URL: http://localhost:${PORT}`);
    console.log(`📁 Pasta pública: ${publicPath}`);
    console.log(`🎯 Ambiente: ${process.env.NODE_ENV || 'development'}`);
    console.log(`⏰ Horário: ${new Date().toLocaleString('pt-BR')}`);
    console.log(`🔧 Favicon: Suporte automático incluído`);
    console.log(`📋 APIs disponíveis:`);
    console.log(`   - POST /api/gerar-relatorio`);
    console.log(`   - POST /api/salvar-rascunho`);
    console.log(`   - POST /api/validar-formulario`);
    console.log(`   - GET /api/status`);
    console.log('==========================================');
});

// ===== GRACEFUL SHUTDOWN =====
process.on('SIGTERM', () => {
    console.log('🛑 Recebido SIGTERM, encerrando servidor...');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('🛑 Recebido SIGINT, encerrando servidor...');
    process.exit(0);
});

module.exports = app;
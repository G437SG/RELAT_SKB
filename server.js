const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

// ===== CONFIGURAÇÃO DE DIRETÓRIOS =====
const publicPath = path.join(__dirname, 'formulario-projeto-arquitetonico', 'public');

// Criar diretório se não existir
if (!fs.existsSync(publicPath)) {
    fs.mkdirSync(publicPath, { recursive: true });
    console.log(`📁 Diretório criado: ${publicPath}`);
}

// ===== MIDDLEWARE BÁSICO =====
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ===== MIDDLEWARE PARA LOGS DETALHADOS =====
app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    console.log(`📡 ${timestamp} - ${req.method} ${req.url}`);
    next();
});

// ===== SERVIR ARQUIVOS ESTÁTICOS =====
app.use(express.static(publicPath, {
    maxAge: '1d',
    etag: true,
    index: ['index.html']
}));

// ===== MIDDLEWARE PARA CORS =====
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    
    if (req.method === 'OPTIONS') {
        res.sendStatus(200);
    } else {
        next();
    }
});

// ===== ROTA ESPECÍFICA PARA FAVICON =====
app.get('/favicon.ico', (req, res) => {
    const faviconPath = path.join(publicPath, 'images', 'favicon.ico');
    
    res.sendFile(faviconPath, (err) => {
        if (err) {
            res.status(204).end();
        }
    });
});

// ===== ROTA PRINCIPAL - SERVIR FORMULÁRIO =====
app.get('/', (req, res) => {
    try {
        const indexPath = path.join(publicPath, 'index.html');
        console.log('📁 Servindo página principal:', indexPath);
        
        // Verificar se arquivo existe
        if (fs.existsSync(indexPath)) {
            res.sendFile(indexPath);
            console.log('✅ index.html servido com sucesso');
        } else {
            console.error('❌ Arquivo index.html não encontrado em:', indexPath);
            res.status(404).send(`
                <!DOCTYPE html>
                <html lang="pt-BR">
                <head>
                    <meta charset="UTF-8">
                    <title>SKBORGES - Arquivo não encontrado</title>
                    <style>
                        body { 
                            font-family: Arial, sans-serif; 
                            padding: 2rem; 
                            text-align: center;
                            background-color: #FFF4E6;
                        }
                        .error { color: #FF6B35; font-size: 1.5rem; margin-bottom: 1rem; }
                        .info { color: #555555; margin: 0.5rem 0; }
                        .path { background: #f5f5f5; padding: 1rem; border-radius: 8px; margin: 1rem 0; }
                    </style>
                </head>
                <body>
                    <div class="error">🏗️ SKBORGES - Sistema em Configuração</div>
                    <p class="info">O arquivo index.html não foi encontrado.</p>
                    <div class="path">
                        <strong>Caminho esperado:</strong><br>
                        ${indexPath}
                    </div>
                    <p class="info">Estrutura esperada:</p>
                    <p class="info">📁 formulario-projeto-arquitetonico/public/index.html</p>
                    <p class="info">📄 formulario-projeto-arquitetonico/public/style.css</p>
                    <p class="info">📄 formulario-projeto-arquitetonico/public/js/script.js</p>
                    <p class="info">🖼️ formulario-projeto-arquitetonico/public/images/logo.png</p>
                </body>
                </html>
            `);
        }
    } catch (error) {
        console.error('❌ Erro crítico ao servir página:', error);
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
            cnpjCpf,
            telefone,
            email,
            endereco,
            projetoArquitetura,
            detalhamento,
            observacaoCliente,
            observacaoProjeto,
            observacaoEscopo,
            observacaoDemandas,
            observacaoFinal
        } = dadosFormulario;
        
        // Extrair demandas do formulário
        const demandas = extrairDemandas(dadosFormulario);
        
        // Criar relatório estruturado
        const relatorio = {
            id: `SKBORGES_${Date.now()}`,
            timestamp: new Date().toISOString(),
            versao: '3.0.0',
            cliente: {
                nome: nomeCliente || 'N/A',
                cnpjCpf: cnpjCpf || '',
                telefone: telefone || '',
                email: email || '',
                endereco: endereco || '',
                observacoes: observacaoCliente || ''
            },
            projeto: {
                nome: nomeProjeto || 'N/A',
                observacoes: observacaoProjeto || ''
            },
            escopo: {
                projetoArquitetura: !!projetoArquitetura,
                detalhamento: {
                    ativo: !!detalhamento,
                    especificos: extrairDetalhamentos(dadosFormulario)
                },
                observacoes: observacaoEscopo || ''
            },
            demandas: {
                total: demandas.length,
                lista: demandas,
                observacoes: observacaoDemandas || ''
            },
            observacoes: {
                finais: observacaoFinal || ''
            },
            metadata: {
                totalCampos: Object.keys(dadosFormulario).length,
                temObservacoes: !!(observacaoCliente || observacaoProjeto || observacaoEscopo || observacaoDemandas || observacaoFinal),
                totalDemandas: demandas.length,
                dataProcessamento: new Date().toLocaleString('pt-BR')
            },
            formularioCompleto: dadosFormulario
        };
        
        console.log('✅ Relatório SKBORGES criado:', relatorio.id);
        console.log('📊 Total de demandas:', demandas.length);
        
        res.json({
            success: true,
            message: 'Relatório gerado com sucesso!',
            data: relatorio,
            metadata: relatorio.metadata
        });

    } catch (error) {
        console.error('❌ Erro ao gerar relatório:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor ao gerar relatório',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// ===== FUNÇÃO PARA EXTRAIR DEMANDAS =====
function extrairDemandas(dados) {
    const demandas = [];
    
    try {
        let nomes = [];
        let descricoes = [];
        
        // Verificar diferentes formatos possíveis dos dados
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
        
        // Buscar por padrões alternativos
        Object.keys(dados).forEach(key => {
            if (key.startsWith('demandaNome_')) {
                const index = key.split('_')[1];
                nomes[index] = dados[key];
            }
            if (key.startsWith('demandaDescricao_')) {
                const index = key.split('_')[1];
                descricoes[index] = dados[key];
            }
        });
        
        // Criar lista de demandas estruturada
        const maxLength = Math.max(nomes.length, descricoes.length);
        for (let i = 0; i < maxLength; i++) {
            const nome = (nomes[i] || '').toString().trim();
            const descricao = (descricoes[i] || '').toString().trim();
            
            if (nome || descricao) {
                demandas.push({
                    numero: i + 1,
                    ambiente: nome,
                    descricao: descricao,
                    indice: i,
                    timestamp: new Date().toISOString()
                });
            }
        }
        
        console.log(`📋 Extraídas ${demandas.length} demandas do formulário`);
        
    } catch (error) {
        console.error('❌ Erro ao extrair demandas:', error);
    }
    
    return demandas;
}

// ===== FUNÇÃO PARA EXTRAIR DETALHAMENTOS =====
function extrairDetalhamentos(dados) {
    const detalhamentos = [];
    
    try {
        const tiposDetalhamento = [
            'detalhamentoEletrico',
            'detalhamentoHidraulico',
            'detalhamentoEstrutura',
            'detalhamentoAcabamento',
            'detalhamentoMobiliario',
            'detalhamentoIluminacao',
            'detalhamentoJardim'
        ];
        
        tiposDetalhamento.forEach(tipo => {
            if (dados[tipo]) {
                detalhamentos.push({
                    tipo: tipo.replace('detalhamento', '').toLowerCase(),
                    nome: tipo.replace('detalhamento', ''),
                    ativo: true,
                    observacoes: dados[tipo + 'Obs'] || ''
                });
            }
        });
        
        console.log(`🔧 Extraídos ${detalhamentos.length} detalhamentos específicos`);
        
    } catch (error) {
        console.error('❌ Erro ao extrair detalhamentos:', error);
    }
    
    return detalhamentos;
}

// ===== API PARA SALVAR RASCUNHO =====
app.post('/api/salvar-rascunho', (req, res) => {
    try {
        console.log('💾 Salvando rascunho SKBORGES...');
        
        const rascunho = {
            id: `DRAFT_SKBORGES_${Date.now()}`,
            timestamp: new Date().toISOString(),
            versao: '3.0.0',
            dados: req.body,
            metadata: {
                totalCampos: Object.keys(req.body).length,
                dataUltimaEdicao: new Date().toLocaleString('pt-BR')
            }
        };
        
        console.log('✅ Rascunho salvo:', rascunho.id);
        
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

// ===== API PARA VALIDAR FORMULÁRIO =====
app.post('/api/validar-formulario', (req, res) => {
    try {
        console.log('✅ Validando formulário SKBORGES...');
        
        const dados = req.body;
        const erros = [];
        const avisos = [];
        
        // Validações obrigatórias
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
        
        // Validar telefone se fornecido
        if (dados.telefone && dados.telefone.trim()) {
            const telefoneRegex = /^[\d\s\(\)\-\+]+$/;
            if (!telefoneRegex.test(dados.telefone) || dados.telefone.length < 8) {
                avisos.push('Formato de telefone pode estar incorreto');
            }
        }
        
        // Validar demandas
        const demandas = extrairDemandas(dados);
        if (demandas.length === 0) {
            erros.push('Pelo menos uma demanda deve ser informada');
        }
        
        // Avisos para campos opcionais mas recomendados
        if (!dados.email || !dados.email.trim()) {
            avisos.push('Email não informado - recomendado para contato');
        }
        
        if (!dados.telefone || !dados.telefone.trim()) {
            avisos.push('Telefone não informado - recomendado para contato');
        }
        
        if (!dados.endereco || !dados.endereco.trim()) {
            avisos.push('Endereço não informado - importante para o projeto');
        }
        
        const isValid = erros.length === 0;
        
        console.log(`📝 Validação concluída: ${isValid ? 'VÁLIDO' : 'INVÁLIDO'}`);
        console.log(`❌ Erros: ${erros.length}, ⚠️ Avisos: ${avisos.length}`);
        
        res.json({
            success: isValid,
            message: isValid ? 'Formulário válido' : 'Erros encontrados na validação',
            erros: erros,
            avisos: avisos,
            estatisticas: {
                totalCampos: Object.keys(dados).length,
                totalDemandas: demandas.length,
                temObservacoes: !!(dados.observacaoCliente || dados.observacaoProjeto || dados.observacaoEscopo || dados.observacaoDemandas || dados.observacaoFinal)
            }
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

// ===== API DE STATUS DO SISTEMA =====
app.get('/api/status', (req, res) => {
    const statusArquivos = {
        indexExists: fs.existsSync(path.join(publicPath, 'index.html')),
        cssExists: fs.existsSync(path.join(publicPath, 'style.css')),
        jsExists: fs.existsSync(path.join(publicPath, 'js', 'script.js')),
        logoExists: fs.existsSync(path.join(publicPath, 'images', 'logo.png'))
    };
    
    res.json({
        sistema: 'SKBORGES',
        versao: '3.0.0',
        status: 'online',
        timestamp: new Date().toISOString(),
        uptime: Math.floor(process.uptime()),
        memoria: {
            usada: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB',
            total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + 'MB'
        },
        ambiente: process.env.NODE_ENV || 'development',
        configuracao: {
            porta: PORT,
            publicPath: publicPath
        },
        arquivos: statusArquivos,
        saude: {
            arquivosOk: Object.values(statusArquivos).every(status => status),
            diretoriosOk: fs.existsSync(publicPath)
        }
    });
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
            'Acesse / para a página principal',
            'Consulte /api/status para verificar o sistema'
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
const server = app.listen(PORT, '0.0.0.0', () => {
    console.log('==========================================');
    console.log(`🚀 SKBORGES v3.0.0 INICIADO COM SUCESSO!`);
    console.log(`📡 URL: http://localhost:${PORT}`);
    console.log(`📁 Pasta pública: ${publicPath}`);
    console.log(`🎯 Ambiente: ${process.env.NODE_ENV || 'development'}`);
    console.log(`⏰ Iniciado em: ${new Date().toLocaleString('pt-BR')}`);
    console.log('==========================================');
    console.log('📋 APIs DISPONÍVEIS:');
    console.log('   GET  / - Formulário principal');
    console.log('   POST /api/gerar-relatorio - Gerar relatório');
    console.log('   POST /api/salvar-rascunho - Salvar progresso');
    console.log('   POST /api/validar-formulario - Validar dados');
    console.log('   GET  /api/status - Status do sistema');
    console.log('==========================================');
    
    // Verificar arquivos essenciais na inicialização
    const arquivosEssenciais = [
        { caminho: path.join(publicPath, 'index.html'), nome: 'index.html' },
        { caminho: path.join(publicPath, 'style.css'), nome: 'style.css' },
        { caminho: path.join(publicPath, 'js', 'script.js'), nome: 'js/script.js' },
        { caminho: path.join(publicPath, 'images', 'logo.png'), nome: 'images/logo.png' }
    ];
    
    console.log('📋 VERIFICAÇÃO DE ARQUIVOS:');
    arquivosEssenciais.forEach(arquivo => {
        if (fs.existsSync(arquivo.caminho)) {
            console.log(`✅ ${arquivo.nome} encontrado`);
        } else {
            console.log(`⚠️  ${arquivo.nome} NÃO encontrado`);
        }
    });
    
    console.log('==========================================');
});

// ===== GRACEFUL SHUTDOWN =====
process.on('SIGTERM', () => {
    console.log('🛑 Recebido SIGTERM, encerrando servidor graciosamente...');
    server.close(() => {
        console.log('✅ Servidor SKBORGES encerrado com sucesso');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('🛑 Recebido SIGINT, encerrando servidor graciosamente...');
    server.close(() => {
        console.log('✅ Servidor SKBORGES encerrado com sucesso');
        process.exit(0);
    });
});

module.exports = app;
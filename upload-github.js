// upload-skborges-github.js
const { execSync } = require('child_process');

const CONFIG = {
    userName: 'G437SG',
    userEmail: 'gabriel10goulart@gmail.com',
    repoName: 'RELAT_SKB',
    githubUsername: 'G437SG',
    projectPath: 'C:\\Users\\PC\\Desktop\\RELAT_SKB'
};

function log(message, color = 'white') {
    const colors = {
        green: '\x1b[32m',
        yellow: '\x1b[33m',
        cyan: '\x1b[36m',
        red: '\x1b[31m',
        white: '\x1b[37m',
        reset: '\x1b[0m'
    };
    console.log(`${colors[color]}${message}${colors.reset}`);
}

function executeCommand(command, description) {
    log(`🔄 ${description}...`, 'yellow');
    try {
        execSync(command, { 
            stdio: 'inherit',
            cwd: CONFIG.projectPath
        });
        log(`✅ ${description} - Concluído!`, 'green');
    } catch (error) {
        log(`❌ Erro em: ${description}`, 'red');
        console.error(error.message);
        process.exit(1);
    }
}

function uploadSKBORGES() {
    log('🚀 Iniciando upload do projeto SKBORGES...', 'green');
    log(`👤 Usuário: ${CONFIG.githubUsername}`, 'cyan');
    log(`📂 Repositório: ${CONFIG.repoName}`, 'cyan');
    log(`📧 Email: ${CONFIG.userEmail}`, 'cyan');
    console.log('');

    // Verificar se o diretório existe
    try {
        process.chdir(CONFIG.projectPath);
    } catch (error) {
        log('❌ Diretório do projeto não encontrado!', 'red');
        process.exit(1);
    }

    // Configurar Git
    executeCommand(
        `git config --global user.name "${CONFIG.userName}"`,
        'Configurando nome de usuário Git'
    );
    
    executeCommand(
        `git config --global user.email "${CONFIG.userEmail}"`,
        'Configurando email Git'
    );

    // Inicializar repositório
    executeCommand('git init', 'Inicializando repositório Git');
    
    // Adicionar arquivos
    executeCommand('git add .', 'Adicionando todos os arquivos');
    
    // Commit inicial detalhado
    const commitMessage = `🚀 Initial release: SKBORGES v4.0.1 - Sistema Profissional de Projetos Arquitetônicos

✨ Funcionalidades principais:
- Sistema completo de formulários arquitetônicos
- Geração de relatórios PDF profissionais
- Interface responsiva e moderna
- Validação de formulários em tempo real
- Gerenciamento dinâmico de ambientes
- Cálculo automático de prazos
- Máscaras de entrada de dados

🛠️ Stack tecnológico:
- Backend: Node.js + Express.js
- Frontend: HTML5, CSS3, JavaScript ES6+
- Icons: Font Awesome
- Sistema de logs avançado

📊 Desenvolvido por: G437SG
📧 Contato: gabriel10goulart@gmail.com
🏗️ Projeto: Sistema SKBORGES v4.0.1`;

    executeCommand(
        `git commit -m "${commitMessage}"`,
        'Fazendo commit inicial'
    );
    
    // Conectar repositório remoto
    const repoUrl = `https://github.com/${CONFIG.githubUsername}/${CONFIG.repoName}.git`;
    executeCommand(
        `git remote add origin ${repoUrl}`,
        'Conectando com repositório remoto'
    );
    
    // Configurar branch principal
    executeCommand('git branch -M main', 'Configurando branch principal');
    
    // Upload
    executeCommand('git push -u origin main', 'Fazendo upload para GitHub');

    console.log('');
    log('🎉 UPLOAD CONCLUÍDO COM SUCESSO!', 'green');
    log('🌐 Seu projeto está disponível em:', 'cyan');
    log(`   ${repoUrl.replace('.git', '')}`, 'white');
    console.log('');
    log('🚀 O projeto SKBORGES está agora no GitHub!', 'green');
}

// Executar upload
uploadSKBORGES();
// upload-github.js
const { execSync } = require('child_process');
const path = require('path');

// Configurações - ALTERE AQUI
const CONFIG = {
    userName: 'SEU_NOME_AQUI',
    userEmail: 'seu-email@exemplo.com',
    repoName: 'skborges-formularios-arquitetonicos',
    githubUsername: 'SEU_USUARIO_GITHUB'
};

function executeCommand(command, description) {
    console.log(`🔄 ${description}...`);
    try {
        execSync(command, { stdio: 'inherit' });
        console.log(`✅ ${description} - Concluído!`);
    } catch (error) {
        console.error(`❌ Erro em: ${description}`);
        console.error(error.message);
        process.exit(1);
    }
}

function uploadToGitHub() {
    console.log('🚀 Iniciando upload do projeto SKBORGES para GitHub...\n');

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
    
    // Commit inicial
    executeCommand(
        'git commit -m "🚀 Initial release: SKBORGES v4.0.1 - Sistema Profissional de Projetos Arquitetônicos"',
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

    console.log('\n🎉 UPLOAD CONCLUÍDO COM SUCESSO!');
    console.log(`🌐 Projeto disponível em: ${repoUrl.replace('.git', '')}`);
}

// Executar upload
uploadToGitHub();
# 🏗️ SKBORGES - Sistema Profissional de Formulários Arquitetônicos

![SKBORGES Logo](formulario-projeto-arquitetonico/public/images/logo.png)

## 📋 Descrição

O **SKBORGES** é um sistema profissional e moderno para criação e gestão de formulários arquitetônicos, desenvolvido para arquitetos e escritórios de arquitetura. O sistema permite criar, preencher e gerar relatórios detalhados de projetos arquitetônicos de forma intuitiva e eficiente.

## ✨ Características Principais

- 🎨 **Interface Moderna**: Design responsivo e intuitivo
- 📊 **Relatórios Detalhados**: Geração automática de relatórios em PDF
- 🏠 **Gestão de Ambientes**: Sistema dinâmico para adicionar ambientes e necessidades
- ⏰ **Cronograma Inteligente**: Cálculo automático de prazos
- 💾 **Dados Persistentes**: Salvamento automático do progresso
- 🔍 **Validação Completa**: Sistema robusto de validação de dados
- 📱 **100% Responsivo**: Funciona perfeitamente em desktop, tablet e mobile

## 🚀 Funcionalidades

### 📝 Formulário Completo
- **Dados do Cliente**: Informações completas de contato e localização
- **Dados do Projeto**: Especificações técnicas e tipologia
- **Escopo Detalhado**: Arquitetura, detalhamentos e projetos complementares
- **Ambientes Dinâmicos**: Adição ilimitada de ambientes e necessidades
- **Cronograma**: Gestão completa de prazos por etapa
- **Observações**: Campos específicos para cada seção

### 📊 Relatórios Profissionais
- **Design Profissional**: Layout moderno com identidade visual
- **Dados Completos**: Espelho fiel de todas as informações preenchidas
- **Status Visual**: Indicadores de campos preenchidos/vazios
- **Exportação PDF**: Geração automática para impressão ou envio
- **Metadados**: Informações de geração e identificação do relatório

## 🛠️ Tecnologias Utilizadas

- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Backend**: Node.js, Express.js
- **Estilização**: CSS Grid, Flexbox, CSS Variables
- **Arquitetura**: MVC, Modular, DRY Principles
- **Performance**: Lazy Loading, Debouncing, Caching

## ⚙️ Instalação e Configuração

### Pré-requisitos
- Node.js (versão 14 ou superior)
- npm ou yarn
- Navegador moderno (Chrome, Firefox, Safari, Edge)

### Instalação
```bash
# Clone o repositório
git clone https://github.com/SEU_USUARIO/skborges-formularios.git

# Entre no diretório
cd skborges-formularios

# Instale as dependências
npm install

# Inicie o servidor de desenvolvimento
npm start
```

### Configuração
1. O servidor iniciará automaticamente na porta 3000
2. Acesse: `http://localhost:3000`
3. O sistema estará pronto para uso!

## 📖 Como Usar

### 1. Preenchimento do Formulário
1. **Dados do Cliente**: Preencha as informações de contato
2. **Dados do Projeto**: Especifique detalhes técnicos
3. **Escopo**: Selecione serviços e detalhamentos
4. **Ambientes**: Adicione ambientes e suas necessidades
5. **Prazos**: Configure o cronograma do projeto
6. **Observações**: Adicione informações complementares

### 2. Geração de Relatório
1. Clique em **"Gerar Relatório PDF"**
2. Uma nova janela será aberta com o relatório
3. Use **Ctrl+P** para imprimir ou salvar como PDF
4. O relatório inclui todas as informações preenchidas

### 3. Funcionalidades Extras
- **Salvamento Automático**: O progresso é salvo automaticamente
- **Validação em Tempo Real**: Campos obrigatórios são destacados
- **Contador de Progresso**: Acompanhe o preenchimento
- **Adição Dinâmica**: Adicione quantos ambientes precisar

## 📁 Estrutura do Projeto

```
RELAT_SKB/
├── formulario-projeto-arquitetonico/
│   ├── public/
│   │   ├── index.html          # Página principal
│   │   ├── style.css           # Estilos principais
│   │   ├── js/
│   │   │   └── script.js       # Lógica da aplicação
│   │   └── images/
│   │       └── logo.png        # Logo do sistema
│   ├── server/                 # Backend (futuro)
│   ├── package.json           # Dependências do projeto
│   └── README.md              # Este arquivo
├── server.js                  # Servidor Node.js
└── package.json              # Configurações gerais
```

## 🎨 Personalização

### Cores e Tema
As cores podem ser customizadas no arquivo `style.css` através das variáveis CSS:

```css
:root {
  --primary-color: #FF6B35;      /* Laranja principal */
  --primary-light: #FF8C42;      /* Laranja claro */
  --primary-dark: #E55A2B;       /* Laranja escuro */
  /* ... outras variáveis */
}
```

### Logo e Identidade Visual
- Substitua `public/images/logo.png` pelo logo desejado
- Ajuste o título no arquivo `index.html`
- Personalize textos e labels conforme necessário

## 🧪 Testes

O projeto inclui arquivos de teste para validação:
- Teste de coleta de dados
- Teste de geração de relatórios
- Teste de funcionalidades específicas

## 📈 Versões

### v4.0.1 (Atual)
- ✅ Remoção da seção "Resumo Geral" dos relatórios
- ✅ Melhorias no sistema de logs e debug
- ✅ Correções de bugs na geração de PDF
- ✅ Otimizações de performance

### v4.0.0
- ✅ Refatoração completa para arquitetura modular
- ✅ Sistema de relatórios como espelho fiel do formulário
- ✅ Implementação de todos os campos e validações
- ✅ Design profissional e responsivo

## 🤝 Contribuição

Contribuições são bem-vindas! Para contribuir:

1. Faça um fork do projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo `LICENSE` para mais detalhes.

## 👨‍💻 Desenvolvido por

**SKBORGES Team**
- Sistema desenvolvido para arquitetos e escritórios de arquitetura
- Foco em usabilidade, performance e profissionalismo

## 📞 Suporte

Para suporte técnico ou dúvidas:
- 📧 Email: [seu-email@exemplo.com]
- 🐛 Issues: [GitHub Issues](https://github.com/SEU_USUARIO/skborges-formularios/issues)
- 📖 Documentação: [Wiki do Projeto](https://github.com/SEU_USUARIO/skborges-formularios/wiki)

---

⭐ **Se este projeto foi útil, não esqueça de dar uma estrela!** ⭐

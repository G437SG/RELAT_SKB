/**
 * SKBORGES - APLICATIVO PROFISSIONAL DE FORMULÁRIOS ARQUITETÔNICOS
 * Versão 4.0.1 (Refatorado para DRY)
 * @author SKBORGES Team
 * @version 4.0.1
 */

(function() {
    'use strict';

    // ===== CONFIGURAÇÃO DA APLICAÇÃO =====
    const APP_CONFIG = {
        name: 'SKBORGES Sistema',
        version: '4.0.0', // A versão funcional não muda
        autoSaveDelay: 2000,
        maxRetries: 3,
        minPrazo: 1,
        maxPrazo: 365
    };

    // ... (AppState, Logger, Utils, DOMManager não precisaram de mudanças para esta refatoração) ...
    // ===== ESTADO DA APLICAÇÃO =====
    const AppState = {
        isInitialized: false,
        demandCount: 0,
        lastSave: null,
        timeouts: [],
        formData: {},
        isGenerating: false
    };

    // ===== SISTEMA DE LOGS =====
    const Logger = {
        prefix: '[SKBORGES]',

        log(level, message, data) {
            const timestamp = new Date().toLocaleTimeString();
            const fullMessage = `${this.prefix} ${timestamp} [${level}] ${message}`;

            if (data) {
                console[level.toLowerCase()](fullMessage, data);
            } else {
                console[level.toLowerCase()](fullMessage);
            }
        },

        debug(message, data) { this.log('DEBUG', message, data); },
        info(message, data) { this.log('INFO', message, data); },
        success(message, data) { this.log('INFO', `✅ ${message}`, data); },
        warning(message, data) { this.log('WARN', `⚠️ ${message}`, data); },
        error(message, data) { this.log('ERROR', `❌ ${message}`, data); }
    };

    // ===== UTILITÁRIOS =====
    const Utils = {
        delay: (ms) => new Promise(resolve => setTimeout(resolve, ms)),

        debounce(func, wait) {
            let timeout;
            return function executedFunction(...args) {
                const later = () => {
                    clearTimeout(timeout);
                    func(...args);
                };
                clearTimeout(timeout);
                timeout = setTimeout(later, wait);
            };
        },

        formatCurrency(value) {
            return new Intl.NumberFormat('pt-BR', {
                style: 'currency',
                currency: 'BRL'
            }).format(value);
        },

        formatDate(date) {
            return new Intl.DateTimeFormat('pt-BR', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
            }).format(date);
        },

        sanitizeString(str) {
            return str ? str.trim().replace(/\s+/g, ' ') : '';
        },

        generateId() {
            return 'id_' + Math.random().toString(36).substr(2, 9);
        }
    };

    // ===== GERENCIADOR DE ELEMENTOS DOM =====
    const DOMManager = {
        cache: new Map(),

        get(id) {
            if (!this.cache.has(id)) {
                const element = document.getElementById(id);
                if (element) {
                    this.cache.set(id, element);
                }
            }
            return this.cache.get(id) || null;
        },

        getAll(selector) {
            return document.querySelectorAll(selector);
        },

        create(tag, options = {}) {
            const element = document.createElement(tag);

            Object.entries(options).forEach(([key, value]) => {
                if (key === 'className') {
                    element.className = value;
                } else if (key === 'innerHTML') {
                    element.innerHTML = value;
                } else if (key === 'textContent') {
                    element.textContent = value;
                } else if (key.startsWith('data-')) {
                    element.setAttribute(key, value);
                } else {
                    element[key] = value;
                }
            });

            return element;
        },

        cacheElements() {
            const elementsToCache = [
                'formularioProjeto', 'listaDemandas', 'contadorDemandas', 'adicionarDemanda',
                'prazoLevantamento', 'prazoLayout', 'prazoModelagem3d', 'prazoProjetoExecutivo',
                'prazoComplementares', 'prazoTotal', 'gerar', 'limpar', 'page-loading', 'scroll-to-top'
            ];

            elementsToCache.forEach(id => {
                const element = document.getElementById(id);
                if (element) {
                    this.cache.set(id, element);
                }
            });

            Logger.success(`${this.cache.size} elementos cacheados`);
        }
    };


    // ===== GERENCIADOR DE PRAZOS =====
    const PrazoManager = {
        campos: ['prazoLevantamento', 'prazoLayout', 'prazoModelagem3d', 'prazoProjetoExecutivo', 'prazoComplementares'],

        init() {
            this.setupEventListeners();
            this.calculateTotal();
            Logger.success('PrazoManager inicializado');
        },

        /**
         * NOVO: Função auxiliar para remover código duplicado.
         * A lógica para determinar a classe de status (success, warning, error) era idêntica
         * em `validatePrazo` e `calculateTotal`. Esta função centraliza essa lógica.
         */
        _getPrazoStatusClass(dias) {
            if (dias <= 30) return 'success';
            if (dias <= 60) return 'warning';
            return 'error';
        },

        setupEventListeners() {
            this.campos.forEach(campo => {
                const input = DOMManager.get(campo);
                if (input) {
                    input.addEventListener('input', Utils.debounce(() => {
                        this.validatePrazo(input);
                        this.calculateTotal();
                    }, 300));

                    input.addEventListener('blur', () => {
                        this.validatePrazo(input);
                    });
                }
            });
        },

        validatePrazo(input) {
            const value = parseInt(input.value);
            const parent = input.closest('.prazo-group');
            if (!parent) return;

            parent.classList.remove('success', 'warning', 'error');

            if (!value || value < APP_CONFIG.minPrazo || value > APP_CONFIG.maxPrazo) {
                if (value) {
                    parent.classList.add('error');
                }
                return false;
            }

            // REATORADO: Usa a função auxiliar para evitar duplicação de lógica.
            const statusClass = this._getPrazoStatusClass(value);
            parent.classList.add(statusClass);

            return true;
        },

        calculateTotal() {
            let total = 0;
            let hasValues = false;

            this.campos.forEach(campo => {
                const input = DOMManager.get(campo);
                if (input && input.value) {
                    const value = parseInt(input.value);
                    if (value > 0) {
                        total += value;
                        hasValues = true;
                    }
                }
            });

            const totalInput = DOMManager.get('prazoTotal');
            if (totalInput) {
                totalInput.value = hasValues ? total : '';
                const totalGroup = totalInput.closest('.prazo-group');
                if (totalGroup) {
                    totalGroup.classList.remove('success', 'warning', 'error');
                    if (hasValues) {
                        // REATORADO: Usa a mesma função auxiliar para o total.
                        const statusClass = this._getPrazoStatusClass(total);
                        totalGroup.classList.add(statusClass);
                    }
                }
            }
            Logger.debug(`Prazo total calculado: ${total} dias`);
        }
    };

    // ... (DemandManager e FormValidator permanecem iguais)
    // ===== GERENCIADOR DE DEMANDAS/AMBIENTES =====
    const DemandManager = {
        templates: {
            demanda: `
                <div class="demanda-linha animate-fade-in-up" data-index="{{index}}">
                    <div class="demanda-card">
                        <div class="demanda-header">
                            <div class="demanda-info">
                                <span class="demanda-numero">{{number}}</span>
                                <span class="demanda-titulo">Ambiente {{number}}</span>
                            </div>
                            <button type="button" class="btn-remove" data-index="{{index}}" aria-label="Remover ambiente {{number}}">
                                <i class="fas fa-times"></i>
                            </button>
                        </div>
                        <div class="demanda-inputs-inline">
                            <div class="input-group-inline ambiente-input-group">
                                <label class="input-label-compact">
                                    <i class="fas fa-home"></i> Ambiente
                                </label>
                                <input type="text" 
                                       name="ambiente[]" 
                                       class="demanda-nome-input" 
                                       placeholder="Ex: Sala, Cozinha, Escritório..."
                                       maxlength="100"
                                       autocomplete="off"
                                       required>
                            </div>
                            <div class="input-group-inline necessidades-input-group">
                                <label class="input-label-compact">
                                    <i class="fas fa-list-ul"></i> Necessidades
                                </label>
                                <input type="text" 
                                       name="necessidades[]" 
                                       class="demanda-desc-input" 
                                       placeholder="Descreva as necessidades específicas..."
                                       maxlength="300">
                            </div>
                        </div>
                    </div>
                </div>
            `
        },

        init() {
            this.setupEventListeners();
            this.addInitial();
            Logger.success('DemandManager inicializado');
        },

        setupEventListeners() {
            const addButton = DOMManager.get('adicionarDemanda');
            if (addButton) {
                addButton.addEventListener('click', () => this.add());
            }

            const container = DOMManager.get('listaDemandas');
            if (container) {
                container.addEventListener('click', (e) => {
                    if (e.target.closest('.btn-remove')) {
                        const index = parseInt(e.target.closest('.btn-remove').dataset.index);
                        this.remove(index);
                    }
                });
            }
        },

        add() {
            try {
                const container = DOMManager.get('listaDemandas');
                if (!container) {
                    Logger.error('Container de demandas não encontrado');
                    return;
                }

                const index = AppState.demandCount;
                const element = this.createElement(index);

                container.appendChild(element);
                AppState.demandCount++;

                this.updateCounter();
                this.focusNewDemand(element);

                Logger.success(`Ambiente ${index + 1} adicionado`);

            } catch (error) {
                Logger.error(`Erro ao adicionar ambiente: ${error.message}`);
            }
        },

        createElement(index) {
            const template = this.templates.demanda
                .replace(/{{index}}/g, index)
                .replace(/{{number}}/g, index + 1);

            const container = DOMManager.create('div');
            container.innerHTML = template;
            const element = container.firstElementChild;

            return element;
        },

        remove(index) {
            try {
                const element = document.querySelector(`[data-index="${index}"]`);
                if (!element) {
                    Logger.warning(`Elemento com índice ${index} não encontrado`);
                    return;
                }

                element.style.opacity = '0';
                element.style.transform = 'translateY(-20px)';

                setTimeout(() => {
                    element.remove();
                    this.reorderElements();
                    this.updateCounter();
                    Logger.success(`Ambiente ${index + 1} removido`);
                }, 300);

            } catch (error) {
                Logger.error(`Erro ao remover ambiente: ${error.message}`);
            }
        },

        reorderElements() {
            const elements = document.querySelectorAll('.demanda-linha');
            AppState.demandCount = elements.length;

            elements.forEach((element, newIndex) => {
                element.dataset.index = newIndex;

                const numero = element.querySelector('.demanda-numero');
                const titulo = element.querySelector('.demanda-titulo');
                const btnRemove = element.querySelector('.btn-remove');

                if (numero) numero.textContent = newIndex + 1;
                if (titulo) titulo.textContent = `Ambiente ${newIndex + 1}`;
                if (btnRemove) {
                    btnRemove.dataset.index = newIndex;
                    btnRemove.setAttribute('aria-label', `Remover ambiente ${newIndex + 1}`);
                }
            });
        },

        updateCounter() {
            const counter = DOMManager.get('contadorDemandas');
            if (counter) {
                const count = AppState.demandCount;
                counter.textContent = `${count} ambiente${count !== 1 ? 's' : ''}`;
            }
        },

        focusNewDemand(element) {
            const input = element.querySelector('.demanda-nome-input');
            if (input) {
                setTimeout(() => {
                    input.focus();
                    input.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }, 150);
            }
        },

        addInitial() {
            if (AppState.demandCount === 0) {
                this.add();
            }
        }
    };

    // ===== VALIDADOR DE FORMULÁRIO =====
    const FormValidator = {
        rules: {
            required: (value) => value && value.trim().length > 0,
            email: (value) => !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
            phone: (value) => !value || /^\(\d{2}\)\s\d{4,5}-\d{4}$/.test(value),
            minLength: (value, min) => !value || value.length >= min,
            maxLength: (value, max) => !value || value.length <= max
        },

        validateField(field) {
            const value = field.value;
            const rules = field.dataset.validate ? field.dataset.validate.split('|') : [];
            const parent = field.closest('.input-group');

            if (!parent) return true;

            parent.classList.remove('success', 'warning', 'error');

            for (let rule of rules) {
                const [ruleName, param] = rule.split(':');

                if (!this.rules[ruleName]) continue;

                const isValid = param ?
                    this.rules[ruleName](value, param) :
                    this.rules[ruleName](value);

                if (!isValid) {
                    parent.classList.add('error');
                    return false;
                }
            }

            if (value) {
                parent.classList.add('success');
            }

            return true;
        },

        validateForm() {
            const form = DOMManager.get('formularioProjeto');
            if (!form) return false;

            const fields = form.querySelectorAll('input[required], textarea[required]');
            let isValid = true;

            fields.forEach(field => {
                if (!this.validateField(field)) {
                    isValid = false;
                }
            });

            return isValid;
        }
    };


    // ===== GERADOR DE RELATÓRIOS =====
    const ReportGenerator = {
        isGenerating: false,
        
        /**
         * NOVO: Função auxiliar para remover duplicação de HTML.
         * Todas as funções `generate...Section` criavam a mesma estrutura de wrapper <div class="section">.
         * Esta função centraliza a criação dessa estrutura.
         */        _createSection(title, iconClass, contentHtml) {
            if (!contentHtml || contentHtml.trim() === '') return '';
            
            return `
                <div class="section">
                    <div class="section-header">
                        <i class="fas ${iconClass}"></i>
                        ${title}
                    </div>
                    <div class="section-content">
                        ${contentHtml}
                    </div>
                </div>
            `;
        },        async generate() {
            if (this.isGenerating) {
                Logger.warning('Geração já em andamento');
                return;
            }

            try {
                this.isGenerating = true;
                Logger.info('🚀 Iniciando geração do relatório...');
                this.showGeneratingState();

                Logger.info('📋 Coletando dados do formulário...');
                const formData = this.collectFormData();
                
                // DEBUG CRÍTICO: Mostrar exatamente o que foi coletado
                console.log('🔍 === DADOS CRÍTICOS PARA DEBUG ===');
                console.log('AMBIENTES:', formData.ambiente);
                console.log('NECESSIDADES:', formData.necessidades);
                console.log('OBSERVAÇÕES:');
                console.log('  - Cliente:', formData.observacaoCliente);
                console.log('  - Projeto:', formData.observacaoProjeto);
                console.log('  - Escopo:', formData.observacaoEscopo);
                console.log('  - Ambientes:', formData.observacaoAmbientes);
                console.log('  - Prazos:', formData.observacaoPrazos);
                console.log('  - Final:', formData.observacaoFinal);
                console.log('🚨 ===========================');

                Logger.info('🏗️ Criando HTML do relatório...');
                const html = this.createPrintableHTML(formData);

                Logger.info('🪟 Abrindo janela de impressão...');
                this.openPrintWindow(html);

                Logger.success('✅ Relatório gerado com sucesso');

            } catch (error) {
                Logger.error(`❌ Erro ao gerar relatório: ${error.message}`);
                Logger.error('Stack trace completo:', error);
                console.error('ERRO DETALHADO:', error);
                this.showError('Erro ao gerar relatório. Tente novamente.');
            } finally {
                this.isGenerating = false;
                this.hideGeneratingState();
                Logger.info('🔄 Finalizando processo de geração...');
            }},        collectFormData() {
            const form = DOMManager.get('formularioProjeto');
            if (!form) throw new Error('Formulário não encontrado');

            console.log('🔄 === INICIANDO COLETA ULTRA-COMPLETA DE DADOS ===');
            console.log('📋 Garantindo que TODOS os campos sejam capturados para o relatório espelho');

            // DADOS BÁSICOS DO CLIENTE
            const clienteData = {
                nomeCliente: this.getFieldValue('nomeCliente'),
                cnpjCpf: this.getFieldValue('cnpjCpf'),
                telefone: this.getFieldValue('telefone'),
                email: this.getFieldValue('email'),
                cep: this.getFieldValue('cep'),
                endereco: this.getFieldValue('endereco'),
                responsavelObra: this.getFieldValue('responsavelObra'),
                numeroResponsavel: this.getFieldValue('numeroResponsavel')
            };

            // DADOS DO PROJETO
            const projetoData = {
                nomeProjeto: this.getFieldValue('nomeProjeto'),
                metragemLote: this.getFieldValue('metragemLote'),
                areaConstruida: this.getFieldValue('areaConstruida'),
                tipoImovel: this.getRadioValue('tipoImovel'),
                outroTipoEspecificar: this.getFieldValue('outroTipoEspecificar'),
                tipoProjeto: this.getRadioValue('tipoProjeto')
            };

            // ESCOPO - ARQUITETURA
            const escopoArquitetura = {
                layout: this.getCheckboxValue('layout'),
                modelagem3d: this.getCheckboxValue('modelagem3d'),
                detalhamento: this.getCheckboxValue('detalhamento')
            };            // DETALHAMENTOS ESPECÍFICOS - GARANTIR QUE TODOS SEJAM CAPTURADOS
            const detalhamentoEspecifico = this.getCheckboxArrayValues('detalhamentoEspecifico[]');
            const todosDetalhamentos = [
                'Marcenaria', 'Detalhamento Áreas Molhadas', 'Forro', 'Iluminação',
                'Tomadas', 'Pisos', 'Executiva', 'Layout', 'Demolir e Construir', 'Apresentação'
            ];

            // PROJETOS COMPLEMENTARES
            const projetosComplementares = {
                arCondicionado: this.getCheckboxValue('arCondicionado'),
                eletrica: this.getCheckboxValue('eletrica'),
                dadosVoz: this.getCheckboxValue('dadosVoz'),
                hidraulica: this.getCheckboxValue('hidraulica'),
                cftv: this.getCheckboxValue('cftv'),
                alarme: this.getCheckboxValue('alarme'),
                incendio: this.getCheckboxValue('incendio')
            };

            // AMBIENTES E NECESSIDADES (DINÂMICOS)
            const ambientesData = this.collectAmbientesData();

            // PRAZOS
            const prazosData = {
                prazoLevantamento: this.getFieldValue('prazoLevantamento'),
                prazoLayout: this.getFieldValue('prazoLayout'),
                prazoModelagem3d: this.getFieldValue('prazoModelagem3d'),
                prazoProjetoExecutivo: this.getFieldValue('prazoProjetoExecutivo'),
                prazoComplementares: this.getFieldValue('prazoComplementares'),
                prazoTotal: this.getFieldValue('prazoTotal')
            };

            // OBSERVAÇÕES (TODAS)
            const observacoesData = {
                observacaoCliente: this.getFieldValue('observacaoCliente'),
                observacaoProjeto: this.getFieldValue('observacaoProjeto'),
                observacaoEscopo: this.getFieldValue('observacaoEscopo'),
                observacaoAmbientes: this.getFieldValue('observacaoAmbientes'),
                observacaoPrazos: this.getFieldValue('observacaoPrazos'),
                observacaoFinal: this.getFieldValue('observacaoFinal')
            };            // CONSOLIDAR TODOS OS DADOS - ESTRUTURA COMPLETA
            const data = {
                // Dados do cliente
                ...clienteData,
                // Dados do projeto
                ...projetoData,
                // Escopo arquitetura
                ...escopoArquitetura,
                // Projetos complementares
                ...projetosComplementares,
                // Prazos
                ...prazosData,
                // Observações
                ...observacoesData,
                // Arrays especiais
                detalhamentoEspecifico: detalhamentoEspecifico,
                todosDetalhamentos: todosDetalhamentos, // Lista completa para comparação
                ambiente: ambientesData.ambientes,
                necessidades: ambientesData.necessidades,
                // Metadados
                dataGeracao: new Date(),
                ambientesCount: ambientesData.ambientes.length,
                timestamp: Date.now()
            };

            // LOG DETALHADO DOS DADOS COLETADOS
            console.log('✅ === DADOS COLETADOS PARA RELATÓRIO ESPELHO ===');
            console.log('👤 CLIENTE (8 campos):', clienteData);
            console.log('🏗️ PROJETO (6 campos):', projetoData);
            console.log('📐 ESCOPO ARQUITETURA (3 checkboxes):', escopoArquitetura);
            console.log('🔧 DETALHAMENTOS SELECIONADOS:', detalhamentoEspecifico);
            console.log('🔧 DETALHAMENTOS DISPONÍVEIS:', todosDetalhamentos);
            console.log('⚙️ COMPLEMENTARES (7 checkboxes):', projetosComplementares);
            console.log('🏠 AMBIENTES (' + ambientesData.ambientes.length + '):', ambientesData.ambientes);
            console.log('📋 NECESSIDADES (' + ambientesData.necessidades.length + '):', ambientesData.necessidades);
            console.log('⏰ PRAZOS (6 campos):', prazosData);
            console.log('💭 OBSERVAÇÕES (6 campos):', observacoesData);
            console.log('📊 TOTAL DE CAMPOS COLETADOS:', Object.keys(data).length);
            console.log('🎯 === COLETA ULTRA-DETALHADA FINALIZADA ===');

            return data;
        },

        // Funções auxiliares para coleta específica
        getFieldValue(name) {
            const field = document.querySelector(`[name="${name}"]`);
            return field ? (field.value || '') : '';
        },

        getRadioValue(name) {
            const radio = document.querySelector(`input[name="${name}"]:checked`);
            return radio ? radio.value : '';
        },

        getCheckboxValue(name) {
            const checkbox = document.querySelector(`input[name="${name}"]`);
            return checkbox ? checkbox.checked : false;
        },

        getCheckboxArrayValues(name) {
            const checkboxes = document.querySelectorAll(`input[name="${name}"]:checked`);
            return Array.from(checkboxes).map(cb => cb.value);
        },

        collectAmbientesData() {
            const ambientes = [];
            const necessidades = [];
            
            const ambienteInputs = document.querySelectorAll('input[name="ambiente[]"]');
            const necessidadeInputs = document.querySelectorAll('input[name="necessidades[]"]');
            
            console.log(`🏠 Coletando ${ambienteInputs.length} ambientes e ${necessidadeInputs.length} necessidades`);
            
            ambienteInputs.forEach((input, index) => {
                const ambiente = input.value || '';
                const necessidade = necessidadeInputs[index] ? (necessidadeInputs[index].value || '') : '';
                
                ambientes.push(ambiente);
                necessidades.push(necessidade);
                
                console.log(`  ${index + 1}. "${ambiente}" -> "${necessidade}"`);
            });
            
            return { ambientes, necessidades };
        },        createPrintableHTML(formData) {
            try {
                Logger.info('📄 Iniciando criação do HTML do relatório...');
                
                const now = formData.dataGeracao;
                const reportId = Utils.generateId().toUpperCase();
                const fileName = `Projeto_${Utils.sanitizeString(formData.nomeProjeto || 'Sem_Nome')}_${Utils.formatDate(now).replace(/\//g, '-')}`;
                
                Logger.info('🏗️ Gerando seções do relatório...');
                
                // Gerar cada seção com tratamento de erro individual
                let clientSection, projectSection, scopeSection, environmentsSection, timelineSection, observationsSection;
                
                try {
                    Logger.info('👤 Gerando seção do cliente...');
                    clientSection = this.generateClientSection(formData);
                } catch (error) {
                    Logger.error('❌ Erro na seção do cliente:', error);
                    clientSection = '<div class="error">Erro ao gerar seção do cliente</div>';
                }
                
                try {
                    Logger.info('🏗️ Gerando seção do projeto...');
                    projectSection = this.generateProjectSection(formData);
                } catch (error) {
                    Logger.error('❌ Erro na seção do projeto:', error);
                    projectSection = '<div class="error">Erro ao gerar seção do projeto</div>';
                }
                
                try {
                    Logger.info('📐 Gerando seção do escopo...');
                    scopeSection = this.generateScopeSection(formData);
                } catch (error) {
                    Logger.error('❌ Erro na seção do escopo:', error);
                    scopeSection = '<div class="error">Erro ao gerar seção do escopo</div>';
                }
                
                try {
                    Logger.info('🏠 Gerando seção de ambientes...');
                    environmentsSection = this.generateEnvironmentsSection(formData);
                } catch (error) {
                    Logger.error('❌ Erro na seção de ambientes:', error);
                    environmentsSection = '<div class="error">Erro ao gerar seção de ambientes</div>';
                }
                
                try {
                    Logger.info('⏰ Gerando seção de cronograma...');
                    timelineSection = this.generateTimelineSection(formData);
                } catch (error) {
                    Logger.error('❌ Erro na seção de cronograma:', error);
                    timelineSection = '<div class="error">Erro ao gerar seção de cronograma</div>';
                }
                
                try {
                    Logger.info('💭 Gerando seção de observações...');
                    observationsSection = this.generateObservationsSection(formData);
                } catch (error) {
                    Logger.error('❌ Erro na seção de observações:', error);
                    observationsSection = '<div class="error">Erro ao gerar seção de observações</div>';
                }

                Logger.info('🎨 Montando HTML final...');
                return `
                    <!DOCTYPE html>
                    <html lang="pt-BR">
                    <head>
                        <meta charset="UTF-8">
                        <meta name="viewport" content="width=device-width, initial-scale=1.0">
                        <title>${fileName}</title>
                        <style>${this.getReportStyles()}</style>
                    </head>                    <body>
                        <div class="header">                            <div class="header-content">
                                <div class="logo-container">
                                <img src="images/logo.png" alt="SKBORGES Logo" class="logo-img" onerror="this.style.display='none';">
                                <div class="logo-text">
                                    <h1>SKBORGES</h1>
                                    <div class="subtitle">Sistema Profissional de Projetos Arquitetônicos</div>
                                </div>
                            </div>
                            <div class="version-info">
                                <span class="version-badge">v${APP_CONFIG.version}</span>
                            </div>
                        </div>
                        <div class="report-info">
                            <div class="report-title">Relatório de Projeto Arquitetônico</div>
                            <div class="meta">
                                <div>Data: ${now.toLocaleDateString('pt-BR')} às ${now.toLocaleTimeString('pt-BR')}</div>
                                <div>Arquivo: ${fileName}</div>
                                <div>ID: ${reportId}</div>
                            </div>
                        </div>
                    </div>                    <div class="container">
                        ${this._createSection('Informações do Cliente', 'fa-user', clientSection)}
                        ${this._createSection('Informações do Projeto', 'fa-building', projectSection)}
                        ${this._createSection('Escopo do Projeto', 'fa-list-check', scopeSection)}
                        ${this._createSection('Ambientes e Necessidades', 'fa-home', environmentsSection)}
                        ${this._createSection('Cronograma do Projeto', 'fa-clock', timelineSection)}
                        ${this._createSection('Observações', 'fa-sticky-note', observationsSection)}
                        
                        <div class="footer">
                            <div><strong>SKBORGES - Sistema de Projetos Arquitetônicos v${APP_CONFIG.version}</strong></div>
                            <div>Arquivo: ${fileName}</div>
                            <div>Gerado automaticamente em ${now.toLocaleString('pt-BR')}</div>
                        </div>                    </div>
                    <div class="no-print" style="position: fixed; top: 10px; right: 10px; z-index: 1000;">
                        <button onclick="window.print()" style="padding: 10px 20px; background: #FF5722; color: white; border: none; border-radius: 4px; cursor: pointer;">
                            🖨️ Imprimir/Salvar PDF
                        </button>
                        <button onclick="window.close()" style="padding: 10px 20px; background: #6c757d; color: white; border: none; border-radius: 4px; cursor: pointer; margin-left: 5px;">
                            ❌ Fechar
                        </button>
                    </div>
                </body>
                </html>`;

            } catch (error) {
                Logger.error('❌ Erro crítico na criação do HTML:', error);
                throw new Error(`Falha na geração do HTML do relatório: ${error.message}`);
            }
        },generateClientSection(data) {
            console.log('👤 Gerando seção completa do cliente');
            
            return `
                <div class="field-group">
                    <div class="field ${!data.nomeCliente ? 'field-empty' : 'field-filled'}">
                        <div class="field-label">Nome Completo *</div>
                        <div class="field-value ${!data.nomeCliente ? 'empty' : ''}">${data.nomeCliente || '(Não informado)'}</div>
                    </div>
                    <div class="field ${!data.cnpjCpf ? 'field-empty' : 'field-filled'}">
                        <div class="field-label">CNPJ/CPF</div>
                        <div class="field-value ${!data.cnpjCpf ? 'empty' : ''}">${data.cnpjCpf || '(Não informado)'}</div>
                    </div>
                    <div class="field ${!data.telefone ? 'field-empty' : 'field-filled'}">
                        <div class="field-label">Telefone *</div>
                        <div class="field-value ${!data.telefone ? 'empty' : ''}">${data.telefone || '(Não informado)'}</div>
                    </div>
                    <div class="field ${!data.email ? 'field-empty' : 'field-filled'}">
                        <div class="field-label">E-mail</div>
                        <div class="field-value ${!data.email ? 'empty' : ''}">${data.email || '(Não informado)'}</div>
                    </div>
                    <div class="field ${!data.cep ? 'field-empty' : 'field-filled'}">
                        <div class="field-label">CEP</div>
                        <div class="field-value ${!data.cep ? 'empty' : ''}">${data.cep || '(Não informado)'}</div>
                    </div>
                    <div class="field ${!data.endereco ? 'field-empty' : 'field-filled'}">
                        <div class="field-label">Endereço Completo</div>
                        <div class="field-value ${!data.endereco ? 'empty' : ''}">${data.endereco || '(Não informado)'}</div>
                    </div>
                    <div class="field ${!data.responsavelObra ? 'field-empty' : 'field-filled'}">
                        <div class="field-label">Responsável pela Obra</div>
                        <div class="field-value ${!data.responsavelObra ? 'empty' : ''}">${data.responsavelObra || '(Não informado)'}</div>
                    </div>
                    <div class="field ${!data.numeroResponsavel ? 'field-empty' : 'field-filled'}">
                        <div class="field-label">Tel. Responsável</div>
                        <div class="field-value ${!data.numeroResponsavel ? 'empty' : ''}">${data.numeroResponsavel || '(Não informado)'}</div>
                    </div>
                </div>`;
        },        generateProjectSection(data) {
            console.log('🏗️ Gerando seção completa do projeto');
            
            // Determinar qual tipo de imóvel foi selecionado
            let tipoImovelCompleto = data.tipoImovel || '(Não selecionado)';
            if (data.tipoImovel === 'Outro' && data.outroTipoEspecificar) {
                tipoImovelCompleto = `Outro: ${data.outroTipoEspecificar}`;
            } else if (data.tipoImovel === 'Outro' && !data.outroTipoEspecificar) {
                tipoImovelCompleto = 'Outro: (Não especificado)';
            }

            return `
                <div class="field-group">
                    <div class="field ${!data.nomeProjeto ? 'field-empty' : 'field-filled'}">
                        <div class="field-label">Nome do Projeto *</div>
                        <div class="field-value ${!data.nomeProjeto ? 'empty' : ''}">${data.nomeProjeto || '(Não informado)'}</div>
                    </div>
                    <div class="field ${!data.metragemLote ? 'field-empty' : 'field-filled'}">
                        <div class="field-label">Metragem do Lote</div>
                        <div class="field-value ${!data.metragemLote ? 'empty' : ''}">${data.metragemLote ? data.metragemLote + ' m²' : '(Não informado)'}</div>
                    </div>
                    <div class="field ${!data.areaConstruida ? 'field-empty' : 'field-filled'}">
                        <div class="field-label">Área Construída</div>
                        <div class="field-value ${!data.areaConstruida ? 'empty' : ''}">${data.areaConstruida ? data.areaConstruida + ' m²' : '(Não informado)'}</div>
                    </div>
                    <div class="field ${!data.tipoImovel ? 'field-empty' : 'field-filled'}">
                        <div class="field-label">Tipo de Imóvel *</div>
                        <div class="field-value ${!data.tipoImovel ? 'empty' : ''}">${tipoImovelCompleto}</div>
                    </div>
                    <div class="field ${!data.tipoProjeto ? 'field-empty' : 'field-filled'}">
                        <div class="field-label">Tipo de Projeto *</div>
                        <div class="field-value ${!data.tipoProjeto ? 'empty' : ''}">${data.tipoProjeto || '(Não selecionado)'}</div>
                    </div>
                </div>`;
        },        generateScopeSection(data) {
            console.log('📐 Gerando seção ULTRA-COMPLETA do escopo');
            console.log('📐 Garantindo que TODAS as opções apareçam, selecionadas ou não');
            
            let html = '';

            // Projeto Arquitetura - TODOS os itens, marcados ou não
            html += '<div class="escopo-group">';
            html += '<h4 class="escopo-subtitle"><i class="fas fa-drafting-compass"></i> Projeto Arquitetura</h4>';
            html += '<div class="checkbox-list">';
            
            const arquiteturaItems = [
                { key: 'layout', label: 'Layout', desc: 'Distribuição e organização dos espaços' },
                { key: 'modelagem3d', label: 'Modelagem 3D', desc: 'Visualização tridimensional do projeto' },
                { key: 'detalhamento', label: 'Detalhamento', desc: 'Especificações técnicas detalhadas' }
            ];

            arquiteturaItems.forEach(item => {
                const isChecked = data[item.key] === true;
                console.log(`📐 ${item.label}: ${isChecked ? 'MARCADO' : 'DESMARCADO'}`);
                
                html += `
                    <div class="checkbox-item ${isChecked ? 'checked' : 'unchecked'}">
                        <span class="checkbox-icon">${isChecked ? '✅' : '☐'}</span>
                        <div class="checkbox-content">
                            <strong>${item.label}</strong>
                            <small>${item.desc}</small>
                            <div class="status-badge ${isChecked ? 'selected' : 'not-selected'}">${isChecked ? 'SELECIONADO' : 'NÃO SELECIONADO'}</div>
                        </div>
                    </div>
                `;
            });

            html += '</div>';

            // Detalhamentos Específicos - TODOS os itens, sempre visíveis (usar lista completa)
            html += '<div class="sub-options">';
            html += '<h5 class="sub-title">📋 Detalhamentos Específicos (Marque todos que se aplicam):</h5>';
            html += '<div class="sub-checkbox-list">';

            // Usar a lista completa de detalhamentos
            const detalhamentoItems = data.todosDetalhamentos || [
                'Marcenaria', 'Detalhamento Áreas Molhadas', 'Forro', 'Iluminação',
                'Tomadas', 'Pisos', 'Executiva', 'Layout', 'Demolir e Construir', 'Apresentação'
            ];

            console.log('🔧 Detalhamentos selecionados:', data.detalhamentoEspecifico);
            console.log('🔧 Lista completa de detalhamentos:', detalhamentoItems);

            detalhamentoItems.forEach(item => {
                const isChecked = data.detalhamentoEspecifico && data.detalhamentoEspecifico.includes(item);
                console.log(`🔧 ${item}: ${isChecked ? 'MARCADO' : 'DESMARCADO'}`);
                
                html += `
                    <div class="sub-checkbox-item ${isChecked ? 'checked' : 'unchecked'}">
                        <span class="checkbox-icon">${isChecked ? '✅' : '☐'}</span>
                        <span class="item-name">${item}</span>
                        <span class="item-status ${isChecked ? 'selected' : 'not-selected'}">${isChecked ? 'SIM' : 'NÃO'}</span>
                    </div>
                `;
            });

            html += '</div></div>';
            html += '</div>';

            // Projetos Complementares - TODOS os itens
            html += '<div class="escopo-group">';  
            html += '<h4 class="escopo-subtitle"><i class="fas fa-cogs"></i> Projetos Complementares</h4>';
            html += '<div class="checkbox-list">';

            const complementarItems = [
                { key: 'arCondicionado', label: 'Ar Condicionado', desc: 'Sistema de climatização' },
                { key: 'eletrica', label: 'Elétrica', desc: 'Instalações elétricas' },
                { key: 'dadosVoz', label: 'Dados e Voz', desc: 'Rede de internet e telefonia' },
                { key: 'hidraulica', label: 'Hidráulica', desc: 'Instalações hidráulicas' },
                { key: 'cftv', label: 'CFTV', desc: 'Circuito fechado de TV' },
                { key: 'alarme', label: 'Alarme', desc: 'Sistema de segurança' },
                { key: 'incendio', label: 'Incêndio', desc: 'Sistema de prevenção' }
            ];

            complementarItems.forEach(item => {
                const isChecked = data[item.key] === true;
                console.log(`⚙️ ${item.label}: ${isChecked ? 'MARCADO' : 'DESMARCADO'}`);
                
                html += `
                    <div class="checkbox-item ${isChecked ? 'checked' : 'unchecked'}">
                        <span class="checkbox-icon">${isChecked ? '✅' : '☐'}</span>
                        <div class="checkbox-content">
                            <strong>${item.label}</strong>
                            <small>${item.desc}</small>
                            <div class="status-badge ${isChecked ? 'selected' : 'not-selected'}">${isChecked ? 'INCLUÍDO' : 'NÃO INCLUÍDO'}</div>
                        </div>
                    </div>
                `;
            });

            html += '</div></div>';

            console.log('📐 Seção de escopo ULTRA-COMPLETA gerada - TODAS as opções exibidas');
            return html;
        },generateEnvironmentsSection(data) {
            console.log('🏠 Gerando seção COMPLETA de ambientes');
            console.log('Ambientes recebidos:', data.ambiente);
            console.log('Necessidades recebidas:', data.necessidades);
            
            const ambientes = data.ambiente || [];
            const necessidades = data.necessidades || [];
            
            // Se não há ambientes, mostrar mensagem explicativa
            if (ambientes.length === 0) {
                console.log('🏠 Nenhum ambiente cadastrado');
                return `
                    <div class="no-environments">
                        <div class="empty-state">
                            <i class="fas fa-home empty-icon"></i>
                            <h4>Nenhum Ambiente Cadastrado</h4>
                            <p>O formulário não possui ambientes específicos definidos. Adicione ambientes para detalhar necessidades por espaço.</p>
                        </div>
                    </div>
                `;
            }
            
            // Gerar seção completa para cada ambiente
            let html = '<div class="environments-list">';
            
            // Garantir que temos o mesmo número de necessidades
            const maxLength = Math.max(ambientes.length, necessidades.length);
            
            for (let i = 0; i < maxLength; i++) {
                const ambiente = ambientes[i] || '';
                const necessidade = necessidades[i] || '';
                const hasAmbiente = ambiente.trim() !== '';
                const hasNecessidade = necessidade.trim() !== '';
                
                console.log(`🏠 Ambiente ${i + 1}: "${ambiente}" | Necessidade: "${necessidade}"`);
                
                html += `
                    <div class="ambiente-card ${(!hasAmbiente && !hasNecessidade) ? 'empty-ambiente' : 'filled-ambiente'}">
                        <div class="ambiente-header">
                            <span class="ambiente-number">${i + 1}</span>
                            <span class="ambiente-label">Ambiente ${i + 1}</span>
                        </div>
                        <div class="ambiente-content">
                            <div class="ambiente-name">
                                <strong>📍 Nome do Ambiente:</strong>
                                <div class="ambiente-title ${!hasAmbiente ? 'empty' : 'filled'}">${hasAmbiente ? ambiente : '(Não especificado)'}</div>
                            </div>
                            <div class="ambiente-needs">
                                <strong>📋 Necessidades Específicas:</strong>
                                <div class="ambiente-desc ${!hasNecessidade ? 'empty' : 'filled'}">${hasNecessidade ? necessidade : '(Nenhuma necessidade especificada)'}</div>
                            </div>
                        </div>
                        <div class="ambiente-status">
                            <span class="status-indicator ${(hasAmbiente || hasNecessidade) ? 'configured' : 'pending'}">
                                ${(hasAmbiente || hasNecessidade) ? '✅ Configurado' : '⚠️ Pendente'}
                            </span>
                        </div>
                    </div>
                `;
            }
            
            html += '</div>';
            
            // Resumo estatístico
            const preenchidos = ambientes.filter(a => a.trim() !== '').length;
            const comNecessidades = necessidades.filter(n => n.trim() !== '').length;
            
            html += `
                <div class="environments-summary">
                    <h5>📊 Resumo dos Ambientes</h5>
                    <div class="summary-stats">
                        <div class="stat-item">
                            <strong>Total de Ambientes:</strong> ${ambientes.length}
                        </div>
                        <div class="stat-item">
                            <strong>Ambientes Nomeados:</strong> ${preenchidos}
                        </div>
                        <div class="stat-item">
                            <strong>Com Necessidades Definidas:</strong> ${comNecessidades}
                        </div>
                    </div>
                </div>
            `;
            
            console.log('🏠 Seção de ambientes COMPLETA gerada');
            return html;
        },generateTimelineSection(data) {
            const prazos = [
                { label: 'Levantamento', value: data.prazoLevantamento, icon: 'fa-search' },
                { label: 'Layout', value: data.prazoLayout, icon: 'fa-drafting-compass' },
                { label: 'Modelagem 3D', value: data.prazoModelagem3d, icon: 'fa-cube' },
                { label: 'Projeto Executivo', value: data.prazoProjetoExecutivo, icon: 'fa-tools' },
                { label: 'Complementares', value: data.prazoComplementares, icon: 'fa-cogs' }
            ];

            let html = '<div class="prazos-grid">';
            
            // Mostrar todos os prazos, preenchidos ou não
            prazos.forEach(prazo => {
                const hasValue = prazo.value && prazo.value.trim();
                html += `
                    <div class="prazo-item ${hasValue ? 'filled' : 'empty'}">
                        <div class="prazo-icon"><i class="fas ${prazo.icon}"></i></div>
                        <div class="prazo-value">${hasValue ? prazo.value : '--'}</div>
                        <div class="prazo-label">${prazo.label}</div>
                        ${hasValue ? '<div class="prazo-unit">dias</div>' : '<div class="prazo-unit empty">não definido</div>'}
                    </div>
                `;
            });
            
            // Mostrar prazo total
            const hasTotal = data.prazoTotal && data.prazoTotal.trim();
            html += `
                <div class="prazo-item prazo-total ${hasTotal ? 'filled' : 'empty'}">
                    <div class="prazo-icon"><i class="fas fa-calculator"></i></div>
                    <div class="prazo-value">${hasTotal ? data.prazoTotal : '--'}</div>
                    <div class="prazo-label">TOTAL</div>
                    ${hasTotal ? '<div class="prazo-unit">dias</div>' : '<div class="prazo-unit empty">não calculado</div>'}
                </div>
            `;

            html += '</div>';
            return html;        },        generateObservationsSection(data) {
            console.log('💭 Gerando seção COMPLETA de observações');
            
            const observacoes = [
                { title: 'Observações sobre o Cliente', content: data.observacaoCliente, icon: '👤' },
                { title: 'Observações sobre o Projeto', content: data.observacaoProjeto, icon: '🏗️' },
                { title: 'Observações sobre o Escopo', content: data.observacaoEscopo, icon: '📐' },
                { title: 'Observações sobre os Ambientes', content: data.observacaoAmbientes, icon: '🏠' },
                { title: 'Observações sobre os Prazos', content: data.observacaoPrazos, icon: '⏰' },
                { title: 'Observações Finais', content: data.observacaoFinal, icon: '📝' }
            ];
            
            let html = '<div class="observations-grid">';
            let totalPreenchidas = 0;

            observacoes.forEach((obs, index) => {
                const hasObs = obs.content && obs.content.trim();
                if (hasObs) totalPreenchidas++;
                
                console.log(`💭 ${index + 1}. ${obs.title}: ${hasObs ? `"${obs.content}"` : 'VAZIO'}`);
                
                html += `
                    <div class="observacao-card ${hasObs ? 'filled' : 'empty'}">
                        <div class="observacao-header">
                            <span class="observacao-icon">${obs.icon}</span>
                            <div class="observacao-title">${obs.title}</div>
                            <span class="observacao-status ${hasObs ? 'has-content' : 'no-content'}">
                                ${hasObs ? '✅ Preenchida' : '⚪ Vazia'}
                            </span>
                        </div>
                        <div class="observacao-content">
                            <div class="observacao-text ${hasObs ? 'filled' : 'empty'}">
                                ${hasObs ? obs.content : '(Nenhuma observação informada)'}
                            </div>
                        </div>
                    </div>
                `;
            });

            html += '</div>';
            
            // Resumo das observações
            html += `
                <div class="observations-summary">
                    <h5>📊 Resumo das Observações</h5>
                    <div class="summary-stats">
                        <div class="stat-item">
                            <strong>Total de Campos:</strong> ${observacoes.length}
                        </div>
                        <div class="stat-item">
                            <strong>Campos Preenchidos:</strong> ${totalPreenchidas}
                        </div>
                        <div class="stat-item">
                            <strong>Campos Vazios:</strong> ${observacoes.length - totalPreenchidas}
                        </div>
                        <div class="stat-item">
                            <strong>Taxa de Preenchimento:</strong> ${Math.round((totalPreenchidas / observacoes.length) * 100)}%
                        </div>
                    </div>
                </div>
            `;

            console.log('💭 Seção de observações COMPLETA gerada');
            return html;        },

        getReportStyles() {
            return `
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; background: white; }
                .container { max-width: 800px; margin: 0 auto; padding: 0 2rem; }                .header { background: linear-gradient(135deg, #FF5722, #FF7043); color: white; padding: 2rem; margin-bottom: 2rem; }
                .header-content { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.5rem; }
                .logo-container { display: flex; align-items: center; gap: 1rem; }
                .logo-img { width: 60px; height: 60px; object-fit: contain; background: white; border-radius: 8px; padding: 8px; }
                .logo-text h1 { font-size: 2.5rem; margin: 0; font-weight: 700; }
                .logo-text .subtitle { font-size: 1rem; opacity: 0.9; margin-top: 0.25rem; }
                .version-info { text-align: right; }
                .version-badge { background: rgba(255, 255, 255, 0.2); padding: 0.4rem 0.8rem; border-radius: 20px; font-size: 0.9rem; font-weight: 600; }
                .report-info { text-align: center; border-top: 1px solid rgba(255, 255, 255, 0.3); padding-top: 1.5rem; }
                .report-title { font-size: 1.3rem; font-weight: 600; margin-bottom: 1rem; }
                .meta { font-size: 0.9rem; opacity: 0.8; line-height: 1.4; }
                .section { margin-bottom: 2rem; border: 1px solid #e9ecef; border-radius: 8px; overflow: hidden; }
                .section-header { background: #37474F; color: white; padding: 1rem 1.5rem; font-size: 1.1rem; font-weight: 600; display: flex; align-items: center; gap: 0.5rem; }
                .section-content { padding: 1.5rem; background: white; }
                .field-group { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1rem; margin-bottom: 1.5rem; }
                .field { margin-bottom: 0.75rem; }
                .field-label { font-weight: 600; color: #495057; margin-bottom: 0.25rem; font-size: 0.9rem; }
                .field-value { color: #212529; font-size: 0.95rem; padding: 0.5rem 0; border-bottom: 1px solid #f0f0f0; }
                .field-value.empty { color: #6c757d; font-style: italic; }
                
                /* Estilos para Escopo */
                .escopo-group { margin-bottom: 2rem; }
                .escopo-subtitle { color: #37474F; font-size: 1rem; font-weight: 600; margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem; }
                .checkbox-list { display: grid; gap: 0.75rem; margin-bottom: 1rem; }
                .checkbox-item { display: flex; align-items: flex-start; gap: 0.75rem; padding: 0.75rem; border-radius: 6px; border: 1px solid #e9ecef; }
                .checkbox-item.checked { background: #f8f9fa; border-color: #FF5722; }
                .checkbox-item.unchecked { background: #ffffff; border-color: #dee2e6; }
                .checkbox-icon { font-size: 1.1rem; margin-top: 0.1rem; }
                .checkbox-content strong { display: block; color: #212529; font-size: 0.9rem; }
                .checkbox-content small { color: #6c757d; font-size: 0.8rem; }
                
                /* Sub-opções */
                .sub-options { margin-top: 1rem; padding: 1rem; background: #f8f9fa; border-radius: 6px; }
                .sub-title { font-size: 0.85rem; font-weight: 600; color: #495057; margin-bottom: 0.75rem; }
                .sub-checkbox-list { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 0.5rem; }
                .sub-checkbox-item { display: flex; align-items: center; gap: 0.5rem; padding: 0.4rem 0.6rem; border-radius: 4px; font-size: 0.8rem; }
                .sub-checkbox-item.checked { background: #e8f5e8; color: #155724; }
                .sub-checkbox-item.unchecked { background: #fff3cd; color: #856404; }
                
                .list-items { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 0.5rem; margin: 1rem 0; }
                .list-item { padding: 0.5rem 0.75rem; background: #f8f9fa; border-radius: 4px; border-left: 3px solid #FF5722; font-size: 0.9rem; }
                .ambiente { background: #f8f9fa; border-radius: 6px; padding: 1rem; margin-bottom: 1rem; border-left: 4px solid #FF5722; }
                .ambiente-title { font-weight: 600; color: #FF5722; margin-bottom: 0.5rem; }
                .ambiente-desc { color: #495057; font-size: 0.9rem; line-height: 1.5; }
                .ambiente-desc.empty { color: #6c757d; font-style: italic; }                .prazos-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 1rem; }
                .prazo-item { text-align: center; padding: 1rem; border-radius: 6px; border: 1px solid #e9ecef; }
                .prazo-item.filled { background: #f8f9fa; border-color: #FF5722; }
                .prazo-item.empty { background: #fff3cd; border-color: #ffc107; }
                .prazo-icon { font-size: 1.2rem; color: #FF5722; margin-bottom: 0.5rem; }
                .prazo-value { font-size: 1.5rem; font-weight: 700; color: #FF5722; margin-bottom: 0.25rem; }
                .prazo-item.empty .prazo-value { color: #856404; font-size: 1.2rem; }
                .prazo-label { font-size: 0.8rem; color: #6c757d; margin-bottom: 0.25rem; font-weight: 600; }
                .prazo-unit { font-size: 0.75rem; color: #6c757d; }
                .prazo-unit.empty { color: #856404; font-style: italic; }
                .prazo-total { grid-column: span 2; background: #FF5722 !important; color: white !important; border-color: #FF5722 !important; }
                .prazo-total.empty { background: #6c757d !important; }
                .prazo-total .prazo-icon, .prazo-total .prazo-value, .prazo-total .prazo-label, .prazo-total .prazo-unit { color: white !important; }
                .prazo-total.empty .prazo-value { color: #f8f9fa !important; }
                .observacao { margin-bottom: 1rem; padding: 1rem; border-radius: 6px; border: 1px solid #e9ecef; }
                .observacao.filled { background: #f8f9fa; }
                .observacao.empty { background: #fff3cd; }
                .observacao-title { font-weight: 600; color: #495057; margin-bottom: 0.5rem; font-size: 0.9rem; }
                .observacao-text { color: #212529; font-size: 0.9rem; line-height: 1.5; }
                .observacao.empty .observacao-text { color: #856404; font-style: italic; }
                  /* Estilos específicos para ambientes e observações */
                .environments-list { margin-bottom: 1.5rem; }
                .ambiente-card { border: 1px solid #e9ecef; border-radius: 6px; margin-bottom: 1rem; overflow: hidden; }
                .ambiente-card.filled-ambiente { border-left: 4px solid #FF5722; }
                .ambiente-card.empty-ambiente { border-left: 4px solid #ffc107; background: #fff3cd; }
                .ambiente-header { background: #f8f9fa; padding: 0.75rem 1rem; display: flex; align-items: center; gap: 0.5rem; }
                .ambiente-number { background: #FF5722; color: white; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.8rem; font-weight: 600; }
                .ambiente-label { font-weight: 600; color: #495057; }
                .ambiente-content { padding: 1rem; }
                .ambiente-name, .ambiente-needs { margin-bottom: 0.75rem; }
                .ambiente-title, .ambiente-desc { margin-top: 0.5rem; font-size: 0.9rem; }
                .ambiente-title.filled, .ambiente-desc.filled { color: #212529; }
                .ambiente-title.empty, .ambiente-desc.empty { color: #6c757d; font-style: italic; }
                .ambiente-status { padding: 0.5rem 1rem; background: #f8f9fa; text-align: center; }
                .status-indicator.configured { color: #155724; font-weight: 600; }
                .status-indicator.pending { color: #856404; font-weight: 600; }
                .environments-summary { margin-top: 1.5rem; padding: 1rem; background: #f8f9fa; border-radius: 6px; }
                .environments-summary h5 { color: #FF5722; margin-bottom: 0.75rem; }
                .summary-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 0.5rem; }
                .observations-grid { display: grid; gap: 1rem; }
                .observacao-card { border: 1px solid #e9ecef; border-radius: 6px; overflow: hidden; }
                .observacao-card.filled { border-left: 4px solid #FF5722; }
                .observacao-card.empty { border-left: 4px solid #ffc107; background: #fff3cd; }
                .observacao-header { background: #f8f9fa; padding: 0.75rem 1rem; display: flex; align-items: center; justify-content: space-between; }
                .observacao-icon { font-size: 1.1rem; }
                .observacao-title { font-weight: 600; color: #495057; }
                .observacao-status.has-content { color: #155724; font-size: 0.8rem; font-weight: 600; }
                .observacao-status.no-content { color: #856404; font-size: 0.8rem; font-weight: 600; }
                .observacao-content { padding: 1rem; }
                .observacao-text.filled { color: #212529; }
                .observacao-text.empty { color: #6c757d; font-style: italic; }
                .observations-summary { margin-top: 1.5rem; padding: 1rem; background: #f8f9fa; border-radius: 6px; }
                .observations-summary h5 { color: #FF5722; margin-bottom: 0.75rem; }
                
                /* Status badges */
                .status-badge { font-size: 0.7rem; padding: 0.2rem 0.5rem; border-radius: 3px; font-weight: 600; margin-top: 0.25rem; }
                .status-badge.selected { background: #d4edda; color: #155724; }
                .status-badge.not-selected { background: #fff3cd; color: #856404; }
                .item-status { font-size: 0.7rem; font-weight: 600; }
                .item-status.selected { color: #155724; }
                .item-status.not-selected { color: #856404; }                .footer { margin-top: 3rem; padding: 1.5rem; background: #f8f9fa; border-radius: 8px; text-align: center; color: #6c757d; font-size: 0.8rem; }
                @media print { 
                    .no-print { display: none !important; } 
                    body { font-size: 12px; } 
                    .container { padding: 0; } 
                    .header { margin-bottom: 1rem; padding: 1.5rem; }
                    .logo-img { width: 50px; height: 50px; }
                    .logo-text h1 { font-size: 2rem; }
                    .header-content { flex-direction: column; align-items: center; text-align: center; gap: 1rem; }
                    .version-info { text-align: center; }
                }
            `;
        },        openPrintWindow(html) {
            try {
                Logger.info('🪟 Tentando abrir janela de impressão...');
                
                // Tentar abrir a janela
                const printWindow = window.open('', '_blank', 'width=800,height=600,scrollbars=yes,resizable=yes');
                
                if (!printWindow) {
                    Logger.error('❌ Falha ao abrir janela - provavelmente bloqueada por pop-up blocker');
                    throw new Error('Não foi possível abrir a janela de impressão. Verifique se o bloqueador de pop-ups está desabilitado.');
                }

                Logger.info('✅ Janela aberta, escrevendo conteúdo...');
                printWindow.document.write(html);
                printWindow.document.close();

                printWindow.onload = () => {
                    Logger.info('📄 Conteúdo carregado na janela');
                    printWindow.focus();
                };

                // Verificar se a janela foi realmente criada
                setTimeout(() => {
                    if (printWindow.closed) {
                        Logger.warning('⚠️ A janela foi fechada pelo usuário ou bloqueador');
                    } else {
                        Logger.success('✅ Janela de relatório aberta com sucesso');
                    }
                }, 1000);

            } catch (error) {
                Logger.error('❌ Erro ao abrir janela de impressão:', error);
                throw error;
            }
        },

        showGeneratingState() {
            const button = DOMManager.get('gerar');
            if (button) {
                button.disabled = true;
                button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Gerando...';
            }
        },

        hideGeneratingState() {
            const button = DOMManager.get('gerar');
            if (button) {
                button.disabled = false;
                button.innerHTML = '<i class="fas fa-file-pdf"></i> Gerar Relatório PDF';
            }
        },

        showError(message) {
            alert(message);
        }
    };
    
    // ... (ProgressManager permanece igual)
    // ===== GERENCIADOR DE PROGRESSO =====
    const ProgressManager = {
        init() {
            this.setupEventListeners();
            this.updateProgress();
        },

        setupEventListeners() {
            const form = DOMManager.get('formularioProjeto');
            if (form) {
                form.addEventListener('input', Utils.debounce(() => {
                    this.updateProgress();
                }, 500));

                form.addEventListener('change', () => {
                    this.updateProgress();
                });
            }
        },

        updateProgress() {
            const form = DOMManager.get('formularioProjeto');
            if (!form) return;

            const allFields = form.querySelectorAll('input, textarea, select');
            const filledFields = Array.from(allFields).filter(field => {
                if (field.type === 'radio' || field.type === 'checkbox') {
                    return field.checked;
                }
                return field.value && field.value.trim() !== '';
            });

            const percentage = Math.round((filledFields.length / allFields.length) * 100);

            const progressFill = document.querySelector('.progress-fill');
            const progressPercentage = document.querySelector('.progress-percentage');

            if (progressFill) {
                progressFill.style.width = `${percentage}%`;
            }

            if (progressPercentage) {
                progressPercentage.textContent = `${percentage}%`;
            }
        }
    };


    // ===== SISTEMA DE MÁSCARAS =====
    const MaskManager = {
        init() {
            this.setupMasks();
        },
        
        /**
         * NOVO: Função auxiliar para aplicar máscaras.
         * A lógica de pegar o valor, limpar caracteres não-numéricos e aplicar uma formatação
         * era duplicada. Esta função genérica centraliza isso.
         */
        _applyMask(field, formatFunction) {
            const value = field.value.replace(/\D/g, '');
            field.value = formatFunction(value);
        },

        setupMasks() {
            const telefoneFields = document.querySelectorAll('input[type="tel"]');
            telefoneFields.forEach(field => {
                field.addEventListener('input', (e) => this.applyPhoneMask(e.target));
            });

            const cepField = DOMManager.get('cep');
            if (cepField) {
                cepField.addEventListener('input', (e) => this.applyCepMask(e.target));
            }
        },

        applyPhoneMask(field) {
            // REATORADO: Usa a função auxiliar com a lógica de formatação de telefone.
            this._applyMask(field, (value) => {
                if (value.length > 10) {
                    return value.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
                }
                return value.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
            });
        },

        applyCepMask(field) {
            // REATORADO: Usa a função auxiliar com a lógica de formatação de CEP.
            this._applyMask(field, (value) => value.replace(/(\d{5})(\d{3})/, '$1-$2'));
        }
    };

    // ... (ScrollManager e App permanecem iguais)
    // ===== SCROLL TO TOP =====
    const ScrollManager = {
        init() {
            this.setupScrollToTop();
            this.handleScroll();
        },

        setupScrollToTop() {
            const scrollButton = DOMManager.get('scroll-to-top');
            if (scrollButton) {
                scrollButton.addEventListener('click', () => {
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                });
            }

            window.addEventListener('scroll', Utils.debounce(() => {
                this.handleScroll();
            }, 100));
        },

        handleScroll() {
            const scrollButton = DOMManager.get('scroll-to-top');
            if (scrollButton) {
                if (window.pageYOffset > 300) {
                    scrollButton.style.display = 'flex';
                } else {
                    scrollButton.style.display = 'none';
                }
            }
        }
    };

    // ===== INICIALIZAÇÃO DA APLICAÇÃO =====
    const App = {
        async init() {
            try {
                Logger.info(`Inicializando ${APP_CONFIG.name} v${APP_CONFIG.version}`);

                if (document.readyState === 'loading') {
                    await new Promise(resolve => {
                        document.addEventListener('DOMContentLoaded', resolve);
                    });
                }

                DOMManager.cacheElements();

                PrazoManager.init();
                DemandManager.init();
                ProgressManager.init();
                MaskManager.init();
                ScrollManager.init();

                this.setupMainEventListeners();
                this.hideLoading();

                AppState.isInitialized = true;
                Logger.success('Aplicação inicializada com sucesso');

            } catch (error) {
                Logger.error(`Erro na inicialização: ${error.message}`);
                this.showError('Erro ao inicializar a aplicação');
            }
        },

        setupMainEventListeners() {
            const gerarButton = DOMManager.get('gerar');
            if (gerarButton) {
                gerarButton.addEventListener('click', (e) => {
                    e.preventDefault();
                    ReportGenerator.generate();
                });
            }

            const limparButton = DOMManager.get('limpar');
            if (limparButton) {
                limparButton.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.clearForm();
                });
                       }

            const form = DOMManager.get('formularioProjeto');
            if (form) {
                form.addEventListener('blur', (e) => {
                    if (e.target.matches('input, textarea, select')) {
                        FormValidator.validateField(e.target);
                    }
                }, true);
            }

            this.setupDynamicOptions();
        },

        setupDynamicOptions() {
            const tipoOutroRadio = document.getElementById('tipoOutro');
            const outroTipoContainer = document.getElementById('outroTipoContainer');

            if (tipoOutroRadio && outroTipoContainer) {
                document.querySelectorAll('input[name="tipoImovel"]').forEach(radio => {
                    radio.addEventListener('change', () => {
                        outroTipoContainer.style.display = tipoOutroRadio.checked ? 'block' : 'none';
                    });
                });
            }

            const tipoProjetoRadios = document.querySelectorAll('input[name="tipoProjeto"]');
            const reformaContainer = document.getElementById('subopcoes-reforma-container');
            const doZeroContainer = document.getElementById('subopcoes-do-zero-container');

            tipoProjetoRadios.forEach(radio => {
                radio.addEventListener('change', () => {
                    if (reformaContainer) {
                        reformaContainer.style.display = radio.value === 'Reforma' && radio.checked ? 'block' : 'none';
                    }
                    if (doZeroContainer) {
                        doZeroContainer.style.display = radio.value === 'Do Zero' && radio.checked ? 'block' : 'none';
                    }
                });
            });

            const detalhamentoCheckbox = DOMManager.get('detalhamento');
            const detalhamentoContainer = document.getElementById('subopcoes-detalhamento-container');

            if (detalhamentoCheckbox && detalhamentoContainer) {
                detalhamentoCheckbox.addEventListener('change', () => {
                    detalhamentoContainer.style.display = detalhamentoCheckbox.checked ? 'block' : 'none';
                });
            }
        },

        clearForm() {
            if (confirm('Tem certeza que deseja limpar todo o formulário? Esta ação não pode ser desfeita.')) {
                const form = DOMManager.get('formularioProjeto');
                if (form) {
                    form.reset();
                    const container = DOMManager.get('listaDemandas');
                    if (container) {
                        container.innerHTML = '';
                        AppState.demandCount = 0;
                        DemandManager.addInitial();
                        DemandManager.updateCounter();
                    }

                    PrazoManager.calculateTotal();
                    ProgressManager.updateProgress();

                    form.querySelectorAll('.input-group').forEach(group => {
                        group.classList.remove('success', 'warning', 'error');
                    });

                    Logger.success('Formulário limpo');
                }
            }
        },

        hideLoading() {
            const loading = DOMManager.get('page-loading');
            if (loading) {
                loading.style.opacity = '0';
                setTimeout(() => {
                    loading.style.display = 'none';
                }, 300);
            }
        },

        showError(message) {
            alert(message);
        }
    };

    // ===== INICIALIZAÇÃO AUTOMÁTICA =====
    App.init();

})();
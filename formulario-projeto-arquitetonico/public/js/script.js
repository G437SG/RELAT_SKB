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
    };    // ===== UTILITÁRIOS =====
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
        },

        // NOVO: Detectar dispositivos móveis
        isMobile() {
            return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
                   /Mobi|Android/i.test(navigator.userAgent) ||
                   (typeof window.orientation !== "undefined") ||
                   (navigator.maxTouchPoints > 1);
        },

        // NOVO: Detectar iOS especificamente  
        isIOS() {
            return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
                   (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
        },

        // NOVO: Detectar Android
        isAndroid() {
            return /Android/i.test(navigator.userAgent);
        },

        // NOVO: Criar arquivo blob para download
        createDownloadBlob(content, filename, mimeType = 'text/html') {
            const blob = new Blob([content], { type: mimeType });
            const url = window.URL.createObjectURL(blob);
            
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            link.style.display = 'none';
            
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            setTimeout(() => window.URL.revokeObjectURL(url), 100);
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
         */        _createSection(title, iconClass, content) {
            return `
                <div class="section">
                    <div class="section-header">
                        <i class="fas ${iconClass}"></i> - ${title}
                    </div>
                    <div class="section-content">
                        ${content}
                    </div>
                </div>
            `;
        },

        // FUNÇÃO AUXILIAR: Contar observações preenchidas
        _countFilledObservations(data) {
            const observationFields = [
                'observacaoCliente',
                'observacaoProjeto', 
                'observacaoEscopo',
                'observacaoAmbientes',
                'observacaoPrazos',
                'observacaoFinal'
            ];
            
            return observationFields.filter(field => 
                data[field] && data[field].trim() !== ''
            ).length;
        },

        async generate() {
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
                console.log('🚨 ============================');

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
            };            // OBSERVAÇÕES (TODAS)
            const observacoesData = {
                observacaoCliente: this.getFieldValue('observacaoCliente'),
                observacaoProjeto: this.getFieldValue('observacaoProjeto'),
                observacaoEscopo: this.getFieldValue('observacaoEscopo'),
                observacaoAmbientes: this.getFieldValue('observacaoAmbientes'),
                observacaoPrazos: this.getFieldValue('observacaoPrazos'),
                observacaoFinal: this.getFieldValue('observacaoFinal')
            };

            // DEBUG ESPECÍFICO PARA OBSERVAÇÕES
            console.log('💭 === DEBUG DETALHADO DAS OBSERVAÇÕES ===');
            Object.entries(observacoesData).forEach(([key, value]) => {
                console.log(`💭 ${key}: "${value}" (${value ? 'PREENCHIDA' : 'VAZIA'})`);
            });
            console.log('💭 ===================================');// CONSOLIDAR TODOS OS DADOS - ESTRUTURA COMPLETA
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
        },        // Funções auxiliares para coleta específica
        getFieldValue(name) {
            const field = document.querySelector(`[name="${name}"]`);
            const value = field ? (field.value || '').trim() : '';
            console.log(`🔍 Campo ${name}: "${value}" (${value ? 'PREENCHIDO' : 'VAZIO'})`);
            return value;
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
                        <title>Relatório SKBORGES - ${fileName} - CRIADO POR: Gabriel Goulart</title>
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
                        <div class="section">
                            <div class="section-header">
                                <i class="fas fa-users"></i>
                                <h2>INFORMAÇÕES GERAIS</h2>
                            </div>
                            <div class="section-content">
                                <div class="two-column-section">
                                    ${clientSection}
                                    ${projectSection}
                                </div>
                            </div>                        </div>                        <div class="main-sections">
                            <div class="section-with-observations">
                                ${this._createSection('Escopo do Projeto', 'fa-list-check', scopeSection)}
                                <div class="side-observations">
                                    <h4>💭 - Observações sobre o Escopo</h4>                                    <div class="related-obs">
                                        <div class="obs-item">📐 ${formData.observacaoEscopo || '(Nenhuma observação sobre escopo informada)'}</div>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="section-with-observations">
                                ${this._createSection('Ambientes e Necessidades', 'fa-home', environmentsSection)}
                                <div class="side-observations">
                                    <h4>💭 - Observações sobre os Ambientes</h4>
                                    <div class="related-obs">
                                        <div class="obs-item">🏠 ${formData.observacaoAmbientes || '(Nenhuma observação sobre ambientes informada)'}</div>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="section-with-observations">
                                ${this._createSection('Cronograma do Projeto', 'fa-clock', timelineSection)}
                                <div class="side-observations">
                                    <h4>💭 - Observações sobre os Prazos</h4>
                                    <div class="related-obs">
                                        <div class="obs-item">⏰ ${formData.observacaoPrazos || '(Nenhuma observação sobre prazos informada)'}</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <div class="section">
                            <div class="section-header">
                                <i class="fas fa-sticky-note"></i> - Observações Completas do Cliente
                            </div>
                            <div class="section-content">
                                <div class="observations-grid">                                    <div class="obs-column">
                                        <h4>👤 - Observações sobre o Cliente</h4>
                                        <div class="obs-item detailed">👤 ${formData.observacaoCliente || '(Nenhuma observação sobre cliente informada)'}</div>
                                        
                                        <h4>🏗️ - Observações sobre o Projeto</h4>
                                        <div class="obs-item detailed">📋 ${formData.observacaoProjeto || '(Nenhuma observação sobre projeto informada)'}</div>
                                    </div>
                                    
                                    <div class="obs-column">
                                        <h4>📊 - Observações Finais</h4>
                                        <div class="obs-item detailed">✨ ${formData.observacaoFinal || '(Nenhuma observação final informada)'}</div>
                                        
                                        <h4>📋 - Resumo das Observações</h4>
                                        <div class="summary-stats">
                                            <div class="stat-item">
                                                <strong>Total de Campos:</strong> 6
                                            </div>
                                            <div class="stat-item">
                                                <strong>Campos Preenchidos:</strong> ${this._countFilledObservations(formData)}
                                            </div>
                                            <div class="stat-item">
                                                <strong>Taxa de Preenchimento:</strong> ${Math.round((this._countFilledObservations(formData) / 6) * 100)}%
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                          <div class="footer">
                            <div><strong>SKBORGES - Sistema de Projetos Arquitetônicos v${APP_CONFIG.version}</strong></div>
                            <div>Arquivo: ${fileName}</div>
                            <div>Gerado automaticamente em ${now.toLocaleString('pt-BR')}</div>
                            <div class="creator-info">CRIADO POR: Gabriel Goulart</div>
                        </div></div>
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
            }        },generateClientSection(data) {
            console.log('👤 Gerando seção completa do cliente em formato lista');
            
            const clientFields = [
                { key: 'nomeCliente', label: 'Nome Completo', required: true },
                { key: 'cnpjCpf', label: 'CNPJ/CPF', required: false },
                { key: 'telefone', label: 'Telefone', required: true },
                { key: 'email', label: 'E-mail', required: false },
                { key: 'cep', label: 'CEP', required: false },
                { key: 'endereco', label: 'Endereço Completo', required: false },
                { key: 'responsavelObra', label: 'Responsável pela Obra', required: false },
                { key: 'numeroResponsavel', label: 'Tel. Responsável', required: false }
            ];

            let clientList = '';
            clientFields.forEach(field => {
                const value = data[field.key] || '';
                const isEmpty = !value.trim();
                const requiredMark = field.required ? '*' : '';
                const displayValue = isEmpty ? '(Não informado)' : value;
                const itemClass = isEmpty ? 'info-item empty' : 'info-item filled';
                
                clientList += `
                    <div class="${itemClass}">
                        <span class="info-label">${field.label}${requiredMark}:</span>
                        <span class="info-value">${displayValue}</span>
                    </div>
                `;
            });

            return `
                <div class="column-left">                    <h3 class="section-title">
                        <i class="fas fa-user"></i> - INFORMAÇÕES PESSOAIS
                    </h3>
                    <div class="info-list">
                        ${clientList}
                    </div>
                </div>
            `;        },        generateProjectSection(data) {
            console.log('🏗️ Gerando seção completa do projeto em formato lista');
            
            // Determinar qual tipo de imóvel foi selecionado
            let tipoImovelCompleto = data.tipoImovel || '(Não selecionado)';
            if (data.tipoImovel === 'Outro' && data.outroTipoEspecificar) {
                tipoImovelCompleto = `Outro: ${data.outroTipoEspecificar}`;
            } else if (data.tipoImovel === 'Outro' && !data.outroTipoEspecificar) {
                tipoImovelCompleto = 'Outro: (Não especificado)';
            }

            const projectFields = [
                { key: 'nomeProjeto', label: 'Nome do Projeto', required: true },
                { key: 'metragemLote', label: 'Metragem do Lote', required: false, unit: 'm²' },
                { key: 'areaConstruida', label: 'Área Construída', required: false, unit: 'm²' },
                { key: 'tipoImovel', label: 'Tipo de Imóvel', required: true, value: tipoImovelCompleto },
                { key: 'tipoProjeto', label: 'Tipo de Projeto', required: true }
            ];

            let projectList = '';
            projectFields.forEach(field => {
                const value = field.value || data[field.key] || '';
                const isEmpty = !value.trim();
                const requiredMark = field.required ? '*' : '';
                
                let displayValue = isEmpty ? '(Não informado)' : value;
                if (!isEmpty && field.unit) displayValue = displayValue + ' ' + field.unit;
                
                const itemClass = isEmpty ? 'info-item empty' : 'info-item filled';
                
                projectList += `
                    <div class="${itemClass}">
                        <span class="info-label">${field.label}${requiredMark}:</span>
                        <span class="info-value">${displayValue}</span>
                    </div>
                `;
            });

            return `
                <div class="column-right">                    <h3 class="section-title">
                        <i class="fas fa-building"></i> - INFORMAÇÕES DO PROJETO
                    </h3>
                    <div class="info-list">
                        ${projectList}
                    </div>
                </div>
            `;
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
            ];            arquiteturaItems.forEach(item => {
                const isChecked = data[item.key] === true;
                console.log(`📐 ${item.label}: ${isChecked ? 'MARCADO' : 'DESMARCADO'}`);
                  html += `
                    <div class="checkbox-item ${isChecked ? 'checked' : 'unchecked'}">
                        <div class="checkbox-content">
                            <strong>${isChecked ? '✅' : '☐'} - ${item.label}</strong>
                            <small>${item.desc}</small>
                        </div>
                    </div>
                `;
            });

            html += '</div>';

            // Detalhamentos Específicos - TODOS os itens, sempre visíveis (usar lista completa)
            html += '<div class="sub-options">';
            html += '<h5 class="sub-title">📋 - Detalhamentos Específicos (Marque todos que se aplicam):</h5>';
            html += '<div class="sub-checkbox-list">';

            // Usar a lista completa de detalhamentos
            const detalhamentoItems = data.todosDetalhamentos || [
                'Marcenaria', 'Detalhamento Áreas Molhadas', 'Forro', 'Iluminação',
                'Tomadas', 'Pisos', 'Executiva', 'Layout', 'Demolir e Construir', 'Apresentação'
            ];

            console.log('🔧 Detalhamentos selecionados:', data.detalhamentoEspecifico);
            console.log('🔧 Lista completa de detalhamentos:', detalhamentoItems);            detalhamentoItems.forEach(item => {
                const isChecked = data.detalhamentoEspecifico && data.detalhamentoEspecifico.includes(item);
                console.log(`🔧 ${item}: ${isChecked ? 'MARCADO' : 'DESMARCADO'}`);
                
                html += `
                    <div class="sub-checkbox-item ${isChecked ? 'checked' : 'unchecked'}">
                        <span class="item-name">${isChecked ? '✅' : '☐'} - ${item}</span>
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
            ];            complementarItems.forEach(item => {
                const isChecked = data[item.key] === true;
                console.log(`⚙️ ${item.label}: ${isChecked ? 'MARCADO' : 'DESMARCADO'}`);
                  html += `
                    <div class="checkbox-item ${isChecked ? 'checked' : 'unchecked'}">
                        <div class="checkbox-content">
                            <strong>${isChecked ? '✅' : '☐'} - ${item.label}</strong>
                            <small>${item.desc}</small>
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
                        <div class="ambiente-content">                            <div class="ambiente-name">
                                <strong>📍 - Nome do Ambiente:</strong>
                                <div class="ambiente-title ${!hasAmbiente ? 'empty' : 'filled'}">${hasAmbiente ? ambiente : '(Não especificado)'}</div>
                            </div>
                            <div class="ambiente-needs">
                                <strong>📋 - Necessidades Específicas:</strong>
                                <div class="ambiente-desc ${!hasNecessidade ? 'empty' : 'filled'}">${hasNecessidade ? necessidade : '(Nenhuma necessidade especificada)'}</div>
                            </div></div>
                    </div>
                `;
            }
            
            html += '</div>';
            
            // Resumo estatístico
            const preenchidos = ambientes.filter(a => a.trim() !== '').length;
            const comNecessidades = necessidades.filter(n => n.trim() !== '').length;
            
            html += `
                <div class="environments-summary">
                    <h5>📊 - Resumo dos Ambientes</h5>
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
            console.log('💭 === INICIANDO GERAÇÃO DA SEÇÃO DE OBSERVAÇÕES ===');
            console.log('💭 Dados recebidos:', data);
            
            const observacoes = [
                { title: 'Observações sobre o Cliente', content: data.observacaoCliente, icon: '👤', field: 'observacaoCliente' },
                { title: 'Observações sobre o Projeto', content: data.observacaoProjeto, icon: '🏗️', field: 'observacaoProjeto' },
                { title: 'Observações sobre o Escopo', content: data.observacaoEscopo, icon: '📐', field: 'observacaoEscopo' },
                { title: 'Observações sobre os Ambientes', content: data.observacaoAmbientes, icon: '🏠', field: 'observacaoAmbientes' },
                { title: 'Observações sobre os Prazos', content: data.observacaoPrazos, icon: '⏰', field: 'observacaoPrazos' },
                { title: 'Observações Finais', content: data.observacaoFinal, icon: '📝', field: 'observacaoFinal' }
            ];
            
            // DEBUG DETALHADO DE CADA OBSERVAÇÃO
            console.log('💭 === ANÁLISE DETALHADA DAS OBSERVAÇÕES ===');
            observacoes.forEach((obs, index) => {
                console.log(`💭 ${index + 1}. Campo: ${obs.field}`);
                console.log(`💭    Título: ${obs.title}`);
                console.log(`💭    Conteúdo: "${obs.content}"`);
                console.log(`💭    Tipo: ${typeof obs.content}`);
                console.log(`💭    Tem conteúdo: ${obs.content && obs.content.trim() ? 'SIM' : 'NÃO'}`);
                console.log('💭 ---');
            });
            
            let html = '<div class="observations-grid">';
            let totalPreenchidas = 0;

            observacoes.forEach((obs, index) => {
                const hasObs = obs.content && obs.content.trim();
                if (hasObs) totalPreenchidas++;
                
                console.log(`💭 ${index + 1}. ${obs.title}: ${hasObs ? `"${obs.content}"` : 'VAZIO'}`);                html += `
                    <div class="observacao-card ${hasObs ? 'filled' : 'empty'}">
                        <div class="observacao-header">
                            <div class="observacao-title">${obs.icon} - ${obs.title}</div>
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
                    <h5>📊 - Resumo das Observações</h5>
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
            `;            console.log('💭 === SEÇÃO DE OBSERVAÇÕES GERADA COM SUCESSO ===');
            console.log(`💭 HTML gerado (${html.length} caracteres):`, html.substring(0, 200) + '...');
            console.log('💭 === FIM DA GERAÇÃO DE OBSERVAÇÕES ===');
            
            return html;        },        getReportStyles() {
            return `
                <style>
                /* CSS DESKTOP FORÇADO - GARANTIR PDF IDÊNTICO EM TODOS DISPOSITIVOS */
                * { 
                    margin: 0 !important; 
                    padding: 0 !important; 
                    box-sizing: border-box !important; 
                    -webkit-print-color-adjust: exact !important;
                    print-color-adjust: exact !important;
                }
                
                body { 
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif !important; 
                    font-size: 12px !important;
                    line-height: 1.6 !important; 
                    color: #333 !important; 
                    background: white !important;
                    margin: 0 !important;
                    padding: 0 !important;
                    width: 100% !important;
                }
                
                .container { 
                    max-width: none !important; 
                    margin: 0 auto !important; 
                    padding: 0 !important; 
                    width: 100% !important;
                }
                
                /* CABEÇALHO - LAYOUT DESKTOP FIXO */
                .header { 
                    background: linear-gradient(135deg, #FF5722, #FF7043) !important; 
                    color: white !important; 
                    padding: 2rem !important; 
                    margin-bottom: 2rem !important; 
                }
                
                .header-content { 
                    display: flex !important; 
                    justify-content: space-between !important; 
                    align-items: flex-start !important; 
                    margin-bottom: 1.5rem !important;
                    flex-direction: row !important;
                    gap: 1rem !important;
                }
                
                .logo-container { 
                    display: flex !important; 
                    align-items: center !important; 
                    gap: 1rem !important; 
                }
                
                .logo-img { 
                    width: 60px !important; 
                    height: 60px !important; 
                    object-fit: contain !important; 
                    background: white !important; 
                    border-radius: 8px !important; 
                    padding: 8px !important; 
                }
                
                .logo-text h1 { 
                    font-size: 2.5rem !important; 
                    margin: 0 !important; 
                    font-weight: 700 !important; 
                }
                
                .logo-text .subtitle { 
                    font-size: 1rem !important; 
                    opacity: 0.9 !important; 
                    margin-top: 0.25rem !important; 
                }
                
                .version-info { 
                    text-align: right !important; 
                }
                
                /* LAYOUT EM DUAS COLUNAS */
                .two-column-section { 
                    display: flex !important; 
                    gap: 30px !important; 
                    margin-bottom: 25px !important; 
                    page-break-inside: avoid !important;
                    flex-direction: row !important;
                }
                
                .column-left, .column-right { 
                    flex: 1 !important; 
                    min-width: 0 !important; 
                }
                
                .column-left { 
                    border-right: 2px solid #FF6B35 !important; 
                    padding-right: 25px !important; 
                }
                
                .column-right { 
                    padding-left: 5px !important; 
                }
                
                .section-title { 
                    font-size: 1.2rem !important; 
                    font-weight: 700 !important; 
                    color: #FF5722 !important; 
                    margin-bottom: 15px !important; 
                    padding-bottom: 8px !important; 
                    border-bottom: 2px solid #FF5722 !important; 
                    display: flex !important; 
                    align-items: center !important; 
                    gap: 8px !important; 
                }
                
                .info-list { 
                    display: flex !important; 
                    flex-direction: column !important; 
                    gap: 8px !important; 
                }
                
                .info-item { 
                    display: flex !important; 
                    align-items: flex-start !important; 
                    padding: 8px 0 !important; 
                    border-bottom: 1px solid #e9ecef !important; 
                }
                
                .info-item.filled { 
                    background: rgba(40, 167, 69, 0.05) !important; 
                }
                
                .info-item.empty { 
                    background: rgba(220, 53, 69, 0.05) !important; 
                }
                
                .info-label { 
                    flex: 0 0 140px !important; 
                    font-weight: 600 !important; 
                    color: #37474F !important; 
                    font-size: 11px !important; 
                    margin-right: 12px !important; 
                }
                
                .info-value { 
                    flex: 1 !important; 
                    color: #333 !important; 
                    font-size: 11px !important; 
                    word-break: break-word !important; 
                }
                
                .info-item.empty .info-value { 
                    color: #999 !important; 
                    font-style: italic !important; 
                }
                
                /* SEÇÕES */
                .section { 
                    margin-bottom: 2rem !important; 
                    border: 1px solid #e9ecef !important; 
                    border-radius: 8px !important; 
                    overflow: hidden !important; 
                }
                
                .section-header { 
                    background: #37474F !important; 
                    color: white !important; 
                    padding: 1rem 1.5rem !important; 
                    display: flex !important; 
                    align-items: center !important; 
                    gap: 0.75rem !important; 
                }
                
                .section-content { 
                    padding: 1.5rem !important; 
                    background: white !important; 
                }
                
                /* PRINT STYLES */
                @media print {
                    * { 
                        -webkit-print-color-adjust: exact !important; 
                        print-color-adjust: exact !important; 
                    }
                    body { 
                        font-size: 10px !important; 
                        margin: 0 !important; 
                        width: 100% !important;
                    }
                    .two-column-section { 
                        display: flex !important; 
                        flex-direction: row !important; 
                        gap: 20px !important; 
                        page-break-inside: avoid !important; 
                    }
                    .column-left { 
                        border-right: 1px solid #FF6B35 !important; 
                        padding-right: 15px !important; 
                    }
                    .info-item { 
                        break-inside: avoid !important; 
                    }
                    .header {
                        background: linear-gradient(135deg, #FF5722, #FF7043) !important;
                    }
                }
                
                /* MOBILE - FORÇAR DESKTOP */
                @media screen and (max-width: 768px) {
                    .two-column-section { 
                        flex-direction: row !important; 
                        gap: 20px !important; 
                    }                    .column-left, .column-right { 
                        flex: 1 !important; 
                    }
                }
                
                /* LAYOUT COM OBSERVAÇÕES AO LADO */
                .main-sections {
                    margin-top: 20px !important;
                }
                
                .section-with-observations {
                    display: flex !important;
                    gap: 20px !important;
                    margin-bottom: 30px !important;
                    align-items: flex-start !important;
                }
                
                .section-with-observations .section {
                    flex: 2 !important;
                    margin-bottom: 0 !important;
                }
                
                .side-observations {
                    flex: 1 !important;
                    background: #f8f9fa !important;
                    border: 1px solid #e9ecef !important;
                    border-radius: 8px !important;
                    padding: 15px !important;
                    margin-top: 0 !important;
                }
                
                .side-observations h4 {
                    color: #FF5722 !important;
                    font-size: 14px !important;
                    margin-bottom: 10px !important;
                    padding-bottom: 5px !important;
                    border-bottom: 1px solid #e9ecef !important;
                }
                
                .related-obs {
                    display: flex !important;
                    flex-direction: column !important;
                    gap: 8px !important;
                }
                
                .obs-item {
                    background: white !important;
                    padding: 8px 12px !important;
                    border-radius: 4px !important;
                    border-left: 3px solid #FF5722 !important;
                    font-size: 12px !important;
                    color: #555 !important;
                }
                
                /* RESPONSIVIDADE - MOBILE */
                @media (max-width: 768px) {
                    .section-with-observations {
                        flex-direction: column !important;
                        gap: 10px !important;
                    }
                    
                    .side-observations {
                        margin-top: 10px !important;
                    }
                }
                  @media print {
                    .section-with-observations {
                        display: flex !important;
                        flex-direction: row !important;
                        gap: 20px !important;
                        page-break-inside: avoid !important;
                    }
                }
                
                /* FOOTER E CREATOR INFO */
                .footer {
                    background: #f8f9fa !important;
                    padding: 15px !important;
                    margin-top: 20px !important;
                    border-top: 1px solid #e9ecef !important;
                    text-align: center !important;
                    font-size: 11px !important;
                }
                  .creator-info {
                    color: #e0e0e0 !important;
                    font-size: 10px !important;
                    opacity: 0.4 !important;
                    margin-top: 5px !important;
                }
                
                /* RODAPÉ ESPECÍFICO DO PDF */
                @page {
                    margin: 2cm 1.5cm 3cm 1.5cm;
                    @bottom-center {
                        content: "CRIADO POR: Gabriel Goulart";
                        font-size: 10px;
                        color: #e0e0e0;
                        opacity: 0.4;
                    }
                }
                
                @media print {
                    @page {
                        margin: 2cm 1.5cm 3cm 1.5cm;
                        @bottom-center {
                            content: "CRIADO POR: Gabriel Goulart";
                            font-size: 10px;
                            color: #e0e0e0;
                            opacity: 0.4;
                        }
                    }
                }
                </style>
            `;},
        openPrintWindow(html) {
            try {
                Logger.info('🪟 Iniciando exportação de relatório...');
                
                // Detectar dispositivo
                const isMobile = Utils.isMobile();
                const isIOS = Utils.isIOS();
                const isAndroid = Utils.isAndroid();
                
                Logger.info(`📱 Dispositivo detectado - Mobile: ${isMobile}, iOS: ${isIOS}, Android: ${isAndroid}`);

                if (isMobile) {
                    Logger.info('📱 Usando estratégia móvel para exportação...');
                    this.handleMobileExport(html);
                } else {
                    Logger.info('💻 Usando estratégia desktop para exportação...');
                    this.handleDesktopExport(html);
                }

            } catch (error) {
                Logger.error('❌ Erro ao exportar relatório:', error);
                this.showMobileAlternatives(html);
            }
        },        handleMobileExport(html) {
            try {
                Logger.info('📱 Iniciando exportação mobile com HTML desktop forçado...');
                
                // CORREÇÃO: Forçar viewport desktop no HTML mobile
                const desktopHTML = html.replace(
                    /<meta name="viewport"[^>]*>/i,
                    '<meta name="viewport" content="width=1024, initial-scale=1.0, shrink-to-fit=no">'
                );
                
                // ESTRATÉGIA 1: window.open com HTML desktop forçado
                Logger.info('📱 Tentativa 1: window.open com viewport desktop...');
                  const printWindow = window.open('', '_blank', 'width=1024,height=768,scrollbars=yes,resizable=yes,toolbar=no,menubar=no');
                
                if (printWindow && !printWindow.closed) {
                    Logger.success('✅ Janela móvel aberta - injetando HTML desktop!');
                    
                    // Injetar HTML com viewport desktop
                    printWindow.document.write(desktopHTML);
                    printWindow.document.close();
                    
                    // CORREÇÃO: Definir título personalizado para substituir "about:blank"
                    printWindow.document.title = 'Relatório SKBORGES - CRIADO POR: Gabriel Goulart';
                    
                    // Aguardar carregamento completo
                    printWindow.onload = () => {
                        Logger.info('📄 HTML desktop carregado no mobile');
                        printWindow.focus();
                        
                        // Aguardar renderização antes de tentar imprimir
                        setTimeout(() => {
                            try {
                                if (Utils.isIOS()) {
                                    // iOS: aguardar mais tempo e tentar impressão
                                    setTimeout(() => {
                                        try {
                                            printWindow.print();
                                        } catch (e) {
                                            Logger.warning('iOS: Impressão manual necessária');
                                        }
                                    }, 1500);
                                } else {
                                    // Android: tentar impressão direta
                                    printWindow.print();
                                }
                            } catch (e) {
                                Logger.warning('Impressão automática falhou - manual necessária');
                            }
                        }, 800);
                    };
                    
                    return; // Sucesso!
                }
                
                throw new Error('Janela não abriu ou foi bloqueada');
                
            } catch (error) {
                Logger.warning('⚠️ Estratégia móvel 1 falhou:', error.message);
                
                // ESTRATÉGIA 2: Página fullscreen com HTML desktop
                Logger.info('📱 Tentativa 2: Página fullscreen com HTML desktop...');
                this.createMobileDesktopPage(html);
            }
        },        createMobileDesktopPage(html) {
            try {
                Logger.info('📱 SOLUÇÃO DEFINITIVA: Criando PDF mobile = desktop...');
                
                // CORREÇÃO TOTAL: Transformar HTML mobile em desktop
                let desktopHTML = html;
                
                // 1. FORÇAR VIEWPORT DESKTOP
                desktopHTML = desktopHTML.replace(
                    /<meta name="viewport"[^>]*>/i, 
                    '<meta name="viewport" content="width=1024, initial-scale=1.0, user-scalable=no, shrink-to-fit=no">'
                );
                
                // 2. ADICIONAR CSS FORÇA BRUTA PARA DESKTOP
                const desktopCSS = '<style id="force-desktop-layout">' +
                    '/* FORÇA BRUTA - PDF MOBILE = DESKTOP */' +
                    '* { box-sizing: border-box !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }' +
                    'body { font-size: 12px !important; margin: 0 !important; padding: 0 !important; width: 100% !important; min-width: 1024px !important; background: white !important; color: #333 !important; font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif !important; line-height: 1.6 !important; }' +
                    '.container { max-width: none !important; width: 100% !important; margin: 0 !important; padding: 0 !important; }' +
                    '.header { background: linear-gradient(135deg, #FF5722, #FF7043) !important; color: white !important; padding: 2rem !important; margin-bottom: 2rem !important; }' +
                    '.header-content { display: flex !important; flex-direction: row !important; justify-content: space-between !important; align-items: flex-start !important; gap: 1rem !important; margin-bottom: 1.5rem !important; }' +
                    '.logo-container { display: flex !important; flex-direction: row !important; align-items: center !important; gap: 1rem !important; }' +
                    '.logo-text h1 { font-size: 2.5rem !important; margin: 0 !important; font-weight: 700 !important; }' +
                    '.logo-text .subtitle { font-size: 1rem !important; opacity: 0.9 !important; margin-top: 0.25rem !important; }' +
                    '.field-group, .info-row { display: flex !important; flex-direction: row !important; gap: 1rem !important; margin-bottom: 1rem !important; align-items: center !important; }' +
                    '.field-label, .info-label { flex: 0 0 200px !important; font-weight: 600 !important; margin-right: 1rem !important; }' +
                    '.field-value, .info-value { flex: 1 !important; padding: 0.5rem 0.75rem !important; background: #f8f9fa !important; border: 1px solid #e9ecef !important; }' +
                    '@media screen and (max-width: 768px) { body { min-width: 1024px !important; font-size: 12px !important; } .container { max-width: none !important; width: 100% !important; } .header-content { flex-direction: row !important; } .field-group { flex-direction: row !important; } .logo-container { flex-direction: row !important; } }' +
                    '@media print { * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; } body { font-size: 12px !important; margin: 0 !important; min-width: 1024px !important; } .header { background: linear-gradient(135deg, #FF5722, #FF7043) !important; } .header-content { display: flex !important; flex-direction: row !important; } .field-group { display: flex !important; flex-direction: row !important; } }' +
                    '</style>';
                
                // 3. INSERIR CSS ANTES DO </head>
                desktopHTML = desktopHTML.replace('</head>', desktopCSS + '</head>');
                
                // 4. REMOVER REGRAS MOBILE CONFLITANTES
                desktopHTML = desktopHTML.replace(/@media\s+screen\s+and\s+\(max-width:\s*768px\)[^}]*{[^{}]*({[^{}]*}[^{}]*)*}/gi, '');
                
                // 5. CORRIGIR CLASSES E ESTILOS INLINE
                desktopHTML = desktopHTML
                    .replace(/font-size:\s*14px/gi, 'font-size: 12px !important')
                    .replace(/flex-direction:\s*column/gi, 'flex-direction: row !important')
                    .replace(/display:\s*block/gi, 'display: flex !important')
                    .replace(/width:\s*100%/gi, 'width: 100% !important');
                
                // Escapar HTML para srcdoc
                const escapedHTML = desktopHTML.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
                
                // Criar overlay fullscreen com HTML corrigido
                const overlay = document.createElement('div');
                overlay.id = 'mobile-desktop-overlay';
                overlay.innerHTML = 
                    '<div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: white; z-index: 999999; display: flex; flex-direction: column;">' +
                        '<div style="background: #FF5722; color: white; padding: 8px 12px; flex-shrink: 0; display: flex; justify-content: space-between; align-items: center; font-size: 14px;">' +
                            '<span style="font-weight: bold;">📄 SKBORGES - Layout Desktop Forçado no Mobile</span>' +
                            '<div style="display: flex; gap: 6px;">' +
                                '<button onclick="document.getElementById(\'desktop-iframe\').contentWindow.print()" style="background: #4CAF50; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: bold;">🖨️ GERAR PDF IDÊNTICO</button>' +
                                '<button onclick="this.closest(\'#mobile-desktop-overlay\').remove()" style="background: #f44336; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: bold;">✕ FECHAR</button>' +
                            '</div>' +
                        '</div>' +
                        '<iframe id="desktop-iframe" style="width: 100%; height: 100%; border: none; flex: 1; background: white;" srcdoc="' + escapedHTML + '"></iframe>' +
                    '</div>';

                // Adicionar ao document
                document.body.appendChild(overlay);
                
                Logger.success('✅ SUCESSO: PDF Mobile com layout desktop 100% idêntico criado!');
                Logger.info('💡 Agora o PDF será EXATAMENTE igual ao desktop em todos aspectos!');
                
                // Aguardar carregamento do iframe e focar
                setTimeout(() => {
                    const iframe = document.getElementById('desktop-iframe');
                    if (iframe && iframe.contentWindow) {
                        iframe.contentWindow.focus();
                        Logger.info('🎯 Iframe focado - pronto para impressão!');
                    }
                }, 500);
                
            } catch (error) {
                Logger.error('❌ Erro ao criar página desktop no mobile:', error);
                this.showMobileAlternatives(html);
            }
        },

        handleDesktopExport(html) {
            try {
                Logger.info('💻 Abrindo janela para desktop...');
                  const printWindow = window.open('', '_blank', 'width=1000,height=700,scrollbars=yes,resizable=yes,toolbar=no,menubar=yes');
                
                if (!printWindow || printWindow.closed) {
                    throw new Error('Janela bloqueada por pop-up blocker');
                }

                printWindow.document.write(html);
                printWindow.document.close();
                
                // CORREÇÃO: Definir título personalizado para substituir "about:blank"
                printWindow.document.title = 'Relatório SKBORGES - CRIADO POR: Gabriel Goulart';

                printWindow.onload = () => {
                    Logger.info('📄 Conteúdo carregado, focando janela...');
                    printWindow.focus();
                };

                setTimeout(() => {
                    if (printWindow.closed) {
                        Logger.warning('⚠️ Janela foi fechada');
                    } else {
                        Logger.success('✅ Janela de relatório aberta com sucesso!');
                    }
                }, 1000);

            } catch (error) {
                Logger.error('❌ Erro na exportação desktop:', error);
                this.showDesktopAlternatives(html);
            }
        },        showMobileAlternatives(html) {
            const today = new Date();
            const dateStr = Utils.formatDate(today).replace(/\//g, '-');
            const fileName = 'Relatorio_SKBORGES_' + dateStr + '.html';
            
            Logger.info('📱 Mostrando alternativas móveis...');
            
            // Tentar download direto
            try {
                Utils.createDownloadBlob(html, fileName);
                
                const message = '📱 RELATÓRIO PARA CELULAR\n\n✅ Arquivo baixado: ' + fileName + 
                    '\n\n📋 Como visualizar:\n• Abra o arquivo baixado\n• Use o navegador para imprimir/salvar como PDF\n• Compartilhe o arquivo gerado\n\n💡 O arquivo foi salvo na pasta Downloads';
                alert(message);
                
            } catch (downloadError) {
                Logger.error('❌ Falha no download:', downloadError);
                
                // Última alternativa: mostrar instruções
                const errorMessage = '📱 EXPORTAÇÃO PARA CELULAR\n\n⚠️ Seu dispositivo tem limitações para exportação automática.\n\n🔧 SOLUÇÕES:\n\n1️⃣ COPIAR DADOS:\n• Volte ao formulário\n• Copie as informações manualmente\n• Cole em um email ou documento\n\n2️⃣ CAPTURA DE TELA:\n• Faça prints de cada seção\n• Envie as imagens por WhatsApp/Email\n\n3️⃣ ACESSAR NO COMPUTADOR:\n• Abra este site no computador\n• Preencha novamente (mais fácil)\n• Exporte normalmente\n\n💡 Recomendamos usar um computador para melhor experiência';
                alert(errorMessage);
            }
        },        showDesktopAlternatives(html) {
            Logger.warning('💻 Mostrando alternativas desktop...');
            
            if (confirm('Não foi possível abrir a janela de impressão (bloqueador de pop-ups?).\n\nDeseja baixar o relatório como arquivo HTML?')) {
                const today = new Date();
                const dateStr = Utils.formatDate(today).replace(/\//g, '-');
                const fileName = 'Relatorio_SKBORGES_' + dateStr + '.html';
                Utils.createDownloadBlob(html, fileName);
                
                const message = '✅ Arquivo baixado: ' + fileName + '\n\n📋 Como usar:\n• Abra o arquivo baixado\n• Use Ctrl+P para imprimir\n• Salve como PDF na impressão';
                alert(message);
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
                progressFill.style.width = percentage + '%';
            }

            if (progressPercentage) {
                progressPercentage.textContent = percentage + '%';
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
                    scrollButton.style.display = 'none';                }
            }
        }
    };

    // ===== INICIALIZAÇÃO DA APLICAÇÃO =====
    const App = {
        async init() {
            try {
                Logger.info('Inicializando ' + APP_CONFIG.name + ' v' + APP_CONFIG.version);

                // CORREÇÃO: Garantir que a página inicie no topo - MÚLTIPLAS ESTRATÉGIAS
                this.forceScrollTop();

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

                // CORREÇÃO: Garantir scroll no topo após inicialização completa
                setTimeout(() => {
                    this.forceScrollTop();
                }, 100);

                // SEGUNDA VERIFICAÇÃO DE SCROLL
                setTimeout(() => {
                    this.forceScrollTop();
                }, 500);

                AppState.isInitialized = true;
                Logger.success('Aplicação inicializada com sucesso');

            } catch (error) {
                Logger.error('Erro na inicialização: ' + error.message);
                this.showError('Erro ao inicializar a aplicação');
            }
        },

        forceScrollTop() {
            // Múltiplas estratégias para garantir que o scroll vá para o topo
            try {
                // Estratégia 1: window.scrollTo
                window.scrollTo(0, 0);
                
                // Estratégia 2: document elements
                document.documentElement.scrollTop = 0;
                document.body.scrollTop = 0;
                
                // Estratégia 3: usando scrollIntoView no primeiro elemento
                const firstElement = document.body.firstElementChild;
                if (firstElement) {
                    firstElement.scrollIntoView({ 
                        top: 0, 
                        behavior: 'instant',
                        block: 'start' 
                    });
                }
                
                Logger.info('🔝 Scroll forçado para o topo da página');
            } catch (error) {
                Logger.warning('Erro ao forçar scroll para o topo:', error);
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
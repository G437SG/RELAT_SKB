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
                                <textarea name="necessidades[]" 
                                       class="demanda-desc-input auto-grow-textarea" 
                                       placeholder="Descreva as necessidades específicas..."
                                       rows="1"
                                       data-max-rows="5"></textarea>
                            </div>
                        </div>
                    </div>
                </div>
            `
        },

        init() {
            this.setupEventListeners();
            this.addInitial();
            this.setupExistingAutoGrow();
            Logger.success('DemandManager inicializado');
        },

        setupExistingAutoGrow() {
            // Setup auto-grow for any existing textareas
            const existingTextareas = document.querySelectorAll('.auto-grow-textarea');
            existingTextareas.forEach(textarea => {
                this.setupAutoGrow(textarea);
            });
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

            // Setup auto-grow functionality for necessidades textarea
            const textarea = element.querySelector('.auto-grow-textarea');
            if (textarea) {
                this.setupAutoGrow(textarea);
            }

            return element;
        },

        setupAutoGrow(textarea) {
            // Auto-grow functionality
            const adjustHeight = () => {
                textarea.style.height = 'auto';
                const scrollHeight = textarea.scrollHeight;
                const maxHeight = parseFloat(getComputedStyle(textarea).maxHeight);
                
                if (scrollHeight <= maxHeight) {
                    textarea.style.height = scrollHeight + 'px';
                    textarea.style.overflowY = 'hidden';
                } else {
                    textarea.style.height = maxHeight + 'px';
                    textarea.style.overflowY = 'auto';
                }
            };

            // Add event listeners
            textarea.addEventListener('input', adjustHeight);
            textarea.addEventListener('paste', () => {
                setTimeout(adjustHeight, 10); // Small delay to let paste complete
            });

            // Initial adjustment
            adjustHeight();
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
            // Verificar se o content é mínimo (indica seção praticamente vazia)
            const isMinimalContent = content.length < 150 || 
                                   content.includes('Nenhum ambiente específico') ||
                                   content.includes('no-environments-minimal') ||
                                   content.trim().length < 50;
            
            if (isMinimalContent) {
                // Para conteúdo mínimo, retornar praticamente nada
                console.log(`🏠 Seção "${title}" detectada como mínima - aplicando layout ultra-compacto`);
                return `<div class="section section-minimal" style="margin: 0 !important; padding: 0.1rem !important; height: auto !important; min-height: 0 !important; overflow: hidden !important; display: inline-block !important; width: 100% !important;">
                    <div class="section-header" style="padding: 0.05rem !important; margin: 0 !important; font-size: 12px !important; line-height: 1 !important; background: #37474F !important; color: white !important; display: inline-block !important; width: 100% !important;">
                        <i class="fas ${iconClass}" style="font-size: 12px !important;"></i> ${title}
                    </div>
                    <div class="section-content" style="margin: 0 !important; padding: 0.05rem !important; height: auto !important; min-height: 0 !important; overflow: hidden !important; display: inline-block !important; width: 100% !important; font-size: 9px !important; line-height: 1 !important;">
                        ${content}
                    </div>
                </div>`;
            }
            
            return `
                <div class="section">
                    <div class="section-header">
                        <i class="fas ${iconClass}"></i> ${title}
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

                // Criar título personalizado
                const projectTitle = this.createProjectTitle(formData);

                Logger.info('🪟 Abrindo janela de impressão...');
                this.openPrintWindow(html, formData, projectTitle);

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
            }
        },

        createProjectTitle(formData) {
            const codigo = formData.codigoProjeto || 'SEM-CÓDIGO';
            const projeto = formData.nomeProjeto || 'SEM-NOME';
            return `${codigo} - ${projeto} - RELATÓRIO`;
        },

        collectFormData() {
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
                codigoProjeto: this.getFieldValue('codigoProjeto'),
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
            console.log('🏗️ PROJETO (7 campos):', projetoData);
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
            // Updated to handle both input and textarea for necessidades
            const necessidadeInputs = document.querySelectorAll('input[name="necessidades[]"], textarea[name="necessidades[]"]');
            
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
                
                // Criar nome do arquivo seguindo o padrão: CODIGO_PROJETO_RELATÓRIO_DATA
                const codigoProjeto = Utils.sanitizeString(formData.codigoProjeto || 'SEM-CODIGO');
                const nomeProjeto = Utils.sanitizeString(formData.nomeProjeto || 'SEM-NOME');
                const dataFormatada = Utils.formatDate(now).replace(/\//g, '-');
                const fileName = `${codigoProjeto}_${nomeProjeto}_RELATORIO_${dataFormatada}`;
                
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
                    const hasEnvironments = formData.ambiente && formData.ambiente.length > 0;
                    Logger.info(`🏠 DEBUG: hasEnvironments = ${hasEnvironments}, ambientes = `, formData.ambiente);
                    if (hasEnvironments) {
                        environmentsSection = this.generateEnvironmentsSection(formData);
                        Logger.info('🏠 DEBUG: Seção de ambientes criada com conteúdo');
                    } else {
                        environmentsSection = null;
                        Logger.info('🏠 DEBUG: environmentsSection = null (seção omitida)');
                    }
                } catch (error) {
                    Logger.error('❌ Erro na seção de ambientes:', error);
                    environmentsSection = null;
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
                    <head>                        <meta charset="UTF-8">
                        <meta name="viewport" content="width=device-width, initial-scale=1.0">
                        <title>Relatório SKBORGES - ${fileName}</title>
                        <style>${this.getReportStyles()}</style>
                    </head>                    <body>
                        <div class="header">                            <div class="header-content">
                                <div class="logo-container">
                                <img src="images/logo.png" alt="SKBORGES Logo" class="logo-img" onerror="this.style.display='none';">
                                <div class="logo-text">
                                    <h1>SKBORGES</h1>
                                    <div class="subtitle">Sistema de Captação de Informações Projetuais</div>
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
                                <div>Código do Projeto: ${formData.codigoProjeto || '(Não informado)'}</div>
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
                                
                                <!-- OBSERVAÇÕES MOVIDAS PARA INFORMAÇÕES GERAIS -->
                                <div class="general-observations" style="margin-top: 8px; padding: 4px; background: #f8f9fa; border: 1px solid #e0e0e0; border-left: 3px solid #FF5722;">
                                    <div class="obs-item" style="margin-bottom: 4px;">
                                        <strong style="color: #FF5722; font-size: 12px;">👤 Observações sobre o Cliente:</strong><br>
                                        <span style="font-size: 9px;">${formData.observacaoCliente || '(Nenhuma observação sobre cliente informada)'}</span>
                                    </div>
                                    <div class="obs-item">
                                        <strong style="color: #FF5722; font-size: 12px;">🏗️ Observações sobre o Projeto:</strong><br>
                                        <span style="font-size: 9px;">${formData.observacaoProjeto || '(Nenhuma observação sobre projeto informada)'}</span>
                                    </div>
                                </div>
                            </div>
                        </div>                        <div class="main-sections">
                            <!-- ESCOPO DO PROJETO -->
                            <div class="section">
                                <div class="section-header">
                                    <i class="fas fa-list-check"></i>
                                    <h2>ESCOPO DO PROJETO</h2>
                                </div>
                                <div class="section-content">
                                    <div class="scope-two-columns">
                                        ${scopeSection}
                                    </div>
                                </div>
                                <div class="section-observations">
                                    <div class="obs-content">
                                        <strong>📐 Observações sobre o Escopo:</strong> ${formData.observacaoEscopo || '(Nenhuma observação sobre escopo informada)'}
                                    </div>
                                </div>
                            </div><!-- DEBUG: FIM ESCOPO -->${environmentsSection ? `
                            
                            <!-- AMBIENTES E NECESSIDADES -->
                            <div class="section">
                                ${this._createSection('Ambientes e Necessidades', 'fa-home', environmentsSection)}
                                <div class="section-observations">
                                    <div class="obs-content">
                                        <strong>🏠 Observações sobre os Ambientes:</strong> ${formData.observacaoAmbientes || '(Nenhuma observação sobre ambientes informada)'}
                                    </div>
                                </div>
                            </div><!-- DEBUG: FIM AMBIENTES -->` : ''}<!-- DEBUG: INICIO CRONOGRAMA -->
                            
                            <!-- CRONOGRAMA DO PROJETO -->
                            <div class="section">
                                ${this._createSection('Cronograma do Projeto', 'fa-clock', timelineSection)}
                                <div class="section-observations">
                                    <div class="obs-content">
                                        <strong>⏰ Observações sobre os Prazos:</strong> ${formData.observacaoPrazos || '(Nenhuma observação sobre prazos informada)'}
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <!-- OBSERVAÇÕES ADICIONAIS (APENAS OBSERVAÇÕES FINAIS) -->
                        <div class="section observations-section" style="border: 1px solid #FF5722; background: white; margin: 0.1rem 0; padding: 0; width: 100%; max-width: 100%; box-sizing: border-box;">
                            <div class="section-header" style="background: #FF5722 !important; color: white !important; padding: 0.1rem;">
                                <i class="fas fa-sticky-note"></i>
                                <h2 style="color: white !important; font-size: 12px !important; margin: 0;">OBSERVAÇÕES ADICIONAIS</h2>
                            </div>
                            <div class="section-content" style="padding: 0.1rem; width: 100%; max-width: 100%; box-sizing: border-box;">
                                <div class="additional-observations" style="background: white; width: 100%; max-width: 100%; box-sizing: border-box; margin: 0; padding: 0;">
                                    <div class="obs-item" style="background: #f8f9fa; border: 1px solid #e9ecef; border-left: 2px solid #FF5722; padding: 0.05rem; margin: 0 0 0.02rem 0; page-break-inside: avoid; width: 100%; max-width: 100%; box-sizing: border-box; word-wrap: break-word;">
                                        <strong style="color: #FF5722; font-size: 12px;">📊 Observações Finais:</strong><br>
                                        <span style="font-size: 9px;">${formData.observacaoFinal || '(Nenhuma observação final informada)'}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <div class="footer">
                            <div style="font-size: 9px; margin: 0; padding: 0;"><strong>SKBORGES - v${APP_CONFIG.version}</strong></div>
                            <div style="font-size: 9px; margin: 0; padding: 0;">Arquivo: ${fileName}</div>
                            <div style="font-size: 9px; margin: 0; padding: 0;">Gerado em ${now.toLocaleString('pt-BR')}</div>
                        </div>

                        <!-- CSS ULTRA-COMPACTO PARA ELIMINAR ESPAÇOS VAZIOS -->
                        <style>
                        @media print {
                            * {
                                box-sizing: border-box !important;
                                word-wrap: break-word !important;
                                overflow-wrap: break-word !important;
                                margin: 0 !important;
                                padding: 0 !important;
                            }
                            
                            @page {
                                size: A4 !important;
                                margin: 0.5cm !important;
                            }
                            
                            body {
                                margin: 0 !important;
                                padding: 0 !important;
                                font-size: 9px !important;
                                line-height: 1.0 !important;
                            }
                            
                            .observations-section {
                                page-break-before: auto !important;
                                page-break-after: auto !important;
                                page-break-inside: avoid !important;
                                border: 1px solid #FF5722 !important;
                                background: white !important;
                                margin: 0.05rem 0 !important;
                                padding: 0 !important;
                                display: block !important;
                                visibility: visible !important;
                                opacity: 1 !important;
                                width: 100% !important;
                                max-width: 100% !important;
                                box-sizing: border-box !important;
                            }
                            
                            .additional-observations {
                                display: block !important;
                                page-break-inside: avoid !important;
                                padding: 0.05rem !important;
                                background: white !important;
                                width: 100% !important;
                                max-width: 100% !important;
                                box-sizing: border-box !important;
                                margin: 0 !important;
                            }
                            
                            .obs-item {
                                display: block !important;
                                visibility: visible !important;
                                page-break-inside: avoid !important;
                                background: #f8f9fa !important;
                                border: 1px solid #e9ecef !important;
                                border-left: 2px solid #FF5722 !important;
                                padding: 0.02rem !important;
                                margin: 0 0 0.01rem 0 !important;
                                min-height: 0.2em !important;
                                opacity: 1 !important;
                                font-size: 9px !important;
                                line-height: 1.0 !important;
                                width: 100% !important;
                                max-width: 100% !important;
                                box-sizing: border-box !important;
                                word-wrap: break-word !important;
                                overflow-wrap: break-word !important;
                            }
                            
                            .obs-item strong {
                                color: #FF5722 !important;
                                font-weight: bold !important;
                                display: inline !important;
                                font-size: 12px !important;
                            }
                            
                            .obs-item span {
                                font-size: 9px !important;
                                line-height: 1.0 !important;
                            }
                            
                            .section {
                                margin: 0.05rem 0 !important;
                                padding: 0 !important;
                            }
                            
                            .section-header {
                                padding: 0.02rem !important;
                                font-size: 12px !important;
                            }
                            
                            .section-content {
                                padding: 0.05rem !important;
                            }
                            
                            .footer {
                                margin: 0.05rem 0 0 0 !important;
                                padding: 0.02rem !important;
                                font-size: 9px !important;
                            }
                        }
                        </style>
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
                { key: 'codigoProjeto', label: 'Código do Projeto', required: false },
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
            console.log('📐 Gerando seção ULTRA-COMPLETA do escopo em duas colunas');
            console.log('📐 Garantindo que TODAS as opções apareçam, selecionadas ou não');
            
            // Coluna 1: Projeto Arquitetura + Detalhamentos
            let column1 = '';
            column1 += '<div class="scope-column">';
            
            // Projeto Arquitetura - TODOS os itens, marcados ou não
            column1 += '<div class="escopo-group compact">';
            column1 += '<h4 class="escopo-subtitle"><i class="fas fa-drafting-compass"></i> Projeto Arquitetura</h4>';
            column1 += '<div class="checkbox-list compact">';
            
            const arquiteturaItems = [
                { key: 'layout', label: 'Layout', desc: 'Distribuição e organização dos espaços' },
                { key: 'modelagem3d', label: 'Modelagem 3D', desc: 'Visualização tridimensional do projeto' },
                { key: 'detalhamento', label: 'Detalhamento', desc: 'Especificações técnicas detalhadas' }
            ];

            arquiteturaItems.forEach(item => {
                const isChecked = data[item.key] === true;
                console.log(`📐 ${item.label}: ${isChecked ? 'MARCADO' : 'DESMARCADO'}`);
                column1 += `
                    <div class="checkbox-item compact ${isChecked ? 'checked' : 'unchecked'}">
                        <div class="checkbox-content">
                            <strong>${isChecked ? '✅' : '☐'} ${item.label}</strong>
                            <small>${item.desc}</small>
                        </div>
                    </div>
                `;
            });

            column1 += '</div>';

            // Detalhamentos Específicos - TODOS os itens, sempre visíveis (usar lista completa)
            column1 += '<div class="sub-options compact">';
            column1 += '<h5 class="sub-title">📋 Detalhamentos Específicos:</h5>';
            column1 += '<div class="sub-checkbox-list compact">';

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
                
                column1 += `
                    <div class="sub-checkbox-item compact ${isChecked ? 'checked' : 'unchecked'}">
                        <span class="item-name">${isChecked ? '✅' : '☐'} ${item}</span>
                        <span class="item-status ${isChecked ? 'selected' : 'not-selected'}">${isChecked ? 'SIM' : 'NÃO'}</span>
                    </div>
                `;
            });

            column1 += '</div></div>';
            column1 += '</div>';
            column1 += '</div>';

            // Coluna 2: Projetos Complementares
            let column2 = '';
            column2 += '<div class="scope-column">';
            column2 += '<div class="escopo-group compact">';  
            column2 += '<h4 class="escopo-subtitle"><i class="fas fa-cogs"></i> Projetos Complementares</h4>';
            column2 += '<div class="checkbox-list compact">';

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
                column2 += `
                    <div class="checkbox-item compact ${isChecked ? 'checked' : 'unchecked'}">
                        <div class="checkbox-content">
                            <strong>${isChecked ? '✅' : '☐'} ${item.label}</strong>
                            <small>${item.desc}</small>
                        </div>
                    </div>
                `;
            });

            column2 += '</div></div>';
            column2 += '</div>';

            console.log('📐 Seção de escopo ULTRA-COMPLETA gerada em duas colunas - TODAS as opções exibidas');
            return column1 + column2;
        },        generateEnvironmentsSection(data) {
            console.log('🏠 Gerando seção de ambientes em formato de duas colunas otimizado para PDF');
            console.log('Ambientes recebidos:', data.ambiente);
            console.log('Necessidades recebidas:', data.necessidades);
            
            const ambientes = data.ambiente || [];
            const necessidades = data.necessidades || [];
            
            // Se não há ambientes, retornar null para omitir completamente a seção
            if (ambientes.length === 0) {
                console.log('🏠 Nenhum ambiente cadastrado - retornando null');
                return null;
            }
            
            // DESIGN DE DUAS COLUNAS OTIMIZADO PARA PDF
            let html = '<div class="environments-two-columns-optimized" style="display: flex !important; gap: 0.2rem !important; margin: 0 !important; padding: 0 !important; width: 100% !important; box-sizing: border-box !important; page-break-inside: auto !important;">';
            
            // Calcular divisão das colunas
            const maxLength = Math.max(ambientes.length, necessidades.length);
            const itemsPerColumn = Math.ceil(maxLength / 2);
            
            // COLUNA ESQUERDA
            html += '<div class="environments-column-left" style="flex: 1 !important; width: 48% !important; margin: 0 !important; padding: 0 !important; display: flex !important; flex-direction: column !important; gap: 0.1rem !important;">';
            for (let i = 0; i < itemsPerColumn; i++) {
                if (i < maxLength) {
                    const ambiente = ambientes[i] || '';
                    const necessidade = necessidades[i] || '';
                    const numeroAmbiente = String(i + 1).padStart(2, '0');
                    
                    html += `
                        <div class="ambiente-item-optimized" style="margin: 0 !important; padding: 0.1rem !important; border: 1px solid #e9ecef !important; background: #f9f9f9 !important; border-radius: 4px !important; page-break-inside: avoid !important; box-sizing: border-box !important;">
                            <div class="ambiente-header-optimized" style="background: #FF5722 !important; color: white !important; padding: 0.1rem !important; border-radius: 3px !important; margin: 0 0 0.1rem 0 !important; text-align: center !important; font-size: 12px !important; font-weight: 600 !important; line-height: 1.1 !important;">
                                AMBIENTE ${numeroAmbiente}
                            </div>
                            <div class="ambiente-details-optimized" style="margin: 0 !important; padding: 0 !important; display: flex !important; flex-direction: column !important; gap: 0.05rem !important;">
                                <div class="ambiente-nome-optimized" style="margin: 0 !important; padding: 0 !important; font-size: 9px !important; line-height: 1.1 !important; word-wrap: break-word !important;">
                                    <strong style="color: #37474F !important; font-weight: 600 !important;">NOME:</strong> ${ambiente.trim() !== '' ? ambiente : '(Não especificado)'}
                                </div>
                                <div class="ambiente-necessidades-optimized" style="margin: 0 !important; padding: 0 !important; font-size: 9px !important; line-height: 1.1 !important; word-wrap: break-word !important;">
                                    <strong style="color: #37474F !important; font-weight: 600 !important;">NECESSIDADES:</strong> ${necessidade.trim() !== '' ? necessidade : '(Não especificado)'}
                                </div>
                            </div>
                        </div>
                    `;
                }
            }
            html += '</div>'; // Fechar coluna esquerda
            
            // COLUNA DIREITA
            html += '<div class="environments-column-right" style="flex: 1 !important; width: 48% !important; margin: 0 !important; padding: 0 !important; display: flex !important; flex-direction: column !important; gap: 0.1rem !important;">';
            for (let i = itemsPerColumn; i < maxLength; i++) {
                if (i < maxLength) {
                    const ambiente = ambientes[i] || '';
                    const necessidade = necessidades[i] || '';
                    const numeroAmbiente = String(i + 1).padStart(2, '0');
                    
                    html += `
                        <div class="ambiente-item-optimized" style="margin: 0 !important; padding: 0.1rem !important; border: 1px solid #e9ecef !important; background: #f9f9f9 !important; border-radius: 4px !important; page-break-inside: avoid !important; box-sizing: border-box !important;">
                            <div class="ambiente-header-optimized" style="background: #FF5722 !important; color: white !important; padding: 0.1rem !important; border-radius: 3px !important; margin: 0 0 0.1rem 0 !important; text-align: center !important; font-size: 12px !important; font-weight: 600 !important; line-height: 1.1 !important;">
                                AMBIENTE ${numeroAmbiente}
                            </div>
                            <div class="ambiente-details-optimized" style="margin: 0 !important; padding: 0 !important; display: flex !important; flex-direction: column !important; gap: 0.05rem !important;">
                                <div class="ambiente-nome-optimized" style="margin: 0 !important; padding: 0 !important; font-size: 9px !important; line-height: 1.1 !important; word-wrap: break-word !important;">
                                    <strong style="color: #37474F !important; font-weight: 600 !important;">NOME:</strong> ${ambiente.trim() !== '' ? ambiente : '(Não especificado)'}
                                </div>
                                <div class="ambiente-necessidades-optimized" style="margin: 0 !important; padding: 0 !important; font-size: 9px !important; line-height: 1.1 !important; word-wrap: break-word !important;">
                                    <strong style="color: #37474F !important; font-weight: 600 !important;">NECESSIDADES:</strong> ${necessidade.trim() !== '' ? necessidade : '(Não especificado)'}
                                </div>
                            </div>
                        </div>
                    `;
                }
            }
            html += '</div>'; // Fechar coluna direita
            
            html += '</div>'; // Fechar environments-two-columns-optimized
            
            // Total de ambientes - estilo otimizado
            html += `
                <div class="environments-summary-optimized" style="background: #e3f2fd !important; padding: 0.2rem !important; border-radius: 4px !important; margin: 0.1rem 0 0 0 !important; text-align: center !important; font-size: 12px !important; font-weight: bold !important; line-height: 1.1 !important; page-break-inside: avoid !important;">
                    <strong>TOTAL DE AMBIENTES:</strong> ${ambientes.length}
                </div>
            `;
            
            console.log('🏠 Seção de ambientes em duas colunas otimizada para PDF gerada');
            return html;
        },generateTimelineSection(data) {
            const prazos = [
                { label: 'LEVANTAMENTO', value: data.prazoLevantamento, icon: 'fa-search' },
                { label: 'LAYOUT', value: data.prazoLayout, icon: 'fa-drafting-compass' },
                { label: 'MODELAGEM 3D', value: data.prazoModelagem3d, icon: 'fa-cube' },
                { label: 'PROJETO EXECUTIVO', value: data.prazoProjetoExecutivo, icon: 'fa-tools' },
                { label: 'COMPLEMENTARES', value: data.prazoComplementares, icon: 'fa-cogs' }
            ];

            let html = '<div class="prazos-list">';
            
            // Mostrar todos os prazos no formato "NOME: X DIAS"
            prazos.forEach(prazo => {
                const hasValue = prazo.value && prazo.value.trim();
                html += `
                    <div class="prazo-item-horizontal ${hasValue ? 'filled' : 'empty'}">
                        <div class="prazo-content">
                            <i class="fas ${prazo.icon}"></i>
                            <strong>${prazo.label}:</strong>
                            <span class="prazo-value">${hasValue ? prazo.value + ' DIAS' : 'NÃO DEFINIDO'}</span>
                        </div>
                    </div>
                `;
            });
            
            // Mostrar prazo total
            const hasTotal = data.prazoTotal && data.prazoTotal.trim();
            html += `
                <div class="prazo-item-horizontal prazo-total ${hasTotal ? 'filled' : 'empty'}">
                    <div class="prazo-content">
                        <i class="fas fa-calculator"></i>
                        <strong>TOTAL:</strong>
                        <span class="prazo-value">${hasTotal ? data.prazoTotal + ' DIAS' : 'NÃO CALCULADO'}</span>
                    </div>
                </div>
            `;

            html += '</div>';
            return html;},        generateObservationsSection(data) {
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
                `;            });

            html += '</div>';
            
            // RESUMO DAS OBSERVAÇÕES REMOVIDO CONFORME SOLICITAÇÃO
            
            console.log('💭 === SEÇÃO DE OBSERVAÇÕES GERADA COM SUCESSO (SEM RESUMO) ===');
            console.log(`💭 HTML gerado (${html.length} caracteres):`, html.substring(0, 200) + '...');
            console.log('💭 === FIM DA GERAÇÃO DE OBSERVAÇÕES ===');
            
            return html;        },        getReportStyles() {
            return `
                <style>
                /* RESET E CONFIGURAÇÃO BASE */
                * { 
                    margin: 0 !important; 
                    padding: 0 !important; 
                    box-sizing: border-box !important; 
                    -webkit-print-color-adjust: exact !important;
                    print-color-adjust: exact !important;
                }
                
                body { 
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif !important; 
                    font-size: 9px !important;
                    line-height: 1.3 !important; 
                    color: #333 !important; 
                    background: white !important;
                    margin: 0 !important;
                    padding: 0 !important;
                    width: 100% !important;
                }
                
                /* PADRONIZAÇÃO DE FONTE CONFORME SOLICITADO */
                /* SEÇÕES E TÍTULOS DE CAIXAS: 12px */
                h1, h2, h3, .main-title, .section-title, .escopo-subtitle, .section-header h2, .ambiente-header, .obs-item strong {
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif !important;
                    font-size: 12px !important;
                    font-weight: bold !important;
                    color: #333 !important;
                    margin: 0 !important;
                    padding: 0 !important;
                    line-height: 1.2 !important;
                }
                
                /* TODOS OS OUTROS TEXTOS: 9px */
                h4, h5, h6, p, span, div, .info-label, .info-value, .obs-item span, .checkbox-item, .ambiente-item, .subtitle, label, input, textarea, small {
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif !important;
                    font-size: 9px !important;
                    font-weight: 400 !important;
                    color: #333 !important;
                    margin: 0 !important;
                    padding: 0 !important;
                    line-height: 1.3 !important;
                }
                
                /* CABEÇALHO */
                .header { 
                    background: linear-gradient(135deg, #FF5722, #FF7043) !important; 
                    color: white !important; 
                    padding: 0.6rem !important; 
                    margin-bottom: 0.4rem !important; 
                }
                
                .header-content { 
                    display: flex !important; 
                    justify-content: space-between !important; 
                    align-items: center !important; 
                }
                
                .logo-container { 
                    display: flex !important; 
                    align-items: center !important; 
                    gap: 0.8rem !important; 
                }
                
                .logo-img { 
                    width: 30px !important; 
                    height: 30px !important; 
                    object-fit: contain !important; 
                    background: white !important; 
                    border-radius: 3px !important; 
                    padding: 3px !important; 
                }
                
                .logo-text h1 { 
                    font-size: 12px !important; 
                    margin: 0 !important; 
                    font-weight: bold !important; 
                    color: white !important;
                }
                
                .logo-text .subtitle { 
                    font-size: 9px !important; 
                    opacity: 0.9 !important; 
                    color: white !important;
                    margin: 0 !important;
                }
                
                .container { 
                    max-width: none !important; 
                    margin: 0 !important; 
                    padding: 0 0.3rem !important; 
                    width: 100% !important;
                }
                
                /* SEÇÕES - COMPACTAS */
                .section { 
                    margin-bottom: 0.4rem !important; 
                    border: 1px solid #e9ecef !important; 
                    border-radius: 3px !important; 
                    overflow: hidden !important; 
                    background: white !important;
                    page-break-inside: avoid !important;
                }
                
                /* SEÇÕES COM CONTEÚDO MÍNIMO - ULTRA COMPACTAS */
                .section:has(.section-content:only-child) {
                    margin-bottom: 0.1rem !important;
                }
                
                .section-header { 
                    background: #37474F !important; 
                    color: white !important; 
                    padding: 0.3rem 0.4rem !important; 
                    display: flex !important; 
                    align-items: center !important; 
                    gap: 0.2rem !important; 
                }
                
                .section-header h2 {
                    font-size: 12px !important;
                    font-weight: bold !important;
                    color: white !important;
                    margin: 0 !important;
                }
                
                .section-content { 
                    padding: 0.4rem !important; 
                    background: white !important; 
                }
                
                /* OBSERVAÇÕES ABAIXO DAS SEÇÕES */
                .section-observations {
                    background: #f8f9fa !important;
                    border-top: 1px solid #e9ecef !important;
                    padding: 0.2rem 0.4rem !important;
                    margin: 0 !important;
                }
                
                .section-observations .obs-content {
                    font-size: 9px !important;
                    color: #555 !important;
                    line-height: 1.2 !important;
                }
                
                .section-observations strong {
                    color: #FF5722 !important;
                    font-weight: bold !important;
                    font-size: 12px !important;
                }
                
                /* LAYOUT DUAS COLUNAS (INFORMAÇÕES GERAIS) */
                .two-column-section { 
                    display: flex !important; 
                    gap: 1rem !important; 
                    margin-bottom: 0.6rem !important; 
                }
                
                .column-left, .column-right { 
                    flex: 1 !important; 
                }
                
                .column-left { 
                    border-right: 2px solid #FF6B35 !important; 
                    padding-right: 0.8rem !important; 
                }
                
                .section-title { 
                    font-size: 12px !important; 
                    font-weight: 600 !important; 
                    color: #FF5722 !important; 
                    margin-bottom: 0.6rem !important; 
                    padding-bottom: 0.3rem !important; 
                    border-bottom: 1px solid #FF5722 !important; 
                    display: flex !important; 
                    align-items: center !important; 
                    gap: 0.3rem !important; 
                }
                
                .info-list { 
                    display: flex !important; 
                    flex-direction: column !important; 
                    gap: 0.3rem !important; 
                }
                
                .info-item { 
                    display: flex !important; 
                    padding: 0.2rem 0 !important; 
                    border-bottom: 1px solid #f0f0f0 !important; 
                }
                
                .info-label { 
                    flex: 0 0 100px !important; 
                    font-weight: 600 !important; 
                    color: #37474F !important; 
                    font-size: 9px !important; 
                    margin-right: 0.5rem !important; 
                }
                
                .info-value { 
                    flex: 1 !important; 
                    color: #333 !important; 
                    font-size: 9px !important; 
                    word-break: break-word !important; 
                }
                
                /* AMBIENTES EM DUAS COLUNAS - OTIMIZADO PARA A4 */
                .environments-two-columns {
                    display: flex !important;
                    gap: 0.2rem !important;
                    margin: 0 !important;
                    width: 100% !important;
                    page-break-inside: avoid !important;
                }
                
                .environments-column {
                    flex: 1 !important;
                    width: 48% !important;
                    display: flex !important;
                    flex-direction: column !important;
                    gap: 0.1rem !important;
                    margin: 0 !important;
                    padding: 0 !important;
                }
                
                .ambiente-item {
                    background: #f9f9f9 !important;
                    border: 1px solid #e9ecef !important;
                    border-radius: 4px !important;
                    padding: 0.2rem !important;
                    margin: 0 0 0.1rem 0 !important;
                    page-break-inside: avoid !important;
                }
                
                .ambiente-header {
                    background: #FF5722 !important;
                    color: white !important;
                    padding: 0.1rem !important;
                    border-radius: 3px !important;
                    margin: 0 0 0.1rem 0 !important;
                    text-align: center !important;
                }
                
                .ambiente-header strong {
                    font-size: 12px !important;
                    font-weight: 600 !important;
                    color: white !important;
                }
                
                .ambiente-details {
                    display: flex !important;
                    flex-direction: column !important;
                    gap: 0.1rem !important;
                    margin: 0 !important;
                    padding: 0 !important;
                }
                
                .ambiente-nome,
                .ambiente-necessidades {
                    font-size: 9px !important;
                    line-height: 1.1 !important;
                    word-wrap: break-word !important;
                    margin: 0 !important;
                    padding: 0 !important;
                }
                
                .ambiente-nome strong,
                .ambiente-necessidades strong {
                    color: #37474F !important;
                    font-weight: 600 !important;
                    margin: 0 !important;
                    padding: 0 !important;
                    font-size: 9px !important;
                }
                
                .environments-summary {
                    background: #e3f2fd !important;
                    padding: 0.2rem !important;
                    border-radius: 4px !important;
                    margin: 0.1rem 0 0 0 !important;
                    text-align: center !important;
                }
                
                .no-environments {
                    margin: 0 !important;
                    padding: 0.1rem !important;
                }
                
                .empty-state {
                    margin: 0 !important;
                    padding: 0.1rem !important;
                    text-align: center !important;
                }
                
                /* OBSERVAÇÕES ADICIONAIS */
                .additional-observations {
                    display: flex !important;
                    flex-direction: column !important;
                    gap: 0.8rem !important;
                }
                
                .additional-observations .obs-item {
                    background: #f8f9fa !important;
                    border: 1px solid #e9ecef !important;
                    border-left: 3px solid #FF5722 !important;
                    padding: 0.6rem !important;
                    border-radius: 4px !important;
                    font-size: 9px !important;
                    line-height: 1.3 !important;
                    margin-bottom: 0.4rem !important;
                }
                
                .additional-observations .obs-item strong {
                    color: #FF5722 !important;
                    font-weight: 600 !important;
                    margin-right: 0.5rem !important;
                    font-size: 9px !important;
                }
                
                /* OUTROS ELEMENTOS */
                .escopo-group {
                    margin-bottom: 1.5rem !important;
                }
                
                .escopo-subtitle {
                    font-size: 1rem !important;
                    font-weight: 600 !important;
                    color: #37474F !important;
                    margin-bottom: 0.8rem !important;
                    padding-bottom: 0.3rem !important;
                    border-bottom: 1px solid #e9ecef !important;
                }
                
                .checkbox-list {
                    display: grid !important;
                    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)) !important;
                    gap: 0.5rem !important;
                }
                
                .checkbox-item {
                    padding: 0.5rem !important;
                    border-radius: 4px !important;
                    font-size: 10px !important;
                }
                
                .checkbox-item.checked {
                    background: rgba(76, 175, 80, 0.1) !important;
                    border-left: 3px solid #4CAF50 !important;
                }
                
                .checkbox-item.unchecked {
                    background: rgba(158, 158, 158, 0.05) !important;
                    border-left: 3px solid #9E9E9E !important;
                }
                
                /* RODAPÉ */
                .footer {
                    background: #f8f9fa !important;
                    padding: 1rem !important;
                    margin-top: 2rem !important;
                    border-top: 2px solid #FF5722 !important;
                    text-align: center !important;
                    color: #666 !important;
                    font-size: 10px !important;
                }
                
                .creator-info {
                    font-weight: 600 !important;
                    color: #FF5722 !important;
                    margin-top: 0.5rem !important;
                }
                
                /* PRINT STYLES - ELIMINAR ESPAÇOS VAZIOS E COMPACTAR */
                @media print {
                    * {
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                        margin: 0 !important;
                        padding: 0 !important;
                    }
                    
                    @page {
                        size: A4 !important;
                        margin: 5mm !important;
                    }
                    
                    body { 
                        font-size: 9px !important; 
                        margin: 0 !important; 
                        padding: 0 !important;
                        width: 100% !important;
                        max-width: 20cm !important;
                        line-height: 1.1 !important;
                        background: white !important;
                        color: #333 !important;
                    }
                    
                    .container {
                        max-width: none !important;
                        padding: 0 !important;
                        margin: 0 !important;
                    }
                    
                    .header {
                        margin-bottom: 0.2rem !important;
                        padding: 0.3rem !important;
                        background: linear-gradient(135deg, #FF5722, #FF7043) !important;
                        color: white !important;
                        page-break-inside: avoid !important;
                    }
                    
                    .section {
                        page-break-inside: avoid !important;
                        margin-bottom: 0.2rem !important;
                        break-inside: avoid !important;
                        border: 1px solid #ddd !important;
                    }
                    
                    .section-header {
                        font-size: 12px !important;
                        padding: 0.1rem 0.2rem !important;
                        background: #37474F !important;
                        color: white !important;
                    }
                    
                    .section-content {
                        padding: 0.2rem !important;
                    }
                
                    /* DUAS COLUNAS PARA INFORMAÇÕES GERAIS */
                    .two-column-section {
                        page-break-inside: avoid !important;
                        display: flex !important;
                        gap: 0.3rem !important;
                        margin: 0 !important;
                    }
                    
                    .column-left, .column-right {
                        flex: 1 !important;
                        margin: 0 !important;
                        padding: 0 !important;
                    }
                    
                    /* AMBIENTES - DUAS COLUNAS COMPACTAS */
                    .environments-two-columns {
                        display: flex !important;
                        gap: 0.2rem !important;
                        page-break-inside: avoid !important;
                        width: 100% !important;
                        margin: 0 !important;
                    }
                    
                    .environments-column {
                        flex: 1 !important;
                        width: 48% !important;
                        margin: 0 !important;
                        padding: 0 !important;
                    }
                    
                    /* ESCOPO - DUAS COLUNAS COMPACTAS */
                    .scope-two-columns {
                        display: flex !important;
                        gap: 0.2rem !important;
                        page-break-inside: avoid !important;
                        width: 100% !important;
                        margin: 0 !important;
                    }
                    
                    .scope-column {
                        flex: 1 !important;
                        width: 48% !important;
                        page-break-inside: avoid !important;
                        margin: 0 !important;
                        padding: 0 !important;
                    }
                    
                    .escopo-group.compact {
                        margin-bottom: 0.1rem !important;
                        padding: 0.1rem !important;
                        background: #f8f9fa !important;
                        border: 1px solid #e9ecef !important;
                        page-break-inside: avoid !important;
                    }
                    
                    .checkbox-item.compact {
                        font-size: 9px !important;
                        padding: 0.05rem !important;
                        margin-bottom: 0.02rem !important;
                        page-break-inside: avoid !important;
                    }
                    
                    .sub-checkbox-item.compact {
                        font-size: 9px !important;
                        padding: 0.02rem 0.05rem !important;
                        margin-bottom: 0.01rem !important;
                    }
                    
                    .ambiente-item {
                        page-break-inside: avoid !important;
                        margin-bottom: 0.1rem !important;
                        padding: 0.1rem !important;
                        font-size: 9px !important;
                    }
                    
                    /* OBSERVAÇÕES ADICIONAIS - ELIMINAR ESPAÇOS VAZIOS */
                    .observations-section {
                        page-break-before: auto !important;
                        page-break-after: auto !important;
                        break-inside: avoid !important;
                        margin: 0.1rem 0 !important;
                        padding: 0 !important;
                        border: 1px solid #FF5722 !important;
                        background: white !important;
                        width: 100% !important;
                        max-width: 100% !important;
                        box-sizing: border-box !important;
                    }
                    
                    .additional-observations {
                        display: block !important;
                        page-break-inside: avoid !important;
                        background: white !important;
                        padding: 0.1rem !important;
                        width: 100% !important;
                        max-width: 100% !important;
                        box-sizing: border-box !important;
                        margin: 0 !important;
                    }
                    
                    .additional-observations .obs-item {
                        background: #f8f9fa !important;
                        border: 1px solid #e9ecef !important;
                        border-left: 2px solid #FF5722 !important;
                        padding: 0.05rem !important;
                        margin: 0 0 0.02rem 0 !important;
                        font-size: 9px !important;
                        line-height: 1.0 !important;
                        break-inside: avoid !important;
                        page-break-inside: avoid !important;
                        visibility: visible !important;
                        display: block !important;
                        min-height: 0.3em !important;
                        width: 100% !important;
                        max-width: 100% !important;
                        box-sizing: border-box !important;
                        word-wrap: break-word !important;
                        overflow-wrap: break-word !important;
                    }
                    
                    .additional-observations .obs-item strong {
                        color: #FF5722 !important;
                        font-weight: 600 !important;
                        font-size: 9px !important;
                        display: inline !important;
                    }
                    
                    .additional-observations .obs-item span {
                        font-size: 9px !important;
                        line-height: 1.0 !important;
                    }
                    
                    /* OBSERVAÇÕES NAS SEÇÕES - COMPACTAS */
                    .section-observations {
                        background: #f8f9fa !important;
                        padding: 0.05rem !important;
                        margin: 0 !important;
                        font-size: 9px !important;
                        border: 1px solid #ddd !important;
                        page-break-inside: avoid !important;
                    }
                    
                    /* FOOTER COMPACTO */
                    .footer {
                        margin-top: 0.2rem !important;
                        padding: 0.1rem !important;
                        font-size: 9px !important;
                        page-break-inside: avoid !important;
                        background: #f8f9fa !important;
                        border-top: 1px solid #ddd !important;
                    }
                    
                    /* ELEMENTOS DE TEXTO PADRONIZADOS */
                    h1, .main-title {
                        font-size: 12px !important;
                        margin: 0 !important;
                        line-height: 1.1 !important;
                        padding: 0 !important;
                        font-weight: 700 !important;
                    }
                    
                    h2, h3, .section-title, .escopo-subtitle, .section-header h2, .subtitle {
                        font-size: 12px !important;
                        margin: 0 !important;
                        line-height: 1.1 !important;
                        padding: 0 !important;
                        font-weight: 600 !important;
                    }
                    
                    h4, h5, h6, p, span, div {
                        font-size: 9px !important;
                        line-height: 1.1 !important;
                        margin: 0 !important;
                        padding: 0 !important;
                    }
                    
                    /* CHECKBOX E ESCOPO COMPACTOS */
                    .checkbox-item {
                        font-size: 9px !important;
                        padding: 0.02rem !important;
                        page-break-inside: avoid !important;
                        margin: 0 !important;
                    }
                    
                    .escopo-group {
                        margin-bottom: 0.1rem !important;
                        padding: 0 !important;
                    }
                    
                    /* PRAZOS COMPACTOS */
                    .prazo-item-horizontal {
                        padding: 0.05rem !important;
                        margin-bottom: 0.02rem !important;
                        font-size: 9px !important;
                    }
                    
                    /* INFO ITEMS COMPACTOS */
                    .info-item {
                        margin: 0 !important;
                        padding: 0.02rem 0 !important;
                        border-bottom: 1px solid #f0f0f0 !important;
                    }
                    
                    .info-label, .info-value {
                        font-size: 9px !important;
                        margin: 0 !important;
                        padding: 0 !important;
                    }
                }
                
                /* MOBILE RESPONSIVE */
                @media screen and (max-width: 768px) {
                    .two-column-section {
                        flex-direction: column !important;
                        gap: 1rem !important;
                    }
                    
                    .column-left {
                        border-right: none !important;
                        border-bottom: 2px solid #FF6B35 !important;
                        padding-right: 0 !important;
                        padding-bottom: 1rem !important;
                    }
                    
                    .environments-two-columns {
                        flex-direction: column !important;
                    }
                }
                </style>
            `;
        },

        openPrintWindow(html, formData, projectTitle) {
            try {
                Logger.info('🪟 Iniciando exportação de relatório...');
                
                // Detectar dispositivo
                const isMobile = Utils.isMobile();
                const isIOS = Utils.isIOS();
                const isAndroid = Utils.isAndroid();
                
                Logger.info(`📱 Dispositivo detectado - Mobile: ${isMobile}, iOS: ${isIOS}, Android: ${isAndroid}`);

                if (isMobile) {
                    Logger.info('📱 Usando estratégia móvel para exportação...');
                    this.handleMobileExport(html, formData, projectTitle);
                } else {
                    Logger.info('💻 Usando estratégia desktop para exportação...');
                    this.handleDesktopExport(html, formData, projectTitle);
                }

            } catch (error) {
                Logger.error('❌ Erro ao exportar relatório:', error);
                this.showMobileAlternatives(html, formData);
            }
        },        handleMobileExport(html, formData, projectTitle) {
            try {
                Logger.info('📱 Iniciando exportação mobile com HTML desktop forçado...');
                
                // CORREÇÃO: Forçar viewport desktop no HTML mobile
                const desktopHTML = this.addPrintButtonToPreview(html.replace(
                    /<meta name="viewport"[^>]*>/i,
                    '<meta name="viewport" content="width=1024, initial-scale=1.0, shrink-to-fit=no">'
                ));
                
                // ESTRATÉGIA 1: window.open com HTML desktop forçado
                Logger.info('📱 Tentativa 1: window.open com viewport desktop...');
                  const printWindow = window.open('', '_blank', 'width=1024,height=768,scrollbars=yes,resizable=yes,toolbar=no,menubar=no');
                
                if (printWindow && !printWindow.closed) {
                    Logger.success('✅ Janela móvel aberta - injetando HTML desktop!');
                    
                    // Injetar HTML com viewport desktop
                    printWindow.document.write(desktopHTML);                    printWindow.document.close();
                    
                    // CORREÇÃO: Definir título personalizado com código do projeto e nome do cliente
                    printWindow.document.title = projectTitle || 'Relatório SKBORGES';
                    
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
                    '/* PDF EXPORT STYLES - STANDARDIZED FONT SIZES: 12px for sections/boxes, 9px for all other text */' +
                    '* { box-sizing: border-box !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }' +
                    'body { font-family: "Segoe UI", Arial, sans-serif !important; font-size: 9px !important; line-height: 1.3 !important; margin: 0 !important; padding: 10px !important; background: white !important; color: #333 !important; }' +
                    '.container { max-width: none !important; width: 100% !important; margin: 0 !important; padding: 0 !important; }' +
                    '/* STANDARDIZED FONT SIZES */' +
                    '/* Section names and box titles: 12px */' +
                    'h1, h2, h3, .section-title, .section-header h2, .main-title, .ambiente-header, .escopo-subtitle, .obs-item strong { font-size: 12px !important; font-weight: bold !important; line-height: 1.2 !important; margin: 0 0 4px 0 !important; }' +
                    '/* All other text: 9px */' +
                    'p, span, div, td, th, .field-value, .info-value, .field-label, .info-label, .checkbox-item, .obs-item span, input, textarea, label, small { font-size: 9px !important; line-height: 1.3 !important; margin: 0 !important; }' +
                    '/* HEADER STYLES */' +
                    '.header { background: linear-gradient(135deg, #FF5722, #FF7043) !important; color: white !important; padding: 8px !important; margin: 0 0 10px 0 !important; }' +
                    '.header-content { display: flex !important; justify-content: space-between !important; align-items: center !important; }' +
                    '.logo-text h1 { font-size: 12px !important; color: white !important; margin: 0 !important; }' +
                    '.logo-text .subtitle { font-size: 9px !important; color: rgba(255,255,255,0.9) !important; margin: 0 !important; }' +
                    '/* SECTION STYLES */' +
                    '.section { margin: 0 0 8px 0 !important; padding: 0 !important; page-break-inside: avoid !important; }' +
                    '.section-header { background: #37474F !important; color: white !important; padding: 4px 8px !important; margin: 0 !important; }' +
                    '.section-content { padding: 6px !important; background: white !important; }' +
                    '/* FORM FIELDS LAYOUT */' +
                    '.field-group, .info-row { display: flex !important; margin: 0 0 4px 0 !important; align-items: flex-start !important; }' +
                    '.field-label, .info-label { flex: 0 0 120px !important; font-weight: bold !important; padding: 2px 4px !important; font-size: 9px !important; }' +
                    '.field-value, .info-value { flex: 1 !important; padding: 2px 4px !important; background: #f8f9fa !important; border: 1px solid #e0e0e0 !important; min-height: 16px !important; font-size: 9px !important; }' +
                    '/* ENVIRONMENTS SECTION - TWO COLUMNS */' +
                    '.environments-two-columns, .scope-two-columns { display: flex !important; gap: 8px !important; margin: 0 !important; }' +
                    '.environments-column, .scope-column { flex: 1 !important; width: 48% !important; }' +
                    '.ambiente-item, .escopo-group { margin: 0 0 4px 0 !important; padding: 3px !important; background: #f8f9fa !important; border: 1px solid #e0e0e0 !important; }' +
                    '.ambiente-header, .escopo-subtitle { font-size: 12px !important; font-weight: bold !important; margin: 0 0 2px 0 !important; }' +
                    '.checkbox-item { font-size: 9px !important; margin: 0 0 2px 0 !important; padding: 1px !important; }' +
                    '/* OBSERVATIONS SECTION */' +
                    '.observations-section { border: 2px solid #FF5722 !important; margin: 8px 0 !important; background: white !important; page-break-inside: avoid !important; }' +
                    '.obs-item { background: #f8f9fa !important; border: 1px solid #e0e0e0 !important; border-left: 3px solid #FF5722 !important; padding: 4px !important; margin: 0 0 4px 0 !important; }' +
                    '.obs-item strong { font-size: 12px !important; color: #FF5722 !important; font-weight: bold !important; }' +
                    '.obs-item span { font-size: 9px !important; }' +
                    '/* HIDE ELEMENTS THAT SHOULD NOT PRINT */' +
                    '.observacoes-coluna-lateral-fixa, .btn-group, .generate-report-btn, .form-actions, .mobile-actions, .floating-actions, .print-button-container { display: none !important; }' +
                    '/* COMPACT LAYOUT - REMOVE EXCESS SPACING */' +
                    '.form-section { margin: 0 !important; padding: 0 !important; }' +
                    '.main-sections { margin: 0 !important; padding: 0 !important; }' +
                    '/* ENSURE PROPER PAGE BREAKS */' +
                    '.section:nth-child(n+2) { page-break-before: auto !important; }' +
                    '@media print { @page { size: A4 !important; margin: 1cm !important; } }' +
                    '</style>'; +
                    '.ambiente-details { margin: 0 !important; padding: 0 !important; height: auto !important; min-height: 0 !important; }' +
                    '.ambiente-nome, .ambiente-necessidades { margin: 0 !important; padding: 0 !important; font-size: 9px !important; line-height: 1.1 !important; height: auto !important; min-height: 0 !important; }' +
                    '.environments-summary { margin: 0 !important; padding: 0 !important; height: auto !important; min-height: 0 !important; }' +
                    '.total-info { margin: 0 !important; padding: 0 !important; font-size: 9px !important; height: auto !important; min-height: 0 !important; }' +
                    '.no-environments, .empty-state { margin: 0 !important; padding: 0 !important; height: auto !important; min-height: 0 !important; }' +
                    '.no-environments-minimal { margin: 0 !important; padding: 0 !important; height: auto !important; min-height: 0 !important; display: inline !important; font-size: 9px !important; line-height: 1 !important; }' +
                    '/* FORCE ZERO HEIGHT FOR ANY EMPTY ENVIRONMENT CONTAINERS */' +
                    '.section:empty, .section-content:empty, div:empty { height: 0 !important; margin: 0 !important; padding: 0 !important; display: none !important; visibility: hidden !important; overflow: hidden !important; }' +
                    '.section:has(.no-environments):only-child { height: 0 !important; margin: 0 !important; padding: 0 !important; display: none !important; }' +
                    'div[style*="display: none"] { height: 0 !important; margin: 0 !important; padding: 0 !important; visibility: hidden !important; }' +
                    '/* PRINT-OPTIMIZED ENVIRONMENTS LAYOUT - TWO COLUMNS */' +
                    '.environments-two-columns-optimized { display: flex !important; gap: 0.2rem !important; margin: 0 !important; padding: 0 !important; width: 100% !important; box-sizing: border-box !important; page-break-inside: auto !important; }' +
                    '.environments-column-left, .environments-column-right { flex: 1 !important; width: 48% !important; margin: 0 !important; padding: 0 !important; display: flex !important; flex-direction: column !important; gap: 0.1rem !important; }' +
                    '.ambiente-item-optimized { margin: 0 !important; padding: 0.1rem !important; border: 1px solid #e9ecef !important; background: #f9f9f9 !important; border-radius: 4px !important; page-break-inside: avoid !important; box-sizing: border-box !important; font-size: 9px !important; line-height: 1.1 !important; }' +
                    '.ambiente-header-optimized { background: #FF5722 !important; color: white !important; padding: 0.1rem !important; border-radius: 3px !important; margin: 0 0 0.1rem 0 !important; text-align: center !important; font-size: 12px !important; font-weight: 600 !important; line-height: 1.1 !important; }' +
                    '.ambiente-details-optimized { margin: 0 !important; padding: 0 !important; display: flex !important; flex-direction: column !important; gap: 0.05rem !important; }' +
                    '.ambiente-nome-optimized, .ambiente-necessidades-optimized { margin: 0 !important; padding: 0 !important; font-size: 9px !important; line-height: 1.1 !important; word-wrap: break-word !important; }' +
                    '.environments-summary-optimized { background: #e3f2fd !important; padding: 0.2rem !important; border-radius: 4px !important; margin: 0.1rem 0 0 0 !important; text-align: center !important; font-size: 12px !important; font-weight: bold !important; line-height: 1.1 !important; page-break-inside: avoid !important; }' +
                    '/* LEGACY PRINT LAYOUT SUPPORT */' +
                    '.environments-list-print { margin: 0 !important; padding: 0 !important; width: 100% !important; box-sizing: border-box !important; page-break-inside: auto !important; }' +
                    '.ambiente-item-print { margin: 0 0 0.05rem 0 !important; padding: 0.03rem !important; border: 1px solid #e9ecef !important; background: #f8f9fa !important; page-break-inside: avoid !important; width: 100% !important; box-sizing: border-box !important; display: block !important; overflow: hidden !important; font-size: 9px !important; line-height: 1.1 !important; }' +
                    '.ambiente-header-print { margin: 0 !important; padding: 0.02rem !important; font-size: 12px !important; font-weight: bold !important; color: #37474F !important; line-height: 1.1 !important; }' +
                    '.ambiente-details-print { margin: 0 !important; padding: 0.02rem !important; display: block !important; font-size: 9px !important; line-height: 1.1 !important; }' +
                    '.ambiente-nome-print, .ambiente-necessidades-print { margin: 0 !important; padding: 0 !important; font-size: 9px !important; line-height: 1.1 !important; display: block !important; }' +
                    '.environments-summary-print { margin: 0.05rem 0 0 0 !important; padding: 0.05rem !important; background: #37474F !important; color: white !important; text-align: center !important; font-size: 12px !important; font-weight: bold !important; line-height: 1.1 !important; page-break-inside: avoid !important; }' +
                    '.section-minimal { margin: 0 !important; padding: 0.05rem !important; height: auto !important; min-height: 0 !important; overflow: hidden !important; display: inline-block !important; width: 100% !important; }' +
                    '.section-minimal .section-header { margin: 0 !important; padding: 0.05rem !important; height: auto !important; min-height: 0 !important; display: inline-block !important; font-size: 12px !important; line-height: 1 !important; }' +
                    '.section-minimal .section-content { margin: 0 !important; padding: 0.05rem !important; height: auto !important; min-height: 0 !important; display: inline-block !important; font-size: 9px !important; line-height: 1 !important; }' +
                    '.environments-inline { margin: 0 !important; padding: 0.1rem !important; background: #f8f9fa !important; border: 1px solid #e9ecef !important; border-radius: 3px !important; display: inline-block !important; width: 100% !important; height: auto !important; min-height: 0 !important; overflow: hidden !important; }' +
                    '.environments-inline .header-inline { background: #37474F !important; color: white !important; padding: 0.05rem 0.1rem !important; margin: 0 !important; font-size: 12px !important; display: inline-block !important; border-radius: 2px !important; }' +
                    '.environments-inline .content-inline { margin: 0 0 0 0.2rem !important; padding: 0 !important; font-size: 9px !important; line-height: 1 !important; display: inline !important; }' +
                    '.section-content:empty { display: none !important; height: 0 !important; margin: 0 !important; padding: 0 !important; }' +
                    '.section-content:has(.no-environments) { margin: 0 !important; padding: 0 !important; height: auto !important; min-height: 0 !important; }' +
                    '.form-section:has(.no-environments) { margin: 0 !important; padding: 0 !important; height: auto !important; min-height: 0 !important; }' +
                    '.observations-section { page-break-inside: avoid !important; border: 2px solid #FF5722 !important; margin: 0.1rem 0 !important; background: white !important; padding: 0 !important; }' +
                    '.additional-observations { display: block !important; padding: 0.1rem !important; margin: 0 !important; }' +
                    '.additional-observations .obs-item { background: #f8f9fa !important; border: 1px solid #e9ecef !important; border-left: 3px solid #FF5722 !important; padding: 0.1rem !important; margin: 0 0 0.05rem 0 !important; page-break-inside: avoid !important; display: block !important; font-size: 9px !important; line-height: 1.1 !important; }' +
                    '.scope-two-columns { display: flex !important; gap: 0.1rem !important; page-break-inside: avoid !important; margin: 0 !important; }' +
                    '.scope-column { flex: 1 !important; width: 48% !important; page-break-inside: avoid !important; margin: 0 !important; padding: 0 !important; }' +
                    '.escopo-group.compact { margin: 0 0 0.1rem 0 !important; padding: 0.1rem !important; background: #f8f9fa !important; border: 1px solid #e9ecef !important; }' +
                    '.checkbox-item.compact { font-size: 9px !important; padding: 0.05rem !important; margin: 0 0 0.05rem 0 !important; line-height: 1.1 !important; }' +
                    '@media screen and (max-width: 768px) { body { min-width: 100vw !important; width: 100vw !important; font-size: 9px !important; margin: 0 !important; padding: 0 !important; line-height: 1.1 !important; } .container { max-width: none !important; width: 100% !important; margin: 0 !important; padding: 0 !important; } .header { width: 100vw !important; margin: 0 !important; box-sizing: border-box !important; padding: 0.3rem !important; } .header-content { flex-direction: row !important; width: 100% !important; margin: 0 !important; padding: 0 !important; } .field-group { flex-direction: row !important; margin: 0 0 0.2rem 0 !important; padding: 0 !important; } .logo-container { flex-direction: row !important; } .section { margin: 0.1rem 0 !important; padding: 0 !important; } .section-header { padding: 0.1rem !important; margin: 0 !important; } .section-content { padding: 0.1rem !important; margin: 0 !important; } .observations-section { display: block !important; page-break-inside: avoid !important; margin: 0.1rem 0 !important; padding: 0 !important; } .additional-observations { display: block !important; padding: 0.1rem !important; margin: 0 !important; } .obs-item { display: block !important; page-break-inside: avoid !important; margin: 0 0 0.1rem 0 !important; padding: 0.1rem !important; font-size: 9px !important; line-height: 1.1 !important; } }' +
                    '@media print { * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; margin: 0 !important; padding: 0 !important; } @page { size: A4 !important; margin: 5mm !important; } body { font-size: 9px !important; margin: 0 !important; min-width: 19cm !important; line-height: 1.1 !important; } .header { background: linear-gradient(135deg, #FF5722, #FF7043) !important; width: 100% !important; padding: 0.3rem !important; margin: 0 !important; } .header-content { display: flex !important; flex-direction: row !important; margin: 0 !important; padding: 0 !important; } .field-group { display: flex !important; flex-direction: row !important; margin: 0 0 0.2rem 0 !important; padding: 0 !important; } h1, .main-title { font-size: 12px !important; margin: 0 !important; padding: 0 !important; line-height: 1.1 !important; font-weight: 700 !important; } h2, h3, .section-title, .subtitle { font-size: 12px !important; margin: 0 !important; padding: 0 !important; line-height: 1.1 !important; font-weight: 600 !important; } h4, h5, h6, p, span, div { font-size: 9px !important; margin: 0 !important; padding: 0 !important; line-height: 1.1 !important; } .section { margin: 0 !important; padding: 0 !important; height: auto !important; min-height: 0 !important; overflow: hidden !important; } .section-header { padding: 0.1rem !important; margin: 0 !important; } .section-content { padding: 0 !important; margin: 0 !important; height: auto !important; overflow: hidden !important; } .form-section { margin: 0 !important; padding: 0 !important; height: auto !important; overflow: hidden !important; } .environments-two-columns { margin: 0 !important; padding: 0 !important; gap: 0 !important; display: flex !important; height: auto !important; overflow: hidden !important; } .environments-column { margin: 0 !important; padding: 0 !important; flex: 1 !important; width: 50% !important; height: auto !important; } .ambiente-item { margin: 0 !important; padding: 0.5mm !important; height: auto !important; overflow: hidden !important; } .ambiente-header { margin: 0 !important; padding: 0 !important; font-size: 12px !important; line-height: 1.1 !important; height: auto !important; } .ambiente-details { margin: 0 !important; padding: 0 !important; height: auto !important; } .ambiente-nome, .ambiente-necessidades { margin: 0 !important; padding: 0 !important; font-size: 9px !important; line-height: 1.1 !important; height: auto !important; } .environments-summary { margin: 0 !important; padding: 0 !important; height: auto !important; } .total-info { margin: 0 !important; padding: 0 !important; font-size: 9px !important; height: auto !important; } .no-environments, .empty-state { margin: 0 !important; padding: 0 !important; height: auto !important; } div:empty { display: none !important; height: 0 !important; margin: 0 !important; padding: 0 !important; } .observations-section { page-break-inside: avoid !important; border: 2px solid #FF5722 !important; background: white !important; display: block !important; margin: 0.1rem 0 !important; padding: 0 !important; } .additional-observations { display: block !important; page-break-inside: avoid !important; padding: 0.1rem !important; margin: 0 !important; } .obs-item { display: block !important; page-break-inside: avoid !important; background: #f8f9fa !important; border: 1px solid #e9ecef !important; margin: 0 0 0.1rem 0 !important; padding: 0.1rem !important; font-size: 9px !important; line-height: 1.1 !important; } .scope-two-columns { display: flex !important; gap: 0.2rem !important; page-break-inside: avoid !important; margin: 0 !important; } .scope-column { flex: 1 !important; width: 48% !important; page-break-inside: avoid !important; margin: 0 !important; padding: 0 !important; } .escopo-group.compact { margin: 0 0 0.1rem 0 !important; padding: 0.1rem !important; background: #f8f9fa !important; border: 1px solid #e9ecef !important; page-break-inside: avoid !important; } .checkbox-item.compact { font-size: 9px !important; padding: 0.05rem !important; margin: 0 0 0.05rem 0 !important; page-break-inside: avoid !important; line-height: 1.1 !important; } }'+
                    '</style>';
                
                // 3. INSERIR CSS ANTES DO </head>
                desktopHTML = desktopHTML.replace('</head>', desktopCSS + '</head>');
                
                // 4. REMOVER REGRAS MOBILE CONFLITANTES
                desktopHTML = desktopHTML.replace(/@media\s+screen\s+and\s+\(max-width:\s*768px\)[^}]*{[^{}]*({[^{}]*}[^{}]*)*}/gi, '');
                
                // 5. CORRIGIR CLASSES E ESTILOS INLINE
                desktopHTML = desktopHTML
                    .replace(/flex-direction:\s*column/gi, 'flex-direction: row !important')
                    .replace(/margin:\s*[^;]+;/gi, 'margin: 0 !important;')
                    .replace(/padding:\s*[^;]+;/gi, 'padding: 0.1rem !important;')
                    .replace(/line-height:\s*[^;]+;/gi, 'line-height: 1.1 !important;');
                
                // 6. LIMPAR CONTAINERS VAZIOS QUE CAUSAM ESPAÇO
                desktopHTML = desktopHTML
                    .replace(/<div([^>]*class="[^"]*environment[^"]*"[^>]*)>\s*<\/div>/gi, '')
                    .replace(/<div([^>]*class="[^"]*ambiente[^"]*"[^>]*)>\s*<\/div>/gi, '')
                    // NOVO: Limpar classes da nova layout otimizada se estiverem vazias
                    .replace(/<div([^>]*class="[^"]*environments-list-print[^"]*"[^>]*)>\s*<\/div>/gi, '')
                    .replace(/<div([^>]*class="[^"]*environments-two-columns-optimized[^"]*"[^>]*)>\s*<\/div>/gi, '')
                    .replace(/<div([^>]*class="[^"]*ambiente-item-print[^"]*"[^>]*)>\s*<\/div>/gi, '')
                    .replace(/<div([^>]*class="[^"]*ambiente-item-optimized[^"]*"[^>]*)>\s*<\/div>/gi, '')
                    .replace(/(<div[^>]*>)(\s*)((<br\s*\/?>)*\s*)(<\/div>)/gi, function(match, openTag, space1, middle, br, closeTag) {
                        if (!middle.trim() || middle.match(/^(<br\s*\/?>|\s)*$/)) {
                            return openTag.replace('>', ' style="height: 0; margin: 0; padding: 0; overflow: hidden; display: none;">') + closeTag;
                        }
                        return match;
                    })
                    .replace(/height:\s*auto/gi, 'height: auto !important')
                    .replace(/overflow:\s*visible/gi, 'overflow: hidden !important');
                
                // 7. FORÇA REMOÇÃO COMPLETA DE SEÇÕES DE AMBIENTES VAZIAS E ESPAÇOS
                desktopHTML = desktopHTML
                    // Remover comentários sobre ambientes omitidos
                    .replace(/<!--\s*AMBIENTES:\s*Nenhum ambiente cadastrado.*?-->/gi, '')
                    .replace(/<!--\s*DEBUG:\s*AMBIENTES OMITIDOS\s*-->/gi, '')
                    // SUPER AGRESSIVO: Detectar e remover completamente seções de ambientes vazias
                    .replace(/<div[^>]*class="[^"]*section[^"]*"[^>]*>\s*<div[^>]*section-header[^>]*>.*?Ambientes\s+e\s+Necessidades.*?<\/div>\s*<div[^>]*section-content[^>]*>.*?<\/div>\s*<\/div>/gis, '')
                    .replace(/<div[^>]*class="[^"]*section-minimal[^"]*"[^>]*>.*?Ambientes\s+e\s+Necessidades.*?<\/div>/gis, '')
                    // Remover qualquer div que contenha apenas espaços em branco após remoção de ambientes
                    .replace(/<div[^>]*class="[^"]*section[^"]*"[^>]*>\s*<\/div>/gi, '')
                    .replace(/<div[^>]*>\s*<!--[^>]*-->\s*<\/div>/gi, '')
                    // EXTREMAMENTE AGRESSIVO: Remover espaços vazios entre escopo e cronograma
                    .replace(/(<!-- DEBUG: FIM ESCOPO -->)\s*(\n|\r\n)?\s*(<!-- DEBUG: INICIO CRONOGRAMA -->)/gi, '$1$3')
                    .replace(/(observação sobre o escopo[^<]*<\/div>\s*<\/div>\s*<\/div>)\s+(<!\-\-\s*DEBUG:\s*INICIO\s*CRONOGRAMA)/gi, '$1$2')
                    .replace(/(observação sobre o escopo[^<]*<\/div>\s*<\/div>\s*<\/div>)\s+(<!-- CRONOGRAMA DO PROJETO -->)/gi, '$1$2')
                    // Remover quebras de linha múltiplas entre seções
                    .replace(/(<\/div>\s*<\/div>)\s*\n\s*\n\s*(<!\-\-\s*DEBUG:\s*INICIO\s*CRONOGRAMA)/gi, '$1$2')
                    .replace(/(<\/div>\s*<\/div>)\s*\n\s*\n\s*(<!-- CRONOGRAMA DO PROJETO -->)/gi, '$1$2')
                    // Remover espaços múltiplos entre tags
                    .replace(/>\s{2,}</g, '><')
                    // Remover referências antigas a conteúdo mínimo que não devem mais existir
                    .replace(/<span[^>]*class="[^"]*no-environments-minimal[^"]*"[^>]*>.*?<\/span>/gi, '')
                    .replace(/Nenhum ambiente específico cadastrado\./gi, '')
                    // Limpeza de containers vazios
                    .replace(/(<h2[^>]*>.*?Ambientes.*?<\/h2>)(\s*<\/div>\s*<div[^>]*section-content[^>]*>)/gi, '')
                    .replace(/(<div[^>]*section-header[^>]*>.*?Ambientes.*?<\/div>)(\s*<div[^>]*section-content[^>]*>)/gi, '')
                    .replace(/(\bAmbientes\s+e\s+Necessidades\b.*?<\/[^>]+>)\s*(<div[^>]*>)/gi, '')
                    // Remover classes relacionadas a ambientes vazios
                    .replace(/<div[^>]*class="[^"]*no-environments[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '')
                    .replace(/<div[^>]*class="[^"]*empty-state[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '')
                    // NOVO: Forçar remoção de qualquer espaço vertical entre escopo e cronograma
                    .replace(/(FIM ESCOPO[^>]*-->)\s*(\n|\r\n)?\s*(<!--[^>]*INICIO CRONOGRAMA)/gi, '$1$3')
                    // Remover linhas vazias múltiplas que podem ter sido criadas
                    .replace(/\n\s*\n\s*\n/g, '\n')
                    .replace(/\s{3,}/g, ' ');
                
                // 8. LIMPEZA FINAL: Remover qualquer referência restante a ambientes vazios e espaços extras
                desktopHTML = desktopHTML
                    .replace(/(<[^>]*>)(\s*Nenhum ambiente específico cadastrado\.\s*)(<\/[^>]*>)/gi, '')
                    .replace(/^\s*<!--.*?AMBIENTES.*?-->\s*$/gm, '')
                    // Forçar compactação entre seções adjacentes
                    .replace(/(<\/div>\s*<\/div>\s*<\/div>)\s*(\n|\r\n)?\s*(<div[^>]*class="section")/gi, '$1$3')
                    // ULTRA AGRESSIVO: Garantir que não há espaço entre escopo e cronograma
                    .replace(/(FIM ESCOPO -->)\s*(\n|\r\n|\s)*(<!-- DEBUG: INICIO CRONOGRAMA -->)/gi, '$1$3')
                    .replace(/(FIM ESCOPO -->)\s*(\n|\r\n|\s)*(<!--[^>]*CRONOGRAMA)/gi, '$1$3')
                    // Remover espaços desnecessários que podem causar página em branco
                    .replace(/(<\/div>\s*){3,}/gi, '</div></div></div>')
                    // Forçar que não haja elementos vazios entre sections
                    .replace(/(<div[^>]*class="section"[^>]*>.*?<\/div>)\s*(\n|\r\n)?\s*(<div[^>]*class="section")/gi, '$1$3');
                
                // 9. VERIFICAÇÃO FINAL: Garantir que HTML está realmente compacto
                desktopHTML = desktopHTML
                    // Remover múltiplas quebras de linha consecutivas
                    .replace(/(\n|\r\n){3,}/g, '\n')
                    // Remover espaços múltiplos entre tags
                    .replace(/>\s{2,}</g, '><')
                    // Compactar fechamento de divs múltiplas
                    .replace(/(<\/div>)\s*(\n|\r\n)?\s*(<\/div>)\s*(\n|\r\n)?\s*(<\/div>)/gi, '$1$3$5')
                    // CRITICAL FIX: Força remoção de quebras de página desnecessárias
                    .replace(/(<div[^>]*class="section"[^>]*>.*?<\/div>)\s*\n{2,}\s*(<div[^>]*class="section")/gi, '$1$2')
                    // Força compactação entre seções adjacentes para evitar espaços em PDF
                    .replace(/(<\/div>\s*<\/div>\s*<\/div>)\s*(\n|\r\n){2,}\s*(<div[^>]*class="section")/gi, '$1$3');
                
                // 10. PDF-SPECIFIC FIX: Adicionar quebras de página controladas para grandes seções
                desktopHTML = desktopHTML
                    // Se a seção de ambientes tem muitos itens, forçar quebra de página adequada
                    .replace(/(<div[^>]*class="environments-list-print"[^>]*>(?:[^<]|<(?!\/div>))*<\/div>)/gi, function(match) {
                        const itemCount = (match.match(/ambiente-item-print/g) || []).length;
                        if (itemCount > 10) { // Many environments - linear layout
                            console.log(`🔧 PDF FIX: ${itemCount} ambientes detectados (layout linear) - aplicando controle de quebra de página`);
                            return match.replace('<div class="environments-list-print"', '<div class="environments-list-print" style="page-break-inside: auto !important; orphans: 2; widows: 2;"');
                        }
                        return match;
                    })
                    // Se a seção de ambientes tem muitos itens no layout duas colunas, forçar quebra adequada
                    .replace(/(<div[^>]*class="environments-two-columns-optimized"[^>]*>(?:[^<]|<(?!\/div>))*<\/div>)/gi, function(match) {
                        const itemCount = (match.match(/ambiente-item-optimized/g) || []).length;
                        if (itemCount > 8) { // Many environments - two column layout
                            console.log(`🔧 PDF FIX: ${itemCount} ambientes detectados (layout duas colunas) - aplicando controle de quebra de página`);
                            return match.replace('<div class="environments-two-columns-optimized"', '<div class="environments-two-columns-optimized" style="page-break-inside: auto !important; orphans: 2; widows: 2;"');
                        }
                        return match;
                    });
                
                // DEBUG: Log do HTML final para análise
                console.log('🔍 DEBUG: HTML final sendo enviado para iframe:');
                console.log('--- ESCOPO ATÉ CRONOGRAMA ---');
                const debugSegment = desktopHTML.substring(
                    Math.max(0, desktopHTML.indexOf('<!-- DEBUG: FIM ESCOPO -->') - 100),
                    desktopHTML.indexOf('<!-- DEBUG: INICIO CRONOGRAMA -->') + 200
                );
                console.log(debugSegment);
                console.log('--- FIM DEBUG ---');
                
                // VERIFICAÇÃO FINAL: Garantir que não há seção de ambientes no HTML final
                if (debugSegment.includes('Ambientes e Necessidades')) {
                    console.warn('⚠️ AVISO: Seção de ambientes ainda presente no HTML final!');
                    console.log('Conteúdo problemático:', debugSegment.match(/Ambientes\s+e\s+Necessidades.*?(?=<!--|$)/gi));
                } else {
                    console.log('✅ SUCESSO: Seção de ambientes removida do HTML final');
                }
                
                // NOVA VERIFICAÇÃO: Contar ambientes no HTML para debug
                const environmentCountPrint = (desktopHTML.match(/ambiente-item-print/g) || []).length;
                const environmentCountOptimized = (desktopHTML.match(/ambiente-item-optimized/g) || []).length;
                const totalEnvironmentCount = environmentCountPrint + environmentCountOptimized;
                
                if (totalEnvironmentCount > 0) {
                    console.log(`🏠 INFO: ${totalEnvironmentCount} ambientes detectados no HTML final (layout otimizado duas colunas para PDF)`);
                    if (environmentCountOptimized > 0) {
                        console.log(`🏠 Layout: Duas colunas otimizado (${environmentCountOptimized} ambientes)`);
                    }
                    if (environmentCountPrint > 0) {
                        console.log(`🏠 Layout: Linear print (${environmentCountPrint} ambientes)`);
                    }
                } else {
                    console.log('🏠 INFO: Nenhum ambiente no HTML final');
                }
                
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
                
                // Aguardar carregamento do iframe e focar + Manipulação DOM final
                setTimeout(() => {
                    const iframe = document.getElementById('desktop-iframe');
                    if (iframe && iframe.contentWindow) {
                        iframe.contentWindow.focus();
                        
                        // LIMPEZA FINAL: Manipular o DOM diretamente no iframe
                        try {
                            const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
                            
                            // Remover qualquer comentário sobre ambientes
                            const walker = iframeDoc.createTreeWalker(
                                iframeDoc.body,
                                NodeFilter.SHOW_COMMENT,
                                null,
                                false
                            );
                            
                            const commentsToRemove = [];
                            let node;
                            while (node = walker.nextNode()) {
                                if (node.textContent.includes('AMBIENTES') || node.textContent.includes('ambiente cadastrado')) {
                                    commentsToRemove.push(node);
                                }
                            }
                            commentsToRemove.forEach(comment => comment.remove());
                            
                            // Forçar margem zero em todos os containers principais
                            const containers = iframeDoc.querySelectorAll('.container, .main-sections, .form-section');
                            containers.forEach(container => {
                                container.style.margin = '0';
                                container.style.padding = '0';
                                container.style.height = 'auto';
                                container.style.minHeight = '0';
                                container.style.overflow = 'hidden';
                            });
                            
                            // Remover qualquer div vazio que pode estar causando espaço
                            const emptyDivs = iframeDoc.querySelectorAll('div:empty');
                            emptyDivs.forEach(div => {
                                if (div.textContent.trim() === '') {
                                    div.remove();
                                }
                            });
                            
                            Logger.info('🧹 Limpeza DOM final aplicada no iframe');
                        } catch (domError) {
                            Logger.warning('⚠️ Não foi possível acessar DOM do iframe:', domError);
                        }
                        
                        Logger.info('🎯 Iframe focado - pronto para impressão!');
                    }
                }, 500);
                
            } catch (error) {
                Logger.error('❌ Erro ao criar página desktop no mobile:', error);
                this.showMobileAlternatives(html, formData);
            }
        },

        handleDesktopExport(html, formData, projectTitle) {
            try {
                Logger.info('💻 Abrindo janela para desktop...');
                
                // Criar HTML com botão de impressão para a preview
                const htmlWithPrintButton = this.addPrintButtonToPreview(html);
                
                const printWindow = window.open('', '_blank', 'width=1000,height=700,scrollbars=yes,resizable=yes,toolbar=no,menubar=yes');
                
                if (!printWindow || printWindow.closed) {
                    throw new Error('Janela bloqueada por pop-up blocker');
                }

                printWindow.document.write(htmlWithPrintButton);
                printWindow.document.close();
                
                // CORREÇÃO: Definir título personalizado com código do projeto e nome do cliente
                printWindow.document.title = projectTitle || 'Relatório SKBORGES';

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
                this.showDesktopAlternatives(html, formData);
            }
        },

        addPrintButtonToPreview(html) {
            // Adicionar botão de impressão e CSS específico para preview
            const printButtonAndCSS = `
                <div id="print-button-container" style="position: fixed; top: 20px; right: 20px; z-index: 9999; background: #FF5722; padding: 10px 20px; border-radius: 5px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
                    <button onclick="window.print()" style="background: white; color: #FF5722; border: none; padding: 8px 16px; border-radius: 4px; font-weight: bold; cursor: pointer; font-size: 14px;">
                        🖨️ IMPRIMIR PDF
                    </button>
                </div>
                
                <style id="preview-pdf-styles">
                    /* PREVIEW PAGE STYLES - MATCH PDF EXACTLY - STANDARDIZED FONT SIZES */
                    body { font-family: "Segoe UI", Arial, sans-serif !important; font-size: 9px !important; line-height: 1.3 !important; margin: 0 !important; padding: 10px !important; background: white !important; color: #333 !important; }
                    .container { max-width: none !important; width: 100% !important; margin: 0 !important; padding: 0 !important; }
                    
                    /* STANDARDIZED FONT SIZES */
                    /* Section names and box titles: 12px */
                    h1, h2, h3, .section-title, .section-header h2, .main-title, .ambiente-header, .escopo-subtitle, .obs-item strong { font-size: 12px !important; font-weight: bold !important; line-height: 1.2 !important; margin: 0 0 4px 0 !important; }
                    /* All other text: 9px */
                    p, span, div, td, th, .field-value, .info-value, .field-label, .info-label, .checkbox-item, .obs-item span, input, textarea, label, small { font-size: 9px !important; line-height: 1.3 !important; margin: 0 !important; }
                    
                    /* HEADER STYLES */
                    .header { background: linear-gradient(135deg, #FF5722, #FF7043) !important; color: white !important; padding: 8px !important; margin: 0 0 10px 0 !important; }
                    .header-content { display: flex !important; justify-content: space-between !important; align-items: center !important; }
                    .logo-text h1 { font-size: 12px !important; color: white !important; margin: 0 !important; }
                    .logo-text .subtitle { font-size: 9px !important; color: rgba(255,255,255,0.9) !important; margin: 0 !important; }
                    
                    /* SECTION STYLES */
                    .section { margin: 0 0 8px 0 !important; padding: 0 !important; page-break-inside: avoid !important; }
                    .section-header { background: #37474F !important; color: white !important; padding: 4px 8px !important; margin: 0 !important; }
                    .section-content { padding: 6px !important; background: white !important; }
                    
                    /* FORM FIELDS LAYOUT */
                    .field-group, .info-row { display: flex !important; margin: 0 0 4px 0 !important; align-items: flex-start !important; }
                    .field-label, .info-label { flex: 0 0 120px !important; font-weight: bold !important; padding: 2px 4px !important; font-size: 9px !important; }
                    .field-value, .info-value { flex: 1 !important; padding: 2px 4px !important; background: #f8f9fa !important; border: 1px solid #e0e0e0 !important; min-height: 16px !important; font-size: 9px !important; }
                    
                    /* ENVIRONMENTS SECTION - TWO COLUMNS */
                    .environments-two-columns, .scope-two-columns { display: flex !important; gap: 8px !important; margin: 0 !important; }
                    .environments-column, .scope-column { flex: 1 !important; width: 48% !important; }
                    .ambiente-item, .escopo-group { margin: 0 0 4px 0 !important; padding: 3px !important; background: #f8f9fa !important; border: 1px solid #e0e0e0 !important; }
                    .ambiente-header, .escopo-subtitle { font-size: 12px !important; font-weight: bold !important; margin: 0 0 2px 0 !important; }
                    .checkbox-item { font-size: 9px !important; margin: 0 0 2px 0 !important; padding: 1px !important; }
                    
                    /* OBSERVATIONS SECTION */
                    .observations-section { border: 2px solid #FF5722 !important; margin: 8px 0 !important; background: white !important; page-break-inside: avoid !important; }
                    .obs-item { background: #f8f9fa !important; border: 1px solid #e0e0e0 !important; border-left: 3px solid #FF5722 !important; padding: 4px !important; margin: 0 0 4px 0 !important; }
                    .obs-item strong { font-size: 12px !important; color: #FF5722 !important; font-weight: bold !important; }
                    .obs-item span { font-size: 9px !important; }
                    
                    /* HIDE ELEMENTS THAT SHOULD NOT PRINT */
                    .observacoes-coluna-lateral-fixa, .btn-group, .generate-report-btn, .form-actions, .mobile-actions, .floating-actions { display: none !important; }
                    
                    /* COMPACT LAYOUT - REMOVE EXCESS SPACING */
                    .form-section { margin: 0 !important; padding: 0 !important; }
                    .main-sections { margin: 0 !important; padding: 0 !important; }
                    
                    /* PRINT STYLES */
                    @media print {
                        #print-button-container { display: none !important; }
                        @page { size: A4 !important; margin: 1cm !important; }
                    }
                </style>
            `;
            
            // Inserir o botão e CSS logo após a tag <body>
            return html.replace('<body>', '<body>' + printButtonAndCSS);
        },        showMobileAlternatives(html, formData = {}) {
            const today = new Date();
            const dateStr = Utils.formatDate(today).replace(/\//g, '-');
            
            // Criar nome seguindo o padrão: CODIGO_PROJETO_RELATÓRIO_DATA
            const codigoProjeto = Utils.sanitizeString(formData.codigoProjeto || 'SEM-CODIGO');
            const nomeProjeto = Utils.sanitizeString(formData.nomeProjeto || 'SEM-NOME');
            const fileName = `${codigoProjeto}_${nomeProjeto}_RELATORIO_${dateStr}.html`;
            
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
        },        showDesktopAlternatives(html, formData = {}) {
            Logger.warning('💻 Mostrando alternativas desktop...');
            
            if (confirm('Não foi possível abrir a janela de impressão (bloqueador de pop-ups?).\n\nDeseja baixar o relatório como arquivo HTML?')) {
                const today = new Date();
                const dateStr = Utils.formatDate(today).replace(/\//g, '-');
                
                // Criar nome seguindo o padrão: CODIGO_PROJETO_RELATÓRIO_DATA
                const codigoProjeto = Utils.sanitizeString(formData.codigoProjeto || 'SEM-CODIGO');
                const nomeProjeto = Utils.sanitizeString(formData.nomeProjeto || 'SEM-NOME');
                const fileName = `${codigoProjeto}_${nomeProjeto}_RELATORIO_${dateStr}.html`;
                
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

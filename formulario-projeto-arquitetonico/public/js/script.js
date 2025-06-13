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
         */
        _createSection(title, iconClass, contentHtml) {
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
        },

        async generate() {
            if (this.isGenerating) {
                Logger.warning('Geração já em andamento');
                return;
            }

            try {
                this.isGenerating = true;
                this.showGeneratingState();

                const formData = this.collectFormData();
                const html = this.createPrintableHTML(formData);

                this.openPrintWindow(html);

                Logger.success('Relatório gerado com sucesso');

            } catch (error) {
                Logger.error(`Erro ao gerar relatório: ${error.message}`);
                this.showError('Erro ao gerar relatório. Tente novamente.');
            } finally {
                this.isGenerating = false;
                this.hideGeneratingState();
            }
        },

        collectFormData() {
            const form = DOMManager.get('formularioProjeto');
            if (!form) throw new Error('Formulário não encontrado');

            const formData = new FormData(form);
            const data = {};

            for (let [key, value] of formData.entries()) {
                if (key.endsWith('[]')) {
                    const cleanKey = key.replace('[]', '');
                    if (!data[cleanKey]) data[cleanKey] = [];
                    data[cleanKey].push(value);
                } else {
                    data[key] = value;
                }
            }

            data.prazoTotal = DOMManager.get('prazoTotal')?.value || '';
            data.dataGeracao = new Date();
            data.ambientesCount = AppState.demandCount;

            return data;
        },

        createPrintableHTML(formData) {
            const now = formData.dataGeracao;
            const reportId = Utils.generateId().toUpperCase();
            const fileName = `Projeto_${Utils.sanitizeString(formData.nomeProjeto || 'Sem_Nome')}_${Utils.formatDate(now).replace(/\//g, '-')}`;
            
            // REATORADO: As funções de geração de seção agora retornam apenas o conteúdo interno.
            // A função _createSection cuida do wrapper, evitando a repetição do HTML da seção.
            const clientSection = this.generateClientSection(formData);
            const projectSection = this.generateProjectSection(formData);
            const scopeSection = this.generateScopeSection(formData);
            const environmentsSection = this.generateEnvironmentsSection(formData);
            const timelineSection = this.generateTimelineSection(formData);
            const observationsSection = this.generateObservationsSection(formData);

            return `
                <!DOCTYPE html>
                <html lang="pt-BR">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>${fileName}</title>
                    <style>${this.getReportStyles()}</style>
                </head>
                <body>
                    <div class="header">
                        <h1>🏗️ SKBORGES</h1>
                        <div class="subtitle">Relatório de Projeto Arquitetônico</div>
                        <div class="meta">
                            <div>Data: ${now.toLocaleDateString('pt-BR')} às ${now.toLocaleTimeString('pt-BR')}</div>
                            <div>Arquivo: ${fileName}</div>
                            <div>ID: ${reportId}</div>
                        </div>
                    </div>
                    <div class="container">
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
                        </div>
                    </div>
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
        },

        generateClientSection(data) {
            return `
                <div class="field-group">
                    <div class="field"><div class="field-label">Nome Completo</div><div class="field-value">${data.nomeCliente || 'Não informado'}</div></div>
                    <div class="field"><div class="field-label">CNPJ/CPF</div><div class="field-value">${data.cnpjCpf || 'Não informado'}</div></div>
                    <div class="field"><div class="field-label">Telefone</div><div class="field-value">${data.telefone || 'Não informado'}</div></div>
                    <div class="field"><div class="field-label">E-mail</div><div class="field-value">${data.email || 'Não informado'}</div></div>
                    <div class="field"><div class="field-label">Endereço</div><div class="field-value">${data.endereco || 'Não informado'}</div></div>
                    <div class="field"><div class="field-label">Responsável pela Obra</div><div class="field-value">${data.responsavelObra || 'Não informado'}</div></div>
                </div>`;
        },

        generateProjectSection(data) {
            return `
                <div class="field-group">
                    <div class="field"><div class="field-label">Nome do Projeto</div><div class="field-value">${data.nomeProjeto || 'Não informado'}</div></div>
                    <div class="field"><div class="field-label">Tipo de Imóvel</div><div class="field-value">${data.tipoImovel || 'Não informado'}</div></div>
                    <div class="field"><div class="field-label">Tipo de Projeto</div><div class="field-value">${data.tipoProjeto || 'Não informado'}</div></div>
                    <div class="field"><div class="field-label">Metragem do Lote</div><div class="field-value">${data.metragemLote ? data.metragemLote + ' m²' : 'Não informado'}</div></div>
                    <div class="field"><div class="field-label">Área Construída</div><div class="field-value">${data.areaConstruida ? data.areaConstruida + ' m²' : 'Não informado'}</div></div>
                </div>`;
        },
        
        generateScopeSection(data) {
            const escopo = ['layout', 'modelagem3d', 'detalhamento', 'arCondicionado', 'eletrica', 'dadosVoz', 'hidraulica', 'cftv', 'alarme', 'incendio']
                .filter(key => data[key])
                .map(key => {
                    // Mapeia a chave para um texto mais amigável
                    const map = { layout: 'Layout', modelagem3d: 'Modelagem 3D', detalhamento: 'Detalhamento', arCondicionado: 'Ar Condicionado', eletrica: 'Elétrica', dadosVoz: 'Dados e Voz', hidraulica: 'Hidráulica', cftv: 'CFTV', alarme: 'Alarme', incendio: 'Incêndio' };
                    return map[key] || key;
                });
                
            if (escopo.length === 0) return '<div class="field-value empty">Nenhum item selecionado</div>';
            
            return `<div class="list-items">${escopo.map(item => `<div class="list-item">${item}</div>`).join('')}</div>`;
        },

        generateEnvironmentsSection(data) {
            const ambientes = data.ambiente || [];
            const necessidades = data.necessidades || [];
            if (ambientes.length === 0) return '<div class="field-value empty">Nenhum ambiente cadastrado</div>';
            
            return ambientes.map((ambiente, index) => `
                <div class="ambiente">
                    <div class="ambiente-title">${ambiente}</div>
                    <div class="ambiente-desc">${necessidades[index] || 'Sem necessidades específicas'}</div>
                </div>
            `).join('');
        },

        generateTimelineSection(data) {
            const prazos = [
                { label: 'Levantamento', value: data.prazoLevantamento }, { label: 'Layout', value: data.prazoLayout },
                { label: 'Modelagem 3D', value: data.prazoModelagem3d }, { label: 'Projeto Executivo', value: data.prazoProjetoExecutivo },
                { label: 'Complementares', value: data.prazoComplementares }
            ].filter(prazo => prazo.value);

            if (prazos.length === 0) return '<div class="field-value empty">Nenhum prazo definido</div>';

            let html = `<div class="prazos-grid">
                ${prazos.map(prazo => `<div class="prazo-item"><div class="prazo-value">${prazo.value}</div><div class="prazo-label">${prazo.label}</div></div>`).join('')}`;
            
            if (data.prazoTotal) {
                html += `<div class="prazo-item prazo-total"><div class="prazo-value">${data.prazoTotal}</div><div class="prazo-label">TOTAL</div></div>`;
            }

            html += `</div>`;
            return html;
        },

        generateObservationsSection(data) {
            const observacoes = [
                { title: 'Cliente', content: data.observacaoCliente }, { title: 'Projeto', content: data.observacaoProjeto },
                { title: 'Escopo', content: data.observacaoEscopo }, { title: 'Prazos', content: data.observacaoPrazos },
                { title: 'Ambientes', content: data.observacaoDemandas }, { title: 'Observações Finais', content: data.observacaoFinal }
            ].filter(obs => obs.content);
            
            if (observacoes.length === 0) return '';
            
            return observacoes.map(obs => `
                <div class="observacao">
                    <div class="observacao-title">${obs.title}</div>
                    <div class="observacao-text">${obs.content}</div>
                </div>
            `).join('');
        },

        // ... o resto do ReportGenerator (getReportStyles, openPrintWindow, etc.) permanece o mesmo ...
        getReportStyles() {
            return `
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; background: white; }
                .container { max-width: 800px; margin: 0 auto; padding: 0 2rem; }
                .header { background: linear-gradient(135deg, #FF5722, #FF7043); color: white; padding: 2rem; text-align: center; margin-bottom: 2rem; }
                .header h1 { font-size: 2.5rem; margin-bottom: 0.5rem; font-weight: 700; }
                .header .subtitle { font-size: 1.2rem; opacity: 0.9; margin-bottom: 1rem; }
                .header .meta { font-size: 0.9rem; opacity: 0.8; }
                .section { margin-bottom: 2rem; border: 1px solid #e9ecef; border-radius: 8px; overflow: hidden; }
                .section-header { background: #37474F; color: white; padding: 1rem 1.5rem; font-size: 1.1rem; font-weight: 600; display: flex; align-items: center; gap: 0.5rem; }
                .section-content { padding: 1.5rem; background: white; }
                .field-group { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1rem; margin-bottom: 1.5rem; }
                .field { margin-bottom: 0.75rem; }
                .field-label { font-weight: 600; color: #495057; margin-bottom: 0.25rem; font-size: 0.9rem; }
                .field-value { color: #212529; font-size: 0.95rem; padding: 0.5rem 0; border-bottom: 1px solid #f0f0f0; }
                .field-value.empty { color: #6c757d; font-style: italic; }
                .list-items { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 0.5rem; margin: 1rem 0; }
                .list-item { padding: 0.5rem 0.75rem; background: #f8f9fa; border-radius: 4px; border-left: 3px solid #FF5722; font-size: 0.9rem; }
                .ambiente { background: #f8f9fa; border-radius: 6px; padding: 1rem; margin-bottom: 1rem; border-left: 4px solid #FF5722; }
                .ambiente-title { font-weight: 600; color: #FF5722; margin-bottom: 0.5rem; }
                .ambiente-desc { color: #495057; font-size: 0.9rem; line-height: 1.5; }
                .prazos-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem; }
                .prazo-item { text-align: center; padding: 1rem; background: #f8f9fa; border-radius: 6px; }
                .prazo-value { font-size: 1.5rem; font-weight: 700; color: #FF5722; }
                .prazo-label { font-size: 0.8rem; color: #6c757d; margin-top: 0.25rem; }
                .prazo-total { background: #FF5722; color: white; grid-column: span 2; }
                .prazo-total .prazo-value { color: white; }
                .prazo-total .prazo-label { color: rgba(255, 255, 255, 0.8); }
                .observacao { margin-bottom: 1rem; padding: 1rem; background: #f8f9fa; border-radius: 6px; }
                .observacao-title { font-weight: 600; color: #495057; margin-bottom: 0.5rem; font-size: 0.9rem; }
                .observacao-text { color: #212529; font-size: 0.9rem; line-height: 1.5; }
                .footer { margin-top: 3rem; padding: 1.5rem; background: #f8f9fa; border-radius: 8px; text-align: center; color: #6c757d; font-size: 0.8rem; }
                @media print { .no-print { display: none !important; } body { font-size: 12px; } .container { padding: 0; } }
            `;
        },

        openPrintWindow(html) {
            const printWindow = window.open('', '_blank');
            if (!printWindow) {
                throw new Error('Não foi possível abrir a janela de impressão. Verifique se o bloqueador de pop-ups está desabilitado.');
            }

            printWindow.document.write(html);
            printWindow.document.close();

            printWindow.onload = () => {
                printWindow.focus();
            };
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
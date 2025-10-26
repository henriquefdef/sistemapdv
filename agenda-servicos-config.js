// agenda-servicos-config.js - Sistema de Configurações da Agenda
// ================================================================

class AgendaConfig {
    constructor(agendaInstance) {
        this.agenda = agendaInstance;
        this.settings = this.loadSettings();
        this.elements = {};
        
        this.init();
    }

    init() {
        this.cacheElements();
        this.setupEventListeners();
        this.createConfigModal();
        this.addConfigStyles();
        console.log('Sistema de configurações da agenda inicializado');
    }

    // ===== CONFIGURAÇÕES PADRÃO =====
    getDefaultSettings() {
        return {
            startTime: '07:00',
            endTime: '18:00',
            slotInterval: 30,
            workDays: [0, 1, 2, 3, 4, 5, 6], // Todos os dias da semana
            notifications: true,
            autoRefresh: true,
            showWeekends: false,
            defaultDuration: 60,
            theme: 'light'
        };
    }

    loadSettings() {
        const defaultSettings = this.getDefaultSettings();
        const saved = localStorage.getItem('agenda-settings');
        
        try {
            const parsed = saved ? JSON.parse(saved) : {};
            return { ...defaultSettings, ...parsed };
        } catch (error) {
            console.warn('Erro ao carregar configurações, usando padrões:', error);
            return defaultSettings;
        }
    }

    saveSettings() {
        try {
            localStorage.setItem('agenda-settings', JSON.stringify(this.settings));
            console.log('Configurações salvas:', this.settings);
        } catch (error) {
            console.error('Erro ao salvar configurações:', error);
        }
    }

    // ===== CACHE DE ELEMENTOS =====
    cacheElements() {
        this.elements = {
            settingsBtn: document.getElementById('settings-btn')
        };
    }

    setupEventListeners() {
        if (this.elements.settingsBtn) {
            this.elements.settingsBtn.addEventListener('click', () => this.openConfigModal());
        }
    }

    // ===== ESTILOS CSS =====
    addConfigStyles() {
        if (document.getElementById('config-styles')) return;
        
        const styles = document.createElement('style');
        styles.id = 'config-styles';
        styles.textContent = `
            /* Base de modal genérica para a Agenda */
            .modal-overlay {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(44, 62, 80, 0.6);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 1002;
            }

            .modal-content {
                background: #ffffff;
                border-radius: 12px;
                box-shadow: 0 20px 40px rgba(0, 0, 0, 0.25);
                width: 90%;
                max-height: 85vh;
                overflow: hidden;
                animation: fadeIn 0.25s ease;
            }

            .modal-header {
                padding: 18px 22px;
                border-bottom: 1px solid #e5e7eb;
                display: flex;
                justify-content: space-between;
                align-items: center;
                background: #f8fafc;
            }

            .modal-body {
                padding: 22px;
                max-height: calc(85vh - 140px);
                overflow-y: auto;
                background: #ffffff;
            }

            .modal-footer {
                padding: 16px 22px;
                border-top: 1px solid #e5e7eb;
                background: #f8fafc;
                display: flex;
                gap: 10px;
                justify-content: flex-end;
            }

            .close-btn {
                background: none;
                border: none;
                font-size: 20px;
                color: #6b7280;
                cursor: pointer;
                width: 32px;
                height: 32px;
                border-radius: 6px;
            }

            .close-btn:hover { background: #eef2f7; color: #111827; }
            @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

            /* Ícone da engrenagem maior */
            #settings-btn {
                width: 44px !important;
                height: 44px !important;
                font-size: 20px !important;
            }
            
            /* Modal de configurações */
            .config-modal-content {
                max-width: 700px;
                width: 95%;
            }
            
            .config-modal-body {
                max-height: 70vh;
                padding: 25px;
            }
            
            /* Seções de configuração */
            .config-section {
                margin-bottom: 30px;
                padding: 20px;
                background: #f8fafc;
                border-radius: 8px;
                border: 1px solid #e2e8f0;
            }
            
            .config-section-title {
                display: flex;
                align-items: center;
                gap: 12px;
                margin-bottom: 20px;
                font-size: 16px;
                font-weight: 600;
                color: #1e293b;
                border-bottom: 2px solid #FF8A00;
                padding-bottom: 8px;
            }
            
            .config-section-title i {
                color: #FF8A00;
                font-size: 18px;
            }
            
            /* Campos de configuração */
            .config-row {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 20px;
                margin-bottom: 15px;
            }
            
            .config-field {
                display: flex;
                flex-direction: column;
                gap: 8px;
            }
            
            .config-label {
                font-size: 14px;
                font-weight: 500;
                color: #374151;
            }
            
            .config-input {
                padding: 10px;
                border: 1px solid #d1d5db;
                border-radius: 6px;
                font-size: 14px;
                transition: all 0.2s ease;
                background: white;
            }
            
            .config-input:focus {
                outline: none;
                border-color: #FF8A00;
                box-shadow: 0 0 0 3px rgba(255, 138, 0, 0.1);
            }
            
            /* Dias da semana */
            .config-days {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
                gap: 12px;
            }
            
            .config-day-item {
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 12px;
                background: white;
                border: 2px solid #e5e7eb;
                border-radius: 8px;
                cursor: pointer;
                transition: all 0.2s ease;
                user-select: none;
            }
            
            .config-day-item:hover {
                border-color: #FF8A00;
                background: rgba(255, 138, 0, 0.05);
            }
            
            .config-day-item input[type="checkbox"] {
                width: 16px;
                height: 16px;
                accent-color: #FF8A00;
            }
            
            .config-day-item input[type="checkbox"]:checked + .config-day-label {
                color: #FF8A00;
                font-weight: 600;
            }
            
            .config-day-label {
                font-size: 14px;
                font-weight: 500;
                color: #374151;
                transition: all 0.2s ease;
            }
            
            /* Switches */
            .config-switches {
                display: flex;
                flex-direction: column;
                gap: 16px;
            }
            
            .config-switch {
                display: flex;
                align-items: center;
                gap: 12px;
                cursor: pointer;
                user-select: none;
                padding: 8px 0;
            }
            
            .config-switch input[type="checkbox"] {
                display: none;
            }
            
            .config-switch-slider {
                position: relative;
                width: 44px;
                height: 24px;
                background: #cbd5e0;
                border-radius: 12px;
                transition: all 0.3s ease;
                flex-shrink: 0;
            }
            
            .config-switch-slider:before {
                content: '';
                position: absolute;
                width: 20px;
                height: 20px;
                border-radius: 50%;
                background: white;
                top: 2px;
                left: 2px;
                transition: all 0.3s ease;
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
            }
            
            .config-switch input[type="checkbox"]:checked + .config-switch-slider {
                background: #FF8A00;
            }
            
            .config-switch input[type="checkbox"]:checked + .config-switch-slider:before {
                transform: translateX(20px);
            }
            
            .config-switch-label {
                font-size: 14px;
                font-weight: 500;
                color: #374151;
            }
            
            /* Responsividade */
            @media (max-width: 768px) {
                .config-row {
                    grid-template-columns: 1fr;
                    gap: 15px;
                }
                
                .config-days {
                    grid-template-columns: 1fr 1fr;
                }
                
                .config-modal-body {
                    padding: 20px;
                }
            }
            
            /* Erros */
            .config-error {
                animation: slideInDown 0.3s ease;
            }
            
            @keyframes slideInDown {
                from {
                    opacity: 0;
                    transform: translateY(-10px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }
        `;
        
        document.head.appendChild(styles);
    }

    // ===== CRIAÇÃO DO MODAL DE CONFIGURAÇÕES =====
    createConfigModal() {
        if (document.getElementById('config-modal')) return;

        const modalHTML = `
            <div class="modal-overlay hidden" id="config-modal">
                <div class="modal-content config-modal-content">
                    <div class="modal-header">
                        <h3 class="modal-title">Configurações da Agenda</h3>
                        <button class="close-btn" id="close-config-modal">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    
                    <div class="modal-body config-modal-body">
                        <form id="config-form">
                            <!-- Configurações de Horário -->
                            <div class="config-section">
                                <h4 class="config-section-title">
                                    <i class="fas fa-clock"></i>
                                    Horários de Funcionamento
                                </h4>
                                
                                <div class="config-row">
                                    <div class="config-field">
                                        <label class="config-label">Horário de Início</label>
                                        <select class="config-input" id="config-start-time">
                                            ${this.generateTimeOptions()}
                                        </select>
                                    </div>
                                    
                                    <div class="config-field">
                                        <label class="config-label">Horário de Fim</label>
                                        <select class="config-input" id="config-end-time">
                                            ${this.generateTimeOptions()}
                                        </select>
                                    </div>
                                </div>
                            </div>


                        </form>
                    </div>
                    
                    <div class="modal-footer">
                        <button class="btn btn-secondary" id="config-cancel">Cancelar</button>
                        <button class="btn btn-secondary" id="config-reset">Restaurar Padrão</button>
                        <button class="btn btn-primary" id="config-save">
                            <i class="fas fa-save"></i>
                            Salvar Configurações
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);
        this.cacheModalElements();
        this.setupModalEventListeners();
    }

    generateTimeOptions() {
        let options = '';
        
        // Gerar opções de 04:00 às 23:30
        for (let hour = 0; hour <= 23; hour++) {
            for (let minute = 0; minute < 60; minute += 30) {
                const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
                options += `<option value="${timeString}">${timeString}</option>`;
            }
        }
        
        return options;
    }

    cacheModalElements() {
        this.modalElements = {
            modal: document.getElementById('config-modal'),
            closeBtn: document.getElementById('close-config-modal'),
            cancelBtn: document.getElementById('config-cancel'),
            resetBtn: document.getElementById('config-reset'),
            saveBtn: document.getElementById('config-save'),
            
            startTimeSelect: document.getElementById('config-start-time'),
            endTimeSelect: document.getElementById('config-end-time')
        };
    }

    setupModalEventListeners() {
        this.modalElements.closeBtn.addEventListener('click', () => this.closeConfigModal());
        this.modalElements.cancelBtn.addEventListener('click', () => this.closeConfigModal());
        this.modalElements.saveBtn.addEventListener('click', () => this.saveConfiguration());
        this.modalElements.resetBtn.addEventListener('click', () => this.resetToDefaults());
        
        this.modalElements.startTimeSelect.addEventListener('change', () => this.validateTimeRange());
        this.modalElements.endTimeSelect.addEventListener('change', () => this.validateTimeRange());
        
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !this.modalElements.modal.classList.contains('hidden')) {
                this.closeConfigModal();
            }
        });
    }

    // ===== ABERTURA E FECHAMENTO DO MODAL =====
    openConfigModal() {
        this.populateConfigForm();
        this.modalElements.modal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
        
        setTimeout(() => {
            this.modalElements.startTimeSelect.focus();
        }, 100);
    }

    closeConfigModal() {
        this.modalElements.modal.classList.add('hidden');
        document.body.style.overflow = '';
    }

    // ===== POPULAÇÃO DO FORMULÁRIO =====
    populateConfigForm() {
        this.modalElements.startTimeSelect.value = this.settings.startTime;
        this.modalElements.endTimeSelect.value = this.settings.endTime;
    }

    // ===== VALIDAÇÃO =====
    validateTimeRange() {
        const startTime = this.modalElements.startTimeSelect.value;
        const endTime = this.modalElements.endTimeSelect.value;
        
        if (!startTime || !endTime) return true;
        
        const startMinutes = this.timeToMinutes(startTime);
        const endMinutes = this.timeToMinutes(endTime);
        
        if (startMinutes >= endMinutes) {
            this.showConfigError('O horário de fim deve ser posterior ao horário de início');
            return false;
        }
        
        const diffMinutes = endMinutes - startMinutes;
        if (diffMinutes < 60) {
            this.showConfigError('O período de funcionamento deve ter pelo menos 1 hora');
            return false;
        }
        
        this.clearConfigError();
        return true;
    }

    timeToMinutes(timeString) {
        const [hours, minutes] = timeString.split(':').map(n => parseInt(n));
        return hours * 60 + minutes;
    }

    // ===== SALVAMENTO =====
    saveConfiguration() {
        if (!this.validateTimeRange()) return;
        
        const newSettings = {
            startTime: this.modalElements.startTimeSelect.value,
            endTime: this.modalElements.endTimeSelect.value,
            slotInterval: 30, // Fixo em 30 minutos
            workDays: [0, 1, 2, 3, 4, 5, 6], // Todos os dias da semana
            notifications: true, // Valores fixos para campos removidos
            autoRefresh: true,
            showWeekends: false,
            defaultDuration: 60
        };
        
        const timeChanged = newSettings.startTime !== this.settings.startTime || 
                           newSettings.endTime !== this.settings.endTime;
        
        this.settings = { ...this.settings, ...newSettings };
        this.saveSettings();
        
        if (timeChanged) {
            this.applyTimeSettings();
        }
        
        this.showConfigNotification('Configurações salvas com sucesso!', 'success');
        this.closeConfigModal();
    }



    applyTimeSettings() {
        if (this.agenda) {
            this.agenda.settings = this.settings;
            this.agenda.generateTimeline();
            this.agenda.loadAppointmentsForCurrentDate();
        }
    }

    // ===== RESTAURAR PADRÕES =====
    resetToDefaults() {
        const confirmMsg = 'Tem certeza que deseja restaurar todas as configurações para o padrão?\n\nEsta ação não pode ser desfeita.';
        
        if (!confirm(confirmMsg)) return;
        
        this.settings = this.getDefaultSettings();
        this.saveSettings();
        this.populateConfigForm();
        this.applyTimeSettings();
        
        this.showConfigNotification('Configurações restauradas para o padrão', 'info');
    }

    // ===== NOTIFICAÇÕES E ERROS =====
    showConfigError(message) {
        this.clearConfigError();
        
        const errorDiv = document.createElement('div');
        errorDiv.className = 'config-error';
        errorDiv.style.cssText = `
            background: #fee;
            color: #c53030;
            padding: 12px;
            border-radius: 6px;
            margin-bottom: 15px;
            font-size: 14px;
            border: 1px solid #feb2b2;
            display: flex;
            align-items: center;
            gap: 8px;
        `;
        errorDiv.innerHTML = `
            <i class="fas fa-exclamation-triangle"></i>
            <span>${message}</span>
        `;
        
        const modalBody = this.modalElements.modal.querySelector('.config-modal-body');
        modalBody.insertBefore(errorDiv, modalBody.firstChild);
        
        setTimeout(() => errorDiv.remove(), 5000);
    }

    clearConfigError() {
        const errorDiv = this.modalElements.modal?.querySelector('.config-error');
        if (errorDiv) errorDiv.remove();
    }

    showConfigNotification(message, type = 'info') {
        if (this.agenda && this.agenda.showNotification) {
            this.agenda.showNotification(message, type);
        }
    }

    // ===== MÉTODO PÚBLICO PARA INTEGRAÇÃO =====
    updateAgendaSettings(agendaInstance) {
        if (agendaInstance) {
            this.agenda = agendaInstance;
            this.agenda.settings = this.settings;
        }
    }
}

// ===== INICIALIZAÇÃO =====
let agendaConfig;

document.addEventListener('DOMContentLoaded', () => {
    const initializeConfig = () => {
        if (window.agendaServicos) {
            try {
                agendaConfig = new AgendaConfig(window.agendaServicos);
                window.agendaConfig = agendaConfig;
                
                // Atualizar configurações da agenda principal
                window.agendaServicos.settings = agendaConfig.settings;
                
                console.log('✅ Sistema de configurações carregado com sucesso');
                return true;
            } catch (error) {
                console.error('❌ Erro ao inicializar configurações:', error);
                return false;
            }
        } else {
            console.log('⏳ Aguardando agenda principal...');
            setTimeout(initializeConfig, 200);
        }
    };
    
    // Tentar inicializar após um delay
    setTimeout(initializeConfig, 1000);
});

// Disponibilizar globalmente
window.AgendaConfig = AgendaConfig;

// Debug para verificar se o arquivo foi carregado
console.log('📄 arquivo agenda-servicos-config.js carregado');
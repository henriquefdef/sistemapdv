// agenda-servicos-modal.js - Modal Principal de Agendamento CORRIGIDO
// ====================================================================

class AgendaModals {
    constructor(agendaInstance) {
        this.agenda = agendaInstance;
        this.currentAppointment = null;
        this.debounceTimer = null;
        this.elements = {};
        this.selectedTimes = [];
        this.isTimeSpecific = false;
        
        this.init();
    }

    init() {
        this.cacheElements();
        this.setupEventListeners();
    }

    cacheElements() {
        this.elements = {
            overlay: document.getElementById('appointment-panel-overlay'),
            modal: document.getElementById('appointment-panel'),
            modalTitle: document.getElementById('panel-title'),
            closeBtn: document.getElementById('close-panel-btn'),
            cancelBtn: document.getElementById('cancel-appointment'),
            saveBtn: document.getElementById('save-appointment'),
            form: document.getElementById('appointment-form'),
            
            // Inputs
            serviceSelect: document.getElementById('service-select'),
            clientSelect: document.getElementById('client-select'),
            professionalSelect: document.getElementById('professional-select'),
            priceInput: document.getElementById('price-input'),
            dateInput: document.getElementById('date-input'),
            notesInput: document.getElementById('notes-input'),
            
            // Sistema de horários
            timeSelector: document.getElementById('time-selector'),
            selectedTimesContainer: document.getElementById('selected-times'),
            startTimeSelect: document.getElementById('start-time-select'),
            endTimeSelect: document.getElementById('end-time-select'),
            selectRangeBtn: document.getElementById('select-range-btn')
        };
        
        this.selectedTimes = [];
    }

    setupEventListeners() {
        // Eventos do modal
        this.elements.closeBtn.addEventListener('click', () => this.closeModal());
        this.elements.cancelBtn.addEventListener('click', () => this.closeModal());
        this.elements.saveBtn.addEventListener('click', () => this.saveAppointment());
        
        // Auto-completar preço quando serviço é selecionado
        this.elements.serviceSelect.addEventListener('change', () => this.autoFillServiceData());
        
        // Validação em tempo real
        this.elements.dateInput.addEventListener('change', () => {
            this.validateDateInput();
            this.generateTimeSlots();
        });
        
        // Regenerar horários quando profissional mudar
        this.elements.professionalSelect.addEventListener('change', () => {
            this.generateTimeSlots();
        });
        
        // Seletor de intervalo de horários
        this.elements.selectRangeBtn.addEventListener('click', () => this.selectTimeRange());
        
        // Auto-executar quando selecionar fim em horário específico
        this.elements.endTimeSelect.addEventListener('change', () => {
            if (this.isTimeSpecific && this.elements.startTimeSelect.value && this.elements.endTimeSelect.value) {
                // Limpar timeout anterior se existir
                if (this.autoSelectionTimeout) {
                    clearTimeout(this.autoSelectionTimeout);
                }
                
                // Aguardar para garantir que os slots foram gerados
                this.autoSelectionTimeout = setTimeout(() => {
                    this.selectTimeRangeAuto();
                }, 400);
            }
        });
        
        // ESC para fechar painel
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.elements.modal.classList.contains('active')) {
                this.closeModal();
            }
        });
        
        // Fechar ao clicar no overlay
        this.elements.overlay.addEventListener('click', (e) => {
            if (e.target === this.elements.overlay) {
                this.closeModal();
            }
        });
    }

    // ===== ABERTURA E FECHAMENTO DO MODAL =====
    openAppointmentModal(time = '', appointment = null) {
        this.currentAppointment = appointment;
        this.isTimeSpecific = Boolean(time && !appointment);
        this.clearError();
        
        if (appointment) {
            this.elements.modalTitle.textContent = 'Editar Agendamento';
            this.elements.saveBtn.innerHTML = 'Salvar Alterações';
            this.populateForm(appointment);
        } else {
            this.elements.modalTitle.textContent = 'Novo Agendamento';
            this.elements.saveBtn.innerHTML = 'Agendar Serviço';
            this.resetForm();
            
            if (time) {
                this.configureForSpecificTime(time);
            }
            // Usar formatação local para evitar problemas de fuso horário
            const year = this.agenda.currentDate.getFullYear();
            const month = String(this.agenda.currentDate.getMonth() + 1).padStart(2, '0');
            const day = String(this.agenda.currentDate.getDate()).padStart(2, '0');
            this.elements.dateInput.value = `${year}-${month}-${day}`;
        }
        
        this.populateProfessionalSelect();
        this.populateClientSelect();
        this.populateServiceSelect();
        
        this.generateTimeSlots();
        this.showModal();
    }

    configureForSpecificTime(startTime) {
        // Armazenar o horário específico para usar após popular os selects
        this.specificStartTime = startTime;
        
        // Calcular horário de fim sugerido baseado nas configurações
        const [hours, minutes] = startTime.split(':').map(n => parseInt(n));
        const startTotalMinutes = hours * 60 + minutes;
        const interval = this.agenda.settings.slotInterval;
        const endTotalMinutes = startTotalMinutes + (interval * 2); // 2 slots padrão
        
        const endHours = Math.floor(endTotalMinutes / 60);
        const endMins = endTotalMinutes % 60;
        const suggestedEndTime = `${endHours.toString().padStart(2, '0')}:${endMins.toString().padStart(2, '0')}`;
        
        // Verificar se está dentro do funcionamento
        const configEndHour = parseInt(this.agenda.settings.endTime.split(':')[0]);
        const configEndMinute = parseInt(this.agenda.settings.endTime.split(':')[1]);
        const configEndTotalMinutes = configEndHour * 60 + configEndMinute;
        
        this.suggestedEndTime = endTotalMinutes <= configEndTotalMinutes ? suggestedEndTime : null;
        
        // Aguardar a população dos selects para configurar os valores
        setTimeout(() => {
            this.applySpecificTimeConfiguration();
        }, 100);
    }
    
    applySpecificTimeConfiguration() {
        if (!this.specificStartTime) return;
        
        // Validar se o horário de início está disponível nas opções
        const startOption = Array.from(this.elements.startTimeSelect.options)
            .find(option => option.value === this.specificStartTime);
        
        if (!startOption) {
            this.showError(`Horário ${this.specificStartTime} não está disponível nos horários de funcionamento`);
            return;
        }
        
        // Definir e bloquear o campo de início
        this.elements.startTimeSelect.value = this.specificStartTime;
        this.elements.startTimeSelect.disabled = true;
        this.elements.startTimeSelect.style.cssText = 'background: #f8f9fa; cursor: not-allowed; opacity: 0.7;';
        
        // Validar e definir horário de fim sugerido se disponível
        if (this.suggestedEndTime) {
            const endOption = Array.from(this.elements.endTimeSelect.options)
                .find(option => option.value === this.suggestedEndTime);
            
            if (endOption) {
                this.elements.endTimeSelect.value = this.suggestedEndTime;
            } else {
                // Se o horário sugerido não está disponível, limpar
                this.suggestedEndTime = null;
                console.warn(`Horário de fim sugerido ${this.suggestedEndTime} não está disponível`);
            }
        }
        
        // Adicionar aviso visual
        const rangeContainer = this.elements.startTimeSelect.closest('.range-inputs');
        if (rangeContainer && !rangeContainer.querySelector('.time-locked-notice')) {
            const notice = document.createElement('div');
            notice.className = 'time-locked-notice';
            notice.style.cssText = `
                grid-column: 1 / -1;
                background: #e3f2fd;
                color: #1565c0;
                padding: 8px 12px;
                border-radius: 6px;
                font-size: 12px;
                margin-top: 10px;
                border-left: 3px solid #2196f3;
                display: flex;
                align-items: center;
                gap: 6px;
            `;
            notice.innerHTML = `<span>ℹ️</span> Horário de início fixo: ${this.specificStartTime}. Ajuste o horário de fim para definir a duração.`;
            rangeContainer.appendChild(notice);
        }
        
        // Focar no seletor de fim
        this.elements.endTimeSelect.focus();
        
        // Se já temos horário de fim válido, executar seleção automática
        if (this.suggestedEndTime && this.elements.endTimeSelect.value === this.suggestedEndTime) {
            setTimeout(() => {
                this.selectTimeRangeAuto();
            }, 300);
        }
    }

    showModal() {
        this.elements.overlay.classList.add('active');
        this.elements.modal.classList.add('active');
        document.body.style.overflow = 'hidden';
        
        // Focar no primeiro input
        setTimeout(() => {
            this.elements.serviceSelect.focus();
        }, 300);
    }

    closeModal() {
        this.elements.overlay.classList.remove('active');
        this.elements.modal.classList.remove('active');
        document.body.style.overflow = '';
        
        // Aguardar a animação antes de limpar
        setTimeout(() => {
            this.clearError();
            this.currentAppointment = null;
            this.isTimeSpecific = false;
            this.clearSelectedTimes();
            this.resetTimeSelectors();
        }, 300);
    }

    resetTimeSelectors() {
        // Limpar timeouts
        if (this.autoSelectionTimeout) {
            clearTimeout(this.autoSelectionTimeout);
            this.autoSelectionTimeout = null;
        }
        
        // Limpar variáveis específicas
        this.specificStartTime = null;
        this.suggestedEndTime = null;
        
        // Reabilitar e limpar campos
        if (this.elements.startTimeSelect) {
            this.elements.startTimeSelect.disabled = false;
            this.elements.startTimeSelect.style.cssText = '';
            this.elements.startTimeSelect.value = '';
        }
        
        if (this.elements.endTimeSelect) {
            this.elements.endTimeSelect.value = '';
        }
        
        // Remover aviso
        const notice = document.querySelector('.time-locked-notice');
        if (notice) notice.remove();
    }

    // ===== SISTEMA DE SELEÇÃO DE HORÁRIOS - CORRIGIDO =====
    async generateTimeSlots(callback = null) {
        if (!this.elements.timeSelector) return;
        
        const selectedDate = this.elements.dateInput.value;
        const selectedProfessionalId = this.elements.professionalSelect.value;
        
        console.log('Gerando slots para:', { selectedDate, selectedProfessionalId });
        
        this.populateTimeSelectors();
        this.elements.timeSelector.innerHTML = '';
        
        // Aplicar configuração específica após popular os selects
        if (this.isTimeSpecific && this.specificStartTime) {
            setTimeout(() => {
                this.applySpecificTimeConfiguration();
            }, 50);
        }
        
        if (!selectedDate || !selectedProfessionalId) {
            console.log('Data ou profissional não selecionados');
            return;
        }
        
        // Encontrar o nome do profissional pelo ID
        let professionalName = null;
        if (window.agendaServicos && window.agendaServicos.professionals) {
            const prof = window.agendaServicos.professionals.find(p => p.id === selectedProfessionalId);
            professionalName = prof ? prof.name : null;
        }
        
        if (!professionalName) {
            console.warn('Nome do profissional não encontrado para ID:', selectedProfessionalId);
            return;
        }
        
        // Usar configurações de funcionamento
        const startHour = parseInt(this.agenda.settings.startTime.split(':')[0]);
        const startMinute = parseInt(this.agenda.settings.startTime.split(':')[1]);
        const endHour = parseInt(this.agenda.settings.endTime.split(':')[0]);
        const endMinute = parseInt(this.agenda.settings.endTime.split(':')[1]);
        const interval = this.agenda.settings.slotInterval;
        
        const startTotalMinutes = startHour * 60 + startMinute;
        const endTotalMinutes = endHour * 60 + endMinute;
        
        // Gerar slots baseados nas configurações
        for (let totalMinutes = startTotalMinutes; totalMinutes < endTotalMinutes; totalMinutes += interval) {
            const hour = Math.floor(totalMinutes / 60);
            const minute = totalMinutes % 60;
            const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
            
            // Verificar se o horário está ocupado - USANDO NOME DO PROFISSIONAL
            const isOccupied = await this.isTimeSlotOccupied(selectedDate, timeString, professionalName);
            
            const timeBtn = document.createElement('div');
            timeBtn.className = `time-slot-btn ${isOccupied ? 'disabled' : ''}`;
            timeBtn.textContent = timeString;
            timeBtn.dataset.time = timeString;
            
            if (!isOccupied) {
                timeBtn.addEventListener('click', () => this.toggleTimeSlot(timeString));
            }
            
            this.elements.timeSelector.appendChild(timeBtn);
        }
        
        // Atualizar botões selecionados e display após gerar todos os slots
        this.updateTimeSlotButtons();
        this.updateSelectedTimesDisplay();
        
        // Executar callback se fornecido
        if (callback && typeof callback === 'function') {
            setTimeout(callback, 100);
        }
    }

    populateTimeSelectors() {
        const timeOptions = [];
        
        // Usar configurações de funcionamento
        const startHour = parseInt(this.agenda.settings.startTime.split(':')[0]);
        const startMinute = parseInt(this.agenda.settings.startTime.split(':')[1]);
        const endHour = parseInt(this.agenda.settings.endTime.split(':')[0]);
        const endMinute = parseInt(this.agenda.settings.endTime.split(':')[1]);
        const interval = this.agenda.settings.slotInterval;
        
        const startTotalMinutes = startHour * 60 + startMinute;
        const endTotalMinutes = endHour * 60 + endMinute;
        
        // Gerar opções baseadas nas configurações
        for (let totalMinutes = startTotalMinutes; totalMinutes <= endTotalMinutes; totalMinutes += interval) {
            const hour = Math.floor(totalMinutes / 60);
            const minute = totalMinutes % 60;
            const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
            timeOptions.push(timeString);
        }
        
        // Popular selects
        this.elements.startTimeSelect.innerHTML = '<option value="">Início</option>';
        this.elements.endTimeSelect.innerHTML = '<option value="">Fim</option>';
        
        timeOptions.forEach(time => {
            const startOption = document.createElement('option');
            startOption.value = time;
            startOption.textContent = time;
            this.elements.startTimeSelect.appendChild(startOption);
            
            const endOption = document.createElement('option');
            endOption.value = time;
            endOption.textContent = time;
            this.elements.endTimeSelect.appendChild(endOption);
        });
    }

    // Função automática para horário específico
    async selectTimeRangeAuto() {
        const startTime = this.elements.startTimeSelect.value;
        const endTime = this.elements.endTimeSelect.value;
        
        if (!startTime || !endTime) {
            console.warn('Horários de início ou fim não definidos para seleção automática');
            return;
        }
        
        const startMinutes = this.timeToMinutes(startTime);
        const endMinutes = this.timeToMinutes(endTime);
        
        if (startMinutes >= endMinutes) {
            this.showError('O horário de fim deve ser posterior ao horário de início');
            return;
        }
        
        // Verificar se a data está selecionada
        const selectedDate = this.elements.dateInput.value;
        if (!selectedDate) {
            this.showError('Selecione uma data antes de definir o horário');
            return;
        }
        
        // Obter nome do profissional selecionado
        const selectedProfessionalId = this.elements.professionalSelect.value;
        let professionalName = null;
        
        if (window.agendaServicos && window.agendaServicos.professionals) {
            const prof = window.agendaServicos.professionals.find(p => p.id === selectedProfessionalId);
            professionalName = prof ? prof.name : null;
        }
        
        if (!professionalName) {
            this.showError('Selecione um profissional válido');
            return;
        }
        
        // Limpar seleções anteriores
        this.selectedTimes = [];
        
        // Gerar horários do intervalo
        const rangeTimes = [];
        const occupiedTimes = [];
        const interval = this.agenda.settings.slotInterval;
        
        for (let minutes = startMinutes; minutes < endMinutes; minutes += interval) {
            const hours = Math.floor(minutes / 60);
            const mins = minutes % 60;
            const timeString = `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
            
            // VERIFICAR CONFLITO USANDO NOME DO PROFISSIONAL
            const isOccupied = await this.isTimeSlotOccupied(selectedDate, timeString, professionalName);
            if (!isOccupied) {
                rangeTimes.push(timeString);
            } else {
                occupiedTimes.push(timeString);
            }
        }
        
        if (rangeTimes.length === 0) {
            this.showError('Todos os horários no intervalo estão ocupados');
            return;
        }
        
        // Mostrar aviso se alguns horários estão ocupados
        if (occupiedTimes.length > 0) {
            const occupiedText = occupiedTimes.join(', ');
            this.showNotification(`Atenção: Horários ocupados ignorados: ${occupiedText}`, 'warning');
        }
        
        // Definir horários selecionados
        this.selectedTimes = [...rangeTimes];
        this.selectedTimes.sort();
        
        // Aguardar um momento para garantir que os botões existam
        setTimeout(() => {
            this.updateTimeSlotButtons();
            this.updateSelectedTimesDisplay();
        }, 100);
        
        const duration = (endMinutes - startMinutes) / 60;
        const durationText = duration < 1 ? `${duration * 60} minutos` : `${duration.toFixed(1)}h`;
        this.showNotification(`Intervalo selecionado: ${durationText} (${rangeTimes.length} slots disponíveis)`, 'success');
    }

    // Função manual para novo serviço
    async selectTimeRange() {
        const startTime = this.elements.startTimeSelect.value;
        const endTime = this.elements.endTimeSelect.value;
        
        if (!startTime || !endTime) {
            this.showError('Selecione o horário de início e fim');
            return;
        }
        
        const startMinutes = this.timeToMinutes(startTime);
        const endMinutes = this.timeToMinutes(endTime);
        
        if (startMinutes >= endMinutes) {
            this.showError('O horário de início deve ser anterior ao horário de fim');
            return;
        }
        
        await this.selectTimeRangeAuto();
        
        // Limpar selects apenas se não for horário específico
        if (!this.isTimeSpecific) {
            this.elements.startTimeSelect.value = '';
            this.elements.endTimeSelect.value = '';
        }
    }

    timeToMinutes(timeString) {
        const [hours, minutes] = timeString.split(':').map(n => parseInt(n));
        return hours * 60 + minutes;
    }

    // FUNÇÃO CORRIGIDA - USA NOME DO PROFISSIONAL
    async isTimeSlotOccupied(date, time, professionalName) {
        if (!date || !professionalName) {
            console.log('Parâmetros insuficientes:', { date, time, professionalName });
            return false;
        }
        
        try {
            // Usar a função corrigida do Supabase
            const hasConflict = await verificarConflitoHorario(
                professionalName, 
                date, 
                time + ':00',
                this.currentAppointment?.id
            );
            
            return hasConflict;
            
        } catch (error) {
            console.error('Erro ao verificar slot ocupado:', error);
            return false;
        }
    }

    selectTimeSlot(time) {
        if (!this.selectedTimes.includes(time)) {
            this.selectedTimes = [time];
            this.updateTimeSlotButtons();
            this.updateSelectedTimesDisplay();
        }
    }

    toggleTimeSlot(time) {
        const index = this.selectedTimes.indexOf(time);
        
        if (index > -1) {
            this.selectedTimes.splice(index, 1);
        } else {
            this.selectedTimes.push(time);
        }
        
        this.selectedTimes.sort();
        this.updateTimeSlotButtons();
        this.updateSelectedTimesDisplay();
    }

    updateTimeSlotButtons() {
        const timeButtons = this.elements.timeSelector.querySelectorAll('.time-slot-btn');
        
        timeButtons.forEach(btn => {
            const time = btn.dataset.time;
            if (this.selectedTimes.includes(time)) {
                btn.classList.add('selected');
            } else {
                btn.classList.remove('selected');
            }
        });
    }

    updateSelectedTimesDisplay() {
        if (this.selectedTimes.length === 0) {
            this.elements.selectedTimesContainer.innerHTML = '<span class="no-times">Nenhum horário selecionado</span>';
        } else {
            const timeTags = this.selectedTimes.map(time => 
                `<div class="selected-time-tag">
                    ${time}
                    <button class="remove-time" onclick="window.agendaModals.removeTimeSlot('${time}')" type="button">×</button>
                </div>`
            ).join('');
            
            this.elements.selectedTimesContainer.innerHTML = timeTags;
        }
    }

    removeTimeSlot(time) {
        const index = this.selectedTimes.indexOf(time);
        if (index > -1) {
            this.selectedTimes.splice(index, 1);
            this.updateTimeSlotButtons();
            this.updateSelectedTimesDisplay();
        }
    }

    clearSelectedTimes() {
        this.selectedTimes = [];
        this.updateTimeSlotButtons();
        this.updateSelectedTimesDisplay();
    }

    // ===== TRATAMENTO DE ERROS =====
    showError(message) {
        this.clearError();
        
        const errorDiv = document.createElement('div');
        errorDiv.className = 'modal-error';
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
        errorDiv.innerHTML = `<span>⚠️</span><span>${message}</span>`;
        
        const modalBody = this.elements.modal.querySelector('.appointment-panel-body');
        modalBody.insertBefore(errorDiv, modalBody.firstChild);
        
        setTimeout(() => errorDiv.remove(), 5000);
    }

    clearError() {
        const errorDiv = this.elements.modal.querySelector('.modal-error');
        if (errorDiv) errorDiv.remove();
    }

    showNotification(message, type = 'info') {
        const existingNotif = this.elements.modal.querySelector('.temp-notification');
        if (existingNotif) existingNotif.remove();

        const notification = document.createElement('div');
        notification.className = 'temp-notification';
        
        const bgColor = {
            'success': '#10b981',
            'error': '#ef4444',
            'warning': '#f59e0b',
            'info': '#3b82f6'
        }[type];
        
        notification.style.cssText = `
            position: absolute;
            top: 10px;
            right: 10px;
            background: ${bgColor};
            color: white;
            padding: 8px 12px;
            border-radius: 6px;
            font-size: 12px;
            z-index: 1001;
            animation: fadeIn 0.3s ease;
        `;
        
        notification.textContent = message;
        this.elements.modal.appendChild(notification);
        
        setTimeout(() => notification.remove(), 3000);
    }
}

// ===== INICIALIZAÇÃO =====
let agendaModals;

document.addEventListener('DOMContentLoaded', () => {
    const initializeModals = () => {
        if (window.agendaServicos) {
            agendaModals = new AgendaModals(window.agendaServicos);
            window.agendaModals = agendaModals;
        } else {
            setTimeout(initializeModals, 100);
        }
    };
    
    setTimeout(initializeModals, 600);
});

window.AgendaModals = AgendaModals;
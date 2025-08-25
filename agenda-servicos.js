// agenda-servicos.js - Sistema Profissional de Agenda de Serviços
// ================================================================

class AgendaServicos {
    constructor() {
        this.currentDate = new Date();
        this.appointments = [];
        this.professionals = [
            { id: 'joao', name: 'João Silva', color: '#FF9800' },
            { id: 'maria', name: 'Maria Santos', color: '#10b981' },
            { id: 'carlos', name: 'Carlos Lima', color: '#3b82f6' }
        ];
        this.services = [
            { id: 1, name: 'Consultoria em TI', price: 150.00, duration: 60 },
            { id: 2, name: 'Manutenção de Computador', price: 80.00, duration: 90 },
            { id: 3, name: 'Instalação de Software', price: 50.00, duration: 30 },
            { id: 4, name: 'Treinamento', price: 200.00, duration: 120 }
        ];
        this.clients = [
            { id: 1, name: 'Empresa ABC Ltda', phone: '(11) 99999-0001' },
            { id: 2, name: 'João da Silva', phone: '(11) 99999-0002' },
            { id: 3, name: 'Maria Oliveira', phone: '(11) 99999-0003' }
        ];
        this.settings = this.loadSettings();
        this.selectedProfessional = 'todos';
        
        this.init();
    }

    init() {
        this.loadHeader();
        this.setupEventListeners();
        this.updateDateDisplay();
        this.generateTimeSlots();
        this.renderAppointments();
        this.updateCurrentTimeIndicator();
        
        // Atualizar indicador de tempo atual a cada minuto
        setInterval(() => this.updateCurrentTimeIndicator(), 60000);
        
        console.log('✅ Agenda de Serviços inicializada');
    }

    async loadHeader() {
        try {
            const response = await fetch('header.js');
            if (response.ok) {
                console.log('✅ Header carregado');
            }
        } catch (error) {
            console.warn('⚠️ Erro ao carregar header:', error);
        }
    }

    setupEventListeners() {
        // Navegação de data
        document.getElementById('prev-day').addEventListener('click', () => this.navigateDate(-1));
        document.getElementById('next-day').addEventListener('click', () => this.navigateDate(1));
        document.getElementById('date-picker').addEventListener('change', (e) => this.setDate(new Date(e.target.value)));
        document.getElementById('today-btn').addEventListener('click', () => this.goToToday());

        // Filtro de profissional
        document.getElementById('professional-filter').addEventListener('change', (e) => {
            this.selectedProfessional = e.target.value;
            this.renderAppointments();
        });

        // Configurações
        document.getElementById('settings-btn').addEventListener('click', () => this.openSettingsModal());

        // Novo agendamento
        document.getElementById('new-appointment-btn').addEventListener('click', () => this.openAppointmentModal());

        // Event listeners dos modais
        this.setupModalListeners();

        // Cliques nos slots vazios
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('appointment-slot') && e.target.classList.contains('empty')) {
                const time = e.target.dataset.time;
                this.openAppointmentModal(time);
            }
        });

        // Atalhos de teclado
        document.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowLeft' && e.ctrlKey) {
                e.preventDefault();
                this.navigateDate(-1);
            } else if (e.key === 'ArrowRight' && e.ctrlKey) {
                e.preventDefault();
                this.navigateDate(1);
            } else if (e.key === 'n' && e.ctrlKey) {
                e.preventDefault();
                this.openAppointmentModal();
            } else if (e.key === 'Escape') {
                this.closeAllModals();
            }
        });
    }

    setupModalListeners() {
        // Fechar modais
        document.querySelectorAll('.close-modal-btn').forEach(btn => {
            btn.addEventListener('click', () => this.closeAllModals());
        });

        document.querySelectorAll('.modal-overlay').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) this.closeAllModals();
            });
        });

        // Configurações
        document.getElementById('cancel-settings').addEventListener('click', () => this.closeAllModals());
        document.getElementById('save-settings').addEventListener('click', () => this.saveSettings());

        // Agendamento
        document.getElementById('cancel-appointment').addEventListener('click', () => this.closeAllModals());
        document.getElementById('save-appointment').addEventListener('click', () => this.saveAppointment());

        // Auto-complete de serviços e clientes
        document.getElementById('service-search').addEventListener('input', (e) => this.handleServiceSearch(e));
        document.getElementById('client-search').addEventListener('input', (e) => this.handleClientSearch(e));
    }

    // ===== NAVEGAÇÃO DE DATA =====
    navigateDate(days) {
        const newDate = new Date(this.currentDate);
        newDate.setDate(newDate.getDate() + days);
        
        // Pular fins de semana se não trabalha
        if (!this.settings.workDays[newDate.getDay()]) {
            // Encontrar próximo dia útil
            const direction = days > 0 ? 1 : -1;
            while (!this.settings.workDays[newDate.getDay()]) {
                newDate.setDate(newDate.getDate() + direction);
            }
        }
        
        this.setDate(newDate);
    }

    setDate(date) {
        this.currentDate = new Date(date);
        this.updateDateDisplay();
        this.renderAppointments();
        this.updateNavigationButtons();
    }

    goToToday() {
        this.setDate(new Date());
    }

    updateDateDisplay() {
        const options = { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        };
        
        const fullDate = this.currentDate.toLocaleDateString('pt-BR', options);
        const shortDate = this.currentDate.toLocaleDateString('pt-BR', { 
            day: 'numeric', 
            month: 'short',
            year: 'numeric'
        });
        
        document.getElementById('current-date').textContent = fullDate;
        document.getElementById('date-info').textContent = shortDate;
        document.getElementById('date-picker').value = this.currentDate.toISOString().split('T')[0];
        
        // Verificar se é fim de semana ou dia não útil
        const dayOfWeek = this.currentDate.getDay();
        const isWorkingDay = this.settings.workDays[dayOfWeek];
        
        if (!isWorkingDay) {
            document.querySelector('.agenda-body').classList.add('non-working-day');
        } else {
            document.querySelector('.agenda-body').classList.remove('non-working-day');
        }
    }

    updateNavigationButtons() {
        const today = new Date();
        const diffTime = this.currentDate.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        // Desabilitar navegação para muito no passado (opcional)
        const prevBtn = document.getElementById('prev-day');
        const nextBtn = document.getElementById('next-day');
        
        // Você pode adicionar lógica aqui para limitar navegação
        prevBtn.disabled = false;
        nextBtn.disabled = false;
    }

    // ===== GERAÇÃO DE HORÁRIOS =====
    generateTimeSlots() {
        const timelineSlots = document.getElementById('timeline-slots');
        const appointmentsGrid = document.getElementById('appointments-grid');
        
        timelineSlots.innerHTML = '';
        appointmentsGrid.innerHTML = '';
        
        const startHour = parseInt(this.settings.startTime.split(':')[0]);
        const endHour = parseInt(this.settings.endTime.split(':')[0]);
        const interval = this.settings.slotInterval;
        
        const currentTime = new Date();
        const isToday = this.isToday(this.currentDate);
        
        for (let hour = startHour; hour < endHour; hour++) {
            for (let minute = 0; minute < 60; minute += interval) {
                const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
                const slotTime = new Date(this.currentDate);
                slotTime.setHours(hour, minute, 0, 0);
                
                // Timeline slot
                const timelineSlot = document.createElement('div');
                timelineSlot.className = 'timeline-slot';
                timelineSlot.textContent = timeString;
                
                // Marcar hora atual
                if (isToday && currentTime.getHours() === hour && currentTime.getMinutes() >= minute && currentTime.getMinutes() < minute + interval) {
                    timelineSlot.classList.add('current-hour');
                }
                
                // Marcar horário de almoço
                if (this.settings.enableLunch && this.isLunchTime(hour, minute)) {
                    timelineSlot.classList.add('lunch-time');
                }
                
                timelineSlots.appendChild(timelineSlot);
                
                // Appointment slot
                const appointmentSlot = document.createElement('div');
                appointmentSlot.className = 'appointment-slot empty';
                appointmentSlot.dataset.time = timeString;
                
                if (this.isLunchTime(hour, minute)) {
                    appointmentSlot.innerHTML = '<span style="color: var(--warning-color);">🍽️ Horário de Almoço</span>';
                    appointmentSlot.classList.remove('empty');
                    appointmentSlot.style.background = '#fff3cd';
                } else {
                    appointmentSlot.innerHTML = '<span>+ Agendar serviço</span>';
                }
                
                appointmentsGrid.appendChild(appointmentSlot);
            }
        }
    }

    isLunchTime(hour, minute) {
        if (!this.settings.enableLunch) return false;
        
        const lunchStart = this.settings.lunchStart.split(':');
        const lunchEnd = this.settings.lunchEnd.split(':');
        const lunchStartMinutes = parseInt(lunchStart[0]) * 60 + parseInt(lunchStart[1]);
        const lunchEndMinutes = parseInt(lunchEnd[0]) * 60 + parseInt(lunchEnd[1]);
        const currentMinutes = hour * 60 + minute;
        
        return currentMinutes >= lunchStartMinutes && currentMinutes < lunchEndMinutes;
    }

    isToday(date) {
        const today = new Date();
        return date.toDateString() === today.toDateString();
    }

    // ===== RENDERIZAÇÃO DE AGENDAMENTOS =====
    renderAppointments() {
        const slots = document.querySelectorAll('.appointment-slot');
        const dateStr = this.currentDate.toISOString().split('T')[0];
        const dayAppointments = this.appointments.filter(apt => apt.date === dateStr);
        
        // Filtrar por profissional
        const filteredAppointments = this.selectedProfessional === 'todos' ? 
            dayAppointments : 
            dayAppointments.filter(apt => apt.professional === this.selectedProfessional);
        
        // Limpar slots ocupados
        slots.forEach(slot => {
            if (!slot.innerHTML.includes('Almoço')) {
                slot.className = 'appointment-slot empty';
                slot.innerHTML = '<span>+ Agendar serviço</span>';
            }
        });
        
        // Preencher com agendamentos
        filteredAppointments.forEach(appointment => {
            const timeSlot = document.querySelector(`[data-time="${appointment.time}"]`);
            if (timeSlot && !timeSlot.innerHTML.includes('Almoço')) {
                timeSlot.className = 'appointment-slot occupied';
                timeSlot.innerHTML = this.createAppointmentHTML(appointment);
                timeSlot.addEventListener('click', () => this.viewAppointmentDetails(appointment));
            }
        });
        
        // Atualizar contador
        document.getElementById('appointments-count').textContent = 
            `${filteredAppointments.length} agendamento${filteredAppointments.length !== 1 ? 's' : ''}`;
    }

    createAppointmentHTML(appointment) {
        const professional = this.professionals.find(p => p.id === appointment.professional);
        const statusClass = `status-${appointment.status}`;
        
        return `
            <div class="appointment-content">
                <div class="appointment-info">
                    <h4>${appointment.service}</h4>
                    <div class="appointment-details">
                        <i class="fa-solid fa-user"></i> ${appointment.client}
                        <i class="fa-solid fa-user-tie"></i> ${professional?.name || appointment.professional}
                    </div>
                </div>
                <div class="appointment-status ${statusClass}">
                    ${this.getStatusLabel(appointment.status)}
                </div>
            </div>
        `;
    }

    getStatusLabel(status) {
        const labels = {
            'agendado': 'Agendado',
            'andamento': 'Em Andamento',
            'concluido': 'Concluído',
            'cancelado': 'Cancelado'
        };
        return labels[status] || status;
    }

    // ===== INDICADOR DE TEMPO ATUAL =====
    updateCurrentTimeIndicator() {
        const existingIndicator = document.querySelector('.current-time-indicator');
        if (existingIndicator) existingIndicator.remove();
        
        if (!this.isToday(this.currentDate)) return;
        
        const currentTime = new Date();
        const currentHour = currentTime.getHours();
        const currentMinute = currentTime.getMinutes();
        
        const startHour = parseInt(this.settings.startTime.split(':')[0]);
        const endHour = parseInt(this.settings.endTime.split(':')[0]);
        
        if (currentHour < startHour || currentHour >= endHour) return;
        
        const totalMinutes = (currentHour - startHour) * 60 + currentMinute;
        const slotHeight = 60; // altura do slot em pixels
        const position = (totalMinutes / this.settings.slotInterval) * slotHeight;
        
        const indicator = document.createElement('div');
        indicator.className = 'current-time-indicator';
        indicator.style.top = `${position}px`;
        
        document.getElementById('appointments-grid').appendChild(indicator);
    }

    // ===== MODAIS =====
    openSettingsModal() {
        this.populateSettingsForm();
        document.getElementById('settings-modal').classList.remove('hidden');
    }

    openAppointmentModal(time = '') {
        this.resetAppointmentForm();
        
        if (time) {
            document.getElementById('appointment-time').value = time;
        }
        
        document.getElementById('appointment-date').value = this.currentDate.toISOString().split('T')[0];
        document.getElementById('appointment-modal').classList.remove('hidden');
        document.getElementById('service-search').focus();
    }

    viewAppointmentDetails(appointment) {
        // Implementar modal de detalhes do agendamento
        console.log('Ver detalhes:', appointment);
        // Por enquanto, mostrar alert
        alert(`Agendamento: ${appointment.service}\nCliente: ${appointment.client}\nHorário: ${appointment.time}\nStatus: ${appointment.status}`);
    }

    closeAllModals() {
        document.querySelectorAll('.modal-overlay').forEach(modal => {
            modal.classList.add('hidden');
        });
    }

    // ===== CONFIGURAÇÕES =====
    loadSettings() {
        const defaultSettings = {
            workDays: [false, true, true, true, true, true, false, false], // Dom, Seg, Ter, Qua, Qui, Sex, Sab
            startTime: '08:00',
            endTime: '18:00',
            slotInterval: 30,
            enableLunch: true,
            lunchStart: '12:00',
            lunchEnd: '13:00'
        };
        
        const saved = localStorage.getItem('agenda-settings');
        return saved ? { ...defaultSettings, ...JSON.parse(saved) } : defaultSettings;
    }

    populateSettingsForm() {
        // Dias da semana
        const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        days.forEach((day, index) => {
            const checkbox = document.getElementById(`work-${day}`);
            if (checkbox) checkbox.checked = this.settings.workDays[index];
        });
        
        // Horários
        document.getElementById('start-time').value = this.settings.startTime;
        document.getElementById('end-time').value = this.settings.endTime;
        document.getElementById('slot-interval').value = this.settings.slotInterval;
        
        // Almoço
        document.getElementById('enable-lunch').checked = this.settings.enableLunch;
        document.getElementById('lunch-start').value = this.settings.lunchStart;
        document.getElementById('lunch-end').value = this.settings.lunchEnd;
    }

    saveSettings() {
        // Coletar dados do formulário
        const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const workDays = days.map(day => {
            const checkbox = document.getElementById(`work-${day}`);
            return checkbox ? checkbox.checked : false;
        });
        
        this.settings = {
            workDays: workDays,
            startTime: document.getElementById('start-time').value,
            endTime: document.getElementById('end-time').value,
            slotInterval: parseInt(document.getElementById('slot-interval').value),
            enableLunch: document.getElementById('enable-lunch').checked,
            lunchStart: document.getElementById('lunch-start').value,
            lunchEnd: document.getElementById('lunch-end').value
        };
        
        localStorage.setItem('agenda-settings', JSON.stringify(this.settings));
        
        // Regenerar interface
        this.generateTimeSlots();
        this.renderAppointments();
        this.closeAllModals();
        
        this.showNotification('Configurações salvas com sucesso!', 'success');
    }

    // ===== AGENDAMENTO =====
    resetAppointmentForm() {
        document.getElementById('service-search').value = '';
        document.getElementById('client-search').value = '';
        document.getElementById('professional-select').value = '';
        document.getElementById('service-price').value = '';
        document.getElementById('appointment-date').value = '';
        document.getElementById('appointment-time').value = '';
        document.getElementById('appointment-notes').value = '';
        
        // Limpar sugestões
        document.getElementById('service-suggestions').classList.remove('show');
        document.getElementById('client-suggestions').classList.remove('show');
    }

    handleServiceSearch(e) {
        const query = e.target.value.toLowerCase();
        const suggestions = document.getElementById('service-suggestions');
        
        if (query.length < 2) {
            suggestions.classList.remove('show');
            return;
        }
        
        const matches = this.services.filter(service => 
            service.name.toLowerCase().includes(query)
        );
        
        if (matches.length > 0) {
            suggestions.innerHTML = matches.map(service => `
                <div class="suggestion-item" data-service-id="${service.id}">
                    <strong>${service.name}</strong>
                    <small>R$ ${service.price.toFixed(2)} - ${service.duration}min</small>
                </div>
            `).join('');
            
            suggestions.classList.add('show');
            
            // Event listeners para sugestões
            suggestions.querySelectorAll('.suggestion-item').forEach(item => {
                item.addEventListener('click', () => {
                    const serviceId = parseInt(item.dataset.serviceId);
                    const service = this.services.find(s => s.id === serviceId);
                    this.selectService(service);
                });
            });
        } else {
            suggestions.classList.remove('show');
        }
    }

    handleClientSearch(e) {
        const query = e.target.value.toLowerCase();
        const suggestions = document.getElementById('client-suggestions');
        
        if (query.length < 2) {
            suggestions.classList.remove('show');
            return;
        }
        
        const matches = this.clients.filter(client => 
            client.name.toLowerCase().includes(query)
        );
        
        if (matches.length > 0) {
            suggestions.innerHTML = matches.map(client => `
                <div class="suggestion-item" data-client-id="${client.id}">
                    <strong>${client.name}</strong>
                    <small>${client.phone}</small>
                </div>
            `).join('');
            
            suggestions.classList.add('show');
            
            // Event listeners para sugestões
            suggestions.querySelectorAll('.suggestion-item').forEach(item => {
                item.addEventListener('click', () => {
                    const clientId = parseInt(item.dataset.clientId);
                    const client = this.clients.find(c => c.id === clientId);
                    this.selectClient(client);
                });
            });
        } else {
            suggestions.classList.remove('show');
        }
    }

    selectService(service) {
        document.getElementById('service-search').value = service.name;
        document.getElementById('service-price').value = service.price.toFixed(2);
        document.getElementById('service-suggestions').classList.remove('show');
    }

    selectClient(client) {
        document.getElementById('client-search').value = client.name;
        document.getElementById('client-suggestions').classList.remove('show');
    }

    saveAppointment() {
        // Validar formulário
        const service = document.getElementById('service-search').value.trim();
        const client = document.getElementById('client-search').value.trim();
        const professional = document.getElementById('professional-select').value;
        const date = document.getElementById('appointment-date').value;
        const time = document.getElementById('appointment-time').value;
        
        if (!service || !client || !professional || !date || !time) {
            this.showNotification('Por favor, preencha todos os campos obrigatórios.', 'error');
            return;
        }
        
        // Verificar conflito de horário
        const dateStr = date;
        const existingAppointment = this.appointments.find(apt => 
            apt.date === dateStr && 
            apt.time === time && 
            (apt.professional === professional || this.selectedProfessional === 'todos')
        );
        
        if (existingAppointment) {
            this.showNotification('Já existe um agendamento neste horário!', 'error');
            return;
        }
        
        // Verificar se está dentro do horário de funcionamento
        if (!this.isValidTime(time)) {
            this.showNotification('Horário fora do funcionamento!', 'error');
            return;
        }
        
        // Criar novo agendamento
        const newAppointment = {
            id: Date.now(),
            service: service,
            client: client,
            professional: professional,
            date: dateStr,
            time: time,
            price: parseFloat(document.getElementById('service-price').value) || 0,
            notes: document.getElementById('appointment-notes').value.trim(),
            status: 'agendado',
            createdAt: new Date().toISOString()
        };
        
        this.appointments.push(newAppointment);
        this.saveAppointmentsToStorage();
        this.renderAppointments();
        this.closeAllModals();
        
        this.showNotification('Agendamento criado com sucesso!', 'success');
    }

    isValidTime(time) {
        const [hours, minutes] = time.split(':').map(n => parseInt(n));
        const timeMinutes = hours * 60 + minutes;
        
        const startMinutes = this.timeToMinutes(this.settings.startTime);
        const endMinutes = this.timeToMinutes(this.settings.endTime);
        
        if (timeMinutes < startMinutes || timeMinutes >= endMinutes) {
            return false;
        }
        
        // Verificar se não é horário de almoço
        if (this.settings.enableLunch) {
            const lunchStartMinutes = this.timeToMinutes(this.settings.lunchStart);
            const lunchEndMinutes = this.timeToMinutes(this.settings.lunchEnd);
            
            if (timeMinutes >= lunchStartMinutes && timeMinutes < lunchEndMinutes) {
                return false;
            }
        }
        
        return true;
    }

    timeToMinutes(timeString) {
        const [hours, minutes] = timeString.split(':').map(n => parseInt(n));
        return hours * 60 + minutes;
    }

    // ===== STORAGE =====
    saveAppointmentsToStorage() {
        localStorage.setItem('agenda-appointments', JSON.stringify(this.appointments));
    }

    loadAppointmentsFromStorage() {
        const saved = localStorage.getItem('agenda-appointments');
        this.appointments = saved ? JSON.parse(saved) : this.generateSampleAppointments();
    }

    generateSampleAppointments() {
        const today = new Date();
        const dateStr = today.toISOString().split('T')[0];
        
        return [
            {
                id: 1,
                service: 'Consultoria em TI',
                client: 'Empresa ABC Ltda',
                professional: 'joao',
                date: dateStr,
                time: '09:00',
                price: 150.00,
                notes: 'Análise de infraestrutura',
                status: 'agendado',
                createdAt: new Date().toISOString()
            },
            {
                id: 2,
                service: 'Manutenção de Computador',
                client: 'João da Silva',
                professional: 'maria',
                date: dateStr,
                time: '14:00',
                price: 80.00,
                notes: 'Limpeza e verificação geral',
                status: 'agendado',
                createdAt: new Date().toISOString()
            },
            {
                id: 3,
                service: 'Treinamento',
                client: 'Maria Oliveira',
                professional: 'carlos',
                date: dateStr,
                time: '16:00',
                price: 200.00,
                notes: 'Treinamento em Excel avançado',
                status: 'concluido',
                createdAt: new Date().toISOString()
            }
        ];
    }

    // ===== NOTIFICAÇÕES =====
    showNotification(message, type = 'info') {
        // Remover notificação existente
        const existing = document.querySelector('.agenda-notification');
        if (existing) existing.remove();

        const notification = document.createElement('div');
        notification.className = `agenda-notification ${type}`;
        
        const bgColor = {
            'success': '#10b981',
            'error': '#ef4444',
            'warning': '#f59e0b',
            'info': '#3b82f6'
        }[type];
        
        const icon = {
            'success': 'fa-check-circle',
            'error': 'fa-exclamation-circle',
            'warning': 'fa-exclamation-triangle',
            'info': 'fa-info-circle'
        }[type];
        
        notification.style.cssText = `
            position: fixed;
            top: 2rem;
            right: 2rem;
            background-color: ${bgColor};
            color: white;
            padding: 1rem 1.5rem;
            border-radius: 8px;
            font-weight: 500;
            z-index: 1001;
            max-width: 400px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            animation: slideInRight 0.3s ease;
            display: flex;
            align-items: center;
            gap: 0.5rem;
        `;
        
        notification.innerHTML = `
            <i class="fas ${icon}"></i>
            <span>${message}</span>
            <button onclick="this.parentElement.remove()" 
                    style="background: none; border: none; color: white; margin-left: auto; cursor: pointer; padding: 0.25rem;">
                <i class="fas fa-times"></i>
            </button>
        `;

        document.body.appendChild(notification);
        
        setTimeout(() => {
            if (notification.parentNode) {
                notification.style.animation = 'slideOutRight 0.3s ease forwards';
                setTimeout(() => notification.remove(), 300);
            }
        }, 4000);
    }

    // ===== MÉTODO DE INICIALIZAÇÃO FINAL =====
    start() {
        this.loadAppointmentsFromStorage();
        this.renderAppointments();
        console.log('🚀 Agenda de Serviços totalmente carregada!');
    }
}

// ===== ESTILOS DAS NOTIFICAÇÕES =====
const notificationStyles = document.createElement('style');
notificationStyles.textContent = `
    @keyframes slideInRight {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    
    @keyframes slideOutRight {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
    
    .agenda-notification {
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    }
`;
document.head.appendChild(notificationStyles);

// ===== INICIALIZAÇÃO =====
let agendaServicos;

document.addEventListener('DOMContentLoaded', () => {
    agendaServicos = new AgendaServicos();
    
    // Aguardar um pouco para carregar dados
    setTimeout(() => {
        agendaServicos.start();
    }, 500);
});

// ===== ATALHOS GLOBAIS =====
window.agendaServicos = agendaServicos;

// Log de carregamento
console.log('✅ Sistema de Agenda de Serviços carregado');
console.log('📋 Funcionalidades disponíveis:');
console.log('  - Navegação por data com setas (Ctrl+←/→)');
console.log('  - Filtro por profissional');
console.log('  - Configuração de dias úteis');
console.log('  - Agendamento de serviços (Ctrl+N)');
console.log('  - Indicador de tempo atual');
console.log('  - Auto-complete para serviços e clientes');
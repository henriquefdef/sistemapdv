// agenda-servicos.js - Sistema Principal de Agenda de Serviços INTEGRADO COM SUPABASE
// ===========================================================

class AgendaServicos {
    constructor() {
        this.currentDate = new Date();
        this.appointments = [];
        this.professionals = [];
        this.services = [];
        this.clients = [];
        this.selectedProfessional = null;
        this.selectedAppointment = null;
        this.settings = this.loadSettings();
        this.isLoading = false;
        
        this.init();
    }

    async init() {
        this.setupEventListeners();
        this.updateDateDisplay();
        
        // SEMPRE gerar a timeline primeiro
        this.generateTimeline();
        
        // Aguardar dados do usuário estarem prontos
        if (window.currentUser && window.currentCompanyId) {
            await this.loadAllData();
        } else {
            document.addEventListener('userDataReady', async () => {
                await this.loadAllData();
            });
        }
        
        this.waitForHeaderAndFixIcons();
        console.log('✅ Agenda de Serviços inicializada com Supabase');
    }

    // ===== CARREGAMENTO DE DADOS DO SUPABASE =====
    
    async loadAllData() {
        try {
            this.setLoadingState(true);
            
            // Carregar dados em paralelo
            const [profissionais, servicos, clientes] = await Promise.all([
                loadProfissionaisFromDB(),
                loadServicosFromDB(),
                loadClientesFromDB()
            ]);
            
            this.professionals = profissionais;
            this.services = servicos;
            this.clients = clientes;
            
            // Atualizar select de profissionais
            this.updateProfessionalSelect();
            
            // Carregar agendamentos do dia atual
            await this.loadAppointmentsForCurrentDate();
            
            this.setLoadingState(false);
            console.log('Dados carregados:', {
                profissionais: this.professionals.length,
                servicos: this.services.length,
                clientes: this.clients.length,
                agendamentos: this.appointments.length
            });
            
        } catch (error) {
            console.error('Erro ao carregar dados:', error);
            this.setLoadingState(false);
            this.showNotification('Erro ao carregar dados da agenda', 'error');
        }
    }
    
    async loadAppointmentsForCurrentDate() {
        try {
            const startDate = new Date(this.currentDate);
            const endDate = new Date(this.currentDate);
            
            const agendamentos = await loadAgendamentosFromDB(startDate, endDate);
            
            // Converter para formato interno
            this.appointments = agendamentos.map(agendamento => ({
                id: agendamento.id,
                service: agendamento.service,
                client: agendamento.client,
                clientPhone: agendamento.clientPhone,
                clientEmail: agendamento.clientEmail,
                professional: agendamento.professional,
                professionalName: agendamento.professionalName,
                date: agendamento.date,
                time: agendamento.time,
                endTime: agendamento.endTime,
                price: agendamento.price,
                status: agendamento.status,
                notes: agendamento.notes,
                internalNotes: agendamento.internalNotes,
                paymentMethod: agendamento.paymentMethod,
                createdAt: agendamento.createdAt,
                group_id: agendamento.group_id  // INCLUIR GROUP_ID
            }));
            
            // SEMPRE renderizar depois de carregar - mesmo que vazio
            this.renderAppointments();
            
        } catch (error) {
            console.error('Erro ao carregar agendamentos:', error);
            this.appointments = [];
            // SEMPRE renderizar mesmo com erro
            this.renderAppointments();
        }
    }
    
    updateProfessionalSelect() {
        const professionalFilter = document.getElementById('professional-filter');
        const professionalSelect = document.getElementById('professional-select');
        
        if (professionalFilter) {
            professionalFilter.innerHTML = '';
            
            // Encontrar o profissional logado usando múltiplas estratégias
            let loggedProfessional = null;
            if (window.currentUser) {
                // Estratégia 1: Comparar por auth_user_id
                loggedProfessional = this.professionals.find(prof => 
                    prof.id === window.currentUser.auth_user_id
                );
                
                // Estratégia 2: Comparar por nome (fallback)
                if (!loggedProfessional && window.currentUser.nome) {
                    loggedProfessional = this.professionals.find(prof => 
                        prof.name === window.currentUser.nome
                    );
                }
            }
            
            // Sempre criar uma lista ordenada com o usuário logado primeiro
            let orderedProfessionals = [];
            
            if (loggedProfessional) {
                // Adicionar o usuário logado primeiro
                orderedProfessionals.push(loggedProfessional);
                
                // Adicionar os outros profissionais (excluindo o logado)
                const otherProfessionals = this.professionals.filter(prof => 
                    prof.id !== loggedProfessional.id
                );
                orderedProfessionals = orderedProfessionals.concat(otherProfessionals);
            } else {
                // Se não encontrou o usuário logado, usar a lista original
                orderedProfessionals = [...this.professionals];
            }
            
            // Adicionar opções ao select
            orderedProfessionals.forEach(prof => {
                const option = document.createElement('option');
                option.value = prof.id;
                option.textContent = prof.name;
                professionalFilter.appendChild(option);
            });
            
            // Selecionar o primeiro da lista (que deve ser o usuário logado)
            if (orderedProfessionals.length > 0) {
                const firstProfessional = orderedProfessionals[0];
                professionalFilter.value = firstProfessional.id;
                this.selectedProfessional = firstProfessional.name;
            }
        }
        
        if (professionalSelect) {
            professionalSelect.innerHTML = '<option value="">Selecionar profissional</option>';
            
            // Usar a mesma lógica de ordenação para o select do modal
            let loggedProfessional = null;
            if (window.currentUser) {
                loggedProfessional = this.professionals.find(prof => 
                    prof.auth_user_id === window.currentUser.auth_user_id || 
                    prof.id === window.currentUser.id
                );
            }
            
            let orderedProfessionals = [...this.professionals];
            if (loggedProfessional) {
                orderedProfessionals = this.professionals.filter(prof => 
                    prof.auth_user_id !== window.currentUser.auth_user_id && 
                    prof.id !== window.currentUser.id
                );
                orderedProfessionals.unshift(loggedProfessional);
            }
            
            orderedProfessionals.forEach(prof => {
                const option = document.createElement('option');
                option.value = prof.id;
                option.textContent = prof.name;
                professionalSelect.appendChild(option);
            });
        }
    }

    // ===== EVENTOS E NAVEGAÇÃO =====
    
    waitForHeaderAndFixIcons() {
        if (window.currentUser) {
            setTimeout(() => this.forceIconsLoad(), 200);
        } else {
            document.addEventListener('userDataReady', () => {
                setTimeout(() => this.forceIconsLoad(), 300);
            });
        }
    }

    forceIconsLoad() {
        const prevBtn = document.getElementById('prev-day');
        const nextBtn = document.getElementById('next-day');
        const todayBtn = document.getElementById('today-btn');
        const settingsBtn = document.getElementById('settings-btn');
        const closePanelBtn = document.getElementById('close-panel');

        const style = document.createElement('style');
        style.textContent = `
            .agenda-container #prev-day:before { content: "◀"; font-weight: bold; }
            .agenda-container #next-day:before { content: "▶"; font-weight: bold; }
            .agenda-container #settings-btn { width: 44px !important; height: 44px !important; font-size: 20px !important; }
            .agenda-container #settings-btn:before { content: "⚙"; font-size: 22px; }
            .details-panel #close-panel:before { content: "×"; font-size: 18px; font-weight: bold; }
            .agenda-container #today-btn:before { content: "📅 "; }
        `;
        document.head.appendChild(style);

        if (prevBtn) prevBtn.innerHTML = '';
        if (nextBtn) nextBtn.innerHTML = '';
        if (settingsBtn) settingsBtn.innerHTML = '';
        if (closePanelBtn) closePanelBtn.innerHTML = '';
        if (todayBtn) todayBtn.innerHTML = 'Hoje';
    }

    setupEventListeners() {
        // Navegação de data
        document.getElementById('prev-day').addEventListener('click', () => this.navigateDate(-1));
        document.getElementById('next-day').addEventListener('click', () => this.navigateDate(1));
        document.getElementById('today-btn').addEventListener('click', () => this.goToToday());
        
        // Filtros e ações
        document.getElementById('professional-filter').addEventListener('change', async (e) => {
            const selectedId = e.target.value;
            const selectedProf = this.professionals.find(p => p.id === selectedId);
            this.selectedProfessional = selectedProf ? selectedProf.name : null;
            this.renderAppointments();
            this.updateAppointmentsCount();
        });
        
        document.getElementById('new-service-btn').addEventListener('click', () => this.openAppointmentModal());
        document.getElementById('settings-btn').addEventListener('click', () => this.openSettings());
        
        // Painel lateral
        document.getElementById('close-panel').addEventListener('click', () => this.clearPanel());
        document.getElementById('complete-service').addEventListener('click', () => this.completeService());
        document.getElementById('cancel-service').addEventListener('click', () => this.cancelService());
        
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
                this.clearPanel();
            }
        });
    }

    // ===== NAVEGAÇÃO DE DATA =====
    async navigateDate(days) {
        this.currentDate.setDate(this.currentDate.getDate() + days);
        this.updateDateDisplay();
        
        // Garantir que timeline existe antes de carregar dados
        const timeline = document.getElementById('timeline');
        if (!timeline.querySelector('.time-slot')) {
            this.generateTimeline();
        }
        
        await this.loadAppointmentsForCurrentDate();
        this.clearPanel();
    }

    async goToToday() {
        this.currentDate = new Date();
        this.updateDateDisplay();
        
        // Garantir que timeline existe antes de carregar dados
        const timeline = document.getElementById('timeline');
        if (!timeline.querySelector('.time-slot')) {
            this.generateTimeline();
        }
        
        await this.loadAppointmentsForCurrentDate();
        this.clearPanel();
    }

    updateDateDisplay() {
        const options = { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        };
        
        const fullDate = this.currentDate.toLocaleDateString('pt-BR', options);
        document.getElementById('section-date').textContent = fullDate;
        this.updateAppointmentsCount();
    }

    updateAppointmentsCount() {
        let dayAppointments = this.appointments.filter(apt => apt.status !== 'cancelado');
        
        if (this.selectedProfessional) {
            dayAppointments = dayAppointments.filter(apt => apt.professional == this.selectedProfessional);
        }
        
        const count = dayAppointments.length;
        const text = `${count} agendamento${count !== 1 ? 's' : ''}`;
        document.getElementById('count-badge').textContent = text;
    }

    // ===== GERAÇÃO DA TIMELINE =====
    generateTimeline() {
        const timeline = document.getElementById('timeline');
        timeline.innerHTML = '';
        
        // Usar configurações para determinar horários
        const startHour = parseInt(this.settings.startTime.split(':')[0]);
        const startMinute = parseInt(this.settings.startTime.split(':')[1]);
        const endHour = parseInt(this.settings.endTime.split(':')[0]);
        const endMinute = parseInt(this.settings.endTime.split(':')[1]);
        
        const startTotalMinutes = startHour * 60 + startMinute;
        const endTotalMinutes = endHour * 60 + endMinute;
        const interval = this.settings.slotInterval;
        
        // Gerar slots baseados nas configurações
        for (let totalMinutes = startTotalMinutes; totalMinutes < endTotalMinutes; totalMinutes += interval) {
            const hour = Math.floor(totalMinutes / 60);
            const minute = totalMinutes % 60;
            const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
            const slot = this.createTimeSlot(timeString);
            timeline.appendChild(slot);
        }
    }

    createTimeSlot(timeString) {
        const slot = document.createElement('div');
        slot.className = 'time-slot';
        slot.dataset.time = timeString;
        
        // Verificar se é horário atual
        const now = new Date();
        const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes() >= 30 ? '30' : '00'}`;
        const isToday = this.isToday(this.currentDate);
        
        slot.innerHTML = `
            <div class="time-label ${isToday && currentTime === timeString ? 'current-time' : ''}">${timeString}</div>
            <div class="slot-content empty" onclick="agendaServicos.openAppointmentModal('${timeString}')">
                <span>+ Agendar serviço</span>
            </div>
        `;
        
        return slot;
    }

    isToday(date) {
        const today = new Date();
        return date.toDateString() === today.toDateString();
    }

    // ===== RENDERIZAÇÃO DOS AGENDAMENTOS =====
    renderAppointments() {
        const timeline = document.getElementById('timeline');
        
        // Se não tem timeline, criar primeiro
        if (!timeline.querySelector('.time-slot')) {
            this.generateTimeline();
        }
        
        const slots = timeline.querySelectorAll('.time-slot');
        
        // Filtrar agendamentos
        let dayAppointments = this.appointments.filter(apt => apt.status !== 'cancelado');
        
        if (this.selectedProfessional) {
            dayAppointments = dayAppointments.filter(apt => apt.professional == this.selectedProfessional);
        }
        
        // Resetar todos os slots para vazio
        slots.forEach(slot => {
            const slotContent = slot.querySelector('.slot-content');
            const timeString = slot.dataset.time;
            
            slotContent.className = 'slot-content empty';
            slotContent.innerHTML = '<span>+ Agendar serviço</span>';
            slotContent.onclick = () => this.openAppointmentModal(timeString);
        });
        
        // Renderizar agendamentos (se houver)
        dayAppointments.forEach(appointment => {
            const slot = timeline.querySelector(`[data-time="${appointment.time}"]`);
            if (slot) {
                this.renderAppointmentInSlot(slot, appointment);
            }
        });
        
        this.updateAppointmentsCount();
    }

    renderAppointmentInSlot(slot, appointment) {
        const slotContent = slot.querySelector('.slot-content');
        const professional = this.professionals.find(p => p.name === appointment.professional);
        
        // Verificar se é um agendamento agrupado
        const isGrouped = appointment.group_id && this.getGroupedAppointments(appointment.group_id).length > 1;
        const groupInfo = isGrouped ? this.getGroupInfo(appointment.group_id, appointment) : null;
        
        slotContent.className = `slot-content occupied ${isGrouped ? 'grouped' : ''}`;
        slotContent.innerHTML = `
            <div class="appointment-info">
                <h4>${appointment.service}${isGrouped ? ` (${groupInfo.position}/${groupInfo.total})` : ''}</h4>
                <div class="appointment-details">
                    <span>👤 ${appointment.client}</span>
                    <span>👨‍💼 ${appointment.professionalName || professional?.name || 'N/A'}</span>
                    <span>💰 R$ ${appointment.price.toFixed(2)}</span>
                    <span class="status-badge">${this.getStatusLabel(appointment.status)}</span>
                    ${isGrouped ? `<span class="group-badge">${groupInfo.timeRange}</span>` : ''}
                </div>
            </div>
        `;
        
        slotContent.onclick = (e) => {
            e.stopPropagation();
            
            if (this.selectedAppointment && this.selectedAppointment.id === appointment.id) {
                this.clearSelection();
                this.clearPanel();
            } else {
                // Selecionar apenas o agendamento individual, mesmo se for agrupado
                this.selectAppointment(appointment);
                this.showAppointmentDetails(appointment);
            }
        };
    }

    getStatusLabel(status) {
        const labels = {
            'agendado': 'Agendado',
            'em_andamento': 'Em Andamento',
            'concluido': 'Concluído',
            'cancelado': 'Cancelado',
            'nao_compareceu': 'Não Compareceu'
        };
        return labels[status] || status;
    }

    // ===== DETALHES DO AGENDAMENTO =====
    selectAppointment(appointment) {
        this.clearSelection();
        this.selectedAppointment = appointment;
        
        const timeline = document.getElementById('timeline');
        const slot = timeline.querySelector(`[data-time="${appointment.time}"]`);
        if (slot) {
            const slotContent = slot.querySelector('.slot-content');
            slotContent.classList.add('selected');
        }
    }
    
    clearSelection() {
        const timeline = document.getElementById('timeline');
        const selectedSlots = timeline.querySelectorAll('.slot-content.selected');
        selectedSlots.forEach(slot => slot.classList.remove('selected'));
        
        this.selectedAppointment = null;
    }

    // Funções para gerenciar agendamentos agrupados
    getGroupedAppointments(groupId) {
        if (!groupId) return [];
        return this.appointments.filter(appointment => appointment.group_id === groupId);
    }

    getGroupInfo(groupId, currentAppointment = null) {
        const groupedAppointments = this.getGroupedAppointments(groupId);
        if (groupedAppointments.length === 0) return null;
        
        // Ordenar por horário
        groupedAppointments.sort((a, b) => a.time.localeCompare(b.time));
        
        const firstTime = groupedAppointments[0].time;
        const lastTime = groupedAppointments[groupedAppointments.length - 1].time;
        const timeRange = firstTime === lastTime ? firstTime : `${firstTime}-${lastTime}`;
        
        let position = 1;
        if (currentAppointment) {
            const index = groupedAppointments.findIndex(app => app.id === currentAppointment.id);
            position = index >= 0 ? index + 1 : 1;
        }
        
        return {
            total: groupedAppointments.length,
            timeRange: timeRange,
            position: position,
            appointments: groupedAppointments
        };
    }

    selectGroupedAppointments(groupId) {
        // Limpar seleção anterior
        this.clearSelection();
        
        const groupedAppointments = this.getGroupedAppointments(groupId);
        
        groupedAppointments.forEach(appointment => {
            const slot = document.querySelector(`[data-time="${appointment.time}"]`);
            if (slot) {
                const slotContent = slot.querySelector('.slot-content');
                if (slotContent) {
                    slotContent.classList.add('selected');
                }
            }
        });
        
        // Definir o primeiro agendamento do grupo como selecionado
        if (groupedAppointments.length > 0) {
            this.selectedAppointment = groupedAppointments[0];
        }
    }

    showAppointmentDetails(appointment) {
        const panelContent = document.getElementById('panel-content');
        const panelActions = document.getElementById('panel-actions');
        const panelTitle = document.getElementById('panel-title');
        
        panelTitle.textContent = appointment.service;
        
        const professional = this.professionals.find(p => p.name === appointment.professional);
        
        panelContent.innerHTML = `
            <div class="service-detail">
                <h3>${appointment.service}</h3>
                <div class="info-grid">
                    <div class="info-item">
                        <i>👤</i>
                        <div class="info-content">
                            <div class="label">Cliente</div>
                            <div class="value">${appointment.client}</div>
                        </div>
                    </div>
                    
                    <div class="info-item">
                        <i>📞</i>
                        <div class="info-content">
                            <div class="label">Telefone</div>
                            <div class="value">${appointment.clientPhone || 'Não informado'}</div>
                        </div>
                    </div>
                    
                    <div class="info-item">
                        <i>📅</i>
                        <div class="info-content">
                            <div class="label">Data</div>
                            <div class="value">${new Date(appointment.date).toLocaleDateString('pt-BR')}</div>
                        </div>
                    </div>
                    
                    <div class="info-item">
                        <i>⏰</i>
                        <div class="info-content">
                            <div class="label">Horário</div>
                            <div class="value">${appointment.time}${appointment.endTime ? ` - ${appointment.endTime}` : ''}</div>
                        </div>
                    </div>
                    
                    <div class="info-item">
                        <i>👨‍💼</i>
                        <div class="info-content">
                            <div class="label">Profissional</div>
                            <div class="value">${appointment.professionalName || professional?.name || 'N/A'}</div>
                        </div>
                    </div>
                    
                    <div class="info-item">
                        <i>💰</i>
                        <div class="info-content">
                            <div class="label">Valor</div>
                            <div class="value">R$ ${appointment.price.toFixed(2)}</div>
                        </div>
                    </div>
                    
                    <div class="info-item full-width">
                        <i>ℹ️</i>
                        <div class="info-content">
                            <div class="label">Status</div>
                            <div class="value">${this.getStatusLabel(appointment.status)}</div>
                        </div>
                    </div>
                    
                    ${appointment.notes ? `
                        <div class="info-item notes">
                            <i>📝</i>
                            <div class="info-content">
                                <div class="label">Observações</div>
                                <div class="value">${appointment.notes}</div>
                            </div>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
        
        panelActions.style.display = 'flex';
    }

    clearPanel() {
        const panelContent = document.getElementById('panel-content');
        const panelActions = document.getElementById('panel-actions');
        const panelTitle = document.getElementById('panel-title');
        
        panelTitle.textContent = 'Detalhes do Serviço';
        panelActions.style.display = 'none';
        
        this.clearSelection();
        
        panelContent.innerHTML = `
            <div class="empty-state">
                <div style="font-size: 64px; margin-bottom: 20px; opacity: 0.4; color: var(--primary-orange);">👆</div>
                <h4>Selecione um horário</h4>
                <p>Clique em um horário vazio para agendar um novo serviço ou em um agendamento para ver detalhes.</p>
            </div>
        `;
    }

    // ===== AÇÕES DOS SERVIÇOS =====
    async completeService() {
        if (!this.selectedAppointment) return;
        
        try {
            // Verificar se é um agendamento agrupado
            if (this.selectedAppointment.group_id) {
                const groupedAppointments = this.getGroupedAppointments(this.selectedAppointment.group_id);
                
                if (groupedAppointments.length > 1) {
                    const confirmMessage = `Este agendamento faz parte de um grupo com ${groupedAppointments.length} horários. Deseja finalizar todos os horários do grupo?`;
                    
                    if (confirm(confirmMessage)) {
                        // Finalizar todos os agendamentos do grupo
                        for (const appointment of groupedAppointments) {
                            await updateAgendamentoStatus(appointment.id, 'concluido', 'Serviço finalizado - Grupo');
                        }
                        this.showNotification(`${groupedAppointments.length} agendamentos do grupo finalizados com sucesso!`, 'success');
                    } else {
                        // Finalizar apenas o agendamento selecionado
                        await updateAgendamentoStatus(this.selectedAppointment.id, 'concluido', 'Serviço finalizado');
                        this.showNotification('Serviço finalizado com sucesso!', 'success');
                    }
                } else {
                    // Agendamento único
                    await updateAgendamentoStatus(this.selectedAppointment.id, 'concluido', 'Serviço finalizado');
                    this.showNotification('Serviço finalizado com sucesso!', 'success');
                }
            } else {
                // Agendamento sem grupo
                await updateAgendamentoStatus(this.selectedAppointment.id, 'concluido', 'Serviço finalizado');
                this.showNotification('Serviço finalizado com sucesso!', 'success');
            }
            
            await this.loadAppointmentsForCurrentDate();
            this.clearPanel();
            
        } catch (error) {
            console.error('Erro ao finalizar serviço:', error);
            this.showNotification('Erro ao finalizar serviço', 'error');
        }
    }

    async cancelService() {
        if (!this.selectedAppointment) return;
        
        try {
            // Verificar se é um agendamento agrupado
            if (this.selectedAppointment.group_id) {
                const groupedAppointments = this.getGroupedAppointments(this.selectedAppointment.group_id);
                
                if (groupedAppointments.length > 1) {
                    const confirmMessage = `Este agendamento faz parte de um grupo com ${groupedAppointments.length} horários. Deseja cancelar todos os horários do grupo?`;
                    
                    if (confirm(confirmMessage)) {
                        // Cancelar todos os agendamentos do grupo
                        for (const appointment of groupedAppointments) {
                            await updateAgendamentoStatus(appointment.id, 'cancelado', 'Cancelado pelo usuário - Grupo');
                        }
                        this.showNotification(`${groupedAppointments.length} agendamentos do grupo cancelados`, 'info');
                    } else {
                        return; // Usuário cancelou a operação
                    }
                } else {
                    // Agendamento único
                    if (confirm('Deseja realmente cancelar este agendamento?')) {
                        await updateAgendamentoStatus(this.selectedAppointment.id, 'cancelado', 'Cancelado pelo usuário');
                        this.showNotification('Agendamento cancelado', 'info');
                    } else {
                        return;
                    }
                }
            } else {
                // Agendamento sem grupo
                if (confirm('Deseja realmente cancelar este agendamento?')) {
                    await updateAgendamentoStatus(this.selectedAppointment.id, 'cancelado', 'Cancelado pelo usuário');
                    this.showNotification('Agendamento cancelado', 'info');
                } else {
                    return;
                }
            }
            
            await this.loadAppointmentsForCurrentDate();
            this.clearPanel();
            
        } catch (error) {
            console.error('Erro ao cancelar agendamento:', error);
            this.showNotification('Erro ao cancelar agendamento', 'error');
        }
    }



    // ===== MODAL DE AGENDAMENTO =====
    openAppointmentModal(time = '', appointment = null) {
        if (window.agendaModals) {
            window.agendaModals.openAppointmentModal(time, appointment);
        }
    }

    closeModal() {
        if (window.agendaModals) {
            window.agendaModals.closeModal();
        }
    }

    // ===== CONFIGURAÇÕES =====
    loadSettings() {
        const defaultSettings = {
            startTime: '07:00',
            endTime: '18:00',
            slotInterval: 30,
            workDays: [1, 2, 3, 4, 5, 6],
            notifications: true
        };
        
        const saved = localStorage.getItem('agenda-settings');
        return saved ? { ...defaultSettings, ...JSON.parse(saved) } : defaultSettings;
    }

    openSettings() {
        if (window.agendaConfig) {
            window.agendaConfig.openConfigModal();
        } else {
            this.showNotification('Sistema de configurações carregando...', 'info');
        }
    }

    // ===== UTILITÁRIOS =====
    async addAppointment(appointmentData) {
        try {
            // Para múltiplos horários, criar um agendamento para cada
            if (Array.isArray(appointmentData.times)) {
                // Gerar um group_id único para agendamentos múltiplos
                const groupId = appointmentData.times.length > 1 ? 
                    `group_${Date.now()}_${Math.random().toString(36).substr(2, 9)}` : null;
                
                const promises = appointmentData.times.map(time => {
                    const singleAppointment = {
                        ...appointmentData,
                        time: time,
                        date: appointmentData.date,
                        group_id: groupId  // Adicionar group_id para agendamentos múltiplos
                    };
                    delete singleAppointment.times;
                    return saveAgendamento(singleAppointment);
                });
                
                await Promise.all(promises);
            } else {
                await saveAgendamento(appointmentData);
            }
            
            await this.loadAppointmentsForCurrentDate();
            this.showNotification('Agendamento(s) salvo(s) com sucesso!', 'success');
            
        } catch (error) {
            console.error('Erro ao salvar agendamento:', error);
            throw error;
        }
    }

    async updateAppointment(appointmentData) {
        try {
            await updateAgendamento(appointmentData.id, appointmentData);
            await this.loadAppointmentsForCurrentDate();
            this.showNotification('Agendamento atualizado com sucesso!', 'success');
            
        } catch (error) {
            console.error('Erro ao atualizar agendamento:', error);
            throw error;
        }
    }

    isValidTime(time) {
        const [hours, minutes] = time.split(':').map(n => parseInt(n));
        const timeMinutes = hours * 60 + minutes;
        
        const startMinutes = this.timeToMinutes(this.settings.startTime);
        const endMinutes = this.timeToMinutes(this.settings.endTime);
        
        return timeMinutes >= startMinutes && timeMinutes < endMinutes;
    }

    timeToMinutes(timeString) {
        const [hours, minutes] = timeString.split(':').map(n => parseInt(n));
        return hours * 60 + minutes;
    }

    setLoadingState(isLoading) {
        this.isLoading = isLoading;
        
        if (isLoading) {
            // Mostrar loading SEM destruir a timeline
            const timeline = document.getElementById('timeline');
            const existingLoading = timeline.querySelector('.loading-state');
            
            if (!existingLoading) {
                const loadingDiv = document.createElement('div');
                loadingDiv.className = 'loading-state';
                loadingDiv.innerHTML = `
                    <div class="loading-spinner"></div>
                    <span>Carregando agendamentos...</span>
                `;
                timeline.appendChild(loadingDiv);
            }
        } else {
            // Remover apenas o loading, manter timeline
            const timeline = document.getElementById('timeline');
            const loadingDiv = timeline.querySelector('.loading-state');
            if (loadingDiv) {
                loadingDiv.remove();
            }
        }
    }

    showNotification(message, type = 'info') {
        // Remover notificação existente
        const existing = document.querySelector('.notification');
        if (existing) existing.remove();

        const notification = document.createElement('div');
        notification.className = 'notification';
        
        const bgColor = {
            'success': '#10b981',
            'error': '#ef4444',
            'warning': '#f59e0b',
            'info': '#3b82f6'
        }[type];
        
        const icon = {
            'success': '✅',
            'error': '❌',
            'warning': '⚠️',
            'info': 'ℹ️'
        }[type];
        
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${bgColor};
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            font-weight: 500;
            z-index: 1001;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            animation: slideIn 0.3s ease;
            max-width: 400px;
            display: flex;
            align-items: center;
            gap: 10px;
        `;
        
        notification.innerHTML = `
            <span>${icon}</span>
            <span>${message}</span>
        `;

        document.body.appendChild(notification);
        
        setTimeout(() => {
            if (notification.parentNode) {
                notification.style.animation = 'slideOut 0.3s ease forwards';
                setTimeout(() => notification.remove(), 300);
            }
        }, 4000);
    }
}

// ===== INICIALIZAÇÃO =====
let agendaServicos;

document.addEventListener('DOMContentLoaded', () => {
    agendaServicos = new AgendaServicos();
    
    // Disponibilizar globalmente para os modais
    window.agendaServicos = agendaServicos;
    
    console.log('🚀 Sistema de Agenda de Serviços integrado com Supabase carregado!');
});

// Exportar para uso global
window.AgendaServicos = AgendaServicos;
// agenda-servicos-agend.js - Formulários e Agendamento CORRIGIDO
// ================================================================

// Extensão da classe AgendaModals para funcionalidades de formulário
Object.assign(AgendaModals.prototype, {

    // ===== MANIPULAÇÃO DE FORMULÁRIO =====
    populateForm(appointment) {
        this.findAndSetSelectValue(this.elements.serviceSelect, appointment.service);
        this.findAndSetSelectValue(this.elements.clientSelect, appointment.client);
        // Encontrar o profissional pelo nome e definir o ID no select
        if (appointment.professional && window.agendaServicos && window.agendaServicos.professionals) {
            const prof = window.agendaServicos.professionals.find(p => p.name === appointment.professional);
            this.elements.professionalSelect.value = prof ? prof.id : '';
        } else {
            this.elements.professionalSelect.value = '';
        }
        this.elements.priceInput.value = appointment.price || '';
        this.elements.dateInput.value = appointment.date || '';
        this.elements.notesInput.value = appointment.notes || '';
        
        this.selectedTimes = appointment.time ? [appointment.time] : [];
    },

    findAndSetSelectValue(selectElement, textToFind) {
        for (let option of selectElement.options) {
            if (option.text.includes(textToFind) || option.text === textToFind) {
                selectElement.value = option.value;
                break;
            }
        }
    },

    resetForm() {
        this.elements.form.reset();
        this.selectedTimes = [];
        this.clearError();
    },

    getFormData() {
        const serviceOption = this.elements.serviceSelect.selectedOptions[0];
        const clientOption = this.elements.clientSelect.selectedOptions[0];
        const professionalOption = this.elements.professionalSelect.selectedOptions[0];
        
        return {
            service: serviceOption ? serviceOption.text.split(' - ')[0].trim() : '',
            client: clientOption ? clientOption.text.trim() : '',
            professionalName: professionalOption ? professionalOption.text.trim() : '',
            
            serviceId: this.elements.serviceSelect.value,
            clientId: this.elements.clientSelect.value,
            professional: this.elements.professionalSelect.value,
            
            price: parseFloat(this.elements.priceInput.value) || 0,
            date: this.elements.dateInput.value,
            times: [...this.selectedTimes],
            notes: this.elements.notesInput.value.trim()
        };
    },

    // ===== POPULAR SELECTS =====
    async populateServiceSelect() {
        try {
            const allServices = await loadServicosFromDB();
            
            // Filtrar serviços baseado no profissional selecionado na agenda
            let services = allServices;
            if (this.agenda && this.agenda.selectedProfessional) {
                // Encontrar o profissional selecionado
                const selectedProf = this.agenda.professionals.find(prof => 
                    prof.id === this.agenda.selectedProfessional
                );
                
                if (selectedProf) {
                    // Filtrar serviços que o profissional pode realizar
                    // Assumindo que existe um campo 'professionals' ou 'professional_ids' nos serviços
                    services = allServices.filter(service => {
                        // Se o serviço não tem profissionais específicos, todos podem fazer
                        if (!service.professionals && !service.professional_ids) {
                            return true;
                        }
                        
                        // Verificar se o profissional está na lista do serviço
                        if (service.professionals) {
                            return service.professionals.includes(selectedProf.auth_user_id) || 
                                   service.professionals.includes(selectedProf.id);
                        }
                        
                        if (service.professional_ids) {
                            return service.professional_ids.includes(selectedProf.auth_user_id) || 
                                   service.professional_ids.includes(selectedProf.id);
                        }
                        
                        return true;
                    });
                }
            }
            
            this.elements.serviceSelect.innerHTML = '<option value="">Selecionar serviço</option>';
            services.forEach(service => {
                const option = document.createElement('option');
                option.value = service.id;
                option.textContent = `${service.name} - R$ ${service.price.toFixed(2)}`;
                option.dataset.price = service.price;
                this.elements.serviceSelect.appendChild(option);
            });
            
        } catch (error) {
            console.error('Erro ao carregar serviços:', error);
        }
    },

    async populateClientSelect() {
        try {
            const clients = await loadClientesFromDB();
            
            this.elements.clientSelect.innerHTML = '<option value="">Selecionar cliente</option>';
            clients.forEach(client => {
                const option = document.createElement('option');
                option.value = client.id;
                option.textContent = client.nome;
                this.elements.clientSelect.appendChild(option);
            });
            
        } catch (error) {
            console.error('Erro ao carregar clientes:', error);
        }
    },

    async populateProfessionalSelect() {
        try {
            const client = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
            
            const { data: usuarios, error } = await client
                .from('user')
                .select('auth_user_id, nome, funcao')
                .eq('id_empresa', window.currentCompanyId)
                .order('nome');
            
            if (error) throw error;
            
            this.elements.professionalSelect.innerHTML = '<option value="">Selecionar profissional</option>';
            
            // Verificar se o usuário é funcionário
            const isEmployee = window.currentUser && window.currentUser.funcao === 'funcionario';
            
            if (isEmployee) {
                // Funcionário: mostrar apenas ele mesmo usando múltiplas estratégias
                let currentUserProfessional = null;
                
                if (window.currentUser) {
                    // Estratégia 1: Comparar por auth_user_id
                    currentUserProfessional = usuarios.find(user => 
                        user.auth_user_id === window.currentUser.auth_user_id
                    );
                    
                    // Estratégia 2: Comparar por nome (fallback)
                    if (!currentUserProfessional && window.currentUser.nome) {
                        currentUserProfessional = usuarios.find(user => 
                            user.nome === window.currentUser.nome
                        );
                    }
                }
                
                if (currentUserProfessional) {
                    const currentUserOption = document.createElement('option');
                    currentUserOption.value = currentUserProfessional.auth_user_id;
                    currentUserOption.textContent = currentUserProfessional.nome;
                    currentUserOption.selected = true;
                    this.elements.professionalSelect.appendChild(currentUserOption);
                    
                    // Desabilitar o select para funcionários
                    this.elements.professionalSelect.disabled = true;
                }
                
            } else {
                // Empreendedor: mostrar todos os profissionais
                // Encontrar o usuário logado usando múltiplas estratégias
                let loggedUser = null;
                if (window.currentUser) {
                    // Estratégia 1: Comparar por auth_user_id
                    loggedUser = usuarios.find(user => 
                        user.auth_user_id === window.currentUser.auth_user_id
                    );
                    
                    // Estratégia 2: Comparar por nome (fallback)
                    if (!loggedUser && window.currentUser.nome) {
                        loggedUser = usuarios.find(user => 
                            user.nome === window.currentUser.nome
                        );
                    }
                }
                
                // Sempre criar uma lista ordenada com o usuário logado primeiro
                let orderedUsers = [];
                
                if (loggedUser) {
                    // Adicionar o usuário logado primeiro
                    orderedUsers.push(loggedUser);
                    
                    // Adicionar os outros usuários (excluindo o logado)
                    const otherUsers = usuarios.filter(user => 
                        user.auth_user_id !== loggedUser.auth_user_id
                    );
                    orderedUsers = orderedUsers.concat(otherUsers);
                } else {
                    // Se não encontrou o usuário logado, usar a lista original
                    orderedUsers = [...usuarios];
                }
                
                // Adicionar opções ao select
                orderedUsers.forEach(user => {
                    const option = document.createElement('option');
                    option.value = user.auth_user_id;
                    option.textContent = user.nome;
                    this.elements.professionalSelect.appendChild(option);
                });
                
                // Habilitar o select para empreendedores
                this.elements.professionalSelect.disabled = false;
                
                // Selecionar o primeiro da lista (que deve ser o usuário logado)
                if (orderedUsers.length > 0) {
                    const firstUser = orderedUsers[0];
                    this.elements.professionalSelect.value = firstUser.auth_user_id;
                }
                
                // Fallback: usar o profissional selecionado na agenda principal
                if (!this.elements.professionalSelect.value && this.agenda && this.agenda.selectedProfessional) {
                    const selectedProf = this.agenda.professionals.find(prof => 
                        prof.id === this.agenda.selectedProfessional
                    );
                    
                    if (selectedProf && selectedProf.auth_user_id) {
                        this.elements.professionalSelect.value = selectedProf.auth_user_id;
                    }
                }
            }
            
        } catch (error) {
            console.error('Erro ao carregar usuários:', error);
        }
    },

    autoFillServiceData() {
        const priceInput = document.getElementById('price-input');
        const serviceSelect = document.getElementById('service-select');
        
        if (!priceInput || !serviceSelect) return;

        const selectedOption = serviceSelect.selectedOptions[0];
        if (selectedOption && selectedOption.dataset.price) {
            priceInput.value = parseFloat(selectedOption.dataset.price).toFixed(2);
        }
    },

    // ===== VALIDAÇÃO =====
    validateDateInput() {
        // Validação de data removida - permite agendar para qualquer data
        this.clearFieldError(this.elements.dateInput);
        return true;
    },

    validateForm() {
        const isBasicValid = this.elements.form.checkValidity();
        
        if (!isBasicValid) {
            this.elements.form.reportValidity();
            return false;
        }
        
        const requiredFields = [
            { element: this.elements.serviceSelect, message: 'Selecione um serviço' },
            { element: this.elements.clientSelect, message: 'Selecione um cliente' },
            { element: this.elements.professionalSelect, message: 'Selecione um profissional' },
            { element: this.elements.dateInput, message: 'Selecione uma data' }
        ];
        
        for (const field of requiredFields) {
            if (!field.element.value) {
                this.showFieldError(field.element, field.message);
                field.element.focus();
                return false;
            }
        }
        
        if (this.selectedTimes.length === 0) {
            this.showError('Selecione pelo menos um horário');
            return false;
        }
        
        return true;
    },

    showFieldError(field, message) {
        this.clearFieldError(field);
        
        field.classList.add('error');
        const errorSpan = document.createElement('span');
        errorSpan.className = 'field-error';
        errorSpan.textContent = message;
        errorSpan.style.cssText = `
            color: #c53030;
            font-size: 12px;
            margin-top: 4px;
            display: block;
        `;
        
        field.parentNode.appendChild(errorSpan);
    },

    clearFieldError(field) {
        field.classList.remove('error');
        const errorSpan = field.parentNode.querySelector('.field-error');
        if (errorSpan) errorSpan.remove();
    },

    // ===== SALVAMENTO =====
    async saveAppointment() {
        if (!this.validateForm()) return;
        
        const formData = this.getFormData();
        
        // Verificar permissões do usuário
        if (!this.validateUserPermissions(formData)) {
            return;
        }
        
        // Verificar conflitos de horário - USANDO A FUNÇÃO CORRIGIDA
        if (!this.currentAppointment && !(await this.checkTimeConflicts(formData))) {
            return;
        }
        
        this.setLoadingState(true);
        
        try {
            if (this.currentAppointment) {
                // Verificar conflitos ao editar (excluindo o próprio agendamento)
                if (!(await this.checkTimeConflicts(formData, this.currentAppointment.id))) {
                    this.setLoadingState(false);
                    return;
                }
                
                const appointmentData = {
                    id: this.currentAppointment.id,
                    service: formData.service,
                    client: formData.client,
                    professional: formData.professional,
                    professionalName: formData.professionalName,
                    date: formData.date,
                    time: formData.times[0],
                    price: formData.price,
                    notes: formData.notes
                };
                
                await this.agenda.updateAppointment(appointmentData);
                
            } else {
                const appointmentData = {
                    service: formData.service,
                    client: formData.client,
                    professional: formData.professional,
                    professionalName: formData.professionalName,
                    date: formData.date,
                    times: formData.times,
                    price: formData.price,
                    notes: formData.notes,
                    status: 'agendado'
                };
                
                await this.agenda.addAppointment(appointmentData);
            }
            
            this.closeModal();
            
        } catch (error) {
            console.error('Erro ao salvar agendamento:', error);
            this.showError(error.message || 'Erro ao salvar agendamento');
        } finally {
            this.setLoadingState(false);
        }
    },

    // ===== VALIDAÇÕES DE PERMISSÃO E CONFLITOS =====
    validateUserPermissions(formData) {
        // Verificar se usuário tem permissão para agendar para outros profissionais
        if (window.currentUser && window.currentUser.funcao === 'funcionario') {
            // Funcionário só pode agendar para si mesmo - comparar por nome
            const currentUserName = window.currentUser.nome;
            if (formData.professionalName !== currentUserName) {
                this.showError('Funcionários só podem agendar serviços para si mesmos.');
                return false;
            }
        }
        
        return true;
    },
    
    // FUNÇÃO CORRIGIDA - USA verificarConflitoHorario do agenda-servicos-supa.js
    async checkTimeConflicts(formData, excludeAppointmentId = null) {
        try {
            console.log('Verificando conflitos para:', {
                professionalName: formData.professionalName,
                date: formData.date,
                times: formData.times,
                excludeId: excludeAppointmentId
            });

            // Verificar cada horário selecionado usando a função corrigida do Supabase
            for (const selectedTime of formData.times) {
                const hasConflict = await verificarConflitoHorario(
                    formData.professionalName, // Nome do profissional
                    formData.date,
                    selectedTime + ':00', // Adicionar segundos
                    excludeAppointmentId
                );
                
                if (hasConflict) {
                    this.showError(`Conflito de horário: ${formData.professionalName} já possui um agendamento às ${selectedTime}.`);
                    return false;
                }
            }
            
            console.log('Nenhum conflito encontrado');
            return true;
            
        } catch (error) {
            console.error('Erro ao verificar conflitos:', error);
            this.showError('Erro ao verificar conflitos de horário.');
            return false;
        }
    },

    setLoadingState(isLoading) {
        this.elements.saveBtn.disabled = isLoading;
        this.elements.saveBtn.innerHTML = isLoading 
            ? 'Salvando...'
            : this.currentAppointment 
                ? 'Salvar Alterações'
                : 'Agendar Serviço';
    }
});
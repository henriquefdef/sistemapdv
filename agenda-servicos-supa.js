// agenda-servicos-supa.js - Integração com Supabase para Agenda de Serviços
// =========================================================================

// ===== FUNÇÕES DE AGENDAMENTOS =====

/**
 * Salvar agendamento - Enviando para coluna profissional
 */
async function saveAgendamento(appointmentData) {
    try {
        console.log('Dados recebidos para salvar:', appointmentData);

        if (!window.currentCompanyId || !window.currentUser) {
            throw new Error('Dados da empresa ou usuário não encontrados');
        }

        // Calcular hora_fim baseada na duração do serviço
        let horaFim = null;
        if (appointmentData.time) {
            let duracaoServico = 60; // padrão 60 minutos
            
            if (appointmentData.serviceId) {
                try {
                    const { data: servico } = await supabaseClient
                        .from('servicos')
                        .select('duracao')
                        .eq('id', appointmentData.serviceId)
                        .single();
                    
                    if (servico && servico.duracao) {
                        duracaoServico = parseInt(servico.duracao);
                    }
                } catch (error) {
                    console.warn('Erro ao buscar duração do serviço, usando padrão de 60 minutos');
                }
            }
            
            const [horas, minutos] = appointmentData.time.split(':');
            const inicioMinutos = parseInt(horas) * 60 + parseInt(minutos);
            const fimMinutos = inicioMinutos + duracaoServico;
            const fimHoras = Math.floor(fimMinutos / 60);
            const fimMins = fimMinutos % 60;
            
            horaFim = `${fimHoras.toString().padStart(2, '0')}:${fimMins.toString().padStart(2, '0')}:00`;
        }

        // Preparar dados - ENVIANDO NOME DO PROFISSIONAL PARA A COLUNA PROFISSIONAL
        const agendamentoData = {
            id_empresa: window.currentCompanyId,
            id_cliente: appointmentData.client || null,
            id_user: appointmentData.professionalName || null,
            id_servico: appointmentData.service || null,
            data_agendamento: appointmentData.date,
            hora_inicio: appointmentData.time ? `${appointmentData.time}:00` : null,
            hora_fim: horaFim,
            valor: appointmentData.price || 0,
            status: appointmentData.status || 'agendado',
            observacoes: appointmentData.notes || null,
            auth_user_id: window.currentUser.auth_user_id,
            profissional: appointmentData.professionalName || null,  // NOME DO PROFISSIONAL PARA VERIFICAÇÃO DE CONFLITO
            group_id: appointmentData.group_id || null
        };

        console.log('Dados preparados para inserção:', agendamentoData);

        const { data, error } = await supabaseClient
            .from('agendamentos')
            .insert(agendamentoData)
            .select();

        if (error) {
            console.error('Erro do Supabase ao salvar agendamento:', error);
            throw new Error(error.message || 'Erro ao salvar agendamento no banco de dados');
        }

        console.log('Agendamento salvo com sucesso:', data);
        return data[0];

    } catch (error) {
        console.error('Erro ao salvar agendamento:', error);
        throw error;
    }
}

/**
 * Carregar agendamentos do banco
 */
async function loadAgendamentosFromDB(startDate, endDate) {
    try {
        if (!window.currentCompanyId) {
            console.warn('ID da empresa não encontrado');
            return [];
        }

        // Usar formatação local para evitar problemas de fuso horário
        const startYear = startDate.getFullYear();
        const startMonth = String(startDate.getMonth() + 1).padStart(2, '0');
        const startDay = String(startDate.getDate()).padStart(2, '0');
        const startDateStr = `${startYear}-${startMonth}-${startDay}`;
        
        const endYear = endDate.getFullYear();
        const endMonth = String(endDate.getMonth() + 1).padStart(2, '0');
        const endDay = String(endDate.getDate()).padStart(2, '0');
        const endDateStr = `${endYear}-${endMonth}-${endDay}`;

        console.log('Carregando agendamentos de', startDateStr, 'até', endDateStr);

        const { data, error } = await supabaseClient
            .from('agendamentos')
            .select('*')
            .eq('id_empresa', window.currentCompanyId)
            .gte('data_agendamento', startDateStr)
            .lte('data_agendamento', endDateStr)
            .order('data_agendamento', { ascending: true })
            .order('hora_inicio', { ascending: true });

        if (error) {
            console.error('Erro do Supabase ao carregar agendamentos:', error);
            throw error;
        }

        console.log('Agendamentos carregados do banco:', data);

        return data.map(agendamento => ({
            id: agendamento.id,
            service: agendamento.id_servico || 'Serviço não encontrado',
            client: agendamento.id_cliente || 'Cliente não encontrado', 
            clientPhone: null,
            clientEmail: null,
            professional: agendamento.profissional, // Nome do profissional da coluna
            professionalName: agendamento.profissional || 'Profissional não encontrado',
            date: agendamento.data_agendamento,
            time: agendamento.hora_inicio ? agendamento.hora_inicio.substring(0, 5) : null,
            endTime: agendamento.hora_fim ? agendamento.hora_fim.substring(0, 5) : null,
            price: parseFloat(agendamento.valor || 0),
            status: agendamento.status || 'agendado',
            notes: agendamento.observacoes || '',
            createdAt: agendamento.created_at,
            group_id: agendamento.group_id || null
        }));

    } catch (error) {
        console.error('Erro ao carregar agendamentos:', error);
        return [];
    }
}

/**
 * Atualizar agendamento
 */
async function updateAgendamento(id, appointmentData) {
    try {
        console.log('Atualizando agendamento:', id, appointmentData);

        let horaFim = null;
        if (appointmentData.time && appointmentData.serviceId) {
            try {
                const { data: servico } = await supabaseClient
                    .from('servicos')
                    .select('duracao')
                    .eq('id', appointmentData.serviceId)
                    .single();
                
                const duracaoServico = servico?.duracao || 60;
                
                const [horas, minutos] = appointmentData.time.split(':');
                const inicioMinutos = parseInt(horas) * 60 + parseInt(minutos);
                const fimMinutos = inicioMinutos + parseInt(duracaoServico);
                const fimHoras = Math.floor(fimMinutes / 60);
                const fimMins = fimMinutos % 60;
                
                horaFim = `${fimHoras.toString().padStart(2, '0')}:${fimMins.toString().padStart(2, '0')}:00`;
            } catch (error) {
                console.warn('Erro ao calcular hora fim:', error);
            }
        }

        const updateData = {
            id_cliente: appointmentData.client || null,
            id_user: appointmentData.professionalName || null,
            id_servico: appointmentData.service || null,
            data_agendamento: appointmentData.date || null,
            hora_inicio: appointmentData.time ? `${appointmentData.time}:00` : null,
            hora_fim: horaFim,
            valor: appointmentData.price || 0,
            status: appointmentData.status || 'agendado',
            observacoes: appointmentData.notes || null,
            profissional: appointmentData.professionalName || null,
            group_id: appointmentData.group_id || null
        };

        Object.keys(updateData).forEach(key => {
            if (updateData[key] === undefined) {
                delete updateData[key];
            }
        });

        const { data, error } = await supabaseClient
            .from('agendamentos')
            .update(updateData)
            .eq('id', id)
            .select();

        if (error) {
            console.error('Erro do Supabase ao atualizar agendamento:', error);
            throw error;
        }

        console.log('Agendamento atualizado com sucesso:', data);
        return data[0];

    } catch (error) {
        console.error('Erro ao atualizar agendamento:', error);
        throw error;
    }
}

/**
 * Atualizar status do agendamento
 */
async function updateAgendamentoStatus(id, novoStatus, observacoes = null) {
    try {
        const updateData = {
            status: novoStatus
        };

        if (observacoes) {
            updateData.observacoes = observacoes;
        }

        const { data, error } = await supabaseClient
            .from('agendamentos')
            .update(updateData)
            .eq('id', id)
            .select();

        if (error) {
            console.error('Erro do Supabase ao atualizar status:', error);
            throw error;
        }

        console.log('Status do agendamento atualizado:', data);
        return data[0];

    } catch (error) {
        console.error('Erro ao atualizar status do agendamento:', error);
        throw error;
    }
}

/**
 * VERIFICAR CONFLITO DE HORÁRIO - FUNÇÃO CORRIGIDA
 * Verifica se existe conflito de horário para o MESMO profissional
 */
async function verificarConflitoHorario(professionalName, data, horaInicio, excludeId = null) {
    try {
        console.log('Verificando conflito para:', { professionalName, data, horaInicio, excludeId });
        
        if (!professionalName || !data || !horaInicio) {
            console.log('Parâmetros insuficientes para verificação');
            return false;
        }

        if (!window.currentCompanyId) {
            console.warn('ID da empresa não encontrado');
            return false;
        }

        let query = supabaseClient
            .from('agendamentos')
            .select('id, hora_inicio, hora_fim, profissional')
            .eq('id_empresa', window.currentCompanyId)
            .eq('profissional', professionalName) // BUSCAR PELO NOME DO PROFISSIONAL
            .eq('data_agendamento', data)
            .neq('status', 'cancelado');

        if (excludeId) {
            query = query.neq('id', excludeId);
        }

        const { data: agendamentos, error } = await query;

        if (error) {
            console.error('Erro ao verificar conflito:', error);
            return false;
        }

        console.log('Agendamentos encontrados para verificação:', agendamentos);

        // Converter horário de entrada para minutos (remover segundos se houver)
        const novoHorarioStr = horaInicio.length > 5 ? horaInicio.substring(0, 5) : horaInicio;
        const novoHorarioMinutos = timeToMinutes(novoHorarioStr);
        
        console.log('Novo horário em minutos:', novoHorarioMinutos, '(' + novoHorarioStr + ')');

        // Verificar sobreposição com agendamentos existentes
        const temConflito = agendamentos.some(agendamento => {
            if (!agendamento.hora_inicio) return false;

            const inicioExistente = timeToMinutes(agendamento.hora_inicio.substring(0, 5));
            const fimExistente = agendamento.hora_fim 
                ? timeToMinutes(agendamento.hora_fim.substring(0, 5))
                : inicioExistente + 60; // Duração padrão de 60 minutos

            console.log(`Comparando com agendamento ${agendamento.id}:`, {
                inicio: inicioExistente,
                fim: fimExistente,
                novo: novoHorarioMinutos
            });

            // Verificar se o novo horário está dentro do período de um agendamento existente
            const conflito = novoHorarioMinutos >= inicioExistente && novoHorarioMinutos < fimExistente;
            
            if (conflito) {
                console.log('CONFLITO DETECTADO!', {
                    agendamentoId: agendamento.id,
                    horarioExistente: agendamento.hora_inicio.substring(0, 5),
                    novoHorario: novoHorarioStr
                });
            }
            
            return conflito;
        });

        console.log('Resultado da verificação de conflito:', temConflito);
        return temConflito;

    } catch (error) {
        console.error('Erro ao verificar conflito de horário:', error);
        return false;
    }
}

/**
 * Converter horário para minutos
 */
function timeToMinutes(timeString) {
    if (!timeString) return 0;
    
    const [hours, minutes] = timeString.split(':').map(n => parseInt(n) || 0);
    return hours * 60 + minutes;
}

// ===== FUNÇÕES DE SERVIÇOS =====

/**
 * Carregar serviços do banco
 */
async function loadServicosFromDB() {
    try {
        if (!window.currentCompanyId) {
            console.warn('ID da empresa não encontrado');
            return [];
        }

        const { data, error } = await supabaseClient
            .from('servicos')
            .select('*')
            .eq('id_empresa', window.currentCompanyId)
            .eq('ativo', true)
            .order('nome');

        if (error) {
            console.error('Erro do Supabase ao carregar serviços:', error);
            throw error;
        }

        return data.map(servico => ({
            id: servico.id,
            name: servico.nome,
            price: parseFloat(servico.preco || 0),
            duration: parseInt(servico.duracao || 60),
            category: servico.categoria || '',
            description: servico.descricao || ''
        }));

    } catch (error) {
        console.error('Erro ao carregar serviços:', error);
        return [];
    }
}

/**
 * Salvar serviço
 */
async function saveServico(serviceData) {
    try {
        if (!window.currentCompanyId || !window.currentUser) {
            throw new Error('Dados da empresa ou usuário não encontrados');
        }

        const servicoData = {
            id_empresa: window.currentCompanyId,
            nome: serviceData.nome,
            preco: serviceData.preco,
            duracao: serviceData.duracao || 60,
            categoria: serviceData.categoria || null,
            descricao: serviceData.descricao || null,
            ativo: true,
            auth_user_id: window.currentUser.auth_user_id
        };

        const { data, error } = await supabaseClient
            .from('servicos')
            .insert(servicoData)
            .select();

        if (error) {
            console.error('Erro do Supabase ao salvar serviço:', error);
            throw error;
        }

        return data[0];

    } catch (error) {
        console.error('Erro ao salvar serviço:', error);
        throw error;
    }
}

/**
 * Atualizar serviço
 */
async function updateServico(id, serviceData) {
    try {
        const updateData = {
            nome: serviceData.nome,
            preco: serviceData.preco,
            duracao: serviceData.duracao || 60,
            categoria: serviceData.categoria || null,
            descricao: serviceData.descricao || null
        };

        const { data, error } = await supabaseClient
            .from('servicos')
            .update(updateData)
            .eq('id', id)
            .select();

        if (error) {
            console.error('Erro do Supabase ao atualizar serviço:', error);
            throw error;
        }

        return data[0];

    } catch (error) {
        console.error('Erro ao atualizar serviço:', error);
        throw error;
    }
}

/**
 * Excluir serviço (desativar)
 */
async function deleteServico(id) {
    try {
        const { data, error } = await supabaseClient
            .from('servicos')
            .update({ ativo: false })
            .eq('id', id)
            .select();

        if (error) {
            console.error('Erro do Supabase ao desativar serviço:', error);
            throw error;
        }

        return data[0];

    } catch (error) {
        console.error('Erro ao desativar serviço:', error);
        throw error;
    }
}

// ===== FUNÇÕES DE CLIENTES =====

/**
 * Carregar clientes do banco
 */
async function loadClientesFromDB() {
    try {
        if (!window.currentCompanyId) {
            console.warn('ID da empresa não encontrado');
            return [];
        }

        const { data, error } = await supabaseClient
            .from('clientes')
            .select('*')
            .eq('id_empresa', window.currentCompanyId)
            .order('nome');

        if (error) {
            console.error('Erro do Supabase ao carregar clientes:', error);
            throw error;
        }

        return data || [];

    } catch (error) {
        console.error('Erro ao carregar clientes:', error);
        return [];
    }
}

// ===== FUNÇÕES DE PROFISSIONAIS (USUÁRIOS) =====

/**
 * Carregar profissionais (usuários da empresa)
 */
async function loadProfissionaisFromDB() {
    try {
        if (!window.currentCompanyId) {
            console.warn('ID da empresa não encontrado');
            return [];
        }

        const { data, error } = await supabaseClient
            .from('user')
            .select('auth_user_id, nome')
            .eq('id_empresa', window.currentCompanyId)
            .order('nome');

        if (error) {
            console.error('Erro do Supabase ao carregar profissionais:', error);
            throw error;
        }

        return data.map(user => ({
            id: user.auth_user_id,
            name: user.nome
        }));

    } catch (error) {
        console.error('Erro ao carregar profissionais:', error);
        return [];
    }
}

// ===== FUNÇÕES UTILITÁRIAS =====

/**
 * Formatar data para o formato brasileiro
 */
function formatDateBR(dateString) {
    if (!dateString) return '';
    
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR');
}

/**
 * Formatar horário
 */
function formatTime(timeString) {
    if (!timeString) return '';
    
    return timeString.substring(0, 5);
}

/**
 * Validar dados do agendamento
 */
function validateAgendamentoData(data) {
    const errors = [];
    
    if (!data.client) errors.push('Cliente é obrigatório');
    if (!data.service) errors.push('Serviço é obrigatório');
    if (!data.professionalName) errors.push('Profissional é obrigatório');
    if (!data.date) errors.push('Data é obrigatória');
    if (!data.time) errors.push('Horário é obrigatório');
    if (data.price < 0) errors.push('Valor deve ser maior ou igual a zero');
    
    return {
        isValid: errors.length === 0,
        errors
    };
}

// Disponibilizar funções globalmente
window.supabaseAgenda = {
    saveAgendamento,
    loadAgendamentosFromDB,
    updateAgendamento,
    updateAgendamentoStatus,
    verificarConflitoHorario,
    loadServicosFromDB,
    saveServico,
    updateServico,
    deleteServico,
    loadClientesFromDB,
    loadProfissionaisFromDB,
    formatDateBR,
    formatTime,
    validateAgendamentoData,
    timeToMinutes
};

console.log('Sistema de integração com Supabase carregado - Verificação de conflito por nome do profissional');
// ===== CREDIÁRIO - MODAIS E FUNCIONALIDADES AVANÇADAS =====

// Variáveis globais para os modais
let currentPaymentData = null;
let currentWhatsAppData = null;

// ===== MODAL DE PAGAMENTO =====
async function openPaymentModal(crediariaId) {
    try {
        // Buscar dados da parcela
        const item = crediariosData.find(c => c.id == crediariaId);
        if (!item) {
            showNotification('Parcela não encontrada', 'error');
            return;
        }
        
        currentPaymentData = {
            id: item.id,
            cliente: item.cliente?.nome || 'Cliente não encontrado',
            venda: item.venda_id,
            parcela: item.numero_parcela,
            valorParcela: item.valor_parcela,
            valorPago: item.valor_pago || 0,
            saldoRestante: item.saldo_restante
        };
        
        // Preencher modal
        document.getElementById('payment-cliente').textContent = currentPaymentData.cliente;
        document.getElementById('payment-venda').textContent = `#${currentPaymentData.venda}`;
        document.getElementById('payment-parcela').textContent = currentPaymentData.parcela;
        document.getElementById('payment-valor-parcela').textContent = formatCurrency(currentPaymentData.valorParcela);
        document.getElementById('payment-valor-pago').textContent = formatCurrency(currentPaymentData.valorPago);
        document.getElementById('payment-saldo-restante').textContent = formatCurrency(currentPaymentData.saldoRestante);
        
        // Configurar campos
        document.getElementById('payment-valor').value = currentPaymentData.saldoRestante.toFixed(2);
        document.getElementById('payment-valor').max = currentPaymentData.saldoRestante;
        
        // Configurar data atual no fuso horário brasileiro
        const now = new Date();
        const brazilTime = new Date(now.toLocaleString("en-US", {timeZone: "America/Sao_Paulo"}));
        document.getElementById('payment-data').value = brazilTime.toISOString().split('T')[0];
        document.getElementById('payment-observacoes').value = '';
        
        // Configurar eventos do modal
        setupPaymentModalEvents();
        
        // Mostrar modal
        const modal = document.getElementById('payment-modal');
        modal.classList.remove('hidden');
        setTimeout(() => modal.classList.add('show'), 10);
        
    } catch (error) {
        console.error('Erro ao abrir modal de pagamento:', error);
        showNotification('Erro ao abrir modal de pagamento', 'error');
    }
}

function setupPaymentModalEvents() {
    // Remover eventos existentes
    const confirmBtn = document.getElementById('confirm-payment');
    const cancelBtn = document.getElementById('cancel-payment');
    
    // Clonar e substituir para remover eventos existentes
    const newConfirmBtn = confirmBtn.cloneNode(true);
    const newCancelBtn = cancelBtn.cloneNode(true);
    
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
    cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
    
    // Adicionar novos eventos
    newConfirmBtn.addEventListener('click', confirmPayment);
    newCancelBtn.addEventListener('click', closePaymentModal);
}

async function confirmPayment() {
    if (!currentPaymentData) return;
    
    const valor = parseFloat(document.getElementById('payment-valor').value);
    const data = document.getElementById('payment-data').value;
    const forma = document.getElementById('payment-forma').value;
    const observacoes = document.getElementById('payment-observacoes').value;
    
    // Validações
    if (!valor || valor <= 0) {
        showNotification('Informe um valor válido para o pagamento', 'error');
        return;
    }
    
    if (valor > currentPaymentData.saldoRestante) {
        showNotification(`O valor não pode ser maior que ${formatCurrency(currentPaymentData.saldoRestante)}`, 'error');
        return;
    }
    
    if (!data) {
        showNotification('Informe a data do pagamento', 'error');
        return;
    }
    
    try {
        // Calcular novo valor pago e status
        const novoValorPago = currentPaymentData.valorPago + valor;
        let novoStatus = 'pendente';
        
        if (novoValorPago >= currentPaymentData.valorParcela) {
            novoStatus = 'pago';
        } else if (novoValorPago > 0) {
            novoStatus = 'parcial';
        }
        
        // Converter data para horário brasileiro antes de salvar
        const paymentDate = new Date(data + 'T00:00:00');
        const brazilPaymentTime = new Date(paymentDate.toLocaleString("en-US", {timeZone: "America/Sao_Paulo"}));
        const brazilDateString = brazilPaymentTime.toISOString().split('T')[0];
        
        // Atualizar na tabela crediario
        const { error: updateError } = await supabaseClient
            .from('crediario')
            .update({
                valor_pago: novoValorPago,
                data_pagamento: brazilDateString,
                status: novoStatus,
                observacoes: observacoes || null
            })
            .eq('id', currentPaymentData.id);
        
        if (updateError) throw updateError;
        
        // Registrar na movimentação financeira
        await registrarMovimentacaoFinanceira(valor, data, forma, observacoes);
        
        showNotification('Pagamento registrado com sucesso!', 'success');
        closePaymentModal();
        loadCrediariosData(); // Recarregar dados
        
    } catch (error) {
        console.error('Erro ao registrar pagamento:', error);
        showNotification('Erro ao registrar pagamento', 'error');
    }
}

async function registrarMovimentacaoFinanceira(valor, data, forma, observacoes) {
    try {
        const descricao = `Recebimento Crediário - Venda #${currentPaymentData.venda} - Parcela ${currentPaymentData.parcela}`;
        
        // Converter data para horário brasileiro
        const paymentDate = new Date(data + 'T00:00:00');
        const brazilPaymentTime = new Date(paymentDate.toLocaleString("en-US", {timeZone: "America/Sao_Paulo"}));
        const brazilDateString = brazilPaymentTime.toISOString().split('T')[0];
        
        const movimentacao = {
            id_empresa: String(window.currentCompanyId),
            tipo: 'RECEBER',
            descricao: descricao,
            valor: valor,
            data_vencimento: brazilDateString,
            categoria: 'Crediário',
            pessoa_empresa: currentPaymentData.cliente,
            documento: `${currentPaymentData.venda}-P${currentPaymentData.parcela}`,
            observacoes: observacoes || `Pagamento via ${forma}`,
            recorrente: false,
            status: 'PAGO',
            auth_user_id: window.currentUser?.auth_user_id || null
        };
        
        await supabaseClient
            .from('movimentacoes_financeiras')
            .insert([movimentacao]);
            
    } catch (error) {
        console.error('Erro ao registrar movimentação financeira:', error);
        // Não falha o pagamento por causa disso
    }
}

function closePaymentModal() {
    const modal = document.getElementById('payment-modal');
    modal.classList.remove('show');
    setTimeout(() => {
        modal.classList.add('hidden');
        currentPaymentData = null;
    }, 300);
}

// ===== MODAL WHATSAPP =====
async function openWhatsAppModal(clienteId, vendaId, parcelaId = null) {
    try {
        // Buscar dados do cliente
        const { data: clienteData, error: clienteError } = await supabaseClient
            .from('clientes')
            .select('*')
            .eq('id', clienteId)
            .eq('id_empresa', window.currentCompanyId)
            .single();
        
        if (clienteError) {
            throw clienteError;
        }
        
        const cliente = clienteData;
        
        if (!cliente.telefone) {
            showNotification('Cliente não possui telefone cadastrado', 'warning');
            return;
        }
        
        let valorParcela, diasAtraso, dataVencimento, qtdParcelas;
        
        if (parcelaId) {
            // Se foi passado o ID da parcela específica, usar dados dessa parcela
            const parcelaEspecifica = crediariosData.find(c => c.id == parcelaId);
            
            if (parcelaEspecifica) {
                valorParcela = parcelaEspecifica.saldo_restante;
                dataVencimento = formatDate(parcelaEspecifica.data_vencimento);
                qtdParcelas = 1; // Uma parcela específica
                
                // Calcular dias de atraso para esta parcela específica
                if (parcelaEspecifica.is_overdue && parcelaEspecifica.status_calculado !== 'pago') {
                    diasAtraso = Math.floor((new Date() - new Date(parcelaEspecifica.data_vencimento)) / (1000 * 60 * 60 * 24));
                } else {
                    diasAtraso = 0;
                }
            } else {
                showNotification('Parcela não encontrada', 'error');
                return;
            }
        } else {
             // Comportamento agregado: buscar todas as parcelas em aberto da venda
             const parcelasEmAberto = crediariosData.filter(c => 
                 c.cliente_id == clienteId && c.venda_id === vendaId && c.saldo_restante > 0 && c.status_calculado !== 'pago'
             );
             
             if (parcelasEmAberto.length === 0) {
                 showNotification('Não há parcelas em aberto para esta venda', 'warning');
                 return;
             }
             
             // Função auxiliar para verificar se uma parcela está vencida
             const isParcelaVencida = (parcela) => {
                 if (!parcela.data_vencimento) return false;
                 const hoje = new Date();
                 const dataVencimento = new Date(parcela.data_vencimento);
                 hoje.setHours(0, 0, 0, 0);
                 dataVencimento.setHours(0, 0, 0, 0);
                 return dataVencimento < hoje;
             };
             
             // Buscar apenas parcelas vencidas usando nossa própria lógica
             const parcelasVencidas = parcelasEmAberto.filter(p => isParcelaVencida(p));
             
             console.log('Debug - Parcelas em aberto:', parcelasEmAberto.length);
             console.log('Debug - Parcelas vencidas:', parcelasVencidas.length);
             console.log('Debug - Parcelas vencidas detalhes:', parcelasVencidas.map(p => ({
                 id: p.id,
                 data_vencimento: p.data_vencimento,
                 is_overdue: p.is_overdue,
                 saldo_restante: p.saldo_restante
             })));
             
             if (parcelasVencidas.length > 0) {
                 // Calcular dados apenas das parcelas vencidas
                 qtdParcelas = parcelasVencidas.length;
                 valorParcela = parcelasVencidas.reduce((sum, p) => sum + p.saldo_restante, 0);
                 
                 // Maior atraso entre as parcelas vencidas
                 diasAtraso = Math.max(...parcelasVencidas.map(p => 
                     Math.floor((new Date() - new Date(p.data_vencimento)) / (1000 * 60 * 60 * 24))
                 ));
                 
                 // Data de vencimento da parcela mais antiga vencida
                 const parcelaMaisAntiga = parcelasVencidas.sort((a, b) => new Date(a.data_vencimento) - new Date(b.data_vencimento))[0];
                 dataVencimento = formatDate(parcelaMaisAntiga.data_vencimento);
             } else {
                 // Se não há parcelas vencidas, mostrar que não há parcelas vencidas
                 qtdParcelas = 0;
                 valorParcela = 0;
                 diasAtraso = 0;
                 
                 // Usar a próxima a vencer apenas para referência
                 const proximaVencer = parcelasEmAberto.sort((a, b) => new Date(a.data_vencimento) - new Date(b.data_vencimento))[0];
                 dataVencimento = formatDate(proximaVencer.data_vencimento);
             }
         }
        
        // Preparar dados customizados para o modal unificado
        const customData = {
            valorParcela: valorParcela,
            diasAtraso: diasAtraso,
            dataVencimento: dataVencimento,
            qtdParcelas: qtdParcelas,
            vendaId: vendaId,
            parcelaId: parcelaId
        };
        
        // Adicionar dados ao cliente para o modal unificado
        const clienteComDados = {
            ...cliente,
            valorParcela: valorParcela,
            diasAtraso: diasAtraso,
            dataVencimento: dataVencimento
        };
        
        // Abrir modal unificado com tipo cobrança
        if (window.whatsAppModalUnified) {
            window.whatsAppModalUnified.open(clienteComDados, 'cobranca', customData);
        } else {
            showNotification('Modal do WhatsApp não está disponível', 'error');
        }
        
    } catch (error) {
        console.error('Erro ao abrir modal WhatsApp:', error);
        showNotification('Erro ao carregar dados do cliente', 'error');
    }
}

// Funções removidas - agora usando modal unificado do WhatsApp

// Função removida - agora usando modal unificado do WhatsApp

// ===== MODAL DE HISTÓRICO =====
async function openHistoryModal(crediariaId) {
    try {
        // Buscar dados da parcela
        const item = crediariosData.find(c => c.id == crediariaId);
        if (!item) {
            showNotification('Parcela não encontrada', 'error');
            return;
        }
        
        // Preencher informações
        document.getElementById('history-cliente').textContent = item.cliente?.nome || 'Cliente não encontrado';
        document.getElementById('history-venda').textContent = `#${item.venda_id}`;
        document.getElementById('history-parcela').textContent = item.numero_parcela;
        
        // Configurar eventos do modal
        setupHistoryModalEvents();
        
        // Renderizar histórico
        const historyContent = document.getElementById('history-content');
        
        if (!item.data_pagamento) {
            historyContent.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-history"></i>
                    <h3>Nenhum pagamento registrado</h3>
                    <p>Esta parcela ainda não possui histórico de pagamentos.</p>
                </div>
            `;
        } else {
            historyContent.innerHTML = `
                <div class="timeline-item">
                    <div class="timeline-icon">
                        <i class="fas fa-dollar-sign"></i>
                    </div>
                    <div class="timeline-content">
                        <div class="timeline-header">
                            <div class="timeline-date">${formatDate(item.data_pagamento)}</div>
                            <div class="timeline-amount">${formatCurrency(item.valor_pago)}</div>
                        </div>
                        <div class="timeline-details">
                            <strong>Status:</strong> ${getStatusLabel(item.status_calculado)}<br>
                            ${item.observacoes ? `<strong>Observações:</strong> ${item.observacoes}<br>` : ''}
                            <strong>Última atualização:</strong> ${formatDateTime(item.created_at)}
                        </div>
                    </div>
                </div>
            `;
        }
        
        // Mostrar modal
        const modal = document.getElementById('history-modal');
        modal.classList.remove('hidden');
        setTimeout(() => modal.classList.add('show'), 10);
        
    } catch (error) {
        console.error('Erro ao carregar histórico:', error);
        showNotification('Erro ao carregar histórico', 'error');
    }
}

function setupHistoryModalEvents() {
    // Remover eventos existentes
    const closeBtn = document.getElementById('close-history');
    
    // Clonar e substituir para remover eventos existentes
    const newCloseBtn = closeBtn.cloneNode(true);
    closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);
    
    // Adicionar novos eventos
    newCloseBtn.addEventListener('click', closeHistoryModal);
}

function closeHistoryModal() {
    const modal = document.getElementById('history-modal');
    modal.classList.remove('show');
    setTimeout(() => {
        modal.classList.add('hidden');
    }, 300);
}

// ===== COBRANÇA EM LOTE =====
async function bulkCharge() {
    try {
        const clientesComParcelas = {};
        
        // Agrupar parcelas em aberto por cliente
        crediariosData.forEach(item => {
            if (item.saldo_restante > 0 && item.status_calculado !== 'pago' && item.cliente?.telefone) {
                const clienteId = item.cliente_id;
                if (!clientesComParcelas[clienteId]) {
                    clientesComParcelas[clienteId] = {
                        cliente: item.cliente,
                        parcelas: []
                    };
                }
                clientesComParcelas[clienteId].parcelas.push(item);
            }
        });
        
        const clientesCount = Object.keys(clientesComParcelas).length;
        
        if (clientesCount === 0) {
            showNotification('Não há clientes com parcelas em aberto e telefone cadastrado', 'warning');
            return;
        }
        
        const confirmacao = confirm(
            `Deseja enviar cobrança via WhatsApp para ${clientesCount} cliente(s) com parcelas em aberto?`
        );
        
        if (!confirmacao) return;
        
        // Abrir WhatsApp para cada cliente (com delay)
        let index = 0;
        for (const clienteId in clientesComParcelas) {
            const clienteData = clientesComParcelas[clienteId];
            const primeiraVenda = clienteData.parcelas[0].venda_id;
            
            setTimeout(() => {
                openWhatsAppModal(clienteId, primeiraVenda);
            }, index * 1500); // Delay de 1.5 segundos
            
            index++;
        }
        
        showNotification(`Preparando cobrança para ${clientesCount} cliente(s)`, 'info');
        
    } catch (error) {
        console.error('Erro na cobrança em lote:', error);
        showNotification('Erro ao processar cobrança em lote', 'error');
    }
}

// ===== FUNÇÕES AUXILIARES PARA MODAIS =====
function resetModalForms() {
    // Reset do modal de pagamento
    const paymentForm = document.querySelector('#payment-modal form');
    if (paymentForm) {
        paymentForm.reset();
    }
    
    // Reset dos campos específicos
    const valorInput = document.getElementById('payment-valor');
    const dataInput = document.getElementById('payment-data');
    const obsInput = document.getElementById('payment-observacoes');
    
    if (valorInput) valorInput.value = '';
    if (dataInput) dataInput.value = new Date().toISOString().split('T')[0];
    if (obsInput) obsInput.value = '';
    
    // Reset do modal WhatsApp
    const templateSelect = document.getElementById('whatsapp-template');
    const mensagemTextarea = document.getElementById('whatsapp-mensagem');
    
    if (templateSelect) templateSelect.value = 'profissional';
    if (mensagemTextarea) mensagemTextarea.value = '';
}

function validatePaymentForm() {
    const valor = parseFloat(document.getElementById('payment-valor').value);
    const data = document.getElementById('payment-data').value;
    
    const errors = [];
    
    if (!valor || valor <= 0) {
        errors.push('Valor do pagamento é obrigatório e deve ser maior que zero');
    }
    
    if (!data) {
        errors.push('Data do pagamento é obrigatória');
    }
    
    if (currentPaymentData && valor > currentPaymentData.saldoRestante) {
        errors.push(`Valor não pode ser maior que ${formatCurrency(currentPaymentData.saldoRestante)}`);
    }
    
    return {
        isValid: errors.length === 0,
        errors: errors
    };
}

function formatPhoneNumber(phone) {
    // Remove todos os caracteres não numéricos
    let cleaned = phone.replace(/\D/g, '');
    
    // Adiciona código do país se necessário
    if (cleaned.length === 10 || cleaned.length === 11) {
        cleaned = '55' + cleaned;
    }
    
    return cleaned;
}

function generateWhatsAppURL(phone, message) {
    const formattedPhone = formatPhoneNumber(phone);
    const encodedMessage = encodeURIComponent(message);
    return `https://wa.me/${formattedPhone}?text=${encodedMessage}`;
}

// ===== TRATAMENTO DE ERROS DOS MODAIS =====
function handleModalError(error, context) {
    console.error(`Erro no modal ${context}:`, error);
    
    let userMessage = 'Ocorreu um erro inesperado';
    
    switch (context) {
        case 'payment':
            userMessage = 'Erro ao processar pagamento';
            break;
        case 'whatsapp':
            userMessage = 'Erro ao preparar mensagem WhatsApp';
            break;
        case 'history':
            userMessage = 'Erro ao carregar histórico';
            break;
        case 'bulk':
            userMessage = 'Erro na cobrança em lote';
            break;
    }
    
    showNotification(userMessage, 'error');
}

// ===== VALIDAÇÕES ESPECÍFICAS =====
function validateWhatsAppData() {
    if (!currentWhatsAppData) {
        return { isValid: false, error: 'Dados do cliente não encontrados' };
    }
    
    if (!currentWhatsAppData.cliente.telefone) {
        return { isValid: false, error: 'Cliente não possui telefone cadastrado' };
    }
    
    const mensagem = document.getElementById('whatsapp-mensagem').value.trim();
    if (!mensagem) {
        return { isValid: false, error: 'Mensagem não pode estar vazia' };
    }
    
    return { isValid: true };
}

function validatePaymentData() {
    if (!currentPaymentData) {
        return { isValid: false, error: 'Dados da parcela não encontrados' };
    }
    
    const formValidation = validatePaymentForm();
    return formValidation;
}

// ===== DEBUG E LOGS =====
function logModalAction(action, data = {}) {
    console.log(`[MODAL] ${action}:`, {
        timestamp: new Date().toISOString(),
        ...data
    });
}

// Exportar funções para debug (apenas em desenvolvimento)
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    window.debugModals = {
        currentPaymentData,
        currentWhatsAppData,
        validatePaymentForm,
        validateWhatsAppData,
        formatPhoneNumber,
        generateWhatsAppURL
    };
}

// Exportar funções globais para uso nos templates HTML
window.openPaymentModal = openPaymentModal;
window.openWhatsAppModal = openWhatsAppModal;
window.openHistoryModal = openHistoryModal;

console.log('✅ Sistema de Crediário inicializado - Arquivo de Modais');
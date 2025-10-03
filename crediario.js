// ===== CREDIÁRIO - ARQUIVO PRINCIPAL =====
// ===== CONFIGURAÇÃO E ESTADO GLOBAL =====

// Estado da aplicação
let crediariosData = [];
let clientesData = [];
let filteredData = [];
let currentFilters = {};

// ===== UTILITÁRIOS =====
function formatCurrency(value) {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(value || 0);
}

function formatDate(dateString) {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('pt-BR');
}

function formatDateTime(dateString) {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('pt-BR');
}

function isOverdue(dateString) {
    if (!dateString) return false;
    const today = new Date();
    const dueDate = new Date(dateString);
    today.setHours(0, 0, 0, 0);
    dueDate.setHours(0, 0, 0, 0);
    return dueDate < today;
}

function isDueToday(dateString) {
    if (!dateString) return false;
    const today = new Date();
    const dueDate = new Date(dateString);
    return today.toDateString() === dueDate.toDateString();
}

function showNotification(message, type = 'info') {
    const existing = document.querySelector('.toast-notification');
    if (existing) existing.remove();

    const notification = document.createElement('div');
    notification.className = `toast-notification toast-${type}`;
    
    notification.style.cssText = `
        position: fixed;
        top: 2rem;
        right: 2rem;
        background: white;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        padding: 1rem 1.5rem;
        box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
        z-index: 1001;
        max-width: 400px;
        animation: slideInRight 0.3s ease;
        display: flex;
        align-items: center;
        gap: 0.75rem;
        font-size: 0.875rem;
        font-weight: 500;
    `;
    
    const colors = {
        success: { icon: 'fa-check-circle', color: '#1dd1a1' },
        error: { icon: 'fa-exclamation-circle', color: '#ff6b6b' },
        warning: { icon: 'fa-exclamation-triangle', color: '#fdcb6e' },
        info: { icon: 'fa-info-circle', color: '#74b9ff' }
    };
    
    const config = colors[type] || colors.info;
    
    notification.innerHTML = `
        <i class="fas ${config.icon}" style="color: ${config.color}; font-size: 1.125rem;"></i>
        <span style="color: #374151;">${message}</span>
        <button onclick="this.parentElement.remove()" 
                style="background: none; border: none; color: #9ca3af; cursor: pointer; padding: 0.25rem; margin-left: auto;">
            <i class="fas fa-times"></i>
        </button>
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
        if (notification.parentNode) {
            notification.style.animation = 'slideOutRight 0.3s ease forwards';
            setTimeout(() => notification.remove(), 300);
        }
    }, 5000);
}

function showLoading(show) {
    const overlay = document.getElementById('loading-overlay');
    overlay.classList.toggle('hidden', !show);
}

function refreshData() {
    loadCrediariosData();
    showNotification('Dados atualizados', 'success');
}

// ===== CARREGAMENTO DE DADOS =====
async function loadCrediariosData() {
    try {
        showLoading(true);
        
        // Buscar dados do crediário com informações do cliente
        const { data: crediarios, error } = await supabaseClient
            .from('crediario')
            .select(`
                *,
                clientes:cliente_id (
                    id,
                    nome,
                    telefone,
                    email
                )
            `)
            .eq('id_empresa', window.currentCompanyId)
            .order('data_vencimento', { ascending: true });

        if (error) throw error;

        // Processar dados
        crediariosData = crediarios.map(item => ({
            ...item,
            cliente: item.clientes,
            status_calculado: calculateStatus(item),
            is_overdue: isOverdue(item.data_vencimento),
            is_due_today: isDueToday(item.data_vencimento),
            saldo_restante: (item.valor_parcela || 0) - (item.valor_pago || 0)
        }));

        filteredData = [...crediariosData];
        
        renderTable();
        updateKPIs();
        
    } catch (error) {
        console.error('Erro ao carregar dados:', error);
        showNotification('Erro ao carregar dados do crediário', 'error');
    } finally {
        showLoading(false);
    }
}

function calculateStatus(item) {
    if (!item.valor_parcela) return 'pendente';
    
    const valorPago = item.valor_pago || 0;
    const valorParcela = item.valor_parcela;
    
    if (valorPago >= valorParcela) {
        return 'pago';
    } else if (valorPago > 0) {
        return 'parcial';
    } else if (isOverdue(item.data_vencimento)) {
        return 'vencido';
    } else {
        return 'pendente';
    }
}

// ===== RENDERIZAÇÃO DA TABELA =====
function renderTable() {
    const container = document.getElementById('crediario-table');
    const recordCount = document.getElementById('record-count');
    
    recordCount.textContent = `${filteredData.length} registro${filteredData.length !== 1 ? 's' : ''}`;
    
    if (filteredData.length === 0) {
        document.getElementById('empty-state').classList.remove('hidden');
        container.innerHTML = '';
        return;
    }
    
    document.getElementById('empty-state').classList.add('hidden');
    
    const table = document.createElement('table');
    table.className = 'data-table';
    
    table.innerHTML = `
        <thead>
            <tr>
                <th>Cliente</th>
                <th>Venda</th>
                <th>Parcela</th>
                <th>Valor</th>
                <th>Pago</th>
                <th>Saldo</th>
                <th>Vencimento</th>
                <th>Status</th>
                <th>Ações</th>
            </tr>
        </thead>
        <tbody>
            ${filteredData.map(item => createTableRow(item)).join('')}
        </tbody>
    `;
    
    container.innerHTML = '';
    container.appendChild(table);
}

function createTableRow(item) {
    const statusClass = item.status_calculado;
    const isOverdueFlag = item.is_overdue && item.status_calculado !== 'pago';
    const isDueTodayFlag = item.is_due_today && item.status_calculado !== 'pago';
    
    let rowClasses = '';
    if (isOverdueFlag) rowClasses += 'overdue ';
    if (isDueTodayFlag) rowClasses += 'due-today ';
    if (statusClass === 'pago') rowClasses += 'paid ';
    
    return `
        <tr data-id="${item.id}" class="${rowClasses}">
            <td>
                <div style="font-weight: 500; color: #374151;">${item.cliente?.nome || 'Cliente não encontrado'}</div>
                ${item.cliente?.telefone ? `<div style="font-size: 0.75rem; color: #6b7280;">${item.cliente.telefone}</div>` : ''}
            </td>
            <td>
                <span class="font-mono">#${item.venda_id}</span>
            </td>
            <td>
                <span style="font-weight: 500;">${item.numero_parcela}</span>
            </td>
            <td>
                <span style="font-weight: 600;">${formatCurrency(item.valor_parcela)}</span>
            </td>
            <td>
                <span class="text-success font-semibold">${formatCurrency(item.valor_pago || 0)}</span>
            </td>
            <td>
                <span style="font-weight: 600;" class="${item.saldo_restante > 0 ? 'text-error' : 'text-success'}">
                    ${formatCurrency(item.saldo_restante)}
                </span>
            </td>
            <td>
                <div style="font-weight: 500;">${formatDate(item.data_vencimento)}</div>
                ${isDueTodayFlag ? '<div style="font-size: 0.75rem;" class="text-warning font-semibold">Vence hoje</div>' : ''}
                ${isOverdueFlag ? '<div style="font-size: 0.75rem;" class="text-error font-semibold">Vencida</div>' : ''}
            </td>
            <td>
                <div class="status-badge ${statusClass}">
                    ${getStatusLabel(statusClass)}
                </div>
            </td>
            <td>
                <div class="action-buttons">
                    ${item.saldo_restante > 0 ? `
                        <button class="action-button pay" onclick="openPaymentModal('${item.id}')" title="Registrar Pagamento">
                            <i class="fas fa-dollar-sign"></i>
                        </button>
                    ` : ''}
                    ${item.cliente?.telefone ? `
                        <button class="action-button whatsapp" onclick="openWhatsAppModal('${item.cliente_id}', '${item.venda_id}')" title="Enviar Cobrança">
                            <i class="fab fa-whatsapp"></i>
                        </button>
                    ` : ''}
                    ${(item.valor_pago || 0) > 0 ? `
                        <button class="action-button history" onclick="openHistoryModal('${item.id}')" title="Ver Histórico">
                            <i class="fas fa-history"></i>
                        </button>
                    ` : ''}
                </div>
            </td>
        </tr>
    `;
}

function getStatusLabel(status) {
    const labels = {
        'pendente': 'Pendente',
        'pago': 'Pago',
        'vencido': 'Vencido',
        'parcial': 'Parcial'
    };
    return labels[status] || status;
}

// ===== ATUALIZAÇÃO DOS KPIs =====
function updateKPIs() {
    let totalAberto = 0;
    let totalVencidas = 0;
    let totalHoje = 0;
    let totalRecebido = 0;
    
    let countAberto = 0;
    let countVencidas = 0;
    let countHoje = 0;
    let countRecebido = 0;
    
    crediariosData.forEach(item => {
        const valorPago = item.valor_pago || 0;
        const saldoRestante = item.valor_parcela - valorPago;
        
        if (item.status_calculado === 'pago') {
            totalRecebido += item.valor_parcela;
            countRecebido++;
        } else {
            totalAberto += saldoRestante;
            countAberto++;
            
            if (item.is_overdue) {
                totalVencidas += saldoRestante;
                countVencidas++;
            } else if (item.is_due_today) {
                totalHoje += saldoRestante;
                countHoje++;
            }
        }
    });
    
    // Atualizar KPIs
    document.getElementById('kpi-total-aberto').textContent = formatCurrency(totalAberto);
    document.getElementById('kpi-total-parcelas').textContent = `${countAberto} parcela${countAberto !== 1 ? 's' : ''} pendente${countAberto !== 1 ? 's' : ''} | ${countVencidas} vencida${countVencidas !== 1 ? 's' : ''}`;
    
    document.getElementById('kpi-vencidas').textContent = formatCurrency(totalVencidas);
    document.getElementById('kpi-vencidas-count').textContent = `${countVencidas} parcela${countVencidas !== 1 ? 's' : ''} em atraso`;
    
    document.getElementById('kpi-hoje').textContent = formatCurrency(totalHoje);
    document.getElementById('kpi-hoje-count').textContent = `${countHoje} parcela${countHoje !== 1 ? 's' : ''} vencendo`;
    
    document.getElementById('kpi-recebido').textContent = formatCurrency(totalRecebido);
    document.getElementById('kpi-recebido-count').textContent = `${countRecebido} parcela${countRecebido !== 1 ? 's' : ''} quitada${countRecebido !== 1 ? 's' : ''}`;
}

// ===== FILTROS =====
function applyFilters() {
    const status = document.getElementById('filter-status').value;
    const cliente = document.getElementById('filter-cliente').value.toLowerCase();
    const dataInicio = document.getElementById('filter-data-inicio').value;
    const dataFim = document.getElementById('filter-data-fim').value;
    
    currentFilters = { status, cliente, dataInicio, dataFim };
    
    filteredData = crediariosData.filter(item => {
        // Filtro por status
        if (status && item.status_calculado !== status) {
            return false;
        }
        
        // Filtro por cliente
        if (cliente && !item.cliente?.nome?.toLowerCase().includes(cliente)) {
            return false;
        }
        
        // Filtro por data
        if (dataInicio || dataFim) {
            const dataVencimento = new Date(item.data_vencimento);
            
            if (dataInicio) {
                const inicio = new Date(dataInicio);
                if (dataVencimento < inicio) return false;
            }
            
            if (dataFim) {
                const fim = new Date(dataFim);
                if (dataVencimento > fim) return false;
            }
        }
        
        return true;
    });
    
    renderTable();
    showNotification(`${filteredData.length} registro(s) encontrado(s)`, 'info');
}

function clearFilters() {
    document.getElementById('filter-status').value = '';
    document.getElementById('filter-cliente').value = '';
    document.getElementById('filter-data-inicio').value = '';
    document.getElementById('filter-data-fim').value = '';
    
    currentFilters = {};
    filteredData = [...crediariosData];
    
    renderTable();
    showNotification('Filtros limpos', 'info');
}

// ===== EXPORTAÇÃO =====
async function exportData() {
    try {
        // Carregar biblioteca XLSX se necessário
        await loadSheetJSLibrary();
        
        // Mostrar loading
        const loadingModal = document.createElement('div');
        loadingModal.className = 'modal-overlay';
        loadingModal.innerHTML = `
            <div class="modal-content">
                <div class="loading-state">
                    <div class="spinner"></div>
                    <p>Gerando arquivo Excel...</p>
                </div>
            </div>
        `;
        document.body.appendChild(loadingModal);
        loadingModal.classList.add('show');
        
        // Preparar dados formatados
        const exportData = filteredData.map(item => ({
            'Cliente': item.cliente?.nome || '',
            'Telefone': item.cliente?.telefone || '',
            'Email': item.cliente?.email || '',
            'Venda ID': item.venda_id,
            'Número Parcela': item.numero_parcela,
            'Valor Parcela': parseFloat(item.valor_parcela || 0),
            'Valor Pago': parseFloat(item.valor_pago || 0),
            'Saldo Restante': parseFloat(item.saldo_restante || 0),
            'Data Vencimento': formatDate(item.data_vencimento),
            'Data Pagamento': item.data_pagamento ? formatDate(item.data_pagamento) : '',
            'Status': getStatusLabel(item.status_calculado),
            'Situação': item.is_overdue ? 'Vencida' : 
                       item.is_due_today ? 'Vence Hoje' : 'No Prazo',
            'Observações': item.observacoes || ''
        }));
        
        // Criar workbook Excel
        const workbook = XLSX.utils.book_new();
        const worksheet = XLSX.utils.json_to_sheet(exportData);
        
        // Definir larguras das colunas
        const columnWidths = [
            { wch: 25 }, // Cliente
            { wch: 15 }, // Telefone
            { wch: 30 }, // Email
            { wch: 12 }, // Venda ID
            { wch: 15 }, // Número Parcela
            { wch: 15 }, // Valor Parcela
            { wch: 15 }, // Valor Pago
            { wch: 15 }, // Saldo Restante
            { wch: 18 }, // Data Vencimento
            { wch: 18 }, // Data Pagamento
            { wch: 12 }, // Status
            { wch: 15 }, // Situação
            { wch: 30 }  // Observações
        ];
        worksheet['!cols'] = columnWidths;
        
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Crediário');
        
        // Gerar nome do arquivo com data e hora
        const now = new Date();
        const dateStr = now.toISOString().split('T')[0];
        const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-');
        const filename = `crediario_${dateStr}_${timeStr}.xlsx`;
        
        // Fazer download
        XLSX.writeFile(workbook, filename);
        
        // Remover loading
        document.body.removeChild(loadingModal);
        
        showNotification(`Arquivo Excel exportado: ${filename}`, 'success');
        
    } catch (error) {
        console.error('Erro na exportação:', error);
        
        // Remover loading se existir
        const loadingModal = document.querySelector('.modal-overlay');
        if (loadingModal) {
            document.body.removeChild(loadingModal);
        }
        
        showNotification('Erro ao exportar dados', 'error');
    }
}

// Função para carregar a biblioteca SheetJS se não estiver carregada
function loadSheetJSLibrary() {
    return new Promise((resolve, reject) => {
        // Verificar se já está carregada
        if (typeof XLSX !== 'undefined') {
            resolve();
            return;
        }
        
        // Carregar biblioteca
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
        script.onload = () => {
            console.log('✅ Biblioteca SheetJS carregada');
            resolve();
        };
        script.onerror = () => {
            reject(new Error('Erro ao carregar biblioteca SheetJS'));
        };
        document.head.appendChild(script);
    });
}

// ===== EVENT LISTENERS =====
function setupEventListeners() {
    // Filtros
    document.getElementById('apply-filters').addEventListener('click', applyFilters);
    document.getElementById('clear-filters').addEventListener('click', clearFilters);
    
    // Ações do header - verificar se os elementos existem antes de adicionar eventos
    const exportBtn = document.getElementById('export-btn');
    if (exportBtn) {
        exportBtn.addEventListener('click', exportData);
    }
    
    // Aplicar filtro com Enter
    document.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && e.target.closest('.filter-section')) {
            applyFilters();
        }
    });
    
    // Fechar modais com ESC
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closePaymentModal();
            closeWhatsAppModal();
            closeHistoryModal();
        }
    });
    
    // Fechar modais clicando fora
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal-overlay')) {
            closePaymentModal();
            closeWhatsAppModal();
            closeHistoryModal();
        }
    });
    
    // Botões de fechar modais
    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const modal = e.target.closest('.modal-overlay');
            if (modal) {
                if (modal.id === 'payment-modal') closePaymentModal();
                if (modal.id === 'whatsapp-modal') closeWhatsAppModal();
                if (modal.id === 'history-modal') closeHistoryModal();
            }
        });
    });
}

// ===== INICIALIZAÇÃO =====
function init() {
    if (!window.currentCompanyId) {
        showNotification('Erro de autenticação. Faça login novamente.', 'error');
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 2000);
        return;
    }
    
    setupEventListeners();
    loadCrediariosData();
    
    console.log('✅ Sistema de Crediário inicializado - Arquivo Principal');
}

// Aguardar dados do usuário
document.addEventListener('userDataReady', init);

// Fallback se os dados já estiverem prontos
document.addEventListener('DOMContentLoaded', () => {
    if (window.currentCompanyId) {
        init();
    }
});

// As funções dos modais são definidas em crediario-modal.js
// Elas são automaticamente disponibilizadas globalmente naquele arquivo
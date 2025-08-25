// ===== RELATÓRIO DE VENDAS - CORE & INICIALIZAÇÃO =====

// ===== ESTADO DA APLICAÇÃO =====
const relatorioState = {
    currentPeriod: 7,
    startDate: null,
    endDate: null,
    vendasData: [],
    vendedores: [],
    supabaseClient: null,
    filters: {
        vendedor: '',
        formaPagamento: '',
        canal: '',
        cliente: ''
    },
    statistics: {
        totalVendas: 0,
        numeroVendas: 0,
        produtosVendidos: 0,
        descontosConcedidos: 0,
        comparacao: {
            totalVendas: 0,
            numeroVendas: 0,
            produtosVendidos: 0,
            descontosConcedidos: 0
        }
    },
    todayStats: {
        vendas: 0,
        valor: 0,
        produtos: 0
    }
};

// ===== INICIALIZAÇÃO =====
document.addEventListener('DOMContentLoaded', () => {
    if (window.currentCompanyId) {
        initializeRelatorio();
    } else {
        document.addEventListener('userDataReady', initializeRelatorio);
    }
});

function initializeRelatorio() {
    if (!window.currentCompanyId) {
        console.error("ID da empresa não encontrado.");
        showNotification('Erro: ID da empresa não encontrado', 'error');
        return;
    }

    // Usar cliente Supabase existente se disponível
    relatorioState.supabaseClient = window.supabaseClient || supabase.createClient(
        'https://gnehkswoqlpchtlgyjyj.supabase.co',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImduZWhrc3dvcWxwY2h0bGd5anlqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM4OTY3NjYsImV4cCI6MjA2OTQ3Mjc2Nn0.8giA1bDvCzgvlcW_pkimGO9qHRF2I0QfhG6nx9U_tdY'
    );
    
    setupEventListeners();
    setupInitialDates();
    loadInitialData();
}

// ===== CONFIGURAÇÃO DE EVENTOS =====
function setupEventListeners() {
    // Botões de período
    document.querySelectorAll('.period-btn').forEach(btn => {
        btn.addEventListener('click', handlePeriodChange);
    });

    // Controles principais
    const applyCustomBtn = document.getElementById('apply-custom-period');
    const refreshBtn = document.getElementById('refresh-data');
    const exportBtn = document.getElementById('export-report');

    if (applyCustomBtn) applyCustomBtn.addEventListener('click', applyCustomPeriod);
    if (refreshBtn) refreshBtn.addEventListener('click', refreshData);
    if (exportBtn) exportBtn.addEventListener('click', exportReport);

    // Filtros avançados
    const toggleFiltersBtn = document.getElementById('toggle-filters');
    const applyFiltersBtn = document.getElementById('apply-filters');
    const clearFiltersBtn = document.getElementById('clear-filters');

    if (toggleFiltersBtn) toggleFiltersBtn.addEventListener('click', toggleFilters);
    if (applyFiltersBtn) applyFiltersBtn.addEventListener('click', applyFilters);
    if (clearFiltersBtn) clearFiltersBtn.addEventListener('click', clearFilters);

    // Controles do gráfico
    const chartTypeSelect = document.getElementById('chart-type');
    const chartPeriodSelect = document.getElementById('chart-period');

    if (chartTypeSelect) chartTypeSelect.addEventListener('change', updateChart);
    if (chartPeriodSelect) chartPeriodSelect.addEventListener('change', updateChart);
}

function setupInitialDates() {
    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - relatorioState.currentPeriod);
    
    relatorioState.startDate = startDate;
    relatorioState.endDate = today;
    
    // Configurar campos de data
    const startDateInput = document.getElementById('start-date');
    const endDateInput = document.getElementById('end-date');
    
    if (startDateInput) startDateInput.value = formatDateForInput(startDate);
    if (endDateInput) endDateInput.value = formatDateForInput(today);
}

// ===== CARREGAMENTO PRINCIPAL =====
async function loadInitialData() {
    try {
        showLoading(true);
        
        await Promise.all([
            loadVendasData(),
            loadVendedores(),
            loadTodayStats()
        ]);
        
        calculateStatistics();
        updateStatisticsDisplay();
        updateTodayDisplay();
        
        // Inicializar gráfico principal
        if (window.initializeChart) {
            window.initializeChart(relatorioState.vendasData);
        }
        
        // Inicializar gráficos adicionais
        setTimeout(() => {
            if (window.initializeAdditionalCharts) {
                window.initializeAdditionalCharts();
            }
        }, 500);
        
    } catch (error) {
        console.error('Erro ao carregar dados:', error);
        showNotification('Erro ao carregar dados do relatório', 'error');
    } finally {
        showLoading(false);
    }
}

// ===== MANIPULAÇÃO DE PERÍODOS =====
function handlePeriodChange(e) {
    const period = e.target.dataset.period;
    
    // Remover active de todos os botões
    document.querySelectorAll('.period-btn').forEach(btn => btn.classList.remove('active'));
    e.target.classList.add('active');

    const customDatesEl = document.getElementById('custom-dates');
    
    if (period === 'custom') {
        if (customDatesEl) customDatesEl.style.display = 'flex';
        return;
    }

    if (customDatesEl) customDatesEl.style.display = 'none';
    
    relatorioState.currentPeriod = parseInt(period);
    updatePeriodDates();
    refreshData();
}

function updatePeriodDates() {
    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - relatorioState.currentPeriod);
    
    relatorioState.startDate = startDate;
    relatorioState.endDate = today;
    
    const startDateInput = document.getElementById('start-date');
    const endDateInput = document.getElementById('end-date');
    
    if (startDateInput) startDateInput.value = formatDateForInput(startDate);
    if (endDateInput) endDateInput.value = formatDateForInput(today);
}

function applyCustomPeriod() {
    const startDateInput = document.getElementById('start-date');
    const endDateInput = document.getElementById('end-date');

    if (!startDateInput || !endDateInput) return;

    const startDateValue = startDateInput.value;
    const endDateValue = endDateInput.value;

    if (!startDateValue || !endDateValue) {
        showNotification('Selecione as datas de início e fim', 'warning');
        return;
    }

    const startDate = new Date(startDateValue);
    const endDate = new Date(endDateValue);

    if (startDate > endDate) {
        showNotification('Data de início deve ser anterior à data de fim', 'warning');
        return;
    }

    relatorioState.startDate = startDate;
    relatorioState.endDate = endDate;
    
    refreshData();
}

// ===== FILTROS =====
function toggleFilters() {
    const content = document.getElementById('filters-content');
    const button = document.getElementById('toggle-filters');
    
    if (!content || !button) return;
    
    const span = button.querySelector('span');
    
    if (content.style.display === 'none' || content.style.display === '') {
        content.style.display = 'block';
        if (span) span.textContent = 'Ocultar Filtros';
    } else {
        content.style.display = 'none';
        if (span) span.textContent = 'Mostrar Filtros';
    }
}

function applyFilters() {
    const vendedorEl = document.getElementById('filter-vendedor');
    const formaPagamentoEl = document.getElementById('filter-forma-pagamento');
    const canalEl = document.getElementById('filter-canal');
    const clienteEl = document.getElementById('filter-cliente');

    relatorioState.filters.vendedor = vendedorEl ? vendedorEl.value : '';
    relatorioState.filters.formaPagamento = formaPagamentoEl ? formaPagamentoEl.value : '';
    relatorioState.filters.canal = canalEl ? canalEl.value : '';
    relatorioState.filters.cliente = clienteEl ? clienteEl.value : '';
    
    refreshData();
}

function clearFilters() {
    relatorioState.filters = {
        vendedor: '',
        formaPagamento: '',
        canal: '',
        cliente: ''
    };
    
    // Limpar campos
    const vendedorEl = document.getElementById('filter-vendedor');
    const formaPagamentoEl = document.getElementById('filter-forma-pagamento');
    const canalEl = document.getElementById('filter-canal');
    const clienteEl = document.getElementById('filter-cliente');

    if (vendedorEl) vendedorEl.value = '';
    if (formaPagamentoEl) formaPagamentoEl.value = '';
    if (canalEl) canalEl.value = '';
    if (clienteEl) clienteEl.value = '';
    
    refreshData();
}

// ===== AÇÕES PRINCIPAIS =====
async function refreshData() {
    await loadInitialData();
}

function updateChart() {
    if (window.updateChart) {
        const chartTypeEl = document.getElementById('chart-type');
        const chartPeriodEl = document.getElementById('chart-period');
        
        const chartType = chartTypeEl ? chartTypeEl.value : 'valor';
        const chartPeriod = chartPeriodEl ? chartPeriodEl.value : 'day';
        
        window.updateChart(relatorioState.vendasData, chartType, chartPeriod);
    }
    
    // Atualizar gráficos adicionais
    if (window.updateAdditionalCharts) {
        window.updateAdditionalCharts();
    }
}

function exportReport() {
    try {
        if (!relatorioState.vendasData || relatorioState.vendasData.length === 0) {
            showNotification('Nenhum dado para exportar', 'warning');
            return;
        }

        // Preparar dados para exportação
        const reportData = relatorioState.vendasData.map(venda => ({
            'ID Venda': venda.id_venda,
            'Data': new Date(venda.hora_venda).toLocaleDateString('pt-BR'),
            'Cliente': venda.cliente_nome || 'Não informado',
            'Produto': venda.produto_nome,
            'Quantidade': venda.quantidade_unit,
            'Preço Unitário': formatCurrency(venda.preco_unitario),
            'Subtotal Item': formatCurrency(venda.subtotal_item),
            'Total Venda': formatCurrency(venda.total_venda),
            'Forma Pagamento': venda.forma_pagamento,
            'Canal': venda.canal_venda || 'presencial',
            'Vendedor ID': venda.vendedor_id
        }));

        // Converter para CSV
        const headers = Object.keys(reportData[0] || {});
        const csvContent = [
            headers.join(','),
            ...reportData.map(row => 
                headers.map(header => `"${row[header]}"`).join(',')
            )
        ].join('\n');

        // Download
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `relatorio_vendas_${formatDateForFilename(relatorioState.startDate)}_${formatDateForFilename(relatorioState.endDate)}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        showNotification('Relatório exportado com sucesso!', 'success');

    } catch (error) {
        console.error('Erro ao exportar relatório:', error);
        showNotification('Erro ao exportar relatório', 'error');
    }
}

// ===== UTILITÁRIOS =====
function formatCurrency(value) {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(value || 0);
}

function formatDateForInput(date) {
    return date.toISOString().split('T')[0];
}

function formatDateForFilename(date) {
    return date.toISOString().split('T')[0].replace(/-/g, '');
}

function showLoading(show) {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
        overlay.style.display = show ? 'flex' : 'none';
    }
}

function showNotification(message, type = 'info') {
    // Remover notificação existente
    const existing = document.querySelector('.notification');
    if (existing) {
        existing.remove();
    }

    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    
    const icons = {
        success: 'fa-check-circle',
        error: 'fa-exclamation-circle',
        warning: 'fa-exclamation-triangle',
        info: 'fa-info-circle'
    };
    
    notification.innerHTML = `
        <i class="fas ${icons[type]}"></i>
        <span>${message}</span>
        <button onclick="this.parentElement.remove()" 
                style="background: none; border: none; color: white; margin-left: auto; cursor: pointer; padding: 0.25rem;">
            <i class="fas fa-times"></i>
        </button>
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
        if (notification.parentNode) {
            notification.style.animation = 'slideInRight 0.3s ease-out reverse';
            setTimeout(() => notification.remove(), 300);
        }
    }, 5000);
}
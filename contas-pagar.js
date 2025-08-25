// ===== SISTEMA DE CONTAS A PAGAR E RECEBER =====

document.addEventListener('DOMContentLoaded', () => {
    document.addEventListener('userDataReady', initializeFinanceiro);
});

// Estado global da aplicação
const state = {
    currentYear: new Date().getFullYear(),
    currentMonth: new Date().getMonth(),
    currentTab: 'receber',
    modalType: 'pagar', // 'pagar' ou 'receber'
    movimentacoes: [],
    chartData: {
        receitas: Array(12).fill(0),
        despesas: Array(12).fill(0)
    },
    chart: null,
    supabaseClient: null
};

// Configuração do Supabase
function initializeFinanceiro() {
    if (!window.currentCompanyId) {
        console.error("ID da empresa não encontrado.");
        return;
    }

    state.supabaseClient = supabase.createClient(
        'https://gnehkswoqlpchtlgyjyj.supabase.co',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImduZWhrc3dvcWxwY2h0bGd5anlqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM4OTY3NjYsImV4cCI6MjA2OTQ3Mjc2Nn0.8giA1bDvCzgvlcW_pkimGO9qHRF2I0QfhG6nx9U_tdY'
    );

    setupEventListeners();
    loadInitialData();
}

// ===== CONFIGURAÇÃO DE EVENTOS =====
function setupEventListeners() {
    // Botões de nova movimentação
    document.getElementById('btn-nova-conta-pagar').addEventListener('click', () => openModal('pagar'));
    document.getElementById('btn-nova-conta-receber').addEventListener('click', () => openModal('receber'));

    // Navegação de ano
    document.getElementById('prev-year').addEventListener('click', () => changeYear(-1));
    document.getElementById('next-year').addEventListener('click', () => changeYear(1));

    // Navegação de meses
    document.querySelectorAll('.month-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const month = parseInt(e.target.dataset.month);
            selectMonth(month);
        });
    });

    // Abas
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
            const tabType = e.target.dataset.tab;
            selectTab(tabType);
        });
    });

    // Modal
    document.getElementById('modal-close').addEventListener('click', closeModal);
    document.getElementById('btn-cancelar').addEventListener('click', closeModal);
    document.getElementById('modal-movimentacao').addEventListener('click', (e) => {
        if (e.target.id === 'modal-movimentacao') closeModal();
    });

    // Formulário
    document.getElementById('form-movimentacao').addEventListener('submit', handleFormSubmit);
}

// ===== CARREGAMENTO INICIAL DE DADOS =====
async function loadInitialData() {
    try {
        await Promise.all([
            loadCategorias(),
            loadMovimentacoesYear(),
            loadSummaryData()
        ]);

        initializeChart();
        updateUI();
        selectMonth(state.currentMonth);
    } catch (error) {
        console.error('Erro ao carregar dados iniciais:', error);
        showError('Erro ao carregar dados iniciais');
    }
}

async function loadCategorias() {
    try {
        // Primeiro, tentar buscar categorias financeiras específicas
        let { data: categorias, error } = await state.supabaseClient
            .from('categorias_financeiras')
            .select('*')
            .eq('id_empresa', window.currentCompanyId)
            .eq('ativo', true);

        if (error && error.code === '42P01') {
            // Se a tabela não existir, criar categorias padrão
            categorias = await createDefaultCategorias();
        } else if (error) {
            throw error;
        }

        // Se não há categorias, usar as de produtos como fallback
        if (!categorias || categorias.length === 0) {
            const { data: prodCategorias, error: prodError } = await state.supabaseClient
                .from('categorias')
                .select('*')
                .eq('id_empresa', window.currentCompanyId);

            if (prodError) throw prodError;
            categorias = prodCategorias || [];
        }

        populateCategoriaSelect(categorias);
    } catch (error) {
        console.error('Erro ao carregar categorias:', error);
        // Usar categorias padrão se houver erro
        populateCategoriaSelect([]);
    }
}

async function createDefaultCategorias() {
    const defaultCategorias = [
        { nome: 'Fornecedores', tipo: 'PAGAR', cor: '#e74c3c' },
        { nome: 'Aluguel', tipo: 'PAGAR', cor: '#3498db' },
        { nome: 'Impostos', tipo: 'PAGAR', cor: '#f39c12' },
        { nome: 'Salários', tipo: 'PAGAR', cor: '#9b59b6' },
        { nome: 'Vendas', tipo: 'RECEBER', cor: '#27ae60' },
        { nome: 'Serviços', tipo: 'RECEBER', cor: '#1abc9c' },
        { nome: 'Outros', tipo: 'AMBOS', cor: '#34495e' }
    ];

    try {
        const categoriasParaInserir = defaultCategorias.map(cat => ({
            ...cat,
            id_empresa: window.currentCompanyId,
            ativo: true
        }));

        const { data, error } = await state.supabaseClient
            .from('categorias_financeiras')
            .insert(categoriasParaInserir)
            .select();

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Erro ao criar categorias padrão:', error);
        return defaultCategorias;
    }
}

function populateCategoriaSelect(categorias) {
    const select = document.getElementById('categoria');
    const currentValue = select.value;
    
    // Limpar opções existentes (exceto a primeira)
    while (select.children.length > 1) {
        select.removeChild(select.lastChild);
    }

    categorias.forEach(categoria => {
        const option = document.createElement('option');
        option.value = categoria.id || categoria.nome;
        option.textContent = categoria.nome;
        select.appendChild(option);
    });

    // Restaurar valor selecionado se ainda existir
    if (currentValue) {
        select.value = currentValue;
    }
}

async function loadMovimentacoesYear() {
    try {
        const startDate = `${state.currentYear}-01-01`;
        const endDate = `${state.currentYear}-12-31`;

        const { data, error } = await state.supabaseClient
            .from('movimentacoes_financeiras')
            .select('*')
            .eq('id_empresa', window.currentCompanyId)
            .gte('data_vencimento', startDate)
            .lte('data_vencimento', endDate)
            .order('data_vencimento', { ascending: false });

        if (error) throw error;

        state.movimentacoes = data || [];
        processChartData();
    } catch (error) {
        console.error('Erro ao carregar movimentações:', error);
        state.movimentacoes = [];
        state.chartData = { receitas: Array(12).fill(0), despesas: Array(12).fill(0) };
    }
}

function processChartData() {
    // Reset dos dados
    state.chartData = {
        receitas: Array(12).fill(0),
        despesas: Array(12).fill(0)
    };

    state.movimentacoes.forEach(mov => {
        const data = new Date(mov.data_vencimento);
        const mes = data.getMonth();
        const valor = parseFloat(mov.valor || 0);

        if (mov.tipo === 'RECEBER') {
            state.chartData.receitas[mes] += valor;
        } else if (mov.tipo === 'PAGAR') {
            state.chartData.despesas[mes] += valor;
        }
    });
}

async function loadSummaryData() {
    try {
        const hoje = new Date();
        const primeiroDiaMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
        const ultimoDiaMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);

        // Carregar dados do mês atual
        const { data, error } = await state.supabaseClient
            .from('movimentacoes_financeiras')
            .select('tipo, valor, status')
            .eq('id_empresa', window.currentCompanyId)
            .gte('data_vencimento', primeiroDiaMes.toISOString().split('T')[0])
            .lte('data_vencimento', ultimoDiaMes.toISOString().split('T')[0]);

        if (error) throw error;

        let totalReceber = 0;
        let totalPagar = 0;

        (data || []).forEach(mov => {
            const valor = parseFloat(mov.valor || 0);
            if (mov.status !== 'PAGO') {
                if (mov.tipo === 'RECEBER') {
                    totalReceber += valor;
                } else if (mov.tipo === 'PAGAR') {
                    totalPagar += valor;
                }
            }
        });

        const saldoAtual = totalReceber - totalPagar;

        // Atualizar elementos na página
        document.getElementById('saldo-atual').textContent = formatCurrency(saldoAtual);
        document.getElementById('total-receber').textContent = formatCurrency(totalReceber);
        document.getElementById('total-pagar').textContent = formatCurrency(totalPagar);

    } catch (error) {
        console.error('Erro ao carregar dados de resumo:', error);
        document.getElementById('saldo-atual').textContent = 'R$ 0,00';
        document.getElementById('total-receber').textContent = 'R$ 0,00';
        document.getElementById('total-pagar').textContent = 'R$ 0,00';
    }
}

// ===== GRÁFICO =====
function initializeChart() {
    const ctx = document.getElementById('financial-chart').getContext('2d');
    
    if (state.chart) {
        state.chart.destroy();
    }

    state.chart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'],
            datasets: [
                {
                    label: 'Receitas',
                    data: state.chartData.receitas,
                    backgroundColor: '#27ae60',
                    borderColor: '#229954',
                    borderWidth: 1
                },
                {
                    label: 'Despesas',
                    data: state.chartData.despesas,
                    backgroundColor: '#e74c3c',
                    borderColor: '#c0392b',
                    borderWidth: 1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                intersect: false,
                mode: 'index'
            },
            plugins: {
                legend: {
                    position: 'top',
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return context.dataset.label + ': ' + formatCurrency(context.parsed.y);
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return formatCurrency(value);
                        }
                    }
                }
            },
            onClick: (event, activeElements) => {
                if (activeElements.length > 0) {
                    const clickedMonth = activeElements[0].index;
                    selectMonth(clickedMonth);
                }
            }
        }
    });
}

// ===== NAVEGAÇÃO =====
function changeYear(direction) {
    state.currentYear += direction;
    document.getElementById('current-year').textContent = state.currentYear;
    loadMovimentacoesYear().then(() => {
        updateChart();
        updateMovimentacoesList();
    });
}

function selectMonth(month) {
    state.currentMonth = month;
    
    // Atualizar UI dos botões de mês
    document.querySelectorAll('.month-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelector(`[data-month="${month}"]`).classList.add('active');

    // Atualizar título da seção
    const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
                       'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    document.getElementById('section-title').textContent = 
        `Movimentações de ${monthNames[month]}/${state.currentYear}`;

    updateMovimentacoesList();
}

function selectTab(tab) {
    state.currentTab = tab;
    
    // Atualizar UI das abas
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelector(`[data-tab="${tab}"]`).classList.add('active');

    updateMovimentacoesList();
}

// ===== MODAL =====
function openModal(tipo) {
    state.modalType = tipo;
    
    const modal = document.getElementById('modal-movimentacao');
    const title = document.getElementById('modal-title');
    const saveBtn = document.getElementById('btn-salvar');

    if (tipo === 'pagar') {
        title.textContent = 'Nova Conta a Pagar';
        saveBtn.textContent = 'Salvar Conta a Pagar';
        saveBtn.className = 'btn-primary';
        saveBtn.style.background = 'linear-gradient(135deg, #e74c3c, #c0392b)';
    } else {
        title.textContent = 'Nova Conta a Receber';
        saveBtn.textContent = 'Salvar Conta a Receber';
        saveBtn.className = 'btn-primary btn-success';
        saveBtn.style.background = 'linear-gradient(135deg, #27ae60, #229954)';
    }

    // Limpar formulário
    document.getElementById('form-movimentacao').reset();
    
    // Definir data padrão como hoje
    const hoje = new Date().toISOString().split('T')[0];
    document.getElementById('data_vencimento').value = hoje;

    modal.classList.add('show');
}

function closeModal() {
    const modal = document.getElementById('modal-movimentacao');
    modal.classList.remove('show');
}

// ===== FORMULÁRIO =====
async function handleFormSubmit(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const movimentacao = {
        id_empresa: window.currentCompanyId,
        tipo: state.modalType.toUpperCase(),
        descricao: formData.get('descricao') || document.getElementById('descricao').value,
        valor: parseFloat(document.getElementById('valor').value),
        data_vencimento: document.getElementById('data_vencimento').value,
        categoria: document.getElementById('categoria').value || null,
        pessoa_empresa: document.getElementById('pessoa_empresa').value || null,
        documento: document.getElementById('documento').value || null,
        observacoes: document.getElementById('observacoes').value || null,
        status: 'PENDENTE',
        created_by: window.currentUser?.auth_user_id
    };

    try {
        const { data, error } = await state.supabaseClient
            .from('movimentacoes_financeiras')
            .insert([movimentacao])
            .select();

        if (error) throw error;

        showSuccess(`${state.modalType === 'pagar' ? 'Conta a pagar' : 'Conta a receber'} cadastrada com sucesso!`);
        
        closeModal();
        await loadMovimentacoesYear();
        await loadSummaryData();
        updateChart();
        updateMovimentacoesList();

    } catch (error) {
        console.error('Erro ao salvar movimentação:', error);
        showError('Erro ao salvar movimentação: ' + error.message);
    }
}

// ===== ATUALIZAÇÃO DA UI =====
function updateUI() {
    document.getElementById('current-year').textContent = state.currentYear;
    selectMonth(state.currentMonth);
}

function updateChart() {
    if (state.chart) {
        state.chart.data.datasets[0].data = state.chartData.receitas;
        state.chart.data.datasets[1].data = state.chartData.despesas;
        state.chart.update();
    }
}

function updateMovimentacoesList() {
    const container = document.getElementById('movimentacoes-list');
    
    // Filtrar movimentações do mês e tipo atual
    const movimentacoesFiltradas = state.movimentacoes.filter(mov => {
        const data = new Date(mov.data_vencimento);
        const isCurrentMonth = data.getMonth() === state.currentMonth && data.getFullYear() === state.currentYear;
        const isCurrentType = mov.tipo.toLowerCase() === state.currentTab.toLowerCase();
        return isCurrentMonth && isCurrentType;
    });

    if (movimentacoesFiltradas.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-inbox"></i>
                <p>Nenhuma movimentação encontrada para este período</p>
            </div>
        `;
        return;
    }

    container.innerHTML = movimentacoesFiltradas.map(mov => `
        <div class="movimentacao-item" data-id="${mov.id}">
            <div class="movimentacao-info">
                <div class="movimentacao-descricao">${mov.descricao}</div>
                <div class="movimentacao-detalhes">
                    ${mov.pessoa_empresa ? `${mov.pessoa_empresa} • ` : ''}
                    Vencimento: ${formatDate(mov.data_vencimento)}
                    ${mov.categoria ? ` • ${mov.categoria}` : ''}
                </div>
            </div>
            <div class="movimentacao-valor ${mov.tipo.toLowerCase()}">
                ${formatCurrency(mov.valor)}
            </div>
            <div class="status-badge ${mov.status.toLowerCase()}">
                ${getStatusLabel(mov.status)}
            </div>
        </div>
    `).join('');
}

// ===== FUNÇÕES UTILITÁRIAS =====
function formatCurrency(value) {
    if (typeof value !== 'number') value = parseFloat(value) || 0;
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(value);
}

function formatDate(dateString) {
    const date = new Date(dateString + 'T00:00:00');
    return date.toLocaleDateString('pt-BR');
}

function getStatusLabel(status) {
    const labels = {
        'PENDENTE': 'Pendente',
        'PAGO': 'Pago',
        'VENCIDO': 'Vencido'
    };
    return labels[status] || status;
}

function showSuccess(message) {
    showNotification(message, 'success');
}

function showError(message) {
    showNotification(message, 'error');
}

function showNotification(message, type) {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i>
        <span>${message}</span>
    `;
    
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'success' ? '#27ae60' : '#e74c3c'};
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10000;
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-weight: 500;
        max-width: 400px;
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
        if (notification.parentNode) {
            document.body.removeChild(notification);
        }
    }, 5000);
}

// ===== FUNÇÕES UTILITÁRIAS ADICIONAIS PARA O SISTEMA FINANCEIRO =====

/**
 * Funcionalidades avançadas para o sistema de contas a pagar e receber
 */

// Adicionar ao final do arquivo contas-financeiro.js

// ===== FUNÇÕES DE VALIDAÇÃO =====
function validateForm(formData) {
    const errors = [];
    
    if (!formData.descricao || formData.descricao.trim().length < 3) {
        errors.push('Descrição deve ter pelo menos 3 caracteres');
    }
    
    if (!formData.valor || formData.valor <= 0) {
        errors.push('Valor deve ser maior que zero');
    }
    
    if (!formData.data_vencimento) {
        errors.push('Data de vencimento é obrigatória');
    }
    
    return errors;
}

// ===== FUNÇÕES DE EXPORTAÇÃO =====
async function exportToExcel() {
    try {
        // Simular loading
        showNotification('Gerando relatório...', 'info');
        
        const movimentacoes = await getAllMovimentacoes();
        
        // Aqui você pode integrar com uma biblioteca como SheetJS
        // Por enquanto, vamos simular o download
        const csvContent = generateCSV(movimentacoes);
        downloadCSV(csvContent, `movimentacoes-${state.currentYear}.csv`);
        
        showSuccess('Relatório exportado com sucesso!');
    } catch (error) {
        console.error('Erro ao exportar:', error);
        showError('Erro ao exportar relatório');
    }
}

function generateCSV(data) {
    const headers = ['Data', 'Tipo', 'Descrição', 'Valor', 'Status', 'Categoria', 'Pessoa/Empresa'];
    const rows = data.map(item => [
        formatDate(item.data_vencimento),
        item.tipo,
        item.descricao,
        item.valor,
        item.status,
        item.categoria || '',
        item.pessoa_empresa || ''
    ]);
    
    const csvContent = [headers, ...rows]
        .map(row => row.map(field => `"${field}"`).join(','))
        .join('\n');
    
    return csvContent;
}

function downloadCSV(content, filename) {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    
    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}

async function getAllMovimentacoes() {
    try {
        const startDate = `${state.currentYear}-01-01`;
        const endDate = `${state.currentYear}-12-31`;

        const { data, error } = await state.supabaseClient
            .from('movimentacoes_financeiras')
            .select('*')
            .eq('id_empresa', window.currentCompanyId)
            .gte('data_vencimento', startDate)
            .lte('data_vencimento', endDate)
            .order('data_vencimento', { ascending: false });

        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('Erro ao buscar todas as movimentações:', error);
        return [];
    }
}

// ===== FUNÇÕES DE RELATÓRIOS =====
function generateYearSummary() {
    const summary = {
        totalReceitas: 0,
        totalDespesas: 0,
        saldoAnual: 0,
        movimentacoesPorMes: Array(12).fill(0),
        categoriasMaisUsadas: {},
        statusDistribution: { PENDENTE: 0, PAGO: 0, VENCIDO: 0 }
    };
    
    state.movimentacoes.forEach(mov => {
        const valor = parseFloat(mov.valor || 0);
        const mes = new Date(mov.data_vencimento).getMonth();
        
        if (mov.tipo === 'RECEBER') {
            summary.totalReceitas += valor;
        } else {
            summary.totalDespesas += valor;
        }
        
        summary.movimentacoesPorMes[mes]++;
        summary.statusDistribution[mov.status]++;
        
        if (mov.categoria) {
            summary.categoriasMaisUsadas[mov.categoria] = 
                (summary.categoriasMaisUsadas[mov.categoria] || 0) + 1;
        }
    });
    
    summary.saldoAnual = summary.totalReceitas - summary.totalDespesas;
    
    return summary;
}

// ===== FUNÇÕES DE BUSCA E FILTRO =====
function setupAdvancedSearch() {
    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.placeholder = 'Buscar movimentações...';
    searchInput.className = 'search-input';
    
    searchInput.addEventListener('input', debounce(handleSearch, 300));
    
    // Adicionar à interface (você pode posicionar onde preferir)
    const searchContainer = document.createElement('div');
    searchContainer.className = 'search-container';
    searchContainer.appendChild(searchInput);
    
    return searchContainer;
}

function handleSearch(event) {
    const term = event.target.value.toLowerCase().trim();
    
    if (!term) {
        updateMovimentacoesList();
        return;
    }
    
    const filteredMovimentacoes = state.movimentacoes.filter(mov => {
        const searchableText = [
            mov.descricao,
            mov.pessoa_empresa,
            mov.categoria,
            mov.documento,
            mov.observacoes,
            formatCurrency(mov.valor)
        ].join(' ').toLowerCase();
        
        return searchableText.includes(term);
    });
    
    renderFilteredMovimentacoes(filteredMovimentacoes);
}

function renderFilteredMovimentacoes(movimentacoes) {
    const container = document.getElementById('movimentacoes-list');
    
    const movimentacoesFiltradas = movimentacoes.filter(mov => {
        const data = new Date(mov.data_vencimento);
        const isCurrentMonth = data.getMonth() === state.currentMonth && data.getFullYear() === state.currentYear;
        const isCurrentType = mov.tipo.toLowerCase() === state.currentTab.toLowerCase();
        return isCurrentMonth && isCurrentType;
    });
    
    if (movimentacoesFiltradas.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-search"></i>
                <p>Nenhuma movimentação encontrada com os critérios de busca</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = movimentacoesFiltradas.map(mov => `
        <div class="movimentacao-item" data-id="${mov.id}">
            <div class="movimentacao-info">
                <div class="movimentacao-descricao">${highlightSearchTerm(mov.descricao)}</div>
                <div class="movimentacao-detalhes">
                    ${mov.pessoa_empresa ? `${highlightSearchTerm(mov.pessoa_empresa)} • ` : ''}
                    Vencimento: ${formatDate(mov.data_vencimento)}
                    ${mov.categoria ? ` • ${highlightSearchTerm(mov.categoria)}` : ''}
                </div>
            </div>
            <div class="movimentacao-valor ${mov.tipo.toLowerCase()}">
                ${formatCurrency(mov.valor)}
            </div>
            <div class="status-badge ${mov.status.toLowerCase()}">
                ${getStatusLabel(mov.status)}
            </div>
        </div>
    `).join('');
}

function highlightSearchTerm(text, term) {
    if (!term || !text) return text;
    
    const regex = new RegExp(`(${term})`, 'gi');
    return text.replace(regex, '<mark>$1</mark>');
}

// ===== FUNÇÕES DE MANIPULAÇÃO DE MOVIMENTAÇÕES =====
async function markAsPaid(movimentacaoId) {
    try {
        const { data, error } = await state.supabaseClient
            .from('movimentacoes_financeiras')
            .update({
                status: 'PAGO',
                data_pagamento: new Date().toISOString().split('T')[0]
            })
            .eq('id', movimentacaoId)
            .eq('id_empresa', window.currentCompanyId)
            .select();

        if (error) throw error;

        showSuccess('Movimentação marcada como paga!');
        await loadMovimentacoesYear();
        await loadSummaryData();
        updateChart();
        updateMovimentacoesList();
        
        return data[0];
    } catch (error) {
        console.error('Erro ao marcar como pago:', error);
        showError('Erro ao marcar movimentação como paga');
        throw error;
    }
}

async function deleteMovimentacao(movimentacaoId) {
    if (!confirm('Tem certeza que deseja excluir esta movimentação?')) {
        return;
    }
    
    try {
        const { error } = await state.supabaseClient
            .from('movimentacoes_financeiras')
            .delete()
            .eq('id', movimentacaoId)
            .eq('id_empresa', window.currentCompanyId);

        if (error) throw error;

        showSuccess('Movimentação excluída com sucesso!');
        await loadMovimentacoesYear();
        await loadSummaryData();
        updateChart();
        updateMovimentacoesList();
    } catch (error) {
        console.error('Erro ao excluir movimentação:', error);
        showError('Erro ao excluir movimentação');
    }
}

// ===== FUNÇÕES UTILITÁRIAS =====
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function formatPercentage(value, total) {
    if (total === 0) return '0%';
    return ((value / total) * 100).toFixed(1) + '%';
}

function getMonthName(monthIndex) {
    const months = [
        'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    return months[monthIndex] || '';
}

function isOverdue(dataVencimento, status) {
    if (status === 'PAGO') return false;
    
    const hoje = new Date();
    const vencimento = new Date(dataVencimento + 'T00:00:00');
    
    return vencimento < hoje;
}

// ===== FUNÇÕES DE CONTEXTO DE MOVIMENTAÇÕES =====
function addContextMenuToMovimentacoes() {
    document.addEventListener('contextmenu', (e) => {
        const movimentacaoItem = e.target.closest('.movimentacao-item');
        if (!movimentacaoItem) return;
        
        e.preventDefault();
        showContextMenu(e.pageX, e.pageY, movimentacaoItem.dataset.id);
    });
    
    document.addEventListener('click', hideContextMenu);
}

function showContextMenu(x, y, movimentacaoId) {
    hideContextMenu(); // Remove menu anterior se existir
    
    const menu = document.createElement('div');
    menu.className = 'context-menu';
    menu.innerHTML = `
        <div class="context-menu-item" data-action="edit">
            <i class="fas fa-edit"></i> Editar
        </div>
        <div class="context-menu-item" data-action="mark-paid">
            <i class="fas fa-check"></i> Marcar como Pago
        </div>
        <div class="context-menu-item" data-action="duplicate">
            <i class="fas fa-copy"></i> Duplicar
        </div>
        <div class="context-menu-divider"></div>
        <div class="context-menu-item danger" data-action="delete">
            <i class="fas fa-trash"></i> Excluir
        </div>
    `;
    
    menu.style.cssText = `
        position: fixed;
        top: ${y}px;
        left: ${x}px;
        background: white;
        border: 1px solid var(--border-color);
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10000;
        min-width: 150px;
    `;
    
    menu.addEventListener('click', (e) => {
        const action = e.target.closest('.context-menu-item')?.dataset.action;
        if (action) {
            handleContextMenuAction(action, movimentacaoId);
            hideContextMenu();
        }
    });
    
    document.body.appendChild(menu);
}

function hideContextMenu() {
    const existingMenu = document.querySelector('.context-menu');
    if (existingMenu) {
        existingMenu.remove();
    }
}

function handleContextMenuAction(action, movimentacaoId) {
    const movimentacao = state.movimentacoes.find(m => m.id == movimentacaoId);
    if (!movimentacao) return;
    
    switch (action) {
        case 'edit':
            editMovimentacao(movimentacao);
            break;
        case 'mark-paid':
            markAsPaid(movimentacaoId);
            break;
        case 'duplicate':
            duplicateMovimentacao(movimentacao);
            break;
        case 'delete':
            deleteMovimentacao(movimentacaoId);
            break;
    }
}

function editMovimentacao(movimentacao) {
    state.modalType = movimentacao.tipo.toLowerCase();
    state.editingId = movimentacao.id;
    
    openModal(state.modalType);
    
    // Preencher formulário com dados existentes
    document.getElementById('descricao').value = movimentacao.descricao || '';
    document.getElementById('valor').value = movimentacao.valor || '';
    document.getElementById('data_vencimento').value = movimentacao.data_vencimento || '';
    document.getElementById('categoria').value = movimentacao.categoria || '';
    document.getElementById('pessoa_empresa').value = movimentacao.pessoa_empresa || '';
    document.getElementById('documento').value = movimentacao.documento || '';
    document.getElementById('observacoes').value = movimentacao.observacoes || '';
    
    // Atualizar título do modal
    const title = document.getElementById('modal-title');
    title.textContent = `Editar ${movimentacao.tipo === 'PAGAR' ? 'Conta a Pagar' : 'Conta a Receber'}`;
    
    const saveBtn = document.getElementById('btn-salvar');
    saveBtn.textContent = 'Atualizar';
}

function duplicateMovimentacao(movimentacao) {
    state.modalType = movimentacao.tipo.toLowerCase();
    state.editingId = null; // Não é edição, é duplicação
    
    openModal(state.modalType);
    
    // Preencher formulário com dados existentes (exceto data)
    document.getElementById('descricao').value = movimentacao.descricao + ' (Cópia)';
    document.getElementById('valor').value = movimentacao.valor || '';
    document.getElementById('categoria').value = movimentacao.categoria || '';
    document.getElementById('pessoa_empresa').value = movimentacao.pessoa_empresa || '';
    document.getElementById('documento').value = '';
    document.getElementById('observacoes').value = movimentacao.observacoes || '';
    
    // Data padrão como hoje
    const hoje = new Date().toISOString().split('T')[0];
    document.getElementById('data_vencimento').value = hoje;
}

// Inicializar funções adicionais quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
    // Adicionar menu de contexto
    addContextMenuToMovimentacoes();
    
    // Adicionar estilos CSS para menu de contexto
    const style = document.createElement('style');
    style.textContent = `
        .context-menu-item {
            padding: 0.75rem 1rem;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 0.5rem;
            font-size: 0.875rem;
            transition: background-color 0.2s;
        }
        
        .context-menu-item:hover {
            background-color: var(--background-light);
        }
        
        .context-menu-item.danger {
            color: var(--danger-color);
        }
        
        .context-menu-item.danger:hover {
            background-color: #fee2e2;
        }
        
        .context-menu-divider {
            height: 1px;
            background: var(--border-color);
            margin: 0.25rem 0;
        }
        
        mark {
            background-color: #fef08a;
            padding: 0 2px;
            border-radius: 2px;
        }
    `;
    document.head.appendChild(style);
});
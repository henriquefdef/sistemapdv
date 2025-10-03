// ===== SISTEMA DE CASHBACK - JAVASCRIPT ATUALIZADO =====

// ===== ESTADO DA APLICAÇÃO =====
const state = {
    currentYear: new Date().getFullYear(),
    clientes: [],
    clientesFiltrados: [],
    historicoAtual: [],
    clienteAtual: null,
    supabaseClient: null,
    chart: null,
    filtroStatus: 'todos',
    searchTerm: '',
    estatisticas: {
        totalDisponivel: 0,
        totalClientes: 0,
        geradoMesAtual: 0,
        totalUtilizado: 0
    }
};

// ===== INICIALIZAÇÃO =====
document.addEventListener('DOMContentLoaded', () => {
    document.addEventListener('userDataReady', initializeCashback);
});

function initializeCashback() {
    if (!window.currentCompanyId) {
        showNotification('Erro: ID da empresa não encontrado', 'error');
        return;
    }

    state.supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    
    setupEventListeners();
    loadCashbackData();
    updateYearDisplay();
}

// ===== CONFIGURAÇÃO DE EVENTOS =====
function setupEventListeners() {
    document.getElementById('prev-year')?.addEventListener('click', () => changeYear(-1));
    document.getElementById('next-year')?.addEventListener('click', () => changeYear(1));

    document.getElementById('search-cliente')?.addEventListener('input', handleSearch);
    document.getElementById('filter-status')?.addEventListener('change', handleFilterStatus);

    document.getElementById('btn-campanha-whatsapp')?.addEventListener('click', openCampanhaModal);
    document.getElementById('btn-relatorio')?.addEventListener('click', exportarRelatorio);

    setupModalEvents();

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeAllModals();
        }
    });
}

function setupModalEvents() {
    document.getElementById('historico-modal-close')?.addEventListener('click', () => closeModal('historico-modal'));
    document.getElementById('historico-modal')?.addEventListener('click', (e) => {
        if (e.target.id === 'historico-modal') closeModal('historico-modal');
    });

    document.getElementById('comprovante-modal-close')?.addEventListener('click', () => closeModal('comprovante-modal'));
    document.getElementById('btn-cancel-comprovante')?.addEventListener('click', () => closeModal('comprovante-modal'));
    document.getElementById('btn-send-comprovante')?.addEventListener('click', enviarComprovante);

    // Remover configuração dos modais de lembrete antigos - agora usa o modal unificado
}

// ===== NAVEGAÇÃO DE ANO =====
function changeYear(direction) {
    state.currentYear += direction;
    updateYearDisplay();
    loadChartData();
}

function updateYearDisplay() {
    const yearElement = document.getElementById('current-year');
    if (yearElement) {
        yearElement.textContent = state.currentYear;
    }
}

// ===== CARREGAMENTO DE DADOS =====
async function loadCashbackData() {
    try {
        showLoading();

        if (!window.currentCompanyId) {
            state.clientes = [];
            calcularEstatisticas();
            updateEstatisticas();
            filtrarClientes();
            loadChartData();
            return;
        }

        const cashbackData = await loadCashbackFromDB();
        
        if (cashbackData && cashbackData.length > 0) {
            const clientesProcessados = processarDadosClientes(cashbackData);
            const clientesCompletos = await carregarDadosCompletos(clientesProcessados);
            state.clientes = clientesCompletos;
        } else {
            state.clientes = [];
        }
        
        calcularEstatisticas();
        updateEstatisticas();
        filtrarClientes();
        loadChartData();
        
    } catch (error) {
        showNotification('Erro ao carregar dados de cashback', 'error');
        state.clientes = [];
        calcularEstatisticas();
        updateEstatisticas();
        filtrarClientes();
        loadChartData();
        hideLoading();
    }
}

async function loadCashbackFromDB() {
    if (!state.supabaseClient || !window.currentCompanyId) {
        return [];
    }

    const { data, error } = await state.supabaseClient
        .from('cashback')
        .select('*')
        .eq('id_empresa', window.currentCompanyId)
        .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
}

function processarDadosClientes(cashbackData) {
    const clientesMap = new Map();

    cashbackData.forEach(operacao => {
        const clienteId = operacao.cliente_id;
        
        if (!clienteId) return;

        if (!clientesMap.has(clienteId)) {
            clientesMap.set(clienteId, {
                id: clienteId,
                saldoAtual: 0,
                totalGerado: 0,
                totalUtilizado: 0,
                operacoes: [],
                ultimaOperacao: null
            });
        }

        const cliente = clientesMap.get(clienteId);
        cliente.operacoes.push(operacao);
        
        if (!cliente.ultimaOperacao || new Date(operacao.created_at) > new Date(cliente.ultimaOperacao.created_at)) {
            cliente.ultimaOperacao = operacao;
            cliente.saldoAtual = parseFloat(operacao.saldo_atual || 0);
        }

        const valor = parseFloat(operacao.valor || 0);
        if (operacao.tipo_operacao === 'credito') {
            cliente.totalGerado += valor;
        } else if (operacao.tipo_operacao === 'debito') {
            cliente.totalUtilizado += valor;
        }
    });

    return Array.from(clientesMap.values());
}

async function carregarDadosCompletos(clientesProcessados) {
    if (!state.supabaseClient || !window.currentCompanyId) {
        return clientesProcessados;
    }

    const clienteIds = clientesProcessados.map(c => c.id).filter(Boolean);
    
    if (clienteIds.length === 0) return [];

    const { data: clientesData, error } = await state.supabaseClient
        .from('clientes')
        .select('id, nome, telefone, email')
        .eq('id_empresa', window.currentCompanyId)
        .in('id', clienteIds);

    if (error) {
        return clientesProcessados;
    }

    return clientesProcessados.map(cliente => {
        const dadosCliente = clientesData.find(c => c.id === cliente.id);
        return {
            ...cliente,
            nome: dadosCliente?.nome || 'Cliente não encontrado',
            telefone: dadosCliente?.telefone || '',
            email: dadosCliente?.email || ''
        };
    });
}

// ===== CÁLCULOS E ESTATÍSTICAS =====
function calcularEstatisticas() {
    state.estatisticas = {
        totalDisponivel: state.clientes.reduce((acc, c) => acc + c.saldoAtual, 0),
        totalClientes: state.clientes.filter(c => c.saldoAtual > 0).length,
        geradoMesAtual: state.clientes.reduce((acc, c) => acc + c.totalGerado, 0),
        totalUtilizado: state.clientes.reduce((acc, c) => acc + c.totalUtilizado, 0)
    };
}

function updateEstatisticas() {
    document.getElementById('total-cashback-disponivel').textContent = formatCurrency(state.estatisticas.totalDisponivel);
    document.getElementById('total-clientes-cashback').textContent = state.estatisticas.totalClientes;
    document.getElementById('cashback-mes-atual').textContent = formatCurrency(state.estatisticas.geradoMesAtual);
    document.getElementById('cashback-utilizado').textContent = formatCurrency(state.estatisticas.totalUtilizado);
}

// ===== FILTROS =====
function handleSearch(e) {
    state.searchTerm = e.target.value.toLowerCase();
    filtrarClientes();
}

function handleFilterStatus(e) {
    state.filtroStatus = e.target.value;
    filtrarClientes();
}

function filtrarClientes() {
    let clientesFiltrados = [...state.clientes];

    if (state.searchTerm) {
        clientesFiltrados = clientesFiltrados.filter(cliente =>
            cliente.nome.toLowerCase().includes(state.searchTerm) ||
            (cliente.telefone && cliente.telefone.includes(state.searchTerm))
        );
    }

    switch (state.filtroStatus) {
        case 'com-saldo':
            clientesFiltrados = clientesFiltrados.filter(c => c.saldoAtual > 0);
            break;
        case 'sem-saldo':
            clientesFiltrados = clientesFiltrados.filter(c => c.saldoAtual <= 0);
            break;
        case 'recentes':
            const diasAtras = new Date();
            diasAtras.setDate(diasAtras.getDate() - 30);
            clientesFiltrados = clientesFiltrados.filter(c => 
                c.ultimaOperacao && new Date(c.ultimaOperacao.created_at) >= diasAtras
            );
            break;
    }

    state.clientesFiltrados = clientesFiltrados;
    renderClientes();
}

// ===== RENDERIZAÇÃO =====
function renderClientes() {
    const container = document.getElementById('clientes-grid');
    if (!container) return;

    if (state.clientesFiltrados.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-piggy-bank"></i>
                <h3>Nenhum cliente encontrado</h3>
                <p>Não há clientes com cashback no período selecionado</p>
            </div>
        `;
        return;
    }

    container.innerHTML = state.clientesFiltrados.map(cliente => {
        return `
            <div class="cliente-card">
                <div class="cliente-header">
                    <div class="cliente-info">
                        <h4>${cliente.nome}</h4>
                        <p>${cliente.telefone || 'Telefone não informado'}</p>
                    </div>
                    <div class="cliente-saldo">
                        <div class="saldo-valor">${formatCurrency(cliente.saldoAtual)}</div>
                        <div class="saldo-label">Saldo Atual</div>
                    </div>
                </div>

                <div class="cliente-stats">
                    <div class="mini-stat">
                        <div class="mini-stat-value">${formatCurrency(cliente.totalGerado)}</div>
                        <div class="mini-stat-label">Gerado</div>
                    </div>
                    <div class="mini-stat">
                        <div class="mini-stat-value">${formatCurrency(cliente.totalUtilizado)}</div>
                        <div class="mini-stat-label">Utilizado</div>
                    </div>
                    <div class="mini-stat">
                        <div class="mini-stat-value">${cliente.operacoes.length}</div>
                        <div class="mini-stat-label">Operações</div>
                    </div>
                </div>

                <div class="cliente-actions">
                    <button class="action-icon-btn btn-historico" onclick="openHistoricoModal(${cliente.id})" title="Ver Histórico">
                        <i class="fas fa-history"></i>
                    </button>
                    ${cliente.saldoAtual > 0 ? `
                        <button class="action-icon-btn btn-comprovante" onclick="openComprovanteModal(${cliente.id})" title="Enviar Comprovante">
                            <i class="fas fa-receipt"></i>
                        </button>
                        <button class="action-icon-btn btn-lembrete" onclick="openCashbackWhatsAppModal(${cliente.id})" title="Enviar Lembrete WhatsApp">
                            <i class="fab fa-whatsapp"></i>
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
    }).join('');

    hideLoading();
}

// ===== GRÁFICO =====
function loadChartData() {
    const chartData = {
        gerado: Array(12).fill(0),
        utilizado: Array(12).fill(0)
    };

    state.clientes.forEach(cliente => {
        cliente.operacoes.forEach(op => {
            const data = new Date(op.created_at);
            if (data.getFullYear() === state.currentYear) {
                const mes = data.getMonth();
                const valor = parseFloat(op.valor || 0);
                
                if (op.tipo_operacao === 'credito') {
                    chartData.gerado[mes] += valor;
                } else if (op.tipo_operacao === 'debito') {
                    chartData.utilizado[mes] += valor;
                }
            }
        });
    });

    initializeChart(chartData);
}

function initializeChart(chartData) {
    const ctx = document.getElementById('cashback-chart');
    if (!ctx) return;

    if (state.chart) {
        state.chart.destroy();
    }

    state.chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'],
            datasets: [
                {
                    label: 'Cashback Gerado',
                    data: chartData.gerado,
                    backgroundColor: 'rgba(255, 152, 0, 0.1)',
                    borderColor: '#FF9800',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: '#FF9800',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    pointRadius: 5
                },
                {
                    label: 'Cashback Utilizado',
                    data: chartData.utilizado,
                    backgroundColor: 'rgba(33, 150, 243, 0.1)',
                    borderColor: '#2196F3',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: '#2196F3',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    pointRadius: 5
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
                    display: false
                },
                tooltip: {
                    backgroundColor: 'rgba(44, 62, 80, 0.9)',
                    titleColor: '#fff',
                    bodyColor: '#fff',
                    borderColor: '#FF9800',
                    borderWidth: 1,
                    cornerRadius: 8,
                    callbacks: {
                        label: function(context) {
                            return context.dataset.label + ': ' + formatCurrency(context.parsed.y);
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        font: {
                            size: 11,
                            weight: '500'
                        },
                        color: '#666'
                    }
                },
                y: {
                    beginAtZero: true,
                    grid: {
                        color: '#f1f3f4',
                        borderDash: [2, 2]
                    },
                    ticks: {
                        font: {
                            size: 11
                        },
                        color: '#666',
                        callback: function(value) {
                            return formatCurrency(value);
                        }
                    }
                }
            }
        }
    });
}

// ===== MODAIS =====
function openHistoricoModal(clienteId) {
    const cliente = state.clientes.find(c => c.id === clienteId);
    if (!cliente) return;

    state.clienteAtual = cliente;
    
    document.getElementById('historico-modal-title').textContent = `Histórico de Cashback - ${cliente.nome}`;
    
    document.getElementById('resumo-saldo').textContent = formatCurrency(cliente.saldoAtual);
    document.getElementById('resumo-total-gerado').textContent = formatCurrency(cliente.totalGerado);
    document.getElementById('resumo-total-utilizado').textContent = formatCurrency(cliente.totalUtilizado);
    document.getElementById('resumo-operacoes').textContent = cliente.operacoes.length;
    
    renderHistorico(cliente.operacoes);
    
    openModal('historico-modal');
}

function renderHistorico(operacoes) {
    const tbody = document.getElementById('historico-table-body');
    if (!tbody) return;

    if (operacoes.length === 0) {
        tbody.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-history"></i>
                <p>Nenhuma operação encontrada</p>
            </div>
        `;
        return;
    }

    const operacoesOrdenadas = [...operacoes].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    tbody.innerHTML = operacoesOrdenadas.map(op => `
        <div class="table-row">
            <div class="row-data">${new Date(op.created_at).toLocaleDateString('pt-BR')}</div>
            <div class="row-operacao ${op.tipo_operacao}">${op.tipo_operacao === 'credito' ? 'Crédito' : 'Débito'}</div>
            <div class="row-data">${op.descricao || 'Sem descrição'}</div>
            <div class="row-valor ${op.tipo_operacao}">${formatCurrency(op.valor)}</div>
            <div class="row-saldo">${formatCurrency(op.saldo_atual)}</div>
        </div>
    `).join('');
}

function openComprovanteModal(clienteId) {
    const cliente = state.clientes.find(c => c.id === clienteId);
    if (!cliente) return;

    state.clienteAtual = cliente;
    
    document.getElementById('preview-cliente-nome').textContent = cliente.nome;
    document.getElementById('preview-saldo-valor').textContent = formatCurrency(cliente.saldoAtual);
    document.getElementById('comprovante-whatsapp').value = cliente.telefone || '';
    
    openModal('comprovante-modal');
}

// ===== NOVA FUNÇÃO PARA ABRIR MODAL WHATSAPP CASHBACK =====
function openCashbackWhatsAppModal(clienteId) {
    const cliente = state.clientes.find(c => c.id === clienteId);
    if (!cliente) return;

    // Usar o modal unificado com tipo cashback
    if (window.whatsAppModalUnified) {
        window.whatsAppModalUnified.open(cliente, 'cashback');
    } else {
        showNotification('Modal WhatsApp não carregado', 'error');
    }
}

// ===== FUNÇÃO PARA CAMPANHA =====
function openCampanhaModal() {
    const clientesComSaldo = state.clientes.filter(c => c.saldoAtual > 0);
    
    if (clientesComSaldo.length === 0) {
        showNotification('Nenhum cliente com saldo de cashback encontrado', 'warning');
        return;
    }

    // Para campanha, podemos usar o primeiro cliente como exemplo
    // O modal deve ser adaptado para campanhas em massa
    if (window.whatsAppModalUnified && clientesComSaldo.length > 0) {
        // Criar um cliente fictício para representar a campanha
        const clienteCampanha = {
            nome: `${clientesComSaldo.length} clientes`,
            telefone: '(XX) XXXXX-XXXX',
            id: 'campanha',
            saldoCashback: clientesComSaldo.reduce((acc, c) => acc + c.saldoAtual, 0)
        };
        
        window.whatsAppModalUnified.open(clienteCampanha, 'cashback');
        
        // Customizar para campanha
        setTimeout(() => {
            document.getElementById('modal-client-name').textContent = 'Campanha para Clientes com Cashback';
            document.getElementById('modal-client-phone').textContent = `${clientesComSaldo.length} clientes selecionados`;
            document.getElementById('client-cashback-value').textContent = formatCurrency(clienteCampanha.saldoCashback);
        }, 100);
    } else {
        showNotification('Modal WhatsApp não carregado', 'error');
    }
}

// ===== AÇÕES DOS MODAIS =====
function enviarComprovante() {
    const whatsapp = document.getElementById('comprovante-whatsapp').value.trim();
    const mensagem = document.getElementById('comprovante-mensagem').value.trim();
    
    if (!whatsapp) {
        showNotification('Digite o número do WhatsApp', 'warning');
        return;
    }
    
    if (!state.clienteAtual) {
        showNotification('Cliente não selecionado', 'error');
        return;
    }
    
    showNotification(`Comprovante enviado para ${state.clienteAtual.nome}!`, 'success');
    closeModal('comprovante-modal');
}

function exportarRelatorio() {
    const dadosRelatorio = state.clientes.map(cliente => ({
        Nome: cliente.nome,
        Telefone: cliente.telefone || '',
        Email: cliente.email || '',
        'Saldo Atual': formatCurrency(cliente.saldoAtual),
        'Total Gerado': formatCurrency(cliente.totalGerado),
        'Total Utilizado': formatCurrency(cliente.totalUtilizado),
        'Operações': cliente.operacoes.length,
        'Última Atividade': cliente.ultimaOperacao ? 
            new Date(cliente.ultimaOperacao.created_at).toLocaleDateString('pt-BR') : 
            'Nunca'
    }));
    
    const headers = Object.keys(dadosRelatorio[0] || {});
    const csvContent = [
        headers.join(','),
        ...dadosRelatorio.map(row => 
            headers.map(header => `"${row[header]}"`).join(',')
        )
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `cashback_relatorio_${state.currentYear}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showNotification('Relatório exportado com sucesso!', 'success');
}

// ===== UTILITÁRIOS =====
function formatCurrency(value) {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(value || 0);
}

function showLoading() {
    const container = document.getElementById('clientes-grid');
    if (container) {
        container.innerHTML = `
            <div class="loading-state">
                <div class="loading-spinner"></div>
                <span>Carregando dados do cashback...</span>
            </div>
        `;
    }
}

function hideLoading() {
    // O loading será substituído pelo conteúdo renderizado
}

function showNotification(message, type = 'info') {
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

function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('show');
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('show');
    }
}

function closeAllModals() {
    document.querySelectorAll('.modal-overlay').forEach(modal => {
        modal.classList.remove('show');
    });
}

// ===== INICIALIZAR QUANDO O DOM ESTIVER PRONTO =====
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        if (window.currentCompanyId) {
            initializeCashback();
        }
    });
} else {
    if (window.currentCompanyId) {
        initializeCashback();
    }
}
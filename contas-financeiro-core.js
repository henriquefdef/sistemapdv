// ===== SISTEMA FINANCEIRO - NÚCLEO E ESTADO =====

document.addEventListener('DOMContentLoaded', () => {
    document.addEventListener('userDataReady', initializeFinanceiro);
});

// Estado global da aplicação - SIMPLIFICADO
const state = {
    currentYear: new Date().getFullYear(),
    currentMonth: null, // null = ano inteiro, número = mês específico
    currentCategory: 'tudo',
    modalType: 'receber',
    movimentacoes: [],
    filteredMovimentacoes: [],
    chartData: {
        receitas: Array(12).fill(0),
        despesas: Array(12).fill(0)
    },
    chart: null,
    totalReceitas: 0.00,
    totalDespesas: 0.00,
    currentPage: 1,
    itemsPerPage: 10,
    selectedItems: new Set(),
    totaisPorCategoria: {}
};

// ===== INICIALIZAÇÃO PRINCIPAL =====
function initializeFinanceiro() {
    if (!window.currentCompanyId) {
        console.error("ID da empresa não encontrado.");
        return;
    }

    setupEventListeners();
    loadInitialData();
}

// ===== CARREGAMENTO INICIAL DE DADOS =====
async function loadInitialData() {
    try {
        showLoading();
        
        state.movimentacoes = [];
        
        if (typeof loadMovimentacoesFromDB === 'function') {
            await loadMovimentacoesFromDB();
        } else {
            console.warn('Funções do banco de dados não carregadas');
        }
        
        processChartData();
        initializeChart();
        
        // SIMPLIFICADO: Calcular tudo de uma vez
        recalcularTudo();
        
        hideLoading();
    } catch (error) {
        console.error('Erro ao carregar dados iniciais:', error);
        state.movimentacoes = [];
        recalcularTudo();
        hideLoading();
    }
}

// ===== FUNÇÃO PRINCIPAL - RECALCULAR TUDO =====
function recalcularTudo() {
    console.log('=== RECALCULANDO TUDO ===');
    console.log('Ano:', state.currentYear, 'Mês:', state.currentMonth);
    
    // Reset total
    state.totalReceitas = 0;
    state.totalDespesas = 0;
    state.totaisPorCategoria = {
        tudo: 0,
        em_atraso: 0,
        vence_hoje: 0,
        receitas: 0,
        despesas: 0,
        pago: 0,
        a_pagar: 0
    };

    const hoje = new Date();
    const hojeBR = `${hoje.getDate().toString().padStart(2, '0')}/${(hoje.getMonth() + 1).toString().padStart(2, '0')}/${hoje.getFullYear()}`;

    // Calcular totais
    state.movimentacoes.forEach(mov => {
        const [dia, mes, ano] = mov.vencimento.split('/');
        const mesMovimentacao = parseInt(mes) - 1;
        const anoMovimentacao = parseInt(ano);
        const valor = parseFloat(mov.valor || 0);
        const dataVencimento = new Date(anoMovimentacao, mesMovimentacao, parseInt(dia));
        
        // Verifica se está no período selecionado
        const noPeriodo = anoMovimentacao === state.currentYear && 
            (state.currentMonth === null || mesMovimentacao === state.currentMonth);
        
        if (noPeriodo) {
            state.totaisPorCategoria.tudo += valor;
            
            if (mov.tipo === 'RECEBER') {
                state.totalReceitas += valor;
                state.totaisPorCategoria.receitas += valor;
            } else if (mov.tipo === 'PAGAR') {
                state.totalDespesas += valor;
                state.totaisPorCategoria.despesas += valor;
            }
            
            // Calcular totais por status de pagamento
            if (mov.status === 'PAGO') {
                state.totaisPorCategoria.pago += valor;
            } else {
                state.totaisPorCategoria.a_pagar += valor;
            }
        }
        
        // Categorias especiais (independentes do período)
        if (dataVencimento < hoje && mov.status !== 'PAGO') {
            state.totaisPorCategoria.em_atraso += valor;
        }
        if (mov.vencimento === hojeBR && mov.status !== 'PAGO') {
            state.totaisPorCategoria.vence_hoje += valor;
        }
    });
    
    console.log('Receitas:', formatCurrency(state.totalReceitas));
    console.log('Despesas:', formatCurrency(state.totalDespesas));
    console.log('Total:', formatCurrency(state.totaisPorCategoria.tudo));
    
    // Atualizar interface
    atualizarInterface();
    atualizarCartoes();
    atualizarBotoesMes();
    filtrarLista();
}

// ===== ATUALIZAR INTERFACE - SIMPLIFICADO =====
function atualizarInterface() {
    console.log('Atualizando barras...');
    
    const totalGeral = state.totalReceitas + state.totalDespesas;
    
    // Elementos das barras
    const barReceitas = document.getElementById('bar-receitas');
    const barDespesas = document.getElementById('bar-despesas');
    const valorReceitas = document.getElementById('valor-receitas');
    const valorDespesas = document.getElementById('valor-despesas');
    
    if (barReceitas && barDespesas && valorReceitas && valorDespesas) {
        if (totalGeral === 0) {
            barReceitas.style.width = '0%';
            barDespesas.style.width = '0%';
        } else {
            const percReceitas = (state.totalReceitas / totalGeral) * 100;
            const percDespesas = (state.totalDespesas / totalGeral) * 100;
            
            barReceitas.style.width = `${percReceitas}%`;
            barDespesas.style.width = `${percDespesas}%`;
        }
        
        valorReceitas.textContent = formatCurrency(state.totalReceitas);
        valorDespesas.textContent = formatCurrency(state.totalDespesas);
        
        console.log('Barras atualizadas!');
    }
    
    // Atualizar ano
    const currentYearEl = document.getElementById('current-year');
    if (currentYearEl) {
        currentYearEl.textContent = state.currentYear;
    }
}

// ===== ATUALIZAR CARTÕES =====
function atualizarCartoes() {
    console.log('Atualizando cartões...');
    
    Object.keys(state.totaisPorCategoria).forEach(categoria => {
        const elemento = document.getElementById(`total-${categoria}`);
        if (elemento) {
            elemento.textContent = formatCurrency(state.totaisPorCategoria[categoria]);
        }
    });
    
    console.log('Cartões atualizados!');
}

// ===== ATUALIZAR BOTÕES DE MÊS - VERSÃO SEGURA =====
function atualizarBotoesMes() {
    // NÃO tocar nos eventos - só no visual
    document.querySelectorAll('.month-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    if (state.currentMonth !== null) {
        const activeBtn = document.querySelector(`[data-month="${state.currentMonth}"]`);
        if (activeBtn) {
            activeBtn.classList.add('active');
        }
    }
    
    // NÃO reconfigurar eventos aqui
}

// ===== FILTRAR LISTA =====
function filtrarLista() {
    const hoje = new Date();
    const hojeBR = `${hoje.getDate().toString().padStart(2, '0')}/${(hoje.getMonth() + 1).toString().padStart(2, '0')}/${hoje.getFullYear()}`;

    state.filteredMovimentacoes = state.movimentacoes.filter(mov => {
        const [dia, mes, ano] = mov.vencimento.split('/');
        const mesMovimentacao = parseInt(mes) - 1;
        const anoMovimentacao = parseInt(ano);
        const dataVencimento = new Date(anoMovimentacao, mesMovimentacao, parseInt(dia));
        
        const noPeriodo = anoMovimentacao === state.currentYear && 
            (state.currentMonth === null || mesMovimentacao === state.currentMonth);
        
        switch(state.currentCategory) {
            case 'tudo':
                return noPeriodo;
            case 'em_atraso':
                return dataVencimento < hoje && mov.status !== 'PAGO';
            case 'vence_hoje':
                return mov.vencimento === hojeBR && mov.status !== 'PAGO';
            case 'receitas':
                return mov.tipo === 'RECEBER' && noPeriodo;
            case 'despesas':
                return mov.tipo === 'PAGAR' && noPeriodo;
            case 'pago':
                return mov.status === 'PAGO' && noPeriodo;
            case 'a_pagar':
                return mov.status !== 'PAGO' && noPeriodo;
            default:
                return noPeriodo;
        }
    });

    state.currentPage = 1;
    
    if (typeof renderMovimentacoes === 'function') {
        renderMovimentacoes();
    }
    if (typeof updatePagination === 'function') {
        updatePagination();
    }
    
    console.log(`Filtrado: ${state.filteredMovimentacoes.length} movimentações`);
}

// ===== SELEÇÃO DE MÊS - SIMPLIFICADO =====
function selectMonth(month) {
    console.log('=== SELECT MONTH ===');
    console.log('Mês clicado:', month);
    console.log('Mês atual:', state.currentMonth);
    
    if (state.currentMonth === month) {
        state.currentMonth = null; // Desmarcar
        console.log('Desmarcado - mostrando ano todo');
    } else {
        state.currentMonth = month; // Marcar
        console.log('Marcado mês:', month);
    }
    
    recalcularTudo();
}

// ===== MUDANÇA DE ANO =====
function changeYear(direction) {
    state.currentYear += direction;
    
    if (typeof loadMovimentacoesFromDB === 'function') {
        loadMovimentacoesFromDB().then(() => {
            processChartData();
            updateChart();
            recalcularTudo();
        });
    } else {
        processChartData();
        updateChart();
        recalcularTudo();
    }
}

// ===== MUDANÇA DE CATEGORIA =====
function selectCategory(category) {
    state.currentCategory = category;
    
    document.querySelectorAll('.filter-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    
    const selectedTab = document.querySelector(`[data-category="${category}"]`);
    if (selectedTab) {
        selectedTab.classList.add('active');
    }

    filtrarLista();
}

// ===== PROCESSAMENTO DE DADOS PARA GRÁFICO =====
function processChartData() {
    state.chartData = {
        receitas: Array(12).fill(0),
        despesas: Array(12).fill(0)
    };

    state.movimentacoes.forEach(mov => {
        const [dia, mes, ano] = mov.vencimento.split('/');
        const mesIndex = parseInt(mes) - 1;
        const valor = parseFloat(mov.valor || 0);

        if (parseInt(ano) === state.currentYear) {
            if (mov.tipo === 'RECEBER') {
                state.chartData.receitas[mesIndex] += valor;
            } else if (mov.tipo === 'PAGAR') {
                state.chartData.despesas[mesIndex] += valor;
            }
        }
    });
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
                    backgroundColor: '#1dd1a1',
                    borderColor: '#00b894',
                    borderWidth: 1,
                    borderRadius: 4,
                    borderSkipped: false,
                },
                {
                    label: 'Despesas',
                    data: state.chartData.despesas,
                    backgroundColor: '#ff6b6b',
                    borderColor: '#e55656',
                    borderWidth: 1,
                    borderRadius: 4,
                    borderSkipped: false,
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
                    labels: {
                        usePointStyle: true,
                        padding: 20,
                        font: {
                            size: 12,
                            weight: '500'
                        }
                    }
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

function updateChart() {
    if (state.chart) {
        state.chart.data.datasets[0].data = state.chartData.receitas;
        state.chart.data.datasets[1].data = state.chartData.despesas;
        state.chart.update('active');
    }
}

// ===== FUNÇÕES UTILITÁRIAS =====
function formatCurrency(value) {
    if (typeof value !== 'number') value = parseFloat(value) || 0;
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(value);
}

function formatDateBR(dateString) {
    const date = new Date(dateString + 'T00:00:00');
    return date.toLocaleDateString('pt-BR');
}

function showLoading() {
    const tableBody = document.getElementById('table-body');
    if (tableBody) {
        tableBody.innerHTML = `
            <div class="loading-state">
                <div class="loading-spinner"></div>
                <span>Carregando movimentações...</span>
            </div>
        `;
    }
}

function hideLoading() {
    // A função de renderização irá substituir o loading
}

function showNotification(message, type) {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    
    const colors = {
        success: '#1dd1a1',
        error: '#ff6b6b',
        warning: '#fdcb6e',
        info: '#74b9ff'
    };
    
    const icons = {
        success: 'fa-check-circle',
        error: 'fa-exclamation-circle',
        warning: 'fa-exclamation-triangle',
        info: 'fa-info-circle'
    };
    
    notification.innerHTML = `
        <i class="fas ${icons[type]}"></i>
        <span>${message}</span>
    `;
    
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${colors[type]};
        color: white;
        padding: 15px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 15px rgba(0,0,0,0.2);
        z-index: 10000;
        display: flex;
        align-items: center;
        gap: 10px;
        font-weight: 500;
        max-width: 400px;
        animation: slideInRight 0.3s ease-out;
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
        if (notification.parentNode) {
            notification.style.animation = 'slideInRight 0.3s ease-out reverse';
            setTimeout(() => {
                if (notification.parentNode) {
                    document.body.removeChild(notification);
                }
            }, 300);
        }
    }, 5000);
}

function isVencido(vencimento) {
    const [dia, mes, ano] = vencimento.split('/');
    const dataVencimento = new Date(parseInt(ano), parseInt(mes) - 1, parseInt(dia));
    return dataVencimento < new Date();
}

// ===== COMPATIBILIDADE COM VERSÃO ANTIGA =====
window.calculateTotaisPorCategoria = recalcularTudo;
window.updateInterface = atualizarInterface;
window.updateTotaisUI = atualizarCartoes;
window.updateMonthButtonsUI = atualizarBotoesMes;
window.filterAndRenderMovimentacoes = filtrarLista;

// ===== FUNÇÕES DE DEBUG =====
window.debugSelectMonth = function(month) {
    console.log('=== DEBUG SELECT MONTH ===');
    selectMonth(month);
};

window.debugShowState = function() {
    console.log('=== DEBUG STATE ===');
    console.log('Ano:', state.currentYear);
    console.log('Mês:', state.currentMonth);
    console.log('Receitas:', formatCurrency(state.totalReceitas));
    console.log('Despesas:', formatCurrency(state.totalDespesas));
    console.log('Total:', formatCurrency(state.totaisPorCategoria.tudo));
};
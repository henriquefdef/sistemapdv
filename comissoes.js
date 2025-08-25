// ===== SISTEMA DE COMISSÕES - JAVASCRIPT =====

// ===== ESTADO DA APLICAÇÃO =====
const state = {
    currentYear: new Date().getFullYear(),
    currentMonth: new Date().getMonth(),
    vendedores: [],
    vendasDetalhadas: {},
    metasVendedores: {},
    supabaseClient: null,
    currentVendedorId: null
};

// ===== INICIALIZAÇÃO =====
document.addEventListener('DOMContentLoaded', () => {
    document.addEventListener('userDataReady', initializeComissoes);
});

function initializeComissoes() {
    if (!window.currentCompanyId) {
        console.error("ID da empresa não encontrado.");
        showNotification('Erro: ID da empresa não encontrado', 'error');
        return;
    }

    // Inicializar Supabase
    state.supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    
    setupEventListeners();
    loadVendedoresData();
    updateYearDisplay();
}

// ===== CONFIGURAÇÃO DE EVENTOS =====
function setupEventListeners() {
    // Navegação de ano
    document.getElementById('prev-year')?.addEventListener('click', () => changeYear(-1));
    document.getElementById('next-year')?.addEventListener('click', () => changeYear(1));

    // Navegação de meses
    document.querySelectorAll('.month-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const month = parseInt(e.target.dataset.month);
            selectMonth(month);
        });
    });

    // Modais
    document.getElementById('modal-close')?.addEventListener('click', closeVendasModal);
    document.getElementById('vendas-modal')?.addEventListener('click', (e) => {
        if (e.target.id === 'vendas-modal') closeVendasModal();
    });

    document.getElementById('meta-modal-close')?.addEventListener('click', closeMetaModal);
    document.getElementById('meta-modal')?.addEventListener('click', (e) => {
        if (e.target.id === 'meta-modal') closeMetaModal();
    });

    document.getElementById('btn-cancel-meta')?.addEventListener('click', closeMetaModal);

    // Formulário de meta
    document.getElementById('meta-form')?.addEventListener('submit', handleMetaSubmit);

    // ESC para fechar modais
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeVendasModal();
            closeMetaModal();
        }
    });
}

// ===== NAVEGAÇÃO DE ANO E MÊS =====
function changeYear(direction) {
    state.currentYear += direction;
    updateYearDisplay();
    loadVendedoresData();
}

function selectMonth(month) {
    state.currentMonth = month;
    updateMonthsDisplay();
    loadVendedoresData();
}

function updateYearDisplay() {
    const yearElement = document.getElementById('current-year');
    if (yearElement) {
        yearElement.textContent = state.currentYear;
    }
}

function updateMonthsDisplay() {
    document.querySelectorAll('.month-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    const activeBtn = document.querySelector(`[data-month="${state.currentMonth}"]`);
    if (activeBtn) {
        activeBtn.classList.add('active');
    }
}

// ===== CARREGAMENTO DE DADOS =====
async function loadVendedoresData() {
    try {
        showLoading();

        // Carregar vendedores da tabela user
        const vendedores = await loadVendedores();
        
        // Carregar metas dos vendedores
        await loadMetasVendedores();
        
        // Para cada vendedor, carregar suas vendas
        const vendedoresComDados = await Promise.all(
            vendedores.map(async (vendedor) => {
                const vendas = await loadVendasVendedor(vendedor.id);
                const analytics = calculateVendedorAnalytics(vendas);
                const meta = state.metasVendedores[vendedor.id] || { meta_mensal: 10000, comissao_percentual: 5 };
                
                return {
                    ...vendedor,
                    vendas: vendas,
                    analytics: analytics,
                    meta: meta
                };
            })
        );

        state.vendedores = vendedoresComDados;
        renderVendedores();
        
    } catch (error) {
        console.error('Erro ao carregar dados dos vendedores:', error);
        showNotification('Erro ao carregar dados dos vendedores', 'error');
        hideLoading();
    }
}

async function loadVendedores() {
    const { data, error } = await state.supabaseClient
        .from('user')
        .select('id, nome, funcao, email')
        .eq('id_empresa', window.currentCompanyId)
        .order('nome', { ascending: true });

    if (error) throw error;
    return data || [];
}

async function loadMetasVendedores() {
    try {
        const { data, error } = await state.supabaseClient
            .from('metas_vendedores')
            .select('*')
            .eq('id_empresa', window.currentCompanyId);

        if (error) throw error;

        // Organizar metas por vendedor_id
        state.metasVendedores = {};
        data?.forEach(meta => {
            state.metasVendedores[meta.vendedor_id] = meta;
        });
    } catch (error) {
        console.error('Erro ao carregar metas:', error);
        state.metasVendedores = {};
    }
}

async function loadVendasVendedor(vendedorId) {
    try {
        const startDate = new Date(state.currentYear, state.currentMonth, 1);
        const endDate = new Date(state.currentYear, state.currentMonth + 1, 0);
        
        const startDateStr = startDate.toISOString().split('T')[0];
        const endDateStr = endDate.toISOString().split('T')[0];

        const { data, error } = await state.supabaseClient
            .from('vendas')
            .select('*')
            .eq('id_empresa', window.currentCompanyId)
            .eq('vendedor_id', vendedorId)
            .gte('hora_venda', `${startDateStr}T00:00:00`)
            .lte('hora_venda', `${endDateStr}T23:59:59`)
            .order('hora_venda', { ascending: false });

        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('Erro ao carregar vendas do vendedor:', error);
        return [];
    }
}

// ===== CÁLCULOS E ANALYTICS =====
function calculateVendedorAnalytics(vendas) {
    const analytics = {
        totalVendas: vendas.length,
        totalVendido: 0,
        totalDescontos: 0,
        totalCancelamentos: 0,
        ticketMedio: 0,
        vendasAtivas: 0,
        vendasCanceladas: 0
    };

    vendas.forEach(venda => {
        const valor = parseFloat(venda.total_venda || 0);
        const desconto = parseFloat(venda.desconto_total || 0);
        
        if (venda.status === 'ATIVO') {
            analytics.totalVendido += valor;
            analytics.totalDescontos += desconto;
            analytics.vendasAtivas++;
        } else {
            analytics.totalCancelamentos += valor;
            analytics.vendasCanceladas++;
        }
    });

    if (analytics.vendasAtivas > 0) {
        analytics.ticketMedio = analytics.totalVendido / analytics.vendasAtivas;
    }

    return analytics;
}

function calculateMetaProgress(vendido, meta) {
    if (!meta || meta <= 0) return 0;
    return Math.min((vendido / meta) * 100, 150); // Máximo 150% para visualização
}

function calculateComissao(vendido, percentual) {
    return (vendido * percentual) / 100;
}

// ===== RENDERIZAÇÃO =====
function renderVendedores() {
    const container = document.getElementById('vendedores-grid');
    if (!container) return;

    if (state.vendedores.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-users"></i>
                <h3>Nenhum vendedor encontrado</h3>
                <p>Cadastre vendedores no sistema para acompanhar as comissões</p>
            </div>
        `;
        return;
    }

    container.innerHTML = state.vendedores.map(vendedor => {
        const progress = calculateMetaProgress(vendedor.analytics.totalVendido, vendedor.meta.meta_mensal);
        const comissao = calculateComissao(vendedor.analytics.totalVendido, vendedor.meta.comissao_percentual);
        const iniciais = vendedor.nome.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
        
        return `
            <div class="vendedor-card">
                <div class="vendedor-header">
                    <div class="vendedor-info">
                        <div class="vendedor-avatar">${iniciais}</div>
                        <div class="vendedor-details">
                            <h3>${vendedor.nome}</h3>
                            <p>${vendedor.funcao || 'Vendedor'}</p>
                        </div>
                    </div>
                    <div class="vendedor-actions">
                        <button class="action-icon-btn btn-ver-vendas" 
                                onclick="openVendasModal(${vendedor.id}, '${vendedor.nome}')"
                                title="Ver vendas">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="action-icon-btn btn-configurar" 
                                onclick="openMetaModal(${vendedor.id}, '${vendedor.nome}')"
                                title="Configurar meta">
                            <i class="fas fa-cog"></i>
                        </button>
                    </div>
                </div>

                <div class="meta-container">
                    <div class="meta-header">
                        <div class="meta-valor">${formatCurrency(vendedor.analytics.totalVendido)}</div>
                        <div class="meta-label">Meta: ${formatCurrency(vendedor.meta.meta_mensal)}</div>
                    </div>
                    <div class="meta-progress">
                        <div class="meta-fill ${progress >= 100 ? 'over-goal' : ''}" 
                             style="width: ${progress}%"></div>
                        <div class="meta-percentage ${progress >= 100 ? 'over-goal' : ''}">${progress.toFixed(1)}%</div>
                    </div>
                </div>

                <div class="vendedor-stats">
                    <div class="stat-item">
                        <div class="stat-number">${vendedor.analytics.totalVendas}</div>
                        <div class="stat-label">Vendas</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-number">${formatCurrency(vendedor.analytics.ticketMedio)}</div>
                        <div class="stat-label">Ticket Médio</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-number">${formatCurrency(comissao)}</div>
                        <div class="stat-label">Comissão</div>
                    </div>
                </div>

                <div class="performance-summary">
                    <div class="performance-item">
                        <div class="performance-value positive">${formatCurrency(vendedor.analytics.totalVendido)}</div>
                        <div class="performance-label">Vendido</div>
                    </div>
                    <div class="performance-item">
                        <div class="performance-value negative">${formatCurrency(vendedor.analytics.totalDescontos)}</div>
                        <div class="performance-label">Descontos</div>
                    </div>
                    <div class="performance-item">
                        <div class="performance-value neutral">${vendedor.analytics.vendasCanceladas}</div>
                        <div class="performance-label">Cancelamentos</div>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    hideLoading();
}

// ===== MODAL DE VENDAS =====
function openVendasModal(vendedorId, vendedorNome) {
    const vendedor = state.vendedores.find(v => v.id === vendedorId);
    if (!vendedor) return;

    document.getElementById('modal-title').textContent = `Vendas de ${vendedorNome}`;
    
    // Atualizar resumo
    const analytics = vendedor.analytics;
    document.getElementById('summary-vendas').textContent = analytics.totalVendas;
    document.getElementById('summary-total').textContent = formatCurrency(analytics.totalVendido);
    document.getElementById('summary-desconto').textContent = formatCurrency(analytics.totalDescontos);
    document.getElementById('summary-ticket').textContent = formatCurrency(analytics.ticketMedio);

    // Renderizar tabela de vendas
    renderVendasTable(vendedor.vendas);

    // Mostrar modal
    document.getElementById('vendas-modal').classList.add('show');
}

function renderVendasTable(vendas) {
    const tableBody = document.getElementById('vendas-table-body');
    
    if (vendas.length === 0) {
        tableBody.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-shopping-cart"></i>
                <p>Nenhuma venda encontrada neste período</p>
            </div>
        `;
        return;
    }

    tableBody.innerHTML = vendas.map(venda => {
        const data = new Date(venda.hora_venda).toLocaleDateString('pt-BR');
        const statusClass = venda.status === 'ATIVO' ? 'status-ativo' : 'status-cancelado';
        const statusText = venda.status === 'ATIVO' ? 'Ativo' : 'Cancelado';
        
        return `
            <div class="table-row">
                <div class="row-data row-id">#${venda.id_venda}</div>
                <div class="row-data row-cliente">${venda.cliente_nome || 'Cliente não identificado'}</div>
                <div class="row-data">${data}</div>
                <div class="row-data row-valor">${formatCurrency(venda.total_venda)}</div>
                <div class="row-data row-desconto">${formatCurrency(venda.desconto_total || 0)}</div>
                <div class="row-status">
                    <span class="status-badge ${statusClass}">${statusText}</span>
                </div>
            </div>
        `;
    }).join('');
}

function closeVendasModal() {
    document.getElementById('vendas-modal').classList.remove('show');
}

// ===== MODAL DE META =====
function openMetaModal(vendedorId, vendedorNome) {
    state.currentVendedorId = vendedorId;
    
    const vendedor = state.vendedores.find(v => v.id === vendedorId);
    const meta = vendedor?.meta || { meta_mensal: 10000, comissao_percentual: 5 };
    
    document.getElementById('meta-modal-title').textContent = `Meta de ${vendedorNome}`;
    document.getElementById('meta-valor').value = meta.meta_mensal;
    document.getElementById('comissao-percentual').value = meta.comissao_percentual;
    
    document.getElementById('meta-modal').classList.add('show');
}

function closeMetaModal() {
    document.getElementById('meta-modal').classList.remove('show');
    state.currentVendedorId = null;
}

async function handleMetaSubmit(e) {
    e.preventDefault();
    
    if (!state.currentVendedorId) return;
    
    const metaValor = parseFloat(document.getElementById('meta-valor').value);
    const comissaoPercentual = parseFloat(document.getElementById('comissao-percentual').value);
    
    if (metaValor <= 0 || comissaoPercentual < 0 || comissaoPercentual > 100) {
        showNotification('Valores inválidos. Verifique os dados inseridos.', 'error');
        return;
    }
    
    try {
        await saveMetaVendedor(state.currentVendedorId, metaValor, comissaoPercentual);
        showNotification('Meta atualizada com sucesso!', 'success');
        closeMetaModal();
        loadVendedoresData(); // Recarregar dados
    } catch (error) {
        console.error('Erro ao salvar meta:', error);
        showNotification('Erro ao salvar meta', 'error');
    }
}

async function saveMetaVendedor(vendedorId, metaMensal, comissaoPercentual) {
    const metaData = {
        id_empresa: window.currentCompanyId,
        vendedor_id: vendedorId,
        meta_mensal: metaMensal,
        comissao_percentual: comissaoPercentual,
        updated_at: new Date().toISOString()
    };

    const { data, error } = await state.supabaseClient
        .from('metas_vendedores')
        .upsert(metaData)
        .select()
        .single();

    if (error) throw error;
    return data;
}

// ===== UTILITÁRIOS =====
function formatCurrency(value) {
    if (typeof value !== 'number') value = parseFloat(value) || 0;
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(value);
}

function showLoading() {
    const container = document.getElementById('vendedores-grid');
    if (container) {
        container.innerHTML = `
            <div class="loading-state">
                <div class="loading-spinner"></div>
                <span>Carregando dados dos vendedores...</span>
            </div>
        `;
    }
}

function hideLoading() {
    // A função de renderização irá substituir o loading
}

function showNotification(message, type) {
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

// ===== FUNÇÕES GLOBAIS PARA ONCLICK =====
window.openVendasModal = openVendasModal;
window.openMetaModal = openMetaModal;

// ===== INICIALIZAÇÃO =====
console.log('Sistema de Comissões carregado!');

// ===== CRIAR TABELA METAS_VENDEDORES SE NÃO EXISTIR =====
async function ensureMetasTable() {
    try {
        // Verificar se a tabela existe tentando fazer uma consulta
        const { data, error } = await state.supabaseClient
            .from('metas_vendedores')
            .select('id')
            .limit(1);

        if (error && error.code === '42P01') {
            // Tabela não existe - seria necessário criar via SQL
            console.warn('Tabela metas_vendedores não existe. Crie-a manualmente no Supabase com os campos:');
            console.warn('- id (int8, primary key)');
            console.warn('- id_empresa (int8, not null)');
            console.warn('- vendedor_id (int8, not null)');
            console.warn('- meta_mensal (numeric, default 10000)');
            console.warn('- comissao_percentual (numeric, default 5)');
            console.warn('- created_at (timestamptz, default now())');
            console.warn('- updated_at (timestamptz, default now())');
        }
    } catch (error) {
        console.error('Erro ao verificar tabela metas_vendedores:', error);
    }
}

// Chamar verificação da tabela quando a aplicação inicializar
document.addEventListener('userDataReady', () => {
    setTimeout(ensureMetasTable, 2000);
});
// ===== GESTÃO DE CLIENTES - VERSÃO CORRIGIDA =====

// ===== ESTADO GLOBAL =====
const gestaoState = {
    supabaseClient: null,
    currentPeriod: 30,
    clientsData: [],
    salesData: [],
    productsData: [],
    processedClients: [],
    frequencyData: [],
    birthdayData: [],
    currentClient: null,
    charts: {},
    filters: {
        period: 30,
        startDate: null,
        endDate: null
    },
    initialized: false,
    pagination: {
        frequency: {
            currentPage: 1,
            pageSize: 10,
            totalItems: 0,
            totalPages: 1,
            initialized: false
        }
    }
};

// ===== INICIALIZAÇÃO =====
document.addEventListener('userDataReady', async () => {
    if (!window.currentCompanyId || !window.currentUser) {
        console.error('❌ Dados da empresa ou usuário não encontrados');
        showNotification('Erro: dados da empresa não encontrados', 'error');
        return;
    }

    console.log('🚀 Inicializando Gestão de Clientes Corrigida');
    await waitForSupabase();
    gestaoState.initialized = true;
    initializeGestaoClientes();
});

async function waitForSupabase() {
    return new Promise((resolve) => {
        const checkSupabase = () => {
            if (window.supabaseClient || (window.supabase && window.currentCompanyId)) {
                gestaoState.supabaseClient = window.supabaseClient || window.supabase.createClient(
                    'https://gnehkswoqlpchtlgyjyj.supabase.co',
                    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImduZWhrc3dvcWxwY2h0bGd5anlqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM4OTY3NjYsImV4cCI6MjA2OTQ3Mjc2Nn0.8giA1bDvCzgvlcW_pkimGO9qHRF2I0QfhG6nx9U_tdY'
                );
                resolve();
            } else {
                setTimeout(checkSupabase, 100);
            }
        };
        checkSupabase();
    });
}

async function initializeGestaoClientes() {
    try {
        showLoading(true);
        
        setupEventListeners();
        await loadAllData();
        renderDashboard();
        
        console.log('✅ Gestão de Clientes inicializada com sucesso');
        
    } catch (error) {
        console.error('❌ Erro na inicialização:', error);
        showNotification('Erro ao carregar gestão de clientes', 'error');
    } finally {
        showLoading(false);
    }
}

// ===== EVENT LISTENERS =====
function setupEventListeners() {
    console.log('🔗 Configurando event listeners...');
    
    // Botões de período
    document.querySelectorAll('.period-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const period = e.target.dataset.period;
            handlePeriodChange(period);
        });
    });
    
    // Aplicar período customizado
    const applyCustomBtn = document.getElementById('apply-custom-period');
    if (applyCustomBtn) {
        applyCustomBtn.addEventListener('click', handleCustomPeriod);
    }
    
    // Botão de atualizar dados
    const refreshBtn = document.getElementById('refresh-data');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', async () => {
            showLoading(true);
            await loadAllData();
            renderDashboard();
            showLoading(false);
            showNotification('Dados atualizados com sucesso!', 'success');
        });
    }
    
    // Seletor de tipo de ranking
    const rankingSelect = document.getElementById('ranking-type');
    if (rankingSelect) {
        rankingSelect.addEventListener('change', updateTopClientes);
    }
    
    // Filtro de localização do gráfico
    const locationFilter = document.getElementById('location-filter');
    if (locationFilter) {
        locationFilter.addEventListener('change', () => {
            renderCidadesChart();
        });
    }
    
    // Filtros de frequência
    const frequencyStatusFilter = document.getElementById('frequency-status-filter');
    if (frequencyStatusFilter) {
        frequencyStatusFilter.addEventListener('change', () => {
            gestaoState.pagination.frequency.currentPage = 1;
            filterFrequencyTable();
        });
    }
    
    const frequencySearch = document.getElementById('frequency-search');
    if (frequencySearch) {
        frequencySearch.addEventListener('input', debounce(() => {
            gestaoState.pagination.frequency.currentPage = 1;
            filterFrequencyTable();
        }, 300));
    }
    
    // Inicializar controles de paginação da Frequência
    initFrequencyPaginationControls();
    
    console.log('✅ Event listeners configurados');
}

// ===== CARREGAMENTO DE DADOS =====
async function loadAllData() {
    try {
        const { start, end } = calculateDateRange();
        
        console.log('📊 Carregando dados do período:', { start, end });
        
        await Promise.all([
            loadClientsData(),
            loadSalesData(start, end),
            loadProductsData()
        ]);
        
        processClientData();
        await processFrequencyData();
        processBirthdayData();
        
        console.log('✅ Todos os dados carregados:', {
            clientes: gestaoState.clientsData.length,
            vendas: gestaoState.salesData.length,
            produtos: gestaoState.productsData.length,
            processados: gestaoState.processedClients.length,
            frequencia: gestaoState.frequencyData.length,
            aniversarios: gestaoState.birthdayData.length
        });
        
    } catch (error) {
        console.error('❌ Erro ao carregar dados:', error);
        throw error;
    }
}

async function loadClientsData() {
    try {
        const { data, error } = await gestaoState.supabaseClient
            .from('clientes')
            .select('*')
            .eq('id_empresa', window.currentCompanyId)
            .order('nome', { ascending: true });

        if (error) throw error;

        gestaoState.clientsData = data || [];
        console.log('📋 Clientes carregados:', gestaoState.clientsData.length);
        
    } catch (error) {
        console.error('❌ Erro ao carregar clientes:', error);
        gestaoState.clientsData = [];
        throw error;
    }
}

async function loadSalesData(startDate, endDate) {
    try {
        let query = gestaoState.supabaseClient
            .from('vendas')
            .select('*')
            .eq('id_empresa', window.currentCompanyId)
            .eq('status', 'ATIVO')
            .not('cliente_nome', 'is', null);

        if (startDate && endDate) {
            query = query.gte('hora_venda', startDate).lte('hora_venda', endDate);
        }

        const { data, error } = await query.order('hora_venda', { ascending: false });

        if (error) throw error;

        gestaoState.salesData = data || [];
        console.log('💰 Vendas carregadas:', gestaoState.salesData.length);
        
    } catch (error) {
        console.error('❌ Erro ao carregar vendas:', error);
        gestaoState.salesData = [];
        throw error;
    }
}

async function loadProductsData() {
    try {
        const { data, error } = await gestaoState.supabaseClient
            .from('produtos')
            .select('*')
            .eq('id_empresa', window.currentCompanyId);

        if (error) throw error;
        
        gestaoState.productsData = data || [];
        console.log('📦 Produtos carregados:', gestaoState.productsData.length);
        
    } catch (error) {
        console.error('❌ Erro ao carregar produtos:', error);
        gestaoState.productsData = [];
        throw error;
    }
}

// ===== PROCESSAMENTO DE DADOS =====
function processClientData() {
    const clientsMap = new Map();
    const today = new Date();
    
    // Adicionar todos os clientes cadastrados
    gestaoState.clientsData.forEach(cliente => {
        if (cliente.nome) {
            clientsMap.set(cliente.nome, {
                nome: cliente.nome,
                telefone: cliente.telefone || null,
                email: cliente.email || null,
                cidade: cliente.cidade || null,
                bairro: cliente.bairro || null,
                estado: cliente.estado || null,
                data_nascimento: cliente.data_nascimento || null,
                total_gasto: 0,
                total_compras: 0,
                ultima_compra: null,
                primeira_compra: null,
                produtos_comprados: new Set(),
                vendas: [],
                status: 'Inativo',
                tipo_cliente: 'sem_compras',
                tipo_cliente_display: 'Sem Compras',
                ticket_medio: 0,
                dias_sem_comprar: null
            });
        }
    });
    
    // Processar vendas para agrupar por cliente
    gestaoState.salesData.forEach(sale => {
        const clientKey = sale.cliente_nome;
        if (!clientKey) return;

        if (!clientsMap.has(clientKey)) {
            clientsMap.set(clientKey, {
                nome: sale.cliente_nome,
                telefone: sale.cliente_telefone || null,
                email: null,
                cidade: null,
                bairro: null,
                estado: null,
                data_nascimento: null,
                total_gasto: 0,
                total_compras: 0,
                ultima_compra: null,
                primeira_compra: null,
                produtos_comprados: new Set(),
                vendas: [],
                status: 'Ativo',
                tipo_cliente: 'primeira_compra',
                tipo_cliente_display: 'Primeira Compra',
                ticket_medio: 0,
                dias_sem_comprar: null
            });
        }

        const client = clientsMap.get(clientKey);
        const saleDate = new Date(sale.hora_venda);
        const saleValue = parseFloat(sale.total_venda) || 0;

        client.total_gasto += saleValue;
        client.total_compras += 1;
        client.vendas.push(sale);
        client.status = 'Ativo';

        if (!client.ultima_compra || saleDate > new Date(client.ultima_compra)) {
            client.ultima_compra = sale.hora_venda;
        }
        if (!client.primeira_compra || saleDate < new Date(client.primeira_compra)) {
            client.primeira_compra = sale.hora_venda;
        }

        if (sale.produto_nome) {
            client.produtos_comprados.add(sale.produto_nome);
        }
    });

    const processedClients = Array.from(clientsMap.values()).map(client => {
        client.ticket_medio = client.total_compras > 0 ? client.total_gasto / client.total_compras : 0;
        
        if (client.ultima_compra) {
            const ultimaCompraDate = new Date(client.ultima_compra);
            client.dias_sem_comprar = Math.floor((today - ultimaCompraDate) / (1000 * 60 * 60 * 24));
        }
        
        if (client.total_compras === 0) {
            client.tipo_cliente = 'sem_compras';
            client.tipo_cliente_display = 'Sem Compras';
            client.status = 'Inativo';
        } else if (client.total_compras === 1) {
            client.tipo_cliente = 'primeira_compra';
            client.tipo_cliente_display = 'Primeira Compra';
        } else if (client.total_compras >= 2 && client.total_compras <= 5) {
            client.tipo_cliente = 'desenvolvimento';
            client.tipo_cliente_display = 'Em Desenvolvimento';
        } else if (client.total_compras >= 6 && client.total_compras <= 15) {
            client.tipo_cliente = 'fiel';
            client.tipo_cliente_display = 'Cliente Fiel';
        } else if (client.total_compras > 15) {
            client.tipo_cliente = 'vip';
            client.tipo_cliente_display = 'Cliente VIP';
        }
        
        client.produtos_comprados = Array.from(client.produtos_comprados);
        return client;
    });

    gestaoState.processedClients = processedClients;
    console.log(`📊 Processados ${processedClients.length} clientes`);
}

// ===== PROCESSAMENTO DE FREQUÊNCIA DE RECOMPRA =====
async function processFrequencyData() {
    try {
        console.log('🔄 Processando dados de frequência...');
        
        // Criar mapa de produtos com frequência
        const produtosFrequenciaMap = new Map();
        gestaoState.productsData.forEach(produto => {
            if (produto.frequencia && produto.frequencia.trim()) {
                produtosFrequenciaMap.set(produto.nome, produto.frequencia);
            }
        });

        console.log(`📦 Produtos com frequência: ${produtosFrequenciaMap.size}`);

        // Filtrar vendas que têm produtos com frequência
        const vendasComFrequencia = gestaoState.salesData.filter(venda => {
            return produtosFrequenciaMap.has(venda.produto_nome);
        });

        console.log(`💰 Vendas com produtos de frequência: ${vendasComFrequencia.length}`);

        // Processar dados para análise de frequência
        const clientsFrequencyMap = new Map();
        const today = new Date();

        vendasComFrequencia.forEach(venda => {
            const clienteKey = `${venda.cliente_nome}_${venda.produto_nome}`;
            const produtoNome = venda.produto_nome;
            const frequencia = produtosFrequenciaMap.get(produtoNome);
            
            if (!clientsFrequencyMap.has(clienteKey)) {
                const ultimaCompra = new Date(venda.hora_venda);
                const frequenciaDias = convertFrequencyToDays(frequencia);
                const diasDesdeUltimaCompra = Math.floor((today - ultimaCompra) / (1000 * 60 * 60 * 24));
                const proximaCompraEsperada = new Date(ultimaCompra);
                proximaCompraEsperada.setDate(proximaCompraEsperada.getDate() + frequenciaDias);
                
                let statusRecompra = 'Normal';
                let diasAtraso = 0;
                
                if (today > proximaCompraEsperada) {
                    diasAtraso = Math.floor((today - proximaCompraEsperada) / (1000 * 60 * 60 * 24));
                    statusRecompra = diasAtraso > 7 ? 'Atrasado' : 'Em Breve';
                }
                
                // Buscar telefone do cliente
                const clienteData = gestaoState.clientsData.find(c => c.nome === venda.cliente_nome);
                
                clientsFrequencyMap.set(clienteKey, {
                    cliente_nome: venda.cliente_nome,
                    produto_nome: produtoNome,
                    frequencia_uso: frequencia,
                    ultima_compra: ultimaCompra.toISOString().split('T')[0],
                    proxima_compra_esperada: proximaCompraEsperada.toISOString().split('T')[0],
                    status_recompra: statusRecompra,
                    dias_atraso: diasAtraso,
                    telefone: clienteData?.telefone || venda.cliente_telefone || null,
                    total_compras: 1,
                    valor_ultima_compra: parseFloat(venda.total_venda) || 0
                });
            } else {
                const existing = clientsFrequencyMap.get(clienteKey);
                existing.total_compras += 1;
                
                const dataVenda = new Date(venda.hora_venda);
                const ultimaCompraExistente = new Date(existing.ultima_compra);
                
                if (dataVenda > ultimaCompraExistente) {
                    const frequenciaDias = convertFrequencyToDays(existing.frequencia_uso);
                    const proximaCompraEsperada = new Date(dataVenda);
                    proximaCompraEsperada.setDate(proximaCompraEsperada.getDate() + frequenciaDias);
                    
                    let statusRecompra = 'Normal';
                    let diasAtraso = 0;
                    
                    if (today > proximaCompraEsperada) {
                        diasAtraso = Math.floor((today - proximaCompraEsperada) / (1000 * 60 * 60 * 24));
                        statusRecompra = diasAtraso > 7 ? 'Atrasado' : 'Em Breve';
                    }
                    
                    existing.ultima_compra = dataVenda.toISOString().split('T')[0];
                    existing.proxima_compra_esperada = proximaCompraEsperada.toISOString().split('T')[0];
                    existing.status_recompra = statusRecompra;
                    existing.dias_atraso = diasAtraso;
                    existing.valor_ultima_compra = parseFloat(venda.total_venda) || 0;
                }
            }
        });

        // Converter para array e ordenar por urgência
        const frequencyData = Array.from(clientsFrequencyMap.values()).sort((a, b) => {
            const statusPriority = { 'Atrasado': 3, 'Em Breve': 2, 'Normal': 1 };
            const statusDiff = statusPriority[b.status_recompra] - statusPriority[a.status_recompra];
            if (statusDiff !== 0) return statusDiff;
            return b.dias_atraso - a.dias_atraso;
        });

        gestaoState.frequencyData = frequencyData;
        console.log(`📊 Processados ${frequencyData.length} registros de frequência`);

    } catch (error) {
        console.error('❌ Erro ao processar dados de frequência:', error);
        gestaoState.frequencyData = [];
    }
}

// ===== PROCESSAMENTO DE ANIVERSÁRIOS =====
function processBirthdayData() {
    const today = new Date();
    const next30Days = new Date();
    next30Days.setDate(today.getDate() + 30);
    
    const birthdayClients = gestaoState.clientsData.filter(client => {
        if (!client.data_nascimento) return false;
        
        const birthDate = new Date(client.data_nascimento);
        const thisYearBirthday = new Date(today.getFullYear(), birthDate.getMonth(), birthDate.getDate());
        
        // Se o aniversário já passou este ano, considerar o próximo ano
        if (thisYearBirthday < today) {
            thisYearBirthday.setFullYear(today.getFullYear() + 1);
        }
        
        return thisYearBirthday >= today && thisYearBirthday <= next30Days;
    }).map(client => {
        const birthDate = new Date(client.data_nascimento);
        const thisYearBirthday = new Date(today.getFullYear(), birthDate.getMonth(), birthDate.getDate());
        
        if (thisYearBirthday < today) {
            thisYearBirthday.setFullYear(today.getFullYear() + 1);
        }
        
        const daysUntil = Math.ceil((thisYearBirthday - today) / (1000 * 60 * 60 * 24));
        const age = today.getFullYear() - birthDate.getFullYear();
        
        return {
            ...client,
            dias_ate_aniversario: daysUntil,
            idade_completara: daysUntil === 0 ? age : age + 1,
            data_aniversario: thisYearBirthday
        };
    }).sort((a, b) => a.dias_ate_aniversario - b.dias_ate_aniversario);
    
    gestaoState.birthdayData = birthdayClients;
    console.log(`🎂 Aniversariantes próximos 30 dias: ${birthdayClients.length}`);
}
// ===== RENDERIZAÇÃO DO DASHBOARD =====
function renderDashboard() {
    updateHeaderStats();
    updateTopClientes();
    updateFrequencyTable();
    renderBirthdayList();
    renderCharts();
}

function updateHeaderStats() {
    const totalClientes = gestaoState.processedClients.length;
    const clientesAtivos = gestaoState.processedClients.filter(c => c.status === 'Ativo').length;
    const aniversariosHoje = gestaoState.birthdayData.filter(c => c.dias_ate_aniversario === 0).length;
    const alertasRecompra = gestaoState.frequencyData.filter(f => f.status_recompra === 'Atrasado').length;
    
    updateElement('total-clientes', totalClientes);
    updateElement('clientes-ativos', clientesAtivos);
    updateElement('aniversarios-hoje', aniversariosHoje);
    updateElement('alertas-recompra', alertasRecompra);
}

function updateTopClientes() {
    const listEl = document.getElementById('top-compradores-list');
    if (!listEl) return;

    const sorted = [...gestaoState.processedClients]
        .sort((a, b) => (b.total_gasto || 0) - (a.total_gasto || 0))
        .slice(0, 10);

    listEl.innerHTML = sorted.map((client, index) => {
        const pos = index + 1;
        const details = `${client.cidade || 'N/A'} • ${client.total_compras || 0} compras`;

        return `
            <div class="ranking-item" onclick="showClientDetails('${client.nome}')">
                <div class="ranking-position">${pos}</div>
                <div class="ranking-info">
                    <div class="ranking-name">${client.nome}</div>
                    <div class="ranking-details">${details}</div>
                </div>
                <div class="ranking-value">${formatCurrency(client.total_gasto || 0)}</div>
            </div>
        `;
    }).join('');
}

function updateFrequencyTable() {
    const tbody = document.getElementById('frequency-table-body');
    if (!tbody) return;

    const filteredData = applyFrequencyFilters();
    
    // Atualizar estado de paginação
    const p = gestaoState.pagination.frequency;
    p.totalItems = filteredData.length;
    p.totalPages = Math.max(1, Math.ceil(p.totalItems / p.pageSize));
    if (p.currentPage > p.totalPages) p.currentPage = p.totalPages;
    const startIndex = (p.currentPage - 1) * p.pageSize;
    const pageItems = filteredData.slice(startIndex, startIndex + p.pageSize);

    tbody.innerHTML = pageItems.map(item => {
        const statusClass = item.status_recompra === 'Atrasado' ? 'status-atrasado' : 
                           item.status_recompra === 'Em Breve' ? 'status-breve' : 'status-ok';
        
        const urgencyClass = item.dias_atraso > 30 ? 'urgency-high' : 
                            item.dias_atraso > 0 ? 'urgency-medium' : 'urgency-low';

        return `
            <tr class="${urgencyClass}">
                <td>
                    <div class="client-product-info">
                        <strong>${item.cliente_nome}</strong>
                    </div>
                </td>
                <td><strong>${item.produto_nome}</strong></td>
                <td>${item.frequencia_uso}</td>
                <td>${formatDate(item.ultima_compra)}</td>
                <td>${formatDate(item.proxima_compra_esperada)}</td>
                <td><span class="status-badge ${statusClass}">${item.status_recompra}</span></td>
                <td class="dias-atraso ${item.dias_atraso > 0 ? 'text-danger' : ''}">${item.dias_atraso > 0 ? `+${item.dias_atraso}` : item.dias_atraso}</td>
                <td>${formatCurrency(item.valor_ultima_compra)}</td>
                <td>
                    <div class="action-buttons">
                        ${item.telefone ? 
                            `<button onclick="sendRecompraWhatsApp(${JSON.stringify({nome: item.cliente_nome, telefone: item.telefone}).replace(/"/g, '&quot;')}, '${item.produto_nome}', '${item.frequencia_uso}')" 
                                     class="btn-whatsapp" title="Lembrete de Recompra">
                                <i class="fab fa-whatsapp"></i>
                            </button>` : 
                            '<span class="no-phone">Sem telefone</span>'
                        }
                    </div>
                </td>
            </tr>
        `;
    }).join('');
    // Atualizar UI de paginação
    renderFrequencyPagination();
}

function initFrequencyPaginationControls() {
    const prevBtn = document.getElementById('freq-prev-page');
    const nextBtn = document.getElementById('freq-next-page');
    if (!prevBtn || !nextBtn) return;

    if (!gestaoState.pagination.frequency.initialized) {
        prevBtn.addEventListener('click', () => {
            const p = gestaoState.pagination.frequency;
            if (p.currentPage > 1) {
                p.currentPage--;
                updateFrequencyTable();
            }
        });
        nextBtn.addEventListener('click', () => {
            const p = gestaoState.pagination.frequency;
            if (p.currentPage < p.totalPages) {
                p.currentPage++;
                updateFrequencyTable();
            }
        });
        gestaoState.pagination.frequency.initialized = true;
    }
}

function renderFrequencyPagination() {
    const infoEl = document.getElementById('frequency-pagination-info');
    const prevBtn = document.getElementById('freq-prev-page');
    const nextBtn = document.getElementById('freq-next-page');
    const pageLabel = document.getElementById('freq-page-numbers');
    if (!infoEl || !prevBtn || !nextBtn || !pageLabel) return;

    const p = gestaoState.pagination.frequency;
    const startItem = p.totalItems === 0 ? 0 : (p.currentPage - 1) * p.pageSize + 1;
    const endItem = Math.min(p.currentPage * p.pageSize, p.totalItems);
    infoEl.textContent = `Mostrando ${startItem}–${endItem} de ${p.totalItems}`;
    pageLabel.textContent = `Página ${p.currentPage} de ${p.totalPages}`;
    prevBtn.disabled = p.currentPage <= 1;
    nextBtn.disabled = p.currentPage >= p.totalPages;
}

function renderBirthdayList() {
    const container = document.getElementById('birthday-list');
    if (!container) return;

    if (gestaoState.birthdayData.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-birthday-cake"></i>
                <h4>Nenhum aniversário nos próximos 30 dias</h4>
                <p>Que tal aproveitar para atualizar os dados de nascimento dos seus clientes?</p>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <div class="birthday-items">
            ${gestaoState.birthdayData.slice(0, 10).map(client => `
                <div class="birthday-item ${client.dias_ate_aniversario === 0 ? 'birthday-today' : ''}">
                    <div class="birthday-avatar">
                        <i class="fas fa-user"></i>
                    </div>
                    <div class="birthday-info">
                        <h5>${client.nome}</h5>
                        <p>${client.dias_ate_aniversario === 0 ? 'HOJE!' : `Em ${client.dias_ate_aniversario} dias`}</p>
                        <small>Completará ${client.idade_completara} anos</small>
                    </div>
                    <div class="birthday-actions">
                        ${client.telefone ? 
                            `<button onclick="sendBirthdayWhatsApp(${JSON.stringify(client).replace(/"/g, '&quot;')})" 
                                     class="btn-birthday" title="Enviar Parabéns">
                                <i class="fab fa-whatsapp"></i>
                            </button>` : 
                            '<span class="no-phone-small">Sem tel.</span>'
                        }
                    </div>
                </div>
            `).join('')}
        </div>
        ${gestaoState.birthdayData.length > 10 ? 
            `<div class="birthday-more">
                <p>+ ${gestaoState.birthdayData.length - 10} outros aniversariantes</p>
            </div>` : ''
        }
    `;
}

// ===== FILTROS =====
function applyFrequencyFilters() {
    const statusFilter = document.getElementById('frequency-status-filter')?.value;
    const searchTerm = document.getElementById('frequency-search')?.value?.toLowerCase();

    return gestaoState.frequencyData.filter(item => {
        if (statusFilter && statusFilter !== 'all') {
            if (statusFilter === 'atrasado' && item.status_recompra !== 'Atrasado') return false;
            if (statusFilter === 'breve' && item.status_recompra !== 'Em Breve') return false;
            if (statusFilter === 'normal' && item.status_recompra !== 'Normal') return false;
        }

        if (searchTerm) {
            const searchableText = `${item.cliente_nome} ${item.produto_nome}`.toLowerCase();
            if (!searchableText.includes(searchTerm)) return false;
        }

        return true;
    });
}

function filterFrequencyTable() {
    updateFrequencyTable();
}

// ===== GRÁFICOS =====
function renderCharts() {
    renderCidadesChart();
    renderInatividadeChart();
    renderPadraoComprasChart();
}

function renderCidadesChart() {
    const ctx = document.getElementById('cidades-chart');
    if (!ctx) return;

    const locationFilter = document.getElementById('location-filter');
    const filterType = locationFilter ? locationFilter.value : 'cidade';
    
    const locationsCount = {};
    gestaoState.processedClients.forEach(client => {
        let location;
        if (filterType === 'bairro') {
            location = client.bairro || 'Não informado';
        } else {
            location = client.cidade || 'Não informado';
        }
        locationsCount[location] = (locationsCount[location] || 0) + 1;
    });

    const sortedLocations = Object.entries(locationsCount)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10);

    if (gestaoState.charts.cidades) {
        gestaoState.charts.cidades.destroy();
    }

    gestaoState.charts.cidades = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: sortedLocations.map(([location]) => location),
            datasets: [{
                data: sortedLocations.map(([, count]) => count),
                backgroundColor: [
                    '#FF9800', '#FFB74D', '#FFC107', '#FF5722', '#4CAF50',
                    '#2196F3', '#9C27B0', '#607D8B', '#795548', '#E91E63'
                ],
                borderWidth: 2,
                borderColor: '#ffffff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        padding: 20,
                        usePointStyle: true
                    }
                }
            }
        }
    });
}

function renderInatividadeChart() {
    const ctx = document.getElementById('inatividade-chart');
    if (!ctx) return;

    const inatividade = {
        '0-30 dias': 0,
        '31-60 dias': 0,
        '61-90 dias': 0,
        '91-180 dias': 0,
        'Mais de 180 dias': 0,
        'Sem compras': 0
    };

    gestaoState.processedClients.forEach(client => {
        const dias = client.dias_sem_comprar;
        if (dias === null) {
            inatividade['Sem compras']++;
        } else if (dias <= 30) {
            inatividade['0-30 dias']++;
        } else if (dias <= 60) {
            inatividade['31-60 dias']++;
        } else if (dias <= 90) {
            inatividade['61-90 dias']++;
        } else if (dias <= 180) {
            inatividade['91-180 dias']++;
        } else {
            inatividade['Mais de 180 dias']++;
        }
    });

    if (gestaoState.charts.inatividade) {
        gestaoState.charts.inatividade.destroy();
    }

    gestaoState.charts.inatividade = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: Object.keys(inatividade),
            datasets: [{
                label: 'Número de Clientes',
                data: Object.values(inatividade),
                backgroundColor: [
                    '#4CAF50', '#8BC34A', '#FFC107', '#FF9800', '#FF5722', '#F44336'
                ]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: { beginAtZero: true, ticks: { stepSize: 1 } }
            },
            // Tornar o clique robusto em Chart.js v4
            onClick: (evt, elements, chart) => {
                try {
                    const points = chart?.getElementsAtEventForMode
                        ? chart.getElementsAtEventForMode(evt, 'nearest', { intersect: true }, true)
                        : elements;
                    if (points && points.length > 0) {
                        const idx = points[0].index ?? points[0]._index ?? 0;
                        const labels = chart?.data?.labels || Object.keys(inatividade);
                        const period = labels[idx];
                        if (period) {
                            showInactivityModal(period);
                        }
                    }
                } catch (e) {
                    console.warn('Falha ao detectar clique no gráfico de Inatividade:', e);
                }
            }
        }
    });
}

function renderPadraoComprasChart() {
    const ctx = document.getElementById('padrao-compras-chart');
    if (!ctx) return;

    const padroes = {
        'Primeira Compra': 0,
        'Em Desenvolvimento': 0,
        'Cliente Fiel': 0,
        'Cliente VIP': 0,
        'Sem Compras': 0
    };

    gestaoState.processedClients.forEach(client => {
        padroes[client.tipo_cliente_display] = (padroes[client.tipo_cliente_display] || 0) + 1;
    });

    if (gestaoState.charts.padraoCompras) {
        gestaoState.charts.padraoCompras.destroy();
    }

    gestaoState.charts.padraoCompras = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: Object.keys(padroes),
            datasets: [{
                data: Object.values(padroes),
                backgroundColor: ['#FFC107', '#FF9800', '#4CAF50', '#2196F3', '#F44336']
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'right' }
            }
        }
    });
}

// ===== UTILITÁRIOS =====
function convertFrequencyToDays(frequency) {
    if (!frequency) return 30;
    
    const freq = frequency.toLowerCase();
    
    if (freq.includes('dia')) {
        const match = freq.match(/\d+/);
        return match ? parseInt(match[0]) : 1;
    }
    
    if (freq.includes('semana')) {
        const match = freq.match(/\d+/);
        return match ? parseInt(match[0]) * 7 : 7;
    }
    
    if (freq.includes('mês') || freq.includes('mes')) {
        const match = freq.match(/\d+/);
        return match ? parseInt(match[0]) * 30 : 30;
    }
    
    if (freq.includes('ano')) {
        const match = freq.match(/\d+/);
        return match ? parseInt(match[0]) * 365 : 365;
    }
    
    const numberMatch = freq.match(/\d+/);
    if (numberMatch) {
        return parseInt(numberMatch[0]);
    }
    
    return 30;
}

function calculateDateRange() {
    const end = new Date();
    const start = new Date();
    
    if (gestaoState.filters.startDate && gestaoState.filters.endDate) {
        return {
            start: gestaoState.filters.startDate,
            end: gestaoState.filters.endDate
        };
    }
    
    start.setDate(start.getDate() - gestaoState.currentPeriod);
    
    return {
        start: start.toISOString().split('T')[0],
        end: end.toISOString().split('T')[0]
    };
}

function handlePeriodChange(period) {
    document.querySelectorAll('.period-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelector(`[data-period="${period}"]`).classList.add('active');

    const customDates = document.getElementById('custom-dates');
    
    if (period === 'custom') {
        customDates.style.display = 'flex';
        return;
    } else {
        customDates.style.display = 'none';
    }

    gestaoState.currentPeriod = parseInt(period);
    gestaoState.filters.period = parseInt(period);
    gestaoState.filters.startDate = null;
    gestaoState.filters.endDate = null;

    loadAllData().then(() => {
        renderDashboard();
    });
}

function handleCustomPeriod() {
    const startDate = document.getElementById('start-date').value;
    const endDate = document.getElementById('end-date').value;

    if (!startDate || !endDate) {
        showNotification('Selecione ambas as datas', 'warning');
        return;
    }

    if (new Date(startDate) > new Date(endDate)) {
        showNotification('Data inicial deve ser menor que a final', 'error');
        return;
    }

    gestaoState.filters.startDate = startDate;
    gestaoState.filters.endDate = endDate;
    gestaoState.currentPeriod = 'custom';

    loadAllData().then(() => {
        renderDashboard();
    });
}

// ===== MODAL DE DETALHES DO CLIENTE =====
async function showClientDetails(clientName) {
    const client = gestaoState.processedClients.find(c => c.nome === clientName);
    
    if (!client) {
        showNotification('Cliente não encontrado', 'error');
        return;
    }

    gestaoState.currentClient = client;

    updateElement('client-detail-title', `Detalhes: ${client.nome}`);
    updateElement('detail-nome', client.nome);
    updateElement('detail-telefone', client.telefone || 'Não informado');
    updateElement('detail-email', client.email || 'Não informado');
    updateElement('detail-cidade', client.cidade ? `${client.cidade} - ${client.estado}` : 'Não informado');

    updateElement('detail-total-gasto', formatCurrency(client.total_gasto));
    updateElement('detail-total-compras', client.total_compras);
    updateElement('detail-ticket-medio', formatCurrency(client.ticket_medio));
    updateElement('detail-ultima-compra', client.ultima_compra ? formatDate(client.ultima_compra) : 'Nunca');

    await loadClientHistory(client);

    const modal = document.getElementById('client-detail-modal');
    if (modal) {
        modal.style.display = 'flex';
    }
}

async function loadClientHistory(client) {
    const tbody = document.getElementById('client-history-body');
    if (!tbody || !client.vendas) return;

    const salesByDate = {};
    client.vendas.forEach(sale => {
        const date = new Date(sale.hora_venda).toDateString();
        if (!salesByDate[date]) {
            salesByDate[date] = {
                date: sale.hora_venda,
                produtos: [],
                quantidade: 0,
                valor: 0,
                forma_pagamento: sale.forma_pagamento
            };
        }
        salesByDate[date].produtos.push(sale.produto_nome);
        salesByDate[date].quantidade += sale.quantidade_unit || 1;
        salesByDate[date].valor += parseFloat(sale.total_venda) || 0;
    });

    const groupedSales = Object.values(salesByDate).sort((a, b) => new Date(b.date) - new Date(a.date));

    tbody.innerHTML = groupedSales.map(sale => `
        <tr>
            <td>${formatDate(sale.date)}</td>
            <td>
                <div title="${sale.produtos.join(', ')}">
                    ${sale.produtos.length === 1 ? sale.produtos[0] : `${sale.produtos[0]} +${sale.produtos.length - 1}`}
                </div>
            </td>
            <td>${sale.quantidade}</td>
            <td><strong>${formatCurrency(sale.valor)}</strong></td>
            <td>${sale.forma_pagamento}</td>
        </tr>
    `).join('');
}

function closeClientDetailModal() {
    const modal = document.getElementById('client-detail-modal');
    if (modal) {
        modal.style.display = 'none';
    }
    gestaoState.currentClient = null;
}

function sendClientWhatsApp() {
    if (!gestaoState.currentClient) return;
    
    const client = gestaoState.currentClient;
    if (!client.telefone) {
        showNotification('Cliente não possui telefone cadastrado', 'warning');
        return;
    }

    openWhatsAppModal(client, 'boas-vindas');
}

function generateClientReport() {
    if (!gestaoState.currentClient) return;
    
    const client = gestaoState.currentClient;
    
    const report = `
RELATÓRIO DO CLIENTE
====================

Nome: ${client.nome}
Telefone: ${client.telefone || 'Não informado'}
E-mail: ${client.email || 'Não informado'}
Cidade: ${client.cidade || 'Não informado'}

ESTATÍSTICAS DE COMPRAS
======================

Total Gasto: ${formatCurrency(client.total_gasto)}
Total de Compras: ${client.total_compras}
Ticket Médio: ${formatCurrency(client.ticket_medio)}
Primeira Compra: ${client.primeira_compra ? formatDate(client.primeira_compra) : 'Não informado'}
Última Compra: ${client.ultima_compra ? formatDate(client.ultima_compra) : 'Não informado'}
Dias sem Comprar: ${client.dias_sem_comprar || 'N/A'}
Status: ${client.status}
Tipo de Cliente: ${client.tipo_cliente_display}

PRODUTOS COMPRADOS
==================
${client.produtos_comprados.join('\n')}

Relatório gerado em: ${new Date().toLocaleString('pt-BR')}
    `;

    const blob = new Blob([report], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relatorio_${client.nome.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    window.URL.revokeObjectURL(url);

    showNotification('Relatório gerado com sucesso', 'success');
}

// ===== FUNÇÕES DE UTILIDADE =====
function formatCurrency(value) {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(value || 0);
}

function formatDate(dateString) {
    return new Date(dateString).toLocaleDateString('pt-BR');
}

function updateElement(id, value) {
    const element = document.getElementById(id);
    if (element) {
        element.textContent = value;
    }
}

function showLoading(show) {
    const loading = document.getElementById('loading-overlay');
    if (loading) {
        loading.style.display = show ? 'flex' : 'none';
    }
}

function showNotification(message, type = 'info') {
    const existing = document.querySelector('.notification');
    if (existing) existing.remove();

    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    
    const icon = type === 'success' ? 'fa-check-circle' : 
                 type === 'error' ? 'fa-exclamation-circle' : 
                 type === 'warning' ? 'fa-exclamation-triangle' : 'fa-info-circle';

    notification.innerHTML = `
        <i class="fas ${icon}"></i>
        <span>${message}</span>
        <button onclick="this.parentElement.remove()">
            <i class="fas fa-times"></i>
        </button>
    `;

    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 5000);
}

function debounce(func, delay) {
    let timeoutId;
    return function (...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func.apply(this, args), delay);
    };
}

// ===== MODAL DE INATIVIDADE =====
function showInactivityModal(period) {
    const modal = document.getElementById('inactivity-modal');
    const title = document.getElementById('inactivity-modal-title');
    const periodInfo = document.getElementById('inactivity-period-info');
    const countInfo = document.getElementById('inactivity-count-info');
    const tbody = document.getElementById('inactivity-clients-body');
    
    // Filtrar clientes por período
    const inactiveClients = getInactiveClientsByPeriod(period);
    
    // Atualizar informações do modal
    title.textContent = `Clientes Inativos - ${period}`;
    periodInfo.textContent = `Período de inatividade: ${period}`;
    countInfo.textContent = `Total de clientes: ${inactiveClients.length}`;
    
    // Limpar tabela
    tbody.innerHTML = '';
    
    // Preencher tabela com clientes
    inactiveClients.forEach(client => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${client.nome || 'N/A'}</td>
            <td>${client.telefone || 'N/A'}</td>
            <td>${client.cidade || 'N/A'}</td>
            <td>${client.ultima_compra ? formatDate(client.ultima_compra) : 'Nunca'}</td>
            <td>${client.dias_sem_comprar || 'N/A'}</td>
            <td>${formatCurrency(client.total_gasto || 0)}</td>
            <td>
                <button class="btn-whatsapp-small" onclick="sendInactiveClientWhatsApp('${client.nome}', '${client.telefone}', ${client.dias_sem_comprar})" title="Enviar WhatsApp">
                    <i class="fab fa-whatsapp"></i>
                </button>
            </td>
        `;
        tbody.appendChild(row);
    });
    
    // Mostrar modal
    modal.style.display = 'flex';
}

function getInactiveClientsByPeriod(period) {
    return gestaoState.processedClients.filter(client => {
        const dias = client.dias_sem_comprar;
        
        switch(period) {
            case '0-30 dias':
                return dias !== null && dias <= 30;
            case '31-60 dias':
                return dias !== null && dias > 30 && dias <= 60;
            case '61-90 dias':
                return dias !== null && dias > 60 && dias <= 90;
            case '91-180 dias':
                return dias !== null && dias > 90 && dias <= 180;
            case 'Mais de 180 dias':
                return dias !== null && dias > 180;
            case 'Sem compras':
                return dias === null;
            default:
                return false;
        }
    });
}

function closeInactivityModal() {
    const modal = document.getElementById('inactivity-modal');
    modal.style.display = 'none';
}

function sendInactiveClientWhatsApp(clientName, phone, daysInactive) {
    const clientData = {
        nome: clientName,
        telefone: phone,
        dias_inativo: daysInactive
    };
    
    const customData = {
        dias_inativo: daysInactive,
        motivo: 'inatividade'
    };
    
    // Usar modal unificado de WhatsApp
    if (window.whatsAppModalUnified) {
        window.whatsAppModalUnified.open(clientData, 'recompra', customData);
    } else if (window.openWhatsAppModal) {
        // Compatibilidade com função global
        window.openWhatsAppModal(clientData, 'recompra', customData);
    } else {
        showNotification('Modal WhatsApp não carregado', 'error');
    }
}

function sendWhatsAppToAllInactive() {
    const tbody = document.getElementById('inactivity-clients-body');
    const rows = tbody.querySelectorAll('tr');
    
    if (rows.length === 0) {
        showNotification('Nenhum cliente inativo encontrado', 'warning');
        return;
    }
    
    let count = 0;
    rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        const clientName = cells[0].textContent;
        const phone = cells[1].textContent;
        const daysInactive = cells[4].textContent;
        
        if (phone && phone !== 'N/A') {
            // Simular envio (aqui você implementaria a lógica real)
            setTimeout(() => {
                console.log(`WhatsApp enviado para ${clientName} (${phone})`);
            }, count * 1000); // Delay entre envios
            count++;
        }
    });
    
    showNotification(`WhatsApp será enviado para ${count} clientes`, 'success');
    closeInactivityModal();
}

function exportInactiveClients() {
    const tbody = document.getElementById('inactivity-clients-body');
    const rows = tbody.querySelectorAll('tr');
    
    if (rows.length === 0) {
        showNotification('Nenhum cliente para exportar', 'warning');
        return;
    }
    
    let csvContent = 'Cliente,Telefone,Cidade,Última Compra,Dias Inativo,Total Gasto\n';
    
    rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        const rowData = [];
        for (let i = 0; i < cells.length - 1; i++) { // -1 para excluir coluna de ações
            rowData.push(cells[i].textContent);
        }
        csvContent += rowData.join(',') + '\n';
    });
    
    // Criar e baixar arquivo
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `clientes_inativos_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showNotification('Lista de clientes inativos exportada com sucesso!', 'success');
}

// ===== EXPORTAR FUNÇÕES GLOBAIS =====
window.gestaoState = gestaoState;
window.showClientDetails = showClientDetails;
window.closeClientDetailModal = closeClientDetailModal;
window.sendClientWhatsApp = sendClientWhatsApp;
window.generateClientReport = generateClientReport;
window.filterFrequencyTable = filterFrequencyTable;
window.showInactivityModal = showInactivityModal;
window.closeInactivityModal = closeInactivityModal;
window.sendInactiveClientWhatsApp = sendInactiveClientWhatsApp;
window.sendWhatsAppToAllInactive = sendWhatsAppToAllInactive;
window.exportInactiveClients = exportInactiveClients;

console.log('✅ Gestão de Clientes - Core Corrigido carregado');
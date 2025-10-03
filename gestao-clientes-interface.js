// ===== GESTÃO DE CLIENTES - INTERFACE E RENDERIZAÇÃO =====

// ===== CONFIGURAÇÃO DE EVENT LISTENERS =====
function setupEventListeners() {
    console.log('🔗 Configurando event listeners da Gestão de Clientes...');
    
    try {
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
        
        // Botão de frequência
        const frequencyBtn = document.getElementById('frequency-check');
        if (frequencyBtn) {
            frequencyBtn.addEventListener('click', openFrequencyModal);
        }
        
        // Botão de exportar relatório
        const exportBtn = document.getElementById('export-report');
        if (exportBtn) {
            exportBtn.addEventListener('click', generateClientReport);
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
        
        // Botão de WhatsApp para todos
        const whatsappAllBtn = document.getElementById('export-whatsapp-top');
        if (whatsappAllBtn) {
            whatsappAllBtn.addEventListener('click', () => {
                // Implementar envio em massa
                showNotification('Funcionalidade em desenvolvimento', 'info');
            });
        }
        
        // Filtros de frequência
        const frequencyStatusFilter = document.getElementById('frequency-status-filter');
        if (frequencyStatusFilter) {
            frequencyStatusFilter.addEventListener('change', filterFrequencyTable);
        }
        
        const frequencySearch = document.getElementById('frequency-search');
        if (frequencySearch) {
            frequencySearch.addEventListener('input', debounce(filterFrequencyTable, 300));
        }
        
        console.log('✅ Event listeners configurados com sucesso');
        
    } catch (error) {
        console.error('❌ Erro ao configurar event listeners:', error);
    }
}

// ===== RENDERIZAÇÃO DO DASHBOARD =====
function renderDashboard() {
    updateHeaderStats();
    updateTopClientes();
    updateFrequencyTable();
    renderCharts();
}

function updateHeaderStats() {
    const totalClientes = gestaoState.processedClients.length;
    const clientesAtivos = gestaoState.processedClients.filter(c => c.status === 'Ativo').length;
    const receitaTotal = gestaoState.processedClients.reduce((sum, c) => sum + c.total_gasto, 0);
    const totalCompras = gestaoState.processedClients.reduce((sum, c) => sum + c.total_compras, 0);
    
    // Calcular ticket médio geral baseado no total de vendas, não na média dos tickets individuais
    const ticketMedioGeral = totalCompras > 0 ? receitaTotal / totalCompras : 0;
    
    updateElement('total-clientes', totalClientes);
    updateElement('clientes-ativos', clientesAtivos);
    updateElement('ticket-medio-geral', formatCurrency(ticketMedioGeral));
    updateElement('receita-total', formatCurrency(receitaTotal));
    
    console.log(`📊 Stats: ${totalClientes} clientes (${clientesAtivos} ativos), Receita: ${formatCurrency(receitaTotal)}, Ticket médio: ${formatCurrency(ticketMedioGeral)}`);
}

function updateTopClientes() {
    const rankingType = document.getElementById('ranking-type')?.value || 'valor';
    let sortedClients = [...gestaoState.processedClients];

    switch (rankingType) {
        case 'quantidade':
            sortedClients.sort((a, b) => b.total_compras - a.total_compras);
            break;
        case 'frequencia':
            sortedClients.sort((a, b) => {
                const freqA = a.dias_sem_comprar || 999;
                const freqB = b.dias_sem_comprar || 999;
                return freqA - freqB;
            });
            break;
        default:
            sortedClients.sort((a, b) => b.total_gasto - a.total_gasto);
    }

    const tbody = document.getElementById('top-clientes-body');
    if (!tbody) return;

    const top20 = sortedClients.slice(0, 20);
    
    tbody.innerHTML = top20.map((client, index) => {
        const statusClass = client.status === 'Ativo' ? 'status-ativo' : 'status-inativo';
        const tipoClass = {
            'primeira_compra': 'tipo-primeira',
            'desenvolvimento': 'tipo-desenvolvimento', 
            'fiel': 'tipo-fiel',
            'vip': 'tipo-vip'
        }[client.tipo_cliente] || 'tipo-novo';

        return `
            <tr onclick="showClientDetails('${client.nome}')" style="cursor: pointer;">
                <td><strong>#${index + 1}</strong></td>
                <td>
                    <div class="client-info">
                        <strong>${client.nome}</strong>
                        <small>${client.cidade || 'Cidade não informada'}</small>
                    </div>
                </td>
                <td>${formatCurrency(client.total_gasto)}</td>
                <td>${client.total_compras}</td>
                <td>${formatCurrency(client.ticket_medio)}</td>
                <td>${client.ultima_compra ? formatDate(client.ultima_compra) : 'Nunca'}</td>
                <td><span class="${statusClass}">${client.status}</span></td>
                <td><span class="${tipoClass}">${client.tipo_cliente_display}</span></td>
                <td>
                    <div class="action-buttons">
                        ${client.telefone ? 
                            `<button onclick="event.stopPropagation(); sendClientWhatsAppAction('${client.nome}', '${client.telefone}', '${client.tipo_cliente}')" 
                                     class="btn-whatsapp" title="Enviar WhatsApp">
                                <i class="fab fa-whatsapp"></i>
                            </button>` : 
                            '<span class="no-phone">Sem telefone</span>'
                        }
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

// ===== TABELA DE FREQUÊNCIA =====
async function updateFrequencyTable() {
    const frequencyData = await calculateFrequencyData();
    renderFrequencyTable(frequencyData);
}

function renderFrequencyTable(frequencyData) {
    const tbody = document.getElementById('frequency-table-body');
    if (!tbody) return;

    const filteredData = applyFrequencyFilters(frequencyData);
    
    tbody.innerHTML = filteredData.map(item => {
        const statusClass = item.status_recompra === 'Atrasado' ? 'status-atrasado' : 
                           item.status_recompra === 'Em Breve' ? 'status-breve' : 'status-ok';
        
        const urgencyClass = item.dias_atraso > 30 ? 'urgency-high' : 
                            item.dias_atraso > 0 ? 'urgency-medium' : 'urgency-low';

        return `
            <tr class="${urgencyClass}">
                <td>
                    <div class="client-product-info">
                        <strong>${item.cliente_nome}</strong>
                        <small>${item.produto_nome}</small>
                    </div>
                </td>
                <td>${item.frequencia_uso}</td>
                <td>${item.ultima_compra ? formatDate(item.ultima_compra) : 'Nunca'}</td>
                <td>${item.proxima_compra_esperada ? formatDate(item.proxima_compra_esperada) : 'N/A'}</td>
                <td><span class="${statusClass}">${item.status_recompra}</span></td>
                <td class="dias-atraso">${item.dias_atraso > 0 ? `+${item.dias_atraso}` : item.dias_atraso}</td>
                <td>
                    <div class="action-buttons">
                        ${item.telefone ? 
                            `<button onclick="sendFrequencyWhatsApp('${item.cliente_nome}', '${item.telefone}', '${item.produto_nome}', '${item.frequencia_uso}')" 
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

    // Atualizar contador
    const counter = document.getElementById('frequency-count');
    if (counter) {
        counter.textContent = `${filteredData.length} registros`;
    }
}

function applyFrequencyFilters(data) {
    const statusFilter = document.getElementById('status-filter')?.value;
    const urgencyFilter = document.getElementById('urgency-filter')?.value;
    const searchTerm = document.getElementById('frequency-search')?.value?.toLowerCase();

    return data.filter(item => {
        // Filtro por status
        if (statusFilter && statusFilter !== 'todos' && item.status_recompra !== statusFilter) {
            return false;
        }

        // Filtro por urgência
        if (urgencyFilter && urgencyFilter !== 'todos') {
            const isUrgent = item.dias_atraso > 0;
            if (urgencyFilter === 'urgente' && !isUrgent) return false;
            if (urgencyFilter === 'normal' && isUrgent) return false;
        }

        // Filtro por busca
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

// ===== DETALHES DO CLIENTE =====
async function showClientDetails(clientName) {
    const client = gestaoState.processedClients.find(c => c.nome === clientName);
    
    if (!client) {
        showNotification('Cliente não encontrado', 'error');
        return;
    }

    gestaoState.currentClient = client;

    // Atualizar informações básicas
    updateElement('client-detail-title', `Detalhes: ${client.nome}`);
    updateElement('detail-nome', client.nome);
    updateElement('detail-telefone', client.telefone || 'Não informado');
    updateElement('detail-email', client.email || 'Não informado');
    updateElement('detail-cidade', client.cidade ? `${client.cidade} - ${client.estado}` : 'Não informado');

    // Atualizar estatísticas
    updateElement('detail-total-gasto', formatCurrency(client.total_gasto));
    updateElement('detail-total-compras', client.total_compras);
    updateElement('detail-ticket-medio', formatCurrency(client.ticket_medio));
    updateElement('detail-ultima-compra', client.ultima_compra ? formatDate(client.ultima_compra) : 'Nunca');

    // Carregar histórico de compras
    await loadClientHistory(client);

    // Mostrar modal
    const modal = document.getElementById('client-detail-modal');
    if (modal) {
        modal.style.display = 'flex';
    }
}

async function loadClientHistory(client) {
    const tbody = document.getElementById('client-history-body');
    if (!tbody || !client.vendas) return;

    // Agrupar vendas por data
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

    sendClientWhatsAppAction(client.nome, client.telefone, client.tipo_cliente);
}

function generateClientReport() {
    if (!gestaoState.currentClient) return;
    
    const client = gestaoState.currentClient;
    
    // Criar relatório simples em formato texto
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
Tipo de Cliente: ${client.tipo_cliente}

PRODUTOS COMPRADOS
==================
${client.produtos_comprados.join('\n')}

Relatório gerado em: ${new Date().toLocaleString('pt-BR')}
    `;

    // Criar arquivo para download
    const blob = new Blob([report], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relatorio_${client.nome.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    window.URL.revokeObjectURL(url);

    showNotification('Relatório gerado com sucesso', 'success');
}

// ===== MODAL DE FREQUÊNCIA =====
async function openFrequencyModal() {
    showNotification('Funcionalidade em desenvolvimento', 'info');
}

// ===== CONTROLE DE PERÍODO =====
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

// ===== FUNÇÕES UTILITÁRIAS =====
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
    
    // Atualizar flag de loading no estado
    gestaoState.isLoading = show;
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

// ===== CONTROLE DE PERÍODO =====
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

// ===== EXPORTAÇÕES PARA WINDOW =====
window.setupEventListeners = setupEventListeners;
window.renderDashboard = renderDashboard;
window.updateHeaderStats = updateHeaderStats;
window.updateTopClientes = updateTopClientes;
window.updateFrequencyTable = updateFrequencyTable;
window.renderFrequencyTable = renderFrequencyTable;
window.applyFrequencyFilters = applyFrequencyFilters;
window.filterFrequencyTable = filterFrequencyTable;
window.showClientDetails = showClientDetails;
window.loadClientHistory = loadClientHistory;
window.closeClientDetailModal = closeClientDetailModal;
window.sendClientWhatsApp = sendClientWhatsApp;
window.generateClientReport = generateClientReport;
window.openFrequencyModal = openFrequencyModal;
window.handlePeriodChange = handlePeriodChange;
window.handleCustomPeriod = handleCustomPeriod;
window.formatCurrency = formatCurrency;
window.formatDate = formatDate;
window.updateElement = updateElement;
window.showLoading = showLoading;
window.showNotification = showNotification;
window.debounce = debounce;

console.log('🖥️ Gestão de Clientes - Interface carregado');
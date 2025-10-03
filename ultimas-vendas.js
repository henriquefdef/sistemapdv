// ===== LÓGICA PRINCIPAL PARA A PÁGINA DE ÚLTIMAS VENDAS (AGRUPADO POR ID_VENDA) =====

document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 DOM carregado, aguardando userDataReady...');
    document.addEventListener('userDataReady', initializePage);
});

const state = {
    sales: [], 
    vendors: new Map(),
    selectedIds: new Set(),
    currentPage: 1,
    itemsPerPage: 15,
    totalPages: 1,
    sort: { column: 'hora_venda', order: 'desc' },
    filters: { 
        startDate: null, 
        endDate: null, 
        paymentMethod: null, 
        vendor: null,
        status: null
    },
    isLoading: true,
    searchTerm: '',
    searchTimeout: null,
};

// --- INICIALIZAÇÃO E EVENTOS ---

async function initializePage() {
    console.log('✅ Dados do usuário prontos, inicializando página...');
    console.log('🏢 Empresa ID:', window.currentCompanyId);
    console.log('👤 Usuário:', window.currentUser);
    
    if (!window.currentCompanyId) {
        console.error('❌ ID da empresa não encontrado');
        showErrorState("ID da empresa não encontrado.");
        return;
    }
    
    // Verificar se os elementos existem
    const tableBody = document.getElementById('sales-table-body');
    const searchInput = document.getElementById('search-input');
    
    console.log('🎯 Elementos encontrados:', {
        tableBody: !!tableBody,
        searchInput: !!searchInput
    });
    
    if (!tableBody) {
        console.error('❌ Elemento sales-table-body não encontrado!');
        return;
    }
    
    setupEventListeners();
    await loadInitialData();
}

function setupEventListeners() {
    console.log('🔗 Configurando event listeners...');
    
    try {
        // Eventos de busca e paginação
        const searchInput = document.getElementById('search-input');
        const prevPage = document.getElementById('prev-page');
        const nextPage = document.getElementById('next-page');
        
        if (searchInput) {
            searchInput.addEventListener('input', handleSearch);
            console.log('✅ Event listener de busca configurado');
        }
        
        if (prevPage) prevPage.addEventListener('click', () => changePage(state.currentPage - 1));
        if (nextPage) nextPage.addEventListener('click', () => changePage(state.currentPage + 1));
        
        // Eventos de ordenação
        document.querySelectorAll('.sortable').forEach(h => {
            h.addEventListener('click', () => handleSort(h.dataset.sort));
        });
        
        // Eventos de seleção
        const selectAllCheckbox = document.getElementById('select-all-checkbox');
        const tableBody = document.getElementById('sales-table-body');
        
        if (selectAllCheckbox) {
            selectAllCheckbox.addEventListener('change', handleSelectAll);
        }
        
        if (tableBody) {
            tableBody.addEventListener('change', handleSelectRow);
            tableBody.addEventListener('click', handleRowAction);
        }
        
        // Menu de ações
        const moreActionsBtn = document.getElementById('more-actions-btn');
        const moreActionsMenu = document.getElementById('more-actions-menu');
        
        if (moreActionsBtn && moreActionsMenu) {
            moreActionsBtn.addEventListener('click', e => { 
                e.stopPropagation(); 
                moreActionsMenu.classList.toggle('show'); 
            });
            document.addEventListener('click', () => moreActionsMenu.classList.remove('show'));
        }
        
        // Ações em lote
        const exportBtn = document.getElementById('export-selected-btn');
        const cancelBtn = document.getElementById('cancel-selected-btn');
        
        if (exportBtn) {
            exportBtn.addEventListener('click', exportSelectedSales);
        }
        
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                const ids = Array.from(state.selectedIds);
                if (ids.length > 0) {
                    showConfirmModal(
                        `Deseja realmente cancelar as ${ids.length} vendas selecionadas?`, 
                        () => cancelSelectedSales(ids)
                    );
                }
            });
        }

        // Eventos dos modais
        setupModalEvents();
        
        // Eventos do painel de filtros
        const filterBtn = document.getElementById('open-filter-panel-btn');
        if (filterBtn) {
            filterBtn.addEventListener('click', openFilterPanel);
        }
        
        // Evento do botão de exportar Excel
        const exportExcelBtn = document.getElementById('export-excel-btn');
        if (exportExcelBtn) {
            exportExcelBtn.addEventListener('click', exportSelectedSales);
        }
        
        console.log('✅ Todos os event listeners configurados');
        
    } catch (error) {
        console.error('❌ Erro ao configurar event listeners:', error);
    }
}

function setupModalEvents() {
    try {
        // Modal de detalhes da venda
        const closeSaleDetailsModal = document.getElementById('close-sale-details-modal');
        
        if (closeSaleDetailsModal) {
            closeSaleDetailsModal.addEventListener('click', () => {
                document.getElementById('sale-details-modal').classList.remove('show');
            });
        }
        
        // Modal de detalhes do item
        const closeItemDetailsModal = document.getElementById('close-item-details-modal');
        
        if (closeItemDetailsModal) {
            closeItemDetailsModal.addEventListener('click', () => {
                document.getElementById('item-details-modal').classList.remove('show');
            });
        }
        
        // Modal de devolução do item
        const closeItemReturnModal = document.getElementById('close-item-return-modal');
        const cancelItemReturnBtn = document.getElementById('cancel-item-return-btn');
        const confirmItemReturnBtn = document.getElementById('confirm-item-return-btn');
        
        if (closeItemReturnModal) {
            closeItemReturnModal.addEventListener('click', () => {
                document.getElementById('item-return-modal').classList.remove('show');
            });
        }
        
        if (cancelItemReturnBtn) {
            cancelItemReturnBtn.addEventListener('click', () => {
                document.getElementById('item-return-modal').classList.remove('show');
            });
        }
        
        if (confirmItemReturnBtn) {
            confirmItemReturnBtn.addEventListener('click', confirmItemReturn);
        }
        
        // Modal de comprovante
        const closeReceiptModal = document.getElementById('close-receipt-modal');
        const printReceiptBtn = document.getElementById('print-receipt-btn');
        const whatsappReceiptBtn = document.getElementById('whatsapp-receipt-btn');
        
        if (closeReceiptModal) {
            closeReceiptModal.addEventListener('click', () => {
                document.getElementById('receipt-modal').classList.remove('show');
            });
        }
        
        if (printReceiptBtn) printReceiptBtn.addEventListener('click', printReceipt);
        if (whatsappReceiptBtn) whatsappReceiptBtn.addEventListener('click', sendReceiptWhatsApp);
        
        // Modal de devolução
        const closeReturnModal = document.getElementById('close-return-modal');
        const cancelReturnBtn = document.getElementById('cancel-return-btn');
        const confirmReturnBtn = document.getElementById('confirm-return-btn');
        
        if (closeReturnModal) {
            closeReturnModal.addEventListener('click', () => {
                document.getElementById('return-modal').classList.remove('show');
            });
        }
        
        if (cancelReturnBtn) {
            cancelReturnBtn.addEventListener('click', () => {
                document.getElementById('return-modal').classList.remove('show');
            });
        }
        
        if (confirmReturnBtn) {
            confirmReturnBtn.addEventListener('click', confirmReturn);
        }
        
        // Fechar modais clicando no overlay
        document.querySelectorAll('.modal-overlay').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.classList.remove('show');
                }
            });
        });
        
        console.log('✅ Event listeners dos modais configurados');
        
    } catch (error) {
        console.error('❌ Erro ao configurar modais:', error);
    }
}

// --- LÓGICA DE BUSCA DE DADOS ---

async function loadInitialData() {
    console.log('📊 Iniciando carregamento de dados...');
    setLoading(true);
    
    try {
        await fetchVendors();
        await fetchSales(); // fetchSales já chama setLoading(false) e render()
        console.log('✅ Dados iniciais carregados com sucesso');
    } catch (error) {
        console.error("❌ Erro na carga inicial:", error);
        setLoading(false);
        showErrorState("Ocorreu um erro ao carregar os dados das vendas.");
    }
}

async function fetchVendors() {
    console.log('👥 Buscando vendedores...');
    
    try {
        const { data, error } = await supabaseClient
            .from('user')
            .select('id, nome')
            .eq('id_empresa', window.currentCompanyId)
            .order('nome', { ascending: true });
        
        if (error) throw error;
        
        state.vendors = new Map(data.map(vendor => [vendor.id, vendor.nome]));
        console.log('✅ Vendedores carregados:', state.vendors.size, 'encontrados');
        
    } catch (error) {
        console.error("❌ Erro ao buscar vendedores:", error);
    }
}

async function fetchSales() {
    console.log('🛒 Buscando vendas agrupadas por id_venda...');
    setLoading(true);
    
    try {
        const { from, to } = getPaginationRange();
        console.log('📄 Paginação:', { from, to, page: state.currentPage });
        
        // Buscar vendas agrupadas por id_venda com informações de devolução
        let query = supabaseClient
            .from('vendas')
            .select(`
                id_venda,
                cliente_nome,
                hora_venda,
                total_venda,
                forma_pagamento,
                vendedor_id,
                status
            `, { count: 'exact' })
            .eq('id_empresa', window.currentCompanyId);

        // Aplicar filtros
        if (state.searchTerm) {
            console.log('🔍 Aplicando filtro de busca:', state.searchTerm);
            query = query.or(`id_venda.ilike.%${state.searchTerm}%,cliente_nome.ilike.%${state.searchTerm}%`);
        }
        
        if (state.filters.startDate) {
            console.log('📅 Filtro data início:', state.filters.startDate);
            query = query.gte('hora_venda', state.filters.startDate);
        }
        
        if (state.filters.endDate) {
            console.log('📅 Filtro data fim:', state.filters.endDate);
            query = query.lte('hora_venda', `${state.filters.endDate} 23:59:59`);
        }
        
        if (state.filters.paymentMethod) {
            console.log('💳 Filtro forma pagamento:', state.filters.paymentMethod);
            query = query.eq('forma_pagamento', state.filters.paymentMethod);
        }
        
        if (state.filters.vendor) {
            console.log('👤 Filtro vendedor:', state.filters.vendor);
            query = query.eq('vendedor_id', state.filters.vendor);
        }

        query = query.order(state.sort.column, { ascending: state.sort.order === 'asc' });

        console.log('🔄 Executando query no Supabase...');
        const { data, error, count } = await query;
        
        if (error) {
            console.error('❌ Erro na query:', error);
            throw error;
        }

        // Agrupar vendas por id_venda e verificar se há devoluções
        const salesMap = new Map();
        data.forEach(sale => {
            if (!salesMap.has(sale.id_venda)) {
                salesMap.set(sale.id_venda, {
                    ...sale,
                    hasReturn: sale.status === 'DEVOLVIDO'
                });
            } else {
                // Se encontrar um item devolvido, marcar a venda como tendo devolução
                const existingSale = salesMap.get(sale.id_venda);
                if (sale.status === 'DEVOLVIDO') {
                    existingSale.hasReturn = true;
                }
            }
        });
        
        // Converter para array e aplicar paginação manual
        const uniqueSales = Array.from(salesMap.values());
        const totalCount = uniqueSales.length;
        const startIndex = from;
        const endIndex = Math.min(to + 1, totalCount);
        
        state.sales = uniqueSales.slice(startIndex, endIndex);
        state.totalPages = Math.ceil(totalCount / state.itemsPerPage);

        console.log(`✅ Vendas únicas carregadas: ${state.sales.length} de ${totalCount} total`);
        console.log('📊 Primeira venda de exemplo:', state.sales[0]);
        console.log('📈 Total de páginas:', state.totalPages);

        setLoading(false);
        render();
        
    } catch (error) {
        console.error("❌ Erro ao buscar vendas:", error);
        setLoading(false);
        showErrorState("Não foi possível carregar as vendas.");
    }
}

// --- RENDERIZAÇÃO ---

function render() {
    console.log('🎨 Iniciando renderização...');
    
    try {
        renderTable();
        renderPagination();
        updateSortUI();
        updateActionsUI();
        renderActiveFilters();
        
        console.log('✅ Renderização concluída');
    } catch (error) {
        console.error('❌ Erro na renderização:', error);
    }
}

function renderTable() {
    console.log('📋 Renderizando tabela...');
    
    const tableBody = document.getElementById('sales-table-body');
    if (!tableBody) {
        console.error('❌ Elemento sales-table-body não encontrado!');
        return;
    }
    
    tableBody.innerHTML = '';

    if (state.isLoading) {
        console.log('⏳ Mostrando estado de carregamento...');
        tableBody.innerHTML = `<tr><td colspan="8" class="loading-state"><div class="spinner"></div><p>Carregando vendas...</p></td></tr>`;
        return;
    }
    
    if (state.sales.length === 0) {
        console.log('📭 Nenhuma venda encontrada');
        tableBody.innerHTML = `<tr><td colspan="8" class="empty-state"><i class="fas fa-receipt fa-2x"></i><p>Nenhuma venda encontrada.</p></td></tr>`;
        return;
    }

    console.log(`📊 Renderizando ${state.sales.length} vendas...`);

    state.sales.forEach((sale, index) => {
        try {
            const isSelected = state.selectedIds.has(sale.id_venda);
            const vendorName = state.vendors.get(sale.vendedor_id) || 'N/A';
            const paymentMethodClass = (sale.forma_pagamento || 'dinheiro').toLowerCase()
                .replace(/[ãáàâ]/g, 'a').replace(/[éêè]/g, 'e').replace(/[íî]/g, 'i')
                .replace(/[óôõ]/g, 'o').replace(/[úû]/g, 'u').replace(/ç/g, 'c')
                .replace(/\s+/g, '-');
            
            const row = document.createElement('tr');
            row.dataset.saleId = sale.id_venda;
            
            // Aplicar classe especial se a venda tiver devolução
            const saleNumberClass = sale.hasReturn ? 'sale-number has-return' : 'sale-number';
            
            row.innerHTML = `
                <td><input type="checkbox" class="row-checkbox" data-id="${sale.id_venda}" ${isSelected ? 'checked' : ''}></td>
                <td><span class="${saleNumberClass}">#${sale.id_venda}</span></td>
                <td>
                    <div>
                        <div>${formatDate(sale.hora_venda)}</div>
                        <div class="sale-date">${formatTime(sale.hora_venda)}</div>
                    </div>
                </td>
                <td><span class="total-value">R$ ${formatCurrency(sale.total_venda)}</span></td>
                <td><span class="payment-method ${paymentMethodClass}">${sale.forma_pagamento || 'Dinheiro'}</span></td>
                <td><span class="seller-name ${!vendorName || vendorName === 'N/A' ? 'no-seller' : ''}">${vendorName}</span></td>
                <td><span class="customer-name ${!sale.cliente_nome ? 'no-customer' : ''}">${sale.cliente_nome || 'Cliente não informado'}</span></td>
                <td class="actions-col">
                    <div class="action-buttons">
                        <button class="btn-action details-btn" title="Ver Detalhes da Venda" data-action="details" data-sale-id="${sale.id_venda}">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="btn-action receipt-btn" title="Gerar Comprovante" data-action="receipt" data-sale-id="${sale.id_venda}">
                            <i class="fas fa-receipt"></i>
                        </button>
                        <button class="btn-action return-btn" title="Devolver" data-action="return" data-sale-id="${sale.id_venda}">
                            <i class="fas fa-undo"></i>
                        </button>
                    </div>
                </td>
            `;
            tableBody.appendChild(row);
            
            if (index === 0) {
                console.log('🔍 Debug primeira linha criada:', {
                    id_venda: sale.id_venda,
                    cliente: sale.cliente_nome,
                    total: sale.total_venda,
                    vendorName
                });
            }
            
        } catch (error) {
            console.error(`❌ Erro ao renderizar venda ${sale.id_venda}:`, error);
        }
    });
    
    console.log(`✅ ${state.sales.length} linhas adicionadas à tabela`);
}

function renderPagination() {
    const pageInfo = document.getElementById('page-info');
    const prevBtn = document.getElementById('prev-page');
    const nextBtn = document.getElementById('next-page');
    
    if (pageInfo) {
        pageInfo.textContent = `Página ${state.currentPage} de ${state.totalPages || 1}`;
    }
    
    if (prevBtn) {
        prevBtn.disabled = state.currentPage === 1;
    }
    
    if (nextBtn) {
        nextBtn.disabled = state.currentPage >= state.totalPages;
    }
}

function updateSortUI() {
    document.querySelectorAll('.sortable').forEach(header => {
        const column = header.dataset.sort;
        const icon = header.querySelector('.fas');
        if (icon) {
            icon.className = 'fas fa-sort';
            header.classList.remove('active');
            if (column === state.sort.column) {
                header.classList.add('active');
                icon.className = state.sort.order === 'asc' ? 'fas fa-sort-up' : 'fas fa-sort-down';
            }
        }
    });
}

function updateActionsUI() {
    const moreActionsBtn = document.getElementById('more-actions-btn');
    if (moreActionsBtn) {
        moreActionsBtn.disabled = state.selectedIds.size === 0;
    }
}

function renderActiveFilters() {
    const container = document.getElementById('active-filters-container');
    if (!container) return;
    
    container.innerHTML = '';

    const filters = [];
    if (state.filters.startDate) filters.push({ label: `De: ${formatDate(state.filters.startDate)}`, key: 'startDate' });
    if (state.filters.endDate) filters.push({ label: `Até: ${formatDate(state.filters.endDate)}`, key: 'endDate' });
    if (state.filters.paymentMethod) filters.push({ label: `Pagamento: ${state.filters.paymentMethod}`, key: 'paymentMethod' });
    if (state.filters.vendor) {
        const vendorName = state.vendors.get(state.filters.vendor) || 'Desconhecido';
        filters.push({ label: `Vendedor: ${vendorName}`, key: 'vendor' });
    }

    filters.forEach(filter => {
        const tag = document.createElement('div');
        tag.className = 'filter-tag';
        tag.innerHTML = `
            ${filter.label}
            <button onclick="removeFilter('${filter.key}')">&times;</button>
        `;
        container.appendChild(tag);
    });
}

// --- EVENTOS E AÇÕES ---

function handleSearch(e) {
    console.log('🔍 Busca alterada:', e.target.value);
    clearTimeout(state.searchTimeout);
    state.searchTimeout = setTimeout(() => {
        state.searchTerm = e.target.value.trim();
        state.currentPage = 1;
        fetchSales();
    }, 300);
}

function handleSort(column) {
    console.log('🔄 Ordenação alterada:', column);
    if (state.sort.column === column) {
        state.sort.order = state.sort.order === 'asc' ? 'desc' : 'asc';
    } else {
        state.sort.column = column;
        state.sort.order = 'desc';
    }
    state.currentPage = 1;
    fetchSales();
}

function handleSelectAll(e) {
    console.log('☑️ Selecionar todos:', e.target.checked);
    const checkboxes = document.querySelectorAll('.row-checkbox');
    checkboxes.forEach(cb => {
        cb.checked = e.target.checked;
        const id = cb.dataset.id;
        if (e.target.checked) {
            state.selectedIds.add(id);
        } else {
            state.selectedIds.delete(id);
        }
    });
    updateActionsUI();
}

function handleSelectRow(e) {
    if (e.target.classList.contains('row-checkbox')) {
        const id = e.target.dataset.id;
        console.log('☑️ Linha selecionada:', id, e.target.checked);
        
        if (e.target.checked) {
            state.selectedIds.add(id);
        } else {
            state.selectedIds.delete(id);
        }
        updateActionsUI();
        
        // Atualizar checkbox "selecionar todos"
        const allCheckboxes = document.querySelectorAll('.row-checkbox');
        const checkedCheckboxes = document.querySelectorAll('.row-checkbox:checked');
        const selectAllCheckbox = document.getElementById('select-all-checkbox');
        if (selectAllCheckbox) {
            selectAllCheckbox.checked = allCheckboxes.length === checkedCheckboxes.length;
        }
    }
}

function handleRowAction(e) {
    const button = e.target.closest('.btn-action');
    if (!button) return;

    const action = button.dataset.action;
    const saleId = button.dataset.saleId;
    const sale = state.sales.find(s => s.id_venda === saleId);

    console.log('🎬 Ação da linha:', { action, saleId, sale: !!sale });

    if (!sale) return;

    switch (action) {
        case 'details':
            showSaleDetailsModal(saleId);
            break;
        case 'receipt':
            // Usar o modal unificado de comprovante
            if (window.openComprovanteUnificadoUltimasVendas) {
                window.openComprovanteUnificadoUltimasVendas(saleId);
            } else {
                // Fallback para o modal antigo se a função não estiver disponível
                console.warn('⚠️ Função unificada não disponível, usando fallback');
                showReceiptModal(sale);
            }
            break;
        case 'return':
            showReturnModal(sale);
            break;
    }
}

function changePage(newPage) {
    console.log('📄 Mudança de página:', newPage);
    if (newPage >= 1 && newPage <= state.totalPages) {
        state.currentPage = newPage;
        fetchSales();
    }
}

// --- FUNÇÕES AUXILIARES ---

function getPaginationRange() {
    const from = (state.currentPage - 1) * state.itemsPerPage;
    const to = from + state.itemsPerPage - 1;
    return { from, to };
}

function setLoading(loading) {
    console.log('⏳ Loading state alterado para:', loading);
    state.isLoading = loading;
    
    if (!loading && state.sales && state.sales.length > 0) {
        console.log('🔄 Forçando renderização da tabela...');
        setTimeout(() => {
            renderTable();
        }, 100);
    }
}

function showErrorState(message) {
    console.log('❌ Mostrando erro:', message);
    const tableBody = document.getElementById('sales-table-body');
    if (tableBody) {
        tableBody.innerHTML = 
            `<tr><td colspan="8" class="empty-state"><i class="fas fa-exclamation-triangle fa-2x"></i><p>${message}</p></td></tr>`;
    }
}

function formatDate(dateString) {
    if (!dateString) return 'N/A';
    try {
        return new Date(dateString).toLocaleDateString('pt-BR');
    } catch (error) {
        console.error('❌ Erro ao formatar data:', dateString, error);
        return 'Data inválida';
    }
}

function formatTime(dateString) {
    if (!dateString) return 'N/A';
    try {
        return new Date(dateString).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    } catch (error) {
        console.error('❌ Erro ao formatar hora:', dateString, error);
        return 'Hora inválida';
    }
}

function formatCurrency(value) {
    try {
        return parseFloat(value || 0).toFixed(2).replace('.', ',');
    } catch (error) {
        console.error('❌ Erro ao formatar moeda:', value, error);
        return '0,00';
    }
}

// --- PAINEL DE FILTROS ---

function openFilterPanel() {
    console.log('🔍 Abrindo painel de filtros...');
    
    const content = `
        <div class="filter-panel-header">
            <h3>Filtros</h3>
            <button id="close-filter-panel-btn" class="close-btn">&times;</button>
        </div>
        <div class="filter-panel-body">
            <div class="filter-group">
                <label>Período</label>
                <div class="date-shortcut-buttons">
                    <button class="date-shortcut-btn" data-period="today">Hoje</button>
                    <button class="date-shortcut-btn" data-period="week">Últimos 7 dias</button>
                    <button class="date-shortcut-btn" data-period="month">Últimos 30 dias</button>
                </div>
                <div class="date-range-inputs">
                    <input type="date" id="filter-start-date" class="filter-input" value="${state.filters.startDate || ''}">
                    <span>até</span>
                    <input type="date" id="filter-end-date" class="filter-input" value="${state.filters.endDate || ''}">
                </div>
            </div>
            <div class="filter-group">
                <label for="filter-payment-method">Forma de Pagamento</label>
                <select id="filter-payment-method" class="filter-input">
                    <option value="">Todas as formas</option>
                    <option value="Dinheiro" ${state.filters.paymentMethod === 'Dinheiro' ? 'selected' : ''}>Dinheiro</option>
                    <option value="Cartão" ${state.filters.paymentMethod === 'Cartão' ? 'selected' : ''}>Cartão</option>
                    <option value="PIX" ${state.filters.paymentMethod === 'PIX' ? 'selected' : ''}>PIX</option>
                    <option value="Crediário" ${state.filters.paymentMethod === 'Crediário' ? 'selected' : ''}>Crediário</option>
                    <option value="Múltiplo" ${state.filters.paymentMethod === 'Múltiplo' ? 'selected' : ''}>Múltiplo</option>
                </select>
            </div>
            <div class="filter-group">
                <label for="filter-vendor">Vendedor</label>
                <select id="filter-vendor" class="filter-input">
                    <option value="">Todos os vendedores</option>
                    ${Array.from(state.vendors.entries()).map(([id, name]) => 
                        `<option value="${id}" ${state.filters.vendor == id ? 'selected' : ''}>${name}</option>`
                    ).join('')}
                </select>
            </div>
        </div>
        <div class="filter-panel-footer">
            <button id="clear-filters-btn" class="btn btn-secondary">Limpar Filtros</button>
            <button id="apply-filters-btn" class="btn btn-primary">Aplicar</button>
        </div>
    `;
    
    const container = document.getElementById('dynamic-container');
    container.innerHTML = `
        <div id="filter-panel-overlay" class="filter-panel-overlay"></div>
        <div id="filter-panel" class="filter-panel">${content}</div>
    `;
    
    const panel = document.getElementById('filter-panel');
    const overlay = document.getElementById('filter-panel-overlay');
    
    setTimeout(() => {
        panel.classList.add('show');
        overlay.classList.add('show');
    }, 10);

    // Event listeners do painel
    overlay.addEventListener('click', closeFilterPanel);
    document.getElementById('close-filter-panel-btn').addEventListener('click', closeFilterPanel);
    document.getElementById('apply-filters-btn').addEventListener('click', applyFilters);
    document.getElementById('clear-filters-btn').addEventListener('click', clearFilters);
    
    document.querySelectorAll('.date-shortcut-btn').forEach(btn => {
        btn.addEventListener('click', handleDateShortcut);
    });
    
    if (state.filters.activeShortcut) {
        const activeBtn = document.querySelector(`.date-shortcut-btn[data-period="${state.filters.activeShortcut}"]`);
        if (activeBtn) activeBtn.classList.add('active');
    }
}

function handleDateShortcut(event) {
    const period = event.target.dataset.period;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let startDate = new Date(today);
    
    if (period === 'today') {
        // Já é hoje
    } else if (period === 'week') {
        startDate.setDate(today.getDate() - 6);
    } else if (period === 'month') {
        startDate.setDate(today.getDate() - 29);
    }

    const toISODate = (date) => date.toISOString().split('T')[0];

    document.getElementById('filter-start-date').value = toISODate(startDate);
    document.getElementById('filter-end-date').value = toISODate(new Date());
    
    document.querySelectorAll('.date-shortcut-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    state.filters.activeShortcut = period;
}

function closeFilterPanel() {
    const panel = document.getElementById('filter-panel');
    const overlay = document.getElementById('filter-panel-overlay');
    if (panel) panel.classList.remove('show');
    if (overlay) overlay.classList.remove('show');
    setTimeout(() => {
        const container = document.getElementById('dynamic-container');
        if (container) container.innerHTML = '';
    }, 400);
}

function applyFilters() {
    state.filters.startDate = document.getElementById('filter-start-date').value || null;
    state.filters.endDate = document.getElementById('filter-end-date').value || null;
    state.filters.paymentMethod = document.getElementById('filter-payment-method').value || null;
    state.filters.vendor = parseInt(document.getElementById('filter-vendor').value) || null;
    
    if (!document.querySelector('.date-shortcut-btn.active')) {
        state.filters.activeShortcut = null;
    }
    
    state.currentPage = 1;
    fetchSales();
    closeFilterPanel();
}

function clearFilters() {
    state.filters = { 
        startDate: null, 
        endDate: null, 
        paymentMethod: null, 
        vendor: null,
        status: null,
        activeShortcut: null
    };
    state.currentPage = 1;
    fetchSales();
    closeFilterPanel();
}

function removeFilter(filterKey) {
    console.log('🗑️ Removendo filtro:', filterKey);
    state.filters[filterKey] = null;
    if (filterKey === 'startDate' || filterKey === 'endDate') {
        state.filters.activeShortcut = null;
    }
    state.currentPage = 1;
    fetchSales();
}

// Exportar funções para uso global
window.removeFilter = removeFilter;
window.state = state; // Exportar estado para uso nos modais

console.log('📊 Últimas Vendas (agrupado por ID_VENDA) - Arquivo principal carregado');
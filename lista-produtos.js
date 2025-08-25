// ===== LÓGICA AVANÇADA PARA A PÁGINA DE LISTA DE PRODUTOS (VERSÃO FINAL E COMPLETA) =====

document.addEventListener('DOMContentLoaded', () => {
    document.addEventListener('userDataReady', initializePage);
});

// Estado global da aplicação
const state = {
    products: [],
    categories: new Map(),
    images: new Map(),
    selectedIds: new Set(),
    currentPage: 1,
    itemsPerPage: 10,
    totalPages: 1,
    sort: { column: 'created_at', order: 'desc' },
    filters: { startDate: null, endDate: null, category: null, activeShortcut: null },
    isLoading: true,
    searchTerm: '',
    searchTimeout: null,
};

// --- INICIALIZAÇÃO E EVENTOS ---

async function initializePage() {
    if (!window.currentCompanyId) {
        showErrorState("ID da empresa não encontrado.");
        return;
    }
    setupEventListeners();
    await loadInitialData();
}

function setupEventListeners() {
    document.getElementById('search-input').addEventListener('input', handleSearch);
    document.getElementById('prev-page').addEventListener('click', () => changePage(state.currentPage - 1));
    document.getElementById('next-page').addEventListener('click', () => changePage(state.currentPage + 1));
    document.querySelectorAll('.sortable').forEach(h => h.addEventListener('click', () => handleSort(h.dataset.sort)));
    document.getElementById('select-all-checkbox').addEventListener('change', handleSelectAll);
    document.getElementById('product-table-body').addEventListener('change', handleSelectRow);
    document.getElementById('product-table-body').addEventListener('click', handleRowAction);
    
    const moreActionsBtn = document.getElementById('more-actions-btn');
    const moreActionsMenu = document.getElementById('more-actions-menu');
    moreActionsBtn.addEventListener('click', e => { e.stopPropagation(); moreActionsMenu.classList.toggle('show'); });
    document.addEventListener('click', () => moreActionsMenu.classList.remove('show'));
    document.getElementById('delete-selected-btn').addEventListener('click', () => {
        const ids = Array.from(state.selectedIds);
        if (ids.length > 0) showConfirmModal(`Deseja realmente excluir os ${ids.length} produtos selecionados?`, () => deleteProducts(ids));
    });

    document.getElementById('open-filter-panel-btn').addEventListener('click', openFilterPanel);
    document.getElementById('export-excel-btn').addEventListener('click', exportToExcel);
}

// --- LÓGICA DE BUSCA DE DADOS ---

async function loadInitialData() {
    setLoading(true);
    try {
        await Promise.all([fetchCategories(), fetchProducts()]);
    } catch (error) {
        console.error("Erro na carga inicial:", error);
        showErrorState("Ocorreu um erro fatal ao carregar os dados.");
    } finally {
        setLoading(false);
    }
}

async function fetchCategories() {
    try {
        const { data, error } = await supabaseClient.from('categorias').select('id, nome').eq('id_empresa', window.currentCompanyId);
        if (error) throw error;
        state.categories = new Map(data.map(cat => [cat.id, cat.nome]));
    } catch (error) {
        console.error("Erro ao buscar categorias:", error);
    }
}

async function fetchProducts() {
    setLoading(true);
    try {
        const { from, to } = getPaginationRange();
        let query = supabaseClient.from('produtos').select('*', { count: 'exact' }).eq('id_empresa', window.currentCompanyId);

        if (state.searchTerm) query = query.or(`nome.ilike.%${state.searchTerm}%,codigo_sku.ilike.%${state.searchTerm}%`);
        if (state.filters.startDate) query = query.gte('created_at', state.filters.startDate);
        if (state.filters.endDate) query = query.lte('created_at', `${state.filters.endDate} 23:59:59`);
        if (state.filters.category) query = query.eq('categoria', state.filters.category);

        query = query.order(state.sort.column, { ascending: state.sort.order === 'asc' }).range(from, to);

        const { data, error, count } = await query;
        if (error) throw error;

        // Buscar saldo atual de cada produto da tabela estoque_movimentacoes
        for (let product of data) {
            const saldoAtual = await getSaldoEstoque(product.codigo_sku);
            product.quantidade_estoque = saldoAtual;
        }

        state.products = data;
        state.totalPages = Math.ceil(count / state.itemsPerPage);

        await fetchImagesForProducts(data);
        render();
    } catch (error) {
        console.error("Erro ao buscar produtos:", error);
        showErrorState("Não foi possível carregar os produtos.");
    } finally {
        setLoading(false);
    }
}

async function fetchImagesForProducts(products) {
    const productIds = products.map(p => p.id);
    if (productIds.length === 0) return;
    try {
        const { data, error } = await supabaseClient.from('produto_imagens').select('produto_id, url').in('produto_id', productIds);
        if (error) throw error;
        state.images.clear();
        data.forEach(img => {
            if (!state.images.has(img.produto_id)) state.images.set(img.produto_id, img.url);
        });
    } catch (error) {
        console.error("Erro ao buscar imagens:", error);
    }
}

// --- RENDERIZAÇÃO ---

function render() {
    renderTable();
    renderPagination();
    updateSortUI();
    updateActionsUI();
    renderActiveFilters();
}

function renderTable() {
    const tableBody = document.getElementById('product-table-body');
    tableBody.innerHTML = '';

    if (state.isLoading) {
        tableBody.innerHTML = `<tr><td colspan="7" class="loading-state"><div class="spinner"></div></td></tr>`;
        return;
    }
    if (state.products.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="7" class="empty-state"><i class="fas fa-box-open fa-2x"></i><p>Nenhum produto encontrado.</p></td></tr>`;
        return;
    }

    state.products.forEach(product => {
        const imageUrl = state.images.get(product.id) || 'log.png';
        const categoryName = state.categories.get(product.categoria) || 'Sem categoria';
        const stockStatus = getStockStatus(product.quantidade_estoque);
        const isSelected = state.selectedIds.has(product.id);

        const row = document.createElement('tr');
        row.dataset.productId = product.id;
        row.innerHTML = `
            <td><input type="checkbox" class="row-checkbox" data-id="${product.id}" ${isSelected ? 'checked' : ''}></td>
            <td>
                <div class="product-info">
                    <img src="${imageUrl}" alt="${product.nome}" class="product-image" onerror="this.onerror=null;this.src='log.png';">
                    <span class="product-name">${product.nome || 'N/A'}</span>
                </div>
            </td>
            <td>${categoryName}</td>
            <td>R$ ${formatCurrency(product.preco_venda)}</td>
            <td><span class="stock-pill ${stockStatus.class}">${product.quantidade_estoque || 0}</span></td>
            <td>${product.codigo_sku || 'N/A'}</td>
            <td class="actions-col">
                <div class="action-buttons">
                    <button class="btn-action details-btn" title="Ver Detalhes"><i class="fas fa-eye"></i></button>
                    <button class="btn-action history-btn" title="Ver Movimentações"><i class="fas fa-history"></i></button>
                    <button class="btn-action edit-btn" title="Editar Produto"><i class="fas fa-pencil-alt"></i></button>
                </div>
            </td>
        `;
        tableBody.appendChild(row);
    });
}

function renderPagination() {
    const pageInfo = document.getElementById('page-info');
    pageInfo.textContent = `Página ${state.currentPage} de ${state.totalPages || 1}`;
    document.getElementById('prev-page').disabled = state.currentPage === 1;
    document.getElementById('next-page').disabled = state.currentPage >= state.totalPages;
}

function updateSortUI() {
    document.querySelectorAll('.sortable').forEach(header => {
        const column = header.dataset.sort;
        const icon = header.querySelector('.fas');
        icon.className = 'fas fa-sort';
        header.classList.remove('active');
        if (column === state.sort.column) {
            header.classList.add('active');
            icon.className = state.sort.order === 'asc' ? 'fas fa-sort-up' : 'fas fa-sort-down';
        }
    });
}

function updateActionsUI() {
    document.getElementById('more-actions-btn').disabled = state.selectedIds.size === 0;
}

// --- HANDLERS ---

function handleRowAction(event) {
    const button = event.target.closest('button.btn-action');
    if (!button) return;
    const row = button.closest('tr');
    const productId = parseInt(row.dataset.productId);
    const product = state.products.find(p => p.id === productId);
    if (!product) return;

    if (button.classList.contains('details-btn')) showDetailsModal(product);
    if (button.classList.contains('history-btn')) showMovimentacoesModal(product);
    if (button.classList.contains('edit-btn')) window.location.href = `adicionar-produtos.html?edit=${productId}`;
}

function handleSearch(event) {
    clearTimeout(state.searchTimeout);
    state.searchTimeout = setTimeout(() => {
        state.searchTerm = event.target.value.trim();
        state.currentPage = 1;
        fetchProducts();
    }, 400);
}

function changePage(newPage) {
    if (newPage >= 1 && newPage <= state.totalPages && newPage !== state.currentPage) {
        state.currentPage = newPage;
        fetchProducts();
    }
}

function handleSort(column) {
    if (state.sort.column === column) {
        state.sort.order = state.sort.order === 'asc' ? 'desc' : 'asc';
    } else {
        state.sort.column = column;
        state.sort.order = 'asc';
    }
    state.currentPage = 1;
    fetchProducts();
}

function handleSelectAll(event) {
    const isChecked = event.target.checked;
    state.selectedIds.clear();
    if (isChecked) {
        state.products.forEach(p => state.selectedIds.add(p.id));
    }
    document.querySelectorAll('.row-checkbox').forEach(cb => cb.checked = isChecked);
    updateActionsUI();
}

function handleSelectRow(event) {
    if (event.target.classList.contains('row-checkbox')) {
        const id = parseInt(event.target.dataset.id);
        if (event.target.checked) {
            state.selectedIds.add(id);
        } else {
            state.selectedIds.delete(id);
        }
        document.getElementById('select-all-checkbox').checked = state.selectedIds.size === state.products.length && state.products.length > 0;
        updateActionsUI();
    }
}

// ===== FUNÇÃO DE EXCLUSÃO CORRIGIDA =====
async function deleteProducts(ids) {
    try {
        console.log('Verificando vendas dos produtos selecionados...');
        
        // BUSCAR OS SKUs DOS PRODUTOS QUE SERÃO EXCLUÍDOS
        const { data: produtosParaExcluir, error: fetchError } = await supabaseClient
            .from('produtos')
            .select('id, nome, codigo_sku')
            .in('id', ids);
        
        if (fetchError) throw fetchError;
        
        if (produtosParaExcluir.length === 0) {
            showErrorMessage("Nenhum produto encontrado para exclusão.");
            return;
        }
        
        // EXTRAIR OS SKUs PARA VERIFICAR NA TABELA VENDAS
        const skus = produtosParaExcluir
            .filter(p => p.codigo_sku) // Só produtos que têm SKU
            .map(p => p.codigo_sku);
        
        if (skus.length === 0) {
            showErrorMessage("Produtos sem SKU não podem ser verificados. Contate o suporte.");
            return;
        }
        
        // VERIFICAR SE ALGUM SKU EXISTE NA TABELA VENDAS
        const { data: vendas, error: vendasError } = await supabaseClient
            .from('vendas')
            .select('produto_sku')
            .in('produto_sku', skus)
            .eq('id_empresa', window.currentCompanyId);
            
        if (vendasError) throw vendasError;
        
        // SE ENCONTROU VENDAS, IMPEDIR EXCLUSÃO
        if (vendas && vendas.length > 0) {
            const skusVendidos = [...new Set(vendas.map(v => v.produto_sku))];
            
            // Buscar nomes dos produtos que não podem ser excluídos
            const produtosComVenda = produtosParaExcluir.filter(p => 
                skusVendidos.includes(p.codigo_sku)
            );
            
            const nomesProdutos = produtosComVenda.map(p => p.nome).join('\n• ');
            
            showErrorMessage(
                `❌ Não é possível excluir os seguintes produtos pois já foram vendidos:\n\n• ${nomesProdutos}\n\n💡 Para excluir estes produtos, cancele as vendas relacionadas primeiro.`
            );
            return;
        }
        
        // SE CHEGOU AQUI, NENHUM PRODUTO FOI VENDIDO - PODE EXCLUIR
        console.log('✅ Nenhuma venda encontrada. Prosseguindo com exclusão...');
        
        // ETAPA 1: EXCLUIR MOVIMENTAÇÕES DE ESTOQUE PRIMEIRO
        console.log('🗑️ Excluindo movimentações de estoque...');
        const { error: deleteMovError } = await supabaseClient
            .from('estoque_movimentacoes')
            .delete()
            .in('produto_id', ids);
            
        if (deleteMovError) {
            console.warn('Erro ao excluir movimentações:', deleteMovError);
            // Continua mesmo se der erro - pode ser que não existam movimentações
        }
        
        // ETAPA 2: EXCLUIR IMAGENS DOS PRODUTOS
        console.log('🖼️ Excluindo imagens dos produtos...');
        const { error: deleteImgError } = await supabaseClient
            .from('produto_imagens')
            .delete()
            .in('produto_id', ids);
            
        if (deleteImgError) {
            console.warn('Erro ao excluir imagens:', deleteImgError);
            // Continua mesmo se der erro
        }
        
        // ETAPA 3: PREPARAR DADOS PARA BACKUP
        const agora = new Date();
        const horarioBrasilia = new Date(agora.getTime() - (3 * 60 * 60 * 1000));
        
        // BUSCAR DADOS COMPLETOS DOS PRODUTOS
        const { data: produtosCompletos, error: completoError } = await supabaseClient
            .from('produtos')
            .select('*')
            .in('id', ids);
        
        if (completoError) throw completoError;
        
        const produtosExcluidos = produtosCompletos.map(produto => {
            const { id, ...produtoSemId } = produto;
            
            // Remove campos que não existem na tabela produtos_excluidos
            delete produtoSemId.ativo;
            
            return {
                ...produtoSemId,
                modificado: horarioBrasilia.toISOString(),
                modificado_por: window.currentUser?.auth_user_id || window.currentUser?.id,
                data_exclusao: horarioBrasilia.toISOString()
            };
        });
        
        // ETAPA 4: SALVAR BACKUP NA TABELA PRODUTOS_EXCLUIDOS
        console.log('💾 Salvando backup dos produtos excluídos...');
        const { error: insertError } = await supabaseClient
            .from('produtos_excluidos')
            .insert(produtosExcluidos);
        
        if (insertError) throw insertError;
        
        // ETAPA 5: EXCLUIR DA TABELA PRODUTOS
        console.log('🗑️ Excluindo produtos da tabela principal...');
        const { error: deleteError } = await supabaseClient
            .from('produtos')
            .delete()
            .in('id', ids);
        
        if (deleteError) throw deleteError;
        
        // LIMPAR SELEÇÕES E ATUALIZAR INTERFACE
        state.selectedIds.clear();
        document.getElementById('select-all-checkbox').checked = false;
        
        await fetchProducts();
        updateActionsUI();
        
        // MOSTRAR MENSAGEM DE SUCESSO
        const quantidade = ids.length;
        const mensagem = quantidade === 1 ? 
            '✅ Produto excluído com sucesso!' : 
            `✅ ${quantidade} produtos excluídos com sucesso!`;
        showSuccessMessage(mensagem);
        
        console.log(`✅ Exclusão concluída: ${quantidade} produtos removidos`);

    } catch (error) {
        console.error("❌ Erro ao excluir produto(s):", error);
        showErrorMessage(`Falha ao excluir produtos: ${error.message}`);
    }
}

// --- LÓGICA DE FILTROS ---

function openFilterPanel() {
    const content = `
        <div class="filter-panel-header">
            <h3>Filtros</h3>
            <button id="close-filter-panel-btn" class="close-btn">&times;</button>
        </div>
        <div class="filter-panel-body">
            <div class="filter-group">
          
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
                <label for="filter-category">Categoria</label>
                <select id="filter-category" class="filter-input">
                    <option value="">Todas as categorias</option>
                    ${Array.from(state.categories.entries()).map(([id, name]) => `<option value="${id}" ${state.filters.category == id ? 'selected' : ''}>${name}</option>`).join('')}
                </select>
            </div>
        </div>
        <div class="filter-panel-footer">
            <button id="clear-filters-btn" class="btn btn-secondary">Limpar Filtros</button>
            <button id="apply-filters-btn" class="btn btn-primary">Aplicar</button>
        </div>
    `;
    const container = document.getElementById('dynamic-container');
    container.innerHTML = `<div id="filter-panel-overlay" class="filter-panel-overlay"></div><div id="filter-panel" class="filter-panel">${content}</div>`;
    
    const panel = document.getElementById('filter-panel');
    const overlay = document.getElementById('filter-panel-overlay');
    
    setTimeout(() => {
        panel.classList.add('show');
        overlay.classList.add('show');
    }, 10);

    overlay.addEventListener('click', closeFilterPanel);
    document.getElementById('close-filter-panel-btn').addEventListener('click', closeFilterPanel);
    document.getElementById('apply-filters-btn').addEventListener('click', applyFilters);
    document.getElementById('clear-filters-btn').addEventListener('click', clearFilters);
    document.querySelectorAll('.date-shortcut-btn').forEach(btn => btn.addEventListener('click', handleDateShortcut));
    
    if (state.filters.activeShortcut) {
        document.querySelector(`.date-shortcut-btn[data-period="${state.filters.activeShortcut}"]`).classList.add('active');
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
    state.filters.category = document.getElementById('filter-category').value || null;
    
    if (!document.querySelector('.date-shortcut-btn.active')) {
        state.filters.activeShortcut = null;
    }
    state.currentPage = 1;
    fetchProducts();
    closeFilterPanel();
}

function clearFilters() {
    state.filters = { startDate: null, endDate: null, category: null, activeShortcut: null };
    state.currentPage = 1;
    fetchProducts();
    closeFilterPanel();
}

function renderActiveFilters() {
    const container = document.getElementById('active-filters-container');
    container.innerHTML = '';
    if (state.filters.startDate && state.filters.endDate) {
        addFilterTag(`Data: ${state.filters.startDate} a ${state.filters.endDate}`, 'date');
    }
    if (state.filters.category) {
        addFilterTag(`Categoria: ${state.categories.get(parseInt(state.filters.category))}`, 'category');
    }
}

function addFilterTag(text, type) {
    const container = document.getElementById('active-filters-container');
    const tag = document.createElement('div');
    tag.className = 'filter-tag';
    tag.innerHTML = `<span>${text}</span><button data-type="${type}">&times;</button>`;
    tag.querySelector('button').addEventListener('click', () => removeFilter(type));
    container.appendChild(tag);
}

function removeFilter(type) {
    if (type === 'date') {
        state.filters.startDate = null;
        state.filters.endDate = null;
        state.filters.activeShortcut = null;
    } else if (type === 'category') {
        state.filters.category = null;
    }
    state.currentPage = 1;
    fetchProducts();
}

// --- LÓGICA DOS MODAIS ---

function createModal(id, title, content, actions) {
    const container = document.getElementById('dynamic-container');
    container.innerHTML = `
        <div id="${id}" class="modal-overlay">
            <div class="modal-content">
                <div class="modal-header">
                    <h3>${title}</h3>
                    <button class="close-btn">&times;</button>
                </div>
                <div class="modal-body">${content}</div>
                ${actions ? `<div class="modal-actions">${actions}</div>` : ''}
            </div>
        </div>
    `;
    const modal = document.getElementById(id);
    const closeModal = () => {
        modal.classList.remove('show');
        setTimeout(() => modal.remove(), 300);
    };
    
    modal.querySelector('.close-btn').addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => { if (e.target.id === id) closeModal(); });
    
    setTimeout(() => modal.classList.add('show'), 10);
    return modal;
}

async function showDetailsModal(product) {
    const detailsHtml = `
        <div class="details-grid">
            ${Object.entries(product).map(([key, value]) => {
                let displayValue = value;
                if (value === null || value === '') displayValue = '-';
                else if (typeof value === 'boolean') displayValue = value ? 'Sim' : 'Não';
                else if (key.includes('preco') || key.includes('custo')) displayValue = `R$ ${formatCurrency(value)}`;
                else if (key.includes('created_at') || key.includes('updated_at')) displayValue = new Date(value).toLocaleString('pt-BR');
                return `<div class="detail-item"><label>${key.replace(/_/g, ' ')}</label><p>${displayValue}</p></div>`;
            }).join('')}
        </div>
    `;
    createModal('details-modal', `Detalhes de ${product.nome}`, detailsHtml);
}

async function showHistoryModal(product) {
    const modal = createModal('history-modal', `Movimentações de ${product.nome}`, '<div class="timeline"><div class="spinner"></div></div>');
    try {
        const [entradasRes, saidasRes] = await Promise.all([
            supabaseClient.from('entradas_estoque').select('*').eq('produto_id', product.id),
            supabaseClient.from('vendas_produtos').select('*').eq('produto_id', product.id)
        ]);

        if (entradasRes.error) throw entradasRes.error;
        if (saidasRes.error) throw saidasRes.error;

        const entradas = entradasRes.data.map(e => ({ ...e, tipo: 'entrada', data: e.created_at }));
        const saidas = saidasRes.data.map(s => ({ ...s, tipo: 'saida', data: s.created_at }));

        const timelineItems = [...entradas, ...saidas]
            .sort((a, b) => new Date(b.data) - new Date(a.data))
            .map(item => `
                <div class="timeline-item">
                    <div class="timeline-icon ${item.tipo}"><i class="fas ${item.tipo === 'entrada' ? 'fa-plus' : 'fa-minus'}"></i></div>
                    <div class="timeline-content">
                        <h4>${item.tipo === 'entrada' ? 'Entrada no Estoque' : 'Venda Realizada'}</h4>
                        <p>Quantidade: <strong>${item.quantidade}</strong></p>
                        <span class="timeline-date">${new Date(item.data).toLocaleString('pt-BR')}</span>
                    </div>
                </div>
            `).join('');
        
        const modalBody = modal.querySelector('.modal-body');
        modalBody.innerHTML = timelineItems.length > 0 ? `<div class="timeline">${timelineItems}</div>` : '<p>Nenhuma movimentação encontrada para este produto.</p>';
    } catch (error) {
        console.error("Erro ao buscar histórico:", error);
        modal.querySelector('.modal-body').innerHTML = '<p>Erro ao carregar o histórico.</p>';
    }
}

function showConfirmModal(message, onConfirm) {
    const actionsHtml = `
        <button id="modal-cancel-btn" class="btn btn-secondary">Cancelar</button>
        <button id="modal-confirm-btn" class="btn btn-danger">Confirmar</button>
    `;
    const modal = createModal('confirm-modal', 'Confirmação', `<p>${message}</p>`, actionsHtml);
    
    modal.querySelector('#modal-confirm-btn').addEventListener('click', () => { onConfirm(); modal.remove(); });
    modal.querySelector('#modal-cancel-btn').addEventListener('click', () => modal.remove());
}

// --- FUNÇÕES UTILITÁRIAS ---

function getPaginationRange() {
    const from = (state.currentPage - 1) * state.itemsPerPage;
    const to = from + state.itemsPerPage - 1;
    return { from, to };
}

function setLoading(isLoading) {
    state.isLoading = isLoading;
    renderTable();
}

function showErrorState(message) {
    const tableBody = document.getElementById('product-table-body');
    tableBody.innerHTML = `<tr><td colspan="7" class="empty-state"><i class="fas fa-exclamation-triangle fa-2x"></i><p>${message}</p></td></tr>`;
}

function formatCurrency(value) {
    if (typeof value !== 'number') return '0,00';
    return value.toFixed(2).replace('.', ',');
}

function formatDate(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR');
}

function formatTime(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function getStockStatus(stock) {
    if (stock <= 0) return { class: 'out-of-stock' };
    if (stock <= 5) return { class: 'low-stock' };
    return { class: 'in-stock' };
}

// ===== FUNÇÕES PARA ESTOQUE E MOVIMENTAÇÕES =====

/**
 * Busca o saldo atual do estoque de um produto calculando as movimentações
 */
async function getSaldoEstoque(sku) {
    if (!sku) return 0;
    
    try {
        // Primeiro, buscar o produto pelo SKU para obter o ID
        const { data: produtoData, error: produtoError } = await supabaseClient
            .from('produtos')
            .select('id, quantidade_estoque')
            .eq('codigo_sku', sku)
            .eq('id_empresa', window.currentCompanyId)
            .single();
            
        if (produtoError || !produtoData) {
            console.warn('Produto não encontrado para SKU:', sku);
            return 0;
        }
        
        // Retornar o estoque atual do produto (que é atualizado pelas movimentações)
        return produtoData.quantidade_estoque || 0;
        
    } catch (error) {
        console.error('Erro ao buscar saldo do estoque:', error);
        return 0;
    }
}

/**
 * Mostra modal com linha do tempo das movimentações do produto
 */
async function showMovimentacoesModal(product) {
    try {
        const { data, error } = await supabaseClient
            .from('estoque_movimentacoes')
            .select('*')
            .eq('id_empresa', window.currentCompanyId)
            .eq('produto_id', product.id)
            .order('created_at', { ascending: false });
            
        if (error) throw error;
        
        const movimentacoes = data || [];
        
        const modalContent = `
            <div class="movimentacoes-header">
                <h4>${product.nome}</h4>
                <p><strong>SKU:</strong> ${product.codigo_sku || 'N/A'}</p>
                <p><strong>Saldo Atual:</strong> ${product.quantidade_estoque || 0} unidades</p>
            </div>
            <div class="movimentacoes-timeline">
                ${movimentacoes.length === 0 ? 
                    '<p class="no-movements">Nenhuma movimentação encontrada para este produto.</p>' :
                    movimentacoes.map(mov => `
                        <div class="timeline-item">
                            <div class="timeline-date">
                                ${formatDate(mov.created_at)}
                                <span class="timeline-time">${formatTime(mov.created_at)}</span>
                            </div>
                            <div class="timeline-content">
                                <div class="movement-type ${mov.tipo_movimentacao.toLowerCase()}">
                                    <i class="fas ${
                                        mov.tipo_movimentacao === 'ENTRADA' ? 'fa-arrow-down' :
                                        mov.tipo_movimentacao === 'SAIDA' ? 'fa-arrow-up' : 'fa-edit'
                                    }"></i>
                                    ${mov.tipo_movimentacao}
                                </div>
                                <div class="movement-details">
                                    <p><strong>Quantidade:</strong> ${mov.quantidade > 0 ? '+' : ''}${mov.quantidade}</p>
                                    <p><strong>Saldo após:</strong> ${mov.saldo_atual}</p>
                                    ${mov.observacoes ? `<p><strong>Observações:</strong> ${mov.observacoes}</p>` : ''}
                                    ${mov.documento_referencia ? `<p><strong>Documento:</strong> ${mov.documento_referencia}</p>` : ''}
                                </div>
                            </div>
                        </div>
                    `).join('')
                }
            </div>
        `;
        
        createModal('movimentacoes-modal', 'Movimentações do Produto', modalContent, [
            { text: 'Fechar', class: 'btn-secondary', action: 'close' }
        ]);
        
    } catch (error) {
        console.error('Erro ao buscar movimentações:', error);
        showErrorMessage('Erro ao carregar movimentações do produto.');
    }
}

/**
 * Exporta produtos filtrados para Excel
 */
async function exportToExcel() {
    console.log('📊 Iniciando exportação de produtos para Excel...');
    
    try {
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
        
        // Buscar todos os produtos filtrados (sem paginação)
        const produtosData = await fetchAllProductsForExcel();
        
        // Criar workbook
        const workbook = XLSX.utils.book_new();
        
        // Preparar dados formatados dos produtos ativos
        const formattedData = produtosData.map(produto => {
            const categoryName = state.categories.get(produto.categoria) || 'Sem categoria';
            
            return {
                'Nome': produto.nome || '',
                'SKU': produto.codigo_sku || '',
                'Categoria': categoryName,
                'Preço Custo': parseFloat(produto.preco_custo || 0),
                'Preço Venda': parseFloat(produto.preco_venda || 0),
                'Estoque': parseInt(produto.quantidade_estoque || 0),
                'Código Barras': produto.codigo_barras || '',
                'Marca': produto.marca || '',
                'Descrição': produto.descricao || '',
                'Data Cadastro': formatDate(produto.created_at)
            };
        });
        
        // Criar worksheet dos produtos ativos
        const worksheet = XLSX.utils.json_to_sheet(formattedData);
        
        // Definir larguras das colunas
        const colWidths = [
            { wch: 30 }, // Nome
            { wch: 15 }, // SKU
            { wch: 20 }, // Categoria
            { wch: 12 }, // Preço Custo
            { wch: 12 }, // Preço Venda
            { wch: 10 }, // Estoque
            { wch: 15 }, // Código Barras
            { wch: 15 }, // Marca
            { wch: 30 }, // Descrição
            { wch: 12 }  // Data Cadastro
        ];
        worksheet['!cols'] = colWidths;
        
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Produtos');
        
        // Buscar e adicionar produtos excluídos
        const produtosExcluidosData = await fetchAllDeletedProductsForExcel();
        
        if (produtosExcluidosData.length > 0) {
            const formattedDeletedData = produtosExcluidosData.map(produto => {
                const categoryName = state.categories.get(produto.categoria) || 'Sem categoria';
                
                return {
                    'Nome': produto.nome || '',
                    'SKU': produto.codigo_sku || '',
                    'Categoria': categoryName,
                    'Preço Custo': parseFloat(produto.preco_custo || 0),
                    'Preço Venda': parseFloat(produto.preco_venda || 0),
                    'Estoque': produto.quantidade_estoque || 0,
                     'Código Barras': produto.codigo_barras || '',
                     'Marca': produto.marca || '',
                     'Descrição': produto.descricao || '',
                     'Data Cadastro': produto.created_at ? new Date(produto.created_at).toLocaleDateString('pt-BR') : '',
                     'Data Exclusão': produto.data_exclusao ? new Date(produto.data_exclusao).toLocaleDateString('pt-BR') : ''
                };
            });
            
            // Criar worksheet dos produtos excluídos
            const deletedWorksheet = XLSX.utils.json_to_sheet(formattedDeletedData);
            
            // Definir larguras das colunas (incluindo Data Exclusão)
            const deletedColWidths = [
                { wch: 30 }, // Nome
                { wch: 15 }, // SKU
                { wch: 20 }, // Categoria
                { wch: 12 }, // Preço Custo
                { wch: 12 }, // Preço Venda
                { wch: 10 }, // Estoque
                { wch: 15 }, // Código Barras
                { wch: 15 }, // Marca
                { wch: 30 }, // Descrição
                { wch: 12 }, // Data Cadastro
                { wch: 12 }  // Data Exclusão
            ];
            deletedWorksheet['!cols'] = deletedColWidths;
            
            XLSX.utils.book_append_sheet(workbook, deletedWorksheet, 'Produtos Excluídos');
        }
        
        // Gerar nome do arquivo com data
        const now = new Date();
        const dateStr = now.toISOString().split('T')[0];
        const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-');
        const filename = `produtos_${dateStr}_${timeStr}.xlsx`;
        
        // Fazer download
        XLSX.writeFile(workbook, filename);
        
        // Remover loading
        document.body.removeChild(loadingModal);
        
        // Mostrar sucesso
        showSuccessMessage(`Arquivo Excel exportado com sucesso: ${filename}`);
        
        console.log('✅ Exportação de produtos concluída:', filename);
        
    } catch (error) {
        console.error('❌ Erro ao exportar Excel:', error);
        
        // Remover loading se existir
        const loadingModal = document.querySelector('.modal-overlay');
        if (loadingModal) {
            document.body.removeChild(loadingModal);
        }
        
        showErrorMessage(`Erro ao exportar Excel: ${error.message}`);
    }
}

/**
 * Busca todos os produtos para exportação (sem paginação)
 */
async function fetchAllProductsForExcel() {
    let query = supabaseClient.from('produtos').select('*').eq('id_empresa', window.currentCompanyId);

    // Aplicar os mesmos filtros da tela
    if (state.searchTerm) query = query.or(`nome.ilike.%${state.searchTerm}%,codigo_sku.ilike.%${state.searchTerm}%`);
    if (state.filters.startDate) query = query.gte('created_at', state.filters.startDate);
    if (state.filters.endDate) query = query.lte('created_at', `${state.filters.endDate} 23:59:59`);
    if (state.filters.category) query = query.eq('categoria', state.filters.category);

    query = query.order(state.sort.column, { ascending: state.sort.order === 'asc' });

    const { data, error } = await query;
    if (error) throw error;

    // Buscar saldo atual de cada produto
    for (let product of data) {
        const saldoAtual = await getSaldoEstoque(product.codigo_sku);
        product.quantidade_estoque = saldoAtual;
    }

    return data || [];
}

/**
 * Busca todos os produtos excluídos para exportação
 */
async function fetchAllDeletedProductsForExcel() {
    try {
        const { data, error } = await supabaseClient
            .from('produtos_excluidos')
            .select('*')
            .eq('id_empresa', window.currentCompanyId)
            .order('data_exclusao', { ascending: false });
            
        if (error) throw error;
        
        return data || [];
    } catch (error) {
        console.error('Erro ao buscar produtos excluídos:', error);
        return [];
    }
}

/**
 * Mostra mensagem de sucesso
 */
function showSuccessMessage(message) {
    const toast = document.createElement('div');
    toast.className = 'toast success';
    toast.innerHTML = `<i class="fas fa-check-circle"></i> ${message}`;
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #10b981;
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10000;
        font-size: 14px;
        max-width: 400px;
        white-space: pre-line;
    `;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        if (toast.parentNode) {
            document.body.removeChild(toast);
        }
    }, 5000);
}

/**
 * Mostra mensagem de erro
 */
function showErrorMessage(message) {
    const toast = document.createElement('div');
    toast.className = 'toast error';
    toast.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${message}`;
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #ef4444;
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10000;
        font-size: 14px;
        max-width: 400px;
        white-space: pre-line;
    `;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        if (toast.parentNode) {
            document.body.removeChild(toast);
        }
    }, 5000);
}
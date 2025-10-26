// ===== GERAR ETIQUETAS EM LOTE - JAVASCRIPT =====

// Configuração e estado global
const CONFIG = {
    itemsPerPage: 50,
    currentPage: 1,
    sortBy: 'nome',
    sortOrder: 'asc',
    filters: {}
};

// Estado da aplicação
const appState = {
    products: [],
    filteredProducts: [],
    selectedProducts: new Set(),
    categories: [],
    brands: [],
    isLoading: false
};

// Elementos DOM principais
let elements = {};

// ===== INICIALIZAÇÃO =====
document.addEventListener('DOMContentLoaded', () => {
    document.addEventListener('userDataReady', initializePage);
});

function initializePage() {
    cacheElements();
    setupEventListeners();
    loadInitialData();
}

function cacheElements() {
    elements = {
        // Filtros
        searchNome: document.getElementById('search-nome'),
        searchCategoria: document.getElementById('search-categoria'),
        searchMarca: document.getElementById('search-marca'),
        searchAtivo: document.getElementById('search-ativo'),
        searchPrecoMin: document.getElementById('search-preco-min'),
        searchPrecoMax: document.getElementById('search-preco-max'),
        searchDataInicio: document.getElementById('search-data-inicio'),
        searchDataFim: document.getElementById('search-data-fim'),
        
        // Controles principais
        selectAllCheckbox: document.getElementById('select-all-checkbox'),
        selectedCount: document.getElementById('selected-count'),
        btnGenerate: document.getElementById('btn-generate'),
        btnClearAll: document.getElementById('btn-clear-all'),
        btnAdvancedFilters: document.getElementById('btn-advanced-filters'),
        advancedFilters: document.getElementById('advanced-filters'),
        
        // Tabela e estados
        loadingState: document.getElementById('loading-state'),
        tableContainer: document.getElementById('table-container'),
        emptyState: document.getElementById('empty-state'),
        productsTable: document.getElementById('products-table'),
        productsTbody: document.getElementById('products-tbody'),
        
        // Paginação
        paginationContainer: document.getElementById('pagination-container'),
        paginationInfo: document.getElementById('pagination-info'),
        pagination: document.getElementById('pagination'),
        itemsPerPageSelect: document.getElementById('items-per-page'),
        
        // Contadores
        productsCount: document.getElementById('products-count'),
        
        // Modais
        categoryModal: document.getElementById('category-modal'),
        categorySelect: document.getElementById('category-select'),
        priceRangeModal: document.getElementById('price-range-modal'),
        priceRangeMin: document.getElementById('price-range-min'),
        priceRangeMax: document.getElementById('price-range-max'),
        
        // Filtros
        filtersContent: document.getElementById('filters-content'),
        toggleIcon: document.getElementById('toggle-icon'),
        toggleText: document.getElementById('toggle-text')
    };
}

function setupEventListeners() {
    // Filtros - busca em tempo real (debounced)
    let searchTimeout;
    elements.searchNome.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(searchProducts, 300);
    });

    // Filtros - mudança imediata
    elements.searchCategoria.addEventListener('change', searchProducts);
    elements.searchMarca.addEventListener('change', searchProducts);
    elements.searchAtivo.addEventListener('change', searchProducts);
    elements.searchPrecoMin.addEventListener('input', debounce(searchProducts, 500));
    elements.searchPrecoMax.addEventListener('input', debounce(searchProducts, 500));
    elements.searchDataInicio.addEventListener('change', searchProducts);
    elements.searchDataFim.addEventListener('change', searchProducts);

    // Select all checkbox
    elements.selectAllCheckbox.addEventListener('change', toggleSelectAll);

    // Items per page
    elements.itemsPerPageSelect.addEventListener('change', changeItemsPerPage);
}

async function loadInitialData() {
    setLoadingState(true);
    
    try {
        // Carregar dados em paralelo
        const [productsResult, categoriesResult, brandsResult] = await Promise.all([
            loadProducts(),
            loadCategories(),
            loadBrands()
        ]);

        if (productsResult.success) {
            appState.products = productsResult.data;
            applyFiltersAndSort();
        } else {
            showError('Erro ao carregar produtos: ' + productsResult.error);
        }

        console.log(`Carregados: ${appState.products.length} produtos, ${appState.categories.length} categorias, ${appState.brands.length} marcas`);
        
    } catch (error) {
        console.error('Erro ao carregar dados:', error);
        showError('Erro ao carregar dados da página');
    } finally {
        setLoadingState(false);
    }
}

// ===== CARREGAMENTO DE DADOS =====
async function loadProducts() {
    try {
        const { data, error } = await supabaseClient
            .from('produtos')
            .select(`
                id,
                nome,
                categoria,
                marca,
                codigo_sku,
                codigo_barras,
                preco_venda,
                quantidade_estoque,
                estoque_minimo,
                ativo,
                created_at
            `)
            .eq('id_empresa', window.currentCompanyId)
            .order('nome', { ascending: true });

        if (error) throw error;

        return { success: true, data: data || [] };
    } catch (error) {
        console.error('Erro ao carregar produtos:', error);
        return { success: false, error: error.message };
    }
}

async function loadCategories() {
    try {
        const { data, error } = await supabaseClient
            .from('categorias')
            .select('id, nome')
            .eq('id_empresa', window.currentCompanyId)
            .order('nome', { ascending: true });

        if (error) throw error;

        appState.categories = data || [];
        updateCategorySelects(data || []);
        
        return { success: true, data: data || [] };
    } catch (error) {
        console.error('Erro ao carregar categorias:', error);
        return { success: false, error: error.message };
    }
}

async function loadBrands() {
    try {
        const { data, error } = await supabaseClient
            .from('marcas')
            .select('id, nome')
            .eq('id_empresa', window.currentCompanyId)
            .order('nome', { ascending: true });

        if (error) throw error;

        appState.brands = data || [];
        updateBrandSelects(data || []);
        
        return { success: true, data: data || [] };
    } catch (error) {
        console.error('Erro ao carregar marcas:', error);
        return { success: false, error: error.message };
    }
}

function updateCategorySelects(categories) {
    const selects = [elements.searchCategoria, elements.categorySelect];
    
    selects.forEach(select => {
        if (!select) return;
        
        // Preservar primeira opção
        const firstOption = select.firstElementChild;
        select.innerHTML = '';
        if (firstOption) select.appendChild(firstOption);
        
        // Adicionar categorias
        categories.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat.nome;
            option.textContent = cat.nome;
            select.appendChild(option);
        });
    });
}

function updateBrandSelects(brands) {
    const select = elements.searchMarca;
    if (!select) return;
    
    // Preservar primeira opção
    const firstOption = select.firstElementChild;
    select.innerHTML = '';
    if (firstOption) select.appendChild(firstOption);
    
    // Adicionar marcas
    brands.forEach(brand => {
        const option = document.createElement('option');
        option.value = brand.nome;
        option.textContent = brand.nome;
        select.appendChild(option);
    });
}

// ===== FILTRAGEM E ORDENAÇÃO =====
function collectFilters() {
    return {
        nome: elements.searchNome.value.trim(),
        categoria: elements.searchCategoria.value,
        marca: elements.searchMarca.value,
        ativo: elements.searchAtivo.value,
        precoMin: parseFloat(elements.searchPrecoMin.value) || null,
        precoMax: parseFloat(elements.searchPrecoMax.value) || null,
        dataInicio: elements.searchDataInicio.value || null,
        dataFim: elements.searchDataFim.value || null
    };
}

function applyFiltersAndSort() {
    const filters = collectFilters();
    
    // Aplicar filtros
    appState.filteredProducts = appState.products.filter(product => {
        // Filtro por nome
        if (filters.nome && !product.nome.toLowerCase().includes(filters.nome.toLowerCase())) {
            return false;
        }
        
        // Filtro por categoria
        if (filters.categoria && product.categoria !== filters.categoria) {
            return false;
        }
        
        // Filtro por marca
        if (filters.marca && product.marca !== filters.marca) {
            return false;
        }
        
        // Filtro por status
        if (filters.ativo !== '') {
            const isActive = filters.ativo === 'true';
            if (product.ativo !== isActive) {
                return false;
            }
        }
        
        // Filtro por preço
        const preco = parseFloat(product.preco_venda) || 0;
        if (filters.precoMin !== null && preco < filters.precoMin) {
            return false;
        }
        if (filters.precoMax !== null && preco > filters.precoMax) {
            return false;
        }
        
        // Filtro por data de cadastro
        if (filters.dataInicio || filters.dataFim) {
            const productDate = new Date(product.created_at);
            const startDate = filters.dataInicio ? new Date(filters.dataInicio) : null;
            const endDate = filters.dataFim ? new Date(filters.dataFim + 'T23:59:59') : null;
            
            if (startDate && productDate < startDate) {
                return false;
            }
            if (endDate && productDate > endDate) {
                return false;
            }
        }
        
        return true;
    });
    
    // Aplicar ordenação
    applySorting();
    
    // Resetar paginação
    CONFIG.currentPage = 1;
    
    // Atualizar interface
    updateProductsDisplay();
    updateSelectionState();
}

function applySorting() {
    appState.filteredProducts.sort((a, b) => {
        let valueA = a[CONFIG.sortBy];
        let valueB = b[CONFIG.sortBy];
        
        // Tratamento para tipos diferentes
        if (CONFIG.sortBy === 'preco_venda' || CONFIG.sortBy === 'quantidade_estoque') {
            valueA = parseFloat(valueA) || 0;
            valueB = parseFloat(valueB) || 0;
        } else if (typeof valueA === 'string') {
            valueA = valueA.toLowerCase();
            valueB = valueB.toLowerCase();
        }
        
        // Comparação
        let comparison = 0;
        if (valueA < valueB) comparison = -1;
        if (valueA > valueB) comparison = 1;
        
        return CONFIG.sortOrder === 'desc' ? comparison * -1 : comparison;
    });
}

// ===== FUNÇÕES DE BUSCA =====
function searchProducts() {
    applyFiltersAndSort();
}

function clearFilters() {
    elements.searchNome.value = '';
    elements.searchCategoria.value = '';
    elements.searchMarca.value = '';
    elements.searchAtivo.value = '';
    elements.searchPrecoMin.value = '';
    elements.searchPrecoMax.value = '';
    
    applyFiltersAndSort();
}

function clearAllFilters() {
    clearFilters();
    clearDates();
}

// ===== FUNÇÕES DE DATA =====
function setDateToday() {
    const today = new Date().toISOString().split('T')[0];
    elements.searchDataInicio.value = today;
    elements.searchDataFim.value = today;
    searchProducts();
}

function setDateThisWeek() {
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay()); // Domingo
    
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6); // Sábado
    
    elements.searchDataInicio.value = startOfWeek.toISOString().split('T')[0];
    elements.searchDataFim.value = endOfWeek.toISOString().split('T')[0];
    searchProducts();
}

function setDateThisMonth() {
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    
    elements.searchDataInicio.value = startOfMonth.toISOString().split('T')[0];
    elements.searchDataFim.value = endOfMonth.toISOString().split('T')[0];
    searchProducts();
}

function clearDates() {
    elements.searchDataInicio.value = '';
    elements.searchDataFim.value = '';
    searchProducts();
}

function toggleAdvancedFilters() {
    const isVisible = elements.advancedFilters.style.display !== 'none';
    
    if (isVisible) {
        elements.advancedFilters.style.display = 'none';
        elements.btnAdvancedFilters.classList.remove('active');
    } else {
        elements.advancedFilters.style.display = 'block';
        elements.btnAdvancedFilters.classList.add('active');
    }
}

// ===== EXIBIÇÃO DOS PRODUTOS =====
function updateProductsDisplay() {
    const totalProducts = appState.filteredProducts.length;
    const startIndex = (CONFIG.currentPage - 1) * CONFIG.itemsPerPage;
    const endIndex = Math.min(startIndex + CONFIG.itemsPerPage, totalProducts);
    const currentPageProducts = appState.filteredProducts.slice(startIndex, endIndex);
    
    // Atualizar contador
    elements.productsCount.textContent = `${totalProducts} produtos encontrados`;
    
    // Verificar se há produtos
    if (totalProducts === 0) {
        showEmptyState();
        return;
    }
    
    showTable();
    renderProductsTable(currentPageProducts);
    updatePagination(totalProducts, startIndex, endIndex);
}

function showTable() {
    elements.loadingState.style.display = 'none';
    elements.emptyState.style.display = 'none';
    elements.tableContainer.style.display = 'block';
    elements.paginationContainer.style.display = 'flex';
}

function showEmptyState() {
    elements.loadingState.style.display = 'none';
    elements.tableContainer.style.display = 'none';
    elements.paginationContainer.style.display = 'none';
    elements.emptyState.style.display = 'flex';
}

function setLoadingState(loading) {
    if (loading) {
        elements.loadingState.style.display = 'flex';
        elements.tableContainer.style.display = 'none';
        elements.emptyState.style.display = 'none';
        elements.paginationContainer.style.display = 'none';
    } else {
        elements.loadingState.style.display = 'none';
    }
}

function renderProductsTable(products) {
    elements.productsTbody.innerHTML = products.map(product => {
        const isSelected = appState.selectedProducts.has(product.id);
        const stockClass = getStockClass(product.quantidade_estoque, product.estoque_minimo);
        
        return `
            <tr class="${isSelected ? 'selected' : ''}" data-product-id="${product.id}">
                <td class="checkbox-column">
                    <label class="checkbox-container">
                        <input type="checkbox" ${isSelected ? 'checked' : ''} 
                               onchange="toggleProductSelection(${product.id})">
                        <span class="checkmark"></span>
                    </label>
                </td>
                <td>
                    <div class="product-name" title="${escapeHtml(product.nome)}">
                        ${escapeHtml(product.nome)}
                    </div>
                </td>
                <td>${escapeHtml(product.categoria || 'Sem categoria')}</td>
                <td>
                    <span class="product-sku">${escapeHtml(product.codigo_sku || 'N/A')}</span>
                </td>
                <td>
                    <span class="product-price">R$ ${formatPrice(product.preco_venda)}</span>
                </td>
                <td>
                    <span class="product-stock ${stockClass}">
                        ${product.quantidade_estoque || 0}
                    </span>
                </td>
                <td>
                    <span class="product-status ${product.ativo ? 'status-active' : 'status-inactive'}">
                        ${product.ativo ? 'Ativo' : 'Inativo'}
                    </span>
                </td>
            </tr>
        `;
    }).join('');
}

// ===== SELEÇÃO DE PRODUTOS =====
function toggleProductSelection(productId) {
    if (appState.selectedProducts.has(productId)) {
        appState.selectedProducts.delete(productId);
    } else {
        appState.selectedProducts.add(productId);
    }
    
    updateSelectionState();
    updateRowSelection(productId);
}

function toggleSelectAll() {
    const isChecked = elements.selectAllCheckbox.checked;
    const currentPageProducts = getCurrentPageProducts();
    
    if (isChecked) {
        currentPageProducts.forEach(product => {
            appState.selectedProducts.add(product.id);
        });
    } else {
        currentPageProducts.forEach(product => {
            appState.selectedProducts.delete(product.id);
        });
    }
    
    updateSelectionState();
    updateAllRowSelections();
}

function updateSelectionState() {
    const selectedCount = appState.selectedProducts.size;
    
    // Atualizar contador
    elements.selectedCount.textContent = selectedCount;
    
    // Habilitar/desabilitar botões
    elements.btnGenerate.disabled = selectedCount === 0;
    elements.btnClearAll.disabled = selectedCount === 0;
    
    // Atualizar checkbox "selecionar todos"
    updateSelectAllCheckbox();
}

function updateSelectAllCheckbox() {
    const currentPageProducts = getCurrentPageProducts();
    const selectedOnPage = currentPageProducts.filter(p => appState.selectedProducts.has(p.id)).length;
    
    if (selectedOnPage === 0) {
        elements.selectAllCheckbox.checked = false;
        elements.selectAllCheckbox.indeterminate = false;
    } else if (selectedOnPage === currentPageProducts.length) {
        elements.selectAllCheckbox.checked = true;
        elements.selectAllCheckbox.indeterminate = false;
    } else {
        elements.selectAllCheckbox.checked = false;
        elements.selectAllCheckbox.indeterminate = true;
    }
}

function updateRowSelection(productId) {
    const row = document.querySelector(`tr[data-product-id="${productId}"]`);
    if (row) {
        const isSelected = appState.selectedProducts.has(productId);
        row.classList.toggle('selected', isSelected);
        
        const checkbox = row.querySelector('input[type="checkbox"]');
        if (checkbox) {
            checkbox.checked = isSelected;
        }
    }
}

function updateAllRowSelections() {
    const rows = document.querySelectorAll('tr[data-product-id]');
    rows.forEach(row => {
        const productId = parseInt(row.dataset.productId);
        const isSelected = appState.selectedProducts.has(productId);
        
        row.classList.toggle('selected', isSelected);
        const checkbox = row.querySelector('input[type="checkbox"]');
        if (checkbox) {
            checkbox.checked = isSelected;
        }
    });
}

function getCurrentPageProducts() {
    const startIndex = (CONFIG.currentPage - 1) * CONFIG.itemsPerPage;
    const endIndex = Math.min(startIndex + CONFIG.itemsPerPage, appState.filteredProducts.length);
    return appState.filteredProducts.slice(startIndex, endIndex);
}

// ===== SELEÇÃO RÁPIDA =====
function selectAll() {
    appState.filteredProducts.forEach(product => {
        appState.selectedProducts.add(product.id);
    });
    
    updateSelectionState();
    updateAllRowSelections();
    showSuccess(`${appState.filteredProducts.length} produtos selecionados`);
}

function clearAllSelections() {
    appState.selectedProducts.clear();
    updateSelectionState();
    updateAllRowSelections();
    showSuccess('Seleção limpa');
}

function selectByCategory() {
    if (appState.categories.length === 0) {
        showError('Nenhuma categoria encontrada');
        return;
    }
    
    // Atualizar select do modal
    updateCategorySelects(appState.categories);
    elements.categoryModal.classList.add('show');
}

function selectByPriceRange() {
    elements.priceRangeModal.classList.add('show');
}

function selectLowStock() {
    const lowStockProducts = appState.filteredProducts.filter(product => {
        const stock = product.quantidade_estoque || 0;
        const minStock = product.estoque_minimo || 0;
        return stock <= minStock && minStock > 0;
    });
    
    if (lowStockProducts.length === 0) {
        showError('Nenhum produto com estoque baixo encontrado');
        return;
    }
    
    lowStockProducts.forEach(product => {
        appState.selectedProducts.add(product.id);
    });
    
    updateSelectionState();
    updateAllRowSelections();
    showSuccess(`${lowStockProducts.length} produtos com estoque baixo selecionados`);
}

// ===== SELEÇÕES RÁPIDAS POR DATA =====
function selectToday() {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);
    
    selectByDateRange(startOfDay, endOfDay, 'hoje');
}

function selectThisWeek() {
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay()); // Domingo
    startOfWeek.setHours(0, 0, 0, 0);
    
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6); // Sábado
    endOfWeek.setHours(23, 59, 59, 999);
    
    selectByDateRange(startOfWeek, endOfWeek, 'esta semana');
}

function selectThisMonth() {
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59);
    
    selectByDateRange(startOfMonth, endOfMonth, 'este mês');
}

function selectByDateRange(startDate, endDate, periodName) {
    const dateProducts = appState.filteredProducts.filter(product => {
        if (!product.created_at) return false;
        
        const productDate = new Date(product.created_at);
        return productDate >= startDate && productDate <= endDate;
    });
    
    if (dateProducts.length === 0) {
        showError(`Nenhum produto cadastrado ${periodName} encontrado`);
        return;
    }
    
    dateProducts.forEach(product => {
        appState.selectedProducts.add(product.id);
    });
    
    updateSelectionState();
    updateAllRowSelections();
    showSuccess(`${dateProducts.length} produtos cadastrados ${periodName} selecionados`);
}

// ===== MODAIS DE SELEÇÃO =====
function closeCategoryModal() {
    elements.categoryModal.classList.remove('show');
}

function closePriceRangeModal() {
    elements.priceRangeModal.classList.remove('show');
}

function selectProductsByCategory() {
    const selectedCategory = elements.categorySelect.value;
    
    if (!selectedCategory) {
        showError('Selecione uma categoria');
        return;
    }
    
    const categoryProducts = appState.filteredProducts.filter(product => 
        product.categoria === selectedCategory
    );
    
    if (categoryProducts.length === 0) {
        showError('Nenhum produto encontrado para esta categoria');
        return;
    }
    
    categoryProducts.forEach(product => {
        appState.selectedProducts.add(product.id);
    });
    
    updateSelectionState();
    updateAllRowSelections();
    showSuccess(`${categoryProducts.length} produtos da categoria "${selectedCategory}" selecionados`);
    closeCategoryModal();
}

function selectProductsByPriceRange() {
    const minPrice = parseFloat(elements.priceRangeMin.value) || 0;
    const maxPrice = parseFloat(elements.priceRangeMax.value) || Infinity;
    
    if (minPrice > maxPrice) {
        showError('Preço mínimo não pode ser maior que o máximo');
        return;
    }
    
    const rangeProducts = appState.filteredProducts.filter(product => {
        const price = parseFloat(product.preco_venda) || 0;
        return price >= minPrice && price <= maxPrice;
    });
    
    if (rangeProducts.length === 0) {
        showError('Nenhum produto encontrado nesta faixa de preço');
        return;
    }
    
    rangeProducts.forEach(product => {
        appState.selectedProducts.add(product.id);
    });
    
    updateSelectionState();
    updateAllRowSelections();
    showSuccess(`${rangeProducts.length} produtos na faixa de R$ ${formatPrice(minPrice)} - R$ ${formatPrice(maxPrice)} selecionados`);
    closePriceRangeModal();
}

// ===== GERAÇÃO DE ETIQUETAS =====
function openEtiquetasModalBatch() {
    if (appState.selectedProducts.size === 0) {
        showError('Selecione pelo menos um produto');
        return;
    }
    
    // Obter dados dos produtos selecionados
    const selectedProductsData = appState.products.filter(product => 
        appState.selectedProducts.has(product.id)
    );
    
    // Abrir modal de etiquetas
    if (typeof openEtiquetasModal === 'function') {
        openEtiquetasModal(selectedProductsData);
    } else {
        showError('Sistema de etiquetas não disponível');
    }
}

// ===== ORDENAÇÃO =====
function sortBy(column) {
    if (CONFIG.sortBy === column) {
        CONFIG.sortOrder = CONFIG.sortOrder === 'asc' ? 'desc' : 'asc';
    } else {
        CONFIG.sortBy = column;
        CONFIG.sortOrder = 'asc';
    }
    
    updateSortIcons();
    applySorting();
    updateProductsDisplay();
}

function updateSortIcons() {
    // Remover classes de todas as colunas
    document.querySelectorAll('.sortable').forEach(th => {
        th.classList.remove('sort-asc', 'sort-desc');
    });
    
    // Adicionar classe na coluna ativa
    const activeHeader = document.querySelector(`.sortable[onclick="sortBy('${CONFIG.sortBy}')"]`);
    if (activeHeader) {
        activeHeader.classList.add(`sort-${CONFIG.sortOrder}`);
    }
}

// ===== PAGINAÇÃO =====
function updatePagination(totalItems, startIndex, endIndex) {
    const totalPages = Math.ceil(totalItems / CONFIG.itemsPerPage);
    
    // Atualizar informações
    elements.paginationInfo.textContent = 
        `Mostrando ${startIndex + 1}-${endIndex} de ${totalItems} produtos`;
    
    // Gerar botões de paginação
    elements.pagination.innerHTML = generatePaginationButtons(totalPages);
}

function generatePaginationButtons(totalPages) {
    if (totalPages <= 1) return '';
    
    let buttons = [];
    
    // Botão anterior
    buttons.push(`
        <button class="pagination-btn" ${CONFIG.currentPage === 1 ? 'disabled' : ''} 
                onclick="goToPage(${CONFIG.currentPage - 1})">
            <i class="fas fa-chevron-left"></i>
        </button>
    `);
    
    // Lógica dos números das páginas
    const range = getPaginationRange(CONFIG.currentPage, totalPages);
    
    range.forEach(pageNum => {
        if (pageNum === '...') {
            buttons.push('<span class="pagination-ellipsis">...</span>');
        } else {
            buttons.push(`
                <button class="pagination-btn ${pageNum === CONFIG.currentPage ? 'active' : ''}" 
                        onclick="goToPage(${pageNum})">
                    ${pageNum}
                </button>
            `);
        }
    });
    
    // Botão próximo
    buttons.push(`
        <button class="pagination-btn" ${CONFIG.currentPage === totalPages ? 'disabled' : ''} 
                onclick="goToPage(${CONFIG.currentPage + 1})">
            <i class="fas fa-chevron-right"></i>
        </button>
    `);
    
    return buttons.join('');
}

function getPaginationRange(current, total) {
    const range = [];
    const showAround = 2; // Quantas páginas mostrar ao redor da atual
    
    if (total <= 7) {
        // Se tem poucas páginas, mostra todas
        for (let i = 1; i <= total; i++) {
            range.push(i);
        }
    } else {
        // Sempre mostrar primeira página
        range.push(1);
        
        // Calcular início e fim do range central
        let start = Math.max(2, current - showAround);
        let end = Math.min(total - 1, current + showAround);
        
        // Ajustar para sempre mostrar 5 números no centro
        if (end - start < showAround * 2) {
            if (start === 2) {
                end = Math.min(total - 1, start + showAround * 2);
            } else {
                start = Math.max(2, end - showAround * 2);
            }
        }
        
        // Adicionar ... se necessário
        if (start > 2) {
            range.push('...');
        }
        
        // Adicionar páginas do centro
        for (let i = start; i <= end; i++) {
            range.push(i);
        }
        
        // Adicionar ... se necessário
        if (end < total - 1) {
            range.push('...');
        }
        
        // Sempre mostrar última página
        if (total > 1) {
            range.push(total);
        }
    }
    
    return range;
}

function goToPage(page) {
    const totalPages = Math.ceil(appState.filteredProducts.length / CONFIG.itemsPerPage);
    
    if (page < 1 || page > totalPages) return;
    
    CONFIG.currentPage = page;
    updateProductsDisplay();
    
    // Scroll suave para o topo da tabela
    elements.tableContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function changeItemsPerPage() {
    CONFIG.itemsPerPage = parseInt(elements.itemsPerPageSelect.value);
    CONFIG.currentPage = 1;
    updateProductsDisplay();
}

// ===== TOGGLE DE FILTROS =====
function toggleFilters() {
    // Função mantida para compatibilidade, mas agora chama toggleAdvancedFilters
    toggleAdvancedFilters();
}

// ===== UTILITÁRIOS =====
function getStockClass(currentStock, minStock) {
    const stock = currentStock || 0;
    const min = minStock || 0;
    
    if (stock === 0) return 'stock-low';
    if (min > 0 && stock <= min) return 'stock-low';
    if (min > 0 && stock <= min * 2) return 'stock-medium';
    return 'stock-high';
}

function formatPrice(price) {
    const numPrice = parseFloat(price) || 0;
    return numPrice.toFixed(2).replace('.', ',');
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

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

// ===== MENSAGENS DE FEEDBACK =====
function showSuccess(message) {
    showNotification(message, 'success');
}

function showError(message) {
    showNotification(message, 'error');
}

function showNotification(message, type) {
    // Remove notificação existente
    const existing = document.querySelector('.notification');
    if (existing) {
        existing.remove();
    }

    // Cria nova notificação
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.style.cssText = `
        position: fixed;
        top: 2rem;
        right: 2rem;
        padding: 1rem 1.5rem;
        border-radius: 8px;
        color: white;
        font-weight: 500;
        z-index: 10000;
        max-width: 400px;
        animation: slideInRight 0.3s ease;
        ${type === 'success' ? 'background-color: #10b981;' : 'background-color: #ef4444;'}
    `;
    
    notification.innerHTML = `
        <div style="display: flex; align-items: center; gap: 0.5rem;">
            <i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i>
            <span>${message}</span>
            <button onclick="this.parentElement.parentElement.remove()" 
                    style="background: none; border: none; color: white; margin-left: auto; cursor: pointer;">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `;

    document.body.appendChild(notification);

    // Remove automaticamente após 5 segundos
    setTimeout(() => {
        if (notification.parentNode) {
            notification.remove();
        }
    }, 5000);
}

// ===== EVENTOS GLOBAIS =====

// Fechar modais com ESC
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeCategoryModal();
        closePriceRangeModal();
    }
});

// Fechar modais clicando fora
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) {
        if (e.target.id === 'category-modal') closeCategoryModal();
        if (e.target.id === 'price-range-modal') closePriceRangeModal();
    }
});

// ===== ATALHOS DE TECLADO =====
document.addEventListener('keydown', (e) => {
    // Ctrl+A para selecionar todos
    if (e.ctrlKey && e.key === 'a' && e.target.tagName !== 'INPUT') {
        e.preventDefault();
        selectAll();
    }
    
    // Ctrl+D para limpar seleção
    if (e.ctrlKey && e.key === 'd') {
        e.preventDefault();
        clearAllSelections();
    }
    
    // Ctrl+P para gerar etiquetas
    if (e.ctrlKey && e.key === 'p') {
        e.preventDefault();
        if (appState.selectedProducts.size > 0) {
            openEtiquetasModalBatch();
        }
    }
    
    // F3 para focar na busca
    if (e.key === 'F3') {
        e.preventDefault();
        elements.searchNome.focus();
    }
});

// ===== PERSISTENCE DE CONFIGURAÇÕES =====
function saveUserPreferences() {
    const preferences = {
        itemsPerPage: CONFIG.itemsPerPage,
        sortBy: CONFIG.sortBy,
        sortOrder: CONFIG.sortOrder,
        filtersCollapsed: !!(elements.filtersContent && elements.filtersContent.classList.contains('collapsed'))
    };
    
    localStorage.setItem('gerar-etiquetas-preferences', JSON.stringify(preferences));
}

function loadUserPreferences() {
    try {
        const saved = localStorage.getItem('gerar-etiquetas-preferences');
        if (saved) {
            const preferences = JSON.parse(saved);
            
            CONFIG.itemsPerPage = preferences.itemsPerPage || CONFIG.itemsPerPage;
            CONFIG.sortBy = preferences.sortBy || CONFIG.sortBy;
            CONFIG.sortOrder = preferences.sortOrder || CONFIG.sortOrder;
            
            // Aplicar configurações à interface
            if (elements.itemsPerPageSelect) {
                elements.itemsPerPageSelect.value = CONFIG.itemsPerPage;
            }
            
            if (preferences.filtersCollapsed) {
                toggleFilters();
            }
        }
    } catch (error) {
        console.warn('Erro ao carregar preferências:', error);
    }
}

// Salvar preferências quando sair da página
window.addEventListener('beforeunload', saveUserPreferences);

// ===== FUNÇÕES GLOBAIS EXPOSTAS =====
window.toggleProductSelection = toggleProductSelection;
window.toggleSelectAll = toggleSelectAll;
window.sortBy = sortBy;
window.goToPage = goToPage;
window.changeItemsPerPage = changeItemsPerPage;
window.searchProducts = searchProducts;
window.clearFilters = clearFilters;
window.clearAllFilters = clearAllFilters;
window.setDateToday = setDateToday;
window.setDateThisWeek = setDateThisWeek;
window.setDateThisMonth = setDateThisMonth;
window.clearDates = clearDates;
window.toggleAdvancedFilters = toggleAdvancedFilters;
window.toggleFilters = toggleFilters;
window.selectAll = selectAll;
window.clearAllSelections = clearAllSelections;
window.selectByCategory = selectByCategory;
window.selectByPriceRange = selectByPriceRange;
window.selectLowStock = selectLowStock;
window.selectToday = selectToday;
window.selectThisWeek = selectThisWeek;
window.selectThisMonth = selectThisMonth;
window.closeCategoryModal = closeCategoryModal;
window.closePriceRangeModal = closePriceRangeModal;
window.selectProductsByCategory = selectProductsByCategory;
window.selectProductsByPriceRange = selectProductsByPriceRange;
window.openEtiquetasModalBatch = openEtiquetasModalBatch;

// ===== ADICIONAR CSS PARA ANIMAÇÕES =====
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    .pagination-ellipsis {
        padding: 0.5rem 0.75rem;
        color: #6b7280;
        font-size: 0.875rem;
    }
    
    .notification {
        box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
    }
    
    .filters-content.collapsed {
        max-height: 0 !important;
        padding-top: 0 !important;
        padding-bottom: 0 !important;
        margin-top: 0 !important;
        margin-bottom: 0 !important;
        overflow: hidden;
    }
    
    .sort-asc .sort-icon::before {
        content: "\\f0de";
    }
    
    .sort-desc .sort-icon::before {
        content: "\\f0dd";
    }
`;
document.head.appendChild(style);

console.log('Sistema de geração de etiquetas em lote carregado ✓');
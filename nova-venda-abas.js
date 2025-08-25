// nova-venda-categorias.js - Sistema de Categorias Estilo Apple (CORRIGIDO)
// ====================================================================

const CATEGORIES_STORAGE_KEY = 'lume-pdv-categories';
const CATEGORY_PRODUCTS_KEY = 'lume-pdv-category-products';
const DEFAULT_CATEGORIES = [
    { id: 'mais-vendidos', name: 'Mais Vendidos', icon: 'fa-fire', type: 'mais-vendidos', active: true },
    { id: 'ultimos-cadastrados', name: 'Últimos', icon: 'fa-clock', type: 'ultimos', active: true }
];

let categories = [];
let currentCategory = 'mais-vendidos';
let isLoadingProducts = false;
let categoryProducts = {};
let currentManagingCategory = null;
let lastRecentProducts = []; 
let lastMostSoldProducts = [];

function initCategoriesSystem() {
    loadCategories();
    loadCategoryProducts();
    renderCategoryTabs();
    bindCategoryEvents();
    loadCategoryProductsDisplay();
}

function loadCategories() {
    try {
        const saved = localStorage.getItem(CATEGORIES_STORAGE_KEY);
        if (saved) {
            categories = JSON.parse(saved);
            DEFAULT_CATEGORIES.forEach(defaultCat => {
                const exists = categories.find(cat => cat.id === defaultCat.id);
                if (!exists) categories.unshift(defaultCat);
            });
        } else {
            categories = [...DEFAULT_CATEGORIES];
        }
        categories = categories.filter(cat => cat.active !== false);
    } catch (error) {
        categories = [...DEFAULT_CATEGORIES];
    }
}

function loadCategoryProducts() {
    try {
        const saved = localStorage.getItem(CATEGORY_PRODUCTS_KEY);
        if (saved) categoryProducts = JSON.parse(saved);
    } catch (error) {
        categoryProducts = {};
    }
}

function saveCategories() {
    try {
        localStorage.setItem(CATEGORIES_STORAGE_KEY, JSON.stringify(categories));
    } catch (error) {
        console.error('Erro ao salvar categorias');
    }
}

function saveCategoryProducts() {
    try {
        localStorage.setItem(CATEGORY_PRODUCTS_KEY, JSON.stringify(categoryProducts));
    } catch (error) {
        console.error('Erro ao salvar produtos');
    }
}

function renderCategoryTabs() {
    const tabsContainer = document.getElementById('category-tabs');
    if (!tabsContainer) return;
    
    tabsContainer.innerHTML = categories.map(category => `
        <div class="category-tab ${category.id === currentCategory ? 'active' : ''}" 
             data-category="${category.id}">
            <i class="fa-solid ${category.icon}"></i>
            <span>${category.name}</span>
        </div>
    `).join('');
}

function switchCategory(categoryId) {
    if (currentCategory === categoryId || isLoadingProducts) return;
    
    const category = categories.find(cat => cat.id === categoryId);
    if (!category) return;
    
    currentCategory = categoryId;
    
    document.querySelectorAll('.category-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.category === categoryId);
    });
    
    loadCategoryProductsDisplay();
}

async function loadCategoryProductsDisplay() {
    const category = categories.find(cat => cat.id === currentCategory);
    if (!category) return;
    
    isLoadingProducts = true;
    showLoadingState();
    
    try {
        let products = [];
        
        switch (category.type) {
            case 'mais-vendidos':
                products = await getMostSoldProducts();
                break;
            case 'ultimos':
                products = await getRecentProducts();
                break;
            case 'manual':
                products = await getManualCategoryProducts(category.id);
                break;
            case 'categoria':
                products = await getProductsByCategory(category.value);
                break;
            case 'promocao':
                products = await getPromotionProducts();
                break;
            case 'estoque-baixo':
                products = await getLowStockProducts();
                break;
            default:
                products = await getRecentProducts();
        }
        
        await fetchProductImages(products);
        renderProducts(products);
        
    } catch (error) {
        showErrorState();
    } finally {
        isLoadingProducts = false;
    }
}

async function getManualCategoryProducts(categoryId) {
    try {
        const productIds = categoryProducts[categoryId] || [];
        if (productIds.length === 0) return [];
        if (!window.currentCompanyId) return [];
        
        const { data, error } = await supabaseClient
            .from('produtos')
            .select('*')
            .eq('id_empresa', window.currentCompanyId)
            .eq('ativo', true)
            .in('id', productIds);
        
        if (error) throw error;
        
        const orderedProducts = productIds
            .map(id => data.find(p => p.id === id))
            .filter(Boolean);
        
        return orderedProducts;
        
    } catch (error) {
        return [];
    }
}

async function getMostSoldProducts() {
    try {
        if (!window.currentCompanyId) return [];
        
        const { data: vendas, error } = await supabaseClient
            .from('vendas')
            .select('produto_nome, quantidade_unit')
            .eq('id_empresa', window.currentCompanyId)
            .eq('status', 'ATIVO')
            .gte('hora_venda', getDateDaysAgo(90));
        
        if (error) throw error;
        
        const vendasPorProduto = {};
        vendas.forEach(venda => {
            const nome = venda.produto_nome;
            if (nome) {
                vendasPorProduto[nome] = (vendasPorProduto[nome] || 0) + (venda.quantidade_unit || 0);
            }
        });
        
        const produtosMaisVendidos = Object.entries(vendasPorProduto)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 20)
            .map(([nome]) => nome);
        
        if (produtosMaisVendidos.length === 0) {
            return await getRecentProducts();
        }
        
        const { data: produtos, error: produtoError } = await supabaseClient
            .from('produtos')
            .select('*')
            .eq('id_empresa', window.currentCompanyId)
            .eq('ativo', true)
            .in('nome', produtosMaisVendidos);
        
        if (produtoError) throw produtoError;
        
        const produtosOrdenados = produtosMaisVendidos
            .map(nome => produtos.find(p => p.nome === nome))
            .filter(Boolean);
        
        if (lastMostSoldProducts.length > 0) {
            const newProductIds = new Set(produtosOrdenados.map(p => p.id));
            const removedProducts = lastMostSoldProducts.filter(p => !newProductIds.has(p.id));
            
            if (removedProducts.length > 0 && typeof removeProductsFromCache === 'function') {
                const removedIds = removedProducts.map(p => p.id);
                removeProductsFromCache(removedIds);
                console.log(`Produtos removidos da lista de mais vendidos: ${removedIds.join(', ')}`);
            }
        }
        
        lastMostSoldProducts = [...produtosOrdenados];
        
        return produtosOrdenados;
        
    } catch (error) {
        return await getRecentProducts();
    }
}

async function getRecentProducts() {
    try {
        if (!window.currentCompanyId) return [];
        
        const { data, error } = await supabaseClient
            .from('produtos')
            .select('*')
            .eq('id_empresa', window.currentCompanyId)
            .eq('ativo', true)
            .order('created_at', { ascending: false })
            .limit(20);
        
        if (error) throw error;
        
        const newProducts = data || [];
        
        if (lastRecentProducts.length > 0) {
            const newProductIds = new Set(newProducts.map(p => p.id));
            const removedProducts = lastRecentProducts.filter(p => !newProductIds.has(p.id));
            
            if (removedProducts.length > 0 && typeof removeProductsFromCache === 'function') {
                const removedIds = removedProducts.map(p => p.id);
                removeProductsFromCache(removedIds);
                console.log(`Produtos removidos da lista de últimos: ${removedIds.join(', ')}`);
            }
        }
        
        lastRecentProducts = [...newProducts];
        
        return newProducts;
        
    } catch (error) {
        return [];
    }
}

async function getPinnedProducts() {
    try {
        const pinnedIds = getPinnedProductIds();
        if (pinnedIds.length === 0) return [];
        if (!window.currentCompanyId) return [];
        
        const { data, error } = await supabaseClient
            .from('produtos')
            .select('*')
            .eq('id_empresa', window.currentCompanyId)
            .eq('ativo', true)
            .in('id', pinnedIds);
        
        if (error) throw error;
        return data || [];
        
    } catch (error) {
        return [];
    }
}

async function getProductsByCategory(categoryValue) {
    try {
        if (!window.currentCompanyId || !categoryValue) return [];
        
        const { data, error } = await supabaseClient
            .from('produtos')
            .select('*')
            .eq('id_empresa', window.currentCompanyId)
            .eq('ativo', true)
            .eq('categoria', categoryValue)
            .order('nome', { ascending: true })
            .limit(20);
        
        if (error) throw error;
        return data || [];
        
    } catch (error) {
        return [];
    }
}

async function getPromotionProducts() {
    try {
        if (!window.currentCompanyId) return [];
        
        const { data, error } = await supabaseClient
            .from('produtos')
            .select('*')
            .eq('id_empresa', window.currentCompanyId)
            .eq('ativo', true)
            .not('preco_promocional', 'is', null)
            .gt('preco_promocional', 0)
            .order('preco_promocional', { ascending: true })
            .limit(20);
        
        if (error) throw error;
        return data || [];
        
    } catch (error) {
        return [];
    }
}

async function getLowStockProducts() {
    try {
        if (!window.currentCompanyId) return [];
        
        const { data, error } = await supabaseClient
            .from('produtos')
            .select('*')
            .eq('id_empresa', window.currentCompanyId)
            .eq('ativo', true)
            .lt('quantidade_estoque', 10)
            .gt('quantidade_estoque', 0)
            .order('quantidade_estoque', { ascending: true })
            .limit(20);
        
        if (error) throw error;
        return data || [];
        
    } catch (error) {
        return [];
    }
}

function getDateDaysAgo(days) {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return date.toISOString();
}

function renderProducts(products) {
    const grid = document.getElementById('recent-products-grid');
    if (!grid) return;
    
    if (!products || products.length === 0) {
        const category = categories.find(cat => cat.id === currentCategory);
        const isManualCategory = category && category.type === 'manual';
        
        grid.innerHTML = `
            <div class="empty-state">
                <i class="fa-solid fa-box-open"></i>
                <h3>Nenhum produto encontrado</h3>
                <p>${isManualCategory ? 
                    'Clique no ícone ⚙️ para adicionar produtos a esta categoria.' : 
                    'Esta categoria ainda não possui produtos.'
                }</p>
            </div>
        `;
        return;
    }
    
    const pinnedIds = getPinnedProductIds();
    
    grid.innerHTML = products.map(product => {
        const isPinned = pinnedIds.includes(product.id);
        const imageUrl = getImageUrl(product);
        
        return `
            <div class="product-card" data-product-id="${product.id}">
                <div class="product-actions">
                    <button class="pin-btn ${isPinned ? 'pinned' : ''}" title="Fixar produto">
                        <i class="fa-solid fa-thumbtack"></i>
                    </button>
                </div>
                <img src="${imageUrl}" 
                     alt="${product.nome}" 
                     class="product-card-img"
                     onerror="this.onerror=null; this.src='nofoto.png';">
                <div class="product-card-info">
                    <div class="product-card-name">${product.nome}</div>
                    <div class="product-card-price">${formatCurrency(product.preco_venda)}</div>
                </div>
            </div>
        `;
    }).join('');
    
    // ======= CORREÇÃO: Atualizar variável global =======
    if (typeof window !== 'undefined') {
        window.renderedProducts = products;
    }
    // Também atualizar a variável local para compatibilidade
    if (typeof renderedProducts !== 'undefined') {
        renderedProducts = products;
    }
}

function showLoadingState() {
    const grid = document.getElementById('recent-products-grid');
    if (!grid) return;
    
    grid.innerHTML = `
        <div class="empty-state">
            <i class="fa-solid fa-spinner fa-spin"></i>
            <h3>Carregando produtos...</h3>
            <p>Aguarde um momento.</p>
        </div>
    `;
}

function showErrorState() {
    const grid = document.getElementById('recent-products-grid');
    if (!grid) return;
    
    grid.innerHTML = `
        <div class="empty-state">
            <i class="fa-solid fa-exclamation-triangle"></i>
            <h3>Erro ao carregar produtos</h3>
            <p>Tente novamente em alguns instantes.</p>
        </div>
    `;
}

function bindCategoryEvents() {
    // ======= CORREÇÃO: Usar delegação de eventos para categorias =======
    const tabsContainer = document.getElementById('category-tabs');
    if (tabsContainer) {
        // Remover listeners antigos clonando o elemento
        const newTabsContainer = tabsContainer.cloneNode(true);
        tabsContainer.parentNode.replaceChild(newTabsContainer, tabsContainer);
        
        // Adicionar um único listener usando delegação
        newTabsContainer.addEventListener('click', function(e) {
            const tab = e.target.closest('.category-tab');
            if (tab) {
                const categoryId = tab.dataset.category;
                switchCategory(categoryId);
            }
        });
    }
    
    const manageBtn = document.getElementById('manage-categories-btn');
    if (manageBtn) {
        manageBtn.addEventListener('click', openManageCategoriesModal);
    }
    
    bindModalEvents();
}

function openManageCategoriesModal() {
    const modal = document.getElementById('manage-categories-modal');
    if (!modal) return;
    
    modal.classList.remove('hidden');
    renderCategoriesList();
    loadProductCategories();
    
    const form = document.getElementById('category-form');
    if (form) form.reset();
    
    const valueGroup = document.getElementById('category-value-group');
    if (valueGroup) valueGroup.classList.add('hidden');
}

function closeManageCategoriesModal() {
    const modal = document.getElementById('manage-categories-modal');
    if (modal) modal.classList.add('hidden');
}

function openManageProductsModal(categoryId) {
    const category = categories.find(cat => cat.id === categoryId);
    if (!category || category.type !== 'manual') {
        alert('Apenas categorias manuais podem ter produtos gerenciados.');
        return;
    }
    
    currentManagingCategory = categoryId;
    const modal = document.getElementById('manage-products-modal');
    if (!modal) return;
    
    document.getElementById('manage-products-title').textContent = 
        `Gerenciar Produtos - ${category.name}`;
    
    modal.classList.remove('hidden');
    loadAvailableProducts();
    loadSelectedProducts();
}

function closeManageProductsModal() {
    const modal = document.getElementById('manage-products-modal');
    if (modal) modal.classList.add('hidden');
    currentManagingCategory = null;
}

async function loadAvailableProducts(searchTerm = '') {
    const list = document.getElementById('available-products-list');
    if (!list) return;
    
    try {
        let query = supabaseClient
            .from('produtos')
            .select('*')
            .eq('id_empresa', window.currentCompanyId)
            .eq('ativo', true)
            .order('nome', { ascending: true })
            .limit(50);
        
        if (searchTerm) {
            query = query.or(`nome.ilike.%${searchTerm}%,codigo_sku.ilike.%${searchTerm}%`);
        }
        
        const { data: products, error } = await query;
        if (error) throw error;
        
        const selectedIds = categoryProducts[currentManagingCategory] || [];
        const availableProducts = products.filter(p => !selectedIds.includes(p.id));
        
        if (availableProducts.length === 0) {
            list.innerHTML = `
                <div class="empty-state">
                    <i class="fa-solid fa-search"></i>
                    <h3>Nenhum produto encontrado</h3>
                    <p>Tente buscar por outro termo.</p>
                </div>
            `;
            return;
        }
        
        list.innerHTML = availableProducts.map(product => `
            <div class="product-item-apple" data-product-id="${product.id}">
                <img src="${getImageUrl(product)}" alt="${product.nome}" class="product-item-img-apple"
                     onerror="this.onerror=null; this.src='nofoto.png';">
                <div class="product-item-info-apple">
                    <div class="product-item-name-apple">${product.nome}</div>
                    <div class="product-item-price-apple">${formatCurrency(product.preco_venda)}</div>
                </div>
                <button class="product-item-action-apple" onclick="addProductToCategory(${product.id})" title="Adicionar">
                    <i class="fa-solid fa-plus"></i>
                </button>
            </div>
        `).join('');
        
    } catch (error) {
        list.innerHTML = `
            <div class="empty-state">
                <i class="fa-solid fa-exclamation-triangle"></i>
                <h3>Erro ao carregar produtos</h3>
                <p>Tente novamente.</p>
            </div>
        `;
    }
}

async function loadSelectedProducts() {
    const list = document.getElementById('selected-products-list');
    if (!list) return;
    
    const selectedIds = categoryProducts[currentManagingCategory] || [];
    
    if (selectedIds.length === 0) {
        list.innerHTML = `
            <div class="empty-state">
                <i class="fa-solid fa-box-open"></i>
                <h3>Nenhum produto selecionado</h3>
                <p>Adicione produtos da lista ao lado.</p>
            </div>
        `;
        return;
    }
    
    try {
        const { data: products, error } = await supabaseClient
            .from('produtos')
            .select('*')
            .eq('id_empresa', window.currentCompanyId)
            .in('id', selectedIds);
        
        if (error) throw error;
        
        const orderedProducts = selectedIds
            .map(id => products.find(p => p.id === id))
            .filter(Boolean);
        
        list.innerHTML = orderedProducts.map(product => `
            <div class="product-item-apple selected" data-product-id="${product.id}">
                <img src="${getImageUrl(product)}" alt="${product.nome}" class="product-item-img-apple"
                     onerror="this.onerror=null; this.src='nofoto.png';">
                <div class="product-item-info-apple">
                    <div class="product-item-name-apple">${product.nome}</div>
                    <div class="product-item-price-apple">${formatCurrency(product.preco_venda)}</div>
                </div>
                <button class="product-item-action-apple remove" onclick="removeProductFromCategory(${product.id})" title="Remover">
                    <i class="fa-solid fa-minus"></i>
                </button>
            </div>
        `).join('');
        
    } catch (error) {
        list.innerHTML = `
            <div class="empty-state">
                <i class="fa-solid fa-exclamation-triangle"></i>
                <h3>Erro ao carregar produtos</h3>
                <p>Tente novamente.</p>
            </div>
        `;
    }
}

function addProductToCategory(productId) {
    if (!currentManagingCategory) return;
    
    if (!categoryProducts[currentManagingCategory]) {
        categoryProducts[currentManagingCategory] = [];
    }
    
    if (!categoryProducts[currentManagingCategory].includes(productId)) {
        categoryProducts[currentManagingCategory].push(productId);
        saveCategoryProducts();
        loadAvailableProducts();
        loadSelectedProducts();
    }
}

function removeProductFromCategory(productId) {
    if (!currentManagingCategory) return;
    
    if (categoryProducts[currentManagingCategory]) {
        categoryProducts[currentManagingCategory] = 
            categoryProducts[currentManagingCategory].filter(id => id !== productId);
        saveCategoryProducts();
        
        // Limpar cache da imagem se a função estiver disponível
        if (typeof removeProductFromCache === 'function') {
            removeProductFromCache(productId);
        }
        
        loadAvailableProducts();
        loadSelectedProducts();
    }
}

function saveProductsChanges() {
    saveCategoryProducts();
    closeManageProductsModal();
    
    if (currentCategory === currentManagingCategory) {
        loadCategoryProductsDisplay();
    }
    
    showNotification('Produtos da categoria atualizados com sucesso!', 'success');
}

function renderCategoriesList() {
    const list = document.getElementById('categories-list');
    if (!list) return;
    
    if (categories.length === 0) {
        list.innerHTML = `
            <div class="empty-state">
                <i class="fa-solid fa-folder-open"></i>
                <h3>Nenhuma categoria criada</h3>
                <p>Crie sua primeira categoria abaixo.</p>
            </div>
        `;
        return;
    }
    
    list.innerHTML = categories.map(category => `
        <div class="category-item" data-category-id="${category.id}">
            <div class="category-info">
                <div class="category-icon">
                    <i class="fa-solid ${category.icon}"></i>
                </div>
                <div class="category-details">
                    <h5>${category.name}</h5>
                    <p>${getCategoryTypeLabel(category.type)}</p>
                </div>
            </div>
            <div class="category-actions">
                ${category.type === 'manual' ? `
                    <button class="icon-btn manage" onclick="openManageProductsModal('${category.id}')" title="Gerenciar Produtos">
                        <i class="fa-solid fa-cog"></i>
                    </button>
                ` : ''}
                <button class="icon-btn edit" onclick="editCategory('${category.id}')" title="Editar">
                    <i class="fa-solid fa-edit"></i>
                </button>
                <button class="icon-btn delete" onclick="deleteCategory('${category.id}')" title="Excluir">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </div>
        </div>
    `).join('');
}

function isDefaultCategory(categoryId) {
    return false; // Permitir exclusão de todas as categorias
}

function getCategoryTypeLabel(type) {
    const labels = {
        'categoria': 'Por Categoria',
        'mais-vendidos': 'Mais Vendidos',
        'ultimos': 'Últimos Cadastrados',
        'promocao': 'Em Promoção',
        'estoque-baixo': 'Estoque Baixo'
    };
    return labels[type] || type;
}

async function loadProductCategories() {
    try {
        if (!window.currentCompanyId) return;
        
        const { data, error } = await supabaseClient
            .from('produtos')
            .select('categoria')
            .eq('id_empresa', window.currentCompanyId)
            .not('categoria', 'is', null);
        
        if (error) throw error;
        
        const uniqueCategories = [...new Set(data.map(p => p.categoria).filter(Boolean))];
        
        const select = document.getElementById('category-value');
        if (select) {
            select.innerHTML = '<option value="">Selecione a categoria</option>' +
                uniqueCategories.map(cat => `<option value="${cat}">${cat}</option>`).join('');
        }
        
    } catch (error) {
        console.error('Erro ao carregar categorias de produtos');
    }
}

function bindModalEvents() {
    document.addEventListener('click', function(e) {
        if (e.target.closest('.close-btn-apple')) {
            if (e.target.closest('#manage-categories-modal')) {
                closeManageCategoriesModal();
            } else if (e.target.closest('#manage-products-modal')) {
                closeManageProductsModal();
            }
        }
        
        if (e.target.id === 'manage-categories-modal') {
            closeManageCategoriesModal();
        } else if (e.target.id === 'manage-products-modal') {
            closeManageProductsModal();
        }
    });
    
    const typeSelect = document.getElementById('category-type');
    if (typeSelect) {
        typeSelect.addEventListener('change', function() {
            const valueGroup = document.getElementById('category-value-group');
            if (valueGroup) {
                valueGroup.classList.toggle('hidden', this.value !== 'categoria');
            }
        });
    }
    
    const form = document.getElementById('category-form');
    if (form) {
        form.addEventListener('submit', handleAddCategory);
    }
    
    const searchInput = document.getElementById('search-products-input');
    if (searchInput) {
        let searchTimeout;
        searchInput.addEventListener('input', function() {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                loadAvailableProducts(this.value.trim());
            }, 300);
        });
    }
    
    const saveBtn = document.getElementById('save-products-btn');
    if (saveBtn) {
        saveBtn.addEventListener('click', saveProductsChanges);
    }
}

function handleAddCategory(e) {
    e.preventDefault();
    
    const name = document.getElementById('category-name').value.trim();
    const icon = document.getElementById('category-icon').value;
    const type = document.getElementById('category-type').value;
    const value = document.getElementById('category-value').value;
    
    if (!name || !icon || !type) {
        alert('Por favor, preencha todos os campos obrigatórios.');
        return;
    }
    
    if (type === 'categoria' && !value) {
        alert('Por favor, selecione uma categoria de produto.');
        return;
    }
    
    const id = generateCategoryId(name);
    
    if (categories.find(cat => cat.id === id)) {
        alert('Já existe uma categoria com este nome.');
        return;
    }
    
    const newCategory = {
        id,
        name,
        icon,
        type,
        value: type === 'categoria' ? value : null,
        active: true,
        createdAt: new Date().toISOString()
    };
    
    categories.push(newCategory);
    saveCategories();
    renderCategoryTabs();
    renderCategoriesList();
    
    e.target.reset();
    const valueGroup = document.getElementById('category-value-group');
    if (valueGroup) valueGroup.classList.add('hidden');
    
    showNotification(`Categoria "${name}" criada com sucesso!`, 'success');
}

function generateCategoryId(name) {
    return name.toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
}

function editCategory(categoryId) {
    const category = categories.find(cat => cat.id === categoryId);
    if (!category) return;
    
    document.getElementById('category-name').value = category.name;
    document.getElementById('category-icon').value = category.icon;
    document.getElementById('category-type').value = category.type;
    
    if (category.type === 'categoria') {
        document.getElementById('category-value').value = category.value || '';
        document.getElementById('category-value-group').classList.remove('hidden');
    }
    
    const form = document.getElementById('category-form');
    const submitBtn = form.querySelector('button[type="submit"]');
    
    submitBtn.innerHTML = '<i class="fa-solid fa-save"></i> Salvar';
    submitBtn.onclick = function(e) {
        e.preventDefault();
        saveEditedCategory(categoryId);
    };
}

function saveEditedCategory(categoryId) {
    const name = document.getElementById('category-name').value.trim();
    const icon = document.getElementById('category-icon').value;
    const type = document.getElementById('category-type').value;
    const value = document.getElementById('category-value').value;
    
    if (!name || !icon || !type) {
        alert('Por favor, preencha todos os campos obrigatórios.');
        return;
    }
    
    if (type === 'categoria' && !value) {
        alert('Por favor, selecione uma categoria de produto.');
        return;
    }
    
    const categoryIndex = categories.findIndex(cat => cat.id === categoryId);
    if (categoryIndex === -1) return;
    
    categories[categoryIndex] = {
        ...categories[categoryIndex],
        name,
        icon,
        type,
        value: type === 'categoria' ? value : null,
        updatedAt: new Date().toISOString()
    };
    
    saveCategories();
    renderCategoryTabs();
    renderCategoriesList();
    
    const form = document.getElementById('category-form');
    form.reset();
    document.getElementById('category-value-group').classList.add('hidden');
    
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.innerHTML = '<i class="fa-solid fa-plus"></i> Adicionar';
    submitBtn.onclick = null;
    
    showNotification(`Categoria "${name}" atualizada com sucesso!`, 'success');
    
    if (categoryId === currentCategory) {
        loadCategoryProductsDisplay();
    }
}

function deleteCategory(categoryId) {
    const category = categories.find(cat => cat.id === categoryId);
    if (!category) return;
    
    if (isDefaultCategory(categoryId)) {
        alert('Categorias padrão não podem ser excluídas.');
        return;
    }
    
    if (!confirm(`Tem certeza que deseja excluir a categoria "${category.name}"?`)) {
        return;
    }
    
    categories = categories.filter(cat => cat.id !== categoryId);
    delete categoryProducts[categoryId];
    saveCategories();
    saveCategoryProducts();
    renderCategoryTabs();
    renderCategoriesList();
    
    if (categoryId === currentCategory) {
        currentCategory = categories[0]?.id || 'mais-vendidos';
        renderCategoryTabs();
        loadCategoryProductsDisplay();
    }
    
    showNotification(`Categoria "${category.name}" excluída com sucesso!`, 'info');
}

// ======= CORREÇÃO: Nova função de integração sem conflitos =======
function integrateCategoriesSystem() {
    // Substituir função de busca de produtos recentes sem conflitos
    if (typeof window.fetchRecentProducts === 'function') {
        window.fetchRecentProductsOriginal = window.fetchRecentProducts;
        window.fetchRecentProducts = loadCategoryProductsDisplay;
    }
    
    // ======= REMOVER EVENT LISTENER ANTIGO QUE ESTAVA CAUSANDO DUPLICAÇÃO =======
    // Este bloco estava sendo executado junto com o do nova-venda-ui.js
    // causando a duplicação dos cliques
    
    console.log('✅ Sistema de categorias integrado sem conflitos de eventos');
}

// Inicialização
document.addEventListener('DOMContentLoaded', function() {
    function waitForCompanyData() {
        if (window.currentCompanyId) {
            initCategoriesSystem();
            integrateCategoriesSystem();
        } else {
            setTimeout(waitForCompanyData, 100);
        }
    }
    waitForCompanyData();
});

document.addEventListener('userDataReady', function() {
    initCategoriesSystem();
    integrateCategoriesSystem();
});

// Exportar funções globais
window.switchCategory = switchCategory;
window.editCategory = editCategory;
window.deleteCategory = deleteCategory;
window.loadCategoryProductsDisplay = loadCategoryProductsDisplay;
window.openManageProductsModal = openManageProductsModal;
window.addProductToCategory = addProductToCategory;
window.removeProductFromCategory = removeProductFromCategory;
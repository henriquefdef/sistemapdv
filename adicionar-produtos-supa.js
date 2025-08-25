// ===== ADICIONAR PRODUTOS - OPERAÇÕES SUPABASE =====

// Configuração dos modais e tabelas
const modalData = {
    categoria: { 
        title: 'Adicionar Categoria', 
        label: 'Nome da Categoria', 
        table: 'categorias', 
        nameField: 'nome' 
    },
    marca: { 
        title: 'Adicionar Marca', 
        label: 'Nome da Marca', 
        table: 'marcas', 
        nameField: 'nome' 
    },
    colecao: { 
        title: 'Adicionar Coleção', 
        label: 'Nome da Coleção', 
        table: 'colecoes', 
        nameField: 'nome' 
    },
    fornecedor: { 
        title: 'Adicionar Fornecedor', 
        label: 'Nome do Fornecedor', 
        table: 'fornecedores', 
        nameField: 'razao_social' 
    },
    cor: { 
        title: 'Adicionar Cor', 
        label: 'Nome da Cor', 
        table: 'cores', 
        nameField: 'nome' 
    },
    material: { 
        title: 'Adicionar Material', 
        label: 'Nome do Material', 
        table: 'materiais', 
        nameField: 'nome' 
    },
    localizacao: { 
        title: 'Adicionar Localização', 
        label: 'Nome da Localização', 
        table: 'localizacoes', 
        nameField: 'nome' 
    }
};

let currentModalType = '';

// ===== CARREGAMENTO DOS SELECTS =====
async function loadSelectOptions() {
    try {
        await Promise.all([
            loadOptions('categoria-produto', 'categorias', 'nome'),
            loadOptions('marca', 'marcas', 'nome'),
            loadOptions('colecao', 'colecoes', 'nome'),
            loadOptions('fornecedor', 'fornecedores', 'razao_social'),
            loadOptions('cor', 'cores', 'nome'),
            loadOptions('material', 'materiais', 'nome'),
            loadOptions('localizacao', 'localizacoes', 'nome')
        ]);
        console.log('Todas as opções dos selects carregadas com sucesso');
    } catch (error) {
        console.error('Erro ao carregar opções dos selects:', error);
    }
}

async function loadOptions(selectId, tableName, fieldName) {
    try {
        const { data, error } = await supabaseClient
            .from(tableName)
            .select(`id, ${fieldName}`)
            .eq('id_empresa', window.currentCompanyId)
            .order(fieldName, { ascending: true });

        if (error) throw error;

        const select = document.getElementById(selectId);
        if (!select) {
            console.warn(`Select com ID '${selectId}' não encontrado`);
            return;
        }

        // Preserva a primeira option (placeholder)
        const firstOption = select.querySelector('option');
        select.innerHTML = '';
        if (firstOption) {
            select.appendChild(firstOption);
        }

        // Adiciona as opções vindas do banco
        data.forEach(item => {
            const option = document.createElement('option');
            option.value = item.id;
            option.textContent = item[fieldName];
            select.appendChild(option);
        });

        console.log(`Carregadas ${data.length} opções para ${selectId}`);
    } catch (error) {
        console.error(`Erro ao carregar ${tableName}:`, error);
        showSelectError(selectId, `Erro ao carregar ${tableName}`);
    }
}

function showSelectError(selectId, message) {
    const select = document.getElementById(selectId);
    if (select) {
        select.innerHTML = `<option value="">${message}</option>`;
        select.style.color = '#ef4444';
    }
}

// ===== MODAL PARA ADICIONAR ITENS =====
window.openModal = function(type) {
    currentModalType = type;
    const config = modalData[type];
    
    if (!config) {
        console.error(`Tipo de modal '${type}' não encontrado`);
        return;
    }
    
    // Configura o modal
    document.getElementById('modal-title').textContent = config.title;
    document.getElementById('item-label').textContent = config.label;
    document.getElementById('item-name').value = '';
    document.getElementById('item-name').placeholder = `Digite ${config.label.toLowerCase()}`;
    
    // Carrega lista de itens existentes
    loadModalItems(type);
    
    // Mostra o modal
    document.getElementById('add-item-modal').classList.add('show');
    
    // Foco no campo de input
    setTimeout(() => {
        document.getElementById('item-name').focus();
    }, 300);
}

window.closeModal = function() {
    document.getElementById('add-item-modal').classList.remove('show');
    currentModalType = '';
    
    // Limpa o formulário do modal
    document.getElementById('item-name').value = '';
    const saveBtn = document.getElementById('save-item-btn');
    saveBtn.disabled = false;
    saveBtn.querySelector('span').textContent = 'Salvar';
}

async function loadModalItems(type) {
    const config = modalData[type];
    const itemsList = document.getElementById('items-list');
    
    // Mostra loading
    itemsList.innerHTML = '<div class="loading-items">Carregando...</div>';
    
    try {
        const { data, error } = await supabaseClient
            .from(config.table)
            .select(`id, ${config.nameField}`)
            .eq('id_empresa', window.currentCompanyId)
            .order(config.nameField, { ascending: true });

        if (error) throw error;

        if (data.length === 0) {
            itemsList.innerHTML = '<div class="empty-list">Nenhum item cadastrado</div>';
        } else {
            itemsList.innerHTML = data.map(item => `
                <div class="item-row" data-id="${item.id}">
                    <span class="item-name">${escapeHtml(item[config.nameField])}</span>
                    <button class="btn-delete" onclick="deleteItem('${type}', ${item.id})" title="Excluir">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `).join('');
        }
    } catch (error) {
        itemsList.innerHTML = '<div class="empty-list error">Erro ao carregar itens</div>';
        console.error('Erro ao carregar itens do modal:', error);
    }
}

// ===== SALVAR NOVO ITEM =====
window.saveItem = async function() {
    const itemName = document.getElementById('item-name').value.trim();
    if (!itemName) {
        alert('Digite o nome do item');
        document.getElementById('item-name').focus();
        return;
    }

    const config = modalData[currentModalType];
    const saveBtn = document.getElementById('save-item-btn');
    const originalText = saveBtn.querySelector('span').textContent;
    
    // Mostra loading
    saveBtn.disabled = true;
    saveBtn.querySelector('span').textContent = 'Salvando...';

    try {
        // Verifica se já existe um item com esse nome
        const { data: existing, error: checkError } = await supabaseClient
            .from(config.table)
            .select('id')
            .eq('id_empresa', window.currentCompanyId)
            .eq(config.nameField, itemName)
            .single();

        if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = no rows found
            throw checkError;
        }

        if (existing) {
            alert('Este item já existe');
            return;
        }

        // Insere o novo item
        const insertData = {
            [config.nameField]: itemName,
            id_empresa: window.currentCompanyId,
            auth_user_id: window.currentUser.auth_user_id
        };

        const { data, error } = await supabaseClient
            .from(config.table)
            .insert([insertData])
            .select();

        if (error) throw error;

        // Sucesso - atualiza interface
        console.log(`${config.title} salvo com sucesso:`, data[0]);
        
        // Atualiza lista no modal
        await loadModalItems(currentModalType);
        
        // Atualiza select na página principal
        const selectId = currentModalType === 'categoria' ? 'categoria-produto' : currentModalType;
        await loadOptions(selectId, config.table, config.nameField);
        
        // Seleciona o item recém-criado
        document.getElementById(selectId).value = data[0].id;
        
        // Limpa o campo de input
        document.getElementById('item-name').value = '';
        
        // Feedback visual
        showModalSuccess(`${config.title.replace('Adicionar ', '')} adicionado com sucesso!`);
        
    } catch (error) {
        console.error('Erro ao salvar item:', error);
        const errorMessage = error.code === '23505' ? 'Este item já existe' : error.message;
        alert(`Erro ao salvar: ${errorMessage}`);
    } finally {
        saveBtn.disabled = false;
        saveBtn.querySelector('span').textContent = originalText;
    }
}

// ===== EXCLUIR ITEM =====
window.deleteItem = async function(type, itemId) {
    const config = modalData[type];
    
    if (!confirm(`Tem certeza que deseja excluir este ${config.title.replace('Adicionar ', '').toLowerCase()}?`)) {
        return;
    }

    try {
        const { error } = await supabaseClient
            .from(config.table)
            .delete()
            .eq('id', itemId);

        if (error) throw error;

        console.log(`Item excluído com sucesso: ${itemId}`);

        // Atualiza lista no modal
        await loadModalItems(type);
        
        // Atualiza select na página principal
        const selectId = type === 'categoria' ? 'categoria-produto' : type;
        await loadOptions(selectId, config.table, config.nameField);
        
        showModalSuccess('Item excluído com sucesso!');
        
    } catch (error) {
        console.error('Erro ao excluir item:', error);
        let errorMessage = 'Erro desconhecido';
        
        if (error.code === '23503') {
            errorMessage = 'Não é possível excluir este item pois ele está sendo usado por outros registros';
        } else {
            errorMessage = error.message;
        }
        
        alert(`Erro ao excluir: ${errorMessage}`);
    }
}

// ===== SALVAR PRODUTO =====
async function saveProduct(productData) {
    try {
        console.log('Salvando produto:', productData);

        // Validação dos dados obrigatórios
        if (!productData.nome || !productData.preco_venda) {
            throw new Error('Nome e preço de venda são obrigatórios');
        }

        // Verifica se já existe produto com mesmo SKU ou código de barras
        if (productData.codigo_sku) {
            const { data: existingSKU } = await supabaseClient
                .from('produtos')
                .select('id')
                .eq('id_empresa', window.currentCompanyId)
                .eq('codigo_sku', productData.codigo_sku)
                .single();

            if (existingSKU) {
                throw new Error('Já existe um produto com este código SKU');
            }
        }

        if (productData.codigo_barras) {
            const { data: existingBarcode } = await supabaseClient
                .from('produtos')
                .select('id')
                .eq('id_empresa', window.currentCompanyId)
                .eq('codigo_barras', productData.codigo_barras)
                .single();

            if (existingBarcode) {
                throw new Error('Já existe um produto com este código de barras');
            }
        }

        // Preparar dados para inserção (remover campos vazios)
        const cleanData = {};
        Object.keys(productData).forEach(key => {
            if (productData[key] !== null && productData[key] !== undefined && productData[key] !== '') {
                cleanData[key] = productData[key];
            }
        });

        // Inserir produto no banco
        const { data, error } = await supabaseClient
            .from('produtos')
            .insert([cleanData])
            .select();

        if (error) throw error;

        const savedProduct = data[0];
        console.log('Produto salvo com sucesso:', savedProduct);

        // Salvar imagens se existirem
        if (window.productImages && window.productImages.length > 0 && typeof saveProductImages === 'function') {
            try {
                await saveProductImages(savedProduct.id, window.productImages);
                console.log('Imagens enviadas com sucesso!');
            } catch (imgError) {
                console.error('Erro ao salvar imagens:', imgError);
                // Não falha o processo principal por causa das imagens
            }
        }

        return { 
            success: true, 
            data: savedProduct,
            message: 'Produto cadastrado com sucesso!'
        };

    } catch (error) {
        console.error('Erro ao salvar produto:', error);
        return { 
            success: false, 
            error: error.message || 'Erro desconhecido ao salvar produto'
        };
    }
}

// ===== BUSCAR PRODUTOS =====
async function searchProducts(filters = {}) {
    try {
        let query = supabaseClient
            .from('produtos')
            .select(`
                *,
                categorias(nome),
                marcas(nome),
                colecoes(nome),
                fornecedores(nome)
            `)
            .eq('id_empresa', window.currentCompanyId);

        // Aplicar filtros
        if (filters.nome) {
            query = query.ilike('nome', `%${filters.nome}%`);
        }
        
        if (filters.categoria_id) {
            query = query.eq('categoria_id', filters.categoria_id);
        }
        
        if (filters.marca_id) {
            query = query.eq('marca_id', filters.marca_id);
        }
        
        if (filters.ativo !== undefined) {
            query = query.eq('ativo', filters.ativo);
        }

        // Ordenação
        const orderBy = filters.orderBy || 'nome';
        const ascending = filters.ascending !== false;
        query = query.order(orderBy, { ascending });

        const { data, error } = await query;
        
        if (error) throw error;

        return { success: true, data };

    } catch (error) {
        console.error('Erro ao buscar produtos:', error);
        return { success: false, error: error.message };
    }
}

// ===== ATUALIZAR PRODUTO =====
async function updateProduct(productId, updateData) {
    try {
        // Remove campos vazios
        const cleanData = {};
        Object.keys(updateData).forEach(key => {
            if (updateData[key] !== null && updateData[key] !== undefined && updateData[key] !== '') {
                cleanData[key] = updateData[key];
            }
        });

        const { data, error } = await supabaseClient
            .from('produtos')
            .update(cleanData)
            .eq('id', productId)
            .eq('id_empresa', window.currentCompanyId)
            .select();

        if (error) throw error;

        return { success: true, data: data[0] };

    } catch (error) {
        console.error('Erro ao atualizar produto:', error);
        return { success: false, error: error.message };
    }
}

// ===== EXCLUIR PRODUTO =====
async function deleteProduct(productId) {
    try {
        // Verificar se produto tem vendas
        const { data: sales } = await supabaseClient
            .from('vendas_produtos')
            .select('id')
            .eq('produto_id', productId)
            .limit(1);

        if (sales && sales.length > 0) {
            throw new Error('Não é possível excluir este produto pois ele possui vendas registradas');
        }

        // Excluir imagens primeiro se existir a função
        if (typeof deleteProductImages === 'function') {
            await deleteProductImages(productId);
        }

        // Excluir produto
        const { error } = await supabaseClient
            .from('produtos')
            .delete()
            .eq('id', productId)
            .eq('id_empresa', window.currentCompanyId);

        if (error) throw error;

        return { success: true };

    } catch (error) {
        console.error('Erro ao excluir produto:', error);
        return { success: false, error: error.message };
    }
}

// ===== BUSCAR PRODUTO POR ID =====
async function getProductById(productId) {
    try {
        const { data, error } = await supabaseClient
            .from('produtos')
            .select(`
                *,
                categorias(id, nome),
                marcas(id, nome),
                colecoes(id, nome),
                fornecedores(id, nome)
            `)
            .eq('id', productId)
            .eq('id_empresa', window.currentCompanyId)
            .single();

        if (error) throw error;

        return { success: true, data };

    } catch (error) {
        console.error('Erro ao buscar produto:', error);
        return { success: false, error: error.message };
    }
}

// ===== VALIDAÇÕES DE NEGÓCIO =====
async function validateProductData(productData, isUpdate = false, productId = null) {
    const errors = [];

    // Nome obrigatório
    if (!productData.nome || productData.nome.trim().length < 2) {
        errors.push('Nome do produto deve ter pelo menos 2 caracteres');
    }

    // Preço de venda obrigatório e maior que zero
    if (!productData.preco_venda || productData.preco_venda <= 0) {
        errors.push('Preço de venda deve ser maior que zero');
    }

    // Preço de custo não pode ser maior que preço de venda (aviso, não erro)
    if (productData.preco_custo && productData.preco_venda && 
        productData.preco_custo > productData.preco_venda) {
        console.warn('Preço de custo maior que preço de venda');
    }

    // Validar códigos únicos
    if (productData.codigo_sku) {
        const { data: existingSKU } = await supabaseClient
            .from('produtos')
            .select('id')
            .eq('id_empresa', window.currentCompanyId)
            .eq('codigo_sku', productData.codigo_sku)
            .neq('id', productId || 0);

        if (existingSKU && existingSKU.length > 0) {
            errors.push('Código SKU já existe');
        }
    }

    if (productData.codigo_barras) {
        const { data: existingBarcode } = await supabaseClient
            .from('produtos')
            .select('id')
            .eq('id_empresa', window.currentCompanyId)
            .eq('codigo_barras', productData.codigo_barras)
            .neq('id', productId || 0);

        if (existingBarcode && existingBarcode.length > 0) {
            errors.push('Código de barras já existe');
        }
    }

    // Validar estoque
    if (productData.estoque_minimo && productData.estoque_maximo &&
        productData.estoque_minimo > productData.estoque_maximo) {
        errors.push('Estoque mínimo não pode ser maior que estoque máximo');
    }

    return {
        isValid: errors.length === 0,
        errors
    };
}

// ===== FUNÇÕES AUXILIARES =====
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showModalSuccess(message) {
    // Cria um mini toast dentro do modal
    const existingToast = document.querySelector('.modal-toast');
    if (existingToast) {
        existingToast.remove();
    }

    const toast = document.createElement('div');
    toast.className = 'modal-toast';
    toast.style.cssText = `
        position: absolute;
        top: 1rem;
        right: 1rem;
        background-color: #10b981;
        color: white;
        padding: 0.5rem 1rem;
        border-radius: 6px;
        font-size: 0.875rem;
        z-index: 1002;
        animation: fadeInOut 3s ease-in-out;
    `;
    toast.textContent = message;

    const modalContent = document.querySelector('.modal-content');
    modalContent.style.position = 'relative';
    modalContent.appendChild(toast);

    setTimeout(() => {
        if (toast.parentNode) {
            toast.remove();
        }
    }, 3000);
}

// ===== EVENTOS DO MODAL =====
document.addEventListener('DOMContentLoaded', () => {
    // Fechar modal clicando fora
    document.getElementById('add-item-modal').addEventListener('click', (e) => {
        if (e.target.id === 'add-item-modal') {
            closeModal();
        }
    });

    // Submeter formulário do modal com Enter
    document.getElementById('item-name').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            saveItem();
        }
    });

    // Adicionar CSS para animações do modal
    const style = document.createElement('style');
    style.textContent = `
        @keyframes fadeInOut {
            0% { opacity: 0; transform: translateY(-10px); }
            15% { opacity: 1; transform: translateY(0); }
            85% { opacity: 1; transform: translateY(0); }
            100% { opacity: 0; transform: translateY(-10px); }
        }
        
        .loading-items {
            padding: 1rem;
            text-align: center;
            color: #6b7280;
            font-style: italic;
        }
        
        .empty-list.error {
            color: #ef4444;
        }
        
        .item-row:hover {
            background-color: #f9fafb;
        }
    `;
    document.head.appendChild(style);
});

// ===== EXPORTAR FUNÇÕES GLOBAIS =====
window.saveProduct = saveProduct;
window.searchProducts = searchProducts;
window.updateProduct = updateProduct;
window.deleteProduct = deleteProduct;
window.getProductById = getProductById;
window.validateProductData = validateProductData;
window.loadSelectOptions = loadSelectOptions;
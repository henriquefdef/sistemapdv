// ===== MOVIMENTAR ESTOQUE - JAVASCRIPT PRINCIPAL =====

// Variáveis globais
let currentProduct = null;
let currentMovementType = 'entrada';

document.addEventListener('DOMContentLoaded', () => {
    document.addEventListener('userDataReady', initializePage);
    
    function initializePage() {
        setupEventListeners();
        // Não carrega movimentações inicialmente - só quando selecionar produto
    }

    // ===== CONFIGURAÇÃO DE EVENTOS =====
    function setupEventListeners() {
        // Botões de tipo de movimentação
        const movementBtns = document.querySelectorAll('.movement-type-btn');
        movementBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                setMovementType(btn.dataset.type);
            });
        });

        // Busca de produto
        const searchInput = document.getElementById('product-search');
        const searchBtn = document.getElementById('search-btn');

        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                searchProduct();
            }
        });

        searchBtn.addEventListener('click', searchProduct);

        // Campos de cálculo automático
        setupCalculations();

        // Formulário
        document.getElementById('movement-form').addEventListener('submit', handleSubmit);
    }

    // ===== TIPO DE MOVIMENTAÇÃO =====
    function setMovementType(type) {
        currentMovementType = type;
        
        // Atualizar botões
        document.querySelectorAll('.movement-type-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-type="${type}"]`).classList.add('active');

        // Mostrar campos correspondentes
        document.querySelectorAll('.movement-fields').forEach(field => {
            field.classList.add('hidden');
        });
        document.getElementById(`${type}-fields`).classList.remove('hidden');

        // Atualizar resumo
        document.getElementById('summary-type').textContent = 
            type === 'entrada' ? 'Entrada' : 
            type === 'saida' ? 'Saída' : 'Ajuste';

        // Configurações específicas por tipo
        if (type === 'ajuste' && currentProduct) {
            document.getElementById('estoque-sistema').value = currentProduct.quantidade_estoque || 0;
        }

        updateSummary();
    }

    // ===== BUSCA DE PRODUTO =====
    async function searchProduct() {
        const searchTerm = document.getElementById('product-search').value.trim();
        
        if (!searchTerm) {
            showError('Digite um código de barras, SKU ou nome do produto');
            return;
        }

        showLoading(true);

        try {
            // Função do arquivo movimentar-supa.js
            const result = await searchProductInDatabase(searchTerm);
            
            if (!result.success) {
                showError(result.error);
                return;
            }

            if (result.data.length === 0) {
                showError('Produto não encontrado');
                return;
            }

            if (result.data.length === 1) {
                selectProduct(result.data[0]);
            } else {
                showProductOptions(result.data);
            }

        } catch (error) {
            console.error('Erro ao buscar produto:', error);
            showError('Erro ao buscar produto');
        } finally {
            showLoading(false);
        }
    }

    function showProductOptions(products) {
        // Implementar modal de seleção se múltiplos produtos
        // Por agora, selecionar o primeiro
        selectProduct(products[0]);
    }

    async function selectProduct(product) {
        currentProduct = product;

        // Preencher dados do produto
        document.getElementById('product-name').textContent = product.nome;
        document.getElementById('product-sku').textContent = `SKU: ${product.codigo_sku || 'N/A'}`;
        document.getElementById('product-stock').innerHTML = 
            `Estoque Atual: <span>${product.quantidade_estoque || 0} unidades</span>`;

        // Mostrar produto selecionado
        document.getElementById('selected-product').classList.remove('hidden');
        document.getElementById('movement-data').classList.remove('hidden');

        // Configurar campos específicos
        if (currentMovementType === 'ajuste') {
            document.getElementById('estoque-sistema').value = product.quantidade_estoque || 0;
        }

        updateSummary();

        // 🆕 NOVO: Carregar movimentações deste produto específico
        loadProductMovements(product.id);
    }

    // ===== CÁLCULOS AUTOMÁTICOS =====
    function setupCalculations() {
        // Campos de quantidade
        document.getElementById('quantidade').addEventListener('input', updateSummary);
        document.getElementById('quantidade-saida').addEventListener('input', updateSummary);
        
        // Campos de ajuste
        document.getElementById('estoque-fisico').addEventListener('input', () => {
            calculateAdjustment();
            updateSummary();
        });

        // Valor total automático
        document.getElementById('quantidade').addEventListener('input', calculateTotal);
        document.getElementById('valor-unitario').addEventListener('input', calculateTotal);
    }

    function calculateTotal() {
        const quantidade = parseFloat(document.getElementById('quantidade').value) || 0;
        const valorUnitario = parseFloat(document.getElementById('valor-unitario').value) || 0;
        
        // Aqui poderia mostrar valor total se necessário
    }

    function calculateAdjustment() {
        const estoqueSystem = parseFloat(document.getElementById('estoque-sistema').value) || 0;
        const estoqueFisico = parseFloat(document.getElementById('estoque-fisico').value) || 0;
        const diferenca = estoqueFisico - estoqueSystem;
        
        document.getElementById('diferenca').value = diferenca;
    }

    function updateSummary() {
        if (!currentProduct) return;

        let quantidade = 0;
        const estoqueAtual = currentProduct.quantidade_estoque || 0;

        switch (currentMovementType) {
            case 'entrada':
                quantidade = parseFloat(document.getElementById('quantidade').value) || 0;
                break;
            case 'saida':
                quantidade = -(parseFloat(document.getElementById('quantidade-saida').value) || 0);
                break;
            case 'ajuste':
                const estoqueFisico = parseFloat(document.getElementById('estoque-fisico').value) || 0;
                quantidade = estoqueFisico - estoqueAtual;
                break;
        }

        const novoEstoque = estoqueAtual + quantidade;

        document.getElementById('summary-quantity').textContent = 
            quantidade > 0 ? `+${quantidade}` : quantidade.toString();
        document.getElementById('summary-new-stock').textContent = `${novoEstoque} unidades`;
    }

    // ===== SUBMISSÃO DO FORMULÁRIO =====
    async function handleSubmit(e) {
        e.preventDefault();

        if (!currentProduct) {
            showError('Selecione um produto primeiro');
            return;
        }

        if (!validateForm()) {
            return;
        }

        // Verificar se não há uma movimentação idêntica muito recente (últimos 5 segundos)
        const isDuplicate = await checkDuplicateMovement();
        if (isDuplicate) {
            showError('Movimentação já foi registrada. Aguarde alguns segundos antes de tentar novamente.');
            return;
        }

        showLoading(true);

        try {
            const movementData = collectMovementData();
            
            // Função do arquivo movimentar-supa.js
            const result = await registerMovement(movementData);
            
            if (!result.success) {
                throw new Error(result.error);
            }

            showSuccess(`Movimentação registrada com sucesso! Novo estoque: ${result.newStock} unidades`);
            
            // Resetar formulário
            resetForm();

        } catch (error) {
            console.error('Erro ao registrar movimentação:', error);
            showError(`Erro ao registrar movimentação: ${error.message}`);
        } finally {
            showLoading(false);
        }
    }

    // ===== VERIFICAÇÃO DE DUPLICATA =====
    async function checkDuplicateMovement() {
        try {
            const movementData = collectMovementData();
            
            // Função do arquivo movimentar-supa.js
            const result = await checkForDuplicateMovement(movementData);
            return result.isDuplicate;

        } catch (error) {
            console.error('Erro na verificação de duplicata:', error);
            return false;
        }
    }

    function validateForm() {
        // Limpar erros anteriores
        document.querySelectorAll('.input-field.error, .select-field.error').forEach(field => {
            field.classList.remove('error');
        });

        switch (currentMovementType) {
            case 'entrada':
                const quantidade = parseFloat(document.getElementById('quantidade').value);
                if (!quantidade || quantidade <= 0) {
                    showFieldError(document.getElementById('quantidade'), 'Digite uma quantidade válida');
                    return false;
                }
                break;
                
            case 'saida':
                const quantidadeSaida = parseFloat(document.getElementById('quantidade-saida').value);
                if (!quantidadeSaida || quantidadeSaida <= 0) {
                    showFieldError(document.getElementById('quantidade-saida'), 'Digite uma quantidade válida');
                    return false;
                }
                
                if (quantidadeSaida > (currentProduct.quantidade_estoque || 0)) {
                    showFieldError(document.getElementById('quantidade-saida'), 'Quantidade maior que o estoque disponível');
                    return false;
                }
                break;
                
            case 'ajuste':
                const estoqueFisico = document.getElementById('estoque-fisico').value;
                const observacao = document.getElementById('observacao-ajuste').value.trim();
                
                if (estoqueFisico === '') {
                    showFieldError(document.getElementById('estoque-fisico'), 'Digite o estoque físico contado');
                    return false;
                }
                
                if (!observacao) {
                    showFieldError(document.getElementById('observacao-ajuste'), 'Explique o motivo do ajuste');
                    return false;
                }
                break;
        }

        return true;
    }

    function showFieldError(field, message) {
        field.classList.add('error');
        field.focus();
        showError(message);
    }

    function collectMovementData() {
        let quantidade = 0;
        let valorUnitario = null;
        let documento = '';
        let fornecedor = '';
        let observacao = '';

        switch (currentMovementType) {
            case 'entrada':
                quantidade = parseInt(document.getElementById('quantidade').value);
                valorUnitario = parseFloat(document.getElementById('valor-unitario').value) || null;
                documento = document.getElementById('documento').value.trim();
                fornecedor = document.getElementById('fornecedor').value.trim();
                observacao = document.getElementById('observacao').value.trim();
                break;
                
            case 'saida':
                quantidade = -parseInt(document.getElementById('quantidade-saida').value);
                documento = document.getElementById('documento-saida').value.trim();
                observacao = document.getElementById('observacao-saida').value.trim();
                
                const motivo = document.getElementById('motivo-saida').value;
                if (motivo) {
                    observacao = `${motivo}${observacao ? ': ' + observacao : ''}`;
                }
                break;
                
            case 'ajuste':
                const estoqueAtual = currentProduct.quantidade_estoque || 0;
                const estoqueFisico = parseInt(document.getElementById('estoque-fisico').value);
                quantidade = estoqueFisico - estoqueAtual;
                documento = 'Ajuste de Inventário';
                observacao = document.getElementById('observacao-ajuste').value.trim();
                break;
        }

        return {
            produto_id: currentProduct.id,
            tipo_movimentacao: currentMovementType,
            quantidade: quantidade,
            valor_unitario: valorUnitario,
            valor_total: valorUnitario ? (Math.abs(quantidade) * valorUnitario) : null,
            documento: documento || null,
            fornecedor: fornecedor || null,
            observacao: observacao || null,
            auth_user_id: window.currentUser.auth_user_id,
            id_empresa: window.currentCompanyId
        };
    }

    // ===== MOVIMENTAÇÕES DO PRODUTO ESPECÍFICO =====
    async function loadProductMovements(productId) {
        try {
            // Mostrar loading na seção de movimentações
            document.getElementById('movements-list').innerHTML = '<div class="loading">Carregando movimentações...</div>';
            
            // Função do arquivo movimentar-supa.js
            const result = await getProductMovements(productId);
            
            if (!result.success) {
                throw new Error(result.error);
            }

            displayMovements(result.data);

        } catch (error) {
            console.error('Erro ao carregar movimentações do produto:', error);
            document.getElementById('movements-list').innerHTML = 
                '<div class="loading">Erro ao carregar movimentações</div>';
        }
    }

    function displayMovements(movements) {
        const container = document.getElementById('movements-list');
        
        if (!movements || movements.length === 0) {
            container.innerHTML = `
                <div class="loading">
                    <i class="fas fa-info-circle"></i> 
                    Nenhuma movimentação encontrada para este produto
                </div>
            `;
            return;
        }

        container.innerHTML = movements.map(movement => `
            <div class="movement-item">
                <div class="movement-info">
                    <h4>${movement.produtos?.nome || currentProduct.nome}</h4>
                    <p><strong>SKU:</strong> ${movement.produtos?.codigo_sku || currentProduct.codigo_sku || 'N/A'}</p>
                    <p><strong>Data:</strong> ${formatDate(movement.created_at)}</p>
                    ${movement.documento ? `<p><strong>Documento:</strong> ${movement.documento}</p>` : ''}
                    ${movement.observacao ? `<p><strong>Obs:</strong> ${movement.observacao}</p>` : ''}
                </div>
                <div style="text-align: right;">
                    <div class="movement-badge ${movement.tipo_movimentacao}">
                        ${movement.tipo_movimentacao}
                    </div>
                    <div class="movement-quantity ${movement.quantidade > 0 ? 'positive' : 'negative'}">
                        ${movement.quantidade > 0 ? '+' : ''}${movement.quantidade}
                    </div>
                </div>
            </div>
        `).join('');
    }

    // ===== FUNÇÕES AUXILIARES =====
    function clearProduct() {
        currentProduct = null;
        document.getElementById('selected-product').classList.add('hidden');
        document.getElementById('movement-data').classList.add('hidden');
        document.getElementById('product-search').value = '';
        
        // 🆕 NOVO: Limpar lista de movimentações
        document.getElementById('movements-list').innerHTML = `
            <div class="loading">
                <i class="fas fa-search"></i> 
                Selecione um produto para ver suas movimentações
            </div>
        `;
    }

    window.resetForm = function() {
        document.getElementById('movement-form').reset();
        clearProduct();
        setMovementType('entrada');
    }

    function formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleString('pt-BR');
    }

    function showLoading(show) {
        const btnText = document.getElementById('btn-text');
        const btnSpinner = document.getElementById('btn-spinner');
        const submitBtn = document.querySelector('.btn-save');
        
        submitBtn.disabled = show;
        btnText.classList.toggle('hidden', show);
        btnSpinner.classList.toggle('hidden', !show);
        
        // Adicionar timeout para evitar cliques múltiplos
        if (show) {
            submitBtn.style.pointerEvents = 'none';
            setTimeout(() => {
                submitBtn.style.pointerEvents = 'auto';
            }, 2000); // 2 segundos de delay
        }
    }

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
            z-index: 1001;
            max-width: 400px;
            animation: slideIn 0.3s ease;
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

    // Adicionar CSS para animações
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from {
                transform: translateX(100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
    `;
    document.head.appendChild(style);

    // Exportar função global
    window.clearProduct = clearProduct;

    // Inicializar lista de movimentações com mensagem
    document.getElementById('movements-list').innerHTML = `
        <div class="loading">
            <i class="fas fa-search"></i> 
            Selecione um produto para ver suas movimentações
        </div>
    `;
});
// ===== ADICIONAR PRODUTOS - JAVASCRIPT PRINCIPAL =====

document.addEventListener('DOMContentLoaded', () => {
    document.addEventListener('userDataReady', initializePage);
    
    function initializePage() {
        setupTabs();
        setupFormValidation();
        setupFormSubmission();
        setupCalculations();
        loadInitialData();
    }

    // ===== CONTROLE DAS ABAS =====
    function setupTabs() {
        const tabButtons = document.querySelectorAll('.tab-nav-item');
        const tabPanes = document.querySelectorAll('.tab-pane');

        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                // Remove active de todos
                tabButtons.forEach(btn => btn.classList.remove('active'));
                tabPanes.forEach(pane => pane.classList.remove('active'));
                
                // Ativa o clicado
                button.classList.add('active');
                const tabId = button.dataset.tab;
                document.getElementById(tabId).classList.add('active');
                
                // Scroll suave para o topo da aba
                document.querySelector('.tab-pane.active').scrollIntoView({ 
                    behavior: 'smooth', 
                    block: 'start' 
                });
            });
        });
    }

    // ===== VALIDAÇÃO DO FORMULÁRIO =====
    function setupFormValidation() {
        const requiredFields = document.querySelectorAll('[required]');
        
        requiredFields.forEach(field => {
            field.addEventListener('blur', validateField);
            field.addEventListener('input', clearFieldError);
        });
    }

    function validateField(event) {
        const field = event.target;
        const value = field.value.trim();
        
        // Remove erro anterior
        clearFieldError(event);
        
        if (!value) {
            showFieldError(field, 'Este campo é obrigatório');
            return false;
        }
        
        // Validações específicas
        if (field.type === 'number' && parseFloat(value) <= 0) {
            showFieldError(field, 'Digite um valor maior que zero');
            return false;
        }
        
        return true;
    }

    function showFieldError(field, message) {
        field.classList.add('error');
        
        // Remove mensagem anterior se existir
        const existingError = field.parentNode.querySelector('.field-error');
        if (existingError) {
            existingError.remove();
        }
        
        // Adiciona nova mensagem
        const errorDiv = document.createElement('div');
        errorDiv.className = 'field-error';
        errorDiv.textContent = message;
        errorDiv.style.cssText = 'color: #ef4444; font-size: 0.75rem; margin-top: 0.25rem;';
        field.parentNode.appendChild(errorDiv);
    }

    function clearFieldError(event) {
        const field = event.target;
        field.classList.remove('error');
        
        const errorMsg = field.parentNode.querySelector('.field-error');
        if (errorMsg) {
            errorMsg.remove();
        }
    }

    // ===== CÁLCULOS AUTOMÁTICOS =====
    function setupCalculations() {
        const precoCusto = document.getElementById('preco-custo');
        const precoVenda = document.getElementById('preco-venda');
        const markup = document.getElementById('markup');

        // Carregar markup salvo do localStorage
        const savedMarkup = localStorage.getItem('defaultMarkup');
        if (savedMarkup) {
            markup.value = savedMarkup;
        }

        // Eventos para cálculos automáticos
        precoCusto.addEventListener('input', calculateFromCostAndMarkup);
        markup.addEventListener('input', () => {
            // Salvar markup no localStorage
            if (markup.value) {
                localStorage.setItem('defaultMarkup', markup.value);
            }
            calculateFromCostAndMarkup();
        });
        precoVenda.addEventListener('input', calculateMarkupFromPrices);

        function calculateFromCostAndMarkup() {
            const custo = parseFloat(precoCusto.value) || 0;
            const markupValue = parseFloat(markup.value) || 0;
            
            if (custo > 0 && markupValue > 0) {
                const venda = custo * (1 + markupValue / 100);
                precoVenda.value = venda.toFixed(2);
                updateMarkupVisualFeedback(markupValue);
            } else if (custo > 0 && markupValue === 0) {
                // Se markup é 0, limpar preço de venda
                precoVenda.value = '';
                markup.style.color = '';
            }
        }

        function calculateMarkupFromPrices() {
            const custo = parseFloat(precoCusto.value) || 0;
            const venda = parseFloat(precoVenda.value) || 0;
            
            if (custo > 0 && venda > 0) {
                const markupCalc = ((venda - custo) / custo) * 100;
                markup.value = markupCalc.toFixed(2);
                
                // Salvar no localStorage
                localStorage.setItem('defaultMarkup', markup.value);
                
                updateMarkupVisualFeedback(markupCalc);
            } else {
                markup.value = '';
                markup.style.color = '';
            }
        }

        function updateMarkupVisualFeedback(markupValue) {
            // Visual feedback do markup
            if (markupValue < 0) {
                markup.style.color = '#ef4444'; // Vermelho para prejuízo
                markup.style.fontWeight = '600';
            } else if (markupValue < 20) {
                markup.style.color = '#f59e0b'; // Amarelo para markup baixo
                markup.style.fontWeight = '500';
            } else {
                markup.style.color = '#10b981'; // Verde para bom markup
                markup.style.fontWeight = '600';
            }
        }
    }

    // ===== CARREGAMENTO INICIAL DOS DADOS =====
    function loadInitialData() {
        // Carrega dados dos selects via arquivo supa
        if (typeof loadSelectOptions === 'function') {
            loadSelectOptions();
        }
        
        // Inicializa upload de imagens via arquivo img
        if (typeof initializeImageUpload === 'function') {
            initializeImageUpload();
        }
        
        // Verificar se está editando um produto
        checkForEditMode();
    }
    
    // ===== VERIFICAR MODO DE EDIÇÃO =====
    async function checkForEditMode() {
        const urlParams = new URLSearchParams(window.location.search);
        const editId = urlParams.get('edit');
        
        if (editId) {
            try {
                await loadProductForEdit(editId);
            } catch (error) {
                console.error('Erro ao carregar produto para edição:', error);
                showErrorMessage('Erro ao carregar dados do produto.');
            }
        }
    }
    
    // ===== CARREGAR PRODUTO PARA EDIÇÃO =====
    async function loadProductForEdit(productId) {
        try {
            const { data, error } = await supabaseClient
                .from('produtos')
                .select('*')
                .eq('id', productId)
                .eq('id_empresa', window.currentCompanyId)
                .single();
                
            if (error) throw error;
            
            if (!data) {
                showErrorMessage('Produto não encontrado.');
                return;
            }
            
            // Preencher formulário com dados do produto
            fillFormWithProductData(data);
            
            // Atualizar título da página
            const pageTitle = document.querySelector('.page-header h1');
            if (pageTitle) {
                pageTitle.innerHTML = 'Estoque > <strong>Editar Produto</strong>';
            }
            
            // Carregar imagens do produto
            if (typeof loadProductImages === 'function') {
                loadProductImages(productId);
            }
            
        } catch (error) {
            console.error('Erro ao buscar produto:', error);
            throw error;
        }
    }
    
    // ===== PREENCHER FORMULÁRIO COM DADOS DO PRODUTO =====
    function fillFormWithProductData(product) {
        // Informações gerais
        document.getElementById('nome-produto').value = product.nome || '';
        document.getElementById('categoria-produto').value = product.categoria || '';
        
        // Campo de quantidade - desabilitar para edição
        const quantidadeField = document.getElementById('quantidade-estoque');
        quantidadeField.value = product.quantidade_estoque || '';
        quantidadeField.disabled = true;
        quantidadeField.style.backgroundColor = '#f5f5f5';
        quantidadeField.style.color = '#666';
        quantidadeField.title = 'Para alterar a quantidade, use a página de Movimentação de Estoque';
        
        // Valores
        document.getElementById('preco-custo').value = product.preco_custo || '';
        document.getElementById('preco-venda').value = product.preco_venda || '';
        
        // Calcular markup se ambos os preços existirem
        if (product.preco_custo && product.preco_venda) {
            const custo = parseFloat(product.preco_custo);
            const venda = parseFloat(product.preco_venda);
            if (custo > 0) {
                const markup = ((venda - custo) / custo) * 100;
                document.getElementById('markup').value = markup.toFixed(2);
            }
        }
        
        // Origem
        const fornecedorField = document.getElementById('fornecedor');
        if (fornecedorField) fornecedorField.value = product.fornecedor || '';
        
        const marcaField = document.getElementById('marca');
        if (marcaField) marcaField.value = product.marca || '';
        
        // Códigos
        const codigoSkuField = document.getElementById('codigo-sku');
        if (codigoSkuField) codigoSkuField.value = product.codigo_sku || '';
        
        const codigoBarrasField = document.getElementById('codigo-barras');
        if (codigoBarrasField) codigoBarrasField.value = product.codigo_barras || '';
        
        // Descrição
        const descricaoField = document.getElementById('descricao');
        if (descricaoField) descricaoField.value = product.descricao || '';
        
        // Pesos e dimensões
        const pesoField = document.getElementById('peso');
        if (pesoField) pesoField.value = product.peso || '';
        
        const alturaField = document.getElementById('altura');
        if (alturaField) alturaField.value = product.altura || '';
        
        const larguraField = document.getElementById('largura');
        if (larguraField) larguraField.value = product.largura || '';
        
        const comprimentoField = document.getElementById('comprimento');
        if (comprimentoField) comprimentoField.value = product.comprimento || '';
        
        // Dados fiscais
        const ncmField = document.getElementById('ncm');
        if (ncmField) ncmField.value = product.ncm || '';
        
        const cfopField = document.getElementById('cfop');
        if (cfopField) cfopField.value = product.cfop || '';
        
        const icmsField = document.getElementById('icms');
        if (icmsField) icmsField.value = product.icms || '';
        
        const ipiField = document.getElementById('ipi');
        if (ipiField) ipiField.value = product.ipi || '';
        
        // Armazenar ID do produto para atualização
        window.editingProductId = product.id;
        
        console.log('✅ Dados do produto carregados para edição:', product.nome);
    }
    
    // ===== FUNÇÃO PARA ATUALIZAR PRODUTO EXISTENTE =====
    async function updateProduct(productId, productData) {
        try {
            const { data, error } = await supabaseClient
                .from('produtos')
                .update({
                    nome: productData.nome,
                    categoria: productData.categoria,
                    quantidade_estoque: productData.quantidade_estoque,
                    preco_custo: productData.preco_custo,
                    preco_venda: productData.preco_venda,
                    fornecedor: productData.fornecedor,
                    marca: productData.marca,
                    codigo_sku: productData.codigo_sku,
                    codigo_barras: productData.codigo_barras,
                    descricao: productData.descricao,
                    peso: productData.peso,
                    altura: productData.altura,
                    largura: productData.largura,
                    comprimento: productData.comprimento,
                    ncm: productData.ncm,
                    cfop: productData.cfop,
                    icms: productData.icms,
                    ipi: productData.ipi,
                    modificado: new Date(new Date().getTime() - (3 * 60 * 60 * 1000)).toISOString(),
                    modificado_por: window.currentUserId
                })
                .eq('id', productId)
                .eq('id_empresa', window.currentCompanyId)
                .select()
                .single();
                
            if (error) {
                console.error('Erro ao atualizar produto:', error);
                return { success: false, error: error.message };
            }
            
            console.log('✅ Produto atualizado com sucesso:', data);
            return { success: true, data };
            
        } catch (error) {
            console.error('Erro ao atualizar produto:', error);
            return { success: false, error: error.message };
        }
    }
    
    // ===== FUNÇÃO PARA MOSTRAR MENSAGEM DE ERRO =====
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
        `;
        document.body.appendChild(toast);
        
        setTimeout(() => {
            if (toast.parentNode) {
                document.body.removeChild(toast);
            }
        }, 5000);
    }
    
    // ===== FUNÇÃO PARA MOSTRAR MENSAGEM DE SUCESSO =====
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
        `;
        document.body.appendChild(toast);
        
        setTimeout(() => {
            if (toast.parentNode) {
                document.body.removeChild(toast);
            }
        }, 5000);
    }

    // ===== SUBMISSÃO DO FORMULÁRIO =====
    function setupFormSubmission() {
        const form = document.getElementById('product-form');
        const saveBtn = form.querySelector('.btn-save');
        const btnText = document.getElementById('btn-text');
        const btnSpinner = document.getElementById('btn-spinner');

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            // Validação completa do formulário
            if (!validateForm()) {
                return;
            }

            // Mostrar loading
            setLoadingState(true);

            try {
                // Coleta dados do formulário
                const productData = collectFormData();
                
                // Verificar se está editando ou criando
                const isEditing = window.editingProductId;
                
                if (isEditing) {
                    // Modo edição - atualizar produto existente
                    const result = await updateProduct(window.editingProductId, productData);
                    
                    if (result.success) {
                        showSuccessMessage('Produto atualizado com sucesso!');
                        
                        // Redirecionar de volta para lista de produtos
                        setTimeout(() => {
                            window.location.href = 'lista-produtos.html';
                        }, 1500);
                    } else {
                        throw new Error(result.error);
                    }
                } else {
                    // Modo criação - salvar novo produto
                    if (typeof saveProduct === 'function') {
                        const result = await saveProduct(productData);
                        
                        if (result.success) {
                            showSuccessMessage('Produto cadastrado com sucesso!');
                            
                            // 🆕 NOVO: Registrar movimentação de entrada inicial se houver quantidade
                            if (productData.quantidade_estoque && productData.quantidade_estoque > 0) {
                                try {
                                    await registrarMovimentacaoEstoque({
                                        produto_id: result.data.id,
                                        tipo_movimentacao: 'entrada',
                                        quantidade: productData.quantidade_estoque,
                                        valor_unitario: productData.preco_custo || null,
                                        valor_total: productData.preco_custo ? (productData.quantidade_estoque * productData.preco_custo) : null,
                                        documento: 'Estoque Inicial',
                                        fornecedor: productData.fornecedores || null,
                                        observacao: `Estoque inicial do produto ${productData.nome}`
                                    });
                                    
                                    console.log(`Movimentação de entrada inicial registrada: ${productData.quantidade_estoque} unidades`);
                                } catch (movError) {
                                    console.error('Erro ao registrar movimentação inicial:', movError);
                                    // Não falha o processo principal por causa da movimentação
                                }
                            }
                            
                            // NOVA PARTE: Pergunta sobre etiqueta
                            setTimeout(() => {
                                showEtiquetaPrompt(result.data);
                            }, 500); 
                            
                            resetForm();
                        } else {
                            throw new Error(result.error);
                        }
                    } else {
                        throw new Error('Função de salvamento não encontrada');
                    }
                }
                
            } catch (error) {
                console.error('Erro ao salvar produto:', error);
                showErrorMessage(`Erro ao salvar produto: ${error.message}`);
            } finally {
                setLoadingState(false);
            }
        });

        function setLoadingState(loading) {
            saveBtn.disabled = loading;
            btnText.classList.toggle('hidden', loading);
            btnSpinner.classList.toggle('hidden', !loading);
        }
    }

    // ===== VALIDAÇÃO COMPLETA DO FORMULÁRIO =====
    function validateForm() {
        let isValid = true;
        const errors = [];

        // Nome do produto
        const nomeProduto = document.getElementById('nome-produto').value.trim();
        if (!nomeProduto) {
            errors.push('Nome do produto é obrigatório');
            isValid = false;
        }

        // Preço de venda
        const precoVenda = parseFloat(document.getElementById('preco-venda').value);
        if (!precoVenda || precoVenda <= 0) {
            errors.push('Preço de venda deve ser maior que zero');
            isValid = false;
        }

        // Código SKU ou código de barras (pelo menos um deve estar preenchido)
        const codigoSKU = document.getElementById('codigo-sku').value.trim();
        const codigoBarras = document.getElementById('codigo-barras').value.trim();
        if (!codigoSKU && !codigoBarras) {
            // Gerar códigos automaticamente se ambos estiverem vazios
            generateAutoCodes();
        }

        if (!isValid) {
            showErrorMessage('Corrija os seguintes erros:\n' + errors.join('\n'));
        }

        return isValid;
    }

    // ===== GERAÇÃO AUTOMÁTICA DE CÓDIGOS =====
    function generateAutoCodes() {
        const timestamp = Date.now().toString();
        const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
        
        // Gerar SKU se vazio
        const skuField = document.getElementById('codigo-sku');
        if (!skuField.value.trim()) {
            skuField.value = `SKU${timestamp.slice(-6)}${random}`;
        }
        
        // Gerar código de barras se vazio
        const barcodeField = document.getElementById('codigo-barras');
        if (!barcodeField.value.trim()) {
            barcodeField.value = `789${timestamp.slice(-7)}${random}`;
        }
    }

    // ===== COLETA DE DADOS DO FORMULÁRIO =====
    function collectFormData() {
        // Função auxiliar para pegar o texto selecionado de um select
        function getSelectedText(selectId) {
            const select = document.getElementById(selectId);
            if (!select || !select.value) return null;
            const selectedOption = select.options[select.selectedIndex];
            return selectedOption ? selectedOption.text : null;
        }

        return {
            // Informações gerais
            nome: document.getElementById('nome-produto').value.trim(),
            categoria: getSelectedText('categoria-produto'),
            marca: getSelectedText('marca'),
            colecao: getSelectedText('colecao'),
            fornecedores: getSelectedText('fornecedor'),
            tipo_unidade: document.getElementById('tipo-unidade').value,
            codigo_sku: document.getElementById('codigo-sku').value.trim(),
            codigo_barras: document.getElementById('codigo-barras').value.trim(),
            
            // Variações
            tamanho: document.getElementById('tamanho').value.trim() || null,
            cor: getSelectedText('cor'),
            material: getSelectedText('material'),
            modelo: document.getElementById('modelo').value.trim() || null,
            genero: document.getElementById('genero').value || null,
            observacoes: document.getElementById('observacoes').value.trim() || null,
            
            // Valores
            preco_custo: parseFloat(document.getElementById('preco-custo').value) || 0,
            markup: parseFloat(document.getElementById('markup').value) || 0,
            preco_venda: parseFloat(document.getElementById('preco-venda').value),
            
            // Estoque
            quantidade_estoque: parseInt(document.getElementById('quantidade-estoque').value) || 0,
            estoque_minimo: parseInt(document.getElementById('estoque-minimo').value) || 0,
            estoque_maximo: parseInt(document.getElementById('estoque-maximo').value) || 0,
            localizacao: getSelectedText('localizacao'),
            
            // Pesos e dimensões
            peso: parseFloat(document.getElementById('peso').value) || null,
            altura: parseFloat(document.getElementById('altura').value) || null,
            largura: parseFloat(document.getElementById('largura').value) || null,
            comprimento: parseFloat(document.getElementById('comprimento').value) || null,
            
            // Dados fiscais
            ncm: document.getElementById('ncm').value.trim() || null,
            cfop: document.getElementById('cfop').value.trim() || null,
            nf: document.getElementById('nf').value.trim() || null,
            serial: document.getElementById('serial').value.trim() || null,
            origem_produto: document.getElementById('origem-produto').value || null,
            csosn: document.getElementById('csosn').value || null,
            cst_pis_cofins: document.getElementById('cst-pis-cofins').value || null,
            cest: document.getElementById('cest').value.trim() || null,
            
            // Dados da empresa
            id_empresa: window.currentCompanyId,
            auth_user_id: window.currentUser.auth_user_id,
        };
    }

    // ===== RESET DO FORMULÁRIO =====
    function resetForm() {
        const form = document.getElementById('product-form');
        form.reset();
        
        // Limpar erros
        const errorFields = form.querySelectorAll('.error');
        errorFields.forEach(field => field.classList.remove('error'));
        
        const errorMessages = form.querySelectorAll('.field-error');
        errorMessages.forEach(msg => msg.remove());
        
        // Limpar markup
        document.getElementById('markup').style.color = '';
        
        // Reabilitar campo de quantidade para criação de novo produto
        const quantidadeField = document.getElementById('quantidade-estoque');
        quantidadeField.disabled = false;
        quantidadeField.style.backgroundColor = '';
        quantidadeField.style.color = '';
        quantidadeField.title = '';
        
        // Limpar ID de edição
        window.editingProductId = null;
        
        // Voltar para primeira aba
        document.querySelector('.tab-nav-item[data-tab="informacoes-gerais"]').click();
        
        // Limpar imagens se existir a função
        if (typeof clearImages === 'function') {
            clearImages();
        }
    }

    // ===== MENSAGENS DE FEEDBACK =====
    function showSuccessMessage(message) {
        showNotification(message, 'success');
    }

    function showErrorMessage(message) {
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

    // ===== EVENTOS GLOBAIS =====
    
    // Fechar modais com ESC
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const modal = document.querySelector('.modal.show');
            if (modal && typeof closeModal === 'function') {
                closeModal();
            }
        }
    });

    // Salvar rascunho automaticamente (a cada 30 segundos)
    let autoSaveTimeout;
    const formInputs = document.querySelectorAll('#product-form input, #product-form select, #product-form textarea');
    
    formInputs.forEach(input => {
        input.addEventListener('input', () => {
            clearTimeout(autoSaveTimeout);
            autoSaveTimeout = setTimeout(saveFormDraft, 30000); // 30 segundos
        });
    });

    function saveFormDraft() {
        try {
            const formData = collectFormData();
            localStorage.setItem('product-draft', JSON.stringify(formData));
            console.log('Rascunho salvo automaticamente');
        } catch (error) {
            console.error('Erro ao salvar rascunho:', error);
        }
    }

    // Carregar rascunho ao inicializar (se existir)
    function loadFormDraft() {
        try {
            const draft = localStorage.getItem('product-draft');
            if (draft) {
                const data = JSON.parse(draft);
                // Implementar carregamento dos dados do rascunho
                console.log('Rascunho encontrado:', data);
            }
        } catch (error) {
            console.error('Erro ao carregar rascunho:', error);
        }
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
        
        .input-field.error, .select-field.error {
            border-color: #ef4444;
            box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.2);
        }
    `;
    document.head.appendChild(style);
});

// ===== FUNÇÕES PARA MOVIMENTAÇÃO DE ESTOQUE =====

/**
 * Registra movimentação de estoque (entrada, saída, ajuste)
 * @param {Object} dados - Dados da movimentação
 */
async function registrarMovimentacaoEstoque(dados) {
    try {
        const { data, error } = await supabaseClient
            .from('estoque_movimentacoes')
            .insert([{
                produto_id: dados.produto_id,
                tipo_movimentacao: dados.tipo_movimentacao,
                quantidade: dados.quantidade,
                valor_unitario: dados.valor_unitario || null,
                valor_total: dados.valor_total || null,
                documento: dados.documento || null,
                fornecedor: dados.fornecedor || null,
                observacao: dados.observacao || null,
                auth_user_id: window.currentUser.auth_user_id,
                id_empresa: window.currentCompanyId
            }]);

        if (error) throw error;
        return { success: true, data };

    } catch (error) {
        console.error('Erro ao registrar movimentação:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Atualiza estoque do produto
 * @param {number} produtoId - ID do produto
 * @param {number} quantidadeAlterada - Quantidade a ser alterada (+ ou -)
 */
async function atualizarEstoqueProduto(produtoId, quantidadeAlterada) {
    try {
        // Busca estoque atual
        const { data: produto, error: selectError } = await supabaseClient
            .from('produtos')
            .select('quantidade_estoque')
            .eq('id', produtoId)
            .single();

        if (selectError) throw selectError;

        // Calcula novo estoque
        const novoEstoque = (produto.quantidade_estoque || 0) + quantidadeAlterada;

        // Atualiza estoque
        const { error: updateError } = await supabaseClient
            .from('produtos')
            .update({ quantidade_estoque: novoEstoque })
            .eq('id', produtoId);

        if (updateError) throw updateError;

        return { success: true, novoEstoque };

    } catch (error) {
        console.error('Erro ao atualizar estoque:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Verifica se há estoque suficiente para venda
 * @param {number} produtoId - ID do produto
 * @param {number} quantidadeDesejada - Quantidade que se quer vender
 */
async function verificarEstoqueDisponivel(produtoId, quantidadeDesejada) {
    try {
        const { data: produto, error } = await supabaseClient
            .from('produtos')
            .select('quantidade_estoque, nome')
            .eq('id', produtoId)
            .single();

        if (error) throw error;

        if (!produto) {
            throw new Error('Produto não encontrado');
        }

        const estoqueDisponivel = produto.quantidade_estoque || 0;

        if (estoqueDisponivel < quantidadeDesejada) {
            throw new Error(`Estoque insuficiente para ${produto.nome}. Disponível: ${estoqueDisponivel}, Solicitado: ${quantidadeDesejada}`);
        }

        return { success: true, estoqueDisponivel };

    } catch (error) {
        return { success: false, error: error.message };
    }
}

/**
 * Registra saída de estoque por venda
 * @param {Object} itemVenda - Item da venda
 * @param {number} vendaId - ID da venda
 */
async function registrarSaidaVenda(itemVenda, vendaId) {
    return await registrarMovimentacaoEstoque({
        produto_id: itemVenda.produto_id,
        tipo_movimentacao: 'saida',
        quantidade: -Math.abs(itemVenda.quantidade), // Sempre negativo para saída
        valor_unitario: itemVenda.preco_unitario,
        valor_total: itemVenda.quantidade * itemVenda.preco_unitario,
        documento: `Venda #${vendaId}`,
        observacao: `Venda - ${itemVenda.produto_nome || 'Produto'}`,
    });
}

/**
 * Processa venda completa com controle de estoque
 * @param {Object} dadosVenda - Dados da venda
 * @param {Array} itensVenda - Itens da venda
 */
async function processarVendaComEstoque(dadosVenda, itensVenda) {
    try {
        // 1. Verificar estoque de todos os itens ANTES de processar
        console.log('Verificando estoque de todos os itens...');
        for (let item of itensVenda) {
            const verificacao = await verificarEstoqueDisponivel(item.produto_id, item.quantidade);
            if (!verificacao.success) {
                throw new Error(verificacao.error);
            }
        }

        // 2. Se chegou aqui, tem estoque para todos os itens
        console.log('Estoque verificado. Processando venda...');

        // 3. Salvar venda principal (implementar conforme seu sistema)
        // const venda = await salvarVenda(dadosVenda);

        // 4. Para cada item vendido, registrar movimentação e atualizar estoque
        for (let item of itensVenda) {
            // Registrar saída na tabela de movimentações
            const movimentacao = await registrarSaidaVenda(item, dadosVenda.id || 0);
            if (!movimentacao.success) {
                throw new Error(`Erro ao registrar movimentação: ${movimentacao.error}`);
            }

            // Atualizar estoque do produto
            const atualizacao = await atualizarEstoqueProduto(item.produto_id, -item.quantidade);
            if (!atualizacao.success) {
                throw new Error(`Erro ao atualizar estoque: ${atualizacao.error}`);
            }

            console.log(`Item processado: ${item.produto_nome} - Novo estoque: ${atualizacao.novoEstoque}`);
        }

        return { success: true, message: 'Venda processada com sucesso!' };

    } catch (error) {
        console.error('Erro ao processar venda:', error);
        return { success: false, error: error.message };
    }
}

// Exportar funções globais para uso em outros arquivos
window.registrarMovimentacaoEstoque = registrarMovimentacaoEstoque;
window.atualizarEstoqueProduto = atualizarEstoqueProduto;
window.verificarEstoqueDisponivel = verificarEstoqueDisponivel;
window.registrarSaidaVenda = registrarSaidaVenda;
window.processarVendaComEstoque = processarVendaComEstoque;

// ===== PROMPT PARA GERAR ETIQUETA =====
// ===== PROMPT PARA GERAR ETIQUETA (VERSÃO CORRIGIDA) =====
function showEtiquetaPrompt(produto) {
    // Remove notificação existente se houver
    const existing = document.querySelector('.etiqueta-prompt');
    if (existing) {
        existing.remove();
    }

    // 🧠 PARTE INTELIGENTE: Detecta se existe mensagem de sucesso
    const successNotification = document.querySelector('.notification');
    const topPosition = successNotification ? '8rem' : '2rem';

    // Cria prompt de etiqueta
    const prompt = document.createElement('div');
    prompt.className = 'etiqueta-prompt';
    prompt.style.cssText = `
        position: fixed;
        top: ${topPosition};
        right: 2rem;
        background: white;
        border-radius: 12px;
        padding: 1.5rem;
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
        z-index: 1002;
        max-width: 350px;
        border-left: 4px solid #FF9800;
        animation: slideInRight 0.3s ease;
    `;
    
    prompt.innerHTML = `
        <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 1rem;">
            <i class="fas fa-tags" style="color: #FF9800; font-size: 1.2rem;"></i>
            <strong style="color: #1f2937;">Gerar Etiqueta</strong>
        </div>
        <p style="margin: 0 0 1rem 0; color: #4b5563; line-height: 1.4;">
            Deseja gerar etiqueta para o produto <strong>${produto.nome}</strong>?
        </p>
        <div style="display: flex; gap: 0.75rem; justify-content: flex-end;">
            <button onclick="closeEtiquetaPrompt()" 
                    style="background: #f3f4f6; color: #4b5563; border: none; padding: 0.5rem 1rem; border-radius: 6px; cursor: pointer; font-size: 0.875rem;">
                Não
            </button>
            <button onclick="openEtiquetaModalFromPrompt(${JSON.stringify(produto).replace(/"/g, '&quot;')})" 
                    style="background: #FF9800; color: white; border: none; padding: 0.5rem 1rem; border-radius: 6px; cursor: pointer; font-size: 0.875rem;">
                <i class="fas fa-print"></i> Sim
            </button>
        </div>
    `;

    document.body.appendChild(prompt);

    // Remove automaticamente após 20 segundos
    setTimeout(() => {
        if (prompt.parentNode) {
            prompt.remove();
        }
    }, 20000);
}

// Funções auxiliares para o prompt
window.closeEtiquetaPrompt = function() {
    const prompt = document.querySelector('.etiqueta-prompt');
    if (prompt) {
        prompt.remove();
    }
}

window.openEtiquetaModalFromPrompt = function(produto) {
    closeEtiquetaPrompt();
    
    // Chama função do modal de etiquetas (será criada)
    if (typeof openEtiquetasModal === 'function') {
        openEtiquetasModal([produto], 'single');
    } else {
        alert('Sistema de etiquetas ainda não implementado');
    }
}
// ===== SISTEMA FINANCEIRO - MODAIS E FORMULÁRIOS =====

// Estado do modal
let modalState = {
    currentType: 'receber',
    editingId: null,
    categorias: {
        RECEBER: [],
        PAGAR: []
    }
};

// ===== INICIALIZAÇÃO DO MODAL =====
document.addEventListener('DOMContentLoaded', () => {
    document.addEventListener('userDataReady', initializeModal);
});

function initializeModal() {
    setupModalEventListeners();
    loadCategorias();
}

function setupModalEventListeners() {
    // Modal principal
    const modal = document.getElementById('modal-movimentacao');
    const modalClose = document.getElementById('modal-close');
    const btnCancelar = document.getElementById('btn-cancelar');
    
    // Fechar modal
    [modalClose, btnCancelar].forEach(btn => {
        btn?.addEventListener('click', closeModal);
    });
    
    // Fechar ao clicar fora
    modal?.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeModal();
        }
    });
    
    // Abas do modal
    document.querySelectorAll('.modal-tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
            const tipo = e.target.closest('.modal-tab').dataset.tipo;
            switchModalTab(tipo);
        });
    });
    
    // Formulário
    const form = document.getElementById('form-movimentacao');
    form?.addEventListener('submit', handleFormSubmit);
    
    // Checkbox de recorrência
    const checkboxRecorrente = document.getElementById('recorrente');
    checkboxRecorrente?.addEventListener('change', toggleRecorrencia);
    
    // Frequência de recorrência - atualizar info
    const selectFrequencia = document.getElementById('frequencia-recorrencia');
    selectFrequencia?.addEventListener('change', updateFrequenciaInfo);
    
    // Quantidade de meses - atualizar info
    const inputQuantidadeMeses = document.getElementById('quantidade-meses');
    inputQuantidadeMeses?.addEventListener('input', updateFrequenciaInfo);
    
    // Botões de categoria
    const btnAddCategoria = document.getElementById('btn-add-categoria');
    const btnDeleteCategoria = document.getElementById('btn-delete-categoria');
    
    btnAddCategoria?.addEventListener('click', openCategoriaModal);
    btnDeleteCategoria?.addEventListener('click', confirmDeleteCategoria);
    
    // Select de categoria - mostrar/esconder botão delete
    const selectCategoria = document.getElementById('categoria');
    selectCategoria?.addEventListener('change', toggleDeleteCategoriaButton);
    
    // Mini modal de categoria
    setupCategoriaModal();
}

// ===== ABRIR/FECHAR MODAL =====
function openModal(tipo = 'receber', editData = null) {
    const modal = document.getElementById('modal-movimentacao');
    
    modalState.currentType = tipo;
    modalState.editingId = editData?.id || null;
    
    // Configurar título
    const title = document.getElementById('modal-title');
    title.textContent = editData ? 'Editar Movimentação' : 'Nova Movimentação';
    
    // Ativar aba correta
    switchModalTab(tipo);
    
    // Preencher formulário se editando
    if (editData) {
        fillFormWithData(editData);
    } else {
        clearForm();
    }
    
    // Carregar categorias do tipo selecionado
    loadCategoriasByType(tipo.toUpperCase());
    
    // Mostrar modal
    modal.classList.add('show');
    document.body.style.overflow = 'hidden';
    
    // Focar no primeiro campo
    setTimeout(() => {
        document.getElementById('descricao')?.focus();
    }, 300);
}

function closeModal() {
    const modal = document.getElementById('modal-movimentacao');
    modal.classList.remove('show');
    document.body.style.overflow = '';
    
    // Limpar formulário
    clearForm();
    modalState.editingId = null;
}

function switchModalTab(tipo) {
    modalState.currentType = tipo;
    
    // Atualizar abas visuais
    document.querySelectorAll('.modal-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelector(`[data-tipo="${tipo}"]`).classList.add('active');
    
    // Carregar categorias do tipo
    loadCategoriasByType(tipo.toUpperCase());
    
    // Atualizar info do mini modal de categoria
    updateCategoriaModalInfo();
}

// ===== FORMULÁRIO =====
function clearForm() {
    const form = document.getElementById('form-movimentacao');
    form.reset();
    
    // Resetar checkbox customizado
    document.getElementById('recorrente').checked = false;
    document.getElementById('tipo-recorrencia-simples').style.display = 'none';
    
    // Resetar frequência para mensal e quantidade para 12 meses
    document.getElementById('frequencia-recorrencia').value = 'mensal';
    document.getElementById('quantidade-meses').value = '12';
    updateFrequenciaInfo();
    
    // Esconder botão de delete categoria
    toggleDeleteCategoriaButton();
}

function fillFormWithData(data) {
    document.getElementById('descricao').value = data.descricao || '';
    document.getElementById('valor').value = data.valor || '';
    document.getElementById('data_vencimento').value = data.data_vencimento || '';
    document.getElementById('categoria').value = data.categoria || '';
    document.getElementById('pessoa_empresa').value = data.pessoa_empresa || '';
    document.getElementById('documento').value = data.documento || '';
    document.getElementById('observacoes').value = data.observacoes || '';
    
    // Checkbox de recorrência
    const isRecorrente = data.recorrente || false;
    document.getElementById('recorrente').checked = isRecorrente;
    toggleRecorrencia({ target: { checked: isRecorrente } });
    
    if (isRecorrente && data.frequencia) {
        document.getElementById('frequencia-recorrencia').value = data.frequencia;
        if (data.quantidade_meses) {
            document.getElementById('quantidade-meses').value = data.quantidade_meses;
        }
        updateFrequenciaInfo();
    }
    
    toggleDeleteCategoriaButton();
}

async function handleFormSubmit(e) {
    e.preventDefault();
    
    if (!validateForm()) {
        return;
    }
    
    try {
        const formData = collectFormData();
        const btnSalvar = document.getElementById('btn-salvar');
        
        // Mostrar loading
        btnSalvar.disabled = true;
        btnSalvar.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';
        
        if (modalState.editingId) {
            // Atualizar movimentação existente
            await updateMovimentacao(modalState.editingId, formData);
            showNotification('Movimentação atualizada com sucesso!', 'success');
        } else {
            // Criar nova movimentação
            if (formData.recorrente) {
                await createRecurrentMovimentacoes(formData);
            } else {
                await saveMovimentacao(formData);
            }
            showNotification('Movimentação salva com sucesso!', 'success');
        }
        
        // Recarregar dados e atualizar interface (INCLUINDO barras)
        await recarregarDadosFinanceiros();
        
        closeModal();
        
    } catch (error) {
        console.error('Erro ao salvar movimentação:', error);
        showNotification('Erro ao salvar movimentação: ' + error.message, 'error');
    } finally {
        // Restaurar botão
        const btnSalvar = document.getElementById('btn-salvar');
        btnSalvar.disabled = false;
        btnSalvar.innerHTML = 'Salvar';
    }
}

function validateForm() {
    const descricao = document.getElementById('descricao').value.trim();
    const valor = parseFloat(document.getElementById('valor').value);
    const dataVencimento = document.getElementById('data_vencimento').value;
    const isRecorrente = document.getElementById('recorrente').checked;
    
    if (!descricao) {
        showNotification('Digite uma descrição', 'warning');
        document.getElementById('descricao').focus();
        return false;
    }
    
    if (!valor || valor <= 0) {
        showNotification('Digite um valor válido', 'warning');
        document.getElementById('valor').focus();
        return false;
    }
    
    if (!dataVencimento) {
        showNotification('Selecione a data de vencimento', 'warning');
        document.getElementById('data_vencimento').focus();
        return false;
    }
    
    // Validação específica para movimentação recorrente
    if (isRecorrente) {
        const quantidadeMeses = parseInt(document.getElementById('quantidade-meses').value);
        const frequencia = document.getElementById('frequencia-recorrencia').value;
        
        if (!quantidadeMeses || quantidadeMeses < 1) {
            showNotification('Digite uma quantidade de meses válida (mínimo 1)', 'warning');
            document.getElementById('quantidade-meses').focus();
            return false;
        }
        
        if (quantidadeMeses > 24) {
            showNotification('Quantidade máxima de meses é 24', 'warning');
            document.getElementById('quantidade-meses').focus();
            return false;
        }
        
        // Validar se a quantidade de meses é suficiente para a frequência escolhida
        const incrementosMeses = {
            'mensal': 1,
            'bimestral': 2,
            'trimestral': 3,
            'semestral': 6,
            'anual': 12
        };
        
        const incrementoMinimo = incrementosMeses[frequencia] || 1;
        if (quantidadeMeses < incrementoMinimo) {
            showNotification(`Para frequência ${frequencia}, a quantidade mínima é ${incrementoMinimo} meses`, 'warning');
            document.getElementById('quantidade-meses').focus();
            return false;
        }
    }
    
    return true;
}

function collectFormData() {
    const isRecorrente = document.getElementById('recorrente').checked;
    const dataVencimento = document.getElementById('data_vencimento').value;
    
    return {
        id_empresa: window.currentCompanyId,
        tipo: modalState.currentType.toUpperCase(),
        descricao: document.getElementById('descricao').value.trim(),
        valor: parseFloat(document.getElementById('valor').value),
        data_vencimento: dataVencimento,
        categoria: document.getElementById('categoria').value || null,
        pessoa_empresa: document.getElementById('pessoa_empresa').value.trim() || null,
        documento: document.getElementById('documento').value.trim() || null,
        observacoes: document.getElementById('observacoes').value.trim() || null,
        recorrente: isRecorrente,
        frequencia: isRecorrente ? document.getElementById('frequencia-recorrencia').value : null,
        quantidade_meses: isRecorrente ? parseInt(document.getElementById('quantidade-meses').value) || 12 : null,
        status: 'PENDENTE'
    };
}

// ===== RECORRÊNCIA =====
function toggleRecorrencia(e) {
    const isChecked = e.target.checked;
    const tipoRecorrencia = document.getElementById('tipo-recorrencia-simples');
    
    if (isChecked) {
        tipoRecorrencia.style.display = 'block';
        updateFrequenciaInfo();
    } else {
        tipoRecorrencia.style.display = 'none';
    }
}

function updateFrequenciaInfo() {
    const frequencia = document.getElementById('frequencia-recorrencia').value;
    const quantidadeMeses = parseInt(document.getElementById('quantidade-meses').value) || 12;
    const infoElement = document.getElementById('frequencia-info');
    
    // Calcular quantos lançamentos serão criados baseado na frequência
    const incrementos = {
        'mensal': 1,
        'bimestral': 2,
        'trimestral': 3,
        'semestral': 6,
        'anual': 12
    };
    
    const incrementoMeses = incrementos[frequencia] || 1;
    const totalLancamentos = Math.floor(quantidadeMeses / incrementoMeses);
    
    // Validar se a quantidade de meses é válida para a frequência escolhida
    if (quantidadeMeses < incrementoMeses) {
        infoElement.textContent = `Quantidade mínima para ${frequencia}: ${incrementoMeses} meses`;
        infoElement.style.color = '#e74c3c';
    } else {
        const mesesTexto = quantidadeMeses === 1 ? 'mês' : 'meses';
        const lancamentosTexto = totalLancamentos === 1 ? 'lançamento' : 'lançamentos';
        infoElement.textContent = `Será criado automaticamente nos próximos ${quantidadeMeses} ${mesesTexto} (${totalLancamentos} ${lancamentosTexto})`;
        infoElement.style.color = '#666';
    }
}

async function createRecurrentMovimentacoes(baseData) {
    const frequencia = baseData.frequencia;
    const quantidadeMeses = parseInt(baseData.quantidade_meses) || 12;
    const dataInicial = new Date(baseData.data_vencimento);
    const movimentacoes = [];
    
    // Calcular incremento baseado na frequência
    const incrementosMeses = {
        'mensal': 1,
        'bimestral': 2,
        'trimestral': 3,
        'semestral': 6,
        'anual': 12
    };
    
    const incrementoMeses = incrementosMeses[frequencia] || 1;
    const totalLancamentos = Math.floor(quantidadeMeses / incrementoMeses);
    
    // Validar se a quantidade de meses é suficiente para a frequência
    if (quantidadeMeses < incrementoMeses) {
        showNotification(`Quantidade mínima para ${frequencia}: ${incrementoMeses} meses`, 'error');
        return;
    }
    
    for (let i = 0; i < totalLancamentos; i++) {
        const novaData = new Date(dataInicial);
        novaData.setMonth(novaData.getMonth() + (i * incrementoMeses));
        
        const movimentacao = {
            ...baseData,
            data_vencimento: novaData.toISOString().split('T')[0]
        };
        
        movimentacoes.push(movimentacao);
    }
    
    // Salvar todas as movimentações
    for (const mov of movimentacoes) {
        await saveMovimentacao(mov);
    }
    
    showNotification(`${movimentacoes.length} movimentações recorrentes criadas!`, 'success');
}

// ===== GERENCIAMENTO DE CATEGORIAS =====
async function loadCategorias() {
    try {
        // Carregar categorias de receber
        const categoriasReceber = await loadCategoriasFromDB('RECEBER');
        modalState.categorias.RECEBER = categoriasReceber;
        
        // Carregar categorias de pagar
        const categoriasPagar = await loadCategoriasFromDB('PAGAR');
        modalState.categorias.PAGAR = categoriasPagar;
        
        console.log('Categorias carregadas:', modalState.categorias);
        
    } catch (error) {
        console.error('Erro ao carregar categorias:', error);
        modalState.categorias = { RECEBER: [], PAGAR: [] };
    }
}

function loadCategoriasByType(tipo) {
    const select = document.getElementById('categoria');
    const categorias = modalState.categorias[tipo] || [];
    
    // Limpar opções existentes
    select.innerHTML = '<option value="">Selecione uma categoria</option>';
    
    // Adicionar categorias
    categorias.forEach(categoria => {
        const option = document.createElement('option');
        option.value = categoria.nome;
        option.textContent = categoria.nome;
        option.dataset.id = categoria.id;
        select.appendChild(option);
    });
    
    // Atualizar botão de delete
    toggleDeleteCategoriaButton();
}

function toggleDeleteCategoriaButton() {
    const select = document.getElementById('categoria');
    const btnDelete = document.getElementById('btn-delete-categoria');
    const container = document.querySelector('.categoria-input-container');
    
    if (select.value && select.value !== '') {
        btnDelete.style.display = 'flex';
        container.classList.add('has-delete');
    } else {
        btnDelete.style.display = 'none';
        container.classList.remove('has-delete');
    }
}

// ===== MINI MODAL DE CATEGORIA =====
function setupCategoriaModal() {
    const miniModal = document.getElementById('mini-modal-categoria');
    const miniModalClose = document.getElementById('mini-modal-close');
    const btnCancelarCategoria = document.getElementById('btn-cancelar-categoria');
    const btnSalvarCategoria = document.getElementById('btn-salvar-categoria');
    
    // Fechar mini modal
    [miniModalClose, btnCancelarCategoria].forEach(btn => {
        btn?.addEventListener('click', closeCategoriaModal);
    });
    
    // Fechar ao clicar fora
    miniModal?.addEventListener('click', (e) => {
        if (e.target === miniModal) {
            closeCategoriaModal();
        }
    });
    
    // Salvar categoria
    btnSalvarCategoria?.addEventListener('click', handleSaveCategoria);
    
    // Enter no campo nome
    document.getElementById('nova-categoria-nome')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            handleSaveCategoria();
        }
    });
    
    // Setup do modal de delete
    setupDeleteCategoriaModal();
}

function openCategoriaModal() {
    const miniModal = document.getElementById('mini-modal-categoria');
    const input = document.getElementById('nova-categoria-nome');
    
    // Limpar campo
    input.value = '';
    
    // Configurar tipo
    updateCategoriaModalInfo();
    
    // Mostrar modal
    miniModal.classList.add('show');
    
    // Focar no campo
    setTimeout(() => input.focus(), 300);
}

function closeCategoriaModal() {
    const miniModal = document.getElementById('mini-modal-categoria');
    miniModal.classList.remove('show');
}

function updateCategoriaModalInfo() {
    const tipo = modalState.currentType.toUpperCase();
    const tipoTexto = tipo === 'RECEBER' ? 'A Receber' : 'A Pagar';
    
    document.getElementById('nova-categoria-tipo').value = tipo;
    document.getElementById('tipo-atual').textContent = tipoTexto;
}

async function handleSaveCategoria() {
    const nome = document.getElementById('nova-categoria-nome').value.trim();
    const tipo = modalState.currentType.toUpperCase();
    
    if (!nome) {
        showNotification('Digite o nome da categoria', 'warning');
        return;
    }
    
    try {
        const btnSalvar = document.getElementById('btn-salvar-categoria');
        btnSalvar.disabled = true;
        btnSalvar.textContent = 'Criando...';
        
        // Verificar se já existe
        const existe = await categoriaExiste(nome, tipo);
        if (existe) {
            showNotification('Já existe uma categoria com este nome', 'warning');
            return;
        }
        
        // Salvar no banco
        const categoria = await saveCategoria({ nome, tipo });
        
        // Adicionar ao estado local
        modalState.categorias[tipo].push(categoria);
        
        // Recarregar select
        loadCategoriasByType(tipo);
        
        // Selecionar a nova categoria
        document.getElementById('categoria').value = nome;
        toggleDeleteCategoriaButton();
        
        closeCategoriaModal();
        showNotification('Categoria criada com sucesso!', 'success');
        
    } catch (error) {
        console.error('Erro ao criar categoria:', error);
        showNotification('Erro ao criar categoria: ' + error.message, 'error');
    } finally {
        const btnSalvar = document.getElementById('btn-salvar-categoria');
        btnSalvar.disabled = false;
        btnSalvar.textContent = 'Criar';
    }
}

// ===== DELETE CATEGORIA =====
function setupDeleteCategoriaModal() {
    const deleteModal = document.getElementById('mini-modal-delete-categoria');
    const deleteModalClose = document.getElementById('mini-modal-delete-close');
    const btnCancelarDelete = document.getElementById('btn-cancelar-delete-categoria');
    const btnConfirmarDelete = document.getElementById('btn-confirmar-delete-categoria');
    
    // Fechar modal de delete
    [deleteModalClose, btnCancelarDelete].forEach(btn => {
        btn?.addEventListener('click', closeDeleteCategoriaModal);
    });
    
    // Fechar ao clicar fora
    deleteModal?.addEventListener('click', (e) => {
        if (e.target === deleteModal) {
            closeDeleteCategoriaModal();
        }
    });
    
    // Confirmar delete
    btnConfirmarDelete?.addEventListener('click', handleDeleteCategoria);
}

function confirmDeleteCategoria() {
    const select = document.getElementById('categoria');
    const categoriaNome = select.value;
    
    if (!categoriaNome) {
        showNotification('Selecione uma categoria para excluir', 'warning');
        return;
    }
    
    // Mostrar nome no modal de confirmação
    document.getElementById('categoria-nome-delete').textContent = categoriaNome;
    
    // Mostrar modal
    document.getElementById('mini-modal-delete-categoria').classList.add('show');
}

function closeDeleteCategoriaModal() {
    document.getElementById('mini-modal-delete-categoria').classList.remove('show');
}

async function handleDeleteCategoria() {
    const select = document.getElementById('categoria');
    const categoriaNome = select.value;
    const option = select.querySelector(`option[value="${categoriaNome}"]`);
    const categoriaId = option?.dataset.id;
    
    if (!categoriaId) {
        showNotification('Erro: ID da categoria não encontrado', 'error');
        return;
    }
    
    try {
        const btnConfirmar = document.getElementById('btn-confirmar-delete-categoria');
        btnConfirmar.disabled = true;
        btnConfirmar.textContent = 'Excluindo...';
        
        // Verificar se está sendo usada
        const emUso = await categoriaEstaEmUso(categoriaNome);
        if (emUso) {
            showNotification('Esta categoria não pode ser excluída pois está sendo usada em movimentações', 'warning');
            return;
        }
        
        // Deletar do banco
        await deleteCategoria(parseInt(categoriaId));
        
        // Remover do estado local
        const tipo = modalState.currentType.toUpperCase();
        modalState.categorias[tipo] = modalState.categorias[tipo].filter(
            cat => cat.id !== parseInt(categoriaId)
        );
        
        // Recarregar select
        loadCategoriasByType(tipo);
        
        closeDeleteCategoriaModal();
        showNotification('Categoria excluída com sucesso!', 'success');
        
    } catch (error) {
        console.error('Erro ao excluir categoria:', error);
        showNotification('Erro ao excluir categoria: ' + error.message, 'error');
    } finally {
        const btnConfirmar = document.getElementById('btn-confirmar-delete-categoria');
        btnConfirmar.disabled = false;
        btnConfirmar.textContent = 'Excluir';
    }
}

// ===== FUNÇÕES UTILITÁRIAS =====
function showNotification(message, type) {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    
    const colors = {
        success: '#1dd1a1',
        error: '#ff6b6b',
        warning: '#fdcb6e',
        info: '#74b9ff'
    };
    
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
    
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${colors[type]};
        color: white;
        padding: 15px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 15px rgba(0,0,0,0.2);
        z-index: 10001;
        display: flex;
        align-items: center;
        gap: 10px;
        font-weight: 500;
        max-width: 400px;
        animation: slideInRight 0.3s ease-out;
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

// Adicionar CSS de animação se não existir
if (!document.querySelector('#slideInRightKeyframes')) {
    const style = document.createElement('style');
    style.id = 'slideInRightKeyframes';
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
    `;
    document.head.appendChild(style);
}

console.log('Módulo de modal do financeiro carregado!');
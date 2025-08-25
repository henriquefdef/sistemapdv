// ===== SISTEMA FINANCEIRO - INTERAÇÕES SIMPLIFICADO =====

// ===== CONFIGURAÇÃO DE EVENTOS SIMPLES =====
function setupEventListeners() {
    console.log('Configurando eventos...');
    
    // Navegação de ano
    document.getElementById('prev-year')?.addEventListener('click', () => changeYear(-1));
    document.getElementById('next-year')?.addEventListener('click', () => changeYear(1));

    // Navegação de meses - MÉTODO PERSISTENTE
    const setupMonthEvents = () => {
        const buttons = document.querySelectorAll('.month-btn');
        console.log('Configurando', buttons.length, 'botões de mês');
        
        buttons.forEach((btn, i) => {
            const month = parseInt(btn.dataset.month);
            
            // NÃO remover eventos existentes - só adicionar se não existe
            if (!btn.hasMonthEvent) {
                const handler = function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('CLIQUE MÊS:', month);
                    selectMonth(month);
                };
                
                // Adicionar evento persistente
                btn.addEventListener('click', handler);
                btn.hasMonthEvent = true; // Flag para não duplicar
                
                console.log(`Mês ${month} (${btn.textContent}) configurado PERSISTENTE`);
            }
        });
    };
    
    // Configurar eventos
    setTimeout(setupMonthEvents, 100);
    setTimeout(setupMonthEvents, 500);

    // Abas de filtro
    document.querySelectorAll('.filter-tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
            const category = e.currentTarget.dataset.category;
            selectCategory(category);
        });
    });

    // Botões de ação
    document.getElementById('btn-adicionar')?.addEventListener('click', () => openModal('receber'));
    document.getElementById('btn-remover')?.addEventListener('click', removeSelected);
    document.getElementById('btn-marcar-pago')?.addEventListener('click', marcarComoPago);

    // Paginação
    document.getElementById('btn-anterior')?.addEventListener('click', () => changePage(-1));
    document.getElementById('btn-proximo')?.addEventListener('click', () => changePage(1));

    // Checkbox de seleção geral
    document.getElementById('select-all-checkbox')?.addEventListener('change', handleSelectAll);

    // Clique na linha da tabela
    document.addEventListener('click', (e) => {
        const row = e.target.closest('.table-row');
        if (row && !e.target.classList.contains('row-checkbox')) {
            toggleRowSelection(row);
        }
    });

    // Seleção de itens
    document.addEventListener('change', (e) => {
        if (e.target.classList.contains('row-checkbox')) {
            handleItemSelection(e.target);
        }
    });
}

// ===== RENDERIZAÇÃO SIMPLIFICADA =====
function renderMovimentacoes() {
    const tableBody = document.getElementById('table-body');
    if (!tableBody) return;
    
    const startIndex = (state.currentPage - 1) * state.itemsPerPage;
    const endIndex = startIndex + state.itemsPerPage;
    const pageItems = state.filteredMovimentacoes.slice(startIndex, endIndex);

    if (pageItems.length === 0) {
        tableBody.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-inbox"></i>
                <p>Nenhuma movimentação encontrada para este período</p>
            </div>
        `;
        return;
    }

    tableBody.innerHTML = pageItems.map(mov => `
        <div class="table-row ${state.selectedItems.has(mov.id) ? 'selected' : ''}" data-id="${mov.id}">
            <div class="row-date">
                <input type="checkbox" class="row-checkbox" data-id="${mov.id}" ${state.selectedItems.has(mov.id) ? 'checked' : ''}>
                ${mov.vencimento}
            </div>
            <div class="row-description">${mov.descricao}</div>
            <div class="row-value ${mov.tipo.toLowerCase() === 'receber' ? 'receita' : 'despesa'}">
                ${formatCurrency(mov.valor)}
            </div>
            <div class="row-person">${mov.recebido_de}</div>
            <div class="row-category">${mov.categoria}</div>
            <div class="row-status">
                <span class="status-indicator ${mov.pago ? 'pago' : isVencido(mov.vencimento) ? 'vencido' : 'pendente'}" 
                      title="${mov.pago ? 'Pago' : isVencido(mov.vencimento) ? 'Vencido' : 'Pendente'}"></span>
            </div>
        </div>
    `).join('');
    
    // Atualizar o estado do checkbox de seleção geral
    updateSelectAllCheckbox();
}

function updatePagination() {
    const totalPages = Math.ceil(state.filteredMovimentacoes.length / state.itemsPerPage);
    const startItem = (state.currentPage - 1) * state.itemsPerPage + 1;
    const endItem = Math.min(state.currentPage * state.itemsPerPage, state.filteredMovimentacoes.length);
    
    const paginationInfo = document.querySelector('.pagination-info');
    if (paginationInfo) {
        paginationInfo.textContent = `Mostrando ${startItem} até ${endItem} de ${state.filteredMovimentacoes.length} registros`;
    }
    
    const btnAnterior = document.getElementById('btn-anterior');
    const btnProximo = document.getElementById('btn-proximo');
    
    if (btnAnterior) btnAnterior.disabled = state.currentPage === 1;
    if (btnProximo) btnProximo.disabled = state.currentPage >= totalPages;
}

function changePage(direction) {
    const totalPages = Math.ceil(state.filteredMovimentacoes.length / state.itemsPerPage);
    const newPage = state.currentPage + direction;
    
    if (newPage >= 1 && newPage <= totalPages) {
        state.currentPage = newPage;
        renderMovimentacoes();
        updatePagination();
    }
}

// ===== SELEÇÃO DE ITENS =====
function toggleRowSelection(row) {
    const id = parseInt(row.dataset.id);
    const checkbox = row.querySelector('.row-checkbox');
    
    if (state.selectedItems.has(id)) {
        state.selectedItems.delete(id);
        checkbox.checked = false;
        row.classList.remove('selected');
    } else {
        state.selectedItems.add(id);
        checkbox.checked = true;
        row.classList.add('selected');
    }
    
    updateActionButtons();
}

function handleItemSelection(checkbox) {
    const id = parseInt(checkbox.dataset.id);
    const row = checkbox.closest('.table-row');
    
    if (checkbox.checked) {
        state.selectedItems.add(id);
        row.classList.add('selected');
    } else {
        state.selectedItems.delete(id);
        row.classList.remove('selected');
    }
    
    updateActionButtons();
    updateSelectAllCheckbox();
}

// ===== SELEÇÃO GERAL =====
function handleSelectAll() {
    const selectAllCheckbox = document.getElementById('select-all-checkbox');
    const isChecked = selectAllCheckbox.checked;
    
    // Obter apenas os itens visíveis na página atual
    const startIndex = (state.currentPage - 1) * state.itemsPerPage;
    const endIndex = startIndex + state.itemsPerPage;
    const visibleItems = state.filteredMovimentacoes.slice(startIndex, endIndex);
    
    if (isChecked) {
        // Selecionar todos os itens visíveis
        visibleItems.forEach(item => {
            state.selectedItems.add(item.id);
        });
    } else {
        // Desselecionar todos os itens visíveis
        visibleItems.forEach(item => {
            state.selectedItems.delete(item.id);
        });
    }
    
    // Atualizar a visualização
    renderMovimentacoes();
    updateActionButtons();
}

function updateSelectAllCheckbox() {
    const selectAllCheckbox = document.getElementById('select-all-checkbox');
    if (!selectAllCheckbox) return;
    
    // Obter apenas os itens visíveis na página atual
    const startIndex = (state.currentPage - 1) * state.itemsPerPage;
    const endIndex = startIndex + state.itemsPerPage;
    const visibleItems = state.filteredMovimentacoes.slice(startIndex, endIndex);
    
    if (visibleItems.length === 0) {
        selectAllCheckbox.checked = false;
        selectAllCheckbox.indeterminate = false;
        return;
    }
    
    const selectedVisibleItems = visibleItems.filter(item => state.selectedItems.has(item.id));
    
    if (selectedVisibleItems.length === 0) {
        selectAllCheckbox.checked = false;
        selectAllCheckbox.indeterminate = false;
    } else if (selectedVisibleItems.length === visibleItems.length) {
        selectAllCheckbox.checked = true;
        selectAllCheckbox.indeterminate = false;
    } else {
        selectAllCheckbox.checked = false;
        selectAllCheckbox.indeterminate = true;
    }
}

function updateActionButtons() {
    const hasSelection = state.selectedItems.size > 0;
    const removeBtn = document.getElementById('btn-remover');
    const pagoBtn = document.getElementById('btn-marcar-pago');
    
    if (removeBtn) {
        removeBtn.style.opacity = hasSelection ? '1' : '0.6';
        removeBtn.style.cursor = hasSelection ? 'pointer' : 'not-allowed';
    }
    
    if (pagoBtn) {
        pagoBtn.style.opacity = hasSelection ? '1' : '0.6';
        pagoBtn.style.cursor = hasSelection ? 'pointer' : 'not-allowed';
    }
}

// ===== AÇÕES =====
function removeSelected() {
    if (state.selectedItems.size === 0) {
        showNotification('Selecione pelo menos uma movimentação para remover', 'warning');
        return;
    }
    
    if (confirm(`Deseja realmente remover ${state.selectedItems.size} movimentação(ões)?`)) {
        const idsToRemove = Array.from(state.selectedItems);
        
        state.movimentacoes = state.movimentacoes.filter(mov => !idsToRemove.includes(mov.id));
        
        if (typeof deleteMovimentacao === 'function') {
            idsToRemove.forEach(id => {
                deleteMovimentacao(id);
            });
        }
        
        state.selectedItems.clear();
        recalcularTudo();
        updateActionButtons();
        showNotification('Movimentações removidas com sucesso!', 'success');
    }
}

function marcarComoPago() {
    if (state.selectedItems.size === 0) {
        showNotification('Selecione pelo menos uma movimentação para marcar como paga', 'warning');
        return;
    }
    
    const idsToUpdate = Array.from(state.selectedItems);
    state.movimentacoes.forEach(mov => {
        if (idsToUpdate.includes(mov.id)) {
            mov.pago = true;
            mov.status = 'PAGO'; // Corrigir: também atualizar o campo status
        }
    });
    
    if (typeof updateMovimentacaoStatus === 'function') {
        idsToUpdate.forEach(id => {
            updateMovimentacaoStatus(id, 'PAGO');
        });
    }
    
    state.selectedItems.clear();
    recalcularTudo();
    updateActionButtons();
    showNotification('Movimentações marcadas como pagas!', 'success');
}

// ===== RECARREGAR DADOS =====
async function recarregarDadosFinanceiros() {
    try {
        if (typeof loadMovimentacoesFromDB === 'function') {
            await loadMovimentacoesFromDB();
        }
        
        processChartData();
        updateChart();
        recalcularTudo();
        
        console.log('Dados financeiros recarregados com sucesso');
        
    } catch (error) {
        console.error('Erro ao recarregar dados:', error);
        setTimeout(() => {
            window.location.reload();
        }, 2000);
    }
}

// ===== RECURSOS AVANÇADOS =====
function setupAdvancedFeatures() {
    document.querySelectorAll('[title]').forEach(element => {
        element.addEventListener('mouseenter', showTooltip);
        element.addEventListener('mouseleave', hideTooltip);
    });
    
    document.addEventListener('keydown', handleKeyboardShortcuts);
}

function handleKeyboardShortcuts(e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        openModal('receber');
    }
    
    if (e.key === 'Escape') {
        closeModal();
    }
    
    if (e.key === 'Delete' && state.selectedItems.size > 0) {
        removeSelected();
    }
    
    if (e.key === 'Enter' && state.selectedItems.size > 0 && !document.querySelector('.modal-overlay.show')) {
        marcarComoPago();
    }
}

function showTooltip(e) {
    const tooltip = document.createElement('div');
    tooltip.className = 'custom-tooltip';
    tooltip.textContent = e.target.title;
    tooltip.style.cssText = `
        position: absolute;
        background: rgba(44, 62, 80, 0.9);
        color: white;
        padding: 8px 12px;
        border-radius: 6px;
        font-size: 12px;
        z-index: 10001;
        pointer-events: none;
        white-space: nowrap;
    `;
    
    document.body.appendChild(tooltip);
    e.target.addEventListener('mousemove', updateTooltipPosition);
    e.target.tooltipElement = tooltip;
}

function updateTooltipPosition(e) {
    const tooltip = e.target.tooltipElement;
    if (tooltip) {
        tooltip.style.left = e.pageX + 10 + 'px';
        tooltip.style.top = e.pageY - 30 + 'px';
    }
}

function hideTooltip(e) {
    if (e.target.tooltipElement) {
        document.body.removeChild(e.target.tooltipElement);
        e.target.removeEventListener('mousemove', updateTooltipPosition);
        delete e.target.tooltipElement;
    }
}

// ===== FUNÇÕES UTILITÁRIAS =====
function formatCurrency(value) {
    if (typeof value !== 'number') value = parseFloat(value) || 0;
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(value);
}

function formatDateBR(dateString) {
    const date = new Date(dateString + 'T00:00:00');
    return date.toLocaleDateString('pt-BR');
}

function isVencido(vencimento) {
    const [dia, mes, ano] = vencimento.split('/');
    const dataVencimento = new Date(parseInt(ano), parseInt(mes) - 1, parseInt(dia));
    return dataVencimento < new Date();
}

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
        z-index: 10000;
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

// ===== INICIALIZAÇÃO =====
function initializeFinanceiroBase() {
    console.log('Inicializando sistema financeiro base...');
    
    setTimeout(() => {
        setupEventListeners();
        console.log('Event listeners configurados');
        setTimeout(setupAdvancedFeatures, 1000);
    }, 500);
}

// Inicializar recursos básicos quando o documento estiver pronto
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(initializeFinanceiroBase, 1000);
});

console.log('Módulo principal do financeiro carregado!');

// ===== TESTE DIRETO NOS BOTÕES - VERSÃO PERSISTENTE =====
window.testDirectClick = function() {
    console.log('=== TESTE DIRETO PERSISTENTE ===');
    
    // Adicionar eventos diretos nos botões SEM REMOVER os existentes
    document.querySelectorAll('.month-btn').forEach((btn, i) => {
        const month = parseInt(btn.dataset.month);
        
        // SÓ adicionar se não tem o evento persistente
        if (!btn.hasDirectEvent) {
            const handler = function(e) {
                e.preventDefault();
                e.stopPropagation();
                console.log('CLIQUE DIRETO PERSISTENTE! Mês:', month);
                selectMonth(month);
            };
            
            btn.addEventListener('click', handler);
            btn.hasDirectEvent = true; // Flag para não duplicar
            
            console.log(`Botão ${i} (${btn.textContent}) configurado PERSISTENTE para mês ${month}`);
        } else {
            console.log(`Botão ${i} já tem evento persistente`);
        }
    });
    
    console.log('Teste PERSISTENTE configurado! Agora clique nos botões múltiplas vezes.');
};

// ===== FORÇA SELEÇÃO DIRETA =====
window.forceMonth = function(month) {
    console.log('=== FORÇANDO MÊS ===', month);
    
    // Forçar state
    state.currentMonth = month;
    
    // Chamar recalculo
    recalcularTudo();
    
    console.log('Mês forçado para:', month);
};

// ===== FUNÇÕES DE DEBUG SIMPLIFICADAS =====
window.debugSelectMonth = function(month) {
    console.log('=== DEBUG SELECT MONTH ===');
    selectMonth(month);
};

window.debugShowState = function() {
    console.log('=== DEBUG STATE ===');
    console.log('Ano:', state.currentYear);
    console.log('Mês:', state.currentMonth);
    console.log('Receitas:', formatCurrency(state.totalReceitas));
    console.log('Despesas:', formatCurrency(state.totalDespesas));
    console.log('Total:', formatCurrency(state.totaisPorCategoria.tudo));
};
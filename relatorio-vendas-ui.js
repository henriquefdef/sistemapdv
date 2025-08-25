// ===== RELATÓRIO DE VENDAS - INTERFACE E INTERAÇÕES =====

// ===== ANIMAÇÕES E EFEITOS VISUAIS =====
function animateStatCards() {
    const cards = document.querySelectorAll('.stat-card');
    cards.forEach((card, index) => {
        setTimeout(() => {
            card.style.opacity = '0';
            card.style.transform = 'translateY(20px)';
            card.style.transition = 'all 0.5s ease';
            
            setTimeout(() => {
                card.style.opacity = '1';
                card.style.transform = 'translateY(0)';
            }, 50);
        }, index * 100);
    });
}

function animateNumbers(elementId, targetValue, duration = 1000) {
    const element = document.getElementById(elementId);
    if (!element) return;
    
    const startValue = 0;
    const increment = targetValue / (duration / 16);
    let currentValue = startValue;
    
    const timer = setInterval(() => {
        currentValue += increment;
        
        if (currentValue >= targetValue) {
            currentValue = targetValue;
            clearInterval(timer);
        }
        
        // Formatar baseado no tipo
        if (elementId.includes('vendas') && !elementId.includes('total')) {
            element.textContent = Math.floor(currentValue).toLocaleString('pt-BR');
        } else if (elementId.includes('produtos')) {
            element.textContent = Math.floor(currentValue).toLocaleString('pt-BR');
        } else {
            element.textContent = formatCurrency(currentValue);
        }
    }, 16);
}

function highlightBestPerformance() {
    const changes = [
        { id: 'total-vendas-change', value: relatorioState.statistics.comparacao.totalVendas },
        { id: 'numero-vendas-change', value: relatorioState.statistics.comparacao.numeroVendas },
        { id: 'produtos-vendidos-change', value: relatorioState.statistics.comparacao.produtosVendidos }
    ];
    
    const bestChange = changes.reduce((max, current) => 
        current.value > max.value ? current : max
    );
    
    if (bestChange.value > 0) {
        const element = document.getElementById(bestChange.id);
        if (element) {
            element.style.animation = 'pulse 2s infinite';
        }
    }
}

// ===== TOOLTIPS INFORMATIVOS =====
function addTooltips() {
    const tooltips = [
        {
            selector: '#total-vendas',
            text: 'Soma total do valor de todas as vendas no período selecionado'
        },
        {
            selector: '#numero-vendas',
            text: 'Quantidade total de transações realizadas'
        },
        {
            selector: '#produtos-vendidos',
            text: 'Número total de produtos/itens vendidos'
        },
        {
            selector: '#descontos-concedidos',
            text: 'Valor total em descontos aplicados nas vendas'
        }
    ];
    
    tooltips.forEach(tooltip => {
        const element = document.querySelector(tooltip.selector);
        if (element) {
            element.title = tooltip.text;
            element.style.cursor = 'help';
        }
    });
}

// ===== DASHBOARD RESPONSIVO =====
function adjustLayoutForScreen() {
    const width = window.innerWidth;
    const statsGrid = document.querySelector('.stats-grid');
    const chartContainer = document.querySelector('.chart-container');
    
    if (width < 768) {
        // Mobile
        if (statsGrid) {
            statsGrid.style.gridTemplateColumns = '1fr';
        }
        if (chartContainer) {
            chartContainer.style.height = '300px';
        }
    } else if (width < 1200) {
        // Tablet
        if (statsGrid) {
            statsGrid.style.gridTemplateColumns = 'repeat(2, 1fr)';
        }
        if (chartContainer) {
            chartContainer.style.height = '350px';
        }
    } else {
        // Desktop
        if (statsGrid) {
            statsGrid.style.gridTemplateColumns = 'repeat(4, 1fr)';
        }
        if (chartContainer) {
            chartContainer.style.height = '400px';
        }
    }
}

// ===== FEEDBACK VISUAL =====
function showDataUpdate() {
    const header = document.querySelector('.relatorio-header');
    if (header) {
        header.style.position = 'relative';
        header.style.overflow = 'hidden';
        
        const pulse = document.createElement('div');
        pulse.style.cssText = `
            position: absolute;
            top: 0;
            left: -100%;
            width: 100%;
            height: 100%;
            background: linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent);
            animation: sweep 1.5s ease-in-out;
        `;
        
        header.appendChild(pulse);
        
        setTimeout(() => {
            if (pulse.parentNode) {
                pulse.parentNode.removeChild(pulse);
            }
        }, 1500);
    }
}

function showFilterActive() {
    const filtersSection = document.querySelector('.filters-section');
    const hasActiveFilters = Object.values(relatorioState.filters).some(filter => filter !== '');
    
    if (filtersSection) {
        if (hasActiveFilters) {
            filtersSection.style.borderLeft = '4px solid #FF9800';
            filtersSection.style.background = 'rgba(255, 152, 0, 0.05)';
        } else {
            filtersSection.style.borderLeft = 'none';
            filtersSection.style.background = '#ffffff';
        }
    }
}

// ===== INTERAÇÕES AVANÇADAS =====
function addCardInteractions() {
    const statCards = document.querySelectorAll('.stat-card');
    
    statCards.forEach(card => {
        card.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-8px) scale(1.02)';
            this.style.zIndex = '10';
        });
        
        card.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0) scale(1)';
            this.style.zIndex = '1';
        });
        
        card.addEventListener('click', function() {
            const cardType = this.querySelector('.stat-label').textContent.toLowerCase();
            showCardDetails(cardType);
        });
    });
}

function showCardDetails(cardType) {
    let details = '';
    const resumo = getResumoVendas();
    
    switch(cardType) {
        case 'total de vendas':
            details = `
                <strong>Detalhes de Vendas:</strong><br>
                • Ticket Médio: ${formatCurrency(resumo.ticketMedio)}<br>
                • Maior Venda: ${formatCurrency(resumo.maiorVenda)}<br>
                • Menor Venda: ${formatCurrency(resumo.menorVenda)}<br>
                • Total de Transações: ${resumo.totalTransacoes}
            `;
            break;
        case 'número de vendas':
            details = `
                <strong>Análise de Transações:</strong><br>
                • Total de Transações: ${resumo.totalTransacoes}<br>
                • Ticket Médio: ${formatCurrency(resumo.ticketMedio)}<br>
                • Forma Mais Usada: ${resumo.formaPagamentoMaisUsada}
            `;
            break;
        case 'produtos vendidos':
            details = `
                <strong>Produtos:</strong><br>
                • Total de Itens: ${relatorioState.statistics.produtosVendidos}<br>
                • Produto Mais Vendido: ${resumo.produtoMaisVendido}
            `;
            break;
        case 'descontos concedidos':
            const percentualDesconto = relatorioState.statistics.totalVendas > 0 ? 
                (relatorioState.statistics.descontosConcedidos / relatorioState.statistics.totalVendas * 100) : 0;
            details = `
                <strong>Análise de Descontos:</strong><br>
                • Total Concedido: ${formatCurrency(relatorioState.statistics.descontosConcedidos)}<br>
                • Percentual sobre Vendas: ${percentualDesconto.toFixed(1)}%
            `;
            break;
    }
    
    showDetailModal(details);
}

function showDetailModal(content) {
    // Remover modal existente
    const existingModal = document.querySelector('.detail-modal');
    if (existingModal) {
        existingModal.remove();
    }
    
    const modal = document.createElement('div');
    modal.className = 'detail-modal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(44, 62, 80, 0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
        animation: fadeIn 0.3s ease;
    `;
    
    modal.innerHTML = `
        <div style="
            background: white;
            padding: 30px;
            border-radius: 12px;
            max-width: 400px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.3);
            animation: slideUp 0.3s ease;
        ">
            <div style="margin-bottom: 20px; line-height: 1.6; color: #333;">
                ${content}
            </div>
            <button onclick="this.closest('.detail-modal').remove()" style="
                background: #FF9800;
                color: white;
                border: none;
                padding: 10px 20px;
                border-radius: 6px;
                cursor: pointer;
                font-weight: 500;
            ">Fechar</button>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Fechar ao clicar fora
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
}

// ===== ATALHOS DE TECLADO =====
function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        // Ctrl/Cmd + R - Atualizar dados
        if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
            e.preventDefault();
            refreshData();
            showNotification('Dados atualizados via teclado', 'info');
        }
        
        // Ctrl/Cmd + E - Exportar
        if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
            e.preventDefault();
            exportReport();
        }
        
        // Ctrl/Cmd + F - Toggle filtros
        if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
            e.preventDefault();
            toggleFilters();
        }
        
        // ESC - Fechar modais
        if (e.key === 'Escape') {
            const detailModal = document.querySelector('.detail-modal');
            if (detailModal) {
                detailModal.remove();
            }
        }
        
        // Números 1-4 - Selecionar período
        if (e.key >= '1' && e.key <= '4' && !e.ctrlKey && !e.metaKey) {
            const periods = ['7', '30', '90', '365'];
            const periodBtns = document.querySelectorAll('.period-btn');
            const targetBtn = Array.from(periodBtns).find(btn => btn.dataset.period === periods[parseInt(e.key) - 1]);
            if (targetBtn) {
                targetBtn.click();
                showNotification(`Período alterado para ${targetBtn.textContent}`, 'info');
            }
        }
    });
}

// ===== PERFORMANCE E DEBOUNCE =====
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

const debouncedResize = debounce(adjustLayoutForScreen, 250);

// ===== AUTO-REFRESH =====
let autoRefreshInterval = null;

function startAutoRefresh(minutes = 5) {
    stopAutoRefresh();
    autoRefreshInterval = setInterval(() => {
        refreshData();
        showNotification('Dados atualizados automaticamente', 'info');
    }, minutes * 60 * 1000);
}

function stopAutoRefresh() {
    if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
        autoRefreshInterval = null;
    }
}

// ===== TEMA ESCURO/CLARO =====
function toggleTheme() {
    const body = document.body;
    const isDark = body.classList.contains('dark-theme');
    
    if (isDark) {
        body.classList.remove('dark-theme');
        localStorage.setItem('relatorio-theme', 'light');
    } else {
        body.classList.add('dark-theme');
        localStorage.setItem('relatorio-theme', 'dark');
    }
}

function loadTheme() {
    const savedTheme = localStorage.getItem('relatorio-theme');
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-theme');
    }
}

// ===== INICIALIZAÇÃO DA UI =====
function initializeUI() {
    addTooltips();
    addCardInteractions();
    setupKeyboardShortcuts();
    loadTheme();
    
    // Event listeners para responsividade
    window.addEventListener('resize', debouncedResize);
    
    // Ajustar layout inicial
    adjustLayoutForScreen();
    
    // Auto-refresh opcional (desabilitado por padrão)
    // startAutoRefresh(5);
    
    console.log('UI do relatório inicializada');
}

// ===== CSS ANIMATIONS =====
function addCustomStyles() {
    const style = document.createElement('style');
    style.textContent = `
        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }
        
        @keyframes slideUp {
            from { transform: translateY(20px); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
        }
        
        @keyframes sweep {
            0% { left: -100%; }
            100% { left: 100%; }
        }
        
        @keyframes pulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.05); }
        }
        
        .stat-card {
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        
        .stat-card:hover {
            cursor: pointer;
        }
        
        .dark-theme {
            --bg-color: #1a1a1a;
            --surface-color: #2d2d2d;
            --text-primary: #ffffff;
            --text-secondary: #a0a0a0;
            --border-color: #404040;
        }
        
        .loading-shimmer {
            background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
            background-size: 200% 100%;
            animation: shimmer 1.5s infinite;
        }
        
        @keyframes shimmer {
            0% { background-position: -200% 0; }
            100% { background-position: 200% 0; }
        }
    `;
    
    document.head.appendChild(style);
}

// ===== INICIALIZAÇÃO AUTOMÁTICA =====
document.addEventListener('DOMContentLoaded', () => {
    addCustomStyles();
    
    // Aguardar um pouco para garantir que os outros scripts carregaram
    setTimeout(() => {
        initializeUI();
    }, 100);
});

// ===== EXPORTAR FUNÇÕES PARA USO GLOBAL =====
window.animateStatCards = animateStatCards;
window.animateNumbers = animateNumbers;
window.showDataUpdate = showDataUpdate;
window.showFilterActive = showFilterActive;
window.toggleTheme = toggleTheme;
window.startAutoRefresh = startAutoRefresh;
window.stopAutoRefresh = stopAutoRefresh;
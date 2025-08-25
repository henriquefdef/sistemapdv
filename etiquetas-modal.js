// ===== SISTEMA DE ETIQUETAS BÁSICO =====

window.etiquetasData = {
    products: [],
    isOpen: false
};

// ===== INICIALIZAÇÃO =====
document.addEventListener('DOMContentLoaded', () => {
    loadEtiquetasModal();
});

async function loadEtiquetasModal() {
    try {
        const response = await fetch('etiquetas-modal.html');
        const html = await response.text();
        
        let container = document.getElementById('etiquetas-modal-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'etiquetas-modal-container';
            document.body.appendChild(container);
        }
        
        container.innerHTML = html;
        setupModalEvents();
        console.log('Modal de etiquetas carregado ✓');
    } catch (error) {
        console.error('Erro ao carregar modal:', error);
    }
}

function setupModalEvents() {
    const modal = document.getElementById('etiquetas-modal');
    if (!modal) return;
    
    // Fechar modal clicando fora
    modal.addEventListener('click', (e) => {
        if (e.target.id === 'etiquetas-modal') {
            closeEtiquetasModal();
        }
    });
    
    // ESC para fechar
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && window.etiquetasData.isOpen) {
            closeEtiquetasModal();
        }
    });
    
    // Eventos dos campos
    setupFieldEvents();
}

function setupFieldEvents() {
    // Evento para mostrar/esconder parcelamento
    const precoField = document.getElementById('exibicao-preco');
    if (precoField) {
        precoField.addEventListener('change', toggleParcelamento);
    }
}

// ===== ABRIR/FECHAR MODAL =====
window.openEtiquetasModal = function(products) {
    window.etiquetasData.products = Array.isArray(products) ? products : [products];
    window.etiquetasData.isOpen = true;
    
    const modal = document.getElementById('etiquetas-modal');
    if (modal) {
        modal.classList.add('show');
        updateProductsList();
        resetFields();
        toggleParcelamento(); // Inicializar estado do parcelamento
    }
    
    console.log('Modal aberto para', window.etiquetasData.products.length, 'produto(s)');
}

window.closeEtiquetasModal = function() {
    const modal = document.getElementById('etiquetas-modal');
    if (modal) {
        modal.classList.remove('show');
        window.etiquetasData.isOpen = false;
    }
}

// ===== TOGGLE TIPO DE CÓDIGO =====
window.selectTipoCodigo = function(tipo) {
    // Atualizar botões visuais
    const buttons = document.querySelectorAll('.toggle-btn');
    buttons.forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.value === tipo) {
            btn.classList.add('active');
        }
    });
    
    // Atualizar input hidden
    const hiddenInput = document.getElementById('tipo-codigo');
    if (hiddenInput) {
        hiddenInput.value = tipo;
    }
    
    console.log('Tipo de código selecionado:', tipo);
}

// ===== TOGGLE PARCELAMENTO =====
function toggleParcelamento() {
    const precoField = document.getElementById('exibicao-preco');
    const parcelamentoDiv = document.getElementById('parcelamento-config');
    
    if (!precoField || !parcelamentoDiv) return;
    
    const valor = precoField.value;
    
    if (valor === 'parcelado' || valor === 'ambos') {
        parcelamentoDiv.classList.remove('hidden');
    } else {
        parcelamentoDiv.classList.add('hidden');
    }
}

// ===== ATUALIZAR LISTA DE PRODUTOS =====
function updateProductsList() {
    const container = document.getElementById('products-list');
    const countElement = document.getElementById('products-count');
    
    if (!container || !window.etiquetasData.products.length) return;
    
    const products = window.etiquetasData.products;
    
    container.innerHTML = products.map(product => `
        <div class="product-item">
            <div class="product-name">${product.nome}</div>
            <div class="product-details">
                <span>Código: ${product.codigo_barras || 'N/A'}</span>
                <span class="product-price">R$ ${formatPrice(product.preco_venda || 0)}</span>
            </div>
        </div>
    `).join('');
    
    if (countElement) {
        const text = products.length === 1 ? '1 produto selecionado' : `${products.length} produtos selecionados`;
        countElement.textContent = text;
    }
}

function resetFields() {
    // Resetar campos básicos
    const fields = [
        { id: 'modelo-etiqueta', value: '' },
        { id: 'mostrar-nome', value: 'sim' },
        { id: 'exibicao-preco', value: 'valor-total' },
        { id: 'parcelas', value: '10' },
        { id: 'percentual-juros', value: '' },
        { id: 'informacoes-adicionais', value: 'empresa' }
    ];
    
    fields.forEach(field => {
        const element = document.getElementById(field.id);
        if (element) {
            element.value = field.value;
        }
    });
    
    // Resetar tipo de código para barcode
    selectTipoCodigo('barcode');
}

// ===== COLETA DE DADOS =====
function coletarDados() {
    return {
        modelo: document.getElementById('modelo-etiqueta').value,
        tipoCodigo: document.getElementById('tipo-codigo').value,
        mostrarNome: document.getElementById('mostrar-nome').value,
        exibicaoPreco: document.getElementById('exibicao-preco').value,
        parcelas: parseInt(document.getElementById('parcelas').value) || 10,
        percentualJuros: parseFloat(document.getElementById('percentual-juros').value) || 0,
        informacoesAdicionais: document.getElementById('informacoes-adicionais').value,
        produtos: window.etiquetasData.products
    };
}

// ===== GERAR ETIQUETAS =====
window.gerarEtiquetas = function() {
    const modelo = document.getElementById('modelo-etiqueta').value;
    
    if (!modelo) {
        alert('Por favor, selecione um modelo de etiqueta');
        return;
    }
    
    const dadosCompletos = coletarDados();
    
    console.log('Dados completos das etiquetas:', dadosCompletos);
    
    // Chamar função de geração de etiquetas
    if (typeof generateEtiquetasVisuais === 'function') {
        generateEtiquetasVisuais(dadosCompletos);
    } else {
        alert('Sistema de geração de etiquetas não encontrado. Verifique se o arquivo etiquetas-gerar.js está carregado.');
    }
    
    closeEtiquetasModal();
}

// ===== UTILITÁRIOS =====
function formatPrice(price) {
    return parseFloat(price).toFixed(2).replace('.', ',');
}

console.log('Sistema completo de etiquetas carregado ✓');
// orcamento.js - Sistema Principal de Orçamentos
// ===================================================

// === ESTADO GLOBAL ===
let orcamento = {
    id: null,
    numero: null,
    cliente: null,
    items: [],
    desconto: { tipo: 'percent', valor: 0 },
    frete: 0,
    observacoes: '',
    totais: { subtotal: 0, desconto: 0, frete: 0, total: 0 }
};

let searchTimeout;

// === ELEMENTOS DOM ===
const elementos = {
    searchInput: document.getElementById('search-input'),
    productsContainer: document.getElementById('products-container'),
    clienteBtn: document.getElementById('cliente-btn'),
    carrinhoItems: document.getElementById('carrinho-items'),
    itemCount: document.getElementById('item-count'),
    descontoTipo: document.getElementById('desconto-tipo'),
    descontoInput: document.getElementById('desconto-input'),
    freteInput: document.getElementById('frete-input'),
    observacoes: document.getElementById('observacoes'),
    subtotal: document.getElementById('subtotal'),
    descontoTotal: document.getElementById('desconto-total'),
    freteTotal: document.getElementById('frete-total'),
    totalGeral: document.getElementById('total-geral'),
    salvarBtn: document.getElementById('salvar-btn'),
    pdfBtn: document.getElementById('pdf-btn'),

    clearBtn: document.getElementById('clear-btn'),
    newBtn: document.getElementById('new-btn'),
    listBtn: document.getElementById('list-btn'),
    clienteModal: document.getElementById('cliente-modal'),
    clienteSearch: document.getElementById('cliente-search'),
    clienteList: document.getElementById('cliente-list'),
    clienteDisplay: document.getElementById('cliente-display'),
    clienteNome: document.getElementById('cliente-nome'),
    clienteContato: document.getElementById('cliente-contato'),
    removeClienteBtn: document.getElementById('remove-cliente-btn'),
    orcamentoNumber: document.getElementById('orcamento-number'),
    orcamentoDate: document.getElementById('orcamento-date'),
    listaModal: document.getElementById('lista-modal'),
    orcamentosTabela: document.getElementById('orcamentos-tabela'),
    orcamentosSearch: document.getElementById('orcamentos-search')
};

// === UTILITÁRIOS ===
const utils = {
    formatCurrency: (value) => new Intl.NumberFormat('pt-BR', {
        style: 'currency', currency: 'BRL'
    }).format(value || 0),

    formatPhone: (phone) => {
        if (!phone) return '';
        const clean = phone.replace(/\D/g, '');
        if (clean.length === 11) return clean.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
        if (clean.length === 10) return clean.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
        return phone;
    },

    formatDate: (date) => {
        if (!date) return new Date().toLocaleDateString('pt-BR');
        return new Date(date).toLocaleDateString('pt-BR');
    },

    debounce: (func, wait) => {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    generateNumber: () => {
        const now = new Date();
        return `ORC${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}${now.getTime().toString().slice(-4)}`;
    },

    showNotification: (message, type = 'info') => {
        const colors = {
            success: '#10b981',
            error: '#ef4444', 
            warning: '#f59e0b',
            info: '#3b82f6'
        };

        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed; top: 1rem; right: 1rem; z-index: 9999;
            background: ${colors[type]}; color: white; 
            padding: 1rem 1.5rem; border-radius: 0.5rem;
            font-weight: 600; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
            transform: translateX(100%); transition: transform 0.3s ease;
        `;
        notification.textContent = message;
        document.body.appendChild(notification);
        
        setTimeout(() => notification.style.transform = 'translateX(0)', 100);
        setTimeout(() => {
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    },

    getProductImageUrl: (product) => {
        if (product.imagem_url && product.imagem_url.trim() && 
            (product.imagem_url.startsWith('http') || product.imagem_url.startsWith('data:'))) {
            return product.imagem_url;
        }
        
        const firstLetter = (product.nome && product.nome.length > 0) ? 
            product.nome.charAt(0).toUpperCase() : 'P';
        
        return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
            <svg width="50" height="50" viewBox="0 0 50 50" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect width="50" height="50" fill="#F3F4F6"/>
                <text x="25" y="32" font-family="Arial, sans-serif" font-size="18" font-weight="bold" 
                      text-anchor="middle" fill="#6B7280">${firstLetter}</text>
            </svg>
        `)}`;
    }
};

// === BUSCAR PRODUTOS ===
const buscarProdutos = utils.debounce(async (query) => {
    if (!query || query.length < 2) {
        elementos.productsContainer.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-search"></i>
                <h3>Buscar Produtos</h3>
                <p>Digite o nome ou código do produto para começar</p>
            </div>
        `;
        return;
    }

    try {
        elementos.productsContainer.innerHTML = '<div class="loading" style="margin: 2rem auto;"></div>';

        const produtos = await OrcamentoSupa.buscarProdutos(query);

        if (!produtos || produtos.length === 0) {
            elementos.productsContainer.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-box-open"></i>
                    <h3>Nenhum produto encontrado</h3>
                    <p>Tente uma busca diferente</p>
                </div>
            `;
            return;
        }

        elementos.productsContainer.innerHTML = produtos.map(produto => {
            const stock = produto.estoque_atual || 0;
            const stockClass = stock > 10 ? 'stock-ok' : stock > 0 ? 'stock-low' : '';
            const stockText = stock > 0 ? `${stock} em estoque` : '';
            const imageUrl = utils.getProductImageUrl(produto);

            return `
                <div class="product-card" onclick="adicionarProduto(${JSON.stringify(produto).replace(/"/g, '&quot;')})">
                    <img src="${imageUrl}" alt="${produto.nome}" class="product-image">
                    <div class="product-info">
                        <div class="product-name">${produto.nome}</div>
                        <div class="product-details">
                            <span>SKU: ${produto.codigo_sku || 'N/A'}</span>
                            ${stockText ? `<span class="product-stock ${stockClass}">${stockText}</span>` : ''}
                        </div>
                    </div>
                    <div class="product-price">${utils.formatCurrency(produto.preco_venda)}</div>
                </div>
            `;
        }).join('');

    } catch (error) {
        console.error('Erro ao buscar produtos:', error);
        utils.showNotification('Erro ao buscar produtos', 'error');
        elementos.productsContainer.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-triangle"></i>
                <h3>Erro na busca</h3>
                <p>Tente novamente</p>
            </div>
        `;
    }
}, 300);

// === ADICIONAR PRODUTO ===
function adicionarProduto(produto) {
    const existing = orcamento.items.find(item => item.id === produto.id);
    
    if (existing) {
        existing.quantidade += 1;
        existing.total = existing.quantidade * existing.preco_unitario;
    } else {
        orcamento.items.push({
            id: produto.id,
            nome: produto.nome,
            codigo_sku: produto.codigo_sku,
            codigo_barras: produto.codigo_barras || null,
            preco_unitario: parseFloat(produto.preco_venda) || 0,
            quantidade: 1,
            total: parseFloat(produto.preco_venda) || 0,
            preco_venda: parseFloat(produto.preco_venda) || 0,
            preco_custo: produto.preco_custo || 0,
            categoria: produto.categoria || '',
            fornecedor: produto.fornecedor || '',
            ativo: true
        });
    }
    
    // Limpar lista de busca e campo de input após adicionar produto
    elementos.searchInput.value = '';
    elementos.productsContainer.innerHTML = `
        <div class="empty-state">
            <i class="fas fa-search"></i>
            <h3>Buscar Produtos</h3>
            <p>Digite o nome ou código do produto para começar</p>
        </div>
    `;
    
    atualizarCarrinho();
    calcularTotais();
    utils.showNotification(`${produto.nome} adicionado!`, 'success');
}

// === REMOVER PRODUTO ===
function removerProduto(id) {
    orcamento.items = orcamento.items.filter(item => item.id !== id);
    atualizarCarrinho();
    calcularTotais();
}

// === ATUALIZAR QUANTIDADE ===
function atualizarQuantidade(id, quantidade) {
    const item = orcamento.items.find(item => item.id === id);
    if (item && quantidade > 0) {
        item.quantidade = quantidade;
        item.total = item.quantidade * item.preco_unitario;
        atualizarCarrinho();
        calcularTotais();
    } else if (quantidade <= 0) {
        removerProduto(id);
    }
}

// === ATUALIZAR CARRINHO ===
function atualizarCarrinho() {
    elementos.itemCount.textContent = orcamento.items.length;
    
    if (orcamento.items.length === 0) {
        elementos.carrinhoItems.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-shopping-cart"></i>
                <p>Nenhum item adicionado</p>
            </div>
        `;
    } else {
        elementos.carrinhoItems.innerHTML = orcamento.items.map(item => `
            <div class="carrinho-item">
                <div class="item-header">
                    <div class="qty-controls">
                        <button class="qty-btn" onclick="atualizarQuantidade(${item.id}, ${item.quantidade - 1})">
                            <i class="fas fa-minus"></i>
                        </button>
                        <input type="number" class="qty-input" value="${item.quantidade}" min="1"
                               onchange="atualizarQuantidade(${item.id}, parseInt(this.value))">
                        <button class="qty-btn" onclick="atualizarQuantidade(${item.id}, ${item.quantidade + 1})">
                            <i class="fas fa-plus"></i>
                        </button>
                    </div>
                    <div class="item-info">
                        <div class="item-nome">${item.nome}</div>
                        <div class="item-codigo">SKU: ${item.codigo_sku || 'N/A'}</div>
                    </div>
                    <div class="item-pricing">
                        <div class="item-preco-unit">${utils.formatCurrency(item.preco_unitario)} cada</div>
                        <div class="item-total">${utils.formatCurrency(item.total)}</div>
                    </div>
                    <button class="remove-btn" onclick="removerProduto(${item.id})">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </div>
        `).join('');
    }
    
    atualizarBotoes();
}

// === CALCULAR TOTAIS ===
function calcularTotais() {
    orcamento.totais.subtotal = orcamento.items.reduce((sum, item) => sum + item.total, 0);
    
    // Desconto
    if (orcamento.desconto.tipo === 'percent') {
        orcamento.totais.desconto = (orcamento.totais.subtotal * orcamento.desconto.valor) / 100;
    } else {
        orcamento.totais.desconto = orcamento.desconto.valor;
    }
    
    orcamento.totais.frete = orcamento.frete;
    orcamento.totais.total = Math.max(0, orcamento.totais.subtotal - orcamento.totais.desconto + orcamento.totais.frete);
    
    // Atualizar display
    elementos.subtotal.textContent = utils.formatCurrency(orcamento.totais.subtotal);
    elementos.descontoTotal.textContent = '- ' + utils.formatCurrency(orcamento.totais.desconto);
    elementos.freteTotal.textContent = utils.formatCurrency(orcamento.totais.frete);
    elementos.totalGeral.textContent = utils.formatCurrency(orcamento.totais.total);
}

// === ATUALIZAR BOTÕES ===
function atualizarBotoes() {
    const hasItems = orcamento.items.length > 0;
    elementos.salvarBtn.disabled = !hasItems;
    elementos.pdfBtn.disabled = !hasItems;
}

// === SELECIONAR CLIENTE ===
function selecionarCliente(cliente) {
    orcamento.cliente = cliente;
    elementos.clienteNome.textContent = cliente.nome;
    elementos.clienteContato.textContent = [
        cliente.telefone ? utils.formatPhone(cliente.telefone) : '',
        cliente.email || ''
    ].filter(Boolean).join(' • ');
    
    elementos.clienteDisplay.style.display = 'flex';
    elementos.clienteBtn.style.display = 'none';
    fecharModal('cliente-modal');
    utils.showNotification(`Cliente ${cliente.nome} selecionado`, 'success');
}

// === REMOVER CLIENTE ===
function removerCliente() {
    orcamento.cliente = null;
    elementos.clienteDisplay.style.display = 'none';
    elementos.clienteBtn.style.display = 'block';
    utils.showNotification('Cliente removido', 'success');
}

// === SALVAR ORÇAMENTO ===
async function salvarOrcamento() {
    if (orcamento.items.length === 0) {
        utils.showNotification('Adicione produtos antes de salvar', 'warning');
        return;
    }
    
    try {
        elementos.salvarBtn.innerHTML = '<div class="loading"></div> Salvando...';
        elementos.salvarBtn.disabled = true;
        
        const resultado = await OrcamentoSupa.salvar(orcamento);
        
        if (resultado.success) {
            orcamento.id = resultado.id;
            orcamento.numero = resultado.numero;
            elementos.orcamentoNumber.textContent = resultado.numero;
            utils.showNotification('Orçamento salvo com sucesso!', 'success');
        } else {
            throw new Error(resultado.error);
        }
        
    } catch (error) {
        console.error('Erro ao salvar:', error);
        utils.showNotification('Erro ao salvar orçamento', 'error');
    } finally {
        elementos.salvarBtn.innerHTML = '<i class="fas fa-save"></i> Salvar Orçamento';
        elementos.salvarBtn.disabled = false;
    }
}



// === LIMPAR ORÇAMENTO ===
function limparOrcamento() {
    if (orcamento.items.length === 0 && !orcamento.cliente) return;
    
    if (confirm('Limpar orçamento atual?')) {
        novoOrcamento();
        utils.showNotification('Orçamento limpo', 'success');
    }
}

// === NOVO ORÇAMENTO ===
function novoOrcamento() {
    orcamento = {
        id: null,
        numero: null,
        cliente: null,
        items: [],
        desconto: { tipo: 'percent', valor: 0 },
        frete: 0,
        observacoes: '',
        totais: { subtotal: 0, desconto: 0, frete: 0, total: 0 }
    };
    
    elementos.orcamentoNumber.textContent = 'Novo';
    elementos.orcamentoDate.textContent = utils.formatDate();
    elementos.clienteDisplay.style.display = 'none';
    elementos.clienteBtn.style.display = 'block';
    elementos.descontoInput.value = '';
    elementos.freteInput.value = '';
    elementos.observacoes.value = '';
    
    atualizarCarrinho();
    calcularTotais();
    atualizarBotoes();
}

// === CARREGAR ORÇAMENTO ===
async function carregarOrcamento(id) {
    try {
        const data = await OrcamentoSupa.buscarPorId(id);
        
        orcamento.id = data.id;
        orcamento.numero = data.numero;
        orcamento.items = JSON.parse(data.itens || '[]');
        orcamento.desconto = {
            tipo: data.desconto_tipo || 'percent',
            valor: data.desconto_valor || 0
        };
        orcamento.frete = data.frete || 0;
        orcamento.observacoes = data.observacoes || '';
        
        if (data.id_cliente) {
            orcamento.cliente = {
                id: data.id_cliente,
                nome: data.cliente_nome
            };
        }
        
        elementos.orcamentoNumber.textContent = data.numero;
        elementos.orcamentoDate.textContent = utils.formatDate(data.data_orcamento);
        elementos.descontoInput.value = orcamento.desconto.valor;
        elementos.freteInput.value = orcamento.frete;
        elementos.observacoes.value = orcamento.observacoes;
        
        if (orcamento.cliente) {
            elementos.clienteNome.textContent = orcamento.cliente.nome;
            elementos.clienteDisplay.style.display = 'flex';
            elementos.clienteBtn.style.display = 'none';
        }
        
        atualizarCarrinho();
        calcularTotais();
        atualizarBotoes();
        fecharModal('lista-modal');
        utils.showNotification('Orçamento carregado', 'success');
        
    } catch (error) {
        console.error('Erro ao carregar orçamento:', error);
        utils.showNotification('Erro ao carregar orçamento', 'error');
    }
}

// === DELETAR ORÇAMENTO ===
async function deletarOrcamento(id) {
    if (!confirm('Excluir este orçamento?')) return;
    
    try {
        await OrcamentoSupa.deletar(id);
        utils.showNotification('Orçamento excluído', 'success');
        listarOrcamentos();
    } catch (error) {
        console.error('Erro ao excluir:', error);
        utils.showNotification('Erro ao excluir orçamento', 'error');
    }
}

// === LISTAR ORÇAMENTOS ===
let todosOrcamentos = [];

async function listarOrcamentos() {
    try {
        abrirModal('lista-modal');
        elementos.orcamentosTabela.innerHTML = '<div class="loading" style="margin: 2rem auto;"></div>';
        
        const orcamentos = await OrcamentoSupa.listar();
        todosOrcamentos = orcamentos || [];
        
        if (!orcamentos || orcamentos.length === 0) {
            elementos.orcamentosTabela.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-file-invoice"></i>
                    <h3>Nenhum orçamento encontrado</h3>
                </div>
            `;
            return;
        }
        
        renderizarOrcamentos(orcamentos);
        
    } catch (error) {
        console.error('Erro ao listar orçamentos:', error);
        elementos.orcamentosTabela.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-triangle"></i>
                <h3>Erro ao carregar orçamentos</h3>
            </div>
        `;
    }
}

function renderizarOrcamentos(orcamentos) {
    elementos.orcamentosTabela.innerHTML = `
        <table class="data-table">
            <thead>
                <tr>
                    <th>Número</th>
                    <th>Cliente</th>
                    <th>Data</th>
                    <th>Total</th>
                    <th>Status</th>
                    <th>Ações</th>
                </tr>
            </thead>
            <tbody>
                ${orcamentos.map(orc => `
                    <tr>
                        <td><strong>${orc.numero}</strong></td>
                        <td>${orc.cliente_nome || 'Sem cliente'}</td>
                        <td>${utils.formatDate(orc.data_orcamento)}</td>
                        <td><strong>${utils.formatCurrency(orc.total)}</strong></td>
                        <td><span class="status-badge status-${orc.status}">${orc.status}</span></td>
                        <td class="table-acoes">
                            <button class="btn-sm btn-view" onclick="carregarOrcamento(${orc.id})" title="Carregar">
                                <i class="fas fa-eye"></i>
                            </button>
                            <button class="btn-sm btn-delete" onclick="deletarOrcamento(${orc.id})" title="Excluir">
                                <i class="fas fa-trash"></i>
                            </button>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

function filtrarOrcamentos(query) {
    if (!query.trim()) {
        renderizarOrcamentos(todosOrcamentos);
        return;
    }
    
    const queryLower = query.toLowerCase();
    const filtrados = todosOrcamentos.filter(orc => {
        return (
            orc.numero?.toLowerCase().includes(queryLower) ||
            orc.cliente_nome?.toLowerCase().includes(queryLower) ||
            utils.formatDate(orc.data_orcamento).includes(queryLower)
        );
    });
    
    if (filtrados.length === 0) {
        elementos.orcamentosTabela.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-search"></i>
                <h3>Nenhum orçamento encontrado</h3>
                <p>Tente buscar por outro termo</p>
            </div>
        `;
    } else {
        renderizarOrcamentos(filtrados);
    }
}

// === MODAIS ===
function abrirModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }
}

function fecharModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('hidden');
        document.body.style.overflow = '';
    }
}

// === EVENT LISTENERS ===
document.addEventListener('DOMContentLoaded', () => {
    // Busca de produtos
    elementos.searchInput?.addEventListener('input', (e) => {
        buscarProdutos(e.target.value.trim());
    });

// Desconto
elementos.descontoTipo?.addEventListener('click', () => {
   orcamento.desconto.tipo = orcamento.desconto.tipo === 'percent' ? 'value' : 'percent';
   elementos.descontoTipo.textContent = orcamento.desconto.tipo === 'percent' ? '%' : 'R$';
   calcularTotais();
});

    elementos.descontoInput?.addEventListener('input', (e) => {
        orcamento.desconto.valor = parseFloat(e.target.value) || 0;
        calcularTotais();
    });

    // Frete
    elementos.freteInput?.addEventListener('input', (e) => {
        orcamento.frete = parseFloat(e.target.value) || 0;
        calcularTotais();
    });

    // Observações
    elementos.observacoes?.addEventListener('input', (e) => {
        orcamento.observacoes = e.target.value;
    });

    // Busca de orçamentos
    elementos.orcamentosSearch?.addEventListener('input', (e) => {
        filtrarOrcamentos(e.target.value);
    });

    // Botões
    elementos.clienteBtn?.addEventListener('click', () => {
        abrirModal('cliente-modal');
        OrcamentoSupa.carregarClientes();
    });

    elementos.removeClienteBtn?.addEventListener('click', removerCliente);
    elementos.clearBtn?.addEventListener('click', limparOrcamento);
    elementos.newBtn?.addEventListener('click', novoOrcamento);
    elementos.salvarBtn?.addEventListener('click', salvarOrcamento);
    elementos.pdfBtn?.addEventListener('click', () => OrcamentoPDF.gerar(orcamento));
    elementos.listBtn?.addEventListener('click', listarOrcamentos);

    // Modais - fechar
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal-close')) {
            const modal = e.target.closest('.modal');
            if (modal) modal.classList.add('hidden');
            document.body.style.overflow = '';
        }
        
        if (e.target.classList.contains('modal')) {
            e.target.classList.add('hidden');
            document.body.style.overflow = '';
        }
    });

    // ESC para fechar modais
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const openModal = document.querySelector('.modal:not(.hidden)');
            if (openModal) {
                openModal.classList.add('hidden');
                document.body.style.overflow = '';
            }
        }
    });

    // Inicialização
    novoOrcamento();
});

// Aguardar dados do usuário
document.addEventListener('userDataReady', () => {
    novoOrcamento();
    console.log('Sistema de orçamentos inicializado');
});

// Funções globais
window.adicionarProduto = adicionarProduto;
window.removerProduto = removerProduto;
window.atualizarQuantidade = atualizarQuantidade;
window.selecionarCliente = selecionarCliente;
window.removerCliente = removerCliente;
window.carregarOrcamento = carregarOrcamento;
window.deletarOrcamento = deletarOrcamento;
// orcamento-fix.js - Correções para o Sistema de Orçamentos
// ========================================================

/**
 * Correções e melhorias para o sistema de orçamentos
 */

// === CORREÇÃO DE FUNÇÃO searchProducts ===
if (typeof searchProducts !== 'undefined') {
    // Sobrescrever função de busca para corrigir erro de imagem
    const originalSearchProducts = searchProducts;
    
    window.searchProducts = utils.debounce(async (query) => {
        if (!query || query.length < 2) {
            elements.productsContainer.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-search"></i>
                    <h3>Buscar Produtos</h3>
                    <p>Digite o nome ou código do produto para começar</p>
                </div>
            `;
            return;
        }

        try {
            elements.productsContainer.innerHTML = '<div class="loading" style="margin: 2rem auto;"></div>';

            // Usar supabaseClient global ou window
            const client = window.supabaseClient || supabaseClient;
            
            const { data, error } = await client
                .from('produtos')
                .select('*')
                .eq('id_empresa', window.currentCompanyId)
                .or(`nome.ilike.%${query}%,codigo_sku.ilike.%${query}%,codigo_barras.ilike.%${query}%`)
                .limit(20);

            if (error) throw error;

            if (!data || data.length === 0) {
                elements.productsContainer.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-box-open"></i>
                        <h3>Nenhum produto encontrado</h3>
                        <p>Tente uma busca diferente</p>
                    </div>
                `;
                return;
            }

            elements.productsContainer.innerHTML = data.map(product => {
                const stock = product.estoque_atual || 0;
                const stockClass = stock > 10 ? 'stock-ok' : stock > 0 ? 'stock-low' : 'stock-out';
                const stockText = stock > 0 ? `${stock} em estoque` : 'Sem estoque';
                
                // CORREÇÃO: Gerar URL de imagem segura
                const imageUrl = getProductImageUrl(product);

                return `
                    <div class="product-card" onclick="addProduct(${JSON.stringify(product).replace(/"/g, '&quot;')})">
                        <img src="${imageUrl}" 
                             alt="${product.nome}" 
                             class="product-image"
                             onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                        <div style="display:none; width:50px; height:50px; background:#F3F4F6; border-radius:4px; align-items:center; justify-content:center; color:#6B7280; font-weight:bold; font-size:18px;">
                            ${product.nome ? product.nome.charAt(0).toUpperCase() : 'P'}
                        </div>>
                        <div class="product-info">
                            <div class="product-name">${product.nome}</div>
                            <div class="product-details">
                                <span>SKU: ${product.codigo_sku || 'N/A'}</span>
                                <span class="product-stock ${stockClass}">${stockText}</span>
                            </div>
                        </div>
                        <div class="product-price">${utils.formatCurrency(product.preco_venda)}</div>
                    </div>
                `;
            }).join('');

        } catch (error) {
            console.error('Erro ao buscar produtos:', error);
            utils.showNotification('Erro ao buscar produtos', 'error');
            elements.productsContainer.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-exclamation-triangle"></i>
                    <h3>Erro na busca</h3>
                    <p>Tente novamente</p>
                </div>
            `;
        }
    }, 300);
}

/**
 * Gera URL de imagem segura para produto
 */
function getProductImageUrl(product) {
    // Verificar se tem imagem válida
    if (product.imagem_url && product.imagem_url.trim() && 
        (product.imagem_url.startsWith('http') || product.imagem_url.startsWith('data:'))) {
        return product.imagem_url;
    }
    
    // Gerar imagem placeholder SVG com primeira letra do produto
    const firstLetter = (product.nome && product.nome.length > 0) ? 
        product.nome.charAt(0).toUpperCase() : 'P';
    
    // SVG placeholder inline que NÃO fará requisição externa
    const svgPlaceholder = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
        <svg width="50" height="50" viewBox="0 0 50 50" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="50" height="50" fill="#F3F4F6"/>
            <text x="25" y="32" font-family="Arial, sans-serif" font-size="18" font-weight="bold" 
                  text-anchor="middle" fill="#6B7280">${firstLetter}</text>
        </svg>
    `)}`;
    
    return svgPlaceholder;
}

// === CORREÇÃO DA FUNÇÃO convertToSale ===
if (typeof convertToSale !== 'undefined') {
    // Backup da função original
    window.convertToSaleOriginal = convertToSale;
}

// Nova função que força o uso do modal
window.convertToSale = async function() {
    console.log('🔄 Iniciando conversão de orçamento...');
    
    // Verificar se há itens
    if (!orcamento.items || orcamento.items.length === 0) {
        utils.showNotification('Adicione produtos antes de converter', 'warning');
        return;
    }
    
    // Tentar usar o sistema de conversão com modal
    if (typeof convertToSaleWithModal === 'function') {
        console.log('✅ Usando conversão com modal');
        await convertToSaleWithModal();
    } else {
        console.warn('⚠️ Sistema de modal não disponível, usando fallback');
        // Fallback: conversão simples
        await convertToSaleSimple();
    }
};

/**
 * Conversão simples sem modal (fallback)
 */
async function convertToSaleSimple() {
    try {
        // Preparar dados da venda
        const saleData = {
            items: orcamento.items.map(item => ({
                id: item.id,
                nome: item.nome,
                codigo_sku: item.codigo_sku,
                preco_venda: item.preco_unitario,
                quantity: item.quantidade,
                discount: { type: 'none', value: 0 }
            })),
            customer: orcamento.cliente,
            totals: {
                subtotal: orcamento.totals.subtotal,
                totalDiscount: orcamento.totals.desconto,
                total: orcamento.totals.total
            },
            payment: {
                method: 'Dinheiro',
                totalAmount: orcamento.totals.total,
                amountReceived: orcamento.totals.total,
                change: 0
            },
            adjustments: {
                discount: orcamento.totals.desconto,
                surcharge: 0,
                freight: orcamento.totals.frete,
                freightPaidBy: 'cliente'
            },
            info: {
                seller: window.currentUser?.id,
                saleChannel: 'presencial',
                sourceType: 'orcamento',
                sourceId: orcamento.id
            },
            receipt: {
                method: 'none'
            }
        };
        
        // Salvar venda
        const result = await window.saveSaleToSupabase(saleData);
        
        if (result.success) {
            // Atualizar status do orçamento
            if (orcamento.id) {
                const client = window.supabaseClient || supabaseClient;
                await client
                    .from('orcamentos')
                    .update({ 
                        status: 'convertido',
                        data_conversao: new Date().toISOString()
                    })
                    .eq('id', orcamento.id);
            }
            
            utils.showNotification(`🎉 Venda #${result.saleNumber} realizada com sucesso!`, 'success');
            newOrcamento();
        } else {
            throw new Error(result.message || 'Erro ao converter orçamento');
        }
        
    } catch (error) {
        console.error('Erro na conversão simples:', error);
        utils.showNotification('Erro ao converter orçamento: ' + error.message, 'error');
    }
}

// === GARANTIR QUE SUPABASE ESTEJA DISPONÍVEL ===
function ensureSupabaseClient() {
    if (!window.supabaseClient) {
        // Tentar encontrar em diferentes locais
        if (typeof supabaseClient !== 'undefined') {
            window.supabaseClient = supabaseClient;
            console.log('✅ SupabaseClient encontrado e definido globalmente');
        } else if (typeof supabase !== 'undefined') {
            window.supabaseClient = supabase;
            console.log('✅ Supabase encontrado e definido como supabaseClient');
        } else {
            console.error('❌ Supabase não encontrado!');
            return false;
        }
    }
    return true;
}

// === OVERRIDE DO BOTÃO CONVERTER ===
function overrideConvertButton() {
    const convertBtn = document.getElementById('convert-btn');
    if (convertBtn) {
        // Remover listeners antigos
        const newBtn = convertBtn.cloneNode(true);
        convertBtn.parentNode.replaceChild(newBtn, convertBtn);
        
        // Adicionar novo listener que marca abertura legítima
        newBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            console.log('🖱️ Botão "Converter em Venda" clicado pelo usuário');
            
            // Marcar que modal será aberto legitimamente
            window.modalOpenedByUser = true;
            
            // Executar conversão
            window.convertToSale();
            
            // Reset da flag após um tempo
            setTimeout(() => {
                window.modalOpenedByUser = false;
            }, 5000);
        });
        
        console.log('✅ Botão "Converter em Venda" atualizado com flag de controle');
    }
}

// === PREVENIR ABERTURA AUTOMÁTICA DO MODAL ===
function preventAutoModalOpen() {
    // Função para verificar e fechar modais indesejados
    const checkAndCloseModal = () => {
        const modal = document.getElementById('advanced-payment-modal');
        if (modal && !modal.classList.contains('hidden')) {
            // Verificar se foi uma abertura legítima (via clique do usuário)
            if (!window.modalOpenedByUser) {
                console.warn('⚠️ Modal aberto automaticamente - fechando');
                modal.classList.add('hidden');
                document.body.style.overflow = '';
            }
        }
    };

    // Verificações periódicas
    checkAndCloseModal();
    setTimeout(checkAndCloseModal, 500);
    setTimeout(checkAndCloseModal, 1000);
    setTimeout(checkAndCloseModal, 2000);
    setTimeout(checkAndCloseModal, 3000);
    
    // Observer para detectar quando modais são criados
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    if (node.id === 'advanced-payment-modal') {
                        setTimeout(() => {
                            if (!window.modalOpenedByUser) {
                                node.classList.add('hidden');
                                document.body.style.overflow = '';
                                console.log('🔒 Modal automático fechado via observer');
                            }
                        }, 100);
                    }
                }
            });
        });
    });
    
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
    
    // Limpar observer após um tempo
    setTimeout(() => observer.disconnect(), 15000);
}

// === FUNÇÃO DE INICIALIZAÇÃO ===
function initFixes() {
    console.log('🔧 Aplicando correções...');
    
    // Garantir Supabase
    ensureSupabaseClient();
    
    // Override do botão
    overrideConvertButton();
    
    // Prevenir modal automático
    preventAutoModalOpen();
    
    console.log('✅ Correções aplicadas');
}

// === INICIALIZAÇÃO ===
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(initFixes, 1000);
});

document.addEventListener('userDataReady', () => {
    setTimeout(initFixes, 500);
});

// Também tentar após carregamento completo
window.addEventListener('load', () => {
    setTimeout(initFixes, 2000);
});

// === EXPORTAR FUNÇÕES ===
window.getProductImageUrl = getProductImageUrl;
window.convertToSaleSimple = convertToSaleSimple;
window.ensureSupabaseClient = ensureSupabaseClient;
window.preventAutoModalOpen = preventAutoModalOpen;

console.log('🛠️ Sistema de correções para orçamentos carregado');
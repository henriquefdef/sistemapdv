// ===== RELATÓRIO DE VENDAS - CONTROLE DE FREQUÊNCIA =====

// ===== ESTADO DA FREQUÊNCIA =====
const frequencyState = {
    clientsData: [],
    filteredData: [],
    currentStatus: 'all',
    filters: {
        client: '',
        product: ''
    }
};

// ===== INICIALIZAÇÃO =====
document.addEventListener('DOMContentLoaded', () => {
    setupFrequencyEventListeners();
});

function setupFrequencyEventListeners() {
    // Botão para abrir modal
    const frequencyBtn = document.getElementById('frequency-check');
    if (frequencyBtn) {
        frequencyBtn.addEventListener('click', openFrequencyModal);
    }

    // Abas de status
    document.querySelectorAll('.status-tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
            const status = e.target.dataset.status;
            setActiveTab(status);
            filterByStatus(status);
        });
    });
}

// ===== ABERTURA DO MODAL =====
async function openFrequencyModal() {
    const modal = document.getElementById('frequency-modal');
    if (!modal) return;

    modal.style.display = 'flex';
    showFrequencyLoading(true);

    try {
        await loadFrequencyData();
        displayFrequencyResults();
    } catch (error) {
        console.error('Erro ao carregar dados de frequência:', error);
        showFrequencyError('Erro ao carregar dados de frequência');
    } finally {
        showFrequencyLoading(false);
    }
}

function closeFrequencyModal() {
    const modal = document.getElementById('frequency-modal');
    if (modal) {
        modal.style.display = 'none';
        // Limpar dados ao fechar
        frequencyState.clientsData = [];
        frequencyState.filteredData = [];
        clearFrequencyFilters();
    }
}

// ===== CARREGAMENTO DE DADOS - VERSÃO CORRIGIDA =====
async function loadFrequencyData() {
    if (!relatorioState.supabaseClient || !window.currentCompanyId) {
        throw new Error('Configuração não encontrada');
    }

    try {
        // PRIMEIRO: Buscar vendas básicas
        const { data: vendasData, error: vendasError } = await relatorioState.supabaseClient
            .from('vendas')
            .select('*')
            .eq('id_empresa', window.currentCompanyId)
            .eq('status', 'ATIVO')
            .not('cliente_nome', 'is', null)
            .not('cliente_nome', 'eq', '')
            .order('hora_venda', { ascending: false });

        if (vendasError) throw vendasError;

        console.log(`Carregadas ${vendasData.length} vendas para análise de frequência`);

        // SEGUNDO: Buscar produtos com frequência definida
        const { data: produtosData, error: produtosError } = await relatorioState.supabaseClient
            .from('produtos')
            .select('nome, frequencia')
            .eq('id_empresa', window.currentCompanyId)
            .not('frequencia', 'is', null)
            .not('frequencia', 'eq', '');

        if (produtosError) throw produtosError;

        console.log(`Carregados ${produtosData.length} produtos com frequência definida`);

        // TERCEIRO: Criar mapa de produtos com frequência
        const produtosFrequenciaMap = new Map();
        produtosData.forEach(produto => {
            produtosFrequenciaMap.set(produto.nome, produto.frequencia);
        });

        // QUARTO: Filtrar vendas que têm produtos com frequência
        const vendasComFrequencia = vendasData.filter(venda => {
            return produtosFrequenciaMap.has(venda.produto_nome);
        });

        console.log(`Encontradas ${vendasComFrequencia.length} vendas de produtos com frequência`);

        // QUINTO: Processar dados para análise de frequência
        const clientsMap = new Map();

        vendasComFrequencia.forEach(venda => {
            const clienteKey = `${venda.cliente_nome}_${venda.cliente_telefone || 'sem_telefone'}`;
            const produtoNome = venda.produto_nome;
            const frequencia = produtosFrequenciaMap.get(produtoNome);

            const key = `${clienteKey}_${produtoNome}`;
            
            if (!clientsMap.has(key)) {
                clientsMap.set(key, {
                    cliente_nome: venda.cliente_nome,
                    cliente_telefone: venda.cliente_telefone || null,
                    produto_nome: produtoNome,
                    frequencia: frequencia,
                    ultima_compra: new Date(venda.hora_venda),
                    total_compras: 0,
                    valor_ultima_compra: parseFloat(venda.total_venda) || 0
                });
            }

            const existing = clientsMap.get(key);
            existing.total_compras += 1;

            // Manter apenas a compra mais recente
            const dataVenda = new Date(venda.hora_venda);
            if (dataVenda > existing.ultima_compra) {
                existing.ultima_compra = dataVenda;
                existing.valor_ultima_compra = parseFloat(venda.total_venda) || 0;
            }
        });

        // SEXTO: Converter para array e calcular status
        frequencyState.clientsData = Array.from(clientsMap.values()).map(client => {
            const diasDesdeUltimaCompra = Math.floor(
                (new Date() - client.ultima_compra) / (1000 * 60 * 60 * 24)
            );
            
            const frequenciaDias = convertFrequencyToDays(client.frequencia);
            const isReadyToBuy = diasDesdeUltimaCompra >= frequenciaDias;
            
            return {
                ...client,
                dias_desde_ultima_compra: diasDesdeUltimaCompra,
                frequencia_dias: frequenciaDias,
                status: isReadyToBuy ? 'ready' : 'pending',
                dias_restantes: Math.max(0, frequenciaDias - diasDesdeUltimaCompra)
            };
        });

        // Ordenar por prioridade (prontos para recompra primeiro)
        frequencyState.clientsData.sort((a, b) => {
            if (a.status === 'ready' && b.status !== 'ready') return -1;
            if (b.status === 'ready' && a.status !== 'ready') return 1;
            return b.dias_desde_ultima_compra - a.dias_desde_ultima_compra;
        });

        frequencyState.filteredData = [...frequencyState.clientsData];

        console.log(`Processados ${frequencyState.clientsData.length} registros de frequência`);

    } catch (error) {
        console.error('Erro ao carregar dados:', error);
        throw error;
    }
}

// ===== CONVERSÃO DE FREQUÊNCIA PARA DIAS =====
function convertFrequencyToDays(frequencia) {
    if (!frequencia) return 30; // Padrão 30 dias

    const freq = frequencia.toLowerCase();
    
    if (freq.includes('semana')) {
        const weeks = parseInt(freq);
        return weeks * 7;
    } else if (freq.includes('mês') || freq.includes('mes')) {
        const months = parseInt(freq);
        return months * 30;
    } else if (freq.includes('ano')) {
        const years = parseInt(freq);
        return years * 365;
    }
    
    return 30; // Padrão
}

// ===== EXIBIÇÃO DOS RESULTADOS =====
function displayFrequencyResults() {
    const container = document.getElementById('frequency-results');
    if (!container) return;

    if (frequencyState.filteredData.length === 0) {
        container.innerHTML = '<div class="no-data">Nenhum cliente encontrado com dados de frequência</div>';
        return;
    }

    const html = frequencyState.filteredData.map(client => {
        const statusClass = client.status === 'ready' ? 'ready-to-buy' : 'pending';
        const statusText = client.status === 'ready' ? 'Pronto para Recompra' : 'Aguardando';
        const statusBadge = client.status === 'ready' ? 'ready' : 'pending';

        return `
            <div class="frequency-item ${statusClass}">
                <div class="frequency-item-header">
                    <div class="frequency-item-info">
                        <div class="frequency-item-client">${client.cliente_nome}</div>
                        <div class="frequency-item-product">${client.produto_nome}</div>
                    </div>
                    <div class="frequency-item-status ${statusBadge}">
                        ${statusText}
                    </div>
                </div>

                <div class="frequency-item-details">
                    <div class="frequency-detail">
                        <div class="frequency-detail-label">Última Compra</div>
                        <div class="frequency-detail-value">${formatDate(client.ultima_compra)}</div>
                    </div>
                    <div class="frequency-detail">
                        <div class="frequency-detail-label">Frequência</div>
                        <div class="frequency-detail-value">${client.frequencia}</div>
                    </div>
                    <div class="frequency-detail">
                        <div class="frequency-detail-label">Dias Passados</div>
                        <div class="frequency-detail-value">${client.dias_desde_ultima_compra}</div>
                    </div>
                    <div class="frequency-detail">
                        <div class="frequency-detail-label">${client.status === 'ready' ? 'Dias em Atraso' : 'Dias Restantes'}</div>
                        <div class="frequency-detail-value">
                            ${client.status === 'ready' ? 
                                (client.dias_desde_ultima_compra - client.frequencia_dias) : 
                                client.dias_restantes
                            }
                        </div>
                    </div>
                    <div class="frequency-detail">
                        <div class="frequency-detail-label">Valor Última Compra</div>
                        <div class="frequency-detail-value">${formatCurrency(client.valor_ultima_compra)}</div>
                    </div>
                    <div class="frequency-detail">
                        <div class="frequency-detail-label">Total de Compras</div>
                        <div class="frequency-detail-value">${client.total_compras}</div>
                    </div>
                </div>

                <div class="frequency-item-actions">
                    ${client.status === 'ready' ? `
                        <button class="btn-whatsapp" onclick="sendWhatsAppMessage('${client.cliente_nome}', '${client.cliente_telefone}', '${client.produto_nome}', '${client.frequencia}')">
                            <i class="fab fa-whatsapp"></i>
                            Enviar WhatsApp
                        </button>
                    ` : ''}
                    <button class="btn-details" onclick="showClientDetails('${client.cliente_nome}', '${client.produto_nome}')">
                        <i class="fas fa-info-circle"></i>
                        Detalhes
                    </button>
                </div>
            </div>
        `;
    }).join('');

    container.innerHTML = html;
}

// ===== FILTROS =====
function filterFrequencyData() {
    const clientFilter = document.getElementById('frequency-filter-client')?.value.toLowerCase() || '';
    const productFilter = document.getElementById('frequency-filter-product')?.value.toLowerCase() || '';

    frequencyState.filters.client = clientFilter;
    frequencyState.filters.product = productFilter;

    applyFilters();
}

function clearFrequencyFilters() {
    document.getElementById('frequency-filter-client').value = '';
    document.getElementById('frequency-filter-product').value = '';
    
    frequencyState.filters.client = '';
    frequencyState.filters.product = '';

    applyFilters();
}

function applyFilters() {
    let filtered = [...frequencyState.clientsData];

    // Aplicar filtros de texto
    if (frequencyState.filters.client) {
        filtered = filtered.filter(client => 
            client.cliente_nome.toLowerCase().includes(frequencyState.filters.client)
        );
    }

    if (frequencyState.filters.product) {
        filtered = filtered.filter(client => 
            client.produto_nome.toLowerCase().includes(frequencyState.filters.product)
        );
    }

    frequencyState.filteredData = filtered;
    
    // Aplicar filtro de status atual
    filterByStatus(frequencyState.currentStatus);
}

function setActiveTab(status) {
    document.querySelectorAll('.status-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    
    document.querySelector(`[data-status="${status}"]`)?.classList.add('active');
    frequencyState.currentStatus = status;
}

function filterByStatus(status) {
    let filtered = [...frequencyState.filteredData];

    if (status === 'ready') {
        filtered = filtered.filter(client => client.status === 'ready');
    } else if (status === 'pending') {
        filtered = filtered.filter(client => client.status === 'pending');
    }

    // Atualizar apenas a exibição sem alterar filteredData original
    const container = document.getElementById('frequency-results');
    if (!container) return;

    if (filtered.length === 0) {
        container.innerHTML = '<div class="no-data">Nenhum cliente encontrado para este filtro</div>';
        return;
    }

    const html = filtered.map(client => {
        const statusClass = client.status === 'ready' ? 'ready-to-buy' : 'pending';
        const statusText = client.status === 'ready' ? 'Pronto para Recompra' : 'Aguardando';
        const statusBadge = client.status === 'ready' ? 'ready' : 'pending';

        return `
            <div class="frequency-item ${statusClass}">
                <div class="frequency-item-header">
                    <div class="frequency-item-info">
                        <div class="frequency-item-client">${client.cliente_nome}</div>
                        <div class="frequency-item-product">${client.produto_nome}</div>
                    </div>
                    <div class="frequency-item-status ${statusBadge}">
                        ${statusText}
                    </div>
                </div>

                <div class="frequency-item-details">
                    <div class="frequency-detail">
                        <div class="frequency-detail-label">Última Compra</div>
                        <div class="frequency-detail-value">${formatDate(client.ultima_compra)}</div>
                    </div>
                    <div class="frequency-detail">
                        <div class="frequency-detail-label">Frequência</div>
                        <div class="frequency-detail-value">${client.frequencia}</div>
                    </div>
                    <div class="frequency-detail">
                        <div class="frequency-detail-label">Dias Passados</div>
                        <div class="frequency-detail-value">${client.dias_desde_ultima_compra}</div>
                    </div>
                    <div class="frequency-detail">
                        <div class="frequency-detail-label">${client.status === 'ready' ? 'Dias em Atraso' : 'Dias Restantes'}</div>
                        <div class="frequency-detail-value">
                            ${client.status === 'ready' ? 
                                (client.dias_desde_ultima_compra - client.frequencia_dias) : 
                                client.dias_restantes
                            }
                        </div>
                    </div>
                    <div class="frequency-detail">
                        <div class="frequency-detail-label">Valor Última Compra</div>
                        <div class="frequency-detail-value">${formatCurrency(client.valor_ultima_compra)}</div>
                    </div>
                    <div class="frequency-detail">
                        <div class="frequency-detail-label">Total de Compras</div>
                        <div class="frequency-detail-value">${client.total_compras}</div>
                    </div>
                </div>

                <div class="frequency-item-actions">
                    ${client.status === 'ready' ? `
                        <button class="btn-whatsapp" onclick="sendWhatsAppMessage('${client.cliente_nome}', '${client.cliente_telefone}', '${client.produto_nome}', '${client.frequencia}')">
                            <i class="fab fa-whatsapp"></i>
                            Enviar WhatsApp
                        </button>
                    ` : ''}
                    <button class="btn-details" onclick="showClientDetails('${client.cliente_nome}', '${client.produto_nome}')">
                        <i class="fas fa-info-circle"></i>
                        Detalhes
                    </button>
                </div>
            </div>
        `;
    }).join('');

    container.innerHTML = html;
}

// ===== WHATSAPP =====
function sendWhatsAppMessage(clientName, phone, productName, frequency) {
    if (!phone) {
        showNotification('Cliente não possui telefone cadastrado', 'warning');
        return;
    }

    // Limpar telefone (remover caracteres não numéricos)
    const cleanPhone = phone.replace(/\D/g, '');
    
    if (cleanPhone.length < 10) {
        showNotification('Número de telefone inválido', 'error');
        return;
    }

    // Adicionar código do país se necessário
    const fullPhone = cleanPhone.startsWith('55') ? cleanPhone : '55' + cleanPhone;

    // Criar mensagem personalizada
    const message = `Olá ${clientName}! ★

Como você está? Espero que esteja tudo bem!

Notei que já faz um tempo desde sua última compra do produto *${productName}*. 

Considerando que a frequência de uso é de *${frequency}*, imagino que você já deve estar precisando repor! 

Que tal dar uma passadinha aqui na loja para dar uma olhada? Temos sempre novidades e promoções especiais para nossos clientes fiéis como você! ★

Qualquer dúvida, estou aqui para ajudar! 

Abraços! ★`;

    // Codificar mensagem para URL
    const encodedMessage = encodeURIComponent(message);
    
    // Criar link do WhatsApp
    const whatsappUrl = `https://wa.me/${fullPhone}?text=${encodedMessage}`;
    
    // Abrir em nova aba
    window.open(whatsappUrl, '_blank');
    
    showNotification(`Mensagem enviada para ${clientName}`, 'success');
}

// ===== DETALHES DO CLIENTE =====
async function showClientDetails(clientName, productName) {
    try {
        showFrequencyLoading(true);

        // Buscar histórico completo do cliente
        const { data: historyData, error } = await relatorioState.supabaseClient
            .from('vendas')
            .select('*')
            .eq('id_empresa', window.currentCompanyId)
            .eq('cliente_nome', clientName)
            .eq('produto_nome', productName)
            .eq('status', 'ATIVO')
            .order('hora_venda', { ascending: false });

        if (error) throw error;

        const modalContent = `
            <div class="detail-modal" onclick="closeDetailModal()">
                <div class="modal-content" onclick="event.stopPropagation()">
                    <div class="modal-header">
                        <h3>Histórico de Compras - ${clientName}</h3>
                        <button class="modal-close" onclick="closeDetailModal()">&times;</button>
                    </div>
                    <div class="modal-body">
                        <p><strong>Produto:</strong> ${productName}</p>
                        <p><strong>Total de Compras:</strong> ${historyData.length}</p>
                        <hr>
                        <h4>Histórico:</h4>
                        <div class="history-list">
                            ${historyData.map(venda => `
                                <div class="history-item">
                                    <div class="history-date">${formatDate(new Date(venda.hora_venda))}</div>
                                    <div class="history-value">${formatCurrency(venda.total_venda)}</div>
                                    <div class="history-qty">${venda.quantidade_unit || 1} un</div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalContent);

    } catch (error) {
        console.error('Erro ao carregar detalhes:', error);
        showNotification('Erro ao carregar histórico do cliente', 'error');
    } finally {
        showFrequencyLoading(false);
    }
}

function closeDetailModal() {
    const modal = document.querySelector('.detail-modal');
    if (modal) {
        modal.remove();
    }
}

// ===== UTILITÁRIOS =====
function formatDate(date) {
    return new Date(date).toLocaleDateString('pt-BR');
}

function formatCurrency(value) {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(value || 0);
}

function showFrequencyLoading(show) {
    const loading = document.getElementById('frequency-loading');
    const results = document.getElementById('frequency-results');
    
    if (loading && results) {
        loading.style.display = show ? 'block' : 'none';
        results.style.display = show ? 'none' : 'block';
    }
}

function showFrequencyError(message) {
    const container = document.getElementById('frequency-results');
    if (container) {
        container.innerHTML = `
            <div class="no-data" style="color: var(--error-color);">
                <i class="fas fa-exclamation-triangle" style="margin-bottom: 10px; font-size: 24px;"></i><br>
                ${message}
            </div>
        `;
    }
}

// ===== EXPORTAR FUNÇÕES GLOBAIS =====
window.openFrequencyModal = openFrequencyModal;
window.closeFrequencyModal = closeFrequencyModal;
window.filterFrequencyData = filterFrequencyData;
window.clearFrequencyFilters = clearFrequencyFilters;
window.sendWhatsAppMessage = sendWhatsAppMessage;
window.showClientDetails = showClientDetails;
window.closeDetailModal = closeDetailModal;

// ===== ADICIONAR BADGE DE NOTIFICAÇÃO - VERSÃO CORRIGIDA =====
async function updateFrequencyNotification() {
    if (!relatorioState.supabaseClient || !window.currentCompanyId) return;

    try {
        // Buscar vendas
        const { data: vendas, error: vendasError } = await relatorioState.supabaseClient
            .from('vendas')
            .select('cliente_nome, produto_nome, hora_venda')
            .eq('id_empresa', window.currentCompanyId)
            .eq('status', 'ATIVO')
            .not('cliente_nome', 'is', null);

        if (vendasError) return;

        // Buscar produtos com frequência
        const { data: produtos, error: produtosError } = await relatorioState.supabaseClient
            .from('produtos')
            .select('nome, frequencia')
            .eq('id_empresa', window.currentCompanyId)
            .not('frequencia', 'is', null);

        if (produtosError) return;

        const produtosMap = new Map();
        produtos.forEach(p => produtosMap.set(p.nome, p.frequencia));

        const clientsMap = new Map();
        const today = new Date();

        vendas.forEach(venda => {
            const frequencia = produtosMap.get(venda.produto_nome);
            if (!frequencia) return;

            const key = `${venda.cliente_nome}_${venda.produto_nome}`;
            const dataVenda = new Date(venda.hora_venda);
            
            if (!clientsMap.has(key) || dataVenda > clientsMap.get(key).data) {
                clientsMap.set(key, {
                    data: dataVenda,
                    frequencia: frequencia
                });
            }
        });

        let readyCount = 0;
        clientsMap.forEach(client => {
            const diasPassados = Math.floor((today - client.data) / (1000 * 60 * 60 * 24));
            const frequenciaDias = convertFrequencyToDays(client.frequencia);
            
            if (diasPassados >= frequenciaDias) {
                readyCount++;
            }
        });

        // Atualizar badge no botão
        const frequencyBtn = document.getElementById('frequency-check');
        if (frequencyBtn && readyCount > 0) {
            const existingBadge = frequencyBtn.querySelector('.frequency-notification-badge');
            if (existingBadge) existingBadge.remove();

            const badge = document.createElement('span');
            badge.className = 'frequency-notification-badge';
            badge.textContent = readyCount > 99 ? '99+' : readyCount;
            frequencyBtn.style.position = 'relative';
            frequencyBtn.appendChild(badge);
        }

    } catch (error) {
        console.error('Erro ao verificar notificações:', error);
    }
}

// Verificar notificações ao carregar
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(updateFrequencyNotification, 2000);
});

// Adicionar estilos específicos para histórico
const historyStyles = `
    .detail-modal {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1002;
    }
    
    .detail-modal .modal-content {
        background: white;
        border-radius: 12px;
        width: 90%;
        max-width: 600px;
        max-height: 80vh;
        overflow-y: auto;
        padding: 0;
    }
    
    .detail-modal .modal-header {
        padding: 20px;
        border-bottom: 1px solid #eee;
        display: flex;
        justify-content: space-between;
        align-items: center;
    }
    
    .detail-modal .modal-body {
        padding: 20px;
    }
    
    .history-list {
        max-height: 300px;
        overflow-y: auto;
        border: 1px solid #eee;
        border-radius: 8px;
    }
    
    .history-item {
        padding: 12px 15px;
        border-bottom: 1px solid #f0f0f0;
        display: grid;
        grid-template-columns: 1fr auto auto;
        gap: 15px;
        align-items: center;
    }
    
    .history-item:last-child {
        border-bottom: none;
    }
    
    .history-date {
        font-weight: 500;
    }
    
    .history-value {
        color: #059669;
        font-weight: 600;
    }
    
    .history-qty {
        color: #6b7280;
        font-size: 14px;
    }
`;

// Adicionar estilos ao head
const styleSheet = document.createElement('style');
styleSheet.textContent = historyStyles;
document.head.appendChild(styleSheet);
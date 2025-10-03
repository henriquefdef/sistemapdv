// Módulo para gerar comprovantes de venda dinamicamente
console.log('🧾 Carregando módulo comprovante-modal.js...');

class ComprovanteModal {
    constructor() {
        this.modal = null;
        this.isOpen = false;
        this.escapeHandler = null;
        console.log('🏗️ ComprovanteModal constructor executado');
    }

    // Função para criar o modal dinamicamente
    createModal() {
        console.log('🔨 createModal iniciado');
        
        // Remover modal existente se houver
        const existingModal = document.getElementById('comprovante-overlay');
        if (existingModal) {
            existingModal.remove();
        }

        // Criar overlay
        const overlay = document.createElement('div');
        overlay.id = 'comprovante-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.75);
            backdrop-filter: blur(0.25rem);
            z-index: 10000;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 1rem;
            box-sizing: border-box;
            animation: fadeIn 0.3s ease-out;
        `;

        // Adicionar animações CSS
        const style = document.createElement('style');
        style.textContent = `
            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            @keyframes slideUp {
                from { transform: translateY(1.875rem); opacity: 0; }
                to { transform: translateY(0); opacity: 1; }
            }
            .btn-hover:hover {
                transform: translateY(-0.0625rem);
                box-shadow: 0 0.5rem 1.5625rem rgba(0, 0, 0, 0.15) !important;
            }
            .btn-hover:active {
                transform: translateY(0);
            }
            @media (max-width: 87.5rem) {
                .modal-content-grid {
                    grid-template-columns: 1fr 22rem !important;
                    gap: 1.5rem !important;
                }
            }
            @media (max-width: 75rem) {
                .modal-content-grid {
                    grid-template-columns: 1fr !important;
                    gap: 1rem !important;
                }
                .modal-container {
                    max-width: 50rem !important;
                }
            }
            @media (max-width: 48rem) {
                .modal-container {
                    max-width: 95vw !important;
                    max-height: 95vh !important;
                    margin: 0.5rem !important;
                }
                .modal-content-grid {
                    padding: 1rem !important;
                }
                .actions-panel {
                    padding: 1.25rem !important;
                }
                .header-content {
                    padding: 0.9rem !important;
                }
            }
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
        `;
        document.head.appendChild(style);

        // Criar container do modal
        const modalContainer = document.createElement('div');
        modalContainer.className = 'modal-container';
        modalContainer.style.cssText = `
            max-width: 62.5rem;
            width: 100%;
            max-height: 90vh;
            background: #ffffff;
            border-radius: 1rem;
            box-shadow: 0 1.5rem 3rem rgba(0, 0, 0, 0.2);
            overflow: hidden;
            display: flex;
            flex-direction: column;
            animation: slideUp 0.4s ease-out;
        `;

        // Adicionar HTML do comprovante
        modalContainer.innerHTML = this.getModalHTML();

        overlay.appendChild(modalContainer);
        document.body.appendChild(overlay);
        console.log('✅ Modal adicionado ao DOM - overlay ID:', overlay.id);

        this.modal = overlay;
        this.isOpen = true;
        console.log('✅ Estado atualizado:', {
            isOpen: this.isOpen,
            modalSet: !!this.modal
        });

        // Fechar ao clicar no overlay
        overlay.addEventListener('click', (e) => {
            console.log('🖱️ Click no overlay detectado');
            if (e.target === overlay) {
                console.log('🖱️ Click foi no overlay (não no conteúdo), fechando modal');
                this.closeModal();
            }
        });

        // Fechar com ESC
        this.escapeHandler = (e) => {
            if (e.key === 'Escape' && this.isOpen) {
                console.log('⌨️ Tecla ESC pressionada, fechando modal');
                this.closeModal();
            }
        };
        document.addEventListener('keydown', this.escapeHandler);
        console.log('⌨️ Event listener ESC adicionado');

        return modalContainer;
    }

    // Limpeza simples
    cleanup() {
        if (this.escapeHandler) {
            document.removeEventListener('keydown', this.escapeHandler);
            this.escapeHandler = null;
        }
        
        const existingModal = document.getElementById('comprovante-overlay');
        if (existingModal) {
            existingModal.remove();
        }
        
        this.modal = null;
        this.isOpen = false;
    }

    // HTML do modal
    getModalHTML() {
        console.log('📄 Gerando HTML do modal');
        return `
            <div class="header header-content" style="background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%); color: white; padding: 1.2rem; text-align: center; border-bottom: 0.0625rem solid #e5e7eb;">
                <h1 style="font-size: 1.4rem; margin: 0 0 0.3rem 0; font-weight: 700; letter-spacing: -0.025em;">Comprovante de Venda</h1>
                <p style="font-size: 0.85rem; opacity: 0.8; margin: 0; font-weight: 400;">Escolha como processar</p>
            </div>
            
            <div class="content modal-content-grid" style="display: grid; grid-template-columns: 1fr 23.75rem; gap: 2rem; padding: 2rem; flex: 1; overflow: auto; background: #fafafa;">
                <div class="cupom-container" style="background: white; border-radius: 0.75rem; padding: 1.5rem; border: 0.0625rem solid #e5e7eb; box-shadow: 0 0.0625rem 0.1875rem rgba(0, 0, 0, 0.1);">
                    <div id="cupom-fiscal" class="cupom-fiscal" style="font-family: 'Courier New', monospace; font-size: 0.8125rem; line-height: 1.5; color: #111827; background: white; padding: 1.5rem; border-radius: 0.5rem;">
                        <!-- O cupom será inserido aqui -->
                    </div>
                </div>
                
                <div class="actions-panel" style="background: white; border-radius: 0.75rem; padding: 1.75rem; border: 0.0625rem solid #e5e7eb; box-shadow: 0 0.0625rem 0.1875rem rgba(0, 0, 0, 0.1); height: fit-content;">
                    <h3 style="font-size: 1.25rem; font-weight: 600; margin: 0 0 1.5rem 0; color: #111827; text-align: center;">Ações Disponíveis</h3>
                    
                    <div id="customer-info" class="customer-info" style="display: none; background: #f0f9ff; padding: 1rem; border-radius: 0.5rem; margin-bottom: 1.5rem; border-left: 0.1875rem solid #0ea5e9;">
                        <h4 style="color: #0369a1; margin: 0 0 0.5rem 0; font-size: 0.875rem; font-weight: 600;">Cliente Selecionado</h4>
                        <p id="customer-name" style="margin: 0.125rem 0; font-size: 0.875rem; color: #374151;"></p>
                        <p id="customer-phone" style="margin: 0.125rem 0; font-size: 0.875rem; color: #6b7280;"></p>
                    </div>
                    
                    <button class="action-btn btn-print btn-hover" onclick="comprovanteModal.imprimirCupom()" style="width: 100%; padding: 0.875rem 1.25rem; margin-bottom: 0.75rem; border: none; border-radius: 0.5rem; font-size: 0.9375rem; font-weight: 600; cursor: pointer; background: #111827; color: white; display: flex; align-items: center; justify-content: center; gap: 0.5rem; transition: all 0.2s ease; box-shadow: 0 0.0625rem 0.1875rem rgba(0, 0, 0, 0.1);">
                        <span style="font-size: 1rem;">🖨️</span> Imprimir Comprovante
                    </button>
                    
                    <button class="action-btn btn-pdf btn-hover" onclick="comprovanteModal.baixarPDF()" style="width: 100%; padding: 0.875rem 1.25rem; margin-bottom: 0.75rem; border: none; border-radius: 0.5rem; font-size: 0.9375rem; font-weight: 600; cursor: pointer; background: #374151; color: white; display: flex; align-items: center; justify-content: center; gap: 0.5rem; transition: all 0.2s ease; box-shadow: 0 0.0625rem 0.1875rem rgba(0, 0, 0, 0.1);">
                        <span style="font-size: 1rem;">📄</span> Baixar como PDF
                    </button>
                    
                    <button class="action-btn btn-whatsapp btn-hover" onclick="comprovanteModal.enviarWhatsApp()" style="width: 100%; padding: 0.875rem 1.25rem; margin-bottom: 0.75rem; border: none; border-radius: 0.5rem; font-size: 0.9375rem; font-weight: 600; cursor: pointer; background: #059669; color: white; display: flex; align-items: center; justify-content: center; gap: 0.5rem; transition: all 0.2s ease; box-shadow: 0 0.0625rem 0.1875rem rgba(0, 0, 0, 0.1);">
                        <span style="font-size: 1rem;">💬</span> Enviar via WhatsApp
                    </button>
                    
                    <button class="action-btn btn-close btn-hover" onclick="comprovanteModal.closeModal()" style="width: 100%; padding: 0.875rem 1.25rem; margin-bottom: 1rem; border: 0.0625rem solid #d1d5db; border-radius: 0.5rem; font-size: 0.9375rem; font-weight: 600; cursor: pointer; background: white; color: #374151; display: flex; align-items: center; justify-content: center; gap: 0.5rem; transition: all 0.2s ease;">
                        <span style="font-size: 1rem;">✕</span> Fechar
                    </button>
                    
                    <div class="whatsapp-instructions" style="background: #f0fdf4; padding: 1rem; border-radius: 0.5rem; margin-top: 1rem; border-left: 0.1875rem solid #22c55e;">
                        <p style="margin: 0; font-size: 0.8125rem; color: #166534; line-height: 1.5;"><strong>Dica:</strong> Após clicar em "Enviar WhatsApp", a imagem será copiada automaticamente. No WhatsApp, basta colar com Ctrl+V para enviar o comprovante!</p>
                    </div>
                    
                    <div class="loading" id="loading" style="display: none; text-align: center; padding: 0.75rem; color: #6b7280; font-size: 0.875rem;">
                        <div style="display: inline-block; width: 1rem; height: 1rem; border: 0.125rem solid #e5e7eb; border-top: 0.125rem solid #6b7280; border-radius: 50%; animation: spin 1s linear infinite; margin-right: 0.5rem;"></div>
                        Processando...
                    </div>
                    
                    <div class="success-msg" id="success-msg" style="background: #f0fdf4; color: #166534; padding: 0.75rem; border-radius: 0.5rem; margin-top: 0.75rem; display: none; font-size: 0.875rem; border-left: 0.1875rem solid #22c55e;">
                        ✅ Ação realizada com sucesso!
                    </div>
                </div>
            </div>
        `;
    }

    // Função para inicializar o comprovante com dados
    initComprovante(data) {
        console.log('🔍 initComprovante iniciado');
        console.log('📊 Dados recebidos:', {
            saleData: data.saleData ? 'presente' : 'ausente',
            saleId: data.saleId,
            companyData: data.companyData ? 'presente' : 'ausente',
            customerData: data.customerData ? 'presente' : 'ausente'
        });
        
        try {
            this.saleData = data.saleData;
            this.saleId = data.saleId;
            this.companyData = data.companyData;
            this.customerData = data.customerData;
            
            console.log('💾 Dados armazenados na instância');
            
            // Mostrar informações do cliente se disponível
            if (this.customerData && this.customerData.telefone) {
                console.log('📱 Exibindo informações do cliente');
                const customerInfoEl = document.getElementById('customer-info');
                if (customerInfoEl) {
                    customerInfoEl.style.display = 'block';
                    const customerNameEl = document.getElementById('customer-name');
                    const customerPhoneEl = document.getElementById('customer-phone');
                    if (customerNameEl) customerNameEl.textContent = this.customerData.nome || 'Cliente';
                    if (customerPhoneEl) customerPhoneEl.textContent = `Tel: ${this.customerData.telefone}`;
                    console.log('✅ Informações do cliente exibidas');
                } else {
                    console.warn('⚠️ Elemento customer-info não encontrado');
                }
            } else {
                console.log('ℹ️ Nenhum cliente selecionado ou sem telefone');
            }
            
            // Gerar e exibir o cupom
            console.log('🧾 Gerando cupom HTML...');
            const cupomHTML = this.generateCupomHTML();
            const cupomEl = document.getElementById('cupom-fiscal');
            if (cupomEl) {
                cupomEl.innerHTML = cupomHTML;
                console.log('✅ Cupom HTML inserido no DOM');
            } else {
                console.error('❌ Elemento cupom-fiscal não encontrado');
            }
            
            console.log('✅ initComprovante concluído com sucesso');
        } catch (error) {
            console.error('❌ Erro em initComprovante:', error);
        }
    }

    // Função para abrir o modal com dados
    openComprovante(data) {
        console.log('🚀 openComprovante chamado');
        
        // Fechar modal existente se houver
        if (this.isOpen) {
            this.closeModal();
        }
        
        // Criar modal
        const modalContainer = this.createModal();
        
        // Inicializar conteúdo
        this.initComprovante(data);
        
        console.log('✅ Modal aberto com sucesso');
    }

    // Função para fechar o modal
    closeModal() {
        console.log('🚪 Fechando modal');
        this.cleanup();
    }

    // Função para formatar moeda
    formatCurrency(value) {
        try {
            return new Intl.NumberFormat('pt-BR', {
                style: 'currency',
                currency: 'BRL'
            }).format(value || 0);
        } catch (error) {
            console.error('❌ Erro ao formatar moeda:', error);
            return 'R$ 0,00';
        }
    }
    // Função para gerar informações de pagamento
    getPagamentoInfo(paymentData) {
        console.log('💳 Gerando informações de pagamento:', paymentData);
        
        try {
            if (!paymentData) {
                console.log('ℹ️ Nenhum dado de pagamento, usando padrão');
                return '<div class="info-row" style="display: flex; justify-content: space-between; margin-bottom: 0.25rem; font-size: 0.75rem;"><span>PAGAMENTO:</span><span>Dinheiro</span></div>';
            }
            
            let info = `<div class="info-row" style="display: flex; justify-content: space-between; margin-bottom: 0.25rem; font-size: 0.75rem;"><span>PAGAMENTO:</span><span>${paymentData.method || 'Não informado'}</span></div>`;
            
            switch (paymentData.method) {
                case 'Dinheiro':
                    if (paymentData.amountReceived && paymentData.change) {
                        info += `
                            <div class="info-row" style="display: flex; justify-content: space-between; margin-bottom: 0.25rem; font-size: 0.75rem;"><span>RECEBIDO:</span><span>${this.formatCurrency(paymentData.amountReceived)}</span></div>
                            <div class="info-row" style="display: flex; justify-content: space-between; margin-bottom: 0.25rem; font-size: 0.75rem;"><span>TROCO:</span><span>${this.formatCurrency(paymentData.change)}</span></div>
                        `;
                    }
                    break;
                    
                case 'Cartao':
                case 'Cartão':
                    info += `<div class="info-row" style="display: flex; justify-content: space-between; margin-bottom: 0.25rem; font-size: 0.75rem;"><span>MODALIDADE:</span><span>${paymentData.cardType || 'N/A'}</span></div>`;
                    if (paymentData.installments > 1) {
                        info += `<div class="info-row" style="display: flex; justify-content: space-between; margin-bottom: 0.25rem; font-size: 0.75rem;"><span>PARCELAS:</span><span>${paymentData.installments}x</span></div>`;
                    }
                    if (paymentData.fees > 0) {
                        info += `<div class="info-row" style="display: flex; justify-content: space-between; margin-bottom: 0.25rem; font-size: 0.75rem;"><span>TAXA:</span><span>${this.formatCurrency(paymentData.fees)}</span></div>`;
                    }
                    break;
                    
                case 'PIX':
                    info += `<div style="font-size: 0.6875rem; margin-top: 0.3125rem; font-style: italic;">Pagamento instantâneo via PIX</div>`;
                    break;
                    
                case 'Crediario':
                    if (paymentData.crediarioInstallments) {
                        info += `<div class="info-row" style="display: flex; justify-content: space-between; margin-bottom: 0.25rem; font-size: 0.75rem;"><span>PARCELAS:</span><span>${paymentData.crediarioInstallments}x</span></div>`;
                    }
                    break;
            }
            
            console.log('✅ Informações de pagamento geradas');
            return info;
        } catch (error) {
            console.error('❌ Erro ao gerar informações de pagamento:', error);
            return '<div class="info-row" style="display: flex; justify-content: space-between; margin-bottom: 0.25rem; font-size: 0.75rem;"><span>PAGAMENTO:</span><span>Erro ao carregar</span></div>';
        }
    }

    // Função para gerar informações de cashback
    getCashbackInfo(saleData, customerData) {
        console.log('💰 Gerando informações de cashback:', {
            saleData: saleData ? 'presente' : 'ausente',
            customerData: customerData ? 'presente' : 'ausente'
        });
        
        try {
            const cashbackEnabled = this.companyData?.cashback_enabled || false;
            console.log('💰 Cashback habilitado:', cashbackEnabled);
            
            if (!cashbackEnabled) {
                console.log('ℹ️ Cashback desabilitado');
                return '';
            }
            
            let cashbackInfo = '<div class="cashback-info" style="margin-top: 0.625rem; padding: 0.5rem; background: #f9fafb; border-radius: 0.25rem; border: 0.0625rem solid #e5e7eb;">';
            cashbackInfo += '<div style="font-weight: 600; margin-bottom: 0.375rem; color: #6b7280; font-size: 0.6875rem; text-transform: uppercase; letter-spacing: 0.025em;">💰 Programa de Fidelidade</div>';
            
            let hasContent = false;
            let saldoFinal = 0;
            
            // Calcular saldo final para usar depois
            if (customerData && customerData.cashback_balance !== undefined) {
                const saldoInicial = customerData.cashback_balance || 0;
                const cashbackGerado = saleData?.cashback_generated || 0;
                const cashbackUsado = saleData?.cashback_used || 0;
                saldoFinal = saldoInicial + cashbackGerado - cashbackUsado;
                console.log('💰 Saldo inicial:', saldoInicial, 'Gerado:', cashbackGerado, 'Usado:', cashbackUsado, 'Saldo final:', saldoFinal);
            }
            
            // Mostrar cashback gerado nesta compra primeiro
            if (saleData?.cashback_generated && saleData.cashback_generated > 0) {
                cashbackInfo += `<div class="info-row" style="display: flex; justify-content: space-between; margin-bottom: 0.1875rem; font-size: 0.6875rem; color: #374151;"><span>Ganho nesta compra:</span><span style="font-weight: 600; color: #10b981;">+${this.formatCurrency(saleData.cashback_generated)}</span></div>`;
                hasContent = true;
                console.log('💰 Cashback gerado:', saleData.cashback_generated);
            }
            
            // Mostrar cashback usado (se houver)
            if (saleData?.cashback_used && saleData.cashback_used > 0) {
                cashbackInfo += `<div class="info-row" style="display: flex; justify-content: space-between; margin-bottom: 0.1875rem; font-size: 0.6875rem; color: #374151;"><span>Usado nesta compra:</span><span style="font-weight: 600; color: #dc2626;">-${this.formatCurrency(saleData.cashback_used)}</span></div>`;
                hasContent = true;
                console.log('💰 Cashback usado:', saleData.cashback_used);
            }
            
            // Mostrar saldo disponível por último
            if (customerData && customerData.cashback_balance !== undefined) {
                cashbackInfo += `<div class="info-row" style="display: flex; justify-content: space-between; margin-bottom: 0.1875rem; font-size: 0.6875rem; color: #374151;"><span>Saldo disponível:</span><span style="font-weight: 600; color: #059669;">${this.formatCurrency(saldoFinal)}</span></div>`;
                hasContent = true;
            }
            
            cashbackInfo += '</div>';
            
            console.log('✅ Informações de cashback geradas, hasContent:', hasContent);
            return hasContent ? cashbackInfo : '';
        } catch (error) {
            console.error('❌ Erro ao gerar informações de cashback:', error);
            return '';
        }
    }

    // Função para gerar HTML do cupom
    generateCupomHTML() {
        console.log('🧾 generateCupomHTML iniciado');
        
        try {
            if (!this.saleData || !this.companyData) {
                console.warn('⚠️ Dados não carregados para gerar cupom');
                return '<p style="text-align: center; color: #6b7280; padding: 1.25rem;">Aguardando dados da venda...</p>';
            }
            
            console.log('📊 Dados disponíveis para gerar cupom:', {
                items: this.saleData.items ? this.saleData.items.length : 0,
                companyName: this.companyData.nome,
                saleId: this.saleId
            });
            
            // Usar a data/hora real da venda em vez da atual
            let dataHoraVenda = new Date(this.saleData.hora_venda || this.saleData.data_venda);
            
            // Verificar se a data é válida, se não for, usar data atual
            if (isNaN(dataHoraVenda.getTime())) {
                console.warn('⚠️ Data da venda inválida, usando data atual');
                dataHoraVenda = new Date();
            }
            
            const dataVenda = dataHoraVenda.toLocaleDateString('pt-BR');
            const horaVenda = dataHoraVenda.toLocaleTimeString('pt-BR');
            
            // Verificar se items existe e é um array
            if (!this.saleData.items || !Array.isArray(this.saleData.items)) {
                console.error('❌ Items da venda não encontrados ou inválidos');
                return '<p style="text-align: center; color: #dc2626; padding: 1.25rem;">Erro: Itens da venda não encontrados</p>';
            }
            
            console.log('🛒 Processando', this.saleData.items.length, 'itens');
            
            // Calcular totais com verificação de segurança
            const subtotal = this.saleData.items.reduce((acc, item) => {
                const preco = parseFloat(item.preco_venda || item.preco) || 0;
                const quantidade = parseInt(item.quantity || item.quantidade) || 0;
                console.log(`📦 Item: ${item.nome}, Preço: ${preco}, Qtd: ${quantidade}`);
                return acc + (preco * quantidade);
            }, 0);
            
            console.log('💰 Subtotal calculado:', subtotal);
            
            const desconto = parseFloat(this.saleData.discount || this.saleData.totals?.totalDiscount) || 0;
            const total = this.saleData.totals?.total || (subtotal - desconto);
            
            console.log('💰 Valores finais:', { subtotal, desconto, total });
            
            let html = `
                <div class="company-header" style="text-align: center; border-bottom: 0.125rem dashed #374151; padding-bottom: 1rem; margin-bottom: 1rem;">
                    <div class="company-name" style="font-size: 1.125rem; font-weight: 700; margin-bottom: 0.5rem; text-transform: uppercase; letter-spacing: 0.03125rem; color: #111827;">${this.companyData.nome || 'EMPRESA'}</div>
                    <div class="company-info" style="font-size: 0.6875rem; line-height: 1.5; margin-bottom: 0.1875rem; color: #6b7280;">${this.companyData.endereco || ''}</div>
                    <div class="company-info" style="font-size: 0.6875rem; line-height: 1.5; margin-bottom: 0.1875rem; color: #6b7280;">CNPJ: ${this.companyData.cnpj || 'Não informado'}</div>
                    <div class="company-info" style="font-size: 0.6875rem; line-height: 1.5; margin-bottom: 0.1875rem; color: #6b7280;">Tel: ${this.companyData.telefone || 'Não informado'}</div>
                </div>
                
                <div class="cupom-title" style="font-size: 1rem; font-weight: 700; margin: 1rem 0; text-align: center; letter-spacing: 0.0625rem; background: #f3f4f6; color: #111827; padding: 0.625rem; border-radius: 0.375rem;">CUPOM FISCAL</div>
                
                <div class="sale-info" style="border-bottom: 0.0625rem dashed #d1d5db; padding-bottom: 0.75rem; margin-bottom: 1rem;">
                    <div class="info-row" style="display: flex; justify-content: space-between; margin-bottom: 0.25rem; font-size: 0.75rem; color: #374151;"><span>VENDA Nº:</span><span>${this.saleId || 'N/A'}</span></div>
                    <div class="info-row" style="display: flex; justify-content: space-between; margin-bottom: 0.25rem; font-size: 0.75rem; color: #374151;"><span>DATA:</span><span>${dataVenda}</span></div>
                    <div class="info-row" style="display: flex; justify-content: space-between; margin-bottom: 0.25rem; font-size: 0.75rem; color: #374151;"><span>HORA:</span><span>${horaVenda}</span></div>
                    ${this.customerData ? `<div class="info-row" style="display: flex; justify-content: space-between; margin-bottom: 0.25rem; font-size: 0.75rem; color: #374151;"><span>CLIENTE:</span><span>${this.customerData.nome || 'N/A'}</span></div>` : ''}
                </div>
                
                <div class="items-section" style="margin: 1rem 0;">
                    <div class="items-header" style="background: #374151; color: white; padding: 0.625rem; text-align: center; font-weight: 600; margin-bottom: 0.75rem; border-radius: 0.25rem;">ITENS</div>
            `;
            
            // Adicionar itens
            this.saleData.items.forEach((item, index) => {
                const preco = parseFloat(item.preco_venda || item.preco) || 0;
                const quantidade = parseInt(item.quantity || item.quantidade) || 0;
                const totalItem = preco * quantidade;
                
                html += `
                    <div class="item" style="border-bottom: 0.0625rem dotted #d1d5db; padding: 0.5rem 0; font-size: 0.6875rem;">
                        <div class="item-header" style="display: flex; justify-content: space-between; font-weight: 600; margin-bottom: 0.1875rem; color: #111827;">
                            <span>${(item.nome || 'Item').substring(0, 25)}</span>
                            <span>${this.formatCurrency(totalItem)}</span>
                        </div>
                        <div class="item-details" style="color: #6b7280; font-size: 0.625rem; margin-left: 0.625rem;">
                            ${quantidade}x ${this.formatCurrency(preco)} cada
                            ${item.codigo_sku || item.codigo ? `| Cód: ${item.codigo_sku || item.codigo}` : ''}
                        </div>
                    </div>
                `;
            });
            
            html += `
                </div>
                
                <div class="totals" style="border-top: 0.125rem solid #374151; padding-top: 1rem; margin-top: 1rem;">
                    <div class="total-row" style="display: flex; justify-content: space-between; margin-bottom: 0.375rem; font-size: 0.75rem; color: #374151;"><span>SUBTOTAL:</span><span>${this.formatCurrency(subtotal)}</span></div>
                    ${desconto > 0 ? `<div class="total-row" style="display: flex; justify-content: space-between; margin-bottom: 0.375rem; font-size: 0.75rem; color: #374151;"><span>DESCONTO:</span><span>-${this.formatCurrency(desconto)}</span></div>` : ''}
                    <div class="total-final" style="font-size: 1rem; font-weight: 700; background: #374151; color: white; padding: 0.75rem; margin: 0.75rem 0; border-radius: 0.375rem; display: flex; justify-content: space-between;">
                        <span>TOTAL:</span><span>${this.formatCurrency(total)}</span>
                    </div>
                </div>
                
                <div class="payment-info" style="border-top: 0.0625rem dashed #d1d5db; padding-top: 0.75rem; margin-top: 1rem; font-size: 0.75rem; color: #374151;">
                    ${this.getPagamentoInfo(this.saleData.payment)}
                </div>
                
                ${this.getCashbackInfo(this.saleData, this.customerData)}
                
                <div class="footer" style="border-top: 0.125rem dashed #d1d5db; padding-top: 1rem; margin-top: 1.25rem; text-align: center; font-size: 0.6875rem; line-height: 1.6; color: #6b7280;">
                    <div class="footer-msg" style="margin: 0.3125rem 0; font-style: italic;">Obrigado pela preferência!</div>
                    <div class="footer-msg" style="margin: 0.3125rem 0; font-style: italic;">Volte sempre!</div>
                    <div style="margin-top: 0.625rem; font-size: 0.625rem;">Sistema PDV - ${new Date().getFullYear()}</div>
                </div>
            `;
            
            console.log('✅ HTML do cupom gerado com sucesso');
            return html;
        } catch (error) {
            console.error('❌ Erro ao gerar HTML do cupom:', error);
            return '<p style="text-align: center; color: #dc2626; padding: 1.25rem;">Erro ao gerar comprovante</p>';
        }
    }

    // Função para imprimir cupom
    async imprimirCupom() {
        console.log('🖨️ ========== INÍCIO IMPRESSÃO ==========');
        console.log('🖨️ imprimirCupom chamado');
        
        try {
            const loadingEl = document.getElementById('loading');
            if (loadingEl) {
                loadingEl.style.display = 'block';
                console.log('✅ Loading exibido');
            }
            
            const cupomEl = document.getElementById('cupom-fiscal');
            if (!cupomEl) {
                console.error('❌ Elemento cupom-fiscal não encontrado no DOM');
                alert('Erro: Cupom não encontrado para impressão');
                return;
            }
            
            if (!cupomEl.innerHTML || cupomEl.innerHTML.trim() === '') {
                console.error('❌ Cupom está vazio');
                alert('Erro: Cupom está vazio');
                return;
            }
            
            await new Promise(resolve => setTimeout(resolve, 500));
            
            const printWindow = window.open('', '_blank', 'width=400,height=600,scrollbars=yes');
            
            if (!printWindow) {
                console.error('❌ Falha ao criar janela de impressão');
                alert('Erro: Não foi possível abrir janela de impressão. Verifique se o bloqueador de pop-ups está desabilitado.');
                return;
            }
            
            const printHTML = `
                <!DOCTYPE html>
                <html lang="pt-BR">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Comprovante de Venda - ${this.saleId || 'N/A'}</title>
                    <style>
                        * {
                            margin: 0;
                            padding: 0;
                            box-sizing: border-box;
                        }
                        body { 
                            font-family: 'Courier New', monospace; 
                            margin: 0; 
                            padding: 1.25rem; 
                            background: white;
                            color: black;
                            line-height: 1.4;
                        }
                        @media print { 
                            body { 
                                padding: 0.625rem; 
                                margin: 0;
                            } 
                            .no-print {
                                display: none !important;
                            }
                        }
                        @page {
                            margin: 0.625rem;
                            size: A4;
                        }
                    </style>
                </head>
                <body>
                    ${cupomEl.innerHTML}
                    <div class="no-print" style="text-align: center; margin-top: 1.25rem; padding: 0.625rem; background: #f0f0f0; border-radius: 0.3125rem;">
                        <p>Esta janela será fechada automaticamente após a impressão.</p>
                        <button onclick="window.print()" style="margin: 0.3125rem; padding: 0.625rem 1.25rem; background: #374151; color: white; border: none; border-radius: 0.3125rem; cursor: pointer;">🖨️ Imprimir Novamente</button>
                        <button onclick="window.close()" style="margin: 0.3125rem; padding: 0.625rem 1.25rem; background: #6b7280; color: white; border: none; border-radius: 0.3125rem; cursor: pointer;">✕ Fechar</button>
                    </div>
                </body>
                </html>
            `;
            
            printWindow.document.write(printHTML);
            printWindow.document.close();
            printWindow.focus();
            
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            printWindow.print();
            
            this.showSuccess('Comprovante enviado para impressão!');
            
            setTimeout(() => {
                try {
                    if (printWindow && !printWindow.closed) {
                        printWindow.close();
                    }
                } catch (error) {
                    console.warn('⚠️ Erro ao fechar janela automaticamente:', error);
                }
            }, 5000);
            
            setTimeout(() => {
                this.closeModal();
            }, 3000);
            
            console.log('🖨️ ========== IMPRESSÃO CONCLUÍDA ==========');
            
        } catch (error) {
            console.error('❌ Erro na impressão:', error);
            alert(`Erro ao imprimir comprovante: ${error.message}`);
        } finally {
            const loadingEl = document.getElementById('loading');
            if (loadingEl) {
                loadingEl.style.display = 'none';
            }
        }
    }

    // Função para baixar PDF
    async baixarPDF() {
        console.log('📄 ========== INÍCIO PDF ==========');
        
        const loadingEl = document.getElementById('loading');
        
        try {
            if (loadingEl) {
                loadingEl.style.display = 'block';
            }
            
            await new Promise(resolve => setTimeout(resolve, 500));
            
            if (typeof html2canvas === 'undefined') {
                throw new Error('Biblioteca html2canvas não carregada. Recarregue a página.');
            }
            
            if (typeof window.jspdf === 'undefined' && typeof jsPDF === 'undefined') {
                throw new Error('Biblioteca jsPDF não carregada. Recarregue a página.');
            }
            
            const cupomEl = document.getElementById('cupom-fiscal');
            if (!cupomEl) {
                throw new Error('Cupom não encontrado');
            }
            
            const canvas = await html2canvas(cupomEl, {
                scale: 2,
                useCORS: true,
                allowTaint: true,
                backgroundColor: '#ffffff',
                logging: false,
                width: cupomEl.scrollWidth,
                height: cupomEl.scrollHeight
            });
            
            let pdf;
            
            if (window.jspdf && window.jspdf.jsPDF) {
                pdf = new window.jspdf.jsPDF('p', 'mm', 'a4');
            } else if (typeof jsPDF !== 'undefined') {
                pdf = new jsPDF('p', 'mm', 'a4');
            } else {
                throw new Error('jsPDF não está disponível');
            }
            
            const imgData = canvas.toDataURL('image/png', 0.95);
            const imgWidth = 190;
            const imgHeight = (canvas.height * imgWidth) / canvas.width;
            
            pdf.addImage(imgData, 'PNG', 10, 10, imgWidth, imgHeight);
            
            const fileName = `comprovante_${this.saleId || new Date().getTime()}.pdf`;
            
            try {
                pdf.save(fileName);
            } catch (saveError) {
                const pdfBlob = pdf.output('blob');
                const url = URL.createObjectURL(pdfBlob);
                const a = document.createElement('a');
                a.href = url;
                a.download = fileName;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }
            
            this.showSuccess('PDF baixado com sucesso!');
            
            setTimeout(() => {
                this.closeModal();
            }, 3000);
            
        } catch (error) {
            console.error('❌ Erro no PDF:', error);
            
            let errorMessage = 'Erro ao gerar PDF: ';
            if (error.message.includes('html2canvas')) {
                errorMessage += 'Problema na captura da imagem.';
            } else if (error.message.includes('jsPDF')) {
                errorMessage += 'Problema na geração do PDF.';
            } else {
                errorMessage += error.message;
            }
            
            alert(errorMessage);
        } finally {
            if (loadingEl) {
                loadingEl.style.display = 'none';
            }
        }
    }

    // Função para enviar via WhatsApp
    async enviarWhatsApp() {
        console.log('💬 ========== INÍCIO WHATSAPP ==========');
        
        try {
            if (typeof html2canvas === 'undefined') {
                alert('Biblioteca html2canvas não carregada. Recarregue a página.');
                return;
            }
            
            const loadingEl = document.getElementById('loading');
            if (loadingEl) {
                loadingEl.style.display = 'block';
            }
            
            const cupomEl = document.getElementById('cupom-fiscal');
            if (!cupomEl) {
                alert('Cupom não encontrado');
                return;
            }
            
            const canvas = await html2canvas(cupomEl, {
                scale: 2,
                useCORS: true,
                backgroundColor: '#ffffff'
            });
            
            canvas.toBlob(async (blob) => {
                try {
                    await navigator.clipboard.write([
                        new ClipboardItem({ 'image/png': blob })
                    ]);
                    
                    this.showSuccess('Imagem copiada! Cole no WhatsApp com Ctrl+V');
                    
                    if (this.customerData && this.customerData.telefone) {
                        const phone = this.customerData.telefone.replace(/\D/g, '');
                        const message = encodeURIComponent('Segue o comprovante da sua compra:');
                        const whatsappUrl = `https://wa.me/55${phone}?text=${message}`;
                        window.open(whatsappUrl, '_blank');
                        
                        setTimeout(() => {
                            this.closeModal();
                        }, 3000);
                    } else {
                        window.open('https://web.whatsapp.com/', '_blank');
                        
                        setTimeout(() => {
                            this.closeModal();
                        }, 3000);
                    }
                    
                } catch (clipboardError) {
                    if (this.customerData && this.customerData.telefone) {
                        const phone = this.customerData.telefone.replace(/\D/g, '');
                        const message = encodeURIComponent('Segue o comprovante da sua compra (imagem será enviada separadamente):');
                        const whatsappUrl = `https://wa.me/55${phone}?text=${message}`;
                        window.open(whatsappUrl, '_blank');
                    } else {
                        window.open('https://web.whatsapp.com/', '_blank');
                    }
                    
                    alert('Não foi possível copiar a imagem automaticamente. Salve a imagem manualmente e envie pelo WhatsApp.');
                }
            }, 'image/png');
            
        } catch (error) {
            console.error('❌ Erro no WhatsApp:', error);
            alert('Erro ao processar imagem para WhatsApp');
        } finally {
            const loadingEl = document.getElementById('loading');
            if (loadingEl) loadingEl.style.display = 'none';
        }
    }

    // Função para mostrar mensagem de sucesso
    showSuccess(message) {
        const successEl = document.getElementById('success-msg');
        if (successEl) {
            successEl.textContent = message;
            successEl.style.display = 'block';
            setTimeout(() => {
                successEl.style.display = 'none';
            }, 3000);
        }
    }
}

// Instância global
const comprovanteModal = new ComprovanteModal();

// Expor a instância globalmente
window.comprovanteModal = comprovanteModal;

// Função global para compatibilidade
window.openComprovanteModal = function(data) {
    comprovanteModal.openComprovante(data);
};

// Função para carregar bibliotecas de forma assíncrona
function loadLibrariesAsync() {
    return new Promise((resolve, reject) => {
        const promises = [];
        
        if (typeof html2canvas === 'undefined') {
            const promise1 = new Promise((res, rej) => {
                const script1 = document.createElement('script');
                script1.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
                script1.onload = () => res();
                script1.onerror = () => rej(new Error('Falha ao carregar html2canvas'));
                document.head.appendChild(script1);
            });
            promises.push(promise1);
        }
        
        if (typeof jsPDF === 'undefined' && typeof window.jspdf === 'undefined') {
            const promise2 = new Promise((res, rej) => {
                const script2 = document.createElement('script');
                script2.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
                script2.onload = () => {
                    setTimeout(() => {
                        if (typeof window.jspdf !== 'undefined' || typeof jsPDF !== 'undefined') {
                            res();
                        } else {
                            rej(new Error('jsPDF não está disponível após carregamento'));
                        }
                    }, 100);
                };
                script2.onerror = () => rej(new Error('Falha ao carregar jsPDF'));
                document.head.appendChild(script2);
            });
            promises.push(promise2);
        }
        
        if (promises.length === 0) {
            resolve();
        } else {
            Promise.all(promises)
                .then(() => resolve())
                .catch(reject);
        }
    });
}

// Função para verificar se as bibliotecas estão disponíveis
function checkLibrariesAvailable() {
    const html2canvasOk = typeof html2canvas !== 'undefined';
    const jsPDFOk = typeof window.jspdf !== 'undefined' || typeof jsPDF !== 'undefined';
    
    console.log('📊 Status das bibliotecas:', {
        html2canvas: html2canvasOk ? '✅' : '❌',
        jsPDF: jsPDFOk ? '✅' : '❌'
    });
    
    return html2canvasOk && jsPDFOk;
}

// Carregar bibliotecas
loadLibrariesAsync()
    .then(() => {
        console.log('🚀 comprovante-modal.js carregado completamente');
    })
    .catch(error => {
        console.error('❌ Erro ao carregar bibliotecas:', error);
    });

// Expor função de verificação globalmente
window.checkLibrariesAvailable = checkLibrariesAvailable;
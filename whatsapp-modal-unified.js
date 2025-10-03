// ===== MODAL WHATSAPP UNIFICADO - GESTÃO DE CLIENTES E CASHBACK =====

class WhatsAppModalUnified {
    constructor() {
        this.modal = null;
        this.currentClient = null;
        this.currentMessage = '';
        this.currentTemplate = '';
        this.currentMessageType = 'boas-vindas';
        this.isEditing = false;
        this.originalMessage = '';
        this.currentSlot = 1;
        this.supabaseClient = null;
        this.customData = {}; // Armazenar dados customizados
        this.init();
    }

    init() {
        this.createModal();
        this.setupEventListeners();
        this.initSupabase();
    }

    initSupabase() {
        try {
            this.supabaseClient = window.supabaseClient || supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        } catch (error) {
            console.error('Erro ao inicializar Supabase para WhatsApp:', error);
        }
    }

    createModal() {
        const modalHTML = `
            <div id="whatsapp-modal" class="whatsapp-modal-overlay" style="display: none;">
                <div class="whatsapp-modal-container">
                    <div class="whatsapp-modal-header">
                        <div class="whatsapp-header-info">
                            <div class="whatsapp-icon">
                                <i class="fab fa-whatsapp"></i>
                            </div>
                            <div class="whatsapp-title">
                                <h3>Enviar WhatsApp</h3>
                                <p id="whatsapp-client-info">Selecione uma mensagem</p>
                            </div>
                        </div>
                        <button class="whatsapp-close-btn" id="close-whatsapp-modal">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>

                    <div class="whatsapp-modal-body">
                        <!-- Informações do Cliente -->
                        <div class="client-info-section">
                            <div class="client-avatar">
                                <i class="fas fa-user"></i>
                            </div>
                            <div class="client-details">
                                <h4 id="modal-client-name">Nome do Cliente</h4>
                                <p id="modal-client-phone">Telefone</p>
                                <p id="modal-client-status">Status do Cliente</p>
                                <div id="modal-client-cashback" style="display: none;">
                                    <p class="cashback-info">
                                        <i class="fas fa-piggy-bank"></i>
                                        Saldo Cashback: <span id="client-cashback-value">R$ 0,00</span>
                                    </p>
                                </div>
                            </div>
                        </div>

                        <!-- Tipos de Mensagem -->
                        <div class="message-types">
                            <h5>Selecione o tipo de mensagem:</h5>
                            <div class="message-type-buttons">
                                <button class="message-type-btn active" data-type="boas-vindas">
                                    <i class="fas fa-heart"></i>
                                    <span>Boas Vindas</span>
                                </button>
                                <button class="message-type-btn" data-type="promocao">
                                    <i class="fas fa-percent"></i>
                                    <span>Promoção</span>
                                </button>
                                <button class="message-type-btn" data-type="aniversario">
                                    <i class="fas fa-birthday-cake"></i>
                                    <span>Aniversário</span>
                                </button>
                                <button class="message-type-btn" data-type="recompra">
                                    <i class="fas fa-refresh"></i>
                                    <span>Recompra</span>
                                </button>
                                <button class="message-type-btn" data-type="cashback" style="display: none;">
                                    <i class="fas fa-piggy-bank"></i>
                                    <span>Cashback</span>
                                </button>
                                <button class="message-type-btn" data-type="cobranca">
                                    <i class="fas fa-money-bill-wave"></i>
                                    <span>Cobrança</span>
                                </button>
                                <button class="message-type-btn" data-type="personalizada">
                                    <i class="fas fa-edit"></i>
                                    <span>Personalizada</span>
                                </button>
                            </div>
                        </div>

                        <!-- Preview da Mensagem -->
                        <div class="message-preview">
                            <div class="preview-header">
                                <h5>Preview da mensagem:</h5>
                                <div class="preview-actions">
                                    <div class="saved-messages">
                                        <button class="saved-msg-btn active" data-slot="1" title="Mensagem salva 1">1</button>
                                        <button class="saved-msg-btn" data-slot="2" title="Mensagem salva 2">2</button>
                                        <button class="saved-msg-btn" data-slot="3" title="Mensagem salva 3">3</button>
                                    </div>
                                    <button class="btn-edit-message" id="btn-edit-message" title="Editar mensagem">
                                        <i class="fas fa-edit"></i>
                                        Editar
                                    </button>
                                </div>
                            </div>
                            <div class="whatsapp-chat-preview">
                                <div class="chat-bubble">
                                    <div id="message-preview-text">Selecione um tipo de mensagem acima</div>
                                    <div class="chat-time">agora</div>
                                </div>
                            </div>
                        </div>

                        <!-- Área de Edição -->
                        <div class="message-editor" id="message-editor" style="display: none;">
                            <div class="editor-header">
                                <h5>Editar mensagem:</h5>
                                <div class="editor-actions">
                                    <button class="btn-save-template" id="btn-save-template" title="Salvar mensagem">
                                        <i class="fas fa-save"></i>
                                        Salvar
                                    </button>
                                    <button class="btn-cancel-edit" id="btn-cancel-edit" title="Cancelar edição">
                                        <i class="fas fa-times"></i>
                                    </button>
                                </div>
                            </div>
                            <textarea id="custom-message" placeholder="Digite sua mensagem personalizada aqui..."></textarea>
                            <div class="placeholder-help">
                                <small><strong>Dica:</strong> Use <code>{{NOME_CLIENTE}}</code> para inserir o nome do cliente e <code>{{SALDO_CASHBACK}}</code> para o saldo</small>
                            </div>
                            <div class="message-tools">
                                <div class="tool-section">
                                    <span class="tool-label">Símbolos:</span>
                                    <button class="tool-btn text-format-btn" onclick="insertTextUnified('★')" title="Estrela">★</button>
                                    <button class="tool-btn text-format-btn" onclick="insertTextUnified('✓')" title="Check">✓</button>
                                    <button class="tool-btn text-format-btn" onclick="insertTextUnified('•')" title="Bullet">•</button>
                                    <button class="tool-btn text-format-btn" onclick="insertTextUnified('→')" title="Seta">→</button>
                                    <button class="tool-btn text-format-btn" onclick="insertTextUnified('▪')" title="Quadrado">▪</button>
                                    <button class="tool-btn text-format-btn" onclick="insertTextUnified('◆')" title="Losango">◆</button>
                                </div>
                                <div class="tool-section">
                                    <span class="tool-label">Placeholders:</span>
                                    <button class="tool-btn placeholder-btn" onclick="insertPlaceholderUnified('{{NOME_CLIENTE}}')">Nome</button>
                                    <button class="tool-btn placeholder-btn" onclick="insertPlaceholderUnified('{{SALDO_CASHBACK}}')" id="cashback-placeholder-btn" style="display: none;">Saldo</button>
                                    <button class="tool-btn placeholder-btn" onclick="insertPlaceholderUnified('{{VALOR_PARCELA}}')" id="cobranca-valor-btn" style="display: none;">Valor</button>
                                    <button class="tool-btn placeholder-btn" onclick="insertPlaceholderUnified('{{DIAS_ATRASO}}')" id="cobranca-dias-btn" style="display: none;">Dias</button>
                                    <button class="tool-btn placeholder-btn" onclick="insertPlaceholderUnified('{{DATA_VENCIMENTO}}')" id="cobranca-data-btn" style="display: none;">Vencimento</button>
                                    <button class="tool-btn placeholder-btn" onclick="insertPlaceholderUnified('{{QTD_PARCELAS}}')" id="cobranca-qtd-btn" style="display: none;">Qtd</button>
                                </div>
                                <span class="char-count">0/1000</span>
                            </div>
                        </div>
                    </div>

                    <div class="whatsapp-modal-footer">
                        <button class="btn-cancel" id="cancel-whatsapp">
                            <i class="fas fa-times"></i>
                            Cancelar
                        </button>
                        <button class="btn-send-whatsapp" id="send-whatsapp-message">
                            <i class="fab fa-whatsapp"></i>
                            Enviar WhatsApp
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);
        this.modal = document.getElementById('whatsapp-modal');
    }

    setupEventListeners() {
        // Fechar modal
        document.getElementById('close-whatsapp-modal').addEventListener('click', () => this.close());
        document.getElementById('cancel-whatsapp').addEventListener('click', () => this.close());

        // Fechar ao clicar fora
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) this.close();
        });

        // Botão de editar mensagem
        document.getElementById('btn-edit-message').addEventListener('click', () => this.enableEditMode());

        // Botão de cancelar edição
        document.getElementById('btn-cancel-edit').addEventListener('click', () => this.cancelEdit());

        // Botão de salvar template
        document.getElementById('btn-save-template').addEventListener('click', () => this.saveCurrentSlotMessage());

        // Tipos de mensagem
        document.querySelectorAll('.message-type-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                document.querySelectorAll('.message-type-btn').forEach(b => b.classList.remove('active'));
                e.target.closest('.message-type-btn').classList.add('active');
                
                const type = e.target.closest('.message-type-btn').dataset.type;
                this.currentMessageType = type;
                
                // Mostrar/esconder placeholder do cashback
                this.toggleCashbackFeatures(type === 'cashback');
                
                // Recarregar estado dos slots para o novo tipo
                await this.loadSavedMessagesState();
                
                // Selecionar slot 1 do novo tipo
                await this.selectSlot(1);
            });
        });

        // Enviar mensagem
        document.getElementById('send-whatsapp-message').addEventListener('click', () => this.sendMessage());

        // Editor personalizado
        document.getElementById('custom-message').addEventListener('input', (e) => {
            this.updateCharCount();
            this.updateCustomPreview(e.target.value);
        });

        // Botões de mensagens salvas
        document.querySelectorAll('.saved-msg-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const slot = parseInt(e.target.dataset.slot);
                await this.selectSlot(slot);
            });
        });

        // ESC para fechar
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.modal.style.display === 'flex') {
                this.close();
            }
        });
    }

    async open(clientData, messageType = null, customData = {}) {
        this.currentClient = clientData;
        this.customData = customData; // Armazenar dados customizados
        // Detectar automaticamente o tipo de mensagem quando não informado
        const inferredType = messageType || this.inferMessageTypeFromContext(customData);
        this.currentMessageType = inferredType;
        
        // Atualizar informações do cliente
        document.getElementById('modal-client-name').textContent = clientData.nome;
        document.getElementById('modal-client-phone').textContent = this.formatPhone(clientData.telefone);
        document.getElementById('modal-client-status').textContent = clientData.tipo_cliente_display || 'Cliente';
        document.getElementById('whatsapp-client-info').textContent = `Para: ${clientData.nome}`;

        // Se for mensagem de cashback, buscar saldo e mostrar informações específicas
        if (messageType === 'cashback') {
            await this.loadClientCashback(clientData.id);
            this.showCashbackButton();
        } else {
          //  this.hideCashbackFeatures();
        }

        // Selecionar tipo de mensagem
        document.querySelectorAll('.message-type-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelector(`[data-type="${inferredType}"]`)?.classList.add('active');

        // Mostrar/esconder recursos específicos
        if (inferredType === 'cashback') {
            this.showCashbackButton();
        } else {
            this.hideCashbackFeatures();
        }

        if (inferredType === 'cobranca') {
            this.showCobrancaButtons();
        } else {
            this.hideCobrancaButtons();
        }

        // Carregar estado das mensagens salvas
        await this.loadSavedMessagesState();

        // Selecionar slot 1 por padrão e carregar mensagem do tipo atual
        await this.selectSlot(1);

        // Mostrar modal
        this.modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }

    // Detecta o tipo de mensagem pelo contexto/página atual
    inferMessageTypeFromContext(customData = {}) {
        try {
            if (customData && typeof customData.messageType === 'string') {
                return customData.messageType;
            }
            const path = (window.location.pathname || '').toLowerCase();
            if (path.includes('crediario') || path.includes('pagamento') || path.includes('contas-financeiro')) {
                return 'cobranca';
            }
            if (path.includes('cashback')) {
                return 'cashback';
            }
            if (path.includes('relatorio-vendas') && path.includes('freq')) {
                return 'recompra';
            }
            if (path.includes('nova-venda')) {
                return 'promocao';
            }
            if (path.includes('clientes') || path.includes('gestao-clientes')) {
                return 'boas-vindas';
            }
        } catch (e) {
            console.warn('Não foi possível inferir o tipo de mensagem pelo contexto:', e);
        }
        return 'boas-vindas';
    }

    async loadClientCashback(clienteId) {
        try {
            if (!this.supabaseClient || !window.currentCompanyId) {
                return;
            }

            // Buscar último saldo do cliente na tabela de cashback
            const { data, error } = await this.supabaseClient
                .from('cashback')
                .select('saldo_atual')
                .eq('cliente_id', clienteId)
                .eq('id_empresa', window.currentCompanyId)
                .order('created_at', { ascending: false })
                .limit(1);

            if (error) throw error;

            const saldo = data && data.length > 0 ? parseFloat(data[0].saldo_atual || 0) : 0;
            
            // Atualizar interface
            document.getElementById('client-cashback-value').textContent = this.formatCurrency(saldo);
            document.getElementById('modal-client-cashback').style.display = 'block';
            
            // Armazenar saldo no cliente atual
            this.currentClient.saldoCashback = saldo;
            
        } catch (error) {
            console.error('Erro ao carregar cashback do cliente:', error);
            // Em caso de erro, mostrar R$ 0,00
            document.getElementById('client-cashback-value').textContent = 'R$ 0,00';
            document.getElementById('modal-client-cashback').style.display = 'block';
            this.currentClient.saldoCashback = 0;
        }
    }

    showCashbackButton() {
        const cashbackBtn = document.querySelector('[data-type="cashback"]');
        if (cashbackBtn) {
            cashbackBtn.style.display = 'flex';
        }
    }

    hideCashbackFeatures() {
        // Esconder botão cashback
        const cashbackBtn = document.querySelector('[data-type="cashback"]');
        if (cashbackBtn) {
            cashbackBtn.style.display = 'none';
        }
        
        // Esconder info de cashback
        document.getElementById('modal-client-cashback').style.display = 'none';
        
        // Esconder placeholder de saldo
        document.getElementById('cashback-placeholder-btn').style.display = 'none';
    }

    showCobrancaButtons() {
        const cobrancaButtons = [
            'cobranca-valor-btn',
            'cobranca-dias-btn', 
            'cobranca-data-btn',
            'cobranca-qtd-btn'
        ];
        
        cobrancaButtons.forEach(btnId => {
            const btn = document.getElementById(btnId);
            if (btn) {
                btn.style.display = 'inline-block';
            }
        });
    }

    hideCobrancaButtons() {
        const cobrancaButtons = [
            'cobranca-valor-btn',
            'cobranca-dias-btn',
            'cobranca-data-btn',
            'cobranca-qtd-btn'
        ];
        
        cobrancaButtons.forEach(btnId => {
            const btn = document.getElementById(btnId);
            if (btn) {
                btn.style.display = 'none';
            }
        });
    }

    toggleCashbackFeatures(show) {
        const cashbackPlaceholder = document.getElementById('cashback-placeholder-btn');
        if (show) {
            cashbackPlaceholder.style.display = 'inline-flex';
        } else {
            cashbackPlaceholder.style.display = 'none';
        }
    }

    close() {
        this.modal.style.display = 'none';
        document.body.style.overflow = '';
        this.currentClient = null;
        this.currentMessage = '';
        this.currentSlot = 1;
        
        // Resetar form
        document.getElementById('custom-message').value = '';
        document.getElementById('message-editor').style.display = 'none';
        
        // Remover seleção de slots
        document.querySelectorAll('.saved-msg-btn').forEach(btn => btn.classList.remove('active'));
        
        // Esconder recursos de cashback
       //  this.hideCashbackFeatures();
  
    }

    async selectSlot(slotNumber) {
        try {
            // Atualizar slot atual
            this.currentSlot = slotNumber;
            
            // Atualizar visual dos botões
            document.querySelectorAll('.saved-msg-btn').forEach(btn => {
                btn.classList.remove('active');
            });
            document.querySelector(`[data-slot="${slotNumber}"]`).classList.add('active');
            
            // Buscar mensagem salva para o tipo atual + slot
            const savedMessage = await window.WhatsAppSupa.buscarMensagemSlot(this.currentMessageType, slotNumber);
            
            if (savedMessage) {
                // Carregar mensagem salva do slot
                this.currentTemplate = savedMessage;
                this.currentMessage = this.replacePlaceholders(savedMessage, this.customData);
                
                // Atualizar preview
                const preview = document.getElementById('message-preview-text');
                preview.innerHTML = this.formatMessagePreview(this.currentMessage);
            } else {
                // Slot vazio - carregar template padrão específico do tipo + slot
                const defaultTemplate = this.getMessageTemplates(this.currentMessageType, slotNumber, this.customData);
                this.currentTemplate = defaultTemplate;
                this.currentMessage = this.replacePlaceholders(defaultTemplate, this.customData);
                
                // Atualizar preview
                const preview = document.getElementById('message-preview-text');
                preview.innerHTML = this.formatMessagePreview(this.currentMessage);
            }
            
            // Esconder editor
            document.getElementById('message-editor').style.display = 'none';
            
        } catch (error) {
            console.error('Erro ao selecionar slot:', error);
            // Fallback: carregar template padrão do tipo atual + slot
            const defaultTemplate = this.getMessageTemplates(this.currentMessageType, slotNumber, this.customData) || '';
            this.currentTemplate = defaultTemplate;
            this.currentMessage = this.replacePlaceholders(defaultTemplate, this.customData);
            const preview = document.getElementById('message-preview-text');
            preview.innerHTML = this.formatMessagePreview(this.currentMessage) || 'Digite sua mensagem...';
            this.showNotification('Carregando template padrão (sem mensagens salvas)', 'warning');
        }
    }

    enableEditMode() {
        const editor = document.getElementById('message-editor');
        const textarea = document.getElementById('custom-message');
        
        // Salvar template original para poder cancelar
        this.originalMessage = this.currentTemplate || this.currentMessage;
        
        // Mostrar editor
        editor.style.display = 'block';
        
        // Se tem mensagem carregada, preencher textarea
        if (this.currentTemplate) {
            textarea.value = this.currentTemplate;
        } else {
            textarea.value = '';
        }
        
        // Focar no textarea
        textarea.focus();
        
        // Atualizar contador
        this.updateCharCount();
        
        // Marcar como editando
        this.isEditing = true;
    }

    async saveCurrentSlotMessage() {
        try {
            const textarea = document.getElementById('custom-message');
            const message = textarea.value.trim();
            
            if (!message) {
                this.showNotification('Digite uma mensagem para salvar', 'warning');
                return;
            }

            if (!window.WhatsAppSupa) {
                this.showNotification('Erro: Sistema não carregado', 'error');
                return;
            }

            // Mostrar loading
            const saveBtn = document.getElementById('btn-save-template');
            const originalText = saveBtn.innerHTML;
            saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';
            saveBtn.disabled = true;

            // Salvar usando nova estrutura: tipo_botao + slot
            const result = await window.WhatsAppSupa.salvarMensagemSlot(this.currentMessageType, this.currentSlot, message);

            if (result.success) {
                // Atualizar template e mensagem atual
                this.currentTemplate = message;
                this.currentMessage = this.replacePlaceholders(message);
                
                // Atualizar estado visual do botão do slot
                this.updateSavedMessageButton(this.currentSlot, true);
                
                // Esconder editor e atualizar preview
                document.getElementById('message-editor').style.display = 'none';
                const preview = document.getElementById('message-preview-text');
                preview.innerHTML = this.formatMessagePreview(this.currentMessage);
                
                // Resetar estado de edição
                this.isEditing = false;
                this.originalMessage = '';
                
                this.showNotification(`${this.getMessageTypeTitle(this.currentMessageType)} salva no slot ${this.currentSlot}!`, 'success');
            } else {
                throw new Error(result.error || 'Erro ao salvar mensagem');
            }

        } catch (error) {
            console.error('Erro ao salvar mensagem:', error);
            this.showNotification('Erro ao salvar: ' + error.message, 'error');
        } finally {
            // Restaurar botão
            const saveBtn = document.getElementById('btn-save-template');
            saveBtn.innerHTML = '<i class="fas fa-save"></i> Salvar';
            saveBtn.disabled = false;
        }
    }

    updateCustomPreview(message) {
        const preview = document.getElementById('message-preview-text');
        this.currentMessage = this.replacePlaceholders(message);
        preview.innerHTML = this.formatMessagePreview(this.currentMessage) || 'Digite sua mensagem...';
    }

    updateCharCount() {
        const textarea = document.getElementById('custom-message');
        const counter = document.querySelector('.char-count');
        const count = textarea.value.length;
        counter.textContent = `${count}/1000`;
        
        if (count > 1000) {
            counter.style.color = '#f44336';
            textarea.value = textarea.value.substring(0, 1000);
        } else {
            counter.style.color = '#666';
        }
    }

    getMessageTemplates(type, slot = 1, customData = {}) {
        const templates = {
            'boas-vindas': {
                1: `Olá {{NOME_CLIENTE}}! ★

Que bom ter você como nosso cliente! Esperamos que tenha gostado da sua experiência conosco.

• Temos sempre novidades e produtos de qualidade
• Nossa equipe está sempre à disposição
• Estamos aqui para qualquer dúvida

Abraços!`,
                2: `Oi {{NOME_CLIENTE}}! ★

Seja muito bem-vindo à nossa família de clientes! 

✓ Atendimento personalizado
✓ Produtos selecionados especialmente para você
→ OFERTA ESPECIAL: 10% de desconto na próxima compra!

◆ Aproveite esta oportunidade única!

Um abraço!`,
                3: `{{NOME_CLIENTE}}, muito obrigado pela confiança! ★

É um prazer tê-lo como cliente VIP.

▪ Produtos premium com preços especiais
▪ Atendimento prioritário 
▪ Frete grátis em compras acima de R$ 100

→ SUPER OFERTA: 20% OFF + brinde exclusivo!

◆ Válido apenas para clientes especiais como você!

Conte conosco sempre!`
            },
            'promocao': {
                1: `{{NOME_CLIENTE}}, oferta especial para você! ★

Preparamos descontos pensando nos nossos melhores clientes.

✓ 15% OFF em produtos selecionados
✓ Condições especiais de pagamento
→ Promoção válida por tempo limitado!

◆ Não perca essa oportunidade!`,
                2: `Atenção {{NOME_CLIENTE}}! ★

SUPER PROMOÇÃO RELÂMPAGO!

▪ ATÉ 30% OFF em toda loja
▪ Parcelamento sem juros
▪ Frete grátis para todo Brasil
▪ Brinde exclusivo nas compras acima de R$ 150

→ APENAS 48 HORAS para aproveitar!

◆ Como cliente VIP, você tem acesso antecipado!

Corre que vai acabar!`,
                3: `{{NOME_CLIENTE}}, liquidação imperdível! ★

*** MEGAPROMOÇÃO ***

▪ Até 50% OFF em produtos selecionados
▪ Leve 3 pague 2 em itens participantes
▪ Cashback de 5% para próximas compras
▪ Frete grátis acima de R$ 99

→ Últimas peças com preços incríveis!

◆ Oferta válida enquanto durarem os estoques!`
            },
            'aniversario': {
                1: `Feliz aniversário, {{NOME_CLIENTE}}! ★

Que este novo ano de vida seja incrível!

✓ Saúde em primeiro lugar
✓ Realizações pessoais e profissionais
→ PRESENTE ESPECIAL: 25% de desconto no seu produto favorito!

◆ Válido por 7 dias para você celebrar!

Venha comemorar conosco!`,
                2: `{{NOME_CLIENTE}}, hoje é dia de festa! ★

Parabéns pelo seu aniversário!

▪ PRESENTE EXCLUSIVO: Produto grátis à sua escolha
▪ 40% OFF em toda sua compra de aniversário  
▪ Frete grátis especial
▪ Atendimento VIP durante todo o mês

→ Oferta única do ano para aniversariantes!

◆ Porque clientes especiais merecem dias especiais!

Aguardamos você para a surpresa!`,
                3: `★ Parabéns {{NOME_CLIENTE}}! ★

Hoje é seu dia especial e preparamos algo único!

▪ MEGADESCONTO de aniversário: 50% OFF
▪ Kit presente surpresa grátis
▪ Cashback dobrado: 10% para próximas compras
▪ Condições especiais de pagamento
▪ Frete grátis em qualquer valor

→ Válido apenas no mês do seu aniversário!

◆ Venha comemorar conosco e aproveitar!`
            },
            'recompra': {
                1: `{{NOME_CLIENTE}}, sentimos sua falta! ★

Já faz um tempo que você não aparece por aqui.

{{PRODUTO_INFO}}

✓ Produtos novos chegaram
✓ Preços especiais para clientes fiéis
→ OFERTA RETORNO: 12% OFF para você voltar!

{{FREQUENCIA_INFO}}

◆ Que tal dar uma passadinha?`,
                2: `Oi {{NOME_CLIENTE}}! ★

Notei que pode estar na hora de repor seus produtos favoritos.

{{PRODUTO_INFO}}

▪ SUPER OFERTA DE RECOMPRA: 25% OFF
▪ Entrega express em 24h
▪ Produto reservado especialmente para você
▪ Parcelamento facilitado

{{FREQUENCIA_INFO}}

→ Oferta válida apenas por 72 horas!

◆ Cliente fiel merece condições especiais!`,
                3: `{{NOME_CLIENTE}}, hora da reposição! ★

Baseado no seu histórico, chegou a hora ideal para recomprar.

{{PRODUTO_INFO}}

▪ DESCONTO PROGRESSIVO: quanto mais comprar, maior o desconto
▪ Até 35% OFF + frete grátis
▪ Cashback de 8% para futuras compras
▪ Produto novo similar com 40% OFF
▪ Atendimento prioritário

{{FREQUENCIA_INFO}}

→ Oferta personalizada válida por 5 dias!

◆ Antecipe-se e economize mais!`
            },
            'cashback': {
                1: `Olá {{NOME_CLIENTE}}! ★

Você tem cashback disponível para usar!

$ *Saldo atual: {{SALDO_CASHBACK}}*

✓ Use na sua próxima compra
✓ Válido por 12 meses
✓ Pode ser usado parcialmente
→ Que tal aproveitar hoje mesmo?

◆ Dinheiro na conta é dinheiro no bolso!`,
                2: `{{NOME_CLIENTE}}, seu dinheiro está aqui! ★

$ *Você tem {{SALDO_CASHBACK}} em cashback!*

▪ Use junto com outros descontos
▪ Sem valor mínimo para utilizar
▪ Combine com promoções atuais
▪ Válido para qualquer produto

→ DICA: Use o cashback + desconto à vista = economia máxima!

◆ Venha resgatar o que é seu!`,
                3: `★ {{NOME_CLIENTE}}, cashback especial! ★

$ *Saldo disponível: {{SALDO_CASHBACK}}*

▪ BÔNUS EXCLUSIVO: +20% de cashback na próxima compra
▪ Use seu saldo atual + ganhe mais
▪ Oferta limitada para clientes VIP
▪ Acumule ainda mais vantagens
▪ Frete grátis ao usar cashback

→ Transforme seu cashback em ainda mais economia!

◆ Oferta válida por 48 horas!`
            },
            'cobranca': {
                1: `Olá {{NOME_CLIENTE}}! ★

Esperamos que esteja tudo bem com você!

• *Parcelas vencidas: {{QTD_PARCELAS}}*
• *Valor em atraso: {{VALOR_PARCELA}}*
• *Vencimento: {{DATA_VENCIMENTO}}*

Sabemos que imprevistos acontecem. Que tal regularizarmos hoje?

✓ Pague pelo PIX e ganhe 5% de desconto
✓ Parcelamos o valor em até 3x sem juros
✓ Atendimento personalizado para você

→ Estamos aqui para ajudar! Entre em contato.

◆ Conte sempre conosco!`,
                2: `{{NOME_CLIENTE}}, vamos resolver juntos? ★

• *Situação das parcelas:*
• *Quantidade: {{QTD_PARCELAS}} parcelas vencidas*
• *Valor em atraso: {{VALOR_PARCELA}}*
• *Venceu em: {{DATA_VENCIMENTO}}*
• *{{DIAS_ATRASO}} dias em atraso*

★ *OPORTUNIDADE ESPECIAL:*
▪ 10% de desconto à vista no PIX
▪ Renegociação com condições facilitadas
▪ Sem taxas adicionais para pagamento hoje
▪ Mantenha seu nome limpo

→ Ligue agora e resolva em 2 minutos!

◆ Sua tranquilidade é nossa prioridade!`,
                3: `*** {{NOME_CLIENTE}}, ATENÇÃO URGENTE! ***

⚠ *SITUAÇÃO CRÍTICA:*
• *Parcelas vencidas: {{QTD_PARCELAS}}*
• *Valor total em atraso: {{VALOR_PARCELA}}*
• *Vencimento: {{DATA_VENCIMENTO}}*
• *{{DIAS_ATRASO}} dias de atraso*

★ *ÚLTIMA OPORTUNIDADE:*
▪ 15% de desconto HOJE no PIX
▪ Evite negativação do CPF
▪ Última chance antes da cobrança jurídica
▪ Atendimento prioritário até 18h

*** *AÇÃO IMEDIATA NECESSÁRIA!* ***

→ Ligue AGORA: Não perca esta chance!

◆ Resolva hoje e durma tranquilo!`
            },
            'personalizada': {
                1: `Olá {{NOME_CLIENTE}}! ★

Digite aqui sua mensagem personalizada...

• Use os símbolos disponíveis
• Personalize conforme necessário

Abraços!`,
                2: `Oi {{NOME_CLIENTE}}! ★

Escreva sua mensagem customizada aqui...

✓ Adicione ofertas se necessário
→ Use chamadas para ação

◆ Torne sua mensagem única!`,
                3: `{{NOME_CLIENTE}}! ★

Crie sua mensagem única neste espaço...

▪ Máximo poder de persuasão
▪ Ofertas irresistíveis
▪ Urgência e exclusividade

→ Converta seu cliente!

◆ Mensagem de alto impacto!`
            }
        };

        const typeTemplates = templates[type] || templates['personalizada'];
        return typeTemplates[slot] || typeTemplates[1];
    }

    replacePlaceholders(message, customData = {}) {
        if (!message) return '';
        
        console.log('Debug replacePlaceholders - customData:', customData);
        console.log('Debug replacePlaceholders - currentClient:', this.currentClient);
        
        const clientName = this.currentClient?.nome || 'Cliente';
        const saldoCashback = this.currentClient?.saldoCashback || 0;
        const productName = customData.produto || '';
        const frequency = customData.frequencia || '';
        const valorParcela = customData.valorParcela || this.currentClient?.valorParcela || 0;
        const diasAtraso = customData.diasAtraso || this.currentClient?.diasAtraso || 0;
        const dataVencimento = customData.dataVencimento || this.currentClient?.dataVencimento || '';
        const qtdParcelas = customData.qtdParcelas || this.currentClient?.qtdParcelas || 0;
        
        console.log('Debug replacePlaceholders - valores finais:', {
            valorParcela, diasAtraso, dataVencimento, qtdParcelas
        });
        
        let processedMessage = message;
        
        // Se não há parcelas vencidas, ajustar a mensagem (APENAS para 'cobranca')
        if (this.currentMessageType === 'cobranca' && qtdParcelas === 0 && valorParcela === 0) {
            processedMessage = `Olá ${clientName}! ★

Esperamos que esteja tudo bem com você!

✓ *Boa notícia!* Não há parcelas vencidas no momento.
• *Próximo vencimento:* ${dataVencimento}

Agradecemos por manter seus pagamentos em dia! 

★ *Lembrete amigável:*
▪ Fique atento ao próximo vencimento
▪ Pague pelo PIX e ganhe 5% de desconto
▪ Atendimento personalizado sempre disponível

→ Conte sempre conosco!

◆ Obrigado pela confiança!`;
            return processedMessage;
        }
        
        // Substituir nome do cliente
        processedMessage = processedMessage.replace(/\{\{NOME_CLIENTE\}\}/g, clientName);
        
        // Substituir saldo de cashback
        processedMessage = processedMessage.replace(/\{\{SALDO_CASHBACK\}\}/g, this.formatCurrency(saldoCashback));
        
        // Substituir placeholders de cobrança
        processedMessage = processedMessage.replace(/\{\{VALOR_PARCELA\}\}/g, this.formatCurrency(valorParcela));
        processedMessage = processedMessage.replace(/\{\{DIAS_ATRASO\}\}/g, diasAtraso);
        processedMessage = processedMessage.replace(/\{\{DATA_VENCIMENTO\}\}/g, dataVencimento);
        processedMessage = processedMessage.replace(/\{\{QTD_PARCELAS\}\}/g, qtdParcelas);
        
        // Substituir informações de produto
        if (productName) {
            processedMessage = processedMessage.replace(/\{\{PRODUTO_INFO\}\}/g, 
                `Notei que já faz um tempo desde sua última compra do *${productName}*.`);
        } else {
            processedMessage = processedMessage.replace(/\{\{PRODUTO_INFO\}\}/g, 
                'Notei que já faz um tempo desde sua última compra.');
        }
        
        // Substituir informações de frequência
        if (frequency) {
            processedMessage = processedMessage.replace(/\{\{FREQUENCIA_INFO\}\}/g, 
                `Considerando a frequência de uso de *${frequency}*, imagino que você já deve estar precisando repor!`);
        } else {
            processedMessage = processedMessage.replace(/\{\{FREQUENCIA_INFO\}\}/g, 
                'Que tal dar uma passadinha para repor seus produtos favoritos?');
        }
        
        return processedMessage;
    }

    formatMessagePreview(message) {
        return message
            .replace(/\*([^*]+)\*/g, '<strong>$1</strong>')
            .replace(/\n/g, '<br>');
    }

    formatPhone(phone) {
        if (!phone) return 'Telefone não informado';
        const clean = phone.replace(/\D/g, '');
        if (clean.length === 11) {
            return `(${clean.substring(0,2)}) ${clean.substring(2,7)}-${clean.substring(7)}`;
        }
        return phone;
    }

    formatCurrency(value) {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(value || 0);
    }

    cancelEdit() {
        const editor = document.getElementById('message-editor');
        const textarea = document.getElementById('custom-message');
        
        // Esconder editor
        editor.style.display = 'none';
        
        // Restaurar preview original se estava editando
        if (this.isEditing && this.originalMessage) {
            this.currentTemplate = this.originalMessage;
            this.currentMessage = this.replacePlaceholders(this.originalMessage);
            
            // Atualizar preview
            const preview = document.getElementById('message-preview-text');
            preview.innerHTML = this.formatMessagePreview(this.currentMessage);
        }
        
        // Limpar textarea
        textarea.value = '';
        
        // Marcar como não editando
        this.isEditing = false;
        this.originalMessage = '';
    }

    getMessageTypeTitle(type) {
        const titles = {
            'boas-vindas': 'Boas Vindas',
            'promocao': 'Promoção Especial',
            'aniversario': 'Feliz Aniversário',
            'recompra': 'Lembrete de Recompra',
            'cashback': 'Cashback Disponível',
            'cobranca': 'Cobrança',
            'personalizada': 'Mensagem Personalizada'
        };
        return titles[type] || 'Mensagem';
    }

    showNotification(message, type = 'info') {
        // Remover notificação existente
        const existing = document.querySelector('.whatsapp-notification');
        if (existing) {
            existing.remove();
        }

        const notification = document.createElement('div');
        notification.className = `whatsapp-notification ${type}`;
        
        const icons = {
            success: 'fa-check-circle',
            error: 'fa-exclamation-circle',
            warning: 'fa-exclamation-triangle',
            info: 'fa-info-circle'
        };
        
        notification.innerHTML = `
            <i class="fas ${icons[type]}"></i>
            ${message}
            <button onclick="this.parentElement.remove()" 
                    style="background: none; border: none; color: white; margin-left: auto; cursor: pointer; padding: 0.25rem;">
                <i class="fas fa-times"></i>
            </button>
        `;

        document.body.appendChild(notification);

        setTimeout(() => {
            if (notification.parentNode) {
                notification.style.animation = 'slideInNotification 0.3s ease-out reverse';
                setTimeout(() => notification.remove(), 300);
            }
        }, 5000);
    }

    sendMessage() {
        if (!this.currentClient || !this.currentClient.telefone) {
            this.showNotification('Cliente não possui telefone cadastrado', 'error');
            return;
        }

        const activeType = document.querySelector('.message-type-btn.active')?.dataset.type;
        
        if (activeType === 'personalizada') {
            const customMessage = document.getElementById('custom-message').value.trim();
            if (!customMessage) {
                this.showNotification('Digite uma mensagem personalizada', 'warning');
                return;
            }
            this.currentMessage = this.replacePlaceholders(customMessage);
        }

        if (!this.currentMessage) {
            this.showNotification('Selecione um tipo de mensagem', 'warning');
            return;
        }

        // Limpar e formatar telefone
        const cleanPhone = this.currentClient.telefone.replace(/\D/g, '');
        if (cleanPhone.length < 10) {
            this.showNotification('Número de telefone inválido', 'error');
            return;
        }

        const fullPhone = cleanPhone.startsWith('55') ? cleanPhone : '55' + cleanPhone;
        const encodedMessage = encodeURIComponent(this.currentMessage);
        const whatsappUrl = `https://wa.me/${fullPhone}?text=${encodedMessage}`;
        
        // Abrir WhatsApp
        window.open(whatsappUrl, '_blank');
        
        // Feedback e fechar modal
        this.showNotification(`Mensagem enviada para ${this.currentClient.nome}`, 'success');
        this.close();
    }

    updateSavedMessageButton(slot, hasMessage) {
        const btn = document.querySelector(`[data-slot="${slot}"]`);
        if (hasMessage) {
            btn.classList.add('has-message');
            btn.title = `Mensagem salva ${slot} (clique para carregar)`;
        } else {
            btn.classList.remove('has-message');
            btn.title = `Slot ${slot} vazio (clique para criar mensagem)`;
        }
    }

    async loadSavedMessagesState() {
        // Verificar quais slots têm mensagens salvas para o tipo atual
        for (let i = 1; i <= 3; i++) {
            let savedMessage = null;
            try {
                savedMessage = await window.WhatsAppSupa.buscarMensagemSlot(this.currentMessageType, i);
            } catch (e) {
                console.warn('WhatsAppSupa indisponível ao verificar slots:', e);
            }
            this.updateSavedMessageButton(i, !!savedMessage);
        }
        
        // Garantir que apenas o slot 1 esteja ativo por padrão
        document.querySelectorAll('.saved-msg-btn').forEach((btn, index) => {
            btn.classList.remove('active');
            if (index === 0) {
                btn.classList.add('active');
            }
        });
    }
}

// Funções utilitárias globais
function insertTextUnified(text) {
    const textarea = document.getElementById('custom-message');
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentText = textarea.value;
    
    textarea.value = currentText.substring(0, start) + text + currentText.substring(end);
    textarea.setSelectionRange(start + text.length, start + text.length);
    textarea.focus();
    
    textarea.dispatchEvent(new Event('input'));
}

function insertPlaceholderUnified(placeholder) {
    insertTextUnified(placeholder);
}

// Instanciar modal unificado
window.whatsAppModalUnified = new WhatsAppModalUnified();

// Funções de abertura para compatibilidade
window.openWhatsAppModal = function(clientData, messageType = 'boas-vindas', customData = {}) {
    window.whatsAppModalUnified.open(clientData, messageType, customData);
};

window.openWhatsAppModalCashback = function(clientData) {
    window.whatsAppModalUnified.open(clientData, 'cashback');
};

window.sendBirthdayWhatsApp = function(clientData) {
    window.whatsAppModalUnified.open(clientData, 'aniversario');
};

window.sendRecompraWhatsApp = function(clientData, produto, frequencia) {
    window.whatsAppModalUnified.open(clientData, 'recompra', { produto, frequencia });
};

window.sendPromocaoWhatsApp = function(clientData) {
    window.whatsAppModalUnified.open(clientData, 'promocao');
};

window.openCobrancaWhatsApp = function(clientData, customData = {}) {
    window.whatsAppModalUnified.open(clientData, 'cobranca', customData);
};

console.log('📱 Modal WhatsApp Unificado carregado');
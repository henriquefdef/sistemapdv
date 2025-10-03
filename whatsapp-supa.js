// ===== INTEGRAÇÃO WHATSAPP COM SUPABASE - VERSÃO ATUALIZADA COM CASHBACK =====
// Gerenciamento de mensagens editáveis do WhatsApp

const WhatsAppSupa = {
    
    /**
     * Configuração do Supabase
     */
    supabaseClient: null,
    
    /**
     * Inicializar cliente Supabase
     */
    init() {
        try {
            // Usar cliente global do header.js
            this.supabaseClient = window.supabaseClient || supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        } catch (error) {
            console.error('Erro ao inicializar Supabase para WhatsApp:', error);
        }
    },

    /**
     * IMPORTANTE: Execute o arquivo 'whatsapp-table-update.sql' no Supabase antes de usar esta versão.
     * O arquivo adiciona a coluna tipo_botao necessária para o funcionamento correto.
     */

    /**
     * Salvar mensagem de um slot específico para um tipo de botão
     * @param {string} tipoBotao - 'boas-vindas', 'promocao', 'aniversario', 'recompra', 'cashback', 'personalizada'
     * @param {number} slotNumber - 1, 2 ou 3
     * @param {string} mensagem - Texto da mensagem
     */
    async salvarMensagemSlot(tipoBotao, slotNumber, mensagem) {
        try {
            console.log('🔄 Salvando mensagem:', { tipoBotao, slotNumber, mensagem });
            
            if (!window.currentCompanyId) {
                throw new Error('ID da empresa não encontrado');
            }

            if (!window.currentUser?.auth_user_id) {
                throw new Error('Usuário não autenticado');
            }
            
            console.log('✅ Dados válidos - Empresa:', window.currentCompanyId, 'Usuário:', window.currentUser.auth_user_id);

            // Verificar se já existe uma mensagem para este tipo + slot
            const { data: existing } = await this.supabaseClient
                .from('whatsapp')
                .select('id')
                .eq('id_empresa', window.currentCompanyId)
                .eq('tipo_botao', tipoBotao)
                .eq('slot', parseInt(slotNumber))
                .single();

            if (existing) {
                // Atualizar mensagem existente
                console.log('🔄 Atualizando mensagem existente:', tipoBotao, 'slot', slotNumber);
                const { error } = await this.supabaseClient
                    .from('whatsapp')
                    .update({ 
                        mensagem: mensagem,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', existing.id);

                if (error) throw error;
                console.log('✅ Mensagem atualizada com sucesso');
            } else {
                // Inserir nova mensagem
                console.log('🔄 Inserindo nova mensagem:', tipoBotao, 'slot', slotNumber);
                const insertData = {
                    auth_user_id: window.currentUser.auth_user_id,
                    id_empresa: window.currentCompanyId,
                    tipo_botao: tipoBotao,
                    tipo_mensagem: 'slot_personalizado', // Categoria genérica
                    titulo: `${this.getTitleFromTipoBotao(tipoBotao)} - Slot ${slotNumber}`,
                    mensagem: mensagem,
                    slot: parseInt(slotNumber),
                    ativo: true,
                    created_at: new Date().toISOString()
                };
                console.log('📝 Dados para inserção:', insertData);
                
                const { error } = await this.supabaseClient
                    .from('whatsapp')
                    .insert(insertData);

                if (error) throw error;
                console.log('✅ Mensagem inserida com sucesso');
            }

            return { success: true };
            
        } catch (error) {
            console.error('Erro ao salvar mensagem no slot:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Buscar mensagem de um slot específico para um tipo de botão
     * @param {string} tipoBotao - 'boas-vindas', 'promocao', 'aniversario', 'recompra', 'cashback', 'personalizada'
     * @param {number} slotNumber - 1, 2 ou 3
     */
    async buscarMensagemSlot(tipoBotao, slotNumber) {
        try {
            if (!window.currentCompanyId) {
                throw new Error('ID da empresa não encontrado');
            }

            const { data, error } = await this.supabaseClient
                .from('whatsapp')
                .select('mensagem')
                .eq('id_empresa', window.currentCompanyId)
                .eq('tipo_botao', tipoBotao)
                .eq('slot', parseInt(slotNumber))
                .eq('ativo', true)
                .single();

            if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
                console.error('Erro ao buscar mensagem do slot:', error);
                throw error;
            }

            return data?.mensagem || null;
            
        } catch (error) {
            console.error('Erro ao buscar mensagem do slot:', error);
            return null;
        }
    },

    /**
     * Buscar mensagem padrão por tipo (sem slot específico)
     * Mantido para compatibilidade com templates padrão
     */
    async buscarMensagemPorTipo(tipoBotao) {
        try {
            if (!window.currentCompanyId) {
                throw new Error('ID da empresa não encontrado');
            }

            const { data, error } = await this.supabaseClient
                .from('whatsapp')
                .select('*')
                .eq('id_empresa', window.currentCompanyId)
                .eq('tipo_botao', tipoBotao)
                .is('slot', null) // Buscar template padrão (sem slot)
                .eq('ativo', true)
                .single();

            if (error && error.code !== 'PGRST116') {
                console.error('Erro ao buscar mensagem WhatsApp:', error);
                throw error;
            }

            return data || null;
            
        } catch (error) {
            console.error('Erro ao buscar mensagem WhatsApp:', error);
            return null;
        }
    },

    /**
     * Salvar template padrão para um tipo de botão (sem slot)
     */
    async salvarMensagem(tipoBotao, titulo, mensagem) {
        try {
            if (!window.currentCompanyId) {
                throw new Error('ID da empresa não encontrado');
            }

            if (!window.currentUser?.auth_user_id) {
                throw new Error('Usuário não autenticado');
            }

            // Verificar se já existe um template padrão para este tipo
            const { data: existingMessage, error: checkError } = await this.supabaseClient
                .from('whatsapp')
                .select('id')
                .eq('id_empresa', window.currentCompanyId)
                .eq('tipo_botao', tipoBotao)
                .is('slot', null)
                .eq('ativo', true)
                .single();

            if (checkError && checkError.code !== 'PGRST116') {
                console.error('Erro ao verificar mensagem existente:', checkError);
                throw checkError;
            }

            const messageData = {
                auth_user_id: window.currentUser.auth_user_id,
                id_empresa: window.currentCompanyId,
                tipo_botao: tipoBotao,
                tipo_mensagem: 'template_padrao',
                titulo: titulo,
                mensagem: mensagem,
                slot: null, // Template padrão não tem slot
                updated_at: new Date().toISOString()
            };

            let result;

            if (existingMessage) {
                // Atualizar template existente
                const { data, error } = await this.supabaseClient
                    .from('whatsapp')
                    .update(messageData)
                    .eq('id', existingMessage.id)
                    .select()
                    .single();

                if (error) throw error;
                result = data;
            } else {
                // Criar novo template
                messageData.created_at = new Date().toISOString();
                
                const { data, error } = await this.supabaseClient
                    .from('whatsapp')
                    .insert([messageData])
                    .select()
                    .single();

                if (error) throw error;
                result = data;
            }

            return { success: true, data: result };
            
        } catch (error) {
            console.error('Erro ao salvar mensagem WhatsApp:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Verificar quais slots têm mensagens para um tipo específico
     */
    async verificarSlotsComMensagem(tipoBotao) {
        try {
            if (!window.currentCompanyId) {
                throw new Error('ID da empresa não encontrado');
            }

            const { data, error } = await this.supabaseClient
                .from('whatsapp')
                .select('slot')
                .eq('id_empresa', window.currentCompanyId)
                .eq('tipo_botao', tipoBotao)
                .not('slot', 'is', null)
                .eq('ativo', true);

            if (error) {
                console.error('Erro ao verificar slots:', error);
                return [];
            }

            return data?.map(item => item.slot) || [];
            
        } catch (error) {
            console.error('Erro ao verificar slots:', error);
            return [];
        }
    },

    /**
     * Deletar mensagem de um slot específico
     */
    async deletarMensagemSlot(tipoBotao, slotNumber) {
        try {
            if (!window.currentCompanyId) {
                throw new Error('ID da empresa não encontrado');
            }

            const { error } = await this.supabaseClient
                .from('whatsapp')
                .delete()
                .eq('id_empresa', window.currentCompanyId)
                .eq('tipo_botao', tipoBotao)
                .eq('slot', parseInt(slotNumber));

            if (error) {
                console.error('Erro ao deletar mensagem do slot:', error);
                throw error;
            }

            return { success: true };
            
        } catch (error) {
            console.error('Erro ao deletar mensagem do slot:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Carregar todas as mensagens da empresa (para debug/admin)
     */
    async carregarTodasMensagens() {
        try {
            if (!window.currentCompanyId) {
                throw new Error('ID da empresa não encontrado');
            }

            const { data, error } = await this.supabaseClient
                .from('whatsapp')
                .select('*')
                .eq('id_empresa', window.currentCompanyId)
                .eq('ativo', true)
                .order('tipo_botao', { ascending: true })
                .order('slot', { ascending: true });

            if (error) {
                console.error('Erro ao carregar mensagens WhatsApp:', error);
                throw error;
            }

            return data || [];
            
        } catch (error) {
            console.error('Erro ao carregar mensagens WhatsApp:', error);
            return [];
        }
    },

    /**
     * Utilitário: Converter tipo de botão para título
     */
    getTitleFromTipoBotao(tipoBotao) {
        const titles = {
            'boas-vindas': 'Boas Vindas',
            'promocao': 'Promoção',
            'aniversario': 'Aniversário', 
            'recompra': 'Lembrete de Recompra',
            'cashback': 'Cashback Disponível',
            'personalizada': 'Mensagem Personalizada'
        };
        return titles[tipoBotao] || 'Mensagem';
    }
};

// Inicializar quando o DOM estiver carregado
document.addEventListener('DOMContentLoaded', () => {
    WhatsAppSupa.init();
});

// Exportar para uso global
window.WhatsAppSupa = WhatsAppSupa;

console.log('📱 WhatsApp Supabase Integration v2 com Cashback carregado');
// orcamento-supa.js - Integração com Supabase
// =============================================

const OrcamentoSupa = {
    
    /**
     * Buscar produtos no Supabase
     * @param {string} query - Termo de busca
     * @returns {Array} Lista de produtos
     */
    buscarProdutos: async function(query) {
        try {
            if (!window.currentCompanyId) {
                throw new Error('ID da empresa não encontrado');
            }

            const { data, error } = await supabaseClient
                .from('produtos')
                .select('*')
                .eq('id_empresa', window.currentCompanyId)
                .or(`nome.ilike.%${query}%,codigo_sku.ilike.%${query}%,codigo_barras.ilike.%${query}%`)
                .limit(20);

            if (error) throw error;
            return data || [];
            
        } catch (error) {
            console.error('Erro ao buscar produtos:', error);
            throw error;
        }
    },

    /**
     * Buscar clientes no Supabase
     * @returns {Array} Lista de clientes
     */
    buscarClientes: async function() {
        try {
            if (!window.currentCompanyId) {
                throw new Error('ID da empresa não encontrado');
            }

            const { data, error } = await supabaseClient
                .from('clientes')
                .select('*')
                .eq('id_empresa', window.currentCompanyId)
                .order('nome');
                
            if (error) throw error;
            return data || [];
            
        } catch (error) {
            console.error('Erro ao buscar clientes:', error);
            throw error;
        }
    },

    /**
     * Carregar clientes no modal
     */
    carregarClientes: async function() {
        try {
            elementos.clienteList.innerHTML = '<div class="loading"></div>';
            
            const clientes = await this.buscarClientes();
            this.exibirClientes(clientes);
            
            // Configurar busca de clientes
            this.configurarBuscaClientes(clientes);
            
        } catch (error) {
            console.error('Erro ao carregar clientes:', error);
            elementos.clienteList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>Erro ao carregar clientes</p>
                </div>
            `;
        }
    },

    /**
     * Exibir lista de clientes
     * @param {Array} clientes - Lista de clientes
     */
    exibirClientes: function(clientes) {
        if (!clientes || clientes.length === 0) {
            elementos.clienteList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-users"></i>
                    <p>Nenhum cliente encontrado</p>
                </div>
            `;
            return;
        }
        
        elementos.clienteList.innerHTML = clientes.map(cliente => `
            <div class="cliente-item" onclick="selecionarCliente(${JSON.stringify(cliente).replace(/"/g, '&quot;')})">
                <div class="cliente-item-nome">${cliente.nome}</div>
                <div class="cliente-item-detalhes">
                    ${cliente.telefone ? `📞 ${utils.formatPhone(cliente.telefone)}` : ''}
                    ${cliente.email ? ` • ✉️ ${cliente.email}` : ''}
                </div>
            </div>
        `).join('');
    },

    /**
     * Configurar busca de clientes
     * @param {Array} todosClientes - Lista completa de clientes
     */
    configurarBuscaClientes: function(todosClientes) {
        elementos.clienteSearch.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase().trim();
            
            if (!query) {
                this.exibirClientes(todosClientes);
                return;
            }
            
            const clientesFiltrados = todosClientes.filter(cliente => 
                cliente.nome.toLowerCase().includes(query) ||
                (cliente.telefone && cliente.telefone.includes(query)) ||
                (cliente.email && cliente.email.toLowerCase().includes(query))
            );
            
            this.exibirClientes(clientesFiltrados);
        });
    },

    /**
     * Salvar orçamento no Supabase
     * @param {Object} orcamento - Dados do orçamento
     * @returns {Object} Resultado da operação
     */
    salvar: async function(orcamento) {
        try {
            if (!window.currentCompanyId || !window.currentUser) {
                throw new Error('Dados de autenticação não encontrados');
            }

            const dados = {
                numero: orcamento.numero || utils.generateNumber(),
                data_orcamento: new Date().toISOString().split('T')[0],
                id_cliente: orcamento.cliente?.id || null,
                cliente_nome: orcamento.cliente?.nome || null,
                itens: JSON.stringify(orcamento.items),
                subtotal: orcamento.totais.subtotal,
                desconto_tipo: orcamento.desconto.tipo,
                desconto_valor: orcamento.desconto.valor,
                desconto: orcamento.totais.desconto,
                frete: orcamento.totais.frete,
                total: orcamento.totais.total,
                observacoes: orcamento.observacoes,
                status: 'rascunho',
                id_empresa: window.currentCompanyId,
                id_usuario: window.currentUser?.id
            };
            
            let resultado;
            if (orcamento.id) {
                // Atualizar orçamento existente
                const { data, error } = await supabaseClient
                    .from('orcamentos')
                    .update(dados)
                    .eq('id', orcamento.id)
                    .select()
                    .single();
                    
                if (error) throw error;
                resultado = data;
            } else {
                // Criar novo orçamento
                const { data, error } = await supabaseClient
                    .from('orcamentos')
                    .insert([dados])
                    .select()
                    .single();
                    
                if (error) throw error;
                resultado = data;
            }
            
            return {
                success: true,
                id: resultado.id,
                numero: resultado.numero,
                data: resultado
            };
            
        } catch (error) {
            console.error('Erro ao salvar orçamento:', error);
            return {
                success: false,
                error: error.message
            };
        }
    },

    /**
     * Listar orçamentos
     * @returns {Array} Lista de orçamentos
     */
    listar: async function() {
        try {
            if (!window.currentCompanyId) {
                throw new Error('ID da empresa não encontrado');
            }

            const { data, error } = await supabaseClient
                .from('orcamentos')
                .select('*')
                .eq('id_empresa', window.currentCompanyId)
                .order('created_at', { ascending: false })
                .limit(50);
                
            if (error) throw error;
            return data || [];
            
        } catch (error) {
            console.error('Erro ao listar orçamentos:', error);
            throw error;
        }
    },

    /**
     * Buscar orçamento por ID
     * @param {number} id - ID do orçamento
     * @returns {Object} Dados do orçamento
     */
    buscarPorId: async function(id) {
        try {
            const { data, error } = await supabaseClient
                .from('orcamentos')
                .select('*')
                .eq('id', id)
                .single();
                
            if (error) throw error;
            return data;
            
        } catch (error) {
            console.error('Erro ao buscar orçamento:', error);
            throw error;
        }
    },

    /**
     * Deletar orçamento
     * @param {number} id - ID do orçamento
     * @returns {boolean} Sucesso da operação
     */
    deletar: async function(id) {
        try {
            const { error } = await supabaseClient
                .from('orcamentos')
                .delete()
                .eq('id', id);
                
            if (error) throw error;
            return true;
            
        } catch (error) {
            console.error('Erro ao deletar orçamento:', error);
            throw error;
        }
    },

    /**
     * Atualizar status do orçamento
     * @param {number} id - ID do orçamento
     * @param {string} status - Novo status
     * @returns {boolean} Sucesso da operação
     */
    atualizarStatus: async function(id, status) {
        try {
            const { error } = await supabaseClient
                .from('orcamentos')
                .update({ 
                    status: status,
                    data_conversao: status === 'convertendo' ? new Date().toISOString() : null
                })
                .eq('id', id);
                
            if (error) throw error;
            return true;
            
        } catch (error) {
            console.error('Erro ao atualizar status:', error);
            throw error;
        }
    },

    /**
     * Buscar dados da empresa
     * @returns {Object} Dados da empresa
     */
    buscarDadosEmpresa: async function() {
        try {
            if (!window.currentCompanyId) {
                return this.getDadosEmpresaPadrao();
            }

            const { data, error } = await supabaseClient
                .from('empresas')
                .select('*')
                .eq('id', window.currentCompanyId)
                .single();
                
            if (error || !data) {
                return this.getDadosEmpresaPadrao();
            }
            
            return {
                nome: data.nome || 'Sua Empresa',
                endereco: data.endereco || '',
                telefone: data.telefone || '',
                email: data.email || '',
                cnpj: data.cnpj || '',
                site: data.website || data.site || ''
            };
            
        } catch (error) {
            console.error('Erro ao buscar dados da empresa:', error);
            return this.getDadosEmpresaPadrao();
        }
    },

    /**
     * Obter dados padrão da empresa
     * @returns {Object} Dados padrão
     */
    getDadosEmpresaPadrao: function() {
        return {
            nome: 'Lume Sistema',
            endereco: '',
            telefone: '',
            email: '',
            cnpj: '',
            site: ''
        };
    },

    /**
     * Validar dados antes de salvar
     * @param {Object} orcamento - Dados do orçamento
     * @returns {Object} Resultado da validação
     */
    validarDados: function(orcamento) {
        const erros = [];

        if (!orcamento.items || orcamento.items.length === 0) {
            erros.push('Adicione pelo menos um item ao orçamento');
        }

        if (!orcamento.totais || orcamento.totais.total <= 0) {
            erros.push('O valor total deve ser maior que zero');
        }

        orcamento.items.forEach((item, index) => {
            if (!item.nome || !item.nome.trim()) {
                erros.push(`Item ${index + 1}: Nome é obrigatório`);
            }
            if (!item.quantidade || item.quantidade <= 0) {
                erros.push(`Item ${index + 1}: Quantidade deve ser maior que zero`);
            }
            if (!item.preco_unitario || item.preco_unitario < 0) {
                erros.push(`Item ${index + 1}: Preço unitário inválido`);
            }
        });

        return {
            valido: erros.length === 0,
            erros: erros
        };
    },

    /**
     * Gerar número único para orçamento
     * @returns {string} Número do orçamento
     */
    gerarNumero: function() {
        const agora = new Date();
        const ano = agora.getFullYear();
        const mes = String(agora.getMonth() + 1).padStart(2, '0');
        const dia = String(agora.getDate()).padStart(2, '0');
        const timestamp = agora.getTime().toString().slice(-4);
        
        return `ORC${ano}${mes}${dia}${timestamp}`;
    },

    /**
     * Verificar conexão com Supabase
     * @returns {boolean} Status da conexão
     */
    verificarConexao: async function() {
        try {
            const { data, error } = await supabaseClient
                .from('orcamentos')
                .select('id')
                .limit(1);
                
            return !error;
            
        } catch (error) {
            console.error('Erro de conexão com Supabase:', error);
            return false;
        }
    },

    /**
     * Backup local dos dados do orçamento
     * @param {Object} orcamento - Dados do orçamento
     */
    salvarBackupLocal: function(orcamento) {
        try {
            const backup = {
                timestamp: new Date().toISOString(),
                dados: orcamento
            };
            
            localStorage.setItem('orcamento_backup', JSON.stringify(backup));
            console.log('Backup local salvo com sucesso');
            
        } catch (error) {
            console.warn('Erro ao salvar backup local:', error);
        }
    },

    /**
     * Restaurar backup local
     * @returns {Object|null} Dados do backup
     */
    restaurarBackupLocal: function() {
        try {
            const backup = localStorage.getItem('orcamento_backup');
            if (!backup) return null;
            
            const dadosBackup = JSON.parse(backup);
            
            // Verificar se o backup é recente (menos de 24 horas)
            const agora = new Date();
            const timestampBackup = new Date(dadosBackup.timestamp);
            const diferencaHoras = (agora - timestampBackup) / (1000 * 60 * 60);
            
            if (diferencaHoras > 24) {
                localStorage.removeItem('orcamento_backup');
                return null;
            }
            
            return dadosBackup.dados;
            
        } catch (error) {
            console.warn('Erro ao restaurar backup local:', error);
            return null;
        }
    },

    /**
     * Limpar backup local
     */
    limparBackupLocal: function() {
        try {
            localStorage.removeItem('orcamento_backup');
            console.log('Backup local removido');
        } catch (error) {
            console.warn('Erro ao limpar backup local:', error);
        }
    },

    /**
     * Estatísticas básicas de orçamentos
     * @returns {Object} Estatísticas
     */
    obterEstatisticas: async function() {
        try {
            if (!window.currentCompanyId) {
                throw new Error('ID da empresa não encontrado');
            }

            const { data, error } = await supabaseClient
                .from('orcamentos')
                .select('status, total, created_at')
                .eq('id_empresa', window.currentCompanyId);
                
            if (error) throw error;
            
            if (!data || data.length === 0) {
                return {
                    total: 0,
                    rascunhos: 0,
                    enviados: 0,
                    convertidos: 0,
                    valorTotal: 0,
                    valorMedio: 0
                };
            }
            
            const stats = data.reduce((acc, orc) => {
                acc.total++;
                acc.valorTotal += orc.total || 0;
                
                switch (orc.status) {
                    case 'rascunho':
                        acc.rascunhos++;
                        break;
                    case 'enviado':
                        acc.enviados++;
                        break;
                    case 'convertido':
                        acc.convertidos++;
                        break;
                }
                
                return acc;
            }, {
                total: 0,
                rascunhos: 0,
                enviados: 0,
                convertidos: 0,
                valorTotal: 0
            });
            
            stats.valorMedio = stats.total > 0 ? stats.valorTotal / stats.total : 0;
            
            return stats;
            
        } catch (error) {
            console.error('Erro ao obter estatísticas:', error);
            return null;
        }
    }
};

// Inicialização quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
    // Verificar se temos todas as dependências necessárias
    let tentativas = 0;
    const maxTentativas = 50;
    
    const verificarDependencias = () => {
        tentativas++;
        
        const hasSupabase = typeof supabaseClient !== 'undefined' || window.supabaseClient;
        const hasCompany = window.currentCompanyId;
        const hasUser = window.currentUser;
        
        if (hasSupabase && hasCompany && hasUser) {
            console.log('✅ OrcamentoSupa inicializado com sucesso');
            
            // Garantir que supabaseClient está disponível globalmente
            if (!window.supabaseClient && typeof supabaseClient !== 'undefined') {
                window.supabaseClient = supabaseClient;
            }
            
            return true;
        }
        
        if (tentativas >= maxTentativas) {
            console.warn('⚠️ Timeout ao aguardar dependências do OrcamentoSupa');
            return true;
        }
        
        return false;
    };
    
    // Verificar imediatamente
    if (!verificarDependencias()) {
        // Aguardar evento de dados do usuário
        document.addEventListener('userDataReady', verificarDependencias);
        
        // Fallback com polling
        const interval = setInterval(() => {
            if (verificarDependencias()) {
                clearInterval(interval);
            }
        }, 200);
    }
});

// Exportar para uso global
window.OrcamentoSupa = OrcamentoSupa;
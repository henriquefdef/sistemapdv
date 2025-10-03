// orcamento-pdf.js - Sistema de Geração de PDF Profissional COMPLETO
// ====================================================================

const OrcamentoPDF = {
    
    /**
     * Gerar PDF do orçamento com design moderno e limpo
     * @param {Object} orcamento - Dados do orçamento
     */
    gerar: async function(orcamento) {
        try {
            if (!orcamento.items || orcamento.items.length === 0) {
                utils.showNotification('Nenhum item no orçamento para gerar PDF', 'warning');
                return;
            }

            // Se o orçamento não tem número, salvar primeiro
            if (!orcamento.numero && window.salvarOrcamento) {
                utils.showNotification('Salvando orçamento antes de gerar PDF...', 'info');
                await window.salvarOrcamento();
                // Aguardar um pouco para garantir que o número foi atualizado
                await new Promise(resolve => setTimeout(resolve, 500));
            }

            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();
            
            // Dados da empresa
            const empresa = await this.obterDadosEmpresa();
            
            // Configurar documento
            this.configurarDocumento(doc);
            
            // Layout moderno e limpo
            let yPosition = this.gerarCabecalhoModerno(doc, empresa);
            yPosition = this.gerarTituloOrcamento(doc, orcamento, yPosition);
            yPosition = this.gerarInfoBasica(doc, orcamento, yPosition);
            yPosition = this.gerarClienteCompacto(doc, orcamento, yPosition);
            yPosition = this.gerarTabelaProdutosLimpa(doc, orcamento, yPosition);
            yPosition = this.gerarTotaisLimpos(doc, orcamento, yPosition);
            this.gerarObservacoesSimples(doc, orcamento, yPosition);
            this.gerarRodapeMinimalista(doc, empresa);
            
            // Salvar PDF
            const nomeArquivo = `Orcamento_${orcamento.numero || 'Novo'}_${new Date().toISOString().split('T')[0]}.pdf`;
            doc.save(nomeArquivo);
            
            utils.showNotification('PDF gerado com sucesso!', 'success');
            
        } catch (error) {
            console.error('Erro ao gerar PDF:', error);
            utils.showNotification('Erro ao gerar PDF: ' + error.message, 'error');
        }
    },

    /**
     * Obter dados da empresa do usuário logado
     */
    obterDadosEmpresa: async function() {
        try {
            if (window.currentCompanyId) {
                const { data, error } = await supabaseClient
                    .from('empresas')
                    .select('*')
                    .eq('id_empresa', window.currentCompanyId)
                    .single();
                
                if (!error && data) {
                    return {
                        nome: data.nome_fantasia || data.razao_social || 'LUME SISTEMA',
                        razao_social: data.razao_social || '',
                        cnpj: data.cnpj || '',
                        telefone: data.telefone_empresa || '',
                        whatsapp: data.whatsapp_responsavel || '',
                        email: data.email_empresa || '',
                        endereco: this.formatarEnderecoCompleto(data),
                        ramo: data.ramo_empresa || '',
                        inscricao_estadual: data.inscricao_estadual || '',
                        inscricao_municipal: data.inscricao_municipal || ''
                    };
                }
            }
            
            // Dados padrão se não encontrar na base
            return {
                nome: 'LUME SISTEMA',
                razao_social: '',
                cnpj: '',
                telefone: '',
                whatsapp: '',
                email: '',
                endereco: '',
                ramo: '',
                inscricao_estadual: '',
                inscricao_municipal: ''
            };
        } catch (error) {
            console.warn('Erro ao obter dados da empresa:', error);
            return {
                nome: 'LUME SISTEMA',
                razao_social: '',
                cnpj: '',
                telefone: '',
                whatsapp: '',
                email: '',
                endereco: '',
                ramo: '',
                inscricao_estadual: '',
                inscricao_municipal: ''
            };
        }
    },

    /**
     * Formatar endereço completo a partir dos dados da empresa
     */
    formatarEnderecoCompleto: function(dados) {
        const partes = [];
        
        if (dados.rua) {
            let endereco = dados.rua;
            if (dados.numero) endereco += `, ${dados.numero}`;
            if (dados.complemento) endereco += `, ${dados.complemento}`;
            partes.push(endereco);
        }
        
        if (dados.bairro && dados.cidade) {
            partes.push(`${dados.bairro}, ${dados.cidade}`);
        } else if (dados.cidade) {
            partes.push(dados.cidade);
        }
        
        if (dados.cep) {
            const cepFormatado = dados.cep.replace(/(\d{5})(\d{3})/, '$1-$2');
            partes.push(`CEP: ${cepFormatado}`);
        }
        
        return partes.join(' • ');
    },

    /**
     * Configurar documento PDF
     */
    configurarDocumento: function(doc) {
        doc.setProperties({
            title: 'Orçamento',
            subject: 'Orçamento Comercial',
            author: 'Sistema Lume',
            creator: 'Sistema Lume'
        });
    },

    /**
     * Cabeçalho profissional com dados reais da empresa
     */
    gerarCabecalhoModerno: function(doc, empresa) {
        const pageWidth = doc.internal.pageSize.width;
        let y = 20;

        // Nome da empresa (nome fantasia em destaque)
        doc.setFontSize(24);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(52, 73, 94);
        doc.text(empresa.nome, pageWidth / 2, y, { align: 'center' });
        y += 8;

        y += 4; // Espaço adicional após o nome da empresa

        // ORÇAMENTO em preto
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 0, 0); // Preto
        doc.text('ORÇAMENTO', pageWidth / 2, y, { align: 'center' });
        y += 12;

        // Ramo da empresa (removendo 'Tecnologia')
        if (empresa.ramo && empresa.ramo !== 'tecnologia') {
            doc.setFontSize(9);
            doc.setFont('helvetica', 'italic');
            doc.setTextColor(120, 120, 120);
            const ramoTexto = this.formatarRamoEmpresa(empresa.ramo);
            doc.text(ramoTexto, pageWidth / 2, y, { align: 'center' });
            y += 10;
        } else {
            y += 6;
        }

        // Linha principal com informações essenciais
        const infoEssencial = [];
        if (empresa.cnpj) {
            const cnpjFormatado = empresa.cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
            infoEssencial.push(`CNPJ: ${cnpjFormatado}`);
        }
        if (empresa.telefone) infoEssencial.push(`Tel: ${empresa.telefone}`);
        if (empresa.email) infoEssencial.push(`Email: ${empresa.email}`);

        if (infoEssencial.length > 0) {
            doc.setFontSize(8);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(80, 80, 80);
            doc.text(infoEssencial.join(' • '), pageWidth / 2, y, { align: 'center' });
            y += 6;
        }

        // Endereço (se disponível)
        if (empresa.endereco) {
            doc.setFontSize(8);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(100, 100, 100);
            doc.text(empresa.endereco, pageWidth / 2, y, { align: 'center' });
            y += 6;
        }

        // WhatsApp do responsável (se diferente do telefone)
        if (empresa.whatsapp && empresa.whatsapp !== empresa.telefone) {
            doc.setFontSize(8);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(100, 100, 100);
            doc.text(`WhatsApp: ${empresa.whatsapp}`, pageWidth / 2, y, { align: 'center' });
            y += 6;
        }

        return y + 15;
    },

    /**
     * Formatar nome do ramo da empresa
     */
    formatarRamoEmpresa: function(ramo) {
        const ramos = {
            'alimentacao': 'Alimentação',
            'varejo': 'Comércio Varejista',
            'servicos': 'Prestação de Serviços',
            'saude': 'Saúde',
            'educacao': 'Educação',
            'construcao': 'Construção Civil',
            'transporte': 'Transporte e Logística',
            'outro': 'Outros Serviços'
        };
        
        return ramos[ramo] || ramo.charAt(0).toUpperCase() + ramo.slice(1);
    },

    /**
     * Título ORÇAMENTO elegante
     */
    gerarTituloOrcamento: function(doc, orcamento, y) {
        // Título removido - agora será exibido no cabeçalho
        return y;
    },

    /**
     * Informações básicas em linha
     */
    gerarInfoBasica: function(doc, orcamento, y) {
        const pageWidth = doc.internal.pageSize.width;

        // Fundo cinza claro
        doc.setFillColor(248, 249, 250);
        doc.rect(20, y - 5, pageWidth - 40, 18, 'F');

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(0, 0, 0);

        // Informações em duas colunas
        const leftCol = 30;
        const rightCol = pageWidth / 2 + 20;

        doc.setFont('helvetica', 'bold');
        doc.text('Número:', leftCol, y + 4);
        doc.setFont('helvetica', 'normal');
        doc.text(orcamento.numero || 'Novo', leftCol + 25, y + 4);

        doc.setFont('helvetica', 'bold');
        doc.text('Data:', rightCol, y + 4);
        doc.setFont('helvetica', 'normal');
        doc.text(utils.formatDate(), rightCol + 15, y + 4);

        doc.setFont('helvetica', 'bold');
        doc.text('Validade:', leftCol, y + 10);
        doc.setFont('helvetica', 'normal');
        doc.text(this.calcularValidadeOrcamento(), leftCol + 25, y + 10);

        return y + 25;
    },

    /**
     * Cliente de forma compacta
     */
    gerarClienteCompacto: function(doc, orcamento, y) {
        if (!orcamento.cliente) {
            return y;
        }

        const pageWidth = doc.internal.pageSize.width;

        // Box do cliente mais sutil
        doc.setFillColor(240, 253, 244);
        doc.rect(20, y - 3, pageWidth - 40, 15, 'F');

        doc.setDrawColor(34, 197, 94);
        doc.setLineWidth(0.3);
        doc.rect(20, y - 3, pageWidth - 40, 15);

        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 0, 0);
        doc.text('Cliente:', 25, y + 4);
        
        doc.setFont('helvetica', 'normal');
        doc.text(orcamento.cliente.nome, 45, y + 4);

        // Contato na mesma linha se houver
        if (orcamento.cliente.telefone || orcamento.cliente.email) {
            const contato = [];
            if (orcamento.cliente.telefone) contato.push(utils.formatPhone(orcamento.cliente.telefone));
            if (orcamento.cliente.email) contato.push(orcamento.cliente.email);
            
            doc.setFontSize(8);
            doc.setTextColor(100, 100, 100);
            doc.text(`(${contato.join(' | ')})`, 25, y + 9);
        }

        return y + 25;
    },

    /**
     * Tabela de produtos limpa e moderna
     */
    gerarTabelaProdutosLimpa: function(doc, orcamento, y) {
        const pageWidth = doc.internal.pageSize.width;

        // Cabeçalho da tabela com cor mais suave
        doc.setFillColor(52, 73, 94);
        doc.rect(20, y, pageWidth - 40, 12, 'F');

        // Colunas otimizadas
        const cols = [
            { x: 25, width: 15, title: 'Item', align: 'left' },
            { x: 40, width: 85, title: 'Descrição', align: 'left' },
            { x: 125, width: 20, title: 'Qtd.', align: 'center' },
            { x: 145, width: 22, title: 'Vlr. Unit.', align: 'right' },
            { x: 167, width: 23, title: 'Total', align: 'right' }
        ];

        // Cabeçalhos em branco
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);

        cols.forEach(col => {
            const textX = col.align === 'center' ? col.x + col.width / 2 : 
                         col.align === 'right' ? col.x + col.width - 3 : col.x + 2;
            doc.text(col.title, textX, y + 8, { align: col.align });
        });

        y += 12;

        // Linhas dos itens com alternância de cores
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(0, 0, 0);

        orcamento.items.forEach((item, index) => {
            // Verificar quebra de página
            if (y > 250) {
                doc.addPage();
                y = 20;
            }

            const rowHeight = 10;
            const isEven = index % 2 === 0;

            // Cor alternada para as linhas
            if (isEven) {
                doc.setFillColor(249, 250, 251);
                doc.rect(20, y, pageWidth - 40, rowHeight, 'F');
            }

            // Bordas sutis
            doc.setDrawColor(229, 231, 235);
            doc.setLineWidth(0.1);
            doc.rect(20, y, pageWidth - 40, rowHeight);

            // Conteúdo das células
            // Item número
            doc.text((index + 1).toString(), cols[0].x + 2, y + 6);

            // Descrição
            const descricaoTexto = this.quebrarTexto(doc, item.nome, cols[1].width - 4);
            doc.text(descricaoTexto[0], cols[1].x + 2, y + 6);

            // Quantidade centralizada
            doc.text(item.quantidade.toString(), cols[2].x + cols[2].width / 2, y + 6, { align: 'center' });

            // Valor unitário alinhado à direita
            doc.text(utils.formatCurrency(item.preco_unitario), cols[3].x + cols[3].width - 3, y + 6, { align: 'right' });

            // Total alinhado à direita
            doc.setFont('helvetica', 'bold');
            doc.text(utils.formatCurrency(item.total), cols[4].x + cols[4].width - 3, y + 6, { align: 'right' });
            doc.setFont('helvetica', 'normal');

            y += rowHeight;
        });

        return y + 10;
    },

    /**
     * Totais limpos e destacados
     */
    gerarTotaisLimpos: function(doc, orcamento, y) {
        const pageWidth = doc.internal.pageSize.width;
        const boxWidth = 70;
        const boxX = pageWidth - 20 - boxWidth;

        let currentY = y;
        const lineHeight = 8;

        // Subtotal
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(75, 85, 99);
        doc.text('Subtotal:', boxX + 5, currentY);
        doc.text(utils.formatCurrency(orcamento.totais.subtotal), boxX + boxWidth - 5, currentY, { align: 'right' });
        currentY += lineHeight;

        // Desconto (se existir)
        if (orcamento.totais.desconto > 0) {
            doc.setTextColor(239, 68, 68);
            doc.text('Desconto:', boxX + 5, currentY);
            doc.text('- ' + utils.formatCurrency(orcamento.totais.desconto), boxX + boxWidth - 5, currentY, { align: 'right' });
            currentY += lineHeight;
        }

        // Frete (se existir)
        if (orcamento.totais.frete > 0) {
            doc.setTextColor(75, 85, 99);
            doc.text('Frete:', boxX + 5, currentY);
            doc.text(utils.formatCurrency(orcamento.totais.frete), boxX + boxWidth - 5, currentY, { align: 'right' });
            currentY += lineHeight;
        }

        // Linha separadora com cor mais suave
        doc.setDrawColor(52, 73, 94);
        doc.setLineWidth(0.5);
        doc.line(boxX + 5, currentY + 2, boxX + boxWidth - 5, currentY + 2);
        currentY += 8;

        // Total final destacado com cor mais suave
        doc.setFillColor(52, 73, 94);
        doc.rect(boxX, currentY - 4, boxWidth, 12, 'F');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.setTextColor(255, 255, 255);
        doc.text('TOTAL:', boxX + 5, currentY + 4);
        doc.text(utils.formatCurrency(orcamento.totais.total), boxX + boxWidth - 5, currentY + 4, { align: 'right' });

        return currentY + 20;
    },

    /**
     * Observações de forma mais simples
     */
    gerarObservacoesSimples: function(doc, orcamento, y) {
        if (!orcamento.observacoes || !orcamento.observacoes.trim()) {
            return y;
        }

        const pageWidth = doc.internal.pageSize.width;

        // Verificar espaço
        if (y > 240) {
            doc.addPage();
            y = 20;
        }

        // Título simples
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(0, 0, 0);
        doc.text('Observações:', 20, y);

        y += 8;

        // Texto das observações sem box
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(75, 85, 99);
        
        const linhasObservacoes = this.quebrarTexto(doc, orcamento.observacoes, pageWidth - 40);
        linhasObservacoes.slice(0, 3).forEach((linha, index) => {
            doc.text(linha, 20, y + (index * 5));
        });

        return y + (linhasObservacoes.length * 5) + 10;
    },

    /**
     * Rodapé minimalista
     */
    gerarRodapeMinimalista: function(doc, empresa) {
        const pageWidth = doc.internal.pageSize.width;
        const pageHeight = doc.internal.pageSize.height;
        const y = pageHeight - 25;

        // Linha sutil
        doc.setDrawColor(229, 231, 235);
        doc.setLineWidth(0.3);
        doc.line(20, y, pageWidth - 20, y);

        // Informações centralizadas
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(156, 163, 175);

        const hoje = new Date();
        const textoData = `Gerado em ${hoje.toLocaleDateString('pt-BR')} às ${hoje.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
        
        doc.text(textoData, pageWidth / 2, y + 8, { align: 'center' });

        // Assinatura discreta
        doc.text('Sistema Lume', pageWidth / 2, y + 15, { align: 'center' });
    },

    /**
     * Calcular validade (30 dias)
     */
    calcularValidadeOrcamento: function() {
        const hoje = new Date();
        const validade = new Date(hoje.getTime() + (30 * 24 * 60 * 60 * 1000));
        return validade.toLocaleDateString('pt-BR');
    },

    /**
     * Quebrar texto em múltiplas linhas
     */
    quebrarTexto: function(doc, texto, larguraMaxima) {
        if (!texto) return [''];
        
        const palavras = texto.split(' ');
        const linhas = [];
        let linhaAtual = '';

        palavras.forEach(palavra => {
            const testeTexto = linhaAtual + (linhaAtual ? ' ' : '') + palavra;
            const largura = doc.getTextWidth(testeTexto);

            if (largura <= larguraMaxima) {
                linhaAtual = testeTexto;
            } else {
                if (linhaAtual) {
                    linhas.push(linhaAtual);
                    linhaAtual = palavra;
                } else {
                    linhas.push(palavra.substring(0, 30) + '...');
                }
            }
        });

        if (linhaAtual) {
            linhas.push(linhaAtual);
        }

        return linhas.length > 0 ? linhas : [''];
    }
};

// Exportar para uso global
window.OrcamentoPDF = OrcamentoPDF;
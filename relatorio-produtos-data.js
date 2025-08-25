// ===== RELATÓRIO DE PRODUTOS - PROCESSAMENTO DE DADOS =====

// ===== FUNÇÕES DE ANÁLISE DE DADOS =====

/**
 * Obter distribuição de produtos por categoria
 * @param {string} metric - 'quantidade' ou 'valor'
 * @returns {Array} Array com dados da categoria
 */
function getCategoriaDistribution(metric = 'quantidade') {
    if (!relatorioProdutosState?.produtosData?.length) {
        return [];
    }

    const categoriaMap = new Map();
    
    relatorioProdutosState.produtosData.forEach(produto => {
        const categoria = produto.categoria || 'Sem categoria';
        
        if (!categoriaMap.has(categoria)) {
            categoriaMap.set(categoria, {
                nome: categoria,
                quantidade: 0,
                valor: 0
            });
        }
        
        const categoriaData = categoriaMap.get(categoria);
        categoriaData.quantidade += 1;
        
        const precoVenda = parseFloat(produto.preco_venda) || 0;
        const estoque = parseInt(produto.quantidade_estoque) || 0;
        categoriaData.valor += precoVenda * estoque;
    });
    
    return Array.from(categoriaMap.values())
        .sort((a, b) => {
            if (metric === 'valor') {
                return b.valor - a.valor;
            }
            return b.quantidade - a.quantidade;
        });
}

/**
 * Obter top produtos por valor em estoque
 * @param {number} limite - Número de produtos a retornar
 * @returns {Array} Array com top produtos
 */
function getTopProdutosByValue(limite = 10) {
    if (!relatorioProdutosState?.produtosData?.length) {
        return [];
    }

    return relatorioProdutosState.produtosData
        .map(produto => {
            const precoVenda = parseFloat(produto.preco_venda) || 0;
            const estoque = parseInt(produto.quantidade_estoque) || 0;
            const valorTotal = precoVenda * estoque;
            
            return {
                nome: produto.nome || 'Produto sem nome',
                categoria: produto.categoria || 'Sem categoria',
                preco: precoVenda,
                estoque: estoque,
                valorTotal: valorTotal,
                markup: parseFloat(produto.markup) || 0
            };
        })
        .filter(produto => produto.valorTotal > 0)
        .sort((a, b) => b.valorTotal - a.valorTotal)
        .slice(0, limite);
}

/**
 * Obter análise de margem de lucro
 * @param {string} type - 'distribuicao' ou 'categoria'
 * @returns {Array} Array com dados de margem
 */
function getMargemAnalysis(type = 'distribuicao') {
    if (!relatorioProdutosState?.produtosData?.length) {
        return [];
    }

    const produtosComMargem = relatorioProdutosState.produtosData
        .filter(produto => produto.markup && produto.markup > 0)
        .map(produto => ({
            nome: produto.nome,
            categoria: produto.categoria || 'Sem categoria',
            markup: parseFloat(produto.markup),
            preco_custo: parseFloat(produto.preco_custo) || 0,
            preco_venda: parseFloat(produto.preco_venda) || 0
        }));

    if (type === 'distribuicao') {
        // Agrupar por faixas de margem
        const faixas = {
            '0-20%': 0,
            '21-40%': 0,
            '41-60%': 0,
            '61-80%': 0,
            '81-100%': 0,
            '100%+': 0
        };

        produtosComMargem.forEach(produto => {
            const markup = produto.markup;
            
            if (markup <= 20) {
                faixas['0-20%']++;
            } else if (markup <= 40) {
                faixas['21-40%']++;
            } else if (markup <= 60) {
                faixas['41-60%']++;
            } else if (markup <= 80) {
                faixas['61-80%']++;
            } else if (markup <= 100) {
                faixas['81-100%']++;
            } else {
                faixas['100%+']++;
            }
        });

        return Object.entries(faixas).map(([faixa, quantidade]) => ({
            faixa,
            quantidade
        }));
        
    } else if (type === 'categoria') {
        // Agrupar por categoria
        const categoriaMap = new Map();
        
        produtosComMargem.forEach(produto => {
            const categoria = produto.categoria;
            
            if (!categoriaMap.has(categoria)) {
                categoriaMap.set(categoria, {
                    categoria,
                    markups: [],
                    margemMedia: 0
                });
            }
            
            categoriaMap.get(categoria).markups.push(produto.markup);
        });
        
        // Calcular média por categoria
        return Array.from(categoriaMap.values())
            .map(item => ({
                categoria: item.categoria,
                margemMedia: item.markups.reduce((sum, m) => sum + m, 0) / item.markups.length,
                produtos: item.markups.length
            }))
            .sort((a, b) => b.margemMedia - a.margemMedia);
    }

    return [];
}

/**
 * Obter status do estoque
 * @returns {Array} Array com dados de status do estoque
 */
function getEstoqueStatus() {
    if (!relatorioProdutosState?.produtosData?.length) {
        return [];
    }

    const status = {
        'Sem Estoque': 0,
        'Estoque Baixo': 0,
        'Estoque Normal': 0,
        'Sem Limite Definido': 0
    };

    relatorioProdutosState.produtosData.forEach(produto => {
        const estoque = parseInt(produto.quantidade_estoque) || 0;
        const minimo = parseInt(produto.estoque_minimo) || 0;
        
        if (estoque <= 0) {
            status['Sem Estoque']++;
        } else if (minimo <= 0) {
            status['Sem Limite Definido']++;
        } else if (estoque <= minimo) {
            status['Estoque Baixo']++;
        } else {
            status['Estoque Normal']++;
        }
    });

    return Object.entries(status)
        .map(([statusName, quantidade]) => ({
            status: statusName,
            quantidade
        }))
        .filter(item => item.quantidade > 0);
}

/**
 * Obter top marcas
 * @param {string} metric - 'quantidade' ou 'valor'
 * @param {number} limite - Número de marcas a retornar
 * @returns {Array} Array com top marcas
 */
function getTopMarcas(metric = 'quantidade', limite = 10) {
    if (!relatorioProdutosState?.produtosData?.length) {
        return [];
    }

    const marcaMap = new Map();
    
    relatorioProdutosState.produtosData.forEach(produto => {
        const marca = produto.marca || 'Sem marca';
        
        if (!marcaMap.has(marca)) {
            marcaMap.set(marca, {
                nome: marca,
                quantidade: 0,
                valor: 0
            });
        }
        
        const marcaData = marcaMap.get(marca);
        marcaData.quantidade += 1;
        
        const precoVenda = parseFloat(produto.preco_venda) || 0;
        const estoque = parseInt(produto.quantidade_estoque) || 0;
        marcaData.valor += precoVenda * estoque;
    });
    
    return Array.from(marcaMap.values())
        .sort((a, b) => {
            if (metric === 'valor') {
                return b.valor - a.valor;
            }
            return b.quantidade - a.quantidade;
        })
        .slice(0, limite);
}

/**
 * Obter distribuição por faixa de preço
 * @returns {Array} Array com dados de faixa de preço
 */
function getFaixaPrecoDistribution() {
    if (!relatorioProdutosState?.produtosData?.length) {
        return [];
    }

    const faixas = {
        'Até R$ 50': 0,
        'R$ 51-100': 0,
        'R$ 101-200': 0,
        'R$ 201-500': 0,
        'R$ 501-1000': 0,
        'Acima de R$ 1000': 0
    };

    relatorioProdutosState.produtosData.forEach(produto => {
        const preco = parseFloat(produto.preco_venda) || 0;
        
        if (preco <= 50) {
            faixas['Até R$ 50']++;
        } else if (preco <= 100) {
            faixas['R$ 51-100']++;
        } else if (preco <= 200) {
            faixas['R$ 101-200']++;
        } else if (preco <= 500) {
            faixas['R$ 201-500']++;
        } else if (preco <= 1000) {
            faixas['R$ 501-1000']++;
        } else {
            faixas['Acima de R$ 1000']++;
        }
    });

    return Object.entries(faixas)
        .map(([faixa, quantidade]) => ({
            faixa,
            quantidade
        }))
        .filter(item => item.quantidade > 0);
}

/**
 * Obter produtos com maior necessidade de reposição
 * @param {number} limite - Número de produtos a retornar
 * @returns {Array} Array com produtos para reposição
 */
function getProdutosParaReposicao(limite = 20) {
    if (!relatorioProdutosState?.produtosData?.length) {
        return [];
    }

    return relatorioProdutosState.produtosData
        .filter(produto => {
            const estoque = parseInt(produto.quantidade_estoque) || 0;
            const minimo = parseInt(produto.estoque_minimo) || 0;
            return estoque <= minimo && minimo > 0;
        })
        .map(produto => {
            const estoque = parseInt(produto.quantidade_estoque) || 0;
            const minimo = parseInt(produto.estoque_minimo) || 0;
            const necessidade = minimo - estoque;
            
            return {
                nome: produto.nome,
                categoria: produto.categoria || 'Sem categoria',
                marca: produto.marca || 'Sem marca',
                estoqueAtual: estoque,
                estoqueMinimo: minimo,
                necessidade: necessidade,
                precoVenda: parseFloat(produto.preco_venda) || 0,
                valorNecessario: necessidade * (parseFloat(produto.preco_custo) || 0)
            };
        })
        .sort((a, b) => b.necessidade - a.necessidade)
        .slice(0, limite);
}

/**
 * Obter resumo financeiro do estoque
 * @returns {Object} Objeto com resumo financeiro
 */
function getResumoFinanceiro() {
    if (!relatorioProdutosState?.produtosData?.length) {
        return {
            valorTotalCusto: 0,
            valorTotalVenda: 0,
            margemTotalPotencial: 0,
            valorImobolizado: 0,
            produtosMaisCaros: [],
            produtosMaisBaratos: []
        };
    }

    let valorTotalCusto = 0;
    let valorTotalVenda = 0;
    
    const produtosComPreco = relatorioProdutosState.produtosData
        .map(produto => {
            const precoCusto = parseFloat(produto.preco_custo) || 0;
            const precoVenda = parseFloat(produto.preco_venda) || 0;
            const estoque = parseInt(produto.quantidade_estoque) || 0;
            
            const valorCustoTotal = precoCusto * estoque;
            const valorVendaTotal = precoVenda * estoque;
            
            valorTotalCusto += valorCustoTotal;
            valorTotalVenda += valorVendaTotal;
            
            return {
                nome: produto.nome,
                precoCusto,
                precoVenda,
                estoque,
                valorCustoTotal,
                valorVendaTotal
            };
        })
        .filter(produto => produto.precoVenda > 0);

    const margemTotalPotencial = valorTotalVenda - valorTotalCusto;
    
    // Top 5 mais caros e mais baratos
    const produtosMaisCaros = produtosComPreco
        .sort((a, b) => b.precoVenda - a.precoVenda)
        .slice(0, 5);
        
    const produtosMaisBaratos = produtosComPreco
        .sort((a, b) => a.precoVenda - b.precoVenda)
        .slice(0, 5);

    return {
        valorTotalCusto,
        valorTotalVenda,
        margemTotalPotencial,
        valorImobilizado: valorTotalCusto,
        produtosMaisCaros,
        produtosMaisBaratos
    };
}

/**
 * Obter análise ABC de produtos
 * @returns {Object} Objeto com classificação ABC
 */
function getAnaliseABC() {
    if (!relatorioProdutosState?.produtosData?.length) {
        return { A: [], B: [], C: [] };
    }

    const produtosComValor = relatorioProdutosState.produtosData
        .map(produto => {
            const precoVenda = parseFloat(produto.preco_venda) || 0;
            const estoque = parseInt(produto.quantidade_estoque) || 0;
            const valorTotal = precoVenda * estoque;
            
            return {
                nome: produto.nome,
                categoria: produto.categoria,
                valorTotal
            };
        })
        .filter(produto => produto.valorTotal > 0)
        .sort((a, b) => b.valorTotal - a.valorTotal);

    const valorTotalGeral = produtosComValor.reduce((sum, produto) => sum + produto.valorTotal, 0);
    
    let valorAcumulado = 0;
    const classificacao = { A: [], B: [], C: [] };
    
    produtosComValor.forEach(produto => {
        valorAcumulado += produto.valorTotal;
        const percentualAcumulado = (valorAcumulado / valorTotalGeral) * 100;
        
        if (percentualAcumulado <= 80) {
            classificacao.A.push(produto);
        } else if (percentualAcumulado <= 95) {
            classificacao.B.push(produto);
        } else {
            classificacao.C.push(produto);
        }
    });
    
    return classificacao;
}

// ===== EXPORTAR FUNÇÕES GLOBAIS =====
window.getCategoriaDistribution = getCategoriaDistribution;
window.getTopProdutosByValue = getTopProdutosByValue;
window.getMargemAnalysis = getMargemAnalysis;
window.getEstoqueStatus = getEstoqueStatus;
window.getTopMarcas = getTopMarcas;
window.getFaixaPrecoDistribution = getFaixaPrecoDistribution;
window.getProdutosParaReposicao = getProdutosParaReposicao;
window.getResumoFinanceiro = getResumoFinanceiro;
window.getAnaliseABC = getAnaliseABC;
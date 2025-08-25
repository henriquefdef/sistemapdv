// ===== GERAÇÃO VISUAL DE ETIQUETAS MELHORADA =====

// Configurações dos modelos de etiqueta
const MODELOS_ETIQUETA = {
    '90x30': { width: '90mm', height: '30mm', colunas: 3, fontSize: { nome: '12px', codigo: '10px', preco: '14px' } },
    '50x20': { width: '50mm', height: '20mm', colunas: 4, fontSize: { nome: '10px', codigo: '8px', preco: '12px' } },
    '40x20': { width: '40mm', height: '20mm', colunas: 5, fontSize: { nome: '8px', codigo: '7px', preco: '10px' } }
};

// ===== FUNÇÃO PRINCIPAL DE GERAÇÃO =====
window.generateEtiquetasVisuais = function(dados) {
    console.log('Gerando etiquetas visuais com dados:', dados);
    
    try {
        // Gerar HTML das etiquetas
        const htmlEtiquetas = criarHTMLEtiquetas(dados);
        
        // Abrir em nova aba
        abrirEtiquetasNoNavegador(htmlEtiquetas);
        
    } catch (error) {
        console.error('Erro ao gerar etiquetas:', error);
        alert('Erro ao gerar etiquetas: ' + error.message);
    }
}

// ===== CRIAR HTML DAS ETIQUETAS =====
function criarHTMLEtiquetas(dados) {
    const modelo = MODELOS_ETIQUETA[dados.modelo];
    if (!modelo) {
        throw new Error('Modelo de etiqueta não encontrado: ' + dados.modelo);
    }
    
    let html = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Etiquetas - ${new Date().toLocaleDateString()}</title>
        <style>${gerarCSS(modelo)}</style>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
    </head>
    <body>
        <div class="toolbar">
            <button onclick="window.print()" class="btn-action">
                🖨️ Imprimir Etiquetas
            </button>
            <button onclick="baixarHTML()" class="btn-action">
                💾 Baixar HTML
            </button>
            <button onclick="baixarPDF()" class="btn-action">
                📄 Baixar PDF
            </button>
            <span class="info">Total: ${dados.produtos.length} etiquetas</span>
        </div>
        
        <div class="etiquetas-container" id="etiquetas-container">
    `;
    
    // Gerar cada etiqueta
    dados.produtos.forEach((produto, index) => {
        html += criarEtiquetaIndividual(produto, dados, modelo);
    });
    
    html += `
        </div>
        
        <script>
            function baixarHTML() {
                const blob = new Blob([document.documentElement.outerHTML], { type: 'text/html' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'etiquetas-' + new Date().toISOString().slice(0,10) + '.html';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }
            
            function baixarPDF() {
                try {
                    const { jsPDF } = window.jspdf;
                    const pdf = new jsPDF('p', 'mm', 'a4');
                    
                    pdf.html(document.getElementById('etiquetas-container'), {
                        callback: function (doc) {
                            doc.save('etiquetas-' + new Date().toISOString().slice(0,10) + '.pdf');
                        },
                        x: 10,
                        y: 10,
                        width: 190,
                        windowWidth: 800
                    });
                } catch (error) {
                    alert('Erro ao gerar PDF. Use a opção de imprimir e salve como PDF.');
                }
            }
        </script>
    </body>
    </html>`;
    
    return html;
}

// ===== CRIAR ETIQUETA INDIVIDUAL =====
function criarEtiquetaIndividual(produto, dados, modelo) {
    let etiquetaHTML = '<div class="etiqueta">';
    
    // Nome da empresa (sempre no topo)
    if (dados.informacoesAdicionais === 'empresa') {
        etiquetaHTML += '<div class="etiqueta-empresa-topo">Sua Empresa</div>';
    }
    
    // Preço (logo após empresa)
    if (dados.exibicaoPreco !== 'nenhum' && produto.preco_venda) {
        etiquetaHTML += criarSecaoPreco(produto.preco_venda, dados);
    }
    
    // Código de barras ou QR Code
    if (produto.codigo_barras) {
        if (dados.tipoCodigo === 'qrcode') {
            etiquetaHTML += criarQRCodeMelhorado(produto.codigo_barras);
        } else {
            etiquetaHTML += criarCodigoBarrasMelhorado(produto.codigo_barras);
        }
    }
    
    // Nome do produto (sempre embaixo)
    if (dados.mostrarNome === 'sim') {
        etiquetaHTML += `<div class="etiqueta-nome-bottom">${produto.nome}</div>`;
    }
    
    etiquetaHTML += '</div>';
    return etiquetaHTML;
}

// ===== CÓDIGO DE BARRAS MELHORADO =====
function criarCodigoBarrasMelhorado(codigo) {
    const barrasSVG = gerarBarrasReais(codigo);
    
    return `
        <div class="codigo-barras-container">
            <div class="codigo-barras-svg">${barrasSVG}</div>
            <div class="codigo-texto">${codigo}</div>
        </div>
    `;
}

function gerarBarrasReais(codigo) {
    // Padrão EAN-13 simplificado - mais realista
    const startPattern = '101';
    const endPattern = '101';
    const middlePattern = '01010';
    
    // Tabela de codificação simplificada para EAN-13
    const leftPatterns = {
        '0': '0001101', '1': '0011001', '2': '0010011', '3': '0111101', '4': '0100011',
        '5': '0110001', '6': '0101111', '7': '0111011', '8': '0110111', '9': '0001011'
    };
    
    const rightPatterns = {
        '0': '1110010', '1': '1100110', '2': '1101100', '3': '1000010', '4': '1011100',
        '5': '1001110', '6': '1010000', '7': '1000100', '8': '1001000', '9': '1110100'
    };
    
    let binaryPattern = startPattern;
    
    // Primeira metade dos dígitos
    for (let i = 0; i < Math.min(6, codigo.length); i++) {
        const digit = codigo[i] || '0';
        binaryPattern += leftPatterns[digit] || leftPatterns['0'];
    }
    
    binaryPattern += middlePattern;
    
    // Segunda metade dos dígitos
    for (let i = 6; i < Math.min(12, codigo.length); i++) {
        const digit = codigo[i] || '0';
        binaryPattern += rightPatterns[digit] || rightPatterns['0'];
    }
    
    binaryPattern += endPattern;
    
    // Converter padrão binário em SVG
    const barWidth = 1;
    const barHeight = 40;
    let svgBars = '';
    let x = 0;
    
    for (let i = 0; i < binaryPattern.length; i++) {
        if (binaryPattern[i] === '1') {
            svgBars += `<rect x="${x}" y="0" width="${barWidth}" height="${barHeight}" fill="#000"/>`;
        }
        x += barWidth;
    }
    
    const totalWidth = binaryPattern.length * barWidth;
    
    return `<svg width="${totalWidth}" height="${barHeight}" viewBox="0 0 ${totalWidth} ${barHeight}">${svgBars}</svg>`;
}

// ===== QR CODE MELHORADO =====
function criarQRCodeMelhorado(codigo) {
    const qrSVG = gerarQRCodeReal(codigo);
    
    return `
        <div class="qrcode-container">
            <div class="qrcode-svg">${qrSVG}</div>
            <div class="codigo-texto">${codigo}</div>
        </div>
    `;
}

function gerarQRCodeReal(codigo) {
    // QR Code mais realista baseado no código
    const size = 25;
    const cellSize = 8;
    const hash = complexHash(codigo);
    
    let qrPattern = '';
    
    // Gerar padrão baseado no código
    for (let row = 0; row < size; row++) {
        for (let col = 0; col < size; col++) {
            const cellHash = (hash + row * size + col) * 31;
            
            // Adicionar padrões característicos do QR Code
            let shouldFill = false;
            
            // Cantos de localização (sempre preenchidos)
            if ((row < 8 && col < 8) || 
                (row < 8 && col >= size - 8) || 
                (row >= size - 8 && col < 8)) {
                shouldFill = (row === 0 || row === 6 || col === 0 || col === 6 || 
                             (row >= 2 && row <= 4 && col >= 2 && col <= 4));
            } else {
                // Resto baseado no hash
                shouldFill = Math.abs(cellHash) % 3 === 0;
            }
            
            if (shouldFill) {
                const x = col * cellSize;
                const y = row * cellSize;
                qrPattern += `<rect x="${x}" y="${y}" width="${cellSize}" height="${cellSize}" fill="#000"/>`;
            }
        }
    }
    
    const totalSize = size * cellSize;
    return `<svg width="${totalSize}" height="${totalSize}" viewBox="0 0 ${totalSize} ${totalSize}" style="background: white;">${qrPattern}</svg>`;
}

function complexHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // 32bit integer
    }
    return Math.abs(hash);
}

// ===== SEÇÃO DE PREÇO =====
function criarSecaoPreco(preco, dados) {
    const precoFloat = parseFloat(preco);
    let precoHTML = '<div class="etiqueta-preco">';
    
    switch (dados.exibicaoPreco) {
        case 'valor-total':
            precoHTML += `<div class="preco-total">R$ ${formatarPreco(precoFloat)}</div>`;
            break;
            
        case 'parcelado':
            const valorParcela = calcularValorParcela(precoFloat, dados.parcelas, dados.percentualJuros);
            precoHTML += `<div class="preco-parcelado">${dados.parcelas}x R$ ${formatarPreco(valorParcela)}</div>`;
            break;
            
        case 'ambos':
            const valorParcelaAmbos = calcularValorParcela(precoFloat, dados.parcelas, dados.percentualJuros);
            precoHTML += `
                <div class="preco-total">R$ ${formatarPreco(precoFloat)}</div>
                <div class="preco-parcelado">ou ${dados.parcelas}x R$ ${formatarPreco(valorParcelaAmbos)}</div>
            `;
            break;
    }
    
    precoHTML += '</div>';
    return precoHTML;
}

function calcularValorParcela(preco, parcelas, juros) {
    const precoComJuros = juros > 0 ? preco * (1 + juros / 100) : preco;
    return precoComJuros / parcelas;
}

function formatarPreco(preco) {
    return preco.toFixed(2).replace('.', ',');
}

// ===== CSS MELHORADO =====
function gerarCSS(modelo) {
    return `
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        body {
            font-family: Arial, sans-serif;
            background: #f5f5f5;
            padding: 0;
        }
        
        .toolbar {
            background: white;
            padding: 15px 20px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            display: flex;
            gap: 10px;
            align-items: center;
            position: sticky;
            top: 0;
            z-index: 100;
            flex-wrap: wrap;
        }
        
        .btn-action {
            background: #FF9800;
            color: white;
            border: none;
            padding: 12px 18px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 500;
            transition: all 0.2s;
            min-width: 140px;
        }
        
        .btn-action:hover {
            background: #e68a00;
            transform: translateY(-1px);
        }
        
        .info {
            color: #666;
            font-size: 14px;
            margin-left: auto;
            font-weight: 500;
        }
        
        .etiquetas-container {
            display: grid;
            grid-template-columns: repeat(${modelo.colunas}, 1fr);
            gap: 5mm;
            padding: 20mm;
            max-width: 210mm;
            margin: 0 auto;
            background: white;
        }
        
        .etiqueta {
            width: ${modelo.width};
            height: ${modelo.height};
            padding: 3mm;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            align-items: center;
            text-align: center;
            background: white;
            page-break-inside: avoid;
        }
        
        .etiqueta-empresa-topo {
            font-size: calc(${modelo.fontSize.nome} + 2px);
            font-weight: bold;
            color: #000;
            margin-bottom: 1mm;
            width: 100%;
        }
        
        .etiqueta-nome-bottom {
            font-size: ${modelo.fontSize.nome};
            font-weight: bold;
            line-height: 1.1;
            margin-top: 1mm;
            overflow: hidden;
            text-overflow: ellipsis;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            width: 100%;
            color: #000;
        }
        
        .codigo-barras-container, .qrcode-container {
            margin: 1mm 0;
            flex-grow: 1;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            width: 100%;
        }
        
        .codigo-barras-svg, .qrcode-svg {
            margin-bottom: 1mm;
            max-width: 100%;
            height: auto;
        }
        
        .codigo-barras-svg svg {
            width: 100%;
            height: 15mm;
        }
        
        .qrcode-svg svg {
            width: 15mm;
            height: 15mm;
        }
        
        .codigo-texto {
            font-size: calc(${modelo.fontSize.codigo} + 1px);
            font-family: monospace;
            letter-spacing: 0.5px;
            font-weight: bold;
            margin-bottom: 1mm;
            color: #000;
        }
        
        .etiqueta-preco {
            margin-top: auto;
            width: 100%;
        }
        
        .preco-total {
            font-size: calc(${modelo.fontSize.preco} + 2px);
            font-weight: bold;
            color: #000;
            margin: 1mm 0;
        }
        
        .preco-parcelado {
            font-size: calc(${modelo.fontSize.preco} * 0.8);
            font-weight: 500;
            color: #000;
            margin-top: 1mm;
        }
        
        .etiqueta-empresa {
            font-size: calc(${modelo.fontSize.codigo} * 0.8);
            color: #666;
            margin-top: 1mm;
            border-top: 1px solid #ddd;
            padding-top: 1mm;
            width: 100%;
        }
        
        @media print {
            body { background: white; }
            .toolbar { display: none !important; }
            .etiquetas-container { 
                padding: 0;
                max-width: none;
                margin: 0;
                gap: 2mm;
            }
            .etiqueta {
                border: 1px solid #000;
            }
        }
        
        @media (max-width: 768px) {
            .toolbar {
                padding: 10px;
            }
            
            .btn-action {
                min-width: 120px;
                padding: 10px 14px;
                font-size: 12px;
            }
            
            .etiquetas-container {
                grid-template-columns: repeat(2, 1fr);
                padding: 10mm;
            }
            
            .info {
                margin-left: 0;
                width: 100%;
                text-align: center;
                margin-top: 10px;
            }
        }
    `;
}

// ===== ABRIR NO NAVEGADOR =====
function abrirEtiquetasNoNavegador(html) {
    // Criar blob com o HTML
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    
    // Abrir em nova aba
    const novaAba = window.open(url, '_blank');
    
    if (!novaAba) {
        alert('Pop-up bloqueado! Permita pop-ups para este site e tente novamente.');
        return;
    }
    
    console.log('Etiquetas abertas em nova aba com sucesso!');
    
    // Limpeza da URL após 5 segundos
    setTimeout(() => {
        URL.revokeObjectURL(url);
    }, 5000);
}

console.log('Sistema de geração de etiquetas melhorado carregado ✓');
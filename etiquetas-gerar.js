// ===== GERAÇÃO VISUAL DE ETIQUETAS MELHORADA =====

// Configurações dos modelos de etiqueta
const MODELOS_ETIQUETA = {
    // Modelos existentes
    '90x30': { width: '90mm', height: '30mm', colunas: 3, fontSize: { nome: '12px', codigo: '10px', preco: '14px' }, barcodeWidthPercent: 95, barcodeHeightMm: 18, qrcodeSizeMm: 18, paddingMm: 3 },
    '50x20': { width: '50mm', height: '20mm', colunas: 4, fontSize: { nome: '10px', codigo: '8px', preco: '12px' }, barcodeWidthPercent: 92, barcodeHeightMm: 12, qrcodeSizeMm: 12, paddingMm: 2 },
    '40x20': { width: '40mm', height: '20mm', colunas: 5, fontSize: { nome: '8px', codigo: '7px', preco: '10px' }, barcodeWidthPercent: 90, barcodeHeightMm: 10, qrcodeSizeMm: 10, paddingMm: 2 },

    // Modelos comuns no Brasil adicionados
    '60x40': { width: '60mm', height: '40mm', colunas: 3, fontSize: { nome: '12px', codigo: '10px', preco: '14px' }, barcodeWidthPercent: 95, barcodeHeightMm: 18, qrcodeSizeMm: 18, paddingMm: 3 },
    '50x30': { width: '50mm', height: '30mm', colunas: 4, fontSize: { nome: '12px', codigo: '10px', preco: '14px' }, barcodeWidthPercent: 95, barcodeHeightMm: 14, qrcodeSizeMm: 14, paddingMm: 3 },
    '35x22': { width: '35mm', height: '22mm', colunas: 5, fontSize: { nome: '9px', codigo: '8px', preco: '11px' }, barcodeWidthPercent: 88, barcodeHeightMm: 10, qrcodeSizeMm: 10, paddingMm: 1.5 },
    '40x60': { width: '40mm', height: '60mm', colunas: 4, fontSize: { nome: '12px', codigo: '10px', preco: '14px' }, barcodeWidthPercent: 92, barcodeHeightMm: 20, qrcodeSizeMm: 16, paddingMm: 3 },
    '80x40': { width: '80mm', height: '40mm', colunas: 2, fontSize: { nome: '14px', codigo: '12px', preco: '16px' }, barcodeWidthPercent: 95, barcodeHeightMm: 20, qrcodeSizeMm: 20, paddingMm: 4 },
    '100x50': { width: '100mm', height: '50mm', colunas: 2, fontSize: { nome: '14px', codigo: '12px', preco: '16px' }, barcodeWidthPercent: 95, barcodeHeightMm: 24, qrcodeSizeMm: 24, paddingMm: 4 },
    '100x150': { width: '100mm', height: '150mm', colunas: 1, fontSize: { nome: '16px', codigo: '14px', preco: '18px' }, barcodeWidthPercent: 95, barcodeHeightMm: 40, qrcodeSizeMm: 35, paddingMm: 6 }
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
    const colunasEfetivas = Math.max(1, Math.min(modelo.colunas, (dados.produtos?.length || 1)));
    
    let html = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Etiquetas - ${new Date().toLocaleDateString()}</title>
        <style>${gerarCSS(modelo)}</style>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"></script>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
    </head>
    <body>
        <div class="toolbar">
            <button onclick="window.print()" class="btn-action">
                🖨️ Imprimir
            </button>
            <button onclick="baixarPDF()" class="btn-action">
                📄 Baixar PDF
            </button>
            <span class="info">Total: ${dados.produtos.length} etiquetas</span>
        </div>
        
        <div class="etiquetas-container" id="etiquetas-container" style="grid-template-columns: repeat(${colunasEfetivas}, ${modelo.width}); grid-auto-rows: auto;">
    `;
    
    // Gerar cada etiqueta
    dados.produtos.forEach((produto, index) => {
        html += criarEtiquetaIndividual(produto, dados, modelo);
    });
    
    html += `
        </div>
        
        <script>
            function baixarPDF() {
                try {
                    const { jsPDF } = window.jspdf || {};
                    if (!jsPDF) throw new Error('jsPDF não carregado');
                    if (typeof html2canvas === 'undefined') throw new Error('html2canvas não carregado');

                    const container = document.getElementById('etiquetas-container');
                    const pdf = new jsPDF('p', 'mm', 'a4');
                    const margin = 10;
                    const pageWidth = pdf.internal.pageSize.getWidth();
                    const usableWidth = pageWidth - margin * 2;

                    pdf.html(container, {
                        callback: function (doc) {
                            doc.save('etiquetas-' + new Date().toISOString().slice(0,10) + '.pdf');
                        },
                        x: margin,
                        y: margin,
                        width: usableWidth,
                        windowWidth: container.scrollWidth || 1024,
                        html2canvas: { scale: 2, useCORS: true, allowTaint: true }
                    });
                } catch (error) {
                    console.error('Erro ao gerar PDF:', error);
                    alert('Erro ao gerar PDF. Tente Imprimir e salvar como PDF.');
                }
            }
        </script>
        <script>
            // Renderização de QR Codes usando QRCode.js (visual padrão)
            (function(){
                function mmToPx(mm){ return Math.round(mm * 3.78); }
                var nodes = document.querySelectorAll('.qrcode-svg[data-code]');
                nodes.forEach(function(node){
                    var text = node.getAttribute('data-code') || '';
                    var sizePx = mmToPx(${MODELOS_ETIQUETA[dados.modelo]?.qrcodeSizeMm || 16});
                    node.innerHTML = '';
                    try {
                        new QRCode(node, { text: text, width: sizePx, height: sizePx, correctLevel: QRCode.CorrectLevel.M });
                    } catch(e) { console.error('Falha ao renderizar QR Code:', e); }
                });
            })();
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
        const nomeEmpresa = dados.empresaNome || 'Sua Empresa';
        etiquetaHTML += `<div class="etiqueta-empresa-topo">${nomeEmpresa}</div>`;
    }
    
    // Preço (logo após empresa)
    if (dados.exibicaoPreco !== 'nenhum' && produto.preco_venda) {
        etiquetaHTML += criarSecaoPreco(produto.preco_venda, dados);
    }
    
    // Código de barras ou QR Code
    const sku = produto.codigo_sku || produto.sku || '';
    const barcode = produto.codigo_barras || '';
    if (dados.tipoCodigo === 'qrcode') {
        if (sku) {
            etiquetaHTML += criarQRCodeMelhorado(sku);
        } else if (barcode) {
            etiquetaHTML += criarQRCodeMelhorado(barcode);
        }
    } else {
        if (barcode) {
            etiquetaHTML += criarCodigoBarrasMelhorado(barcode);
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
    return `
        <div class="qrcode-container">
            <div class="qrcode-svg" data-code="${codigo}"></div>
            <div class="codigo-texto">${codigo}</div>
        </div>
    `;
}

function gerarQRCodeReal(codigo) {
    // QR Code visual mais próximo do padrão oficial (Versão 1)
    const size = 21;            // módulos (versão 1)
    const quietZone = 4;        // zona silenciosa
    const cellSize = 6;         // pixels por módulo
    const hash = complexHash(codigo);

    const totalSize = (size + quietZone * 2) * cellSize;
    const offset = quietZone * cellSize;
    let qrPattern = '';

    // Desenha padrões de localização (finder patterns)
    function drawFinder(xCells, yCells) {
        const x = offset + xCells * cellSize;
        const y = offset + yCells * cellSize;
        const outer = 7 * cellSize, inner = 5 * cellSize, core = 3 * cellSize;
        qrPattern += `<rect x="${x}" y="${y}" width="${outer}" height="${outer}" fill="#000"/>`;
        qrPattern += `<rect x="${x + cellSize}" y="${y + cellSize}" width="${inner}" height="${inner}" fill="#fff"/>`;
        qrPattern += `<rect x="${x + 2 * cellSize}" y="${y + 2 * cellSize}" width="${core}" height="${core}" fill="#000"/>`;
    }
    drawFinder(0, 0);                         // topo-esquerda
    drawFinder(size - 7, 0);                  // topo-direita
    drawFinder(0, size - 7);                  // base-esquerda

    // Linhas de temporização (timing patterns) no eixo central
    for (let i = 0; i < size; i++) {
        // Linha horizontal
        const xH = offset + i * cellSize;
        const yH = offset + 6 * cellSize;
        // Pular sobre os padrões de localização
        if (i < 7 || i > size - 8) continue;
        const fillH = i % 2 === 0 ? '#000' : '#fff';
        qrPattern += `<rect x="${xH}" y="${yH}" width="${cellSize}" height="${cellSize}" fill="${fillH}"/>`;

        // Linha vertical
        const xV = offset + 6 * cellSize;
        const yV = offset + i * cellSize;
        if (i < 7 || i > size - 8) continue;
        const fillV = i % 2 === 0 ? '#000' : '#fff';
        qrPattern += `<rect x="${xV}" y="${yV}" width="${cellSize}" height="${cellSize}" fill="${fillV}"/>`;
    }

    // Preenche módulos de dados baseado em hash (aparência típica)
    for (let row = 0; row < size; row++) {
        for (let col = 0; col < size; col++) {
            // Áreas reservadas (finder + timing)
            const inTopLeft = row < 7 && col < 7;
            const inTopRight = row < 7 && col >= size - 7;
            const inBottomLeft = row >= size - 7 && col < 7;
            const onTiming = row === 6 || col === 6;
            if (inTopLeft || inTopRight || inBottomLeft || onTiming) continue;

            const cellHash = (hash + row * size + col) % 7;
            const shouldFill = cellHash === 0 || cellHash === 2 || cellHash === 4; // densidade moderada
            if (shouldFill) {
                const x = offset + col * cellSize;
                const y = offset + row * cellSize;
                qrPattern += `<rect x="${x}" y="${y}" width="${cellSize}" height="${cellSize}" fill="#000"/>`;
            }
        }
    }

    return `<svg width="${totalSize}" height="${totalSize}" viewBox="0 0 ${totalSize} ${totalSize}" style="background: white; image-rendering: pixelated;">${qrPattern}</svg>`;
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
    const alturaMm = parseFloat(String(modelo.height).replace('mm','')) || 0;
    const isPequena = alturaMm && alturaMm <= 30;
    const gapVerticalMm = isPequena ? 0.5 : 1;
    const barcodeAlturaMm = Math.min(modelo.barcodeHeightMm || 14, Math.max(10, alturaMm * 0.45));
    const clampLinhasNome = isPequena ? 1 : 2;
    return `
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        body {
            font-family: Arial, sans-serif;
            background: #f5f5f5;
            padding: 0;
        }

        @page {
            size: A4;
            margin: 10mm;
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
            grid-template-columns: repeat(${modelo.colunas}, ${modelo.width});
            grid-auto-rows: auto;
            gap: 5mm;
            padding: 10mm;
            width: max-content;
            margin: 0 auto;
            background: transparent;
        }
        
        .etiqueta {
            width: ${modelo.width};
            min-width: ${modelo.width};
            min-height: ${modelo.height};
            height: auto;
            padding: ${modelo.paddingMm ?? 3}mm;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            align-items: center;
            text-align: center;
            background: white;
            box-sizing: border-box;
            page-break-inside: avoid;
            break-inside: avoid;
        }
        
        .etiqueta-empresa-topo {
            font-size: calc(${modelo.fontSize.nome} + 2px);
            font-weight: bold;
            color: #000;
            margin-bottom: ${gapVerticalMm}mm;
            width: 100%;
        }
        
        .etiqueta-nome-bottom {
            font-size: ${modelo.fontSize.nome};
            font-weight: bold;
            line-height: 1.1;
            margin-top: ${gapVerticalMm}mm;
            overflow: hidden;
            text-overflow: ellipsis;
            display: -webkit-box;
            -webkit-line-clamp: ${clampLinhasNome};
            -webkit-box-orient: vertical;
            width: 100%;
            color: #000;
        }
        
        .codigo-barras-container, .qrcode-container {
            margin: ${gapVerticalMm}mm 0;
            flex-grow: 1;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            width: 100%;
        }
        
        .codigo-barras-svg, .qrcode-svg {
            margin-bottom: ${gapVerticalMm}mm;
            max-width: 100%;
            height: auto;
        }
        
        .codigo-barras-svg svg {
            width: ${modelo.barcodeWidthPercent}%;
            height: ${barcodeAlturaMm}mm;
        }
        
        .qrcode-svg svg {
            width: ${modelo.qrcodeSizeMm}mm;
            height: ${modelo.qrcodeSizeMm}mm;
        }
        .qrcode-svg canvas, .qrcode-svg img {
            width: ${modelo.qrcodeSizeMm}mm;
            height: ${modelo.qrcodeSizeMm}mm;
        }
        
        .codigo-texto {
            font-size: calc(${modelo.fontSize.codigo} + 1px);
            font-family: monospace;
            letter-spacing: 0.5px;
            font-weight: bold;
            margin-bottom: ${gapVerticalMm}mm;
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
            margin: ${gapVerticalMm}mm 0;
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
                width: max-content;
                margin: 0;
                gap: 2mm;
                grid-template-columns: repeat(${modelo.colunas}, ${modelo.width});
                grid-auto-rows: ${modelo.height};
            }
            .etiqueta {
                border: 1px solid #000;
                height: ${modelo.height};
                min-height: ${modelo.height};
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
    // Abrir em nova aba e escrever o conteúdo para garantir funcionamento dos botões
    const novaAba = window.open('', '_blank');
    
    if (!novaAba) {
        alert('Pop-up bloqueado! Permita pop-ups para este site e tente novamente.');
        return;
    }
    
    novaAba.document.open();
    novaAba.document.write(html);
    novaAba.document.close();
    console.log('Etiquetas abertas em nova aba com sucesso!');
}

console.log('Sistema de geração de etiquetas melhorado carregado ✓');
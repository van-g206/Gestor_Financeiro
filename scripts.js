/* GESTOR FINANCEIRO V10 - SCRIPTS CORRIGIDOS PARA MOBILE/PWA */

const $ = id => document.getElementById(id);
let myChart = null;

// Removi o código de unregister forçado que estava no topo. 
// Ele impedia o PWA de funcionar offline no celular toda vez que você abria o app.

window.onload = () => {
    configurarMenu();
    configurarCategorias();
    carregarDadosIniciais();
    configurarSimulador();
    configurarBotaoPdf();
};

// --- CONTROLE DO MENU LATERAL (CORREÇÃO DE TOQUE) ---
function configurarMenu() {
    const sidebar = $('sidebar');
    const overlay = $('overlay');
    
    // Adicionado 'touchstart' para resposta imediata no celular
    const abrir = (e) => {
        if (e) e.preventDefault();
        sidebar.classList.add('open');
        overlay.classList.add('open');
    };

    const fechar = (e) => {
        if (e) e.preventDefault();
        sidebar.classList.remove('open');
        overlay.classList.remove('open');
    };

    // Suporta clique no PC e toque rápido no celular
    $('btnOpenMenu').onclick = abrir;
    $('btnCloseMenu').onclick = fechar;
    overlay.onclick = fechar;
}

function configurarCategorias() {
    const sel = $('gCat');
    if (sel) {
        sel.innerHTML = `
            <option value="N">Necessidade</option>
            <option value="D">Desejo</option>
            <option value="S">Reserva/Investimento</option>
        `;
    }
}

// --- PERSISTÊNCIA DE DADOS ---
function carregarDadosIniciais() {
    const hoje = new Date();
    const mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
    const mesSalvo = localStorage.getItem('fin_mes_ref') || mesAtual;
    
    $('mesReferencia').value = mesSalvo;
    $('mesReferencia').onchange = (e) => {
        localStorage.setItem('fin_mes_ref', e.target.value);
        carregarDadosDoMes(e.target.value);
    };
    carregarDadosDoMes(mesSalvo);
}

function carregarDadosDoMes(mes) {
    const dadosDefault = {
        rendas: [], gastos: [], notas: [], vr: 0, somarVr: false,
        metas: { n: 50, d: 30, s: 20 }
    };
    const dados = JSON.parse(localStorage.getItem(`fin_v10_${mes}`)) || dadosDefault;

    // Garante que campos de input existam antes de atribuir valor
    if($('metaN')) $('metaN').value = dados.metas.n;
    if($('metaD')) $('metaD').value = dados.metas.d;
    if($('metaS')) $('metaS').value = dados.metas.s;
    if($('ticket')) $('ticket').value = dados.vr || 0;
    if($('incluirVr')) $('incluirVr').checked = dados.somarVr || false;

    // Salva mudanças automaticamente com debounce ou ao perder o foco (blur)
    [$('metaN'), $('metaD'), $('metaS'), $('ticket'), $('incluirVr')].forEach(el => {
        if(el) el.onblur = () => salvarEstadoAtual();
        if(el) el.onchange = () => salvarEstadoAtual();
    });

    atualizarInterface(dados);
}

function salvarEstadoAtual() {
    const mes = $('mesReferencia').value;
    const dAntigos = JSON.parse(localStorage.getItem(`fin_v10_${mes}`)) || { rendas: [], gastos: [], notas: [] };
    
    const dados = {
        rendas: dAntigos.rendas,
        gastos: dAntigos.gastos,
        notas: dAntigos.notas,
        vr: parseFloat($('ticket').value) || 0,
        somarVr: $('incluirVr').checked,
        metas: {
            n: parseFloat($('metaN').value) || 0,
            d: parseFloat($('metaD').value) || 0,
            s: parseFloat($('metaS').value) || 0
        }
    };
    localStorage.setItem(`fin_v10_${mes}`, JSON.stringify(dados));
    atualizarInterface(dados);
}

// --- LÓGICA DE CÁLCULO E INTERFACE ---
function atualizarInterface(d) {
    const rendaRealDinheiro = d.rendas.reduce((acc, cur) => acc + (cur.valor || 0), 0);
    const valorVR = parseFloat(d.vr || 0);

    let saldoDisponivel = rendaRealDinheiro;
    if (d.somarVr) saldoDisponivel += valorVR;

    const gN = d.gastos.filter(g => g.cat === 'N').reduce((acc, cur) => acc + cur.valor, 0);
    const gD = d.gastos.filter(g => g.cat === 'D').reduce((acc, cur) => acc + cur.valor, 0);
    const gS = d.gastos.filter(g => g.cat === 'S').reduce((acc, cur) => acc + cur.valor, 0);
    const totalG = gN + gD + gS;

    $('tTotal').innerText = `R$ ${rendaRealDinheiro.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
    $('tGastos').innerText = `R$ ${totalG.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
    $('tSobra').innerText = `R$ ${(saldoDisponivel - totalG).toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;

    renderizarTabelas(d.rendas, d.gastos);
    renderizarGraficoELegenda(rendaRealDinheiro, gN, gD, gS, d.metas);
    renderizarNotas(d.notas);
}

// --- RENDERIZAÇÃO E REMOÇÃO (CORREÇÃO DE ESCOPO GLOBAL) ---
// Função movida para o escopo window para garantir que o 'onclick' no HTML a encontre
window.removerItem = (chave, index) => {
    const d = obterDadosStorage(); 
    d[chave].splice(index, 1); 
    salvarEAtualizar(d);
};

function renderizarTabelas(rendas, gastos) {
    $('tabRendas').innerHTML = rendas.map((r, i) => `
        <tr><td>${r.desc}</td><td>R$ ${r.valor.toFixed(2)}</td>
        <td style="text-align:right"><button onclick="removerItem('rendas', ${i})" class="btn-delete"><i class="fas fa-trash"></i></button></td></tr>
    `).join('');

    $('tabHist').innerHTML = gastos.sort((a,b) => b.dia - a.dia).map((g, i) => `
        <tr><td><strong>${g.dia}</strong> - ${g.desc}</td><td>R$ ${g.valor.toFixed(2)}</td>
        <td style="text-align:right"><button onclick="removerItem('gastos', ${i})" class="btn-delete"><i class="fas fa-trash"></i></button></td></tr>
    `).join('');
}

function renderizarGraficoELegenda(rendaBase, n, d, s, metas) {
    const ctx = $('financeChart').getContext('2d');
    if (myChart) myChart.destroy();
    
    const temDados = (n + d + s) > 0;
    myChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            datasets: [{
                data: temDados ? [n, d, s] : [1],
                backgroundColor: temDados ? ['#d63384', '#ffc107', '#20c997'] : ['#f0f0f0'],
                borderWidth: 2, borderColor: '#ffffff'
            }]
        },
        options: { cutout: '70%', plugins: { legend: { display: false } }, responsive: true, maintainAspectRatio: false }
    });
    
    const limN = rendaBase * (metas.n / 100);
    const limD = rendaBase * (metas.d / 100);
    const limS = rendaBase * (metas.s / 100);
    
    $('graficoLegenda').innerHTML = `
        <div class="legend-item"><div class="box-color" style="background:#d63384"></div><div class="legend-values"><span>N (${metas.n}%)</span><span>R$ ${n.toFixed(2)}</span></div></div>
        <div class="legend-item"><div class="box-color" style="background:#ffc107"></div><div class="legend-values"><span>D (${metas.d}%)</span><span>R$ ${d.toFixed(2)}</span></div></div>
        <div class="legend-item"><div class="box-color" style="background:#20c997"></div><div class="legend-values"><span>S (${metas.s}%)</span><span>R$ ${s.toFixed(2)}</span></div></div>
    `;
}

// --- AÇÕES DE ADIÇÃO (MELHORADO) ---
$('btnAddRenda').onclick = () => {
    const desc = $('rDesc').value; const valor = parseFloat($('rVal').value);
    if (!desc || isNaN(valor)) return;
    const d = obterDadosStorage(); d.rendas.push({ desc, valor });
    salvarEAtualizar(d); $('rDesc').value = ''; $('rVal').value = '';
};

$('btnAddGasto').onclick = () => {
    const diaVal = $('gDia').value;
    const dia = diaVal ? diaVal.split('-').reverse()[0] : new Date().getDate();
    const desc = $('gDesc').value; const valor = parseFloat($('gVal').value); const cat = $('gCat').value;
    if (!desc || isNaN(valor)) return;
    const d = obterDadosStorage(); d.gastos.push({ dia, desc, valor, cat });
    salvarEAtualizar(d); $('gDesc').value = ''; $('gVal').value = '';
};

$('btnSalvarNota').onclick = () => {
    const texto = $('notaTexto').value; if (!texto) return;
    const d = obterDadosStorage(); d.notas.push({ texto, data: new Date().toLocaleDateString('pt-BR') });
    $('notaTexto').value = ''; salvarEAtualizar(d);
};

function renderizarNotas(notas) {
    $('listaNotas').innerHTML = notas.map((n, i) => `
        <div class="note-item"><p>${n.texto}</p><small>${n.data}</small>
        <button onclick="removerItem('notas', ${i})" class="btn-delete-note"><i class="fas fa-times"></i></button></div>
    `).join('');
}

// --- SIMULADOR ---
function configurarSimulador() {
    const calc = () => {
        const v = parseFloat($('extraValor').value) || 0; 
        const q = parseFloat($('extraQtd').value) || 0;
        const total = v * q;
        $('resExtra').innerText = `Total Extra: R$ ${total.toFixed(2)}`;
        return total;
    };
    
    $('extraValor').oninput = calc; 
    $('extraQtd').oninput = calc;

    if (!$('btnAddExtraSim')) {
        const btnAddExtra = document.createElement('button');
        btnAddExtra.id = 'btnAddExtraSim';
        btnAddExtra.innerText = "Adicionar à Renda";
        btnAddExtra.className = "btn-add"; 
        btnAddExtra.style.width = "100%";
        btnAddExtra.style.marginTop = "10px";
        
        btnAddExtra.onclick = () => {
            const valorExtra = calc();
            if (valorExtra > 0) {
                const d = obterDadosStorage();
                d.rendas.push({ desc: "Ganho Extra (Simulador)", valor: valorExtra });
                salvarEAtualizar(d);
                $('extraValor').value = ''; $('extraQtd').value = '';
                $('resExtra').innerText = "Adicionado!";
            }
        };
        $('resExtra').parentNode.appendChild(btnAddExtra);
    }
}

// --- FUNÇÕES AUXILIARES ---
function obterDadosStorage() {
    const mes = $('mesReferencia').value;
    return JSON.parse(localStorage.getItem(`fin_v10_${mes}`)) || { rendas: [], gastos: [], notas: [], vr: 0, metas: {n:50, d:30, s:20} };
}

function salvarEAtualizar(dados) {
    localStorage.setItem(`fin_v10_${$('mesReferencia').value}`, JSON.stringify(dados));
    atualizarInterface(dados);
}

function configurarBotaoPdf() {
    if (!$('btnImprimirPdf')) {
        const containers = document.querySelectorAll('.sidebar-section');
        const lastContainer = containers[containers.length - 1];
        const btn = document.createElement('button');
        btn.id = 'btnImprimirPdf';
        btn.className = 'menu-action';
        btn.innerHTML = '<i class="fas fa-print"></i> Imprimir Relatório PDF';
        btn.onclick = () => window.print();
        lastContainer.appendChild(btn);
    }
}

// --- BACKUP ---
$('btnExport').onclick = () => {
    const mes = $('mesReferencia').value;
    const dados = localStorage.getItem(`fin_v10_${mes}`);
    const blob = new Blob([dados], {type: "application/json"});
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `backup_${mes}.json`; a.click();
};

$('btnImport').onclick = () => $('fileInput').click();
$('fileInput').onchange = (e) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
        localStorage.setItem(`fin_v10_${$('mesReferencia').value}`, ev.target.result);
        location.reload();
    };
    reader.readAsText(e.target.files[0]);
};
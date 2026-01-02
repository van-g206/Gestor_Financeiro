const $ = id => document.getElementById(id);
const fmt = v => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const idGen = () => Date.now().toString(36) + Math.random().toString(36).substr(2);

// ESTRUTURA DE DADOS
let state = {
    mesAtivo: new Date().toISOString().slice(0, 7),
    dadosPorMes: {}, 
    historicoArquivado: [],
    config: { piso: 2306.08, ticket: 410, incluirVr: false, metaN: 50, metaD: 30, metaS: 20 }
};

let myChart = null;

// MAPA DE ÍCONES PARA CATEGORIAS
const icones = { n: '🏠', d: '🛍️', s: '💰' };

// INICIALIZAÇÃO
document.addEventListener('DOMContentLoaded', () => {
    const categorias = `
        <option value="n">Necessidades</option>
        <option value="d">Desejos</option>
        <option value="s">Poupança</option>
    `;
    if($("catVar")) $("catVar").innerHTML = categorias;
    if($("gCat")) $("gCat").innerHTML = categorias;
    
    carregarTudo();
    
    // Listeners de Configuração
    ["piso", "ticket", "incluirVr", "metaN", "metaD", "metaS"].forEach(id => {
        $(id)?.addEventListener('change', () => {
            atualizarConfig();
            calcularRenda();
        });
    });

    ["manualDia20", "manualDia05", "aluguel"].forEach(id => {
        $(id)?.addEventListener('input', calcularRenda);
    });
});

function mudarMes() {
    state.mesAtivo = $("mesReferencia").value;
    if (!state.dadosPorMes[state.mesAtivo]) {
        state.dadosPorMes[state.mesAtivo] = { vale: 0, saldo: 0, aluguel: 0, variaveis: [], gastos: [] };
    }
    const d = state.dadosPorMes[state.mesAtivo];
    $("manualDia20").value = d.vale || "";
    $("manualDia05").value = d.saldo || "";
    $("aluguel").value = d.aluguel || "";
    calcularRenda();
}

function calcularRenda() {
    const mes = state.mesAtivo;
    const d = state.dadosPorMes[mes];

    d.vale = Number($("manualDia20").value);
    d.saldo = Number($("manualDia05").value);
    d.aluguel = Number($("aluguel").value);

    let rendaTotal = d.vale + d.saldo;
    if (state.config.incluirVr) rendaTotal += state.config.ticket;

    const somaCat = (cat) => {
        const fixos = d.variaveis.filter(v => v.categoria === cat).reduce((a, b) => a + b.valor, 0);
        const diarios = d.gastos.filter(g => g.categoria === cat).reduce((a, b) => a + b.valor, 0);
        return (cat === 'n' ? d.aluguel : 0) + fixos + diarios;
    };

    const tN = somaCat('n'), tD = somaCat('d'), tS = somaCat('s');
    const totalGeral = tN + tD + tS;
    const saldoLivre = rendaTotal - totalGeral;

    // CORES DINÂMICAS DO SALDO
    const cardSaldo = document.querySelector('.main-balance');
    if (cardSaldo) {
        if (saldoLivre < 0) cardSaldo.style.background = "var(--primary-dark)"; 
        else if (rendaTotal > 0 && saldoLivre < (rendaTotal * 0.15)) cardSaldo.style.background = "var(--primary)";
        else cardSaldo.style.background = "var(--cat-s)";
    }

    $("tTotal").textContent = fmt(rendaTotal);
    $("tGastos").textContent = fmt(totalGeral);
    $("tSobra").textContent = fmt(saldoLivre);

    atualizarBarras(rendaTotal, tN, tD, tS);
    renderizarGrafico(tN, tD, tS);
    renderizarListas();
    salvarNoStorage();
    simularDomingos($("simDomingos").value);
}

function atualizarBarras(renda, n, d, s) {
    const metas = [
        { id: 'N', valor: n, metaPerc: state.config.metaN },
        { id: 'D', valor: d, metaPerc: state.config.metaD },
        { id: 'S', valor: s, metaPerc: state.config.metaS }
    ];
    metas.forEach(m => {
        const valorMeta = (renda * m.metaPerc) / 100;
        if (renda > 0) {
            const prog = (m.valor / valorMeta) * 100;
            $(`txt${m.id}`).textContent = `${fmt(m.valor)} / ${fmt(valorMeta)}`;
            $(`bar${m.id}`).style.width = Math.min(100, prog) + "%";
            $(`bar${m.id}`).style.background = prog > 100 ? 'var(--primary-dark)' : ''; 
        } else {
            $(`txt${m.id}`).textContent = `${fmt(m.valor)} / R$ 0,00`;
            $(`bar${m.id}`).style.width = "0%";
        }
    });
}

function simularDomingos(qtd) {
    const piso = Number($("piso").value) || 0;
    const ganho = (piso / 220 * 2) * 6;
    const res = $("resDomingos");
    if(res) res.innerHTML = qtd > 0 ? `1 Domingo: <strong>${fmt(ganho)}</strong><br>Total: <span style="color:var(--cat-s)">${fmt(qtd * ganho)}</span>` : "";
}

function addVariavel() {
    const valor = Number($("valorVar").value);
    if (!valor) return;
    state.dadosPorMes[state.mesAtivo].variaveis.push({
        id: idGen(), desc: $("descVar").value, valor: valor, categoria: $("catVar").value
    });
    $("descVar").value = ""; $("valorVar").value = "";
    calcularRenda();
}

function addGasto() {
    const valor = Number($("gVal").value);
    const dia = $("gDia").value || "00";
    if (!valor) return;
    state.dadosPorMes[state.mesAtivo].gastos.push({
        id: idGen(), dia: dia.padStart(2, '0'), desc: $("gDesc").value, valor: valor, categoria: $("gCat").value
    });
    $("gDia").value = ""; $("gDesc").value = ""; $("gVal").value = "";
    state.dadosPorMes[state.mesAtivo].gastos.sort((a, b) => a.dia - b.dia);
    calcularRenda();
}

function removerItem(lista, id) {
    state.dadosPorMes[state.mesAtivo][lista] = state.dadosPorMes[state.mesAtivo][lista].filter(i => i.id !== id);
    calcularRenda();
}

function renderizarListas() {
    const d = state.dadosPorMes[state.mesAtivo];
    const row = (item, lista) => `
        <tr>
            ${item.dia ? `<td>${item.dia}</td>` : ''}
            <td>${icones[item.categoria] || ''} ${item.desc}</td>
            <td>${fmt(item.valor)}</td>
            <td class="no-print" style="text-align:right"><button onclick="removerItem('${lista}','${item.id}')" class="btn-icon">&times;</button></td>
        </tr>`;

    $("tabVar").innerHTML = d.variaveis.map(i => row(i, 'variaveis')).join('');
    $("tabHist").innerHTML = d.gastos.map(i => row(i, 'gastos')).join('');
    $("listaHistorico").innerHTML = state.historicoArquivado.map(h => `<div class="hist-item"><span>${h.mes}</span> <b>${fmt(h.valor)}</b></div>`).join('');
}

function arquivarMes() {
    const d = state.dadosPorMes[state.mesAtivo];
    if ((d.vale + d.saldo) === 0) return alert("Sem valores para arquivar.");
    if (confirm(`Fechar mês ${state.mesAtivo}?`)) {
        state.historicoArquivado.unshift({ mes: state.mesAtivo, valor: d.vale + d.saldo });
        state.dadosPorMes[state.mesAtivo].gastos = [];
        state.dadosPorMes[state.mesAtivo].vale = 0;
        state.dadosPorMes[state.mesAtivo].saldo = 0;
        mudarMes();
    }
}

function salvarNoStorage() { localStorage.setItem('gestor_v10_pro', JSON.stringify(state)); }

function carregarTudo() {
    const salvo = localStorage.getItem('gestor_v10_pro');
    if (salvo) state = JSON.parse(salvo);
    $("mesReferencia").value = state.mesAtivo;
    $("piso").value = state.config.piso;
    $("ticket").value = state.config.ticket;
    $("incluirVr").checked = state.config.incluirVr;
    $("metaN").value = state.config.metaN;
    $("metaD").value = state.config.metaD;
    $("metaS").value = state.config.metaS;
    mudarMes();
}

function toggleMenu() { 
    $("sidebar").classList.toggle('open'); 
    $("overlay").classList.toggle('open'); 
}

function renderizarGrafico(n, d, s) {
    const canvas = $('financeChart');
    if(!canvas) return;
    if (myChart) {
        myChart.data.datasets[0].data = [n, d, s];
        myChart.update();
    } else {
        myChart = new Chart(canvas.getContext('2d'), {
            type: 'doughnut',
            data: {
                labels: ['Fixo', 'Lazer', 'Reserva'],
                datasets: [{ data: [n, d, s], backgroundColor: ['#d63384', '#e67e22', '#20c997'], borderWidth: 0 }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
        });
    }
}

function gerarPDF() { 
    if($("print-mes")) $("print-mes").textContent = "Mês: " + $("mesReferencia").value; 
    window.print(); 
}

function baixarBackup() {
    const blob = new Blob([JSON.stringify(state)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `backup_${state.mesAtivo}.json`;
    a.click();
}

function restaurarBackup(input) {
    const reader = new FileReader();
    reader.onload = (e) => { state = JSON.parse(e.target.result); carregarTudo(); };
    reader.readAsText(input.files[0]);
} 
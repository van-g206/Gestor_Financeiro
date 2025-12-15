const $ = id => document.getElementById(id);
const fmt = v => Number(v||0).toLocaleString('pt-BR', {style:'currency', currency:'BRL'});
const idGen = () => Date.now().toString(36) + Math.random().toString(36).substr(2);

// --- ESTADO INICIAL DO APLICATIVO ---
let state = {
  salario:0, vr:0, incluirVr:false, aluguel:0,
  config: { n: 50, d: 30, s: 20 },
  horasBase: 220, 
  variaveis:[], gastos:[], historico:[], updated: null,
  descontos: { faltasNJ: 0, faltasJ: 0, atrasos: 0, outros: 0 }, 
  horasExtras: {
    horasDomingo: 6, 
    valorHora: 0,
    ganhoDomingo: 0,
    ativo: false 
  }
};

const CATEGORIAS = {
  n: { name: 'Necessidades', color: '#ef4444' },
  d: { name: 'Desejos', color: '#f59e0b' },
  s: { name: 'Poupança', color: '#10b981' },
};

let myChart = null;


// --- FUNÇÕES GERAIS DE UTILIDADE ---

function salvar() {
  state.updated = new Date().toISOString();
  localStorage.setItem('financeState', JSON.stringify(state));
  render();
}

function carregar() {
  const savedState = localStorage.getItem('financeState');
  if (savedState) {
    state = JSON.parse(savedState);
    state.horasExtras = state.horasExtras || { horasDomingo: 6, valorHora: 0, ganhoDomingo: 0, ativo: false };
    state.descontos = state.descontos || { faltasNJ: 0, faltasJ: 0, atrasos: 0, outros: 0 };
    
  }
  
  // Preenche inputs com o estado salvo
  $("piso").value = state.salario;
  $("ticket").value = state.vr;
  $("aluguel").value = state.aluguel;
  $("incluirVr").checked = state.incluirVr;
  $("heDom").value = state.horasExtras.horasDomingo;
  $("heAtivo").checked = state.horasExtras.ativo;
  $("horasBase").value = state.horasBase;
  
  $("metaN").value = state.config.n;
  $("metaD").value = state.config.d;
  $("metaS").value = state.config.s;

  $("faltasNJ").value = state.descontos.faltasNJ;
  $("faltasJ").value = state.descontos.faltasJ;
  $("atrasos").value = state.descontos.atrasos;
  $("outrosDesc").value = state.descontos.outros;

  // Carrega Modo Escuro
  const darkMode = localStorage.getItem('darkMode') === 'true';
  document.body.classList.toggle('dark-mode', darkMode);
  $("darkModeToggle").checked = darkMode;


  // Inicializa
  calcularRenda();
  render();
}

function calcularRenda() {
  // 1. Coleta e Atualiza Estado da Renda
  const pisoBruto = Number($("piso").value) || 0;
  const ticket = Number($("ticket").value) || 0;
  const aluguel = Number($("aluguel").value) || 0;
  const incluirVr = $("incluirVr").checked;
  const horasMensaisBase = Number(state.horasBase || 220);

  state.salario = pisoBruto;
  state.vr = ticket;
  state.aluguel = aluguel;
  state.incluirVr = incluirVr;


  // 2. Cálculo do Valor por Hora e Extras
  const valorHoraNormal = pisoBruto / horasMensaisBase;
  const valorHoraExtra = valorHoraNormal * 2; // 100% adicional

  $("valorHora").value = valorHoraNormal.toFixed(2);
  state.horasExtras.valorHora = valorHoraNormal;
  state.horasExtras.horasDomingo = Number($("heDom").value) || 0;

  let ganhoExtra = 0;
  if (state.horasExtras.ativo) {
    ganhoExtra = state.horasExtras.horasDomingo * valorHoraExtra;
  }
  state.horasExtras.ganhoDomingo = ganhoExtra;

  // 3. Cálculo de Descontos (Faltas/Atrasos/Outros)
  const faltasNJ = state.descontos.faltasNJ || 0;
  const atrasos = state.descontos.atrasos || 0;
  const outrosDesc = state.descontos.outros || 0;

  const descontoFaltas = faltasNJ * 8 * valorHoraNormal; 
  const descontoAtrasos = atrasos * valorHoraNormal;
  const totalDescontosR = descontoFaltas + descontoAtrasos + outrosDesc;

  // 4. Determina Salário Líquido (Base)
  const salarioLiquidoBase = pisoBruto - totalDescontosR;
  $("salario").value = salarioLiquidoBase.toFixed(2);
  
  // 5. Determina Renda Total (para orçamento)
  let rendaTotal = salarioLiquidoBase + ganhoExtra;
  if (incluirVr) {
    rendaTotal += ticket;
  }
  
  // 6. Atualiza Métricas (Resumo)
  const totalGastos = calcularGastosTotal();
  const saldoRestante = rendaTotal - totalGastos;
  
  // Atualiza DOM
  $("tTotal").textContent = fmt(rendaTotal);
  $("tGastos").textContent = fmt(totalGastos);
  $("tSobra").textContent = fmt(saldoRestante);
  
  // Atualiza Tabela de Descontos
  let htmlDesc = `
    <tr><td>Faltas Não Justificadas (${faltasNJ}d)</td><td class="desconto-valor">${fmt(descontoFaltas)}</td></tr>
    <tr><td>Atrasos (${atrasos}h)</td><td class="desconto-valor">${fmt(descontoAtrasos)}</td></tr>
    <tr><td>Outros Descontos</td><td class="desconto-valor">${fmt(outrosDesc)}</td></tr>
    <tr style="border-top:1px solid var(--border)"><td style="font-weight:700">Total Descontos</td><td class="desconto-valor" id="totalDescontos">${fmt(totalDescontosR)}</td></tr>
  `;
  $("tabDescontos").innerHTML = htmlDesc;

  // Atualiza Resumo de Métricas
  $("mBruto").textContent = fmt(pisoBruto);
  $("mDescontos").textContent = fmt(totalDescontosR);
  $("mLiquidoBase").textContent = fmt(salarioLiquidoBase);
  $("mExtra").textContent = fmt(ganhoExtra);
  $("mValorHe").textContent = fmt(valorHoraExtra);
  $("mVrImpacto").textContent = fmt(ticket);
  $("mRendaTotal").textContent = fmt(rendaTotal);
  $("mAnual").textContent = fmt(rendaTotal * 12);
  
  salvar();
  calcular();
}

function calcularGastosTotal() {
  const totalVar = state.variaveis.reduce((acc, curr) => acc + curr.valor, 0);
  const totalGastos = state.gastos.reduce((acc, curr) => acc + curr.valor, 0);
  const totalAluguel = state.aluguel;
  return totalVar + totalGastos + totalAluguel;
}

function calcular() {
  // Atualiza metas
  state.config.n = Number($("metaN").value) || 0;
  state.config.d = Number($("metaD").value) || 0;
  state.config.s = Number($("metaS").value) || 0;

  const somaMetas = state.config.n + state.config.d + state.config.s;
  $("sumCheck").textContent = `Total: ${somaMetas}%`;
  $("sumCheck").style.color = somaMetas === 100 ? CATEGORIAS.s.color : CATEGORIAS.n.color;

  $("lblN").textContent = state.config.n;
  $("lblD").textContent = state.config.d;
  $("lblS").textContent = state.config.s;

  const rendaTotal = Number($("mRendaTotal").textContent.replace(/[R$.,]/g, '').replace(',', '.') / 100) || 0;
  if (rendaTotal === 0) {
    // Evita divisão por zero
    renderChart({n:0, d:0, s:0}); 
    return {n:0, d:0, s:0};
  }
  
  const metas = {
    n: (rendaTotal * state.config.n) / 100,
    d: (rendaTotal * state.config.d) / 100,
    s: (rendaTotal * state.config.s) / 100,
  };

  const gastosPorCat = { n: state.aluguel, d: 0, s: 0 };

  state.variaveis.forEach(item => gastosPorCat[item.categoria] += item.valor);
  state.gastos.forEach(item => gastosPorCat[item.categoria] += item.valor);

  // --- Renderização das Barras de Progresso ---
  Object.keys(gastosPorCat).forEach(cat => {
    const meta = metas[cat];
    const gasto = gastosPorCat[cat];
    const percentualGasto = (gasto / meta) * 100;
    
    $(cat === 'n' ? 'txtN' : cat === 'd' ? 'txtD' : 'txtS').textContent = `${fmt(gasto)} / ${fmt(meta)}`;
    $(cat === 'n' ? 'barN' : cat === 'd' ? 'barD' : 'barS').style.width = `${Math.min(100, percentualGasto)}%`;

    const alerta = $(cat === 'n' ? 'alertaN' : cat === 'd' ? 'alertaD' : 'alertaS');
    if (gasto > meta) {
      const excesso = gasto - meta;
      alerta.textContent = `🚨 Você excedeu a meta em ${fmt(excesso)}!`;
      alerta.style.color = CATEGORIAS.n.color;
    } else {
      const restante = meta - gasto;
      alerta.textContent = `Restante: ${fmt(restante)}`;
      alerta.style.color = CATEGORIAS.muted;
    }
  });

  renderChart(gastosPorCat);
  salvar();
  return gastosPorCat;
}

// --- FUNÇÕES DE MANIPULAÇÃO DE TRANSAÇÕES ---

function addVariavel() {
  const desc = $("descVar").value;
  const valor = Number($("valorVar").value);
  const cat = $("catVar").value;

  if (desc && valor > 0 && cat) {
    state.variaveis.push({ id: idGen(), desc, valor, categoria: cat, tipo: 'Variável', date: new Date().toISOString() });
    $("descVar").value = "";
    $("valorVar").value = "";
    salvar();
    calcularRenda();
  } else {
    alert("Preencha todos os campos corretamente para Contas.");
  }
}

function removeVariavel(id) {
  state.variaveis = state.variaveis.filter(item => item.id !== id);
  salvar();
  calcularRenda();
}

function addGasto() {
  const desc = $("gDesc").value;
  const valor = Number($("gVal").value);
  const cat = $("gCat").value;

  if (desc && valor > 0 && cat) {
    state.gastos.push({ id: idGen(), desc, valor, categoria: cat, tipo: 'Gasto Diário', date: new Date().toISOString() });
    $("gDesc").value = "";
    $("gVal").value = "";
    salvar();
    calcularRenda();
  } else {
    alert("Preencha todos os campos corretamente para Gastos Diários.");
  }
}

function removeGasto(id) {
  state.gastos = state.gastos.filter(item => item.id !== id);
  salvar();
  calcularRenda();
}

// --- FUNÇÕES DE RENDERIZAÇÃO DO DOM ---

function renderTabVariavel() {
  const table = $("tabVar");
  if (state.variaveis.length === 0) {
    table.innerHTML = "<tr><td colspan='4' style='text-align:center; color:var(--muted)'>Nenhuma conta fixa/variável registrada.</td></tr>";
    return;
  }
  
  let html = "<thead><tr><td>Descrição</td><td>Categoria</td><td>Valor</td><td>Ação</td></tr></thead><tbody>";
  state.variaveis.sort((a, b) => a.desc.localeCompare(b.desc)).forEach(item => {
    const catData = CATEGORIAS[item.categoria];
    html += `
      <tr>
        <td>${item.desc}</td>
        <td style="color:${catData.color}; font-weight:600">${catData.name}</td>
        <td>${fmt(item.valor)}</td>
        <td style="text-align:center">
          <button class="btn-icon btn-danger" onclick="removeVariavel('${item.id}')" aria-label="Remover Conta">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </td>
      </tr>
    `;
  });
  html += `<tr><td colspan="2" style="font-weight:700">Total</td><td style="font-weight:700">${fmt(state.variaveis.reduce((acc, curr) => acc + curr.valor, 0))}</td><td></td></tr>`;
  html += "</tbody>";
  table.innerHTML = html;
}

function renderTabGasto() {
  const table = $("tabHist");
  if (state.gastos.length === 0) {
    table.innerHTML = "<tr><td colspan='4' style='text-align:center; color:var(--muted)'>Nenhum gasto diário registrado.</td></tr>";
    return;
  }
  
  let html = "<thead><tr><td>Data</td><td>Descrição</td><td>Valor</td><td>Ação</td></tr></thead><tbody>";
  state.gastos.sort((a, b) => new Date(b.date) - new Date(a.date)).forEach(item => {
    const catData = CATEGORIAS[item.categoria];
    const date = new Date(item.date).toLocaleDateString('pt-BR');
    html += `
      <tr>
        <td>${date}</td>
        <td>${item.desc}<span class="t-meta" style="color:${catData.color}">${catData.name}</span></td>
        <td>${fmt(item.valor)}</td>
        <td style="text-align:center">
          <button class="btn-icon btn-danger" onclick="removeGasto('${item.id}')" aria-label="Remover Gasto">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </td>
      </tr>
    `;
  });
  html += `<tr><td colspan="2" style="font-weight:700">Total</td><td style="font-weight:700">${fmt(state.gastos.reduce((acc, curr) => acc + curr.valor, 0))}</td><td></td></tr>`;
  html += "</tbody>";
  table.innerHTML = html;
}

function renderSelects() {
  const options = Object.keys(CATEGORIAS).map(key => 
    `<option value="${key}">${CATEGORIAS[key].name}</option>`
  ).join('');
  $("catVar").innerHTML = options;
  $("gCat").innerHTML = options;
}

function renderHistorico() {
  const lista = $("listaHistorico");
  if (state.historico.length === 0) {
    lista.innerHTML = "<div style='padding:15px'>Nenhum mês arquivado ainda.</div>";
    return;
  }

  let html = "<div style='text-align:left'>";
  state.historico.sort((a, b) => new Date(b.date) - new Date(a.date)).forEach(mes => {
    const data = new Date(mes.date).toLocaleDateString('pt-BR', {month: 'long', year: 'numeric'});
    const totalGasto = mes.variaveis.reduce((sum, item) => sum + item.valor, 0) + 
                       mes.gastos.reduce((sum, item) => sum + item.valor, 0) + mes.aluguel;
    const saldo = mes.rendaTotal - totalGasto;
    const saldoClass = saldo >= 0 ? 'val-green' : 'val-red';

    html += `
      <div style="padding:10px 0; border-bottom:1px dashed var(--border); display:flex; justify-content:space-between; align-items:center;">
        <div>
          <strong style="color:var(--primary)">${data.charAt(0).toUpperCase() + data.slice(1)}</strong>
          <span style="display:block; font-size:11px; color:var(--muted)">Renda: ${fmt(mes.rendaTotal)} | Gastos: ${fmt(totalGasto)}</span>
        </div>
        <div style="font-weight:700" class="${saldoClass}">${fmt(saldo)}</div>
      </div>
    `;
  });
  html += "</div>";
  lista.innerHTML = html;
}

function render() {
  if (state.updated) {
    const date = new Date(state.updated).toLocaleTimeString('pt-BR');
    $("ultima").textContent = `Atualizado às ${date}`;
  }
  
  // Atualiza input de Renda
  $("piso").value = state.salario.toFixed(2);
  $("ticket").value = state.vr.toFixed(2);
  $("aluguel").value = state.aluguel.toFixed(2);
  $("incluirVr").checked = state.incluirVr;
  $("heAtivo").checked = state.horasExtras.ativo;
  
  // Renderiza tabelas
  renderTabVariavel();
  renderTabGasto();
  renderHistorico();
}


// --- FUNÇÕES DO CHART.JS (GRÁFICO) ---

function renderChart(gastosPorCat) {
  const ctx = $('financeChart').getContext('2d');
  
  const data = [
    gastosPorCat.n || 0,
    gastosPorCat.d || 0,
    gastosPorCat.s || 0
  ];
  const labels = [CATEGORIAS.n.name, CATEGORIAS.d.name, CATEGORIAS.s.name];
  const colors = [CATEGORIAS.n.color, CATEGORIAS.d.color, CATEGORIAS.s.color];
  
  if (myChart) {
    myChart.data.datasets[0].data = data;
    myChart.update();
    return;
  }

  myChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{
        data: data,
        backgroundColor: colors,
        hoverOffset: 10
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: document.body.classList.contains('dark-mode') ? 'var(--text)' : 'var(--primary)',
            font: {
              size: 11
            }
          }
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              let label = context.label || '';
              if (label) {
                label += ': ';
              }
              if (context.parsed !== null) {
                label += fmt(context.parsed);
              }
              return label;
            }
          }
        }
      }
    }
  });
}

// --- FUNÇÕES DE MENU LATERAL & EXPORTAÇÃO/BACKUP ---

function toggleMenu(){
  $('sidebar').classList.toggle('open');
  $('overlay').classList.toggle('open');
}

function toggleDarkMode() {
  document.body.classList.toggle('dark-mode', $('darkModeToggle').checked);
  localStorage.setItem('darkMode', $('darkModeToggle').checked ? 'true' : 'false');
  if (myChart) {
    myChart.destroy(); 
    myChart = null;
    calcular(); // Recalcula para re-renderizar o gráfico com cores corretas
  }
}

function toggleHe() {
  state.horasExtras.ativo = $('heAtivo').checked;
  salvar();
  calcularRenda();
}

function simularExtras(horas) {
  const h = Number(horas) || 0;
  if (state.horasExtras.valorHora === 0) {
    $("simulacaoOutput").textContent = "Calcule a renda primeiro para obter o valor/hora.";
    return;
  }
  const valorHoraExtra = state.horasExtras.valorHora * 2;
  const ganhoSimulado = h * valorHoraExtra;
  $("simulacaoOutput").textContent = `Projeção de Ganho: ${fmt(ganhoSimulado)}`;
}

function fecharMes() {
  if (!confirm("Deseja realmente fechar e arquivar o mês atual? Os dados atuais serão zerados para um novo ciclo, mas salvos no Histórico.")) return;

  const rendaTotal = Number($("mRendaTotal").textContent.replace(/[R$.,]/g, '').replace(',', '.') / 100) || 0;
  
  const mesArquivado = {
    date: new Date().toISOString(),
    rendaTotal: rendaTotal,
    aluguel: state.aluguel,
    variaveis: [...state.variaveis],
    gastos: [...state.gastos],
    config: {...state.config}
  };

  state.historico.push(mesArquivado);
  
  // Limpa dados do mês atual, mantendo configurações fixas
  state.variaveis = [];
  state.gastos = [];
  state.descontos = { faltasNJ: 0, faltasJ: 0, atrasos: 0, outros: 0 }; 
  state.horasExtras.horasDomingo = 0; // Zera HEs para o próximo mês

  // Atualiza inputs
  $("faltasNJ").value = 0;
  $("faltasJ").value = 0;
  $("atrasos").value = 0;
  $("outrosDesc").value = 0;
  $("heDom").value = 0;
  
  alert("Mês arquivado com sucesso! O estado foi zerado para o novo mês.");
  calcularRenda();
}

function baixarBackup() {
  const dataStr = JSON.stringify(state, null, 2);
  const blob = new Blob([dataStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `gestor_backup_${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  alert("Backup baixado com sucesso! Salve o arquivo em local seguro.");
}

function restaurarBackup(input) {
  const file = input.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const restoredState = JSON.parse(e.target.result);
      if (restoredState && restoredState.salario !== undefined && restoredState.historico !== undefined) {
        if (confirm("Tem certeza que deseja restaurar? Os dados atuais serão substituídos.")) {
          state = restoredState;
          salvar();
          carregar(); // Recarrega o estado e o DOM
          alert("Backup restaurado com sucesso!");
        }
      } else {
        alert("Arquivo de backup inválido.");
      }
    } catch (error) {
      alert("Erro ao ler o arquivo: " + error.message);
    }
  };
  reader.readAsText(file);
}


function exportarExcel() {
    if (!confirm("Deseja exportar as transações de Contas e Gastos Diários como CSV?")) return;

    let csvContent = "data:text/csv;charset=utf-8,\uFEFF"; // \uFEFF for BOM (Excel encoding fix)
    
    // 1. Dados de transações
    const transacoes = [
        ...state.variaveis.map(t => ({...t, type: 'Conta Fixa/Variável'})),
        ...state.gastos.map(t => ({...t, type: 'Gasto Diário'}))
    ];

    if (transacoes.length === 0) {
        alert("Nenhuma transação para exportar.");
        return;
    }

    const headers = ["ID", "Tipo", "Data", "Descrição", "Valor", "Categoria"];
    csvContent += headers.join(";") + "\n";

    transacoes.forEach(t => {
        const row = [
            `"${t.id}"`, // ID entre aspas para evitar quebras em números longos
            t.type,
            new Date(t.date).toISOString().slice(0, 10), // Apenas a data
            `"${t.desc.replace(/"/g, '""')}"`, // Descrição entre aspas e escapa aspas duplas
            t.valor.toFixed(2).replace('.', ','), // Formato brasileiro
            CATEGORIAS[t.categoria].name
        ].join(";");
        csvContent += row + "\n";
    });

    // Cria e baixa o arquivo
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "transacoes_gestor.csv");
    document.body.appendChild(link); 
    link.click();
    document.body.removeChild(link);
}


function gerarRelatorio() {
    alert("Função de Gerar Relatório PDF ainda não implementada.");
    // Para implementar esta função, você precisará de uma biblioteca como 'jspdf' ou 'html2pdf'.
}


// --- INICIALIZAÇÃO ---
document.addEventListener('DOMContentLoaded', () => {
  renderSelects();
  carregar();
  
  // Adiciona listeners para salvar configs e recalcular metas
  document.querySelectorAll('input[id^="meta"], input[id="aluguel"]').forEach(input => {
    input.addEventListener('input', calcularRenda);
  });
  
  document.querySelectorAll('#piso, #ticket, #incluirVr, #horasBase').forEach(input => {
      input.addEventListener('change', calcularRenda);
  });
  
  document.querySelectorAll('#faltasNJ, #faltasJ, #atrasos, #outrosDesc').forEach(input => {
      input.addEventListener('input', calcularRenda);
  });
});
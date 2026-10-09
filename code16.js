var SHEET_ID='1uYl5jd-0eMqxnCpXZI2Rm7VtOdCmrd6CWKFfGX_sgTU';
var SHEET_GID='286377544';
var PAVIMENTOS=['TÉRREO','1º','2º','3º','EANE','INF'];
var PAV_CORES={'TÉRREO':'#2563EB','1º':'#0D9F4F','2º':'#D97706','3º':'#7C3AED','EANE':'#DC2626','INF':'#0891B2'};
var PAV_BADGE={'TÉRREO':'badge-pav-terreo','1º':'badge-pav-1','2º':'badge-pav-2','3º':'badge-pav-3','EANE':'badge-pav-eane','INF':'badge-pav-inf'};
var PARSED=null;
var SELECTED_DATE_IDX=0;
var COLORS=['#2563EB','#D97706','#0D9F4F','#7C3AED','#DC2626','#0891B2','#DB2777','#65A30D','#EA580C','#0284C7'];
var VIEW_MODE='single';
var RANGE_SELECTED=new Set();
var rangeSortKey=null,rangeSortDir=1;
var sortKey=null,sortDir=1;

function norm(s){return(s||'').toString().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim()}
function esc(s){return(s||'').toString().replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
function uniq(arr){return[...new Set(arr.filter(function(v){return v!==''}))].sort(function(a,b){return a.localeCompare(b,'pt-BR')})}
function fmtNow(){return new Date().toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit'})}
function G(id){return document.getElementById(id)}
function alignSingleView(){
  var root=G('single-view');
  if(!root || root.style.display==='none') return;
  var left=root.children[0], right=root.children[1];
  if(!left || !right) return;
  var leftTop=left.querySelector('.cd');
  var rightTop=right.querySelector('.cd');
  if(!leftTop || !rightTop) return;
  rightTop.style.minHeight='';
  var h=leftTop.getBoundingClientRect().height;
  if(h>0) rightTop.style.minHeight=Math.round(h)+'px';
}
window.addEventListener('resize',function(){setTimeout(function(){alignSingleView();injectProdEmpresaPanel()},30)});


var KW_VAZIO=['nao encontrado','não encontrado','n/a','nenhum','nenhuma','sem atividade','sem lancamento','sem lançamento','sem serviço','sem frente de servico','sem frente de serviço','sem frente','indefinido','—','--'];
/* Palavras que precisam ser match EXATO (evita falso positivo com palavras curtas) */
var KW_VAZIO_EXATO=['na','n/a','-','—','--'];
function temAtividade(v){
  if(!v||!v.trim())return false;
  var n=norm(v);
  if(!n)return false;
  /* match exato para palavras muito curtas */
  for(var j=0;j<KW_VAZIO_EXATO.length;j++){if(n===KW_VAZIO_EXATO[j])return false}
  /* match exato OU começa-com para frases */
  for(var i=0;i<KW_VAZIO.length;i++){if(n===KW_VAZIO[i]||n.indexOf(KW_VAZIO[i])===0)return false}
  return true;
}

/* Efetivo real de um dia = pessoas com atividade lancada (excluindo ferias e faltosos) */
function comAtividadeCount(day){return day.ativos.filter(function(p){return !!p.atividade}).length}


/* ═══════ PRODUÇÃO MENSAL — KPI ÚNICO, DETALHE COMPLETO AO CLICAR ═══════ */
var JORNADA_HORAS=8;
function getMonthlyProdRows(days){
  /* Antes alimentava o modal mensal (removido); hoje só serve ao KPI do período. */
  var rows=[];
  (days||[]).forEach(function(day){
    (day.ativos||[]).forEach(function(p){
      var parsed=parseProducaoUnidades(p.prod||'');
      if(!parsed.length)return;
      var m2=0,un=0,m3=0;
      parsed.forEach(function(u){if(u.unidade==='M2')m2+=u.valor;else if(u.unidade==='UN')un+=u.valor;else if(u.unidade==='M3')m3+=u.valor;});
      rows.push({date:day.date||p.data||'—',nome:p.nome||'—',empresa:p.empresa||'—',funcao:p.funcao||'—',pav:p.pav||'—',local:p.regiao||'—',atividade:p.atividade||p.atividadeRaw||'—',prod:p.prod||'—',m2:m2,un:un,m3:m3,ponto:m2>0,horas:JORNADA_HORAS});
    });
  });
  return rows;
}
function calcMonthlyProd(rows){
  /*
   * Regra dos indicadores por unidade:
   * - Cada trabalhador/dia que possui lançamento em uma unidade gera 1 ponto daquela unidade.
   * - Todo ponto corresponde a 8 horas de trabalho.
   * - Portanto, para cada unidade: produção/hora = produção ÷ (pontos × 8).
   * - Produção/colaborador = produção ÷ pontos.
   * - Os pontos são independentes por unidade: m², m³ e UN não são misturados.
   */
  var t={m2:0,un:0,m3:0,pontosM2:0,pontosM3:0,pontosUN:0};
  (rows||[]).forEach(function(r){
    t.m2+=r.m2; t.un+=r.un; t.m3+=r.m3;
    if(r.m2>0)t.pontosM2++;
    if(r.m3>0)t.pontosM3++;
    if(r.un>0)t.pontosUN++;
  });
  t.m2=Number(t.m2.toFixed(2)); t.un=Number(t.un.toFixed(2)); t.m3=Number(t.m3.toFixed(3));
  t.horasM2=t.pontosM2*JORNADA_HORAS;
  t.horasM3=t.pontosM3*JORNADA_HORAS;
  t.horasUN=t.pontosUN*JORNADA_HORAS;
  t.m2Hora=t.pontosM2>0?Number((t.m2/t.horasM2).toFixed(2)):null;
  t.m3Hora=t.pontosM3>0?Number((t.m3/t.horasM3).toFixed(3)):null;
  t.unHora=t.pontosUN>0?Number((t.un/t.horasUN).toFixed(2)):null;
  t.m2Ponto=t.pontosM2>0?Number((t.m2/t.pontosM2).toFixed(2)):null;
  t.m3Ponto=t.pontosM3>0?Number((t.m3/t.pontosM3).toFixed(3)):null;
  t.unPonto=t.pontosUN>0?Number((t.un/t.pontosUN).toFixed(2)):null;
  t.dias=[...new Set((rows||[]).map(function(r){return r.date;}).filter(Boolean))].length;
  return t;
}

function openProducaoPeriodoModal(){
  if(!PARSED)return;
  var days=getRangeDays();
  if(!days.length){toast('Selecione um ou mais dias no periodo','warn');return}
  G('prod-month-modal-title').textContent='📐 Produção do Período';
  G('prod-month-modal-sub').textContent=days.length+' dia(s) selecionados · jornada considerada: '+JORNADA_HORAS+' h por colaborador';
  var emps=uniq(days.flatMap(function(d){return (d.ativos||[]).map(function(p){return p.empresa;}).filter(Boolean);}));
  var funcs=uniq(days.flatMap(function(d){return (d.ativos||[]).map(function(p){return p.funcao;}).filter(Boolean);}));
  var pavs=uniq(days.flatMap(function(d){return (d.ativos||[]).map(function(p){return p.pav;}).filter(Boolean);}));
  G('pm-prod-emp').innerHTML='<option value="">Todas as empresas</option>'+emps.map(function(v){return '<option value="'+esc(v)+'">'+esc(v)+'</option>';}).join('');
  G('pm-prod-func').innerHTML='<option value="">Todas as funções</option>'+funcs.map(function(v){return '<option value="'+esc(v)+'">'+esc(v)+'</option>';}).join('');
  G('pm-prod-pav').innerHTML='<option value="">Todos os pavimentos</option>'+pavs.map(function(v){return '<option value="'+esc(v)+'">'+esc(v)+'</option>';}).join('');
  G('pm-prod-q').value='';G('pm-prod-emp').value='';G('pm-prod-func').value='';G('pm-prod-pav').value='';
  renderMonthlyProdModal();G('prod-month-modal-overlay').classList.add('on');
}
/* ═══ Modal: produção por empresa no período (KPI 🏗️) ═══ */
function openProducaoEmpresaModal(){
  if(!PARSED)return;
  var days=getRangeDays();
  if(!days.length){toast('Selecione um ou mais dias no periodo','warn');return}
  var byEmp={};
  days.forEach(function(day){
    (day.ativos||[]).forEach(function(p){
      if(!temAtividade(p.prod))return;
      var us=parseProducaoUnidades(p.prod);
      if(!us.length)return;
      if(!byEmp[p.empresa])byEmp[p.empresa]={M2:0,M3:0,UN:0,lan:0};
      byEmp[p.empresa].lan+=us.length;
      us.forEach(function(u){byEmp[p.empresa][u.unidade]+=u.valor});
    });
  });
  var keys=Object.keys(byEmp).filter(function(k){return byEmp[k].M2>0||byEmp[k].M3>0||byEmp[k].UN>0}).sort(function(a,b){return byEmp[b].M2-byEmp[a].M2||byEmp[b].M3-byEmp[a].M3||a.localeCompare(b,'pt-BR')});
  var hdr=G('emp-modal-overlay').querySelector('.modal-h');
  hdr.style.background='#0891B2';
  G('emp-modal-title').textContent='🏗️ Produção por Empresa';
  G('emp-modal-sub').textContent=days.length+' dia(s) selecionados · '+keys.length+' empresa(s) com produção';
  var body=G('emp-modal-body');
  if(!keys.length){
    body.innerHTML='<div class="modal-empty">Nenhuma produção lançada no período selecionado.</div>';
    G('emp-modal-overlay').classList.add('on');
    return;
  }
  var tM2=0,tM3=0,tUN=0,tLan=0;
  keys.forEach(function(k){tM2+=byEmp[k].M2;tM3+=byEmp[k].M3;tUN+=byEmp[k].UN;tLan+=byEmp[k].lan});
  var html='<div class="local-summary">'+
    '<div class="local-stat"><b>'+fmtNum(tM2)+'</b><span>Total m²</span></div>'+
    '<div class="local-stat"><b>'+tM3.toLocaleString('pt-BR',{minimumFractionDigits:3,maximumFractionDigits:3})+'</b><span>Total m³</span></div>'+
    '<div class="local-stat"><b>'+fmtNum(tUN)+'</b><span>Total UN</span></div>'+
  '</div>';
  var th='text-align:left;padding:8px 10px;background:#E0F7FA;color:#0E7490;font-family:JetBrains Mono;font-size:9px;text-transform:uppercase;letter-spacing:.04em';
  var td='padding:8px 10px;border-bottom:1px solid #EAF4F6';
  html+='<table class="people-modal-table" style="width:100%;border-collapse:collapse;font-size:12px">'+
    '<thead><tr><th style="'+th+'">#</th><th style="'+th+'">Empresa</th><th style="'+th+'">m²</th><th style="'+th+'">m³</th><th style="'+th+'">UN</th><th style="'+th+'">Lançamentos</th></tr></thead><tbody>';
  keys.forEach(function(k,i){
    var v=byEmp[k];
    html+='<tr style="background:'+(i%2===0?'#fff':'#F8FAFC')+'">'+
      '<td data-label="#" class="nr" style="'+td+';color:var(--ink3)">'+(i+1)+'</td>'+
      '<td data-label="Empresa" style="'+td+'"><span class="badge badge-gray">'+esc(k)+'</span></td>'+
      '<td data-label="m²" class="nr" style="'+td+';font-weight:700;color:#2563EB">'+(v.M2>0?fmtNum(v.M2):'—')+'</td>'+
      '<td data-label="m³" class="nr" style="'+td+';font-weight:700;color:#D97706">'+(v.M3>0?v.M3.toLocaleString('pt-BR',{minimumFractionDigits:3,maximumFractionDigits:3}):'—')+'</td>'+
      '<td data-label="UN" class="nr" style="'+td+';font-weight:700;color:#7C3AED">'+(v.UN>0?fmtNum(v.UN):'—')+'</td>'+
      '<td data-label="Lançamentos" class="nr" style="'+td+';color:var(--ink2)">'+v.lan+'</td>'+
    '</tr>';
  });
  html+='<tr style="background:#E0F7FA;font-weight:700">'+
    '<td colspan="2" style="padding:8px 10px;color:#0E7490;font-family:JetBrains Mono;font-size:9px;text-transform:uppercase;letter-spacing:.04em">Total</td>'+
    '<td class="nr" style="padding:8px 10px;color:#0E7490">'+fmtNum(tM2)+'</td>'+
    '<td class="nr" style="padding:8px 10px;color:#0E7490">'+tM3.toLocaleString('pt-BR',{minimumFractionDigits:3,maximumFractionDigits:3})+'</td>'+
    '<td class="nr" style="padding:8px 10px;color:#0E7490">'+fmtNum(tUN)+'</td>'+
    '<td class="nr" style="padding:8px 10px;color:#0E7490">'+tLan+'</td>'+
  '</tr>';
  html+='</tbody></table>';
  body.innerHTML=html;
  G('emp-modal-overlay').classList.add('on');
}
/* ═══ Modal: produção por FUNÇÃO (dia e período) ═══ */
function openProdFuncDiaModal(funcKey){
  var day=getSelectedDay();
  if(!day||!funcKey)return;
  var lista=(day.ativos||[]).filter(function(p){return (p.funcao||'(sem função)')===funcKey&&temAtividade(p.prod)});
  var hdr=G('emp-modal-overlay').querySelector('.modal-h');
  hdr.style.background='#D97706';
  G('emp-modal-title').textContent='⚒️ Produção — '+funcKey;
  G('emp-modal-sub').textContent=day.date+' · '+lista.length+' pessoa(s) com produção lançada';
  var body=G('emp-modal-body');
  if(!lista.length){
    body.innerHTML='<div class="modal-empty">Nenhuma produção lançada nesta função neste dia.</div>';
  }else{
    var t={M2:0,M3:0,UN:0};
    lista.forEach(function(p){parseProducaoUnidades(p.prod).forEach(function(u){t[u.unidade]+=u.valor})});
    var html='<div class="local-summary">'+
      '<div class="local-stat"><b>'+fmtNum(t.M2)+'</b><span>Total m²</span></div>'+
      '<div class="local-stat"><b>'+t.M3.toLocaleString('pt-BR',{minimumFractionDigits:3,maximumFractionDigits:3})+'</b><span>Total m³</span></div>'+
      '<div class="local-stat"><b>'+fmtNum(t.UN)+'</b><span>Total UN</span></div>'+
    '</div>';
    var th='text-align:left;padding:8px 10px;background:#FEF3C7;color:#92400E;font-family:JetBrains Mono;font-size:9px;text-transform:uppercase;letter-spacing:.04em';
    var td='padding:8px 10px;border-bottom:1px solid #FDE8C8';
    html+='<table class="people-modal-table" style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr>'+
      '<th style="'+th+'">Nome</th><th style="'+th+'">Empresa</th><th style="'+th+'">Pav.</th><th style="'+th+'">Atividade</th><th style="'+th+'">Produção</th></tr></thead><tbody>';
    lista.sort(function(a,b){return(a.nome||'').localeCompare(b.nome||'','pt-BR')}).forEach(function(p,i){
      var us=parseProducaoUnidades(p.prod);
      var txt=us.length?us.map(function(u){return fmtNum(u.valor)+' '+(u.unidade==='M2'?'m²':u.unidade==='M3'?'m³':'un')}).join(' + '):'—';
      html+='<tr style="background:'+(i%2===0?'#fff':'#F8FAFC')+'">'+
        '<td style="'+td+';font-weight:600">'+esc(p.nome)+'</td>'+
        '<td style="'+td+'"><span class="badge badge-gray">'+esc(p.empresa)+'</span></td>'+
        '<td style="'+td+'">'+pavBadge(p.pav)+'</td>'+
        '<td style="'+td+';color:var(--ink2)">'+esc(p.atividade||'—')+'</td>'+
        '<td style="'+td+'"><div style="font-weight:700;color:#B45309">'+txt+'</div><div style="font-size:10px;color:var(--ink3)">'+esc(p.prod)+'</div></td>'+
      '</tr>';
    });
    html+='</tbody></table>';
    body.innerHTML=html;
  }
  G('emp-modal-overlay').classList.add('on');
}

function openProducaoFuncModal(){
  if(!PARSED)return;
  var days=getRangeDays();
  if(!days.length){toast('Selecione um ou mais dias no periodo','warn');return}
  var byFunc={};
  days.forEach(function(day){
    (day.ativos||[]).forEach(function(p){
      if(!temAtividade(p.prod))return;
      var us=parseProducaoUnidades(p.prod);
      if(!us.length)return;
      var k=p.funcao||'(sem função)';
      if(!byFunc[k])byFunc[k]={M2:0,M3:0,UN:0,lan:0,pessoas:{}};
      byFunc[k].lan+=us.length;
      byFunc[k].pessoas[p.nome]=1;
      us.forEach(function(u){byFunc[k][u.unidade]+=u.valor});
    });
  });
  var keys=Object.keys(byFunc).filter(function(k){return byFunc[k].M2>0||byFunc[k].M3>0||byFunc[k].UN>0}).sort(function(a,b){return byFunc[b].M2-byFunc[a].M2||byFunc[b].M3-byFunc[a].M3||byFunc[b].UN-byFunc[a].UN||a.localeCompare(b,'pt-BR')});
  var hdr=G('emp-modal-overlay').querySelector('.modal-h');
  hdr.style.background='#D97706';
  G('emp-modal-title').textContent='⚒️ Produção por Função';
  G('emp-modal-sub').textContent=days.length+' dia(s) selecionados · '+keys.length+' função(ões) com produção';
  var body=G('emp-modal-body');
  if(!keys.length){
    body.innerHTML='<div class="modal-empty">Nenhuma produção lançada no período selecionado.</div>';
    G('emp-modal-overlay').classList.add('on');
    return;
  }
  var tM2=0,tM3=0,tUN=0,tLan=0;
  keys.forEach(function(k){tM2+=byFunc[k].M2;tM3+=byFunc[k].M3;tUN+=byFunc[k].UN;tLan+=byFunc[k].lan});
  var html='<div class="local-summary">'+
    '<div class="local-stat"><b>'+fmtNum(tM2)+'</b><span>Total m²</span></div>'+
    '<div class="local-stat"><b>'+tM3.toLocaleString('pt-BR',{minimumFractionDigits:3,maximumFractionDigits:3})+'</b><span>Total m³</span></div>'+
    '<div class="local-stat"><b>'+fmtNum(tUN)+'</b><span>Total UN</span></div>'+
  '</div>';
  var th='text-align:left;padding:8px 10px;background:#FEF3C7;color:#92400E;font-family:JetBrains Mono;font-size:9px;text-transform:uppercase;letter-spacing:.04em';
  var td='padding:8px 10px;border-bottom:1px solid #FDE8C8';
  html+='<table class="people-modal-table" style="width:100%;border-collapse:collapse;font-size:12px">'+
    '<thead><tr><th style="'+th+'">#</th><th style="'+th+'">Função</th><th style="'+th+'">Pessoas</th>'+
    '<th style="'+th+';text-align:right">m²</th><th style="'+th+';text-align:right">m³</th><th style="'+th+';text-align:right">UN</th><th style="'+th+';text-align:right">Lançamentos</th></tr></thead><tbody>';
  keys.forEach(function(k,i){
    var v=byFunc[k],np=Object.keys(v.pessoas).length;
    html+='<tr style="background:'+(i%2===0?'#fff':'#F8FAFC')+'">'+
      '<td style="'+td+';color:var(--ink3)">'+(i+1)+'</td>'+
      '<td style="'+td+';font-weight:600">'+esc(k)+'</td>'+
      '<td style="'+td+'">'+np+'</td>'+
      '<td style="'+td+';text-align:right;font-weight:700;color:#2563EB">'+(v.M2>0?fmtNum(v.M2):'—')+'</td>'+
      '<td style="'+td+';text-align:right;font-weight:700;color:#D97706">'+(v.M3>0?v.M3.toLocaleString('pt-BR',{minimumFractionDigits:3,maximumFractionDigits:3}):'—')+'</td>'+
      '<td style="'+td+';text-align:right;font-weight:700;color:#7C3AED">'+(v.UN>0?fmtNum(v.UN):'—')+'</td>'+
      '<td style="'+td+';text-align:right;color:var(--ink2)">'+v.lan+'</td>'+
    '</tr>';
  });
  html+='<tr style="background:#FDE8C8;font-weight:700">'+
    '<td colspan="3" style="padding:8px 10px;color:#92400E;font-family:JetBrains Mono;font-size:9px;text-transform:uppercase;letter-spacing:.04em">Total</td>'+
    '<td style="padding:8px 10px;text-align:right;color:#92400E">'+fmtNum(tM2)+'</td>'+
    '<td style="padding:8px 10px;text-align:right;color:#92400E">'+tM3.toLocaleString('pt-BR',{minimumFractionDigits:3,maximumFractionDigits:3})+'</td>'+
    '<td style="padding:8px 10px;text-align:right;color:#92400E">'+fmtNum(tUN)+'</td>'+
    '<td style="padding:8px 10px;text-align:right;color:#92400E">'+tLan+'</td>'+
  '</tr>';
  html+='</tbody></table>';
  body.innerHTML=html;
  G('emp-modal-overlay').classList.add('on');
}

function monthlyProdMatches(r,q,emp,func,pav){
  if(emp&&r.empresa!==emp)return false;if(func&&r.funcao!==func)return false;if(pav&&r.pav!==pav)return false;
  if(q){var txt=norm([r.date,r.nome,r.empresa,r.funcao,r.pav,r.local,r.atividade,r.prod].join(' '));if(txt.indexOf(q)===-1)return false;}
  return true;
}

/* Agrega lançamentos por empresa: totais por unidade + nº de lançamentos */
function prodPorEmpresa(rows){
  var byEmp={};
  (rows||[]).forEach(function(r){
    if(!byEmp[r.empresa])byEmp[r.empresa]={M2:0,M3:0,UN:0,lan:0};
    var e=byEmp[r.empresa];e.M2+=r.m2;e.M3+=r.m3;e.UN+=r.un;e.lan++;
  });
  return Object.keys(byEmp).map(function(k){var e=byEmp[k];return{nome:k,M2:e.M2,M3:e.M3,UN:e.UN,lan:e.lan}}).sort(function(a,b){return b.M2-a.M2||b.M3-a.M3||b.UN-a.UN||a.nome.localeCompare(b.nome,'pt-BR')});
}
function pmEmpTableHTML(emps){
  if(!emps.length)return '';
  var t={M2:0,M3:0,UN:0,lan:0};
  emps.forEach(function(e){t.M2+=e.M2;t.M3+=e.M3;t.UN+=e.UN;t.lan+=e.lan});
  var h='<div class="pm-prod-break" style="margin-top:10px"><span>🏗️ Produção por empresa</span><strong>'+emps.length+' empresa(s)</strong></div>'+
    '<div class="pm-prod-table-wrap" style="margin-bottom:10px"><table class="pm-prod-table"><thead><tr><th>#</th><th>Empresa</th><th>m²</th><th>m³</th><th>UN</th><th>Lançamentos</th></tr></thead><tbody>';
  emps.forEach(function(e,i){
    h+='<tr><td class="nr" data-label="#">'+(i+1)+'</td><td data-label="Empresa"><span class="badge badge-gray">'+esc(e.nome)+'</span></td>'+
      '<td class="unit-val" data-label="m²">'+(e.M2>0?fmtNum(e.M2):'—')+'</td>'+
      '<td class="unit-val" data-label="m³">'+(e.M3>0?e.M3.toLocaleString('pt-BR',{minimumFractionDigits:3,maximumFractionDigits:3}):'—')+'</td>'+
      '<td class="unit-val" data-label="UN">'+(e.UN>0?fmtNum(e.UN):'—')+'</td>'+
      '<td class="nr" data-label="Lançamentos">'+e.lan+'</td></tr>';
  });
  h+='<tr><td colspan="2" data-label="Total" style="font-weight:700;color:#0E7490">TOTAL</td>'+
    '<td class="unit-val" data-label="m²" style="font-weight:700;color:#0E7490">'+fmtNum(t.M2)+'</td>'+
    '<td class="unit-val" data-label="m³" style="font-weight:700;color:#0E7490">'+t.M3.toLocaleString('pt-BR',{minimumFractionDigits:3,maximumFractionDigits:3})+'</td>'+
    '<td class="unit-val" data-label="UN" style="font-weight:700;color:#0E7490">'+fmtNum(t.UN)+'</td>'+
    '<td class="nr" data-label="Lançamentos" style="font-weight:700;color:#0E7490">'+t.lan+'</td></tr>';
  h+='</tbody></table></div>';
  return h;
}
function renderMonthlyProdModal(){
  if(!PARSED)return;
  var rows=getMonthlyProdRows(getRangeDays());
  var q=norm(G('pm-prod-q').value),emp=G('pm-prod-emp').value,func=G('pm-prod-func').value,pav=G('pm-prod-pav').value;
  rows=rows.filter(function(r){return monthlyProdMatches(r,q,emp,func,pav);}).sort(function(a,b){var da=parseDateBR(a.date),db=parseDateBR(b.date);var va=da?da.y*10000+da.m*100+da.d:0,vb=db?db.y*10000+db.m*100+db.d:0;return va-vb||a.nome.localeCompare(b.nome,'pt-BR');});
  var m=calcMonthlyProd(rows);
  G('prod-month-modal-summary').innerHTML=
    '<div class="pm-prod-stat"><div class="p-l">Produção do período m²</div><div class="p-v">'+fmtNum(m.m2)+' m²</div><div class="p-f">soma dos lançamentos em m²</div></div>'+    '<div class="pm-prod-stat"><div class="p-l">Trabalhador-dia m²</div><div class="p-v">'+m.pontosM2+'</div><div class="p-f">1 trabalhador/dia com m²</div></div>'+    '<div class="pm-prod-stat"><div class="p-l">Produção/hora m²</div><div class="p-v">'+(m.m2Hora===null?'N/D':fmtNum(m.m2Hora)+' m²/h')+'</div><div class="p-f">m² ÷ (pontos × 8 h)</div></div>'+    '<div class="pm-prod-stat"><div class="p-l">Produção/trabalhador-dia m²</div><div class="p-v">'+(m.m2Ponto===null?'N/D':fmtNum(m.m2Ponto)+' m²')+'</div><div class="p-f">m² ÷ pontos</div></div>'+    '<div class="pm-prod-stat"><div class="p-l">Produção do período m³</div><div class="p-v">'+m.m3.toLocaleString('pt-BR',{minimumFractionDigits:3,maximumFractionDigits:3})+' m³</div><div class="p-f">soma dos lançamentos em m³</div></div>'+    '<div class="pm-prod-stat"><div class="p-l">Trabalhador-dia m³</div><div class="p-v">'+m.pontosM3+'</div><div class="p-f">1 trabalhador/dia com m³</div></div>'+    '<div class="pm-prod-stat"><div class="p-l">Produção/hora m³</div><div class="p-v">'+(m.m3Hora===null?'N/D':m.m3Hora.toLocaleString('pt-BR',{minimumFractionDigits:3,maximumFractionDigits:3})+' m³/h')+'</div><div class="p-f">m³ ÷ (pontos × 8 h)</div></div>'+    '<div class="pm-prod-stat"><div class="p-l">Produção/trabalhador-dia m³</div><div class="p-v">'+(m.m3Ponto===null?'N/D':m.m3Ponto.toLocaleString('pt-BR',{minimumFractionDigits:3,maximumFractionDigits:3})+' m³')+'</div><div class="p-f">m³ ÷ pontos</div></div>'+    '<div class="pm-prod-stat"><div class="p-l">Produção do período UN</div><div class="p-v">'+fmtNum(m.un)+' UN</div><div class="p-f">soma dos lançamentos em UN</div></div>'+    '<div class="pm-prod-stat"><div class="p-l">Trabalhador-dia UN</div><div class="p-v">'+m.pontosUN+'</div><div class="p-f">1 trabalhador/dia com UN</div></div>'+    '<div class="pm-prod-stat"><div class="p-l">Produção/hora UN</div><div class="p-v">'+(m.unHora===null?'N/D':fmtNum(m.unHora)+' UN/h')+'</div><div class="p-f">UN ÷ (pontos × 8 h)</div></div>'+    '<div class="pm-prod-stat"><div class="p-l">Produção/trabalhador-dia UN</div><div class="p-v">'+(m.unPonto===null?'N/D':fmtNum(m.unPonto)+' UN')+'</div><div class="p-f">UN ÷ pontos</div></div>';
  G('pm-prod-results').textContent=rows.length+' lançamento(s)';
  G('pm-emp-summary').innerHTML=pmEmpTableHTML(prodPorEmpresa(rows));
  var body=G('prod-month-modal-body');
  if(!rows.length){body.innerHTML='<div class="pm-prod-empty">Nenhuma produção encontrada com os filtros aplicados.</div>';return;}
  var h='<table class="pm-prod-table"><thead><tr><th>#</th><th>Data</th><th>Nome</th><th>Empresa</th><th>Função</th><th>Pavimento</th><th>Local</th><th>Atividade</th><th>Produção lançada</th><th>M²</th><th>UN</th><th>M³</th><th>Horas</th></tr></thead><tbody>';
  rows.forEach(function(r,i){
    var m3txt=r.m3.toLocaleString('pt-BR',{minimumFractionDigits:3,maximumFractionDigits:3});
    h+='<tr><td class="nr" data-label="#">'+(i+1)+'</td>'+
      '<td data-label="Data">'+esc(r.date)+'</td>'+
      '<td data-label="Nome" style="font-weight:700">'+esc(r.nome)+'</td>'+
      '<td data-label="Empresa"><span class="badge badge-gray">'+esc(r.empresa)+'</span></td>'+
      '<td data-label="Função" style="color:var(--ink2)">'+esc(r.funcao)+'</td>'+
      '<td data-label="Pavimento">'+pavBadge(r.pav)+'</td>'+
      '<td data-label="Local">'+esc(r.local)+'</td>'+
      '<td data-label="Atividade">'+esc(r.atividade)+'</td>'+
      '<td data-label="Produção" class="prod-launch">'+esc(r.prod)+'</td>'+
      '<td data-label="M²" class="unit-val">'+fmtNum(r.m2)+' m²</td>'+
      '<td data-label="UN" class="unit-val">'+fmtNum(r.un)+'</td>'+
      '<td data-label="M³" class="unit-val">'+m3txt+' m³</td>'+
      '<td data-label="Horas" class="unit-val">'+JORNADA_HORAS+' h</td>'+
      '</tr>';
  });
  h+='</tbody></table>';body.innerHTML=h;
}
function printMonthlyProdModal(){
  if(!PARSED)return;
  var rows=getMonthlyProdRows(getRangeDays());
  var q=norm(G('pm-prod-q').value),emp=G('pm-prod-emp').value,func=G('pm-prod-func').value,pav=G('pm-prod-pav').value;
  rows=rows.filter(function(r){return monthlyProdMatches(r,q,emp,func,pav);}).sort(function(a,b){var da=parseDateBR(a.date),db=parseDateBR(b.date);var va=da?da.y*10000+da.m*100+da.d:0,vb=db?db.y*10000+db.m*100+db.d:0;return va-vb||a.nome.localeCompare(b.nome,'pt-BR');});
  var m=calcMonthlyProd(rows);
  var printTitle='Produção — Período selecionado';
  var empsPrint=prodPorEmpresa(rows);
  var tP={M2:0,M3:0,UN:0,lan:0};
  empsPrint.forEach(function(e){tP.M2+=e.M2;tP.M3+=e.M3;tP.UN+=e.UN;tP.lan+=e.lan});
  G('print-header').innerHTML='<h1>RDO — '+esc(printTitle)+'</h1><p>'+rows.length+' lançamento(s) · '+empsPrint.length+' empresa(s) · '+m.pontosM2+' colaborador(es) m² · '+fmtNum(m.m2)+' m² · '+m.horasM2+' h m² · '+m.dias+' dia(s) · Impresso em '+fmtNow()+'</p>';
  var h='<div class="monthly-print-report"><div class="mpr-summary">'+
    '<section class="mpr-group"><div class="mpr-group-title">M²</div><div class="mpr-grid">'+
    '<div class="mpr-stat"><div class="mpr-label">Produção do período</div><div class="mpr-val">'+fmtNum(m.m2)+' m²</div><div class="mpr-fact">soma dos lançamentos</div></div>'+
    '<div class="mpr-stat"><div class="mpr-label">Colaboradores</div><div class="mpr-val">'+m.pontosM2+'</div><div class="mpr-fact">trabalhadores/dia com m²</div></div>'+
    '<div class="mpr-stat"><div class="mpr-label">Produção/hora</div><div class="mpr-val">'+(m.m2Hora===null?'N/D':fmtNum(m.m2Hora)+' m²/h')+'</div><div class="mpr-fact">m² ÷ (colaboradores × 8 h)</div></div>'+
    '<div class="mpr-stat"><div class="mpr-label">Produção/colaborador</div><div class="mpr-val">'+(m.m2Ponto===null?'N/D':fmtNum(m.m2Ponto)+' m²')+'</div><div class="mpr-fact">m² ÷ colaboradores</div></div>'+
    '</div></section>'+
    '<section class="mpr-group"><div class="mpr-group-title">M³</div><div class="mpr-grid">'+
    '<div class="mpr-stat"><div class="mpr-label">Produção do período</div><div class="mpr-val">'+m.m3.toLocaleString('pt-BR',{minimumFractionDigits:3,maximumFractionDigits:3})+' m³</div><div class="mpr-fact">soma dos lançamentos</div></div>'+
    '<div class="mpr-stat"><div class="mpr-label">Colaboradores</div><div class="mpr-val">'+m.pontosM3+'</div><div class="mpr-fact">trabalhadores/dia com m³</div></div>'+
    '<div class="mpr-stat"><div class="mpr-label">Produção/hora</div><div class="mpr-val">'+(m.m3Hora===null?'N/D':m.m3Hora.toLocaleString('pt-BR',{minimumFractionDigits:3,maximumFractionDigits:3})+' m³/h')+'</div><div class="mpr-fact">m³ ÷ (colaboradores × 8 h)</div></div>'+
    '<div class="mpr-stat"><div class="mpr-label">Produção/colaborador</div><div class="mpr-val">'+(m.m3Ponto===null?'N/D':m.m3Ponto.toLocaleString('pt-BR',{minimumFractionDigits:3,maximumFractionDigits:3})+' m³')+'</div><div class="mpr-fact">m³ ÷ colaboradores</div></div>'+
    '</div></section>'+
    '<section class="mpr-group"><div class="mpr-group-title">UN</div><div class="mpr-grid">'+
    '<div class="mpr-stat"><div class="mpr-label">Produção do período</div><div class="mpr-val">'+fmtNum(m.un)+' UN</div><div class="mpr-fact">soma dos lançamentos</div></div>'+
    '<div class="mpr-stat"><div class="mpr-label">Colaboradores</div><div class="mpr-val">'+m.pontosUN+'</div><div class="mpr-fact">trabalhadores/dia com UN</div></div>'+
    '<div class="mpr-stat"><div class="mpr-label">Produção/hora</div><div class="mpr-val">'+(m.unHora===null?'N/D':fmtNum(m.unHora)+' UN/h')+'</div><div class="mpr-fact">UN ÷ (colaboradores × 8 h)</div></div>'+
    '<div class="mpr-stat"><div class="mpr-label">Produção/colaborador</div><div class="mpr-val">'+(m.unPonto===null?'N/D':fmtNum(m.unPonto)+' UN')+'</div><div class="mpr-fact">UN ÷ colaboradores</div></div>'+
    '</div></section>'+
    '</div>';
  if(empsPrint.length){
    h+='<div class="mpr-section-title">Produção por empresa</div><table class="mpr-emp-table"><thead><tr><th>#</th><th>Empresa</th><th>m²</th><th>m³</th><th>UN</th><th>Lançamentos</th></tr></thead><tbody>';
    empsPrint.forEach(function(e,i){
      h+='<tr><td>'+(i+1)+'</td><td style="text-align:left!important"><b>'+esc(e.nome)+'</b></td>'+
        '<td>'+(e.M2>0?fmtNum(e.M2):'—')+'</td>'+
        '<td>'+(e.M3>0?e.M3.toLocaleString('pt-BR',{minimumFractionDigits:3,maximumFractionDigits:3}):'—')+'</td>'+
        '<td>'+(e.UN>0?fmtNum(e.UN):'—')+'</td>'+
        '<td>'+e.lan+'</td></tr>';
    });
    h+='<tr><td colspan="2" style="text-align:left!important;font-weight:700">TOTAL</td><td style="font-weight:700">'+fmtNum(tP.M2)+'</td><td style="font-weight:700">'+tP.M3.toLocaleString('pt-BR',{minimumFractionDigits:3,maximumFractionDigits:3})+'</td><td style="font-weight:700">'+fmtNum(tP.UN)+'</td><td style="font-weight:700">'+tP.lan+'</td></tr>';
    h+='</tbody></table>';
  }
  h+='<div class="mpr-section-title">Detalhamento da produção</div><table><thead><tr><th>#</th><th>Data</th><th>Nome</th><th>Empresa</th><th>Função</th><th>Pav.</th><th>Local</th><th>Atividade</th><th>M²</th><th>UN</th><th>M³</th></tr></thead><tbody>';
  rows.forEach(function(r,i){
    var m3txt=r.m3.toLocaleString('pt-BR',{minimumFractionDigits:3,maximumFractionDigits:3});
    h+='<tr><td>'+
      (i+1)+'</td><td>'+esc(r.date)+'</td><td>'+esc(r.nome)+'</td><td>'+esc(r.empresa)+'</td><td>'+esc(r.funcao)+'</td><td>'+esc(r.pav)+'</td><td>'+esc(r.local)+'</td><td>'+esc(r.atividade)+'</td><td><b>'+fmtNum(r.m2)+' m²</b></td><td><b>'+fmtNum(r.un)+'</b></td><td><b>'+m3txt+' m³</b></td></tr>';
  });
  if(!rows.length)h+='<tr><td colspan="11" style="text-align:center;padding:14px">Nenhuma produção encontrada.</td></tr>';
  h+='</tbody></table></div>';
  G('print-db-section').innerHTML=h;G('print-db-section').style.display='block';document.body.classList.add('monthly-prod-print');closeMonthlyProdModal();
  requestAnimationFrame(function(){window.print();setTimeout(function(){G('print-db-section').style.display='none';G('print-db-section').innerHTML='';document.body.classList.remove('monthly-prod-print');},700);});
}
function closeMonthlyProdModal(){var el=G('prod-month-modal-overlay');if(el)el.classList.remove('on');}

function setChip(state,txt){var el=G('chip'),dot=G('livedot'),t=G('chip-txt');el.className='chip chip-'+state;dot.style.display=state==='ok'?'inline-block':'none';t.textContent=txt}
var _ttmr=null;
function toast(msg,type){var el=G('toast');el.style.display='block';el.style.background=type==='ok'?'#0D9F4F':type==='warn'?'#D97706':'#DC2626';el.textContent=msg;clearTimeout(_ttmr);_ttmr=setTimeout(function(){el.style.display='none'},3500)}

function findCol(hd,kws){for(var i=0;i<hd.length;i++){var n=norm(hd[i]);for(var k=0;k<kws.length;k++){if(n.indexOf(norm(kws[k]))>-1)return i}}return -1}

/* ═══════ NORMALIZACAO SILENCIOSA ═══════ */
function limparParaMatch(s){return norm(s).replace(/[^a-z0-9\s]/g,'').replace(/\s+/g,' ').trim()}

/* junta variacoes do mesmo rotulo (funcao/empresa) num unico texto, usando a
   versao sem acento/minuscula/espaco duplicado como chave e mantendo a
   primeira grafia encontrada na planilha, exibida em Title Case consistente */
var FUNCAO_CANON={};
var EMPRESA_CANON={};
function tituloConsistente(raw){
  return raw.toLowerCase().replace(/\s+/g,' ').trim().replace(/(^|[\s\/\-])\S/g,function(c){return c.toUpperCase()});
}
function normalizarRotulo(cru,cache){
  if(!cru)return '';
  var raw=String(cru).replace(/\s+/g,' ').trim();
  if(!raw)return '';
  var chave=limparParaMatch(raw);
  if(!chave)return raw;
  if(!cache[chave])cache[chave]=tituloConsistente(raw);
  return cache[chave];
}
function normalizarFuncao(cru){return normalizarRotulo(cru,FUNCAO_CANON)}
function normalizarEmpresa(cru){return normalizarRotulo(cru,EMPRESA_CANON)}

function normalizarPavimento(cru){
  if(!cru)return '';var raw=String(cru).trim();if(!raw)return '';
  var limpo=limparParaMatch(raw);
  var MAPA={'terreo':'TÉRREO','terre':'TÉRREO','tereo':'TÉRREO','terrero':'TÉRREO','terrro':'TÉRREO','terreoo':'TÉRREO','rreo':'TÉRREO','ter':'TÉRREO',
    '1':'1º','1o':'1º','1 p':'1º','1p':'1º','1 pav':'1º','1 pavimento':'1º','1 andar':'1º','1pav':'1º','1pavimento':'1º','1andar':'1º','p1':'1º','p 1':'1º','pav 1':'1º','pavimento 1':'1º','primeiro':'1º','pav 1o':'1º',
    '2':'2º','2o':'2º','2 p':'2º','2p':'2º','2 pav':'2º','2 pavimento':'2º','2 andar':'2º','2pav':'2º','2pavimento':'2º','2andar':'2º','p2':'2º','p 2':'2º','pav 2':'2º','pavimento 2':'2º','segundo':'2º','pav 2o':'2º',
    '3':'3º','3o':'3º','3 p':'3º','3p':'3º','3 pav':'3º','3 pavimento':'3º','3 andar':'3º','3pav':'3º','3pavimento':'3º','3andar':'3º','p3':'3º','p 3':'3º','pav 3':'3º','pavimento 3':'3º','terceiro':'3º','pav 3o':'3º',
    'enae':'EANE','enea':'EANE','ene':'EANE','ena':'EANE','eane':'EANE','ean':'EANE',
    'inf':'INF','infr':'INF','infra':'INF','infraestrutura':'INF'};
  if(MAPA[limpo]!==undefined)return MAPA[limpo];
  if(/enae|eane|enea|ena[^a-z]/.test(limpo))return 'EANE';
  if(/(^|\s)inf[a-z]*($|\s)/.test(limpo))return 'INF';
  if(/terr[eo]{1,3}/.test(limpo))return 'TÉRREO';
  if(/\b3/.test(limpo))return '3º';
  if(/\b2/.test(limpo))return '2º';
  if(/\b1/.test(limpo))return '1º';
  return '';
}

function detectarDoTexto(texto){
  if(!texto)return '';var t=norm(texto);
  if(/enae|eane/.test(t))return 'EANE';
  if(/inf\b|infra/.test(t))return 'INF';
  if(/terr[eo]/.test(t))return 'TÉRREO';
  if(/\b3[ºo°]?\s*(pav|andar)/.test(t)||/terceiro\s*(pav|andar)/.test(t))return '3º';
  if(/\b2[ºo°]?\s*(pav|andar)/.test(t)||/segundo\s*(pav|andar)/.test(t))return '2º';
  if(/\b1[ºo°]?\s*(pav|andar)/.test(t)||/primeiro\s*(pav|andar)/.test(t))return '1º';
  if(/pavimento\s*1|1\s*pavimento/.test(t))return '1º';
  if(/pavimento\s*2|2\s*pavimento/.test(t))return '2º';
  if(/pavimento\s*3|3\s*pavimento/.test(t))return '3º';
  return '';
}

/* ═══════ AUSENCIAS (ferias / afastado) — tiram do efetivo ═══════ */
var KW_MOTIVOS=[
  {tag:'FERIAS',kws:['ferias','férias','de ferias','em ferias','feria']},
  {tag:'AFASTADO',kws:['afastado','afastada','atestado','licenca','licença','atestado medico']},
  {tag:'JUSTIFICADO',kws:['justificado','justificada','falta justificada','falta justif','dispensado','dispensada','abonado','abonada','declaracao','declaração','declaracao medica']}
];
/* Varre a linha inteira coluna por coluna — o motivo (ex.: "atestado medico")
   pode estar em Motivo/Observacao/Situacao, não só na coluna Status. */
function motivoAusencia(row){
  for(var fi=0;fi<row.length;fi++){
    var v=norm(row[fi]||'');
    if(!v)continue;
    for(var m=0;m<KW_MOTIVOS.length;m++){
      var kws=KW_MOTIVOS[m].kws;
      for(var k=0;k<kws.length;k++){
        if(v.indexOf(kws[k])>-1)return KW_MOTIVOS[m].tag;
      }
    }
  }
  return '';
}

/* Combina local + pavimento num unico rotulo, ex.: "ESTACIONAMENTO / TÉRREO" */
function regiaoPavKey(p){
  if(!p||!p.regiao)return '';
  return p.pav?(p.regiao+' / '+p.pav):p.regiao;
}

/* ═══════ PARSE ═══════ */
function parseData(raw){
  if(!raw||raw.length<2)return null;
  var hd=raw[0];
  var ci={nome:findCol(hd,['funcionario','lider','nome']),empresa:findCol(hd,['empresa']),funcao:findCol(hd,['funcao','função']),atividade:findCol(hd,['servico','serviço','atividade']),regiao:findCol(hd,['local','regiao','região','area','área']),pav:findCol(hd,['pav']),data:findCol(hd,['data inicio','data']),prod:findCol(hd,['prod'])};
  var people=[];
  for(var r=1;r<raw.length;r++){
    var row=raw[r];var nome=(ci.nome>-1?row[ci.nome]||'':'').trim();
    if(!nome||nome.length<2)continue;if(norm(nome).indexOf('total')>-1)continue;
    var motivo=motivoAusencia(row);var vac=!!motivo;
    var atividadeRaw=(ci.atividade>-1?row[ci.atividade]||'':'').trim();
    var pavNorm=normalizarPavimento((ci.pav>-1?row[ci.pav]||'':'').trim());
    if(!pavNorm&&atividadeRaw)pavNorm=detectarDoTexto(atividadeRaw);
    people.push({nome:nome,empresa:normalizarEmpresa((ci.empresa>-1?row[ci.empresa]||'':'').trim())||'—',funcao:normalizarFuncao((ci.funcao>-1?row[ci.funcao]||'':'').trim())||'—',atividade:temAtividade(atividadeRaw)?atividadeRaw:'',atividadeRaw:atividadeRaw,regiao:(ci.regiao>-1?row[ci.regiao]||'':'').trim(),pav:pavNorm,prod:(ci.prod>-1?row[ci.prod]||'':'').trim(),data:(ci.data>-1?row[ci.data]||'':'').trim(),ferias:vac,motivo:motivo});
  }
  var byDate={};
  people.forEach(function(p){var d=p.data||'(sem data)';if(!byDate[d])byDate[d]={date:d,all:[],ativos:[],ferias:[],byEmp:{},byFunc:{},byPav:{},byRegiao:{}};byDate[d].all.push(p);if(p.ferias){byDate[d].ferias.push(p);return}byDate[d].ativos.push(p);byDate[d].byEmp[p.empresa]=(byDate[d].byEmp[p.empresa]||0)+1;byDate[d].byFunc[p.funcao]=(byDate[d].byFunc[p.funcao]||0)+1;if(!byDate[d].byEmpAtiv)byDate[d].byEmpAtiv={};if(!byDate[d].byFuncAtiv)byDate[d].byFuncAtiv={};if(p.atividade){byDate[d].byEmpAtiv[p.empresa]=(byDate[d].byEmpAtiv[p.empresa]||0)+1;byDate[d].byFuncAtiv[p.funcao]=(byDate[d].byFuncAtiv[p.funcao]||0)+1;}if(p.pav)byDate[d].byPav[p.pav]=(byDate[d].byPav[p.pav]||0)+1;if(p.regiao){var regKey=regiaoPavKey(p);byDate[d].byRegiao[regKey]=(byDate[d].byRegiao[regKey]||0)+1}});
  var days=Object.keys(byDate).sort(function(a,b){
    var pa=parseDateBR(a),pb=parseDateBR(b);
    if(pa&&pb)return(pa.y*10000+pa.m*100+pa.d)-(pb.y*10000+pb.m*100+pb.d);
    return a.localeCompare(b);
  }).reverse().map(function(d){return byDate[d]});
  return{people:people,days:days};
}

/* ═══════ MODE SWITCH ═══════ */
function setViewMode(mode){
  VIEW_MODE=mode;
  G('tab-single').className='mode-tab'+(mode==='single'?' on':'');
  G('tab-range').className='mode-tab'+(mode==='range'?' on':'');
  G('date-bar').style.display=mode==='single'?'flex':'none';
  G('range-card').style.display=mode==='range'?'block':'none';
  G('single-view').style.display=mode==='single'?'grid':'none';
  G('range-view').style.display=mode==='range'?'block':'none';
  G('hist-card').style.display=mode==='single'?'block':'none';
  G('kpis2').style.display=mode==='range'?'grid':'none';
  G('range-extra').style.display=mode==='range'?'grid':'none';
  if(mode==='range'){initRangeChips();renderRangeAll()}
  else{renderAllForDate()}
}

/* ═══════ DATE FILTER (single) ═══════ */
function populateDateFilter(){
  var badge=G('date-count-badge'),btnPrev=G('btn-prev'),btnNext=G('btn-next');
  if(!PARSED||!PARSED.days.length){G('fdate-btn').textContent='Sem datas';G('fdate-panel').innerHTML='';badge.textContent='';btnPrev.disabled=true;btnNext.disabled=true;return}
  var days=PARSED.days;
  if(isNaN(SELECTED_DATE_IDX)||SELECTED_DATE_IDX<0||SELECTED_DATE_IDX>=days.length)SELECTED_DATE_IDX=0;
  renderDatePanel();updateDateBtnText();
  badge.textContent=days.length+' data(s)';
  btnPrev.disabled=SELECTED_DATE_IDX>=days.length-1;btnNext.disabled=SELECTED_DATE_IDX<=0;
}

function renderDatePanel(){
  var panel=G('fdate-panel');
  if(!PARSED||!PARSED.days.length){panel.innerHTML='';return}
  panel.innerHTML=PARSED.days.map(function(d,i){return '<div class="date-dd-item'+(i===SELECTED_DATE_IDX?' sel':'')+'" onclick="selectDateFromPanel('+i+')">'+esc(d.date)+'  ('+comAtividadeCount(d)+' com atividade, '+d.ferias.length+' ferias)</div>'}).join('');
}
function updateDateBtnText(){
  var day=getSelectedDay();
  G('fdate-btn').textContent=day?(day.date+'  ('+comAtividadeCount(day)+' com atividade, '+day.ferias.length+' ferias)'):'Sem datas';
}
function toggleDateDropdown(e){
  if(e)e.stopPropagation();
  var panel=G('fdate-panel');
  var opening=panel.style.display==='none'||!panel.style.display;
  if(opening){renderDatePanel();panel.style.display='block';var selEl=panel.querySelector('.date-dd-item.sel');if(selEl)selEl.scrollIntoView({block:'nearest'})}
  else panel.style.display='none';
}
document.addEventListener('click',function(e){
  var wrap=G('fdate-wrap');
  if(wrap&&!wrap.contains(e.target))G('fdate-panel').style.display='none';
});
function selectDateFromPanel(idx){SELECTED_DATE_IDX=idx;G('fdate-panel').style.display='none';onDateChange()}

function navDate(dir){if(!PARSED||!PARSED.days.length)return;var newIdx=SELECTED_DATE_IDX+dir;if(newIdx<0||newIdx>=PARSED.days.length)return;SELECTED_DATE_IDX=newIdx;onDateChange()}

function onDateChange(){
  G('btn-prev').disabled=SELECTED_DATE_IDX>=PARSED.days.length-1;
  G('btn-next').disabled=SELECTED_DATE_IDX<=0;
  ['fq','femp','ffunc','fpav','fprod','faz'].forEach(function(id){G(id).value=''});
  G('fstatus').value='ativo';
  updateDateBtnText();renderDatePanel();
  renderAllForDate();
}

function getSelectedDay(){if(!PARSED||!PARSED.days.length)return null;return PARSED.days[Math.min(SELECTED_DATE_IDX,PARSED.days.length-1)]}

/* ═══════ RANGE (multi-dia) ═══════ */
var MESES_PT=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
function parseDateBR(s){
  var parts=(s||'').split('/');
  if(parts.length!==3)return null;
  var d=parseInt(parts[0],10),m=parseInt(parts[1],10),y=parseInt(parts[2],10);
  if(!d||!m||!y)return null;
  return{d:d,m:m,y:y,key:y+'-'+String(m).padStart(2,'0')};
}

function initRangeChips(){
  var box=G('range-chips');
  if(!PARSED||!PARSED.days.length){box.innerHTML='<div class="em">Sem datas</div>';return}
  var ascDays=PARSED.days.slice().reverse();
  var html='',curKey=null;
  ascDays.forEach(function(d){
    var pd=parseDateBR(d.date);
    var key=pd?pd.key:'?';
    if(key!==curKey){
      curKey=key;
      var label=pd?(MESES_PT[pd.m-1]+' de '+pd.y):'Data invalida';
      html+='<div style="width:100%;font-family:\'JetBrains Mono\';font-size:9px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--ink3);margin:8px 0 3px;padding-top:6px;border-top:1px dashed var(--line)">'+esc(label)+'</div>';
    }
    var sel=RANGE_SELECTED.has(d.date);
    html+='<span class="date-chip'+(sel?' sel':'')+'" data-date="'+esc(d.date)+'" onclick="toggleRangeDate(\''+esc(d.date).replace(/'/g,"\\'")+'\')">'+esc(d.date)+' <span style="opacity:.7">('+d.ativos.length+')</span></span>';
  });
  box.innerHTML=html;
  G('range-meta').textContent=PARSED.days.length+' data(s) disponiveis';
}

function toggleRangeDate(date){
  if(RANGE_SELECTED.has(date))RANGE_SELECTED.delete(date);else RANGE_SELECTED.add(date);
  initRangeChips();renderRangeAll();
}
function selectAllRangeDates(){if(!PARSED)return;PARSED.days.forEach(function(d){RANGE_SELECTED.add(d.date)});initRangeChips();renderRangeAll()}
function clearRangeDates(){RANGE_SELECTED.clear();initRangeChips();renderRangeAll()}
function selectLastNDates(n){if(!PARSED)return;RANGE_SELECTED.clear();PARSED.days.slice(0,n).forEach(function(d){RANGE_SELECTED.add(d.date)});initRangeChips();renderRangeAll()}
function selectCurrentMonth(offset){
  if(!PARSED)return;
  var now=new Date();
  var targetM=now.getMonth()+1+offset,targetY=now.getFullYear();
  while(targetM<1){targetM+=12;targetY--}
  while(targetM>12){targetM-=12;targetY++}
  RANGE_SELECTED.clear();
  PARSED.days.forEach(function(d){var pd=parseDateBR(d.date);if(pd&&pd.m===targetM&&pd.y===targetY)RANGE_SELECTED.add(d.date)});
  initRangeChips();renderRangeAll();
}

function getRangeDays(){if(!PARSED)return[];return PARSED.days.filter(function(d){return RANGE_SELECTED.has(d.date)})}

function computeRangeAgg(days){
  /* Regra: falta vale só no dia — sem contagem histórica. */

  var map={};
  days.forEach(function(day){
    day.all.forEach(function(p){
      var key=norm(p.nome)+'|'+norm(p.empresa);
      if(!map[key])map[key]={nome:p.nome,empresa:p.empresa,funcao:p.funcao,diasPresente:0,diasAtivo:0,diasFerias:0,diasSem:0,diasSemProd:0,pavs:{},producoes:[]};
      var e=map[key];
      e.diasPresente++;
      if(p.ferias){e.diasFerias++;return}
      if(p.atividade)e.diasAtivo++;else e.diasSem++;
      if(!temAtividade(p.prod))e.diasSemProd++;
      if(p.pav)e.pavs[p.pav]=(e.pavs[p.pav]||0)+1;
      if(p.prod||p.atividade)e.producoes.push({data:p.data,prod:p.prod,atividade:p.atividade||p.atividadeRaw,pav:p.pav});
    });
  });
  return Object.keys(map).map(function(k){
    var e=map[k];
    return e;
  });
}

function populateRangeFilters(agg){
  function fill(id,vals,def){var sel=G(id),cur=sel.value;sel.innerHTML='<option value="">'+def+'</option>'+vals.map(function(v){return '<option value="'+esc(v)+'">'+esc(v)+'</option>'}).join('');if(vals.indexOf(cur)>-1)sel.value=cur}
  fill('remp',uniq(agg.map(function(p){return p.empresa})),'Todas empresas');
  fill('rfunc',uniq(agg.map(function(p){return p.funcao})),'Todas funcoes');
  var pavSel=G('rpav'),curPav=pavSel.value;
  pavSel.innerHTML='<option value="">Todos pavimentos</option>'+PAVIMENTOS.map(function(v){return '<option value="'+esc(v)+'">'+esc(v)+'</option>'}).join('');
  if(PAVIMENTOS.indexOf(curPav)>-1)pavSel.value=curPav;
}

function renderRangeKPIs(days,agg){
  var el=G('kpis');
  el.classList.add('kpi-auto');
  if(!days.length){el.innerHTML='<div class="kp"><div class="kl">Nenhuma data selecionada</div><div class="kv">—</div></div>';G('kpis2').innerHTML='';return}
  var totalPessoaDias=agg.reduce(function(s,p){return s+p.diasPresente},0);
  var pessoasDistintas=agg.length;
  var mediaDias=pessoasDistintas>0?(totalPessoaDias/pessoasDistintas).toFixed(1):'0';
  var totalAtivo=agg.reduce(function(s,p){return s+p.diasAtivo},0);
  var totalFerias=agg.reduce(function(s,p){return s+p.diasFerias},0);
  var empresas=uniq(agg.map(function(p){return p.empresa})).length;
  var prodPeriodo=calcMonthlyProd(getMonthlyProdRows(days));
  el.innerHTML=[
    {i:'📅',l:'Dias no periodo',v:days.length,f:'datas selecionadas',c:'var(--blue)'},
    {i:'👷',l:'Pessoas distintas',v:pessoasDistintas,f:'no periodo',c:'#059669'},
    {i:'🧮',l:'Pessoa-dias',v:totalPessoaDias,f:'soma de presencas',c:'var(--cyan)'},
    {i:'📈',l:'Media dias/pessoa',v:mediaDias,f:'presenca media',c:'#7C3AED'},
    {i:'✅',l:'Dias c/ atividade',v:totalAtivo,f:'lancamentos',c:'var(--green)'},
    {i:'🌴',l:'Dias de ferias',v:totalFerias,f:'no periodo',c:'var(--amber)'},
    {i:'🏢',l:'Empresas',v:empresas,f:'envolvidas',c:'var(--navy)'},
    {i:'📐',l:'Produção do período',v:fmtNum(prodPeriodo.m2)+' m²',f:(prodPeriodo.m3>0||prodPeriodo.un>0?'m² · m³ · UN — clique para ver':'m² — clique para ver'),c:'#0891B2',click:'openProducaoPeriodoModal()'},
    {i:'🏗️',l:'Produção por empresa',v:uniq(getMonthlyProdRows(days).filter(function(r){return r.empresa;}).map(function(r){return r.empresa;})).length,f:'empresas com produção — clique para ver',c:'#7C3AED',click:'openProducaoEmpresaModal()'},
    {i:'⚒️',l:'Produção por função',v:uniq(getMonthlyProdRows(days).filter(function(r){return r.funcao&&r.funcao!=='—';}).map(function(r){return r.funcao;})).length,f:'funções com produção — clique para ver',c:'#D97706',click:'openProducaoFuncModal()'}
  ].map(function(k){var clickAttr=k.click?(' onclick="'+k.click+'" role="button" tabindex="0" title="Clique para ver a produção do periodo"'):'';var cls='kp'+(k.click?' kp-click':'');return '<div class="'+cls+'" style="--kc:'+k.c+'"'+clickAttr+'><div class="ki">'+k.i+'</div><div class="kl">'+k.l+'</div><div class="kv">'+k.v+'</div><div class="kf">'+k.f+'</div></div>'}).join('');
}

function renderRangeKPIs2(days,agg){
  var el=G('kpis2');
  if(!days.length){el.innerHTML='';return}
  var headcounts=days.map(function(d){return comAtividadeCount(d)});
  var efetivoMedio=(headcounts.reduce(function(s,v){return s+v},0)/days.length).toFixed(1);
  var maxV=Math.max.apply(null,headcounts),minV=Math.min.apply(null,headcounts);
  var maxDay=days[headcounts.indexOf(maxV)],minDay=days[headcounts.indexOf(minV)];
  var totalPessoaDias=agg.reduce(function(s,p){return s+p.diasPresente},0);
  var totalFerias=agg.reduce(function(s,p){return s+p.diasFerias},0);
  var totalAtivo=agg.reduce(function(s,p){return s+p.diasAtivo},0);
  var naoFerias=totalPessoaDias-totalFerias;
  var taxaAtividade=naoFerias>0?(totalAtivo/naoFerias*100).toFixed(0):'0';
  var unicos=agg.filter(function(p){return p.diasPresente===1}).length;
  el.innerHTML=[
    {i:'📊',l:'Efetivo medio/dia',v:efetivoMedio,f:'media de pessoas por dia',c:'#059669'},
    {i:'🔺',l:'Pico de efetivo',v:maxV,f:maxDay?maxDay.date:'—',c:'var(--green)'},
    {i:'🔻',l:'Menor efetivo',v:minV,f:minDay?minDay.date:'—',c:'var(--red)'},
    {i:'🎯',l:'Taxa de atividade',v:taxaAtividade+'%',f:'dias c/ atividade vs presenca',c:'var(--blue)'},
    {i:'🔄',l:'Presenca unica',v:unicos,f:'clique para ver as pessoas',c:'#7C3AED',click:'openUnicosModal()'}
  ].map(function(k){
    var clickAttr=k.click?(' onclick="'+k.click+'" role="button" tabindex="0" title="Clique para ver as pessoas com presença única"'):'';
    var cls='kp'+(k.click?' kp-click':'');
    return '<div class="'+cls+'" style="--kc:'+k.c+'"'+clickAttr+'><div class="ki">'+k.i+'</div><div class="kl">'+k.l+'</div><div class="kv">'+k.v+'</div><div class="kf">'+k.f+'</div></div>';
  }).join('');
}

function openUnicosModal(){
  var days=getRangeDays();
  if(!days.length){toast('Selecione um ou mais dias no periodo','warn');return}
  /* Presença única = pessoa com diasPresente === 1 no período selecionado */
  var agg=computeRangeAgg(days);
  var unicosAgg=agg.filter(function(p){return p.diasPresente===1});
  var mapaDados={};
  days.forEach(function(day){
    day.all.forEach(function(p){
      var key=norm(p.nome)+'|'+norm(p.empresa);
      if(!mapaDados[key])mapaDados[key]=[];
      mapaDados[key].push({nome:p.nome,empresa:p.empresa,funcao:p.funcao,data:day.date,pav:p.pav,atividade:p.atividade||p.atividadeRaw||''});
    });
  });
  var lista=unicosAgg.map(function(p){
    var key=norm(p.nome)+'|'+norm(p.empresa);
    var registro=(mapaDados[key]&&mapaDados[key][0])?mapaDados[key][0]:{};
    return{nome:p.nome,empresa:p.empresa,funcao:p.funcao,data:registro.data||'—',pav:registro.pav||'',atividade:registro.atividade||''};
  });
  lista.sort(function(a,b){return(a.nome||'').localeCompare(b.nome||'','pt-BR')});

  var body=G('unicos-modal-body');
  G('unicos-modal-title').textContent='🔄 Presença Única';
  G('unicos-modal-sub').textContent=days.length+' dia(s) selecionados · '+lista.length+' pessoa(s) presente(s) em apenas 1 dia';

  if(!lista.length){
    body.innerHTML='<div class="modal-empty">Nenhuma pessoa com presença única no período selecionado.</div>';
  }else{
    var empresas=uniq(lista.map(function(p){return p.empresa})).length;
    var funcoes=uniq(lista.map(function(p){return p.funcao})).length;
    body.innerHTML='<div class="unicos-summary">'+
      '<div class="unicos-stat"><div class="us-k">Pessoas</div><div class="us-v">'+lista.length+'</div></div>'+
      '<div class="unicos-stat"><div class="us-k">Empresas</div><div class="us-v">'+empresas+'</div></div>'+
      '<div class="unicos-stat"><div class="us-k">Funções</div><div class="us-v">'+funcoes+'</div></div>'+
    '</div>'+
    '<div class="unicos-table-wrap"><table><thead><tr><th>Nome</th><th>Empresa</th><th>Função</th><th>Data</th><th>Pavimento</th><th>Atividade</th></tr></thead><tbody>'+
    lista.map(function(p){return '<tr>'+
      '<td data-label="Nome" style="font-weight:600">'+esc(p.nome)+'</td>'+
      '<td data-label="Empresa"><span class="badge badge-gray">'+esc(p.empresa)+'</span></td>'+
      '<td data-label="Função" style="color:var(--ink2)">'+esc(p.funcao)+'</td>'+
      '<td data-label="Data" style="font-family:JetBrains Mono">'+esc(p.data||'—')+'</td>'+
      '<td data-label="Pavimento">'+pavBadge(p.pav)+'</td>'+
      '<td data-label="Atividade" style="color:var(--ink2)">'+esc(p.atividade||'—')+'</td>'+
    '</tr>'}).join('')+
    '</tbody></table></div>';
  }
  G('unicos-modal-overlay').classList.add('on');
}

function closeUnicosModal(){G('unicos-modal-overlay').classList.remove('on')}

function aggregateAcrossDays(days,field){
  var out={};
  days.forEach(function(d){Object.keys(d[field]).forEach(function(k){out[k]=(out[k]||0)+d[field][k]})});
  return out;
}

function getFilteredRangeAgg(){
  var q=norm(G('rq').value),emp=G('remp').value,func=G('rfunc').value,pav=G('rpav').value;
  var days=getRangeDays();var agg=computeRangeAgg(days);
  return agg.filter(function(p){
    if(emp&&p.empresa!==emp)return false;
    if(func&&p.funcao!==func)return false;
    if(pav&&!p.pavs[pav])return false;
    if(q){var full=norm(p.nome+' '+p.empresa+' '+p.funcao);if(full.indexOf(q)===-1)return false}
    return true;
  });
}

function setRangeSort(k){if(rangeSortKey===k)rangeSortDir*=-1;else{rangeSortKey=k;rangeSortDir=1}renderRangeTable()}

function renderRangeTable(){
  var el=G('range-tbl-box'),meta=G('range-tbl-meta');
  var days=getRangeDays();
  if(!days.length){el.innerHTML='<div class="em">Selecione um ou mais dias acima para ver a producao por pessoa.</div>';meta.textContent='';return}
  var agg=getFilteredRangeAgg();
  if(rangeSortKey==='nome'||rangeSortKey==='empresa'||rangeSortKey==='funcao')agg=agg.slice().sort(function(a,b){return(a[rangeSortKey]||'').localeCompare(b[rangeSortKey]||'','pt-BR')*rangeSortDir});
  else if(rangeSortKey)agg=agg.slice().sort(function(a,b){return((a[rangeSortKey]||0)-(b[rangeSortKey]||0))*rangeSortDir});
  else agg=agg.slice().sort(function(a,b){return b.diasPresente-a.diasPresente});
  meta.textContent=days.length+' dia(s) selecionados · '+agg.length+' pessoa(s)';
  var sk=rangeSortKey,sd=rangeSortDir;
  function th(label,key){return '<th onclick="setRangeSort(\''+key+'\')" class="'+(sk===key?(sd>0?'asc':'desc'):'')+'">'+label+'</th>'}
  var h='<table class="t"><thead><tr>'+th('Nome','nome')+th('Empresa','empresa')+th('Funcao','funcao')+th('Dias presente','diasPresente')+th('Dias c/ ativ.','diasAtivo')+th('Dias s/ ativ.','diasSem')+th('Dias s/ producao','diasSemProd')+th('Dias ferias','diasFerias')+'<th>Pavimentos</th><th>Producao / Atividades por dia</th></tr></thead><tbody>';
  agg.forEach(function(p){
    var pavList=Object.keys(p.pavs).sort().map(function(pv){return pavBadge(pv)}).join(' ')||'<span class="badge badge-pav-none">—</span>';
    var prodHtml=p.producoes.length?('<div class="prod-list">'+p.producoes.slice().sort(function(a,b){return(a.data||'').localeCompare(b.data||'')}).map(function(pr){return '<div><span class="pd">'+esc(pr.data)+'</span>'+esc(pr.prod?pr.prod:(pr.atividade||'—'))+(pr.pav?' <span style="color:var(--ink3)">['+esc(pr.pav)+']</span>':'')+'</div>'}).join('')+'</div>'):'<span style="color:var(--ink3)">sem lancamentos</span>';
    h+='<tr>'+
      '<td data-label="Nome" style="font-weight:600;white-space:nowrap">'+esc(p.nome)+'</td>'+
      '<td data-label="Empresa"><span class="badge badge-gray">'+esc(p.empresa)+'</span></td>'+
      '<td data-label="Funcao" style="color:var(--ink2)">'+esc(p.funcao)+'</td>'+
      '<td data-label="Dias presente" class="nr" style="font-weight:700;color:var(--navy)">'+p.diasPresente+'</td>'+
      '<td data-label="Dias c/ ativ." class="nr" style="color:var(--green)">'+p.diasAtivo+'</td>'+
      '<td data-label="Dias s/ ativ." class="nr" style="color:var(--red)">'+p.diasSem+'</td>'+
      '<td data-label="Dias s/ producao" class="nr" style="color:'+(p.diasSemProd?'var(--red)':'var(--ink3)')+';font-weight:'+(p.diasSemProd?'700':'400')+'">'+(p.diasSemProd?'⚠ ':'')+p.diasSemProd+'</td>'+
      '<td data-label="Dias ferias" class="nr" style="color:var(--amber)">'+p.diasFerias+'</td>'+
      '<td data-label="Pavimentos">'+pavList+'</td>'+
      '<td data-label="Producao / Atividades" style="max-width:320px">'+prodHtml+'</td>'+
    '</tr>';
  });
  h+='</tbody></table>';el.innerHTML=h;
  markScrollable(el);
}

function renderRangeAll(){
  var days=getRangeDays(),agg=computeRangeAgg(days);
  G('sub-date').textContent=days.length?('Periodo: '+days.length+' dia(s) selecionados'):'Nenhum dia selecionado no periodo';
  G('range-summary').textContent=days.length?(days.length+' dia(s) selecionados de '+(PARSED?PARSED.days.length:0)):'Nenhum dia selecionado';
  renderRangeKPIs(days,agg);
  renderRangeKPIs2(days,agg);
  if(days.length){
    renderChart(days,null,'rchart-box','rchart-meta');
    renderBars('rtop-emp-bars','rtop-emp-meta',aggregateAcrossDays(days,'byEmp'),COLORS,null,'range');
    renderBars('rtop-func-bars','rtop-func-meta',aggregateAcrossDays(days,'byFunc'),COLORS);
  }else{
    G('rchart-box').innerHTML='<div class="em">Selecione um ou mais dias acima</div>';
    G('rchart-meta').textContent='';
    ['rtop-emp-bars','rtop-func-bars'].forEach(function(id){G(id).innerHTML=''});
    ['rtop-emp-meta','rtop-func-meta'].forEach(function(id){G(id).textContent=''});
  }
  populateRangeFilters(agg);
  renderRangeTable();
  G('upd-ts').textContent='atualizado '+fmtNow();
}

/* ═══════ IMPRESSÃO ═══════ */
function doPrint(){
  if(VIEW_MODE==='range'){ executeRangePrint(); return; }
  var day=getSelectedDay();
  if(!day){toast('Selecione um dia primeiro','warn');return}
  G('pm-sub').textContent='Dia '+day.date+' \u00b7 '+day.all.length+' pessoas no total';
  pmBuildChips('pm-emps',uniq(day.all.map(function(p){return p.empresa})));
  pmBuildChips('pm-funcs',uniq(day.all.map(function(p){return p.funcao})));
  pmBuildChips('pm-pavs',PAVIMENTOS.filter(function(v){return day.byPav[v]>0}));
  G('pm-faltosos').checked=true;
  G('pm-lbl-faltosos').className='pm-chip-label on';
  G('pm-ferias').checked=true;
  G('pm-lbl-ferias').className='pm-chip-label on';
  G('print-modal-overlay').classList.add('on');
  updatePrintPreview();
}

function pmBuildChips(id,vals){
  var b=G(id);if(!b)return;
  b.innerHTML=vals.map(function(v){
    return '<label class="pm-chip-label on" title="'+esc(v)+'"><input type="checkbox" value="'+esc(v)+'" checked onchange="this.closest(\'label\').className=\'pm-chip-label\'+(this.checked?\' on\':\'\');updatePrintPreview()">'+esc(v)+'</label>';
  }).join('');
}

function pmToggleAll(id,state){
  var b=G(id);if(!b)return;
  b.querySelectorAll('input').forEach(function(cb){cb.checked=state;cb.closest('label').className='pm-chip-label'+(state?' on':'');});
  updatePrintPreview();
}

function pmGetSelected(id){
  var b=G(id);if(!b)return[];
  var v=[];b.querySelectorAll('input:checked').forEach(function(c){v.push(c.value)});return v;
}

function closePrintModal(){G('print-modal-overlay').classList.remove('on')}

function updatePrintPreview(){
  var day=getSelectedDay();if(!day)return;
  var emps=pmGetSelected('pm-emps'),funcs=pmGetSelected('pm-funcs'),pavs=pmGetSelected('pm-pavs');
  var iF=G('pm-faltosos').checked,iV=G('pm-ferias').checked;
  function match(p){
    if(emps.length&&emps.indexOf(p.empresa)===-1)return false;
    if(funcs.length&&funcs.indexOf(p.funcao)===-1)return false;
    if(pavs.length&&p.pav&&pavs.indexOf(p.pav)===-1)return false;
    return true;
  }
  var a=day.ativos.filter(function(p){return !!p.atividade&&match(p)});
  var f=iF?day.ativos.filter(function(p){return !p.atividade&&match(p)}):[];
  var v=iV?day.ferias.filter(function(p){return match(p)}):[];
  G('pm-preview').textContent=
    (a.length+f.length+v.length)+' pessoa(s) — '+a.length+' ativo(s)'+(iF?' \u00b7 '+f.length+' faltoso(s)':'')+(iV?' \u00b7 '+v.length+' f\u00e9rias':'');
}

function executeRangePrint(){
  var days=getRangeDays();
  if(!days.length){toast('Selecione um ou mais dias no periodo','warn');return;}
  var q=norm(G('rq').value),empFilter=G('remp').value,funcFilter=G('rfunc').value,pavFilter=G('rpav').value;
  function match(p){
    if(empFilter&&p.empresa!==empFilter)return false;
    if(funcFilter&&p.funcao!==funcFilter)return false;
    if(pavFilter&&p.pav&&!samePavForMatch(p.pav,pavFilter))return false;
    if(q){var full=norm((p.nome||'')+' '+(p.empresa||'')+' '+(p.funcao||'')+' '+(p.atividade||'')+' '+(p.prod||'')+' '+(p.regiao||''));if(full.indexOf(q)===-1)return false;}
    return true;
  }
  var agg=getFilteredRangeAgg();
  var summary={};
  var launchRows=[];
  days.forEach(function(day){
    (day.ativos||[]).forEach(function(p){
      if(!match(p))return;
      var parsed=parseProducaoUnidades(p.prod||'');
      if(!parsed.length)return;
      parsed.forEach(function(u){
        if(!summary[p.empresa])summary[p.empresa]={M2:0,M3:0,UN:0};
        summary[p.empresa][u.unidade]+=u.valor;
      });
      launchRows.push({date:day.date,nome:p.nome,empresa:p.empresa,funcao:p.funcao,pav:p.pav||'—',local:p.regiao||'—',atividade:p.atividade||p.atividadeRaw||'—',prod:p.prod||'—'});
    });
  });
  var companies=Object.keys(summary).filter(function(k){return summary[k].M2>0||summary[k].M3>0||summary[k].UN>0}).sort(function(a,b){return a.localeCompare(b,'pt-BR')});
  var totals=companies.reduce(function(t,k){t.M2+=summary[k].M2;t.M3+=summary[k].M3;t.UN+=summary[k].UN;return t;},{M2:0,M3:0,UN:0});
  var titleParts=[days.length+' dia(s) selecionados'];
  if(empFilter)titleParts.push('Empreiteira: '+empFilter);
  if(funcFilter)titleParts.push('Função: '+funcFilter);
  if(pavFilter)titleParts.push('Pav.: '+pavFilter);
  if(q)titleParts.push('Busca: '+G('rq').value);
  G('print-header').innerHTML=
    '<h1>RDO — Relatório Filtrado de Produção</h1>'+
    '<p>'+esc(titleParts.join(' · '))+' · '+launchRows.length+' lançamento(s) · Impresso em '+fmtNow()+'</p>';

  var h='<div class="range-print-report">';
  h+='<div class="range-print-title">Produção do período</div>';
  h+='<div class="range-print-total-grid">'+
    '<div class="range-print-total"><span>M²</span><b>'+fmtNum(totals.M2)+' m²</b></div>'+
    '<div class="range-print-total"><span>M³</span><b>'+totals.M3.toLocaleString('pt-BR',{minimumFractionDigits:3,maximumFractionDigits:3})+' m³</b></div>'+
    '<div class="range-print-total"><span>UN</span><b>'+fmtNum(totals.UN)+' UN</b></div>'+
    '</div>';

  h+='<div class="range-print-section-title">Lançamentos de produção</div>';
  h+='<table class="range-print-table"><thead><tr><th>Data</th><th>Nome</th><th>Empresa</th><th>Função</th><th>Pav.</th><th>Local</th><th>Atividade</th><th>Produção</th></tr></thead><tbody>';
  launchRows.sort(function(a,b){var da=parseDateBR(a.date),db=parseDateBR(b.date);var va=da?da.y*10000+da.m*100+da.d:0,vb=db?db.y*10000+db.m*100+db.d:0;return va-vb||a.empresa.localeCompare(b.empresa,'pt-BR')||a.nome.localeCompare(b.nome,'pt-BR')});
  launchRows.forEach(function(r){
    h+='<tr><td>'+esc(r.date)+'</td><td><b>'+esc(r.nome)+'</b></td><td>'+esc(r.empresa)+'</td><td>'+esc(r.funcao)+'</td><td>'+esc(r.pav)+'</td><td>'+esc(r.local)+'</td><td>'+esc(r.atividade)+'</td><td><b>'+esc(r.prod)+'</b></td></tr>';
  });
  if(!launchRows.length)h+='<tr><td colspan="8" style="text-align:center;padding:12px">Nenhum lançamento de produção encontrado.</td></tr>';
  h+='</tbody></table>';

  h+='<div class="range-print-section-title">Resumo da produção por empreiteira</div>';
  h+='<table class="range-print-summary-table"><thead><tr><th>Empreiteira</th><th>M²</th><th>M³</th><th>UN</th></tr></thead><tbody>';
  companies.forEach(function(k){
    var v=summary[k];
    h+='<tr><td><b>'+esc(k)+'</b></td><td>'+fmtNum(v.M2)+' m²</td><td>'+v.M3.toLocaleString('pt-BR',{minimumFractionDigits:3,maximumFractionDigits:3})+' m³</td><td>'+fmtNum(v.UN)+' UN</td></tr>';
  });
  if(!companies.length)h+='<tr><td colspan="4" style="text-align:center;padding:10px">Nenhuma produção encontrada para os filtros selecionados.</td></tr>';
  h+='</tbody></table>';

  /* Seção PPC (2ª planilha) no PDF do período */
  h+=ppcPrintHTML();

  h+='</div>';

  var sec=G('print-db-section');
  sec.innerHTML=h;sec.style.display='block';document.body.classList.add('range-print');
  requestAnimationFrame(function(){
    window.print();
    setTimeout(function(){sec.style.display='none';sec.innerHTML='';document.body.classList.remove('range-print');},700);
  });
}

function executePrint(){
  var day=getSelectedDay();if(!day)return;
  var emps=pmGetSelected('pm-emps'),funcs=pmGetSelected('pm-funcs'),pavs=pmGetSelected('pm-pavs');
  var iF=G('pm-faltosos').checked,iV=G('pm-ferias').checked;
  function match(p){
    if(emps.length&&emps.indexOf(p.empresa)===-1)return false;
    if(funcs.length&&funcs.indexOf(p.funcao)===-1)return false;
    if(pavs.length&&p.pav&&pavs.indexOf(p.pav)===-1)return false;
    return true;
  }
  function srt(a,b){return(a.nome||'').localeCompare(b.nome||'','pt-BR')}
  var ativos=day.ativos.filter(function(p){return !!p.atividade&&match(p)}).sort(srt);
  var semAtiv=iF?day.ativos.filter(function(p){return !p.atividade&&match(p)}).sort(srt):[];
  var ferias=iV?day.ferias.filter(function(p){return match(p)}).sort(srt):[];
  var tE=G('pm-emps').querySelectorAll('input').length;
  var tF=G('pm-funcs').querySelectorAll('input').length;
  var tP=G('pm-pavs').querySelectorAll('input').length;
  var fl=[];
  if(emps.length&&emps.length<tE)fl.push('Empresa: '+emps.join(', '));
  if(funcs.length&&funcs.length<tF)fl.push('Fun\u00e7\u00e3o: '+funcs.join(', '));
  if(pavs.length&&pavs.length<tP)fl.push('Pav.: '+pavs.join(', '));
  var sf=fl.length?' \u00b7 '+fl.join(' / '):'';
  G('print-header').innerHTML=
    '<h1>RDO \u2014 Relatorio Diario de Obra</h1>'+
    '<p>Data: '+esc(day.date)+' \u00b7 Efetivo: '+ativos.length+' \u00b7 Faltosos: '+semAtiv.length+' \u00b7 F\u00e9rias: '+ferias.length+sf+' \u00b7 Impresso em '+fmtNow()+'</p>';
  var h='<div class="cd"><div class="cd-h"><h3>Equipe do dia \u2014 '+esc(day.date)+'</h3>'+
    '<span class="mt">'+ativos.length+' ativo(s)'+(semAtiv.length?' \u00b7 '+semAtiv.length+' faltoso(s)':'')+(ferias.length?' \u00b7 '+ferias.length+' f\u00e9rias':'')+'</span></div>'+
    '<table class="t"><thead><tr><th>#</th><th>Nome</th><th>Fun\u00e7\u00e3o</th><th>Empresa</th><th>Atividade / Servi\u00e7o</th><th>Produ\u00e7\u00e3o</th><th>Pav.</th><th>Local</th></tr></thead><tbody>';
  var num=1;
  ativos.forEach(function(p){
    h+='<tr><td class="nr" style="color:#94A3B8">'+num+++'</td><td style="font-weight:600;white-space:nowrap">'+esc(p.nome)+'</td><td style="color:#475569">'+esc(p.funcao)+'</td><td>'+esc(p.empresa)+'</td><td style="white-space:normal">'+esc(p.atividade||'\u2014')+'</td><td style="white-space:normal;font-weight:600">'+esc(p.prod||'\u2014')+'</td><td>'+esc(p.pav||'\u2014')+'</td><td style="color:#475569">'+esc(p.regiao||'\u2014')+'</td></tr>';
  });
  if(semAtiv.length){
    h+='<tr style="background:#FEE2E2"><td colspan="8" style="font-family:JetBrains Mono;font-size:9px;font-weight:700;color:#B91C1C;text-transform:uppercase;padding:6px 10px">🚫 '+semAtiv.length+' FALTOSO(S)</td></tr>';
    semAtiv.forEach(function(p){h+='<tr style="background:#FFF5F5"><td class="nr" style="color:#94A3B8">'+num+++'</td><td style="font-weight:600;color:#B91C1C">'+esc(p.nome)+'</td><td style="color:#991B1B">'+esc(p.funcao)+'</td><td>'+esc(p.empresa)+'</td><td style="color:#94A3B8;font-style:italic">'+esc(p.atividadeRaw||'\u2014')+'</td><td style="color:#94A3B8">\u2014</td><td>'+esc(p.pav||'\u2014')+'</td><td>'+esc(p.regiao||'\u2014')+'</td></tr>';});
  }
  if(ferias.length){
    h+='<tr style="background:#FEF3C7"><td colspan="7" style="font-family:JetBrains Mono;font-size:9px;font-weight:700;color:#92400E;text-transform:uppercase;padding:6px 10px">🌴 '+ferias.length+' FÉRIAS / AUSENTE(S)</td></tr>';
    ferias.forEach(function(p){h+='<tr style="background:#FFFBEB"><td class="nr" style="color:#94A3B8">'+num+++'</td><td style="font-weight:600;color:#92400E">'+esc(p.nome)+'</td><td style="color:#B45309">'+esc(p.funcao)+'</td><td>'+esc(p.empresa)+'</td><td colspan="4"><span style="font-family:JetBrains Mono;font-size:9px;font-weight:700;background:#FEF3C7;padding:2px 6px;border-radius:10px;color:#92400E">'+esc(p.motivo||'F\u00c9RIAS')+'</span></td></tr>';});
  }
  h+='</tbody></table></div>';

  /* Seção PPC (2ª planilha) no PDF do dia */
  h+=ppcPrintHTML();

  var sec=G('print-db-section');
  sec.innerHTML=h;
  sec.style.display='block';
  document.body.classList.add('custom-print');
  closePrintModal();
  requestAnimationFrame(function(){
    window.print();
    setTimeout(function(){
      sec.style.display='none';
      document.body.classList.remove('custom-print');
    },500);
  });
}

/* ═══════ RENDERING (single day) ═══════ */
function populateFilters(day){
  function fill(id,vals,def){var sel=G(id),cur=sel.value;sel.innerHTML='<option value="">'+def+'</option>'+vals.map(function(v){return '<option value="'+esc(v)+'">'+esc(v)+'</option>'}).join('');sel.value=(vals.indexOf(cur)>-1)?cur:''}
  if(!day)return;
  fill('femp',uniq(day.ativos.map(function(p){return p.empresa})),'Todas empresas');
  fill('ffunc',uniq(day.ativos.map(function(p){return p.funcao})),'Todas funcoes');
  var pavSel=G('fpav');var curPav=pavSel.value;
  pavSel.innerHTML='<option value="">Todos pavimentos</option>'+PAVIMENTOS.map(function(v){var cnt=day.byPav[v]||0;return cnt>0?'<option value="'+esc(v)+'">'+esc(v)+'</option>':''}).join('');
  pavSel.value=(PAVIMENTOS.indexOf(curPav)>-1)?curPav:'';
}

function renderKPIs(day){
  if(!day){G('kpis').innerHTML='<div class="kp"><div class="kl">Sem dados</div><div class="kv">—</div></div>';return}
  G('kpis').classList.remove('kpi-auto');
  var empCnt=Object.keys(day.byEmp).length,funcCnt=Object.keys(day.byFunc).length;
  var comAtiv=day.ativos.filter(function(p){return !!p.atividade}).length;
  var faltosos=day.ativos.length-comAtiv;
  var previsto=day.ativos.length;
  var pctPrevisto=previsto>0?(comAtiv/previsto*100).toFixed(0):'0';
  var prodDia=computeProducaoDia(day);
  var prodM2Dia=prodDia.totals.M2||0;
  /* Mini-ranking: top 3 empresas do dia em m², exibido dentro do card 📐 */
  var byEmpMini={};
  prodDia.producers.forEach(function(pr){pr.parsed.forEach(function(u){if(u.unidade==='M2')byEmpMini[pr.p.empresa]=(byEmpMini[pr.p.empresa]||0)+u.valor})});
  var miniTop=Object.keys(byEmpMini).map(function(k){return{n:k,v:byEmpMini[k]}}).sort(function(a,b){return b.v-a.v}).slice(0,3);
  var miniHtml='';
  if(miniTop.length){
    var mxMini=miniTop[0].v||1;
    miniHtml='<div class="kp-mini">'+miniTop.map(function(m){return '<div class="kp-mini-row"><span class="nm" title="'+esc(m.n)+'">'+esc(m.n)+'</span><div class="tr"><div class="fl" style="width:'+(m.v/mxMini*100).toFixed(0)+'%"></div></div><span class="vl">'+fmtNum(m.v)+' m²</span></div>'}).join('')+'</div>';
  }
  var cards=[
    {i:'👷',l:'Pessoas no dia',             v:comAtiv,           f:'de '+previsto+' previstos ('+pctPrevisto+'%)', c:'#059669', click:''},
    {i:'🆕',l:'Chegaram Hoje',                v:(function(){var prev=PARSED.days.slice(SELECTED_DATE_IDX+1);var ant=new Set();prev.forEach(function(d){d.all.forEach(function(p){ant.add(norm(p.nome))})});return day.all.filter(function(p){return !ant.has(norm(p.nome))}).length})(), f:'1ª vez na obra — clique para ver',c:'var(--navy)', click:'openHojeModal()'},
    {i:'🌴',l:'De Ferias',      v:day.ferias.length, f:'excluidos do efetivo',              c:'var(--amber)', click:'openPeopleModal(\'ferias\')'},
    {i:'🚫',l:'Faltosos',       v:faltosos,          f:'sem atividade — excluidos',         c:'var(--red)',   click:'openPeopleModal(\'faltosos\')'},
    {i:'🏢',l:'Empresas',       v:empCnt,            f:'ativas hoje',                       c:'var(--blue)',  click:''},
    {i:'⚒️',l:'Funcoes',        v:funcCnt,           f:'distintas',                         c:'var(--cyan)',  click:''},
    {i:'📐',l:'Produção diária', v:fmtNum(prodM2Dia)+' m²', f:day.date+' — clique para ver', c:'#0891B2', click:'openProducaoModal()', feature:true, extra:miniHtml}
  ].map(function(k){
    var clickAttr=k.click?(' onclick="'+k.click+'" role="button" tabindex="0"'):'';
    var cls='kp'+(k.click?' kp-click':'')+(k.feature?' kp-feature':'');
    return '<div class="'+cls+'" style="--kc:'+k.c+'"'+clickAttr+'><div class="ki">'+k.i+'</div><div class="kl">'+k.l+'</div><div class="kv">'+k.v+'</div><div class="kf">'+k.f+'</div>'+(k.extra||'')+'</div>';
  });
  G('kpis').innerHTML='<div class="kpis-left">'+cards.slice(0,6).join('')+'</div>'+cards.slice(6).join('');
}

/* ═══════ PRODUÇÃO POR UNIDADE (UN / M² / M³) ═══════ */
/* Extrai pares {valor, unidade} do texto livre da coluna Produção.
   Reconhece m²/m2 -> M2, m³/m3 -> M3, un/und/unid/unidade(s) -> UN.
   Um mesmo texto pode ter mais de uma unidade (ex.: "12m² + 3un portas"). */
function parseProducaoUnidades(texto){
  if(!texto)return[];
  var resultados=[];
  /* Aceita números no padrão brasileiro (50,73 / 1.234,56) e evita \b após m²/m³,
     pois os caracteres sobrescritos não funcionam como "word boundary" em JS. */
  var re=/(\d[\d.,]*\d|\d)\s*(m³|m3|m²|m2|und?\.?|unid(?:ade)?s?)(?=$|[^A-Za-z0-9])/gi;
  var m;
  while((m=re.exec(texto))!==null){
    var bruto=m[1].replace(/\s/g,'');
    var valor;
    if(bruto.indexOf(',')>-1 && bruto.indexOf('.')>-1){
      valor=bruto.lastIndexOf(',')>bruto.lastIndexOf('.')?parseFloat(bruto.replace(/\./g,'').replace(',','.')):parseFloat(bruto.replace(/,/g,''));
    }else if(bruto.indexOf(',')>-1){
      valor=parseFloat(bruto.replace(',','.'));
    }else{
      valor=parseFloat(bruto);
    }
    if(isNaN(valor))continue;
    var u=m[2].toLowerCase();
    var unidade=(u==='m³'||u==='m3')?'M3':(u==='m²'||u==='m2')?'M2':'UN';
    resultados.push({valor:valor,unidade:unidade});
  }
  return resultados;
}

/* Agrega a produção do dia: só considera quem tem produção preenchida
   (mesma regra de temAtividade usada no filtro "Com producao" da tabela). */
function computeProducaoDia(day){
  var producers=[],totals={UN:0,M2:0,M3:0};
  if(!day)return{producers:producers,totals:totals};
  day.ativos.forEach(function(p){
    if(!temAtividade(p.prod))return;
    var parsed=parseProducaoUnidades(p.prod);
    parsed.forEach(function(u){totals[u.unidade]+=u.valor});
    producers.push({p:p,parsed:parsed});
  });
  return{producers:producers,totals:totals};
}

function fmtNum(v){return v.toLocaleString('pt-BR',{maximumFractionDigits:2})}

function openProducaoModal(){
  var day=getSelectedDay();
  if(!day){toast('Selecione um dia primeiro','warn');return}
  var agg=computeProducaoDia(day);
  var hdr=G('emp-modal-overlay').querySelector('.modal-h');
  hdr.style.background='#0891B2';
  G('emp-modal-title').textContent='📦 Produção Total';
  G('emp-modal-sub').textContent=day.date+' · '+agg.producers.length+' pessoa(s) com produção lançada';
  var body=G('emp-modal-body');
  if(!agg.producers.length){
    body.innerHTML='<div class="modal-empty">Nenhuma produção lançada neste dia.</div>';
    G('emp-modal-overlay').classList.add('on');
    return;
  }
  var lista=agg.producers.slice().sort(function(a,b){return(a.p.nome||'').localeCompare(b.p.nome||'','pt-BR')});
  var html='<div class="local-summary">'+
    '<div class="local-stat"><b>'+fmtNum(agg.totals.UN)+'</b><span>Total UN</span></div>'+
    '<div class="local-stat"><b>'+fmtNum(agg.totals.M2)+'</b><span>Total M²</span></div>'+
    '<div class="local-stat"><b>'+fmtNum(agg.totals.M3)+'</b><span>Total M³</span></div>'+
  '</div>';
  html+='<table class="people-modal-table" style="width:100%;border-collapse:collapse;font-size:12px">'+
    '<thead><tr>'+
    '<th style="text-align:left;padding:8px 10px;background:#E0F7FA;color:#0E7490;font-family:JetBrains Mono;font-size:9px;text-transform:uppercase;letter-spacing:.04em">Nome</th>'+
    '<th style="text-align:left;padding:8px 10px;background:#E0F7FA;color:#0E7490;font-family:JetBrains Mono;font-size:9px;text-transform:uppercase;letter-spacing:.04em">Empresa</th>'+
    '<th style="text-align:left;padding:8px 10px;background:#E0F7FA;color:#0E7490;font-family:JetBrains Mono;font-size:9px;text-transform:uppercase;letter-spacing:.04em">Pavimento</th>'+
    '<th style="text-align:left;padding:8px 10px;background:#E0F7FA;color:#0E7490;font-family:JetBrains Mono;font-size:9px;text-transform:uppercase;letter-spacing:.04em">Produção</th>'+
    '</tr></thead><tbody>'+
    lista.map(function(item,i){
      var p=item.p;var bg=i%2===0?'#fff':'#F8FAFC';
      var unidadesTxt=item.parsed.length?item.parsed.map(function(u){return fmtNum(u.valor)+' '+(u.unidade==='M2'?'m²':u.unidade==='M3'?'m³':'un')}).join(' + '):'—';
      return '<tr style="background:'+bg+'">'+
        '<td data-label="Nome" style="padding:8px 10px;font-weight:600;border-bottom:1px solid #E0F7FA">'+esc(p.nome)+'</td>'+
        '<td data-label="Empresa" style="padding:8px 10px;border-bottom:1px solid #E0F7FA"><span class="badge badge-gray">'+esc(p.empresa)+'</span></td>'+
        '<td data-label="Pavimento" style="padding:8px 10px;border-bottom:1px solid #E0F7FA">'+pavBadge(p.pav)+'</td>'+
        '<td data-label="Produção" style="padding:8px 10px;border-bottom:1px solid #E0F7FA">'+
          '<div style="font-weight:700;color:#0E7490">'+esc(unidadesTxt)+'</div>'+
          '<div style="margin-top:2px;color:var(--ink2);font-size:10px">'+esc(p.prod)+'</div>'+
        '</td>'+
      '</tr>';
    }).join('')+
    '</tbody></table>';
  body.innerHTML=html;
  G('emp-modal-overlay').classList.add('on');
}

function renderBars(elId,metaId,counts,colorMap,ativCounts,clickMode){
  var el=G(elId);
  var keys=Object.keys(counts).sort(function(a,b){return counts[b]-counts[a]});
  if(!keys.length){el.innerHTML='<div class="em">Sem dados</div>';G(metaId).textContent='';return}
  var max=counts[keys[0]];
  G(metaId).textContent=keys.length+' categorias';
  el.innerHTML=keys.map(function(k,i){
    var total=counts[k];
    var atv=ativCounts?(ativCounts[k]||0):null;
    var barW=max>0?(total/max*100).toFixed(1):0;
    var c=(colorMap&&colorMap[k])?colorMap[k]:(typeof colorMap==='string'?colorMap:COLORS[i%COLORS.length]);
    var valStr=atv!==null?(atv+'/'+total):total;
    var clickCls=clickMode?' bar-row-click':'';
    var clickTitle=clickMode==='pav'?(' — clique para ver as funções'):clickMode==='reg'?(' — clique para ver as funções'):clickMode==='func'?(' — clique para ver as pessoas'):clickMode==='srv'?(' — clique para ver os serviços'):(' — clique para ver os cargos');
    var dataAttr=clickMode?' data-bar-key="'+esc(k)+'" title="'+esc(k)+clickTitle+'"':' title="'+esc(k)+'"';
    return '<div class="bar-row'+clickCls+'"'+dataAttr+'><span class="bar-label">'+(esc(k))+'</span><div class="bar-track"><div class="bar-fill" style="width:'+barW+'%;background:'+c+'"></div></div><span class="bar-val">'+valStr+'</span></div>';
  }).join('');
  if(clickMode){
    Array.prototype.forEach.call(el.querySelectorAll('.bar-row-click'),function(row){
      var key=row.getAttribute('data-bar-key');
      if(clickMode==='pav') row.addEventListener('click',function(){openPavModal(key)});
      else if(clickMode==='reg') row.addEventListener('click',function(){openLocalModal(key)});
      else if(clickMode==='func') row.addEventListener('click',function(){openFuncModal(key)});
      else if(clickMode==='srv') row.addEventListener('click',function(){openSrvModal(key)});
      else row.addEventListener('click',function(){openEmpModal(key,clickMode)});
    });
  }
}

/* ═══════════════════════════════════════════════════════════════════════
   MODAIS DE DRILL-DOWN (Empresa / Pavimento / Local / Função)
   As três variantes (emp/pav/local) agrupam por função e usam o mesmo HTML,
   então compartilham _abrirModalAgrupado(). Função é um caso à parte: mostra
   uma tabela achatada em vez de accordions.
   ═══════════════════════════════════════════════════════════════════════ */
function _abrirModalAgrupado(pessoas,opts){
  var grupos={};
  pessoas.forEach(function(p){var f=p.funcao||'(sem função)';if(!grupos[f])grupos[f]=[];grupos[f].push(p);});
  var funcs=Object.keys(grupos).sort(function(a,b){return grupos[b].length-grupos[a].length});
  var total=pessoas.length,comAtiv=pessoas.filter(function(p){return !!p.atividade}).length;

  var hdr=G('emp-modal-overlay').querySelector('.modal-h');
  hdr.style.background=opts.cor;
  G('emp-modal-title').textContent=opts.titulo;
  G('emp-modal-sub').textContent=opts.subtitulo;

  var body=G('emp-modal-body');
  if(!funcs.length){body.innerHTML='<div class="modal-empty">Nenhuma pessoa encontrada.</div>';G('emp-modal-overlay').classList.add('on');return}

  var max=grupos[funcs[0]].length;
  var rowCls=opts.pavRow?'person-row pav-person-row':'person-row';
  var html='<div class="local-summary">'+
    '<div class="local-stat"><b>'+total+'</b><span>Pessoas</span></div>'+
    '<div class="local-stat"><b>'+comAtiv+'</b><span>Com atividade</span></div>'+
    '<div class="local-stat"><b>'+funcs.length+'</b><span>Funções</span></div></div>';

  html+=funcs.map(function(f,i){
    var lista=grupos[f].slice().sort(function(a,b){return(a.nome||'').localeCompare(b.nome||'','pt-BR')});
    var cnt=lista.length,atv=lista.filter(function(p){return !!p.atividade}).length;
    var w=max?(cnt/max*100).toFixed(1):0;
    var corBar=opts.corBar==='cycle'?COLORS[i%COLORS.length]:opts.corBar;
    var people=lista.map(function(p){
      /* Empresa: mostra badge do pavimento; Pav/Local: mostra o texto da atividade */
      var meio=opts.pavRow
        ? '<span class="person-activity" title="'+esc(p.atividade||'Sem atividade')+'">'+esc(p.atividade||'Sem atividade')+'</span>'
        : '<span class="badge badge-gray">'+esc(p.pav||'')+'</span>';
      return '<div class="'+rowCls+'">'+
        '<i class="person-dot" style="background:'+(p.atividade?'#10B981':'#EF4444')+'"></i>'+
        '<span class="person-name" title="'+esc(p.nome)+'">'+esc(p.nome)+'</span>'+
        meio+
        '<span class="badge '+(p.atividade?'badge-green':'badge-red')+'">'+(p.atividade?'ATIVO':'SEM ATIVIDADE')+'</span>'+
        '</div>';
    }).join('');
    return '<div class="accordion-group">'+
      '<div class="accordion-head">'+
        '<span class="accordion-arrow">▶</span><span class="accordion-title">'+esc(f)+'</span>'+
        '<div class="accordion-bar"><i style="width:'+w+'%;background:'+corBar+'"></i></div>'+
        '<span class="accordion-count">'+atv+'/'+cnt+'</span><span class="accordion-hint">ver</span>'+
      '</div><div class="accordion-body">'+people+'</div></div>';
  }).join('');

  body.innerHTML=html;
  body.querySelectorAll('.accordion-head').forEach(function(head){head.addEventListener('click',function(){
    var b=head.nextElementSibling,open=b.classList.toggle('open');head.classList.toggle('open',open);
  });});
  G('emp-modal-overlay').classList.add('on');
}

function openEmpModal(empKey,mode){
  if(!empKey)return;
  var peopleList=[],contextLabel='';
  if(mode==='range'){
    var days=getRangeDays(); if(!days.length)return;
    days.forEach(function(d){peopleList=peopleList.concat(d.ativos)});
    contextLabel=days.length+' dia(s) selecionados no periodo';
  }else{
    var day=getSelectedDay(); if(!day)return;
    peopleList=day.ativos; contextLabel='Dia '+(day.date||'—');
  }
  var pessoas=peopleList.filter(function(p){return p.empresa===empKey});
  _abrirModalAgrupado(pessoas,{
    titulo:'🏢 '+empKey,
    cor:'var(--navy)',
    subtitulo:contextLabel+' · '+pessoas.length+' pessoa(s)',
    pavRow:false,
    corBar:'cycle'
  });
}

function openPavModal(pavKey){
  if(!pavKey)return;
  var day=getSelectedDay(); if(!day)return;
  var pessoas=day.ativos.filter(function(p){return p.pav===pavKey});
  _abrirModalAgrupado(pessoas,{
    titulo:'📍 '+pavKey,
    cor:PAV_CORES[pavKey]||'var(--navy)',
    subtitulo:day.date+' · '+pessoas.length+' pessoa(s)',
    pavRow:true,
    corBar:PAV_CORES[pavKey]||'#64748B'
  });
}

function openLocalModal(localKey){
  if(!localKey)return;
  var day=getSelectedDay(); if(!day)return;
  var pessoas=day.ativos.filter(function(p){return regiaoPavKey(p)===localKey});
  _abrirModalAgrupado(pessoas,{
    titulo:'📍 '+localKey,
    cor:'var(--navy)',
    subtitulo:day.date+' · '+pessoas.length+' pessoa(s)',
    pavRow:true,
    corBar:'#64748B'
  });
}

/* Função: mostra uma tabela achatada (não agrupa por nada) */
function openFuncModal(funcKey){
  if(!funcKey)return;
  var day=getSelectedDay(); if(!day)return;
  var pessoas=day.ativos.filter(function(p){return (p.funcao||'(sem funcao)')===funcKey});
  var comAtiv=pessoas.filter(function(p){return !!p.atividade}).length;
  var hdr=G('emp-modal-overlay').querySelector('.modal-h');
  hdr.style.background='#0891B2';
  G('emp-modal-title').textContent=funcKey;
  G('emp-modal-sub').textContent='Dia '+(day.date||'—')+' · '+pessoas.length+' pessoa(s) · '+comAtiv+' c/ atividade';
  var body=G('emp-modal-body');
  if(!pessoas.length){
    body.innerHTML='<div class="modal-empty">Nenhuma pessoa encontrada nesta função.</div>';
  }else{
    pessoas.sort(function(a,b){return (a.nome||'').localeCompare(b.nome||'','pt-BR')});
    body.innerHTML='<table class="people-modal-table" style="width:100%;border-collapse:collapse;font-size:12px">'+
      '<thead><tr>'+
      '<th style="text-align:left;padding:8px 10px;background:#E0F2FE;color:#075985;font-family:JetBrains Mono;font-size:9px;text-transform:uppercase;letter-spacing:.04em">Nome</th>'+
      '<th style="text-align:left;padding:8px 10px;background:#E0F2FE;color:#075985;font-family:JetBrains Mono;font-size:9px;text-transform:uppercase;letter-spacing:.04em">Empresa</th>'+
      '<th style="text-align:left;padding:8px 10px;background:#E0F2FE;color:#075985;font-family:JetBrains Mono;font-size:9px;text-transform:uppercase;letter-spacing:.04em">Pavimento</th>'+
      '<th style="text-align:left;padding:8px 10px;background:#E0F2FE;color:#075985;font-family:JetBrains Mono;font-size:9px;text-transform:uppercase;letter-spacing:.04em">Atividade</th>'+
      '</tr></thead><tbody>'+
      pessoas.map(function(p,i){
        var bg=i%2===0?'#fff':'#F8FAFC';
        var status=p.atividade
          ? '<span class="badge badge-green">ATIVO</span>'
          : '<span class="badge badge-red">SEM ATIVIDADE</span>';
        return '<tr style="background:'+bg+'">'+
          '<td data-label="Nome" style="padding:8px 10px;font-weight:600;border-bottom:1px solid #E0F2FE">'+esc(p.nome)+'</td>'+
          '<td data-label="Empresa" style="padding:8px 10px;border-bottom:1px solid #E0F2FE"><span class="badge badge-gray">'+esc(p.empresa)+'</span></td>'+
          '<td data-label="Pavimento" style="padding:8px 10px;border-bottom:1px solid #E0F2FE">'+pavBadge(p.pav)+'</td>'+
          '<td data-label="Atividade" style="padding:8px 10px;border-bottom:1px solid #E0F2FE">'+status+
            (p.atividade?'<div style="margin-top:3px;color:var(--ink2);font-size:10px">'+esc(p.atividade)+'</div>':'')+
          '</td>'+
        '</tr>';
      }).join('')+
      '</tbody></table>';
  }
  G('emp-modal-overlay').classList.add('on');
}

/* ═══════ MODAL "CHEGARAM HOJE" ═══════ */
var _hojeData = [];  /* cache: pessoas que apareceram pela primeira vez no dia selecionado */

function openHojeModal() {
  var day = getSelectedDay();
  if (!day) { toast('Selecione um dia primeiro', 'warn'); return; }

  /* Dias ANTERIORES ao selecionado (todos os que vêm depois no array, pois days está em ordem decrescente) */
  var selectedIdx = SELECTED_DATE_IDX;
  var diasAnteriores = PARSED.days.slice(selectedIdx + 1); /* índices maiores = datas mais antigas */

  /* Conjunto de nomes que já apareceram em algum dia anterior */
  var nomesAnteriores = new Set();
  diasAnteriores.forEach(function(d) {
    d.all.forEach(function(p) {
      nomesAnteriores.add(norm(p.nome));
    });
  });

  /* "Chegou hoje" = está no dia selecionado E nunca apareceu antes */
  var todosHoje = day.ativos.concat(day.ferias);
  _hojeData = todosHoje.filter(function(p) {
    return !nomesAnteriores.has(norm(p.nome));
  });

  var feriasCnt = _hojeData.filter(function(p) { return p.ferias; }).length;
  var funcoesDistintas = uniq(_hojeData.map(function(p) { return p.funcao; })).length;
  var empresasDistintas = uniq(_hojeData.map(function(p) { return p.empresa; })).length;

  G('hoje-modal-title').textContent = '🆕 Chegaram em ' + (day.date || '—') + ' (1ª vez na obra)';
  G('hoje-modal-sub').textContent =
    _hojeData.length + ' pessoa(s) nova(s)' +
    (feriasCnt ? ' · ' + feriasCnt + ' férias' : '') +
    (diasAnteriores.length === 0 ? ' · (sem histórico anterior para comparar)' : '');

  G('hoje-modal-summary').innerHTML =
    '<div class="hj-stat"><b>' + _hojeData.length + '</b><span>Novos</span></div>' +
    '<div class="hj-stat"><b>' + funcoesDistintas + '</b><span>Funções</span></div>' +
    '<div class="hj-stat"><b>' + empresasDistintas + '</b><span>Empresas</span></div>';

  /* popular filtros */
  function fillSel(id, vals, def) {
    var sel = G(id), cur = sel.value;
    sel.innerHTML = '<option value="">' + def + '</option>' +
      vals.map(function(v) { return '<option value="' + esc(v) + '">' + esc(v) + '</option>'; }).join('');
    if (vals.indexOf(cur) > -1) sel.value = cur; else sel.value = '';
  }
  fillSel('hj-func', uniq(_hojeData.map(function(p) { return p.funcao; })), 'Todas as funções');
  fillSel('hj-emp',  uniq(_hojeData.map(function(p) { return p.empresa; })), 'Todas as empresas');
  var pavs = PAVIMENTOS.filter(function(v) { return _hojeData.some(function(p) { return p.pav === v; }); });
  fillSel('hj-pav', pavs, 'Todos os pavimentos');

  G('hj-q').value = '';
  G('hj-status').value = '';

  renderHojeModal();
  G('hoje-modal-overlay').classList.add('on');
}

function closeHojeModal() { G('hoje-modal-overlay').classList.remove('on'); }

function renderHojeModal() {
  var q    = norm(G('hj-q').value);
  var func = G('hj-func').value;
  var emp  = G('hj-emp').value;
  var pav  = G('hj-pav').value;
  var st   = G('hj-status').value;

  var lista = _hojeData.filter(function(p) {
    if (func && p.funcao !== func) return false;
    if (emp  && p.empresa !== emp) return false;
    if (pav  && p.pav !== pav) return false;
    if (st === 'ativo'   && (!p.atividade || p.ferias)) return false;
    if (st === 'ferias'  && !p.ferias) return false;
    if (q) {
      var full = norm(p.nome + ' ' + p.funcao + ' ' + p.empresa + ' ' + p.atividade + ' ' + p.regiao);
      if (full.indexOf(q) === -1) return false;
    }
    return true;
  });

  lista.sort(function(a, b) {
    var fa = a.funcao || '', fb = b.funcao || '';
    if (fa !== fb) return fa.localeCompare(fb, 'pt-BR');
    return (a.nome || '').localeCompare(b.nome || '', 'pt-BR');
  });

  var el = G('hoje-modal-body');
  if (!lista.length) {
    el.innerHTML = '<div class="modal-empty">Nenhuma pessoa encontrada com os filtros aplicados.</div>';
    return;
  }

  var h = '<table><thead><tr>' +
    '<th>#</th><th>Nome</th><th>Função</th><th>Empresa</th>' +
    '<th>Pavimento</th><th>Local</th><th>Atividade / Status</th>' +
    '</tr></thead><tbody>';

  var num = 1, curFunc = null;
  lista.forEach(function(p) {
    if (p.funcao !== curFunc) {
      curFunc = p.funcao;
      var cntFunc = lista.filter(function(x) { return x.funcao === curFunc; }).length;
      h += '<tr class="hj-func-header">' +
        '<td colspan="7" data-label="">⚒️ ' + esc(curFunc) + ' — ' + cntFunc + ' pessoa(s)</td>' +
        '</tr>';
    }

    var statusCell, statusStyle = '';
    if (p.ferias) {
      statusCell = '<span class="badge badge-ferias">' + esc(p.motivo || 'FÉRIAS') + '</span>';
      statusStyle = 'background:#FFFBEB';
    } else if (p.atividade) {
      statusCell = '<span class="badge badge-green">ATIVO</span>' +
        '<div style="margin-top:3px;color:var(--ink2);font-size:10px;line-height:1.4">' + esc(p.atividade) + '</div>';
    } else {
      statusCell = '<span class="badge badge-red">FALTOSO</span>' +
        (p.atividadeRaw ? '<div style="margin-top:3px;color:var(--ink3);font-size:10px;font-style:italic">' + esc(p.atividadeRaw) + '</div>' : '');
      statusStyle = 'background:#FFF5F5';
    }

    h += '<tr style="' + statusStyle + '">' +
      '<td data-label="#" class="nr" style="color:#94A3B8;font-family:JetBrains Mono">' + num++ + '</td>' +
      '<td data-label="Nome" style="font-weight:600;white-space:nowrap">' + esc(p.nome) + '</td>' +
      '<td data-label="Função" style="color:var(--ink2)">' + esc(p.funcao) + '</td>' +
      '<td data-label="Empresa"><span class="badge badge-gray">' + esc(p.empresa) + '</span></td>' +
      '<td data-label="Pavimento">' + pavBadge(p.pav) + '</td>' +
      '<td data-label="Local" style="color:var(--ink2);font-size:10px">' + esc(p.regiao || '—') + '</td>' +
      '<td data-label="Status / Atividade">' + statusCell + '</td>' +
    '</tr>';
  });

  h += '</tbody></table>';
  el.innerHTML = h;
}

function closeEmpModal(){
  G('emp-modal-overlay').classList.remove('on');
  G('emp-modal-overlay').querySelector('.modal-h').style.background='';
}

document.addEventListener('keydown',function(e){
  if(e.key==='Escape'){closeEmpModal();closePeopleModal();closeUnicosModal();closePrintModal();closeHojeModal();closePPCModal()}
});

/* ═══════ MODAL FALTOSOS / FÉRIAS ═══════ */
function openPeopleModal(tipo){
  var day=getSelectedDay();
  if(!day)return;
  var hdr=G('people-modal-hdr');
  var title=G('people-modal-title');
  var sub=G('people-modal-sub');
  var body=G('people-modal-body');

  if(tipo==='ferias'){
    var lista=day.ferias;
    hdr.style.background='#92400E';
    title.textContent='🌴 De Férias / Ausentes';
    sub.textContent=day.date+' · '+lista.length+' pessoa(s) excluída(s) do efetivo';
    if(!lista.length){
      body.innerHTML='<div class="modal-empty">Nenhuma pessoa de férias ou afastada neste dia.</div>';
    }else{
      body.innerHTML='<table class="people-modal-table" style="width:100%;border-collapse:collapse;font-size:12px">'+
        '<thead><tr>'+
        '<th style="text-align:left;padding:8px 10px;background:#FEF3C7;color:#92400E;font-family:JetBrains Mono;font-size:9px;text-transform:uppercase;letter-spacing:.04em">Nome</th>'+
        '<th style="text-align:left;padding:8px 10px;background:#FEF3C7;color:#92400E;font-family:JetBrains Mono;font-size:9px;text-transform:uppercase;letter-spacing:.04em">Função</th>'+
        '<th style="text-align:left;padding:8px 10px;background:#FEF3C7;color:#92400E;font-family:JetBrains Mono;font-size:9px;text-transform:uppercase;letter-spacing:.04em">Empresa</th>'+
        '<th style="text-align:left;padding:8px 10px;background:#FEF3C7;color:#92400E;font-family:JetBrains Mono;font-size:9px;text-transform:uppercase;letter-spacing:.04em">Motivo</th>'+
        '</tr></thead><tbody>'+
        lista.map(function(p,i){
          var bg=i%2===0?'#fff':'#FFFBEB';
          return '<tr style="background:'+bg+'">'+
            '<td data-label="Nome" style="padding:8px 10px;font-weight:600;border-bottom:1px solid #FEF3C7">'+esc(p.nome)+'</td>'+
            '<td data-label="Função" style="padding:8px 10px;color:#92400E;border-bottom:1px solid #FEF3C7">'+esc(p.funcao)+'</td>'+
            '<td data-label="Empresa" style="padding:8px 10px;border-bottom:1px solid #FEF3C7"><span class="badge badge-gray">'+esc(p.empresa)+'</span></td>'+
            '<td data-label="Motivo" style="padding:8px 10px;border-bottom:1px solid #FEF3C7"><span class="badge badge-ferias">'+esc(p.motivo||'FÉRIAS')+'</span></td>'+
          '</tr>';
        }).join('')+
        '</tbody></table>';
    }
  }else{ /* faltosos */
    var faltososList=day.ativos.filter(function(p){return !p.atividade});
    /* Regra: falta vale só no dia — sem contagem histórica. */
    hdr.style.background='#991B1B';
    title.textContent='🚫 Faltosos / Sem Atividade';
    sub.textContent=day.date+' · '+faltososList.length+' pessoa(s) excluída(s) do efetivo';
    if(!faltososList.length){
      body.innerHTML='<div class="modal-empty">Nenhum faltoso neste dia. 👍</div>';
    }else{
      body.innerHTML='<table class="people-modal-table" style="width:100%;border-collapse:collapse;font-size:12px">'+
        '<thead><tr>'+
        '<th style="text-align:left;padding:8px 10px;background:#FEE2E2;color:#991B1B;font-family:JetBrains Mono;font-size:9px;text-transform:uppercase;letter-spacing:.04em">Nome</th>'+
        '<th style="text-align:left;padding:8px 10px;background:#FEE2E2;color:#991B1B;font-family:JetBrains Mono;font-size:9px;text-transform:uppercase;letter-spacing:.04em">Função</th>'+
        '<th style="text-align:left;padding:8px 10px;background:#FEE2E2;color:#991B1B;font-family:JetBrains Mono;font-size:9px;text-transform:uppercase;letter-spacing:.04em">Empresa</th>'+
        '<th style="text-align:left;padding:8px 10px;background:#FEE2E2;color:#991B1B;font-family:JetBrains Mono;font-size:9px;text-transform:uppercase;letter-spacing:.04em">Reg. Atividade</th>'+
        '</tr></thead><tbody>'+
        faltososList.map(function(p,i){
          var bg=i%2===0?'#fff':'#FFF5F5';
          return '<tr style="background:'+bg+'">'+
            '<td data-label="Nome" style="padding:8px 10px;font-weight:600;color:#B91C1C;border-bottom:1px solid #FEE2E2">'+esc(p.nome)+'</td>'+
            '<td data-label="Função" style="padding:8px 10px;color:#991B1B;border-bottom:1px solid #FEE2E2">'+esc(p.funcao)+'</td>'+
            '<td data-label="Empresa" style="padding:8px 10px;border-bottom:1px solid #FEE2E2"><span class="badge badge-gray">'+esc(p.empresa)+'</span></td>'+
            '<td data-label="Reg. Atividade" style="padding:8px 10px;border-bottom:1px solid #FEE2E2;color:var(--ink3);font-size:11px;font-style:italic">'+esc(p.atividadeRaw||'—')+'</td>'+
          '</tr>';
        }).join('')+
        '</tbody></table>';
    }
  }
  G('people-modal-overlay').classList.add('on');
}
function closePeopleModal(){G('people-modal-overlay').classList.remove('on')}

/* ═══ Filtro discreto de empresas nos gráficos "Efetivo por dia" ═══ */
var CHART_FILTER={};  /* boxId -> null (todas) ou array de empresas selecionadas */
var CHART_CTX={};     /* boxId -> últimos dados do render (para re-renderizar) */
function countEfetivoDia(d,sel){
  if(!sel)return comAtividadeCount(d);
  return(d.ativos||[]).filter(function(p){return!!p.atividade&&sel.indexOf(p.empresa)>-1}).length;
}
function renderChart(days,selectedDay,boxId,metaId){
  boxId=boxId||'chart-box';metaId=metaId||'chart-meta';
  var el=G(boxId),meta=G(metaId);
  if(!days||!days.length){el.innerHTML='<div class="em">Sem dados</div>';return}
  var empsGraf=uniq(days.reduce(function(a,d){return a.concat((d.ativos||[]).map(function(p){return p.empresa}).filter(Boolean))},[]));
  var selEmp=CHART_FILTER[boxId]||null;
  meta.textContent=days.length+' dia(s)'+(selEmp&&selEmp.length<empsGraf.length?' \u00b7 '+selEmp.filter(function(v){return empsGraf.indexOf(v)>-1}).length+'/'+empsGraf.length+' empresas':'');

  var isMobile=window.innerWidth<=640;
  var n=days.length;
  var W=isMobile?(window.innerWidth-28):600;
  var H=isMobile?130:220;
  var pL=isMobile?28:36, pR=isMobile?6:10, pT=isMobile?20:28, pB=isMobile?26:38;

  var vals  =days.map(function(d){return countEfetivoDia(d,selEmp)}).reverse();
  var labels=days.map(function(d){return d.date}).reverse();
  var selIdx=-1;
  if(selectedDay){for(var si=0;si<n;si++){if(labels[si]===selectedDay.date){selIdx=si;break}}}
  var maxV=Math.max.apply(null,vals.concat([1]));

  function xS(i){return pL+(n>1?i/(n-1):0.5)*(W-pL-pR)}
  function yS(v){return pT+(1-v/maxV)*(H-pT-pB)}

  var svg='<svg viewBox="0 0 '+W+' '+H+'" style="width:100%;display:block">';

  var fntY=isMobile?8:9;
  for(var g=0;g<=4;g++){
    var gy=yS(maxV*g/4);
    svg+='<line x1="'+pL+'" y1="'+gy+'" x2="'+(W-pR)+'" y2="'+gy+'" stroke="#E2E8F0" stroke-dasharray="3,3"/>';
    svg+='<text x="'+(pL-4)+'" y="'+(gy+3)+'" text-anchor="end" fill="#94A3B8" font-family="JetBrains Mono" font-size="'+fntY+'">'+Math.round(maxV*g/4)+'</text>';
  }

  var lblSlot=isMobile?30:36;
  var maxXLbls=Math.max(2, Math.floor((W-pL-pR)/lblSlot));
  var xStep=Math.max(1, Math.ceil((n-1)/(maxXLbls-1)));
  var xLblIdx=[];
  for(var xi=0;xi<n;xi+=xStep) xLblIdx.push(xi);
  if(xLblIdx[xLblIdx.length-1]!==n-1) xLblIdx[xLblIdx.length-1]=n-1;

  var fntX=isMobile?7:8;
  for(var xii=0;xii<xLblIdx.length;xii++){
    var idx=xLblIdx[xii];
    var lx=xS(idx);
    var isFirst=(idx===0),isLast=(idx===n-1),isSel=(idx===selIdx);
    var anchor=isLast?'end':(isFirst?'start':'middle');
    svg+='<line x1="'+lx+'" y1="'+pT+'" x2="'+lx+'" y2="'+(H-pB)+'" stroke="#F1F5F9"/>';
    svg+='<text x="'+lx+'" y="'+(H-pB+fntX+4)+'" text-anchor="'+anchor+'" fill="'+(isSel?'#059669':'#94A3B8')+'" font-family="JetBrains Mono" font-size="'+fntX+'" font-weight="'+(isSel?'700':'400')+'">'+esc(labels[idx].slice(0,5))+'</text>';
  }

  var areaPath='M '+xS(0)+' '+(H-pB)+' L '+xS(0)+' '+yS(vals[0]);
  for(var pi=1;pi<n;pi++) areaPath+=' L '+xS(pi)+' '+yS(vals[pi]);
  areaPath+=' L '+xS(n-1)+' '+(H-pB)+' Z';
  svg+='<path d="'+areaPath+'" fill="#059669" opacity="0.10"/>';
  var linePath='M '+xS(0)+' '+yS(vals[0]);
  for(var li=1;li<n;li++) linePath+=' L '+xS(li)+' '+yS(vals[li]);
  svg+='<path d="'+linePath+'" fill="none" stroke="#059669" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>';

  var valStep=n<=12?1:xStep;
  var valSet={};
  for(var vi=0;vi<n;vi+=valStep) valSet[vi]=true;
  valSet[0]=true;
  valSet[n-1]=true;
  if(selIdx>=0) valSet[selIdx]=true;
  var fntV=isMobile?8:9, fntVSel=isMobile?10:11;

  for(var ci=0;ci<n;ci++){
    var cx=xS(ci),cy=yS(vals[ci]),isSel=(ci===selIdx);
    var r=isSel?5:3;
    svg+='<circle cx="'+cx+'" cy="'+cy+'" r="'+r+'" fill="'+(isSel?'#D97706':'#059669')+'" stroke="#fff" stroke-width="'+(isSel?2:1.5)+'"/>';
    if(valSet[ci]){
      var isF=(ci===0),isL=(ci===n-1);
      var vAnchor=isL?'end':(isF?'start':'middle');
      var vx=isF?cx+2:(isL?cx-2:cx);
      var vy=Math.max(pT+(isSel?fntVSel:fntV), cy-r-4);
      svg+='<text x="'+vx+'" y="'+vy+'" text-anchor="'+vAnchor+'" fill="'+(isSel?'#D97706':'#059669')+'" font-family="JetBrains Mono" font-size="'+(isSel?fntVSel:fntV)+'" font-weight="700">'+vals[ci]+'</text>';
    }
  }

  if(selIdx>=0){
    var sx=xS(selIdx),sy=yS(vals[selIdx]);
    svg+='<circle cx="'+sx+'" cy="'+sy+'" r="5" fill="none" stroke="#D97706" stroke-width="1.5" opacity="0.5">'+
         '<animate attributeName="r" from="5" to="14" dur="1.5s" repeatCount="indefinite"/>'+
         '<animate attributeName="opacity" from="0.6" to="0" dur="1.5s" repeatCount="indefinite"/></circle>';
  }

  svg+='</svg>';
  el.innerHTML=svg;
  buildChartFilter(boxId,metaId,days,selectedDay,empsGraf);
}

/* UI do filtro: um botãozinho discreto no cabeçalho do gráfico que abre uma
   lista simples de empresas (mesmos chips da impressão). Sempre recalcula o
   gráfico pelo nº de colaboradores COM ATIVIDADE das empresas marcadas. */
function buildChartFilter(boxId,metaId,days,selectedDay,emps){
  CHART_CTX[boxId]={days:days,selectedDay:selectedDay,metaId:metaId,emps:emps};
  var host=G(metaId);if(!host||!host.parentNode)return;
  var sel=CHART_FILTER[boxId];
  var wrap=G('chart-filter-'+boxId);
  if(!wrap){
    wrap=document.createElement('span');
    wrap.id='chart-filter-'+boxId;
    wrap.className='chart-filter';
    wrap.innerHTML='<button type="button" class="chart-filter-btn" onclick="toggleChartFilter(\''+boxId+'\')"></button>'+
                   '<div class="chart-filter-pop" id="chart-filter-pop-'+boxId+'"></div>';
    host.parentNode.appendChild(wrap);
  }
  if(emps.length<2){wrap.style.display='none';return}  /* 1 empresa só: não polui o cabeçalho */
  wrap.style.display='';
  var btn=wrap.querySelector('.chart-filter-btn');
  var nSel=sel?sel.filter(function(v){return emps.indexOf(v)>-1}).length:emps.length;
  var ativo=!!sel&&nSel<emps.length;
  btn.className='chart-filter-btn'+(ativo?' on':'');
  btn.title=ativo?('Filtrar empresas — mostrando: '+sel.filter(function(v){return emps.indexOf(v)>-1}).join(', ')):'Filtrar empresas no gráfico';
  btn.innerHTML='\ud83d\udce2'+(ativo?' '+nSel:' <span style="opacity:.65">empresas</span>')+' ▾';
  var pop=G('chart-filter-pop-'+boxId);
  pop.innerHTML='<div class="cfa"><span onclick="chartFilterAll(\''+boxId+'\',true)">todas</span> \u00b7 <span onclick="chartFilterAll(\''+boxId+'\',false)">nenhuma</span></div>'+
    emps.map(function(v){
      var ck=!sel||sel.indexOf(v)>-1;
      return '<label class="pm-chip-label'+(ck?' on':'')+'" title="'+esc(v)+'"><input type="checkbox" value="'+esc(v)+'"'+(ck?' checked':'')+' onchange="chartFilterToggle(\''+boxId+'\',this)">'+esc(v)+'</label>';
    }).join('');
}
function _chartPopPlace(boxId){
  var w=G('chart-filter-'+boxId),pop=G('chart-filter-pop-'+boxId);
  if(!w||!pop)return;
  var r=w.querySelector('.chart-filter-btn').getBoundingClientRect();
  pop.style.display='block';
  var pw=pop.offsetWidth||200;
  pop.style.left=Math.max(8,Math.min(window.innerWidth-pw-8,r.right-pw))+'px';
  pop.style.top=(r.bottom+4)+'px';
}
function toggleChartFilter(boxId){
  var pop=G('chart-filter-pop-'+boxId);if(!pop)return;
  var abrir=pop.style.display!=='block';
  document.querySelectorAll('.chart-filter-pop').forEach(function(p){p.style.display='none'});
  if(abrir)_chartPopPlace(boxId);
}
function chartFilterAll(boxId,state){
  var pop=G('chart-filter-pop-'+boxId);if(!pop)return;
  pop.querySelectorAll('input').forEach(function(cb){cb.checked=state;cb.closest('label').className='pm-chip-label'+(state?' on':'')});
  chartFilterApply(boxId);
}
function chartFilterToggle(boxId,cb){
  if(cb&&cb.closest('label'))cb.closest('label').className='pm-chip-label'+(cb.checked?' on':'');
  chartFilterApply(boxId);
}
function chartFilterApply(boxId){
  var pop=G('chart-filter-pop-'+boxId),ctx=CHART_CTX[boxId];
  if(!ctx)return;
  var emps=ctx.emps||[],sel=[];
  if(pop)pop.querySelectorAll('input').forEach(function(cb){if(cb.checked)sel.push(cb.value)});
  CHART_FILTER[boxId]=(sel.length>=emps.length)?null:sel;
  renderChart(ctx.days,ctx.selectedDay,boxId,ctx.metaId);
  _chartPopPlace(boxId);
}
/* fecha os popovers ao clicar fora */
document.addEventListener('click',function(e){
  if(e.target&&e.target.closest&&e.target.closest('.chart-filter'))return;
  document.querySelectorAll('.chart-filter-pop').forEach(function(p){p.style.display='none'});
});

function getFilteredPeople(day){
  if(!day)return{active:[],ferias:[]};
  var q=norm(G('fq').value),emp=G('femp').value,func=G('ffunc').value,pav=G('fpav').value,st=G('fstatus').value||'ativo',prodF=G('fprod').value;
  var active=[],ferias=[];
  day.all.forEach(function(p){
    if(emp&&p.empresa!==emp)return;
    if(func&&p.funcao!==func)return;
    if(pav&&p.pav!==pav)return;
    if(q){var full=norm(p.nome+' '+p.empresa+' '+p.funcao+' '+p.atividade+' '+p.regiao);if(full.indexOf(q)===-1)return}

    if(p.ferias){
      if(st==='ferias'||st==='todos')ferias.push(p);
      return;
    }
    if(st==='ativo'&&!p.atividade)return;
    if(st==='sem'&&p.atividade)return;
    if(st==='ferias')return;
    if(prodF==='com'&&!temAtividade(p.prod))return;
    if(prodF==='sem'&&temAtividade(p.prod))return;
    active.push(p);
  });
  return{active:active,ferias:ferias};
}

function pavBadge(pav){
  if(!pav)return '<span class="badge badge-pav-none">—</span>';
  return '<span class="badge '+(PAV_BADGE[pav]||'badge-blue')+'">'+esc(pav)+'</span>';
}

function markScrollable(container){
  requestAnimationFrame(function(){
    if(window.innerWidth<=480)return;
    var tbl=container.querySelector('table.t');
    if(tbl&&tbl.scrollWidth>container.clientWidth+2)container.classList.add('can-scroll');
    else container.classList.remove('can-scroll');
  });
}

function setSort(k){if(sortKey===k)sortDir*=-1;else{sortKey=k;sortDir=1}renderTable()}

function renderTable(){
  setTimeout(alignSingleView,30);
  var day=getSelectedDay(),el=G('tbl-box'),meta=G('tbl-meta');
  if(!day){el.innerHTML='<div class="em">Sem dados</div>';return}
  var r=getFilteredPeople(day),ferias=r.ferias;
  var az=G('faz').value;

  var ativos=r.active.filter(function(p){return !!p.atividade});
  var faltosos=r.active.filter(function(p){return !p.atividade});

  function sortPpl(arr){
    if(sortKey) return arr.slice().sort(function(a,b){return(a[sortKey]||'').localeCompare(b[sortKey]||'','pt-BR',{numeric:true})*sortDir});
    if(az==='az') return arr.slice().sort(function(a,b){return(a.nome||'').localeCompare(b.nome||'','pt-BR')});
    if(az==='za') return arr.slice().sort(function(a,b){return(b.nome||'').localeCompare(a.nome||'','pt-BR')});
    return arr;
  }
  ativos=sortPpl(ativos);
  faltosos=sortPpl(faltosos);
  ferias=sortPpl(ferias);

  meta.textContent=ativos.length+' ativos'+(faltosos.length?' · '+faltosos.length+' faltosos':'')+(ferias.length?' · '+ferias.length+' ferias':'');

  var sk=sortKey,sd=sortDir;
  var h='<table class="t"><thead><tr>'+
    '<th onclick="setSort(\'nome\')" class="'+(sk==='nome'?sd>0?'asc':'desc':'')+'">Nome</th>'+
    '<th onclick="setSort(\'funcao\')" class="'+(sk==='funcao'?sd>0?'asc':'desc':'')+'">Funcao</th>'+
    '<th onclick="setSort(\'empresa\')" class="'+(sk==='empresa'?sd>0?'asc':'desc':'')+'">Empresa</th>'+
    '<th>Atividade / Servico</th>'+
    '<th onclick="setSort(\'pav\')" class="'+(sk==='pav'?sd>0?'asc':'desc':'')+'">Pav.</th>'+
    '<th onclick="setSort(\'regiao\')" class="'+(sk==='regiao'?sd>0?'asc':'desc':'')+'">Local</th>'+
    '</tr></thead><tbody>';

  ativos.forEach(function(p){
    h+='<tr>'+
      '<td data-label="Nome" style="font-weight:600;white-space:nowrap">'+esc(p.nome)+'</td>'+
      '<td data-label="Funcao" style="color:var(--ink2)">'+esc(p.funcao)+'</td>'+
      '<td data-label="Empresa"><span class="badge badge-gray">'+esc(p.empresa)+'</span></td>'+
      '<td data-label="Atividade" style="min-width:170px;white-space:normal;line-height:1.5">'+esc(p.atividade)+'</td>'+
      '<td data-label="Pav.">'+pavBadge(p.pav)+'</td>'+
      '<td data-label="Local" style="color:var(--ink2);font-size:11px">'+esc(p.regiao||'—')+'</td>'+
    '</tr>';
  });

  if(faltosos.length){
    h+='<tr style="background:#FEE2E2"><td colspan="6" style="padding:8px 12px;font-family:\'JetBrains Mono\';font-size:10px;color:#B91C1C;font-weight:700;letter-spacing:.04em;text-transform:uppercase">🚫 '+faltosos.length+' FALTOSO(S) — sem atividade (excluidos do efetivo real)</td></tr>';
    faltosos.forEach(function(p){
      h+='<tr style="background:#FFF5F5">'+
        '<td data-label="Nome" style="font-weight:600;white-space:nowrap;color:#B91C1C">'+esc(p.nome)+'</td>'+
        '<td data-label="Funcao" style="color:#991B1B">'+esc(p.funcao)+'</td>'+
        '<td data-label="Empresa"><span class="badge badge-gray">'+esc(p.empresa)+'</span></td>'+
        '<td data-label="Atividade"><span class="badge badge-red">FALTOSO</span>'+(p.atividadeRaw?'<span style="color:var(--ink3);font-size:10px;font-style:italic;margin-left:6px">'+esc(p.atividadeRaw)+'</span>':'')+'</td>'+
        '<td data-label="Pav.">'+pavBadge(p.pav)+'</td>'+
        '<td data-label="Local" style="color:var(--ink2);font-size:11px">'+esc(p.regiao||'—')+'</td>'+
      '</tr>';
    });
  }

  if(ferias.length){
    h+='<tr class="ferias-header"><td colspan="6">★ '+ferias.length+' PESSOA(S) AUSENTE(S) (ferias/afastado — excluidas do efetivo)</td></tr>';
    ferias.forEach(function(p){
      h+='<tr class="ferias-row">'+
        '<td data-label="Nome" style="font-weight:600;color:#92400E;white-space:nowrap">'+esc(p.nome)+'</td>'+
        '<td data-label="Funcao" style="color:#B45309">'+esc(p.funcao)+'</td>'+
        '<td data-label="Empresa"><span class="badge badge-gray">'+esc(p.empresa)+'</span></td>'+
        '<td data-label="Status" colspan="2"><span class="badge badge-ferias">'+esc(p.motivo||'FERIAS')+'</span></td>'+
        '<td data-label="Local" style="color:var(--ink2);font-size:11px">'+esc(p.regiao||'—')+'</td>'+
      '</tr>';
    });
  }

  h+='</tbody></table>';
  el.innerHTML=h;
  markScrollable(el);
}

function renderHist(days){
  var el=G('hist-box'),meta=G('hist-meta');
  if(!days||!days.length){el.innerHTML='<div class="em">Sem dados</div>';return}
  meta.textContent=days.length+' dia(s)';
  var selDay=getSelectedDay(),selDate=selDay?selDay.date:'';
  var h='<table class="t"><thead><tr><th>Data</th><th>Efetivo (c/ atividade)</th><th>Presentes</th><th>Ferias</th><th>Empresas</th><th>Funcoes</th><th>C/ pavimento</th></tr></thead><tbody>';
  days.forEach(function(d,di){
    var comAtiv=comAtividadeCount(d),comPav=d.ativos.filter(function(p){return p.pav}).length,pctAtiv=d.ativos.length>0?(comAtiv/d.ativos.length*100).toFixed(0):'0',isSel=d.date===selDate;
    h+='<tr style="cursor:pointer;'+(isSel?'background:#DBEAFE':'')+'" onclick="selectDateByValue('+di+')">'+
      '<td data-label="Data" style="font-family:JetBrains Mono;font-weight:700">'+(isSel?'▸ ':'')+esc(d.date)+'</td>'+
      '<td data-label="Efetivo" class="nr" style="font-size:16px;font-weight:700;color:#059669">'+comAtiv+' <span style="font-size:10px;color:var(--ink3);font-weight:400">('+pctAtiv+'%)</span></td>'+
      '<td data-label="Presentes" class="nr" style="color:var(--ink2)">'+d.ativos.length+'</td>'+
      '<td data-label="Ferias" class="nr" style="color:'+(d.ferias.length?'var(--amber)':'var(--ink3)')+'">'+d.ferias.length+'</td>'+
      '<td data-label="Empresas" class="nr">'+Object.keys(d.byEmp).length+'</td>'+
      '<td data-label="Funcoes" class="nr">'+Object.keys(d.byFunc).length+'</td>'+
      '<td data-label="C/ pavimento" class="nr">'+comPav+'/'+d.ativos.length+'</td>'+
    '</tr>';
  });
  h+='</tbody></table>';el.innerHTML=h;
  markScrollable(el);
}

function selectDateByValue(idx){
  SELECTED_DATE_IDX=idx;
  G('btn-prev').disabled=SELECTED_DATE_IDX>=PARSED.days.length-1;
  G('btn-next').disabled=SELECTED_DATE_IDX<=0;
  ['fq','femp','ffunc','fpav','fprod','faz'].forEach(function(id){G(id).value=''});
  G('fstatus').value='ativo';
  updateDateBtnText();renderDatePanel();
  renderAllForDate();G('kpis').scrollIntoView({behavior:'smooth',block:'start'});
}

var SINGLE_PROD_EMPRESA_UNIT='M2';
function setSingleProdEmpresaUnit(unit){
  SINGLE_PROD_EMPRESA_UNIT=unit||'M2';
  ['m2','m3','un'].forEach(function(k){var b=G('single-prod-tab-'+k);if(b)b.classList.toggle('on',SINGLE_PROD_EMPRESA_UNIT===k.toUpperCase())});
  renderProducaoEmpresaDia(getSelectedDay());
}

function renderProducaoEmpresaDia(day){
  var box=G('single-prod-empresa-box'),meta=G('single-prod-empresa-meta');
  if(!box||!meta)return;
  if(!day){box.innerHTML='<div class="prod-empresa-empty">Selecione um dia para ver a produção por empresa.</div>';meta.textContent='';return;}
  var unit=SINGLE_PROD_EMPRESA_UNIT, label=unit==='M2'?'m²':unit==='M3'?'m³':'UN';
  var color=unit==='M2'?'#2563EB':unit==='M3'?'#D97706':'#7C3AED';
  var byEmp={};
  (day.ativos||[]).forEach(function(p){
    if(!temAtividade(p.prod))return;
    parseProducaoUnidades(p.prod).forEach(function(u){
      if(u.unidade===unit)byEmp[p.empresa]=(byEmp[p.empresa]||0)+u.valor;
    });
  });
  var keys=Object.keys(byEmp).filter(function(k){return byEmp[k]>0}).sort(function(a,b){return byEmp[b]-byEmp[a]});
  if(!keys.length){box.innerHTML='<div class="prod-empresa-empty">Nenhuma produção em '+label+' registrada neste dia.</div>';meta.textContent=day.date+' · 0 empresas';return;}
  var max=byEmp[keys[0]]||1,total=keys.reduce(function(s,k){return s+byEmp[k]},0);
  var rows=keys.map(function(k){
    var w=(byEmp[k]/max*100).toFixed(1);
    return '<div class="prod-empresa-row"><span class="prod-empresa-name" title="'+esc(k)+'">'+esc(k)+'</span><div class="prod-empresa-track"><div class="prod-empresa-fill" style="width:'+w+'%;background:'+color+'"></div></div><span class="prod-empresa-val">'+fmtNum(byEmp[k])+' '+label+'</span></div>';
  }).join('');
  box.innerHTML=rows;
  meta.textContent=day.date+' · '+keys.length+' empresa(s) · '+fmtNum(total)+' '+label;
}

var SINGLE_PROD_FUNC_UNIT='M2';
function setSingleProdFuncUnit(unit){
  SINGLE_PROD_FUNC_UNIT=unit||'M2';
  ['m2','m3','un'].forEach(function(k){var b=G('single-prod-func-tab-'+k);if(b)b.classList.toggle('on',SINGLE_PROD_FUNC_UNIT===k.toUpperCase())});
  renderProducaoFuncDia(getSelectedDay());
}

/* Produção agrupada por FUNÇÃO (pintor, eletricista, pedreiro...) no dia selecionado */
function renderProducaoFuncDia(day){
  var box=G('single-prod-func-box'),meta=G('single-prod-func-meta');
  if(!box||!meta)return;
  if(!day){box.innerHTML='<div class="prod-empresa-empty">Selecione um dia para ver a produção por função.</div>';meta.textContent='';return;}
  var unit=SINGLE_PROD_FUNC_UNIT,label=unit==='M2'?'m²':unit==='M3'?'m³':'UN';
  var byFunc={};
  (day.ativos||[]).forEach(function(p){
    if(!temAtividade(p.prod))return;
    var fn=p.funcao||'(sem função)';
    parseProducaoUnidades(p.prod).forEach(function(u){
      if(u.unidade===unit)byFunc[fn]=(byFunc[fn]||0)+u.valor;
    });
  });
  var keys=Object.keys(byFunc).filter(function(k){return byFunc[k]>0}).sort(function(a,b){return byFunc[b]-byFunc[a]});
  if(!keys.length){box.innerHTML='<div class="prod-empresa-empty">Nenhuma produção em '+label+' registrada neste dia.</div>';meta.textContent=day.date+' · 0 funções';return;}
  var max=byFunc[keys[0]]||1,total=keys.reduce(function(s,k){return s+byFunc[k]},0);
  box.innerHTML=keys.map(function(k,i){
    var w=(byFunc[k]/max*100).toFixed(1);
    return '<div class="prod-empresa-row" data-func-key="'+esc(k)+'" title="'+esc(k)+' — clique para ver quem produziu" style="cursor:pointer"><span class="prod-empresa-name">'+esc(k)+'</span><div class="prod-empresa-track"><div class="prod-empresa-fill" style="width:'+w+'%;background:'+COLORS[i%COLORS.length]+'"></div></div><span class="prod-empresa-val">'+fmtNum(byFunc[k])+' '+label+'</span></div>';
  }).join('');
  Array.prototype.forEach.call(box.querySelectorAll('[data-func-key]'),function(row){
    row.addEventListener('click',function(){openProdFuncDiaModal(row.getAttribute('data-func-key'))});
  });
  meta.textContent=day.date+' · '+keys.length+' função(ões) · '+fmtNum(total)+' '+label;
}

function renderAllForDate(){
  var day=getSelectedDay();
  G('sub-date').textContent=day?('Dados de '+day.date):'Sem dados';
  renderKPIs(day);
  if(day){populateFilters(day);renderBars('emp-bars','emp-meta',day.byEmp,COLORS,day.byEmpAtiv,'day');renderBars('func-bars','func-meta',day.byFunc,COLORS,day.byFuncAtiv,'func');renderBars('pav-bars','pav-meta',day.byPav,PAV_CORES,null,'pav');renderBars('reg-bars','reg-meta',day.byRegiao,COLORS,null,'reg')}
  else{['emp-bars','func-bars','pav-bars','reg-bars'].forEach(function(id){G(id).innerHTML=''});['emp-meta','func-meta','pav-meta','reg-meta'].forEach(function(id){G(id).textContent=''})}
  renderChart(PARSED.days,day);renderProducaoEmpresaDia(day);renderProducaoFuncDia(day);renderTable();renderHist(PARSED.days);
  G('upd-ts').textContent='atualizado '+fmtNow();
}

function renderAll(){
  if(!PARSED){G('kpis').innerHTML='<div class="kp"><div class="kl">Sem dados</div><div class="kv">—</div></div>';return}
  populateDateFilter();
  G('sub-info').textContent='Fonte: Google Sheets · '+PARSED.people.length+' registros';
  initRangeChips();
  if(VIEW_MODE==='range')renderRangeAll();else renderAllForDate();
}


/* ═══════ PPC — PLANEJAMENTO A CURTO PRAZO (2ª planilha) ═══════
   KPI: PPC = tarefas com EXEC % = 100% ÷ tarefas planejadas da semana.
   Lê todas as abas "Semana ..." da planilha; o KPI mostra a semana mais recente com tarefas. */
var PPC_SHEET_ID='1FuE2D7kSc4p5ZjVCUMWtsqq7MYrNRmGyzM4Dt_b3vXg';
var PPC_API_KEY='AIzaSyBcTj7dlJDeCjnNjy5ZHVgJ1_NeQNEhw7M';
var PPC_WEEKS=[],PPC_SEL=-1,PPC_SEL_TITLE='',PPC_STATE='loading',PPC_ERR='',PPC_OBRA='';

function ppcPct(v){
  var s=String(v==null?'':v).trim();
  if(!s)return null;
  var m=s.match(/^(\d+(?:[.,]\d+)?)\s*%$/);
  if(m)return parseFloat(m[1].replace(',','.'));
  /* Número puro (FORMATTED_VALUE sem o símbolo %): 0<n<1 = fração; 1..100 = percentual */
  if(!/^\d+(?:[.,]\d+)?$/.test(s))return null;
  var n=parseFloat(s.replace(',','.'));
  if(n>0&&n<1)return Math.round(n*100);
  if(n>=1&&n<=100)return n;
  return null;
}
function ppcFmtD(d){return ('0'+d.getDate()).slice(-2)+'/'+('0'+(d.getMonth()+1)).slice(-2)}

function ppcParseTab(values,title){
  var hdr=-1,cT=1,cE=13,cC=16,cEq=2,cR=3,start=null,label=title,obra='';
  for(var r=0;r<Math.min(values.length,15);r++){
    var row=values[r]||[];
    for(var c=0;c<row.length;c++){
      var n=norm(row[c]);
      if(!n)continue;
      if(n.indexOf('tarefas')===0){hdr=r;cT=c}
      else if(n.indexOf('exec')===0)cE=c;
      else if(n==='causas')cC=c;
      else if(n==='equipe')cEq=c;
      else if(n.indexOf('responsavel')===0)cR=c;
      else if(n.indexOf('obra')===0&&!obra)obra=String(row[c]).replace(/^\s*obra\.?\s*/i,'').trim();
    }
    var mm=row.join(' ').match(/(\d{1,2})\D{1,3}(\d{1,2})\D{1,3}(\d{4})\s*a\s*(\d{1,2})\D{1,3}(\d{1,2})\D{1,3}(\d{4})/i);
    if(mm&&!start){
      var d1=new Date(+mm[3],+mm[2]-1,+mm[1]),d2=new Date(+mm[6],+mm[5]-1,+mm[4]);
      start=d1.getTime();label=ppcFmtD(d1)+' a '+ppcFmtD(d2);
    }
  }
  var tasks=[];
  if(hdr<0)return{title:title,label:label,start:start,tasks:tasks,obra:obra};
  for(var i=hdr+1;i<values.length;i++){
    var row=values[i]||[],next=values[i+1]||[];
    var item=String(row[0]||'').trim(),nome=String(row[cT]||'').trim();
    if(!nome||!item)continue;            /* linha "E" (executado) não tem tarefa/item */
    var pct=ppcPct(row[cE]);
    if(pct===null)pct=ppcPct(row[cE+1]);
    if(pct===null)pct=ppcPct(next[cE]);
    if(pct===null)pct=ppcPct(next[cE+1]);
    var causa=String(row[cC]||next[cC]||'').trim();
    /* marcas nos dias da semana (S T Q Q S S D = 7 colunas antes de EXEC %) */
    var dm=[];for(var dd=0;dd<7;dd++){var tx=String(row[cE-7+dd]||'').trim();if(tx)dm.push({d:dd,txt:tx})}
    tasks.push({item:item,nome:nome,equipe:String(row[cEq]||'').trim(),resp:String(row[cR]||'').trim(),pct:pct===null?0:pct,causa:causa,dias:dm});
  }
  return{title:title,label:label,start:start,end:start!=null?start+6*86400000:null,tasks:tasks,obra:obra};
}

function ppcStats(w){
  var t=w.tasks.length,d=0,sum=0;
  w.tasks.forEach(function(x){if(x.pct>=100)d++;sum+=Math.min(x.pct,100)});
  return{total:t,done:d,open:t-d,pct:t?Math.round(d/t*100):0,avg:t?Math.round(sum/t):0};
}
function ppcColor(p){return p>=80?'var(--green)':p>=60?'var(--amber)':'var(--red)'}
/* Semana virtual "Todo o periodo": soma as tarefas de todas as abas (semana de origem em __wi) */
function ppcAllWeek(){
  var t=[];
  PPC_WEEKS.forEach(function(w,wi){w.tasks.forEach(function(x){var c={};for(var k in x)c[k]=x[k];c.__wi=wi;t.push(c)})});
  if(!t.length)return null;
  var a=PPC_WEEKS[0].label.split(' a ')[0],b=PPC_WEEKS[PPC_WEEKS.length-1].label.split(' a ')[1];
  return{title:'__ALL__',label:a+' a '+b,start:PPC_WEEKS[0].start,end:PPC_WEEKS[PPC_WEEKS.length-1].end,tasks:t,obra:PPC_OBRA};
}
function ppcIsAll(){return PPC_WEEKS.length>0&&PPC_SEL>=PPC_WEEKS.length}
function ppcCurWeek(){if(ppcIsAll())return ppcAllWeek()||PPC_WEEKS[PPC_WEEKS.length-1];return PPC_WEEKS[PPC_SEL]||PPC_WEEKS[PPC_WEEKS.length-1]}

/* Agrupa tarefas iguais entre as semanas: início, há quantos dias rola e término.
   Regra combinada: EXEC 100% na semana mais recente = serviço terminou;
   dias exatos só quando as colunas S/T/Q estiverem marcadas. */
function ppcServices(){
  if(!PPC_WEEKS.length)return[];
  var latestWi=PPC_WEEKS.length-1,curW=PPC_WEEKS[latestWi],all=ppcIsAll();
  var selWi=all?PPC_SEL:((PPC_SEL>=0&&PPC_SEL<PPC_WEEKS.length)?PPC_SEL:latestWi);
  var hoje=new Date();hoje.setHours(0,0,0,0);
  var map={};
  PPC_WEEKS.forEach(function(w,wi){
    w.tasks.forEach(function(t){
      var k=norm(t.nome);if(!k)return;
      if(!map[k])map[k]={nome:t.nome,equipe:t.equipe,resp:t.resp,hist:[],marksByWi:{},causes:[]};
      var s=map[k];
      s.hist.push({wi:wi,label:w.label,start:w.start,pct:t.pct});
      s.marksByWi[wi]=t.dias||[];if(t.causa)s.causes.push({wi:wi,txt:t.causa});
      s.equipe=t.equipe||s.equipe;s.resp=t.resp||s.resp;s.causa=t.causa||s.causa;
    });
  });
  var out=Object.keys(map).map(function(k){
    var s=map[k],first=s.hist[0];
    var selOcc=null;if(all)selOcc=s.hist[s.hist.length-1]||null;else s.hist.forEach(function(x){if(x.wi===selWi)selOcc=x});
    if(!selOcc)return null;              /* lista = apenas os serviços da semana selecionada */
    var inicio=first.start!=null?new Date(first.start):null;
    var dias=inicio?Math.max(1,Math.round((hoje-inicio)/86400000)+1):null;
    var isCur=all?true:selWi===latestWi;
    var status=selOcc.pct>=100?'concluido':(isCur?'andamento':'parado');
    var marks=s.marksByWi[all?latestWi:selWi]||[];
    var fimDia=null;
    if(status==='concluido'&&isCur&&marks.length){fimDia=new Date(curW.start+marks[marks.length-1].d*86400000)}
    /* Dias marcados na grade S/T/Q (ex.: "PREVISTO" na segunda) = dias planejados do serviço */
    var previstos=(isCur&&status!=='concluido')?marks.map(function(m){return new Date(curW.start+m.d*86400000)}).sort(function(a,b){return a-b}):[];
    return{nome:s.nome,equipe:s.equipe,resp:s.resp,causa:s.causa,causas:(s.causes||[]).filter(function(c){return all||c.wi===selWi}),hist:s.hist,inicio:inicio,dias:dias,status:status,lastPct:selOcc.pct,isCur:isCur,fimDia:fimDia,previstos:previstos};
  }).filter(Boolean);
  var peso={andamento:0,concluido:1,parado:2};
  out.sort(function(a,b){return peso[a.status]-peso[b.status]||(b.dias||0)-(a.dias||0)||a.nome.localeCompare(b.nome,'pt-BR')});
  return out;
}

function loadPPC(){
  PPC_STATE='loading';injectPPCCard();
  var base='https://sheets.googleapis.com/v4/spreadsheets/'+PPC_SHEET_ID;
  fetch(base+'?fields=sheets.properties.title&key='+PPC_API_KEY)
  .then(function(r){if(!r.ok)throw new Error('HTTP '+r.status);return r.json()})
  .then(function(meta){
    var titles=(meta.sheets||[]).map(function(s){return s.properties.title});
    var sem=titles.filter(function(t){return norm(t).indexOf('semana')===0});
    if(!sem.length)sem=titles;
    var qs=sem.map(function(t){return 'ranges='+encodeURIComponent("'"+t.replace(/'/g,"''")+"'!A1:Z300")}).join('&');
    return fetch(base+'/values:batchGet?'+qs+'&valueRenderOption=FORMATTED_VALUE&key='+PPC_API_KEY)
      .then(function(r){if(!r.ok)throw new Error('HTTP '+r.status);return r.json()})
      .then(function(d){return{titles:sem,d:d}});
  })
  .then(function(res){
    var weeks=[];
    (res.d.valueRanges||[]).forEach(function(vr,i){
      var w=ppcParseTab(vr.values||[],res.titles[i]);
      if(w.tasks.length)weeks.push(w);
    });
    weeks.sort(function(a,b){return (a.start||0)-(b.start||0)});
    PPC_WEEKS=weeks;
    PPC_OBRA=weeks.length?weeks[0].obra:'';
    var keep=-1;
    if(PPC_SEL_TITLE==='__ALL__')keep=weeks.length;
    weeks.forEach(function(w,i){if(w.title===PPC_SEL_TITLE)keep=i});
    PPC_SEL=keep>=0?keep:weeks.length-1;      /* padrão: semana mais recente */
    if(PPC_SEL>=0&&PPC_SEL<weeks.length)PPC_SEL_TITLE=weeks[PPC_SEL].title;
    PPC_STATE=weeks.length?'ok':'empty';
    injectPPCCard();
    if(G('ppc-modal-overlay')&&G('ppc-modal-overlay').classList.contains('on'))renderPPCModal();
  })
  .catch(function(err){
    PPC_STATE='err';PPC_ERR=err.message||String(err);injectPPCCard();
  });
}


function ppcTitle(n){return String(n||'').toLowerCase().replace(/(^|\s)(\S)/g,function(m,a,b){return a+b.toUpperCase()})}
/* Barras "Serviços por empresa": concluídos/planejados por empresa (coluna RESPONSAVEL/EMP) da semana selecionada */
function renderPPCBars(){
  [['srv-bars','srv-meta'],['rsrv-bars','rsrv-meta']].forEach(function(ids){
    var el=G(ids[0]),meta=G(ids[1]);if(!el||!meta)return;
    if(PPC_STATE!=='ok'){
      el.innerHTML='<div class="em">'+(PPC_STATE==='loading'?'Carregando…':PPC_STATE==='err'?'Erro ao ler a planilha de serviços':'Sem serviços na planilha')+'</div>';
      meta.textContent='';return;
    }
    var w=ppcCurWeek();if(!w)return;var tot={},ok={};
    w.tasks.forEach(function(t){
      var k=ppcTitle(t.resp||t.equipe||'Sem empresa');
      tot[k]=(tot[k]||0)+1;if(t.pct>=100)ok[k]=(ok[k]||0)+1;
    });
    renderBars(ids[0],ids[1],tot,COLORS,ok,'srv');
    meta.textContent=(ppcIsAll()?'Período todo ':'Semana ')+w.label+' · concluídos/planejados';
  });
}
/* Clique na empresa em "Serviços por empresa": lista os serviços dela na semana selecionada */
function openSrvModal(key){
  if(PPC_STATE!=='ok'||!PPC_WEEKS.length)return;
  var w=ppcCurWeek();if(!w)return;
  var nomes={};
  w.tasks.forEach(function(t){
    if(ppcTitle(t.resp||t.equipe||'Sem empresa')===key)nomes[norm(t.nome)]=1;
  });
  var curW=PPC_WEEKS[PPC_WEEKS.length-1];
  var hojeTs=(function(){var h=new Date();h.setHours(0,0,0,0);return h.getTime()})();
  var lista=ppcServices().filter(function(x){return nomes[norm(x.nome)]});
  var feitos=lista.filter(function(x){return x.status==='concluido'}).length;
  var hdr=G('emp-modal-overlay').querySelector('.modal-h');
  hdr.style.background='#7C3AED';
  G('emp-modal-title').textContent='🎯 Serviços — '+key;
  G('emp-modal-sub').textContent=(ppcIsAll()?'Período ':'Semana ')+w.label+' · '+lista.length+' serviço(s) · '+feitos+' concluído(s)';
  var h='<div class="local-summary">'+
    '<div class="local-stat"><b>'+lista.length+'</b><span>Planejados</span></div>'+
    '<div class="local-stat"><b style="color:var(--green)">'+feitos+'</b><span>Concluídos</span></div>'+
    '<div class="local-stat"><b style="color:var(--red)">'+(lista.length-feitos)+'</b><span>Não concluídos</span></div></div>';
  if(!lista.length)h+='<div class="modal-empty">Nenhum serviço encontrado para esta empresa.</div>';
  lista.forEach(function(s){
    var ok=s.status==='concluido',and=s.status==='andamento';
    var dot=ok?'var(--green)':(and?'var(--amber)':'var(--red)');
    var meta='';
    if(s.inicio)meta+='In\u00edcio '+ppcFmtD(s.inicio);
    if(s.dias&&(ok||and))meta+=(meta?' \u00b7 ':'')+'<b>'+s.dias+' dia'+(s.dias>1?'s':'')+'</b>';
    if(ok)meta+=(meta?' \u00b7 ':'')+'\u2713 terminou'+(s.fimDia?' '+ppcFmtD(s.fimDia):'');
    else if(and){
      if(s.previstos&&s.previstos.length){
        var ds=s.previstos.map(function(d){return d.getTime()===hojeTs?'hoje ('+ppcFmtD(d)+')':ppcFmtD(d)});
        meta+=(meta?' \u00b7 ':'')+'previsto: '+(ds.length>1?ds.slice(0,-1).join(', ')+' e '+ds[ds.length-1]:ds[0]);
      }else if(curW.end!=null)meta+=(meta?' \u00b7 ':'')+'termina: previsto '+ppcFmtD(new Date(curW.end));
    }else meta+=(meta?' \u00b7 ':'')+'n\u00e3o conclu\u00edda nesta semana';
    var hist=s.hist.map(function(x){return x.label.split(' a ')[0]+': '+x.pct+'%'}).join(' \u00b7 ');
    h+='<div class="ppc-row"><span class="ppc-dot" style="background:'+dot+'"></span><div><div class="n">'+esc(s.nome)+'</div>'+
      (s.equipe?'<div class="m">'+esc(s.equipe)+'</div>':'')+
      '<div class="ppc-srv-meta">'+meta+'</div>'+(hist?'<div class="ppc-srv-hist">'+esc(hist)+'</div>':'')+
      (s.causa?'<span class="ppc-tag">'+esc(s.causa)+'</span>':'')+'</div>'+
      '<div class="p" style="color:'+dot+'">'+Math.round(s.lastPct)+'%</div></div>';
  });
  G('emp-modal-body').innerHTML=h;
  G('emp-modal-overlay').classList.add('on');
}
function injectPPCCard(){
  renderPPCBars();
  var el=G('kpis');if(!el)return;
  var old=G('ppc-kpi');if(old&&old.parentNode)old.parentNode.removeChild(old);
  var v='—',f='carregando…',c='#7C3AED';
  if(PPC_STATE==='ok'){
    var w=ppcCurWeek(),st=ppcStats(w);
    v=st.pct+'%';f=st.done+' de '+st.total+' tarefas · '+(ppcIsAll()?'todo o período ('+w.label+')':w.label)+' — clique para ver';c=ppcColor(st.pct);
  }else if(PPC_STATE==='empty'){f='sem tarefas na planilha';}
  else if(PPC_STATE==='err'){f='erro ao carregar — clique para detalhes';c='var(--red)';}
  el.insertAdjacentHTML('beforeend','<div id="ppc-kpi" class="kp kp-click" style="--kc:'+c+'" onclick="openPPCModal()" role="button" tabindex="0" title="PPC — Planejamento a Curto Prazo"><div class="ki">🎯</div><div class="kl">PPC semanal</div><div class="kv">'+v+'</div><div class="kf">'+esc(f)+'</div></div>');
}
/* KPI de produtividade: cada unidade é dividida pelos COLABORADORES QUE LANÇARAM AQUela unidade no dia
   (mesma regra dos "pontos" do indicador mensal). Dividir tudo pelo efetivo total distorce o número:
   ex.: só 1 pessoa lançou UN hoje -> 7 un ÷ 1 = 7,0 un/pessoa (e não 7 ÷ 52 = 0,13).
   Clicável -> detalhe por empresa */
function fmt3(v){return v.toLocaleString('pt-BR',{maximumFractionDigits:3})}
function effCalc(d){
  var pess=d.ativos.filter(function(p){return !!p.atividade}).length;
  var agg=computeProducaoDia(d),t=agg.totals;
  var p2=0,p3=0,pu=0;
  agg.producers.forEach(function(pr){
    var comM2=false,comM3=false,comUN=false;
    pr.parsed.forEach(function(u){if(u.unidade==='M2')comM2=true;else if(u.unidade==='M3')comM3=true;else comUN=true});
    if(comM2)p2++;if(comM3)p3++;if(comUN)pu++;
  });
  return{pess:pess,p2:p2,p3:p3,pu:pu,M2:t.M2||0,M3:t.M3||0,UN:t.UN||0,
    r2:p2?(t.M2||0)/p2:0,r3:p3?(t.M3||0)/p3:0,rU:pu?(t.UN||0)/pu:0};
}
/* Média MENSAL: só os demais dias do mesmo mês/ano do dia selecionado em que aquela unidade teve produção */
function effMedias(day){
  var ref=parseDateBR(day&&day.date);
  var acc={r2:[0,0],r3:[0,0],rU:[0,0]};
  (PARSED&&PARSED.days||[]).forEach(function(d){
    if(d===day)return;
    if(ref){var pd=parseDateBR(d.date);if(!pd||pd.m!==ref.m||pd.y!==ref.y)return}
    var c=effCalc(d);if(!c.pess)return;
    ['r2','r3','rU'].forEach(function(k){if(c[k]>0){acc[k][0]+=c[k];acc[k][1]++}});
  });
  return{r2:acc.r2[1]?acc.r2[0]/acc.r2[1]:0,r3:acc.r3[1]?acc.r3[0]/acc.r3[1]:0,rU:acc.rU[1]?acc.rU[0]/acc.rU[1]:0};
}
function effBadge(v,media,txt){
  if(!(media>0&&v>0))return '';
  var dif=(v-media)/media*100,cls=dif>=3?'up':dif<=-3?'dn':'eq';
  return '<span class="kd '+cls+'">'+(dif>=0?'▲ +':'▼ ')+dif.toFixed(0)+'% '+(txt||'vs média')+'</span>';
}
function injectEffCard(day){
  var el=G('kpis');if(!el)return;
  var old=G('eff-kpi');if(old&&old.parentNode)old.parentNode.removeChild(old);
  if(!day||el.classList.contains('kpi-auto'))return;
  var c=effCalc(day),m=effMedias(day);
  function chip(v,un,f){return '<span class="ke'+(v>0?'':' z')+'"><b>'+f(v)+'</b> '+un+'/pessoa</span>'}
  var f=c.pess?fmtNum(c.M2)+' m² ÷ '+c.p2+' · '+fmt3(c.M3)+' m³ ÷ '+c.p3+' · '+fmtNum(c.UN)+' un ÷ '+c.pu+' · '+c.pess+' com atividade':'sem pessoas com atividade';
  el.insertAdjacentHTML('beforeend','<div id="eff-kpi" class="kp kp-click" style="--kc:#0891B2" onclick="openEffModal()" role="button" tabindex="0" title="Produção ÷ colaboradores que lançaram cada unidade — clique para ver por empresa">'+
    '<div class="ki">⚡</div><div class="kl">Produtividade</div>'+
    '<div class="kv">'+fmtNum(c.r2)+' m²/pessoa'+effBadge(c.r2,m.r2,'vs média do mês')+'</div>'+
    '<div class="kes">'+chip(c.r3,'m³',fmt3)+chip(c.rU,'un',fmtNum)+'</div>'+
    '<div class="kf">'+esc(f)+'</div></div>');
}
function openEffModal(){
  var day=getSelectedDay();
  if(!day){toast('Selecione um dia primeiro','warn');return}
  var c=effCalc(day),m=effMedias(day);
  var hdr=G('emp-modal-overlay').querySelector('.modal-h');
  hdr.style.background='#0891B2';
  G('emp-modal-title').textContent='⚡ Produtividade por pessoa';
  G('emp-modal-sub').textContent=day.date+' · '+c.pess+' com atividade · com produção: m² '+c.p2+' · m³ '+c.p3+' · un '+c.pu;
  var body=G('emp-modal-body');
  if(!c.pess){body.innerHTML='<div class="modal-empty">Nenhuma pessoa com atividade neste dia.</div>';G('emp-modal-overlay').classList.add('on');return}
  /* por empresa */
  var by={};
  day.ativos.forEach(function(p){
    if(!p.atividade)return;
    var e=by[p.empresa]||(by[p.empresa]={n:p.empresa,pess:0,p2:0,p3:0,pu:0,M2:0,M3:0,UN:0});e.pess++;
  });
  computeProducaoDia(day).producers.forEach(function(pr){
    var e=by[pr.p.empresa];if(!e)return;
    var comM2=false,comM3=false,comUN=false;
    pr.parsed.forEach(function(u){e[u.unidade]+=u.valor;if(u.unidade==='M2')comM2=true;else if(u.unidade==='M3')comM3=true;else comUN=true});
    if(comM2)e.p2++;if(comM3)e.p3++;if(comUN)e.pu++;
  });
  var rows=Object.keys(by).map(function(k){return by[k]}).sort(function(a,b){return b.M2-a.M2||b.pess-a.pess});
  function stat(v,l,med,f,un){return '<div class="local-stat"><b>'+f(v)+'</b><span>'+l+'</span>'+(med>0?'<span style="display:block;margin-top:3px;text-transform:none">média do mês '+f(med)+' '+un+'</span>':'')+'</div>'}
  var h='<div class="local-summary">'+
    stat(c.r2,'m² / colaborador',m.r2,fmtNum,'m²')+stat(c.r3,'m³ / colaborador',m.r3,fmt3,'m³')+stat(c.rU,'un / colaborador',m.rU,fmtNum,'un')+'</div>';
  var th='padding:8px 10px;background:#E0F7FA;color:#0E7490;font-family:JetBrains Mono;font-size:9px;text-transform:uppercase;letter-spacing:.04em;text-align:right';
  var td='padding:8px 10px;border-bottom:1px solid #E0F7FA;text-align:right';
  function r(v,f){return v>0?f(v):'—'}
  h+='<table class="people-modal-table" style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr>'+
    '<th style="'+th+';text-align:left">Empresa</th><th style="'+th+'">Pessoas</th>'+
    '<th style="'+th+'">m²</th><th style="'+th+'">m²/colab.</th><th style="'+th+'">m³</th><th style="'+th+'">m³/colab.</th><th style="'+th+'">UN</th><th style="'+th+'">UN/colab.</th></tr></thead><tbody>'+
    rows.map(function(e,i){
      var bg=i%2===0?'#fff':'#F8FAFC';
      return '<tr style="background:'+bg+'"><td data-label="Empresa" style="'+td+';text-align:left"><span class="badge badge-gray">'+esc(e.n)+'</span></td>'+
        '<td data-label="Pessoas" style="'+td+'">'+e.pess+'</td>'+
        '<td data-label="m²" style="'+td+'">'+r(e.M2,fmtNum)+'</td><td data-label="m²/colab." style="'+td+';font-weight:700;color:#0E7490" title="'+e.p2+' colaborador(es) com m²">'+r(e.p2?e.M2/e.p2:0,fmtNum)+'</td>'+
        '<td data-label="m³" style="'+td+'">'+r(e.M3,fmt3)+'</td><td data-label="m³/colab." style="'+td+';font-weight:700;color:#D97706" title="'+e.p3+' colaborador(es) com m³">'+r(e.p3?e.M3/e.p3:0,fmt3)+'</td>'+
        '<td data-label="UN" style="'+td+'">'+r(e.UN,fmtNum)+'</td><td data-label="UN/colab." style="'+td+';font-weight:700;color:#7C3AED" title="'+e.pu+' colaborador(es) com UN">'+r(e.pu?e.UN/e.pu:0,fmtNum)+'</td></tr>';
    }).join('')+
    '<tr><td style="'+td+';text-align:left;font-weight:700;color:#0E7490">TOTAL</td><td style="'+td+';font-weight:700">'+c.pess+'</td>'+
    '<td style="'+td+';font-weight:700">'+fmtNum(c.M2)+'</td><td style="'+td+';font-weight:700">'+fmtNum(c.r2)+'</td>'+
    '<td style="'+td+';font-weight:700">'+fmt3(c.M3)+'</td><td style="'+td+';font-weight:700">'+fmt3(c.r3)+'</td>'+
    '<td style="'+td+';font-weight:700">'+fmtNum(c.UN)+'</td><td style="'+td+';font-weight:700">'+fmtNum(c.rU)+'</td></tr></tbody></table>'+
    '<div style="margin-top:10px;font-size:10px;color:var(--ink3)">Divisor: colaboradores que lançaram aquela unidade no dia (m²: '+c.p2+' · m³: '+c.p3+' · un: '+c.pu+'), mesma regra dos "pontos" do indicador mensal — faltosos e férias ficam de fora. A média é MENSAL: compara com os demais dias do mesmo mês em que a unidade teve produção.</div>';
  body.innerHTML=h;
  G('emp-modal-overlay').classList.add('on');
}
/* mantém o card PPC sempre presente quando a linha de KPIs é redesenhada */
/* Painel "Produção por empresa" sobe para a célula livre ao lado do card PPC (desktop/dia);
   volta para #prod-emp-home no mobile e no modo período */
var _prodPanelEl=null;
function injectProdEmpresaPanel(){
  var el=G('kpis');
  if(!_prodPanelEl)_prodPanelEl=G('single-prod-empresa-card');
  if(!el||!_prodPanelEl)return;
  var home=G('prod-emp-home');
  var want=VIEW_MODE==='single'&&window.matchMedia('(min-width:901px)').matches&&!el.classList.contains('kpi-auto');
  if(want){
    var ppc=G('ppc-kpi');
    var okPos=ppc?ppc.nextElementSibling===_prodPanelEl:_prodPanelEl.parentNode===el;
    if(!okPos)el.insertBefore(_prodPanelEl,ppc?ppc.nextSibling:null);
  }else if(home&&_prodPanelEl.parentNode!==home)home.appendChild(_prodPanelEl);
}
(function(){
  var _k=renderKPIs,_rk=renderRangeKPIs;
  renderKPIs=function(day){_k(day);injectPPCCard();injectEffCard(day);injectProdEmpresaPanel()};
  renderRangeKPIs=function(days,agg){_rk(days,agg);injectPPCCard();injectProdEmpresaPanel()};
})();

function ppcSelectWeek(i){
  if(i>=PPC_WEEKS.length){PPC_SEL=PPC_WEEKS.length;PPC_SEL_TITLE='__ALL__'}
  else{PPC_SEL=i;PPC_SEL_TITLE=PPC_WEEKS[i].title}
  renderPPCModal();injectPPCCard();
}
function openPPCModal(){G('ppc-modal-overlay').classList.add('on');renderPPCModal()}
function closePPCModal(){var el=G('ppc-modal-overlay');if(el)el.classList.remove('on')}

/* Bloco PPC para os relatórios impressos (dia e período). Retorna '' se não houver dados. */
function ppcPrintHTML(){
  if(PPC_STATE!=='ok'||!PPC_WEEKS.length)return '';
  var w=ppcCurWeek(),st=ppcStats(w);
  if(!w.tasks.length)return '';
  var corPPC=st.pct>=80?'#16A34A':st.pct>=60?'#D97706':'#DC2626';
  var h='<div class="ppc-print-block">';
  h+='<div class="ppc-print-title">\uD83C\uDFAF PPC \u2014 Planejamento a Curto Prazo \u00b7 '+(ppcIsAll()?'Período ':'Semana ')+esc(w.label)+(PPC_OBRA?' \u00b7 '+esc(PPC_OBRA):'')+'</div>';
  h+='<div class="ppc-print-sum">'+
    '<div><span>PPC</span><b style="color:'+corPPC+'">'+st.pct+'%</b></div>'+
    '<div><span>Planejadas</span><b>'+st.total+'</b></div>'+
    '<div><span>Conclu\u00eddas</span><b>'+st.done+'</b></div>'+
    '<div><span>N\u00e3o conclu\u00eddas</span><b>'+st.open+'</b></div>'+
    '<div><span>Exec. m\u00e9dia</span><b>'+st.avg+'%</b></div></div>';
  var cz={};w.tasks.forEach(function(t){if(t.causa)cz[t.causa]=(cz[t.causa]||0)+1});
  var ck=Object.keys(cz);
  if(ck.length)h+='<div class="ppc-print-causas"><b>Causas:</b> '+ck.map(function(k){return esc(k)+' ('+cz[k]+')'}).join(' \u00b7 ')+'</div>';
  h+='<table class="ppc-print-table">'+
    '<colgroup><col style="width:5%"><col style="width:36%"><col style="width:12%"><col style="width:17%"><col style="width:9%"><col style="width:21%"></colgroup>'+
    '<thead><tr><th>Item</th><th>Tarefa</th><th>Equipe</th><th>Respons\u00e1vel</th><th>Exec %</th><th>Causa</th></tr></thead><tbody>';
  var list=w.tasks.slice().sort(function(a,b){return (a.pct>=100)-(b.pct>=100)});
  list.forEach(function(t,i){
    var ok=t.pct>=100;
    h+='<tr><td>'+(i+1)+'</td><td>'+esc(t.nome)+'</td><td>'+esc(t.equipe||'\u2014')+'</td><td>'+esc(t.resp||'\u2014')+'</td><td style="text-align:right;font-weight:700;color:'+(ok?'#16A34A':'#DC2626')+'">'+Math.round(t.pct)+'%</td><td>'+esc(t.causa||'\u2014')+'</td></tr>';
  });
  h+='</tbody></table></div>';
  return h;
}

function renderPPCModal(){
  var body=G('ppc-modal-body'),sub=G('ppc-modal-sub');
  if(PPC_STATE!=='ok'){
    sub.textContent='';
    body.innerHTML='<div class="em">'+(PPC_STATE==='loading'?'Carregando planilha…':PPC_STATE==='err'?'Não foi possível ler a planilha ('+esc(PPC_ERR)+').<br>Verifique se ela está compartilhada como "qualquer pessoa com o link" e clique em Atualizar.':'Nenhuma tarefa encontrada nas abas da planilha.')+'</div>';
    return;
  }
  var all=ppcIsAll(),w=ppcCurWeek(),st=ppcStats(w);
  sub.textContent=(PPC_OBRA?PPC_OBRA+' · ':'')+(all?'Período todo · ':'Semana ')+w.label;
  var h='<div class="ppc-chips">'+PPC_WEEKS.map(function(x,i){
    return '<button class="ppc-chip'+(i===PPC_SEL?' sel':'')+'" onclick="ppcSelectWeek('+i+')">'+esc(x.label)+' · '+ppcStats(x).pct+'%</button>';
  }).join('')+'<button class="ppc-chip'+(all?' sel':'')+'" onclick="ppcSelectWeek('+PPC_WEEKS.length+')" title="Todas as semanas somadas">📅 Todo o período</button></div>';
  if(PPC_WEEKS.length>1){
    var wA=ppcAllWeek(),stA=wA?ppcStats(wA):{pct:0};
    h+='<div class="ppc-trend">'+PPC_WEEKS.map(function(x,i){var stx=ppcStats(x);return '<div class="ppc-trend-col'+(i===PPC_SEL?' sel':'')+'" onclick="ppcSelectWeek('+i+')" title="'+esc(x.label)+' \u00b7 '+stx.pct+'%"><i style="height:'+Math.max(stx.pct,4)+'%;background:'+ppcColor(stx.pct)+'"></i><span>'+stx.pct+'%</span></div>'}).join('')+'<div class="ppc-trend-col all'+(all?' sel':'')+'" onclick="ppcSelectWeek('+PPC_WEEKS.length+')" title="Todo o período \u00b7 '+stA.pct+'%"><i style="height:'+Math.max(stA.pct,4)+'%;background:'+ppcColor(stA.pct)+'"></i><span>'+stA.pct+'%</span></div></div>';
  }
  h+='<div class="ppc-sum">'
    +'<div><div class="l">PPC</div><div class="v" style="color:'+ppcColor(st.pct)+'">'+st.pct+'%</div></div>'
    +'<div><div class="l">Planejadas</div><div class="v">'+st.total+'</div></div>'
    +'<div><div class="l">Concluídas</div><div class="v" style="color:var(--green)">'+st.done+'</div></div>'
    +'<div><div class="l">Não concluídas</div><div class="v" style="color:var(--red)">'+st.open+'</div></div>'
    +'<div><div class="l">Exec. média</div><div class="v">'+st.avg+'%</div></div></div>';
  /* causas */
  var cz={};w.tasks.forEach(function(t){if(t.causa)cz[t.causa]=(cz[t.causa]||0)+1});
  var keys=Object.keys(cz).sort(function(a,b){return cz[b]-cz[a]});
  if(keys.length){
    var mx=cz[keys[0]];
    h+='<div class="ppc-h">'+(all?'Causas registradas no período':'Causas registradas')+'</div>'+keys.map(function(k){
      return '<div class="ppc-cz"><span>'+esc(k)+'</span><div class="ppc-bar"><i style="width:'+Math.round(cz[k]/mx*100)+'%"></i></div><b>'+cz[k]+'</b></div>';
    }).join('');
  }
  /* Acompanamento por serviço: início, dias rolando e término (100% = terminou) */
  var srvs=ppcServices(),curW=PPC_WEEKS[PPC_WEEKS.length-1];
  var hojeTs=(function(){var h=new Date();h.setHours(0,0,0,0);return h.getTime()})();
  /* Faltas de TODO o periodo: comparacao previsto x executado —
     toda tarefa planejada em qualquer semana que nao chegou a 100%. Falta e falta, sem codigo de cores. */
  if(all){
    var fts=[];
    PPC_WEEKS.forEach(function(wk,wi){wk.tasks.forEach(function(t){if(t.pct<100)fts.push({wi:wi,t:t})})});
    h+='<div class="ppc-h">Faltas do período todo — '+fts.length+' ocorrência(s)</div>';
    h+='<div style="font-size:11px;color:var(--ink2);margin:-2px 0 8px">tudo que ficou planejado e não chegou a 100% (previsto × executado)</div>';
    if(!fts.length)h+='<div class="em">Nenhuma falta registrada no período.</div>';
    fts.forEach(function(f){
      var t=f.t,wk=PPC_WEEKS[f.wi];
      h+='<div class="ppc-row"><span class="ppc-dot" style="background:var(--red)"></span><div><div class="n">'+esc(t.nome)+'</div>'+
        '<div class="m">'+esc(['Semana '+wk.label,t.equipe,t.resp].filter(Boolean).join(' · '))+'</div>'+
        (t.causa?'<span class="ppc-tag">'+esc(t.causa)+'</span>':'')+'</div>'+
        '<div class="p" style="color:var(--red)">'+Math.round(t.pct)+'%</div></div>';
    });
  }
  h+='<div class="ppc-h">'+(all?'Todos os serviços do período ('+srvs.length+') — situação mais recente':'Serviços da semana '+esc((PPC_WEEKS[PPC_SEL]||curW).label)+' — há quantos dias rolam')+'</div>';
  if(!srvs.length){h+='<div class="em">Nenhum serviço encontrado nas abas da planilha.</div>'}
  srvs.forEach(function(s){
    var ok=s.status==='concluido',and=s.status==='andamento';
    var dot=ok?'var(--green)':(and?'var(--amber)':'var(--red)');
    var meta='';
    if(s.inicio)meta+='In\u00edcio '+ppcFmtD(s.inicio);
    if(s.dias&&(ok||and))meta+=(meta?' \u00b7 ':'')+'<b>'+s.dias+' dia'+(s.dias>1?'s':'')+'</b>';
    if(ok)meta+=(meta?' \u00b7 ':'')+'\u2713 terminou'+(s.fimDia?' '+ppcFmtD(s.fimDia):'');
    else if(and){
      if(s.previstos&&s.previstos.length){
        var ds=s.previstos.map(function(d){return d.getTime()===hojeTs?'hoje ('+ppcFmtD(d)+')':ppcFmtD(d)});
        meta+=(meta?' \u00b7 ':'')+'previsto: '+(ds.length>1?ds.slice(0,-1).join(', ')+' e '+ds[ds.length-1]:ds[0]);
      }else if(curW.end!=null)meta+=(meta?' \u00b7 ':'')+'termina: previsto '+ppcFmtD(new Date(curW.end));
    }
    else if(!and)meta+=(meta?' \u00b7 ':'')+'n\u00e3o conclu\u00edda nesta semana';
    var hist=s.hist.map(function(x){return x.label.split(' a ')[0]+': '+x.pct+'%'}).join(' \u00b7 ');
    h+='<div class="ppc-row"><span class="ppc-dot" style="background:'+dot+'"></span><div><div class="n">'+esc(s.nome)+'</div><div class="m">'+esc([s.equipe,s.resp].filter(Boolean).join(' \u00b7 '))+'</div>'+
      '<div class="ppc-srv-meta">'+meta+'</div>'+(hist?'<div class="ppc-srv-hist">'+esc(hist)+'</div>':'')+'</div>'+
      ((s.causas&&s.causas.length)?'<div style="margin-top:4px">'+s.causas.map(function(c){return '<span class="ppc-tag'+(all?' ppc-tag-wk':'')+'">'+(all?'<i>'+esc(PPC_WEEKS[c.wi].label.split(' a ')[0])+'</i>':'')+esc(c.txt)+'</span>'}).join('')+'</div>':'')+
      '<div class="p" style="color:'+dot+'">'+Math.round(s.lastPct)+'%</div></div>';
  });
  body.innerHTML=h;
}

/* ═══════ DATA LOADING ═══════ */
function doLoad(){
  /* Reinicia o timer do auto-refresh sempre que houver carga (manual ou silenciosa) */
  _scheduleNext();
  loadPPC();
  var btn=G('btn-reload');
  btn.classList.add('spin');
  setChip('warn','carregando');
  G('err-box').innerHTML='';
  var API_KEY='AIzaSyBcTj7dlJDeCjnNjy5ZHVgJ1_NeQNEhw7M';
  var attempt=0;
  function tryLoad(){
    attempt++;
    fetch('https://sheets.googleapis.com/v4/spreadsheets/'+SHEET_ID+'?fields=sheets.properties&key='+API_KEY)
    .then(function(r){if(!r.ok)throw new Error('HTTP '+r.status);return r.json()})
    .then(function(meta){
      var sheets=meta.sheets||[],name=null;
      for(var i=0;i<sheets.length;i++){if(String(sheets[i].properties.sheetId)===String(SHEET_GID)){name=sheets[i].properties.title;break}}
      if(!name)name=(sheets[0]||{properties:{}}).properties.title||'Sheet1';
      var range=encodeURIComponent(name+'!A1:Z10000');
      return fetch('https://sheets.googleapis.com/v4/spreadsheets/'+SHEET_ID+'/values/'+range+'?valueRenderOption=FORMATTED_VALUE&key='+API_KEY);
    })
    .then(function(r){if(!r.ok)throw new Error('HTTP '+r.status);return r.json()})
    .then(function(data){
      btn.classList.remove('spin');
      if(!data.values||data.values.length<2)throw new Error('Planilha vazia');
      PARSED=parseData(data.values);
      setChip('ok','online');
      toast('Carregado \u2014 '+(data.values.length-1)+' linhas','ok');
      G('sub-info').textContent='Sheets API \u00b7 '+(data.values.length-1)+' linhas';
      renderAll();
    })
    .catch(function(err){
      if(attempt<2){setTimeout(tryLoad,2000);return;}
      btn.classList.remove('spin');
      setChip('err','erro');
      G('err-box').innerHTML='<div class="err-box"><b>Erro: '+esc(err.message)+'</b><br>Clique em Atualizar para tentar novamente.</div>';
      toast('Erro ao carregar','err');
    });
  }
  tryLoad();
}

setInterval(function(){G('clk').textContent=new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})},1000);

/* ═══════════════════════════════════════════════════════════════════
   AUTO-REFRESH SILENCIOSO
   - Recarrega os dados a cada AUTO_INTERVAL_MS (5 min por padrão)
   - Não reseta filtros, não pisca a tela — só atualiza os dados
   - Pausa enquanto a aba está em segundo plano (visibilitychange)
   - Mostra contador regressivo discreto ao lado do relógio
   ═══════════════════════════════════════════════════════════════════ */
var AUTO_INTERVAL_MS = 5 * 60 * 1000; /* 5 minutos */
var _autoTimer   = null;
var _nextReload  = 0;
var _countTick   = null;

function _scheduleNext(){
  clearTimeout(_autoTimer);
  clearInterval(_countTick);
  _nextReload = Date.now() + AUTO_INTERVAL_MS;

  _autoTimer = setTimeout(function(){
    if(document.hidden){ /* aba em segundo plano — adia 30 s e tenta de novo */
      _autoTimer = setTimeout(function(){doLoad()}, 30000);
    } else {
      doLoad();
    }
  }, AUTO_INTERVAL_MS);

  _countTick = setInterval(function(){
    var rem = Math.max(0, Math.round((_nextReload - Date.now()) / 1000));
    var mm  = String(Math.floor(rem / 60)).padStart(2,'0');
    var ss  = String(rem % 60).padStart(2,'0');
    var clkEl = G('auto-countdown');
    if(clkEl) clkEl.textContent = mm+':'+ss;
  }, 1000);
}

/* retoma ao voltar para a aba */
document.addEventListener('visibilitychange', function(){
  if(!document.hidden && _nextReload && Date.now() >= _nextReload){
    doLoad();
  }
});

window.addEventListener('load', function(){
  doLoad();
});


'use strict';
const ICONS={grid:'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',list:'<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>',flow:'<rect x="9" y="2" width="6" height="5" rx="1"/><rect x="2" y="17" width="6" height="5" rx="1"/><rect x="16" y="17" width="6" height="5" rx="1"/><path d="M12 7v5H5v5m7-5h7v5"/>',clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',help:'<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 0 1 5 0c0 2-2.5 2-2.5 4M12 17h.01"/>',users:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m20 0v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/><circle cx="9" cy="7" r="4"/>',shield:'<path d="M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6l-8-3Z"/><path d="m8 12 3 3 5-6"/>',arrow:'<path d="M5 12h14m-5-5 5 5-5 5"/>',chevron:'<path d="m9 5 7 7-7 7"/>',search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',check:'<path d="m5 12 4 4L19 6"/>',checkcircle:'<circle cx="12" cy="12" r="9"/><path d="m7 12 3 3 7-7"/>',inbox:'<path d="M4 5h16l2 12v3H2v-3L4 5Z"/><path d="M2 15h6l2 3h4l2-3h6"/>',send:'<path d="m22 2-7 20-4-9-9-4 20-7Zm0 0L11 13"/>',transfer:'<path d="M3 7h17m-4-4 4 4-4 4M21 17H4m4-4-4 4 4 4"/>',download:'<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',plus:'<path d="M12 5v14M5 12h14"/>',close:'<path d="m6 6 12 12M6 18 18 6"/>',pin:'<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',building:'<path d="M4 21V3h12v18M16 9h4v12M2 21h20M8 7h4M8 11h4M8 15h4M9 21v-3h2v3"/>',message:'<path d="M21 15a4 4 0 0 1-4 4H7l-5 3V6a4 4 0 0 1 4-4h11a4 4 0 0 1 4 4v9Z"/><path d="M6 7h11M6 11h8"/>',file:'<path d="M14 2H5v20h14V7l-5-5ZM14 2v6h5M8 12h8M8 16h6"/>',menu:'<path d="M4 6h16M4 12h16M4 18h16"/>',refresh:'<path d="M20 7v5h-5M4 17v-5h5"/><path d="M6 7a7 7 0 0 1 12-2l2 3M4 16l2 3a7 7 0 0 0 12-2"/>',external:'<path d="M14 3h7v7m-9 2 9-9M10 3H3v18h18v-7"/>',info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/>'};
const icon=(name,size=18)=>`<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]||ICONS.file}</svg>`;
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const STORAGE_KEY='heneng.jingshe.prototype.v1';
const STATES=['待接收','办理中','已办结'];
const STATE_CLASS={'待接收':'receive','办理中':'doing','已办结':'closed'};
const CATEGORIES=['咨询求助','邻里纠纷','治安相关','环境卫生','公共设施','其他事项'];
const DEPTS={police:'公安受理岗',community1:'社区一',community2:'社区二'};
const SHORT_DEPTS={police:'公安',community1:'社区一',community2:'社区二'};
const atAgo=hours=>new Date(Date.now()-hours*3600000).toISOString();
const dateFmt=(value,full=false)=>new Date(value).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',...(full?{year:'numeric'}:{})}).replaceAll('/','-');
const dateOnly=value=>new Date(value).toLocaleDateString('zh-CN',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).replaceAll('/','-');
const badge=state=>`<span class="status ${STATE_CLASS[state]||''}">${esc(state)}</span>`;
let storageAvailable=true,toastTimer;
function seedData(){
 const seeds=[
 ['SL-K8Q2M6','楼道照明故障，请协调维修','公共设施','社区一','和悦小区 3 号楼','楼道二层和三层的照明灯损坏，夜间上下楼不方便，希望协调检查并维修。','待接收','property1',.5,'林女士',true],
 ['SL-P4N7W2','小区停车通道被占用','邻里纠纷','社区二','锦和小区北侧通道','近期通道经常有车辆停放，影响居民进出，希望了解应该如何协调处理。','待接收','community2',1.2,'居民',false],
 ['SL-B6R3T9','咨询居住登记办理方式','咨询求助','社区一','社区一服务范围','想咨询居住登记需要准备哪些材料，以及可以在哪里办理。','待接收','police',2.1,'周先生',true],
 ['SL-H2D8V5','公共健身器材松动','公共设施','社区一','和悦小区活动广场','广场上的一处健身器材出现松动，请协助联系负责人员检查。','待接收','community1',3.5,'居民',false],
 ['SL-F7L9C3','共享区域杂物堆放','环境卫生','社区二','锦和小区 2 号楼','楼道公共区域堆放了一些杂物，通行不太方便，希望社区帮助协调清理。','待接收','property2',5,'居民',false],
 ['SL-M5S2J8','晚间装修噪声协调','邻里纠纷','社区一','和悦小区 5 号楼','邻居近期晚间装修声音较大，希望帮助沟通合理的施工时间。','办理中','police',22,'居民',false],
 ['SL-W3K6N4','小区绿化带垃圾清理','环境卫生','社区一','和悦小区南侧绿化带','绿化带内有堆积垃圾，希望协助联系物业安排清理。','办理中','property1',25,'居民',false],
 ['SL-R9H4B7','公共区域照明检修','公共设施','社区二','锦和小区西侧步道','步道照明有几处不亮，希望尽快安排检修。','办理中','community2',29,'居民',false],
 ['SL-C2V7P5','便民服务事项咨询','咨询求助','社区一','社区一服务站','想了解社区便民服务的办理时间和具体地点。','办理中','community1',48,'居民',false],
 ['SL-J6T3F9','活动场地设施维护','公共设施','社区二','锦和小区公共活动区','活动场地的一处座椅损坏，希望协调修复。','已办结','property2',51,'居民',false],
 ['SL-N8B5D2','社区服务地点咨询','咨询求助','社区一','社区一服务范围','想确认社区便民服务的具体位置。','已办结','police',72,'吴女士',true],
 ['SL-V4M9R6','公共区域清洁协调','环境卫生','社区二','锦和小区公共区域','希望协助改善公共区域清洁情况。','已办结','community2',96,'居民',false]
 ];
 const names={police:'东三路派出所',community1:'社区一',community2:'社区二',property1:'和悦物业服务中心',property2:'锦和物业服务中心'};
 const records=seeds.map((x)=>{
  const [id,title,initialCategory,community,location,description,status,owner,age,submitter,mine]=x;
  const category=status==='待接收'?'待分类':initialCategory;
  const createdAt=atAgo(age), logs=[{at:createdAt,actor:'群众',action:'提交诉求',detail:`群众选择上报至${names[owner]}，由该单位直接接收、分类并办理。`}];
  const dt=f=>new Date(Date.parse(createdAt)+age*3600000*f).toISOString();
  if(status!=='待接收'){
   logs.push({at:dt(.25),actor:names[owner],action:'接收并分类',detail:`本单位已接收，问题类型：${category}。`});
   logs.push({at:dt(.45),actor:names[owner],action:'办理记录',detail:category==='咨询求助'?'已了解诉求内容，正在核实相关办理信息。':'已了解现场情况，正在安排工作人员处理。'});
  }
  const result=status==='已办结'?(category==='咨询求助'?'已就咨询事项作出说明，告知相应办理地点及办理方式。':'已安排人员完成处理，并核实现场情况。'):'';
  if(status==='已办结')logs.push({at:dt(.9),actor:names[owner],action:'反馈结果并办结',detail:result});
  return{id,title,category,community,location,description,status,owner,receiverId:owner,recipientType:owner.startsWith('property')?'property':owner==='police'?'police':'community',createdAt,updatedAt:logs.at(-1).at,submitter,createdBy:mine?'resident-local':'sample',source:'扫码入口',participants:[owner],result,publicResult:result,logs};
 });
 return {version:1,records};
}
function heading(title,description,actions='',eyebrow='SERVICE WORKSPACE'){return `<div class="page-heading"><div><div class="eyebrow">${eyebrow}</div><h1>${title}</h1><p>${description}</p></div><div class="page-actions">${actions}</div></div>`;}
function overviewView(){
 const records=visibleRecords(), own=records.filter(activeForRole);
 const configs=[['全部','list','blue','当前岗位可见的全部事项'],['待接收','inbox','purple','由所选单位接收并分类'],['办理中','clock','amber','承办单位正在处理'],['已办结','checkcircle','teal','本单位已反馈结果并办结']];
 const list=records.filter(r=>r.status!=='已办结'&&activeForRole(r)&&(ui.dashFilter==='全部'||r.status===ui.dashFilter)).sort((a,b)=>Date.parse(b.updatedAt)-Date.parse(a.updatedAt));
 const logs=latestIssueLogs(records).slice(0,4);
 const cats=CATEGORIES.map(c=>({name:c,n:records.filter(r=>r.category===c).length})).filter(c=>c.n).sort((a,b)=>b.n-a.n);const max=Math.max(1,...cats.map(c=>c.n));
 const actions=ui.role!=='police'?communitySelect():`<button class="btn" data-nav="workflow">${icon('flow',15)}业务逻辑</button><button class="btn primary" data-role="resident">${icon('plus',15)}群众入口</button>`;
 return `${heading(ui.staffId==='admin'?'诉求办理总览':({police:'公安办理工作台',community:'社区办理工作台',property:'物业办理工作台'}[ui.role]||'诉求办理工作台'),'群众选择接收单位，承办单位直接分类、办理、反馈并办结。',actions)}<div class="stats">${configs.map(([state,ico,color,note])=>{let n=state==='全部'?records.length:records.filter(r=>r.status===state).length;return `<button class="stat" data-status="${state}" aria-label="查看${state}事项，共${n}件"><div class="stat-top"><span>${state==='全部'?'事项总量':state}</span><span class="stat-icon bg-${color} ${color}">${icon(ico,18)}</span></div><div class="stat-num">${n}<span style="font-size:11px;font-weight:400;color:#9ba9ba;margin-left:7px">件</span></div><div class="stat-note">${note}</div><span class="stat-accent bg-${color}"></span></button>`;}).join('')}</div><div class="dashboard-grid"><section class="panel"><div class="panel-head"><div><div class="panel-title"><span class="dot"></span><h2>当前待办</h2></div><p class="panel-sub">当前单位负责的未办结事项 · 按最近办理时间排序</p></div><button class="text-btn" data-nav="cases">全部事项 ${icon('chevron',14)}</button></div><div class="mini-tabs" aria-label="待办筛选">${['全部','待接收','办理中'].map(s=>`<button class="${ui.dashFilter===s?'active':''}" data-dash-filter="${s}">${s==='全部'?'全部待办':s}<span class="tiny-num">${records.filter(r=>r.status!=='已办结'&&activeForRole(r)&&(s==='全部'||r.status===s)).length}</span></button>`).join('')}</div>${caseTable(list.slice(0,6),true)}<div class="panel-bottom"><span>当前共 ${list.length} 件待办${list.length>6?'，展示最近 6 件':''}</span><button class="text-btn" data-nav="cases">进入诉求台账 ${icon('arrow',14)}</button></div></section><aside class="side-stack"><section class="panel"><div class="panel-head"><div class="panel-title"><span class="dot"></span><h2>事项分布</h2></div><span class="badge-inline">全部记录</span></div><div class="total-caption">已受理 <strong>${records.length}</strong> 件 · 已办结 <strong>${records.filter(r=>r.status==='已办结').length}</strong> 件</div><div class="panel-body">${cats.map((c,i)=>`<div class="category-row"><div class="bar-label"><span>${esc(c.name)}</span><span>${c.n} 件</span></div><div class="bar-track"><div class="bar-fill" style="width:${c.n/max*100}%;background:${['#4c88d7','#56a8b1','#84a7d7','#9aaac7','#a1b9d8'][i%5]}"></div></div></div>`).join('')}</div></section><section class="panel"><div class="panel-head"><div class="panel-title"><span class="dot"></span><h2>最新流转</h2></div><button class="text-btn" data-nav="logs">更多</button></div><div class="panel-body">${logs.map(l=>`<div class="timeline-brief"><span class="timeline-dot"></span><div><div class="timeline-title">${esc(l.actor)} · ${esc(l.action)}</div><button class="text-btn" style="font-size:10px;padding:0" data-case="${l.id}">${esc(l.title.length>16?l.title.slice(0,16)+'…':l.title)}</button><div class="timeline-time">${dateFmt(l.at)}</div></div></div>`).join('')||'<p class="panel-sub">暂无流转记录</p>'}</div></section></aside></div>`;
}
function caseTable(records,compact=false){if(!records.length)return `<div class="empty">${icon('inbox',36)}<h3>暂无符合条件的事项</h3><p>可以调整筛选条件，或从群众服务入口提交一条诉求。</p></div>`;return `<div class="table-wrap"><table><thead><tr><th>诉求事项</th><th>发生区域</th>${compact?'':'<th>当前办理方</th>'}<th>办理状态</th><th>更新时间</th><th style="text-align:right">操作</th></tr></thead><tbody>${records.map(r=>`<tr><td><button class="case-title" data-case="${r.id}" title="${esc(r.title)}">${esc(r.title)}</button><div class="case-meta"><span>${r.id}</span><span class="sep"></span><span>${esc(r.category)}</span></div></td><td style="white-space:nowrap">${esc(r.community)}</td>${compact?'':`<td style="white-space:nowrap">${esc(orgName(r.owner))}</td>`}<td>${badge(r.status)}</td><td style="white-space:nowrap;font-size:11px;color:#8a98ac">${dateFmt(r.updatedAt)}</td><td style="text-align:right"><button class="text-btn" data-case="${r.id}" aria-label="查看${esc(r.title)}">查看 ${icon('chevron',12)}</button></td></tr>`).join('')}</tbody></table></div>`;}
function latestIssueLogs(records){
 return records.map(r=>{
  const entries=(r.logs||[]).map((l,i)=>({...l,_order:i}));
  entries.sort((a,b)=>(Date.parse(b.at)||0)-(Date.parse(a.at)||0)||b._order-a._order);
  const l=entries[0]||{at:r.updatedAt||r.createdAt,actor:orgName(r.owner),action:'暂无办理记录',detail:'打开事项查看详情。'};
  return{...l,id:r.id,title:r.title,status:r.status,owner:r.owner,category:r.category,logCount:entries.length};
 }).sort((a,b)=>(Date.parse(b.at)||0)-(Date.parse(a.at)||0)||String(a.id).localeCompare(String(b.id)));
}
function logsView(){
 const logs=latestIssueLogs(visibleRecords());
 return `${heading('流转记录','每个事项仅显示一条最新动态；点击事项查看完整办理时间轴。',ui.role!=='police'?communitySelect():'')}<section class="panel"><div class="panel-head"><div class="panel-title"><span class="dot"></span><h2>事项最新动态</h2></div><span class="panel-sub">共 ${logs.length} 个事项 · 按最新流转时间排序</span></div><div class="log-list">${logs.map(l=>`<div class="log-row" data-log-issue="${esc(l.id)}"><time>${dateFmt(l.at,true)}</time><span class="log-action">${esc(l.action)}</span><div class="log-main"><button class="case-title" style="max-width:100%" data-case="${esc(l.id)}">${esc(l.title)}</button><div class="case-meta log-meta"><span>${esc(l.id)}</span><span>承办单位：${esc(orgName(l.owner))}</span>${badge(l.status)}</div><div class="log-latest-detail">${esc(l.detail)}</div><button class="text-btn log-history-link" data-case="${esc(l.id)}">查看完整流转记录（${l.logCount} 条） ${icon('chevron',12)}</button></div><span class="log-actor">${esc(l.actor)}</span></div>`).join('')||'<div class="empty">暂无流转记录</div>'}</div></section>`;
}
function publicStatus(r){return r.status;}
function caseAction(act,id){
 const r=getRecord(id);if(!allowed(r,act))return toast('只有接收单位可以执行当前办理操作。','error');
 const labels={accept:'接收并分类',classify:'调整问题类型',note:'添加办理记录',complete:'反馈结果并办结'};
 const hints={accept:'请根据群众的诉求描述选择问题类型。确认后直接进入本单位办理流程，不分流、不转办。',classify:'根据核实情况调整问题类型，承办单位保持不变，变更将写入本事项的完整历史。',note:'记录本单位本次联系、核实或处理进展。保存后事项继续处于办理中。',complete:'填写可向群众展示的处理措施和结果。本单位确认后直接办结，无需其他单位复核。'};
 let fields='';
 if(['accept','classify'].includes(act))fields+=`<div class="field"><label for="action-category">问题类型 <span class="req">*</span></label><select id="action-category" name="category" required><option value="">请根据群众描述选择类型</option>${CATEGORIES.map(c=>`<option value="${esc(c)}" ${r.category===c?'selected':''}>${esc(c)}</option>`).join('')}</select></div>`;
 const optional=['accept','classify'].includes(act),label=optional?'办理说明':act==='complete'?'办理结果':'办理记录';
 fields+=`<div class="field"><label for="action-detail">${label}${optional?'（选填）':' <span class="req">*</span>'}</label><textarea id="action-detail" name="detail" ${optional?'':'required minlength="2"'} maxlength="1000" placeholder="${act==='complete'?'请填写具体处理措施和结果，该结果将向群众公开。':optional?'可补充核实情况或分类依据。':'请填写本次办理进展。'}"></textarea></div>`;
 openModal(labels[act],`<p class="modal-note">${hints[act]}</p><div class="case-ref">${esc(r.id)}<strong>${esc(r.title)}</strong><p>${esc(r.description)}</p></div><form id="action-form" data-kind="${act}" data-record="${esc(id)}">${fields}<div class="modal-actions"><button type="button" class="btn" data-action="close-modal">取消</button><button type="submit" class="btn primary">${labels[act]}</button></div></form>`);
}
function openModal(title,content){document.getElementById('modal-root').innerHTML=`<div class="modal-overlay" data-backdrop="modal"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div class="modal-head"><h2 id="modal-title">${title}</h2><button class="icon-btn" data-action="close-modal" aria-label="关闭对话框">${icon('close',20)}</button></div><div class="modal-content">${content}</div></section></div>`;setTimeout(()=>document.querySelector('#modal-root select,#modal-root textarea,#modal-root input,#modal-root button')?.focus(),20);}
function closeModal(){document.getElementById('modal-root').innerHTML='';}
function refreshTable(){const rows=filteredRecords();const table=document.getElementById('case-table-content');if(table)table.innerHTML=caseTable(rows);const count=document.getElementById('case-result-count');if(count)count.textContent=`共 ${rows.length} 条记录`;}

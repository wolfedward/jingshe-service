'use strict';
const V2_STORAGE='heneng.dongsan.local-download.v2';
const ADMIN_CAPS=['orgs','roles','staff','entries','dimensions'];
const ALL_CAPS=['overview','records','reports','screen',...ADMIN_CAPS,'accept','note','close','export'];
const copy=value=>JSON.parse(JSON.stringify(value));
// Normalize saved snapshots and older browser caches after the station rename.
const renameStationValue=(_key,value)=>typeof value==='string'?value.replaceAll('东二路派出所','东三路派出所'):value;
const uid=prefix=>prefix+'-'+(globalThis.crypto?.randomUUID?.()||Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,10));
const deviceId=(()=>{try{let id=localStorage.getItem('heneng.dongsan.local-download.device');if(!id){id=uid('device');localStorage.setItem('heneng.dongsan.local-download.device',id);}return id;}catch{return uid('device');}})();
function defaultConfig(){
 const now=new Date().toISOString();
 return{
  organizations:[{id:'police',name:'东三路派出所',type:'police',parentId:null,enabled:true,center:[37.44,118.66]},{id:'community1',name:'社区一',type:'community',parentId:'police',enabled:true,center:[37.443,118.655]},{id:'community2',name:'社区二',type:'community',parentId:'police',enabled:true,center:[37.431,118.673]},{id:'grid1',name:'社区一 · 第一网格',type:'grid',parentId:'community1',enabled:true,center:[37.446,118.652]},{id:'grid2',name:'社区二 · 第一网格',type:'grid',parentId:'community2',enabled:true,center:[37.433,118.678]},{id:'property1',name:'和悦物业服务中心',type:'property',parentId:null,enabled:true,center:[37.446,118.652]},{id:'property2',name:'锦和物业服务中心',type:'property',parentId:null,enabled:true,center:[37.433,118.678]}],
  roles:[{id:'admin',name:'系统管理员',base:'police',scope:'all',permissions:ALL_CAPS,builtin:true,enabled:true},{id:'police',name:'公安办理岗',base:'police',scope:'org',permissions:['overview','records','reports','screen','accept','note','close','export'],builtin:true,enabled:true},{id:'community',name:'社区办理岗',base:'community',scope:'branch',permissions:['overview','records','reports','screen','accept','note','close','export'],builtin:true,enabled:true},{id:'property',name:'物业办理岗',base:'property',scope:'org',permissions:['overview','records','reports','screen','accept','note','close','export'],builtin:true,enabled:true}],
  staff:[{id:'admin',name:'管理员（演示）',roleId:'admin',orgId:'police',enabled:true},{id:'police-duty',name:'公安办理岗（演示）',roleId:'police',orgId:'police',enabled:true},{id:'community1-worker',name:'社区一办理人（演示）',roleId:'community',orgId:'community1',enabled:true},{id:'community2-worker',name:'社区二办理人（演示）',roleId:'community',orgId:'community2',enabled:true},{id:'grid1-worker',name:'第一网格员（演示）',roleId:'community',orgId:'grid1',enabled:true},{id:'property1-worker',name:'和悦物业办理人（演示）',roleId:'property',orgId:'property1',enabled:true},{id:'property2-worker',name:'锦和物业办理人（演示）',roleId:'property',orgId:'property2',enabled:true}],
  entries:[{id:'entry-community1',name:'社区一群众入口',orgId:'community1',enabled:true,createdAt:now},{id:'entry-community2',name:'社区二群众入口',orgId:'community2',enabled:true,createdAt:now}],
  dimensions:[{id:'urgency',name:'紧急程度',type:'select',options:['一般','较急','紧急'],enabled:true,showInForm:true,required:true},{id:'scene',name:'发生场景',type:'select',options:['居住环境','公共空间','便民咨询'],enabled:true,showInForm:true,required:false}],
  categories:['咨询求助','邻里纠纷','治安相关','环境卫生','公共设施','其他事项'].map((name,i)=>({id:'cat'+i,name,enabled:true,color:['#508bdc','#9864b9','#c97559','#4d9c83','#589bb2','#8793a8'][i]})),
  settings:{entryBaseUrl:'',center:[37.44,118.66],zoom:13,tileUrl:'https://tile.openstreetmap.org/{z}/{x}/{y}.png',tileAttribution:'OpenFreeMap © OpenMapTiles © OpenStreetMap contributors',vectorStyleUrl:'https://tiles.openfreemap.org/styles/liberty'}
 };
}
// One-time upgrade of an existing browser snapshot: preserve IDs, results and complete history.
function ensureDirectIntake(snapshot){
 if(snapshot.directIntakeVersion===1)return snapshot;
 const defaults=defaultConfig(),c=snapshot.config;
 for(const key of ['organizations','roles','staff']){
  const additions=defaults[key].filter(x=>key==='organizations'?x.type==='property':key==='roles'?x.base==='property':x.roleId==='property');
  for(const item of additions)if(!c[key].some(x=>x.id===item.id))c[key].push(copy(item));
 }
 for(const r of c.roles){
  const previous=r.permissions||[];
  r.permissions=[...new Set(['overview',...previous.map(p=>p==='map'?'screen':p).filter(p=>ALL_CAPS.includes(p))])];
  if(previous.includes('feedback')&&!r.permissions.includes('close'))r.permissions.push('close');
  if(r.id==='police'&&r.builtin){r.scope='org';r.name='公安办理岗';}
 }
 for(const r of snapshot.records){
  r.logs=Array.isArray(r.logs)?r.logs:[];
  r.category=r.category||'待分类';r.receiverId=r.receiverId||r.owner;
  const type=c.organizations.find(o=>o.id===r.receiverId)?.type;
  r.recipientType=r.recipientType||(type==='grid'?'community':type)||'police';
  const old=r.status;
  if(old==='待分流')r.status='待接收';
  if(old==='待复核')r.status='办理中';
  if(r.status!==old){
   const at=new Date().toISOString();r.updatedAt=at;
   r.logs.push({at,actor:'系统',action:'办理规则更新',detail:`历史状态“${old}”调整为“${r.status}”，保留原办理单位、结果及历史，由当前承办单位继续处理并自行办结。`});
  }
 }
 snapshot.directIntakeVersion=1;
 return snapshot;
}
function migrate(old){
 if(old)old=JSON.parse(JSON.stringify(old),renameStationValue);
 if(old?.version===2&&old.config)return ensureDirectIntake(old);
 const config=defaultConfig(),sampleIds=new Set(seedData().records.map(r=>r.id));
 const points=[[37.449,118.653],[37.438,118.674],[37.443,118.66],[37.445,118.648],[37.429,118.677],[37.447,118.659],[37.44,118.649],[37.434,118.672],[37.451,118.657],[37.431,118.681],[37.441,118.664],[37.436,118.678]];
 const records=(old?.records||seedData().records).map((r,i)=>{
  const sample=sampleIds.has(r.id),p=points[i%points.length];
  return{...r,orgId:r.community==='社区二'?'community2':'community1',entryId:null,createdBy:sample?(r.createdBy==='resident-local'?'sample-resident':'sample'):(r.createdBy==='resident-local'?deviceId:r.createdBy),source:sample?'sample':r.source,geo:sample?{lat:p[0],lng:p[1],accuracy:null,source:'sample',capturedAt:r.createdAt}:null,custom:sample?{urgency:['一般','较急','一般','紧急'][i%4],scene:r.category==='咨询求助'?'便民咨询':r.category==='公共设施'?'公共空间':'居住环境'}:{},...(r.status==='已办结'?{closedAt:r.logs.at(-1)?.at||r.updatedAt}:{})};
 });
 return ensureDirectIntake({version:2,config,records});
}
function cachedState(){try{const s=JSON.parse(localStorage.getItem(V2_STORAGE)||'null',renameStationValue);if(s?.data?.version===2&&s.data.config){s.data=migrate(s.data);return s;}return{data:migrate(null),base:null,revision:0,dirty:false};}catch{storageAvailable=false;return{data:migrate(null),base:null,revision:0,dirty:false};}}
const cached=cachedState();
let data=cached.data;
let ui={role:'police',community:'community1',view:'overview',staffId:'admin',adminTab:'orgs',filter:'全部',search:'',org:'全部',onlyMine:false,dashFilter:'全部',residentTab:'submit',receipt:null,drawer:null,mobile:false,mapFilters:{},reportFilters:{},mapColor:'status',reportGroup:'category',reportMetric:'count',formGeo:null,entryId:new URLSearchParams(location.search).get('entry'),residentDraft:{},pickerOpen:false,gpsBusy:false};
if(ui.entryId)ui.role='resident';
let cloud=null,syncState={mode:'loading',dirty:false,revision:0,conflicts:[]};
function syncLookups(){
 CATEGORIES.splice(0,CATEGORIES.length,...data.config.categories.filter(c=>c.enabled!==false).map(c=>c.name));
 Object.keys(DEPTS).forEach(k=>delete DEPTS[k]);Object.keys(SHORT_DEPTS).forEach(k=>delete SHORT_DEPTS[k]);
 for(const o of data.config.organizations){DEPTS[o.id]=o.name;SHORT_DEPTS[o.id]=o.name;}
 if(ui.reportGroup?.startsWith('custom:')&&!data.config.dimensions.some(d=>d.id===ui.reportGroup.slice(7)&&d.enabled))ui.reportGroup='category';
 if(ui.mapColor?.startsWith('custom:')&&!data.config.dimensions.some(d=>d.id===ui.mapColor.slice(7)&&d.enabled))ui.mapColor='status';
 const p=HNPolicy.profile(data.config,ui.staffId);if(ui.role!=='resident'&&p){ui.role=p.role.base;ui.community=p.staff.orgId;}
}
function orgName(id){return data.config.organizations.find(o=>o.id===id)?.name||id||'未分配';}
function configuredRoleName(id){return data.config.roles.find(r=>r.id===id)?.name||id;}
function actor(){return HNPolicy.profile(data.config,ui.staffId)?.staff.orgId||'police';}
function roleName(){return ui.role==='resident'?'群众服务':orgName(actor())+' · '+configuredRoleName(HNPolicy.profile(data.config,ui.staffId)?.role.id);}
function can(permission){return ui.role!=='resident'&&HNPolicy.can(data.config,ui.staffId,permission);}
function visibleRecords(){return ui.role==='resident'?data.records.filter(r=>r.createdBy===deviceId||(!ui.entryId&&r.createdBy==='sample-resident')):HNPolicy.visible(data.records,data.config,ui.staffId);}
function activeForRole(r){return r.owner===actor();}
function canSee(r){return (ui.role==='resident'||can('records'))&&visibleRecords().some(x=>x.id===r.id);}
function getRecord(id){return data.records.find(r=>r.id===id);}
function filteredRecords(){return visibleRecords().filter(r=>(!ui.onlyMine||r.owner===actor())&&(ui.filter==='全部'||r.status===ui.filter)&&(ui.org==='全部'||r.orgId===ui.org)&&(!ui.search||[r.id,r.title,r.description,r.location,r.category].join(' ').toLowerCase().includes(ui.search.toLowerCase()))).sort((a,b)=>Date.parse(b.updatedAt)-Date.parse(a.updatedAt));}
function allowed(r,act){return ui.role!=='resident'&&HNPolicy.allowed(r,act,data.config,ui.staffId);}
function history(r,action,detail,who=orgName(actor())){const at=new Date().toISOString();r.updatedAt=at;r.logs.push({at,actor:who,action,detail});}
function toast(message,type='success'){clearTimeout(toastTimer);const el=document.getElementById('toast-root');el.innerHTML=`<div class="toast ${type}" role="status">${icon(type==='error'?'info':'checkcircle',18)}<span>${esc(message)}</span></div>`;toastTimer=setTimeout(()=>el.innerHTML='',4000);}
function save(){if(!cloud)return false;cloud.save();return !cloud.snapshot().dirty;}
function commit(fn,message){fn();syncLookups();const saved=save();render();if(message)toast(saved?message:'修改暂留当前页面，本机保存失败。请点击保存状态下载备份。',saved?'success':'error');}
function download(name,content,mime){const url=URL.createObjectURL(new Blob([content],{type:mime}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function entryUrl(entry){const base=String(data.config.settings.entryBaseUrl||'').trim();if(!base)return '';try{const url=new URL(base);if(!['http:','https:'].includes(url.protocol)||url.username||url.password)return '';url.searchParams.set('entry',entry.id);return url.href;}catch{return '';}}
function localEntryUrl(entry){const url=new URL(location.href);url.searchParams.set('entry',entry.id);url.hash='';return url.href;}
function navigation(){return[
 ['overview','grid','事项总览','overview'],['cases','list','诉求台账','records'],['reports','file','统计报表','reports'],['screen','grid','分析大屏','screen'],['logs','clock','流转记录','records'],['admin','users','系统配置','admin'],['workflow','flow','业务逻辑',null],['help','help','使用说明',null]
 ].filter(x=>x[3]==null||(x[3]==='admin'?ADMIN_CAPS.some(can):can(x[3])));}
function nav(view){if(view==='map')view='screen';if(ui.entryId)return;if(ui.role!=='resident'&&!navigation().some(x=>x[0]===view))return toast('当前预览角色没有此页面权限。','error');ui.view=view;ui.mobile=false;ui.onlyMine=false;ui.filter='全部';ui.search='';ui.org='全部';ui.drawer=null;render();}
function setProfile(id){if(ui.entryId)return;const p=HNPolicy.profile(data.config,id);if(!p)return toast('人员、角色或所属组织已停用。','error');ui.staffId=id;ui.role=p.role.base;ui.community=p.staff.orgId;ui.view='overview';ui.drawer=null;ui.onlyMine=false;ui.filter='全部';ui.search='';ui.org='全部';ui.dashFilter='全部';ui.mobile=false;closeModal();render();}
function setRole(role){if(ui.entryId)return;if(role==='resident'){ui.role='resident';ui.view='overview';ui.drawer=null;ui.mobile=false;closeModal();render();return;}const current=HNPolicy.profile(data.config,ui.staffId);const next=current?.role.base===role?current.staff:data.config.staff.find(s=>HNPolicy.profile(data.config,s.id)?.role.base===role);if(next)setProfile(next.id);else toast('请先在系统配置中创建对应岗位。','error');}
function footer(){return `<footer class="footer"><span>山东合能科技有限责任公司 · 技术支持</span><span>警社联动诉求服务 · V2.1</span></footer>`;}
function communitySelect(){return `<div class="org-select"><span>当前组织</span><strong>${esc(orgName(actor()))}</strong></div>`;}
function syncLabel(){return{loading:'正在检查本机保存',syncing:'正在保存本机',synced:'已保存本机',offline:'本机保存待重试',error:'本机保存失败'}[syncState.mode]||'本机保存待处理';}
function syncBadge(){return `<button class="sync-badge" data-action="sync" data-sync-status="${syncState.mode}" title="查看本机保存状态">${syncLabel()}</button>`;}
function updateSync(status){syncState=status;for(const el of document.querySelectorAll('.sync-badge')){el.dataset.syncStatus=status.mode;el.textContent=syncLabel();}for(const el of document.querySelectorAll('[data-receipt-state]'))el.textContent=status.dirty?'诉求仅暂留当前页面，请下载备份':'诉求已保存本机';}
function captureDraft(){const form=document.getElementById('resident-form');if(form&&ui.residentTab==='submit')ui.residentDraft=Object.fromEntries(new FormData(form));}
function render(){
 captureDraft();HNGeo?.dispose();syncLookups();
 if(ui.role!=='resident'&&!navigation().some(x=>x[0]===ui.view))ui.view=navigation()[0]?.[0]||'help';
 const app=document.getElementById('app');
 if(ui.entryId){app.innerHTML=`<main class="mobile-intake"><div class="intake-top"><strong>${icon('flow',19)} 警社联动 · 群众服务</strong>${syncBadge()}</div>${residentView()}${footer()}</main>`;}
 else if(ui.view==='screen'&&can('screen')){app.innerHTML=`<main class="full-screen-view">${HNGeo.view(HN,'screen')}<div class="sync-float">${syncBadge()}</div></main>`;}
 else{
  const navs=ui.role==='resident'?[['overview','message','群众服务'],['workflow','flow','办理流程'],['help','help','使用说明']]:navigation();
  const count=visibleRecords().filter(r=>r.status!=='已办结'&&activeForRole(r)).length;
  app.innerHTML=`<aside class="sidebar ${ui.mobile?'mobile-open':''}"><div class="brand"><div class="brand-mark">${icon('flow',24)}</div><div><h2>警社联动</h2><small>诉求服务 · 协同办理</small></div></div><div class="nav-caption">工作空间</div><nav class="nav" aria-label="主导航">${navs.map(([v,i,n])=>`<button data-nav="${v}" class="${ui.view===v?'active':''}" ${ui.view===v?'aria-current="page"':''}>${icon(i,18)}<span>${n}</span>${v==='cases'?`<span class="count">${count}</span>`:''}</button>`).join('')}</nav><div class="sidebar-foot"><div class="unit">${icon('building',15)} 东三路派出所</div><div>群众诉求受理 · 公安 · 社区 · 物业服务</div><div class="divider"></div><div>山东合能科技有限责任公司</div></div></aside><div class="shell"><header class="topbar"><div class="topbar-left"><button class="icon-btn mobile-menu" data-action="menu" aria-label="打开菜单">${icon('menu',20)}</button><strong>${esc(roleName())}</strong></div><div class="topbar-right">${syncBadge()}<select id="profile-select" class="profile-select" aria-label="人员与角色预览">${data.config.staff.filter(s=>HNPolicy.profile(data.config,s.id)).map(s=>`<option value="${esc(s.id)}" ${ui.staffId===s.id?'selected':''}>${esc(s.name)}</option>`).join('')}</select><div class="role-control" aria-label="切换预览角色"><button data-role="police" class="${ui.role==='police'?'active':''}">公安端</button><button data-role="community" class="${ui.role==='community'?'active':''}">社区端</button><button data-role="property" class="${ui.role==='property'?'active':''}">物业端</button><button data-role="resident" class="${ui.role==='resident'?'active':''}">群众端</button></div></div></header><main class="content">${viewContent()}${footer()}</main></div>`;
 }
 renderDrawer();
 if(ui.view==='admin'&&ui.role!=='resident')HNAdmin.mount(HN);
 if(['reports','screen'].includes(ui.view)&&ui.role!=='resident')HNGeo.mount(HN,ui.view);
 if(ui.role==='resident'&&ui.residentTab==='submit'&&ui.pickerOpen&&document.getElementById('resident-picker'))HNGeo.renderPicker(HN,'resident-picker',geo=>{ui.formGeo=geo;const el=document.getElementById('location-readout');if(el)el.innerHTML=locationSummary();});
}
function viewContent(){if(ui.view==='workflow')return workflowView();if(ui.view==='help')return helpView();if(ui.role==='resident')return residentView();if(ui.view==='admin')return HNAdmin.view(HN);if(['reports','screen'].includes(ui.view))return HNGeo.view(HN,ui.view);if(ui.view==='cases')return casesView();if(ui.view==='logs')return logsView();return overviewView();}
function casesView(){const rows=filteredRecords(),scope=visibleRecords().filter(r=>!ui.onlyMine||r.owner===actor());return `${heading('诉求台账','查看事项内容、发生区域、办理归属与完整流转。',`${can('export')?`<button class="btn" data-action="export">${icon('download',15)}导出台账</button>`:''}`)}<section class="panel"><div class="mini-tabs" style="padding-top:8px">${['全部',...STATES].map(s=>`<button data-filter="${s}" class="${ui.filter===s?'active':''}">${s}<span class="tiny-num">${scope.filter(r=>s==='全部'||r.status===s).length}</span></button>`).join('')}</div><div class="filters"><div class="search">${icon('search',17)}<input id="case-search" type="search" value="${esc(ui.search)}" placeholder="搜索标题、单号或位置" aria-label="搜索诉求"></div><select id="org-filter" aria-label="筛选发生地组织"><option value="全部">全部发生区域</option>${data.config.organizations.map(o=>`<option value="${esc(o.id)}" ${ui.org===o.id?'selected':''}>${esc(o.name)}</option>`).join('')}</select>${ui.role!=='resident'?`<label><input id="only-mine-filter" type="checkbox" ${ui.onlyMine?'checked':''}> 仅当前负责</label>`:''}<button class="btn small" data-action="clear-filters">重置筛选</button></div><div id="case-table-content">${caseTable(rows)}</div><div class="panel-bottom"><span id="case-result-count">共 ${rows.length} 条记录</span><span>当前角色可见范围</span></div></section>`;}
function locationSummary(){const g=ui.formGeo;if(!g)return`${icon('pin',18)}<div><strong>尚未标注地图位置</strong><small>可获取手机定位或手动选点；详细地址请另外填写。</small></div>`;return `${icon('pin',18)}<div><strong>${g.source==='device'?'设备定位':'手动选点'} · 已记录</strong><span>${g.lat.toFixed(6)}, ${g.lng.toFixed(6)}</span><small>${g.accuracy!=null?'设备报告精度约 '+Math.round(g.accuracy)+' 米；':''}请核对标点并补充楼栋、楼层或门牌。</small></div>`;}
function entryIsActive(entry){return !!entry&&entry.enabled!==false&&orgIsActive(entry.orgId);}
function orgIsActive(id){let o=data.config.organizations.find(x=>x.id===id),seen=new Set();while(o){if(o.enabled===false||seen.has(o.id))return false;seen.add(o.id);if(!o.parentId)return true;o=data.config.organizations.find(x=>x.id===o.parentId);}return false;}
function customField(d){const key='custom:'+d.id,val=ui.residentDraft[key]??'';return`<div class="field"><label for="field-${esc(d.id)}">${esc(d.name)}${d.required?'<span class="req">*</span>':''}</label>${d.type==='select'?`<select id="field-${esc(d.id)}" name="${esc(key)}" ${d.required?'required':''}><option value="">请选择${esc(d.name)}</option>${d.options.map(v=>`<option ${val===v?'selected':''}>${esc(v)}</option>`).join('')}</select>`:`<input id="field-${esc(d.id)}" name="${esc(key)}" type="${d.type==='number'?'number':d.type==='date'?'date':'text'}" ${d.type==='number'?'step="any"':''} value="${esc(val)}" maxlength="1000" ${d.required?'required':''}>`}</div>`;}
function receivingOrganizations(type){
 return data.config.organizations.filter(o=>HNPolicy.compatible(type,o.type)&&orgIsActive(o.id));
}
function recipientFields(d){
 const type=['police','community','property'].includes(d.recipientType)?d.recipientType:'';
 const orgs=receivingOrganizations(type);
 const selected=orgs.some(o=>o.id===d.receiverId)?d.receiverId:orgs.length===1?orgs[0].id:'';
 return `<div class="field"><label for="r-recipient-type">上报至 <span class="req">*</span></label><select id="r-recipient-type" name="recipientType" required><option value="">请选择接收方</option>${[['police','公安'],['community','社区'],['property','物业']].map(([id,name])=>`<option value="${id}" ${type===id?'selected':''}>${name}</option>`).join('')}</select></div><div class="field"><label for="r-receiver">接收单位 <span class="req">*</span></label><select id="r-receiver" name="receiverId" required ${type?'':'disabled'}><option value="">${type?(orgs.length?'请选择具体单位':'暂无启用单位，请联系管理员'):'请先选择公安、社区或物业'}</option>${orgs.map(o=>`<option value="${esc(o.id)}" ${selected===o.id?'selected':''}>${esc(o.name)}</option>`).join('')}</select><p class="field-help">由您选择的单位直接接收、分类、办理并办结。</p></div>`;
}
function residentView(){
 const entry=ui.entryId?data.config.entries.find(e=>e.id===ui.entryId):null;
 if(ui.entryId&&!entryIsActive(entry)&&ui.residentTab!=='mine')return`<section class="panel entry-disabled">${icon('info',36)}<h2>${syncState.mode==='loading'?'正在确认入口':'入口暂不可用'}</h2><p>${syncState.mode==='loading'?'正在读取入口配置，请稍候。':'此入口不存在、已停用，或关联区域已停用，暂不能新提报。您仍可查看本设备已提交的诉求。'}</p><button class="btn" data-action="sync" style="margin-top:20px">重新检查</button><button class="btn soft" style="margin:20px 8px 0" data-resident-tab="mine">查看已提交诉求</button></section>`;
 const records=visibleRecords().sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt));const d=ui.residentDraft,org=entry?.orgId||d.orgId||'community1';
 return `<div class="resident-wrap"><div class="resident-hero"><div><div class="eyebrow" style="color:#88a3c3">COMMUNITY SERVICE</div><h1>有事说一声</h1><p>选择接收单位，提交您的咨询与诉求。</p></div><div class="hero-icon">${icon('message',58)}</div></div><div class="mini-tabs resident-switch"><button data-resident-tab="submit" class="${ui.residentTab==='submit'?'active':''}">提交诉求</button><button data-resident-tab="mine" class="${ui.residentTab==='mine'?'active':''}">我的诉求 <span>${records.length}</span></button></div>${entry?`<div class="entry-banner">${icon('pin',20)}<div><strong>${esc(entry.name)}</strong><span>归属：${esc(orgName(entry.orgId))}</span></div></div>`:''}${ui.receipt?`<div class="receipt"><div class="check">${icon('check',28)}</div><h2 data-receipt-state>${syncState.dirty?'诉求仅暂留当前页面，请下载备份':'诉求已保存本机'}</h2><p>请保留事项编号，可在本机切换您所选的公安、社区或物业角色演示办理。本地记录不会发送至真实单位。<span class="receipt-code">${esc(ui.receipt)}</span></p><button class="btn soft" data-case="${esc(ui.receipt)}">查看办理进度 ${icon('arrow',15)}</button></div>`:''}${ui.residentTab==='mine'?`${records.map(r=>`<article class="panel resident-card" data-case="${esc(r.id)}" tabindex="0" role="button" aria-label="查看${esc(r.title)}"><div class="resident-card-head"><div><h3>${esc(r.title)}</h3><p>${esc(r.id)} · 承办单位：${esc(orgName(r.owner))}</p></div>${badge(publicStatus(r))}</div><div class="resident-card-bottom"><span>提交时间 ${dateFmt(r.createdAt,true)}</span><span class="blue">查看详情 ${icon('chevron',13)}</span></div></article>`).join('')||'<div class="panel empty">暂无本设备提交记录</div>'}<p class="source-note">此列表显示当前浏览器提交的事项；切换角色可在本机演示办理。数据不会跨设备或跨浏览器共享，也不会发送给真实公安、社区或物业。</p>`:`<div class="resident-grid"><section class="panel form-panel"><h2 class="section-heading">请描述您需要的帮助</h2><p class="section-intro">带 <span class="req">*</span> 的项目为必填。请使用虚构信息体验样板。</p><form id="resident-form"><div class="form-grid">${recipientFields(d)}<div class="field full"><label for="r-title">诉求标题 <span class="req">*</span></label><input id="r-title" type="text" name="title" required maxlength="60" value="${esc(d.title||'')}" placeholder="一句话说明您遇到的问题"></div><div class="field"><label for="r-org">发生区域 <span class="req">*</span></label><select id="r-org" name="orgId" ${entry?'disabled':''}>${data.config.organizations.filter(o=>['community','grid'].includes(o.type)&&orgIsActive(o.id)).map(o=>`<option value="${esc(o.id)}" ${org===o.id?'selected':''}>${esc(o.name)}</option>`).join('')}</select>${entry?`<input type="hidden" name="orgId" value="${esc(org)}">`:''}</div><div class="field full"><label for="r-address">详细地址 <span class="req">*</span></label><input id="r-address" type="text" name="location" required maxlength="100" value="${esc(d.location||'')}" placeholder="如：某小区3号楼东侧通道"><p class="field-help">请写清街道、小区、楼栋或附近地标。</p><div class="location-tools"><button type="button" class="btn soft" data-action="gps" ${ui.gpsBusy?'disabled':''}>${icon('pin',16)}${ui.gpsBusy?'正在获取…':'获取当前位置'}</button><button type="button" class="btn" data-action="pick-location">${icon('grid',16)}${ui.pickerOpen?'收起地图':'地图手动选点'}</button>${ui.formGeo?'<button type="button" class="btn small" data-action="clear-location">清除坐标</button>':''}</div><div id="location-readout" class="location-readout ${ui.formGeo?'':'location-empty'}">${locationSummary()}</div>${ui.pickerOpen?'<div id="resident-picker" class="picker-shell"></div>':''}<p class="field-help">定位会请求设备授权。坐标用于标注事项，不能自动确定楼层或门牌；可拒绝定位并手动补充。</p></div><div class="field full"><label for="r-description">诉求描述 <span class="req">*</span></label><textarea id="r-description" name="description" required minlength="5" maxlength="1000" rows="4" placeholder="请描述发生情况、时间和希望获得的帮助">${esc(d.description||'')}</textarea></div><div class="field"><label for="r-name">称呼</label><input id="r-name" type="text" name="submitter" maxlength="60" value="${esc(d.submitter||'')}" placeholder="选填"></div></div>${data.config.dimensions.some(x=>x.enabled&&x.showInForm)?`<h3 class="form-section-label">补充信息</h3><div class="custom-fields">${data.config.dimensions.filter(x=>x.enabled&&x.showInForm).map(customField).join('')}</div>`:''}<div class="resident-submit"><p>本样板用于需求沟通。紧急情况请通过正式报警渠道处理。</p><button type="submit" class="btn primary">提交诉求 ${icon('send',16)}</button></div></form></section><aside class="resident-side"><section class="panel resident-tips"><h3>把问题说清楚</h3><ol><li>选择公安、社区或物业及具体接收单位。</li><li>填写地址，获取定位或在地图上选点。</li><li>提交后保留编号，查看办理进度。</li></ol></section><section class="panel resident-tips"><h3>办理流程</h3><p>群众选择接收单位 → 该单位接收并分类 → 本单位办理 → 反馈结果并办结。</p></section></aside></div>`}</div>`;
}
async function requestLocation(){
 if(ui.gpsBusy)return;captureDraft();ui.gpsBusy=true;render();
 try{ui.formGeo=await HNLocation(navigator.geolocation,window.isSecureContext);ui.pickerOpen=true;toast('已获取位置，请核对地图并补充详细地址。');}
 catch(error){toast(error.message,'error');ui.pickerOpen=true;}
 finally{ui.gpsBusy=false;render();}
}
function submitResident(form){
 const obj=Object.fromEntries(new FormData(form));for(const k in obj)obj[k]=String(obj[k]).trim();
 const entry=ui.entryId?data.config.entries.find(x=>x.id===ui.entryId):null;
 if(ui.entryId&&!entryIsActive(entry))return toast('此入口已停用，无法提交。','error');
 const orgId=entry?.orgId||obj.orgId;
 if(entry&&!cloud?.snapshot().base?.config.entries.some(e=>e.id===entry.id))return toast('入口配置尚未保存到本机，请先重新保存配置；保存失败时请下载备份。','error');
 if(!data.config.organizations.some(o=>o.id===orgId&&['community','grid'].includes(o.type))||!orgIsActive(orgId))return toast('请选择有效的发生区域。','error');
 if(!['police','community','property'].includes(obj.recipientType))return toast('请选择上报至公安、社区或物业。','error');
 const receiver=receivingOrganizations(obj.recipientType).find(o=>o.id===obj.receiverId);
 if(!receiver)return toast('请选择有效的接收单位；该单位可能已停用。','error');
 if(!obj.title||obj.title.length>60||!obj.location||obj.location.length>100||!obj.description||obj.description.length<5||obj.description.length>1000)return toast('请填写完整有效的标题、区域、地址与描述。','error');
 const custom={};
 for(const dim of data.config.dimensions.filter(x=>x.enabled&&x.showInForm)){
  const value=obj['custom:'+dim.id]||'';if(dim.required&&!value)return toast('请填写'+dim.name+'。','error');if(value==='')continue;
  if(dim.type==='select'&&!dim.options.includes(value))return toast(dim.name+'选项已调整，请重新选择。','error');
  if(dim.type==='number'&&!Number.isFinite(Number(value)))return toast(dim.name+'需要有效数字。','error');
  if(dim.type==='date'&&!/^\d{4}-\d{2}-\d{2}$/.test(value))return toast(dim.name+'日期格式无效。','error');
  custom[dim.id]=dim.type==='number'?Number(value):value;
 }
 const id=uid('SL').toUpperCase(),now=new Date().toISOString(),owner=receiver.id;
 data.records.unshift({id,title:obj.title,category:'待分类',community:orgName(orgId),location:obj.location,description:obj.description,submitter:obj.submitter||'居民',status:'待接收',owner,receiverId:owner,recipientType:obj.recipientType,orgId,entryId:entry?.id||null,geo:ui.formGeo?copy(ui.formGeo):null,custom,createdAt:now,updatedAt:now,createdBy:deviceId,source:entry?'扫码入口':'群众服务',participants:[owner],result:'',publicResult:'',logs:[{at:now,actor:'群众',action:'提交诉求',detail:`群众选择上报至${receiver.name}，由该单位直接接收、分类并办理。`}]});
 ui.residentDraft={};ui.formGeo=null;ui.pickerOpen=false;form.reset();ui.receipt=id;ui.residentTab='mine';const saved=save();render();window.scrollTo({top:0,behavior:'smooth'});toast(saved?`诉求已保存，${receiver.name}可直接接收并办理。`:'诉求暂留当前页面，本机保存失败。请立即下载本机备份。',saved?'success':'error');
}
function openCase(id){const r=getRecord(id);if(!r||!canSee(r))return toast('当前角色无法查看该事项。','error');ui.drawer=id;renderDrawer();document.querySelector('#drawer-root [data-action="close-drawer"]')?.focus();}
function closeDrawer(){ui.drawer=null;document.getElementById('drawer-root').innerHTML='';document.body.style.overflow='';}
function renderDrawer(){
 const root=document.getElementById('drawer-root');if(!ui.drawer){root.innerHTML='';document.body.style.overflow='';return;}
 const r=getRecord(ui.drawer);if(!r||!canSee(r)){closeDrawer();return;}document.body.style.overflow='hidden';
 const citizen=ui.role==='resident',stat=citizen?publicStatus(r):r.status;
 const meta=[['发生区域',orgName(r.orgId)],['详细地址',r.location],['问题类型',r.category||'待分类'],['提交时间',dateFmt(r.createdAt,true)],['承办单位',orgName(r.owner)],...(citizen?[]:[['群众称呼',r.submitter]])];
 const g=r.geo,geo=g&&HNDomain.validateCoordinates(g.lat,g.lng)?`${g.lat.toFixed(6)}, ${g.lng.toFixed(6)} · ${{device:'设备定位',manual:'手动选点',sample:'样板示意坐标'}[g.source]}${g.accuracy!=null?' · 精度约'+Math.round(g.accuracy)+'米':''}`:'未标注坐标（已保留文字地址）';
 root.innerHTML=`<div class="overlay" data-backdrop="drawer"><section class="drawer" role="dialog" aria-modal="true" aria-labelledby="detail-title"><div class="drawer-head"><div><div class="case-meta"><span>${esc(r.id)}</span><span class="sep"></span>${badge(stat)}</div><h2 id="detail-title">${esc(r.title)}</h2></div><button class="icon-btn" data-action="close-drawer" aria-label="关闭事项详情">${icon('close',21)}</button></div><div class="drawer-body">${citizen?`<div class="detail-box resident-detail-status">${icon(r.status==='已办结'?'checkcircle':'clock',28)}<h3>${r.status==='已办结'?'您的诉求已办结':r.status==='待接收'?'您的诉求已提交，等待受理':'工作人员正在办理您的诉求'}</h3><p>最近更新 ${dateFmt(r.updatedAt,true)}</p></div>`:''}<div class="detail-box"><h3>${icon('file',16)}事项信息</h3><dl class="detail-meta">${meta.map(([k,v])=>`<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl></div><div class="detail-box"><h3>${icon('pin',16)}地图位置</h3><p>${esc(geo)}</p>${g?.source==='sample'?'<p class="source-note">用于演示任务标点，非真实案件或辖区边界。</p>':''}<div class="detail-custom" style="margin-top:12px">${Object.entries(r.custom||{}).map(([k,v])=>`<span>${esc(data.config.dimensions.find(d=>d.id===k)?.name||k)}：${esc(v)}</span>`).join('')}</div></div><div class="detail-box"><h3>${icon('message',16)}诉求内容</h3><div class="description">${esc(r.description)}</div></div>${(citizen?r.publicResult:r.result)?`<div class="detail-box detail-result"><h3>${icon('checkcircle',16)}${citizen?'办理结果':'办理结果'}</h3><div class="description">${esc(citizen?r.publicResult:r.result)}</div></div>`:''}${!citizen?`<div class="detail-box"><h3>${icon('clock',16)}流转时间轴</h3><div class="timeline">${[...r.logs].map((l,i)=>({...l,_order:i})).sort((a,b)=>(Date.parse(b.at)||0)-(Date.parse(a.at)||0)||b._order-a._order).map(l=>`<div class="timeline-item"><span class="timeline-node"></span><div class="timeline-item-body"><div class="timeline-item-top"><strong>${esc(l.action)}</strong><time>${dateFmt(l.at,true)}</time></div><p>${esc(l.detail)}</p><div class="timeline-actor">${esc(l.actor)}</div></div></div>`).join('')}</div></div>`:''}</div><div class="drawer-actions">${citizen?`<span class="action-caption">仅显示公开办理状态与结果</span><button class="btn" data-action="close-drawer">关闭详情</button>`:actionButtons(r)}</div></section></div>`;
}
function actionButtons(r){
 const choices=[['accept','接收并分类','primary','check'],['note','添加办理记录','','plus'],['classify','调整问题类型','','file'],['complete','反馈结果并办结','primary','checkcircle']].filter(([act])=>allowed(r,act));
 const caption=r.status==='已办结'?'事项已办结，记录保留':r.owner!==actor()?`由${orgName(r.owner)}办理，当前岗位仅可查看`:`本单位直接办理：${orgName(r.owner)}`;
 return `<span class="action-caption">${esc(caption)}</span>${choices.map(([act,label,cls,ico])=>`<button class="btn ${cls}" data-case-action="${act}" data-id="${esc(r.id)}">${icon(ico,15)}${label}</button>`).join('')||'<button class="btn" data-action="close-drawer">关闭详情</button>'}`;
}
function submitAction(form){
 const act=form.dataset.kind,r=getRecord(form.dataset.record);
 if(!allowed(r,act)){closeModal();return toast('当前单位或事项状态不支持此操作，请重新查看。','error');}
 const fd=new FormData(form),detail=String(fd.get('detail')||'').trim(),category=String(fd.get('category')||'').trim();
 if(detail.length>1000)return toast('办理说明最多1000字。','error');
 if(['accept','classify'].includes(act)&&!CATEGORIES.includes(category))return toast('请由接收单位选择有效的问题类型。','error');
 if(['note','complete'].includes(act)&&detail.length<2)return toast('请填写具体的办理记录或办理结果。','error');
 if(act==='accept'){
  r.category=category;r.status='办理中';r.classifiedBy=actor();r.classifiedAt=new Date().toISOString();
  history(r,'接收并分类',`本单位已接收，问题类型：${category}。${detail?'\n'+detail:''}`);
 }else if(act==='classify'){
  if(category===r.category)return toast('问题类型没有变化。','error');
  const previous=r.category;r.category=category;r.classifiedBy=actor();r.classifiedAt=new Date().toISOString();
  history(r,'调整问题类型',`${previous} → ${category}${detail?'\n'+detail:''}`);
 }else if(act==='note')history(r,'办理记录',detail);
 else if(act==='complete'){
  r.result=detail;r.publicResult=detail;r.status='已办结';
  history(r,'反馈结果并办结',detail);r.closedAt=r.updatedAt;
 }else return toast('此办理操作不可用。','error');
 const saved=save();closeModal();render();
 toast(saved?{accept:'已接收并分类，进入本单位办理流程。',classify:'问题类型已更新。',note:'办理记录已保存。',complete:'本单位已办结，群众端可查看办理结果。'}[act]:'办理变更暂留当前页面，本机保存失败。请立即下载备份。',saved?'success':'error');
}
function exportCsv(){if(!can('export'))return toast('当前角色没有导出权限。','error');const rows=filteredRecords();const cell=v=>{let s=String(v??'');if(/^[\s]*[=+@-]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';};const cols=['事项编号','诉求标题','类型','发生区域','详细地址','纬度','经度','坐标来源','当前办理方','状态','提交时间','办结时间','办理结果'];const text='\uFEFF'+[cols,...rows.map(r=>[r.id,r.title,r.category,orgName(r.orgId),r.location,r.geo?.lat,r.geo?.lng,r.geo?.source,orgName(r.owner),r.status,dateFmt(r.createdAt,true),r.closedAt?dateFmt(r.closedAt,true):'',r.result])].map(row=>row.map(cell).join(',')).join('\r\n');download('诉求台账_'+dateOnly(new Date())+'.csv',text,'text/csv;charset=utf-8;');toast('已导出当前筛选的 '+rows.length+' 条事项。');}
function workflowView(){
 const lane=(title,iconName)=>`<section class="panel direct-lane"><h3>${icon(iconName,19)}${title}</h3><p>接收群众直接上报的诉求</p><div>接收并分类 <span>→</span> 本单位办理 <span>→</span> 反馈结果并办结</div></section>`;
 return `${heading('业务逻辑与系统结构','群众自主选择接收单位；公安、社区、物业平行承办，各自负责到底。','','BUSINESS FLOW')}<section class="panel direct-intake-head"><h2>${icon('message',22)} 群众提交诉求</h2><p>选择公安、社区或物业及具体单位，填写描述、地址与位置；无需选择问题类型。</p><strong>所选单位直接收到诉求 · 不经公安分流 · 不跨单位转办</strong></section><div class="direct-lanes">${lane('公安','shield')}${lane('社区','users')}${lane('物业','building')}</div><div class="workflow-steps">${[['待接收','接收单位根据群众描述选择问题类型，确认接收。'],['办理中','本单位记录处理进展；可修正问题类型，不改变承办单位。'],['已办结','本单位填写并公开办理结果，无需公安复核。']].map(([s,t])=>`<div class="workflow-step"><h3>${badge(s)}</h3><p>${t}</p></div>`).join('')}</div><section class="panel direct-intake-head"><h3>办理数据统一联动</h3><p>分析大屏包含事项地图、状态、类型与趋势统计；流转记录按事项汇总最新动态，点击查看该事项完整时间轴。</p></section>`;
}
function helpView(){return `${heading('演示与使用说明','按一条完整事项，演示从扫码提报到地图分析。','','PROTOTYPE GUIDE')}<div class="help-grid"><section class="panel help-section"><h2>建议演示顺序</h2><ol><li><strong>配置岗位。</strong>在系统配置中建立公安、社区/网格、物业组织、角色和人员；人员下拉框可预览可见范围与操作权限。</li><li><strong>生成入口。</strong>在入口二维码中绑定区域并打开本机预览；另行配置可访问的HTTP(S)页面地址后才生成手机可访问的二维码。</li><li><strong>填写表单。</strong>选择接收方和具体单位，填写描述、地址和补充信息；问题类型由接收单位选择；明确点击获取定位，或在地图上选择位置。</li><li><strong>工作台办理。</strong>群众上报给哪个单位，哪个单位接收并分类、记录办理进展、反馈结果并自行办结。</li><li><strong>大屏地图看任务。</strong>按未办结/已办结、时间、类型、组织和自定义字段筛选，点标点查看详情。</li><li><strong>报表与大屏。</strong>在同一筛选范围内切换统计维度，导出明细或分组CSV，打印报表，打开分析大屏。</li></ol><button class="btn primary" data-role="resident">从群众提交开始 ${icon('arrow',15)}</button></section><section class="panel help-section"><h2>样板范围 <span class="help-badge">V2.1</span></h2><p>用于需求沟通的私有样板，初始事项和标点均为虚构示意。不会提交给真实公安、社区或物业业务系统。</p><h3>本机数据与扫码入口</h3><p>事项与配置仅保存在当前浏览器，不跨设备共享。本机入口预览使用当前HTML文件；未配置公开HTTP(S)页面地址时不生成可供手机访问的二维码。若另行部署页面并配置地址，二维码指向该页面，但各浏览器的数据仍互相独立。群众“我的诉求”按本机浏览器识别。</p><h3>岗位权限预览</h3><p>角色配置控制当前页面、办理按钮和承办单位数据范围；拥有全部查看范围的管理员也不能替其他单位办理。人员切换是预览机制，正式员工登录及服务端权限需要建设。</p><h3>地图与定位</h3><p>设备定位是否可用取决于浏览器对本地文件的限制及设备授权；不可用时请手动选点或填写地址。精度由设备报告，详细地址仍需填写。无坐标事项保留文字地址并单独计数，不会虚构标点。底图通过OpenFreeMap显示OpenStreetMap数据，正式服务商与部署环境待确认。</p><h3>统计口径</h3><p>地图、大屏、报表共用筛选，日期按北京时间整日。办结率＝已办结/当前筛选总量；平均耗时仅含提交和办结时间均有效的已办结事项，并显示样本数。</p><h3>本机保存与备份</h3><p>每次修改会尝试保存到当前浏览器，状态显示“已保存本机”才表示写入成功。保存失败时请保持页面打开并下载JSON备份。清理浏览器数据、换浏览器、移动或改名HTML后，原数据可能无法读取；本版不提供多人同步，请避免同时打开多个窗口编辑。地图底图仍需联网。</p><button class="btn" data-action="sync">查看本机保存状态与备份</button></section></div>`;}
function showSync(){
 const s=cloud?.snapshot()?.status||syncState;
 openModal('本机保存与备份',`<p class="modal-note"><strong>${esc(syncLabel())}</strong><br>${esc(s.message||'数据仅保存在当前浏览器，不会同步到在线系统。')}<br>本地保存序号：${Number(s.revision)||0}${s.lastSynced?'<br>最近保存：'+esc(dateFmt(s.lastSynced,true)):''}</p><p class="modal-note">JSON备份保留当前全部事项与配置。请在清理浏览器、移动文件或关闭未保存页面之前下载；本版本不提供自动跨设备同步。</p><div class="modal-actions"><button class="btn" data-action="backup-local">下载本机备份</button><button class="btn primary" data-action="retry-sync">重新保存本机</button></div>`);
}
document.addEventListener('click',e=>{
 const t=e.target.closest('button,[data-case],[data-backdrop]');if(!t)return;
 if([...t.attributes].some(a=>a.name.startsWith('data-admin-')||a.name.startsWith('data-geo-')))return;
 if(t.dataset.backdrop&&e.target===t){if(t.dataset.backdrop==='modal')closeModal();else closeDrawer();return;}
 if(t.dataset.nav)return nav(t.dataset.nav);if(t.dataset.role)return setRole(t.dataset.role);if(t.dataset.caseAction)return caseAction(t.dataset.caseAction,t.dataset.id);if(t.dataset.case)return openCase(t.dataset.case);
 if(t.dataset.status){if(!can('records'))return;ui.view='cases';ui.filter=t.dataset.status;ui.search='';ui.onlyMine=false;render();return;}
 if(t.dataset.filter){ui.filter=t.dataset.filter;render();return;}if(t.dataset.dashFilter){ui.dashFilter=t.dataset.dashFilter;render();return;}
 if(t.dataset.residentTab){captureDraft();ui.residentTab=t.dataset.residentTab;ui.receipt=null;render();return;}
 const act=t.dataset.action;
 if(act==='close-drawer')closeDrawer();if(act==='close-modal')closeModal();if(act==='menu'){ui.mobile=!ui.mobile;render();}
 if(act==='clear-filters'){ui.search='';ui.org='全部';ui.filter='全部';ui.onlyMine=false;render();}if(act==='export')exportCsv();
 if(act==='gps')requestLocation();if(act==='pick-location'){ui.pickerOpen=!ui.pickerOpen;render();}if(act==='clear-location'){ui.formGeo=null;render();}
 if(act==='sync')showSync();if(act==='retry-sync'){closeModal();cloud?.retry();}if(act==='backup-local')download('警社联动本机备份_'+new Date().toISOString().slice(0,10)+'.json',JSON.stringify(data,null,2),'application/json');
 if(act==='resolve-local'||act==='resolve-remote'){closeModal();cloud?.resolve(act==='resolve-local'?'local':'remote');}
});
document.addEventListener('change',e=>{if(e.target.id==='r-recipient-type'){const receiver=document.getElementById('r-receiver');if(receiver)receiver.value='';captureDraft();render();return;}if(e.target.id==='profile-select')setProfile(e.target.value);if(e.target.id==='only-mine-filter'){ui.onlyMine=e.target.checked;render();}if(e.target.id==='org-filter'){ui.org=e.target.value;refreshTable();}if(e.target.closest('#resident-form'))captureDraft();});
document.addEventListener('input',e=>{if(e.target.id==='case-search'){ui.search=e.target.value;refreshTable();}if(e.target.closest('#resident-form'))captureDraft();});
document.addEventListener('submit',e=>{if(e.target.id==='resident-form'){e.preventDefault();submitResident(e.target);}if(e.target.id==='action-form'){e.preventDefault();submitAction(e.target);}});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){if(document.getElementById('modal-root').children.length)closeModal();else closeDrawer();}if((e.key==='Enter'||e.key===' ')&&e.target.matches('[role="button"][data-case]')){e.preventDefault();openCase(e.target.dataset.case);}if(e.key==='Tab'){const dialog=document.querySelector('#modal-root .modal')||document.querySelector('#drawer-root .drawer');if(dialog){const f=[...dialog.querySelectorAll('button,a,input,select,textarea,[tabindex="0"]')].filter(el=>!el.disabled);if(f.length){const first=f[0],last=f.at(-1);if(e.shiftKey&&document.activeElement===first){last.focus();e.preventDefault();}else if(!e.shiftKey&&document.activeElement===last){first.focus();e.preventDefault();}}}}});
window.HN={data:()=>data,ui:()=>ui,esc,icon,toast,render,save,can,orgName,roleName:configuredRoleName,commit,openModal,closeModal,openCase,navigate:nav,setProfile,download,entryUrl,localEntryUrl,uid,records:()=>visibleRecords()};
syncLookups();render();
if(window.HNCloud){cloud=HNCloud.create({getData:()=>data,applyData:next=>{data=next;syncLookups();render();},onStatus:updateSync,canRefresh:()=>!document.getElementById('modal-root').children.length,storageKey:V2_STORAGE,initial:{base:cached.base,revision:cached.revision||0,dirty:!!cached.dirty}});cloud.start();}
else updateSync({mode:'error',dirty:true,revision:0,message:'本机保存组件尚未加载，请保持页面打开并下载备份。'});
window.addEventListener('beforeunload',e=>{if(syncState.dirty){e.preventDefault();e.returnValue='';}});

(function () {
  'use strict';
  const PALETTE = ['#2674b8','#129b8c','#d58b26','#9563bb','#df6373','#5779a0','#708c35','#bb6940'];
  const STATES = ['待接收','办理中','已办结'];
  const STATE_COLORS = {'待接收':'#8a65ba','办理中':'#2878bd','已办结':'#188775'};
  let maps = [], cleanups = [], timers = [];
  const E = (h, x) => h.esc(String(x == null ? '' : x));
  const domain = () => window.HNDomain;
  const config = h => h.data().config || {};
  const dims = h => (config(h).dimensions || []).filter(x => x.enabled !== false);
  const source = h => h.records();
  const defaults = () => ({status:'all',category:'all',orgId:'all',start:'',end:'',timeField:'createdAt',keyword:'',custom:{}});
  function filters(h) {
    const u = h.ui();
    const f = u.geoFilters || Object.assign({}, u.mapFilters || {}, u.reportFilters || {});
    return Object.assign(defaults(),f,{custom:Object.assign({},f.custom || {})});
  }
  function saveFilters(h,f) {
    h.ui().geoFilters = f;
    h.ui().mapFilters = Object.assign({},f,{custom:Object.assign({},f.custom)});
    h.ui().reportFilters = Object.assign({},f,{custom:Object.assign({},f.custom)});
  }
  const filtered = h => domain().filterRecords(source(h), filters(h), config(h));
  const metric = h => domain().metrics(filtered(h));
  const number = (n,places=0) => n == null || !Number.isFinite(Number(n)) ? '—' : Number(n).toLocaleString('zh-CN',{maximumFractionDigits:places});
  function dateTime(v) {const d = new Date(v);return !v || isNaN(d) ? '—' : d.toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false});}
  function valid(r) {return !!r.geo && domain().validateCoordinates(Number(r.geo.lat),Number(r.geo.lng));}
  function value(h,r,key) {return domain().dimensionValue(r,key,config(h));}
  function options(h,items,selected) {return items.map(x=>`<option value="${E(h,x[0])}" ${String(x[0])===String(selected)?'selected':''}>${E(h,x[1])}</option>`).join('');}
  function categoryItems(h) {
    const names = [...new Set([...(config(h).categories||[]).map(c=>c.name),...source(h).map(r=>r.category)].filter(Boolean))];
    return [['all','全部类型'],...names.map(x=>[x,x])];
  }
  function filterMarkup(h,compact=false) {
    const f=filters(h), orgs=(config(h).organizations||[]);
    const custom=dims(h).map(d=>{
      const v=f.custom[d.id] || '';
      const control=d.type==='select'?`<select data-geo-custom="${E(h,d.id)}">${options(h,[['','全部'],...(d.options||[]).map(x=>[x,x])],v)}</select>`:`<input data-geo-custom="${E(h,d.id)}" type="${d.type==='number'?'number':d.type==='date'?'date':'text'}" value="${E(h,v)}" placeholder="精确匹配" ${d.type==='number'?'step="any"':''}>`;
      return `<label>${E(h,d.name)}${control}</label>`;
    }).join('');
    return `<details class="geo-filter-shell" ${compact?'':'open'}><summary><span>筛选范围</span><span>${E(h,scopeLabel(h))}</span></summary><div class="geo-filter-grid">
      <label>办理状态<select data-geo-filter="status">${options(h,[['all','全部状态'],['open','未办结（全部在办）'],...STATES.map(x=>[x,x])],f.status)}</select></label>
      <label>问题类型<select data-geo-filter="category">${options(h,categoryItems(h),f.category)}</select></label>
      <label>发生地组织<select data-geo-filter="orgId">${options(h,[['all','全部发生地组织'],...orgs.map(x=>[x.id,x.name+(x.enabled===false?'（已停用）':'')])],f.orgId)}</select></label>
      <label>时间依据<select data-geo-filter="timeField">${options(h,[['createdAt','提交时间'],['closedAt','办结时间']],f.timeField)}</select></label>
      <label>开始日期<input type="date" data-geo-filter="start" value="${E(h,f.start)}"></label>
      <label>结束日期<input type="date" data-geo-filter="end" value="${E(h,f.end)}"></label>
      <label class="geo-keyword">关键词<input type="search" data-geo-filter="keyword" value="${E(h,f.keyword)}" placeholder="标题、地址、编号等"></label>${custom}
      <div class="geo-filter-reset"><button type="button" class="geo-btn geo-btn-soft" data-geo-reset>重置筛选</button></div>
    </div><p class="geo-filter-help">日期按北京时间整日计算；发生地组织包含其下级。地图、指标、图表、明细导出共用本组筛选。</p><p class="geo-filter-error" data-geo-filter-error hidden></p></details>`;
  }
  function scopeLabel(h) {
    const f=filters(h), parts=[f.status==='all'?'全部状态':f.status==='open'?'未办结':f.status];
    if(f.category!=='all')parts.push(f.category);
    if(f.orgId!=='all')parts.push(h.orgName(f.orgId));
    if(f.start||f.end)parts.push(`${f.start||'不限'} 至 ${f.end||'不限'}`);
    const n=Object.values(f.custom).filter(x=>x!==''&&x!=null).length;if(n)parts.push(`${n}项自定义条件`);
    if(f.keyword)parts.push('含关键词');return parts.join(' · ');
  }
  function kpis(h,rs,screen=false) {
    const m=domain().metrics(rs);
    return `<div class="geo-kpis ${screen?'geo-kpis-screen':''}">${[
      ['筛选事项总量',m.total,'当前角色可见事项'],['未办结',m.open,'待接收 / 办理中'],['已办结',m.closed,'当前状态为已办结'],['办结率',number(m.rate,1)+'%','已办结 ÷ 筛选总量'],['平均办结耗时',m.avgHours==null?'—':number(m.avgHours,1)+' 小时',`仅 ${number(m.durationCount)} 条有办结时间记录`]
    ].map(([l,v,s])=>`<div class="geo-kpi"><span>${E(h,l)}</span><strong>${E(h,v)}</strong><small>${E(h,s)}</small></div>`).join('')}</div>`;
  }
  function groupOptions(h,selected) {
    return options(h,[['category','问题类型'],['status','办理状态'],['org','发生地组织'],['owner','当前办理组织'],['day','提交日期'],...dims(h).map(d=>['custom:'+d.id,d.name])],selected);
  }
  function colorOptions(h,selected) {
    return options(h,[['status','办理状态'],['category','问题类型'],...dims(h).filter(d=>d.type==='select').map(d=>['custom:'+d.id,d.name])],selected);
  }
  function colorModel(h,rs) {
    let key=h.ui().mapColor||'status';
    if(key.startsWith('custom:')&&!dims(h).some(d=>'custom:'+d.id===key&&d.type==='select'))key='status';
    let labels;
    if(key==='status')labels=STATES;
    else if(key==='category')labels=categoryItems(h).slice(1).map(x=>x[0]);
    else {const d=dims(h).find(d=>'custom:'+d.id===key);labels=[...(d.options||[])];}
    for(const r of rs){const v=String(value(h,r,key)||'未填写');if(!labels.includes(v))labels.push(v);}
    const getLabel=r=>String(value(h,r,key)||'未填写');
    const colors={};labels.forEach((l,i)=>{const cat=(config(h).categories||[]).find(c=>c.name===l);colors[l]=key==='status'?STATE_COLORS[l]||PALETTE[i%PALETTE.length]:key==='category'&&cat&&/^#[0-9a-f]{6}$/i.test(cat.color)?cat.color:PALETTE[i%PALETTE.length];});
    return {key,labels,colors,getLabel,color:r=>colors[getLabel(r)]||'#6a8196'};
  }
  function legend(h,rs) {
    const cm=colorModel(h,rs);
    return `<div class="geo-legend">${cm.labels.map(l=>`<span><i style="--pin-color:${cm.colors[l]}"></i>${E(h,l)}</span>`).join('')}<span class="geo-shape-key">◆ 未办结　●✓ 已办结</span></div>`;
  }
  function mapCanvas(h,rs,screen=false) {
    const m=domain().metrics(rs);
    return `<div class="geo-map-toolbar"><div><strong>${number(m.located)} 个可定位事项</strong><span class="geo-map-unlocated"> ${number(m.unlocated)} 个未定位，不显示标点</span></div><label>标点配色<select data-geo-color>${colorOptions(h,h.ui().mapColor||'status')}</select></label><button type="button" class="geo-btn geo-btn-soft" data-geo-fit>定位全部标点</button></div>
      <div class="geo-map-frame ${screen?'geo-screen-map-frame':''}"><div id="hn-geo-main-map" class="geo-leaflet" aria-label="事项地图，可拖动与缩放"></div><div class="geo-map-warning" data-geo-tile-warning hidden>底图暂未加载成功。可继续查看已有标点及坐标；请检查网络，稍后可重新进入地图。</div></div>${legend(h,rs)}
      <p class="geo-map-note">底图 OpenFreeMap · © OpenMapTiles · © OpenStreetMap。默认中心为东营周边样板示意，不表示真实辖区边界；样板坐标会明确标注。发生地组织与当前办理组织分别统计。</p>`;
  }
  function issueList(h,rs,short=false) {
    const sorted=[...rs].sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));
    const shown=sorted.slice(0,short?5:80);
    return `<div class="geo-issue-list">${shown.length?shown.map(r=>`<article class="geo-issue"><button type="button" class="geo-issue-title" data-geo-open="${E(h,r.id)}">${E(h,r.title||'未命名事项')}</button><span class="geo-status ${r.status==='已办结'?'closed':''}">${E(h,r.status)}</span><p>${E(h,r.category)} · ${E(h,h.orgName(r.orgId)||r.community||'未分类')}</p><small>${E(h,r.location||'未填写地址')} · ${valid(r)?r.geo.source==='sample'?'样板坐标':'已定位':'未定位'}</small>${valid(r)?`<small class="geo-coordinate">${Number(r.geo.lat).toFixed(5)}, ${Number(r.geo.lng).toFixed(5)}</small>`:''}<div class="geo-issue-actions"><time>${E(h,dateTime(r.createdAt))}</time>${valid(r)?`<button type="button" data-geo-focus="${E(h,r.id)}">地图定位</button>`:''}</div></article>`).join(''):'<div class="geo-empty">当前范围没有事项。调整筛选后查看。</div>'}</div>${sorted.length>shown.length?`<p class="geo-muted">显示最近 ${shown.length} 条，共 ${sorted.length} 条；地图仍显示全部有效点位。</p>`:''}`;
  }
  function header(h,title,desc,actions='') {return `<header class="geo-page-head"><div><div class="geo-eyebrow">警社联动 · V2 沟通样板</div><h1>${E(h,title)}</h1><p>${E(h,desc)}</p></div><div class="geo-actions">${actions}</div></header>`;}
  const metricNames={count:'事项量',closed:'已办结量',open:'未办结量',rate:'办结率',avgHours:'平均办结小时'};
  function metricValue(g,key){return key==='avgHours'?(g.avgHours==null?0:Number(g.avgHours)):Number(g[key]||0);}
  function bars(h,groups,key='count',limit=12) {
    const shown=groups.slice(0,limit), max=Math.max(1,...shown.map(g=>metricValue(g,key)));
    return shown.length?`<div class="geo-bars">${shown.map(g=>`<div class="geo-bar-row"><span title="${E(h,g.label)}">${E(h,g.label)}</span><div class="geo-bar-track"><i style="width:${Math.max(0,Math.min(100,metricValue(g,key)/max*100))}%"></i></div><b>${key==='avgHours'&&g.avgHours==null?'—':number(metricValue(g,key),key==='rate'||key==='avgHours'?1:0)}${key==='rate'?'%':''}</b></div>`).join('')}</div>${groups.length>limit?`<p class="geo-muted">图表显示前${limit}组；完整分组见表格与导出。</p>`:''}`:'<div class="geo-empty">当前筛选没有可统计事项。</div>';
  }
  function trend(h,rs) {
    const groups=domain().groupRecords(rs,'day',config(h)).filter(g=>/^\d{4}-\d{2}-\d{2}$/.test(g.key)).sort((a,b)=>a.key.localeCompare(b.key));
    const shown=groups.slice(-14);if(!shown.length)return '<div class="geo-empty">暂无有效提交日期。</div>';
    const max=Math.max(1,...shown.map(x=>x.count));
    return `<div class="geo-trend" role="img" aria-label="最近14个有数据日期的事项量">${shown.map(g=>`<div class="geo-trend-col" title="${E(h,g.key)}：${g.count}条"><b>${g.count}</b><div><i style="height:${Math.max(3,g.count/max*100)}%"></i></div><span>${E(h,g.key.slice(5))}</span></div>`).join('')}</div><p class="geo-muted">按提交日期统计，展示最近 ${shown.length} 个有数据日期；当前筛选仍以所选时间依据计算。</p>`;
  }
  function groupTable(h,groups) {
    return `<div class="geo-table-wrap"><table class="geo-table"><thead><tr><th>分组</th><th>事项量</th><th>未办结</th><th>已办结</th><th>办结率</th><th>平均办结耗时（小时）</th></tr></thead><tbody>${groups.length?groups.map(g=>`<tr><td>${E(h,g.label)}</td><td>${number(g.count)}</td><td>${number(g.open)}</td><td>${number(g.closed)}</td><td>${number(g.rate,1)}%</td><td>${number(g.avgHours,1)}</td></tr>`).join(''):'<tr><td colspan="6" class="geo-empty">无匹配记录</td></tr>'}</tbody></table></div>`;
  }
  function reportsView(h) {
    const rs=filtered(h), group=h.ui().reportGroup||'category', key=h.ui().reportMetric||'count';
    const groups=domain().groupRecords(rs,group,config(h));
    const exports=h.can('export')?'<button type="button" class="geo-btn geo-btn-soft" data-geo-export="records">导出事项CSV</button><button type="button" class="geo-btn geo-btn-soft" data-geo-export="groups">导出分组CSV</button>':'';
    return `<section class="geo-root geo-report" data-geo-root="reports">${header(h,'统计报表','以当前角色可见事项为数据范围，指标、图表、表格与CSV采用相同筛选。',`${exports}<button type="button" class="geo-btn geo-btn-primary" data-geo-print>打印报表</button>`)}${filterMarkup(h)}<div class="geo-print-scope">筛选范围：${E(h,scopeLabel(h))}；生成时间：${E(h,dateTime(new Date().toISOString()))}</div>${kpis(h,rs)}<div class="geo-report-controls"><label>分组维度<select data-geo-group>${groupOptions(h,group)}</select></label><label>图表指标<select data-geo-metric>${options(h,Object.entries(metricNames),key)}</select></label><span>平均耗时仅统计同时具有有效提交及办结时间的已办结事项。</span></div><div class="geo-report-charts"><section class="geo-panel"><h2>分组对比 <small>${E(h,metricNames[key]||'事项量')}</small></h2>${bars(h,groups,key)}</section><section class="geo-panel"><h2>提交趋势</h2>${trend(h,rs)}</section></div><section class="geo-panel geo-report-table"><h2>分组统计明细 <span>${groups.length}组</span></h2>${groupTable(h,groups)}<p class="geo-muted">“—”表示缺少有效办结时间样本。发生地组织与当前办理组织为不同维度；办结率按当前状态计算。</p></section></section>`;
  }
  function screenView(h) {
    const rs=filtered(h), cats=domain().groupRecords(rs,'category',config(h));
    return `<section class="geo-root geo-screen" data-geo-root="screen"><header class="geo-screen-head"><div><p>东三路派出所 · 山东合能科技有限责任公司</p><h1>警社联动 · 诉求运行分析</h1><small>本地页面 · 示意数据与坐标 · 当前角色可见范围</small></div><div class="geo-screen-tools"><time data-geo-clock></time><div><button type="button" class="geo-btn" data-geo-fullscreen>进入全屏</button><button type="button" class="geo-btn" data-geo-nav="overview">返回主页</button></div></div></header>${filterMarkup(h,true)}${kpis(h,rs,true)}<div class="geo-screen-grid"><section class="geo-panel geo-screen-map"><h2>事项空间分布</h2>${mapCanvas(h,rs,true)}</section><section class="geo-panel geo-screen-types"><h2>问题类型分布</h2>${bars(h,cats,'count',6)}</section><section class="geo-panel geo-screen-trend"><h2>提交趋势</h2>${trend(h,rs)}</section><section class="geo-panel geo-screen-recent"><h2>筛选事项 <span>${rs.length} 件</span></h2>${issueList(h,rs)}</section></div><footer class="geo-screen-footer">群众自主选择接收单位，公安、社区、物业分别独立接收、分类、办理并办结。统计口径：${E(h,scopeLabel(h))}</footer></section>`;
  }
  function view(h,name) {return name==='reports'?reportsView(h):screenView(h);}
  function listen(el,event,fn){el.addEventListener(event,fn);cleanups.push(()=>el.removeEventListener(event,fn));}
  function dispose(){for(const id of timers)clearInterval(id);timers=[];for(const fn of cleanups.splice(0))try{fn();}catch(_){}for(const m of maps.splice(0))try{m.stop();/* Leaflet 1.9.4 leaves a zoom-transition timeout queued after remove(). */m._animatingZoom=false;m.remove();}catch(_){}}
  function pinIcon(h,r,cm) {
    const closed=r.status==='已办结';
    return window.L.divIcon({className:'geo-marker-wrap',html:`<span class="geo-task-pin ${closed?'is-closed':'is-open'}" style="--pin-color:${cm.color(r)}"><b>${closed?'✓':''}</b></span>`,iconSize:[26,30],iconAnchor:[13,16],popupAnchor:[0,-17]});
  }
  function removeFailedBasemap(map,layer) {
    if(!layer)return;
    // Leaflet registers getEvents() before adapter.onAdd(). If _initGL throws,
    // the layer is registered despite being only partially initialized.
    try{if(layer.getEvents)map.off(layer.getEvents(),layer);}catch(_){}
    try{if(map._proxy&&window.L.DomEvent)window.L.DomEvent.off(map._proxy,window.L.DomUtil.TRANSITION_END,layer._transitionEnd,layer);}catch(_){}
    try{if(layer._glMap&&typeof layer._glMap.remove==='function')layer._glMap.remove();}catch(_){}
    try{if(layer._container?.parentNode)layer._container.parentNode.removeChild(layer._container);}catch(_){}
    layer._glMap=null;
    // The adapter's original onRemove assumes GL initialization completed.
    // Override only this failed instance so Leaflet can finish deregistration.
    layer.onRemove=function(){};
    try{map.removeLayer(layer);}catch(_){try{delete map._layers[window.L.stamp(layer)];}catch(__){}}
    layer._map=null;layer._mapToAdd=null;
    try{layer.off();}catch(_){}
  }
  function makeMap(h,id,rs,picker=false) {
    const el=document.getElementById(id);if(!el)return null;
    if(!window.L){el.innerHTML='<div class="geo-empty">地图组件加载失败。事项与坐标仍可在列表中查看，请刷新页面重试。</div>';return null;}
    const settings=config(h).settings||{}, center=Array.isArray(settings.center)?settings.center:[37.44,118.66];
    const map=window.L.map(el,{scrollWheelZoom:!picker,zoomControl:true,attributionControl:true,minZoom:1,maxZoom:19,maxBounds:[[-85.05112878,-180],[85.05112878,180]],maxBoundsViscosity:1}).setView(center,Number(settings.zoom)||13);maps.push(map);
    const attribution='<a href="https://openfreemap.org/" target="_blank" rel="noopener">OpenFreeMap</a> · © <a href="https://openmaptiles.org/" target="_blank" rel="noopener">OpenMapTiles</a> · © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>';
    map.attributionControl.addAttribution(attribution);
    const warning=message=>{if(!maps.includes(map)||!el.isConnected)return;const warn=el.parentElement?.querySelector('[data-geo-tile-warning]');if(warn){warn.textContent=message;warn.hidden=false;}};
    const canvasFallback=()=>{
      if(!window.HNCanvasBasemap?.addTo){warning('当前环境未启用WebGL，Canvas兼容底图组件尚未加载。事项标点、坐标与手动选点仍可使用。');return;}
      warning('正在加载地图…');
      let failed=false;
      const handle=window.HNCanvasBasemap.addTo(map,settings,()=>{failed=true;warning('底图数据加载失败，请检查网络。事项标点、坐标及手动选点仍可使用。');});
      cleanups.push(()=>handle.remove());
      handle.ready.then(layer=>{if(layer&&maps.includes(map)&&el.isConnected)layer.once('tileload',()=>{const warn=el.parentElement?.querySelector('[data-geo-tile-warning]');if(warn&&!failed)warn.hidden=true;});});
    };
    if(!window.maplibregl||typeof window.L.maplibreGL!=='function') {
      canvasFallback();
    } else if(typeof window.maplibregl.supported==='function'&&!window.maplibregl.supported()) {
      canvasFallback();
    } else {
      let layer=null;
      try {
        // Keep the GL canvas beneath Leaflet's marker and popup panes. The GL
        // map is non-interactive; Leaflet owns pointer, touch and zoom events.
        layer=window.L.maplibreGL({style:settings.vectorStyleUrl||'https://tiles.openfreemap.org/styles/liberty',pane:'tilePane',interactive:false,attributionControl:false});
        layer.addTo(map);
        const gl=layer.getMaplibreMap();
        const error=()=>warning('矢量底图加载失败，可能受网络或WebGL限制。可继续操作事项标点、查看坐标或手动选点。');
        gl.on('error',error);cleanups.push(()=>gl.off('error',error));
        const canvas=gl.getCanvas();
        if(canvas)listen(canvas,'webglcontextlost',()=>warning('WebGL绘图环境已中断。事项标点和坐标仍保留；请刷新页面恢复底图。'));
      } catch(error) {
        console.warn('Basemap initialization failed',error.message);
        removeFailedBasemap(map,layer);
        canvasFallback();
      }
    }
    // Cancel delayed resize before disposing the map; Leaflet retains _container after remove().
    const resizeFrame=requestAnimationFrame(()=>{if(maps.includes(map)&&el.isConnected)map.invalidateSize();});
    cleanups.push(()=>cancelAnimationFrame(resizeFrame));
    return map;
  }
  function mountMap(h,root,rs) {
    const map=makeMap(h,'hn-geo-main-map',rs);if(!map)return;
    const cm=colorModel(h,rs), marked=new Map(), bounds=[];
    rs.filter(valid).forEach(r=>{
      const pos=[Number(r.geo.lat),Number(r.geo.lng)], marker=window.L.marker(pos,{icon:pinIcon(h,r,cm)}).addTo(map);bounds.push(pos);marked.set(r.id,marker);
      marker.bindPopup(`<div class="geo-popup"><strong>${E(h,r.title)}</strong><p>${E(h,r.category)} · ${E(h,r.status)}</p><p>${E(h,r.location||'未填写地址')}</p><small>${pos[0].toFixed(6)}, ${pos[1].toFixed(6)}${r.geo.source==='sample'?' · 样板示意坐标':r.geo.source==='device'?' · 设备定位':' · 手动选点'}</small><button type="button" data-geo-open="${E(h,r.id)}">查看事项详情</button></div>`);
    });
    const fit=()=>{if(bounds.length===1)map.setView(bounds[0],15);else if(bounds.length)map.fitBounds(bounds,{padding:[35,35],maxZoom:15});else {const s=config(h).settings||{};map.setView(s.center||[37.44,118.66],s.zoom||13);h.toast('当前范围没有有效定位，显示样板默认中心');}};
    const viewport=h.ui().geoMapViewport;
    if(viewport&&Array.isArray(viewport.center))map.setView(viewport.center,viewport.zoom);else if(bounds.length)fit();
    map.on('moveend',()=>{const p=map.getCenter();h.ui().geoMapViewport={center:[p.lat,p.lng],zoom:map.getZoom()};});
    const fitButton=root.querySelector('[data-geo-fit]');if(fitButton)listen(fitButton,'click',fit);
    listen(root,'click',e=>{const b=e.target.closest('[data-geo-focus]');if(!b)return;const m=marked.get(b.dataset.geoFocus);if(m){map.setView(m.getLatLng(),Math.max(15,map.getZoom()));m.openPopup();root.querySelector('#hn-geo-main-map').scrollIntoView({block:'nearest',behavior:'smooth'});}});
  }
  function csvCell(v){let s=String(v==null?'':v);if(/^[=+\-@\t\r]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';}
  function csv(rows){return '\uFEFF'+rows.map(r=>r.map(csvCell).join(',')).join('\r\n');}
  function exportCSV(h,kind) {
    if(!h.can('export')){h.toast('当前角色没有导出权限');return;}
    const rs=filtered(h),ds=dims(h);let rows;
    if(kind==='groups')rows=[['分组','事项量','未办结','已办结','办结率(%)','平均办结耗时(小时)'],...domain().groupRecords(rs,h.ui().reportGroup||'category',config(h)).map(g=>[g.label,g.count,g.open,g.closed,g.rate,g.avgHours==null?'':g.avgHours])];
    else rows=[['编号','标题','类型','状态','发生地组织','当前办理组织','发生地址','提交时间(北京时间)','办结时间(北京时间)','纬度','经度','坐标来源',...ds.map(d=>d.name)],...rs.map(r=>[r.id,r.title,r.category,r.status,h.orgName(r.orgId)||r.community,h.orgName(r.owner),r.location,dateTime(r.createdAt),r.closedAt?dateTime(r.closedAt):'',valid(r)?r.geo.lat:'',valid(r)?r.geo.lng:'',r.geo?.source||'',...ds.map(d=>r.custom?.[d.id]??'')])];
    h.download(`警社联动_${kind==='groups'?'分组统计':'筛选事项'}_${new Date().toISOString().slice(0,10)}.csv`,csv(rows),'text/csv;charset=utf-8');
  }
  function mount(h,name) {
    const root=document.querySelector(`[data-geo-root="${name}"]`);if(!root)return;
    listen(root,'change',e=>{
      const t=e.target;
      if(t.matches('[data-geo-filter],[data-geo-custom]')){
        const f=filters(h);if(t.dataset.geoFilter)f[t.dataset.geoFilter]=t.value;else {if(t.value==='')delete f.custom[t.dataset.geoCustom];else f.custom[t.dataset.geoCustom]=t.value;}
        if(f.start&&f.end&&f.start>f.end){const msg=root.querySelector('[data-geo-filter-error]');msg.hidden=false;msg.textContent='开始日期不能晚于结束日期。请调整后再应用。';return;}
        saveFilters(h,f);h.render();
      }else if(t.matches('[data-geo-color]')){h.ui().mapColor=t.value;h.render();}
      else if(t.matches('[data-geo-group]')){h.ui().reportGroup=t.value;h.render();}
      else if(t.matches('[data-geo-metric]')){h.ui().reportMetric=t.value;h.render();}
    });
    listen(root,'click',async e=>{
      const open=e.target.closest('[data-geo-open]');if(open){h.openCase(open.dataset.geoOpen);return;}
      const nav=e.target.closest('[data-geo-nav]');if(nav){if(document.fullscreenElement)try{await document.exitFullscreen();}catch(_){}h.navigate(nav.dataset.geoNav);return;}
      if(e.target.closest('[data-geo-reset]')){saveFilters(h,defaults());h.render();return;}
      const ex=e.target.closest('[data-geo-export]');if(ex){exportCSV(h,ex.dataset.geoExport);return;}
      if(e.target.closest('[data-geo-print]')){window.print();return;}
      const fs=e.target.closest('[data-geo-fullscreen]');if(fs){try{if(document.fullscreenElement)await document.exitFullscreen();else if(root.requestFullscreen)await root.requestFullscreen();else h.toast('当前浏览器不支持全屏，请使用浏览器的全屏功能');}catch(_){h.toast('浏览器未允许全屏，可继续使用当前大屏布局');}}
    });
    if(name==='map'||name==='screen')mountMap(h,root,filtered(h));
    if(name==='screen'){
      const tick=()=>{const el=root.querySelector('[data-geo-clock]');if(el)el.textContent=new Date().toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false});};tick();timers.push(setInterval(tick,1000));
      const fullscreen=()=>{const b=root.querySelector('[data-geo-fullscreen]');if(b)b.textContent=document.fullscreenElement?'退出全屏':'进入全屏';for(const m of maps)try{m.invalidateSize();}catch(_){}};listen(document,'fullscreenchange',fullscreen);fullscreen();
    }
  }
  function renderPicker(h,containerId,onChange) {
    const el=document.getElementById(containerId);if(!el)return;
    const id='hn-geo-picker-'+Math.random().toString(36).slice(2,9);
    el.innerHTML=`<div class="geo-picker"><div id="${id}" class="geo-picker-map" aria-label="点击地图或拖动标点选择发生位置"></div><div class="geo-map-warning" data-geo-tile-warning hidden>底图加载失败；仍可拖动选点或手动填写经纬度。</div><p>点击地图或拖动标点修正位置；不会自动申请定位或地理编码。默认地图中心仅作示意。</p><div class="geo-picker-fields"><label>纬度<input type="number" step="any" min="-90" max="90" data-geo-picker-lat></label><label>经度<input type="number" step="any" min="-180" max="180" data-geo-picker-lng></label><button type="button" class="geo-btn geo-btn-soft" data-geo-picker-apply>应用坐标</button></div><small data-geo-picker-caption>尚未选定位置。点击地图或输入有效坐标后应用。</small></div>`;
    const map=makeMap(h,id,[],true), initial=h.ui().formGeo;
    let marker=null;
    const lat=el.querySelector('[data-geo-picker-lat]'),lng=el.querySelector('[data-geo-picker-lng]'),caption=el.querySelector('[data-geo-picker-caption]');
    const setPoint=(a,b,notify=true)=>{
      a=Number(a);b=Number(b);if(!domain().validateCoordinates(a,b)){h.toast('请输入有效经纬度：纬度-90到90，经度-180到180');return;}
      lat.value=a.toFixed(6);lng.value=b.toFixed(6);
      if(map){if(marker)marker.setLatLng([a,b]);else {marker=window.L.marker([a,b],{draggable:true}).addTo(map);marker.on('dragend',()=>{const p=marker.getLatLng();setPoint(p.lat,p.lng);});}}
      caption.textContent=`已选 ${a.toFixed(6)}, ${b.toFixed(6)}；请继续核对并填写准确文字地址。`;
      if(notify)onChange({lat:a,lng:b,accuracy:null,source:'manual',capturedAt:new Date().toISOString()});
    };
    if(initial&&domain().validateCoordinates(Number(initial.lat),Number(initial.lng))){setPoint(initial.lat,initial.lng,false);if(map)map.setView([initial.lat,initial.lng],16);}
    if(map)map.on('click',e=>setPoint(e.latlng.lat,e.latlng.lng));
    listen(el.querySelector('[data-geo-picker-apply]'),'click',()=>{if(lat.value===''||lng.value===''){h.toast('请同时填写纬度和经度');return;}setPoint(lat.value,lng.value);if(map&&marker)map.panTo(marker.getLatLng());});
  }
  window.HNGeo={view,mount,dispose,renderPicker};
})();

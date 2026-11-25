/* Shared definitions for map, dashboard, report and exports. */
(function (root) {
  'use strict';
  const valid = (lat,lng) => typeof lat === 'number' && typeof lng === 'number' && Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat)<=90 && Math.abs(lng)<=180;
  const dateKey = iso => { const n=Date.parse(iso); return Number.isFinite(n)?new Date(n+8*3600000).toISOString().slice(0,10):''; };
  function descendants(id,orgs=[]) {
    const ids=new Set([id]); let changed=true;
    while(changed){changed=false;for(const org of orgs)if(ids.has(org.parentId)&&!ids.has(org.id)){ids.add(org.id);changed=true;}}
    return [...ids];
  }
  function filterRecords(records,filters={},config={}) {
    const area=filters.orgId&&filters.orgId!=='all'?new Set(descendants(filters.orgId,config.organizations)):null;
    const query=String(filters.keyword||'').trim().toLocaleLowerCase();
    return records.filter(r=>{
      if(filters.status&&filters.status!=='all'&&(filters.status==='open'?r.status==='已办结':r.status!==filters.status))return false;
      if(filters.category&&filters.category!=='all'&&r.category!==filters.category)return false;
      if(area&&!area.has(r.orgId))return false;
      if(filters.start||filters.end){const day=dateKey(r[filters.timeField==='closedAt'?'closedAt':'createdAt']);if(!day||(filters.start&&day<filters.start)||(filters.end&&day>filters.end))return false;}
      if(Object.entries(filters.custom||{}).some(([key,val])=>val!==''&&val!=='all'&&val!=null&&String(r.custom?.[key]??'')!==String(val)))return false;
      return !query||[r.id,r.title,r.category,r.community,r.location,r.description].some(x=>String(x||'').toLocaleLowerCase().includes(query));
    });
  }
  function metrics(records) {
    const closed=records.filter(r=>r.status==='已办结');
    const durations=closed.map(r=>(Date.parse(r.closedAt)-Date.parse(r.createdAt))/3600000).filter(n=>Number.isFinite(n)&&n>=0);
    const located=records.filter(r=>r.geo&&valid(r.geo.lat,r.geo.lng)).length;
    return {total:records.length,open:records.length-closed.length,closed:closed.length,rate:records.length?closed.length/records.length*100:0,located,unlocated:records.length-located,avgHours:durations.length?durations.reduce((a,b)=>a+b,0)/durations.length:null,durationCount:durations.length};
  }
  function dimensionValue(r,key,config={}) {
    if(key==='org'||key==='owner'){const id=key==='org'?r.orgId:r.owner;return(config.organizations||[]).find(x=>x.id===id)?.name||id||'未分配';}
    if(key==='day')return dateKey(r.createdAt)||'日期未知';
    const val=key.startsWith('custom:')?r.custom?.[key.slice(7)]:r[key];
    return val==null||val===''?'未填写':String(val);
  }
  function groupRecords(records,key,config) {
    const groups=new Map();
    for(const r of records){const label=dimensionValue(r,key,config);if(!groups.has(label))groups.set(label,[]);groups.get(label).push(r);}
    return [...groups].map(([label,rs])=>({key:label,label,...metrics(rs),count:rs.length})).sort((a,b)=>b.count-a.count||a.label.localeCompare(b.label,'zh-CN'));
  }
  root.HNDomain={descendants,filterRecords,groupRecords,metrics,dimensionValue,validateCoordinates:valid,dateKey};
})(window);

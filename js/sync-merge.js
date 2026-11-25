/* Three-way merge: never silently replace concurrent edits to the same entity. */
(function(root){
  'use strict';
  const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
  const copy=x=>x===undefined?undefined:JSON.parse(JSON.stringify(x));
  root.HNSyncMerge=function(base,local,remote){
    const conflicts=[];
    function value(b,l,r,path){
      if(equal(l,b))return copy(r);
      if(equal(r,b)||equal(l,r))return copy(l);
      conflicts.push(path);return copy(l);
    }
    function entities(b=[],l=[],r=[],path){
      const bm=new Map(b.map(x=>[x.id,x])),lm=new Map(l.map(x=>[x.id,x])),rm=new Map(r.map(x=>[x.id,x]));
      const ids=new Set([...r.map(x=>x.id),...l.map(x=>x.id)]);
      return [...ids].map(id=>value(bm.get(id),lm.get(id),rm.get(id),path+':'+id)).filter(x=>x!==undefined);
    }
    const result={version:2,records:entities(base?.records,local.records,remote.records,'records'),config:{}};
    const bc=base?.config||{},lc=local.config||{},rc=remote.config||{};
    for(const key of new Set([...Object.keys(lc),...Object.keys(rc)])){
      result.config[key]=Array.isArray(lc[key])&&Array.isArray(rc[key])?entities(bc[key],lc[key],rc[key],'config.'+key):value(bc[key],lc[key],rc[key],'config.'+key);
    }
    return{data:result,conflicts};
  };
})(window);

(function(root){
 'use strict';
 function compatible(base,type){return base==='community'?['community','grid'].includes(type):base===type;}
 function profile(config,id){
   const staff=config.staff.find(x=>x.id===id&&x.enabled!==false),role=staff&&config.roles.find(x=>x.id===staff.roleId&&x.enabled!==false);
   if(!staff||!role)return null;
   let org=config.organizations.find(x=>x.id===staff.orgId),visited=new Set();
   if(!org||!compatible(role.base,org.type))return null;
   while(org){if(org.enabled===false||visited.has(org.id))return null;visited.add(org.id);if(!org.parentId)break;org=config.organizations.find(x=>x.id===org.parentId);if(!org)return null;}
   return{staff,role};
 }
 function can(config,id,permission){const p=profile(config,id);return !!p&&(permission==='overview'||p.role.permissions.includes(permission));}
 function visible(rows,config,id){
   const p=profile(config,id);if(!p)return[];if(p.role.scope==='all')return rows;
   const ids=new Set(p.role.scope==='branch'?root.HNDomain.descendants(p.staff.orgId,config.organizations):[p.staff.orgId]);
   return rows.filter(r=>ids.has(r.owner));
 }
 function allowed(r,action,config,id){
   const permission={complete:'close',classify:'accept'}[action]||action;
   const p=profile(config,id);
   if(!r||!p||!can(config,id,permission)||r.owner!==p.staff.orgId)return false;
   switch(action){
     case'accept':return r.status==='待接收';
     case'classify':case'note':return r.status==='办理中';
     case'complete':return r.status==='办理中'&&!!r.category&&r.category!=='待分类';
     default:return false;
   }
 }
 root.HNPolicy={profile,can,visible,allowed,compatible};
})(window);

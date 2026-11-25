/* Standalone download: browser-only persistence, with no backend or API calls. */
(function(root){
  'use strict';
  const copy=value=>value===undefined?undefined:JSON.parse(JSON.stringify(value));
  function create({getData,onStatus=()=>{},storageKey,initial={}}){
    let base=copy(initial.base||null),revision=Number(initial.revision)||0,dirty=true,disposed=false,lastSaved=null;
    let status={mode:'loading',message:'正在检查本机保存'};
    function current(){return {mode:status.mode,dirty,revision,lastSynced:lastSaved,message:status.message,conflicts:[]};}
    function snapshot(){return {data:copy(getData()),base:copy(base),revision,dirty,status:copy(current())};}
    function emit(mode,message){status={mode,message};if(!disposed)onStatus(current());}
    function persist(){
      if(disposed)return Promise.resolve(snapshot());
      dirty=true;emit('syncing','正在保存到当前浏览器');
      try{
        const next=copy(getData()),nextRevision=revision+1;
        const envelope={data:next,base:copy(next),revision:nextRevision,dirty:false};
        root.localStorage.setItem(storageKey,JSON.stringify(envelope));
        // A successful storage write is the only path that acknowledges changes.
        base=next;revision=nextRevision;dirty=false;lastSaved=new Date().toISOString();
        emit('synced','已保存本机，仅当前浏览器可见。移动或改名HTML、清理浏览器数据或换浏览器可能无法找回，请定期下载JSON备份。');
      }catch(_){
        dirty=true;
        emit('error','本机保存失败，当前修改仅留在此页面内存中，关闭或刷新可能丢失。请立即点击“下载本机备份”导出JSON；检查浏览器存储权限或空间后可重新保存。');
      }
      return Promise.resolve(snapshot());
    }
    return {start:persist,save:persist,retry:persist,resolve:()=>Promise.resolve(snapshot()),snapshot,dispose(){disposed=true;}};
  }
  // Preserve the app facade while replacing online synchronization entirely.
  root.HNCloud={create};
})(window);

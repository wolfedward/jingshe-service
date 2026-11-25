(function(root){'use strict';root.HNLocation=(geo,secure)=>new Promise((resolve,reject)=>{
 if(!secure)return reject(new Error('设备定位需要HTTPS安全页面。您可以使用地图手动选点。'));
 if(!geo?.getCurrentPosition)return reject(new Error('当前浏览器不支持设备定位，请使用地图手动选点。'));
 geo.getCurrentPosition(position=>{const c=position.coords;if(!root.HNDomain.validateCoordinates(c.latitude,c.longitude))return reject(new Error('设备没有返回有效位置，请手动选点。'));resolve({lat:c.latitude,lng:c.longitude,accuracy:Number.isFinite(c.accuracy)&&c.accuracy>=0?c.accuracy:null,source:'device',capturedAt:new Date(position.timestamp||Date.now()).toISOString()});},error=>reject(new Error(({1:'未获得定位授权，请使用地图手动选点。',2:'暂时无法确定位置，请到信号较好的地方重试或手动选点。',3:'定位超时，请重试或手动选点。'})[error.code]||'定位失败，请使用地图手动选点。')),{enableHighAccuracy:true,maximumAge:0,timeout:15000});
});})(window);

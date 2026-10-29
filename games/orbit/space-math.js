/* Shared pinhole camera and ray/sphere math for rendering and deterministic tests. */
(function(root){
  'use strict';
  const FOV=58,TAN=Math.tan(FOV*Math.PI/360),IMPACT_DEPTH=8;
  function validPoint(p){return !!p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=0&&p.x<=1&&p.y>=.14&&p.y<=.88;}
  function worldAt(point,depth,aspect=16/9){return {x:(point.x*2-1)*depth*TAN*aspect,y:(1-point.y*2)*depth*TAN,z:-depth};}
  function project(position,aspect=16/9){
    const depth=-position.z;if(depth<=0)return null;
    return {x:.5+position.x/(2*depth*TAN*aspect),y:.5-position.y/(2*depth*TAN)};
  }
  function ray(point,aspect=16/9){
    if(!validPoint(point))return null;
    const p=worldAt(point,1,aspect),length=Math.hypot(p.x,p.y,p.z);
    return {x:p.x/length,y:p.y/length,z:p.z/length};
  }
  function nearest(enemies,point,aspect=16/9){
    const direction=ray(point,aspect);if(!direction)return null;
    let result=null;
    for(const enemy of enemies){
      const p=enemy.position,r=enemy.radius*1.12;
      if(!p||p.z>=0||!Number.isFinite(r))continue;
      const along=p.x*direction.x+p.y*direction.y+p.z*direction.z;
      const perpendicular=p.x*p.x+p.y*p.y+p.z*p.z-along*along;
      if(along<=0||perpendicular>r*r)continue;
      const distance=Math.max(0,along-Math.sqrt(Math.max(0,r*r-perpendicular)));
      if(!result||distance<result.distance)result={enemy,distance,position:{x:direction.x*distance,y:direction.y*distance,z:direction.z*distance}};
    }
    return result;
  }
  const api={FOV,TAN,IMPACT_DEPTH,worldAt,project,ray,nearest,validPoint};
  root.SpaceMath=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);

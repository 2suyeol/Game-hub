/* W3C intrinsic Z-X'-Y'' device orientation, relative to a user-set reference. */
(function(root){
  "use strict";
  const radians=degrees=>degrees*Math.PI/180;
  function valid(sample) {return !!sample&&["alpha","beta","gamma"].every(key=>typeof sample[key]==="number"&&Number.isFinite(sample[key]));}
  function multiply(a,b) {return a.map(row=>b[0].map((_,j)=>row.reduce((sum,v,k)=>sum+v*b[k][j],0)));}
  function matrix(sample) {
    if(!valid(sample)) return null;
    const a=radians(sample.alpha),b=radians(sample.beta),g=radians(sample.gamma);
    const ca=Math.cos(a),sa=Math.sin(a),cb=Math.cos(b),sb=Math.sin(b),cg=Math.cos(g),sg=Math.sin(g);
    return multiply(multiply([[ca,-sa,0],[sa,ca,0],[0,0,1]],[[1,0,0],[0,cb,-sb],[0,sb,cb]]),[[cg,0,sg],[0,1,0],[-sg,0,cg]]);
  }
  function aim(reference,sample,sensitivity=1) {
    const rotation=matrix(sample);
    if(!reference||!rotation) return null;
    // The phone's top edge is the pointing axis (+Y). Transform it back into
    // the calibrated phone frame; rotation about this axis does not move aim.
    const direction=rotation.map(row=>row[1]);
    const local=[0,1,2].map(i=>reference.reduce((sum,row,k)=>sum+row[i]*direction[k],0));
    if(local[1]<.2) return null; // Facing away: do not wrap across the playfield.
    const yaw=Math.atan2(local[0],local[1]);
    const pitch=Math.atan2(local[2],Math.hypot(local[0],local[1]));
    return {x:.5+yaw/radians(70)*sensitivity,y:.5-pitch/radians(50)*sensitivity};
  }
  const api={valid,matrix,aim};
  root.PhoneMotion=api;
  if(typeof module!=="undefined"&&module.exports) module.exports=api;
})(typeof globalThis!=="undefined"?globalThis:this);

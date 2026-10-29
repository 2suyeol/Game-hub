(function(root){
  'use strict';
  const timing={sensorGrace:1800,sensorFire:500,inputGrace:1500,fireGrace:400,lease:8000};
  class AimSmoother {
    constructor(){this.clear();}
    clear(){this.point=null;this.target=null;}
    push(point){
      if(!point||!Number.isFinite(point.x)||!Number.isFinite(point.y))return;
      this.target={x:point.x,y:point.y};if(!this.point)this.point={...this.target};
    }
    step(seconds){
      if(!this.point||!this.target)return null;
      // Time-based easing: identical response at 30, 60 and 120 Hz. No prediction.
      const blend=1-Math.exp(-Math.max(0,Math.min(.1,seconds))/.055);
      this.point.x+=(this.target.x-this.point.x)*blend;
      this.point.y+=(this.target.y-this.point.y)*blend;
      return this.point;
    }
  }
  class InputStream {
    constructor({url,key,lease,onFatal=()=>{},onInterrupted=()=>{},Socket=root.WebSocket,clock=()=>performance.now()}){
      Object.assign(this,{url,key,lease,onFatal,onInterrupted,Socket,clock});
      this.socket=null;this.ready=false;this.retryAt=0;this.lastAck=0;this.closed=false;
    }
    maintain(){
      const now=this.clock();
      if(this.closed||!this.Socket)return;
      if(this.socket&&now-this.lastAck>1500){this.disconnect();this.onInterrupted();}
      if(this.socket||now<this.retryAt)return;
      let socket;
      try{socket=new this.Socket(this.url);}catch{this.retryAt=now+2000;return;}
      this.socket=socket;this.lastAck=now;
      socket.onopen=()=>{if(this.socket===socket)socket.send(JSON.stringify({type:'auth',key:this.key,lease:this.lease}));};
      socket.onmessage=event=>{
        if(this.socket!==socket)return;
        let data;try{data=JSON.parse(event.data);}catch{return;}
        if(data.type==='ready'||data.type==='ack'){this.ready=true;this.lastAck=this.clock();}
        if(data.type==='error'){this.disconnect();if([401,409].includes(data.status))this.onFatal(data.status);}
      };
      socket.onerror=()=>{if(this.socket===socket){this.disconnect();this.onInterrupted();}};
      socket.onclose=()=>{if(this.socket===socket){this.disconnect();this.onInterrupted();}};
    }
    send(packet){
      this.maintain();
      if(!this.ready||this.socket?.readyState!==1)return false;
      // Never queue a trail of old aim positions behind a congested connection.
      if(this.socket.bufferedAmount>2048){this.disconnect();this.onInterrupted();return false;}
      try{this.socket.send(JSON.stringify({type:'input',...packet}));return true;}
      catch{this.disconnect();this.onInterrupted();return false;}
    }
    disconnect(){
      const socket=this.socket;this.socket=null;this.ready=false;this.retryAt=this.clock()+1500;
      if(socket){socket.onopen=socket.onmessage=socket.onerror=socket.onclose=null;socket.close();}
    }
    close(){this.closed=true;this.disconnect();}
  }
  const api={timing,AimSmoother,InputStream};root.PhoneInput=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);

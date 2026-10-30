/* Orthographic Canvas 2D renderer for the same simulated assets when WebGL is unavailable. */
(function(){
 'use strict';
 window.CMSTwinView=function(host,options={}){
   const c=document.createElement('canvas');c.setAttribute('aria-label','Compatibility 3D view: drag to orbit the model');c.setAttribute('role','img');c.style.cssText='width:100%;height:100%;display:block;touch-action:none';host.appendChild(c);
   const ctx=c.getContext('2d');let state=options.initialState||null,yaw=-.28,zoom=1,drag=null,view='control',w=800,h=400;
   let pose={...CMSCamera.views.control.flat},motion=null,autoMode=false,pan=0,lastFrame=performance.now(),lastDraw=0;
   const screenCanvas=document.createElement('canvas');screenCanvas.width=320;screenCanvas.height=180;const screenCtx=screenCanvas.getContext('2d');
   function manual(){motion=null;autoMode=false;if(options.onManual)options.onManual();}
   c.tabIndex=0;

   function size(){const r=host.getBoundingClientRect();w=Math.max(1,r.width);h=Math.max(1,r.height);c.width=w*Math.min(devicePixelRatio||1,1.5);c.height=h*Math.min(devicePixelRatio||1,1.5);draw();}
   new ResizeObserver(size).observe(host);size();
   c.addEventListener('pointerdown',e=>{manual();drag={x:e.clientX,yaw};c.setPointerCapture(e.pointerId);});
   c.addEventListener('pointermove',e=>{if(drag){yaw=drag.yaw+(e.clientX-drag.x)*.007;draw();}});c.addEventListener('pointerup',()=>drag=null);c.addEventListener('pointercancel',()=>drag=null);
   c.addEventListener('wheel',e=>{e.preventDefault();manual();zoom=Math.max(.65,Math.min(1.8,zoom-e.deltaY*.001));draw();},{passive:false});
   function draw(){if(!ctx||!host.offsetWidth)return;const s=state||{t1Closed:true,t2Closed:true,t1Load:30,t2Load:30,reserveLoad:0,rating:40,fire:0,reserveClosed:false,isolated:false,unserved:0,demand:60,cooling:true,t1Temp:53.1,t2Temp:53.1,scada:true};
     const d=c.width/w;ctx.setTransform(d,0,0,d,0,0);ctx.fillStyle='#0c1723';ctx.fillRect(0,0,w,h);
     const inside=CMSCamera.views[view].inside,scale=Math.min(w/58,h/32)*zoom*pose.scale,cx=pose.x,cz=pose.z;
     const shapes=[],labels=[],co=Math.cos(yaw+pan),si=Math.sin(yaw+pan);
     // Perspective interior cameras put the visitor in the room, at the consoles.
     const eye=pose.eye||[21.15,3.05,6.05],aim=pose.aim||[16.8,2,-1.5];
     const normalize=v=>{const n=Math.hypot(...v)||1;return v.map(x=>x/n);};
     const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
     const delta=yaw-pose.yaw+pan,raw=[aim[0]-eye[0],aim[1]-eye[1],aim[2]-eye[2]],cs=Math.cos(delta),sn=Math.sin(delta);
     const forward=normalize([raw[0]*cs-raw[2]*sn,raw[1],raw[0]*sn+raw[2]*cs]),right=normalize(cross(forward,[0,1,0])),up=cross(right,forward);
     const focal=(h*.5)/Math.tan((pose.fov||78)*Math.PI/360)*zoom;
     const dot=(a,b)=>a.reduce((n,v,i)=>n+v*b[i],0);
     function cam(v){const a=v.map((n,i)=>n-eye[i]);return [dot(a,right),dot(a,up),dot(a,forward)];}
     function p(v){if(inside){const a=cam(v);return [w*.5+a[0]*focal/Math.max(.08,a[2]),h*.51-a[1]*focal/Math.max(.08,a[2])];}const x=v[0]-cx,z=v[2]-cz;return [w*.48+(x*co-z*si)*scale,h*.48+(x*si+z*co)*scale*.44-v[1]*scale*.92];}
     function depth(v){return inside?-cam(v)[2]:(v[0]-cx)*si+(v[2]-cz)*co+v[1]*.48;}
     function clip(pts){if(!inside)return pts;const result=[];for(let i=0;i<pts.length;i++){const a=pts[i],b=pts[(i+1)%pts.length],za=cam(a)[2],zb=cam(b)[2];if(za>=.08)result.push(a);if((za>=.08)!==(zb>=.08)){const t=(.08-za)/(zb-za);result.push(a.map((v,k)=>v+(b[k]-v)*t));}}return result;}
     function face(pts,color,stroke='#91a9ae22',layer){const clipped=clip(pts);if(clipped.length<3)return;shapes.push({pts:clipped.map(p),color,stroke,z:layer??pts.reduce((a,v)=>a+depth(v),0)/pts.length});}
     function line(a,b,col,width=1,layer){if(inside){const za=cam(a)[2],zb=cam(b)[2];if(za<.08&&zb<.08)return;if((za<.08)!==(zb<.08)){const t=(.08-za)/(zb-za),v=a.map((n,i)=>n+(b[i]-n)*t);if(za<.08)a=v;else b=v;}}shapes.push({pts:[p(a),p(b)],stroke:col,width,z:layer??(depth(a)+depth(b))/2+.05});}
     function box(x,y,z,dx,dy,dz,col){const a=[x-dx/2,y,z-dz/2],b=[x+dx/2,y,z-dz/2],e=[x-dx/2,y,z+dz/2],f=[x+dx/2,y,z+dz/2],A=[a[0],y+dy,a[2]],B=[b[0],y+dy,b[2]],E=[e[0],y+dy,e[2]],F=[f[0],y+dy,f[2]];
       face([a,b,B,A],col[0]);face([e,f,F,E],col[0]);face([a,e,E,A],col[1]);face([b,f,F,B],col[1]);face([A,B,F,E],col[2]);}
     const steel=['#45545d','#303e49','#6a7a82'],concrete=['#566069','#3b4852','#7b8589'],green=['#4c6856','#304b3f','#74917a'],off=['#35424b','#293741','#586873'],amber=['#88683b','#5d4c30','#ba9359'];

     if(inside){
       // Camera is inside the room. Interior surfaces frame the consoles; no exterior roof covers the view.
       face([[12.2,4.5,-2.4],[21.8,4.5,-2.4],[21.8,4.5,6.4],[12.2,4.5,6.4]],'#22333e',undefined,-99998);
       for(let z=-1.8;z<6;z+=2.4)face([[13,4.48,z],[21,4.48,z],[21,4.48,z+.1],[13,4.48,z+.1]],'#91b9b1',undefined,-99997);
       face([[21.8,0,-2.4],[21.8,0,6.4],[21.8,4.5,6.4],[21.8,4.5,-2.4]],'#263d47');
       face([[12.2,0,-2.4],[21.8,0,-2.4],[21.8,0,6.4],[12.2,0,6.4]],'#243540',undefined,-100000);
       for(let x=12.2;x<22;x+=.6)line([x,.01,-2.4],[x,.01,6.4],'#334752',.7,-99999);
       for(let z=-2.4;z<6.5;z+=.6)line([12.2,.01,z],[21.8,.01,z],'#334752',.7,-99999);
       box(17,0,-2.5,9.8,4.4,.18,['#44565d','#31434c','#65757a']);
       // Only the far side wall remains; front, near wall and roof are cut away.
       box(12.15,0,1.9,.16,4.4,8.8,['#344650','#253741','#4a6069']);
       for(let i=0;i<15;i++)box(12.25,.6,-2+i*.55,.06,3.1,.08,['#756044','#5c4a35','#8a7152']);
       function screen(x,y,z,width,height,heading,rows){
         box(x,y-height/2-.07,z-.04,width+.12,height+.14,.08,['#12242d','#0b1720','#243b44']);
         const pts=[[x-width/2,y-height/2,z],[x+width/2,y-height/2,z],[x+width/2,y+height/2,z],[x-width/2,y+height/2,z]];
         if(inside&&pts.some(v=>cam(v)[2]<.08))return;
         shapes.push({pts:pts.map(p),color:'#071823',stroke:'#4f727d',z:depth([x,y,z])+.08,screen:{heading,rows}});
       }
       const hot=s.fire>0||!s.cooling,served=(s.demand-s.unserved).toFixed(1);
       screen(14.5,2.7,-2.36,3.4,1.9,'NETWORK / LIVE',[['T1',s.t1Load.toFixed(1)+' MW'],['T2',s.t2Load.toFixed(1)+' MW'],['RESERVE',s.reserveClosed?'CLOSED':'OPEN'],['CITY',served+' MW']]);
       screen(18,2.7,-2.36,3.4,1.9,'CMS / RESPONSE',[['INCIDENT',hot?'T2 / ACTIVE':'MONITORING'],['ISOLATION',s.isolated?'CONFIRMED':'PENDING'],['AUTHORITY',s.isolated?'APPROVED':'REVIEW'],['FEEDBACK',s.scada===false?'MISSING':'AVAILABLE']]);
       screen(20.65,2.7,-2.36,1.65,1.9,'ALARMS',[['T2',s.t2Temp.toFixed(1)+' C'],['CB',s.t2Closed?'CLOSED':'OPEN'],['FIRE',s.fire>0?'ACTIVE':'NONE']]);
       function operator(x,z){
         box(x,.06,z,.7,.32,.7,['#273743','#1b2934','#3f535f']);box(x,.35,z+.28,.66,.9,.12,['#324451','#273745','#526674']);
         box(x,.38,z-.02,.44,.66,.35,['#336e80','#235368','#4d94a1']);box(x,1.04,z-.03,.29,.3,.28,['#cda789','#96755f','#e1c0a0']);
         line([x-.2,.82,z],[x-.4,.95,z-.68],'#8aabb1',4);line([x+.2,.82,z],[x+.35,.95,z-.68],'#8aabb1',4);
       }
       for(let i=0;i<3;i++){const x=14.3+i*2.6,z=1.6;
         box(x,0,z,2.25,.9,.8,['#293b45','#1a2c36','#3d4e57']);box(x,.9,z,2.4,.08,1.0,['#756049','#4b4135','#9e8460']);
         box(x,1,z-.24,.08,.28,.08,steel);screen(x,1.55,z-.24,1.65,.7,i===1?'DISPATCHER':'SCADA',[['T1',s.t1Load.toFixed(1)+' MW'],['T2',s.t2Temp.toFixed(1)+' C']]);
         box(x,.99,z+.25,.6,.02,.2,off);operator(x,z+1.1);
       }
       box(17,.05,4.6,5.4,.24,1.7,['#273943','#1a2b34','#3a4d57']);
       box(17,.29,4.4,2.5,.85,.8,['#293b45','#1a2c36','#826d52']);screen(17,1.72,4.1,1.8,.73,'SUPERVISOR',[['DEMAND',s.demand+' MW'],['SUPPLY',served+' MW']]);operator(17,5.3);
       for(let k=0;k<3;k++){box(21.2,0,1.2+k*.9,.7,2.3,.7,['#20333d','#11242f','#3d545d']);for(let j=0;j<6;j++)box(21.2,.35+j*.29,1.57+k*.9,.48,.05,.04,green);}
       labels.push({p:[17,4.9,-2.4],text:view==='dispatcher'?'DISPATCHER / LIVE CONSOLE':view==='wall'?'CMS / DECISION WALL':'CONTROL ROOM / INTERIOR',color:'#c5fa7b'});
     }else{
     face([[-23,-.2,-16],[25,-.2,-16],[25,-.2,20],[-23,-.2,20]],'#172733',undefined,-100000);
     for(let i=-22;i<=24;i+=2)line([i,-.16,-15],[i,-.16,19],'#233c49',.6,-99999);for(let i=-14;i<=18;i+=2)line([-22,-.16,i],[24,-.16,i],'#233c49',.6,-99999);
     box(6,0,18,43,.06,3,['#2c353c','#232d35','#2c353c']);
     function transformer(x,z,two){const live=two?s.t2Closed:s.t1Closed,cols=live?(two&&!s.cooling||!two&&s.t1Load>s.rating?amber:green):off;
       box(x,0,z,8,.35,6,concrete);box(x,.35,z,4,3,2.5,cols);box(x,3.35,z,4.3,.18,2.8,cols);
       for(let i=0;i<8;i++){box(x-1.8+i*.5,.8,z-1.8,.12,2.2,.8,cols);box(x-1.8+i*.5,.8,z+1.8,.12,2.2,.8,cols);}
       for(let i=0;i<3;i++){box(x-1.2+i*1.2,3.5,z,.23,1.8,.23,['#98adb0','#6d898d','#cad6cf']);for(let j=0;j<5;j++)box(x-1.2+i*1.2,3.7+j*.25,z,.46,.08,.46,['#9aafb2','#6d858d','#c2d1cd']);}
       labels.push({p:[x,6.3,z],text:(two?'T2':'T1')+' / '+(two?(s.fire>0?'FIRE':s.isolated?'ISOLATED':live?'IN SERVICE':'TRIPPED'):live?(s.t1Load>s.rating?'OVERLOAD':'IN SERVICE'):'TRIPPED'),color:two&&s.fire>0||!two&&!live?'#ff9886':'#c5fa7b'});
     }
     transformer(-10,-5,true);transformer(-10,7,false);box(-10,0,1,8,5,.3,concrete);
     for(const z of [-5,7]){const isT2=z<0,live=isT2?s.t2Closed:s.t1Closed;for(let k=0;k<3;k++){const zz=z+(k-1)*1.1;box(0,0,zz,.28,2.8,.28,steel);box(0,2.8,zz,.4,1.1,.4,off);line([-8.8+k*1.2,5.3,z],[0,3.9,zz],live?'#bff977':'#536878',1.4);line([0,3.9,zz],[7,6,zz],live?'#bff977':'#536878',1.4);box(7,0,zz,.25,6,.25,steel);}box(7,5.9,z,.35,.2,4,steel);}
     for(const z of [-12,13]){box(4,0,z,.3,8,.3,steel);box(13,0,z,.3,8,.3,steel);box(8.5,8,z,10,.3,.4,steel);line([4,2,z],[13,7.8,z],'#5b6d77',1);line([13,2,z],[4,7.8,z],'#5b6d77',1);}
     for(let k=0;k<3;k++)line([6+k,8,-12],[6+k,8,13],'#6d9299',1);
     box(17,0,2,9,4,8,['#364950','#263d46','#526873']);box(17,4,2,9.5,.25,8.5,steel);
     for(let k=0;k<4;k++)box(13.8+k*2,1.8,6.03,1.2,1.2,.04,['#709d94','#709d94','#709d94']);
     labels.push({p:[17,6,2],text:'CONTROL ROOM',color:'#b6cbd0'});
     box(2,0,-11,3,.6,2,concrete);box(2,.6,-11,1.5,2,1.3,s.reserveClosed?green:off);labels.push({p:[2,4.1,-11],text:'RESERVE / '+(s.reserveClosed?'CLOSED':'OPEN'),color:s.reserveClosed?'#c5fa7b':'#9aadb8'});
     if(s.isolated){line([1.5,.3,-4],[1.5,3,-4],'#c5fa7b',2);line([.8,.3,-4],[2.2,.3,-4],'#c5fa7b',2);}
     if(s.fire>0){const flick=.8+.15*Math.sin(s.time*6);for(let i=0;i<10;i++){const x=-11.7+(i%5)*.8,z=-5.8+Math.floor(i/5)*1.4,y=3.6+(i%3)*.35;
       face([[x-.5,y,z],[x+.5,y,z],[x+.2,y+s.fire*4*flick,z]],i%2?'#ff8d39cc':'#ffd278dd');}
       labels.push({p:[-10,9,-5],text:'MODELLED FIRE',color:'#ffbc8b'});}
     }
     shapes.sort((a,b)=>a.z-b.z);for(const f of shapes){ctx.beginPath();f.pts.forEach((v,i)=>i?ctx.lineTo(...v):ctx.moveTo(...v));if(f.color){ctx.closePath();ctx.fillStyle=f.color;ctx.fill();}ctx.strokeStyle=f.stroke;ctx.lineWidth=f.width||.6;ctx.stroke();
       if(f.screen){const a=f.pts[3],b=f.pts[2],d=f.pts[0],x=screenCtx;
         x.fillStyle='#071721';x.fillRect(0,0,320,180);x.fillStyle='#17343d';x.fillRect(0,0,320,34);x.fillStyle='#c5fa7b';x.font='bold 14px monospace';x.fillText(f.screen.heading,12,23);
         f.screen.rows.forEach((r,i)=>{x.font='13px monospace';x.fillStyle='#8da6ae';x.fillText(r[0],12,61+i*28);x.fillStyle='#e2f1e9';x.textAlign='right';x.fillText(r[1],307,61+i*28);x.textAlign='left';});
         ctx.save();ctx.transform((b[0]-a[0])/320,(b[1]-a[1])/320,(d[0]-a[0])/180,(d[1]-a[1])/180,a[0],a[1]);ctx.drawImage(screenCanvas,0,0);ctx.restore();
       }
     }
     for(const l of options.label===false||inside?[]:labels){const v=p(l.p);ctx.font='9px ui-monospace,monospace';const tw=ctx.measureText(l.text).width;ctx.fillStyle='#0a151de8';ctx.fillRect(v[0]-tw/2-7,v[1]-12,tw+14,20);ctx.fillStyle=l.color;ctx.textAlign='center';ctx.fillText(l.text,v[0],v[1]+1);}
     ctx.textAlign='left';ctx.fillStyle='#8199a5';ctx.font='8px ui-monospace,monospace';if(options.label!==false)ctx.fillText('COMPATIBLE VIEW / LIVE SIMULATION STATE',14,h-14);
   }

   this.update=s=>{state=s;draw();};
   this.auto=enabled=>{autoMode=enabled;pan=0;draw();};
   this.view=(name,settings={})=>{
     if(!CMSCamera.views[name])return;const crossing=CMSCamera.views[view].inside!==CMSCamera.views[name].inside;view=name;autoMode=!!settings.auto;pan=0;zoom=1;
     const target=CMSCamera.views[name].flat;
     c.setAttribute('aria-label',CMSCamera.views[name].label+' — interactive 3D view. Arrow keys rotate; plus and minus zoom.');
     motion={from:{...pose,yaw},to:{...target},elapsed:0};
     if(settings.instant||crossing){pose={...target};yaw=target.yaw;motion=null;}draw();
   };
   this.nudge=action=>{if(motion){pose={...motion.to};yaw=motion.to.yaw;motion=null;}manual();if(action==='left')yaw-=.18;if(action==='right')yaw+=.18;if(action==='in')zoom=Math.min(1.8,zoom*1.15);if(action==='out')zoom=Math.max(.65,zoom/1.15);draw();};
   c.addEventListener('keydown',e=>{const action={ArrowLeft:'left',ArrowRight:'right','+':'in','=':'in','-':'out'}[e.key];if(action){e.preventDefault();this.nudge(action);}});
   function animate(now){requestAnimationFrame(animate);const dt=Math.min(.05,(now-lastFrame)/1000);lastFrame=now;
     const moving=!!motion;
     if(motion){motion.elapsed=Math.min(1,motion.elapsed+dt);const k=motion.elapsed*motion.elapsed*(3-2*motion.elapsed);for(const key of ['x','z','scale','fov']){if(motion.to[key]!==undefined)pose[key]=(motion.from[key]??motion.to[key])+((motion.to[key])-(motion.from[key]??motion.to[key]))*k;}for(const key of ['eye','aim']){if(motion.to[key])pose[key]=motion.to[key].map((v,i)=>(motion.from[key]||motion.to[key])[i]+(v-(motion.from[key]||motion.to[key])[i])*k);}yaw=motion.from.yaw+(motion.to.yaw-motion.from.yaw)*k;pose.yaw=yaw;if(motion.elapsed===1)motion=null;}
     if(autoMode&&!document.hidden)pan=Math.sin(now*.00012)*.055;else pan=0;
     if((moving||autoMode)&&now-lastDraw>32){lastDraw=now;draw();}
   }
   requestAnimationFrame(animate);draw();
 };
})();

/* Shared camera intent for both renderers. Coordinates use the source scene's room bounds. */
(function(root){
  'use strict';
  const views={
    overview:{label:'Whole site',inside:false,p:[41,29,46],q:[0,2,0],fov:40,flat:{x:0,z:0,yaw:-.65,scale:1}},
    transformers:{label:'Transformer bays',inside:false,p:[9,14,24],q:[-10,2,2],fov:48,flat:{x:-9,z:1,yaw:-.55,scale:1.55}},
    control:{label:'Inside control room',inside:true,p:[26.8,4.1,10.1],q:[19.7,2.3,-1.2],fov:62,flat:{x:17,z:1.5,yaw:-.28,scale:2.7,eye:[18.8,2.65,5.95],aim:[17,2.1,-1.7],fov:62}},
    dispatcher:{label:'Dispatcher desk',inside:true,p:[20.5,2.5,5.8],q:[17.9,1.65,2.7],fov:58,flat:{x:16.3,z:3,yaw:.22,scale:4.1,eye:[17,1.95,3.8],aim:[16.9,1.55,1.36],fov:78}},
    wall:{label:'Decision wall',inside:true,p:[20,3.1,2.8],q:[20,2.8,-3.1],fov:65,flat:{x:17,z:-.8,yaw:0,scale:3.6,eye:[17,2.65,1.9],aim:[17,2.65,-2.4],fov:82}}
  };
  function follow(s,seconds){
    if(s.scenario==='normal')return ['control','dispatcher','wall'][Math.floor(seconds/9)%3];
    const age=Math.max(0,s.time-s.faultAt);
    if(age<4)return 'transformers';
    if(age<9)return 'wall';
    if(!s.isolated)return ['dispatcher','wall'][Math.floor(seconds/9)%2];
    if(!s.reserveClosed)return 'overview';
    return ['control','transformers','wall'][Math.floor(seconds/9)%3];
  }
  const api={views,follow};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.CMSCamera=api;
})(typeof window!=='undefined'?window:globalThis);

/* CMS simulation model v1. Deliberately simplified, deterministic, no physical I/O. */
(function(root){
  'use strict';
  const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
  class CMSTwin {
    constructor(){this.reset();}
    reset(){
      this.s={time:0,demand:60,ambient:25,rating:40,reserveCapacity:30,
        scenario:'normal',faultAt:null,t1Temp:53.1,t2Temp:53.1,t1Closed:true,t2Closed:true,
        cooling:true,fire:0,isolated:false,reserveClosed:false,suppression:false,
        scada:true,vision:true,thermal:false,context:true,dispatched:false,
        shed:0,t1Load:30,t2Load:30,reserveLoad:0,unserved:0,overloadSeconds:0,
        energyUnserved:0,evidenceRequested:false};
      this.events=[];this.history=[];this.seq=0;this.sampleAt=-1;
      this.log('SYSTEM','New simulation run. T1 + T2 share 60 MW. Reserve open.');
      this.balance();this.record();return this.s;
    }
    log(kind,message){this.events.push({id:++this.seq,time:+this.s.time.toFixed(2),kind,message});if(this.events.length>2000)this.events.shift();}
    balance(){
      const s=this.s,need=Math.max(0,s.demand-s.shed);
      s.reserveLoad=s.reserveClosed?Math.min(s.reserveCapacity,need):0;
      const left=need-s.reserveLoad;
      s.t1Load=s.t1Closed?(s.t2Closed?left/2:Math.min(left,s.rating*1.6)):0;
      s.t2Load=s.t2Closed?(s.t1Closed?left/2:Math.min(left,s.rating*1.6)):0;
      s.unserved=Math.max(0,s.demand-s.t1Load-s.t2Load-s.reserveLoad);
    }
    set(key,value){
      const s=this.s;
      if(key==='demand')s.demand=clamp(Number(value)||60,30,90);
      else if(key==='ambient')s.ambient=clamp(Number(value)||25,5,45);
      else if(['scada','vision','context'].includes(key))s[key]=!!value;
      else return;
      this.log('INPUT',key+' → '+s[key]+(key==='demand'?' MW':key==='ambient'?' °C':''));this.balance();
    }
    inject(scenario){
      const s=this.s;if(s.scenario!=='normal')return false;
      if(!['fire','cooling','conflict'].includes(scenario))return false;
      s.scenario=scenario;s.faultAt=s.time;
      if(scenario==='fire'){s.fire=.65;s.t2Temp=135;s.cooling=false;this.log('FAULT','T2 internal fault and fire injected into the plant model.');}
      if(scenario==='cooling'){s.cooling=false;this.log('FAULT','T2 cooling failure injected. Temperature now follows reduced heat removal.');}
      if(scenario==='conflict')this.log('FAULT','Vision smoke alarm injected; physical plant remains healthy.');
      return true;
    }
    step(dt){
      // Fixed maximum substep: repeatable transitions even at accelerated playback.
      let remaining=clamp(Number(dt)||0,0,600);
      while(remaining>1e-8){const h=Math.min(.25,remaining);this.tick(h);remaining-=h;}
      return this.s;
    }
    tick(dt){
      const s=this.s;s.time+=dt;this.balance();
      if(s.evidenceRequested&&s.time-s.requestedAt>=3)this.acquire();
      if(s.scenario==='fire'&&s.t2Closed&&s.time-s.faultAt>=.25){s.t2Closed=false;this.log('PROTECTION','Independent protection tripped CB-T2. CMS did not issue this trip.');this.balance();}
      const eq1=s.ambient+50*Math.pow(s.t1Load/s.rating,2);
      const eq2=s.ambient+50*Math.pow(s.t2Load/s.rating,2)*(s.cooling?1:3.8)+s.fire*160;
      s.t1Temp+=(eq1-s.t1Temp)*(1-Math.exp(-dt/100));
      s.t2Temp+=(eq2-s.t2Temp)*(1-Math.exp(-dt/90));
      if(s.scenario==='cooling'&&s.t2Closed&&s.t2Temp>=110){s.t2Closed=false;this.log('PROTECTION','T2 thermal protection tripped at the illustrative 110 °C threshold.');this.balance();}
      s.overloadSeconds=s.t1Closed&&s.t1Load>s.rating*1.1?s.overloadSeconds+dt:Math.max(0,s.overloadSeconds-dt*2);
      if(s.t1Closed&&(s.overloadSeconds>=120||s.t1Temp>=115)){s.t1Closed=false;this.log('PROTECTION','T1 backup trip: sustained overload or thermal limit. Supply capacity has fallen.');this.balance();}
      if(s.fire>0){const old=s.fire;s.fire=clamp(s.fire+dt*(s.suppression?-.012:.001),0,1);if(old>0&&s.fire===0)this.log('OUTCOME','Simulated fire extinguished. T2 remains isolated; no automatic re-energisation.');}
      s.energyUnserved+=s.unserved*dt/3600;
      if(s.time-this.sampleAt>=1){this.record();this.sampleAt=s.time;}
    }
    record(){const s=this.s;this.history.push({time:+s.time.toFixed(2),t1Temp:+s.t1Temp.toFixed(2),t2Temp:+s.t2Temp.toFixed(2),t1Load:s.t1Load,t2Load:s.t2Load,reserveLoad:s.reserveLoad,unserved:s.unserved,fire:s.fire});if(this.history.length>3600)this.history.shift();}
    evidence(){
      const s=this.s,age=s.faultAt===null?0:s.time-s.faultAt;
      const hot=s.scenario==='fire'||(s.scenario==='cooling'&&s.t2Temp>70);
      const smoke=s.scenario==='fire'&&s.fire>0||s.scenario==='conflict';
      return [
        {id:'scada',label:'SCADA',available:s.scada,value:s.scada?`T2 ${s.t2Temp.toFixed(1)} °C · CB ${s.t2Closed?'closed':'open'}`:'Signal unavailable',flag:s.scada&&hot},
        {id:'vision',label:'Vision',available:s.vision,value:s.vision?(smoke?'Smoke / flame indication':'No smoke indication'):'Camera unavailable',flag:s.vision&&smoke},
        {id:'thermal',label:'Independent thermal',available:s.thermal,value:s.thermal?(hot?'Independent hot-spot confirmed':'No abnormal hot-spot'):(s.evidenceRequested?'Acquisition pending':'Not yet acquired'),flag:s.thermal&&hot},
        {id:'context',label:'Topology & rules',available:s.context,value:s.context?'Local demo procedure loaded':'Procedure unavailable',flag:false},
      ].map(e=>({...e,age:age}));
    }
    assessment(){
      const s=this.s,ev=this.evidence(),age=s.faultAt===null?0:s.time-s.faultAt;
      const corroborated=s.scada&&(s.scenario==='fire'&&(s.thermal||s.vision)||s.scenario==='cooling'&&s.thermal&&s.t2Temp>70);
      let stage=0,title='Observe the operating system',detail='T1 and T2 share demand. Change the load or inject a fault to begin.',route='MONITOR';
      if(s.scenario!=='normal'){
        stage=age<1?0:age<2?1:age<3?2:3;
        title='Associate observations with T2';detail='CMS groups available observations into one incident.';route='COLLECT';
        if(age>=3){
          if(s.scenario==='conflict'&&!s.thermal){title='Conflicting evidence: acquire another view';detail='Vision indicates smoke; the process state does not support it. Ask for independent thermal evidence.';route='GATHER';stage=2;}
          else if(s.scenario==='conflict'){title='Alarm contradicted by independent evidence';detail='Thermal and process observations show no abnormal heat. Withhold switching and escalate the camera discrepancy.';route='ABSTAIN';stage=3;}
          else if(!s.scada||!s.context){title='Required evidence is unavailable';detail='A missing breaker-state feed or procedure blocks switching. Restore the source or escalate.';route='ESCALATE';stage=2;}
          else if(!corroborated){title='Evidence is incomplete';detail='Acquire independent thermal evidence before presenting a switching request.';route='GATHER';stage=2;}
          else {stage=4;route='ASK';title=s.t2Closed?'Review controlled isolation':'Review post-trip coordination';detail=s.t2Closed?'The cooling fault is real. A reviewed isolation can remove T2 from service before a protective trip.':'Protection has tripped T2. CMS proposes verified isolation, reserve support and incident coordination.';}
          if(s.isolated&&s.reserveClosed&&s.scada&&s.context){stage=5;route=s.fire>0?'ACT':'VERIFY';title=s.fire>0?'Contain the incident; monitor the network':'Verify the resulting state';detail=s.fire>0?'Suppression is permitted only after confirmed isolation. Monitor T1 loading and supply.':'T2 stays out of service. Check served demand, thermal recovery and the decision record.';}
        }
      }
      if(s.unserved>.1){title='Supply deficit: escalate the incident';detail='Available paths cannot serve demand. The model shows '+s.unserved.toFixed(1)+' MW unserved. Review the surviving capacity; tripped equipment stays out of service.';route='ESCALATE';}
      return {stage,title,detail,route,corroborated,evidence:ev};
    }
    gates(){
      const s=this.s,a=this.assessment(),ready=s.scenario!=='normal'&&s.time-s.faultAt>=3;
      const relevant=['fire','cooling'].includes(s.scenario);
      return {
        isolate:{allowed:ready&&relevant&&a.corroborated&&s.scada&&s.context&&!s.isolated,reason:s.isolated?'Isolation confirmed':!ready?'Waiting for incident assessment':!relevant?'No corroborated physical fault':!s.scada?'Breaker-state feedback required':!s.context?'Procedure required':!a.corroborated?'Independent evidence required':'Dispatcher review required'},
        reserve:{allowed:ready&&relevant&&s.isolated&&s.scada&&s.context&&!s.reserveClosed,reason:s.reserveClosed?'Reserve in service':!s.isolated?'Confirm T2 isolation first':!s.scada?'Breaker-state feedback required':!s.context?'Procedure required':'Supervisor review required'},
        suppress:{allowed:s.fire>0&&s.isolated&&s.scada&&s.context&&!s.suppression,reason:s.suppression?'Suppression active':s.fire<=0?'No active fire':!s.isolated?'Confirmed isolation required':!s.scada?'Isolation feedback required':!s.context?'Procedure required':'Site response review required'},
        dispatch:{allowed:ready&&relevant&&!s.dispatched,reason:s.dispatched?'Response team notified':'Log a simulated incident notification'},
        thermal:{allowed:s.scenario!=='normal'&&!s.thermal&&!s.evidenceRequested,reason:s.thermal?'Independent observation available':s.evidenceRequested?'Acquisition pending':'Acquire an independent observation'},
      };
    }
    action(id){
      const g=this.gates()[id];if(!g||!g.allowed){this.log('BLOCKED',id+': '+(g?g.reason:'Unknown action'));return false;}
      const s=this.s;
      if(id==='thermal'){s.evidenceRequested=true;s.requestedAt=s.time;this.log('EVIDENCE','Independent thermal observation requested.');}
      if(id==='isolate'){s.t2Closed=false;s.isolated=true;this.log('APPROVAL','Demo dispatcher authorised T2 isolation; simulated status confirmed.');}
      if(id==='reserve'){s.reserveClosed=true;this.log('APPROVAL','Demo supervisor authorised reserve energisation; 30 MW capacity enabled.');}
      if(id==='suppress'){s.suppression=true;this.log('ACTION','Simulated site response enabled suppression after isolation confirmation.');}
      if(id==='dispatch'){s.dispatched=true;this.log('ACTION','Simulated response-team notification recorded. No external message sent.');}
      this.balance();this.record();return true;
    }
    acquire(){if(this.s.evidenceRequested&&!this.s.thermal){this.s.thermal=true;this.s.evidenceRequested=false;this.log('EVIDENCE','Independent thermal observation received from the simulated plant.');}}
    forecast(withPlan){
      const copy=new CMSTwin();copy.s=JSON.parse(JSON.stringify(this.s));copy.events=[];copy.history=[];
      // Explicit what-if intervention, not a permission bypass in the running model.
      if(withPlan){copy.s.t2Closed=false;copy.s.isolated=true;copy.s.reserveClosed=true;if(copy.s.fire>0)copy.s.suppression=true;copy.balance();}
      let peak=copy.s.t1Temp;for(let i=0;i<180;i++){copy.step(1);peak=Math.max(peak,copy.s.t1Temp);}
      return {t1Peak:peak,unserved:copy.s.unserved,fire:copy.s.fire,t1Closed:copy.s.t1Closed};
    }
    export(){return {schema:'cms-twin-run/v1',model:'Illustrative thermal / capacity model; not calibrated to physical equipment',exportedAt:new Date().toISOString(),parameters:{ratingMW:40,reserveMW:30,thermalTimeConstantsSeconds:[100,90],overloadTripSeconds:120,overloadTripRatio:1.1,t1ThermalTripC:115,t2ThermalTripC:110},state:this.s,events:this.events,samples:this.history};}
  }
  if(typeof module!=='undefined'&&module.exports)module.exports=CMSTwin;else root.CMSTwin=CMSTwin;
})(typeof window!=='undefined'?window:globalThis);

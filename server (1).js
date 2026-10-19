const http=require("http"),fs=require("fs"),path=require("path"),{WebSocketServer}=require("ws");
const srv=http.createServer((q,r)=>{r.writeHead(200,{"Content-Type":"text/html; charset=utf-8"});r.end(fs.readFileSync(path.join(__dirname,"index.html")))});
const wss=new WebSocketServer({server:srv}),lobbies={};
const rc=()=>{let c;do{c=Array.from({length:4},()=>"ABCDEFGHJKLMNPQRSTUVWXYZ"[Math.floor(Math.random()*24)]).join("")}while(lobbies[c]);return c};
const send=(w,o)=>{if(w&&w.readyState===1)w.send(JSON.stringify(o))};
const toClients=L=>L.clients.forEach(c=>send(c,{t:"state",S:L.S}));
const toAll=L=>{send(L.host,{t:"state",S:L.S});toClients(L)};
wss.on("connection",ws=>{
  let L=null,isHost=false,slot=0;
  ws.on("message",raw=>{
    let m;try{m=JSON.parse(raw)}catch(e){return}
    if(m.t==="host"){
      let c=String(m.code||"").toUpperCase();
      L=lobbies[c];
      if(L&&L.token!==m.token){send(ws,{t:"err",msg:"Diese Lobby gehört jemand anderem."});L=null;return}
      if(!L){c=(/^[A-Z]{4}$/.test(c)&&m.token)?c:rc();L=lobbies[c]={code:c,token:m.token||Math.random().toString(36).slice(2),host:null,S:null,slots:[],clients:new Set()}}
      L.host=ws;isHost=true;
      send(ws,{t:"hosted",code:L.code,token:L.token});
    }else if(m.t==="state"&&isHost&&L){
      L.S=m.S;toClients(L);
    }else if(m.t==="join"){
      L=lobbies[String(m.code||"").toUpperCase()];
      if(!L){send(ws,{t:"err",msg:"Lobby nicht gefunden. Code prüfen."});return}
      const name=String(m.name||"").trim().slice(0,14);
      if(name){
        for(let i=1;i<=4;i++)if(L.slots[i]&&L.slots[i].name===name){slot=i;break}
        if(!slot)for(let i=1;i<=4;i++)if(!L.slots[i]||L.slots[i].ws.readyState!==1){slot=i;break}
        if(!slot){send(ws,{t:"err",msg:"Die Lobby ist voll (4 Spieler)."});L=null;return}
        L.slots[slot]={name,ws};
        if(L.S){L.S.players[slot].name=name}
      }
      L.clients.add(ws);
      send(ws,{t:"joined",code:L.code,slot});
      if(L.S){if(slot)toAll(L);else send(ws,{t:"state",S:L.S})}
    }else if(m.t==="buzz"&&slot&&L&&L.S){
      const S=L.S;
      if(S.open&&!S.buzzed&&!S.open.scored){S.buzzed=true;S.cur=slot;S.open.none=0;toAll(L)}
    }
  });
  ws.on("close",()=>{if(L){L.clients.delete(ws);if(isHost&&L.host===ws)L.host=null}});
});
srv.listen(process.env.PORT||3000,()=>console.log("läuft"));

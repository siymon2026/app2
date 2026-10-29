// TEST-ONLY zero-dependency mock of the customer API + static server for /public (used by tests/browser-ux.py). Run: node tests/ux-mock-server.js
const http = require("http"), fs = require("fs"), path = require("path");
const PUB = path.join(__dirname, "..", "public");
const MIME = {".html":"text/html; charset=utf-8",".js":"text/javascript",".css":"text/css",".json":"application/json",".svg":"image/svg+xml",".png":"image/png",".webmanifest":"application/manifest+json",".mp3":"audio/mpeg"};
const TOKEN = "tok1";
const now = Date.now();
const iso = (m) => new Date(now - m*60000).toISOString();
const state = {
  log: [],
  seenAt: iso(90),
  cfg: { push: 1 },
  pushPosts: 0,
  notifications: [
    { id:"o1", type:"order_status", orderId:"MU0JYS4V-48EE87", stage:"accepted", title:"تحديث الطلب", message:"طلبك في طريقه إليك 🚚 (طلب #MU0JYS4V-48EE87)", createdAt: iso(2) },
    { id:"o2", type:"order_status", orderId:"MU0JYS4V-48EE87", stage:"restaurant_ready", title:"تحديث الطلب", message:"تم وضع طلبك يطبخ 🍳 (طلب #MU0JYS4V-48EE87)", createdAt: iso(3) },
    { id:"b2", type:"broadcast", linkUrl:null, url:"/notifications/", title:"صيانة قصيرة الليلة", message:"قد يتوقف التطبيق لدقائق قليلة بعد منتصف الليل.", createdAt: iso(10) },
    { id:"o3", type:"order_status", orderId:"MU0JYS4V-48EE87", stage:"admin_accepted", title:"تحديث الطلب", message:"تم قبول طلبك ✅ (طلب #MU0JYS4V-48EE87)", createdAt: iso(60) },
    { id:"o4", type:"order_status", orderId:"MO45FWC6-B78BA7", stage:"accepted", title:"تحديث الطلب", message:"طلبك في طريقه إليك 🚚 (طلب #MO45FWC6-B78BA7)", createdAt: iso(200) },
    { id:"b1", type:"broadcast", linkUrl:"/orders/", url:"/orders/", title:"عرض اليوم: خصم 20% على كل الوجبات", message:"استمتع بخصم 20% على جميع الوجبات اليوم فقط.\nالعرض ساري حتى منتصف الليل ولا يُجمع مع عروض أخرى. اطلب الآن وتابع طلبك مباشرة من التطبيق.", createdAt: iso(1500) },
  ],
  orders: [
    { id:"MU0JYS4V-48EE87", createdAt: iso(5), status:"on_the_way", total:75, currency:"MAD", items:[{name:"برغر",qty:2,price:30},{name:"بطاطس",qty:1,price:15}], driverName:"يوسف", driverPhone:"0600000000", driverId:"d1" },
    { id:"MO45FWC6-B78BA7", createdAt: iso(500), status:"pending_nodriver", total:40, currency:"MAD", items:[{name:"بيتزا",qty:1,price:40}] },
    { id:"MK1", createdAt: iso(5000), status:"delivered", total:20, currency:"MAD", items:[{name:"عصير",qty:1,price:20}] },
    { id:"MK2", createdAt: iso(6000), status:"canceled", total:20, currency:"MAD", items:[{name:"عصير",qty:1,price:20}] },
  ],
  support: [ { id:"s1", from:"admin", text:"مرحباً، كيف يمكننا مساعدتك؟", createdAt: iso(20) } ],
  driverChat: { "MU0JYS4V-48EE87": [ { id:"d1", from:"driver", text:"أنا قريب منك", createdAt: iso(1) } ] },
};
const send = (res, code, obj) => { res.writeHead(code, {"Content-Type":"application/json"}); res.end(JSON.stringify(obj)); };
const readBody = (req) => new Promise((ok) => { let d=""; req.on("data",c=>d+=c); req.on("end",()=>{ try{ok(JSON.parse(d||"{}"))}catch{ok({})} }); });

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, "http://x"); let p = u.pathname;
  if (p.startsWith("/api/")) {
    state.log.push(req.method + " " + p);
    const b = req.method === "GET" ? {} : await readBody(req);
    if (p === "/api/public-config") return send(res,200,{supportPhone:"+212600000000",webPushEnabled:!!state.cfg.push,webPushPublicKey:state.cfg.push?"BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U":""});
    if (p === "/api/health") return send(res,200,{ok:true});
    if (p === "/api/customer/push/subscribe") { state.pushPosts++; return send(res,200,{ok:true}); }
    if (p === "/api/customer/push/unsubscribe") return send(res,200,{ok:true});
    if (p === "/api/service-area") return send(res,200,{ok:true});
    if (p === "/api/customer/login") return send(res,200,{token:TOKEN,customer:{firstName:"محمد",lastName:"العربي",email:"m@x.com"}});
    if (p.startsWith("/api/customer/")) {
      if ((req.headers.authorization||"") !== "Bearer "+TOKEN) return send(res,401,{error:"Unauthorized"});
      if (p === "/api/customer/me") return send(res,200,{customer:{firstName:"محمد",lastName:"العربي",email:"m@x.com"}});
      if (p === "/api/customer/orders") return send(res,200,{orders:state.orders});
      if (p === "/api/customer/notifications") {
        const seen = new Date(state.seenAt).getTime();
        const unread = state.notifications.filter(n=>new Date(n.createdAt).getTime()>seen).length;
        return send(res,200,{ok:true,notifications:state.notifications,unreadCount:unread,lastSeenAt:state.seenAt});
      }
      if (p === "/api/customer/notifications/seen") { state.seenAt = new Date().toISOString(); return send(res,200,{ok:true}); }
      if (p === "/api/customer/support") {
        if (req.method === "POST") { state.support.push({id:"s"+Date.now(),from:"customer",text:b.text,createdAt:new Date().toISOString()}); return send(res,200,{ok:true}); }
        return send(res,200,{ok:true,messages:state.support});
      }
      let m = p.match(/^\/api\/customer\/orders\/([^/]+)\/chat$/);
      if (m) {
        const id = decodeURIComponent(m[1]); const o = state.orders.find(x=>x.id===id);
        if (!o) return send(res,404,{error:"Not found"});
        if (req.method === "POST") {
          if (!o.driverId) return send(res,409,{error:"No driver assigned"});
          (state.driverChat[id] ||= []).push({id:"m"+Date.now(),from:"customer",text:b.text,createdAt:new Date().toISOString()});
          return send(res,200,{ok:true});
        }
        return send(res,200,{ok:true,orderId:id,driverId:o.driverId||null,messages:o.driverId?(state.driverChat[id]||[]):[]});
      }
      return send(res,200,{ok:true});
    }
    if (p === "/__log") return send(res,200,state.log);
    return send(res,200,{ok:true,restaurants:[],items:[],sections:[],banners:[]});
  }
  if (p === "/__log") return send(res,200,state.log);
  if (p === "/__cfg") { state.cfg.push = Number(u.searchParams.get("push")); return send(res,200,state.cfg); }
  if (p === "/__state") return send(res,200,{pushPosts:state.pushPosts,seenAt:state.seenAt});
  if (p.endsWith("/")) p += "index.html";
  const f = path.join(PUB, p);
  if (!f.startsWith(PUB) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end("nf"); }
  res.writeHead(200,{"Content-Type":MIME[path.extname(f)]||"application/octet-stream"});
  fs.createReadStream(f).pipe(res);
});
server.listen(4567, () => console.log("mock on 4567"));

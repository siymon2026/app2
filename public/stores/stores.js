const LOGO="/icons/icon-192.png";
const T=[['rest','المطاعم','🍔'],['pharm','الصيدليات','💊'],['cafe','المقاهي','☕'],['veg','الخضر والفواكه','🥬'],['butch','الجزارة','🥩'],['groc','البقالة','🛒'],['bake','المخابز','🥖'],['sweet','الحلويات','🍰'],['super','السوبرماركت','🏬'],['home','المنزل','🏠'],['care','العناية الشخصية','🧴'],['elec','الإلكترونيات','🔌']];
const TN=Object.fromEntries(T.map(t=>[t[0],t]));
const FT={rest:['مطبخ مغربي','وجبات سريعة','بيتزا'],pharm:['حراسة 24/7','توصيل عاجل','مستحضرات تجميل'],cafe:['قهوة مختصة','فطور','عصائر'],veg:['عضوي','محلي','جملة'],butch:['حلال معتمد','دجاج','لحم بقري'],groc:['منتجات محلية','مشروبات','معلبات'],bake:['خبز طازج','معجنات','كعك'],sweet:['حلويات مغربية','كيك','شوكولاتة'],super:['أسعار مخفضة','منتجات طازجة','كل شيء'],home:['أثاث','تنظيف','مطبخ'],care:['عطور','شعر','بشرة'],elec:['هواتف','إكسسوارات','أجهزة منزلية']};
const PC={rest:['الأكثر طلباً','الوجبات','المشروبات'],pharm:['أدوية دون وصفة','العناية','مكملات'],cafe:['مشروبات ساخنة','باردة','حلويات'],veg:['خضر','فواكه','أعشاب'],butch:['لحم','دجاج','مفروم'],groc:['أساسيات','ألبان','مشروبات'],bake:['خبز','معجنات','حلويات'],sweet:['مغربية','كيك','هدايا'],super:['طازج','معلبات','منظفات'],home:['مطبخ','تنظيف','ديكور'],care:['شعر','بشرة','عطور'],elec:['شواحن','سماعات','إكسسوارات']};
const PR={rest:[['طاجين دجاج',55,'🍲'],['بيتزا مارغريتا',45,'🍕'],['برجر دجاج',38,'🍔'],['عصير برتقال',15,'🧃']],pharm:[['باراسيتامول',12,'💊'],['فيتامين C',48,'🍊'],['كريم مرطب',65,'🧴'],['كمامات',20,'😷']],cafe:[['قهوة إسبريسو',14,'☕'],['كابتشينو',18,'🥛'],['كرواسون',10,'🥐'],['عصير أفوكادو',22,'🥑']],veg:[['طماطم 1كغ',6,'🍅'],['بطاطس 1كغ',7,'🥔'],['برتقال 1كغ',9,'🍊'],['نعناع حزمة',3,'🌿']],butch:[['لحم بقري 1كغ',110,'🥩'],['دجاج كامل',45,'🍗'],['لحم مفروم',95,'🍖'],['كفتة',70,'🧆']],groc:[['زيت زيتون',65,'🫒'],['سكر 1كغ',8,'🧂'],['حليب 1ل',7,'🥛'],['شاي أخضر',18,'🍵']],bake:[['خبز بلدي',2,'🥖'],['باغيت',2,'🥖'],['ميلوي',12,'🥐'],['كعك',20,'🥨']],sweet:[['شباكية 500غ',45,'🍯'],['كيك شوكولاتة',120,'🍰'],['غريبة',35,'🍪'],['سلو',50,'🌰']],super:[['أرز 1كغ',14,'🍚'],['معجون طماطم',9,'🥫'],['منظف أرضيات',25,'🧽'],['ماء 5ل',9,'💧']],home:[['طقم أكواب',55,'🥤'],['مكنسة',120,'🧹'],['شمعة عطرية',40,'🕯️'],['مفرش',90,'🛏️']],care:[['شامبو',35,'🧴'],['عطر',250,'🌸'],['معجون أسنان',15,'🪥'],['كريم يدين',28,'🧼']],elec:[['شاحن سريع',80,'🔌'],['سماعات',150,'🎧'],['كابل USB-C',30,'🔗'],['بطارية متنقلة',190,'🔋']]};
const HUE={rest:'#ffe0d3',pharm:'#d9f3ea',cafe:'#efe2d2',veg:'#dff2d4',butch:'#fbd9d9',groc:'#fdf0c9',bake:'#f6e5c8',sweet:'#fbdbe8',super:'#d9e8fb',home:'#e5dcf5',care:'#dcf0f4',elec:'#dde1e8'};
const S=[
['rest','مطعم دار الطاجين','مراكش',4.8,30,8,2.1,1],['rest','برجر هاوس','الدار البيضاء',4.5,25,6,1.4,1],['rest','بيتزا ميديترانيا','طنجة',4.3,40,10,3.5,0],
['pharm','صيدلية الأمل','الرباط',4.9,20,5,0.9,1],['pharm','صيدلية الحراسة','فاس',4.6,25,7,2.8,1],
['cafe','مقهى الأطلس','أكادير',4.7,15,5,1.1,1],['cafe','كوفي ستوديو','الدار البيضاء',4.4,20,6,2.4,0],
['veg','سوق الخضر الطازجة','مراكش',4.6,35,0,1.9,1],['butch','جزارة الأصالة','فاس',4.7,40,8,3.2,1],
['groc','بقالة الحي','طنجة',4.4,18,4,0.7,1],['bake','مخبزة سيمون','الرباط',4.8,15,3,0.6,1],['sweet','حلويات الفرح','فاس',4.9,45,9,4.0,0],
['super','سوبرماركت النور','الدار البيضاء',4.5,45,12,5.2,1],['home','بيت وديكور','أكادير',4.2,60,15,6.0,1],['care','عناية وجمال','الرباط',4.6,35,8,3.0,1],['elec','تيك بوينت','طنجة',4.5,50,15,4.4,1]
].map((a,i)=>({id:i,type:a[0],name:a[1],city:a[2],r:a[3],t:a[4],fee:a[5],d:a[6],open:!!a[7],tag:FT[a[0]][i%3]}));
const st={view:'home',arg:null,grid:true,cart:[],fav:new Set([0,3]),f:{open:false,rate:false,free:false,fast:false,near:false,tag:null},dc:null,loading:false,sq:'',pc:0,tab:'menu'};
const $=s=>document.getElementById(s);
const nav=(v,a)=>{st.view=v;st.arg=a??null;st.pc=0;st.tab='menu';st.sq='';if(v==='cat'){st.f={open:false,rate:false,free:false,fast:false,near:false,tag:null};st.loading=true;render();setTimeout(()=>{st.loading=false;render()},650);return}render();scrollTo(0,0)};
const toast=m=>{const t=$('toast');t.textContent=m;t.classList.add('on');clearTimeout(toast.h);toast.h=setTimeout(()=>t.classList.remove('on'),1500)};
const add=(n,p,sid)=>{st.cart.push({n,p,sid});toast('أُضيف إلى السلة ✓');render()};
const fav=id=>{st.fav.has(id)?st.fav.delete(id):st.fav.add(id);render()};
const card=s=>`<div class="sc ${s.open?'':'closed'}" data-a="nav" data-v="store:${s.id}"><div class="cv" style="background:${HUE[s.type]}">${TN[s.type][2]}<span class="st ${s.open?'':'c'}">${s.open?'مفتوح الآن':'مغلق'}</span><button class="fv" aria-label="المفضلة" data-a="fav" data-v="${s.id}">${st.fav.has(s.id)?'❤️':'🤍'}</button></div><div class="lg">${TN[s.type][2]}</div><div class="bd"><b>${s.name}</b><p>${TN[s.type][1]} · ${s.city}</p><div class="meta"><span class="s">★ ${s.r}</span><span>⏱ ${s.t} د</span><span>🛵 ${s.fee?s.fee+' د.م':'مجاني'}</span><span>📍 ${s.d} كم</span></div></div></div>`;
const prod=(p,sid,dis)=>`<div class="pr"><div class="im">${p[2]}</div><b>${p[0]}</b><div class="pp"><span>${p[1]} د.م</span><button class="add" ${dis?'disabled':''} aria-label="أضف" data-a="add" data-v="${p[0]}|${p[1]}|${sid}">+</button></div></div>`;
const hdr=()=>`<div class="hd"><img class="logo" src="${LOGO}" alt="Siymon"><div class="loc"><small>التوصيل إلى</small><b>الدار البيضاء، المعاريف ▾</b></div><button class="ib" aria-label="الإشعارات">🔔<i></i></button></div>`;
const srch=ph=>`<label class="search"><span>🔍</span><input placeholder="${ph}"></label>`;
const skel=()=>`<div class="list g">${[1,2,3,4].map(()=>'<div class="sk" style="height:190px"></div>').join('')}</div>`;
const empty=(i,t,d,b)=>`<div class="empty"><big>${i}</big><b>${t}</b>${d}${b?`<br><button class="btn p" data-a="${b[1]}" data-v="${b[2]||''}">${b[0]}</button>`:''}</div>`;
function home(){const op=S.filter(s=>s.open);return hdr()+`<div class="pg">${srch('ابحث عن متجر، مطعم أو منتج…')}
<h2>التصنيفات</h2><div class="cats">${T.slice(0,7).map(t=>`<button class="cat" data-a="nav" data-v="cat:${t[0]}"><em>${t[2]}</em>${t[1]}</button>`).join('')}<button class="cat" data-a="nav" data-v="discover"><em>➕</em>المزيد</button></div>
<h2>عروض اليوم</h2><div class="row"><div class="offer"><b>خصم 30%</b><span>على أول طلب من المطاعم</span><u>🍕</u></div><div class="offer"><b>توصيل مجاني</b><span>للخضر والفواكه فوق 80 د.م</span><u>🥬</u></div><div class="offer"><b>1+1 مجاناً</b><span>على القهوة المختصة</span><u>☕</u></div></div>
<h2>المتاجر القريبة <a data-a="nav" data-v="discover">عرض الكل</a></h2><div class="row">${[...S].sort((a,b)=>a.d-b.d).slice(0,5).map(s=>`<div style="flex:0 0 215px">${card(s)}</div>`).join('')}</div>
<h2>المطاعم الأكثر طلباً <a data-a="nav" data-v="cat:rest">عرض الكل</a></h2><div class="row">${S.filter(s=>s.type==='rest').map(s=>`<div style="flex:0 0 215px">${card(s)}</div>`).join('')}</div>
<h2>مفتوح الآن</h2><div class="list">${op.slice(0,3).map(card).join('')}</div>
<h2>الأكثر مبيعاً</h2><div class="row">${['rest','groc','pharm','cafe','veg'].map(k=>prod(PR[k][0],-1)).join('')}</div></div>`}
function disc(){let l=S.filter(s=>!st.dc||s.type===st.dc);return hdr()+`<div class="pg"><h1 class="t">اكتشف المتاجر</h1>${srch('ابحث في المتاجر…')}
<div class="row" style="margin-top:12px"><button class="chip ${st.dc?'':'on'}" data-a="dc" data-v="">الكل</button>${T.map(t=>`<button class="chip ${st.dc===t[0]?'on':''}" data-a="dc" data-v="${t[0]}">${t[2]} ${t[1]}</button>`).join('')}</div>
${filters(null)}<div style="display:flex;justify-content:space-between;align-items:center;margin:10px 0"><span style="color:var(--muted);font-size:13px">${filt(l).length} متجر</span><span><button class="chip ${st.grid?'on':''}" data-a="grid" data-v="1">▦ شبكة</button> <button class="chip ${!st.grid?'on':''}" data-a="grid" data-v="0">☰ قائمة</button></span></div>${results(filt(l))}</div>`}
const filt=l=>l.filter(s=>(!st.f.open||s.open)&&(!st.f.rate||s.r>=4.6)&&(!st.f.free||s.fee<=5)&&(!st.f.fast||s.t<=25)&&(!st.f.near||s.d<=2)&&(!st.f.tag||s.tag===st.f.tag));
const results=l=>l.length?`<div class="list ${st.grid?'g':''}">${l.map(card).join('')}</div>`:empty('🔎','لا توجد نتائج','جرّب تغيير الفلاتر أو البحث بكلمة أخرى',['إعادة ضبط الفلاتر','reset']);
function filters(type){const b=[['open','مفتوح الآن'],['near','أقل من 2 كم'],['rate','تقييم 4.6+'],['free','رسوم ≤ 5 د.م'],['fast','≤ 25 دقيقة']];return `<div class="row" style="margin-top:10px">${b.map(x=>`<button class="chip ${st.f[x[0]]?'on':''}" data-a="fb" data-v="${x[0]}">${x[1]}</button>`).join('')}${type?FT[type].map(x=>`<button class="chip ${st.f.tag===x?'on':''}" data-a="ft" data-v="${x}">${x}</button>`).join(''):''}</div>`}
function cat(){const t=TN[st.arg];const l=S.filter(s=>s.type===st.arg);return `<div class="hd"><button class="ib back" aria-label="رجوع" data-a="nav" data-v="home">➜</button><b style="font-size:18px">${t[2]} ${t[1]}</b></div><div class="pg">${srch('ابحث في '+t[1]+'…')}${filters(st.arg)}<div style="margin-top:14px">${st.loading?skel():results(filt(l))}</div></div>`}
function store(){const s=S[st.arg],t=TN[s.type],ps=PR[s.type].filter(p=>p[0].includes(st.sq)||!st.sq);return `<div class="hero" style="background:${HUE[s.type]}">${t[2]}<button class="ib bk" aria-label="رجوع" data-a="nav" data-v="home">➜</button></div>
<div class="sinfo"><div class="tp"><div class="lg2">${t[2]}</div><div style="flex:1;text-align:start"><h1>${s.name}</h1><div class="meta"><span>${t[1]} · ${s.city}</span></div></div><button class="ib" data-a="fav" data-v="${s.id}" aria-label="المفضلة">${st.fav.has(s.id)?'❤️':'🤍'}</button></div>
<div class="meta" style="margin-top:12px;justify-content:space-between"><span class="st ${s.open?'':'c'}" style="position:static">${s.open?'مفتوح · حتى 23:00':'مغلق · يفتح 09:00'}</span><span class="s">★ ${s.r}</span><span>⏱ ${s.t} د</span><span>🛵 ${s.fee?s.fee+' د.م':'مجاني'}</span></div></div>
<div class="pg">${s.open?'':'<div class="err" style="margin-bottom:12px">🔒 هذا المتجر مغلق حالياً — يمكنك تصفح المنتجات وإضافتها عند إعادة الفتح.</div>'}
<div class="tabs">${[['menu','المنتجات'],['offers','العروض'],['info','معلومات']].map(x=>`<button class="chip ${st.tab===x[0]?'on':''}" data-a="tab" data-v="${x[0]}">${x[1]}</button>`).join('')}</div>
${st.tab==='menu'?`<label class="search"><span>🔍</span><input id="sq" value="${st.sq}" placeholder="ابحث داخل المتجر…"></label><div class="row" style="margin:12px 0">${PC[s.type].map((c,i)=>`<button class="chip ${st.pc===i?'on':''}" data-a="pc" data-v="${i}">${c}</button>`).join('')}</div>
<div class="list">${ps.length?ps.map(p=>`<div class="pl"><div class="im">${p[2]}</div><div class="x"><b>${p[0]}</b><p>${p[1]} د.م</p></div><button class="add" ${s.open?'':'disabled'} aria-label="أضف" data-a="add" data-v="${p[0]}|${p[1]}|${s.id}">+</button></div>`).join(''):empty('🔎','لا يوجد منتج بهذا الاسم','')}</div>`:st.tab==='offers'?`<div class="offer" style="flex:none"><b>خصم 15%</b><span>على ${PC[s.type][0]} طوال الأسبوع</span><u>${t[2]}</u></div>`:`<div class="info"><div><span>ساعات العمل</span><b>09:00 – 23:00</b></div><div><span>المدينة</span><b>${s.city}</b></div><div><span>المسافة</span><b>${s.d} كم</b></div><div><span>الدفع</span><b>نقداً عند الاستلام</b></div></div>`}</div>`}
function cart(){const c=st.cart,tot=c.reduce((a,x)=>a+x.p,0);return hdr()+`<div class="pg"><h1 class="t">السلة</h1>${c.length?`<div class="list">${c.map(x=>`<div class="pl"><div class="x"><b>${x.n}</b><p>${x.p} د.م</p></div></div>`).join('')}</div><div class="info" style="margin:14px 0"><div><span>المجموع</span><b>${tot} د.م</b></div></div><button class="btn p" style="width:100%" data-a="toast" data-v="سيتم ربط الدفع بنظام الطلبات">إتمام الطلب</button> <button class="btn g" style="width:100%;margin-top:8px" data-a="clear">تفريغ السلة</button>`:empty('🛒','سلتك فارغة','أضف منتجات من متاجرك المفضلة',['اكتشف المتاجر','nav','discover'])}</div>`}
function comps(){return hdr()+`<div class="pg"><h1 class="t">المكوّنات و Tokens</h1>
<div class="cmp"><h3>الألوان</h3><div class="w">${[['brand','#5DD62C'],['soft','#fff1ec'],['ok','#337418'],['bad','#c62828'],['bg','#f7f4ef'],['dark','#0f0f10'],['card','#17181a']].map(c=>`<div class="sw"><i style="background:${c[1]}"></i>${c[0]}</div>`).join('')}</div></div>
<div class="cmp"><h3>الأزرار (Variants: Primary / Secondary / Ghost / Disabled)</h3><div class="w"><button class="btn p">أساسي</button><button class="btn">ثانوي</button><button class="btn g">شفاف</button><button class="btn p" disabled>معطّل</button><button class="add">+</button></div></div>
<div class="cmp"><h3>الفلاتر (Default / Selected)</h3><div class="w"><span class="chip">مفتوح الآن</span><span class="chip on">تقييم 4.6+</span></div></div>
<div class="cmp"><h3>الأيقونات</h3><div class="w" style="font-size:26px">${T.map(t=>t[2]).join(' ')}</div></div>
<div class="cmp"><h3>بطاقة متجر: مفتوح / مغلق</h3><div class="list g">${card(S[0])}${card(S[2])}</div></div>
<div class="cmp"><h3>حالة التحميل</h3><div class="sk" style="height:70px"></div></div>
<div class="cmp"><h3>حالة الخطأ</h3><div class="err">⚠️ تعذّر تحميل المتاجر <button class="btn p" style="margin-inline-start:auto;padding:8px 14px">إعادة المحاولة</button></div></div>
<div class="cmp"><h3>صفحة فارغة</h3>${empty('🏪','لا توجد متاجر في منطقتك بعد','سنوسّع التغطية قريباً')}</div>
<div class="cmp"><h3>Tokens</h3><div class="info"><div><span>Radius</span><b>12 / 14 / 16</b></div><div><span>Spacing</span><b>4 · 8 · 12 · 16 · 24</b></div><div><span>الخط</span><b>Tajawal 400/700/800</b></div></div></div></div>`}
function render(){const v=st.view;$('app').innerHTML=(v==='home'?home():v==='discover'?disc():v==='cat'?cat():v==='store'?store():v==='cart'?cart():comps())+`<nav class="nav">${[['home','🏠','الرئيسية'],['discover','🧭','اكتشف'],['cart','🛒','السلة'],['orders','📦','طلباتي']].map(n=>`<button class="${(v===n[0]||(n[0]==='discover'&&(v==='cat'||v==='store')))?'on':''}" data-a="nav" data-v="${n[0]}"><span>${n[1]}</span>${n[2]}${n[0]==='cart'&&st.cart.length?`<b>${st.cart.length}</b>`:''}</button>`).join('')}</nav>`}

document.addEventListener('click',e=>{const el=e.target.closest('[data-a]');if(!el)return;const a=el.dataset.a,v=el.dataset.v;
if(a==='nav'){if(v==='orders'){location.href='/orders/';return}const [k,x]=v.split(':');nav(k,x===undefined?null:(k==='store'?+x:x))}
else if(a==='fav')fav(+v);
else if(a==='add'){const [n,p,i]=v.split('|');add(n,+p,+i)}
else if(a==='dc'){st.dc=v||null;render()}
else if(a==='grid'){st.grid=v==='1';render()}
else if(a==='fb'){st.f[v]=!st.f[v];render()}
else if(a==='ft'){st.f.tag=st.f.tag===v?null:v;render()}
else if(a==='pc'){st.pc=+v;render()}
else if(a==='tab'){st.tab=v;render()}
else if(a==='reset'){st.f={open:false,rate:false,free:false,fast:false,near:false,tag:null};render()}
else if(a==='clear'){st.cart=[];render()}
else if(a==='toast')toast(v)});
document.addEventListener('input',e=>{if(e.target.id!=='sq')return;st.sq=e.target.value;render();const q=$('sq');q.focus();q.setSelectionRange(q.value.length,q.value.length)});
if(location.hash==='#components')st.view='comps';
render();

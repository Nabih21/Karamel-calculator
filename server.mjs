import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import crypto from 'node:crypto';

const root=path.dirname(fileURLToPath(import.meta.url));
const TOKEN=process.env.NOTION_TOKEN, PASSWORD=process.env.APP_PASSWORD;
const DS={ingredients:'e2c7f0e5-d60e-49af-8693-41b278400c44',packaging:'4a932663-d329-4ebd-b2f1-1324703ae0ed',recipes:'db1700c0-6eab-4456-8f49-ab207e0301c4',recipeIngredients:'d27625c1-6bc4-4006-8f42-cf37081c7b21',recipePackaging:'d31b0d4c-5bd0-442f-9a75-2f311a566d15',overhead:'140d145b-e734-44c0-bdec-e4b5411b3718'};
const json=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'});res.end(JSON.stringify(data));};
const authorized=req=>{if(!TOKEN||!PASSWORD)return false;const a=crypto.createHash('sha256').update(String(req.headers['x-karamel-password']||'')).digest();const b=crypto.createHash('sha256').update(PASSWORD).digest();return crypto.timingSafeEqual(a,b)};
async function notion(route,method='GET',body){for(let i=0;i<4;i++){const r=await fetch('https://api.notion.com/v1'+route,{method,headers:{'Authorization':'Bearer '+TOKEN,'Notion-Version':'2025-09-03','Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});const j=await r.json().catch(()=>({}));if(r.status===429&&i<3){await new Promise(resolve=>setTimeout(resolve,Math.min(8000,1000*Number(r.headers.get('retry-after')||1))));continue;}if(!r.ok)throw new Error(j.message||'Notion request failed: '+r.status);return j;}}
async function all(ds){let results=[],cursor;do{const x=await notion('/data_sources/'+ds+'/query','POST',{page_size:100,...(cursor?{start_cursor:cursor}:{})});results.push(...x.results);cursor=x.has_more?x.next_cursor:null;}while(cursor&&results.length<10000);return results;}
const title=(p,n)=>(p[n]?.title||[]).map(x=>x.plain_text||'').join('');
const num=(p,n)=>p[n]?.number??p[n]?.formula?.number??null;
const relation=(p,n)=>p[n]?.relation?.[0]?.id||null;
function transform(k,x){const p=x.properties;
if(k==='ingredients')return{id:x.id,name:title(p,'Ingrédient'),weight:num(p,'Poids acheté (g)'),price:num(p,"Prix d'achat (CAD)")};
if(k==='packaging')return{id:x.id,name:title(p,'Emballage'),weight:num(p,'Quantité achetée'),price:num(p,"Prix d'achat (CAD)")};
if(k==='recipes')return{id:x.id,name:title(p,'Recette'),pieces:num(p,'Pièces produites'),ratio:num(p,'Ratio coût cible'),status:p['Statut']?.select?.name||'Draft'};
if(k==='recipeIngredients')return{id:x.id,name:title(p,'Ligne'),recipe:relation(p,'Recette'),item:relation(p,'Ingrédient'),qty:num(p,'Quantité (g)')};
if(k==='recipePackaging')return{id:x.id,name:title(p,'Ligne'),recipe:relation(p,'Recette'),item:relation(p,'Emballage'),qty:num(p,'Quantité')};
if(k==='overhead')return{id:x.id,name:title(p,'Frais général'),recipe:relation(p,'Recette'),amount:num(p,'Montant (CAD)')};
}
const text=(name,value)=>({[name]:{title:[{text:{content:String(value).slice(0,2000)}}]}});
const n=(name,value)=>({[name]:{number:Number(value)}});
const rel=(name,id)=>({[name]:{relation:[{id}]}});
function validName(s){if(typeof s!=='string'||!s.trim()||s.length>200)throw Error('Enter a name (1–200 characters).');return s.trim()}
function validNumber(x,positive=false){if(x===null||x===''||!Number.isFinite(Number(x))||Number(x)<0||(positive&&Number(x)===0))throw Error('Enter a valid nonnegative number.');return Number(x)}
function validId(s){if(!/^[a-f0-9-]{32,36}$/i.test(String(s)))throw Error('Invalid record identifier');return s}
function props(k,d){if(k==='ingredients'||k==='packaging')return{...text(k==='ingredients'?'Ingrédient':'Emballage',validName(d.name)),...n(k==='ingredients'?'Poids acheté (g)':'Quantité achetée',validNumber(d.weight,true)),...n("Prix d'achat (CAD)",validNumber(d.price))};
if(k==='recipes')return{...text('Recette',validName(d.name)),...n('Pièces produites',validNumber(d.pieces,true)),...n('Ratio coût cible',validNumber(d.ratio,true))};
if(k==='recipeIngredients'||k==='recipePackaging')return{...text('Ligne',validName(d.name)),...rel('Recette',validId(d.recipe)),...rel(k==='recipeIngredients'?'Ingrédient':'Emballage',validId(d.item)),...n(k==='recipeIngredients'?'Quantité (g)':'Quantité',validNumber(d.qty,true))};
if(k==='overhead')return{...text('Frais général',validName(d.name)),...n('Montant (CAD)',validNumber(d.amount)),...rel('Recette',validId(d.recipe))};throw Error('Invalid entity')}
async function mutate({action,entity,data={}}){if(!Object.hasOwn(DS,entity))throw Error('Unknown table');
if(action==='create')return notion('/pages','POST',{parent:{type:'data_source_id',data_source_id:DS[entity]},properties:props(entity,data)});
if(action==='update'){validId(data.id);let properties;
if(entity==='overhead')properties={...text('Frais général',validName(data.name)),...n('Montant (CAD)',validNumber(data.amount))};
else if(entity==='recipeIngredients'||entity==='recipePackaging')properties={...n(entity==='recipeIngredients'?'Quantité (g)':'Quantité',validNumber(data.qty,true))};
else properties=props(entity,data);
return notion('/pages/'+data.id,'PATCH',{properties});}throw Error('Unknown action')}
async function handle(req,res){const url=new URL(req.url||'/', 'http://localhost');
if(url.pathname==='/health')return json(res,200,{ok:true,configured:Boolean(TOKEN&&PASSWORD)});
if(url.pathname.startsWith('/api/')){if(!TOKEN||!PASSWORD)return json(res,503,{error:'Add NOTION_TOKEN and APP_PASSWORD in Render Environment.'});if(!authorized(req))return json(res,401,{error:'Incorrect application password.'});
try{if(url.pathname==='/api/data'&&req.method==='GET'){const pairs=await Promise.all(Object.entries(DS).map(async ([k,id])=>[k,(await all(id)).map(x=>transform(k,x))]));return json(res,200,Object.fromEntries(pairs));}
if(url.pathname==='/api/mutate'&&req.method==='POST'){let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>25000)throw Error('Request too large')}const result=await mutate(JSON.parse(raw||'{}'));return json(res,200,{id:result.id,ok:true});}
return json(res,404,{error:'Unknown API route'});}catch(e){return json(res,400,{error:e.message})}}
if(req.method!=='GET')return json(res,405,{error:'Not allowed'});
const files={'/':'index.html','/index.html':'index.html'};
const file=files[url.pathname];if(!file)return json(res,404,{error:'Not found'});
const body=await fs.readFile(path.join(root,'public',file));
res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','X-Content-Type-Options':'nosniff','Cache-Control':'no-store','Referrer-Policy':'no-referrer','Content-Security-Policy':"frame-ancestors 'self' https://www.notion.so https://notion.so https://*.notion.site; default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self'"});res.end(body)}
http.createServer((req,res)=>handle(req,res).catch(e=>json(res,500,{error:e.message}))).listen(Number(process.env.PORT||3000),'0.0.0.0',()=>console.log('Karamel Studio ready'));

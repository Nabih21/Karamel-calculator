// Karamel Studio Cloudflare Worker — uses the existing Notion data sources.
const DS={ingredients:'e2c7f0e5-d60e-49af-8693-41b278400c44',packaging:'4a932663-d329-4ebd-b2f1-1324703ae0ed',recipes:'db1700c0-6eab-4456-8f49-ab207e0301c4',recipeIngredients:'d27625c1-6bc4-4006-8f42-cf37081c7b21',recipePackaging:'d31b0d4c-5bd0-442f-9a75-2f311a566d15',overhead:'140d145b-e734-44c0-bdec-e4b5411b3718'};
async function notion(env,route,method='GET',body){for(let i=0;i<4;i++){const r=await fetch('https://api.notion.com/v1'+route,{method,headers:{'Authorization':'Bearer '+env.NOTION_TOKEN,'Notion-Version':'2025-09-03','Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});const j=await r.json().catch(()=>({}));if(r.status===429&&i<3){await new Promise(resolve=>setTimeout(resolve,Math.min(8000,1000*Number(r.headers.get('retry-after')||1))));continue;}if(!r.ok){const e=new Error(j.message||'Notion request failed: '+r.status);e.status=r.status;throw e;}return j;}}
async function all(env,ds){let results=[],cursor;do{const x=await notion(env,'/data_sources/'+ds+'/query','POST',{page_size:100,...(cursor?{start_cursor:cursor}:{})});results.push(...x.results);cursor=x.has_more?x.next_cursor:null;}while(cursor);return results;}
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
const n=(name,value)=>({[name]:{number:value===null?null:Number(value)}});
const rel=(name,id)=>({[name]:{relation:[{id}]}});
function props(k,d){if(k==='ingredients'||k==='packaging')return{...text(k==='ingredients'?'Ingrédient':'Emballage',d.name),...n(k==='ingredients'?'Poids acheté (g)':'Quantité achetée',d.weight),...n("Prix d'achat (CAD)",d.price)};
if(k==='recipes')return{...text('Recette',d.name),...n('Pièces produites',d.pieces),...n('Ratio coût cible',d.ratio)};
if(k==='recipeIngredients'||k==='recipePackaging')return{...text('Ligne',d.name),...rel('Recette',d.recipe),...rel(k==='recipeIngredients'?'Ingrédient':'Emballage',d.item),...n(k==='recipeIngredients'?'Quantité (g)':'Quantité',d.qty)};
if(k==='overhead')return{...text('Frais général',d.name),...n('Montant (CAD)',d.amount),...rel('Recette',d.recipe)};throw Error('Invalid entity')}
async function mutate(env,{action,entity,data={}}){if(!Object.hasOwn(DS,entity))throw Error('Unknown table');
if(action==='create')return notion(env,'/pages','POST',{parent:{type:'data_source_id',data_source_id:DS[entity]},properties:props(entity,data)});
if(action==='update'){let properties;
if(entity==='overhead')properties={...text('Frais général',data.name),...n('Montant (CAD)',data.amount)};
else if(entity==='recipeIngredients'||entity==='recipePackaging')properties={...n(entity==='recipeIngredients'?'Quantité (g)':'Quantité',data.qty)};
else properties=props(entity,data);
return notion(env,'/pages/'+data.id,'PATCH',{properties});}throw Error('Unknown action')}


export function notionRepository(env){return {
 async list(entity){return (await all(env,DS[entity])).map(x=>transform(entity,x))},
 async delete(entity,{id}){if(!['ingredients','recipeIngredients','recipePackaging','overhead'].includes(entity))throw Error('Only recipe rows can be removed');return notion(env,'/pages/'+id,'PATCH',{archived:true})},
 async create(entity,data){return mutate(env,{action:'create',entity,data})},
 async update(entity,data){return mutate(env,{action:'update',entity,data})}
};}

import fs from 'node:fs';
const config=JSON.parse(fs.readFileSync('wrangler.jsonc'));const db=config.d1_databases[0].database_id;
async function query(sql,params=[]){const r=await fetch(`https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/d1/database/${db}/query`,{method:'POST',headers:{Authorization:`Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,'Content-Type':'application/json'},body:JSON.stringify({sql,params})});const j=await r.json();if(!r.ok||!j.success)throw Error('D1 repair query failed');return j.result[0]}
const recipe='41471d1d-fe9b-81a0-acb0-c8055643c6be';
const repairs=[['41871d1d-fe9b-8064-bfa0-d3b513f35228','41471d1d-fe9b-8092-bbf5-c45e85274bb8','Creme 35%'],['41871d1d-fe9b-80ba-83fe-e3b5db80fa57','41471d1d-fe9b-813e-91b3-ff4b8fb1e80a','Glucose'],['41871d1d-fe9b-80db-b617-e312eb13f1af','41471d1d-fe9b-81dd-9420-cf89e6c7f08a','Beurre']];
for(const [line,id,name] of repairs){const item=(await query('SELECT * FROM ingredients WHERE id=?',[id])).results[0];if(item?.name!==name||!(item.weight>0)||!(item.price>=0))throw Error('Catalogue precondition failed');const row=(await query('SELECT * FROM recipeIngredients WHERE id=? AND recipe=?',[line,recipe])).results[0];if(!row||(row.item!==null&&row.item!==id))throw Error('Line precondition failed');}
for(const [line,id]of repairs)await query('UPDATE recipeIngredients SET item=? WHERE id=? AND recipe=? AND item IS NULL',[id,line,recipe]);
for(const [line,id]of repairs){const row=(await query('SELECT item FROM recipeIngredients WHERE id=?',[line])).results[0];if(row.item!==id)throw Error('Repair verification failed');}
console.log('Three Caramel ingredient links verified. Purchase values and quantities unchanged.');

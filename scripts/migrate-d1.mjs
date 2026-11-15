// Run only in the migration workflow. Never prints records or credentials.
import {readFile,writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {columns} from '../src/repositories/d1.mjs';
const account=process.env.CLOUDFLARE_ACCOUNT_ID, token=process.env.CLOUDFLARE_API_TOKEN;
const root=`https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(account)}/d1/database`;
async function api(path,body){const r=await fetch(root+path,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});const j=await r.json();if(!r.ok||!j.success)throw Error(`Cloudflare request failed (${r.status}): ${JSON.stringify(j.errors)}`);return j.result}
const snapshot=JSON.parse(await readFile(process.env.EXPORT_PATH,'utf8'));
const name=`karamel-migration-${process.env.GITHUB_RUN_ID}`;
// Each attempt gets a new database. Never overwrite a populated production DB.
const created=await api('',{name});const id=created.uuid;
const config=JSON.parse(await readFile('wrangler.jsonc','utf8'));
config.d1_databases=[{binding:'DB',database_name:name,database_id:id,migrations_dir:'migrations'}];
config.vars={...config.vars,DATA_BACKEND:'d1'};
await writeFile('wrangler.migration.json',JSON.stringify(config,null,2));
function execute(file){const result=spawnSync('npx',['--no-install','wrangler','d1','execute',name,'--remote','--config','wrangler.migration.json','--file',file],{encoding:'utf8'});if(result.status!==0)throw Error(`D1 execution failed for ${file}; inspect database ${id} before retrying. Output withheld to protect business data.`)}
execute('migrations/0001_initial.sql');execute(process.env.IMPORT_PATH);
for(const [entity,keys]of Object.entries(columns)){
 const result=await api(`/${id}/query`,{sql:`SELECT * FROM "${entity}" ORDER BY id`,params:[]});
 const actual=result[0].results;
 const normalize=rows=>rows.map(r=>Object.fromEntries(keys.map(k=>[k,r[k]??(k==='status'?'Draft':null)]))).sort((a,b)=>a.id.localeCompare(b.id));
 assert.deepEqual(normalize(actual),normalize(snapshot.data[entity]),`${entity} reconciliation failed`);
}
await writeFile(process.env.GITHUB_STEP_SUMMARY,`## D1 import reconciled\nDatabase: \`${name}\`\nID: \`${id}\`\nAll six collections match the export, including IDs and relationships.\nProduction still uses Notion.\n`,{flag:'a'});
console.log('D1 import reconciled. Production unchanged. Database ID:',id);

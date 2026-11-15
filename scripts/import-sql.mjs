import {readFile,writeFile} from 'node:fs/promises';
import {DatabaseSync} from 'node:sqlite';
import {columns} from '../src/repositories/d1.mjs';
const [input,output]=process.argv.slice(2);if(!input||!output)throw Error('Usage: node scripts/import-sql.mjs export.json import.sql');
const snapshot=JSON.parse(await readFile(input,'utf8'));if(snapshot.version!==1)throw Error('Unsupported export version');
const db=new DatabaseSync(':memory:');db.exec(await readFile(new URL('../migrations/0001_initial.sql',import.meta.url),'utf8'));
const quote=v=>v===null?'NULL':typeof v==='number'&&Number.isFinite(v)?String(v):typeof v==='string'?"'"+v.replaceAll("'","''")+"'":(()=>{throw Error('Unsupported value')})();
const sql=[];
for(const [entity,keys] of Object.entries(columns)){
 if(!Array.isArray(snapshot.data[entity]))throw Error('Missing collection: '+entity);
 for(const record of snapshot.data[entity]){
 const values=keys.map(k=>record[k]??(k==='status'?'Draft':null));
 const statement=`INSERT INTO "${entity}" (${keys.map(k=>'"'+k+'"').join(',')}) VALUES (${values.map(quote).join(',')});`;
 try{db.exec(statement)}catch(e){throw Error(`${entity} record ${record.id}: ${e.message}`)}
 sql.push(statement);
 }
}
if(db.prepare('PRAGMA foreign_key_check').all().length)throw Error('Broken relationships');
await writeFile(output,sql.join('\n')+'\n',{flag:'wx',mode:0o600});db.close();console.log('Validated and generated',sql.length,'inserts. Import into an empty database only.');

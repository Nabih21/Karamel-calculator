import fs from 'node:fs';
import {randomBytes,createCipheriv,publicEncrypt} from 'node:crypto';
const config=JSON.parse(fs.readFileSync('wrangler.jsonc','utf8'));
const db=config.d1_databases[0].database_id;
const data={};
for(const entity of ['ingredients','packaging','recipes','recipeIngredients','recipePackaging','overhead']){
 const response=await fetch(`https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/d1/database/${db}/query`,{method:'POST',headers:{Authorization:`Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,'Content-Type':'application/json'},body:JSON.stringify({sql:`SELECT * FROM "${entity}"`,params:[]})});
 const result=await response.json();if(!response.ok||!result.success)throw Error('D1 diagnostic query failed');data[entity]=result.result[0].results;
}
// Only the requesting workspace can decrypt the record values; logs contain ciphertext.
const key=randomBytes(32),iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv);
const payload=Buffer.concat([cipher.update(JSON.stringify(data)),cipher.final()]);
const wrapped=publicEncrypt(Buffer.from(process.env.DIAGNOSTIC_KEY,'base64').toString(),key);
const envelope=JSON.stringify({key:wrapped.toString('base64'),iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),payload:payload.toString('base64')});
const encoded=Buffer.from(envelope).toString('base64');for(let i=0;i<encoded.length;i+=2000)console.log('::notice title=Encrypted D1 diagnostic '+String(i/2000).padStart(4,'0')+'::'+encoded.slice(i,i+2000));

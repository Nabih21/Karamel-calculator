import {writeFile} from 'node:fs/promises';
import {notionRepository} from '../src/repositories/notion.mjs';
import {recipeService} from '../src/services/recipes.mjs';
if(!process.env.NOTION_TOKEN)throw Error('NOTION_TOKEN is required');
const output=process.argv[2];if(!output)throw Error('Usage: node scripts/export-notion.mjs /secure/path/export.json');
const data=await recipeService(notionRepository(process.env)).read();
await writeFile(output,JSON.stringify({version:1,data},null,2),{flag:'wx',mode:0o600});
console.log('Exported',Object.fromEntries(Object.entries(data).map(([k,v])=>[k,v.length])));

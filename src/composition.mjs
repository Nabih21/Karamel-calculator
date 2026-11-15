import {notionRepository} from './repositories/notion.mjs';
import {d1Repository} from './repositories/d1.mjs';
import {recipeService} from './services/recipes.mjs';
export function configured(env){return (env.DATA_BACKEND||'notion')==='notion'?Boolean(env.NOTION_TOKEN):env.DATA_BACKEND==='d1'&&Boolean(env.DB)}
export function service(env){
 const backend=env.DATA_BACKEND||'notion';
 if(backend==='notion')return recipeService(notionRepository(env));
 if(backend==='d1')return recipeService(d1Repository(env.DB));
 throw Error('Unknown DATA_BACKEND');
}

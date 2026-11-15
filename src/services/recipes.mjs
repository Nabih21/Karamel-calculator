import {entities,validateMutation} from '../domain/recipes.mjs';
// Repository contract: list, create, update, delete. Plain domain records only.
export function recipeService(repository){return {
 async read(){const result={};for(const entity of entities)result[entity]=await repository.list(entity);
 result.recipePackaging=result.recipePackaging.map(line=>({...line,qty:result.recipes.find(r=>r.id===line.recipe)?.pieces??null}));return result},
 async mutate(input){const {action,entity,data}=validateMutation(input);
 if(action==='create'&&entity==='recipePackaging'){
 const recipe=(await repository.list('recipes')).find(r=>r.id===data.recipe);
 if(!recipe||!Number.isInteger(recipe.pieces)||recipe.pieces<=0)throw Error('Set a valid recipe yield first');
 data.qty=recipe.pieces;
 }
 return repository[action](entity,data)}
};}

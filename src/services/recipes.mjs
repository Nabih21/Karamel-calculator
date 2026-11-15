import {entities,validateMutation} from '../domain/recipes.mjs';
// Repository contract: list(entity) -> records; create/update(entity, data) -> {id}.
export function recipeService(repository){return {
 async read(){const result={};for(const entity of entities)result[entity]=await repository.list(entity);return result},
 async mutate(input){const {action,entity,data}=validateMutation(input);return repository[action](entity,data)}
};}

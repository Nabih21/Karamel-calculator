function validName(s){if(typeof s!=='string'||!s.trim()||s.length>200)throw Error('Enter a name (1–200 characters).');return s.trim()}
function validNumber(x,positive=false,optional=false){if(optional&&(x===null||x===undefined||x===''))return null;if(x===null||x===undefined||x===''||!Number.isFinite(Number(x))||Number(x)<0||(positive&&Number(x)===0))throw Error('Enter a valid nonnegative number.');return Number(x)}
function validId(s){if(!/^[a-f0-9-]{32,36}$/i.test(String(s)))throw Error('Invalid record identifier');return s}

export const entities=['ingredients','packaging','recipes','recipeIngredients','recipePackaging','overhead'];
export function validateMutation({action,entity,data:d={}}){
 if(!entities.includes(entity))throw Error('Unknown table');
 if(!['create','update','delete'].includes(action))throw Error('Unknown action');
 if(action==='delete'){if(!['ingredients','recipeIngredients','recipePackaging','overhead'].includes(entity))throw Error('Only recipe rows can be removed');return {action,entity,data:{id:validId(d.id)}}}
 if(action==='update'&&entity==='recipePackaging')throw Error('Packaging quantity follows pieces produced and cannot be edited');
 const out={};if(action==='update')out.id=validId(d.id);
 if(action==='update'&&['recipeIngredients','recipePackaging'].includes(entity))out.qty=validNumber(d.qty,true);
 else {
 out.name=validName(d.name);
 if(['ingredients','packaging'].includes(entity)){out.weight=validNumber(d.weight,true,true);out.price=validNumber(d.price,false,true)}
 if(entity==='recipes'){out.pieces=validNumber(d.pieces,true);if(!Number.isInteger(out.pieces))throw Error('Pieces produced must be a whole number');out.ratio=validNumber(d.ratio,true);if(out.ratio>1)throw Error('Target cost ratio must be greater than 0 and at most 1.');}
 if(['recipeIngredients','recipePackaging'].includes(entity)){out.recipe=validId(d.recipe);out.item=validId(d.item);out.qty=entity==='recipePackaging'?1:validNumber(d.qty,true)}
 if(entity==='overhead'){out.amount=validNumber(d.amount)}
 }
 return {action,entity,data:out};
}

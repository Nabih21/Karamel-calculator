import test from 'node:test';import assert from 'node:assert/strict';import {DatabaseSync} from 'node:sqlite';import {readFileSync} from 'node:fs';
import {d1Repository} from '../src/repositories/d1.mjs';import {recipeService} from '../src/services/recipes.mjs';import {calculateRecipes} from '../public/pricing.mjs';
test('D1 repository persists a complete recipe through the service and rejects invalid writes',async()=>{
 const sqlite=new DatabaseSync(':memory:');sqlite.exec(readFileSync(new URL('../migrations/0001_initial.sql',import.meta.url),'utf8'));
 const db={prepare(sql){const s=sqlite.prepare(sql);let args=[];return {bind(...a){args=a;return this},async all(){return {results:s.all(...args)}},async run(){return {meta:s.run(...args)}}}}};
 const service=recipeService(d1Repository(db));
 try{
 const create=(entity,data)=>service.mutate({action:'create',entity,data});
 const i=await create('ingredients',{name:'Chocolate',weight:1000,price:20});
 const r=await create('recipes',{name:'Truffles',pieces:20,ratio:.35});
 await create('recipeIngredients',{name:'Chocolate',recipe:r.id,item:i.id,qty:200});
 let data=await service.read();assert.equal(calculateRecipes(data)[0].total,4);
 await service.mutate({action:'update',entity:'ingredients',data:{id:i.id,name:'Chocolate',weight:1000,price:30}});
 data=await service.read();assert.equal(calculateRecipes(data)[0].total,6);
 await assert.rejects(create('recipes',{name:'Bad',pieces:20,ratio:35}),/ratio/);
 await assert.rejects(create('recipeIngredients',{name:'Broken',recipe:r.id,item:crypto.randomUUID(),qty:1}),/FOREIGN KEY/);
 assert.equal(data.ingredients.length,1);
 const pack=await create('packaging',{name:'Bag',weight:100,price:10});
 const line=await create('recipePackaging',{name:'Bag',recipe:r.id,item:pack.id,qty:999});
 data=await service.read();assert.equal(data.recipePackaging[0].qty,20);assert.equal(calculateRecipes(data)[0].pc,2);
 await service.mutate({action:'update',entity:'recipes',data:{id:r.id,name:'Truffles',pieces:24,ratio:.35}});
 data=await service.read();assert.equal(data.recipePackaging[0].qty,24);assert.ok(Math.abs(calculateRecipes(data)[0].pc-2.4)<1e-10);
 await assert.rejects(service.mutate({action:'update',entity:'recipePackaging',data:{id:line.id,qty:5}}),/cannot be edited/);
 await service.mutate({action:'delete',entity:'recipePackaging',data:{id:line.id}});
 data=await service.read();assert.equal(data.recipePackaging.length,0);assert.equal(data.packaging.length,1);
 const ingredientLine=data.recipeIngredients[0];await service.mutate({action:'delete',entity:'recipeIngredients',data:{id:ingredientLine.id}});
 data=await service.read();assert.equal(data.recipeIngredients.length,0);assert.equal(data.ingredients.length,1);assert.equal(calculateRecipes(data)[0].ready,false);
 await assert.rejects(service.mutate({action:'delete',entity:'ingredients',data:{id:i.id}}),/Only recipe rows/);
 await assert.rejects(service.mutate({action:'delete',entity:'recipePackaging',data:{id:line.id}}),/not found/);
 }finally{sqlite.close()}
});

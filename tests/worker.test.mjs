import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/worker.mjs';

const env={NOTION_TOKEN:'test-notion-token',APP_PASSWORD:'x',ASSETS:{fetch:()=>Response.json({})}};
const call=(method,path,body,password='x')=>worker.fetch(new Request('https://karamel.test'+path,{
  method,headers:{'X-Karamel-Password':password,'Content-Type':'application/json'},
  ...(body?{body:JSON.stringify(body)}:{})
}),env);

test('updating an existing ingredient includes the Notion integration context',async()=>{
  const previous=globalThis.fetch;
  const calls=[];
  globalThis.fetch=async (url,options)=>{calls.push({url,options});return Response.json({id:'1234'})};
  try{
    const response=await call('POST','/api/mutate',{action:'update',entity:'ingredients',data:{
      id:'12345678-1234-1234-1234-123456789012',name:'Cocoa butter',weight:100,price:12
    }});
    assert.equal(response.status,200);
    assert.match(calls[0].url,/\/v1\/pages\/12345678-1234-1234-1234-123456789012$/);
    assert.equal(calls[0].options.method,'PATCH');
    assert.equal(calls[0].options.headers.Authorization,'Bearer test-notion-token');
    const changed=JSON.parse(calls[0].options.body).properties;
    assert.equal(changed["Prix d'achat (CAD)"].number,12);
  }finally{globalThis.fetch=previous}
});

test('incomplete purchase information can be edited without pretending its cost is zero',async()=>{
  const previous=globalThis.fetch;
  let last;
  globalThis.fetch=async (url,options)=>{last=JSON.parse(options.body);return Response.json({id:'new-page'})};
  try{
    const response=await call('POST','/api/mutate',{action:'create',entity:'ingredients',data:{name:'Unpriced ingredient',weight:'',price:''}});
    assert.equal(response.status,200);
    assert.equal(last.properties['Poids acheté (g)'].number,null);
    assert.equal(last.properties["Prix d'achat (CAD)"].number,null);
  }finally{globalThis.fetch=previous}
});


test('a real zero purchase price stays zero instead of becoming missing',async()=>{
  const previous=globalThis.fetch;
  let last;
  globalThis.fetch=async (url,options)=>{last=JSON.parse(options.body);return Response.json({id:'new-page'})};
  try{
    const response=await call('POST','/api/mutate',{action:'create',entity:'ingredients',data:{name:'Complimentary sample',weight:100,price:0}});
    assert.equal(response.status,200);
    assert.equal(last.properties['Poids acheté (g)'].number,100);
    assert.equal(last.properties["Prix d'achat (CAD)"].number,0);
  }finally{globalThis.fetch=previous}
});

test('wrong password is rejected without reaching Notion',async()=>{
  const previous=globalThis.fetch;
  globalThis.fetch=()=>{throw Error('Notion should not be contacted')};
  try{
    const response=await call('POST','/api/mutate',{action:'create',entity:'ingredients',data:{name:'Cocoa',weight:20,price:2}},'wrong');
    assert.equal(response.status,401);
  }finally{globalThis.fetch=previous}
});

test('reading the dashboard queries six existing databases',async()=>{
  const previous=globalThis.fetch;
  let active=0,maxActive=0,requests=0;
  globalThis.fetch=async()=>{
    active++;maxActive=Math.max(active,maxActive);requests++;
    const response=Response.json({results:[],has_more:false,next_cursor:null});
    active--;return response;
  };
  try{
    const response=await call('GET','/api/data');
    assert.equal(response.status,200);
    const result=await response.json();
    assert.equal(Object.keys(result).length,6);
    assert.equal(requests,6);
    assert.equal(maxActive,1);
  }finally{globalThis.fetch=previous}
});

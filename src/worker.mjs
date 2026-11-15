import {service,configured} from './composition.mjs';
const response=(status,value)=>new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer'}});
async function authorized(request,password){
 if(!password)return false;
 const candidate=request.headers.get('X-Karamel-Password')||'';
 const bytes=new TextEncoder();
 const [a,b]=await Promise.all([crypto.subtle.digest('SHA-256',bytes.encode(candidate)),crypto.subtle.digest('SHA-256',bytes.encode(password))]);
 const u=new Uint8Array(a),v=new Uint8Array(b);let diff=0;for(let i=0;i<u.length;i++)diff|=u[i]^v[i];return diff===0;
}
export default {async fetch(request,env){
 const url=new URL(request.url);
 if(url.pathname==='/health')return response(200,{ok:true,configured:Boolean(configured(env)&&env.APP_PASSWORD)});
 if(url.pathname.startsWith('/api/')){
   if(!configured(env)||!env.APP_PASSWORD)return response(503,{error:'Configure the selected database and APP_PASSWORD.'});
   if(!(await authorized(request,env.APP_PASSWORD)))return response(401,{error:'Incorrect application password.'});
   try{
     if(url.pathname==='/api/data'&&request.method==='GET'){
       return response(200,await service(env).read());
     }
     if(url.pathname==='/api/mutate'&&request.method==='POST'){
       if(Number(request.headers.get('content-length'))>25000)return response(413,{error:'Request too large'});
       const raw=await request.text();if(raw.length>25000)return response(413,{error:'Request too large'});
       const result=await service(env).mutate(JSON.parse(raw||'{}'));return response(200,{ok:true,id:result.id});
     }
     return response(404,{error:'Unknown API route'});
   }catch(e){return response(e.status===429?429:e.status>=500?502:e.status===401||e.status===403?502:400,{error:e.message||'Request failed'})}
 }
 if(request.method!=='GET'&&request.method!=='HEAD')return response(405,{error:'Method not allowed'});
 const asset=await env.ASSETS.fetch(request);
 const h=new Headers(asset.headers);
 h.set('Cache-Control','no-store');
 h.set('X-Content-Type-Options','nosniff');h.set('Referrer-Policy','no-referrer');
 h.set('Content-Security-Policy',"frame-ancestors 'self' https://www.notion.so https://notion.so https://*.notion.site; default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self'");
 return new Response(asset.body,{status:asset.status,headers:h});
}};

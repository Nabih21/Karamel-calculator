// Local Node entry point uses the same HTTP handler and application service as Cloudflare.
import http from 'node:http';
import fs from 'node:fs/promises';
import worker from './src/worker.mjs';
const env={...process.env,ASSETS:{async fetch(request){const path=new URL(request.url).pathname;const files={'/':'index.html','/index.html':'index.html','/pricing.mjs':'pricing.mjs'};if(!files[path])return new Response('Not found',{status:404});return new Response(await fs.readFile(new URL('./public/'+files[path],import.meta.url)),{headers:{'content-type':path.endsWith('.mjs')?'text/javascript':'text/html; charset=utf-8'}})}}};
http.createServer(async(req,res)=>{try{const request=new Request('http://localhost'+req.url,{method:req.method,headers:req.headers,...(['GET','HEAD'].includes(req.method)?{}:{body:req,duplex:'half'})});const response=await worker.fetch(request,env);res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()))}catch{res.writeHead(500);res.end('Internal server error')}}).listen(Number(process.env.PORT||3000),'0.0.0.0',()=>console.log('Karamel Studio ready'));

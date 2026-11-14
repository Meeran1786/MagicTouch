// MagicTouch local server - no installs needed, just Node.js.
// Serves this folder at http://localhost:8080 (camera access needs http://localhost, not file://)
const http=require('http'),fs=require('fs'),path=require('path');
const PORT=process.env.PORT||8080, ROOT=__dirname;
const TYPES={'.html':'text/html; charset=utf-8','.js':'text/javascript','.wasm':'application/wasm','.data':'application/octet-stream','.tflite':'application/octet-stream','.binarypb':'application/octet-stream','.png':'image/png','.json':'application/json','.css':'text/css','.svg':'image/svg+xml','.jpg':'image/jpeg','.mp3':'audio/mpeg'};
http.createServer((req,res)=>{
  let p=decodeURIComponent(req.url.split('?')[0]);
  if(p==='/'||p==='/poc'){res.writeHead(302,{Location:'/poc/'});return res.end();}  // main app: Classes 1-12 POC
  if(p.endsWith('/')) p+='index.html';
  const f=path.join(ROOT,path.normalize(p));
  if(!f.startsWith(ROOT)){res.writeHead(403);return res.end();}
  fs.readFile(f,(e,d)=>{ if(e){res.writeHead(404);return res.end('Not found');}
    res.writeHead(200,{'Content-Type':TYPES[path.extname(f)]||'application/octet-stream'}); res.end(d); });
}).listen(PORT,'127.0.0.1',()=>console.log('MagicTouch running at  http://localhost:'+PORT+'/  (keep this window open, Ctrl+C to stop)'));

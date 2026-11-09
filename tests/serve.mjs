import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const prefix = '/';
const port = 4175;
const types = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.json':'application/json', '.svg':'image/svg+xml', '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.gif':'image/gif', '.webp':'image/webp', '.pdf':'application/pdf', '.csv':'text/csv', '.mp4':'video/mp4' };
http.createServer((req,res)=>{
  let pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  if (prefix !== '/' && pathname.startsWith(prefix)) pathname = pathname.slice(prefix.length);
  if (pathname === '/' || pathname === '') pathname = '/index.html';
  const target = path.resolve(root, '.' + pathname);
  if (!target.startsWith(root + path.sep) && target !== root) { res.writeHead(403).end('Forbidden'); return; }
  fs.stat(target,(error,stat)=>{
    const file = error || !stat.isFile() ? path.join(target,'index.html') : target;
    fs.readFile(file,(readError,data)=>{
      if(readError){res.writeHead(404,{'content-type':'text/plain'}).end('Not found');return;}
      res.writeHead(200,{'content-type':types[path.extname(file).toLowerCase()]||'application/octet-stream'}).end(data);
    });
  });
}).listen(port,'127.0.0.1',()=>console.log(`Test site at http://127.0.0.1:${port}${prefix}`));

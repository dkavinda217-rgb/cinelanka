const ORIGIN='https://dkavinda217-rgb.github.io';
const DB_URL='https://nddooewojbjefuckijqo.supabase.co';
const PUBLIC_KEY='sb_publishable_o5FalRPFr26g6kD9WYJRmw_vEVcXcSY';
const PART_SIZE=32*1024*1024,MAX_SIZE=5*1024*1024*1024;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
function reply(data,status=200){return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Access-Control-Allow-Origin':ORIGIN,'Cache-Control':'no-store','Vary':'Origin'}})}
async function admin(request){const auth=request.headers.get('Authorization');if(!auth?.startsWith('Bearer '))return false;const headers={apikey:PUBLIC_KEY,Authorization:auth};const user=await fetch(DB_URL+'/auth/v1/user',{headers});if(!user.ok)return false;const {id}=await user.json();if(!id)return false;const res=await fetch(DB_URL+'/rest/v1/cinelanka_admins?select=user_id&user_id=eq.'+encodeURIComponent(id),{headers});return res.ok&&(await res.json()).length===1}
async function readJSON(request){const text=await request.text();if(text.length>100000)throw Error('Invalid request');return JSON.parse(text)}
export default {async fetch(request,env){
const url=new URL(request.url),path=url.pathname;
if(request.method==='OPTIONS')return new Response(null,{status:204,headers:{'Access-Control-Allow-Origin':ORIGIN,'Access-Control-Allow-Methods':'GET,HEAD,POST,PUT,DELETE,OPTIONS','Access-Control-Allow-Headers':'Authorization,Content-Type','Access-Control-Max-Age':'3600'}});
try{
if(path.startsWith('/media/')&&['GET','HEAD'].includes(request.method)){
 const key=path.slice(7);if(!/^videos\/[0-9a-f-]+\.(mp4|webm)$/.test(key))return reply({error:'Not found'},404);
 const obj=request.method==='HEAD'?await env.MOVIES.head(key):await env.MOVIES.get(key,{range:request.headers});if(!obj)return reply({error:'Not found'},404);
 const headers=new Headers({'Access-Control-Allow-Origin':ORIGIN,'Accept-Ranges':'bytes','Cache-Control':'public,max-age=86400','ETag':obj.httpEtag,'X-Content-Type-Options':'nosniff'});obj.writeHttpMetadata(headers);let status=200;
 if(obj.range&&'offset' in obj.range){const offset=obj.range.offset,length=obj.range.length;headers.set('Content-Range',`bytes ${offset}-${offset+length-1}/${obj.size}`);headers.set('Content-Length',String(length));status=206}else headers.set('Content-Length',String(obj.size));
 return new Response(request.method==='HEAD'?null:obj.body,{headers,status});
}
if(!path.startsWith('/uploads'))return reply({error:'Not found'},404);
if(request.headers.get('Origin')!==ORIGIN)return reply({error:'Origin not allowed'},403);
if(!await admin(request))return reply({error:'Admin login required'},403);
if(path==='/uploads'&&request.method==='POST'){
 const body=await readJSON(request);if(!Number.isSafeInteger(body.size)||body.size<1||body.size>MAX_SIZE||!['video/mp4','video/webm'].includes(body.type))return reply({error:'Use MP4/WebM, up to 5 GB.'},400);
 const id=crypto.randomUUID(),key='videos/'+id+(body.type==='video/mp4'?'.mp4':'.webm');const upload=await env.MOVIES.createMultipartUpload(key,{httpMetadata:{contentType:body.type,contentDisposition:'inline'}});
 await env.MOVIES.put('_uploads/'+id,JSON.stringify({key,uploadId:upload.uploadId,size:body.size,created:Date.now()}));return reply({id,partSize:PART_SIZE,parts:Math.ceil(body.size/PART_SIZE)});
}
const match=path.match(/^\/uploads\/([^/]+)(?:\/parts\/(\d+)|\/(complete))?$/);if(!match||!UUID.test(match[1]))return reply({error:'Not found'},404);
const id=match[1],record=await env.MOVIES.get('_uploads/'+id);if(!record)return reply({error:'Upload expired. Start again.'},404);const session=await record.json();const upload=env.MOVIES.resumeMultipartUpload(session.key,session.uploadId);const count=Math.ceil(session.size/PART_SIZE);
if(request.method==='DELETE'&&!match[2]&&!match[3]){await upload.abort();await env.MOVIES.delete('_uploads/'+id);return reply({cancelled:true})}
if(request.method==='PUT'&&match[2]){const number=Number(match[2]);if(number<1||number>count)return reply({error:'Invalid part'},400);const expected=number===count?session.size-(count-1)*PART_SIZE:PART_SIZE;const size=request.headers.get('Content-Length');if(size&&Number(size)!==expected)return reply({error:'Incorrect part size'},400);const bytes=await request.arrayBuffer();if(bytes.byteLength!==expected)return reply({error:'Incorrect part size'},400);return reply(await upload.uploadPart(number,bytes))}
if(request.method==='POST'&&match[3]){const body=await readJSON(request);if(!Array.isArray(body.parts)||body.parts.length!==count||body.parts.some((part,i)=>part.partNumber!==i+1||typeof part.etag!=='string'||part.etag.length>200))return reply({error:'Incomplete upload'},400);await upload.complete(body.parts);await env.MOVIES.delete('_uploads/'+id);return reply({url:url.origin+'/media/'+session.key})}
return reply({error:'Method not allowed'},405);
}catch{return reply({error:'Upload request failed. Please retry.'},500)}
}};

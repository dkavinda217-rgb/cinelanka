// Install after database.js, with window.CINELANKA_UPLOAD_URL set to the deployed Worker origin.
(()=>{
const endpoint=window.CINELANKA_UPLOAD_URL;
if(!endpoint)return;
const videoInput=$('#addVideo'),container=document.createElement('div');
container.innerHTML='<label>Upload video file<input id="videoFile" type="file" accept="video/mp4,video/webm,.mp4,.webm"></label><div class="managerTools"><button id="uploadVideo" class="secondary" type="button">Upload selected video</button><button id="cancelUpload" class="secondary" type="button" hidden>Cancel upload</button></div><progress id="uploadProgress" max="100" value="0" hidden></progress><p id="uploadMessage" role="status"></p>';
videoInput.closest('label').after(container);
let active=false,controller=null;
async function api(path,method,body,token){const fresh=await window.cinelankaUploadSession?.();if(!fresh)throw Error('Admin session expired. Log in again.');token=fresh.access_token;const res=await fetch(endpoint+path,{method,headers:{Authorization:'Bearer '+token,...(body instanceof Blob?{}:{'Content-Type':'application/json'})},body:body instanceof Blob?body:body?JSON.stringify(body):undefined,signal:controller?.signal});if(!res.ok)throw Error(res.status===403?'Admin session expired. Log in again.':'Upload failed ('+res.status+'). Try again.');return res.json()}
$('#cancelUpload').onclick=()=>controller?.abort();
$('#uploadVideo').onclick=async()=>{
 if(active)return;
 const file=$('#videoFile').files[0],message=$('#uploadMessage');
 if(!file){message.textContent='Choose a video file first.';return}
 const type=file.type||(/\.mp4$/i.test(file.name)?'video/mp4':/\.webm$/i.test(file.name)?'video/webm':'');
 if(!['video/mp4','video/webm'].includes(type)||file.size<1||file.size>5*1024**3){message.textContent='Choose an MP4 or WebM video up to 5 GB.';return}
 const session=await window.cinelankaUploadSession?.();if(!session){message.textContent='Log in as an admin first.';return}
 active=true;window.cinelankaUploading=true;window.cinelankaRefreshAdmin?.();controller=new AbortController();let id=null;
 $('#uploadVideo').disabled=true;$('#cancelUpload').hidden=false;$('#uploadProgress').hidden=false;$('#uploadProgress').value=0;$('#databaseSave').disabled=true;message.textContent='Starting upload…';
 try{
 const info=await api('/uploads','POST',{size:file.size,type},session.access_token);id=info.id;const parts=[];
 for(let number=1;number<=info.parts;number++){
   const chunk=file.slice((number-1)*info.partSize,Math.min(number*info.partSize,file.size),type);let part;
   for(let attempt=0;attempt<3;attempt++){try{part=await api('/uploads/'+id+'/parts/'+number,'PUT',chunk,session.access_token);break}catch(err){if(controller.signal.aborted||attempt===2)throw err}}
   parts.push({partNumber:part.partNumber,etag:part.etag});const percent=Math.round(Math.min(number*info.partSize,file.size)/file.size*100);$('#uploadProgress').value=percent;message.textContent='Uploading '+percent+'% — keep this tab open.';
 }
 message.textContent='Finishing upload…';const result=await api('/uploads/'+id+'/complete','POST',{parts},session.access_token);id=null;videoInput.value=result.url;$('#videoFile').value='';message.textContent='Upload complete. Add or save this movie, then click Save for everyone.';
 }catch(err){message.textContent=controller.signal.aborted?'Upload cancelled.':err.message;if(id){try{await fetch(endpoint+'/uploads/'+id,{method:'DELETE',headers:{Authorization:'Bearer '+session.access_token}})}catch{}}}
 finally{active=false;window.cinelankaUploading=false;controller=null;$('#uploadVideo').disabled=false;$('#cancelUpload').hidden=true;window.cinelankaRefreshAdmin?.()}
 };
window.addEventListener('beforeunload',e=>{if(active){e.preventDefault();e.returnValue=''}});
})();

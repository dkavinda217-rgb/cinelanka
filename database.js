(()=>{
const config=window.CINELANKA_DATABASE;
const state=$('#databaseStatus');
if(!config?.url||!config?.key){state.textContent='Database setup is not complete yet.';return}
if(!window.supabase){state.textContent='Login library could not load. Refresh and try again.';return}
const db=window.supabase.createClient(config.url,config.key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
let version=null,busy=false,admin=false;
const restore=document.createElement('button');
restore.type='button';restore.className='secondary';restore.textContent='Restore unsaved movies';restore.hidden=true;
$('#databaseSave').after(restore);
function draftAvailable(){try{return !!localStorage.getItem('cinelanka-catalog')}catch{return false}}
restore.onclick=()=>{
 if(!admin||busy||version===null||window.cinelankaUploading)return;
 try{
 const draft=validateCatalog(JSON.parse(localStorage.getItem('cinelanka-catalog')));
 const previous=localStorage.getItem('cinelanka-draft-version');
 if(previous!==null&&Number(previous)!==version){state.textContent='The online catalog changed. Your draft is preserved, but cannot replace newer changes.';return}
 if(!confirm('Restore this browser’s unsaved movies? Review them, then click Save for everyone.'))return;
 movies=draft;refresh();renderManager();lock();state.textContent='Draft restored. Review it, then click Save for everyone.';
 }catch{state.textContent='The saved draft could not be restored.'}
};

function lock(){restore.hidden=!admin||!draftAvailable();restore.disabled=busy||version===null||!!window.cinelankaUploading;$('#adminWorkspace').hidden=!admin;$('#adminHelp').hidden=!admin;const disabled=!admin||busy||version===null||!!window.cinelankaUploading;$('#movieForm').querySelectorAll('input,select,textarea,button').forEach(el=>el.disabled=el.id==='cancelUpload'&&window.cinelankaUploading?!admin||busy:disabled);$('#adminLogout').disabled=!!window.cinelankaUploading;$('#databaseSave').disabled=disabled;$('#managedMovies').querySelectorAll('button').forEach(el=>el.disabled=disabled)}
async function load(){const {data,error}=await db.from('cinelanka_catalog').select('movies,version').eq('id',1).single();if(error)throw Error('Could not load the shared catalog. Please try again.');movies=validateCatalog(data.movies);version=data.version;refresh();renderManager();lock()}
async function access(){admin=false;lock();const {data:{session}}=await db.auth.getSession();if(session){const {data,error}=await db.from('cinelanka_admins').select('user_id').eq('user_id',session.user.id).maybeSingle();admin=!error&&!!data}$('#adminLogin').hidden=admin;$('#adminLogout').hidden=!session;state.textContent=admin?'Logged in as admin. Changes can be saved for everyone.':session?'This account does not have admin access.':'Visitors can watch movies. Admin login is required to edit.';lock()}
$('#adminLogin').onsubmit=async e=>{e.preventDefault();if(busy)return;busy=true;state.textContent='Signing in…';const password=$('#adminPassword').value;$('#adminPassword').value='';try{const {error}=await db.auth.signInWithPassword({email:$('#adminEmail').value.trim(),password});if(error)throw Error('Login failed. Check your email and password.');await access()}catch(err){state.textContent=err.message}finally{busy=false;lock()}};
$('#adminLogout').onclick=async()=>{if(busy)return;await db.auth.signOut();await access()};
$('#databaseSave').onclick=async()=>{if(!admin||busy||version===null)return;busy=true;lock();state.textContent='Saving for everyone…';try{const snapshot=validateCatalog(movies);const {data,error}=await db.rpc('cinelanka_save_catalog',{p_movies:snapshot,p_expected_version:version});if(error){if(error.message.includes('catalog_conflict'))throw Error('Another admin updated the catalog. Reload the latest catalog before editing again.');throw Error('Save failed. Your current draft is still open. Try again.')}version=data;state.textContent='Saved! Everyone now sees this catalog. No GitHub upload needed.';try{localStorage.removeItem('cinelanka-catalog');localStorage.removeItem('cinelanka-draft-version')}catch{}}catch(err){state.textContent=err.message}finally{busy=false;lock()}};
$('#reloadDatabase').onclick=async()=>{if(busy||!confirm('Load the latest online catalog? Unsaved edits in this browser will be replaced.'))return;busy=true;lock();try{await load();state.textContent='Latest shared catalog loaded.'}catch(err){state.textContent=err.message}finally{busy=false;lock()}};
$('#manageOpen').addEventListener('click',()=>{lock()});
const originalPersist=persistCatalog;persistCatalog=next=>{if(!admin||busy){state.textContent='Log in as an admin before editing.';return false}const ok=originalPersist(next);lock();if(ok){try{localStorage.setItem('cinelanka-draft-version',String(version))}catch{}state.textContent='Saving movie for everyone…';queueMicrotask(()=>$('#databaseSave').onclick())}return ok};
db.auth.onAuthStateChange(()=>{setTimeout(()=>access().catch(()=>{admin=false;lock()}),0)});
window.cinelankaUploadSession=async()=>admin?(await db.auth.getSession()).data.session:null;window.cinelankaRefreshAdmin=lock;lock();Promise.all([load(),access()]).catch(err=>{state.textContent=err.message;lock()});
})();

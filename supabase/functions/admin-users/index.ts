import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
const cors={'Access-Control-Allow-Origin':Deno.env.get('APP_URL')??'http://localhost:5173','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'};
const out=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json'}});
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});if(req.method!=='POST')return out({error:'Method not allowed'},405);
 const auth=req.headers.get('Authorization');if(!auth?.startsWith('Bearer '))return out({error:'Sign in required'},401);
 const url=Deno.env.get('SUPABASE_URL')!,anon=Deno.env.get('SUPABASE_ANON_KEY')!,service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
 const caller=createClient(url,anon,{global:{headers:{Authorization:auth}}});const {data:{user},error}=await caller.auth.getUser();if(error||!user)return out({error:'Invalid session'},401);
 if(user.app_metadata?.role!=='admin')return out({error:'Administrator access required'},403);
 let body:{userId?:string;role?:string};try{body=await req.json()}catch{return out({error:'Invalid JSON'},400)}
 if(!body.userId||!['candidate','coordinator','admin'].includes(body.role??''))return out({error:'A user ID and valid role are required'},400);
 if(body.userId===user.id)return out({error:'You cannot change your own role here'},400);
 const admin=createClient(url,service);const {data:target,error:targetError}=await admin.auth.admin.getUserById(body.userId);if(targetError||!target)return out({error:'User not found'},404);
 const nextMeta={...target.user.app_metadata,role:body.role};const {error:updateError}=await admin.auth.admin.updateUserById(body.userId,{app_metadata:nextMeta});if(updateError)return out({error:'Could not update trusted role metadata'},502);
 const {error:profileError}=await admin.from('profiles').update({role:body.role}).eq('id',body.userId);if(profileError)return out({error:'Auth role updated; profile role sync needs administrator attention'},502);
 return out({updated:true});
});

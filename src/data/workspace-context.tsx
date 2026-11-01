import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { createDemoData, DEMO_ADMIN_ID, DEMO_READER_ID } from '@/domain/demo'
import { applyCommand, scopeWorkspace } from '@/domain/rules'
import { emptyWorkspace, type UserProfile, type WorkspaceCommand, type WorkspaceData } from '@/domain/model'
import { connect, loadWorkspace, readConnection, saveConnection, writeCommand, type Connection } from './supabase'

const demoKey='rcfito.demo.v1'
type CreateUserInput={email:string;password:string;display_name:string;role:'viewer'|'admin';agricultural_unit_ids:string[]}
const initialDemo=()=>{try {const parsed=JSON.parse(localStorage.getItem(demoKey)??'null'); if(parsed?.catalogs&&parsed?.projects&&parsed?.profiles)return parsed as WorkspaceData}catch{/* Start fresh after invalid demo data. */}return createDemoData()}
type WorkspaceContextValue={data:WorkspaceData;profile:UserProfile;isAdmin:boolean;mode:'demo'|'supabase';loading:boolean;error:string|null;warning:string|null;authenticated:boolean;connection:Connection|null;mutate:(c:WorkspaceCommand)=>Promise<void>;refresh:()=>Promise<void>;configure:(c:Connection|null)=>void;signIn:(email:string,password:string)=>Promise<void>;signOut:()=>Promise<void>;setDemoRole:(role:'admin'|'reader')=>void;resetDemo:()=>void;createUser:(input:CreateUserInput)=>Promise<void>}
const Context=createContext<WorkspaceContextValue|null>(null)
export function WorkspaceProvider({children}:{children:ReactNode}) {
  const [connection,setConnection]=useState(readConnection)
  const client=useMemo(()=>connection?connect(connection):null,[connection])
  const [session,setSession]=useState<Session|null>(null)
  const [data,setData]=useState<WorkspaceData>(()=>connection?emptyWorkspace():initialDemo())
  const [loading,setLoading]=useState(Boolean(connection)),[error,setError]=useState<string|null>(null),[warning,setWarning]=useState<string|null>(null)
  const [demoRole,setDemoRole]=useState<'admin'|'reader'>('admin')
  const dataRef=useRef(data);dataRef.current=data
  const generation=useRef(0)
  const identityRef=useRef<string|null>(null)
  const profile=useMemo(()=>data.profiles.find(p=>p.id===(client?session?.user.id:demoRole==='admin'?DEMO_ADMIN_ID:DEMO_READER_ID))??{id:session?.user.id??'',full_name:session?.user.email??'Sin sesión',role:'reader' as const},[data.profiles,client,session,demoRole])
  const refresh=useCallback(async()=>{
    if(!client)return
    const request=++generation.current
    try{const loaded=await loadWorkspace(client);if(request!==generation.current)return;setData(loaded);setError(null)}catch(e){if(request===generation.current)setError(e instanceof Error?e.message:'No se pudo actualizar la información.');throw e}finally{if(request===generation.current)setLoading(false)}
  },[client])
  useEffect(()=>{
    generation.current++;setError(null);setWarning(null)
    if(!client){setSession(null);setData(initialDemo());setLoading(false);return}
    setData(emptyWorkspace());setLoading(true)
    let alive=true
    void client.auth.getSession().then(({data,error})=>{if(!alive)return;if(error){setError(error.message);setLoading(false);return}setSession(data.session);if(!data.session)setLoading(false)})
    const {data:{subscription}}=client.auth.onAuthStateChange((_event,next)=>{if(!alive)return;const identity=next?.user.id??null;if(identityRef.current!==identity){generation.current++;setData(emptyWorkspace());setError(null);setLoading(Boolean(next));identityRef.current=identity}setSession(next);if(!next){generation.current++;setData(emptyWorkspace());setLoading(false)}})
    return()=>{alive=false;subscription.unsubscribe()}
  },[client])
  useEffect(()=>{if(client&&session){setLoading(true);void refresh().catch(()=>{})}},[client,session,refresh])
  const mutate=useCallback(async(c:WorkspaceCommand)=>{
    if(profile.role!=='admin')throw new Error('Solo la administración puede guardar cambios.')
    setWarning(null)
    if(!client){const next=applyCommand(dataRef.current,c,profile);localStorage.setItem(demoKey,JSON.stringify(next));dataRef.current=next;setData(next);return}
    await writeCommand(client,c)
    try{await refresh()}catch{setWarning('El cambio se guardó, pero no se pudo actualizar la vista. Usa Actualizar; no repitas la captura.')}
  },[client,profile,refresh])
  const configure=(c:Connection|null)=>{setConnection(saveConnection(c))}
  const signIn=async(email:string,password:string)=>{if(!client)throw new Error('Primero configura la conexión.');const{error}=await client.auth.signInWithPassword({email,password});if(error)throw error}
  const signOut=async()=>{if(!client)return;const{error}=await client.auth.signOut();if(error)throw error;setData(emptyWorkspace());setSession(null)}
  const resetDemo=()=>{const next=createDemoData();localStorage.setItem(demoKey,JSON.stringify(next));dataRef.current=next;setData(next);setDemoRole('admin')}
  const createUser=async(input:CreateUserInput)=>{if(!client||profile.role!=='admin')throw new Error('El alta de cuentas requiere conexión real y sesión de administración.');const{data,error}=await client.functions.invoke('admin-create-user',{body:input});if(error)throw error;if(data?.error)throw new Error(data.error);try{await refresh()}catch{setWarning('La cuenta se creó, pero no se pudo actualizar la lista. Actualiza la vista sin repetir el alta.')}}
  const value:WorkspaceContextValue={data:client?data:scopeWorkspace(data,profile),profile,isAdmin:profile.role==='admin',mode:client?'supabase':'demo',loading,error,warning,authenticated:client?Boolean(session):true,connection,mutate,refresh,configure,signIn,signOut,setDemoRole,resetDemo,createUser}
  return <Context.Provider value={value}>{children}</Context.Provider>
}
export function useWorkspace(){const c=useContext(Context);if(!c)throw new Error('Falta WorkspaceProvider.');return c}

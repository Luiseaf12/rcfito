import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { canViewMenu, type MenuKey } from '@/domain/menu-permissions'
import { createDemoData, DEMO_ADMIN_ID, DEMO_READER_ID } from '@/domain/demo'
import { applyCommand, scopeWorkspace } from '@/domain/rules'
import { completeCatalogs, emptyWorkspace, type UserProfile, type WorkspaceCommand, type WorkspaceData } from '@/domain/model'
import { connect, loadWorkspace, readConnection, saveConnection, writeCommand, type Connection } from './supabase'
import { interpretApplicationMessage } from './application-ai'
import { interpretApplicationImage, type CaptureImage } from './application-image'
import type { ImageExtraction } from '@/domain/application-image'
import { askApplicationChat, executeApplicationQuery as executeQuery, transcribeApplicationAudio as transcribeAudio, type ApplicationQueryFilters, type ApplicationChatResponse, type ApplicationQueryOptions } from './application-chat'
import type { ExtractedApplication } from '@/domain/application-import'
import { readAiSettings, testAiConnection, persistAiSettings, type AiSettingsStatus, type AiSettingsInput, type AiSettingsTestResult, type AiSettingsSaveInput } from './ai-settings'

const demoKey='rcfito.demo.v1'
type CreateUserInput={email:string;password:string;display_name:string;role:'viewer'|'admin';agricultural_unit_ids:string[];menu_permissions?:MenuKey[]}
const initialDemo=()=>{try {const parsed=JSON.parse(localStorage.getItem(demoKey)??'null'); if(parsed?.catalogs&&parsed?.projects&&parsed?.profiles)return {...emptyWorkspace(),...parsed,catalogs:completeCatalogs(parsed.catalogs),applicationOrders:parsed.applicationOrders??[],applicationTargets:parsed.applicationTargets??[],applicationChanges:parsed.applicationChanges??[],sowingGroups:parsed.sowingGroups??[]} as WorkspaceData}catch{/* Start fresh after invalid demo data. */}return createDemoData()}
type WorkspaceContextValue={data:WorkspaceData;profile:UserProfile;isAdmin:boolean;mode:'demo'|'supabase';loading:boolean;error:string|null;warning:string|null;authenticated:boolean;connection:Connection|null;mutate:(c:WorkspaceCommand)=>Promise<void>;refresh:()=>Promise<void>;configure:(c:Connection|null)=>void;signIn:(email:string,password:string)=>Promise<void>;signOut:()=>Promise<void>;setDemoRole:(role:'admin'|'reader')=>void;resetDemo:()=>void;createUser:(input:CreateUserInput)=>Promise<void>;interpretApplication:(message:string,signal?:AbortSignal)=>Promise<ExtractedApplication>;interpretImage:(message:string,image:CaptureImage,signal?:AbortSignal)=>Promise<ImageExtraction>;loadAiSettings:(signal?:AbortSignal)=>Promise<AiSettingsStatus>;testAiSettings:(input:AiSettingsInput,signal?:AbortSignal)=>Promise<AiSettingsTestResult>;saveAiSettings:(input:AiSettingsSaveInput,signal?:AbortSignal)=>Promise<AiSettingsStatus>}
type ChatWorkspaceContextValue = WorkspaceContextValue & {
  queryApplications: (message: string, context?: ApplicationQueryFilters, previousQuery?: ApplicationQueryFilters | null, signal?: AbortSignal) => Promise<ApplicationChatResponse>
  executeApplicationQuery: (query: ApplicationQueryFilters, signal?: AbortSignal, options?: ApplicationQueryOptions) => Promise<ApplicationChatResponse>
  transcribeApplicationAudio: (file: File, signal?: AbortSignal) => Promise<string>
}
const Context=createContext<ChatWorkspaceContextValue|null>(null)
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
  const profile=useMemo(()=>data.profiles.find(p=>p.id===(client?session?.user.id:demoRole==='admin'?DEMO_ADMIN_ID:DEMO_READER_ID))??{id:session?.user.id??'',full_name:session?.user.email??'Sin sesión',role:'reader' as const,menu_permissions:[]},[data.profiles,client,session,demoRole])
  const refresh=useCallback(async()=>{
    if(!client)return
    const request=++generation.current
    try{const loaded=await loadWorkspace(client);if(request!==generation.current)return;setData(loaded);setError(null)}catch(e){if(request===generation.current){if((e as {code?:string}).code==='42501')setData(emptyWorkspace());setError(e instanceof Error?e.message:'No se pudo actualizar la información.');}throw e}finally{if(request===generation.current)setLoading(false)}
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
  // Revalidating the same session must keep the route and its unsaved forms mounted.
  // Initial connection and identity changes already enable the blocking loader above.
  useEffect(()=>{if(client&&session){void refresh().catch(()=>{})}},[client,session,refresh])
  useEffect(()=>{if(!client||!session)return;const check=()=>{void refresh().catch(()=>{})};window.addEventListener('focus',check);return()=>window.removeEventListener('focus',check)},[client,session,refresh])
  const mutate=useCallback(async(c:WorkspaceCommand)=>{
    if(profile.role!=='admin'||profile.active===false)throw new Error('Solo la administración puede guardar cambios.')
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
  const interpretApplication=async(message:string,signal?:AbortSignal)=>{
    if(!client||profile.role!=='admin')throw new Error('La interpretación con IA requiere una sesión real de administración.')
    if(!connection?.managed)throw new Error('La IA usa la conexión gestionada de esta instalación. Revisa Conexión y preferencias.')
    const{data:{session:current},error}=await client.auth.getSession()
    if(error||!current)throw new Error('Tu sesión no está disponible. Inicia sesión nuevamente antes de interpretar.')
    return interpretApplicationMessage(message,current.access_token,signal)
  }
  const interpretImage=async(message:string,image:CaptureImage,signal?:AbortSignal)=>{
    if(!client||profile.role!=='admin')throw new Error('La interpretación de imágenes requiere una sesión real de administración.')
    if(!connection?.managed)throw new Error('La IA usa la conexión gestionada de esta instalación.')
    const{data:{session:current},error}=await client.auth.getSession()
    if(error||!current)throw new Error('Tu sesión no está disponible. Inicia sesión nuevamente antes de interpretar.')
    return interpretApplicationImage(message,image,current.access_token,signal)
  }
  const aiSettingsToken=useCallback(async()=>{
    if(!client||profile.role!=='admin')throw new Error('La configuración de IA requiere una sesión real de administración.')
    if(!connection?.managed)throw new Error('La configuración de IA usa la conexión gestionada de esta instalación.')
    const{data:{session:current},error}=await client.auth.getSession()
    if(error||!current)throw new Error('Tu sesión no está disponible. Inicia sesión nuevamente.')
    return current.access_token
  },[client,profile.role,connection?.managed])
  const loadAiSettings=useCallback(async(signal?:AbortSignal)=>readAiSettings(await aiSettingsToken(),signal),[aiSettingsToken])
  const testAiSettings=useCallback(async(input:AiSettingsInput,signal?:AbortSignal)=>testAiConnection(await aiSettingsToken(),input,signal),[aiSettingsToken])
  const saveAiSettings=useCallback(async(input:AiSettingsSaveInput,signal?:AbortSignal)=>persistAiSettings(await aiSettingsToken(),input,signal),[aiSettingsToken])
  const queryToken=useCallback(async()=>{
    if(!canViewMenu(profile,'queries'))throw new Error('Tu cuenta no tiene acceso a Consultas.')
    if(!client||!connection?.managed)throw new Error('Las consultas con IA requieren la conexión gestionada de esta instalación.')
    const {data:{session:current},error}=await client.auth.getSession()
    if(error||!current)throw new Error('Tu sesión no está disponible. Inicia sesión nuevamente.')
    return current.access_token
  },[client,connection?.managed,profile])
  const queryApplications=useCallback(async(message:string,context:ApplicationQueryFilters={},previousQuery?:ApplicationQueryFilters|null,signal?:AbortSignal)=>askApplicationChat(message,await queryToken(),context,previousQuery,signal),[queryToken])
  const transcribeApplicationAudio=useCallback(async(file:File,signal?:AbortSignal)=>transcribeAudio(file,await queryToken(),signal),[queryToken])
  const executeApplicationQuery=useCallback(async(query:ApplicationQueryFilters,signal?:AbortSignal,options?:ApplicationQueryOptions)=>executeQuery(query,await queryToken(),signal,options),[queryToken])
  const value:ChatWorkspaceContextValue={data:client?data:scopeWorkspace(data,profile),profile,isAdmin:profile.role==='admin'&&profile.active!==false,mode:client?'supabase':'demo',loading,error,warning,authenticated:client?Boolean(session):true,connection,mutate,refresh,configure,signIn,signOut,setDemoRole,resetDemo,createUser,interpretApplication,interpretImage,loadAiSettings,testAiSettings,saveAiSettings,queryApplications,transcribeApplicationAudio,executeApplicationQuery}
  return <Context.Provider value={value}>{children}</Context.Provider>
}
export function useWorkspace(){const c=useContext(Context);if(!c)throw new Error('Falta WorkspaceProvider.');return c}

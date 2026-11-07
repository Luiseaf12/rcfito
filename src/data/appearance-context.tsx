import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { useWorkspace } from './workspace-context'
import { resolvedAppearance, type Appearance } from '@/domain/appearance'
type AppearanceState={value:Appearance;busy:boolean;error:string|null;save:(value:Appearance)=>Promise<void>;retry:()=>void}
const Context=createContext<AppearanceState|null>(null)
export function AppearanceProvider({children}:{children:ReactNode}) {
  const {profile,mode,connection,authenticated,loadAppearance,saveAppearance}=useWorkspace()
  const owner=authenticated?`${mode}:${connection?.url??'demo'}:${profile.id}`:''
  const [stored,setStored]=useState({owner:'',value:'system' as Appearance})
  const [status,setStatus]=useState({owner:'',busy:false,error:null as string|null})
  const [systemDark,setSystemDark]=useState(()=>window.matchMedia('(prefers-color-scheme: dark)').matches)
  const request=useRef(0),saving=useRef(false),ownerRef=useRef(owner);ownerRef.current=owner
  const [retryKey,retry]=useState(0)
  const value=stored.owner===owner?stored.value:'system'
  useLayoutEffect(()=>{
    const theme=resolvedAppearance(value,systemDark)
    document.documentElement.classList.toggle('dark',theme==='dark')
    document.documentElement.style.colorScheme=theme
  },[value,systemDark])
  useEffect(()=>{
    const media=window.matchMedia('(prefers-color-scheme: dark)')
    const changed=()=>setSystemDark(media.matches)
    changed();media.addEventListener('change',changed)
    return()=>media.removeEventListener('change',changed)
  },[])
  useEffect(()=>{
    let alive=true;saving.current=false
    const refresh=async(initial=false)=>{
      if(!owner||saving.current)return
      const serial=++request.current
      if(initial)setStatus({owner,busy:true,error:null})
      try{const selected=await loadAppearance();if(alive&&serial===request.current){setStored({owner,value:selected});setStatus({owner,busy:false,error:null})}}
      catch(error){if(alive&&serial===request.current)setStatus({owner,busy:false,error:error instanceof Error?error.message:'No se pudo consultar tu apariencia.'})}
    }
    void refresh(true)
    const focus=()=>{void refresh()};window.addEventListener('focus',focus)
    return()=>{alive=false;request.current++;window.removeEventListener('focus',focus)}
  },[owner,loadAppearance,retryKey])
  async function save(selected:Appearance){
    if(!owner||saving.current)return
    saving.current=true;const serial=++request.current;setStatus({owner,busy:true,error:null})
    try{const result=await saveAppearance(selected);if(ownerRef.current===owner&&serial===request.current){setStored({owner,value:result});setStatus({owner,busy:false,error:null})}}
    catch(error){if(ownerRef.current===owner&&serial===request.current)setStatus({owner,busy:false,error:error instanceof Error?error.message:'No se pudo guardar tu apariencia.'})}
    finally{if(ownerRef.current===owner)saving.current=false}
  }
  return <Context.Provider value={{value,busy:status.owner===owner?status.busy:Boolean(owner),error:status.owner===owner?status.error:null,save,retry:()=>retry(key=>key+1)}}>{children}</Context.Provider>
}
export function useAppearance(){const value=useContext(Context);if(!value)throw new Error('Falta el proveedor de apariencia.');return value}

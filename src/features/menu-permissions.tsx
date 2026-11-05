import { useId } from 'react'
import { Field, FieldDescription, FieldLabel, FieldLegend, FieldSet } from '@/components/ui/field'
import { Checkbox } from '@/components/ui/checkbox'
import { FormSelect } from './shared'
import { effectiveMenus, menuDefinitions, menuTemplates, normalizeMenus, type MenuKey } from '@/domain/menu-permissions'
import type { CatalogRecord, UserAccessChange, UserProfile } from '@/domain/model'

export function MenuPermissionsEditor({ role, menus, onChange, users, userId, disabled = false }: { role: UserProfile['role']; menus: MenuKey[]; onChange: (keys: MenuKey[]) => void; users: UserProfile[]; userId?: string; disabled?: boolean }) {
  const prefix=useId(),admin=role==='admin'
  return <FieldSet><FieldLegend>Permisos de menú</FieldLegend><FieldDescription>{admin?'La plantilla Administración habilita todas las secciones. Para limitar los menús, utiliza el rol Usuario de consulta.':'Selecciona las secciones que puede abrir. El rol sigue siendo de consulta y las agrícolas asignadas delimitan sus datos.'}</FieldDescription>
    {!admin&&<div className="field-grid"><FormSelect label="Aplicar plantilla de menús" value="__choose" onChange={key=>{const template=menuTemplates.find(item=>item.key===key);if(template)onChange([...template.menus])}} options={[{value:'__choose',label:'Seleccionar plantilla…'},...menuTemplates.map(item=>({value:item.key,label:item.label}))]} disabled={disabled}/><FormSelect label="Copiar permisos de otro usuario" value="__choose" onChange={id=>{const source=users.find(user=>user.id===id);if(source)onChange(normalizeMenus(effectiveMenus(source)))}} options={[{value:'__choose',label:'Seleccionar usuario…'},...users.filter(user=>user.id!==userId&&user.active!==false).map(user=>({value:user.id,label:user.full_name}))]} disabled={disabled}/></div>}
    {(['workspace','catalogs','administration'] as const).map(group=><FieldSet key={group}><FieldLegend variant="label">{group==='workspace'?'Espacio de trabajo':group==='catalogs'?'Catálogos':'Administración'}</FieldLegend><div className="assignment-options">{menuDefinitions.filter(menu=>menu.group===group).map(menu=><Field orientation="horizontal" key={menu.key} data-disabled={disabled||admin||menu.adminOnly}><Checkbox id={`${prefix}-${menu.key}`} disabled={disabled||admin||menu.adminOnly} checked={admin||menus.includes(menu.key)} onCheckedChange={checked=>onChange(normalizeMenus(checked===true?[...menus,menu.key]:menus.filter(key=>key!==menu.key)))}/><FieldLabel htmlFor={`${prefix}-${menu.key}`}>{menu.label}{menu.adminOnly&&!admin?' · Requiere administrador':''}</FieldLabel></Field>)}</div></FieldSet>)}
    {!admin&&menus.length===0&&<p className="muted">La cuenta podrá iniciar sesión y salir, pero no tendrá secciones habilitadas.</p>}
    <FieldDescription>Los filtros pueden mostrar referencias mínimas de sus registros autorizados. Los catálogos completos requieren su propio permiso.</FieldDescription>
  </FieldSet>
}

export function UserMenuAccessHistory({changes,userId,units}:{changes:UserAccessChange[];userId:string;units:CatalogRecord[]}) {
  const history=changes.filter(change=>change.user_id===userId).sort((a,b)=>b.changed_at.localeCompare(a.changed_at)).slice(0,20)
  const label=(key:string)=>menuDefinitions.find(menu=>menu.key===key)?.label??key
  const role=(value:string)=>value==='admin'?'Administrador':'Consulta'
  const names=(ids:string[])=>ids.map(id=>units.find(unit=>unit.id===id)?.name??'Referencia retirada').join(', ')||'Ninguna'
  return <FieldSet><FieldLegend>Historial de acceso</FieldLegend>{history.map(change=>{
    const added=change.after.menus.filter(key=>!change.before.menus.includes(key)),removed=change.before.menus.filter(key=>!change.after.menus.includes(key))
    return <article className="flex flex-col gap-2" key={change.id}><p><strong>{change.changed_by_name}</strong> · {new Intl.DateTimeFormat('es-MX',{dateStyle:'medium',timeStyle:'short'}).format(new Date(change.changed_at))}</p>{!!added.length&&<p className="muted">Menús agregados: {added.map(label).join(', ')}.</p>}{!!removed.length&&<p className="muted">Menús retirados: {removed.map(label).join(', ')}.</p>}{change.before.role!==change.after.role&&<p className="muted">Rol: {role(change.before.role)} → {role(change.after.role)}.</p>}{JSON.stringify(change.before.agricultural_unit_ids)!==JSON.stringify(change.after.agricultural_unit_ids)&&<p className="muted">Agrícolas: {names(change.before.agricultural_unit_ids)} → {names(change.after.agricultural_unit_ids)}.</p>}{!added.length&&!removed.length&&change.before.role===change.after.role&&JSON.stringify(change.before.agricultural_unit_ids)===JSON.stringify(change.after.agricultural_unit_ids)&&<p className="muted">Acceso revisado y guardado.</p>}</article>
  })}{!history.length&&<p className="muted">Sin cambios de acceso registrados.</p>}</FieldSet>
}

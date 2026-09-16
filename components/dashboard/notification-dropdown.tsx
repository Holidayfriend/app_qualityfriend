"use client";

import { useEffect, useId, useRef, useState } from "react";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useI18n } from "../i18n/i18n-provider";
import { notificationMessages, requestMessages } from "../../lib/i18n/dictionaries";
import { BrandLoader } from "../ui/brand-loader";

type Notification = { id:string; title:string; detail:string; icon:string; destination:string; read:boolean; createdAt:string };
const icons:Record<string,{icon:string;background:string}>={housekeeping:{icon:"🧹",background:"#DCFCE7"},jobs:{icon:"📋",background:"#FEF3C7"},schedule:{icon:"📅",background:"#DBEAFE"},revenue:{icon:"📈",background:"#EDE9FE"},notes:{icon:"📝",background:"#FEF9E7"},"📝":{icon:"📝",background:"#FEF9E7"}};

export function NotificationDropdown({ fullPage = false }: { fullPage?: boolean }) {
  const router=useRouter();
  const {locale}=useI18n();
  const t=notificationMessages[locale];
  const [notifications,setNotifications]=useState<Notification[]>([]);
  const [unreadCount,setUnreadCount]=useState(0);
  const [loading,setLoading]=useState(true);
  const [failed,setFailed]=useState(false);
  const [page,setPage]=useState(1);
  const [totalPages,setTotalPages]=useState(1);
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useEffect(() => {
    let active=true;
    const controller=new AbortController();
    async function load(){
      try{
        const response=await fetch(`/api/notifications?locale=${locale}&limit=${fullPage?20:5}&page=${page}`,{cache:"no-store",signal:controller.signal});
        if(!response.ok)throw new Error();
        const result=await response.json();
        if(active){setNotifications(result.notifications);setUnreadCount(result.unreadCount);setTotalPages(result.totalPages);setPage(result.page);setFailed(false)}
      }catch{if(active)setFailed(true)}
      finally{if(active)setLoading(false)}
    }
    void load();
    const timer=window.setInterval(()=>{if(document.visibilityState==="visible")void load()},5000);
    return()=>{active=false;controller.abort();window.clearInterval(timer)};
  },[locale,open,fullPage,page]);

  async function visit(notification:Notification){
    try{
      const result=await fetch("/api/notifications",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:notification.id})});
      if(result.ok){setNotifications(items=>items.map(item=>item.id===notification.id?{...item,read:true}:item));if(!notification.read)setUnreadCount(count=>Math.max(0,count-1))}
    }catch{/* Navigation remains available if read acknowledgement fails. */}
    setOpen(false);
    if(/^\/[a-z0-9][a-z0-9/_-]*$/i.test(notification.destination))router.push(notification.destination);
  }

  useEffect(() => {
    if (!open) return;
    function dismissOutside(event: PointerEvent) {
      if (event.target instanceof Node && !container.current?.contains(event.target)) setOpen(false);
    }
    function dismissEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
      }
    }
    document.addEventListener("pointerdown", dismissOutside);
    document.addEventListener("keydown", dismissEscape);
    return () => {
      document.removeEventListener("pointerdown", dismissOutside);
      document.removeEventListener("keydown", dismissEscape);
    };
  }, [open]);

  if (fullPage && loading) return <BrandLoader label={requestMessages[locale].loading} />;

  const list = <div className={fullPage?"py-1.5":"max-h-[400px] overflow-y-auto py-1.5"}>
    {loading||failed||!notifications.length?<p role={failed?"alert":"status"} className="px-4 py-3 text-sm text-[var(--qf-text-muted)]">{loading?t.loading:failed?t.failed:t.empty}</p>:null}
    {!loading&&!failed&&notifications.map(notification=><button key={notification.id} type="button" onClick={()=>void visit(notification)} className="flex w-full cursor-pointer items-start gap-3 border-b border-[var(--qf-border)] px-4 py-3 text-left transition last:border-b-0 hover:bg-[var(--qf-accent-soft)]">
      <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{background:icons[notification.icon]?.background??"#DBEAFE",fontSize:15}}>{icons[notification.icon]?.icon??"i"}</span>
      <span className="min-w-0 break-words">
        <span className="block text-sm font-semibold">{notification.title}{!notification.read?<span aria-label={t.unread} className="ml-2 inline-block h-1.5 w-1.5 rounded-full bg-[var(--qf-accent)]"/>:null}</span>
        <span className="mt-0.5 block text-xs text-[var(--qf-text-muted)]">{notification.detail}</span>
        {fullPage?<time dateTime={notification.createdAt} className="mt-1 block text-xs text-[var(--qf-text-muted)]">{new Date(notification.createdAt).toLocaleString(locale)}</time>:null}
      </span>
    </button>)}
  </div>;

  if(fullPage)return <section aria-label={t.title} className="overflow-hidden rounded-xl border border-[var(--qf-border)] bg-white">
    {list}
    <nav aria-label={t.pagination} className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--qf-border)] px-4 py-3 text-sm">
      <button type="button" disabled={loading||page<=1} onClick={()=>{setLoading(true);setPage(page-1)}} className="cursor-pointer rounded-lg border border-[var(--qf-border)] px-3 py-2 disabled:cursor-default disabled:opacity-40">{t.previous}</button>
      <span aria-live="polite">{t.pageOf.replace("{page}",String(page)).replace("{total}",String(totalPages))}</span>
      <button type="button" disabled={loading||page>=totalPages} onClick={()=>{setLoading(true);setPage(page+1)}} className="cursor-pointer rounded-lg border border-[var(--qf-border)] px-3 py-2 disabled:cursor-default disabled:opacity-40">{t.next}</button>
    </nav>
  </section>;

  return <div ref={container} className="relative" onBlur={(event) => {
    if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
  }}>
    <button ref={trigger} type="button" aria-label={t.title} aria-expanded={open} aria-controls={panelId} onClick={() => setOpen(!open)} className="relative flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-[var(--qf-border)] bg-white" style={{ fontSize: 16 }}>
      🔔{unreadCount>0?<span className="absolute right-[5px] top-[5px] h-2 w-2 rounded-full border-2 border-white bg-[var(--qf-danger)]" />:null}
    </button>
    {open && <section id={panelId} aria-label={t.title} className="absolute right-0 top-[44px] z-[100] w-[320px] max-w-[calc(100vw-32px)] overflow-hidden rounded-[10px] border border-[var(--qf-border)] bg-white text-[var(--qf-text)] shadow-[0_12px_32px_rgba(0,0,0,.15)]" style={{ lineHeight: "normal" }}>
      <div className="border-b border-[var(--qf-border)] px-4 py-3 text-[13px] font-bold">{t.title}</div>
      {list}
      <Link href="/notifications" onClick={()=>setOpen(false)} className="block border-t border-[var(--qf-border)] px-4 py-3 text-center text-sm font-semibold text-[var(--qf-accent)] hover:bg-[var(--qf-accent-soft)]">{t.seeAll}</Link>
    </section>}
  </div>;
}

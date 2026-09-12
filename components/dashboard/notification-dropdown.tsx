"use client";

import { useEffect, useId, useRef, useState } from "react";

import { useRouter } from "next/navigation";
import { useI18n } from "../i18n/i18n-provider";
import { notificationMessages } from "../../lib/i18n/dictionaries";

type Notification = { id:string; title:string; detail:string; icon:string; destination:string; read:boolean; createdAt:string };
const icons:Record<string,{icon:string;background:string}>={housekeeping:{icon:"\u{1F9F9}",background:"#DCFCE7"},jobs:{icon:"\u{1F4CB}",background:"#FEF3C7"},schedule:{icon:"\u{1F4C5}",background:"#DBEAFE"},revenue:{icon:"\u{1F4C8}",background:"#EDE9FE"}};

export function NotificationDropdown() {
  const router=useRouter();
  const {locale}=useI18n();
  const t=notificationMessages[locale];
  const [notifications,setNotifications]=useState<Notification[]>([]);
  const [unreadCount,setUnreadCount]=useState(0);
  const [loading,setLoading]=useState(true);
  const [failed,setFailed]=useState(false);
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useEffect(() => {
    let active=true;
    const controller=new AbortController();
    async function load(){
      try{
        const response=await fetch(`/api/notifications?locale=${locale}`,{cache:"no-store",signal:controller.signal});
        if(!response.ok)throw new Error();
        const result=await response.json();
        if(active){setNotifications(result.notifications);setUnreadCount(result.unreadCount);setFailed(false)}
      }catch{if(active)setFailed(true)}
      finally{if(active)setLoading(false)}
    }
    void load();
    const timer=window.setInterval(()=>{if(document.visibilityState==="visible")void load()},5000);
    return()=>{active=false;controller.abort();window.clearInterval(timer)};
  },[locale,open]);

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

  return <div ref={container} className="relative" onBlur={(event) => {
    if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
  }}>
    <button ref={trigger} type="button" aria-label={t.title} aria-expanded={open} aria-controls={panelId} onClick={() => setOpen(!open)} className="relative flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-[var(--qf-border)] bg-white" style={{ fontSize: 16 }}>
      🔔{unreadCount>0?<span className="absolute right-[5px] top-[5px] h-2 w-2 rounded-full border-2 border-white bg-[var(--qf-danger)]" />:null}
    </button>
    {open && <section id={panelId} aria-label={t.title} className="absolute right-0 top-[44px] z-[100] w-[320px] max-w-[calc(100vw-32px)] overflow-hidden rounded-[10px] border border-[var(--qf-border)] bg-white text-[var(--qf-text)] shadow-[0_12px_32px_rgba(0,0,0,.15)]" style={{ lineHeight: "normal" }}>
      <div className="border-b border-[var(--qf-border)] px-4 py-3 text-[13px] font-bold">{t.title}</div>
      <div className="max-h-[400px] overflow-y-auto py-1.5">{loading||failed||!notifications.length?<p role={failed?"alert":"status"} className="px-4 py-3 text-[12px] text-[var(--qf-text-muted)]">{loading?t.loading:failed?t.failed:t.empty}</p>:null}
        {notifications.map((notification) => <button key={notification.id} type="button" onClick={() => void visit(notification)} className="flex w-full cursor-pointer items-start gap-3 border-b border-[var(--qf-border)] px-4 py-2.5 text-left last:border-b-0">
          <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ background: (icons[notification.icon]??{background:"#DBEAFE"}).background, fontSize: 15 }}>{icons[notification.icon]?.icon??"i"}</span>
          <span>
            <span className="block text-[13.5px] font-semibold leading-[1.3]">{notification.title}{!notification.read?<span aria-label={t.unread} className="ml-2 inline-block h-1.5 w-1.5 rounded-full bg-[var(--qf-accent)]"/>:null}</span>
            <span className="mt-0.5 block text-[12px] text-[var(--qf-text-muted)]">{notification.detail}</span>
          </span>
        </button>)}
      </div>
    </section>}
  </div>;
}

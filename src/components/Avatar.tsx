import { ASSET_BASE } from "../services/api";
import type { User } from "../types";
import { useMemo, useState } from "react";

function colorFromName(name: string) {
  if (!name) return "hsl(210 30% 92%)";
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue} 65% 88%)`;
}

export function Avatar({ user }: { user: User }) {
  const [imgErr, setImgErr] = useState(false);
  const safeName = useMemo(() => {
    const raw = String(user?.name ?? "").trim();
    return raw || "User";
  }, [user?.name]);
  const src = useMemo(() => {
    const raw = String(user.avatar_url || "").trim();
    if (!raw) return "";
    if (raw.startsWith("http://") || raw.startsWith("https://") || raw.startsWith("data:") || raw.startsWith("blob:")) return raw;
    const normalized = raw.startsWith("/") ? raw : `/${raw}`;
    return `${ASSET_BASE}${normalized}`;
  }, [user.avatar_url]);
  if (src && !imgErr) return <img className="avatar" src={src} alt={safeName} onError={() => setImgErr(true)} />;
  return <div className="avatar fallback" style={{ background: colorFromName(safeName) }}>{safeName.slice(0, 1).toUpperCase()}</div>;
}

import { ASSET_BASE } from "../services/api";
import type { User } from "../types";

function colorFromName(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue} 65% 88%)`;
}

export function Avatar({ user }: { user: User }) {
  const src = user.avatar_url ? (user.avatar_url.startsWith("http") ? user.avatar_url : `${ASSET_BASE}${user.avatar_url}`) : "";
  if (src) return <img className="avatar" src={src} alt={user.name} />;
  return <div className="avatar fallback" style={{ background: colorFromName(user.name) }}>{user.name.slice(0, 1).toUpperCase()}</div>;
}

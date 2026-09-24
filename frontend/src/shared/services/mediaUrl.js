import { API_BASE_URL } from "@/shared/api/apiClient";

export function resolveMediaUrl(path) {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;      // already absolute (Google CDN fallback)
  const origin = API_BASE_URL.replace(/\/api\/?$/, '');
  return `${origin}/${path.replace(/^\//, '')}`;
}
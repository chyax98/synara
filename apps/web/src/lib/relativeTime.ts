// FILE: relativeTime.ts
// Purpose: 紧凑型相对时间标签（"刚刚"、"5分钟"、"3小时"、"2天"）用于会话列表。
// Layer: Web UI utility

export function formatRelativeTime(iso: string): string {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes}分钟`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}小时`;
  return `${Math.floor(hours / 24)}天`;
}
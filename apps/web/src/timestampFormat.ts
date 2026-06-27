// FILE: timestampFormat.ts
// Purpose: 纯手工中文时间格式化，不依赖 Intl/ICU 运行时数据。
// 中文产品统一使用 24 小时制 "HH:MM:SS" / "HH:MM" 与中文上午/下午标识，
// 完全忽略浏览器 locale 与 timestampFormat 选项（保留入参签名以兼容调用方）。
// Layer: web 纯展示工具
// Exports: getTimestampFormatOptions, formatTimestamp, formatShortTimestamp

import { type TimestampFormat } from "./appSettings";

// 保留导出以兼容旧调用方/测试。中文产品固定 24 小时制，不再读取 timestampFormat。
export function getTimestampFormatOptions(
  _timestampFormat: TimestampFormat,
  includeSeconds: boolean,
): Intl.DateTimeFormatOptions {
  const baseOptions: Intl.DateTimeFormatOptions = {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    ...(includeSeconds ? { second: "2-digit" } : {}),
  };
  return baseOptions;
}

function pad2(value: number): string {
  return value < 10 ? `0${value}` : `${value}`;
}

// 纯手工 24 小时制中文时间，零 Intl 依赖。
function formatChineseTime(isoDate: string, includeSeconds: boolean): string {
  const date = new Date(isoDate);
  const hours = pad2(date.getHours());
  const minutes = pad2(date.getMinutes());
  if (includeSeconds) {
    const seconds = pad2(date.getSeconds());
    return `${hours}:${minutes}:${seconds}`;
  }
  return `${hours}:${minutes}`;
}

export function formatTimestamp(isoDate: string, _timestampFormat: TimestampFormat): string {
  return formatChineseTime(isoDate, true);
}

export function formatShortTimestamp(isoDate: string, _timestampFormat: TimestampFormat): string {
  return formatChineseTime(isoDate, false);
}

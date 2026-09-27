import { randomUUID } from 'node:crypto';
import type { Heartbeat, Observation, QualityReport, Station, StationConnectivity, StationStatus, StationStatusEvent } from './types.js';

export const HEARTBEAT_TIMEOUT_MS = Number(process.env.HEARTBEAT_TIMEOUT_MS ?? 60_000);

export const stations: Station[] = [
  { id: 'st-001', code: 'QZ-A01', name: '青岚台站', region: '川西断裂带', elevationM: 1840, status: 'online', lastSeenAt: new Date().toISOString() },
  { id: 'st-002', code: 'QZ-B07', name: '白石台站', region: '龙门山南段', elevationM: 920, status: 'online', lastSeenAt: new Date().toISOString() },
  { id: 'st-003', code: 'QZ-C12', name: '岷江台站', region: '岷江河谷', elevationM: 2470, status: 'maintenance', lastSeenAt: new Date().toISOString() }
];
export const observations: Observation[] = [];
export const reports: QualityReport[] = [];
export const heartbeats: Heartbeat[] = [];
export const statusEvents: StationStatusEvent[] = [];

function transition(station: Station, to: StationStatus, reason: StationStatusEvent['reason'], changedAt: string): StationStatusEvent {
  const event: StationStatusEvent = { id: randomUUID(), stationId: station.id, from: station.status, to, reason, changedAt, lastSeenAt: station.lastSeenAt };
  statusEvents.push(event);
  station.status = to;
  return event;
}

// 应用一次台站活动（心跳或观测）。lastSeenAt 只前进不后退：
// 迟到/重复事件（事件时间不晚于最近有效上报）不改变任何状态；
// 新鲜事件把失联台站恢复为在线；过期事件只更新 lastSeenAt，不会误恢复。
export function applyStationActivity(station: Station, eventAtRaw: string, source: 'heartbeat' | 'observation'): { applied: boolean; event?: StationStatusEvent } {
  const now = Date.now();
  const parsed = Date.parse(eventAtRaw);
  if (Number.isNaN(parsed)) return { applied: false };
  const eventMs = Math.min(parsed, now); // 未来时间按接收时间截断，避免异常时钟把台站永久钉在在线
  if (eventMs <= Date.parse(station.lastSeenAt)) return { applied: false };
  station.lastSeenAt = new Date(eventMs).toISOString();
  if (station.status === 'maintenance') return { applied: true }; // 维护态由人工管理，不自动改写
  const changedAt = new Date(now).toISOString();
  const fresh = now - eventMs <= HEARTBEAT_TIMEOUT_MS;
  if (fresh && station.status === 'offline') return { applied: true, event: transition(station, 'online', source, changedAt) };
  if (!fresh && station.status === 'online') return { applied: true, event: transition(station, 'offline', 'timeout', changedAt) };
  return { applied: true };
}

export function recordHeartbeat(station: Station, sentAt: string): { heartbeat: Heartbeat; statusEvent?: StationStatusEvent } {
  const { applied, event } = applyStationActivity(station, sentAt, 'heartbeat');
  const heartbeat: Heartbeat = { id: randomUUID(), stationId: station.id, sentAt, receivedAt: new Date().toISOString(), applied };
  heartbeats.push(heartbeat);
  return { heartbeat, statusEvent: event };
}

// 巡检：超过心跳超时仍未上报的在线台站判定为失联
export function sweepLostStations(nowMs = Date.now()): StationStatusEvent[] {
  const events: StationStatusEvent[] = [];
  for (const station of stations) {
    if (station.status !== 'online') continue;
    if (nowMs - Date.parse(station.lastSeenAt) > HEARTBEAT_TIMEOUT_MS) events.push(transition(station, 'offline', 'timeout', new Date(nowMs).toISOString()));
  }
  return events;
}

// 值守视图：先按当前时间刷新失联判定，再汇总每台站的失联/恢复情况
export function getConnectivity(nowMs = Date.now()): StationConnectivity[] {
  sweepLostStations(nowMs);
  return stations.map(station => {
    const history = statusEvents.filter(item => item.stationId === station.id);
    const lastLost = [...history].reverse().find(item => item.to === 'offline');
    const lastRecovered = [...history].reverse().find(item => item.to === 'online');
    const lostAt = station.status === 'offline' ? lastLost?.changedAt ?? null : null;
    const recovered = station.status === 'online' && !!lastLost && !!lastRecovered && lastRecovered.changedAt > lastLost.changedAt;
    return { stationId: station.id, code: station.code, name: station.name, status: station.status, lastSeenAt: station.lastSeenAt, lostAt, lostForMs: lostAt ? nowMs - Date.parse(lostAt) : null, lastRecoveredAt: lastRecovered?.changedAt ?? null, recovered };
  });
}

export function createReport(stationId: string, start: string, end: string): QualityReport {
  const rows = observations.filter(item => item.stationId === stationId && item.observedAt >= start && item.observedAt <= end);
  const averageScore = rows.length ? Math.round(rows.reduce((sum, item) => sum + item.qualityScore, 0) / rows.length) : 0;
  const issues = [...new Set(rows.flatMap(item => item.issues))];
  const report = { id: randomUUID(), stationId, windowStart: start, windowEnd: end, observationCount: rows.length, averageScore, issues, generatedAt: new Date().toISOString() };
  reports.push(report); return report;
}

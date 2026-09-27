import { randomUUID } from 'node:crypto';
import type { Heartbeat, Observation, QualityReport, Station, StationStatus, StationStatusEvent } from './types.js';

export const STATION_OFFLINE_TIMEOUT_MS = Number(process.env.STATION_OFFLINE_TIMEOUT_MS ?? 60_000);
export const STATION_SWEEP_INTERVAL_MS = Number(process.env.STATION_SWEEP_INTERVAL_MS ?? 15_000);
export const MAX_CLOCK_SKEW_MS = Number(process.env.STATION_MAX_CLOCK_SKEW_MS ?? 300_000);

const nowIso = () => new Date().toISOString();
const bootAt = nowIso();

export const stations: Station[] = [
  { id: 'st-001', code: 'QZ-A01', name: '青岚台站', region: '川西断裂带', elevationM: 1840, status: 'online', lastSeenAt: bootAt, lastEventAt: bootAt },
  { id: 'st-002', code: 'QZ-B07', name: '白石台站', region: '龙门山南段', elevationM: 920, status: 'online', lastSeenAt: bootAt, lastEventAt: bootAt },
  { id: 'st-003', code: 'QZ-C12', name: '岷江台站', region: '岷江河谷', elevationM: 2470, status: 'maintenance', lastSeenAt: bootAt, lastEventAt: bootAt }
];
export const observations: Observation[] = [];
export const reports: QualityReport[] = [];
export const heartbeats: Heartbeat[] = [];
export const statusEvents: StationStatusEvent[] = [];

function transition(station: Station, toStatus: StationStatus, reason: StationStatusEvent['reason'], eventAt: string): StationStatusEvent {
  const event: StationStatusEvent = { id: randomUUID(), stationId: station.id, fromStatus: station.status, toStatus, reason, eventAt, recordedAt: nowIso() };
  station.status = toStatus;
  statusEvents.push(event);
  return event;
}

export type ReportOutcome = { applied: boolean; ignoredReason: 'stale-event' | null; transition: StationStatusEvent | null };

// 按事件时间有序应用心跳/观测上报：迟到或重复的事件不会回退台站状态
export function applyReportEvent(station: Station, eventAt: string, source: 'heartbeat' | 'observation'): ReportOutcome {
  const eventTime = new Date(eventAt).getTime();
  if (eventTime <= new Date(station.lastEventAt).getTime()) {
    if (eventTime > new Date(station.lastSeenAt).getTime()) station.lastSeenAt = eventAt;
    return { applied: false, ignoredReason: 'stale-event', transition: null };
  }
  station.lastSeenAt = eventAt;
  station.lastEventAt = eventAt;
  const transitionEvent = station.status === 'offline' ? transition(station, 'online', source, eventAt) : null;
  return { applied: true, ignoredReason: null, transition: transitionEvent };
}

// 记录心跳；beatId 用于客户端重试去重，重复提交返回首次记录
export function recordHeartbeat(station: Station, sentAt: string, beatId?: string): { heartbeat: Heartbeat; duplicate: boolean } {
  if (beatId) {
    const existing = heartbeats.find(item => item.stationId === station.id && item.beatId === beatId);
    if (existing) return { heartbeat: existing, duplicate: true };
  }
  const outcome = applyReportEvent(station, sentAt, 'heartbeat');
  const heartbeat: Heartbeat = { id: randomUUID(), stationId: station.id, beatId: beatId ?? null, sentAt, receivedAt: nowIso(), applied: outcome.applied, ignoredReason: outcome.ignoredReason };
  heartbeats.push(heartbeat);
  return { heartbeat, duplicate: false };
}

// 失联判定：online 台站超过超时阈值未上报则置为 offline；维护中台站不参与自动判定
export function sweepOfflineStations(now: Date = new Date()): StationStatusEvent[] {
  const events: StationStatusEvent[] = [];
  for (const station of stations) {
    if (station.status !== 'online') continue;
    if (now.getTime() - new Date(station.lastSeenAt).getTime() <= STATION_OFFLINE_TIMEOUT_MS) continue;
    // 以检测时间作为事件时间，阻止检测之前发出的迟到事件把台站改回 online
    station.lastEventAt = now.toISOString();
    events.push(transition(station, 'offline', 'heartbeat-timeout', station.lastEventAt));
  }
  return events;
}

export function createReport(stationId: string, start: string, end: string): QualityReport {
  const rows = observations.filter(item => item.stationId === stationId && item.observedAt >= start && item.observedAt <= end);
  const averageScore = rows.length ? Math.round(rows.reduce((sum, item) => sum + item.qualityScore, 0) / rows.length) : 0;
  const issues = [...new Set(rows.flatMap(item => item.issues))];
  const report = { id: randomUUID(), stationId, windowStart: start, windowEnd: end, observationCount: rows.length, averageScore, issues, generatedAt: nowIso() };
  reports.push(report); return report;
}

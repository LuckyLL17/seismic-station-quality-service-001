export type StationStatus = 'online' | 'maintenance' | 'offline';
export type Station = { id: string; code: string; name: string; region: string; elevationM: number; status: StationStatus; lastSeenAt: string; lastEventAt: string };
export type Observation = { id: string; stationId: string; observedAt: string; samples: number; sampleRateHz: number; peakAmplitude: number; timingOffsetMs: number; qualityScore: number; issues: string[] };
export type QualityReport = { id: string; stationId: string; windowStart: string; windowEnd: string; observationCount: number; averageScore: number; issues: string[]; generatedAt: string };
export type Heartbeat = { id: string; stationId: string; beatId: string | null; sentAt: string; receivedAt: string; applied: boolean; ignoredReason: 'stale-event' | null };
export type StationStatusEvent = { id: string; stationId: string; fromStatus: StationStatus; toStatus: StationStatus; reason: 'heartbeat' | 'observation' | 'heartbeat-timeout'; eventAt: string; recordedAt: string };

export type StationStatus = 'online' | 'maintenance' | 'offline';
export type Station = { id: string; code: string; name: string; region: string; elevationM: number; status: StationStatus; lastSeenAt: string };
export type Observation = { id: string; stationId: string; observedAt: string; samples: number; sampleRateHz: number; peakAmplitude: number; timingOffsetMs: number; qualityScore: number; issues: string[] };
export type QualityReport = { id: string; stationId: string; windowStart: string; windowEnd: string; observationCount: number; averageScore: number; issues: string[]; generatedAt: string };
export type Heartbeat = { id: string; stationId: string; sentAt: string; receivedAt: string; applied: boolean };
export type StationStatusEvent = { id: string; stationId: string; from: StationStatus; to: StationStatus; reason: 'timeout' | 'heartbeat' | 'observation'; changedAt: string; lastSeenAt: string };
export type StationConnectivity = { stationId: string; code: string; name: string; status: StationStatus; lastSeenAt: string; lostAt: string | null; lostForMs: number | null; lastRecoveredAt: string | null; recovered: boolean };

import { Buffer } from 'buffer';
import { CAR_COUNT, PACKET_NAMES } from './constants';
import { safeGetLabel, toUint8Array } from './binary';
import type { PacketHeader } from './parsers';
import {
  parseCarDamagePacket,
  parseCarStatusPacket,
  parseCarTelemetryPacket,
  parseEventPacket,
  parseHeader,
  parseLapDataPacket,
  parseParticipantsPacket,
  parseSessionPacket,
} from './parsers';

export type LapPlayer = NonNullable<ReturnType<typeof parseLapDataPacket>>['player'];
export type TelePlayer = NonNullable<ReturnType<typeof parseCarTelemetryPacket>>['player'];
export type StatusPlayer = NonNullable<ReturnType<typeof parseCarStatusPacket>>['player'];
export type DamagePlayer = NonNullable<ReturnType<typeof parseCarDamagePacket>>['player'];

const EVENT_HISTORY_LIMIT = 30;

export type DriverOverview = {
  index: number;
  name: string;
  raceNumber: number;
  teamId: number;
  carPosition: number;
  currentLapNum: number;
  currentLapTimeMs: number;
  lastLapTimeMs: number;
  lapDistanceM: number;
  totalDistanceM: number;
  speedKph: number;
  tyreCompound: string;
  tyresAgeLaps: number;
  pitStatus: number;
};

export type TelemetrySummary = {
  receivedPackets: number;
  packetCounts: Record<number, number>;
  latestSender: string | null;
  latestHeader: (PacketHeader & { packetName?: string }) | null;
  latestSession: ReturnType<typeof parseSessionPacket> | null;
  latestParticipants: ReturnType<typeof parseParticipantsPacket> | null;
  latestLapData: LapPlayer | null;
  latestTelemetry: TelePlayer | null;
  latestCarStatus: StatusPlayer | null;
  latestCarDamage: DamagePlayer | null;
  driversOverview: DriverOverview[];
  eventHistory: ReturnType<typeof parseEventPacket>[];
};

type CacheArrays = {
  lapAll: unknown[];
  telemetryAll: unknown[];
  statusAll: unknown[];
  damageAll: unknown[];
};

function emptyCaches(): CacheArrays {
  return {
    lapAll: [],
    telemetryAll: [],
    statusAll: [],
    damageAll: [],
  };
}

export function createTelemetryEngine() {
  const startTime = Date.now();
  let receivedPackets = 0;
  const packetCounts: Record<number, number> = {};
  let latestSender: string | null = null;
  let latestHeader: (PacketHeader & { packetName?: string }) | null = null;
  let latestSession: ReturnType<typeof parseSessionPacket> | null = null;
  let latestParticipants: ReturnType<typeof parseParticipantsPacket> | null = null;
  let latestLapData: LapPlayer | null = null;
  let latestTelemetry: TelePlayer | null = null;
  let latestCarStatus: StatusPlayer | null = null;
  let latestCarDamage: DamagePlayer | null = null;
  let eventHistory: ReturnType<typeof parseEventPacket>[] = [];
  let driversOverview: DriverOverview[] = [];
  const caches = emptyCaches();

  function computeDriversOverview() {
    const participants = latestParticipants?.participants || [];
    const activeCars = participants.length > 0 ? participants.length : CAR_COUNT;
    const list: DriverOverview[] = [];

    for (let i = 0; i < activeCars; i += 1) {
      const p = participants[i] || { index: i, name: `Driver ${i}`, raceNumber: i, teamId: 0 };
      const lap = (caches.lapAll[i] as Record<string, unknown>) || {};
      const telem = (caches.telemetryAll[i] as Record<string, unknown>) || {};
      const status = (caches.statusAll[i] as Record<string, unknown>) || {};

      const rawLapDistance = Number(lap.lapDistanceM || 0);
      const rawTotalDistance = Number(lap.totalDistanceM || 0);
      const lapDistanceM =
        Number.isFinite(rawLapDistance) && Math.abs(rawLapDistance) < 1000000 ? rawLapDistance : 0;
      const totalDistanceM =
        Number.isFinite(rawTotalDistance) && Math.abs(rawTotalDistance) < 100000000
          ? rawTotalDistance
          : 0;
      const rawPosition = Number(lap.carPosition || 0);
      const carPosition = rawPosition >= 1 && rawPosition <= CAR_COUNT ? rawPosition : 99;

      list.push({
        index: i,
        name: String(p.name || `Driver ${i}`),
        raceNumber: Number(p.raceNumber ?? i),
        teamId: Number(p.teamId ?? 0),
        carPosition,
        currentLapNum: Number(lap.currentLapNum || 0),
        currentLapTimeMs: Number(lap.currentLapTimeMs || 0),
        lastLapTimeMs: Number(lap.lastLapTimeMs || 0),
        lapDistanceM,
        totalDistanceM,
        speedKph: Number(telem.speedKph || 0),
        tyreCompound: String(status.tyreCompoundLabel || 'Unknown'),
        tyresAgeLaps: Number(status.tyresAgeLaps ?? 0),
        pitStatus: Number(lap.pitStatus ?? 0),
      });
    }

    const hasRealPositions = list.some((item) => item.carPosition !== 99);
    if (!hasRealPositions) {
      list.sort((a, b) => b.totalDistanceM - a.totalDistanceM);
      list.forEach((item, idx) => {
        item.carPosition = idx + 1;
      });
    } else {
      list.sort((a, b) => a.carPosition - b.carPosition);
    }

    driversOverview = list;
  }

  function getSummary(): TelemetrySummary {
    return {
      receivedPackets,
      packetCounts: { ...packetCounts },
      latestSender,
      latestHeader,
      latestSession,
      latestParticipants,
      latestLapData,
      latestTelemetry,
      latestCarStatus,
      latestCarDamage,
      driversOverview: [...driversOverview],
      eventHistory: [...eventHistory],
    };
  }

  function processBuffer(buf: Uint8Array) {
    const header = parseHeader(buf);
    if (!header) return;

    receivedPackets += 1;
    packetCounts[header.packetId] = (packetCounts[header.packetId] || 0) + 1;

    latestHeader = {
      ...header,
      packetName: safeGetLabel(PACKET_NAMES, header.packetId),
    };

    switch (header.packetId) {
      case 1: {
        const p = parseSessionPacket(buf);
        if (p) latestSession = p;
        break;
      }
      case 2: {
        const p = parseLapDataPacket(buf, header);
        if (p) {
          latestLapData = p.player;
          caches.lapAll = p.allCars;
        }
        break;
      }
      case 3: {
        const p = parseEventPacket(buf);
        if (p) {
          eventHistory = [p, ...eventHistory].slice(0, EVENT_HISTORY_LIMIT);
        }
        break;
      }
      case 4: {
        const p = parseParticipantsPacket(buf, header);
        if (p) latestParticipants = p;
        break;
      }
      case 6: {
        const p = parseCarTelemetryPacket(buf, header);
        if (p) {
          latestTelemetry = p.player;
          caches.telemetryAll = p.allCars;
        }
        break;
      }
      case 7: {
        const p = parseCarStatusPacket(buf, header);
        if (p) {
          latestCarStatus = p.player;
          caches.statusAll = p.allCars;
        }
        break;
      }
      case 10: {
        const p = parseCarDamagePacket(buf, header);
        if (p) {
          latestCarDamage = p.player;
          caches.damageAll = p.allCars;
        }
        break;
      }
      default:
        break;
    }

    computeDriversOverview();
  }

  function onUdpMessage(msg: unknown, rinfo: { address: string; port: number }) {
    const raw = toUint8Array(msg) ?? (typeof Buffer !== 'undefined' && Buffer.isBuffer(msg)
      ? new Uint8Array(msg)
      : null);
    if (!raw) return;

    latestSender = `${rinfo.address}:${rinfo.port}`;
    processBuffer(raw);
  }

  return {
    getSummary,
    onUdpMessage,
    getMeta: () => ({ startTime, uptimeMs: Date.now() - startTime }),
  };
}

export type TelemetryEngine = ReturnType<typeof createTelemetryEngine>;

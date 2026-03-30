import { CAR_COUNT } from './constants';
import {
  ERS_MODE,
  FUEL_MIX,
  SAFETY_CAR_STATUS,
  SESSION_TYPES,
  SURFACE_TYPES,
  TYRE_COMPOUNDS,
  WEATHER,
} from './constants';
import { clamp, dataView, safeGetLabel, safeReadString } from './binary';

export type PacketHeader = {
  packetFormat: number;
  gameYear: number;
  gameMajorVersion: number;
  gameMinorVersion: number;
  packetVersion: number;
  packetId: number;
  sessionUID: string;
  sessionTime: number;
  frameIdentifier: number;
  overallFrameIdentifier: number;
  playerCarIndex: number;
  secondaryPlayerCarIndex: number;
};

export function parseHeader(buf: Uint8Array): PacketHeader | null {
  if (buf.length < 29) return null;
  const dv = dataView(buf);
  return {
    packetFormat: dv.getUint16(0, true),
    gameYear: buf[2],
    gameMajorVersion: buf[3],
    gameMinorVersion: buf[4],
    packetVersion: buf[5],
    packetId: buf[6],
    sessionUID: dv.getBigUint64(7, true).toString(),
    sessionTime: Number(dv.getFloat32(15, true).toFixed(3)),
    frameIdentifier: dv.getUint32(19, true),
    overallFrameIdentifier: dv.getUint32(23, true),
    playerCarIndex: buf[27],
    secondaryPlayerCarIndex: buf[28],
  };
}

export function parseSessionPacket(buf: Uint8Array) {
  const base = 29;
  if (buf.length < base + 19) return null;
  const dv = dataView(buf);
  const weatherId = buf[base];
  const trackTemperatureC = dv.getInt8(base + 1);
  const airTemperatureC = dv.getInt8(base + 2);
  const totalLaps = buf[base + 3];
  const trackLengthM = dv.getUint16(base + 4, true);
  const sessionTypeId = buf[base + 6];
  const trackId = dv.getInt8(base + 7);
  const formula = buf[base + 8];
  const sessionTimeLeftSec = dv.getUint16(base + 9, true);
  const sessionDurationSec = dv.getUint16(base + 11, true);
  const pitSpeedLimitKph = buf[base + 13];
  const numMarshalZones = buf[base + 18];
  const afterMarshalOffset = base + 19 + numMarshalZones * 5;
  const safetyCarStatusId =
    buf.length >= afterMarshalOffset + 1 ? buf[afterMarshalOffset] : null;

  return {
    weatherId,
    weather: safeGetLabel(WEATHER, weatherId),
    trackTemperatureC,
    airTemperatureC,
    totalLaps,
    trackLengthM,
    sessionTypeId,
    sessionType: safeGetLabel(SESSION_TYPES, sessionTypeId),
    trackId,
    formula,
    sessionTimeLeftSec,
    sessionDurationSec,
    pitSpeedLimitKph,
    numMarshalZones,
    safetyCarStatusId,
    safetyCarStatus:
      safetyCarStatusId === null ? 'Unknown' : safeGetLabel(SAFETY_CAR_STATUS, safetyCarStatusId),
    receivedAt: Date.now(),
  };
}

export function parseLapDataPacket(buf: Uint8Array, header: PacketHeader) {
  const carDataSize = 57;
  const minimumSize = 29 + CAR_COUNT * carDataSize;
  if (buf.length < minimumSize) return null;
  const dv = dataView(buf);

  const allCars = [];
  for (let i = 0; i < CAR_COUNT; i += 1) {
    const o = 29 + i * carDataSize;
    allCars.push({
      index: i,
      lastLapTimeMs: dv.getUint32(o, true),
      currentLapTimeMs: dv.getUint32(o + 4, true),
      lapDistanceM: Number(dv.getFloat32(o + 18, true).toFixed(2)),
      totalDistanceM: Number(dv.getFloat32(o + 22, true).toFixed(2)),
      carPosition: buf[o + 30],
      currentLapNum: buf[o + 31],
      pitStatus: buf[o + 32],
      numPitStops: buf[o + 33],
      sector: buf[o + 34],
      penaltiesSec: buf[o + 36],
      resultStatus: buf[o + 43],
    });
  }

  const playerCarIndex = clamp(header.playerCarIndex, 0, CAR_COUNT - 1);
  return {
    allCars,
    player: allCars[playerCarIndex],
    playerCarIndex,
    receivedAt: Date.now(),
  };
}

export function parseCarTelemetryPacket(buf: Uint8Array, header: PacketHeader) {
  const carDataSize = 60;
  const minimumSize = 29 + CAR_COUNT * carDataSize + 3;
  if (buf.length < minimumSize) return null;
  const dv = dataView(buf);

  const allCars = [];
  for (let i = 0; i < CAR_COUNT; i += 1) {
    const o = 29 + i * carDataSize;
    const tyres = [
      { position: 'Rear Left', temp: buf[o + 30], brakeTemp: dv.getUint16(o + 22, true) },
      { position: 'Rear Right', temp: buf[o + 31], brakeTemp: dv.getUint16(o + 24, true) },
      { position: 'Front Left', temp: buf[o + 32], brakeTemp: dv.getUint16(o + 26, true) },
      { position: 'Front Right', temp: buf[o + 33], brakeTemp: dv.getUint16(o + 28, true) },
    ];
    allCars.push({
      index: i,
      speedKph: dv.getUint16(o, true),
      throttle: Number(dv.getFloat32(o + 2, true).toFixed(3)),
      steer: Number(dv.getFloat32(o + 6, true).toFixed(3)),
      brake: Number(dv.getFloat32(o + 10, true).toFixed(3)),
      clutch: buf[o + 14],
      gear: dv.getInt8(o + 15),
      engineRPM: dv.getUint16(o + 16, true),
      drsEnabled: buf[o + 18] === 1,
      engineTemperatureC: dv.getUint16(o + 38, true),
      tyres,
    });
  }

  const playerCarIndex = clamp(header.playerCarIndex, 0, CAR_COUNT - 1);
  const basePlayer = allCars[playerCarIndex] as {
    index: number;
    tyres: Array<{ position: string; temp: number; brakeTemp: number }>;
    [k: string]: unknown;
  };
  const oBase = 29 + playerCarIndex * carDataSize;
  const tyresDetailed = basePlayer.tyres.map(
    (item: { position: string; temp: number; brakeTemp: number }, idx: number) => ({
      ...item,
      surfaceTempC: item.temp,
      innerTempC: buf[oBase + 34 + idx],
      pressurePsi: Number(dv.getFloat32(oBase + 40 + idx * 4, true).toFixed(2)),
      surfaceType: safeGetLabel(SURFACE_TYPES, buf[oBase + 56 + idx]),
    })
  );
  const player = { ...basePlayer, index: playerCarIndex, tyres: tyresDetailed };

  return {
    allCars,
    player,
    playerCarIndex,
    receivedAt: Date.now(),
  };
}

export function parseCarStatusPacket(buf: Uint8Array, header: PacketHeader) {
  const carDataSize = 47;
  const minimumSize = 29 + CAR_COUNT * carDataSize;
  if (buf.length < minimumSize) return null;
  const dv = dataView(buf);

  const allCars = [];
  for (let i = 0; i < CAR_COUNT; i += 1) {
    const o = 29 + i * carDataSize;
    const visualTyreCompound = buf[o + 26];
    const actualTyreCompound = buf[o + 25];
    allCars.push({
      index: i,
      fuelMix: safeGetLabel(FUEL_MIX, buf[o + 2]),
      fuelInTankKg: Number(dv.getFloat32(o + 5, true).toFixed(2)),
      fuelRemainingLaps: Number(dv.getFloat32(o + 13, true).toFixed(2)),
      pitLimiterStatus: buf[o + 4] === 1,
      antiLockBrakes: buf[o + 1] === 1,
      visualTyreCompound,
      actualTyreCompound,
      tyreCompoundLabel:
        (TYRE_COMPOUNDS[visualTyreCompound] ?? TYRE_COMPOUNDS[actualTyreCompound]) || 'Unknown',
      tyresAgeLaps: buf[o + 27],
      ersStoreEnergyJ: Number(dv.getFloat32(o + 29, true).toFixed(2)),
      ersStoreEnergyPct: Number(((dv.getFloat32(o + 29, true) / 4000000) * 100).toFixed(2)),
      ersDeployMode: safeGetLabel(ERS_MODE, buf[o + 33]),
      ersHarvestedThisLapMGUKJ: Number(dv.getFloat32(o + 34, true).toFixed(2)),
      ersHarvestedThisLapMGUHJ: Number(dv.getFloat32(o + 38, true).toFixed(2)),
      ersDeployedThisLapJ: Number(dv.getFloat32(o + 42, true).toFixed(2)),
    });
  }

  const playerCarIndex = clamp(header.playerCarIndex, 0, CAR_COUNT - 1);
  return {
    allCars,
    player: allCars[playerCarIndex],
    playerCarIndex,
    receivedAt: Date.now(),
  };
}

export function parseCarDamagePacket(buf: Uint8Array, header: PacketHeader) {
  const carDataSize = 42;
  const minimumSize = 29 + CAR_COUNT * carDataSize;
  if (buf.length < minimumSize) return null;
  const dv = dataView(buf);

  const allCars = [];
  for (let i = 0; i < CAR_COUNT; i += 1) {
    const o = 29 + i * carDataSize;
    allCars.push({
      index: i,
      tyresWearPct: [
        Number(dv.getFloat32(o, true).toFixed(1)),
        Number(dv.getFloat32(o + 4, true).toFixed(1)),
        Number(dv.getFloat32(o + 8, true).toFixed(1)),
        Number(dv.getFloat32(o + 12, true).toFixed(1)),
      ],
      aeroDamage: {
        frontLeftWing: buf[o + 24],
        frontRightWing: buf[o + 25],
        rearWing: buf[o + 26],
        floor: buf[o + 27],
        diffuser: buf[o + 28],
        sidepod: buf[o + 29],
      },
      failures: {
        drsFault: buf[o + 30] === 1,
        ersFault: buf[o + 31] === 1,
        engineBlown: buf[o + 40] === 1,
        engineSeized: buf[o + 41] === 1,
      },
      powerUnitWearPct: {
        gearbox: buf[o + 32],
        engine: buf[o + 33],
        mguH: buf[o + 34],
        es: buf[o + 35],
        ce: buf[o + 36],
        ice: buf[o + 37],
        mguK: buf[o + 38],
        tc: buf[o + 39],
      },
    });
  }

  const playerCarIndex = clamp(header.playerCarIndex, 0, CAR_COUNT - 1);
  return {
    allCars,
    player: allCars[playerCarIndex],
    playerCarIndex,
    receivedAt: Date.now(),
  };
}

export function parseParticipantsPacket(buf: Uint8Array, header: PacketHeader) {
  const base = 29;
  const entrySize = 58;
  const minimumSize = base + 1 + CAR_COUNT * entrySize;
  if (buf.length < minimumSize) return null;

  const numActiveCars = buf[base];
  const participants = [];
  for (let i = 0; i < CAR_COUNT; i += 1) {
    const o = base + 1 + i * entrySize;
    participants.push({
      index: i,
      aiControlled: buf[o] === 1,
      teamId: buf[o + 3],
      raceNumber: buf[o + 5],
      name: safeReadString(buf, o + 7, 48) || `Driver ${i}`,
    });
  }

  const playerCarIndex = clamp(header.playerCarIndex, 0, CAR_COUNT - 1);
  return {
    numActiveCars,
    player: participants[playerCarIndex],
    participants: participants.slice(0, Math.max(numActiveCars, playerCarIndex + 1)),
    receivedAt: Date.now(),
  };
}

const EVENT_CODES: Record<string, string> = {
  SSTA: 'Session Started',
  SEND: 'Session Ended',
  FTLP: 'Fastest Lap',
  RTMT: 'Retirement',
  DRSE: 'DRS Enabled',
  DRSD: 'DRS Disabled',
  TMPT: 'Teammate In Pits',
  CHQF: 'Chequered Flag',
  RCWN: 'Race Winner',
  PENA: 'Penalty Issued',
  SPTP: 'Speed Trap Triggered',
  STLG: 'Start Lights',
  LGOT: 'Lights Out',
  DTSV: 'Drive Through Served',
  SGSV: 'Stop Go Served',
  FLBK: 'Flashback',
  BUTN: 'Button Status',
};

export function parseEventPacket(buf: Uint8Array) {
  if (buf.length < 33) return null;
  const eventCode = safeReadString(buf, 29, 4);
  return {
    eventCode,
    eventName: EVENT_CODES[eventCode] || 'Unknown Event',
    receivedAt: Date.now(),
  };
}

const http = require("http");
const dgram = require("dgram");
const os = require("os");
const next = require("next");

const dev = process.env.NODE_ENV !== "production";
const app = next({ dev });
const handle = app.getRequestHandler();

const UDP_PORT = Number(process.env.UDP_PORT || 20777);
const UDP_HOST = process.env.UDP_HOST || "0.0.0.0";
const HTTP_PORT = Number(process.env.HTTP_PORT || 3000);
const LOCAL_IPS = getLocalIPv4();
const CAR_COUNT = 22;
const EVENT_HISTORY_LIMIT = 30;

const PACKET_NAMES = {
  0: "Motion",
  1: "Session",
  2: "LapData",
  3: "Event",
  4: "Participants",
  5: "CarSetups",
  6: "CarTelemetry",
  7: "CarStatus",
  8: "FinalClassification",
  9: "LobbyInfo",
  10: "CarDamage",
  11: "SessionHistory",
  12: "TyreSets",
  13: "MotionExtended",
  14: "TimeTrial",
  15: "LapPositions"
};

const SURFACE_TYPES = {
  0: "Tarmac",
  1: "Rumble strip",
  2: "Concrete",
  3: "Rock",
  4: "Gravel",
  5: "Mud",
  6: "Sand",
  7: "Grass",
  8: "Water",
  9: "Cobblestone",
  10: "Metal",
  11: "Ridged"
};

const WEATHER = {
  0: "Clear",
  1: "Light Cloud",
  2: "Overcast",
  3: "Light Rain",
  4: "Heavy Rain",
  5: "Storm"
};

const SESSION_TYPES = {
  0: "Unknown",
  1: "P1",
  2: "P2",
  3: "P3",
  4: "Short P",
  5: "Q1",
  6: "Q2",
  7: "Q3",
  8: "Short Q",
  9: "One Shot Q",
  10: "Race",
  11: "Race 2",
  12: "Race 3",
  13: "Time Trial"
};

const SAFETY_CAR_STATUS = {
  0: "No Safety Car",
  1: "Full Safety Car",
  2: "Virtual Safety Car",
  3: "Formation Lap"
};

const FUEL_MIX = {
  0: "Lean",
  1: "Standard",
  2: "Rich",
  3: "Max"
};

const ERS_MODE = {
  0: "None",
  1: "Medium",
  2: "Hotlap",
  3: "Overtake"
};

const TYRE_COMPOUNDS = {
  16: "C5",
  17: "C4",
  18: "C3",
  19: "C2",
  20: "C1",
  7: "Inter",
  8: "Wet",
  9: "Dry",
  10: "Super Soft",
  11: "Soft",
  12: "Medium",
  13: "Hard"
};

const EVENT_CODES = {
  SSTA: "Session Started",
  SEND: "Session Ended",
  FTLP: "Fastest Lap",
  RTMT: "Retirement",
  DRSE: "DRS Enabled",
  DRSD: "DRS Disabled",
  TMPT: "Teammate In Pits",
  CHQF: "Chequered Flag",
  RCWN: "Race Winner",
  PENA: "Penalty Issued",
  SPTP: "Speed Trap Triggered",
  STLG: "Start Lights",
  LGOT: "Lights Out",
  DTSV: "Drive Through Served",
  SGSV: "Stop Go Served",
  FLBK: "Flashback",
  BUTN: "Button Status"
};

const stats = {
  startTime: Date.now(),
  receivedPackets: 0,
  packetCounts: {},
  latestSender: null,
  latestHeader: null,
  latestSession: null,
  latestParticipants: null,
  latestLapData: null,
  latestTelemetry: null,
  latestCarStatus: null,
  latestCarDamage: null,
  latestMotion: null,
  latestCarSetups: null,
  latestFinalClassification: null,
  latestLobbyInfo: null,
  latestSessionHistory: null,
  latestTyreSets: null,
  latestMotionExtended: null,
  latestTimeTrial: null,
  latestLapPositions: null,
  eventHistory: [],
  driversOverview: []
};

const caches = {
  lapAll: [],
  telemetryAll: [],
  statusAll: [],
  damageAll: []
};

const clients = new Set();

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function safeGetLabel(map, key, fallback = "Unknown") {
  return Object.prototype.hasOwnProperty.call(map, key) ? map[key] : fallback;
}

function safeReadString(buffer, offset, length) {
  const end = clamp(offset + length, 0, buffer.length);
  return buffer.toString("utf8", offset, end).replace(/\0/g, "").trim();
}

function getLocalIPv4() {
  const interfaces = os.networkInterfaces();
  const ips = [];
  for (const list of Object.values(interfaces)) {
    if (!Array.isArray(list)) {
      continue;
    }
    for (const iface of list) {
      if (iface.family === "IPv4" && !iface.internal) {
        ips.push(iface.address);
      }
    }
  }
  return ips;
}

function parseHeader(buffer) {
  if (buffer.length < 29) {
    return null;
  }
  return {
    packetFormat: buffer.readUInt16LE(0),
    gameYear: buffer.readUInt8(2),
    gameMajorVersion: buffer.readUInt8(3),
    gameMinorVersion: buffer.readUInt8(4),
    packetVersion: buffer.readUInt8(5),
    packetId: buffer.readUInt8(6),
    sessionUID: buffer.readBigUInt64LE(7).toString(),
    sessionTime: Number(buffer.readFloatLE(15).toFixed(3)),
    frameIdentifier: buffer.readUInt32LE(19),
    overallFrameIdentifier: buffer.readUInt32LE(23),
    playerCarIndex: buffer.readUInt8(27),
    secondaryPlayerCarIndex: buffer.readUInt8(28)
  };
}

function parseSessionPacket(buffer) {
  const base = 29;
  if (buffer.length < base + 19) {
    return null;
  }

  const weatherId = buffer.readUInt8(base);
  const trackTemperatureC = buffer.readInt8(base + 1);
  const airTemperatureC = buffer.readInt8(base + 2);
  const totalLaps = buffer.readUInt8(base + 3);
  const trackLengthM = buffer.readUInt16LE(base + 4);
  const sessionTypeId = buffer.readUInt8(base + 6);
  const trackId = buffer.readInt8(base + 7);
  const formula = buffer.readUInt8(base + 8);
  const sessionTimeLeftSec = buffer.readUInt16LE(base + 9);
  const sessionDurationSec = buffer.readUInt16LE(base + 11);
  const pitSpeedLimitKph = buffer.readUInt8(base + 13);
  const numMarshalZones = buffer.readUInt8(base + 18);
  const afterMarshalOffset = base + 19 + numMarshalZones * 5;

  const safetyCarStatusId =
    buffer.length >= afterMarshalOffset + 1 ? buffer.readUInt8(afterMarshalOffset) : null;

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
      safetyCarStatusId === null ? "Unknown" : safeGetLabel(SAFETY_CAR_STATUS, safetyCarStatusId),
    receivedAt: Date.now()
  };
}

function parseLapDataPacket(buffer, header) {
  const carDataSize = 57;
  const minimumSize = 29 + CAR_COUNT * carDataSize;
  if (buffer.length < minimumSize) {
    return null;
  }

  const allCars = [];
  for (let i = 0; i < CAR_COUNT; i += 1) {
    const o = 29 + i * carDataSize;
    allCars.push({
      index: i,
      lastLapTimeMs: buffer.readUInt32LE(o),
      currentLapTimeMs: buffer.readUInt32LE(o + 4),
      lapDistanceM: Number(buffer.readFloatLE(o + 18).toFixed(2)),
      totalDistanceM: Number(buffer.readFloatLE(o + 22).toFixed(2)),
      carPosition: buffer.readUInt8(o + 30),
      currentLapNum: buffer.readUInt8(o + 31),
      pitStatus: buffer.readUInt8(o + 32),
      numPitStops: buffer.readUInt8(o + 33),
      sector: buffer.readUInt8(o + 34),
      penaltiesSec: buffer.readUInt8(o + 36),
      resultStatus: buffer.readUInt8(o + 43)
    });
  }

  const playerCarIndex = clamp(header.playerCarIndex, 0, CAR_COUNT - 1);
  return {
    allCars,
    player: allCars[playerCarIndex],
    playerCarIndex,
    receivedAt: Date.now()
  };
}

function parseCarTelemetryPacket(buffer, header) {
  const carDataSize = 60;
  const minimumSize = 29 + CAR_COUNT * carDataSize + 3;
  if (buffer.length < minimumSize) {
    return null;
  }

  const allCars = [];
  for (let i = 0; i < CAR_COUNT; i += 1) {
    const o = 29 + i * carDataSize;
    const tyres = [
      { position: "Rear Left", temp: buffer.readUInt8(o + 30), brakeTemp: buffer.readUInt16LE(o + 22) },
      { position: "Rear Right", temp: buffer.readUInt8(o + 31), brakeTemp: buffer.readUInt16LE(o + 24) },
      { position: "Front Left", temp: buffer.readUInt8(o + 32), brakeTemp: buffer.readUInt16LE(o + 26) },
      { position: "Front Right", temp: buffer.readUInt8(o + 33), brakeTemp: buffer.readUInt16LE(o + 28) }
    ];
    allCars.push({
      index: i,
      speedKph: buffer.readUInt16LE(o),
      throttle: Number(buffer.readFloatLE(o + 2).toFixed(3)),
      steer: Number(buffer.readFloatLE(o + 6).toFixed(3)),
      brake: Number(buffer.readFloatLE(o + 10).toFixed(3)),
      clutch: buffer.readUInt8(o + 14),
      gear: buffer.readInt8(o + 15),
      engineRPM: buffer.readUInt16LE(o + 16),
      drsEnabled: buffer.readUInt8(o + 18) === 1,
      engineTemperatureC: buffer.readUInt16LE(o + 38),
      tyres
    });
  }

  const playerCarIndex = clamp(header.playerCarIndex, 0, CAR_COUNT - 1);
  const player = allCars[playerCarIndex];
  player.tyres = player.tyres.map((item, idx) => ({
    ...item,
    innerTempC: buffer.readUInt8(29 + playerCarIndex * carDataSize + 34 + idx),
    pressurePsi: Number(buffer.readFloatLE(29 + playerCarIndex * carDataSize + 40 + idx * 4).toFixed(2)),
    surfaceType: safeGetLabel(
      SURFACE_TYPES,
      buffer.readUInt8(29 + playerCarIndex * carDataSize + 56 + idx)
    )
  }));

  return {
    allCars,
    player,
    playerCarIndex,
    receivedAt: Date.now()
  };
}

function parseCarStatusPacket(buffer, header) {
  const carDataSize = 47;
  const minimumSize = 29 + CAR_COUNT * carDataSize;
  if (buffer.length < minimumSize) {
    return null;
  }

  const allCars = [];
  for (let i = 0; i < CAR_COUNT; i += 1) {
    const o = 29 + i * carDataSize;
    const visualTyreCompound = buffer.readUInt8(o + 26);
    const actualTyreCompound = buffer.readUInt8(o + 25);
    allCars.push({
      index: i,
      fuelMix: safeGetLabel(FUEL_MIX, buffer.readUInt8(o + 2)),
      fuelInTankKg: Number(buffer.readFloatLE(o + 5).toFixed(2)),
      fuelRemainingLaps: Number(buffer.readFloatLE(o + 13).toFixed(2)),
      pitLimiterStatus: buffer.readUInt8(o + 4) === 1,
      antiLockBrakes: buffer.readUInt8(o + 1) === 1,
      visualTyreCompound,
      actualTyreCompound,
      tyreCompoundLabel:
        safeGetLabel(TYRE_COMPOUNDS, visualTyreCompound, null) ||
        safeGetLabel(TYRE_COMPOUNDS, actualTyreCompound),
      tyresAgeLaps: buffer.readUInt8(o + 27),
      ersStoreEnergyJ: Number(buffer.readFloatLE(o + 29).toFixed(2)),
      ersStoreEnergyPct: Number(((buffer.readFloatLE(o + 29) / 4000000) * 100).toFixed(2)),
      ersDeployMode: safeGetLabel(ERS_MODE, buffer.readUInt8(o + 33)),
      ersHarvestedThisLapMGUKJ: Number(buffer.readFloatLE(o + 34).toFixed(2)),
      ersHarvestedThisLapMGUHJ: Number(buffer.readFloatLE(o + 38).toFixed(2)),
      ersDeployedThisLapJ: Number(buffer.readFloatLE(o + 42).toFixed(2))
    });
  }

  const playerCarIndex = clamp(header.playerCarIndex, 0, CAR_COUNT - 1);
  return {
    allCars,
    player: allCars[playerCarIndex],
    playerCarIndex,
    receivedAt: Date.now()
  };
}

function parseCarDamagePacket(buffer, header) {
  const carDataSize = 42;
  const minimumSize = 29 + CAR_COUNT * carDataSize;
  if (buffer.length < minimumSize) {
    return null;
  }

  const allCars = [];
  for (let i = 0; i < CAR_COUNT; i += 1) {
    const o = 29 + i * carDataSize;
    allCars.push({
      index: i,
      tyresWearPct: [
        Number(buffer.readFloatLE(o).toFixed(1)),
        Number(buffer.readFloatLE(o + 4).toFixed(1)),
        Number(buffer.readFloatLE(o + 8).toFixed(1)),
        Number(buffer.readFloatLE(o + 12).toFixed(1))
      ],
      aeroDamage: {
        frontLeftWing: buffer.readUInt8(o + 24),
        frontRightWing: buffer.readUInt8(o + 25),
        rearWing: buffer.readUInt8(o + 26),
        floor: buffer.readUInt8(o + 27),
        diffuser: buffer.readUInt8(o + 28),
        sidepod: buffer.readUInt8(o + 29)
      },
      failures: {
        drsFault: buffer.readUInt8(o + 30) === 1,
        ersFault: buffer.readUInt8(o + 31) === 1,
        engineBlown: buffer.readUInt8(o + 40) === 1,
        engineSeized: buffer.readUInt8(o + 41) === 1
      },
      powerUnitWearPct: {
        gearbox: buffer.readUInt8(o + 32),
        engine: buffer.readUInt8(o + 33),
        mguH: buffer.readUInt8(o + 34),
        es: buffer.readUInt8(o + 35),
        ce: buffer.readUInt8(o + 36),
        ice: buffer.readUInt8(o + 37),
        mguK: buffer.readUInt8(o + 38),
        tc: buffer.readUInt8(o + 39)
      }
    });
  }

  const playerCarIndex = clamp(header.playerCarIndex, 0, CAR_COUNT - 1);
  return {
    allCars,
    player: allCars[playerCarIndex],
    playerCarIndex,
    receivedAt: Date.now()
  };
}

function parseParticipantsPacket(buffer, header) {
  const base = 29;
  const entrySize = 58;
  const minimumSize = base + 1 + CAR_COUNT * entrySize;
  if (buffer.length < minimumSize) {
    return null;
  }

  const numActiveCars = buffer.readUInt8(base);
  const participants = [];
  for (let i = 0; i < CAR_COUNT; i += 1) {
    const o = base + 1 + i * entrySize;
    participants.push({
      index: i,
      aiControlled: buffer.readUInt8(o) === 1,
      teamId: buffer.readUInt8(o + 3),
      raceNumber: buffer.readUInt8(o + 5),
      name: safeReadString(buffer, o + 7, 48) || `Driver ${i}`
    });
  }

  const playerCarIndex = clamp(header.playerCarIndex, 0, CAR_COUNT - 1);
  return {
    numActiveCars,
    player: participants[playerCarIndex],
    participants: participants.slice(0, Math.max(numActiveCars, playerCarIndex + 1)),
    receivedAt: Date.now()
  };
}

function parseEventPacket(buffer) {
  if (buffer.length < 33) {
    return null;
  }
  const eventCode = safeReadString(buffer, 29, 4);
  return {
    eventCode,
    eventName: safeGetLabel(EVENT_CODES, eventCode, "Unknown Event"),
    receivedAt: Date.now()
  };
}

function parseMotionPacket(buffer, header) {
  const carDataSize = 60;
  const minimumSize = 29 + CAR_COUNT * carDataSize;
  if (buffer.length < minimumSize) {
    return null;
  }

  const allCars = [];
  for (let i = 0; i < CAR_COUNT; i += 1) {
    const o = 29 + i * carDataSize;
    allCars.push({
      index: i,
      worldPositionX: Number(buffer.readFloatLE(o).toFixed(3)),
      worldPositionY: Number(buffer.readFloatLE(o + 4).toFixed(3)),
      worldPositionZ: Number(buffer.readFloatLE(o + 8).toFixed(3)),
      worldVelocityX: Number(buffer.readFloatLE(o + 12).toFixed(3)),
      worldVelocityY: Number(buffer.readFloatLE(o + 16).toFixed(3)),
      worldVelocityZ: Number(buffer.readFloatLE(o + 20).toFixed(3)),
      gForceLateral: Number(buffer.readFloatLE(o + 24).toFixed(3)),
      gForceLongitudinal: Number(buffer.readFloatLE(o + 28).toFixed(3)),
      gForceVertical: Number(buffer.readFloatLE(o + 32).toFixed(3)),
      yaw: Number(buffer.readFloatLE(o + 36).toFixed(3)),
      pitch: Number(buffer.readFloatLE(o + 40).toFixed(3)),
      roll: Number(buffer.readFloatLE(o + 44).toFixed(3))
    });
  }

  const playerCarIndex = clamp(header.playerCarIndex, 0, CAR_COUNT - 1);
  return {
    allCars,
    player: allCars[playerCarIndex],
    playerCarIndex,
    receivedAt: Date.now()
  };
}

function parseCarSetupsPacket(buffer, header) {
  const carDataSize = 49;
  const minimumSize = 29 + CAR_COUNT * carDataSize;
  if (buffer.length < minimumSize) {
    return null;
  }

  const allCars = [];
  for (let i = 0; i < CAR_COUNT; i += 1) {
    const o = 29 + i * carDataSize;
    allCars.push({
      index: i,
      frontWing: buffer.readUInt8(o),
      rearWing: buffer.readUInt8(o + 1),
      onThrottle: buffer.readUInt8(o + 2),
      offThrottle: buffer.readUInt8(o + 3),
      frontCamber: Number(buffer.readFloatLE(o + 4).toFixed(2)),
      rearCamber: Number(buffer.readFloatLE(o + 8).toFixed(2)),
      frontToe: Number(buffer.readFloatLE(o + 12).toFixed(3)),
      rearToe: Number(buffer.readFloatLE(o + 16).toFixed(3)),
      frontSuspension: buffer.readUInt8(o + 20),
      rearSuspension: buffer.readUInt8(o + 21),
      frontAntiRollBar: buffer.readUInt8(o + 22),
      rearAntiRollBar: buffer.readUInt8(o + 23),
      frontSuspensionHeight: buffer.readUInt8(o + 24),
      rearSuspensionHeight: buffer.readUInt8(o + 25),
      brakePressure: buffer.readUInt8(o + 26),
      brakeBias: buffer.readUInt8(o + 27),
      rearLeftTyrePressure: Number(buffer.readFloatLE(o + 28).toFixed(2)),
      rearRightTyrePressure: Number(buffer.readFloatLE(o + 32).toFixed(2)),
      frontLeftTyrePressure: Number(buffer.readFloatLE(o + 36).toFixed(2)),
      frontRightTyrePressure: Number(buffer.readFloatLE(o + 40).toFixed(2)),
      ballast: buffer.readUInt8(o + 44),
      fuelLoad: Number(buffer.readFloatLE(o + 45).toFixed(2))
    });
  }

  const playerCarIndex = clamp(header.playerCarIndex, 0, CAR_COUNT - 1);
  return {
    allCars,
    player: allCars[playerCarIndex],
    playerCarIndex,
    receivedAt: Date.now()
  };
}

function parseFinalClassificationPacket(buffer) {
  const base = 29;
  if (buffer.length < base + 1) {
    return null;
  }
  const numCars = buffer.readUInt8(base);
  const entrySize = 45;
  const requiredSize = base + 1 + numCars * entrySize;
  if (buffer.length < requiredSize) {
    return null;
  }

  const classification = [];
  for (let i = 0; i < numCars; i += 1) {
    const o = base + 1 + i * entrySize;
    classification.push({
      position: buffer.readUInt8(o),
      numLaps: buffer.readUInt8(o + 1),
      gridPosition: buffer.readUInt8(o + 2),
      points: buffer.readUInt8(o + 3),
      numPitStops: buffer.readUInt8(o + 4),
      resultStatus: buffer.readUInt8(o + 5),
      bestLapTimeMs: buffer.readUInt32LE(o + 6),
      totalRaceTimeSec: Number(buffer.readDoubleLE(o + 10).toFixed(3)),
      penaltiesTimeSec: buffer.readUInt8(o + 18),
      numPenalties: buffer.readUInt8(o + 19),
      numTyreStints: buffer.readUInt8(o + 20)
    });
  }

  return {
    numCars,
    classification,
    receivedAt: Date.now()
  };
}

function parseLobbyInfoPacket(buffer) {
  const base = 29;
  if (buffer.length < base + 1) {
    return null;
  }
  const numPlayers = buffer.readUInt8(base);
  const entrySize = 54;
  const requiredSize = base + 1 + numPlayers * entrySize;
  if (buffer.length < requiredSize) {
    return null;
  }

  const players = [];
  for (let i = 0; i < numPlayers; i += 1) {
    const o = base + 1 + i * entrySize;
    players.push({
      carIndex: buffer.readUInt8(o),
      teamId: buffer.readUInt8(o + 1),
      nationality: buffer.readUInt8(o + 2),
      name: safeReadString(buffer, o + 3, 48) || `Player ${i + 1}`,
      carNumber: buffer.readUInt8(o + 51),
      readyStatus: buffer.readUInt8(o + 52)
    });
  }

  return {
    numPlayers,
    players,
    receivedAt: Date.now()
  };
}

function parseSessionHistoryPacket(buffer) {
  const base = 29;
  if (buffer.length < base + 10) {
    return null;
  }

  const carIndex = buffer.readUInt8(base);
  const numLaps = buffer.readUInt8(base + 1);
  const numTyreStints = buffer.readUInt8(base + 2);

  const bestLapTimeLapNum = buffer.readUInt8(base + 3);
  const bestSector1LapNum = buffer.readUInt8(base + 4);
  const bestSector2LapNum = buffer.readUInt8(base + 5);
  const bestSector3LapNum = buffer.readUInt8(base + 6);

  const lapHistoryData = [];
  const maxLapRecords = Math.min(numLaps, 100);
  const lapSize = 14;
  for (let i = 0; i < maxLapRecords; i += 1) {
    const o = base + 10 + i * lapSize;
    if (o + lapSize > buffer.length) {
      break;
    }
    lapHistoryData.push({
      lapTimeMs: buffer.readUInt32LE(o),
      sector1TimeMs: buffer.readUInt16LE(o + 4),
      sector2TimeMs: buffer.readUInt16LE(o + 6),
      sector3TimeMs: buffer.readUInt16LE(o + 8),
      lapValidBitFlags: buffer.readUInt8(o + 10)
    });
  }

  return {
    carIndex,
    numLaps,
    numTyreStints,
    bestLapTimeLapNum,
    bestSector1LapNum,
    bestSector2LapNum,
    bestSector3LapNum,
    lapHistoryData,
    receivedAt: Date.now()
  };
}

function parseTyreSetsPacket(buffer) {
  const base = 29;
  if (buffer.length < base + 2) {
    return null;
  }
  const carIndex = buffer.readUInt8(base);
  const fittedIdx = buffer.readUInt8(buffer.length - 1);
  const setSize = 10;
  const maxSets = Math.floor((buffer.length - base - 1) / setSize);
  const tyreSets = [];

  for (let i = 0; i < maxSets; i += 1) {
    const o = base + i * setSize;
    if (o + setSize > buffer.length - 1) {
      break;
    }
    tyreSets.push({
      index: i,
      actualTyreCompound: buffer.readUInt8(o),
      visualTyreCompound: buffer.readUInt8(o + 1),
      wearPct: buffer.readUInt8(o + 2),
      available: buffer.readUInt8(o + 3) === 1,
      recommendedSession: buffer.readUInt8(o + 4),
      lifeSpanLaps: buffer.readUInt8(o + 5),
      usableLifeLaps: buffer.readUInt8(o + 6),
      lapDeltaTimeMs: buffer.readInt16LE(o + 7),
      fitted: i === fittedIdx
    });
  }

  return {
    carIndex,
    fittedIdx,
    tyreSets,
    receivedAt: Date.now()
  };
}

function parseMotionExtendedPacket(buffer) {
  const base = 29;
  if (buffer.length < base + 4 * 4 * 4 + 4) {
    return null;
  }

  const readFloatArray = (start, count) =>
    Array.from({ length: count }, (_, i) => Number(buffer.readFloatLE(start + i * 4).toFixed(3)));

  const suspensionPosition = readFloatArray(base, 4);
  const suspensionVelocity = readFloatArray(base + 16, 4);
  const suspensionAcceleration = readFloatArray(base + 32, 4);
  const wheelSpeed = readFloatArray(base + 48, 4);
  const wheelSlipRatio = readFloatArray(base + 64, 4);

  return {
    suspensionPosition,
    suspensionVelocity,
    suspensionAcceleration,
    wheelSpeed,
    wheelSlipRatio,
    localVelocity: {
      x: Number(buffer.readFloatLE(base + 80).toFixed(3)),
      y: Number(buffer.readFloatLE(base + 84).toFixed(3)),
      z: Number(buffer.readFloatLE(base + 88).toFixed(3))
    },
    angularVelocity: {
      x: Number(buffer.readFloatLE(base + 92).toFixed(3)),
      y: Number(buffer.readFloatLE(base + 96).toFixed(3)),
      z: Number(buffer.readFloatLE(base + 100).toFixed(3))
    },
    frontWheelsAngle: Number(buffer.readFloatLE(base + 116).toFixed(3)),
    receivedAt: Date.now()
  };
}

function parseTimeTrialPacket(buffer) {
  const base = 29;
  if (buffer.length < base + 12) {
    return null;
  }

  return {
    playerSessionBestLapTimeMs: buffer.readUInt32LE(base),
    playerPersonalBestLapTimeMs: buffer.readUInt32LE(base + 4),
    playerCurrentLapTimeMs: buffer.readUInt32LE(base + 8),
    packetSize: buffer.length,
    receivedAt: Date.now()
  };
}

function parseLapPositionsPacket(buffer) {
  const base = 29;
  if (buffer.length < base + 2) {
    return null;
  }
  const carIndex = buffer.readUInt8(base);
  const numLaps = buffer.readUInt8(base + 1);
  const positions = [];
  const start = base + 2;
  const end = Math.min(buffer.length, start + numLaps);
  for (let i = start; i < end; i += 1) {
    positions.push(buffer.readUInt8(i));
  }

  return {
    carIndex,
    numLaps,
    positions,
    receivedAt: Date.now()
  };
}

function computeDriversOverview() {
  const participants = stats.latestParticipants?.participants || [];
  const activeCars = participants.length > 0 ? participants.length : CAR_COUNT;
  const list = [];

  for (let i = 0; i < activeCars; i += 1) {
    const p = participants[i] || { index: i, name: `Driver ${i}` };
    const lap = caches.lapAll[i] || {};
    const telem = caches.telemetryAll[i] || {};
    const status = caches.statusAll[i] || {};

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
      name: p.name,
      raceNumber: p.raceNumber,
      teamId: p.teamId,
      carPosition,
      currentLapNum: lap.currentLapNum || 0,
      currentLapTimeMs: Number(lap.currentLapTimeMs || 0),
      lastLapTimeMs: Number(lap.lastLapTimeMs || 0),
      lapDistanceM,
      totalDistanceM,
      speedKph: telem.speedKph || 0,
      tyreCompound: status.tyreCompoundLabel || "Unknown",
      tyresAgeLaps: status.tyresAgeLaps ?? 0,
      pitStatus: lap.pitStatus ?? 0
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

  stats.driversOverview = list;
}

function getBaseStats() {
  return {
    receivedPackets: stats.receivedPackets,
    packetCounts: stats.packetCounts,
    latestSender: stats.latestSender
  };
}

function getSummaryPayload() {
  return {
    server: {
      udpHost: UDP_HOST,
      udpPort: UDP_PORT,
      httpPort: HTTP_PORT,
      localIps: LOCAL_IPS,
      uptimeMs: Date.now() - stats.startTime
    },
    stats: getBaseStats(),
    latestHeader: stats.latestHeader,
    latestSession: stats.latestSession,
    latestParticipants: stats.latestParticipants,
    latestLapData: stats.latestLapData,
    latestTelemetry: stats.latestTelemetry,
    latestCarStatus: stats.latestCarStatus,
    latestCarDamage: stats.latestCarDamage,
    latestMotion: stats.latestMotion,
    latestCarSetups: stats.latestCarSetups,
    latestFinalClassification: stats.latestFinalClassification,
    latestLobbyInfo: stats.latestLobbyInfo,
    latestSessionHistory: stats.latestSessionHistory,
    latestTyreSets: stats.latestTyreSets,
    latestMotionExtended: stats.latestMotionExtended,
    latestTimeTrial: stats.latestTimeTrial,
    latestLapPositions: stats.latestLapPositions,
    driversOverview: stats.driversOverview,
    eventHistory: stats.eventHistory
  };
}

function sendSSE(client, eventName, payload) {
  client.write(`event: ${eventName}\n`);
  client.write(`data: ${JSON.stringify(payload)}\n\n`);
}

function broadcast(eventName, payload) {
  for (const client of clients) {
    sendSSE(client, eventName, payload);
  }
}

app.prepare().then(() => {
  const server = http.createServer((req, res) => {
    if (req.url === "/events") {
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        Connection: "keep-alive",
        "Cache-Control": "no-cache"
      });
      res.write("\n");
      clients.add(res);
      sendSSE(res, "summary", getSummaryPayload());
      req.on("close", () => clients.delete(res));
      return;
    }

    if (req.url === "/api/summary") {
      res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify(getSummaryPayload()));
      return;
    }

    handle(req, res);
  });

  const udpServer = dgram.createSocket("udp4");
  udpServer.on("message", (msg, rinfo) => {
    const header = parseHeader(msg);
    if (!header) {
      return;
    }

    stats.receivedPackets += 1;
    stats.packetCounts[header.packetId] = (stats.packetCounts[header.packetId] || 0) + 1;
    stats.latestSender = `${rinfo.address}:${rinfo.port}`;
    stats.latestHeader = {
      ...header,
      packetName: safeGetLabel(PACKET_NAMES, header.packetId)
    };

    switch (header.packetId) {
      case 0: {
        const p = parseMotionPacket(msg, header);
        if (p) {
          stats.latestMotion = p;
        }
        break;
      }
      case 1: {
        const p = parseSessionPacket(msg);
        if (p) {
          stats.latestSession = p;
        }
        break;
      }
      case 2: {
        const p = parseLapDataPacket(msg, header);
        if (p) {
          stats.latestLapData = p.player;
          caches.lapAll = p.allCars;
        }
        break;
      }
      case 3: {
        const p = parseEventPacket(msg);
        if (p) {
          stats.eventHistory.unshift(p);
          stats.eventHistory = stats.eventHistory.slice(0, EVENT_HISTORY_LIMIT);
        }
        break;
      }
      case 4: {
        const p = parseParticipantsPacket(msg, header);
        if (p) {
          stats.latestParticipants = p;
        }
        break;
      }
      case 5: {
        const p = parseCarSetupsPacket(msg, header);
        if (p) {
          stats.latestCarSetups = p;
        }
        break;
      }
      case 6: {
        const p = parseCarTelemetryPacket(msg, header);
        if (p) {
          stats.latestTelemetry = p.player;
          caches.telemetryAll = p.allCars;
        }
        break;
      }
      case 7: {
        const p = parseCarStatusPacket(msg, header);
        if (p) {
          stats.latestCarStatus = p.player;
          caches.statusAll = p.allCars;
        }
        break;
      }
      case 10: {
        const p = parseCarDamagePacket(msg, header);
        if (p) {
          stats.latestCarDamage = p.player;
          caches.damageAll = p.allCars;
        }
        break;
      }
      case 8: {
        const p = parseFinalClassificationPacket(msg);
        if (p) {
          stats.latestFinalClassification = p;
        }
        break;
      }
      case 9: {
        const p = parseLobbyInfoPacket(msg);
        if (p) {
          stats.latestLobbyInfo = p;
        }
        break;
      }
      case 11: {
        const p = parseSessionHistoryPacket(msg);
        if (p) {
          stats.latestSessionHistory = p;
        }
        break;
      }
      case 12: {
        const p = parseTyreSetsPacket(msg);
        if (p) {
          stats.latestTyreSets = p;
        }
        break;
      }
      case 13: {
        const p = parseMotionExtendedPacket(msg);
        if (p) {
          stats.latestMotionExtended = p;
        }
        break;
      }
      case 14: {
        const p = parseTimeTrialPacket(msg);
        if (p) {
          stats.latestTimeTrial = p;
        }
        break;
      }
      case 15: {
        const p = parseLapPositionsPacket(msg);
        if (p) {
          stats.latestLapPositions = p;
        }
        break;
      }
      default:
        break;
    }

    computeDriversOverview();
    broadcast("snapshot", getSummaryPayload());
  });

  udpServer.on("listening", () => {
    const address = udpServer.address();
    console.log(`UDP dinleyici hazir: ${address.address}:${address.port}`);
    console.log(`Ayni Wi-Fi icin kullanilabilecek IP adresleri: ${LOCAL_IPS.join(", ")}`);
  });

  udpServer.on("error", (error) => {
    console.error("UDP hata:", error.message);
  });

  udpServer.bind(UDP_PORT, UDP_HOST);

  server.listen(HTTP_PORT, () => {
    console.log(`Next dashboard hazir: http://localhost:${HTTP_PORT}`);
  });
});

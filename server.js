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

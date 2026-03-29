const state = {
  speedHistory: [],
  rpmHistory: [],
  maxPoints: 100,
  lastTelemetryTs: 0,
  latest: {
    telemetry: null,
    session: null,
    lapData: null,
    carStatus: null,
    carDamage: null,
    participants: null,
    eventHistory: []
  }
};

const els = {
  connectionBadge: document.getElementById("connectionBadge"),
  speedValue: document.getElementById("speedValue"),
  gearValue: document.getElementById("gearValue"),
  rpmValue: document.getElementById("rpmValue"),
  drsValue: document.getElementById("drsValue"),
  positionValue: document.getElementById("positionValue"),
  lapValue: document.getElementById("lapValue"),
  fuelValue: document.getElementById("fuelValue"),
  ersValue: document.getElementById("ersValue"),
  packetCountValue: document.getElementById("packetCountValue"),
  driverValue: document.getElementById("driverValue"),
  throttleBar: document.getElementById("throttleBar"),
  brakeBar: document.getElementById("brakeBar"),
  clutchBar: document.getElementById("clutchBar"),
  steerBar: document.getElementById("steerBar"),
  throttleText: document.getElementById("throttleText"),
  brakeText: document.getElementById("brakeText"),
  clutchText: document.getElementById("clutchText"),
  steerText: document.getElementById("steerText"),
  sessionTypeValue: document.getElementById("sessionTypeValue"),
  weatherValue: document.getElementById("weatherValue"),
  trackTempValue: document.getElementById("trackTempValue"),
  airTempValue: document.getElementById("airTempValue"),
  safetyCarValue: document.getElementById("safetyCarValue"),
  sessionTimeLeftValue: document.getElementById("sessionTimeLeftValue"),
  pitLimitValue: document.getElementById("pitLimitValue"),
  marshalValue: document.getElementById("marshalValue"),
  lastLapValue: document.getElementById("lastLapValue"),
  currentLapTimeValue: document.getElementById("currentLapTimeValue"),
  sector1Value: document.getElementById("sector1Value"),
  sector2Value: document.getElementById("sector2Value"),
  deltaFrontValue: document.getElementById("deltaFrontValue"),
  deltaLeaderValue: document.getElementById("deltaLeaderValue"),
  lapDistanceValue: document.getElementById("lapDistanceValue"),
  pitStopsValue: document.getElementById("pitStopsValue"),
  penaltyValue: document.getElementById("penaltyValue"),
  tyreTableBody: document.getElementById("tyreTableBody"),
  fuelMixValue: document.getElementById("fuelMixValue"),
  fuelTankValue: document.getElementById("fuelTankValue"),
  fuelLapValue: document.getElementById("fuelLapValue"),
  ersModeValue: document.getElementById("ersModeValue"),
  ersKValue: document.getElementById("ersKValue"),
  ersHValue: document.getElementById("ersHValue"),
  ersDeployValue: document.getElementById("ersDeployValue"),
  pitLimiterValue: document.getElementById("pitLimiterValue"),
  absValue: document.getElementById("absValue"),
  frontWingValue: document.getElementById("frontWingValue"),
  rearWingValue: document.getElementById("rearWingValue"),
  floorDiffValue: document.getElementById("floorDiffValue"),
  sidepodValue: document.getElementById("sidepodValue"),
  gearboxWearValue: document.getElementById("gearboxWearValue"),
  engineWearValue: document.getElementById("engineWearValue"),
  drsFaultValue: document.getElementById("drsFaultValue"),
  ersFaultValue: document.getElementById("ersFaultValue"),
  engineFailureValue: document.getElementById("engineFailureValue"),
  eventList: document.getElementById("eventList"),
  packetDistribution: document.getElementById("packetDistribution"),
  headerJson: document.getElementById("headerJson"),
  snapshotJson: document.getElementById("snapshotJson"),
  speedChart: document.getElementById("speedChart"),
  rpmChart: document.getElementById("rpmChart")
};

function fmtPercent01(v) {
  return `${Math.round(v * 100)}%`;
}

function fmtMs(ms) {
  if (ms == null || ms <= 0) {
    return "-";
  }
  const minutes = Math.floor(ms / 60000);
  const seconds = ((ms % 60000) / 1000).toFixed(3).padStart(6, "0");
  return `${minutes}:${seconds}`;
}

function fmtSec(sec) {
  if (sec == null || sec < 0) {
    return "-";
  }
  const mm = Math.floor(sec / 60);
  const ss = String(Math.floor(sec % 60)).padStart(2, "0");
  return `${mm}:${ss}`;
}

function updateBadge(live) {
  els.connectionBadge.className = `badge ${live ? "live" : "waiting"}`;
  els.connectionBadge.textContent = live ? "Canli veri akiyor" : "Veri bekleniyor";
}

function trimHistory(list, maxLength) {
  while (list.length > maxLength) {
    list.shift();
  }
}

function drawLineChart(canvas, values, lineColor, maxValue) {
  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  ctx.clearRect(0, 0, width, height);

  ctx.strokeStyle = "#1f2630";
  ctx.lineWidth = 1;
  for (let i = 1; i < 4; i += 1) {
    const y = (height / 4) * i;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  if (values.length < 2) {
    return;
  }

  const stepX = width / (values.length - 1);
  ctx.beginPath();
  ctx.lineWidth = 2;
  ctx.strokeStyle = lineColor;
  values.forEach((v, i) => {
    const x = i * stepX;
    const y = height - Math.max(0, Math.min(1, v / maxValue)) * (height - 16) - 8;
    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  });
  ctx.stroke();
}

function toGearLabel(gear) {
  if (gear === 0) {
    return "N";
  }
  if (gear === -1) {
    return "R";
  }
  return String(gear);
}

function mergeTyreData(telemetryTyres, damageTyres) {
  if (!Array.isArray(telemetryTyres) || telemetryTyres.length === 0) {
    return [];
  }
  return telemetryTyres.map((t, i) => ({
    ...t,
    wearPct: damageTyres?.[i]?.wearPct ?? "-",
    tyreDamagePct: damageTyres?.[i]?.tyreDamagePct ?? "-",
    brakeDamagePct: damageTyres?.[i]?.brakeDamagePct ?? "-"
  }));
}

function updateTyreTable() {
  const tyres = mergeTyreData(state.latest.telemetry?.tyres, state.latest.carDamage?.tyres);
  if (tyres.length === 0) {
    els.tyreTableBody.innerHTML = "<tr><td colspan='9'>Veri yok</td></tr>";
    return;
  }

  els.tyreTableBody.innerHTML = tyres
    .map(
      (tyre) => `
      <tr>
        <td>${tyre.position}</td>
        <td>${tyre.surfaceTempC}</td>
        <td>${tyre.innerTempC}</td>
        <td>${tyre.pressurePsi}</td>
        <td>${tyre.brakeTempC}</td>
        <td>${tyre.surfaceType}</td>
        <td>${tyre.wearPct}</td>
        <td>${tyre.tyreDamagePct}</td>
        <td>${tyre.brakeDamagePct}</td>
      </tr>`
    )
    .join("");
}

function updateOverview() {
  const telemetry = state.latest.telemetry;
  const lap = state.latest.lapData;
  const status = state.latest.carStatus;
  const participants = state.latest.participants;

  if (telemetry) {
    state.lastTelemetryTs = Date.now();
    updateBadge(true);

    els.speedValue.textContent = `${telemetry.speedKph} km/h`;
    els.gearValue.textContent = toGearLabel(telemetry.gear);
    els.rpmValue.textContent = `${telemetry.engineRPM}`;
    els.drsValue.textContent = telemetry.drsEnabled ? "Acik" : "Kapali";

    els.throttleBar.style.width = `${Math.round(telemetry.throttle * 100)}%`;
    els.brakeBar.style.width = `${Math.round(telemetry.brake * 100)}%`;
    els.clutchBar.style.width = `${telemetry.clutch}%`;
    els.steerBar.style.width = `${Math.round(Math.abs(telemetry.steer) * 100)}%`;

    els.throttleText.textContent = fmtPercent01(telemetry.throttle);
    els.brakeText.textContent = fmtPercent01(telemetry.brake);
    els.clutchText.textContent = `${telemetry.clutch}%`;
    els.steerText.textContent = `${Math.round(telemetry.steer * 100)}%`;

    state.speedHistory.push(telemetry.speedKph);
    state.rpmHistory.push(telemetry.engineRPM);
    trimHistory(state.speedHistory, state.maxPoints);
    trimHistory(state.rpmHistory, state.maxPoints);
    drawLineChart(els.speedChart, state.speedHistory, "#58a6ff", 380);
    drawLineChart(els.rpmChart, state.rpmHistory, "#2ea043", 16000);
  }

  if (lap) {
    els.positionValue.textContent = lap.carPosition > 0 ? `P${lap.carPosition}` : "-";
    els.lapValue.textContent = lap.currentLapNum ? `${lap.currentLapNum}` : "-";
  }

  if (status) {
    els.fuelValue.textContent = `${status.fuelInTankKg.toFixed(1)} kg`;
    els.ersValue.textContent = `${status.ersStoreEnergyPct.toFixed(1)}%`;
  }

  if (participants?.player?.name) {
    els.driverValue.textContent = participants.player.name;
  }
}

function updateSession() {
  const s = state.latest.session;
  if (!s) {
    return;
  }
  els.sessionTypeValue.textContent = s.sessionType || "-";
  els.weatherValue.textContent = s.weather || "-";
  els.trackTempValue.textContent = `${s.trackTemperatureC} C`;
  els.airTempValue.textContent = `${s.airTemperatureC} C`;
  els.safetyCarValue.textContent = s.safetyCarStatus || "-";
  els.sessionTimeLeftValue.textContent = fmtSec(s.sessionTimeLeftSec);
  els.pitLimitValue.textContent = `${s.pitSpeedLimitKph} km/h`;
  els.marshalValue.textContent = `${s.numMarshalZones}`;
}

function updateLapData() {
  const l = state.latest.lapData;
  if (!l) {
    return;
  }
  els.lastLapValue.textContent = fmtMs(l.lastLapTimeMs);
  els.currentLapTimeValue.textContent = fmtMs(l.currentLapTimeMs);
  els.sector1Value.textContent = `${l.sector1MinutesPart}:${String(l.sector1TimeMs).padStart(3, "0")}`;
  els.sector2Value.textContent = `${l.sector2MinutesPart}:${String(l.sector2TimeMs).padStart(3, "0")}`;
  els.deltaFrontValue.textContent = `${l.deltaToCarInFrontMsPart} ms`;
  els.deltaLeaderValue.textContent = `${l.deltaToRaceLeaderMsPart} ms`;
  els.lapDistanceValue.textContent = `${l.lapDistanceM.toFixed(1)} m`;
  els.pitStopsValue.textContent = `${l.numPitStops} (aktif: ${l.pitLaneTimerActive ? "evet" : "hayir"})`;
  els.penaltyValue.textContent = `${l.penaltiesSec}s / warning ${l.totalWarnings}`;
}

function updateCarStatus() {
  const s = state.latest.carStatus;
  if (!s) {
    return;
  }
  els.fuelMixValue.textContent = s.fuelMix;
  els.fuelTankValue.textContent = `${s.fuelInTankKg.toFixed(2)} / ${s.fuelCapacityKg.toFixed(2)}`;
  els.fuelLapValue.textContent = s.fuelRemainingLaps.toFixed(2);
  els.ersModeValue.textContent = s.ersDeployMode;
  els.ersKValue.textContent = `${s.ersHarvestedThisLapMGUKJ.toFixed(1)} J`;
  els.ersHValue.textContent = `${s.ersHarvestedThisLapMGUHJ.toFixed(1)} J`;
  els.ersDeployValue.textContent = `${s.ersDeployedThisLapJ.toFixed(1)} J`;
  els.pitLimiterValue.textContent = s.pitLimiterStatus ? "Acik" : "Kapali";
  els.absValue.textContent = s.antiLockBrakes ? "Acik" : "Kapali";
}

function updateCarDamage() {
  const d = state.latest.carDamage;
  if (!d) {
    return;
  }
  els.frontWingValue.textContent = `${d.aeroDamage.frontLeftWing}% / ${d.aeroDamage.frontRightWing}%`;
  els.rearWingValue.textContent = `${d.aeroDamage.rearWing}%`;
  els.floorDiffValue.textContent = `${d.aeroDamage.floor}% / ${d.aeroDamage.diffuser}%`;
  els.sidepodValue.textContent = `${d.aeroDamage.sidepod}%`;
  els.gearboxWearValue.textContent = `${d.powerUnitWearPct.gearbox}%`;
  els.engineWearValue.textContent = `${d.powerUnitWearPct.engine}%`;
  els.drsFaultValue.textContent = d.failures.drsFault ? "Var" : "Yok";
  els.ersFaultValue.textContent = d.failures.ersFault ? "Var" : "Yok";
  els.engineFailureValue.textContent = d.failures.engineBlown || d.failures.engineSeized ? "Ariza" : "Normal";
}

function updateEvents() {
  const list = state.latest.eventHistory;
  if (!Array.isArray(list) || list.length === 0) {
    els.eventList.innerHTML = "<li>Event bekleniyor...</li>";
    return;
  }

  els.eventList.innerHTML = list
    .slice(0, 12)
    .map((e) => {
      const details = Object.keys(e.details || {}).length > 0 ? JSON.stringify(e.details) : "{}";
      return `<li><strong>${e.eventCode}</strong> - ${e.eventName} <span>${details}</span></li>`;
    })
    .join("");
}

function updatePacketMeta(header, stats) {
  els.packetDistribution.textContent = JSON.stringify(stats?.packetCounts || {}, null, 2);
  els.headerJson.textContent = JSON.stringify(header || {}, null, 2);
  els.packetCountValue.textContent = String(stats?.receivedPackets ?? 0);
}

function refreshAll(snapshot) {
  updateOverview();
  updateSession();
  updateLapData();
  updateCarStatus();
  updateCarDamage();
  updateTyreTable();
  updateEvents();
  els.snapshotJson.textContent = JSON.stringify(snapshot, null, 2);
}

function applySummary(summary) {
  if (!summary) {
    return;
  }

  state.latest.telemetry = summary.latestTelemetry || state.latest.telemetry;
  state.latest.session = summary.latestSession || state.latest.session;
  state.latest.lapData = summary.latestLapData || state.latest.lapData;
  state.latest.carStatus = summary.latestCarStatus || state.latest.carStatus;
  state.latest.carDamage = summary.latestCarDamage || state.latest.carDamage;
  state.latest.participants = summary.latestParticipants || state.latest.participants;
  state.latest.eventHistory = summary.eventHistory || state.latest.eventHistory;

  updatePacketMeta(summary.latestHeader, summary.stats);
  refreshAll(summary);
}

function applyPacketEvent(payload, targetKey) {
  if (!payload) {
    return;
  }
  if (targetKey) {
    state.latest[targetKey] = payload.data || state.latest[targetKey];
  }
  updatePacketMeta(payload.header, payload.stats);
  refreshAll({
    latestTelemetry: state.latest.telemetry,
    latestSession: state.latest.session,
    latestLapData: state.latest.lapData,
    latestCarStatus: state.latest.carStatus,
    latestCarDamage: state.latest.carDamage,
    latestParticipants: state.latest.participants,
    eventHistory: state.latest.eventHistory
  });
}

function startSSE() {
  const source = new EventSource("/events");

  source.addEventListener("summary", (event) => {
    applySummary(JSON.parse(event.data));
  });
  source.addEventListener("telemetry", (event) => applyPacketEvent(JSON.parse(event.data), "telemetry"));
  source.addEventListener("session", (event) => applyPacketEvent(JSON.parse(event.data), "session"));
  source.addEventListener("lapData", (event) => applyPacketEvent(JSON.parse(event.data), "lapData"));
  source.addEventListener("carStatus", (event) => applyPacketEvent(JSON.parse(event.data), "carStatus"));
  source.addEventListener("carDamage", (event) => applyPacketEvent(JSON.parse(event.data), "carDamage"));
  source.addEventListener("participants", (event) => applyPacketEvent(JSON.parse(event.data), "participants"));
  source.addEventListener("event", (event) => {
    const payload = JSON.parse(event.data);
    if (payload.data) {
      state.latest.eventHistory.unshift(payload.data);
      state.latest.eventHistory = state.latest.eventHistory.slice(0, 25);
    }
    applyPacketEvent(payload, null);
  });
  source.addEventListener("packet", (event) => applyPacketEvent(JSON.parse(event.data), null));

  source.onerror = () => {
    updateBadge(false);
  };
}

setInterval(() => {
  if (Date.now() - state.lastTelemetryTs > 2500) {
    updateBadge(false);
  }
}, 500);

startSSE();

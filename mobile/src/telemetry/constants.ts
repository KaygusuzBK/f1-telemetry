export const CAR_COUNT = 22;

export const PACKET_NAMES: Record<number, string> = {
  0: 'Motion',
  1: 'Session',
  2: 'LapData',
  3: 'Event',
  4: 'Participants',
  5: 'CarSetups',
  6: 'CarTelemetry',
  7: 'CarStatus',
  8: 'FinalClassification',
  9: 'LobbyInfo',
  10: 'CarDamage',
  11: 'SessionHistory',
  12: 'TyreSets',
  13: 'MotionExtended',
  14: 'TimeTrial',
  15: 'LapPositions',
};

export const WEATHER: Record<number, string> = {
  0: 'Clear',
  1: 'Light Cloud',
  2: 'Overcast',
  3: 'Light Rain',
  4: 'Heavy Rain',
  5: 'Storm',
};

export const SESSION_TYPES: Record<number, string> = {
  0: 'Unknown',
  1: 'P1',
  2: 'P2',
  3: 'P3',
  4: 'Short P',
  5: 'Q1',
  6: 'Q2',
  7: 'Q3',
  8: 'Short Q',
  9: 'One Shot Q',
  10: 'Race',
  11: 'Race 2',
  12: 'Race 3',
  13: 'Time Trial',
};

export const SAFETY_CAR_STATUS: Record<number, string> = {
  0: 'No Safety Car',
  1: 'Full Safety Car',
  2: 'Virtual Safety Car',
  3: 'Formation Lap',
};

export const FUEL_MIX: Record<number, string> = {
  0: 'Lean',
  1: 'Standard',
  2: 'Rich',
  3: 'Max',
};

export const ERS_MODE: Record<number, string> = {
  0: 'None',
  1: 'Medium',
  2: 'Hotlap',
  3: 'Overtake',
};

export const TYRE_COMPOUNDS: Record<number, string> = {
  16: 'C5',
  17: 'C4',
  18: 'C3',
  19: 'C2',
  20: 'C1',
  7: 'Inter',
  8: 'Wet',
  9: 'Dry',
  10: 'Super Soft',
  11: 'Soft',
  12: 'Medium',
  13: 'Hard',
};

export const SURFACE_TYPES: Record<number, string> = {
  0: 'Tarmac',
  1: 'Rumble strip',
  2: 'Concrete',
  3: 'Rock',
  4: 'Gravel',
  5: 'Mud',
  6: 'Sand',
  7: 'Grass',
  8: 'Water',
  9: 'Cobblestone',
  10: 'Metal',
  11: 'Ridged',
};

/**
 * Градации качества соединения, которые видит интерфейс участников канала.
 */
export type RealtimeConnectionQuality = "low" | "med" | "good";

/**
 * Служебные signal-type имена для realtime-телеметрии речи и качества соединения.
 */
export const REALTIME_VOICE_SIGNAL_TYPES = {
  speaking: "slovo.voice-speaking",
  connectionQualityProbe: "slovo.connection-quality-probe",
  connectionQuality: "slovo.connection-quality",
} as const;

/**
 * Нормализует итоговую градацию качества соединения по RTT и browser network hints.
 */
export function resolveRealtimeConnectionQuality(input: {
  rttMs: number | null;
  effectiveType?: string | null;
}): RealtimeConnectionQuality {
  const effectiveType = input.effectiveType?.trim().toLowerCase() ?? null;

  if (effectiveType === "slow-2g" || effectiveType === "2g") {
    return "low";
  }

  if (effectiveType === "3g") {
    return "med";
  }

  if (typeof input.rttMs === "number") {
    if (input.rttMs <= 120) {
      return "good";
    }

    if (input.rttMs <= 280) {
      return "med";
    }

    return "low";
  }

  return "good";
}

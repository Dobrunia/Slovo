<script setup lang="ts">
import type { ClientRealtimeConnectionQuality } from "../../types/server";
import wifiGoodIcon from "../../assets/icons/wifi-good.svg";
import wifiMedIcon from "../../assets/icons/wifi-med.svg";
import wifiLowIcon from "../../assets/icons/wifi-low.svg";

interface ConnectionQualityIndicatorProps {
  quality: ClientRealtimeConnectionQuality | null;
}

const props = defineProps<ConnectionQualityIndicatorProps>();

/**
 * Возвращает SVG и подпись для текущей градации качества соединения.
 */
function resolveConnectionQualityMeta(quality: ClientRealtimeConnectionQuality | null): {
  iconSrc: string | null;
  label: string;
  toneClass: string | null;
} {
  if (quality === "good") {
    return {
      iconSrc: wifiGoodIcon,
      label: "Хорошее соединение",
      toneClass: "connection-quality-indicator--good",
    };
  }

  if (quality === "med") {
    return {
      iconSrc: wifiMedIcon,
      label: "Среднее соединение",
      toneClass: "connection-quality-indicator--med",
    };
  }

  if (quality === "low") {
    return {
      iconSrc: wifiLowIcon,
      label: "Слабое соединение",
      toneClass: "connection-quality-indicator--low",
    };
  }

  return {
    iconSrc: null,
    label: "Качество соединения еще не определено",
    toneClass: null,
  };
}
</script>

<template>
  <span
    v-if="props.quality"
    class="connection-quality-indicator"
    :class="resolveConnectionQualityMeta(props.quality).toneClass ?? undefined"
    :aria-label="resolveConnectionQualityMeta(props.quality).label"
    :title="resolveConnectionQualityMeta(props.quality).label"
  >
    <span
      class="connection-quality-indicator__icon"
      :style="{
        '--connection-quality-indicator-icon': `url(${resolveConnectionQualityMeta(props.quality).iconSrc})`,
      }"
    />
  </span>
</template>

<style scoped>
.connection-quality-indicator {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
}

.connection-quality-indicator__icon {
  display: block;
  width: 16px;
  height: 16px;
  background-color: currentColor;
  mask-image: var(--connection-quality-indicator-icon);
  mask-repeat: no-repeat;
  mask-position: center;
  mask-size: contain;
  -webkit-mask-image: var(--connection-quality-indicator-icon);
  -webkit-mask-repeat: no-repeat;
  -webkit-mask-position: center;
  -webkit-mask-size: contain;
}

.connection-quality-indicator--good {
  color: var(--dbru-color-success);
}

.connection-quality-indicator--med {
  color: var(--dbru-color-warning, #d4a017);
}

.connection-quality-indicator--low {
  color: var(--dbru-color-error);
}
</style>

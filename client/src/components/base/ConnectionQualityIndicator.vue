<script setup lang="ts">
import { computed } from "vue";
import wifiLowIcon from "../../assets/icons/wifi-low.svg";
import wifiMedIcon from "../../assets/icons/wifi-med.svg";
import wifiGoodIcon from "../../assets/icons/wifi-good.svg";

type ConnectionQualityLevel = "low" | "med" | "good" | null | undefined;

interface ConnectionQualityIndicatorProps {
  quality: ConnectionQualityLevel;
  size?: "xs" | "sm" | "md";
}

const props = withDefaults(defineProps<ConnectionQualityIndicatorProps>(), {
  size: "sm",
});

/**
 * Возвращает метаданные иконки и цвета для текущего качества соединения.
 */
const indicatorMeta = computed(() => {
  if (!props.quality) {
    return null;
  }

  if (props.quality === "good") {
    return {
      iconSrc: wifiGoodIcon,
      label: "Хорошее соединение",
      tone: "success",
    } as const;
  }

  if (props.quality === "med") {
    return {
      iconSrc: wifiMedIcon,
      label: "Среднее соединение",
      tone: "warning",
    } as const;
  }

  return {
    iconSrc: wifiLowIcon,
    label: "Плохое соединение",
    tone: "error",
  } as const;
});

/**
 * Возвращает CSS-переменную с источником SVG-иконки.
 */
const iconStyle = computed(() => {
  if (!indicatorMeta.value) {
    return undefined;
  }

  return {
    "--connection-quality-indicator-icon-src": `url("${indicatorMeta.value.iconSrc}")`,
  };
});
</script>

<template>
  <span
    v-if="indicatorMeta"
    class="connection-quality-indicator"
    :class="[
      `connection-quality-indicator--${indicatorMeta.tone}`,
      `connection-quality-indicator--${size}`,
    ]"
    :title="indicatorMeta.label"
    :aria-label="indicatorMeta.label"
    :style="iconStyle"
  />
</template>

<style scoped>
.connection-quality-indicator {
  display: inline-block;
  flex: 0 0 auto;
  background-color: currentColor;
  -webkit-mask-image: var(--connection-quality-indicator-icon-src);
  mask-image: var(--connection-quality-indicator-icon-src);
  -webkit-mask-position: center;
  mask-position: center;
  -webkit-mask-repeat: no-repeat;
  mask-repeat: no-repeat;
  -webkit-mask-size: contain;
  mask-size: contain;
}

.connection-quality-indicator--xs {
  width: 0.875rem;
  height: 0.875rem;
}

.connection-quality-indicator--sm {
  width: 1rem;
  height: 1rem;
}

.connection-quality-indicator--md {
  width: 1.25rem;
  height: 1.25rem;
}

.connection-quality-indicator--success {
  color: var(--dbru-color-success);
}

.connection-quality-indicator--warning {
  color: var(--dbru-color-warning);
}

.connection-quality-indicator--error {
  color: var(--dbru-color-error);
}
</style>

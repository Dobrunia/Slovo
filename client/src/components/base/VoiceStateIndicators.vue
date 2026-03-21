<script setup lang="ts">
import { computed } from "vue";
import micOffIcon from "../../assets/icons/mic-off.svg";
import headphonesOffIcon from "../../assets/icons/headphones-off.svg";

interface VoiceStateIndicatorsProps {
  muted: boolean;
  deafened: boolean;
  size?: "xs" | "sm" | "md";
}

const props = withDefaults(defineProps<VoiceStateIndicatorsProps>(), {
  size: "sm",
});

/**
 * Возвращает набор активных индикаторов голосового состояния.
 */
const indicators = computed(() => {
  if (props.deafened) {
    return [
      {
        key: "muted",
        label: "Микрофон выключен",
        iconSrc: micOffIcon,
      },
      {
        key: "deafened",
        label: "Звук отключен",
        iconSrc: headphonesOffIcon,
      },
    ] as const;
  }

  if (props.muted) {
    return [
      {
        key: "muted",
        label: "Микрофон выключен",
        iconSrc: micOffIcon,
      },
    ] as const;
  }

  return [];
});

/**
 * Формирует CSS-переменную для конкретной SVG-иконки.
 */
function buildIconStyle(iconSrc: string): Record<string, string> {
  return {
    "--voice-state-indicators-icon-src": `url("${iconSrc}")`,
  };
}
</script>

<template>
  <span
    v-if="indicators.length > 0"
    class="voice-state-indicators"
  >
    <span
      v-for="indicator in indicators"
      :key="indicator.key"
      class="voice-state-indicators__icon"
      :class="`voice-state-indicators__icon--${size}`"
      :style="buildIconStyle(indicator.iconSrc)"
      :title="indicator.label"
      :aria-label="indicator.label"
    />
  </span>
</template>

<style scoped>
.voice-state-indicators {
  display: inline-flex;
  align-items: center;
  gap: var(--dbru-space-1);
  color: var(--dbru-color-error);
}

.voice-state-indicators__icon {
  display: inline-block;
  flex: 0 0 auto;
  background-color: currentColor;
  -webkit-mask-image: var(--voice-state-indicators-icon-src);
  mask-image: var(--voice-state-indicators-icon-src);
  -webkit-mask-position: center;
  mask-position: center;
  -webkit-mask-repeat: no-repeat;
  mask-repeat: no-repeat;
  -webkit-mask-size: contain;
  mask-size: contain;
}

.voice-state-indicators__icon--xs {
  width: 0.75rem;
  height: 0.75rem;
}

.voice-state-indicators__icon--sm {
  width: 0.875rem;
  height: 0.875rem;
}

.voice-state-indicators__icon--md {
  width: 1rem;
  height: 1rem;
}
</style>

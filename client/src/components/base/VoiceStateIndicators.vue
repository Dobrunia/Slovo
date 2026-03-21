<script setup lang="ts">
interface VoiceStateIndicatorsProps {
  muted: boolean;
  deafened: boolean;
  size?: "xs" | "sm";
}

const props = withDefaults(defineProps<VoiceStateIndicatorsProps>(), {
  size: "sm",
});
</script>

<template>
  <span
    v-if="props.muted || props.deafened"
    class="voice-state-indicators"
    :class="`voice-state-indicators--${props.size}`"
    aria-label="Состояние микрофона и наушников"
  >
    <span
      v-if="props.muted || props.deafened"
      class="voice-state-indicators__icon"
      aria-hidden="true"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 3a3 3 0 0 1 3 3v6a3 3 0 1 1-6 0V6a3 3 0 0 1 3-3Z" />
        <path d="M19 11a7 7 0 0 1-12.02 4.95" />
        <path d="M5 11a7 7 0 0 0 11.66 5.03" />
        <path d="M12 18v3" />
        <path d="M8 21h8" />
        <path d="M4 4l16 16" />
      </svg>
    </span>

    <span
      v-if="props.deafened"
      class="voice-state-indicators__icon"
      aria-hidden="true"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M3 14v-4a2 2 0 0 1 2-2h3l4-4v16l-4-4H5a2 2 0 0 1-2-2Z" />
        <path d="M14 9a5 5 0 0 1 0 6" />
        <path d="M17 6a9 9 0 0 1 0 12" />
        <path d="M4 4l16 16" />
      </svg>
    </span>
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
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
}

.voice-state-indicators__icon svg {
  display: block;
}

.voice-state-indicators--xs .voice-state-indicators__icon {
  width: 14px;
  height: 14px;
}

.voice-state-indicators--sm .voice-state-indicators__icon {
  width: 16px;
  height: 16px;
}
</style>

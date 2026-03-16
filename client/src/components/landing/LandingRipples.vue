<template>
  <div class="landing-ripples" aria-hidden="true">
    <span
      v-for="rippleClassName in rippleClassNames"
      :key="rippleClassName"
      :class="['landing-ripples__drop', rippleClassName]"
    >
      <span class="landing-ripples__ring landing-ripples__ring--small"></span>
      <span class="landing-ripples__ring landing-ripples__ring--medium"></span>
      <span class="landing-ripples__ring landing-ripples__ring--large"></span>
    </span>
  </div>
</template>

<script setup lang="ts">
/**
 * Набор декоративных точек, из которых на стартовом экране расходятся мягкие «капли»-волны.
 * Классы задают позицию, оттенок и индивидуальный ритм анимации.
 */
const rippleClassNames = [
  "landing-ripples__drop--north-west",
  "landing-ripples__drop--north",
  "landing-ripples__drop--north-east",
  "landing-ripples__drop--center-left",
  "landing-ripples__drop--center-right",
  "landing-ripples__drop--south-west",
  "landing-ripples__drop--south",
  "landing-ripples__drop--south-east",
];
</script>

<style scoped>
.landing-ripples {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  z-index: 0;
}

.landing-ripples__drop {
  --landing-ripple-delay: 0s;
  --landing-ripple-cycle: 4.8s;
  --landing-ripple-ring-strong: color-mix(
    in srgb,
    var(--landing-accent-blue-deep) 92%,
    transparent
  );
  --landing-ripple-ring-soft: color-mix(
    in srgb,
    var(--landing-accent-violet-deep) 80%,
    transparent
  );
  --landing-ripple-glow: color-mix(
    in srgb,
    var(--landing-accent-blue) 58%,
    var(--landing-accent-violet)
  );
  position: absolute;
  width: 5.8rem;
  aspect-ratio: 1;
  transform: translate(-50%, -50%);
}

.landing-ripples__ring {
  position: absolute;
  top: 50%;
  left: 50%;
  border-radius: 999px;
  transform: translate(-50%, -50%);
  border: 0.14rem solid var(--landing-ripple-ring-strong);
  box-shadow:
    0 0 0 0.1rem color-mix(in srgb, var(--landing-ripple-glow) 18%, transparent),
    0 0 1.2rem color-mix(in srgb, var(--landing-ripple-glow) 22%, transparent);
  opacity: 0;
  will-change: opacity;
  animation-duration: var(--landing-ripple-cycle);
  animation-timing-function: linear;
  animation-iteration-count: infinite;
  animation-delay: var(--landing-ripple-delay);
}

.landing-ripples__ring--small {
  width: 1.1rem;
  aspect-ratio: 1;
  --landing-ripple-peak: 0.96;
  animation-name: landing-ripple-pulse;
}

.landing-ripples__ring--medium {
  width: 2.6rem;
  aspect-ratio: 1;
  border-color: color-mix(in srgb, var(--landing-ripple-ring-strong) 78%, transparent);
  --landing-ripple-peak: 0.56;
  animation-name: landing-ripple-pulse;
  animation-delay: calc(var(--landing-ripple-delay) + (var(--landing-ripple-cycle) * 0.18));
}

.landing-ripples__ring--large {
  width: 4.6rem;
  aspect-ratio: 1;
  border-color: var(--landing-ripple-ring-soft);
  box-shadow:
    0 0 0 0.14rem color-mix(in srgb, var(--landing-ripple-glow) 14%, transparent),
    0 0 1.45rem color-mix(in srgb, var(--landing-ripple-glow) 18%, transparent);
  --landing-ripple-peak: 0.3;
  animation-name: landing-ripple-pulse;
  animation-delay: calc(var(--landing-ripple-delay) + (var(--landing-ripple-cycle) * 0.36));
}

.landing-ripples__drop--north-west {
  top: 16%;
  left: 17%;
  --landing-ripple-delay: -0.8s;
  --landing-ripple-cycle: 4.9s;
}

.landing-ripples__drop--north {
  top: 22%;
  left: 48%;
  --landing-ripple-delay: -2.1s;
  --landing-ripple-cycle: 5.1s;
}

.landing-ripples__drop--north-east {
  --landing-ripple-ring-strong: color-mix(
    in srgb,
    var(--landing-accent-violet-deep) 94%,
    transparent
  );
  --landing-ripple-ring-soft: color-mix(
    in srgb,
    var(--landing-accent-blue-deep) 88%,
    transparent
  );
  top: 14%;
  left: 81%;
  --landing-ripple-delay: -1.4s;
  --landing-ripple-cycle: 4.6s;
}

.landing-ripples__drop--center-left {
  top: 44%;
  left: 22%;
  --landing-ripple-delay: -2.8s;
  --landing-ripple-cycle: 5.4s;
}

.landing-ripples__drop--center-right {
  --landing-ripple-ring-strong: color-mix(
    in srgb,
    var(--landing-accent-violet-deep) 100%,
    transparent
  );
  top: 52%;
  left: 77%;
  --landing-ripple-delay: -3.2s;
  --landing-ripple-cycle: 4.8s;
}

.landing-ripples__drop--south-west {
  top: 73%;
  left: 13%;
  --landing-ripple-delay: -1.9s;
  --landing-ripple-cycle: 5.6s;
}

.landing-ripples__drop--south {
  --landing-ripple-ring-strong: color-mix(
    in srgb,
    var(--landing-accent-blue-deep) 100%,
    transparent
  );
  --landing-ripple-ring-soft: color-mix(
    in srgb,
    var(--landing-accent-violet) 90%,
    transparent
  );
  top: 79%;
  left: 52%;
  --landing-ripple-delay: -0.3s;
  --landing-ripple-cycle: 4.7s;
}

.landing-ripples__drop--south-east {
  top: 70%;
  left: 88%;
  --landing-ripple-delay: -2.4s;
  --landing-ripple-cycle: 5s;
}

@keyframes landing-ripple-pulse {
  0% {
    opacity: 0;
    transform: translate(-50%, -50%);
  }

  10% {
    opacity: var(--landing-ripple-peak);
    transform: translate(-50%, -50%);
  }

  28% {
    opacity: calc(var(--landing-ripple-peak) * 0.58);
    transform: translate(-50%, -50%);
  }

  46% {
    opacity: calc(var(--landing-ripple-peak) * 0.24);
    transform: translate(-50%, -50%);
  }

  62%,
  100% {
    opacity: 0;
    transform: translate(-50%, -50%);
  }
}

@media (max-width: 640px) {
  .landing-ripples__drop {
    width: 4.8rem;
  }

  .landing-ripples__ring--small {
    width: 0.95rem;
  }

  .landing-ripples__ring--medium {
    width: 2.15rem;
  }

  .landing-ripples__ring--large {
    width: 3.8rem;
  }

  .landing-ripples__drop--north-west {
    top: 10%;
    left: 10%;
  }

  .landing-ripples__drop--north {
    top: 18%;
    left: 52%;
  }

  .landing-ripples__drop--north-east {
    top: 12%;
    left: 92%;
  }

  .landing-ripples__drop--center-left {
    left: 8%;
  }

  .landing-ripples__drop--center-right {
    left: 94%;
  }

  .landing-ripples__drop--south-west {
    left: 6%;
    top: 82%;
  }

  .landing-ripples__drop--south {
    top: 88%;
  }

  .landing-ripples__drop--south-east {
    left: 96%;
    top: 78%;
  }
}

@media (prefers-reduced-motion: reduce) {
  .landing-ripples__drop {
    animation: none;
    opacity: 0;
  }
}
</style>

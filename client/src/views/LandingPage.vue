<template>
  <section class="landing-page">
    <LandingRipples />
    <div class="landing-page__aura landing-page__aura--left" aria-hidden="true"></div>
    <div class="landing-page__aura landing-page__aura--right" aria-hidden="true"></div>

    <div class="landing-page__card">
      <svg
        class="landing-page__frame"
        viewBox="0 0 1000 360"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <defs>
          <path
            id="landing-page__frame-path"
            d="M 28 8 H 972 Q 992 8 992 28 V 332 Q 992 352 972 352 H 28 Q 8 352 8 332 V 28 Q 8 8 28 8 Z"
          />
          <filter id="landing-page__frame-glow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="4.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <use
          href="#landing-page__frame-path"
          class="landing-page__frame-base"
        />

        <g class="landing-page__frame-segment" filter="url(#landing-page__frame-glow)">
          <circle
            class="landing-page__frame-dot-glow landing-page__frame-dot-glow--blue"
            cx="0"
            cy="0"
            r="10"
          />
          <circle
            class="landing-page__frame-dot landing-page__frame-dot--blue"
            cx="0"
            cy="0"
            r="4.5"
          />
          <animateMotion dur="5.2s" repeatCount="indefinite" rotate="auto">
            <mpath href="#landing-page__frame-path" />
          </animateMotion>
        </g>

        <g class="landing-page__frame-segment" filter="url(#landing-page__frame-glow)">
          <circle
            class="landing-page__frame-dot-glow landing-page__frame-dot-glow--violet"
            cx="0"
            cy="0"
            r="10"
          />
          <circle
            class="landing-page__frame-dot landing-page__frame-dot--violet"
            cx="0"
            cy="0"
            r="4.5"
          />
          <animateMotion dur="5.2s" begin="-2.6s" repeatCount="indefinite" rotate="auto">
            <mpath href="#landing-page__frame-path" />
          </animateMotion>
        </g>
      </svg>

      <div class="landing-page__content dbru-surface">
        <p class="landing-page__kicker dbru-text-sm">Slovo</p>
        <h1 class="landing-page__title dbru-text-main">Включайся в разговор</h1>

        <DbrButton
          class="landing-page__action"
          :native-type="'button'"
          variant="ghost"
          @click="goToLogin"
        >
          Войти
        </DbrButton>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { useRouter } from "vue-router";
import { DbrButton } from "dobruniaui-vue";
import LandingRipples from "../components/landing/LandingRipples.vue";
import { LOGIN_ROUTE_PATH } from "../constants";

const router = useRouter();

/**
 * Переводит пользователя на экран входа.
 */
async function goToLogin(): Promise<void> {
  await router.replace(LOGIN_ROUTE_PATH);
}
</script>

<style scoped>
.landing-page {
  --landing-accent-blue: #8db7f3;
  --landing-accent-blue-deep: #5b8edb;
  --landing-accent-violet: #c6acee;
  --landing-accent-violet-deep: #9a79d7;
  position: relative;
  isolation: isolate;
  width: min(100%, 84rem);
  height: 100%;
  display: grid;
  align-items: center;
  justify-items: center;
  overflow: hidden;
}

.landing-page__card {
  position: relative;
  z-index: 1;
  width: min(100%, 64rem);
  animation: landing-content-enter 700ms ease-out both;
}

.landing-page__content {
  position: relative;
  z-index: 1;
  display: grid;
  justify-items: center;
  gap: var(--dbru-space-5);
  padding: var(--dbru-space-6) calc(var(--dbru-space-6) + 0.75rem);
  text-align: center;
  border-radius: var(--dbru-radius-md);
  border: transparent;
  background: transparent;
  box-shadow:
    var(--dbru-shadow-md),
    0 1.25rem 3rem
      color-mix(in srgb, var(--landing-accent-blue) 8%, transparent);
  backdrop-filter: blur(10px);
  overflow: visible;
}

.landing-page__frame {
  position: absolute;
  inset: 0;
  pointer-events: none;
  width: 100%;
  height: 100%;
  overflow: visible;
}

.landing-page__frame-base {
  fill: none;
  stroke: color-mix(in srgb, var(--dbru-color-border) 88%, transparent);
  stroke-width: 2;
}

.landing-page__frame-dot-glow {
  opacity: 0.45;
  animation: landing-frame-glow-shift 2.8s linear infinite;
}

.landing-page__frame-dot-glow--blue {
  fill: color-mix(in srgb, var(--landing-accent-blue) 88%, white);
}

.landing-page__frame-dot--blue {
  fill: color-mix(in srgb, var(--landing-accent-blue-deep) 96%, white);
  animation: landing-frame-dot-shift 2.8s linear infinite;
}

.landing-page__frame-dot-glow--violet {
  fill: color-mix(in srgb, var(--landing-accent-violet) 90%, white);
  animation-delay: -1.4s;
}

.landing-page__frame-dot--violet {
  fill: color-mix(in srgb, var(--landing-accent-violet-deep) 96%, white);
  animation: landing-frame-dot-shift 2.8s linear infinite;
  animation-delay: -1.4s;
}

.landing-page__kicker {
  margin: 0;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: color-mix(in srgb, var(--landing-accent-blue-deep) 72%, var(--dbru-color-text));
}

.landing-page__title {
  margin: 0;
  max-width: 100%;
  white-space: nowrap;
  font-size: clamp(0.9rem, 2.82vw, 3rem);
  line-height: 1;
  letter-spacing: -0.03em;
  font-weight: 700;
  text-wrap: nowrap;
  text-shadow: 0 0.05em 0.8em
    color-mix(in srgb, var(--dbru-color-bg) 70%, transparent);
}

.landing-page__action {
  place-self: center;
  animation: landing-action-enter 900ms ease-out both;
}

.landing-page__aura {
  position: absolute;
  inset: auto;
  width: 26rem;
  aspect-ratio: 1;
  border-radius: 999px;
  pointer-events: none;
  opacity: 0.75;
  filter: blur(36px);
  z-index: 0;
}

.landing-page__aura--left {
  top: 8%;
  left: 6%;
  background:
    radial-gradient(
      circle,
      color-mix(in srgb, var(--dbru-color-primary) 16%, transparent) 0%,
      transparent 68%
    );
  animation: landing-float-left 12s ease-in-out infinite;
}

.landing-page__aura--right {
  right: 4%;
  bottom: 10%;
  width: 22rem;
  background:
    radial-gradient(
      circle,
      color-mix(in srgb, var(--dbru-color-border) 85%, transparent) 0%,
      transparent 72%
    );
  animation: landing-float-right 14s ease-in-out infinite;
}

@keyframes landing-content-enter {
  from {
    opacity: 0;
    transform: translateY(1.25rem);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes landing-frame-dot-shift {
  0%,
  100% {
    fill: color-mix(in srgb, var(--landing-accent-blue-deep) 96%, white);
  }

  35% {
    fill: color-mix(in srgb, var(--landing-accent-violet) 92%, white);
  }

  68% {
    fill: color-mix(in srgb, var(--landing-accent-blue) 98%, white);
  }
}

@keyframes landing-frame-glow-shift {
  0%,
  100% {
    fill: color-mix(in srgb, var(--landing-accent-blue) 88%, white);
  }

  35% {
    fill: color-mix(in srgb, var(--landing-accent-violet-deep) 84%, white);
  }

  68% {
    fill: color-mix(in srgb, var(--landing-accent-violet) 86%, white);
  }
}

@keyframes landing-action-enter {
  from {
    opacity: 0;
    transform: translateY(1rem);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes landing-float-left {
  0%,
  100% {
    transform: translate3d(0, 0, 0) scale(1);
  }

  50% {
    transform: translate3d(1.5rem, 1rem, 0) scale(1.04);
  }
}

@keyframes landing-float-right {
  0%,
  100% {
    transform: translate3d(0, 0, 0) scale(1);
  }

  50% {
    transform: translate3d(-1.25rem, -1rem, 0) scale(1.06);
  }
}

@media (prefers-reduced-motion: reduce) {
  .landing-page__content,
  .landing-page__action,
  .landing-page__aura {
    animation: none;
  }

  .landing-page__frame-segment {
    display: none;
  }
}

@media (max-width: 640px) {
  .landing-page {
    width: 100%;
  }

  .landing-page__card {
    width: min(100%, 100%);
  }

  .landing-page__content {
    padding: var(--dbru-space-4);
  }

  .landing-page__title {
    font-size: clamp(0.84rem, 3.55vw, 1.16rem);
  }

  .landing-page__action {
    min-width: 11rem;
  }

  .landing-page__aura--left {
    top: 3%;
    left: -18%;
    width: 18rem;
  }

  .landing-page__aura--right {
    right: -16%;
    bottom: 8%;
    width: 16rem;
  }
}
</style>

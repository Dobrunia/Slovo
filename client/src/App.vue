<template>
  <main class="app-shell">
    <section class="hero dbru-surface">
      <p class="eyebrow">Slovo</p>
      <h1>Voice-first workspace bootstrap</h1>
      <p class="lead">
        Проект готов к дальнейшей сборке GraphQL, LiveRail, Prisma и MediaSoup слоев.
      </p>

      <ul class="layer-list">
        <li v-for="layer in layers" :key="layer.name" class="layer-card dbru-surface">
          <p class="layer-name">{{ layer.name }}</p>
          <p class="layer-description">{{ layer.description }}</p>
        </li>
      </ul>
    </section>
  </main>
</template>

<script setup lang="ts">
import {
  DEFAULT_CLIENT_GRAPHQL_URL,
  DEFAULT_CLIENT_REALTIME_URL,
} from "./constants";

/**
 * Список технологических слоев, которые уже зафиксированы в bootstrap-конфигурации.
 */
const graphqlUrl = import.meta.env.VITE_GRAPHQL_URL?.trim() || DEFAULT_CLIENT_GRAPHQL_URL;
const realtimeUrl = import.meta.env.VITE_REALTIME_URL?.trim() || DEFAULT_CLIENT_REALTIME_URL;

const layers = [
  {
    name: "Client",
    description: "Vue 3 + Vite + Vitest + DobruniaUI Vue",
  },
  {
    name: "Transport",
    description: `GraphQL: ${graphqlUrl} | Realtime: ${realtimeUrl}`,
  },
  {
    name: "Media",
    description: "MediaSoup и mediasoup-client для voice и screen share",
  },
  {
    name: "Storage",
    description: "MySQL в Docker и Prisma для постоянных данных",
  },
];
</script>

<style scoped>
.app-shell {
  min-height: 100vh;
  padding: 48px 24px;
  background:
    radial-gradient(circle at top, rgba(94, 146, 255, 0.2), transparent 36%),
    linear-gradient(180deg, #09111f 0%, #050812 100%);
  color: #f4f7fb;
}

.hero {
  width: min(960px, 100%);
  margin: 0 auto;
  padding: 32px;
  border-radius: 28px;
  background: rgba(11, 18, 34, 0.82);
  border: 1px solid rgba(131, 162, 255, 0.2);
  backdrop-filter: blur(18px);
}

.eyebrow {
  margin: 0 0 12px;
  font-size: 0.75rem;
  letter-spacing: 0.24em;
  text-transform: uppercase;
  color: #89a7ff;
}

h1 {
  margin: 0;
  font-size: clamp(2.4rem, 5vw, 4.6rem);
  line-height: 0.95;
}

.lead {
  max-width: 42rem;
  margin: 20px 0 32px;
  color: rgba(244, 247, 251, 0.78);
  font-size: 1.05rem;
}

.layer-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 16px;
  padding: 0;
  margin: 0;
  list-style: none;
}

.layer-card {
  padding: 20px;
  border-radius: 20px;
  background: rgba(15, 25, 46, 0.94);
  border: 1px solid rgba(131, 162, 255, 0.16);
}

.layer-name {
  margin: 0 0 10px;
  font-size: 1rem;
  font-weight: 700;
}

.layer-description {
  margin: 0;
  color: rgba(244, 247, 251, 0.72);
  line-height: 1.5;
}

@media (max-width: 640px) {
  .app-shell {
    padding: 20px 16px;
  }

  .hero {
    padding: 24px;
    border-radius: 20px;
  }
}
</style>

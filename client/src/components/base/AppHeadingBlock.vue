<script setup lang="ts">
import { computed } from "vue";

/**
 * Свойства унифицированного блока заголовка с опциональными поясняющими строками.
 */
interface AppHeadingBlockProps {
  title: string;
  description?: string;
  eyebrow?: string;
  titleTag?: "h1" | "h2" | "h3" | "h4";
  titleSize?: "base" | "lg";
  centered?: boolean;
}

const props = withDefaults(defineProps<AppHeadingBlockProps>(), {
  description: "",
  eyebrow: "",
  titleTag: "h2",
  titleSize: "lg",
  centered: false,
});

/**
 * Возвращает utility-класс размера заголовка из DobruniaUI.
 */
const titleSizeClass = computed(() =>
  props.titleSize === "base" ? "dbru-text-base" : "dbru-text-lg",
);
</script>

<template>
  <div
    class="app-heading-block"
    :class="{
      'app-heading-block--centered': centered,
    }"
  >
    <p
      v-if="eyebrow"
      class="app-heading-block__eyebrow dbru-text-xs dbru-text-muted"
    >
      {{ eyebrow }}
    </p>

    <component
      :is="titleTag"
      class="app-heading-block__title dbru-text-main"
      :class="titleSizeClass"
    >
      {{ title }}
    </component>

    <p
      v-if="description"
      class="app-heading-block__description dbru-text-sm dbru-text-muted"
    >
      {{ description }}
    </p>
  </div>
</template>

<style scoped>
.app-heading-block {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.app-heading-block--centered {
  justify-items: center;
  text-align: center;
}

.app-heading-block__eyebrow,
.app-heading-block__title,
.app-heading-block__description {
  margin: 0;
  min-width: 0;
}

.app-heading-block__eyebrow {
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
</style>

<template>
  <header class="app-header-layout">
    <div class="app-header-layout__primary">
      <slot name="primary" />
    </div>

    <div class="app-header-layout__secondary">
      <slot name="secondary" />
    </div>
  </header>
</template>

<style scoped>
.app-header-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: var(--dbru-space-4);
  align-items: center;
  padding: var(--dbru-space-4) var(--dbru-space-5);
  border-bottom: var(--dbru-border-size-1) solid var(--dbru-color-border);
}

.app-header-layout__primary {
  min-width: 0;
}

.app-header-layout__secondary {
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
}

@media (max-width: 640px) {
  .app-header-layout {
    grid-template-columns: 1fr;
    padding: var(--dbru-space-2) var(--dbru-space-3) 0;
  }
}
</style>

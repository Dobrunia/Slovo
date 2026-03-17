<template>
  <div class="authenticated-layout">
    <header class="authenticated-layout__header">
      <slot name="header" />
    </header>

    <div class="authenticated-layout__body">
      <aside class="authenticated-layout__sidebar">
        <slot name="sidebar" />
      </aside>

      <section class="authenticated-layout__main">
        <div class="authenticated-layout__user-control">
          <slot name="user-control" />
        </div>

        <div class="authenticated-layout__content">
          <slot name="content" />
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.authenticated-layout {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.authenticated-layout__header,
.authenticated-layout__body,
.authenticated-layout__sidebar,
.authenticated-layout__main,
.authenticated-layout__content {
  min-height: 0;
}

.authenticated-layout__body {
  display: grid;
  grid-template-columns: minmax(18rem, 22rem) minmax(0, 1fr);
  gap: 0;
  overflow: hidden;
}

.authenticated-layout__main {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  overflow: hidden;
}

.authenticated-layout__user-control,
.authenticated-layout__content {
  min-height: 0;
}

@media (max-width: 960px) {
  .authenticated-layout__body {
    grid-template-columns: 1fr;
  }
}
</style>

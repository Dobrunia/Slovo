<script setup lang="ts">
import { computed, reactive, watch } from "vue";
import { DbrButton, DbrCard, DbrInput } from "dobruniaui-vue";
import xIcon from "../../assets/icons/x.svg";
import AppIconButton from "../../components/base/AppIconButton.vue";
import AppHeadingBlock from "../../components/base/AppHeadingBlock.vue";
import { useServersStore } from "../../stores/servers";

const props = defineProps<{
  isOpen: boolean;
}>();

const emit = defineEmits<{
  close: [];
  created: [serverId: string];
}>();

const serversStore = useServersStore();
const form = reactive({
  name: "",
});

const submitLabel = computed(() =>
  serversStore.isCreating ? "Создаем..." : "Создать сервер",
);

const errorMessage = computed(() => serversStore.createErrorMessage);

watch(
  () => props.isOpen,
  (isOpen) => {
    if (isOpen) {
      serversStore.clearCreateError();
      return;
    }

    serversStore.clearCreateError();
    form.name = "";
  },
);

/**
 * Отправляет запрос на создание нового сервера и закрывает модальное окно после успеха.
 */
async function handleSubmit(): Promise<void> {
  const createdServer = await serversStore.createServer({
    name: form.name,
  });

  form.name = "";
  emit("created", createdServer.id);
  emit("close");
}
</script>

<template>
  <Teleport to="body">
    <transition name="create-server-modal">
      <div v-if="isOpen" class="create-server-modal" @click.self="emit('close')">
        <div class="create-server-modal__dialog">
          <DbrCard class="create-server-modal__card">
            <div class="create-server-modal__surface">
              <header class="create-server-modal__header">
                <AppHeadingBlock
                  class="create-server-modal__heading"
                  eyebrow="Новый сервер"
                  title="Создать сервер"
                />

                <AppIconButton
                  :icon-src="xIcon"
                  label="Закрыть окно создания сервера"
                  icon-alt=""
                  @click="emit('close')"
                />
              </header>

              <form class="create-server-modal__form" @submit.prevent="handleSubmit">
                <DbrInput
                  v-model="form.name"
                  label="Название сервера"
                  required
                />

                <p v-if="errorMessage" class="create-server-modal__error dbru-text-sm">
                  {{ errorMessage }}
                </p>

                <footer class="create-server-modal__footer">
                  <DbrButton
                    variant="ghost"
                    :native-type="'button'"
                    @click="emit('close')"
                  >
                    Отмена
                  </DbrButton>

                  <DbrButton
                    :disabled="serversStore.isCreating || !form.name.trim()"
                    :native-type="'submit'"
                  >
                    {{ submitLabel }}
                  </DbrButton>
                </footer>
              </form>
            </div>
          </DbrCard>
        </div>
      </div>
    </transition>
  </Teleport>
</template>

<style scoped>
.create-server-modal {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--dbru-space-4);
  backdrop-filter: blur(12px);
}

.create-server-modal__dialog {
  width: min(100%, 32rem);
}

.create-server-modal__card {
  width: 100%;
  border: var(--dbru-border-size-1) solid var(--dbru-color-border);
  border-radius: var(--dbru-radius-md);
  background: var(--dbru-color-surface);
  box-shadow: var(--dbru-shadow-md);
}

.create-server-modal__surface {
  display: grid;
  gap: var(--dbru-space-5);
  padding: var(--dbru-space-6);
  color: var(--dbru-color-text);
}

.create-server-modal__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--dbru-space-4);
}

.create-server-modal__heading {
  flex: 1 1 auto;
}

.create-server-modal__form {
  display: grid;
  gap: var(--dbru-space-4);
}

.create-server-modal__error {
  margin: 0;
  color: var(--dbru-color-error);
}

.create-server-modal__footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--dbru-space-3);
}

.create-server-modal-enter-active,
.create-server-modal-leave-active {
  transition: opacity 180ms ease;
}

.create-server-modal-enter-active .create-server-modal__dialog,
.create-server-modal-leave-active .create-server-modal__dialog {
  transition:
    transform 180ms ease,
    opacity 180ms ease;
}

.create-server-modal-enter-from,
.create-server-modal-leave-to {
  opacity: 0;
}

.create-server-modal-enter-from .create-server-modal__dialog,
.create-server-modal-leave-to .create-server-modal__dialog {
  opacity: 0;
  transform: translateY(0.75rem) scale(0.98);
}

@media (max-width: 640px) {
  .create-server-modal {
    padding: var(--dbru-space-3);
  }

  .create-server-modal__surface {
    gap: var(--dbru-space-4);
    padding: var(--dbru-space-5);
  }

  .create-server-modal__footer {
    flex-direction: column-reverse;
  }
}
</style>

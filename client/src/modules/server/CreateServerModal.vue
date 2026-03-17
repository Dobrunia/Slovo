<script setup lang="ts">
import { computed, reactive, watch } from 'vue';
import { DbrButton, DbrCard, DbrInput } from 'dobruniaui-vue';
import xIcon from '../../assets/icons/x.svg';
import AppIconButton from '../../components/base/AppIconButton.vue';
import AppHeadingBlock from '../../components/base/AppHeadingBlock.vue';
import { useServersStore } from '../../stores/servers';

const props = defineProps<{
  isOpen: boolean;
}>();

const emit = defineEmits<{
  close: [];
  created: [serverId: string];
}>();

const serversStore = useServersStore();
const form = reactive({
  name: '',
});

const submitLabel = computed(() => (serversStore.isCreating ? 'Создаем...' : 'Создать сервер'));

const errorMessage = computed(() => serversStore.createErrorMessage);

watch(
  () => props.isOpen,
  (isOpen) => {
    if (isOpen) {
      serversStore.clearCreateError();
      return;
    }

    serversStore.clearCreateError();
    form.name = '';
  }
);

/**
 * Отправляет запрос на создание нового сервера и закрывает модальное окно после успеха.
 */
async function handleSubmit(): Promise<void> {
  const createdServer = await serversStore.createServer({
    name: form.name,
  });

  form.name = '';
  emit('created', createdServer.id);
  emit('close');
}
</script>

<template>
  <Teleport to="body">
    <transition name="create-server-modal">
      <div v-if="isOpen" class="create-server-modal" @click.self="emit('close')">
        <DbrCard>
          <form class="create-server-modal__form" @submit.prevent="handleSubmit">
            <header class="create-server-modal__header">
              <AppHeadingBlock title="Создать сервер" />

              <AppIconButton
                :icon-src="xIcon"
                label="Закрыть окно создания сервера"
                icon-alt=""
                @click="emit('close')"
              />
            </header>
            <DbrInput v-model="form.name" label="Название сервера" required />

            <p v-if="errorMessage" class="create-server-modal__error dbru-text-sm">
              {{ errorMessage }}
            </p>

            <DbrButton
              :disabled="serversStore.isCreating || !form.name.trim()"
              :native-type="'submit'"
            >
              {{ submitLabel }}
            </DbrButton>
          </form>
        </DbrCard>
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
  backdrop-filter: blur(12px);
}

.create-server-modal__form {
  width: 600px;
  padding: var(--dbru-space-4);
  display: flex;
  flex-direction: column;
  gap: var(--dbru-space-4);
}

.create-server-modal__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.create-server-modal__error {
  margin: 0;
  color: var(--dbru-color-error);
}
</style>

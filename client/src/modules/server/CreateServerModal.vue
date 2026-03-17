<script setup lang="ts">
import { computed, reactive, watch } from 'vue';
import { DbrButton, DbrInput } from 'dobruniaui-vue';
import AppModalLayout from '../../components/base/AppModalLayout.vue';
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
  <AppModalLayout
    :is-open="isOpen"
    title="Создать сервер"
    @close="emit('close')"
  >
    <form class="create-server-modal__form" @submit.prevent="handleSubmit">
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
  </AppModalLayout>
</template>

<style scoped>
.create-server-modal__form {
  width: 100%;
  min-width: 0;
  display: grid;
  gap: var(--dbru-space-4);
}

.create-server-modal__error {
  margin: 0;
  color: var(--dbru-color-error);
}
</style>

import type {
  ClientChannelsUpdatedEventPayload,
  ClientPresenceUpdatedEventPayload,
  ClientServerUpdatedEventPayload,
} from "../types/server";
import { subscribeToServerPresence, subscribeToServerStructure } from "./runtime";

type StopSubscription = () => Promise<void>;

/**
 * Singleton-orchestration слой для home-экрана.
 * Этот helper не является общим multi-consumer subscribe API: он сознательно держит
 * один active/pending target на весь модуль и рассчитан только на одного владельца
 * lifecycle в рамках текущего SPA-клиента.
 */

/**
 * Входные параметры singleton-подписки на live-состояние выбранного сервера.
 */
export interface SubscribeToServerLiveStateInput {
  sessionToken: string;
  serverId: string;
  onServerUpdated(payload: ClientServerUpdatedEventPayload): void;
  onChannelsUpdated(payload: ClientChannelsUpdatedEventPayload): void;
  onPresenceUpdated(payload: ClientPresenceUpdatedEventPayload): void;
}

let activeSubscriptionTarget: string | null = null;
let activeSubscriptionStop: StopSubscription | null = null;
let pendingSubscriptionTarget: string | null = null;
let pendingSubscriptionPromise: Promise<StopSubscription> | null = null;

/**
 * Подписывает singleton-orchestration слой на live-структуру и presence выбранного сервера.
 * Функция дедуплицирует только один active/pending target и не предназначена
 * для независимых параллельных потребителей.
 */
export async function subscribeToServerLiveState(
  input: SubscribeToServerLiveStateInput,
): Promise<StopSubscription> {
  const subscriptionTarget = createSubscriptionTarget(input.sessionToken, input.serverId);

  if (activeSubscriptionTarget === subscriptionTarget && activeSubscriptionStop) {
    return activeSubscriptionStop;
  }

  if (
    pendingSubscriptionTarget === subscriptionTarget &&
    pendingSubscriptionPromise
  ) {
    return pendingSubscriptionPromise;
  }

  const pendingSubscription = createServerLiveSubscription(input, subscriptionTarget);
  pendingSubscriptionTarget = subscriptionTarget;
  pendingSubscriptionPromise = pendingSubscription;

  try {
    const stop = await pendingSubscription;
    activeSubscriptionTarget = subscriptionTarget;
    activeSubscriptionStop = stop;
    return stop;
  } finally {
    if (pendingSubscriptionTarget === subscriptionTarget) {
      pendingSubscriptionTarget = null;
      pendingSubscriptionPromise = null;
    }
  }
}

/**
 * Создает реальную пару подписок на структуру сервера и server presence.
 */
async function createServerLiveSubscription(
  input: SubscribeToServerLiveStateInput,
  subscriptionTarget: string,
): Promise<StopSubscription> {
  let stopStructureSubscription: null | (() => Promise<void> | void) = null;
  let stopPresenceSubscription: null | (() => Promise<void> | void) = null;

  try {
    stopStructureSubscription = await subscribeToServerStructure({
      sessionToken: input.sessionToken,
      serverId: input.serverId,
      onServerUpdated: input.onServerUpdated,
      onChannelsUpdated: input.onChannelsUpdated,
    });
    stopPresenceSubscription = await subscribeToServerPresence({
      sessionToken: input.sessionToken,
      serverId: input.serverId,
      onPresenceUpdated: input.onPresenceUpdated,
    });
  } catch (error) {
    await Promise.allSettled([
      stopSubscription(stopStructureSubscription),
      stopSubscription(stopPresenceSubscription),
    ]);
    throw error;
  }

  let isStopped = false;

  return async () => {
    if (isStopped) {
      return;
    }

    isStopped = true;

    if (activeSubscriptionTarget === subscriptionTarget) {
      activeSubscriptionTarget = null;
      activeSubscriptionStop = null;
    }

    await Promise.allSettled([
      stopSubscription(stopPresenceSubscription),
      stopSubscription(stopStructureSubscription),
    ]);
  };
}

/**
 * Приводит session/server target к детерминированной строке для dedupe.
 */
function createSubscriptionTarget(sessionToken: string, serverId: string): string {
  return `${sessionToken}:${serverId}`;
}

/**
 * Безопасно останавливает подписку, если она была создана.
 */
async function stopSubscription(
  stop: null | (() => Promise<void> | void),
): Promise<void> {
  if (!stop) {
    return;
  }

  await Promise.resolve(stop());
}

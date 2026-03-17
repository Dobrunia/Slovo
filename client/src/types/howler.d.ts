declare module "howler" {
  /**
   * Минимальная типизация howler, используемая клиентом только для resume AudioContext.
   */
  export const Howler: {
    ctx?: {
      state?: string;
      resume(): Promise<void>;
    } | null;
  };
}

declare module "howler" {
  /**
   * Минимальная локальная типизация howler для управления AudioContext.
   */
  export const Howler: {
    ctx?: {
      state?: string;
      resume(): Promise<void>;
    } | null;
  };
}

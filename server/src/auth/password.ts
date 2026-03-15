import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { PASSWORD_KEY_BYTES, PASSWORD_SALT_BYTES } from "../config/constants.js";

const scrypt = promisify(scryptCallback);

/**
 * Создает стойкий хеш пароля для хранения в базе данных.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(PASSWORD_SALT_BYTES).toString("hex");
  const derivedKey = await derivePasswordKey(password, salt);

  return `${salt}:${derivedKey.toString("hex")}`;
}

/**
 * Проверяет, соответствует ли пароль ранее сохраненному хешу.
 */
export async function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  const [salt, hash] = passwordHash.split(":");

  if (!salt || !hash) {
    return false;
  }

  const derivedKey = await derivePasswordKey(password, salt);
  const storedKey = Buffer.from(hash, "hex");

  if (derivedKey.length !== storedKey.length) {
    return false;
  }

  return timingSafeEqual(derivedKey, storedKey);
}

/**
 * Вычисляет бинарный ключ пароля через scrypt для заданной соли.
 */
async function derivePasswordKey(password: string, salt: string): Promise<Buffer> {
  const derivedKey = await scrypt(password, salt, PASSWORD_KEY_BYTES);

  return Buffer.from(derivedKey as ArrayBuffer);
}

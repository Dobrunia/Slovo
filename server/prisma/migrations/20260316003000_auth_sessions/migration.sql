CREATE TABLE `AuthSession` (
  `id` VARCHAR(191) NOT NULL,
  `tokenHash` VARCHAR(64) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `AuthSession_tokenHash_key`(`tokenHash`),
  INDEX `AuthSession_userId_idx`(`userId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `AuthSession`
  ADD CONSTRAINT `AuthSession_userId_fkey`
  FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

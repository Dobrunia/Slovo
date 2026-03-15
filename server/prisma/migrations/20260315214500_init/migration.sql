-- CreateTable
CREATE TABLE `User` (
  `id` VARCHAR(191) NOT NULL,
  `email` VARCHAR(191) NOT NULL,
  `username` VARCHAR(191) NOT NULL,
  `passwordHash` VARCHAR(255) NOT NULL,
  `displayName` VARCHAR(191) NOT NULL,
  `avatarUrl` VARCHAR(2048) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `User_email_key`(`email`),
  UNIQUE INDEX `User_username_key`(`username`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Server` (
  `id` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `avatarUrl` VARCHAR(2048) NULL,
  `isPublic` BOOLEAN NOT NULL DEFAULT false,
  `ownerId` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  INDEX `Server_ownerId_idx`(`ownerId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ServerMember` (
  `id` VARCHAR(191) NOT NULL,
  `serverId` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `role` ENUM('OWNER', 'ADMIN', 'MEMBER') NOT NULL DEFAULT 'MEMBER',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  INDEX `ServerMember_userId_idx`(`userId`),
  UNIQUE INDEX `ServerMember_serverId_userId_key`(`serverId`, `userId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `VoiceChannel` (
  `id` VARCHAR(191) NOT NULL,
  `serverId` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `sortOrder` INTEGER NOT NULL DEFAULT 0,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  INDEX `VoiceChannel_serverId_sortOrder_idx`(`serverId`, `sortOrder`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ServerBan` (
  `id` VARCHAR(191) NOT NULL,
  `serverId` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `bannedByUserId` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  INDEX `ServerBan_bannedByUserId_idx`(`bannedByUserId`),
  UNIQUE INDEX `ServerBan_serverId_userId_key`(`serverId`, `userId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Server`
ADD CONSTRAINT `Server_ownerId_fkey`
FOREIGN KEY (`ownerId`) REFERENCES `User`(`id`)
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ServerMember`
ADD CONSTRAINT `ServerMember_serverId_fkey`
FOREIGN KEY (`serverId`) REFERENCES `Server`(`id`)
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ServerMember`
ADD CONSTRAINT `ServerMember_userId_fkey`
FOREIGN KEY (`userId`) REFERENCES `User`(`id`)
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VoiceChannel`
ADD CONSTRAINT `VoiceChannel_serverId_fkey`
FOREIGN KEY (`serverId`) REFERENCES `Server`(`id`)
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ServerBan`
ADD CONSTRAINT `ServerBan_serverId_fkey`
FOREIGN KEY (`serverId`) REFERENCES `Server`(`id`)
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ServerBan`
ADD CONSTRAINT `ServerBan_userId_fkey`
FOREIGN KEY (`userId`) REFERENCES `User`(`id`)
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ServerBan`
ADD CONSTRAINT `ServerBan_bannedByUserId_fkey`
FOREIGN KEY (`bannedByUserId`) REFERENCES `User`(`id`)
ON DELETE RESTRICT ON UPDATE CASCADE;

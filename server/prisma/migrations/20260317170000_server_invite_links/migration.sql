ALTER TABLE `Server`
ADD COLUMN `inviteToken` VARCHAR(64) NULL;

CREATE UNIQUE INDEX `Server_inviteToken_key` ON `Server`(`inviteToken`);

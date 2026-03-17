UPDATE `ServerMember` AS `membership`
JOIN `Server` AS `server` ON `server`.`id` = `membership`.`serverId`
SET `membership`.`role` = 'OWNER'
WHERE `membership`.`role` = 'ADMIN'
  AND `membership`.`userId` = `server`.`ownerId`;

UPDATE `ServerMember`
SET `role` = 'MEMBER'
WHERE `role` = 'ADMIN';

ALTER TABLE `ServerMember`
MODIFY `role` ENUM('OWNER', 'MEMBER') NOT NULL DEFAULT 'MEMBER';

CREATE TABLE `life_members` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `revision` INTEGER NOT NULL DEFAULT 1,
  `name_en` VARCHAR(200) NOT NULL,
  `name_ne` VARCHAR(200) NOT NULL,
  `display_order` INTEGER NOT NULL DEFAULT 0,
  `is_active` BOOLEAN NOT NULL DEFAULT false,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `life_members_is_active_display_order_id_idx` (`is_active`, `display_order`, `id`),
  CONSTRAINT `life_members_order_check` CHECK (`display_order` BETWEEN 0 AND 999999)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

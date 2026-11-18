CREATE TABLE `about_organization` (
  `id` INTEGER NOT NULL DEFAULT 1,
  `revision` INTEGER NOT NULL DEFAULT 1,
  `heading_en` VARCHAR(200) NOT NULL,
  `heading_ne` VARCHAR(200) NOT NULL,
  `introduction_en` TEXT NOT NULL,
  `introduction_ne` TEXT NOT NULL,
  `background_history_en` TEXT NOT NULL,
  `background_history_ne` TEXT NOT NULL,
  `objectives_en` TEXT NOT NULL,
  `objectives_ne` TEXT NOT NULL,
  `core_values_en` TEXT NOT NULL,
  `core_values_ne` TEXT NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  CONSTRAINT `about_organization_singleton` CHECK (`id` = 1)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `vision_mission` (
  `id` INTEGER NOT NULL DEFAULT 1,
  `revision` INTEGER NOT NULL DEFAULT 1,
  `vision_en` TEXT NOT NULL,
  `vision_ne` TEXT NOT NULL,
  `mission_en` TEXT NOT NULL,
  `mission_ne` TEXT NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  CONSTRAINT `vision_mission_singleton` CHECK (`id` = 1)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `team_members` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `revision` INTEGER NOT NULL DEFAULT 1,
  `name_en` VARCHAR(200) NOT NULL,
  `name_ne` VARCHAR(200) NOT NULL,
  `designation_en` VARCHAR(200) NOT NULL,
  `designation_ne` VARCHAR(200) NOT NULL,
  `introduction_en` TEXT NOT NULL,
  `introduction_ne` TEXT NOT NULL,
  `photo_id` INTEGER NULL,
  `display_order` INTEGER NOT NULL DEFAULT 0,
  `is_active` BOOLEAN NOT NULL DEFAULT false,
  INDEX `team_members_is_active_display_order_id_idx` (`is_active`,`display_order`,`id`),
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  CONSTRAINT `team_members_order_check` CHECK (`display_order` BETWEEN 0 AND 999999),
  CONSTRAINT `team_members_photo_id_fkey` FOREIGN KEY (`photo_id`) REFERENCES `media_assets` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `committee_members` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `revision` INTEGER NOT NULL DEFAULT 1,
  `name_en` VARCHAR(200) NOT NULL,
  `name_ne` VARCHAR(200) NOT NULL,
  `position_en` VARCHAR(200) NOT NULL,
  `position_ne` VARCHAR(200) NOT NULL,
  `committee_role_en` VARCHAR(200) NOT NULL,
  `committee_role_ne` VARCHAR(200) NOT NULL,
  `introduction_en` TEXT NOT NULL,
  `introduction_ne` TEXT NOT NULL,
  `photo_id` INTEGER NULL,
  `display_order` INTEGER NOT NULL DEFAULT 0,
  `is_active` BOOLEAN NOT NULL DEFAULT false,
  INDEX `committee_members_is_active_display_order_id_idx` (`is_active`,`display_order`,`id`),
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  CONSTRAINT `committee_members_order_check` CHECK (`display_order` BETWEEN 0 AND 999999),
  CONSTRAINT `committee_members_photo_id_fkey` FOREIGN KEY (`photo_id`) REFERENCES `media_assets` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `about_images` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `revision` INTEGER NOT NULL DEFAULT 1,
  `alt_text_en` VARCHAR(500) NOT NULL,
  `alt_text_ne` VARCHAR(500) NOT NULL,
  `media_id` INTEGER NOT NULL,
  `display_order` INTEGER NOT NULL DEFAULT 0,
  `about_id` INTEGER NOT NULL DEFAULT 1,
  INDEX `about_images_about_id_display_order_id_idx` (`about_id`,`display_order`,`id`),
  CONSTRAINT `about_images_about_id_fkey` FOREIGN KEY (`about_id`) REFERENCES `about_organization` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  CONSTRAINT `about_images_order_check` CHECK (`display_order` BETWEEN 0 AND 999999),
  CONSTRAINT `about_images_media_id_fkey` FOREIGN KEY (`media_id`) REFERENCES `media_assets` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

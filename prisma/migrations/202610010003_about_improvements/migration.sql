ALTER TABLE `about_organization`
  ADD COLUMN `hero_image_id` INTEGER NULL,
  ADD COLUMN `youtube_url` VARCHAR(100) NULL,
  ADD CONSTRAINT `about_organization_hero_image_id_fkey` FOREIGN KEY (`hero_image_id`) REFERENCES `media_assets` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE `about_statistics` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `revision` INTEGER NOT NULL DEFAULT 1,
  `kind` VARCHAR(32) NOT NULL,
  `label_en` VARCHAR(100) NOT NULL,
  `label_ne` VARCHAR(100) NOT NULL,
  `value` VARCHAR(40) NOT NULL,
  `display_order` INTEGER NOT NULL DEFAULT 0,
  `is_active` BOOLEAN NOT NULL DEFAULT false,
  `about_id` INTEGER NOT NULL DEFAULT 1,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `about_statistics_kind_key` (`kind`),
  INDEX `about_statistics_about_id_is_active_display_order_id_idx` (`about_id`, `is_active`, `display_order`, `id`),
  CONSTRAINT `about_statistics_kind_check` CHECK (`kind` IN ('community_reach','families_supported','projects_completed','active_volunteers')),
  CONSTRAINT `about_statistics_order_check` CHECK (`display_order` BETWEEN 0 AND 999999),
  CONSTRAINT `about_statistics_about_id_fkey` FOREIGN KEY (`about_id`) REFERENCES `about_organization` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

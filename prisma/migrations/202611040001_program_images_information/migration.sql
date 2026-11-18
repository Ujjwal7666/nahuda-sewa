ALTER TABLE `programs` ADD COLUMN `additional_format` VARCHAR(10) NOT NULL DEFAULT 'PLAIN',
  ADD CONSTRAINT `programs_additional_format_check` CHECK (`additional_format` IN ('PLAIN','HTML'));
CREATE TABLE `program_images` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `revision` INTEGER NOT NULL DEFAULT 1,
  `caption_en` TEXT NOT NULL,
  `caption_ne` TEXT NOT NULL,
  `alt_text_en` VARCHAR(500) NOT NULL,
  `alt_text_ne` VARCHAR(500) NOT NULL,
  `display_order` INTEGER NOT NULL DEFAULT 0,
  `image_id` INTEGER NOT NULL,
  `program_id` INTEGER NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `program_images_program_id_display_order_id_idx` (`program_id`,`display_order`,`id`),
  CONSTRAINT `program_images_order_check` CHECK (`display_order` BETWEEN 0 AND 999999),
  CONSTRAINT `program_images_program_id_fkey` FOREIGN KEY (`program_id`) REFERENCES `programs` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `program_images_image_id_fkey` FOREIGN KEY (`image_id`) REFERENCES `media_assets` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

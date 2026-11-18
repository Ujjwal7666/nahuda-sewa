-- CreateTable
CREATE TABLE `service_categories` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `revision` INTEGER NOT NULL DEFAULT 1,
    `name_en` VARCHAR(200) NOT NULL,
    `name_ne` VARCHAR(200) NOT NULL,
    `slug` VARCHAR(120) NOT NULL,
    `description_en` TEXT NOT NULL,
    `description_ne` TEXT NOT NULL,
    `display_order` INTEGER NOT NULL DEFAULT 0,
    `is_active` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `service_categories_slug_key`(`slug`),
    INDEX `service_categories_is_active_display_order_id_idx`(`is_active`, `display_order`, `id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `services` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `revision` INTEGER NOT NULL DEFAULT 1,
    `name_en` VARCHAR(200) NOT NULL,
    `name_ne` VARCHAR(200) NOT NULL,
    `slug` VARCHAR(120) NOT NULL,
    `short_description_en` TEXT NOT NULL,
    `short_description_ne` TEXT NOT NULL,
    `full_description_en` TEXT NOT NULL,
    `full_description_ne` TEXT NOT NULL,
    `who_is_it_for_en` TEXT NOT NULL,
    `who_is_it_for_ne` TEXT NOT NULL,
    `availability_en` TEXT NOT NULL,
    `availability_ne` TEXT NOT NULL,
    `location_en` TEXT NOT NULL,
    `location_ne` TEXT NOT NULL,
    `icon` VARCHAR(40) NULL,
    `featured_image_id` INTEGER NULL,
    `category_id` INTEGER NULL,
    `display_order` INTEGER NOT NULL DEFAULT 0,
    `is_active` BOOLEAN NOT NULL DEFAULT false,
    `is_featured` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `services_slug_key`(`slug`),
    INDEX `services_is_active_display_order_id_idx`(`is_active`, `display_order`, `id`),
    INDEX `services_is_active_is_featured_display_order_id_idx`(`is_active`, `is_featured`, `display_order`, `id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `service_features` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `revision` INTEGER NOT NULL DEFAULT 1,
    `title_en` VARCHAR(200) NOT NULL,
    `title_ne` VARCHAR(200) NOT NULL,
    `description_en` TEXT NOT NULL,
    `description_ne` TEXT NOT NULL,
    `display_order` INTEGER NOT NULL DEFAULT 0,
    `service_id` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `service_features_service_id_display_order_id_idx`(`service_id`, `display_order`, `id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `service_images` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `revision` INTEGER NOT NULL DEFAULT 1,
    `caption_en` TEXT NOT NULL,
    `caption_ne` TEXT NOT NULL,
    `alt_text_en` VARCHAR(500) NOT NULL,
    `alt_text_ne` VARCHAR(500) NOT NULL,
    `display_order` INTEGER NOT NULL DEFAULT 0,
    `image_id` INTEGER NOT NULL,
    `service_id` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `service_images_service_id_display_order_id_idx`(`service_id`, `display_order`, `id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `services` ADD CONSTRAINT `services_featured_image_id_fkey` FOREIGN KEY (`featured_image_id`) REFERENCES `media_assets`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `services` ADD CONSTRAINT `services_category_id_fkey` FOREIGN KEY (`category_id`) REFERENCES `service_categories`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `service_features` ADD CONSTRAINT `service_features_service_id_fkey` FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `service_images` ADD CONSTRAINT `service_images_image_id_fkey` FOREIGN KEY (`image_id`) REFERENCES `media_assets`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `service_images` ADD CONSTRAINT `service_images_service_id_fkey` FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- Match the established bounded ordering constraints.
ALTER TABLE `service_categories` ADD CONSTRAINT `service_categories_order_check` CHECK (`display_order` BETWEEN 0 AND 999999);
ALTER TABLE `services` ADD CONSTRAINT `services_order_check` CHECK (`display_order` BETWEEN 0 AND 999999);
ALTER TABLE `service_features` ADD CONSTRAINT `service_features_order_check` CHECK (`display_order` BETWEEN 0 AND 999999);
ALTER TABLE `service_images` ADD CONSTRAINT `service_images_order_check` CHECK (`display_order` BETWEEN 0 AND 999999);

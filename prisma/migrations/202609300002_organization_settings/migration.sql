-- CreateTable
CREATE TABLE `organization_settings` (
    `id` INTEGER NOT NULL DEFAULT 1,
    `revision` INTEGER NOT NULL DEFAULT 1,
    `name_en` VARCHAR(200) NULL,
    `name_ne` VARCHAR(200) NULL,
    `short_name_en` VARCHAR(80) NULL,
    `short_name_ne` VARCHAR(80) NULL,
    `tagline_en` VARCHAR(250) NULL,
    `tagline_ne` VARCHAR(250) NULL,
    `primary_email` VARCHAR(254) NULL,
    `secondary_email` VARCHAR(254) NULL,
    `phone` VARCHAR(64) NULL,
    `whatsapp` VARCHAR(64) NULL,
    `address_en` VARCHAR(500) NULL,
    `address_ne` VARCHAR(500) NULL,
    `city_en` VARCHAR(100) NULL,
    `city_ne` VARCHAR(100) NULL,
    `country_en` VARCHAR(100) NULL,
    `country_ne` VARCHAR(100) NULL,
    `map_url` TEXT NULL,
    `facebook_url` TEXT NULL,
    `instagram_url` TEXT NULL,
    `youtube_url` TEXT NULL,
    `linkedin_url` TEXT NULL,
    `x_url` TEXT NULL,
    `footer_description_en` TEXT NULL,
    `footer_description_ne` TEXT NULL,
    `copyright_en` VARCHAR(250) NULL,
    `copyright_ne` VARCHAR(250) NULL,
    `donation_intro_en` TEXT NULL,
    `donation_intro_ne` TEXT NULL,
    `bank_name` VARCHAR(150) NULL,
    `account_name` VARCHAR(150) NULL,
    `account_number` VARCHAR(100) NULL,
    `branch` VARCHAR(150) NULL,
    `swift_code` VARCHAR(11) NULL,
    `donation_instructions_en` TEXT NULL,
    `donation_instructions_ne` TEXT NULL,
    `site_title_en` VARCHAR(200) NULL,
    `site_title_ne` VARCHAR(200) NULL,
    `site_description_en` VARCHAR(500) NULL,
    `site_description_ne` VARCHAR(500) NULL,
    `primary_logo_id` INTEGER NULL,
    `footer_logo_id` INTEGER NULL,
    `favicon_id` INTEGER NULL,
    `donation_qr_id` INTEGER NULL,
    `sharing_image_id` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`),
    CONSTRAINT `organization_settings_singleton` CHECK (`id` = 1)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `media_assets` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `storage_key` VARCHAR(80) NOT NULL,
    `mime_type` VARCHAR(32) NOT NULL,
    `size_bytes` INTEGER NOT NULL,
    `width` INTEGER NOT NULL,
    `height` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `media_assets_storage_key_key`(`storage_key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `organization_settings` ADD CONSTRAINT `organization_settings_primary_logo_id_fkey` FOREIGN KEY (`primary_logo_id`) REFERENCES `media_assets`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `organization_settings` ADD CONSTRAINT `organization_settings_footer_logo_id_fkey` FOREIGN KEY (`footer_logo_id`) REFERENCES `media_assets`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `organization_settings` ADD CONSTRAINT `organization_settings_favicon_id_fkey` FOREIGN KEY (`favicon_id`) REFERENCES `media_assets`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `organization_settings` ADD CONSTRAINT `organization_settings_donation_qr_id_fkey` FOREIGN KEY (`donation_qr_id`) REFERENCES `media_assets`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `organization_settings` ADD CONSTRAINT `organization_settings_sharing_image_id_fkey` FOREIGN KEY (`sharing_image_id`) REFERENCES `media_assets`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;


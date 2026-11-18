-- CreateTable
CREATE TABLE `news` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `revision` INTEGER NOT NULL DEFAULT 1,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `title_en` VARCHAR(200) NOT NULL,
    `title_ne` VARCHAR(200) NOT NULL,
    `summary_en` TEXT NOT NULL,
    `summary_ne` TEXT NOT NULL,
    `content_en` TEXT NOT NULL,
    `content_ne` TEXT NOT NULL,
    `featured_image_id` INTEGER NULL,
    `slug` VARCHAR(120) NOT NULL,
    `slug_locked` BOOLEAN NOT NULL DEFAULT false,
    `published_date` DATE NULL,
    `status` ENUM('DRAFT', 'PUBLISHED') NOT NULL DEFAULT 'DRAFT',

    UNIQUE INDEX `news_slug_key`(`slug`),
    INDEX `news_status_published_date_id_idx`(`status`, `published_date`, `id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `gallery_albums` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `revision` INTEGER NOT NULL DEFAULT 1,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `title_en` VARCHAR(200) NOT NULL,
    `title_ne` VARCHAR(200) NOT NULL,
    `description_en` TEXT NOT NULL,
    `description_ne` TEXT NOT NULL,
    `cover_image_id` INTEGER NULL,
    `date` DATE NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT false,

    INDEX `gallery_albums_is_active_date_id_idx`(`is_active`, `date`, `id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `testimonials` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `revision` INTEGER NOT NULL DEFAULT 1,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `name_en` VARCHAR(200) NOT NULL,
    `name_ne` VARCHAR(200) NOT NULL,
    `position_organization_en` VARCHAR(200) NOT NULL,
    `position_organization_ne` VARCHAR(200) NOT NULL,
    `testimonial_en` TEXT NOT NULL,
    `testimonial_ne` TEXT NOT NULL,
    `photo_id` INTEGER NULL,
    `display_order` INTEGER NOT NULL DEFAULT 0,
    `is_active` BOOLEAN NOT NULL DEFAULT false,

    INDEX `testimonials_is_active_display_order_id_idx`(`is_active`, `display_order`, `id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `news_images` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `revision` INTEGER NOT NULL DEFAULT 1,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `alt_text_en` VARCHAR(500) NOT NULL,
    `alt_text_ne` VARCHAR(500) NOT NULL,
    `media_id` INTEGER NOT NULL,
    `news_id` INTEGER NOT NULL,
    `display_order` INTEGER NOT NULL DEFAULT 0,

    INDEX `news_images_news_id_display_order_id_idx`(`news_id`, `display_order`, `id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `gallery_images` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `revision` INTEGER NOT NULL DEFAULT 1,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `caption_en` TEXT NOT NULL,
    `caption_ne` TEXT NOT NULL,
    `alt_text_en` VARCHAR(500) NOT NULL,
    `alt_text_ne` VARCHAR(500) NOT NULL,
    `image_id` INTEGER NOT NULL,
    `album_id` INTEGER NOT NULL,
    `display_order` INTEGER NOT NULL DEFAULT 0,

    INDEX `gallery_images_album_id_display_order_id_idx`(`album_id`, `display_order`, `id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `news` ADD CONSTRAINT `news_featured_image_id_fkey` FOREIGN KEY (`featured_image_id`) REFERENCES `media_assets`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `gallery_albums` ADD CONSTRAINT `gallery_albums_cover_image_id_fkey` FOREIGN KEY (`cover_image_id`) REFERENCES `media_assets`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `testimonials` ADD CONSTRAINT `testimonials_photo_id_fkey` FOREIGN KEY (`photo_id`) REFERENCES `media_assets`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `news_images` ADD CONSTRAINT `news_images_media_id_fkey` FOREIGN KEY (`media_id`) REFERENCES `media_assets`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `news_images` ADD CONSTRAINT `news_images_news_id_fkey` FOREIGN KEY (`news_id`) REFERENCES `news`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `gallery_images` ADD CONSTRAINT `gallery_images_image_id_fkey` FOREIGN KEY (`image_id`) REFERENCES `media_assets`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `gallery_images` ADD CONSTRAINT `gallery_images_album_id_fkey` FOREIGN KEY (`album_id`) REFERENCES `gallery_albums`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- Editorial safety constraints, reviewed for MySQL 8.
ALTER TABLE news ADD CONSTRAINT news_published_date_check CHECK (status <> 'PUBLISHED' OR published_date IS NOT NULL);
ALTER TABLE testimonials ADD CONSTRAINT testimonials_order_check CHECK (display_order BETWEEN 0 AND 999999);
ALTER TABLE news_images ADD CONSTRAINT news_images_order_check CHECK (display_order BETWEEN 0 AND 999999);
ALTER TABLE gallery_images ADD CONSTRAINT gallery_images_order_check CHECK (display_order BETWEEN 0 AND 999999);

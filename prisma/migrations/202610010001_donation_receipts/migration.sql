-- CreateTable
CREATE TABLE `donation_receipt_submissions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `full_name` VARCHAR(100) NOT NULL,
    `email` VARCHAR(254) NOT NULL,
    `phone` VARCHAR(64) NULL,
    `donation_date` DATE NOT NULL,
    `donation_amount` DECIMAL(11, 2) NOT NULL,
    `currency` CHAR(3) NOT NULL,
    `transaction_reference` VARCHAR(150) NULL,
    `message` TEXT NULL,
    `receipt_key` VARCHAR(80) NOT NULL,
    `mime_type` VARCHAR(32) NOT NULL,
    `size_bytes` INTEGER NOT NULL,
    `width` INTEGER NOT NULL,
    `height` INTEGER NOT NULL,
    `submission_key` CHAR(64) NOT NULL,
    `status` ENUM('NEW', 'REVIEWED') NOT NULL DEFAULT 'NEW',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `donation_receipt_submissions_receipt_key_key`(`receipt_key`),
    UNIQUE INDEX `donation_receipt_submissions_submission_key_key`(`submission_key`),
    INDEX `donation_receipt_submissions_status_created_at_id_idx`(`status`, `created_at`, `id`),
    INDEX `donation_receipt_submissions_created_at_id_idx`(`created_at`, `id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

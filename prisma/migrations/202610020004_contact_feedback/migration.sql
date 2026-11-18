CREATE TABLE `contact_submissions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL,
    `email` VARCHAR(254) NOT NULL,
    `phone` VARCHAR(64) NULL,
    `subject` VARCHAR(200) NOT NULL,
    `message` TEXT NOT NULL,
    `submission_key` CHAR(64) NOT NULL,
    `submitted_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `status` ENUM('NEW', 'READ') NOT NULL DEFAULT 'NEW',
    UNIQUE INDEX `contact_submissions_submission_key_key` (`submission_key`),
    INDEX `contact_submissions_status_submitted_at_id_idx` (`status`, `submitted_at`, `id`),
    INDEX `contact_submissions_submitted_at_id_idx` (`submitted_at`, `id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

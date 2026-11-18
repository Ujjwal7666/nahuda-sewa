-- Existing members retain all values and remain unassigned until reviewed in Admin.
CREATE TABLE `committee_branches` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `revision` INTEGER NOT NULL DEFAULT 1,
  `name_en` VARCHAR(200) NOT NULL,
  `name_ne` VARCHAR(200) NOT NULL,
  `description_en` TEXT NOT NULL,
  `description_ne` TEXT NOT NULL,
  `display_order` INTEGER NOT NULL DEFAULT 0,
  `is_active` BOOLEAN NOT NULL DEFAULT false,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `committee_branches_is_active_display_order_id_idx` (`is_active`, `display_order`, `id`),
  CONSTRAINT `committee_branches_order_check` CHECK (`display_order` BETWEEN 0 AND 999999)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `committee_members` ADD COLUMN `branch_id` INTEGER NULL,
  ADD INDEX `committee_members_branch_id_is_active_display_order_id_idx` (`branch_id`, `is_active`, `display_order`, `id`),
  ADD CONSTRAINT `committee_members_branch_id_fkey` FOREIGN KEY (`branch_id`) REFERENCES `committee_branches` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

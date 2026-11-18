ALTER TABLE `services`
  MODIFY `full_description_en` LONGTEXT NOT NULL,
  MODIFY `full_description_ne` LONGTEXT NOT NULL,
  ADD COLUMN `description_format` VARCHAR(10) NOT NULL DEFAULT 'PLAIN',
  ADD COLUMN `image_position` VARCHAR(10) NOT NULL DEFAULT 'DEFAULT',
  ADD CONSTRAINT `services_description_format_check` CHECK (`description_format` IN ('PLAIN','HTML')),
  ADD CONSTRAINT `services_image_position_check` CHECK (`image_position` IN ('DEFAULT','LEFT','RIGHT','TOP','FULL'));

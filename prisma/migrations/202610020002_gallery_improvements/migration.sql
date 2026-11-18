-- Optional contextual credit preserves all existing album/image rows and relations.
ALTER TABLE `gallery_images`
  ADD COLUMN `credit_en` VARCHAR(200) NULL,
  ADD COLUMN `credit_ne` VARCHAR(200) NULL;

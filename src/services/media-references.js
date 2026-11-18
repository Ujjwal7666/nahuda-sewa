import {assetSlots} from '../config/organization-fields.js';
// All current public media owners must be checked before metadata/file removal.
export async function removeUnreferencedMedia(tx, asset) {
  const references = await tx.organizationSettings.count({where:{OR:assetSlots.map(({key})=>({[`${key}_id`]:asset.id}))}})
    + await tx.teamMember.count({where:{photo_id:asset.id}})
    + await tx.committeeMember.count({where:{photo_id:asset.id}})
    + await tx.aboutImage.count({where:{media_id:asset.id}})
    + await tx.aboutOrganization.count({where:{hero_image_id:asset.id}})
    + await tx.news.count({where:{featured_image_id:asset.id}})
    + await tx.newsImage.count({where:{media_id:asset.id}})
    + await tx.galleryAlbum.count({where:{cover_image_id:asset.id}})
    + await tx.galleryImage.count({where:{image_id:asset.id}})
    + await tx.testimonial.count({where:{photo_id:asset.id}})
    + await tx.service.count({where:{featured_image_id:asset.id}})
    + await tx.serviceImage.count({where:{image_id:asset.id}})
    + await tx.programImage.count({where:{image_id:asset.id}})
    + await tx.program.count({where:{featured_image_id:asset.id}});
  if (!references) await tx.mediaAsset.deleteMany({where:{id:asset.id}});
}

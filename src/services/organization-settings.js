import { mkdir, open, unlink } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { uploadRoot } from '../config/storage.js';
import { AssetError as SettingsError, decodeAsset, safeKey } from './image-assets.js';
import { assetSlots } from '../config/organization-fields.js';
import { branding } from '../config/branding.js';
import { removeUnreferencedMedia } from './media-references.js';

export { uploadRoot };

export const assetInclude = Object.fromEntries(assetSlots.map(({key}) => [key, true]));
export { AssetError as SettingsError, decodeAsset, safeKey } from './image-assets.js';
export const assetUrl = (asset) => asset ? `/media/${asset.storage_key}` : null;

export function organizationSettingsService(db, directory = uploadRoot) {
  const root = resolve(directory);
  const read = () => db.organizationSettings.findUnique({ where: {id: 1}, include: assetInclude });
  async function removeFile(key) {
    if (!safeKey(key)) return;
    try { await unlink(join(root, key)); } catch (error) { if (error.code !== 'ENOENT') console.error('Settings asset cleanup failed; inspect upload storage.'); }
  }
  return { read, root,
    async findAsset(key) { return safeKey(key) ? db.mediaAsset.findUnique({where: {storage_key: key}}) : null; },
    async save(values, body, files = {}) {
      const prepared = [];
      // Validate/decode all images before persisting any file or database change.
      for (const slot of assetSlots) {
        if (files[slot.key]?.length && body[`clear_${slot.key}`]) throw new SettingsError(`${slot.label}: choose either replacement or removal.`);
        if (files[slot.key]?.[0]) prepared.push({ slot, ...await decodeAsset(files[slot.key][0], slot) });
      }
      const written = [], obsolete = [];
      try {
        if (prepared.length) await mkdir(root, { recursive: true });
        for (const asset of prepared) {
          const handle = await open(join(root, asset.metadata.storage_key), 'wx');
          written.push(asset.metadata.storage_key);
          try { await handle.writeFile(asset.data); } finally { await handle.close(); }
        }
        await db.$transaction(async (tx) => {
          const previous = await tx.organizationSettings.findUnique({where: {id: 1}, include: assetInclude});
          if ((previous?.revision || 0) !== Number(body.revision)) throw new SettingsError('Settings changed in another tab. Reload this page before saving again.', 409);
          const data = {...values};
          for (const slot of assetSlots) {
            const replacement = prepared.find((item) => item.slot.key === slot.key);
            if (replacement || body[`clear_${slot.key}`] === '1') {
              data[`${slot.key}_id`] = replacement ? (await tx.mediaAsset.create({data: replacement.metadata})).id : null;
              if (previous?.[slot.key]) obsolete.push(previous[slot.key]);
            }
          }
          if (previous) {
            const result = await tx.organizationSettings.updateMany({where: {id: 1, revision: previous.revision}, data: {...data, revision: {increment: 1}}});
            if (result.count !== 1) throw new SettingsError('Settings changed in another tab. Reload this page before saving again.', 409);
          } else await tx.organizationSettings.create({data: {id: 1, ...data}});
          for (const asset of obsolete) {
            await removeUnreferencedMedia(tx, asset);
          }
        });
      } catch (error) {
        for (const key of written) await removeFile(key);
        if (error.code === 'P2002' || error.code === 'P2034') throw new SettingsError('Settings changed in another tab. Reload this page before saving again.', 409);
        throw error;
      }
      for (const asset of obsolete) if (!await db.mediaAsset.findUnique({where: {id: asset.id}})) await removeFile(asset.storage_key);
    },
  };
}

export function publicOrganization(row, locale = 'en') {
  const r = row || {};
  const text = (key) => r[`${key}_${locale}`] || r[`${key}_en`] || r[`${key}_ne`] || '';
  const organization = { ...Object.fromEntries(['name','short_name','tagline','address','city','country','footer_description','copyright','donation_intro','donation_instructions','site_title','site_description'].map((key) => [key, text(key)])),
    name: text('name') || branding.name[locale],
    names: {en: r.short_name_en || r.name_en || r.name_ne || branding.name.en, ne: r.short_name_ne || r.name_ne || r.short_name_en || r.name_en || branding.name.ne},
    primary_logo: assetUrl(r.primary_logo) || (!row ? branding.logoUrl : null),
    footer_logo: assetUrl(r.footer_logo) || assetUrl(r.primary_logo) || (!row ? branding.logoUrl : null),
    favicon: assetUrl(r.favicon), donation_qr: assetUrl(r.donation_qr), sharing_image: assetUrl(r.sharing_image),
    ...Object.fromEntries(['primary_email','secondary_email','phone','whatsapp','map_url','bank_name','account_name','account_number','branch','swift_code'].map((key) => [key, r[key] || ''])),
    socials: ['facebook','instagram','youtube','linkedin','x'].filter((key) => r[`${key}_url`]).map((key) => ({key, label: {facebook:'Facebook',instagram:'Instagram',youtube:'YouTube',linkedin:'LinkedIn',x:'X'}[key], url: r[`${key}_url`]})),
  };
  organization.hasDonation = ['donation_intro','donation_instructions','donation_qr','bank_name','account_name','account_number','branch','swift_code'].some((key) => organization[key]);
  return organization;
}

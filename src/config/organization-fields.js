// Shared form/validation metadata; these are fields of one organization, not translations as rows.
const pair = (key, label, max = 200, type = 'text') => ['en', 'ne'].map((lang) => ({
  key: `${key}_${lang}`, label: `${label} — ${lang === 'en' ? 'English' : 'नेपाली'}`, max, type, lang,
}));
const field = (key, label, max = 200, type = 'text') => ({ key, label, max, type });
export const settingsSections = [
  { id: 'identity', title: 'Organization Identity', fields: [ ...pair('name', 'Organization name'), ...pair('short_name', 'Short name', 80), ...pair('tagline', 'Tagline', 250) ] },
  { id: 'contact', title: 'Contact', fields: [field('primary_email', 'Primary email', 254, 'email'), field('secondary_email', 'Secondary email', 254, 'email'), field('phone', 'Phone', 64, 'tel'), field('whatsapp', 'WhatsApp (include country code)', 64, 'tel')] },
  { id: 'address', title: 'Address', fields: [...pair('address', 'Address', 500, 'textarea'), ...pair('city', 'City', 100), ...pair('country', 'Country', 100), field('map_url', 'Google Maps URL (link or embed URL, not HTML)', 2048, 'url')] },
  { id: 'social', title: 'Social Media', fields: ['facebook', 'instagram', 'youtube', 'linkedin', 'x'].map((key) => field(key + '_url', key === 'x' ? 'X' : key[0].toUpperCase() + key.slice(1), 2048, 'url')) },
  { id: 'footer', title: 'Footer', fields: [...pair('footer_description', 'Footer description', 4000, 'textarea'), ...pair('copyright', 'Copyright', 250)] },
  { id: 'donation', title: 'Donation Information', fields: [...pair('donation_intro', 'Donation introduction', 4000, 'textarea'), field('bank_name', 'Bank name', 150), field('account_name', 'Account name', 150), field('account_number', 'Account number', 100), field('branch', 'Branch', 150), field('swift_code', 'SWIFT code (8 or 11 characters)', 11), ...pair('donation_instructions', 'Additional instructions', 4000, 'textarea')] },
  { id: 'seo', title: 'SEO Defaults', fields: [...pair('site_title', 'Default site title', 200), ...pair('site_description', 'Default description', 500, 'textarea')] },
];
export const settingsFields = settingsSections.flatMap((section) => section.fields);
export const assetSlots = [
  { key: 'primary_logo', label: 'Primary logo' }, { key: 'footer_logo', label: 'Footer logo' },
  { key: 'favicon', label: 'Favicon' }, { key: 'donation_qr', label: 'Donation QR image' },
  { key: 'sharing_image', label: 'Social sharing image' },
];

export function validateSettings(body = {}) {
  const values = {}, errors = [];
  for (const field of settingsFields) {
    const raw = body[field.key] ?? '';
    if (typeof raw !== 'string') { errors.push(`${field.label}: enter one value.`); values[field.key] = ''; continue; }
    const value = raw.trim();
    values[field.key] = value || null;
    if (value.length > field.max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)) errors.push(`${field.label}: use at most ${field.max} characters and no control characters.`);
    if (value && field.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) errors.push(`${field.label}: enter a valid email address.`);
    if (value && field.type === 'tel' && (!/^[+\d\s().\-]+$/.test(value) || (value.match(/\d/g) || []).length < 5)) errors.push(`${field.label}: enter a phone number, including country code where appropriate.`);
    if (value && field.type === 'url') {
      try {
        const url = new URL(value);
        if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || !url.hostname.includes('.')) throw new Error();
        if (field.key === 'map_url' && !(['www.google.com', 'google.com', 'maps.google.com', 'maps.app.goo.gl', 'goo.gl'].includes(url.hostname))) throw new Error();
        values[field.key] = url.href;
      } catch { errors.push(`${field.label}: enter a valid ${field.key === 'map_url' ? 'Google Maps' : 'HTTP or HTTPS'} URL.`); }
    }
  }
  if (values.swift_code && !/^[A-Za-z]{6}[A-Za-z0-9]{2}([A-Za-z0-9]{3})?$/.test(values.swift_code)) errors.push('SWIFT code must contain 8 or 11 valid characters.');
  for (const slot of assetSlots) {
    if (body[`clear_${slot.key}`] !== undefined && body[`clear_${slot.key}`] !== '1') errors.push(`${slot.label}: invalid removal option.`);
  }
  if (typeof body.revision !== 'string' || !/^\d{1,10}$/.test(body.revision)) errors.push('Reload the settings page before saving.');
  return { values, errors };
}

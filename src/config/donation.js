import { normalizeEmail } from '../services/authentication.js';

export const currencies = ['NPR', 'INR', 'USD', 'EUR', 'GBP', 'AUD', 'CAD', 'CHF'];
export const receiptLifetimeMs = 30 * 60 * 1000;
export const receiptCookie = (config) => ({httpOnly: true, secure: config.nodeEnv === 'production', sameSite: 'lax', path: '/', maxAge: receiptLifetimeMs});
export const todayInNepal = () => new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Kathmandu', year:'numeric', month:'2-digit', day:'2-digit'}).format(new Date());
export const donationText = {
  en: {
    title:'Donate', eyebrow:'Support our work', details:'Donation details', qr:'Scan to donate', scan:'Scan this QR code with your banking application.',
    bank:'Bank transfer', bank_name:'Bank name', account_name:'Account name', account_number:'Account number', branch:'Branch', swift_code:'SWIFT code',
    instructions:'Additional instructions', empty:'Donation details have not been added yet. Please contact the organization for information.',
    receipt:'Submit your donation receipt', explanation:'Already donated through the QR code or bank transfer? Send your receipt below so our team can review it. No payment is taken on this website.',
    full_name:'Full name', email:'Email address', phone:'Phone number (optional)', donation_date:'Donation date (AD)', donation_amount:'Donation amount', currency:'Currency',
    transaction_reference:'Transaction / reference number (optional)', message:'Message / notes (optional)', file:'Receipt image', upload:'PNG, JPG or WebP, up to 10 MB. Upload a clear image of your receipt.',
    privacy:'Your details and receipt are visible only to authorized administrators.', submit:'Submit receipt', success:'Thank you. Your donation receipt has been submitted successfully.',
    errors:'Please check the following:', invalid:'Enter a valid value within the field limit.', required:'Complete this required field.', fileError:'Choose a valid PNG, JPEG or WebP receipt, up to 10 MB and 16 megapixels.',
    expired:'This form has expired or could not be verified. Reload the page and try again.', unavailable:'Receipt submission is temporarily unavailable. Please try again later.',
    slow:'Please wait a moment before submitting this form.', limited:'Too many attempts. Please try again later.', support:'Need help?', copy:'Copy', copied:'Copied', copyFailed:'Please select and copy the value manually.',
    step1:'Read the donation details', step2:'Donate using your banking app', step3:'Submit your receipt', back:'Back to home', currencyHint:'Choose the currency shown on your receipt. Amounts are not converted.',
  },
  ne: {
    title:'सहयोग', eyebrow:'हाम्रो कार्यमा सहयोग गर्नुहोस्', details:'सहयोग विवरण', qr:'सहयोगका लागि स्क्यान गर्नुहोस्', scan:'आफ्नो बैंकिङ एपबाट यो QR कोड स्क्यान गर्नुहोस्।',
    bank:'बैंकमार्फत सहयोग', bank_name:'बैंकको नाम', account_name:'खातावालाको नाम', account_number:'खाता नम्बर', branch:'शाखा', swift_code:'SWIFT कोड',
    instructions:'थप निर्देशन', empty:'सहयोग सम्बन्धी विवरण अझै थपिएको छैन। जानकारीका लागि संस्थामा सम्पर्क गर्नुहोस्।',
    receipt:'सहयोगको रसिद पठाउनुहोस्', explanation:'QR वा बैंकमार्फत सहयोग गरिसक्नुभयो? हाम्रो टोलीले हेर्न सक्ने गरी तल रसिद पठाउनुहोस्। यस वेबसाइटबाट भुक्तानी लिइँदैन।',
    full_name:'पूरा नाम', email:'इमेल ठेगाना', phone:'फोन नम्बर (वैकल्पिक)', donation_date:'सहयोग गरेको मिति (ईस्वी)', donation_amount:'सहयोग रकम', currency:'मुद्रा',
    transaction_reference:'कारोबार / सन्दर्भ नम्बर (वैकल्पिक)', message:'सन्देश / टिप्पणी (वैकल्पिक)', file:'रसिदको तस्बिर', upload:'PNG, JPG वा WebP, बढीमा २ MB। रसिदको स्पष्ट तस्बिर पठाउनुहोस्।',
    privacy:'तपाईंको विवरण र रसिद आधिकारिक प्रशासकहरूले मात्र हेर्न सक्छन्।', submit:'रसिद पठाउनुहोस्', success:'धन्यवाद। तपाईंको सहयोगको रसिद सफलतापूर्वक पठाइएको छ।',
    errors:'कृपया निम्न विवरण जाँच गर्नुहोस्:', invalid:'तोकिएको सीमाभित्र सही विवरण लेख्नुहोस्।', required:'यो आवश्यक विवरण भर्नुहोस्।', fileError:'बढीमा २ MB र १६ मेगापिक्सेलको सही PNG, JPEG वा WebP रसिद छान्नुहोस्।',
    expired:'यो फारमको समय सकिएको छ वा पुष्टि हुन सकेन। पृष्ठ फेरि खोलेर प्रयास गर्नुहोस्।', unavailable:'अहिले रसिद पठाउन सकिँदैन। कृपया पछि प्रयास गर्नुहोस्।',
    slow:'फारम पठाउनुअघि केही क्षण पर्खनुहोस्।', limited:'धेरै पटक प्रयास भयो। कृपया पछि प्रयास गर्नुहोस्।', support:'सहयोग चाहिन्छ?', copy:'प्रतिलिपि', copied:'प्रतिलिपि भयो', copyFailed:'कृपया विवरण छानेर आफैँ प्रतिलिपि गर्नुहोस्।',
    step1:'सहयोग विवरण पढ्नुहोस्', step2:'बैंकिङ एपबाट सहयोग गर्नुहोस्', step3:'रसिद पठाउनुहोस्', back:'गृहपृष्ठमा फर्कनुहोस्', currencyHint:'रसिदमा भएको मुद्रा छान्नुहोस्। रकम रूपान्तरण गरिँदैन।',
  },
};

export function validateReceipt(body = {}, today = todayInNepal()) {
  const values = {}, errors = [];
  const limits = {full_name:100,email:254,phone:64,donation_date:10,donation_amount:12,currency:3,transaction_reference:150,message:2000};
  for (const [key,max] of Object.entries(limits)) {
    const raw = body[key];
    values[key] = typeof raw === 'string' ? raw.trim().slice(0,max) : '';
    if ((raw !== undefined && typeof raw !== 'string') || (typeof raw === 'string' && (raw.length > max || /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(raw)))) errors.push(key);
  }
  for (const key of ['full_name','email','donation_date','donation_amount','currency']) if (!values[key]) errors.push(key);
  if (!normalizeEmail(values.email)) errors.push('email');
  if (values.phone && !/^[+\d ()\-.]{3,64}$/.test(values.phone)) errors.push('phone');
  if (!currencies.includes(values.currency)) errors.push('currency');
  if (!/^(?:0|[1-9]\d{0,8})(?:\.\d{1,2})?$/.test(values.donation_amount) || Number(values.donation_amount) <= 0) errors.push('donation_amount');
  const date = new Date(values.donation_date+'T00:00:00.000Z');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(values.donation_date) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0,10) !== values.donation_date || values.donation_date < '1900-01-01' || values.donation_date > today) errors.push('donation_date');
  return {values, errors:[...new Set(errors)], data: errors.length ? null : {...values, email:normalizeEmail(values.email), donation_date:date, phone:values.phone||null, transaction_reference:values.transaction_reference||null,message:values.message||null}};
}

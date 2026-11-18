import { normalizeEmail } from '../services/authentication.js';

export const contactLifetimeMs = 30 * 60 * 1000;
export const contactFields = [
  {key:'name', type:'text', max:100, required:true, autocomplete:'name'},
  {key:'email', type:'email', max:254, required:true, autocomplete:'email'},
  {key:'phone', type:'tel', max:64, required:false, autocomplete:'tel'},
  {key:'subject', type:'text', max:200, required:true, autocomplete:'off'},
  {key:'message', type:'textarea', max:5000, required:true, autocomplete:'off'},
];
export const contactText = {
  en: {
    title:'Contact Us', intro:'Get in touch or share your feedback with our organization.', details:'Contact information',
    primary_email:'Primary email', secondary_email:'Secondary email', phone:'Phone number (optional)', contactPhone:'Phone', whatsapp:'WhatsApp', address:'Address', map:'Open Google Maps',
    empty:'Contact information has not been added yet. You can use the form below.', feedback:'Feedback', share:'Share Your Feedback',
    form:'Contact / Feedback', explanation:'Send us a message using this form.', privacy:'Your message is visible only to authorized administrators.',
    name:'Name', email:'Email address', subject:'Subject', message:'Message', submit:'Send message',
    required:'Complete this required field.', invalid:'Enter a valid value within the field limit.', errors:'Please check the highlighted fields.',
    success:'Thank you. Your message has been submitted successfully.', expired:'This form has expired or could not be verified. Reload the page and try again.',
    unavailable:'Message submission is temporarily unavailable. Please try again later.', slow:'Please wait a moment and leave the hidden field empty before submitting.',
    limited:'Too many attempts. Please try again later.', retry:'Reload form', bodyError:'The form could not be processed. Use one value per field within the stated limits.',
  },
  ne: {
    title:'सम्पर्क गर्नुहोस्', intro:'हाम्रो संस्थासँग सम्पर्क गर्नुहोस् वा आफ्नो प्रतिक्रिया दिनुहोस्।', details:'सम्पर्क विवरण',
    primary_email:'मुख्य इमेल', secondary_email:'अर्को इमेल', phone:'फोन नम्बर (वैकल्पिक)', contactPhone:'फोन', whatsapp:'व्हाट्सएप', address:'ठेगाना', map:'गुगल नक्सा खोल्नुहोस्',
    empty:'सम्पर्क विवरण अझै थपिएको छैन। तलको फारम प्रयोग गर्न सक्नुहुन्छ।', feedback:'प्रतिक्रिया', share:'आफ्नो प्रतिक्रिया दिनुहोस्',
    form:'सम्पर्क / प्रतिक्रिया', explanation:'यो फारमबाट हामीलाई सन्देश पठाउनुहोस्।', privacy:'तपाईंको सन्देश आधिकारिक प्रशासकहरूले मात्र हेर्न सक्छन्।',
    name:'नाम', email:'इमेल ठेगाना', subject:'विषय', message:'सन्देश', submit:'सन्देश पठाउनुहोस्',
    required:'यो आवश्यक विवरण भर्नुहोस्।', invalid:'तोकिएको सीमाभित्र सही विवरण लेख्नुहोस्।', errors:'कृपया चिन्ह लगाइएका विवरण जाँच गर्नुहोस्।',
    success:'धन्यवाद। तपाईंको सन्देश सफलतापूर्वक पठाइएको छ।', expired:'यो फारमको समय सकिएको छ वा पुष्टि हुन सकेन। पृष्ठ फेरि खोलेर प्रयास गर्नुहोस्।',
    unavailable:'अहिले सन्देश पठाउन सकिँदैन। कृपया पछि प्रयास गर्नुहोस्।', slow:'केही क्षण पर्खनुहोस् र लुकाइएको विवरण खाली राखेर पठाउनुहोस्।',
    limited:'धेरै पटक प्रयास भयो। कृपया पछि प्रयास गर्नुहोस्।', retry:'फारम फेरि खोल्नुहोस्', bodyError:'फारम प्रशोधन हुन सकेन। प्रत्येक विवरणमा तोकिएको सीमाभित्र एउटा मात्र मान लेख्नुहोस्।',
  },
};

export function validateContact(body = {}) {
  const values = {}, errors = {};
  for (const field of contactFields) {
    const raw = body[field.key];
    values[field.key] = typeof raw === 'string' ? raw : '';
    if (raw !== undefined && typeof raw !== 'string') errors[field.key] = 'invalid';
    else if (field.required && !values[field.key].trim()) errors[field.key] = 'required';
    else if ([...values[field.key]].length > field.max || /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(values[field.key]) ||
      (field.type !== 'textarea' && /[\r\n\t]/.test(values[field.key]))) errors[field.key] = 'invalid';
  }
  if (values.email && !normalizeEmail(values.email)) errors.email = 'invalid';
  if (values.phone.trim() && (!/^[+\d ()\-.]+$/.test(values.phone) || (values.phone.match(/\d/g) || []).length < 5)) errors.phone = 'invalid';
  return {values, errors, data:Object.keys(errors).length ? null : {...values, phone:values.phone.trim() ? values.phone : null}};
}

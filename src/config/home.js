export const homeLabels = {
  en: {welcome:'Welcome',about:'Get to know us',aboutLink:'About our organization',services:'Explore core activities',ourWork:'Our Work',ourWorkIntro:'A selection of our work and initiatives.',viewAllWork:'View All Our Work',coreActivities:'Core Activities',coreActivitiesIntro:'Explore the areas where we work and the activities within each category.',activityCount:'published activities',viewCategory:'View Category',exploreAllActivities:'Explore All Core Activities',impact:'Our community in numbers',news:'Latest news',newsIntro:'Updates from our organization.',allNews:'All news',read:'Read story',gallery:'A closer look',galleryIntro:'Explore moments from our gallery.',allGallery:'Full gallery',album:'View album',testimonials:'Voices from our community',allTestimonials:'All testimonials',feedback:'Your voice matters',feedbackIntro:'Have a question, an idea or feedback? We would like to hear from you.',donate:'Support our work',donateIntro:'Visit our donation page to learn how you can contribute.',donateLink:'Ways to donate',empty:'Information will be available here soon.'},
  ne: {welcome:'स्वागत छ',about:'हामीलाई चिन्नुहोस्',aboutLink:'हाम्रो संस्थाको बारेमा',services:'मुख्य गतिविधिहरू हेर्नुहोस्',ourWork:'हाम्रो काम',ourWorkIntro:'हाम्रा काम र पहलहरूको एक झलक।',viewAllWork:'हाम्रा सबै कामहरू हेर्नुहोस्',coreActivities:'मुख्य गतिविधिहरू',coreActivitiesIntro:'हामीले काम गर्ने क्षेत्र र तिनअन्तर्गतका गतिविधिहरू हेर्नुहोस्।',activityCount:'प्रकाशित गतिविधिहरू',viewCategory:'वर्ग हेर्नुहोस्',exploreAllActivities:'सबै मुख्य गतिविधिहरू हेर्नुहोस्',impact:'हाम्रो समुदायका तथ्याङ्क',news:'पछिल्ला समाचार',newsIntro:'हाम्रो संस्थाका नयाँ जानकारी।',allNews:'सबै समाचार',read:'समाचार पढ्नुहोस्',gallery:'हाम्रा केही झलकहरू',galleryIntro:'हाम्रो तस्बिर सङ्ग्रहका क्षणहरू हेर्नुहोस्।',allGallery:'पूरा तस्बिर सङ्ग्रह',album:'एल्बम हेर्नुहोस्',testimonials:'हाम्रो समुदायका अनुभवहरू',allTestimonials:'सबै अनुभवहरू',feedback:'तपाईंको विचार महत्त्वपूर्ण छ',feedbackIntro:'प्रश्न, सुझाव वा प्रतिक्रिया छ? हामी तपाईंको कुरा सुन्न चाहन्छौँ।',donate:'हाम्रो कार्यमा सहयोग गर्नुहोस्',donateIntro:'सहयोग गर्ने तरिका जान्न हाम्रो सहयोग पृष्ठमा जानुहोस्।',donateLink:'सहयोग गर्ने तरिका',empty:'थप जानकारी यहाँ चाँडै उपलब्ध हुनेछ।'},
};

// Bound excerpts by Unicode code points without clipping Devanagari clusters.
export function homeExcerpt(value='',limit=300,locale='en') {
  const text=value.trim();
  if([...text].length<=limit) return text;
  const segments=new Intl.Segmenter(locale,{granularity:'word'}).segment(text);
  let result='';
  for(const {segment} of segments) {
    if([...result,...segment].length>limit) break;
    result+=segment;
  }
  if(!result.trim()) {
    for(const {segment} of new Intl.Segmenter(locale,{granularity:'grapheme'}).segment(text)) {
      if([...result,...segment].length>limit) break;
      result+=segment;
    }
  }
  return result.trimEnd()+'…';
}

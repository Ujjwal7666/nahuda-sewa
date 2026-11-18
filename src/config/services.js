const pairs = entries => entries.flatMap(([key,label,max,optional=true,group='Detailed content']) => ['en','ne'].map(lang=>({key:`${key}_${lang}`,label:`${label} ${lang.toUpperCase()}`,lang,max,optional,multiline:max>500,group})));
export const serviceModules = {
  services:{model:'service',label:'Core Activities',path:'/admin/services',publicPath:'/services',service:true,visibility:true,ordered:true,asset:'featured_image',fields:[...pairs([['name','Activity title',200,false,'Basic information'],['short_description','Short description',1000,true,'Basic information'],['full_description','Full description',200000],['who_is_it_for','Who is it for?',10000,true,'Additional information'],['availability','Availability',10000,true,'Additional information'],['location','Location',1000,true,'Additional information']]),{key:'icon',label:'Icon (plain symbol or text, no HTML)',max:40,optional:true,group:'Media'}]},
  serviceCategories:{model:'serviceCategory',label:'Activity categories',path:'/admin/service-categories',publicPath:'/services',slug:true,visibility:true,ordered:true,fields:pairs([['name','Category name',200,false,'Basic information'],['description','Description',1000]])},
  serviceFeature:{model:'serviceFeature',label:'Activity features',parent:'services',parentKey:'service_id',childPath:'features',ordered:true,fields:pairs([['title','Feature title',200,false,'What we provide'],['description','Feature description',10000]])},
  serviceImage:{model:'serviceImage',label:'Activity images',parent:'services',parentKey:'service_id',childPath:'images',asset:'image',requiredImage:true,ordered:true,fields:pairs([['caption','Caption',1000],['alt_text','Image description (falls back to activity title)',500]])},
};
export const serviceLabels = {
  en:{overview:'At a glance',heading:'Core Activities',empty:'Activity information will be available here soon.',read:'Learn more',back:'All Core Activities',about:'About the Activity',features:'What We Provide',who_is_it_for:'Who Is It For?',availability:'Availability',location:'Location',gallery:'Activity Gallery',contact:'Need More Information?',contactBody:'Contact us about this activity.',contactLink:'Contact Us'},
  ne:{overview:'एक नजरमा',heading:'मुख्य गतिविधिहरू',empty:'गतिविधिबारे जानकारी यहाँ चाँडै उपलब्ध हुनेछ।',read:'थप जान्नुहोस्',back:'सबै मुख्य गतिविधिहरू',about:'गतिविधिको बारेमा',features:'हामी के प्रदान गर्छौं',who_is_it_for:'यो कसका लागि हो?',availability:'उपलब्धता',location:'स्थान',gallery:'गतिविधिका तस्बिरहरू',contact:'थप जानकारी चाहिन्छ?',contactBody:'यस गतिविधिबारे हामीलाई सम्पर्क गर्नुहोस्।',contactLink:'सम्पर्क गर्नुहोस्'},
};
Object.assign(serviceLabels.en,{other:'More Activities',browse:'Activity categories',explore:'Explore activities',category:'Activity category',homeIntro:'Explore our core activities by category.',backCategory:'Back to category',featured:'Featured activities'});
Object.assign(serviceLabels.ne,{other:'अन्य गतिविधिहरू',browse:'गतिविधिका वर्गहरू',explore:'गतिविधिहरू हेर्नुहोस्',category:'गतिविधिको वर्ग',homeIntro:'वर्गअनुसार हाम्रा मुख्य गतिविधिहरू हेर्नुहोस्।',backCategory:'वर्गमा फर्कनुहोस्',featured:'विशेष गतिविधिहरू'});

for(const field of serviceModules.services.fields) if(field.key.startsWith('full_description_')) { field.richText=true; field.preserveWhitespace=true; field.maxBytes=800000; }

serviceLabels.en.related='Related Core Activities';
serviceLabels.ne.related='सम्बन्धित मुख्य गतिविधिहरू';

serviceLabels.en.breadcrumb='Breadcrumb';
serviceLabels.ne.breadcrumb='पृष्ठ मार्ग';

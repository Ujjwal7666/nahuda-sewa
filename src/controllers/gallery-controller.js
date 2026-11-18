import {positiveId,dateInput} from '../config/media-content.js';
import {contentText} from '../config/fixed-content.js';
import {assetUrl} from '../services/organization-settings.js';
import {notFound} from '../middleware/errors.js';

export function galleryController(content,detail=false) {
  return async(req,res)=> {
    const id=detail?positiveId(req.params.albumId):null;
    const album=detail && id && content?await content.activeAlbum(id):null;
    if(detail && !album) return notFound(req,res);
    const albums=!detail && content?await content.galleryOverview():[];
    const ne=res.locals.locale==='ne';
    const labels=ne?{back:'तस्बिर सङ्ग्रहमा फर्कनुहोस्',view:'एल्बम हेर्नुहोस्',photos:'तस्बिरहरू',photo:'तस्बिर',empty:'थप जानकारी यहाँ चाँडै उपलब्ध हुनेछ।',noImages:'यस एल्बममा तस्बिरहरू चाँडै उपलब्ध हुनेछन्।',unavailable:'तस्बिर उपलब्ध छैन',close:'बन्द गर्नुहोस्',previous:'अघिल्लो तस्बिर',next:'अर्को तस्बिर',open:'तस्बिर हेर्नुहोस्',thumbnails:'तस्बिर छनोट',loading:'तस्बिर लोड हुँदैछ'}:{back:'Back to Gallery',view:'View Album',photos:'photos',photo:'photo',empty:'Information will be available here soon.',noImages:'Images will be available in this album soon.',unavailable:'Image unavailable',close:'Close',previous:'Previous photo',next:'Next photo',open:'View photo',thumbnails:'Choose a photo',loading:'Loading image'};
    const heading=album?contentText(album,'title',res.locals.locale):res.locals.t.gallery;
    const formatDate=value=>value?new Intl.DateTimeFormat(ne?'ne-NP':'en-GB',{dateStyle:'long',timeZone:'UTC'}).format(value):'';
    res.render('public/gallery',{title:heading+' | '+res.locals.organization.name,heading,album,albums,labels,contentText,assetUrl,dateInput,formatDate});
  };
}

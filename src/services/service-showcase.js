import {serviceModules} from '../config/services.js';

const byOrder=(a,b)=>a.display_order-b.display_order || a.id-b.id;
export function groupServices(rows,categories,featuredOnly=false) {
  const groups=categories.filter(category=>category.is_active).slice().sort(byOrder).map(category=>({category,services:[],anchor:'category-'+category.slug,path:'/services/category/'+category.slug}));
  const byCategory=new Map(groups.map(group=>[group.category.id,group]));
  const other={category:null,services:[],anchor:'other-services',path:'/services#other-services'};
  for(const service of rows) {
    if(!service.is_active || (featuredOnly && !service.is_featured)) continue;
    (byCategory.get(service.category_id)||other).services.push(service);
  }
  return [...groups,other].filter(group=>group.services.length || (!featuredOnly && group.category)).map(group=> {
    group.services.sort(byOrder);
    group.coverService=group.services.find(service=>service.featured_image)||null;
    return group;
  });
}
export async function serviceShowcase(content,featuredOnly=false) {
  if(!content) return [];
  const [rows,categories]=await Promise.all([featuredOnly?content.featuredServices():content.activeServices(),content.list(serviceModules.serviceCategories,true)]);
  return groupServices(rows,categories,featuredOnly);
}

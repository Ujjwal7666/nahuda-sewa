import {mkdir, open, unlink} from 'node:fs/promises';
import {resolve, join} from 'node:path';
import {uploadRoot} from './organization-settings.js';
import {AssetError, decodeAsset, safeKey} from './image-assets.js';
import {removeUnreferencedMedia} from './media-references.js';
export {AssetError as ContentError} from './image-assets.js';
const orderBy = [{display_order:'asc'}, {id:'asc'}];
const includeFor = (module,publicOnly=false) => module.model === 'committeeBranch' ? {_count:{select:{members:true}}} : module.photo ? {photo:true,...(module.model === 'committeeMember'?{branch:true}:{})} : module.image ? {media:true} : module.model === 'aboutOrganization' ? {hero_image:true,images:{include:{media:true},orderBy},statistics:{where:publicOnly?{is_active:true}:undefined,orderBy}} : undefined;
export function fixedContentService(db, directory = uploadRoot) {
  const root = resolve(directory);
  async function removeFile(key) {
    if (!safeKey(key)) return;
    try {await unlink(join(root,key));} catch(error) {if(error.code !== 'ENOENT') console.error('Content asset cleanup failed; inspect upload storage.');}
  }
  const read = (module,id=1,publicOnly=false) => db[module.model].findUnique({where:{id},include:includeFor(module,publicOnly)});
  async function mutate(module,id,values,body,file,deleting=false) {
    if(file && !module.photo && !module.image && !module.hero) throw new AssetError('Images are not accepted on this form.');
    if (file && body.clear_photo === '1') throw new AssetError('Choose either image replacement or removal.');
    const prepared = file ? await decodeAsset(file,{key:'content',label:'Image'}) : null;
    let written, obsolete, result;
    try {
      if(prepared) {
        await mkdir(root,{recursive:true});
        const handle = await open(join(root,prepared.metadata.storage_key),'wx');
        written = prepared.metadata.storage_key;
        try {await handle.writeFile(prepared.data);} finally {await handle.close();}
      }
      result = await db.$transaction(async tx => {
        const previous = id ? await tx[module.model].findUnique({where:{id},include:includeFor(module)}) : null;
        if (id && !previous && !module.singleton) throw new AssetError('Record not found.',404);
        if ((previous?.revision || 0) !== Number(body.revision)) throw new AssetError('Content changed in another tab. Reload before trying again.',409);
        const data = {...values};
        if(module.model === 'committeeMember' && !deleting && (!values.branch_id || !await tx.committeeBranch.findUnique({where:{id:values.branch_id}}))) throw new AssetError('Choose an existing committee branch.');
        if(module.model === 'committeeBranch' && deleting && previous._count.members) throw new AssetError('Move or delete all members before deleting this branch. No members have been removed.',409);
        if(module.image && !previous && !prepared) throw new AssetError('Choose an image.');
        if((module.image || module.statistic) && !await tx.aboutOrganization.findUnique({where:{id:1}})) throw new AssetError('Save About Organization before adding images or statistics.');
        const mediaField = module.photo ? 'photo_id' : module.image ? 'media_id' : module.hero ? 'hero_image_id' : null;
        if(mediaField && (prepared || body.clear_photo === '1' || deleting)) {
          obsolete = previous?.[module.photo ? 'photo' : module.hero ? 'hero_image' : 'media'];
          if(!deleting) data[mediaField] = prepared ? (await tx.mediaAsset.create({data:prepared.metadata})).id : null;
        }
        if(module.image || module.statistic) data.about_id = 1;
        let row;
        if(previous) {
          const changed = deleting ? await tx[module.model].deleteMany({where:{id,revision:previous.revision}}) : await tx[module.model].updateMany({where:{id,revision:previous.revision},data:{...data,revision:{increment:1}}});
          if(changed.count !== 1) throw new AssetError('Content changed in another tab. Reload before trying again.',409);
          row = {id};
        } else row = await tx[module.model].create({data:{...data,...(module.singleton?{id:1}:{})}});
        if(obsolete) await removeUnreferencedMedia(tx,obsolete);
        return row;
      });
    } catch(error) {
      if(written) await removeFile(written);
      if(error.code==='P2003' && ['committeeBranch','committeeMember'].includes(module.model)) throw new AssetError('The branch is in use or no longer available. Reload and move members before deleting a branch.',409);
      if(error.code==='P2002' && module.statistic) throw new AssetError('That statistic category already exists. Edit the existing statistic instead.',409);
      if(['P2002','P2034'].includes(error.code)) throw new AssetError('Content changed in another tab. Reload before trying again.',409);
      throw error;
    }
    // Cleanup after commit must never roll back a file already referenced by saved content.
    if(obsolete && !await db.mediaAsset.findUnique({where:{id:obsolete.id}})) await removeFile(obsolete.storage_key);
    return result;
  }
  return {read,
    committeeBranches:()=>db.committeeBranch.findMany({where:{is_active:true},orderBy,include:{members:{where:{is_active:true},orderBy,include:{photo:true}}}}),
    homeAbout:()=>db.aboutOrganization.findUnique({where:{id:1},include:{images:{take:1,include:{media:true},orderBy},statistics:{where:{is_active:true},orderBy}}}),
    list:(module,active=false,branchId)=>db[module.model].findMany({where:{...(active?{is_active:true}:{}),...(module.model==='committeeMember' && branchId!==undefined?{branch_id:branchId}:{})},include:includeFor(module),orderBy}),
    save:(module,id,values,body,file)=>mutate(module,id,values,body,file),
    delete:(module,id,body)=>mutate(module,id,{},body,null,true),
  };
}

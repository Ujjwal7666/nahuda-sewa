import { mkdir, open, unlink } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { receiptRoot } from '../config/storage.js';
import { createHash } from 'node:crypto';
import { decodeAsset, safeKey } from './image-assets.js';
import { consumeRateLimit } from './rate-limit.js';

export { receiptRoot };

export function donationReceiptService(db, config, directory = receiptRoot) {
  const root = resolve(directory);
  return {
    root,
    limit: (kind,value) => consumeRateLimit(db,config.sessionSecret,'receipt',[[`${kind}:${value}`,kind==='ip'?config.receiptIpMax:config.receiptEmailMax]],config.receiptWindowMs),
    async save(data,file,token) {
      const submission_key = createHash('sha256').update(token).digest('hex');
      if (await db.donationReceiptSubmission.findUnique({where:{submission_key}})) return;
      const asset = await decodeAsset(file,{key:'receipt',label:'Receipt'});
      await mkdir(root,{recursive:true});
      const key = asset.metadata.storage_key;
      let written = false;
      try {
        const handle = await open(join(root,key),'wx'); written = true;
        try { await handle.writeFile(asset.data); } finally { await handle.close(); }
        const {storage_key,...metadata} = asset.metadata;
        await db.donationReceiptSubmission.create({data:{...data,...metadata,receipt_key:storage_key,submission_key}});
      } catch (error) {
        if (written) await unlink(join(root,key)).catch(() => console.error('Private receipt cleanup failed; inspect receipt storage.'));
        if (error.code==='P2002' && await db.donationReceiptSubmission.findUnique({where:{submission_key}})) return;
        throw error;
      }
    },
    async list(page,status) {
      const where = status ? {status} : {};
      const [rows,count] = await Promise.all([
        db.donationReceiptSubmission.findMany({where,orderBy:[{created_at:'desc'},{id:'desc'}],skip:(page-1)*20,take:20,select:{id:true,full_name:true,email:true,donation_date:true,donation_amount:true,currency:true,status:true,created_at:true}}),
        db.donationReceiptSubmission.count({where}),
      ]);
      return {rows,count};
    },
    find: (id) => db.donationReceiptSubmission.findUnique({where:{id}}),
    async status(id,status) { return (await db.donationReceiptSubmission.updateMany({where:{id},data:{status}})).count; },
    safeKey,
  };
}

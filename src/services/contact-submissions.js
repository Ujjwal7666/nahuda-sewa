import { createHash } from 'node:crypto';
import { consumeRateLimit } from './rate-limit.js';
import { normalizeEmail } from './authentication.js';

export function contactSubmissionService(db, config) {
  return {
    limit:(kind,value) => consumeRateLimit(db,config.sessionSecret,'contact',[[`${kind}:${kind==='email'?normalizeEmail(value):value}`,kind==='ip'?config.contactIpMax:config.contactEmailMax]],config.contactWindowMs),
    async save(data, token) {
      const submission_key = createHash('sha256').update(token).digest('hex');
      try { await db.contactSubmission.create({data:{...data,submission_key}}); }
      catch (error) {
        if (error.code==='P2002' && await db.contactSubmission.findUnique({where:{submission_key}})) return;
        throw error;
      }
    },
    async list(page,status) {
      const where = status ? {status} : {};
      const [rows,count] = await Promise.all([
        db.contactSubmission.findMany({where,orderBy:[{submitted_at:'desc'},{id:'desc'}],skip:(page-1)*20,take:20,
          select:{id:true,name:true,email:true,phone:true,subject:true,submitted_at:true,status:true}}),
        db.contactSubmission.count({where}),
      ]);
      return {rows,count};
    },
    find:(id) => db.contactSubmission.findUnique({where:{id}}),
    async markRead(id) { return (await db.contactSubmission.updateMany({where:{id},data:{status:'READ'}})).count; },
  };
}

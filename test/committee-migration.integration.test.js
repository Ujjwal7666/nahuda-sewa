import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createDatabase} from '../src/services/database.js';

// Run before migrate deploy, exclusively on the runner's new empty disposable DB.
test('Committee additive migration preserves every legacy value and photo reference', {skip:!process.env.COMMITTEE_MIGRATION_DATABASE_URL}, async()=> {
  const url=new URL(process.env.COMMITTEE_MIGRATION_DATABASE_URL);
  assert.match(url.pathname,/^\/nahuda_auth_test_[a-f0-9]{16}$/);
  const db=createDatabase(url.href);
  let emptyDatabaseVerified=false;
  try {
    const tables=await db.$queryRaw`SHOW TABLES`;
    assert.equal(tables.length,0,'Migration rehearsal requires a newly created empty database');
    emptyDatabaseVerified=true;
    const mediaSql=await readFile(new URL('../prisma/migrations/202609300002_organization_settings/migration.sql',import.meta.url),'utf8');
    const memberSql=await readFile(new URL('../prisma/migrations/202610010002_phase_4_content/migration.sql',import.meta.url),'utf8');
    for(const [sql,table] of [[mediaSql,'media_assets'],[memberSql,'committee_members']]) {
      const statement=sql.match(new RegExp('CREATE TABLE `'+table+'` \\([\\s\\S]*?;'))?.[0];
      assert.ok(statement);await db.$executeRawUnsafe(statement);
    }
    const photo=await db.mediaAsset.create({data:{storage_key:'legacy-fixture.png',mime_type:'image/png',size_bytes:100,width:10,height:20}});
    await db.$executeRaw`INSERT INTO committee_members (revision,name_en,name_ne,position_en,position_ne,committee_role_en,committee_role_ne,introduction_en,introduction_ne,photo_id,display_order,is_active,updated_at) VALUES (7,'Legacy fixture','पुरानो सदस्य','Position','पद','Role','भूमिका','Introduction','परिचय',${photo.id},42,true,'2026-10-01 00:00:00')`;
    const [before]=await db.$queryRaw`SELECT * FROM committee_members`;
    const migration=await readFile(new URL('../prisma/migrations/202610270001_committee_branches/migration.sql',import.meta.url),'utf8');
    for(const statement of migration.split(';').map(s=>s.trim()).filter(Boolean)) await db.$executeRawUnsafe(statement);
    const [after]=await db.$queryRaw`SELECT * FROM committee_members`;
    const {branch_id,...preserved}=after;
    assert.equal(branch_id,null);assert.deepEqual(preserved,before);
    assert.equal(await db.committeeBranch.count(),0);
    assert.deepEqual(await db.mediaAsset.findUnique({where:{id:photo.id}}),photo);
  } finally {
    // Only this runner-created DB is touched; normal migration deploy follows.
    if(emptyDatabaseVerified) {
      await db.$executeRawUnsafe('DROP TABLE IF EXISTS committee_members');
      await db.$executeRawUnsafe('DROP TABLE IF EXISTS committee_branches');
      await db.$executeRawUnsafe('DROP TABLE IF EXISTS media_assets');
    }
    await db.$disconnect();
  }
});

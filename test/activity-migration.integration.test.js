import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createDatabase} from '../src/services/database.js';

test('Activity migration preserves all legacy columns, media and category assignments',{skip:!process.env.ACTIVITY_MIGRATION_DATABASE_URL},async()=> {
  const url=new URL(process.env.ACTIVITY_MIGRATION_DATABASE_URL);
  assert.match(url.pathname,/^\/nahuda_auth_test_[a-f0-9]{16}$/);
  const db=createDatabase(url.href);let verified=false;
  try {
    assert.equal((await db.$queryRaw`SHOW TABLES`).length,0);verified=true;
    const media=await readFile(new URL('../prisma/migrations/202609300002_organization_settings/migration.sql',import.meta.url),'utf8');
    await db.$executeRawUnsafe(media.match(/CREATE TABLE `media_assets` \([\s\S]*?;/)[0]);
    const legacy=await readFile(new URL('../prisma/migrations/202610020003_dynamic_services/migration.sql',import.meta.url),'utf8');
    for(const sql of legacy.split(';').map(s=>s.trim()).filter(Boolean)) await db.$executeRawUnsafe(sql);
    await db.$executeRaw`INSERT INTO media_assets (storage_key,mime_type,size_bytes,width,height) VALUES ('legacy-activity.png','image/png',100,800,600)`;
    await db.$executeRaw`INSERT INTO service_categories (name_en,name_ne,slug,description_en,description_ne,updated_at) VALUES ('Group','समूह','group','','',NOW())`;
    await db.$executeRaw`INSERT INTO services (revision,name_en,name_ne,slug,short_description_en,short_description_ne,full_description_en,full_description_ne,who_is_it_for_en,who_is_it_for_ne,availability_en,availability_ne,location_en,location_ne,featured_image_id,category_id,display_order,is_active,updated_at) VALUES (9,'Activity','गतिविधि','activity','Short','परिचय','  Literal <h2>text</h2>\nsecond line  ','नेपाली विवरण','','','','','','',1,1,7,true,'2026-10-01 00:00:00')`;
    const [before]=await db.$queryRaw`SELECT * FROM services`;
    const migration=await readFile(new URL('../prisma/migrations/202611020001_activity_detail/migration.sql',import.meta.url),'utf8');
    await db.$executeRawUnsafe(migration);
    const [after]=await db.$queryRaw`SELECT * FROM services`;
    const {description_format,image_position,...preserved}=after;
    assert.equal(description_format,'PLAIN');assert.equal(image_position,'DEFAULT');assert.deepEqual(preserved,before);
    assert.equal((await db.$queryRaw`SELECT COUNT(*) AS n FROM media_assets`)[0].n,1n);
    await assert.rejects(db.$executeRaw`UPDATE services SET image_position='BAD'`);
  } finally {
    if(verified) for(const table of ['service_images','service_features','services','service_categories','media_assets']) await db.$executeRawUnsafe(`DROP TABLE IF EXISTS \`${table}\``);
    await db.$disconnect();
  }
});

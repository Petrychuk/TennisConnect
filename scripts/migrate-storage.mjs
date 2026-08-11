import { createClient } from '@supabase/supabase-js';

const OLD_URL = 'https://mikkwluwghuqjgwkdqmf.supabase.co';
const OLD_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pa2t3bHV3Z2h1cWpnd2tkcW1mIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjM3OTgxMiwiZXhwIjoyMDgxOTU1ODEyfQ.YDwYTK5EIwZSqu7lcvsPWpSAummEDnE0bEyQZhDTUiA';

const NEW_URL = 'https://rjjkoeiywuxdepiyhuak.supabase.co';
const NEW_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJqamtvZWl5d3V4ZGVwaXlodWFrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NjM1MjA4MywiZXhwIjoyMTAxOTI4MDgzfQ.vBzJW40GGa5fZQfCT9aHvoJkVFWy-aOi38yQN6hHbfs';

const BUCKET = 'media';

const oldSupabase = createClient(OLD_URL, OLD_SERVICE_KEY);
const newSupabase = createClient(NEW_URL, NEW_SERVICE_KEY);

let copied = 0;
let failed = 0;

async function migrateFolder(path = '') {
  const { data, error } = await oldSupabase.storage
    .from(BUCKET)
    .list(path, {
      limit: 1000,
      offset: 0,
      sortBy: { column: 'name', order: 'asc' },
    });

  if (error) {
    console.error(`❌ Cannot list: ${path || '/'}`, error.message);
    return;
  }

  for (const item of data ?? []) {
    const fullPath = path ? `${path}/${item.name}` : item.name;

    // Supabase folders don't have an id.
    if (!item.id) {
      console.log(`📁 ${fullPath}`);
      await migrateFolder(fullPath);
      continue;
    }

    console.log(`Copying: ${fullPath}`);

    const { data: file, error: downloadError } =
      await oldSupabase.storage.from(BUCKET).download(fullPath);

    if (downloadError) {
      failed++;
      console.error(`❌ Download failed: ${fullPath}`, downloadError.message);
      continue;
    }

    const arrayBuffer = await file.arrayBuffer();

    const { error: uploadError } =
      await newSupabase.storage.from(BUCKET).upload(
        fullPath,
        arrayBuffer,
        {
          contentType: file.type || 'application/octet-stream',
          upsert: false,
        }
      );

    if (uploadError) {
      failed++;
      console.error(`❌ Upload failed: ${fullPath}`, uploadError.message);
      continue;
    }

    copied++;
    console.log(`✅ ${fullPath}`);
  }
}

console.log('🚀 Starting Storage migration India → Sydney');

await migrateFolder();

console.log('');
console.log('Migration finished');
console.log(`✅ Copied: ${copied}`);
console.log(`❌ Failed: ${failed}`);
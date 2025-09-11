import { runImport } from '../src/lib/import-csv';

(async () => {
  try {
    await runImport();
    console.log('Import finished successfully');
    process.exit(0);
  } catch (err) {
    console.error('Import failed:', err);
    process.exit(1);
  }
})();

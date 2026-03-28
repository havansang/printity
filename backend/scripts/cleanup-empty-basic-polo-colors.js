const fs = require('fs/promises');
const path = require('path');

const TARGET_DIR = path.resolve(__dirname, '../resources/mockups/basic-polo/colors');

function parseArguments(argv) {
  return {
    dryRun: argv.includes('--dry-run'),
  };
}

async function removeEmptyDirectories(directoryPath, options, isRoot = false) {
  const entries = await fs.readdir(directoryPath, { withFileTypes: true });

  let hasFile = false;

  for (const entry of entries) {
    const entryPath = path.join(directoryPath, entry.name);

    if (entry.isFile()) {
      hasFile = true;
      continue;
    }

    if (!entry.isDirectory()) {
      continue;
    }

    const childHasFile = await removeEmptyDirectories(entryPath, options, false);
    if (childHasFile) {
      hasFile = true;
    }
  }

  if (!hasFile && !isRoot) {
    const relativePath = path.relative(TARGET_DIR, directoryPath) || '.';

    if (options.dryRun) {
      console.log(`[dry-run] Would remove: ${relativePath}`);
    } else {
      await fs.rmdir(directoryPath);
      console.log(`Removed: ${relativePath}`);
    }
  }

  return hasFile;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));

  const targetStat = await fs.stat(TARGET_DIR).catch(() => null);
  if (!targetStat || !targetStat.isDirectory()) {
    throw new Error(`Target directory not found: ${TARGET_DIR}`);
  }

  await removeEmptyDirectories(TARGET_DIR, options, true);

  if (options.dryRun) {
    console.log('Dry run completed.');
    return;
  }

  console.log('Empty directories removed successfully.');
}

main().catch((error) => {
  console.error('Failed to clean up empty directories.', error);
  process.exit(1);
});

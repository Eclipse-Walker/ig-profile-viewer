import fs from 'fs';
import path from 'path';

try {
  // Read package.json version
  const packageJsonPath = path.join(process.cwd(), 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const version = packageJson.version;

  // Read manifest.json
  const manifestPath = path.join(process.cwd(), 'public', 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  // Update version in manifest
  manifest.version = version;

  // Write updated manifest
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  console.log(`✅ Updated manifest.json version to ${version}`);
} catch (error) {
  console.error('❌ Error updating manifest version:', error.message);
  process.exit(1);
} 
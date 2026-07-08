import fs from 'fs';
import path from 'path';

const serverCjsPath = path.join(process.cwd(), 'dist', 'server.cjs');

if (fs.existsSync(serverCjsPath)) {
  console.log('Running post-build SMB2 patch on dist/server.cjs...');
  let c = fs.readFileSync(serverCjsPath, 'utf8');

  // Replace messages glob
  c = c.replace(
    'globRequire_messages("../messages/" + messageName)',
    'globRequire_messages("../messages/" + messageName + ".js")'
  );

  // Replace structures glob
  c = c.replace(
    /globRequire_structures\("\.\.\/structures\/" \+ ([a-zA-Z0-9_]+\.headers\["Command"\]\.toLowerCase\(\))\)/g,
    'globRequire_structures("../structures/" + $1 + ".js")'
  );

  fs.writeFileSync(serverCjsPath, c, 'utf8');
  console.log('SMB2 patch applied successfully!');
} else {
  console.error('Error: dist/server.cjs not found.');
}

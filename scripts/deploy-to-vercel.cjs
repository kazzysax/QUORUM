const fs = require('fs');
const path = require('path');
const https = require('https');
const crypto = require('crypto');

const os = require('os');

function getVercelToken() {
  if (process.env.VERCEL_TOKEN) return process.env.VERCEL_TOKEN;
  try {
    const authPath = path.join(os.homedir(), 'AppData/Roaming/xdg.data/com.vercel.cli/auth.json');
    if (fs.existsSync(authPath)) {
      const data = JSON.parse(fs.readFileSync(authPath, 'utf8'));
      if (data.token) return data.token;
    }
  } catch (_) {}
  throw new Error('Vercel token not found in environment or auth.json');
}

const TOKEN = getVercelToken();
const TEAM_ID = 'team_BITltmnWm5s8PezUdqviHcpq';
const PROJECT_ID = 'prj_r740cdEunBih5lMwvlvD5pKIIFea';
const PROJECT_NAME = 'quorum-io';
const RESOLVED_IP = '216.198.79.3';

function request(options, body) {
  return new Promise((resolve, reject) => {
    const opts = {
      ...options,
      lookup: (hostname, opt, cb) => {
        if (typeof opt === 'function') {
          cb = opt;
          opt = {};
        }
        if (opt && opt.all) {
          return cb(null, [{ address: RESOLVED_IP, family: 4 }]);
        }
        return cb(null, RESOLVED_IP, 4);
      }
    };
    opts.headers = {
      Authorization: `Bearer ${TOKEN}`,
      ...opts.headers
    };
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (_) {
          resolve({ status: res.statusCode, data });
        }
      });
    });
    req.on('error', reject);
    if (body) {
      if (Buffer.isBuffer(body)) {
        req.write(body);
      } else if (typeof body === 'object') {
        req.write(JSON.stringify(body));
      } else {
        req.write(body);
      }
    }
    req.end();
  });
}

function getAllFiles(dir, base = dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    if (file === 'node_modules' || file === 'dist' || file === '.vercel' || file === '.git' || file === '.env.local') {
      continue;
    }
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      results = results.concat(getAllFiles(fullPath, base));
    } else {
      const relPath = path.relative(base, fullPath).replace(/\\/g, '/');
      const content = fs.readFileSync(fullPath);
      const sha = crypto.createHash('sha1').update(content).digest('hex');
      results.push({
        fullPath,
        file: relPath,
        sha,
        size: stat.size,
        content
      });
    }
  }
  return results;
}

async function main() {
  const frontendDir = path.resolve(__dirname, '../frontend');
  console.log(`Scanning frontend source files in: ${frontendDir}`);
  const files = getAllFiles(frontendDir);
  console.log(`Found ${files.length} files to upload.`);

  // Upload files to Vercel
  for (const f of files) {
    const res = await request(
      {
        hostname: 'api.vercel.com',
        path: `/v2/files?teamId=${TEAM_ID}`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/octet-stream',
          'Content-Length': f.size,
          'x-vercel-digest': f.sha
        }
      },
      f.content
    );
    if (res.status === 200) {
      console.log(`✓ ${f.file} (${f.size}b)`);
    } else {
      console.log(`HTTP ${res.status}: ${f.file}`);
    }
  }

  // Create deployment
  console.log('\nCreating Vercel production deployment for quorum-io...');
  const deployPayload = {
    name: PROJECT_NAME,
    project: PROJECT_ID,
    target: 'production',
    files: files.map((f) => ({
      file: f.file,
      sha: f.sha,
      size: f.size
    })),
    projectSettings: {
      framework: 'vite',
      buildCommand: 'npm run build',
      outputDirectory: 'dist'
    },
    meta: {
      gitCommitSha: 'bee0072',
      gitCommitMessage: 'feat(ui): static sidebar with fixed wallet button and collapsible toggle',
      actor: 'antigravity'
    }
  };

  const deployRes = await request(
    {
      hostname: 'api.vercel.com',
      path: `/v13/deployments?teamId=${TEAM_ID}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    },
    deployPayload
  );

  console.log('Deploy response status:', deployRes.status);
  const deployment = deployRes.data;
  console.log('Deployment ID:', deployment.id);
  console.log('Deployment URL:', deployment.url);

  if (!deployment.id) {
    console.error('Failed to create deployment:', deployment);
    process.exit(1);
  }

  // Poll for ready state
  console.log('Waiting for deployment to be READY...');
  let ready = false;
  for (let i = 0; i < 45; i++) {
    const statusRes = await request({
      hostname: 'api.vercel.com',
      path: `/v13/deployments/${deployment.id}?teamId=${TEAM_ID}`,
      method: 'GET'
    });
    const state = statusRes.data.readyState;
    console.log(`Current state: ${state}`);
    if (state === 'READY') {
      ready = true;
      break;
    }
    if (state === 'ERROR') {
      console.error('Deployment error:', statusRes.data);
      process.exit(1);
    }
    await new Promise((r) => setTimeout(r, 2000));
  }

  // Assign aliases
  const aliases = [
    'quorumio.vercel.app',
    'quorum-io-app.vercel.app',
    'quorum-protocol.vercel.app',
    'quorum-near.vercel.app'
  ];

  console.log('\nAssigning aliases...');
  for (const alias of aliases) {
    const aliasRes = await request(
      {
        hostname: 'api.vercel.com',
        path: `/v2/deployments/${deployment.id}/aliases?teamId=${TEAM_ID}`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      },
      { alias }
    );
    console.log(`Alias ${alias}: HTTP ${aliasRes.status}`, aliasRes.data?.alias || aliasRes.data?.error?.message || aliasRes.data);
  }

  console.log('\nDeployment and Aliasing Complete!');
}

main().catch(console.error);

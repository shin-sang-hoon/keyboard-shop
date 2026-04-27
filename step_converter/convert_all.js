const fs = require('fs');
const path = require('path');
const https = require('https');

function download(url, dest) {
  return new Promise((resolve, reject) => {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    const file = fs.createWriteStream(dest);
    https.get(url, { headers: { 'User-Agent': 'keyboard-shop' } }, res => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        file.close();
        if (fs.existsSync(dest)) fs.unlinkSync(dest);
        download(res.headers.location, dest).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode !== 200) {
        file.close();
        if (fs.existsSync(dest)) fs.unlinkSync(dest);
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      res.pipe(file);
      file.on('finish', () => file.close(resolve));
    }).on('error', err => {
      if (fs.existsSync(dest)) fs.unlinkSync(dest);
      reject(err);
    });
  });
}

async function getStepFiles() {
  return new Promise((resolve) => {
    const url = 'https://api.github.com/repos/Keychron/Keychron-Keyboards-Hardware-Design/git/trees/main?recursive=1';
    https.get(url, { headers: { 'User-Agent': 'keyboard-shop' } }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          const files = (json.tree || [])
            .filter(f => f.type === 'blob' && /\.(stp|step)$/i.test(f.path))
            .map(f => f.path);
          resolve(files);
        } catch { resolve([]); }
      });
    }).on('error', () => resolve([]));
  });
}

async function stepToGlb(occt, doc_module, stepData) {
  const { Document, NodeIO } = doc_module;
  const result = occt.ReadStepFile(new Uint8Array(stepData), null);
  if (!result || !result.success || !result.meshes || result.meshes.length === 0) return null;

  const doc = new Document();
  const buffer = doc.createBuffer();
  const scene = doc.createScene();

  for (const meshData of result.meshes) {
    const posArray = new Float32Array(meshData.attributes.position.array);
    const idxArray = new Uint32Array(meshData.index.array);

    const posAccessor = doc.createAccessor()
      .setType('VEC3')
      .setArray(posArray)
      .setBuffer(buffer);

    const idxAccessor = doc.createAccessor()
      .setType('SCALAR')
      .setArray(idxArray)
      .setBuffer(buffer);

    const prim = doc.createPrimitive()
      .setAttribute('POSITION', posAccessor)
      .setIndices(idxAccessor);

    if (meshData.attributes.normal) {
      const normArray = new Float32Array(meshData.attributes.normal.array);
      prim.setAttribute('NORMAL',
        doc.createAccessor().setType('VEC3').setArray(normArray).setBuffer(buffer)
      );
    }

    const mesh = doc.createMesh(meshData.name || 'mesh').addPrimitive(prim);
    const node = doc.createNode(meshData.name || 'node').setMesh(mesh);
    scene.addChild(node);
  }

  const io = new NodeIO();
  return await io.writeBinary(doc);
}

async function main() {
  const occtModule = await import('occt-import-js');
  const occt = await occtModule.default();
  const gltfModule = await import('@gltf-transform/core');

  const OUTPUT_DIR = path.join(__dirname, '..', 'frontend', 'public', 'models');
  const BASE_URL = 'https://github.com/Keychron/Keychron-Keyboards-Hardware-Design/raw/refs/heads/main';
  const tmpStep = path.join(__dirname, 'tmp.step');

  console.log('STEP 파일 목록 가져오는 중...');
  const stepFiles = await getStepFiles();
  console.log(`총 ${stepFiles.length}개 STEP 파일 발견`);

  const pending = stepFiles.filter(f => {
    const glbPath = path.join(OUTPUT_DIR, f.replace(/\.(stp|step)$/i, '.glb'));
    return !fs.existsSync(glbPath);
  });
  console.log(`변환 필요: ${pending.length}개\n`);

  let success = 0, fail = 0;

  for (const stepPath of pending) {
    const glbAbsPath = path.join(OUTPUT_DIR, stepPath.replace(/\.(stp|step)$/i, '.glb'));
    const encodedPath = stepPath.split('/').map(encodeURIComponent).join('/');
    const downloadUrl = `${BASE_URL}/${encodedPath}?download=`;

    process.stdout.write(`[변환] ${stepPath} ... `);

    try {
      await download(downloadUrl, tmpStep);
      const stepData = fs.readFileSync(tmpStep);
      const glbBuffer = await stepToGlb(occt, gltfModule, stepData);

      if (!glbBuffer) {
        console.log('✗ (변환 실패)');
        fail++;
        continue;
      }

      fs.mkdirSync(path.dirname(glbAbsPath), { recursive: true });
      fs.writeFileSync(glbAbsPath, glbBuffer);
      console.log(`✓ (${(glbBuffer.length / 1024).toFixed(0)}KB)`);
      success++;
    } catch (e) {
      console.log(`✗ (${e.message})`);
      fail++;
    } finally {
      if (fs.existsSync(tmpStep)) fs.unlinkSync(tmpStep);
    }
  }

  console.log(`\n완료: 성공 ${success}개, 실패 ${fail}개`);
}

main().catch(console.error);
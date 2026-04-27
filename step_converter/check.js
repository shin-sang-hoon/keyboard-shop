async function main() {
  const m = await import('occt-import-js');
  const occt = await m.default();
  const { NodeIO, Document, Primitive } = await import('@gltf-transform/core');
  const fs = require('fs');

  const data = fs.readFileSync('test.stp');
  const r = occt.ReadStepFile(new Uint8Array(data), null);

  const doc = new Document();
  const buffer = doc.createBuffer();
  const scene = doc.createScene();

  for (const meshData of r.meshes) {
    const posArray = new Float32Array(meshData.attributes.position.array);
    const normArray = meshData.attributes.normal ? new Float32Array(meshData.attributes.normal.array) : null;
    const idxArray = new Uint32Array(meshData.index.array);

    const posAccessor = doc.createAccessor()
      .setType('VEC3')
      .setArray(posArray)
      .setBuffer(buffer);

    const prim = doc.createPrimitive()
      .setAttribute('POSITION', posAccessor)
      .setIndices(doc.createAccessor().setType('SCALAR').setArray(idxArray).setBuffer(buffer));

    if (normArray) {
      prim.setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(normArray).setBuffer(buffer));
    }

    const mesh = doc.createMesh(meshData.name || 'mesh').addPrimitive(prim);
    const node = doc.createNode(meshData.name || 'node').setMesh(mesh);
    scene.addChild(node);
  }

  const io = new NodeIO();
  const glb = await io.writeBinary(doc);
  fs.writeFileSync('test.glb', glb);
  console.log(`완료! ${(glb.length / 1024).toFixed(0)}KB`);
}
main().catch(console.error);
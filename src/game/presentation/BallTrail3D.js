export function createBallTrail3D(THREE, { maxPoints = 14 } = {}) {
  const pointCount = Math.max(2, Math.floor(maxPoints));
  const positions = new Float32Array(pointCount * 3);
  const colors = new Float32Array(pointCount * 3);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.setDrawRange(0, 0);

  const material = new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.72,
    depthWrite: false,
    toneMapped: false,
  });
  const line = new THREE.Line(geometry, material);
  line.frustumCulled = false;
  line.renderOrder = 4;

  function update(points, { worldX, worldZ, speed = 0, opacityForIndex }) {
    const count = Math.min(pointCount, points.length);
    const position = geometry.attributes.position.array;
    const color = geometry.attributes.color.array;

    for (let index = 0; index < count; index += 1) {
      const point = points[index];
      const offset = index * 3;
      position[offset] = worldX(point.x);
      position[offset + 1] = 0.58 + Math.max(0, point.height || 0);
      position[offset + 2] = worldZ(point.y);
      const alpha = Math.max(0, Math.min(1, opacityForIndex(index, count, speed) * 4));
      color[offset] = alpha;
      color[offset + 1] = alpha;
      color[offset + 2] = alpha;
    }

    geometry.setDrawRange(0, count);
    geometry.attributes.position.needsUpdate = true;
    geometry.attributes.color.needsUpdate = true;
    line.visible = count > 1 && speed > 0;
  }

  function dispose() {
    geometry.dispose();
    material.dispose();
  }

  return Object.freeze({ line, update, dispose, maxPoints: pointCount });
}

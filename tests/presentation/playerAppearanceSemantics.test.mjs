import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";

import { classifyPlayerSurface, createPlayerModelView, createSemanticPlayerMaterial } from "../../src/game/presentation/PlayerModelView.js";

function canvasContext() {
  return { fillStyle: "", strokeStyle: "", lineWidth: 1, font: "", textAlign: "", textBaseline: "", roundRect() {}, fill() {}, stroke() {}, fillText() {} };
}
function documentStub() { return { createElement: () => ({ width: 0, height: 0, getContext: () => canvasContext() }) }; }
function scenePort() { const objects = new Set(); return { objects, addObject(object) { objects.add(object); return true; }, removeObject(object) { return objects.delete(object); } }; }
function descriptor(overrides = {}) { return Object.freeze({ id: "home-0", team: 0, index: 0, role: "FW", name: "TONY", number: 10, dirX: 1, dirY: 0, ...overrides }); }
function sourceMaterial(name, color) { const material = new THREE.MeshStandardMaterial({ color }); material.name = name; material.map = new THREE.Texture(); return material; }

test("surface classification is semantic and keeps unknown source slots neutral", () => {
  assert.equal(classifyPlayerSurface("Avatar_Jersey", "Fabric"), "kit");
  assert.equal(classifyPlayerSurface("shorts_mesh", "Fabric"), "shorts");
  assert.equal(classifyPlayerSurface("foot_r", "BootLeather"), "boots");
  assert.equal(classifyPlayerSurface("Head", "Skin"), "skin");
  assert.equal(classifyPlayerSurface("Accessory", "Material.001"), "unknown");
});

test("semantic material cloning preserves maps and tints only explicit kit surfaces", () => {
  const home = descriptor(); const away = descriptor({ id: "away-1", team: 1, index: 1 }); const keeper = descriptor({ id: "home-gk", role: "GK" });
  const skinSource = sourceMaterial("Skin", 0x8b5d45); const unknownSource = sourceMaterial("Material.001", 0x556677); const jerseySource = sourceMaterial("Jersey", 0xffffff); const bootSource = sourceMaterial("BootLeather", 0x222222);
  const skin = createSemanticPlayerMaterial({ source: skinSource, nodeName: "Head", player: home, ownedMaterials: [] });
  const unknown = createSemanticPlayerMaterial({ source: unknownSource, nodeName: "Accessory", player: home, ownedMaterials: [] });
  const homeJersey = createSemanticPlayerMaterial({ source: jerseySource, nodeName: "JerseyMesh", player: home, ownedMaterials: [] });
  const awayJersey = createSemanticPlayerMaterial({ source: jerseySource, nodeName: "JerseyMesh", player: away, ownedMaterials: [] });
  const keeperJersey = createSemanticPlayerMaterial({ source: jerseySource, nodeName: "JerseyMesh", player: keeper, ownedMaterials: [] });
  const boots = createSemanticPlayerMaterial({ source: bootSource, nodeName: "foot_l", player: home, ownedMaterials: [] });
  for (const [clone, source] of [[skin, skinSource], [unknown, unknownSource], [homeJersey, jerseySource], [awayJersey, jerseySource], [keeperJersey, jerseySource], [boots, bootSource]]) {
    assert.notEqual(clone, source); assert.equal(clone.map, source.map); assert.equal(clone.userData.tonySharedTextures, true); assert.equal(clone.userData.tonySourceMapPreserved, true);
  }
  assert.equal(skin.color.getHex(), skinSource.color.getHex()); assert.equal(unknown.color.getHex(), unknownSource.color.getHex()); assert.equal(boots.color.getHex(), bootSource.color.getHex());
  assert.equal(homeJersey.color.getHex(), 0xe1bb58); assert.equal(awayJersey.color.getHex(), 0x32b8c8); assert.equal(keeperJersey.color.getHex(), 0x7650d6);
});

test("procedural fallback exposes two explicit boot meshes and appearance evidence", () => {
  const view = createPlayerModelView({ player: descriptor(), scenePort: scenePort(), document: documentStub(), worldX: (value) => value, worldZ: (value) => value, lowPowerDevice: true });
  const names = []; view.root.traverse((node) => { if (node.name) names.push(node.name); });
  const evidence = view.diagnostics().appearance;
  assert.equal(evidence.mode, "fallback"); assert.equal(evidence.bootCount, 2); assert.equal(evidence.semanticCounts.boots, 2);
  assert.equal(names.includes("TonyBootLeft"), true); assert.equal(names.includes("TonyBootRight"), true);
  assert.equal(view.teardown(), true);
});

test("rig installation preserves semantic source materials and reports footwear for field and keeper roles", () => {
  for (const player of [descriptor(), descriptor({ id: "away-0", team: 1, index: 1 }), descriptor({ id: "home-gk", role: "GK", index: 2 })]) {
    const character = new THREE.Group();
    const skin = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), sourceMaterial("Skin", 0x8b5d45)); skin.name = "Head";
    const jersey = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), sourceMaterial("Jersey", 0xffffff)); jersey.name = "JerseyMesh";
    const shorts = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), sourceMaterial("Shorts", 0xffffff)); shorts.name = "ShortsMesh";
    const leftBoot = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), sourceMaterial("BootLeather", 0x222222)); leftBoot.name = "foot_l";
    const rightBoot = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), sourceMaterial("BootLeather", 0x222222)); rightBoot.name = "foot_r";
    character.add(skin, jersey, shorts, leftBoot, rightBoot);
    const view = createPlayerModelView({ player, scenePort: scenePort(), document: documentStub(), worldX: (value) => value, worldZ: (value) => value, cloneModel: (source) => source.clone(true) });
    assert.equal(view.installAsset({ characterScene: character, animations: [] }), true);
    const evidence = view.diagnostics().appearance;
    assert.equal(evidence.mode, "asset"); assert.ok(evidence.bootCount >= 2); assert.ok(evidence.preservedMapCount >= 5); assert.ok(evidence.tintedKitMaterialCount >= 2); assert.equal(evidence.semanticCounts.skin, 1); assert.equal(evidence.semanticCounts.boots, 2);
    const rig = view.root.children.find((child) => child !== view.root.children[0] && child.type === "Group");
    const installed = []; rig?.traverse((node) => { if (node.isMesh) installed.push(node.material); });
    assert.equal(installed.every((material) => material.userData.tonySharedTextures === true), true);
    assert.equal(view.teardown(), true);
  }
});

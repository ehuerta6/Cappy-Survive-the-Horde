import { useEffect, useRef } from 'react';
import { Engine, Scene, ArcRotateCamera, Vector3, HemisphericLight, MeshBuilder, StandardMaterial, Color3, Color4, type Mesh } from '@babylonjs/core';
import { Simulation } from '../game/Simulation';
import { BASE, CHEST } from '../game/types';

export function World({ simulation }: { simulation: Simulation }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const engine = new Engine(canvas.current!, true);
    const scene = new Scene(engine);
    scene.clearColor = new Color4(0.09, 0.13, 0.14, 1);
    const camera = new ArcRotateCamera('camera', -Math.PI / 4, Math.PI / 3.1, 20, Vector3.Zero(), scene);
    camera.minZ = 0.1;
    new HemisphericLight('light', new Vector3(0.3, 1, -0.4), scene).intensity = 1.25;
    const material = (name: string, color: string) => {
      const m = new StandardMaterial(name, scene); m.diffuseColor = Color3.FromHexString(color); m.specularColor = Color3.Black(); return m;
    };
    const grass = material('grass', '#516749'), bark = material('bark', '#6D4832'), leaves = material('leaves', '#2D713E');
    const baseMat = material('base', '#97A6AD'), chestMat = material('chest', '#C78D42'), cappyMat = material('cappy', '#E4AB68'), zombieMat = material('zombie', '#ABCC60');
    const ground = MeshBuilder.CreateGround('ground', { width: 11, height: 11 }, scene); ground.material = grass;
    const lines: Vector3[][] = [];
    for (let i = -5; i <= 5; i++) { lines.push([new Vector3(i, 0.01, -5), new Vector3(i, 0.01, 5)], [new Vector3(-5, 0.01, i), new Vector3(5, 0.01, i)]); }
    const grid = MeshBuilder.CreateLineSystem('grid', { lines }, scene); grid.color = new Color3(0.37, 0.46, 0.33);
    const base = MeshBuilder.CreateBox('base', { width: 1.6, depth: 1.6, height: 1.4 }, scene); base.position.set(BASE.x, 0.7, BASE.z); base.material = baseMat;
    const chest = MeshBuilder.CreateBox('chest', { width: 0.85, depth: 0.65, height: 0.6 }, scene); chest.position.set(CHEST.x, 0.3, CHEST.z); chest.material = chestMat;
    const cappy = MeshBuilder.CreateCapsule('cappy', { height: 1.15, radius: 0.32 }, scene); cappy.material = cappyMat;
    const trees = new Map<number, Mesh[]>();
    simulation.state.trees.forEach(tree => {
      const trunk = MeshBuilder.CreateCylinder(`trunk-${tree.id}`, { height: 1, diameter: 0.25 }, scene); trunk.position.set(tree.x, 0.5, tree.z); trunk.material = bark;
      const crown = MeshBuilder.CreateSphere(`tree-${tree.id}`, { diameter: 1.2, segments: 6 }, scene); crown.position.set(tree.x, 1.4, tree.z); crown.material = leaves;
      trees.set(tree.id, [trunk, crown]);
    });
    const zombies = new Map<number, Mesh>();
    engine.runRenderLoop(() => {
      simulation.update(Math.min(engine.getDeltaTime() / 1000, 0.1));
      const state = simulation.state;
      cappy.position.set(state.cappyPosition.x, 0.58, state.cappyPosition.z);
      for (const tree of state.trees) trees.get(tree.id)?.forEach(mesh => mesh.setEnabled(tree.alive));
      for (const zombie of state.zombies) {
        if (!zombies.has(zombie.id)) {
          const mesh = MeshBuilder.CreateBox(`zombie-${zombie.id}`, { height: 1, width: 0.55, depth: 0.55 }, scene); mesh.material = zombieMat; zombies.set(zombie.id, mesh);
        }
        const mesh = zombies.get(zombie.id)!; mesh.position.set(zombie.x, 0.5, zombie.z); mesh.setEnabled(zombie.alive);
      }
      if (!state.zombies.length) zombies.forEach(mesh => mesh.setEnabled(false));
      baseMat.diffuseColor = Color3.Lerp(Color3.FromHexString('#BE5252'), Color3.FromHexString('#97A6AD'), state.baseHealth / state.maxBaseHealth);
      scene.render();
    });
    const observer = new ResizeObserver(() => engine.resize()); observer.observe(canvas.current!);
    return () => { observer.disconnect(); scene.dispose(); engine.dispose(); };
  }, [simulation]);
  return <canvas ref={canvas} aria-label="3D game world with Cappy, a base, chest, trees and zombies" />;
}

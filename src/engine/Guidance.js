import * as THREE from 'three';
import { canvasTexture } from './world.js';

// A gentle in-world waypoint: a soft golden arrow bobbing above the target and
// a glowing ring on the ground beneath it. This is the "floating arrow / where
// to go next" guidance — invisible stagecraft that keeps the player from ever
// being lost (storyteller skill). setTarget(null) hides it.
export class Guidance {
  constructor(scene) {
    this.scene = scene;
    this._t = 0;
    this.visible = false;
    this.target = new THREE.Vector3();

    // Downward chevron arrow (billboarded).
    const arrowTex = canvasTexture(64, 64, (ctx, w, h) => {
      ctx.strokeStyle = 'rgba(255,224,170,0.95)';
      ctx.lineWidth = 9;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(16, 20); ctx.lineTo(32, 40); ctx.lineTo(48, 20);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(16, 20); ctx.lineTo(32, 40); ctx.lineTo(48, 20);
      ctx.stroke();
    });
    this.arrow = new THREE.Mesh(
      new THREE.PlaneGeometry(0.9, 0.9),
      new THREE.MeshBasicMaterial({
        map: arrowTex, transparent: true, depthWrite: false, fog: false,
        blending: THREE.AdditiveBlending, opacity: 0.95,
      }),
    );

    // Ground ring (additive, flat).
    const ringTex = canvasTexture(128, 128, (ctx, w, h) => {
      const cx = w / 2, cy = h / 2;
      for (let i = 0; i < 3; i++) {
        ctx.strokeStyle = `rgba(255,220,160,${0.5 - i * 0.14})`;
        ctx.lineWidth = 3 - i;
        ctx.beginPath();
        ctx.arc(cx, cy, 40 - i * 3, 0, Math.PI * 2);
        ctx.stroke();
      }
    });
    this.ring = new THREE.Mesh(
      new THREE.PlaneGeometry(2.2, 2.2),
      new THREE.MeshBasicMaterial({
        map: ringTex, transparent: true, depthWrite: false, fog: false,
        blending: THREE.AdditiveBlending, opacity: 0.8,
      }),
    );
    this.ring.rotation.x = -Math.PI / 2;

    this.group = new THREE.Group();
    this.group.add(this.arrow, this.ring);
    this.group.visible = false;
    scene.add(this.group);
  }

  setTarget(vec3) {
    if (!vec3) { this.visible = false; this.group.visible = false; return; }
    this.target.copy(vec3);
    this.visible = true;
    this.group.visible = true;
  }

  setTargetXZ(x, z) { this.target.set(x, 0, z); this.visible = true; this.group.visible = true; }

  update(dt, camera) {
    if (!this.visible) return;
    this._t += dt;
    const t = this._t / 1000;
    this.ring.position.set(this.target.x, 0.04, this.target.z);
    const s = 1 + Math.sin(t * 2.2) * 0.08;
    this.ring.scale.setScalar(s);
    this.ring.material.opacity = 0.55 + Math.sin(t * 2.2) * 0.2;

    this.arrow.position.set(this.target.x, this.target.y + 2.5 + Math.sin(t * 2.0) * 0.18, this.target.z);
    // Yaw-billboard the arrow to the camera.
    this.arrow.rotation.y = Math.atan2(
      camera.position.x - this.arrow.position.x,
      camera.position.z - this.arrow.position.z,
    );
  }

  dispose() {
    for (const m of [this.arrow, this.ring]) {
      m.geometry.dispose();
      m.material.map?.dispose();
      m.material.dispose();
    }
    this.scene.remove(this.group);
  }
}

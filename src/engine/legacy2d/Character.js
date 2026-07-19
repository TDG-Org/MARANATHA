import * as THREE from 'three';
import { blobShadow, clamp } from '../world.js';

// A flat HD-2D character: a yaw-billboarded canvas sprite that lives in the 3D
// world, animated by a multi-frame stride atlas PLUS procedural bob / sway /
// breath / facing (character-design + animation skills). Zero image files —
// every frame is drawn to one canvas atlas at build time.
//
//   draw(ctx, w, h, swing)  draws ONE frame for a stride value `swing` in
//   [-1..1] (0 = feet together). We sample it at a few swing values to build
//   the atlas: index 0 is the idle pose, the rest are the walk cycle.
export class Character {
  constructor({
    draw,
    height = 2.0,
    frameW = 128,
    frameH = 256,
    walkPoses = [1, 0, -1, 0], // stride cycle sampled from draw()
    strideLen = 1.15,          // world distance per half-stride (frame step)
    bobAmp = 0.055,
    name = '',
  }) {
    this.name = name;
    this.height = height;
    this.strideLen = strideLen;
    this.bobAmp = bobAmp;

    this._frameW = frameW;
    this._frameH = frameH;
    this._poses = [0, ...walkPoses]; // 0 = idle
    this.frameCount = this._poses.length;

    const w = height * (frameW / frameH);
    this.sprite = new THREE.Mesh(
      new THREE.PlaneGeometry(w, height),
      new THREE.MeshBasicMaterial({
        transparent: true, alphaTest: 0.02, depthWrite: false, fog: true,
      }),
    );
    this.sprite.position.y = height / 2;
    this._baseY = height / 2;
    this.texture = null;
    this._buildAtlas(draw); // sets this.texture + material.map

    this.shadow = blobShadow(w * 1.05);

    this.root = new THREE.Group();
    this.root.add(this.sprite, this.shadow);

    // Animation state.
    this._t = 0;
    this.walkDist = 0;
    this.faceX = 1;      // eased ±1 facing
    this._faceTarget = 1;
    this._right = new THREE.Vector3();
  }

  // Draw all frames into one atlas canvas → texture. Rebuildable so a
  // character can be re-skinned mid-scene (e.g. Joseph receiving the coat).
  _buildAtlas(draw) {
    const fw = this._frameW, fh = this._frameH, poses = this._poses;
    const canvas = document.createElement('canvas');
    canvas.width = fw * this.frameCount;
    canvas.height = fh;
    const ctx = canvas.getContext('2d');
    poses.forEach((swing, i) => {
      ctx.save();
      ctx.translate(i * fw, 0);
      ctx.beginPath();
      ctx.rect(0, 0, fw, fh);
      ctx.clip();
      draw(ctx, fw, fh, swing);
      ctx.restore();
    });
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 1;
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearFilter;
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.repeat.x = 1 / this.frameCount;
    tex.offset.x = 0;
    if (this.texture) this.texture.dispose();
    this.texture = tex;
    this.sprite.material.map = tex;
    this.sprite.material.needsUpdate = true;
  }

  setDraw(draw) { this._buildAtlas(draw); }

  addTo(scene) { scene.add(this.root); return this; }

  placeAt(x, z) { this.root.position.set(x, 0, z); return this; }

  get position() { return this.root.position; }

  // Called every frame by the controller (or an idle NPC driver) with the
  // character's world velocity so it animates itself.
  animate(dt, camera, vx = 0, vz = 0, walkSpeed = 3.2) {
    this._t += dt;
    const speed = Math.hypot(vx, vz);
    const speed01 = clamp(speed / walkSpeed, 0, 1);
    const moving = speed01 > 0.06;

    // Yaw-billboard the whole root toward the camera (blob shadow spins flat).
    this.root.rotation.y = Math.atan2(
      camera.position.x - this.root.position.x,
      camera.position.z - this.root.position.z,
    );

    // Frame selection (single-frame actors like sheep stay on frame 0).
    let frame = 0;
    if (moving && this.frameCount > 1) {
      this.walkDist += speed * dt * 0.001;
      frame = 1 + (Math.floor(this.walkDist / this.strideLen) % (this.frameCount - 1));
    } else if (!moving) {
      this.walkDist = 0;
    }
    this.texture.offset.x = frame / this.frameCount;

    // Bob (feet-planted gait) + sway, both scaled by speed so they melt at rest.
    const phase = (this.walkDist / this.strideLen) * Math.PI;
    this.sprite.position.y = this._baseY - Math.abs(Math.sin(phase)) * this.bobAmp * speed01;
    this.sprite.rotation.z = Math.sin(phase * 2) * 0.028 * speed01;

    // Idle breath when essentially still.
    const breathe = moving ? 1 : 1 + Math.sin(this._t * 0.0017) * 0.012;
    this.sprite.scale.y = breathe;

    // Facing: flip toward horizontal screen-travel; ease the flip (squash-through).
    if (moving) {
      this._right.set(1, 0, 0).applyQuaternion(camera.quaternion);
      const dot = this._right.x * vx + this._right.z * vz;
      if (Math.abs(dot) > 0.02) this._faceTarget = dot >= 0 ? 1 : -1;
    }
    this.faceX += (this._faceTarget - this.faceX) * Math.min(dt * 0.02, 1);
    this.sprite.scale.x = Math.sign(this.faceX) * Math.max(0.06, Math.abs(this.faceX));
  }

  dispose() {
    this.sprite.geometry.dispose();
    this.sprite.material.map?.dispose();
    this.sprite.material.dispose();
    this.shadow.geometry.dispose();
    this.shadow.material.map?.dispose();
    this.shadow.material.dispose();
    this.root.parent?.remove(this.root);
  }
}

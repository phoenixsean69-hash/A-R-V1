import {
  useEffect,
  useRef,
  useState,
} from "react";

import * as THREE from "three";

import type {
  ReconstructionParticipantAssetId,
} from "../../types/reconstruction";

import {
  disposeObjectTree,
} from "../../services/realisticSceneAssetService";

import {
  loadPremiumParticipantAssetModel,
} from "../../services/premiumParticipantAssetService";

interface ParticipantAssetPreview3DProps {
  assetId: ReconstructionParticipantAssetId;
}

export default function ParticipantAssetPreview3D({
  assetId,
}: ParticipantAssetPreview3DProps) {
  const mountRef =
    useRef<HTMLDivElement | null>(null);

  const [status, setStatus] =
    useState<
      "loading" |
      "premium" |
      "fallback"
    >("loading");

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let disposed = false;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x242424);

    const camera = new THREE.PerspectiveCamera(
      35,
      1,
      0.05,
      100,
    );

    camera.position.set(5.6, 3.4, 5.6);
    camera.lookAt(0, 1, 0);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: "low-power",
    });

    renderer.setPixelRatio(
      Math.min(window.devicePixelRatio, 1.25),
    );

    renderer.outputColorSpace =
      THREE.SRGBColorSpace;

    renderer.toneMapping =
      THREE.ACESFilmicToneMapping;

    renderer.toneMappingExposure = 1.05;

    mount.replaceChildren(renderer.domElement);

    scene.add(
      new THREE.HemisphereLight(
        0xe4e7eb,
        0x30342f,
        2,
      ),
    );

    const key =
      new THREE.DirectionalLight(
        0xffffff,
        2.3,
      );

    key.position.set(-3, 7, 4);
    scene.add(key);

    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(3.6, 48),
      new THREE.MeshStandardMaterial({
        color: 0x303030,
        roughness: 1,
      }),
    );

    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.015;
    scene.add(floor);

    const modelHolder = new THREE.Group();
    scene.add(modelHolder);

    const resize = () => {
      const rect = mount.getBoundingClientRect();
      const width = Math.max(1, rect.width);
      const height = Math.max(1, rect.height);

      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };

    const observer = new ResizeObserver(resize);
    observer.observe(mount);
    resize();

    setStatus("loading");

    void loadPremiumParticipantAssetModel(assetId)
      .then((model) => {
        if (disposed) {
          if (model) disposeObjectTree(model);
          return;
        }

        if (!model) {
          setStatus("fallback");
          return;
        }

        modelHolder.add(model);

        const bounds =
          new THREE.Box3().setFromObject(model);

        const size =
          bounds.getSize(new THREE.Vector3());

        const radius = Math.max(
          size.x,
          size.y,
          size.z,
          1,
        );

        camera.position.set(
          radius * 1.45,
          Math.max(radius * 0.75, size.y * 0.8),
          radius * 1.45,
        );

        camera.lookAt(
          0,
          Math.max(0.3, size.y * 0.42),
          0,
        );

        setStatus("premium");
      })
      .catch(() => {
        if (!disposed) {
          setStatus("fallback");
        }
      });

    let frame = 0;

    const animate = () => {
      modelHolder.rotation.y += 0.004;
      renderer.render(scene, camera);
      frame =
        window.requestAnimationFrame(animate);
    };

    frame =
      window.requestAnimationFrame(animate);

    return () => {
      disposed = true;

      window.cancelAnimationFrame(frame);
      observer.disconnect();

      scene.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;

        object.geometry.dispose();

        const materials =
          Array.isArray(object.material)
            ? object.material
            : [object.material];

        materials.forEach(
          (material) => material.dispose(),
        );
      });

      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [assetId]);

  return (
    <div className="roadsafe-asset-preview">
      <div
        ref={mountRef}
        className="roadsafe-asset-preview__canvas"
      />

      <span
        className={`roadsafe-asset-preview__status is-${status}`}
      >
        {status === "loading"
          ? "Loading HQ model…"
          : status === "premium"
            ? "HQ intake model"
            : "Procedural fallback"}
      </span>
    </div>
  );
}

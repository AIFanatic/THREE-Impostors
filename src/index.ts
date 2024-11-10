import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import Stats from "three/examples/jsm/libs/stats.module.js";
import { AmbientLight, BufferGeometry, Color, DirectionalLight, DoubleSide, Mesh, MeshBasicMaterial, MeshPhongMaterial, NearestFilter, Object3D, PerspectiveCamera, PlaneGeometry, SRGBColorSpace, Scene, ShaderMaterial, SphereGeometry, TextureLoader, Vector2, Vector3, WebGLRenderer } from "three";

import { Impostor } from "./Impostor";

import { Dilator } from "./Dilator";


async function main() {
    const canvas = document.createElement("canvas");
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    document.body.appendChild(canvas);
    
    var renderer = new WebGLRenderer({canvas: canvas, alpha: true});
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);
    
    var scene = new Scene();
    window.scene = scene;
    window.addSphere = (position: Vector3) => {
        const g = new SphereGeometry(0.05);
        const m = new MeshBasicMaterial();
        const mesh = new Mesh(g, m);
        mesh.position.copy(position);
        scene.add(mesh);
    }
    scene.background = new Color(0x222222);
    var camera = new PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 5;
    const controls = new OrbitControls(camera, renderer.domElement);
    
    const ambientLight = new AmbientLight();
    ambientLight.intensity = 0.1;
    scene.add(ambientLight);
    const directionalLight = new DirectionalLight();
    directionalLight.position.set(45 * Math.PI / 180, 45 * Math.PI / 180, 0)
    scene.add(directionalLight);
    
    const stats = new Stats();
    document.body.appendChild(stats.dom);
    
    let geometry = new BufferGeometry();

    {
        const objLoader = new OBJLoader();
        const obj = await objLoader.loadAsync("./bunny.obj");
        geometry = obj.children[0].geometry;
        geometry = geometry.scale(0.01, 0.01, 0.01);
    }

    // {
    //     const gLTFLoader = new GLTFLoader();
    //     const gltf = await gLTFLoader.loadAsync("./LowPolyTrees.glb");
    //     console.log(gltf)
    //     const obj = mergeGeometries([gltf.scene.children[0].geometry, gltf.scene.children[0].children[0].geometry]);
    //     console.log(obj)
    //     geometry = mergeVertices(obj.rotateX(Math.PI / 2).scale(0.01, 0.01, 0.01));
    // }

    // {
    //     const gLTFLoader = new GLTFLoader();
    //     const gltf = await gLTFLoader.loadAsync("./pine.glb");
    //     console.log(gltf)
    //     geometry = gltf.scene.children[1].children[0].geometry;
    //     geometry = geometry.scale(0.01, 0.01, 0.01);
    //     geometry = mergeVertices(geometry);
    // }
    // const geometry = mergeVertices(obj.geometry.scale(0.01, 0.01, 0.01));
    const mat = new MeshPhongMaterial({ wireframe: false, transparent: true });
    const mesh = new Mesh(geometry, mat);
    // mesh.position.x = -2;
    scene.add(mesh);

    const atlasTiles = 16;
    const atlasResolution = 2048;
    const impostor = new Impostor(geometry, renderer, atlasTiles, atlasResolution);

    {
        const p = new PlaneGeometry(2, 2);
        const m = new MeshBasicMaterial({ map: impostor.albedoTexture.texture, side: DoubleSide });
        // const m = new MeshBasicMaterial({ map: texture, side: DoubleSide });
        const mesh = new Mesh(p, m);
    
        scene.add(mesh);
    }

    impostor.impostorMesh.position.x = -2;
    scene.add(impostor.impostorMesh);

    const dilator = new Dilator(impostor.albedoTexture.texture, renderer);

    const dilateGeometry = new PlaneGeometry(2, 2);
    const dilateMat = new ShaderMaterial({
        vertexShader: `
            varying vec2 vUv;
    
            void main() {
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position.xyz, 1.0);
                vUv = uv;
            }
        `,
        fragmentShader: `
        uniform sampler2D map;
        varying vec2 vUv;
    
        void main() {
            vec4 c = texture2D(map, vUv);
            gl_FragColor = c;
        }
        `,
        uniforms: {
            map: {value: dilator.GetRenderTarget().texture},
        },
        side: DoubleSide
    });
    // const dilateMat = new MeshBasicMaterial({map: dilator.GetRenderTarget().texture, toneMapped: false});
    const dilateMesh = new Mesh(dilateGeometry, dilateMat);
    dilateMesh.position.x = 6;
    scene.add(dilateMesh)

    var render = function () {
        requestAnimationFrame(render);

        impostor.impostorMesh.material.uniforms.cameraPosition.value.copy(camera.position);

        stats.update();
        renderer.render(scene, camera);
    };

    render();
}

main()
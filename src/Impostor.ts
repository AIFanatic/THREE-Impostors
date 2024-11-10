import { BufferGeometry, Color, DoubleSide, MathUtils, Matrix4, Mesh, MeshBasicMaterial, MeshNormalMaterial, OrthographicCamera, PlaneGeometry, RenderTarget, Scene, ShaderMaterial, Vector2, Vector3, WebGLRenderTarget, WebGLRenderer } from "three";
import { Dilator } from "./Dilator";

export class Impostor {
    private geometry: BufferGeometry;
    private renderer: WebGLRenderer;
    private scene: Scene;

    private camera: OrthographicCamera;

    private atlasTiles: number;

    public albedoTexture: WebGLRenderTarget;
    public normalTexture: WebGLRenderTarget;
    public impostorMesh: Mesh;
    public dilator: Dilator;

    constructor(geometry: BufferGeometry, renderer: WebGLRenderer, atlasTiles: number, atlasResolution: number) {
        this.geometry = geometry;
        this.renderer = renderer;
        this.atlasTiles = atlasTiles;
        this.scene = new Scene();
        this.scene.background = new Color(0x000000);

        this.geometry = this.geometry.center();
        this.geometry.computeBoundingBox();
        this.geometry.computeBoundingSphere();
        if (!this.geometry.boundingSphere) throw Error("Could not compute bounding sphere");
        if (!this.geometry.boundingBox) throw Error("Could not compute bounding box");

        const radius = this.geometry.boundingSphere.radius;

        console.log(radius)

        this.camera = new OrthographicCamera(
            -radius, radius,
            radius, -radius,
            0, 1000
        );

        const mat = new ShaderMaterial({
            vertexShader: `
            varying vec3 vNormal;

            void main() {
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position.xyz, 1.0);
                vNormal = normal;
            }
            `,
            fragmentShader: `
            varying vec3 vNormal;
            
            uniform bool renderNormal;

            void main() {
                if (renderNormal) {
                    gl_FragColor = vec4((vNormal + 1.0) / 2.0, 1.0);
                }
                else {
                    gl_FragColor = vec4(1.0);
                }
            }
            `,
            uniforms: {
                renderNormal: {value: 0.0}
            }
        });
        // const mat = new MeshNormalMaterial();
        const mesh = new Mesh(this.geometry, mat);
        this.scene.add(mesh);

        // Set up the atlas texture
        // const sizePerTile = 100;
        const frameSize = atlasResolution / atlasTiles;
        this.albedoTexture = new WebGLRenderTarget(atlasResolution, atlasResolution);
        this.normalTexture = this.albedoTexture.clone();

        console.log(atlasResolution, atlasTiles, frameSize);

        const frames = atlasTiles;
        const imposterPosition = new Vector3(); // root.position + imposter.Offset

        const framesMinusOne = frames - 1;

        for (var x = 0; x < frames; x++) {
            for (var y = 0; y < frames; y++) {
                var vec = new Vector2(
                    x / framesMinusOne,
                    y / framesMinusOne
                );
                const vecSigned = new Vector2(vec.x * 2 - 1, vec.y * 2 - 1);
                const normal = this.OctahedralCoordToVector(vecSigned);
                // const normal = this.OctahedralCoordToVectorHemisphere(vecSigned);
    
                const position = imposterPosition.clone().add(normal.clone().multiplyScalar(radius));

                window.addSphere(position);

                this.camera.position.copy(position);
                this.camera.lookAt(new Vector3(0, 0, 0));

                mat.uniforms.renderNormal.value = false;
                this.renderByPosition(this.albedoTexture, x * frameSize, y * frameSize, frameSize, frameSize);
                mat.uniforms.renderNormal.value = true;
                this.renderByPosition(this.normalTexture, x * frameSize, y * frameSize, frameSize, frameSize);
                // const helper = new CameraHelper( this.camera );
                // window.scene.add( helper );
                // this.renderByPosition(this.atlasTexture, 0, 0, this.atlasTexture.width, this.atlasTexture.height);
                // break
            }
            // break
        }

        this.impostorMesh = this.CreateImpostorMesh();


        // const d = new Dilator(this.atlasTexture.texture, renderer);

        // const dilateGeometry = new PlaneGeometry(2, 2);
        // const dilateMat = new MeshBasicMaterial({map: d.GetRenderTarget().texture});
        // const dilateMesh = new Mesh(dilateGeometry, dilateMat);
        // dilateMesh.position.x = 3;
        // window.scene.add(dilateMesh)
        // this.dilator = d;

        // this.impostorMesh.material.uniforms.atlas.value = d.GetRenderTarget().texture;
        
    }

    private renderByPosition(renderTarget: WebGLRenderTarget, x: number, y: number, w: number, h: number) {
        this.renderer.setRenderTarget(renderTarget);
        this.renderer.setViewport(x, y, w, h);
        this.renderer.setScissor(x, y, w, h);
        this.renderer.setScissorTest(true);
        this.renderer.render(this.scene, this.camera);
        this.renderer.setRenderTarget(null);
        this.renderer.setViewport(0, 0, this.renderer.domElement.width, this.renderer.domElement.height);
        this.renderer.setScissorTest(false);
    }

    private OctahedralCoordToVectorHemisphere(f: Vector2): Vector3 {
        const coord = new Vector2(f.x + f.y, f.x - f.y).multiplyScalar(0.5);
        var vec = new Vector3(
            coord.x,
            1.0 - new Vector2(1,1).dot(new Vector2(Math.abs(coord.x), Math.abs(coord.y))),
            coord.y
        );
        return vec.normalize();
    }
    
    private OctahedralCoordToVector(f: Vector2): Vector3 {
        // // var n = new Vector3(f.x, 1 - Math.abs(f.x) - Math.abs(f.y), f.y);
        // // var t = MathUtils.clamp(-n.y, 0, 1);
        // // n.x += n.x >= 0 ? -t : t;
        // // n.z += n.z >= 0 ? -t : t;
        // // return n.normalize();

        function sign_not_zero(v: Vector2): Vector2
        {
            return new Vector2((v.x >= 0.) ? 1.0 : -1.0, (v.y >= 0.0) ? 1.0 : -1.0);
        }


        const v = f.clone();
        const n = new Vector3(v.x, v.y, 1.0 - Math.abs(v.x) - Math.abs(v.y));
        if (n.z < 0.) {
            // n.xy = (1.0 - Math.abs(n.yx)) * sign_not_zero(n.xy);

            const t = new Vector2(n.x, n.y);
            n.x = (1.0 - Math.abs(t.y)) * sign_not_zero(t).x;
            n.y = (1.0 - Math.abs(t.x)) * sign_not_zero(t).y;
        }
        return n.normalize();
    }

    private CreateImpostorMesh(): Mesh {
        let g = new PlaneGeometry(1, 1);
        const m = new ShaderMaterial({
            vertexShader: `
            varying vec2 vUv;
            varying vec3 cameraPos_OS;

            void main() {
                mat4 mm = modelMatrix;
                #ifdef USE_INSTANCING
                    mm = instanceMatrix;
                #endif
                mat4 mvm = viewMatrix * mm;
                gl_Position = projectionMatrix * (mvm * vec4(0.0, 0.0, 0.0, 1.0) + vec4(position.x, position.y, 0.0, 0.0));

                vUv = uv;

                cameraPos_OS = (inverse(modelMatrix) * vec4(cameraPosition, 1.0)).xyz;
            }
            `,
            fragmentShader: `
                uniform sampler2D albedoTexture;
                uniform sampler2D normalTexture;
                uniform int u_atlasTiles;

                varying vec2 vUv;

                varying vec3 cameraPos_OS;

                // http://jcgt.org/published/0003/02/01/paper.pdf
                // A Survey of Efficient Representations for Independent Unit Vectors 
                vec2 sign_not_zero(vec2 v)
                {
                    return vec2((v.x >= 0.f) ? 1.f : -1.f, (v.y >= 0.f) ? 1.f : -1.f);
                }

                // n: should already be normalized
                vec2 oct_encode_dir(vec3 n)
                {
                    vec2 p = n.xy * (1.f / (abs(n.x) + abs(n.y) + abs(n.z)));
                    return (n.z <= 0.f) ? ( (1.f - abs(p.yx)) * sign_not_zero(p) ) : p;
                }

                // Simple pseudo-random noise function based on fragment coordinates
                float noise(vec2 uv) {
                    return fract(sin(dot(uv ,vec2(12.9898,78.233))) * 43758.5453);
                }

                void main() {

                    vec3 d = normalize(cameraPos_OS);
                    vec2 uv = oct_encode_dir(d) * 0.5 + 0.5;

                    float u_AtlasTiles = float(u_atlasTiles);
                    vec2 tileUV = uv * u_AtlasTiles;
                    vec2 tileBase = floor(tileUV);
                    vec2 f = fract(tileUV);
                    // Coordinates within the tile
                    vec2 tileCoord = vUv;
                    float tileSize = 1.0 / u_AtlasTiles;
                
                    float fx = f.x;
                    float fy = f.y;
                    // // Use smoother interpolation weights
                    // float fx = f.x * f.x * (3.0 - 2.0 * f.x);
                    // float fy = f.y * f.y * (3.0 - 2.0 * f.y);

                    // // Generate a noise value for dithering
                    // float ditherStrength = 0.05; // Adjust the strength as needed
                    // float dither = (noise(gl_FragCoord.xy) - 0.5) * ditherStrength;
                    
                    // // Apply dithering to the interpolation weights
                    // fx = clamp(fx + dither, 0.0, 1.0);
                    // fy = clamp(fy + dither, 0.0, 1.0);

                    vec2 uv00 = (tileBase + tileCoord) * tileSize;
                    vec2 uv10 = (tileBase + vec2(1.0, 0.0) + tileCoord) * tileSize;
                    vec2 uv01 = (tileBase + vec2(0.0, 1.0) + tileCoord) * tileSize;
                    vec2 uv11 = (tileBase + vec2(1.0, 1.0) + tileCoord) * tileSize;

                    // Sample the textures
                    vec4 color00 = texture2D(normalTexture, uv00);
                    vec4 color10 = texture2D(normalTexture, uv10);
                    vec4 color01 = texture2D(normalTexture, uv01);
                    vec4 color11 = texture2D(normalTexture, uv11);

                    // Perform smoother bilinear interpolation
                    vec4 color0 = mix(color00, color10, fx);
                    vec4 color1 = mix(color01, color11, fx);
                    vec4 finalColor = mix(color0, color1, fy);

                    float EPS = 1e-5;
                    if (finalColor.r < EPS && finalColor.g < EPS && finalColor.b < EPS) {
                        discard;
                    }

                    gl_FragColor = finalColor;
                }
            `,
            uniforms: {
                albedoTexture: { value: this.albedoTexture.texture },
                normalTexture: { value: this.normalTexture.texture },
                cameraPosition: { value: new Vector3() },
                u_atlasTiles: { value: this.atlasTiles },
            },
            side: DoubleSide
        });
        return new Mesh(g, m);
    }
}
import {  LinearFilter, Mesh, NearestFilter, OrthographicCamera, PlaneGeometry, SRGBColorSpace, Scene, ShaderMaterial, Texture, WebGLRenderTarget, WebGLRenderer } from "three";

export class Dilator {
    private readBuffer: WebGLRenderTarget;
    private writeBuffer: WebGLRenderTarget;

    constructor(texture: Texture, renderer: WebGLRenderer) {
        this.readBuffer = new WebGLRenderTarget(texture.image.width, texture.image.height, {
            // magFilter: NearestFilter,
            // minFilter: NearestFilter,
            generateMipmaps: false
        });
        this.writeBuffer = this.readBuffer.clone();

        const dilateMat = new ShaderMaterial({
            vertexShader: `
                varying vec2 vUv;

                void main() {
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position.xyz, 1.0);
                    vUv = uv;
                }
            `,
            fragmentShader: `
            precision highp float;
            precision highp int;
            precision highp sampler2D;
            uniform sampler2D atlas;
            uniform sampler2D rt;
            uniform int first;
            varying vec2 vUv;

            vec3 dilate(sampler2D tex, vec2 UV) {
                float TextureSize = float(textureSize(tex, 0).x);
                int MaxSteps = 64;
                float texelsize = 1.0 / TextureSize;
                float mindist = 10000000.0;
                vec2 offsets[8];
                offsets[0] = vec2(-1, 0);
                offsets[1] = vec2(1, 0);
                offsets[2] = vec2(0, 1);
                offsets[3] = vec2(0, -1);
                offsets[4] = vec2(-1, 1);
                offsets[5] = vec2(1, 1);
                offsets[6] = vec2(1, -1);
                offsets[7] = vec2(-1, -1);
                
                vec3 _sample = texture2D(tex, UV).rgb;
                vec3 curminsample = _sample;
                
                const float EPS = 1e-5;
                if(_sample.x < EPS && _sample.y < EPS && _sample.z < EPS)
                {
                    int i = 0;
                    while(i < MaxSteps)
                    { 
                        i++;
                        int j = 0;
                        while (j < 8)
                        {
                            vec2 curUV = UV + offsets[j] * texelsize * float(i);
                            vec3 offsetsample = texture2D(tex, curUV).rgb;
                
                            if(offsetsample.x > EPS || offsetsample.y > EPS || offsetsample.z > EPS)
                            {
                                float curdist = length(UV - curUV);
                
                                if (curdist < mindist)
                                {
                                    vec2 projectUV = curUV + offsets[j] * texelsize * float(i) * 0.25;
                                    vec3 direction = texture2D(tex, projectUV).rgb;
                                    mindist = curdist;
                
                                    if(direction.x > EPS || direction.y > EPS || direction.z > EPS)
                                    {
                                        vec3 delta = offsetsample - direction;
                                        curminsample = offsetsample + delta * 4.0;
                                    }
                
                                    else
                                    {
                                        curminsample = offsetsample;
                                    }
                                }
                            }
                            j++;
                        }
                    }
                }
                
                return curminsample;
            }

            void main() {
                vec3 ca;
                if (first == 0) {
                    ca = texture2D(atlas, vUv).rgb;
                }
                else {
                    ca = dilate(rt, vUv);
                }
                gl_FragColor = vec4(ca.rgb, 1.0);
            }
            `,
            uniforms: {
                atlas: {value: texture},
                rt: {value: this.readBuffer.texture},
                first: {value: 0},
            },
        });
        const dilateGeometry = new PlaneGeometry(2, 2);
        const dilateMesh = new Mesh(dilateGeometry, dilateMat);
        // dilateMesh.position.x = 3;

        const scene = new Scene();
        scene.add(dilateMesh);

        const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);

        const swap = () => {
            const temp = this.readBuffer
            this.readBuffer = this.writeBuffer
            this.writeBuffer = temp
        }
        let first = 0;
        const render = () => {
            this.readBuffer.texture.needsUpdate = true;
            dilateMat.uniforms.first.value = first;
            dilateMat.uniforms.rt.value = this.readBuffer.texture;
            
            renderer.setRenderTarget(this.writeBuffer);
            renderer.render(scene, camera);
            renderer.setRenderTarget(null);
            
            swap();
            
            first++;
        }

        for (let i = 0; i < 3; i++) {
            render();
        }
    }

    public GetRenderTarget(): WebGLRenderTarget {
        return this.writeBuffer
    }
}
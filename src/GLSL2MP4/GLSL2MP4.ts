import * as THREE from "three";
import {createFFmpeg, fetchFile} from "@ffmpeg/ffmpeg";

const vertex = `
precision highp float;
uniform mat4 modelMatrix;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform mat4 viewMatrix;
uniform mat3 normalMatrix;
uniform vec3 cameraPosition;
attribute vec3 position;
void main(){

  gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4( position , 1.);

}
`;

const frag = `
precision highp float;
uniform vec3 iResolution;
uniform float iTime;
 
// By iq: https://www.shadertoy.com/user/iq  
// license: Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.
void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    // Normalized pixel coordinates (from 0 to 1)
    vec2 uv = fragCoord/vec2(100,100);
 
    // Time varying pixel color
    vec3 col = 0.5 + 0.5*cos(iTime*3.1415*2.0+uv.xyx+vec3(0,2,4));
 
    // Output to screen
    fragColor = vec4(col,1.0);
}
 
void main() {
  mainImage(gl_FragColor, gl_FragCoord.xy);
}
`;

export class GLSL2MP4{
    width:number;
    height:number;
    gl:WebGLRenderingContext;
    renderer:THREE.WebGLRenderer;
    camera:THREE.OrthographicCamera;
    material:THREE.RawShaderMaterial;
    scene:THREE.Scene;
    mesh:THREE.Mesh;
    uniforms:{ [uniform: string]: THREE.IUniform };
    src:string;
    frameBuffer:Array<string>;
    canvas2D:HTMLCanvasElement;

    constructor(width:number,height:number,uniforms?:{ [uniform: string]: THREE.IUniform },src?:string) {
        this.width = width;
        this.height = height;
        this.frameBuffer = new Array<string>();
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        this.canvas2D = document.createElement("canvas");
        this.canvas2D.width = width;
        this.canvas2D.height = height;
        this.gl = canvas.getContext("webgl") as WebGLRenderingContext;
        this.renderer = new THREE.WebGLRenderer(this.gl);
        this.renderer.autoClearColor = false;
        this.renderer.setClearColor(new THREE.Color(255,0,0));

        this.camera = new THREE.OrthographicCamera(
            -1, // left
            1, // right
            1, // top
            -1, // bottom
            -1, // near,
            1, // far
        );
        this.scene = new THREE.Scene();
        this.src = src ? src : frag;
        this.uniforms = uniforms ? uniforms : {};
        const plane = new THREE.PlaneBufferGeometry(2, 2);
        this.material = new THREE.RawShaderMaterial({
            vertexShader:vertex,
            fragmentShader:frag,
            uniforms:{}
        });
        this.mesh = new THREE.Mesh(plane, this.material);
        this.scene.add(this.mesh);

    }

    SetShader(src:string){
        this.mesh.material = new THREE.RawShaderMaterial({
            vertexShader:vertex,
            fragmentShader:src,
            uniforms:this.uniforms
        })

    }
    SetUniform(uniforms:{ [uniform: string]: THREE.IUniform }){
        this.mesh.material = new THREE.RawShaderMaterial({
            vertexShader:vertex,
            fragmentShader:this.src,
            uniforms:uniforms
        });

    }

    AddFrame:(targetCanvas:HTMLCanvasElement) => HTMLCanvasElement = (targetCanvas:HTMLCanvasElement) => {
        this.renderer.render(this.scene,this.camera);
        const canvas = this.gl.canvas as HTMLCanvasElement;
        const context = this.canvas2D.getContext("2d") as CanvasRenderingContext2D;
        context.drawImage(canvas,0,0);
        const uri = this.canvas2D.toDataURL();
        this.frameBuffer.push(uri);
            return canvas;
    };
    createObjectUrl = (array:Array<any>, options:any)=>{
        const blob = new Blob(array, options);
        const objectUrl = URL.createObjectURL(blob);
        return objectUrl;
    };
    GenerateMp4 = async (frameRate?:number,height?:number,width?:number,showLog?:boolean) => {
        height = height? height : this.height;
        width = width ? width : this.width;
        frameRate = frameRate? frameRate : 60;
        const ffmpeg = createFFmpeg({ log: showLog?showLog:false });
        await ffmpeg.load();
        this.frameBuffer.forEach(async (e,i) => {
            await ffmpeg.FS("writeFile",`image${i}.png`,await fetchFile(e));
        });
        await ffmpeg.run("-r" ,`${frameRate}`,"-analyzeduration", "6000M","-probesize", "6000M",'-i','image%d.png',"-pix_fmt" ,"yuv420p" ,"-s" ,`${width}x${height}`, 'output.mp4');
        const data = ffmpeg.FS("readFile",'output.mp4');
        const objectUrl = this.createObjectUrl([data.buffer], { type: 'video/mp4' });
        console.log(objectUrl);
        return objectUrl;
    }
}

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

type CodeColors = {
    normal:string;
    reserved:string;
    operator:string;
    commentout:string;
}

export class GLSL2MP4{
    width:number;
    height:number;
    showTextMode:boolean;
    fontName:string;
    fontSize:number;
    padding:number;
    spacing:number;
    codeColors:CodeColors;
    gl:WebGLRenderingContext;
    renderer:THREE.WebGLRenderer;
    camera:THREE.OrthographicCamera;
    material:THREE.RawShaderMaterial;
    scene:THREE.Scene;
    mesh:THREE.Mesh;
    uniforms:{ [uniform: string]: THREE.IUniform };
    src:string;
    displaySrc:string;
    frameBuffer:Array<string>;
    canvas2D:HTMLCanvasElement;

    constructor(width:number,height:number,uniforms?:{ [uniform: string]: THREE.IUniform },src?:string,showTextMode?:boolean) {
        this.width = width;
        this.height = height;
        this.showTextMode = showTextMode?showTextMode : false;
        this.fontName = "Monospace";
        this.fontSize = 12;
        this.padding = 5;
        this.spacing = 2;
        this.frameBuffer = new Array<string>();
        this.codeColors = {
            normal:"rgb(255,255,255)",
            reserved:"rgb(255,0,0)",
            operator:"rgb(0,255,0)",
            commentout:"rgb(100,100,100)"
        }
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
        this.displaySrc = "";
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

    SetShader(src:string,displaySrc?:string){
        this.src = src;
        this.displaySrc = displaySrc ? displaySrc : "";
        this.mesh.material = new THREE.RawShaderMaterial({
            vertexShader:vertex,
            fragmentShader:src,
            uniforms:this.uniforms
        })

    }
    SetUniform(uniforms:{ [uniform: string]: THREE.IUniform }){
        this.uniforms = uniforms;
        this.mesh.material = new THREE.RawShaderMaterial({
            vertexShader:vertex,
            fragmentShader:this.src,
            uniforms:uniforms
        });

    }

    AddFrame:() => HTMLCanvasElement = () => {
        this.renderer.render(this.scene,this.camera);
        const canvas = this.gl.canvas as HTMLCanvasElement;
        const context = this.canvas2D.getContext("2d") as CanvasRenderingContext2D;
        context.drawImage(canvas,0,0);
        if(this.showTextMode){
            if(this.displaySrc){
                this.drawGLSLCode(context,this.displaySrc);
            }else{
                this.drawGLSLCode(context,this.src);
            }
        }
        const uri = this.canvas2D.toDataURL();
        this.frameBuffer.push(uri);
        return canvas;
    };
    createObjectUrl = (array:Array<any>, options:any)=>{
        const blob = new Blob(array, options);
        const objectUrl = URL.createObjectURL(blob);
        return objectUrl;
    };

    drawGLSLCode = (context:CanvasRenderingContext2D,src:string) => {
        const operatorRexExp = new RegExp("\\+|\\-|\\*|/|%");
        const spaceRegExp = new RegExp("\\s|\\t|;");
        const commentoutRegExp = new RegExp("(//)");
        const typeRegExp = new RegExp("(int)|(float)|(vec2)|(vec3)|(vec4)|(sampler2D)|(void)|(uniform)|(in)|(out)|(precision)|(highp)|(mediump)|(lowp)");
        const bracketsRegExp = new RegExp("\\(|\\)");
        const splitRegExp = new RegExp(`${commentoutRegExp.source}|${spaceRegExp.source}|${operatorRexExp.source}|${bracketsRegExp.source}`,"g");
        const split = src.split('\n');
        context.font = `bold ${this.fontSize}px ${this.fontName}`;
        for(let i = 0; i < split.length; i++){
            let beginIndex = 0;
            let endIndex = 0;
            let x = this.padding;
            const totalWidth = context.measureText(split[i]).width;
            context.fillStyle = "rgba(0,0,0,0.5)";
            context.fillRect(this.padding,this.fontSize * i + this.spacing * (i+1)+this.padding,totalWidth,this.fontSize + this.spacing);
            while(true){
                const regres = splitRegExp.exec(split[i]);
                if(regres){
                    endIndex = splitRegExp.lastIndex;
                    //文節を取り出す
                    const phrase = split[i].substring(beginIndex,endIndex - regres[0].length);
                    //文節のレンダリング
                    let width = context.measureText(phrase).width;
                    context.fillStyle = (typeRegExp.test(phrase))?this.codeColors.reserved:this.codeColors.normal;
                    context.fillText(phrase,x,(this.fontSize + this.spacing) * (i + 1)+this.padding);
                    x += width;
                    const separator = regres[0];
                    //separatorのレンダリング
                    //TODO コメントアウトの分岐　各々着色
                    if(commentoutRegExp.test(separator)){
                        let width = context.measureText(separator).width;
                        context.fillStyle = this.codeColors.commentout;
                        context.fillText(separator,x,(this.fontSize + this.spacing) * (i + 1)+this.padding);
                        x += width;
                        beginIndex = endIndex;
                        endIndex = split[i].length;
                        const phrase = split[i].substring(beginIndex,endIndex);
                        width = context.measureText(phrase).width;
                        context.fillStyle = (typeRegExp.test(phrase))?this.codeColors.reserved:this.codeColors.normal;
                        context.fillText(phrase,x,(this.fontSize + this.spacing) * (i + 1)+this.padding);
                        x += width;


                        break;

                    }
                    width = context.measureText(separator).width;
                    context.fillStyle = this.codeColors.operator;
                    context.fillText(separator,x,(this.fontSize + this.spacing) * (i + 1)+this.padding);
                    x += width;
                    beginIndex = endIndex;
                }else{
                    endIndex = split[i].length;
                    context.fillStyle = this.codeColors.normal;
                    const phrase = split[i].substring(beginIndex,endIndex);
                    //レンダリング
                    context.fillText(phrase,x,(this.fontSize + this.spacing) * (i + 1)+this.padding);

                    break;
                }
            }
        }
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

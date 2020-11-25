# glsl2mp4
generate mp4 from glsl(THREE+webGLCanvas) with ffmpeg.wasm

# install
```
// for npm
npm install https://github.com/Hirai0827/glsl2mp4
// for yarn
yarn add https://github.com/Hirai0827/glsl2mp4
```

#usage
```js
const converter = new GLSL2MP4(500,500);
converter.SetShader(fragmentShaderStr);
for(let i = 0.0;i < 60; i+=1.0){
  context.drawImage(canvas,0,0);
  converter.SetUniform({iTime:{value:i/60.0},iResolution:{value:new THREE.Vec3(500,500,1)}});
  converter.AddFrame(canvasRef.current);
}
converter.GenerateMp4(30).then(e => {todoWithVideo(e)/*something todo video*/;});

```

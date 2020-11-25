//import * as tf from "@tensorflow/tfjs";
import * as tf from '@tensorflow/tfjs-core';
import '@tensorflow/tfjs-backend-webgl';
import * as blazeface from "@tensorflow-models/blazeface";
import vs from "./pos.vert";
import shader from "./shader.frag";
import sobel from "./shaders/sobel.frag";
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { FXAAShader } from "three/examples/jsm/shaders/FXAAShader.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { GlitchPass } from "three/examples/jsm/postprocessing/GlitchPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";

import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";

import TTFLoader from './TTFLoader';
const loader = new TTFLoader();
const fontLoader = new THREE.FontLoader();
     //assets/fonts/Jackerton-Free-Regular.otf
const fontName = "/fonts/FugazOne-Regular.ttf";//Jackerton-Free-Regular.otf";



tf.setBackend('webgl');
const WIDTH = 640.0;
const HEIGHT = 480.0;
let MODEL = null;
let FACE_MODEL = null;

(async () => {
  MODEL = await blazeface.load();
})();

const faceLandmarksDetection = require('@tensorflow-models/face-landmarks-detection');
(async()=>{
  FACE_MODEL = await faceLandmarksDetection.load(
    faceLandmarksDetection.SupportedPackages.mediapipeFacemesh);

})();

function createMaterial(type, color) {
  let mat =
    type == "basic"
      ? new THREE.MeshBasicMaterial()
      : new THREE.MeshStandardMaterial();

  mat.color.set(color);
  if (type == "standard") {
    mat.metalness = 0.25;
    mat.roughness = 0.75;
  }

  // mat.onBeforeCompile = function(shader) {
  //   shader.uniforms.time = { value: 1.0 };
  //   shader.uniforms.isTip = { value: 0.0 };

  //   shader.vertexShader =
  //     `uniform float time;
  //    uniform float isTip;
  //    attribute vec3 instPosition;
  //    attribute vec2 instUv;
  //   ` +
  //     noise + // see the script in the html-section
  //     shader.vertexShader;
  //   shader.vertexShader = shader.vertexShader.replace(
  //     `#include <begin_vertex>`,
  //     `
  //     vec3 transformed = vec3( position );

  //     vec3 ip = instPosition;
  //     vec2 iUv = instUv;
  //     iUv.y += time * 0.125;
  //     iUv *= vec2(3.14);
  //     float wave = snoise( vec3( iUv, 0.0 ) );

  //     ip.y = wave * 3.5;
  //     float lim = 2.0;
  //     bool tip = isTip < 0.5 ? ip.y > lim : ip.y <= lim;
  //     transformed *= tip ? 0.0 : 1.0;

  //     transformed = transformed + ip;
  //   `
  //   );
  //   materialShaders.push({
  //     id: "mat" + materialShaders.length,
  //     shader: shader,
  //     isTip: isTip,
  //     changeColor: changeColor
  //   });
  //   materialInst.push(mat);
  // };
  
  return mat;
}

const darkMaterial = createMaterial("basic", 0x000000);




const style = document.createElement("style");
style.innerHTML = `ul {
    list-style-type: none;
    margin: 0 0 5 0;
    padding: 0;
    overflow: hidden;
    background-color: #333333;
  }

  li {
    float: left;
  }

  li a {
    display: block;
    color: white;
    text-align: center;
    padding: 16px;
    text-decoration: none;
  }

  li a:hover {
    background-color: #111111;
  }

  .wrapper {
    position: relative;
    width: ${WIDTH};
    height: ${HEIGHT};
    float: left;
  }

  .wrapper canvas {
      position: absolute;
      top: 0;
      left: 0;
  }
`;
document.head.appendChild(style);

const menu = document.createElement("ul");
menu.innerHTML = `<li><a href="#home">Home</a></li><li><a href="#a">A</a></li>`;
document.body.appendChild(menu);

const btn = document.createElement("button");
btn.innerHTML = "Start";
btn.id = "btnStart";
btn.style = "float: right;";
document.body.appendChild(btn);

const btnPlus = document.createElement("button");
btnPlus.innerHTML = "+";
btnPlus.id = "btnPlus";
btnPlus.style = "float: right;";
document.body.appendChild(btnPlus);

const btnMinus = document.createElement("button");
btnMinus.innerHTML = "-";
btnMinus.id = "btnMinus";
btnMinus.style = "float: right;";
document.body.appendChild(btnMinus);

const video = document.createElement("video");
video.style = "float:left;display:none;";
document.body.appendChild(video);

const gl_div = document.createElement("div");
gl_div.width = WIDTH;
gl_div.height = HEIGHT;
gl_div.className = "wrapper";
document.body.appendChild(gl_div);

const canv = document.createElement("canvas");
canv.id = "debug";
canv.width = WIDTH;
canv.height = HEIGHT;

var renderer = new THREE.WebGLRenderer();
renderer.setSize(WIDTH, HEIGHT);
renderer.setClearColor(0x000000);

let mytarget = new THREE.WebGLRenderTarget(WIDTH * 0.75, HEIGHT * 0.75);
let effcomposer = new EffectComposer(renderer, mytarget);

const rtScene = new THREE.Scene();
rtScene.background = new THREE.Color("red");

const drawRect = (contxt, x1, y1, x2, y2) => {
  contxt.beginPath();
  contxt.rect(x1, y1, x2 - x1, y2 - y1);
  contxt.lineWidth = 5;
  contxt.strokeStyle = "#ffffff";
  contxt.stroke();
};

let state = 0;

// starting --------------------------------------------------------
btn.addEventListener("click", async () => {
  btnPlus.addEventListener("click", () => {
    state = state < 2 ? state + 1 : state;
  });

  btnMinus.addEventListener("click", () => {
    state = state > 0 ? state - 1 : state;
  });

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: {
      facingMode: "user",
      width: WIDTH,
      height: HEIGHT,
    },
  });

  video.srcObject = stream;
  await video.play();

  //SELECTIVE BLOOM PRESERVING RENDER TARGET BACKGROUND CLEARCOLOR
  const ENTIRE_SCENE = 0,
  BLOOM_SCENE = 1;
  var bloomLayer = new THREE.Layers();
  bloomLayer.set(BLOOM_SCENE);



  var texture = new THREE.VideoTexture(video);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.format = THREE.RGBFormat;

  var scene = new THREE.Scene();

  let camera = new THREE.OrthographicCamera(
    WIDTH / -2,
    WIDTH / 2,
    HEIGHT / 2,
    HEIGHT / -2,
    0.1,
    1000
  );

  camera.position.z = WIDTH / 2.0;
  camera.lookAt(new THREE.Vector3(0.0, 0.0, 0.0));
  // camera.zoom = 1.0;

  var geometry = new THREE.PlaneGeometry(WIDTH * 0.75, HEIGHT * 0.75, -10.0);

  var shaderMaterial = new THREE.ShaderMaterial({
    vertexShader: vs,
    fragmentShader: shader,
    transparent: true,
    uniforms: {
      time: { value: 0.0 },
      opacity: { value: 0.8 },
      color: { value: new THREE.Vector3(1.0, 0.0, 0.0) },
      resolution: { value: new THREE.Vector2() },
      map: { value: texture },
      swtch: { value: 1 },
    },
  });

  var sobelShader = {
    vertexShader: vs,
    fragmentShader: sobel,
    uniforms: {
      threshold: { value: 1.0 },
      uWindow: {
        value: new THREE.Vector2(WIDTH, HEIGHT),
      },
    },
  };




  var imageObject = new THREE.Mesh(
    new THREE.PlaneGeometry(WIDTH, HEIGHT),
    new THREE.MeshBasicMaterial({ map: texture }),);


  scene.add(imageObject);

  var plane = new THREE.Mesh(geometry, shaderMaterial);
  //Below enables the sobel filter which ends up removing our geometry because we dont render it to the target
  //scene.add(plane);

  gl_div.appendChild(renderer.domElement);
  gl_div.appendChild(canv);

  var renderPass = new RenderPass(scene, camera);
  //TODO: reenable to render to screen
  //effcomposer.addPass(renderPass);

  //let sobelPass = new ShaderPass(sobelShader);
  //sobelPass.renderToScreen = false;
  //effcomposer.addPass(sobelPass);

  var glitchPass = new GlitchPass();
  glitchPass.renderToScreen = true;
  //TODO: reenable on appropriate composer
  // effcomposer.addPass(glitchPass);


  var fxaaPass = new ShaderPass( FXAAShader );

  const pixelRatio = renderer.getPixelRatio();

  fxaaPass.material.uniforms[ 'resolution' ].value.x = 1 / ( WIDTH * pixelRatio );
  fxaaPass.material.uniforms[ 'resolution' ].value.y = 1 / ( HEIGHT * pixelRatio );
  //TODO: Reenable 
  //effcomposer.addPass(fxaaPass);


  //SELECTIVE BLOOM PRESERVING RENDER TARGET BACKGROUND CLEARCOLOR
  
  var bloomPass = new UnrealBloomPass(new THREE.Vector2(WIDTH, HEIGHT),
         0.6, 0.1, 0.2);
  //TODO: remove imageObject from the render pass allowing selective bloom
  //effcomposer.addPass(bloomPass);
  var bloomComposer = new EffectComposer(renderer);
  bloomComposer.renderToScreen = false;
  bloomComposer.setSize(
    window.innerWidth * window.devicePixelRatio,
    window.innerHeight * window.devicePixelRatio
  );
  bloomComposer.addPass(renderPass);
  bloomComposer.addPass(bloomPass);

  var finalPass = new ShaderPass(
  new THREE.ShaderMaterial({
      uniforms: {
        baseTexture: { value: null },
        bloomTexture: { value: bloomComposer.renderTarget2.texture }
      },
      vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 ); }`,
      fragmentShader: `
     
      uniform sampler2D baseTexture; 
      uniform sampler2D bloomTexture; 
      varying vec2 vUv; 
      vec4 getTexture( sampler2D tt ) { 
        return linearToOutputTexel( texture( tt , vUv ) ); 
      } 
      void main() { 
        gl_FragColor = ( getTexture( baseTexture ) + vec4( 1.0 ) * getTexture(bloomTexture ) ); 
      }`,
      defines: {'USE_MAP':''}
    }),
    "baseTexture"
  );
  finalPass.needsSwap = true;
  var finalComposer = new EffectComposer(renderer);
  finalComposer.setSize(
    window.innerWidth * window.devicePixelRatio,
    window.innerHeight * window.devicePixelRatio
  );
  finalComposer.addPass(renderPass);
  finalComposer.addPass(finalPass);

  var materials = {};
  function renderBloom() {
    scene.traverse(darkenNonBloomed);
    bloomComposer.render();
    scene.traverse(restoreMaterial);
  }
  function darkenNonBloomed(obj) { // non-bloomed stuff must be black, including scene background
    if (obj.isMesh && bloomLayer.test(obj.layers) === false) {
      materials[obj.uuid] = obj.material;
      obj.material = darkMaterial;
    }
    renderer.setClearColor(0x000000);
  }
  function restoreMaterial(obj) {
    if (materials[obj.uuid]) {
      obj.material = materials[obj.uuid];
      delete materials[obj.uuid];
    }
    renderer.setClearColor(0x332233);
  }

  let d = 0;

  var textGeo;
  var textMesh1;
  const height = 10,
        size = 80,
        hover = 30,

        curveSegments = 64,

        bevelThickness = .0,//2,
        bevelSize = .0,//1.5,
        bevelEnabled = false;
  (async () => {
    await loader.load(fontName,fnt =>{
      var font = fontLoader.parse(fnt)
      textGeo = new THREE.TextGeometry( 'MUTE', {
        font: font,
      // size: 100,
       
      // curveSegments: 32,
      // bevelEnabled: true,
      // bevelThickness: 6,
      // bevelSize: 2.5,
      // bevelOffset: 0,
      // bevelSegments: 8,
                size: size,
          height: height,
          curveSegments: curveSegments,

          bevelThickness: bevelThickness,
          bevelSize: bevelSize,
          bevelEnabled: bevelEnabled
    } );

    textGeo.computeBoundingBox();
    textGeo.computeVertexNormals();
    
    const centerOffset = - 0.5 * ( textGeo.boundingBox.max.x - textGeo.boundingBox.min.x );


    var textMaterial = createMaterial('basic', 0xc4f735) ;
    // new THREE.MeshBasicMaterial( 
    //     { color: 0xc4f735 }
    // );
    textGeo = new THREE.BufferGeometry().fromGeometry( textGeo );

  //setGradient(textGeo, cols, 'z', rev);
  // var mat = new THREE.MeshBasicMaterial({
  //   vertexColors: THREE.VertexColors,
  //   wireframe: false
  // });
  // var obj = new THREE.Mesh(textGeo, mat);
  //scene.add(obj);
  textMesh1 = new THREE.Mesh( textGeo, textMaterial );

        textMesh1.position.x = centerOffset;
        textMesh1.position.y = hover;
        textMesh1.position.z = 0;

        textMesh1.rotation.x = 0;
        //textMesh1.rotation.y = Math.PI * 2;


  // //var fontMesh = new THREE.Mesh( textGeometry, textMaterial );
  textMesh1.layers.enable(BLOOM_SCENE);
  scene.add( textMesh1 );

  //console.log(fontMesh.position);


      

      
    });


  })();

  async function animate() {
    const faces =  await MODEL.estimateFaces(video, false);
    //  const predictions = await FACE_MODEL.estimateFaces({
    //     input: video ,  
    //   returnTensors: false,
    // flipHorizontal: false,
    // predictIrises: state.predictIrises});
    canv.getContext("2d").clearRect(0, 0, WIDTH, HEIGHT);

    if (faces && faces[0] && state) {
      d = Math.abs(320 - faces[0].landmarks[2][0]) / 320.0;

      if (state > 1) {
        faces[0].landmarks.map((lm) => {
          drawRect(
            canv.getContext("2d"),
            Math.round(lm[0]) - 5,
            Math.round(lm[1]) - 5,
            Math.round(lm[0]) + 5,
            Math.round(lm[1] + 5)
          );
        });

        drawRect(
          canv.getContext("2d"),
          Math.round(faces[0].topLeft[0]),
          Math.round(faces[0].topLeft[1]),
          Math.round(faces[0].bottomRight[0]),
          Math.round(faces[0].bottomRight[1])
        );
      }
      const vector = new THREE.Vector3();
      const centerOffsetX = - 0.5 * ( textGeo.boundingBox.max.x - textGeo.boundingBox.min.x );
      const centerOffsetY = - 0.5 * ( textGeo.boundingBox.max.y- textGeo.boundingBox.min.y );
      vector.set( faces[0].landmarks[3][0] - (WIDTH/2) + centerOffsetX, 
        faces[0].landmarks[3][1] * -1 + HEIGHT/2 + centerOffsetY , ( camera.near + camera.far ) / ( camera.near - camera.far ) );
      
      //TODO: scale text with bounding box size 
      // var sizeH = boxH.getSize(); // get the size of the bounding box of the house
      // var sizeO = boxO.getSize(); // get the size of the bounding box of the obj
      // var ratio = sizeH.divide( sizeO )
      // textMesh1.scale(1/ratio);

      textMesh1.position.copy(vector);
    }

    //glitchPass.renderToScreen = d > 0.15;
    shaderMaterial.uniforms.time.value += 0.05;
    //sobelPass.uniforms.threshold.value = d > 0.05 ? 500 * d * d : 0.0;

    //effcomposer.render();


    renderBloom();
  // render the entire scene, then render bloom scene on top
    finalComposer.render();

    requestAnimationFrame(animate);
  }
  requestAnimationFrame(animate);
});

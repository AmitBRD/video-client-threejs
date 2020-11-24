import * as tf from "@tensorflow/tfjs";
import * as blazeface from "@tensorflow-models/blazeface";
import vs from "./pos.vert";
import shader from "./shader.frag";
import sobel from "./shaders/sobel.frag";
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { GlitchPass } from "three/examples/jsm/postprocessing/GlitchPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";

import TTFLoader from './TTFLoader';
const loader = new TTFLoader();
const fontLoader = new THREE.FontLoader();
     //assets/fonts/Jackerton-Free-Regular.otf
const fontName = "/fonts/FugazOne-Regular.ttf";//Jackerton-Free-Regular.otf";



const WIDTH = 640.0;
const HEIGHT = 480.0;
let MODEL = null;

(async () => {
  MODEL = await blazeface.load();
})();

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
video.style = "float:left;";
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
  effcomposer.addPass(renderPass);

  let sobelPass = new ShaderPass(sobelShader);
  sobelPass.renderToScreen = false;
  //effcomposer.addPass(sobelPass);

  var glitchPass = new GlitchPass();
  glitchPass.renderToScreen = true;
  effcomposer.addPass(glitchPass);


  var bloomPass = new UnrealBloomPass(new THREE.Vector2(WIDTH, HEIGHT),
         0.8, 0.1, 0.7);
  effcomposer.addPass(bloomPass);

  let d = 0;

  var textGeo;
  var textMesh1;
  const height = 80,
        size = 120,
        hover = 30,

        curveSegments = 32,

        bevelThickness = 2,
        bevelSize = 1.5,
        bevelEnabled = false;
  (async () => {
    await loader.load(fontName,fnt =>{
      var font = fontLoader.parse(fnt)
      textGeo = new THREE.TextGeometry( 'MUTE', {
        font: font,
      // size: 100,
      // height: 10,
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

 var textMaterial = new THREE.MeshBasicMaterial( 
    { color: 0xc4f735 }
  );
  textGeo = new THREE.BufferGeometry().fromGeometry( textGeo );
  textMesh1 = new THREE.Mesh( textGeo, textMaterial );

        textMesh1.position.x = centerOffset;
        textMesh1.position.y = hover;
        textMesh1.position.z = 0;

        textMesh1.rotation.x = 0;
        //textMesh1.rotation.y = Math.PI * 2;


  //var fontMesh = new THREE.Mesh( textGeometry, textMaterial );

  scene.add( textMesh1 );

  //console.log(fontMesh.position);


      

      
    });


  })();

  async function animate() {
    const faces = await MODEL.estimateFaces(video, false);
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
       
      console.log(vector)
      textMesh1.position.copy(vector);
      //vector.unproject( camera );
      //console.log(vector)
    }

    glitchPass.renderToScreen = d > 0.05;
    shaderMaterial.uniforms.time.value += 0.05;
    sobelPass.uniforms.threshold.value = d > 0.05 ? 500 * d * d : 0.0;

    effcomposer.render();
    requestAnimationFrame(animate);
  }
  requestAnimationFrame(animate);
});

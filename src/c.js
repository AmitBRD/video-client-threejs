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
import { FaceMeshFaceGeometry } from "./FaceMeshFaceGeometry/face.js";
import { FACES as indices  } from "./FaceMeshFaceGeometry/geometry.js";
//https://ada.is/blog/2020/10/29/curve-modifiers-in-threejs/
import { InstancedFlow } from "three/examples/jsm/modifiers/CurveModifier.js";
import { HeartRateSocket } from "./socket.js";

import TTFLoader from './TTFLoader';


import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
const gltfLoader = new GLTFLoader();
const crownModelLocation = '/model/fall_guys_crown/scene.gltf';

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
    faceLandmarksDetection.SupportedPackages.mediapipeFacemesh,{maxFaces:1});

})();

let UPDATE_TEXT = false;
let TEXT_VALUE = "";
const socket = new HeartRateSocket("ws://127.0.0.1:8013/web-socket/", function(data){
  UPDATE_TEXT = true;
  TEXT_VALUE = Math.trunc(data["heartRate"])+"bpm";
});

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
      width: WIDTH/2,
      height: HEIGHT/2,
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

  camera.position.z = WIDTH ;
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

  const directionalLight = new THREE.DirectionalLight( 0xffffff, 0.5 );
  scene.add( directionalLight );
  const cgeom = new THREE.PlaneGeometry(WIDTH/2, HEIGHT/2);// new THREE.CircleGeometry( WIDTH*0.25, 32 );
  const material = new THREE.MeshBasicMaterial( { color: 0xffff00 } );
  const circle = new THREE.Mesh( new THREE.CircleGeometry( WIDTH*0.15, 32 ), material );
  //scene.add( circle );

  var imageObject = new THREE.Mesh(
    cgeom,
    new THREE.MeshBasicMaterial({ map: texture, transparent:true, opacity:0.5 }),);

  imageObject.position.setZ(-150);
  imageObject.position.setX(-WIDTH/4);
  imageObject.position.setY(HEIGHT/4);
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
         0.6, 0.2, 0.3);
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

  const loader = new TTFLoader();
  const fontLoader = new THREE.FontLoader();
     //assets/fonts/Jackerton-Free-Regular.otf
  const fontName = "/fonts/FugazOne-Regular.ttf";//Jackerton-Free-Regular.otf";

  var textGeo;
  var textMesh1;
  var textMaterial;
  var font;
  const height = 1,
        size = 40,
        hover = 30,

        curveSegments = 64,

        bevelThickness = .0,//2,
        bevelSize = .0,//1.5,
        bevelEnabled = false;
  (async () => {
    await loader.load(fontName,fnt =>{
      font = fontLoader.parse(fnt)
      textGeo = new THREE.TextGeometry( 'BRD', {
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


    textMaterial = //createMaterial('basic', 0xc4f735) ;
    new THREE.MeshToonMaterial( 
        { color: 0xc3f746,
         transparent:true,
         opacity: 0.8, 
         emissive:0xc4f730,
         emissiveIntensity:0.5
       }
    );
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

  // const rot = new THREE.Matrix4().makeRotationX(-Math.PI / 4);
  // textMesh1.geometry.applyMatrix4(rot);

  //console.log(fontMesh.position);


      

      
    });


  })();

  function updateText(data){
    textMesh1.geometry.dispose();
        //textMesh1.material.dispose();
    scene.remove(textMesh1);


    textGeo = new THREE.TextGeometry( data , {
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
  }


  // Load a glTF resource
  gltfLoader.load(
    // resource URL
    crownModelLocation,
    // called when the resource is loaded
    function ( gltf ) {
      gltf.scene.scale.multiplyScalar(30);
      gltf.scene.position.z = -30; 

      scene.add( gltf.scene);

      // gltf.animations; // Array<THREE.AnimationClip>
      // gltf.scene; // THREE.Group
      // gltf.scenes; // Array<THREE.Group>
      // gltf.cameras; // Array<THREE.Camera>
      // gltf.asset; // Object

    },
    // called while loading is progressing
    function ( xhr ) {

      console.log( ( xhr.loaded / xhr.total * 100 ) + '% loaded' );

    },
    // called when loading has errors
    function ( error ) {

      console.log( 'An error happened' );

    }
  );

  const faceGeometry = new FaceMeshFaceGeometry({ useVideoTexture: false });
  faceGeometry.setSize(WIDTH, HEIGHT);
  // Create mask mesh.
  const maskMaterial = new THREE.MeshToonMaterial({'color':0xff0000})
  const mask = new THREE.Mesh(faceGeometry, maskMaterial);
  scene.add(mask);
  mask.receiveShadow = mask.castShadow = true;

  const rightEye = new THREE.Mesh(new THREE.BoxBufferGeometry(1, 1, 1), createMaterial('basic', 0xff0000 ));
  //rightEye.castShadow = rightEye.receiveShadow = true;
  
   //TODO: if tracking face mesh
  //scene.add(rightEye);
  rightEye.scale.setScalar(20);

  function drawPath(ctx, points, closePath) {
  const region = new Path2D();
  region.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) {
    const point = points[i];
    region.lineTo(point[0], point[1]);
  }

  if (closePath) {
    region.closePath();
  }
  ctx.stroke(region);
  }


 

  async function animate() {
    const faces = null;
    //await MODEL.estimateFaces(video, false); 
    //canv.getContext("2d").clearRect(0, 0, WIDTH, HEIGHT);

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
      const scale =  ((faces[0].bottomRight[0] - faces[0].topLeft[0])/(WIDTH/2));
      textMesh1.scale.set(scale,scale,1);

      const scaleOffset =  textMesh1.position.clone().multiplyScalar(scale);
      
      const centerOffsetX = (- 0.5 * ( textGeo.boundingBox.max.x - textGeo.boundingBox.min.x ))*scale;
      const centerOffsetY = (- 0.5 * ( textGeo.boundingBox.max.y- textGeo.boundingBox.min.y ))*scale;
      //vector.set( faces[0].landmarks[3][0] - (WIDTH/2) + centerOffsetX, 
      //  faces[0].landmarks[3][1] * -1 + HEIGHT/2 + centerOffsetY , ( camera.near + camera.far ) / ( camera.near - camera.far ) );
       vector.set( (faces[0].topLeft[0]- (WIDTH/2) +centerOffsetX) , 
        (faces[0].topLeft[1] * -1 + HEIGHT/2 + centerOffsetY ) , ( camera.near + camera.far ) / ( camera.near - camera.far ) );
      //TODO: scale text with bounding box size 
      // var sizeH = boxH.getSize(); // get the size of the bounding box of the house
      // var sizeO = boxO.getSize(); // get the size of the bounding box of the obj
      // var ratio = sizeH.divide( sizeO )
      
      console.log("SCALE:",scale, textMesh1.position);
      textMesh1.position.copy(vector);
     

    }
    var predictions = null;
     if(!faces){
       predictions = await FACE_MODEL.estimateFaces({
          input: video ,  
        returnTensors: false,
      flipHorizontal: false,
      predictIrises: false});
     }
     canv.getContext("2d").clearRect(0, 0, WIDTH, HEIGHT);
    if (!faces && predictions.length > 0) {
      predictions.forEach(prediction => {
        faceGeometry.update(prediction, false);
        //const trackRightEye = faceGeometry.track(417, 445, 450);
        //rightEye.position.copy(trackRightEye.position);
        //rightEye.rotation.setFromRotationMatrix(trackRightEye.rotation);

         //https://github.com/google/mediapipe/blob/master/mediapipe/modules/face_geometry/data/canonical_face_model_uv_visualization.png
        //const trackHalo = faceGeometry.track(151, 352,123);
         if(UPDATE_TEXT){
           updateText(TEXT_VALUE);
           UPDATE_TEXT = false;
         }
        

         //const trackHalo = faceGeometry.track(208, 428, 175);

           //nose
          const trackHalo = faceGeometry.track(5, 275,45 );
          
          //TODO: the constant height above (e.g. 30 ) needs to be scaled to the change in landmark position. use the face
          //bounding box to infact track the scale change as face detection 
          const offsetVector = new THREE.Vector3(- 0.5 * ( textGeo.boundingBox.max.x - textGeo.boundingBox.min.x ) - 80,
            - 0.5 * ( textGeo.boundingBox.max.y - textGeo.boundingBox.min.y ) + 30);
          offsetVector.applyMatrix4(trackHalo.rotation);
          textMesh1.position.copy(trackHalo.position);
          //textMesh1.position.setX(textMesh1.position.x+ centerOffsetX);
          //textMesh1.position.setY(textMesh1.position.y);
          //textMesh1.position.setZ(textMesh1.position.z - 100);
          //textMesh1.position.setZ(( camera.near + camera.far ) / ( camera.near - camera.far ) );
          //https://github.com/spite/FaceMeshFaceGeometry/blob/372b9e6a824af057e1a2e40b6c3b2827c7c0d410/examples/video/main.js#L207
           textMesh1.rotation.setFromRotationMatrix(trackHalo.rotation);
           textMesh1.position.add(offsetVector);

        if (state > 1) {
          const keypoints = prediction.scaledMesh;
          const GREEN = '#32EEDB';
          const ctx = canv.getContext("2d")
          ctx.fillStyle = GREEN;
          const NUM_KEYPOINTS = 468;
          ctx.strokeStyle = GREEN;
          ctx.lineWidth = 0.5;

          for (let i = 0; i < indices.length / 3; i++) {
            const points = [
              indices[i * 3], indices[i * 3 + 1],
              indices[i * 3 + 2]
            ].map(index => keypoints[index]);

            //TODO: enable to see triangles on face
            drawPath(ctx, points, true);
            }
        }
      });
    /*
    `predictions` is an array of objects describing each detected face, for example:
 
    [
      {
        faceInViewConfidence: 1, // The probability of a face being present.
        boundingBox: { // The bounding box surrounding the face.
          topLeft: [232.28, 145.26],
          bottomRight: [449.75, 308.36],
        },
        mesh: [ // The 3D coordinates of each facial landmark.
          [92.07, 119.49, -17.54],
          [91.97, 102.52, -30.54],
          ...
        ],
        scaledMesh: [ // The 3D coordinates of each facial landmark, normalized.
          [322.32, 297.58, -17.54],
          [322.18, 263.95, -30.54]
        ],
        annotations: { // Semantic groupings of the `scaledMesh` coordinates.
          silhouette: [
            [326.19, 124.72, -3.82],
            [351.06, 126.30, -3.00],
            ...
          ],
          ...
        }
      }
    ]
    */
 
    // for (let i = 0; i < predictions.length; i++) {
    //   const keypoints = predictions[i].scaledMesh;
 
    //   // Log facial keypoints.
    //   for (let i = 0; i < keypoints.length; i++) {
    //     const [x, y, z] = keypoints[i];
 
    //     console.log(`Keypoint ${i}: [${x}, ${y}, ${z}]`);
    //   }
    // }
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

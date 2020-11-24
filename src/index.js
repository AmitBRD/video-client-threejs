import vs from "./pos.vert";
import shader from "./shader.frag";
import * as THREE from "three";

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
}`;
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
gl_div.width = 640;
gl_div.height = 480;
document.body.appendChild(gl_div);

btn.addEventListener("click", async () => {
  btnPlus.addEventListener("click", () => {
    shaderMaterial.uniforms.swtch.value < 5
      ? shaderMaterial.uniforms.swtch.value++
      : 5;
    console.log(shaderMaterial.uniforms.swtch.value);
  });

  btnMinus.addEventListener("click", () => {
    shaderMaterial.uniforms.swtch.value > 1
      ? shaderMaterial.uniforms.swtch.value--
      : 1;
    console.log(shaderMaterial.uniforms.swtch.value);
  });

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: {
      facingMode: "user",
      width: 640,
      height: 480,
    },
  });

  video.srcObject = stream;
  await video.play();

  var texture = new THREE.VideoTexture(video);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.format = THREE.RGBFormat;

  var scene = new THREE.Scene();
  // var camera = new THREE.PerspectiveCamera(
  //   60,
  //   // window.innerWidth / window.innerHeight,
  //   640.0 / 480.0,
  //   1,
  //   1000
  // );

  let camera = new THREE.OrthographicCamera(
    640 / -2,
    640 / 2,
    480 / 2,
    480 / -2,
    0.1,
    1000
  );

  camera.position.z = 320.0;
  camera.zoom = 1.0;

  var geometry = new THREE.PlaneGeometry(480.0, 360.0);
  // var geometry = new THREE.Sphere(new THREE.Vector3(0.0,0.0,0.0), 240.0);
  var material = new THREE.MeshBasicMaterial({
    // color: 0xffff00,
    // side: THREE.DoubleSide,
    map: texture,
  });

  var shaderMaterial = new THREE.ShaderMaterial({
    vertexShader: vs,
    fragmentShader: shader,
    transparent: true,
    uniforms: {
      time: { value: 0.0 },
      opacity: { value: 0.8 },
      color: { value: new THREE.Vector3(1.0, 0.5, 0.0) },
      resolution: { value: new THREE.Vector2() },
      map: { value: texture },
      swtch: { value: 1 },
    },
  });

  // var plane = new THREE.Mesh(geometry, [material, shaderMaterial]);
  var plane = new THREE.Mesh(geometry, shaderMaterial);
  scene.add(plane);

  var renderer = new THREE.WebGLRenderer();
  renderer.setSize(640.0, 480.0);

  gl_div.appendChild(renderer.domElement);

  function animate() {
    // this.shaderMaterial.uniforms.opacity.value = 1;
    shaderMaterial.uniforms.time.value += 0.05;
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
  }
  animate();
});

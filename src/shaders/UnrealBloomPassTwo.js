/**
 * @author spidersharma / http://eduperiment.com/
 *
 * Inspired from Unreal Engine
 * https://docs.unrealengine.com/latest/INT/Engine/Rendering/PostProcessEffects/Bloom/
 */

import {
	AdditiveBlending,
	Color,
	LinearFilter,
	MeshBasicMaterial,
	RGBAFormat,
	ShaderMaterial,
	UniformsUtils,
	Vector2,
	Vector3,
	WebGLRenderTarget
} from 'three';
import { Pass } from 'three/examples/jsm/postprocessing/Pass.js';
import { CopyShader } from 'three/examples/jsm/shaders/CopyShader.js';
import { LuminosityHighPassShader } from 'three/examples/jsm/shaders/LuminosityHighPassShader.js';

var UnrealBloomPass = function ( resolution, strength, radius, threshold, selectedObjects, scene, camera ) {

	Pass.call( this );

	this.strength = ( strength !== undefined ) ? strength : 1;
	this.radius = radius;
	this.threshold = threshold;
	this.resolution = ( resolution !== undefined ) ? new Vector2( resolution.x, resolution.y ) : new Vector2( 256, 256 );

	this.scene = scene;
	this.camera = camera;
	this.selectedObjects = selectedObjects || [];

	// create color only once here, reuse it later inside the render function
	this.clearColor = new Color( 0, 0, 0 );

	// render targets
	var pars = { minFilter: LinearFilter, magFilter: LinearFilter, format: RGBAFormat };
	this.renderTargetsHorizontal = [];
	this.renderTargetsVertical = [];
	this.nMips = 5;
	var resX = Math.round( this.resolution.x / 2 );
	var resY = Math.round( this.resolution.y / 2 );

	this.renderTargetSelectedObjects = new WebGLRenderTarget( resX, resY, pars );
	this.renderTargetSelectedObjects.texture.name = "UnrealBloomPass.selectedObjects";
	this.renderTargetSelectedObjects.texture.generateMipmaps = false;

	this.renderTargetBright = new WebGLRenderTarget( resX, resY, pars );
	this.renderTargetBright.texture.name = "UnrealBloomPass.bright";
	this.renderTargetBright.texture.generateMipmaps = false;

	for ( var i = 0; i < this.nMips; i ++ ) {

		var renderTargetHorizonal = new WebGLRenderTarget( resX, resY, pars );

		renderTargetHorizonal.texture.name = "UnrealBloomPass.h" + i;
		renderTargetHorizonal.texture.generateMipmaps = false;

		this.renderTargetsHorizontal.push( renderTargetHorizonal );

		var renderTargetVertical = new WebGLRenderTarget( resX, resY, pars );

		renderTargetVertical.texture.name = "UnrealBloomPass.v" + i;
		renderTargetVertical.texture.generateMipmaps = false;

		this.renderTargetsVertical.push( renderTargetVertical );

		resX = Math.round( resX / 2 );

		resY = Math.round( resY / 2 );

	}

	// luminosity high pass material

	if ( LuminosityHighPassShader === undefined )
		console.error( "UnrealBloomPass relies on LuminosityHighPassShader" );

	var highPassShader = LuminosityHighPassShader;
	this.highPassUniforms = UniformsUtils.clone( highPassShader.uniforms );

	this.highPassUniforms[ "luminosityThreshold" ].value = threshold;
	this.highPassUniforms[ "smoothWidth" ].value = 0.01;

	this.materialHighPassFilter = new ShaderMaterial( {
		uniforms: this.highPassUniforms,
		vertexShader: highPassShader.vertexShader,
		fragmentShader: highPassShader.fragmentShader,
		defines: {}
	} );

	// Gaussian Blur Materials
	this.separableBlurMaterials = [];
	var kernelSizeArray = [ 3, 5, 7, 9, 11 ];
	var resX = Math.round( this.resolution.x / 2 );
	var resY = Math.round( this.resolution.y / 2 );

	for ( var i = 0; i < this.nMips; i ++ ) {

		this.separableBlurMaterials.push( this.createSeperableBlurMaterial( kernelSizeArray[ i ] ) );

		this.separableBlurMaterials[ i ].uniforms[ "texSize" ].value = new Vector2( resX, resY );

		resX = Math.round( resX / 2 );

		resY = Math.round( resY / 2 );

	}

	// Composite material
	this.bloomFactors = [ 1.0, 0.8, 0.6, 0.4, 0.2 ];
	this.bloomTintColors = [
		new Vector3( 1, 1, 1 ),
		new Vector3( 1, 1, 1 ),
		new Vector3( 1, 1, 1 ),
		new Vector3( 1, 1, 1 ),
		new Vector3( 1, 1, 1 )
	];

	this.compositeMaterial = this.createCompositeMaterial( this.nMips );

	this.blendMaterial = this.createBlendMaterial();

	// copy material
	if ( CopyShader === undefined ) {

		console.error( "UnrealBloomPass relies on CopyShader" );

	}

	var copyShader = CopyShader;

	this.copyUniforms = UniformsUtils.clone( copyShader.uniforms );
	this.copyUniforms[ "opacity" ].value = 1.0;

	this.materialCopy = new ShaderMaterial( {
		uniforms: this.copyUniforms,
		vertexShader: copyShader.vertexShader,
		fragmentShader: copyShader.fragmentShader,
		blending: AdditiveBlending,
		depthTest: false,
		depthWrite: false,
		transparent: true
	} );

	this.enabled = true;
	this.needsSwap = false;

	this.oldClearColor = new Color();
	this.oldClearAlpha = 1;

	this.basic = new MeshBasicMaterial();

	this.fsQuad = new Pass.FullScreenQuad( null );

};

UnrealBloomPass.prototype = Object.assign( Object.create( Pass.prototype ), {

	constructor: UnrealBloomPass,

	dispose: function () {

		for ( var i = 0; i < this.renderTargetsHorizontal.length; i ++ ) {

			this.renderTargetsHorizontal[ i ].dispose();

		}

		for ( var i = 0; i < this.renderTargetsVertical.length; i ++ ) {

			this.renderTargetsVertical[ i ].dispose();

		}

		this.renderTargetBright.dispose();

	},

	setSize: function ( width, height ) {

		var resX = Math.round( width / 2 );
		var resY = Math.round( height / 2 );

		this.renderTargetBright.setSize( resX, resY );

		for ( var i = 0; i < this.nMips; i ++ ) {

			this.renderTargetsHorizontal[ i ].setSize( resX, resY );
			this.renderTargetsVertical[ i ].setSize( resX, resY );

			this.separableBlurMaterials[ i ].uniforms[ "texSize" ].value = new Vector2( resX, resY );

			resX = Math.round( resX / 2 );
			resY = Math.round( resY / 2 );

		}

	},

	render: function ( renderer, writeBuffer, readBuffer, deltaTime, maskActive ) {

		this.oldClearColor.copy( renderer.getClearColor() );
		this.oldClearAlpha = renderer.getClearAlpha();
		var oldAutoClear = renderer.autoClear;
		renderer.autoClear = false;

		renderer.setClearColor( this.clearColor, 0 );

		if ( maskActive ) renderer.state.buffers.stencil.setTest( false );

		if ( this.renderToScreen ) {

			this.fsQuad.material = this.basic;
			if( this.basic.map === null ) this.basic.map = readBuffer.texture;

			renderer.setRenderTarget( null );
			renderer.clear();
			this.fsQuad.render( renderer );

		}

		var applyBuffer = readBuffer;

		if ( this.selectedObjects.length > 0 ) {

			this.changeVisibilityOfNonSelectedObjects( false );

			renderer.setRenderTarget( this.renderTargetSelectedObjects );
			renderer.clear();
			renderer.render( this.scene, this.camera );

			applyBuffer = this.renderTargetSelectedObjects;

			this.changeVisibilityOfNonSelectedObjects( true );

		}

		// 1. Extract Bright Areas
		this.highPassUniforms[ "tDiffuse" ].value = applyBuffer.texture;
		this.highPassUniforms[ "luminosityThreshold" ].value = this.threshold;
		this.fsQuad.material = this.materialHighPassFilter;

		renderer.setRenderTarget( this.renderTargetBright );
		renderer.clear();
		this.fsQuad.render( renderer );

		// 2. Blur All the mips progressively
		var inputRenderTarget = this.renderTargetBright;

		for ( var i = 0; i < this.nMips; i ++ ) {

			this.fsQuad.material = this.separableBlurMaterials[ i ];

			this.separableBlurMaterials[ i ].uniforms[ "colorTexture" ].value = inputRenderTarget.texture;
			this.separableBlurMaterials[ i ].uniforms[ "direction" ].value = UnrealBloomPass.BlurDirectionX;
			renderer.setRenderTarget( this.renderTargetsHorizontal[ i ] );
			renderer.clear();
			this.fsQuad.render( renderer );

			this.separableBlurMaterials[ i ].uniforms[ "colorTexture" ].value = this.renderTargetsHorizontal[ i ].texture;
			this.separableBlurMaterials[ i ].uniforms[ "direction" ].value = UnrealBloomPass.BlurDirectionY;
			renderer.setRenderTarget( this.renderTargetsVertical[ i ] );
			renderer.clear();
			this.fsQuad.render( renderer );

			inputRenderTarget = this.renderTargetsVertical[ i ];

		}

		// Composite All the mips

		this.fsQuad.material = this.compositeMaterial;
		this.compositeMaterial.uniforms[ "bloomStrength" ].value = this.strength;
		this.compositeMaterial.uniforms[ "bloomRadius" ].value = this.radius;
		this.compositeMaterial.uniforms[ "bloomTintColors" ].value = this.bloomTintColors;

		renderer.setRenderTarget( this.renderTargetsHorizontal[ 0 ] );
		renderer.clear();
		this.fsQuad.render( renderer );

		if ( this.selectedObjects.length > 0 ) {

			this.fsQuad.material = this.blendMaterial;
			this.blendMaterial.uniforms[ 'baseTexture' ].value = readBuffer.texture;
			// this.blendMaterial.uniforms[ "bloomTexture" ].value = this.renderTargetsHorizontal[ 0 ].texture;

		} else {

			// Blend it additively over the input texture
			this.fsQuad.material = this.materialCopy;
			this.copyUniforms[ "tDiffuse" ].value = this.renderTargetsHorizontal[ 0 ].texture;

		}

		if ( maskActive ) renderer.state.buffers.stencil.setTest( true );

		if ( this.renderToScreen ) {

			renderer.setRenderTarget( null );
			this.fsQuad.render( renderer );

		} else {

			renderer.setRenderTarget( readBuffer );
			this.fsQuad.render( renderer );

		}

		// Restore renderer settings
		renderer.setClearColor( this.oldClearColor, this.oldClearAlpha );
		renderer.autoClear = oldAutoClear;

	},

	createBlendMaterial: function() {

		return new ShaderMaterial( {
			uniforms: {
				baseTexture: { value: null },
				bloomTexture: { value: this.renderTargetsHorizontal[ 0 ].texture },
			},

			vertexShader: `
			varying vec2 vUv;

			void main() {

				vUv = uv;

				gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

			}
			`,

			fragmentShader:
			`
			uniform sampler2D baseTexture;
			uniform sampler2D bloomTexture;

			varying vec2 vUv;

			void main() {

				// vec4 texel1 = texture2D( baseTexture, vUv );
				// vec4 texel2 = texture2D( bloomTexture, vUv );
				// gl_FragColor = mix( texel1, texel2, 0.5 );

				gl_FragColor = texture2D( baseTexture , vUv ) + vec4( 1.0 ) * texture2D( bloomTexture , vUv );

			}
			`
		} );

	},

	createSeperableBlurMaterial: function ( kernelRadius ) {

		return new ShaderMaterial( {

			defines: {
				"KERNEL_RADIUS": kernelRadius,
				"SIGMA": kernelRadius
			},

			uniforms: {
				"colorTexture": { value: null },
				"texSize": { value: new Vector2( 0.5, 0.5 ) },
				"direction": { value: new Vector2( 0.5, 0.5 ) }
			},

			vertexShader:
				"varying vec2 vUv;\n\
				void main() {\n\
					vUv = uv;\n\
					gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );\n\
				}",

			fragmentShader:
				"#include <common>\
				varying vec2 vUv;\n\
				uniform sampler2D colorTexture;\n\
				uniform vec2 texSize;\
				uniform vec2 direction;\
				\
				float gaussianPdf(in float x, in float sigma) {\
					return 0.39894 * exp( -0.5 * x * x/( sigma * sigma))/sigma;\
				}\
				void main() {\n\
					vec2 invSize = 1.0 / texSize;\
					float fSigma = float(SIGMA);\
					float weightSum = gaussianPdf(0.0, fSigma);\
					vec3 diffuseSum = texture2D( colorTexture, vUv).rgb * weightSum;\
					for( int i = 1; i < KERNEL_RADIUS; i ++ ) {\
						float x = float(i);\
						float w = gaussianPdf(x, fSigma);\
						vec2 uvOffset = direction * invSize * x;\
						vec3 sample1 = texture2D( colorTexture, vUv + uvOffset).rgb;\
						vec3 sample2 = texture2D( colorTexture, vUv - uvOffset).rgb;\
						diffuseSum += (sample1 + sample2) * w;\
						weightSum += 2.0 * w;\
					}\
					gl_FragColor = vec4(diffuseSum/weightSum, 1.0);\n\
				}"
		} );

	},

	createCompositeMaterial: function ( nMips ) {

		return new ShaderMaterial( {

			defines: {
				"NUM_MIPS": nMips
			},

			uniforms: {
				blurTexture0: { value: this.renderTargetsVertical[ 0 ].texture },
				blurTexture1: { value: this.renderTargetsVertical[ 1 ].texture },
				blurTexture2: { value: this.renderTargetsVertical[ 2 ].texture },
				blurTexture3: { value: this.renderTargetsVertical[ 3 ].texture },
				blurTexture4: { value: this.renderTargetsVertical[ 4 ].texture },
				bloomStrength: { value: this.strength },
				bloomFactors: { value: this.bloomFactors },
				bloomTintColors: { value: this.bloomTintColors },
				bloomRadius: { value: this.radius }
			},

			vertexShader:
				"varying vec2 vUv;\n\
				void main() {\n\
					vUv = uv;\n\
					gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );\n\
				}",

			fragmentShader:
				"varying vec2 vUv;\
				uniform sampler2D blurTexture0;\
				uniform sampler2D blurTexture1;\
				uniform sampler2D blurTexture2;\
				uniform sampler2D blurTexture3;\
				uniform sampler2D blurTexture4;\
				uniform float bloomStrength;\
				uniform float bloomRadius;\
				uniform float bloomFactors[NUM_MIPS];\
				uniform vec3 bloomTintColors[NUM_MIPS];\
				\
				float lerpBloomFactor(const in float factor) { \
					float mirrorFactor = 1.2 - factor;\
					return mix(factor, mirrorFactor, bloomRadius);\
				}\
				\
				void main() {\
					gl_FragColor = bloomStrength * ( lerpBloomFactor(bloomFactors[0]) * vec4(bloomTintColors[0], 1.0) * texture2D(blurTexture0, vUv) + \
													lerpBloomFactor(bloomFactors[1]) * vec4(bloomTintColors[1], 1.0) * texture2D(blurTexture1, vUv) + \
													lerpBloomFactor(bloomFactors[2]) * vec4(bloomTintColors[2], 1.0) * texture2D(blurTexture2, vUv) + \
													lerpBloomFactor(bloomFactors[3]) * vec4(bloomTintColors[3], 1.0) * texture2D(blurTexture3, vUv) + \
													lerpBloomFactor(bloomFactors[4]) * vec4(bloomTintColors[4], 1.0) * texture2D(blurTexture4, vUv) );\
				}"
		} );

	},

	changeVisibilityOfNonSelectedObjects: function ( bVisible ) {

		var self = this;

		this.scene.traverse( function( child ) {

			if( child.isMesh && ! self.selectedObjects.includes( child )) {

				child.visible = bVisible;
				// child.material.colorWrite = bVisible;

			}

		} );

	},

} );

UnrealBloomPass.BlurDirectionX = new Vector2( 1.0, 0.0 );
UnrealBloomPass.BlurDirectionY = new Vector2( 0.0, 1.0 );

export { UnrealBloomPass };
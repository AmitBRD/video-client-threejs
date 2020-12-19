import Voronoi from 'Voronoi';
const random = require('random');
import * as THREE from "three";


//https://github.com/nayrrod/voronoi-fracture/
class VoronoiMesh{
	constructor(width,height,cell_count, options){
		this.rand = random.uniform( 0, 1);
		const halfWidth = width/2;
		const halfHeight = height /2 ;

		let vertices = getRandom2DVertices(cell_count, 'uniform', width, height)

	    // Generate the data-only voronoi diagram from those vertices
	    let voronoiDiagram = generateVoronoiDiagram(-halfWidth, halfWidth, -halfHeight, halfHeight, vertices)

	    // Generate three.js shapes from each cell in the voronoi diagram
	    let shapeArray = voronoiDiagram.cells.map(getVoronoiShape)

	    // Extrude these shapes into actual geometry
	    let geomArray = extrudeShapes(shapeArray)

	    // Put every geometry in a single buffer mesh with custom shader material
	    this.bufferMesh = getBufferMesh(geomArray)
	    
	}

	

}

function getRandom2DVertices(sitesCount, distribution, width, height) {
    // let isGaussian = distribution == 'gaussian' ? true : false
    // let isUniform = distribution == 'uniform' ? true : false
    let randGeneratorX = random.uniform(-1. , 1);
    let randGeneratorY = random.uniform(-1. , 1);
    // if (isGaussian) {
    //     randGeneratorX = Prob.normal(0, 0.3)
    //     randGeneratorY = Prob.normal(0, 0.3)
    // } else {
    //     randGeneratorX = Prob.uniform(-1.0, 1.0)
    //     randGeneratorY = Prob.uniform(-1.0, 1.0)
    // }

    const halfWidth = width / 2
    const halfHeight = height / 2
    // Here we fill an array with random 2D vertices in viewport space
    const verticesCount = sitesCount
    let vertices = new Array(verticesCount).fill({})
    vertices = vertices.map(() => {
        let x = randGeneratorX() * halfWidth
        let y = randGeneratorY() * halfHeight
        // discard the point if it does not fall into viewport space, needed for gaussian distribution
        if (x < -halfWidth || x > halfWidth || y < -halfHeight || y > halfHeight) {
            return {
                x: 0,
                y: 0
            }
        }
        return {
            x,
            y
        }
    })
    return vertices
}

function extrudeShapes(shapeArray) {
    const extrudeSettings = {
        amount: 100,
        bevelEnabled: false,
        bevelSegments: 0,
        steps: 1,
        bevelSize: 0,
        bevelThickness: 0
    }

    let geomArray = []

    for (let i = 0; i < shapeArray.length; i++) {

        let cellGeom = new THREE.ExtrudeGeometry(shapeArray[i], extrudeSettings)
        cellGeom.computeBoundingBox()
        var cellBBox = cellGeom.boundingBox
        var cellCenter = {
            x: cellBBox.min.x + (cellBBox.max.x - cellBBox.min.x) / 2,
            y: cellBBox.min.y + (cellBBox.max.y - cellBBox.min.y) / 2,
            z: cellBBox.min.z + (cellBBox.max.z - cellBBox.min.z) / 2
        }
        cellGeom.center()
        cellGeom.cellCenter = cellCenter
        geomArray.push(cellGeom)
    }
    return geomArray
}

function getBufferMesh(geomArray) {
    let positions = []
    let normals = []
    let colors = []
    let center = []

    geomArray.forEach(function (geometry, index, array) {
        let color = new THREE.Color(0xffffff);
        color.setHSL((index / array.length), 1.0, 0.7);

        geometry.faces.forEach(function (face, index) {
            positions.push(geometry.vertices[face.a].x + geometry.cellCenter.x);
            positions.push(geometry.vertices[face.a].y + geometry.cellCenter.y);
            positions.push(geometry.vertices[face.a].z + geometry.cellCenter.z);
            positions.push(geometry.vertices[face.b].x + geometry.cellCenter.x);
            positions.push(geometry.vertices[face.b].y + geometry.cellCenter.y);
            positions.push(geometry.vertices[face.b].z + geometry.cellCenter.z);
            positions.push(geometry.vertices[face.c].x + geometry.cellCenter.x);
            positions.push(geometry.vertices[face.c].y + geometry.cellCenter.y);
            positions.push(geometry.vertices[face.c].z + geometry.cellCenter.z);

            normals.push(face.normal.x);
            normals.push(face.normal.y);
            normals.push(face.normal.z);
            normals.push(face.normal.x);
            normals.push(face.normal.y);
            normals.push(face.normal.z);
            normals.push(face.normal.x);
            normals.push(face.normal.y);
            normals.push(face.normal.z);

            center.push(geometry.cellCenter.x)
            center.push(geometry.cellCenter.y)
            center.push(geometry.cellCenter.z)
            center.push(geometry.cellCenter.x)
            center.push(geometry.cellCenter.y)
            center.push(geometry.cellCenter.z)
            center.push(geometry.cellCenter.x)
            center.push(geometry.cellCenter.y)
            center.push(geometry.cellCenter.z)
        })
    })

    let bufferGeometry = new THREE.BufferGeometry()
    bufferGeometry.addAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    bufferGeometry.addAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
    bufferGeometry.addAttribute('center', new THREE.Float32BufferAttribute(center, 3))


    let isWhite = /*guiParams.theme === 'neon' ? 0.0 :*/ 1.0

    // shaderMaterial = new THREE.ShaderMaterial({
    //     vertexShader: vertShader,
    //     fragmentShader: fragShader,
    //     uniforms: {
    //         time: {
    //             value: 1.0
    //         },
    //         resolution: {
    //             value: new THREE.Vector2()
    //         },
    //         noiseScale: {
    //             value: guiParams.noiseScale
    //         },
    //         noiseDisplacement: {
    //             value: guiParams.noiseDisplacement
    //         },
    //         isWhite: {
    //             value: isWhite
    //         }
    //     }
    // })
    // shaderMaterial.uniforms.resolution.value.x = width
    // shaderMaterial.uniforms.resolution.value.y = height

    // new THREE.MeshToonMaterial( 
    //     { color: 0xc3f746,
    //      transparent:true,
    //      opacity: 0.2, 
    //      emissive:0xc4f730,
    //      emissiveIntensity:0.5,
    //      //wireframe:true
    //    }
    // )
    var bufferMesh = new THREE.Mesh(bufferGeometry, new THREE.MeshNormalMaterial({wireframe:true}));
    return bufferMesh
}

function generateVoronoiDiagram(xMin, xMax, yMin, yMax, sites) {
    let voronoi = new Voronoi()
    let boundingBox = {
        xl: xMin,
        xr: xMax,
        yt: yMin,
        yb: yMax
    };
    let voronoiDiagram = voronoi.compute(sites, boundingBox)
    return voronoiDiagram
}

function getVoronoiShape(cell) {
    let shape = new THREE.Shape();
    for (let i = 0; i < cell.halfedges.length; i++) {
        let startPoint = cell.halfedges[i].getStartpoint();
        let endPoint = cell.halfedges[i].getEndpoint();
        if (i === 0) {
            shape.moveTo(startPoint.x, startPoint.y);
        }
        shape.lineTo(endPoint.x, endPoint.y);
    }
    return shape
}

function clamp(num, min, max) {
    return Math.min(Math.max(num, min), max);
}


export {VoronoiMesh};
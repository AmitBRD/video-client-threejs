precision mediump float;
varying vec2 vUv;
uniform vec3 color;
uniform float opacity;
uniform float time;
uniform sampler2D map;
uniform int swtch;

vec4 blendMultiply(vec4 base, vec4 blend) {
	return base*blend;
}

vec4 blendMultiply(vec4 base, vec4 blend, float opacity) {
	return (blendMultiply(base, blend) * opacity + base * (1.0 - opacity));
}

void sw1() {
    gl_FragColor = vec4(color, opacity);
}

void sw2() {
    vec4 col = vec4(vec3(0.5 - 0.5*cos(time + vUv.x*4.0), 0.5 + 0.5*cos(time + vUv.y*5.0), 0.5 + 0.5*sin(time + vUv.x*3.0)), opacity);
    gl_FragColor = col;
}

void sw3() {
    gl_FragColor = texture2D(map, vUv);
}

void sw4() {
    vec2 centre = vec2(0.5, 0.5);
    vec2 pos = mod(vUv * 10.0, 1.0);

    float d = distance(pos, centre);

    float mask = 1.0-step(0.5 + sin(time + vUv.x*3.0)*0.5, d);
    vec4 newColour = vec4(vec3(mask), 1.0); 

    vec4 text = texture2D(map, vUv);
    newColour = blendMultiply(newColour, text, 1.0);
    
    gl_FragColor = newColour;
}

void sw5() {
    vec2 centre = vec2(0.5, 0.5);
    vec2 pos = mod(vUv * 10.0, 1.0);

    float d = distance(pos, centre);

    float mask = 1.0-step(0.5 + sin(time + vUv.x*3.0)*0.5, d);
    vec4 newColour = vec4(vec3(mask), 1.0); 
    
    vec4 c1 = vec4(vec3(0.5 - 0.5*cos(time + vUv.x*4.0), 0.5 + 0.5*cos(time + vUv.y*5.0), 0.5 + 0.5*sin(time + vUv.x*3.0)), opacity);
    newColour = blendMultiply(newColour, c1, opacity);

    vec4 text = texture2D(map, vUv);
    newColour = blendMultiply(newColour, text, 1.0);
    
    gl_FragColor = newColour;
}


void main() {
    switch(swtch) {
        case 1: sw1();
        break;

        case 2: sw2();
        break;

        case 3: sw3();
        break;

        case 4: sw4();
        break;

        case 5: sw5();
        break;

        default: sw1();
    }
}
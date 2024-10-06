// Max van Leeuwen
//  twitter.com/maksvanleeuwen
//  links.maxvanleeuwen.com
//
// ✨ Renders a trail of particles on touch or mouse hover ✨



// parameters
const maxParticleCount = 190; // maximum simultaneous particle count before cycling
const particleSpawnIntervalMS = 5; // spawn a new particle once every this many ms (if frames are skipped, positions will be interpolated for a smooth particle trail!)


import * as THREE from 'three';
import sparkles from './sparkles.png'; // texture



function startScene(){
    // check if mobile device
    const userAgent = navigator.userAgent || navigator.vendor || window.opera;
    const isMobileDevice = /android/i.test(userAgent) || /iPad|iPhone|iPod/.test(userAgent) && !window.MSStream;

    // get initial window size to dynamically update scene on resize
    const displaySizes = {
        width: window.innerWidth,
        height: window.innerHeight,
    }

    // create threejs scene
    const container = document.getElementById('threejs-container');
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, displaySizes.width / displaySizes.height, 0.1, 1000);
    camera.position.z = 5;
    const renderer = new THREE.WebGLRenderer(); // {alpha: true});
    scene.background = new THREE.Color("rgb(113, 0, 205)");
    container.appendChild(renderer.domElement);

    // change camera and renderer size dynamically when window is resized
    function updateWindowResize(){
        // get sizes
        displaySizes.width = window.innerWidth;
        displaySizes.height = window.innerHeight;

        // apply
        camera.aspect = displaySizes.width / displaySizes.height;
        camera.updateProjectionMatrix();
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.setSize(displaySizes.width, displaySizes.height);
    }
    window.addEventListener('resize', updateWindowResize);
    updateWindowResize();



    // create particles as buffer geometry
    const particlesGeometry = new THREE.BufferGeometry();

    // position attribute (placeholder)
    const positions = new Float32Array(maxParticleCount * 3);
    const sizes = new Float32Array(maxParticleCount);
    const startTimes = new Float32Array(maxParticleCount);

    // spawn-time attribute (placeholder)
    for(let i = 0; i < maxParticleCount; i++){
        sizes[i] = (Math.pow(Math.random(), 2)/2 + .5); // initialized with random sizes for variation, ranging 0.5-1, with bias towards smaller for a nicer look
        startTimes[i] = -1; // -1 means unused particle, this will be overwritten each time this particle is cycled through
    }

    // apply attributes to particle geo
    particlesGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    particlesGeometry.setAttribute('startTime', new THREE.BufferAttribute(startTimes, 1));
    particlesGeometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    
    // create material
    const particleTexture = new THREE.TextureLoader().load(sparkles); // texture
    const particlesMaterial = new THREE.ShaderMaterial({
    uniforms: {
        tex: {value: particleTexture},
        currentTime : {value: 0} // placeholder, will be overwritten each time this particle is cycled through
    },
    transparent: true,

    // vertex shader (animated motion and scale)
    vertexShader: `
uniform float currentTime;
attribute float startTime; // this particle's spawn time (update each cycle)
attribute float size;
varying float vColor; // brightness of particle (to be used in fragment stage)

float remap(float value, float minSrc, float maxSrc, float minDst, float maxDst){ // simple remap function
    return minDst + (value - minSrc) * (maxDst - minDst) / (maxSrc - minSrc);
}

float cubicInOut(float t){ // convert 0-1 linear to cubic (in/out)
    if(t < .5){
        return 4. * t * t * t;
    }else{
        float f = ((2. * t) - 2.);
        return .5 * f * f * f + 1.;
    }
}

float random(float seed){ // simple seeded random
    return fract(sin(seed) * 43758.5453123);
}

float centerRemap(float v, float center){ // linear 0-1 to lin 0-1-0, with arbitrary 'center' position
    if(v < center){
        return v/center;
    }else{
        return remap(v, center, 1., 1., 0.);
    }
}

const float inTime = .18; // particle scale-in animation duration (0-1)
const float horizontalAmount = .35; // flying away from cursor horizontally
const float particleScale = 300.; // overall particle scale

void main(){
    float lifeTime = random(startTime+10.)/2. + .5; // random lifetime between 0.5-1
    float t = startTime < 0. ? 0. : currentTime-startTime; // 0-1

    float horDirection = remap(random(startTime+20.), 0., 1., -horizontalAmount, horizontalAmount); // random horizontal direction on spawn
    float horMultiplier = 1. - pow(1. - (t / (lifeTime*.7) ), 3.); // imitating a horizontal force by using the particle's age to multiply horDirection with
    float unititializedOffset = t==0.?9999.:0.; // a scale of 0 is still visible as a tiny dot (floating point precision error), so this is an extra measure, pushing the particle out of view when it shouldn't be visible
    vec4 mvPosition = modelViewMatrix * vec4(position+vec3(horDirection * horMultiplier + unititializedOffset, -t*t*.4  -t*.3, 0.), 1.0); // x is horizontal force, y is falling down
    gl_Position = projectionMatrix * mvPosition;

    float fluctuatingSize = sin(t*10. + random(startTime+30.)*6.)/4.+.75; // a fluctuating scale between .5-1
    float particleInOutScale = t > inTime ? 1.-pow(1.-remap(t, inTime, lifeTime, 1., 0.), 2.) : cubicInOut(t/inTime); // if t>inTime, do exponential scale-out anim, otherwise do cubic scale-in
    gl_PointSize = t > lifeTime ? 0. : size * (particleScale / -mvPosition.z) * particleInOutScale; // final particle size
    gl_PointSize *= fluctuatingSize;

    vColor = sin(random(startTime+40.)*6. + t*20.)/2. +.5; // fluctuating brightness between 0-1
}
    `,

    // fragment shader (animates colors)
    fragmentShader: `
uniform sampler2D tex;
varying float vColor; // get fluctuating brightness amount

void main(){
    gl_FragColor = texture2D(tex, gl_PointCoord); // get texture color
    gl_FragColor.rgb *= pow(vColor, 6.)*1.2 + 1.; // apply fluctuating brightness to texture
}
    `});



    // add points with this particle material to the scene
    const particleSystem = new THREE.Points(particlesGeometry, particlesMaterial);
    scene.add(particleSystem);



    // place the next particle in the cycle at a position with specific startTime
    let crrParticleIndex = 0; // current particle index
    function addParticle(x, y, z, startTime){
        // position
        positions[crrParticleIndex * 3] = x;
        positions[crrParticleIndex * 3 + 1] = y;
        positions[crrParticleIndex * 3 + 2] = z;
        particlesGeometry.attributes.position.needsUpdate = true;

        // start time initialize
        startTimes[crrParticleIndex] = startTime;
        particlesGeometry.attributes.startTime.needsUpdate = true;

        // cycle index (if exceeding maximum index, go back to 0 and reuse earlier first particle)
        crrParticleIndex++;
        if(crrParticleIndex >= maxParticleCount){
            crrParticleIndex = 0;
        }
    }



    // interactions
    let lastMouseMoveEvent;
    let prvPos; // store previous spawn position
    function requestParticles(event, resetParticleSpawnCounter){
        lastMouseMoveEvent = event; // register mouse moved (to keep spawning when mouse not moving)

        // check how many new particles should be spawned on this frame
        const maxParticleCount = particlesToSpawn(resetParticleSpawnCounter);
        if(maxParticleCount == 0) return;

        // don't spawn particles if not inside of the canvas
        if(!isCursorInWindow || isCursorHoveringOverButton) return;

        // get on-screen spawn position
        const x = (event.clientX / displaySizes.width) * 2 - 1;
        const y = -(event.clientY / displaySizes.height) * 2 + 1;

        // place in world space
        const vector = new THREE.Vector3(x, y, 0.5);
        vector.unproject(camera);
        const dir = vector.sub(camera.position).normalize();
        const distance = -camera.position.z / dir.z;
        const pos = camera.position.clone().add(dir.multiplyScalar(distance)); // world position

        // spawn particles
        const currentTime = getElapsedTime();
        for(let i = 0; i < maxParticleCount; i++){
            const ratio = (i+1)/maxParticleCount; // (0-1]
            let p = pos;
            if(prvPos){ // interpolate with previous frame's position for a continuous streak
                p = prvPos.clone().lerp(p, ratio); // overwrite with lerped
            }
            addParticle(p.x, p.y, p.z, currentTime + ratio*.001); // draw new particle, give it a slight 'currentTime' offset to make sure each particle is unique even when created on the same frame
        }

        // store as previous spawn position to interpolate on next frame
        prvPos = new THREE.Vector3(pos.x, pos.y, pos.z);
    }



    let isFirstMove = true;
    function onMouseMove(event){
        requestParticles(event, isFirstMove);
        if(isFirstMove) isFirstMove = false;
    }

    let activeTouchEvent;
    function onTouchStart(event){ // on touch start and move
        prvPos = null; // deregister interpolation history
        const touch = event.touches[0];
        activeTouchEvent = touch; // register touch is active (to keep spawning even when not moving)
        requestParticles(touch, true);
    }

    function onTouchMove(event){ // on touch start and move
        const touch = event.touches[0];
        activeTouchEvent = touch; // register touch is active (to keep spawning even when not moving)
        requestParticles(touch);
    }

    function touchEnd(){
        activeTouchEvent = null; // deregister active touch (stop spawning)
        prvPos = null; // deregister interpolation history
    }

    // event listeners
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('touchstart', onTouchStart);
    window.addEventListener('touchmove', onTouchMove);
    window.addEventListener('touchend', touchEnd);



    // no particles if cursor is outdside of window
    let isCursorInWindow = true;
    document.addEventListener('mouseleave', () => {
        isCursorInWindow = false;
        prvPos = null; // deregister interpolation history
    });
    document.addEventListener('mouseenter', () => {
        isCursorInWindow = true;
    });

    // no particles if cursor in hovering over the button
    var isCursorHoveringOverButton = false;
    var buttons = document.querySelector('.link-btn');
    buttons.addEventListener('mouseenter', (event) => {
        isCursorHoveringOverButton = true;
    }, true); // 'true' makes sure the event is captured in the capturing phase
    buttons.addEventListener('mouseleave', (event) => {
        isCursorHoveringOverButton = false;
    }, true);



    // get the current time
    const startTime = Date.now()/1000; // current clock time in seconds
    function getElapsedTime(){ // time since page load in seconds
        return Date.now()/1000 - startTime;
    }



    // get the amount of new particles to spawn on this frame, based on elapsed time since last spawn
    let prvTime = Date.now(); // keep track of when a particle was last spawned
    let totalSpawnCount = 0; // spawnCount is additive on top of previous frame
    function particlesToSpawn(resetParticleSpawnCounter){ // if resetParticleSpawnCounter is true, no interpolation particles are created
        // get amount of particles that should have spawned during the duration of this frame
        const currentTime = Date.now();
        if(resetParticleSpawnCounter) prvTime = currentTime;
        const thisFrameCount = (currentTime - prvTime) / particleSpawnIntervalMS;
        prvTime = currentTime;

        // add to previous frame (there might be leftover)
        totalSpawnCount += thisFrameCount;
        if(totalSpawnCount >= 1){ // if 1 or more particles are to be spawned on this frame
            const floored = Math.floor(totalSpawnCount); // whole number of particles to spawn
            totalSpawnCount -= floored; // leftover particles for next frame
            return floored;
        }
        return 0;
    }



    // final animation
    const animate = () => {
        requestAnimationFrame(animate);

        // particles material needs the current time for comparison
        particlesMaterial.uniforms['currentTime'].value = getElapsedTime(); // seconds since page load

        // on touch & hold
        if(activeTouchEvent) requestParticles(activeTouchEvent);
        if(!isMobileDevice && lastMouseMoveEvent) requestParticles(lastMouseMoveEvent);

        renderer.render(scene, camera);
    };
    animate();
}
startScene();
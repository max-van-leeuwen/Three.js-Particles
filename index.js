// Max van Leeuwen
// twitter.com/maksvanleeuwen
// links.maxvanleeuwen.com
//
// ✨ Renders a trail of particles on touch or mouse hover ✨



// parameters
const particleCount = 190; // maximum simultaneous particle count before cycling
const spawnInterval = 5; // spawn a new particle once every this many ms (if frames are skipped, positions will be interpolated for a smooth particle trail!)
// -


import * as THREE from 'three';
import sparkles from './sparkles.png'; // texture



function startScene(){
    // get mobile device
    const userAgent = navigator.userAgent || navigator.vendor || window.opera;
    const isMobileDevice = /android/i.test(userAgent) || /iPad|iPhone|iPod/.test(userAgent) && !window.MSStream;

    // get window size
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

    // set window size dynamically
    function updateWindowResize(){
        // get sizes
        displaySizes.width = window.innerWidth;
        displaySizes.height = window.innerHeight;

        // apply
        camera.aspect = displaySizes.width / displaySizes.height;
        camera.updateProjectionMatrix();
        renderer.setSize(displaySizes.width, displaySizes.height);
    }
    window.addEventListener('resize', updateWindowResize);
    updateWindowResize();



    // create particles as buffer geometry
    const particlesGeometry = new THREE.BufferGeometry();

    // position attribute (placeholder)
    const positions = new Float32Array(particleCount * 3);

    // random size attribute
    const sizes = new Float32Array(particleCount);
    for(let i = 0; i < particleCount; i++){
        sizes[i] = (Math.pow(Math.random(), 2)/2 + .5); // initialized with random sizes for variation, [.5-1] with bias towards smaller for a more organic look
    }

    // spawn-time attribute (placeholder)
    const startTimes = new Float32Array(particleCount);
    for(let i = 0; i < particleCount; i++){
        startTimes[i] = -1; // will be overwritten each time this particle is cycled through
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
    if (t < .5) {
        return 4. * t * t * t;
    } else {
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

const float inTime = .18; // particle scale-in animation duration
const float horizontalAmount = .35; // flying away from cursor horizontally
const float particleScale = 300.; // overall particle scale

void main() {
    float lifeTime = random(startTime+10.)/2. + .5; // random lifetime between 0.5-1
    float t = startTime < 0. ? 0. : currentTime-startTime;

    float horDirection = remap(random(startTime+20.), 0., 1., -horizontalAmount, horizontalAmount); // random horizontal direction on spawn
    float horMultiplier = 1. - pow(1. - (t / (lifeTime*.7) ), 2.); // imitating a horizontal force by using the particle's age to multiply horDirection with
    vec4 mvPosition = modelViewMatrix * vec4(position+vec3(horDirection * horMultiplier, -t*t*.4  -t*.3, 0.), 1.0); // x is horizontal force, y is falling down
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

void main() {
    gl_FragColor = texture2D(tex, gl_PointCoord); // get texture color
    gl_FragColor.rgb *= pow(vColor, 6.)*1.2 + 1.; // apply fluctuating brightness to texture
}
    `});



    // add points with this particle material to the scene
    const particleSystem = new THREE.Points(particlesGeometry, particlesMaterial);
    scene.add(particleSystem);



    // cycling particles
    let currentParticle = 0; // current particle index
    function addParticle(x, y, z, startTime){
        // position
        positions[currentParticle * 3] = x;
        positions[currentParticle * 3 + 1] = y;
        positions[currentParticle * 3 + 2] = z;
        particlesGeometry.attributes.position.needsUpdate = true;

        // start time initialize
        startTimes[currentParticle] = startTime;
        particlesGeometry.attributes.startTime.needsUpdate = true;

        // cycle index (if exceeding maximum index, go back to 0 and reuse earlier first particle)
        currentParticle++;
        if(currentParticle >= particleCount){
            currentParticle = 0;
        }
    }



    // interactions
    let lastMouseMoveEvent;
    let prvP; // store previous spawn position
    function requestParticles(event, resetParticleSpawnCounter){
        lastMouseMoveEvent = event; // register mouse moved (to keep spawning when mouse not moving)

        // check how many new particles should be spawned
        const particleCount = particlesToSpawn(resetParticleSpawnCounter);
        if(particleCount == 0) return;

        if(!isCursorInside) return;

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
        const currentTime = getCurrentTime();
        for(let i = 0; i < particleCount; i++){
            const ratio = (i+1)/particleCount; // (0-1]
            let p = pos;
            if(prvP){ // interpolate with previous frame's position for a continuous streak
                p = prvP.clone().lerp(p, ratio); // overwrite with lerped
            }
            addParticle(p.x, p.y, p.z, currentTime + ratio*.001); // draw new particle, give it a slight 'currentTime' offset to make sure each particle is unique even when created on the same frame
        }

        // store as previous spawn position to interpolate on next frame
        prvP = new THREE.Vector3(pos.x, pos.y, pos.z);
    }



    let isFirstMove = true;
    function onMouseMove(event){
        requestParticles(event, isFirstMove);
        if(isFirstMove) isFirstMove = false;
    }

    let touchActive;
    function onTouchStart(event){ // on touch start and move
        prvP = null; // deregister interpolation history
        const touch = event.touches[0];
        touchActive = touch; // register touch is active (to keep spawning even when not moving)
        requestParticles(touch, true);
    }

    function onTouchMove(event){ // on touch start and move
        const touch = event.touches[0];
        touchActive = touch; // register touch is active (to keep spawning even when not moving)
        requestParticles(touch);
    }

    function touchEnd(){
        touchActive = null; // deregister active touch (stop spawning)
        prvP = null; // deregister interpolation history
    }

    // event listeners
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('touchstart', onTouchStart);
    window.addEventListener('touchmove', onTouchMove);
    window.addEventListener('touchend', touchEnd);



    // no particles if cursor is outdside of window
    let isCursorInside = true;
    document.addEventListener('mouseleave', () => {
        isCursorInside = false;
        prvP = null; // deregister interpolation history
    });
    document.addEventListener('mouseenter', () => {
        isCursorInside = true;
    });



    // get the current time
    const startTime = Date.now()/1000; // current clock time in seconds
    function getCurrentTime(){ // time since page load in seconds
        return Date.now()/1000 - startTime;
    }



    // get the amount of new particles to spawn on this frame, based on elapsed time since last spawn
    let prvTime = Date.now(); // keep track of when a particle was last spawned
    let totalSpawnCount = 0; // spawnCount is additive on top of previous frame
    function particlesToSpawn(resetParticleSpawnCounter){ // if resetParticleSpawnCounter is true, no interpolation particles are created
        // get amount of particles that should have spawned during the duration of this frame
        const currentTime = Date.now();
        if(resetParticleSpawnCounter) prvTime = currentTime;
        const thisFrameCount = (currentTime - prvTime) / spawnInterval;
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
        particlesMaterial.uniforms['currentTime'].value = getCurrentTime(); // seconds since page load

        // on touch & hold
        if(touchActive) requestParticles(touchActive);
        if(!isMobileDevice && lastMouseMoveEvent) requestParticles(lastMouseMoveEvent);

        renderer.render(scene, camera);
    };
    animate();
}



startScene();

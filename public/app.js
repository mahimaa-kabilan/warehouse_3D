// ==========================================
// 3D WAREHOUSE TWIN ENGINE (THREE.JS)
// ==========================================

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b0f19); // Premium deep slate dark

// CAMERA
const camera = new THREE.PerspectiveCamera(
    60,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
);
camera.position.set(12, 12, 22);

// RENDERER
const renderer = new THREE.WebGLRenderer({
    canvas: document.querySelector('#bg'),
    antialias: true
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

// CONTROLS
const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.maxPolarAngle = Math.PI / 2 - 0.02; // Don't allow camera under floor
controls.minDistance = 3;
controls.maxDistance = 60;

// LIGHTS - Studio Quality Lighting setup for textures & metallic materials
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);

// Primary Directional Light (Warm studio light)
const dirLight1 = new THREE.DirectionalLight(0xffffff, 0.85);
dirLight1.position.set(15, 30, 15);
scene.add(dirLight1);

// Secondary Directional Light (Subtle cyan fill light for premium sci-fi tint)
const dirLight2 = new THREE.DirectionalLight(0x38bdf8, 0.4);
dirLight2.position.set(-15, 10, -15);
scene.add(dirLight2);

// FLOOR GRID
// Aligning floor exactly at y=0
const gridHelper = new THREE.GridHelper(60, 60, 0x38bdf8, 0x1e293b);
gridHelper.position.y = 0;
scene.add(gridHelper);

// WAREHOUSE SLOT CONFIGURATION
const rows = 4;        // Vertical (y-axis)
const cols = 3;        // Horizontal (x-axis)
const depth = 5;       // Depth (z-axis)
const spacing = 2.0;   // General spacing unit
const pathwayGap = 2.0; // Pathway gap of 2 units

const slotPositions = [];
const packageMeshes = [];
let selectedMesh = null;
let searchedMesh = null;

// ==========================================
// FORKLIFT GLOBAL STATE & CONFIG
// ==========================================
const homePosition = new THREE.Vector3(-4, 0, -2);
const arrivalBay = new THREE.Vector3(-5.5, 0, -2);
const dispatchBay = new THREE.Vector3(7.5, 0, -2);

let forkliftGroup = null;
let forkliftForks = null; // The forks group that moves vertically on the mast
let forkliftInnerMast = null; // Telescopic inner mast group that moves up with the forks
let forkliftBeaconLight = null; // Pulsing pointlight

// Animation queue & Waypoint Navigation Variables
const forkliftQueue = [];
let currentForkliftTask = null;
let forkliftState = "IDLE"; 
let forkliftCargoMesh = null; 

// State machine variables
let forkliftProgress = 0;
let forkliftSourcePos = new THREE.Vector3();
let forkliftTargetPos = new THREE.Vector3();
let forkliftTargetY = 0.5; // Fork height target
let isInitialLoad = true; // flag to skip animation on initial load

// Waypoint tracking
let pathWaypoints = [];
let currentWaypointIdx = 0;

function createForklift() {
    const forklift = new THREE.Group();

    // 1. CHASSIS (Main body)
    const chassisGeom = new THREE.BoxGeometry(0.8, 0.4, 1.3);
    const chassisMat = new THREE.MeshStandardMaterial({
        color: 0xeab308, // Safety yellow
        metalness: 0.6,
        roughness: 0.2
    });
    const chassis = new THREE.Mesh(chassisGeom, chassisMat);
    chassis.position.y = 0.3; // Sit above ground
    forklift.add(chassis);

    // Counterweight (Heavy back bumper)
    const bumperGeom = new THREE.BoxGeometry(0.8, 0.4, 0.3);
    const bumperMat = new THREE.MeshStandardMaterial({
        color: 0x1e293b, // Dark grey metal
        metalness: 0.8,
        roughness: 0.3
    });
    const bumper = new THREE.Mesh(bumperGeom, bumperMat);
    bumper.position.set(0, 0.3, -0.65 - 0.15);
    forklift.add(bumper);

    // 2. WHEELS (4 black cylinders)
    const wheelGeom = new THREE.CylinderGeometry(0.18, 0.18, 0.15, 16);
    const wheelMat = new THREE.MeshStandardMaterial({
        color: 0x111827,
        roughness: 0.9,
        metalness: 0.1
    });

    // Front Left Wheel
    const flWheel = new THREE.Mesh(wheelGeom, wheelMat);
    flWheel.rotation.z = Math.PI / 2;
    flWheel.position.set(-0.45, 0.18, 0.4);
    forklift.add(flWheel);

    // Front Right Wheel
    const frWheel = new THREE.Mesh(wheelGeom, wheelMat);
    frWheel.rotation.z = Math.PI / 2;
    frWheel.position.set(0.45, 0.18, 0.4);
    forklift.add(frWheel);

    // Back Left Wheel
    const blWheel = new THREE.Mesh(wheelGeom, wheelMat);
    blWheel.rotation.z = Math.PI / 2;
    blWheel.position.set(-0.45, 0.18, -0.4);
    forklift.add(blWheel);

    // Back Right Wheel
    const brWheel = new THREE.Mesh(wheelGeom, wheelMat);
    brWheel.rotation.z = Math.PI / 2;
    brWheel.position.set(0.45, 0.18, -0.4);
    forklift.add(brWheel);

    // 3. CABIN (Rollcage structure)
    const pillarMat = new THREE.MeshStandardMaterial({
        color: 0x1e293b,
        metalness: 0.8,
        roughness: 0.2
    });
    const pillarGeom = new THREE.CylinderGeometry(0.02, 0.02, 0.9, 8);

    // Front left pillar
    const flPillar = new THREE.Mesh(pillarGeom, pillarMat);
    flPillar.position.set(-0.35, 0.95, 0.1);
    forklift.add(flPillar);

    // Front right pillar
    const frPillar = new THREE.Mesh(pillarGeom, pillarMat);
    frPillar.position.set(0.35, 0.95, 0.1);
    forklift.add(frPillar);

    // Back left pillar
    const blPillar = new THREE.Mesh(pillarGeom, pillarMat);
    blPillar.position.set(-0.35, 0.95, -0.4);
    forklift.add(blPillar);

    // Back right pillar
    const brPillar = new THREE.Mesh(pillarGeom, pillarMat);
    brPillar.position.set(0.35, 0.95, -0.4);
    forklift.add(brPillar);

    // Cabin roof
    const roofGeom = new THREE.BoxGeometry(0.76, 0.04, 0.6);
    const roofMat = new THREE.MeshStandardMaterial({
        color: 0xeab308,
        metalness: 0.5,
        roughness: 0.3
    });
    const roof = new THREE.Mesh(roofGeom, roofMat);
    roof.position.set(0, 1.4, -0.15);
    forklift.add(roof);

    // Seat
    const seatGeom = new THREE.BoxGeometry(0.4, 0.3, 0.4);
    const seatMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.8 });
    const seat = new THREE.Mesh(seatGeom, seatMat);
    seat.position.set(0, 0.65, -0.15);
    forklift.add(seat);

    // Steering Wheel Console
    const consoleGeom = new THREE.BoxGeometry(0.3, 0.2, 0.15);
    const consoleMesh = new THREE.Mesh(consoleGeom, pillarMat);
    consoleMesh.position.set(0, 0.75, 0.2);
    forklift.add(consoleMesh);

    // 4. VERTICAL MAST (Telescopic Rails)
    // 4a. OUTER MAST (Fixed to chassis)
    const outerMastGeom = new THREE.BoxGeometry(0.04, 2.0, 0.04);
    const outerMastMat = new THREE.MeshStandardMaterial({
        color: 0x1e293b, // Dark grey metal for outer structure
        metalness: 0.8,
        roughness: 0.3
    });

    const lOuterMast = new THREE.Mesh(outerMastGeom, outerMastMat);
    lOuterMast.position.set(-0.22, 1.0, 0.65);
    forklift.add(lOuterMast);

    const rOuterMast = new THREE.Mesh(outerMastGeom, outerMastMat);
    rOuterMast.position.set(0.22, 1.0, 0.65);
    forklift.add(rOuterMast);

    // 4b. INNER MAST (Slides vertically inside outer mast)
    forkliftInnerMast = new THREE.Group();
    forkliftInnerMast.position.set(0, 0.1, 0.65); // starts at base height

    const innerMastGeom = new THREE.BoxGeometry(0.04, 2.0, 0.04);
    const innerMastMat = new THREE.MeshStandardMaterial({
        color: 0x94a3b8, // Shiny silver/chrome inner rails
        metalness: 0.95,
        roughness: 0.1
    });

    const lInnerMast = new THREE.Mesh(innerMastGeom, innerMastMat);
    lInnerMast.position.set(-0.18, 1.0, 0.0); // relative to group
    forkliftInnerMast.add(lInnerMast);

    const rInnerMast = new THREE.Mesh(innerMastGeom, innerMastMat);
    rInnerMast.position.set(0.18, 1.0, 0.0); // relative to group
    forkliftInnerMast.add(rInnerMast);

    // Cross beam top of inner mast
    const mastBeamGeom = new THREE.BoxGeometry(0.40, 0.06, 0.06);
    const mastBeam = new THREE.Mesh(mastBeamGeom, innerMastMat);
    mastBeam.position.set(0, 1.97, 0.0); // relative to group
    forkliftInnerMast.add(mastBeam);

    forklift.add(forkliftInnerMast);

    // 5. MOVING CARRIAGE AND FORKS GROUP (Lifts independently along the rails)
    forkliftForks = new THREE.Group();
    forkliftForks.position.set(0, 0.1, 0.65); // Default lowest fork height

    // Carriage plate sliding on mast
    const carriagePlateGeom = new THREE.BoxGeometry(0.36, 0.3, 0.04);
    const carriagePlate = new THREE.Mesh(carriagePlateGeom, pillarMat);
    carriagePlate.position.set(0, 0.15, 0.02);
    forkliftForks.add(carriagePlate);

    // Reach Rails (Pantograph sliding extension mechanism)
    const reachRailGeom = new THREE.BoxGeometry(0.04, 0.04, 1.2);
    const lReachRail = new THREE.Mesh(reachRailGeom, pillarMat);
    lReachRail.position.set(-0.16, 0.15, -0.6); // Extends backwards from carriage
    forkliftForks.add(lReachRail);
    const rReachRail = new THREE.Mesh(reachRailGeom, pillarMat);
    rReachRail.position.set(0.16, 0.15, -0.6);
    forkliftForks.add(rReachRail);

    // Left Fork (L-shape)
    const forkVertGeom = new THREE.BoxGeometry(0.05, 0.35, 0.02);
    const forkHorizGeom = new THREE.BoxGeometry(0.05, 0.02, 0.6);
    const forkMat = new THREE.MeshStandardMaterial({
        color: 0x64748b, // Dark metal
        metalness: 0.95,
        roughness: 0.15
    });

    const lForkV = new THREE.Mesh(forkVertGeom, forkMat);
    lForkV.position.set(-0.1, 0.15, 0.04);
    forkliftForks.add(lForkV);

    const lForkH = new THREE.Mesh(forkHorizGeom, forkMat);
    lForkH.position.set(-0.1, 0.0, 0.32);
    forkliftForks.add(lForkH);

    // Right Fork
    const rForkV = new THREE.Mesh(forkVertGeom, forkMat);
    rForkV.position.set(0.1, 0.15, 0.04);
    forkliftForks.add(rForkV);

    const rForkH = new THREE.Mesh(forkHorizGeom, forkMat);
    rForkH.position.set(0.1, 0.0, 0.32);
    forkliftForks.add(rForkH);

    forklift.add(forkliftForks);

    // 6. FLASHING BEACON ON ROOF (Safety orange LED)
    const beaconBaseGeom = new THREE.CylinderGeometry(0.06, 0.06, 0.04, 8);
    const beaconBase = new THREE.Mesh(beaconBaseGeom, pillarMat);
    beaconBase.position.set(0, 1.43, -0.15);
    forklift.add(beaconBase);

    const beaconLightGeom = new THREE.SphereGeometry(0.05, 8, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    const beaconLightMat = new THREE.MeshStandardMaterial({
        color: 0xea580c, // Bright neon safety orange
        emissive: 0xea580c,
        emissiveIntensity: 1.0,
        transparent: true,
        opacity: 0.8
    });
    const beaconDome = new THREE.Mesh(beaconLightGeom, beaconLightMat);
    beaconDome.position.set(0, 1.45, -0.15);
    forklift.add(beaconDome);

    // Warning Light PointLight (glowing)
    forkliftBeaconLight = new THREE.PointLight(0xea580c, 1.5, 3);
    forkliftBeaconLight.position.set(0, 1.5, -0.15);
    forklift.add(forkliftBeaconLight);

    return forklift;
}

// Instantiate forklift and add to scene
forkliftGroup = createForklift();
forkliftGroup.position.copy(homePosition);
scene.add(forkliftGroup);

// PROCEDURAL LOADING DOCKS (ENTRY & EXIT)
function createLoadingDocks() {
    // 1. Entry Dock (Dock A) at X = -5.5, Y = 0, Z = -2
    const dockGroupA = new THREE.Group();
    dockGroupA.position.set(-5.5, 0, -2);

    // Platform
    const platGeom = new THREE.BoxGeometry(1.2, 0.05, 1.2);
    const platMatA = new THREE.MeshStandardMaterial({
        color: 0x0284c7, // Entry blue accent
        roughness: 0.5,
        metalness: 0.5
    });
    const platformA = new THREE.Mesh(platGeom, platMatA);
    platformA.position.y = 0.025;
    dockGroupA.add(platformA);

    // Closed industrial building/bay structure (walls & roof)
    const wallMat = new THREE.MeshStandardMaterial({
        color: 0x111827, // Slate dark metal walls
        metalness: 0.8,
        roughness: 0.3
    });
    const backWallA = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, 0.1), wallMat);
    backWallA.position.set(0, 0.6, -0.55);
    dockGroupA.add(backWallA);

    const lWallA = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.2, 1.2), wallMat);
    lWallA.position.set(-0.55, 0.6, 0);
    dockGroupA.add(lWallA);

    const rWallA = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.2, 1.2), wallMat);
    rWallA.position.set(0.55, 0.6, 0);
    dockGroupA.add(rWallA);

    // Roof
    const roofA = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.05, 1.2), wallMat);
    roofA.position.set(0, 1.2, 0);
    dockGroupA.add(roofA);

    // Neon glowing gate indicator
    const lightGeom = new THREE.BoxGeometry(0.8, 0.05, 0.05);
    const lightMatA = new THREE.MeshBasicMaterial({ color: 0x0ea5e9 });
    const indicatorA = new THREE.Mesh(lightGeom, lightMatA);
    indicatorA.position.set(0, 1.15, 0.55);
    dockGroupA.add(indicatorA);

    scene.add(dockGroupA);

    // 2. Exit Dock (Dock B) at X = 7.5, Y = 0, Z = -2
    const dockGroupB = new THREE.Group();
    dockGroupB.position.set(7.5, 0, -2);

    // Platform
    const platMatB = new THREE.MeshStandardMaterial({
        color: 0xef4444, // Exit red accent
        roughness: 0.5,
        metalness: 0.5
    });
    const platformB = new THREE.Mesh(platGeom, platMatB);
    platformB.position.y = 0.025;
    dockGroupB.add(platformB);

    // Walls
    const backWallB = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, 0.1), wallMat);
    backWallB.position.set(0, 0.6, -0.55);
    dockGroupB.add(backWallB);

    const lWallB = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.2, 1.2), wallMat);
    lWallB.position.set(-0.55, 0.6, 0);
    dockGroupB.add(lWallB);

    const rWallB = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.2, 1.2), wallMat);
    rWallB.position.set(0.55, 0.6, 0);
    dockGroupB.add(rWallB);

    // Roof
    const roofB = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.05, 1.2), wallMat);
    roofB.position.set(0, 1.2, 0);
    dockGroupB.add(roofB);

    // Neon glowing gate indicator
    const lightMatB = new THREE.MeshBasicMaterial({ color: 0xf43f5e });
    const indicatorB = new THREE.Mesh(lightGeom, lightMatB);
    indicatorB.position.set(0, 1.15, 0.55);
    dockGroupB.add(indicatorB);

    scene.add(dockGroupB);
}

// Generate the Entry & Exit departments
createLoadingDocks();


// ===================================================
// PROCEDURAL INDUSTRIAL STEEL & WOOD SHELVING RACKS
// ===================================================

const pillarHeight = rows * spacing;
const pillarGeom = new THREE.CylinderGeometry(0.05, 0.05, pillarHeight, 12);
const pillarMat = new THREE.MeshStandardMaterial({
    color: 0x1e3a8a, // Metallic cobalt industrial blue uprights
    metalness: 0.8,
    roughness: 0.2,
    transparent: true,
    opacity: 1.0
});

const shelfWidth = (cols - 1) * spacing + 1.30;
const shelfGeom = new THREE.BoxGeometry(shelfWidth, 0.06, 1.25);
const shelfMat = new THREE.MeshStandardMaterial({
    color: 0x92400e, // Rich brown pine wood decking
    roughness: 0.8,
    metalness: 0.05,
    transparent: true,
    opacity: 1.0
});

const beamGeom = new THREE.BoxGeometry(shelfWidth, 0.08, 0.04);
const beamMat = new THREE.MeshStandardMaterial({
    color: 0xea580c, // Safety gloss orange cross beams
    metalness: 0.7,
    roughness: 0.3,
    transparent: true,
    opacity: 1.0
});

// RACK MATERIAL ARRAYS FOR AISLE-SPECIFIC TRANSPARENCY
const rackPillarMaterials = [];
const rackShelfMaterials = [];
const rackBeamMaterials = [];

// Formula implements pathway gap once in every 2 shelves in depth (z-axis)
// And aligns the first row of cubes exactly above the ground plane (y=0)
for (let z = 0; z < depth; z++) {
    // Supermarket arrangement: Pathway gap of 2 units after every 2 shelves in depth
    const zOffset = z * spacing + Math.floor(z / 2) * pathwayGap;

    // Create unique materials for this shelf aisle to control opacity independently
    const currentPillarMat = pillarMat.clone();
    const currentShelfMat = shelfMat.clone();
    const currentBeamMat = beamMat.clone();

    rackPillarMaterials.push(currentPillarMat);
    rackShelfMaterials.push(currentShelfMat);
    rackBeamMaterials.push(currentBeamMat);

    // Upright steel pillars (4 columns at the corners of each double shelf row)
    const xMin = -0.65;
    const xMax = (cols - 1) * spacing + 0.65;
    const zMin = zOffset - 0.65;
    const zMax = zOffset + 0.65;
    const yCenter = pillarHeight / 2;

    const cornerPillars = [
        { x: xMin, z: zMin },
        { x: xMax, z: zMin },
        { x: xMin, z: zMax },
        { x: xMax, z: zMax }
    ];

    cornerPillars.forEach(p => {
        const mesh = new THREE.Mesh(pillarGeom, currentPillarMat);
        mesh.position.set(p.x, yCenter, p.z);
        scene.add(mesh);
    });

    for (let y = 0; y < rows; y++) {
        // Construct horizontal wooden shelf plank under this row
        const shelfMesh = new THREE.Mesh(shelfGeom, currentShelfMat);
        shelfMesh.position.set(((cols - 1) * spacing) / 2, y * spacing, zOffset);
        scene.add(shelfMesh);

        // Construct horizontal steel safety orange beam under the front of wood plank
        const frontBeam = new THREE.Mesh(beamGeom, currentBeamMat);
        frontBeam.position.set(((cols - 1) * spacing) / 2, y * spacing - 0.04, zOffset - 0.6);
        scene.add(frontBeam);

        // Construct horizontal steel safety orange beam under the back of wood plank
        const backBeam = new THREE.Mesh(beamGeom, currentBeamMat);
        backBeam.position.set(((cols - 1) * spacing) / 2, y * spacing - 0.04, zOffset + 0.6);
        scene.add(backBeam);

        for (let x = 0; x < cols; x++) {
            const posX = x * spacing;
            // Ground Alignment: Offset by 0.5 so that cube bottom sits flat on wood shelf (y * spacing + 0.05)
            const posY = 0.5 + y * spacing;
            const posZ = zOffset;

            slotPositions.push({ x: posX, y: posY, z: posZ });

            // Generate Slot Cyber-Wireframe Visuals (Holographic boundaries of slot)
            const geometry = new THREE.BoxGeometry(1, 1, 1);
            const material = new THREE.MeshBasicMaterial({
                color: 0x475569,
                wireframe: true,
                transparent: true,
                opacity: 0.25
            });
            const slotCube = new THREE.Mesh(geometry, material);
            slotCube.position.set(posX, posY, posZ);
            scene.add(slotCube);
        }
    }
}

// RAYCASTER & INTERACTION
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

// Globally listen to click events
window.addEventListener("click", (event) => {
    // Only raycast when the click target is exactly the 3D canvas
    if (event.target !== renderer.domElement) return;

    // Normalizing mouse coordinates to full screen space
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(packageMeshes);

    if (intersects.length > 0) {
        const clickedMesh = intersects[0].object;
        selectPackageMesh(clickedMesh);
    } else {
        clearHighlights();
    }
});

// ============================================================
// DYNAMIC TEXTURE GENERATION FOR CARDBOARD SHIPPING BOXES
// ============================================================

const packageTextureCache = {};

function getPackageMaterials(pkg) {
    const cacheKey = `${pkg.package_identifier}_${pkg.lifespan}`;
    let textures;

    if (packageTextureCache[cacheKey]) {
        textures = packageTextureCache[cacheKey];
    } else {
        // 1. Generate Front Face Texture (With Shipping Label & colored QA Sticker)
        const canvasFront = document.createElement("canvas");
        canvasFront.width = 256;
        canvasFront.height = 256;
        const ctx = canvasFront.getContext("2d");

        // Base Matte Cardboard color
        ctx.fillStyle = "#c58f58";
        ctx.fillRect(0, 0, 256, 256);

        // Add cardboard grain/noise
        ctx.fillStyle = "rgba(0, 0, 0, 0.03)";
        for (let i = 0; i < 400; i++) {
            const x = Math.random() * 256;
            const y = Math.random() * 256;
            ctx.fillRect(x, y, 1.5, 1.5);
        }

        // Write Shipping Label (White Background)
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(15, 15, 130, 95);

        // Shipping Label text details
        ctx.fillStyle = "#1e293b";
        ctx.font = "bold 9px 'Inter', sans-serif";
        ctx.fillText("FROM: LOGISTICS CENTRAL", 20, 28);
        ctx.fillText("TO: WH-BAY B1", 20, 39);
        ctx.fillText("PKG ID:", 20, 52);
        
        ctx.font = "bold 11px 'Inter', sans-serif";
        ctx.fillStyle = "#0284c7"; // Cyan-blue accent color for ID
        ctx.fillText(pkg.package_identifier, 20, 64);

        // Draw dynamic, realistic barcode
        ctx.fillStyle = "#000000";
        ctx.fillRect(20, 74, 3, 24);
        ctx.fillRect(25, 74, 1, 24);
        ctx.fillRect(28, 74, 5, 24);
        ctx.fillRect(35, 74, 2, 24);
        ctx.fillRect(39, 74, 1, 24);
        ctx.fillRect(42, 74, 4, 24);
        ctx.fillRect(48, 74, 2, 24);
        ctx.fillRect(52, 74, 1, 24);
        ctx.fillRect(55, 74, 6, 24);
        ctx.fillRect(63, 74, 2, 24);
        ctx.fillRect(67, 74, 3, 24);
        
        // Draw dynamic, realistic QR code
        ctx.fillRect(110, 70, 28, 28);
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(113, 73, 22, 22);
        ctx.fillStyle = "#000000";
        ctx.fillRect(116, 76, 16, 16);
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(120, 80, 8, 8);
        ctx.fillStyle = "#000000";
        ctx.fillRect(123, 83, 2, 2);

        // Logistics QA Status Sticker (Red/Yellow/Green based on lifespan)
        let statusColor = "#10b981"; // Emerald Green (Healthy)
        let statusLabel = "QA PASS: OK";
        let priorityLabel = "LIFESPAN: LONG";

        if (pkg.lifespan < 5) {
            statusColor = "#ef4444"; // Rose Red (Urgent)
            statusLabel = "QA WARN: EXPIRY";
            priorityLabel = "EXPIRY URGENT";
        } else if (pkg.lifespan < 10) {
            statusColor = "#f59e0b"; // Amber Orange (Moderate)
            statusLabel = "QA HOLD: MID";
            priorityLabel = "DISPATCH SOON";
        }

        // Sticker background
        ctx.fillStyle = statusColor;
        ctx.fillRect(15, 125, 226, 65);

        // Sticker text
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 11px 'Inter', sans-serif";
        ctx.fillText(statusLabel, 25, 142);
        ctx.font = "bold 9px 'Inter', sans-serif";
        ctx.fillText(priorityLabel, 25, 157);
        ctx.fillText(`SHELF LIFE: ${pkg.lifespan} DAYS`, 25, 171);

        // Up arrow warning logistics icons
        ctx.strokeStyle = "rgba(0,0,0,0.18)";
        ctx.lineWidth = 2.5;
        
        ctx.beginPath();
        ctx.moveTo(175, 45); ctx.lineTo(175, 75);
        ctx.moveTo(175, 45); ctx.lineTo(168, 52);
        ctx.moveTo(175, 45); ctx.lineTo(182, 52);
        
        ctx.moveTo(195, 45); ctx.lineTo(195, 75);
        ctx.moveTo(195, 45); ctx.lineTo(188, 52);
        ctx.moveTo(195, 45); ctx.lineTo(202, 52);
        ctx.stroke();

        // 2. Generate Top Face Texture (With Brown Fiber Packing Tape)
        const canvasTop = document.createElement("canvas");
        canvasTop.width = 256;
        canvasTop.height = 256;
        const ctxTop = canvasTop.getContext("2d");
        
        ctxTop.fillStyle = "#c58f58";
        ctxTop.fillRect(0, 0, 256, 256);
        
        // Add noise
        ctxTop.fillStyle = "rgba(0, 0, 0, 0.03)";
        for (let i = 0; i < 400; i++) {
            const x = Math.random() * 256;
            const y = Math.random() * 256;
            ctxTop.fillRect(x, y, 1.5, 1.5);
        }
        
        // Thick Brown Packing Tape running across center
        ctxTop.fillStyle = "#78350f";
        ctxTop.fillRect(0, 110, 256, 36);

        // 3. Generate Plain Cardboard Canvas for other faces
        const canvasPlain = document.createElement("canvas");
        canvasPlain.width = 128;
        canvasPlain.height = 128;
        const ctxPlain = canvasPlain.getContext("2d");
        ctxPlain.fillStyle = "#c58f58";
        ctxPlain.fillRect(0, 0, 128, 128);
        ctxPlain.fillStyle = "rgba(0, 0, 0, 0.03)";
        for (let i = 0; i < 200; i++) {
            const x = Math.random() * 128;
            const y = Math.random() * 128;
            ctxPlain.fillRect(x, y, 1.5, 1.5);
        }

        // Convert to ThreeJS textures
        const textureFront = new THREE.CanvasTexture(canvasFront);
        const textureTop = new THREE.CanvasTexture(canvasTop);
        const texturePlain = new THREE.CanvasTexture(canvasPlain);

        textures = { front: textureFront, top: textureTop, plain: texturePlain };
        packageTextureCache[cacheKey] = textures;
    }

    // Always return a fresh array of material instances so each package highlights independently
    // Materials array order: Right (+X), Left (-X), Top (+Y), Bottom (-Y), Front (+Z), Back (-Z)
    return [
        new THREE.MeshStandardMaterial({ map: textures.plain, roughness: 0.8, emissive: new THREE.Color(0x000000), emissiveIntensity: 0 }), // Right (+X)
        new THREE.MeshStandardMaterial({ map: textures.plain, roughness: 0.8, emissive: new THREE.Color(0x000000), emissiveIntensity: 0 }), // Left (-X)
        new THREE.MeshStandardMaterial({ map: textures.top, roughness: 0.8, emissive: new THREE.Color(0x000000), emissiveIntensity: 0 }),   // Top (+Y)
        new THREE.MeshStandardMaterial({ map: textures.plain, roughness: 0.8, emissive: new THREE.Color(0x000000), emissiveIntensity: 0 }), // Bottom (-Y)
        new THREE.MeshStandardMaterial({ map: textures.front, roughness: 0.8, emissive: new THREE.Color(0x000000), emissiveIntensity: 0 }), // Front (+Z)
        new THREE.MeshStandardMaterial({ map: textures.front, roughness: 0.8, emissive: new THREE.Color(0x000000), emissiveIntensity: 0 })  // Back (-Z) - map label to both front/back so it's always facing the openings!
    ];
}

// LOAD PACKAGES FROM DATABASE
async function loadPackages() {
    try {
        const response = await fetch("/packages");
        if (!response.ok) throw new Error("Could not load database records");
        const packages = await response.json();
        
        if (isInitialLoad) {
            // Clear old package meshes
            packageMeshes.forEach(mesh => {
                scene.remove(mesh);
            });
            packageMeshes.length = 0;
            selectedMesh = null;
            searchedMesh = null;

            packages.forEach(pkg => {
                createPackage(pkg);
            });
            isInitialLoad = false;
        } else {
            // Compare fetched packages with packageMeshes to detect dynamic additions
            packages.forEach(pkg => {
                const exists = packageMeshes.some(mesh => mesh.userData.package_identifier === pkg.package_identifier);
                const alreadyQueued = forkliftQueue.some(task => task.type === "arrival" && task.pkg.package_identifier === pkg.package_identifier)
                                      || (currentForkliftTask && currentForkliftTask.type === "arrival" && currentForkliftTask.pkg.package_identifier === pkg.package_identifier);
                
                if (!exists && !alreadyQueued) {
                    forkliftQueue.push({
                        type: "arrival",
                        pkg: pkg,
                        slotIndex: pkg.slot_index
                    });
                }
            });

            // Clean up any package meshes that were deleted from the database
            for (let i = packageMeshes.length - 1; i >= 0; i--) {
                const mesh = packageMeshes[i];
                const stillExists = packages.some(pkg => pkg.package_identifier === mesh.userData.package_identifier);
                const beingDispatched = (currentForkliftTask && currentForkliftTask.type === "dispatch" && currentForkliftTask.pkg.package_identifier === mesh.userData.package_identifier)
                                        || forkliftQueue.some(task => task.type === "dispatch" && task.pkg.package_identifier === mesh.userData.package_identifier);
                
                if (!stillExists && !beingDispatched) {
                    scene.remove(mesh);
                    packageMeshes.splice(i, 1);
                }
            }
        }
        
        // Reset details panel to default
        resetDetailsPanel();
    } catch (err) {
        showToast("Error loading packages from database", "error");
        console.error(err);
    }
}

// CREATE INDIVIDUAL 3D PACKAGE MESH
function createPackage(pkg) {
    const pos = slotPositions[pkg.slot_index];
    if (!pos) return;

    // Use size 0.9 so it fits elegantly inside the slot boundaries
    const geometry = new THREE.BoxGeometry(0.9, 0.9, 0.9);

    // Get dynamic cardboard textures with unique shipping IDs & QA tags
    const materials = getPackageMaterials(pkg);

    const mesh = new THREE.Mesh(geometry, materials);
    mesh.position.set(pos.x, pos.y, pos.z);
    mesh.userData = pkg; // Hold full database package info

    scene.add(mesh);
    packageMeshes.push(mesh);
}

// RESET ALL CUBE MATERIALS TO STANDARD CARD BOARD
function resetAllMaterials() {
    packageMeshes.forEach(mesh => {
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        mats.forEach(mat => {
            mat.color.setHex(0xffffff); // Remove tint
            mat.emissive.setHex(0x000000); // Remove glow
            mat.emissiveIntensity = 0;
            mat.transparent = true;
            mat.opacity = 1.0; // Full package opacity
        });
    });

    // Restore full solid opacity to ALL racking units
    for (let z = 0; z < depth; z++) {
        if (rackPillarMaterials[z]) rackPillarMaterials[z].opacity = 1.0;
        if (rackShelfMaterials[z]) rackShelfMaterials[z].opacity = 1.0;
        if (rackBeamMaterials[z]) rackBeamMaterials[z].opacity = 1.0;
    }
}

// SELECT & HIGHLIGHT PACKAGE (BLUE HOLOGRAPHIC GLOW)
function selectPackageMesh(mesh) {
    resetAllMaterials();
    selectedMesh = mesh;
    searchedMesh = null;

    // Apply Deep Royal Blue Emissive glow to all sides while keeping cardboard readable
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    mats.forEach(mat => {
        mat.emissive.setHex(0x1d4ed8); // Emissive Blue
        mat.emissiveIntensity = 0.8;
        mat.transparent = true;
        mat.opacity = 1.0; // Keep selected package 100% solid
    });

    // Fade out all OTHER packages in the warehouse
    packageMeshes.forEach(otherMesh => {
        if (otherMesh !== mesh) {
            const otherMats = Array.isArray(otherMesh.material) ? otherMesh.material : [otherMesh.material];
            otherMats.forEach(mat => {
                mat.transparent = true;
                mat.opacity = 0.15; // Holographic fade
            });
        }
    });

    const pkg = mesh.userData;
    // Calculate the shelf z-index for this package
    // Since slots are created in loops: z (depth), y (rows), x (cols)
    // The slot index is: z * (rows * cols) + y * cols + x
    const packageZ = Math.floor(pkg.slot_index / (rows * cols));

    // Keep ONLY the shelf holding the selected package opaque; fade all other shelves!
    for (let z = 0; z < depth; z++) {
        if (z === packageZ) {
            if (rackPillarMaterials[z]) rackPillarMaterials[z].opacity = 1.0;
            if (rackShelfMaterials[z]) rackShelfMaterials[z].opacity = 1.0;
            if (rackBeamMaterials[z]) rackBeamMaterials[z].opacity = 1.0;
        } else {
            if (rackPillarMaterials[z]) rackPillarMaterials[z].opacity = 0.12;
            if (rackShelfMaterials[z]) rackShelfMaterials[z].opacity = 0.12;
            if (rackBeamMaterials[z]) rackBeamMaterials[z].opacity = 0.12;
        }
    }

    updateDetailsPanel(pkg);
    
    // Smoothly focus camera controls on the package
    focusCamera(mesh.position);
}

// SEARCH & HIGHLIGHT PACKAGE (BRIGHT CYAN HOLOGRAPHIC GLOW)
function highlightSearchedPackage(mesh) {
    resetAllMaterials();
    searchedMesh = mesh;
    selectedMesh = null;

    // Apply glowing Bright Cyan-Blue Emissive glow
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    mats.forEach(mat => {
        mat.emissive.setHex(0x0891b2); // Emissive Cyan
        mat.emissiveIntensity = 0.9;
        mat.transparent = true;
        mat.opacity = 1.0; // Keep focused package 100% solid
    });

    // Fade out all OTHER packages in the warehouse
    packageMeshes.forEach(otherMesh => {
        if (otherMesh !== mesh) {
            const otherMats = Array.isArray(otherMesh.material) ? otherMesh.material : [otherMesh.material];
            otherMats.forEach(mat => {
                mat.transparent = true;
                mat.opacity = 0.15; // Holographic fade
            });
        }
    });

    const pkg = mesh.userData;
    const packageZ = Math.floor(pkg.slot_index / (rows * cols));

    // Keep ONLY the shelf holding the searched package opaque; fade all other shelves!
    for (let z = 0; z < depth; z++) {
        if (z === packageZ) {
            if (rackPillarMaterials[z]) rackPillarMaterials[z].opacity = 1.0;
            if (rackShelfMaterials[z]) rackShelfMaterials[z].opacity = 1.0;
            if (rackBeamMaterials[z]) rackBeamMaterials[z].opacity = 1.0;
        } else {
            if (rackPillarMaterials[z]) rackPillarMaterials[z].opacity = 0.12;
            if (rackShelfMaterials[z]) rackShelfMaterials[z].opacity = 0.12;
            if (rackBeamMaterials[z]) rackBeamMaterials[z].opacity = 0.12;
        }
    }

    updateDetailsPanel(pkg);
    
    // Smoothly focus camera controls on the package
    focusCamera(mesh.position);
}

// CLEAR ALL SELECTION AND SEARCH HIGHLIGHTS
function clearHighlights() {
    resetAllMaterials();
    selectedMesh = null;
    searchedMesh = null;
    resetDetailsPanel();
}

// DETAILS PANEL BINDINGS
function updateDetailsPanel(pkg) {
    const detailsPanel = document.getElementById("details");
    const pos = slotPositions[pkg.slot_index] || { x: 0, y: 0, z: 0 };
    detailsPanel.innerHTML = `
        <div class="details-title">Package Details</div>
        <div class="details-row">
            <span class="details-label">ID / Identifier:</span>
            <span class="details-value">${pkg.package_identifier}</span>
        </div>
        <div class="details-row">
            <span class="details-label">Lifespan:</span>
            <span class="details-value">${pkg.lifespan} days</span>
        </div>
        <div class="details-row">
            <span class="details-label">Slot Assigned:</span>
            <span class="details-value">Slot #${pkg.slot_index}</span>
        </div>
        <div class="details-row">
            <span class="details-label">Coordinates:</span>
            <span class="details-value">X:${pos.x.toFixed(1)}, Y:${pos.y.toFixed(1)}, Z:${pos.z.toFixed(1)}</span>
        </div>
    `;
}

function resetDetailsPanel() {
    const detailsPanel = document.getElementById("details");
    detailsPanel.innerHTML = `
        <div class="details-title">Package Details</div>
        <div class="details-empty">Click a package in the 3D grid or search for one to inspect its properties.</div>
    `;
}

// FOCUS CAMERA TARGET SMOOTHLY
function focusCamera(targetPos) {
    // Move controls focus target
    gsapAnimate(controls.target, targetPos, 0.8);
    
    // Position camera dynamically to frame the object
    const idealCamPos = new THREE.Vector3(
        targetPos.x + 8,
        targetPos.y + 6,
        targetPos.z + 8
    );
    gsapAnimate(camera.position, idealCamPos, 0.8);
}

// Minimal smooth lerp animation helper for camera transitions
function gsapAnimate(obj, target, duration) {
    const start = { x: obj.x, y: obj.y, z: obj.z };
    const startTime = performance.now();

    function step() {
        const now = performance.now();
        const progress = Math.min((now - startTime) / (duration * 1000), 1);
        
        // Cubic ease out
        const ease = 1 - Math.pow(1 - progress, 3);

        obj.x = start.x + (target.x - start.x) * ease;
        obj.y = start.y + (target.y - start.y) * ease;
        obj.z = start.z + (target.z - start.z) * ease;

        if (progress < 1) {
            requestAnimationFrame(step);
        }
    }
    requestAnimationFrame(step);
}

// SEARCH PACKAGE HANDLER
document.getElementById("searchBtn").addEventListener("click", () => {
    const searchVal = document.getElementById("searchInput").value.trim();
    if (!searchVal) {
        showToast("Please enter a package ID to search", "error");
        return;
    }

    const matchedMesh = packageMeshes.find(mesh => 
        mesh.userData.package_identifier.toLowerCase() === searchVal.toLowerCase()
    );

    if (matchedMesh) {
        highlightSearchedPackage(matchedMesh);
        showToast(`Located Package: ${searchVal}`);
    } else {
        showToast(`Package ID "${searchVal}" not found`, "error");
    }
});

// DISPATCH PACKAGE HANDLER
document.getElementById("dispatchBtn").addEventListener("click", () => {
    const dispatchVal = document.getElementById("dispatchInput").value.trim();
    if (!dispatchVal) {
        showToast("Please enter a package ID to dispatch", "error");
        return;
    }

    const matchedMesh = packageMeshes.find(mesh => 
        mesh.userData.package_identifier.toLowerCase() === dispatchVal.toLowerCase()
    );

    if (!matchedMesh) {
        showToast(`Package ID "${dispatchVal}" not found in warehouse`, "error");
        return;
    }

    const alreadyQueued = forkliftQueue.some(task => task.type === "dispatch" && task.pkg.package_identifier.toLowerCase() === dispatchVal.toLowerCase())
                          || (currentForkliftTask && currentForkliftTask.type === "dispatch" && currentForkliftTask.pkg.package_identifier.toLowerCase() === dispatchVal.toLowerCase());
    
    if (alreadyQueued) {
        showToast(`Package "${dispatchVal}" is already queued for dispatch`, "error");
        return;
    }

    // Queue the dispatch task!
    forkliftQueue.push({
        type: "dispatch",
        pkg: matchedMesh.userData,
        mesh: matchedMesh,
        slotIndex: matchedMesh.userData.slot_index
    });

    showToast(`Forklift dispatched to retrieve ${matchedMesh.userData.package_identifier}`);
    document.getElementById("dispatchInput").value = "";
});

// DYNAMIC INPUTS FOR QUANTITY ADDITION
document.getElementById("generateInputs").addEventListener("click", () => {
    const qtyInput = document.getElementById("quantity");
    const quantity = parseInt(qtyInput.value);

    if (isNaN(quantity) || quantity < 1 || quantity > 60) {
        showToast("Please enter a valid quantity between 1 and 60", "error");
        return;
    }

    const container = document.getElementById("packageInputs");
    container.innerHTML = "";

    // Generate N inputs dynamically
    for (let i = 0; i < quantity; i++) {
        // Pre-fill Package IDs with random alphanumeric helpers to speed up manual testing!
        const randomId = "PKG-" + Math.random().toString(36).substring(2, 6).toUpperCase();
        const randomLifespan = Math.floor(Math.random() * 15) + 1; // random 1-15 lifespan

        container.innerHTML += `
            <div class="pkgInput">
                <div class="pkgInput-header">Package #${i + 1}</div>
                <input type="text" placeholder="Package ID" class="pkgId" value="${randomId}">
                <input type="number" placeholder="Lifespan (days)" class="pkgLife" value="${randomLifespan}" min="1">
            </div>
        `;
    }

    // Show final add button
    document.getElementById("addBtn").style.display = "block";
});

// SUBMIT PACKAGES TO DATABASE
document.getElementById("addBtn").addEventListener("click", async () => {
    const idFields = document.querySelectorAll(".pkgId");
    const lifeFields = document.querySelectorAll(".pkgLife");
    
    const packages = [];
    let validationPassed = true;

    for (let i = 0; i < idFields.length; i++) {
        const identifier = idFields[i].value.trim();
        const lifespan = parseInt(lifeFields[i].value);

        if (!identifier) {
            showToast(`Identifier is empty for Package #${i + 1}`, "error");
            validationPassed = false;
            break;
        }

        if (isNaN(lifespan) || lifespan < 1) {
            showToast(`Lifespan must be at least 1 day for Package #${i + 1}`, "error");
            validationPassed = false;
            break;
        }

        packages.push({
            package_identifier: identifier,
            lifespan: lifespan
        });
    }

    if (!validationPassed) return;

    try {
        const response = await fetch("/add-package", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ packages })
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(errText);
        }

        showToast("Packages successfully added!");
        
        // Clean up UI inputs
        document.getElementById("packageInputs").innerHTML = "";
        document.getElementById("addBtn").style.display = "none";
        document.getElementById("quantity").value = "";

        // Reload package visuals
        loadPackages();
    } catch (err) {
        showToast(err.message || "Failed to add packages", "error");
        console.error(err);
    }
});

// TOAST NOTIFICATIONS
let toastTimer = null;
function showToast(message, type = "success") {
    const toast = document.getElementById("toast");
    toast.textContent = message;
    
    if (type === "error") {
        toast.className = "toast error";
    } else {
        toast.className = "toast";
    }
    
    toast.style.display = "block";

    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
        toast.style.display = "none";
    }, 3000);
}

// ==========================================
// COLLISION-FREE WAYPOINT ROUTING LOGIC
// ==========================================
async function executeDatabaseDispatch(pkgId) {
    try {
        const response = await fetch(`/dispatch/${encodeURIComponent(pkgId)}`, {
            method: "DELETE"
        });

        if (!response.ok) throw new Error("Dispatch failed");
        
        const resText = await response.text();
        showToast(`Package ${pkgId} successfully dispatched!`);
        
        // Reload all packages - free slots are instantly available for new items!
        loadPackages();
    } catch (err) {
        showToast(`Could not delete package: ${pkgId}`, "error");
        console.error(err);
    }
}

function moveTowards(target, step) {
    const dir = new THREE.Vector3().subVectors(target, forkliftGroup.position);
    const dist = dir.length();
    if (dist <= step) {
        forkliftGroup.position.copy(target);
    } else {
        dir.normalize();
        forkliftGroup.position.addScaledVector(dir, step);
    }
}

function rotateTowards(target) {
    const dx = target.x - forkliftGroup.position.x;
    const dz = target.z - forkliftGroup.position.z;
    if (Math.abs(dx) > 0.01 || Math.abs(dz) > 0.01) {
        const targetAngle = Math.atan2(dx, dz);
        let diff = targetAngle - forkliftGroup.rotation.y;
        diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        forkliftGroup.rotation.y += diff * 0.15; // smooth rotation turn
    }
}

function getRotationDiff(target) {
    const dx = target.x - forkliftGroup.position.x;
    const dz = target.z - forkliftGroup.position.z;
    if (Math.abs(dx) > 0.01 || Math.abs(dz) > 0.01) {
        const targetAngle = Math.atan2(dx, dz);
        let diff = targetAngle - forkliftGroup.rotation.y;
        diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        return Math.abs(diff);
    }
    return 0;
}

function getApproachZ(z, zOffset) {
    return (z % 2 === 0) ? (zOffset - 2.0) : (zOffset + 2.0);
}

// Generate the Manhattan waypoint route from a start position to the rack slot approach point
function getPath(start, end, slotIndex) {
    const path = [];
    const targetX = end.x;
    
    const z = Math.floor(slotIndex / (rows * cols));
    const zOffset = slotPositions[slotIndex].z;
    const approachZ = getApproachZ(z, zOffset);
    
    // 1. Move from start bay to vertical corridor at X = -2.2, Z = -2
    path.push(new THREE.Vector3(-2.2, 0, -2));
    
    // 2. Turn and drive down vertical corridor Z to target approach Z
    path.push(new THREE.Vector3(-2.2, 0, approachZ));
    
    // 3. Turn and drive horizontally along target aisle to approach slot point
    path.push(new THREE.Vector3(targetX, 0, approachZ));
    
    return path;
}

// Generate the Manhattan waypoint route from approach point back to destination bay (Home or Exit)
function getReturnPath(start, end, slotIndex) {
    const path = [];
    const z = Math.floor(slotIndex / (rows * cols));
    const zOffset = slotPositions[slotIndex].z;
    const approachZ = getApproachZ(z, zOffset);
    
    // 1. Drive horizontally back down aisle to vertical corridor at X = -2.2
    path.push(new THREE.Vector3(-2.2, 0, approachZ));
    
    // 2. Drive down vertical corridor back to front access lane Z = -2
    path.push(new THREE.Vector3(-2.2, 0, -2));
    
    // 3. Drive horizontally to destination (Home/Exit bay)
    path.push(end.clone());
    
    return path;
}

function updateForklift() {
    // 1. Pulsing safety warning beacon light
    if (forkliftBeaconLight) {
        const pulse = 0.5 + Math.sin(performance.now() * 0.015) * 0.5;
        forkliftBeaconLight.intensity = pulse * 1.5;
    }

    // 2. Real-time Telemetry coordinates HUD update
    if (forkliftGroup && forkliftForks) {
        const fx = forkliftGroup.position.x;
        const fy = forkliftForks.position.y + forkliftGroup.position.y;
        const fz = forkliftGroup.position.z;
        document.getElementById("forklift-coords").textContent = `X: ${fx.toFixed(2)}, Y: ${fy.toFixed(2)}, Z: ${fz.toFixed(2)}`;
    }

    // 2.5. Telescopic Mast Animation update
    if (forkliftInnerMast && forkliftForks) {
        forkliftInnerMast.position.y = forkliftForks.position.y * 0.6;
    }

    // 3. Process the Task Queue
    if (!currentForkliftTask) {
        if (forkliftQueue.length > 0) {
            currentForkliftTask = forkliftQueue.shift();
            
            // Set up target slot coordinates
            const slotPos = slotPositions[currentForkliftTask.slotIndex];
            currentForkliftTask.slotPos = new THREE.Vector3(slotPos.x, 0, slotPos.z);
            currentForkliftTask.slotYHeight = slotPos.y - 0.5; // Fork height to align with slot
            
            // Set up segment waypoints
            if (currentForkliftTask.type === "arrival") {
                // For arrival, first drive empty to the Entry Bay to pick up cargo
                pathWaypoints = [arrivalBay.clone()];
                currentWaypointIdx = 0;
                
                const cargoEl = document.getElementById("forklift-cargo");
                cargoEl.textContent = "NONE";
                cargoEl.className = "hud-value cargo-none";
            } else {
                // For dispatch, drive empty to retrieve package from target slot
                pathWaypoints = getPath(forkliftGroup.position, currentForkliftTask.slotPos, currentForkliftTask.slotIndex);
                currentWaypointIdx = 0;
                
                const cargoEl = document.getElementById("forklift-cargo");
                cargoEl.textContent = "NONE";
                cargoEl.className = "hud-value cargo-none";
            }

            forkliftState = "DRIVING_TO_PICK";
            
            // Set status HUD
            const statusEl = document.getElementById("forklift-status");
            statusEl.textContent = "DRIVING TO PICK";
            statusEl.className = "hud-value status-moving";
        } else {
            // Forklift is fully IDLE
            forkliftState = "IDLE";
            
            const statusEl = document.getElementById("forklift-status");
            statusEl.textContent = "IDLE";
            statusEl.className = "hud-value status-idle";
            
            const cargoEl = document.getElementById("forklift-cargo");
            cargoEl.textContent = "NONE";
            cargoEl.className = "hud-value cargo-none";
            
            // Return to parking spot if away
            const dist = forkliftGroup.position.distanceTo(homePosition);
            if (dist > 0.05) {
                if (getRotationDiff(homePosition) > 0.05) {
                    rotateTowards(homePosition);
                } else {
                    moveTowards(homePosition, 0.05);
                }
            }
            return;
        }
    }

    // 4. Waypoint & State Machine Controller
    const task = currentForkliftTask;
    const slotPos = task.slotPos;
    const slotY = task.slotYHeight;
    const targetX = slotPos.x;
    const targetZ = slotPos.z;

    const z = Math.floor(task.slotIndex / (rows * cols));
    const zOffset = slotPositions[task.slotIndex].z;
    // Odd/Even rack engagement directions
    const engageZ = (z % 2 === 0) ? (zOffset - 0.8) : (zOffset + 0.8);
    const retractZ = getApproachZ(z, zOffset);

    const speed = 0.08;
    const liftSpeed = 0.02;

    switch (forkliftState) {
        case "DRIVING_TO_PICK":
            if (pathWaypoints.length > 0 && currentWaypointIdx < pathWaypoints.length) {
                const wp = pathWaypoints[currentWaypointIdx];
                if (getRotationDiff(wp) > 0.05) {
                    rotateTowards(wp); // Turn completely first before moving to prevent corner clipping
                } else if (forkliftGroup.position.distanceTo(wp) > 0.05) {
                    moveTowards(wp, speed);
                } else {
                    currentWaypointIdx++;
                }
            } else {
                // Replaced segment completions
                if (task.type === "arrival" && forkliftGroup.position.distanceTo(arrivalBay) < 0.15 && pathWaypoints.length === 1) {
                    // Reached Entry Bay! Spawn package on forks inside Loading Dock A
                    const geom = new THREE.BoxGeometry(0.9, 0.9, 0.9);
                    const mats = getPackageMaterials(task.pkg);
                    const pkgMesh = new THREE.Mesh(geom, mats);
                    pkgMesh.position.set(0, 0.5, 0.15);
                    forkliftForks.add(pkgMesh);
                    task.pkgMesh = pkgMesh;
                    
                    const cargoEl = document.getElementById("forklift-cargo");
                    cargoEl.textContent = task.pkg.package_identifier;
                    cargoEl.className = "hud-value cargo-active";
                    
                    // Generate new waypoints to slot approach point
                    pathWaypoints = getPath(arrivalBay, slotPos, task.slotIndex);
                    currentWaypointIdx = 0;
                } else {
                    // Arrived at slot approach point
                    if (task.type === "arrival") {
                        forkliftState = "LIFTING_FOR_DROP";
                        const statusEl = document.getElementById("forklift-status");
                        statusEl.textContent = "LIFTING CARGO";
                        statusEl.className = "hud-value status-acting";
                    } else {
                        forkliftState = "LIFTING_FOR_PICK";
                        const statusEl = document.getElementById("forklift-status");
                        statusEl.textContent = "LIFTING FORKS";
                        statusEl.className = "hud-value status-acting";
                    }
                }
            }
            break;

        case "LIFTING_FOR_PICK": {
            // Rotate in place to face target shelf
            const slotTargetPoint = new THREE.Vector3(targetX, 0, zOffset);
            rotateTowards(slotTargetPoint);

            // Raise empty forks to target slot height
            let pickHeightReached = false;
            if (Math.abs(forkliftForks.position.y - slotY) > 0.02) {
                const dir = forkliftForks.position.y < slotY ? 1 : -1;
                forkliftForks.position.y += dir * liftSpeed;
            } else {
                pickHeightReached = true;
            }

            // Only transition if aligned in angle and height
            if (pickHeightReached && getRotationDiff(slotTargetPoint) < 0.05) {
                forkliftState = "FORWARD_PICK";
                const statusEl = document.getElementById("forklift-status");
                statusEl.textContent = "PICKING PACKAGE";
                statusEl.className = "hud-value status-acting";
            }
            break;
        }

        case "FORWARD_PICK": {
            // Pantograph Reach: Slide forks forward into slot while forklift body remains stationary
            const targetExtendZ = Math.abs(retractZ - zOffset) - 0.15;
            if (forkliftForks.position.z < targetExtendZ) {
                forkliftForks.position.z += 0.05;
            } else {
                forkliftForks.position.z = targetExtendZ;
                
                const matchedMesh = task.mesh;
                if (matchedMesh) {
                    scene.remove(matchedMesh);
                    const idx = packageMeshes.indexOf(matchedMesh);
                    if (idx > -1) packageMeshes.splice(idx, 1);
                    
                    // Parent package to forks
                    matchedMesh.position.set(0, 0.5, 0.15);
                    matchedMesh.rotation.set(0, 0, 0);
                    forkliftForks.add(matchedMesh);
                    task.pkgMesh = matchedMesh;
                    
                    const cargoEl = document.getElementById("forklift-cargo");
                    cargoEl.textContent = task.pkg.package_identifier;
                    cargoEl.className = "hud-value cargo-active";
                }
                
                // Lift forks slightly to clear cross beams
                forkliftForks.position.y += 0.15;
                forkliftState = "RETRACTING_PICK";
            }
            break;
        }

        case "RETRACTING_PICK": {
            // Pantograph Reach: Retract forks back into the forklift chassis
            if (forkliftForks.position.z > 0.65) {
                forkliftForks.position.z -= 0.05;
            } else {
                forkliftForks.position.z = 0.65;
                forkliftState = "LOWERING_TRAVEL";
                const statusEl = document.getElementById("forklift-status");
                statusEl.textContent = "LOWERING FORKS";
                statusEl.className = "hud-value status-acting";
            }
            break;
        }

        case "LOWERING_TRAVEL":
            // Lower carriage to travel height
            if (forkliftForks.position.y > 0.12) {
                forkliftForks.position.y -= liftSpeed;
            } else {
                forkliftForks.position.y = 0.1;
                
                // Drive loaded to Exit Bay (Dock B)
                pathWaypoints = getReturnPath(slotPos, dispatchBay, task.slotIndex);
                currentWaypointIdx = 0;
                forkliftState = "DRIVING_TO_DELIVER";
                
                const statusEl = document.getElementById("forklift-status");
                statusEl.textContent = "DELIVERING CARGO";
                statusEl.className = "hud-value status-moving";
            }
            break;

        case "DRIVING_TO_DELIVER":
            if (pathWaypoints.length > 0 && currentWaypointIdx < pathWaypoints.length) {
                const wp = pathWaypoints[currentWaypointIdx];
                if (getRotationDiff(wp) > 0.05) {
                    rotateTowards(wp); // Turn completely first before moving to prevent corner clipping
                } else if (forkliftGroup.position.distanceTo(wp) > 0.05) {
                    moveTowards(wp, speed);
                } else {
                    currentWaypointIdx++;
                }
            } else {
                // Delivery drive finished
                if (task.type === "arrival") {
                    // Arrival complete, return home
                    currentForkliftTask = null;
                    forkliftState = "IDLE";
                } else {
                    // Dispatch reached Exit Bay! Detach package and flush it inside Dock B
                    const pkgMesh = task.pkgMesh;
                    if (pkgMesh) {
                        forkliftForks.remove(pkgMesh);
                        scene.add(pkgMesh);
                        pkgMesh.position.copy(dispatchBay).add(new THREE.Vector3(0, 0.5, 0));
                        
                        let opacity = 1.0;
                        function fade() {
                            opacity -= 0.05;
                            if (opacity > 0) {
                                const mats = Array.isArray(pkgMesh.material) ? pkgMesh.material : [pkgMesh.material];
                                mats.forEach(mat => {
                                    mat.transparent = true;
                                    mat.opacity = opacity;
                                });
                                requestAnimationFrame(fade);
                            } else {
                                scene.remove(pkgMesh);
                            }
                        }
                        fade();
                    }
                    
                    // Trigger DB delete
                    executeDatabaseDispatch(task.pkg.package_identifier);
                    
                    const cargoEl = document.getElementById("forklift-cargo");
                    cargoEl.textContent = "NONE";
                    cargoEl.className = "hud-value cargo-none";
                    
                    // Drive back to Home
                    pathWaypoints = [homePosition.clone()];
                    currentWaypointIdx = 0;
                    forkliftState = "LOWERING_IDLE";
                    
                    const statusEl = document.getElementById("forklift-status");
                    statusEl.textContent = "RETURNING HOME";
                    statusEl.className = "hud-value status-moving";
                }
            }
            break;

        case "LIFTING_FOR_DROP": {
            // Rotate in place to face target shelf
            const slotTargetPoint = new THREE.Vector3(targetX, 0, zOffset);
            rotateTowards(slotTargetPoint);

            // Raise loaded forks to target slot height
            let dropHeightReached = false;
            if (Math.abs(forkliftForks.position.y - slotY) > 0.02) {
                const dir = forkliftForks.position.y < slotY ? 1 : -1;
                forkliftForks.position.y += dir * liftSpeed;
            } else {
                dropHeightReached = true;
            }

            // Only transition if aligned in angle and height
            if (dropHeightReached && getRotationDiff(slotTargetPoint) < 0.05) {
                forkliftState = "FORWARD_DROP";
                const statusEl = document.getElementById("forklift-status");
                statusEl.textContent = "PLACING PACKAGE";
                statusEl.className = "hud-value status-acting";
            }
            break;
        }

        case "FORWARD_DROP": {
            // Pantograph Reach: Slide forks forward into slot to drop package
            const targetExtendZ = Math.abs(retractZ - zOffset) - 0.15;
            if (forkliftForks.position.z < targetExtendZ) {
                forkliftForks.position.z += 0.05;
            } else {
                forkliftForks.position.z = targetExtendZ;
                
                const pkgMesh = task.pkgMesh;
                if (pkgMesh) {
                    forkliftForks.remove(pkgMesh);
                    
                    // Add package mesh back to warehouse
                    const actualSlotPos = slotPositions[task.slotIndex];
                    pkgMesh.position.set(actualSlotPos.x, actualSlotPos.y, actualSlotPos.z);
                    pkgMesh.rotation.set(0, 0, 0);
                    pkgMesh.userData = task.pkg;
                    scene.add(pkgMesh);
                    packageMeshes.push(pkgMesh);
                    
                    // Celebrate drop-off with a bright emerald glow!
                    const mats = Array.isArray(pkgMesh.material) ? pkgMesh.material : [pkgMesh.material];
                    mats.forEach(mat => {
                        mat.emissive.setHex(0x10b981);
                        mat.emissiveIntensity = 1.0;
                    });
                    
                    setTimeout(() => {
                        mats.forEach(mat => {
                            mat.emissive.setHex(0x000000);
                            mat.emissiveIntensity = 0.0;
                        });
                    }, 1000);
                }
                
                forkliftState = "RETRACTING_DROP";
            }
            break;
        }

        case "RETRACTING_DROP": {
            // Pantograph Reach: Retract empty forks back into the forklift chassis
            if (forkliftForks.position.z > 0.65) {
                forkliftForks.position.z -= 0.05;
            } else {
                forkliftForks.position.z = 0.65;
                forkliftState = "LOWERING_IDLE";
                const statusEl = document.getElementById("forklift-status");
                statusEl.textContent = "RETURNING HOME";
                statusEl.className = "hud-value status-moving";
            }
            break;
        }

        case "LOWERING_IDLE":
            // Lower empty forks to travel height
            if (forkliftForks.position.y > 0.12) {
                forkliftForks.position.y -= liftSpeed;
            } else {
                forkliftForks.position.y = 0.1;
                
                if (task.type === "arrival") {
                    // Generate return path back to Home
                    pathWaypoints = getReturnPath(slotPos, homePosition, task.slotIndex);
                    currentWaypointIdx = 0;
                    forkliftState = "DRIVING_TO_DELIVER"; // drive return segment
                } else {
                    // Dispatch: drive return segment home from Exit Bay
                    if (pathWaypoints.length > 0 && currentWaypointIdx < pathWaypoints.length) {
                        const wp = pathWaypoints[currentWaypointIdx];
                        if (getRotationDiff(wp) > 0.05) {
                            rotateTowards(wp);
                        } else if (forkliftGroup.position.distanceTo(wp) > 0.05) {
                            moveTowards(wp, speed);
                        } else {
                            currentWaypointIdx++;
                        }
                    } else {
                        currentForkliftTask = null;
                        forkliftState = "IDLE";
                    }
                }
            }
            break;
    }
}

// WINDOW RESIZE BINDING
window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// ENGINE ANIMATION LOOP
function animate() {
    requestAnimationFrame(animate);
    controls.update();
    updateForklift();
    renderer.render(scene, camera);
}

// START ENGINE
animate();
loadPackages();
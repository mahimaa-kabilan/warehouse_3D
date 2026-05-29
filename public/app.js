// ==========================================
// 3D WAREHOUSE TWIN ENGINE (THREE.JS)
// ==========================================

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0f172a); // Premium deep slate background

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

// LIGHTS
const ambientLight = new THREE.AmbientLight(0xffffff, 0.55);
scene.add(ambientLight);

// Primary Directional Light (Warm studio light)
const dirLight1 = new THREE.DirectionalLight(0xffffff, 0.85);
dirLight1.position.set(15, 30, 15);
scene.add(dirLight1);

// Secondary Directional Light (Subtle cyan fill light)
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

// CREATE SHELVES & COMPUTE COORDINATES
// Formula implements pathway gap once in every 2 shelves in depth (z-axis)
// And aligns the first row of cubes exactly above the ground plane (y=0)
for (let z = 0; z < depth; z++) {
    // Supermarket arrangement: Pathway gap of 2 units after every 2 shelves in depth
    const zOffset = z * spacing + Math.floor(z / 2) * pathwayGap;

    for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
            const posX = x * spacing;
            // Ground Alignment: Offset by 0.5 so that cube bottom (height=1) sits exactly on y=0
            const posY = 0.5 + y * spacing;
            const posZ = zOffset;

            slotPositions.push({ x: posX, y: posY, z: posZ });

            // Generate Slot Wireframe Visuals
            const geometry = new THREE.BoxGeometry(1, 1, 1);
            const material = new THREE.MeshBasicMaterial({
                color: 0x475569,
                wireframe: true,
                transparent: true,
                opacity: 0.3
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

// LOAD PACKAGES FROM DATABASE
async function loadPackages() {
    // Clear old package meshes
    packageMeshes.forEach(mesh => {
        scene.remove(mesh);
    });
    packageMeshes.length = 0;
    selectedMesh = null;
    searchedMesh = null;

    try {
        const response = await fetch("/packages");
        if (!response.ok) throw new Error("Could not load database records");
        const packages = await response.json();
        
        packages.forEach(pkg => {
            createPackage(pkg);
        });
        
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

    // Use size 0.9 so it fits elegantly inside the wireframe slot
    const geometry = new THREE.BoxGeometry(0.9, 0.9, 0.9);

    // Harmonic colors based on lifespan:
    // Green (>=10): Healthy, Yellow (<10): Moderate, Red (<5): Urgent
    let colorHex = 0x10b981; // Emerald Green
    if (pkg.lifespan < 5) {
        colorHex = 0xf43f5e; // Rose Red
    } else if (pkg.lifespan < 10) {
        colorHex = 0xf59e0b; // Amber Gold
    }

    const material = new THREE.MeshStandardMaterial({
        color: colorHex,
        roughness: 0.15,
        metalness: 0.1,
        emissive: new THREE.Color(0x000000),
        emissiveIntensity: 0
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(pos.x, pos.y, pos.z);
    mesh.userData = pkg; // Hold full database package info

    scene.add(mesh);
    packageMeshes.push(mesh);
}

// RESET ALL CUBE MATERIALS TO STANDARD COLORS
function resetAllMaterials() {
    packageMeshes.forEach(mesh => {
        const pkg = mesh.userData;
        let baseColor = 0x10b981;
        if (pkg.lifespan < 5) {
            baseColor = 0xf43f5e;
        } else if (pkg.lifespan < 10) {
            baseColor = 0xf59e0b;
        }
        mesh.material.color.setHex(baseColor);
        mesh.material.emissive.setHex(0x000000);
        mesh.material.emissiveIntensity = 0;
    });
}

// SELECT & HIGHLIGHT PACKAGE (BLUE)
function selectPackageMesh(mesh) {
    resetAllMaterials();
    selectedMesh = mesh;
    searchedMesh = null;

    // Highlight in Deep Royal Blue & Emissive glow
    mesh.material.color.setHex(0x3b82f6);
    mesh.material.emissive.setHex(0x1d4ed8);
    mesh.material.emissiveIntensity = 0.6;

    const pkg = mesh.userData;
    updateDetailsPanel(pkg);
    
    // Smoothly focus camera controls on the package
    focusCamera(mesh.position);
}

// SEARCH & HIGHLIGHT PACKAGE (BRIGHT GLOWING CYAN BLUE)
function highlightSearchedPackage(mesh) {
    resetAllMaterials();
    searchedMesh = mesh;
    selectedMesh = null;

    // Highlight in Glowing Bright Cyan-Blue
    mesh.material.color.setHex(0x00f0ff);
    mesh.material.emissive.setHex(0x0891b2);
    mesh.material.emissiveIntensity = 0.9;

    const pkg = mesh.userData;
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
            <span class="details-value">X:${slotPositions[pkg.slot_index].x.toFixed(1)}, Y:${slotPositions[pkg.slot_index].y.toFixed(1)}, Z:${slotPositions[pkg.slot_index].z.toFixed(1)}</span>
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
document.getElementById("dispatchBtn").addEventListener("click", async () => {
    const dispatchVal = document.getElementById("dispatchInput").value.trim();
    if (!dispatchVal) {
        showToast("Please enter a package ID to dispatch", "error");
        return;
    }

    try {
        const response = await fetch(`/dispatch/${encodeURIComponent(dispatchVal)}`, {
            method: "DELETE"
        });

        if (!response.ok) throw new Error("Dispatch failed");
        
        const resText = await response.text();
        showToast(resText);
        document.getElementById("dispatchInput").value = "";
        
        // Reload all packages - free slots are instantly available for new items!
        loadPackages();
    } catch (err) {
        showToast(`Could not dispatch: ${dispatchVal}`, "error");
        console.error(err);
    }
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
    renderer.render(scene, camera);
}

// START ENGINE
animate();
loadPackages();
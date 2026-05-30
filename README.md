#  3D Warehouse Digital Twin Dashboard

This application is an interactive, real-time 3D dashboard designed to visualize, manage, and track inventory inside a simulated warehouse grid. It features a collision-free forklift animation that automatically paths, retrieves, and dispatches cardboard boxes based on your commands.

The project uses an Express backend with  **SQLite** database

---

## Prerequisites (What to Download)

To run this application on your local computer, you only need to download and install one tool:

### 1. Node.js (Runtime Environment)
Node.js runs the backend JavaScript server and handles the database connections. Installing Node.js also automatically installs **npm** (Node Package Manager) which downloads the project's dependencies.

* **How to download**: 
  1. Go to the official website: [https://nodejs.org/](https://nodejs.org/)
  2. Download the **LTS (Long Term Support)** version recommended for most users.
  3. Run the installer and click through the default setup.

### 2. A Modern Web Browser
The 3D visualization relies on **WebGL** technology. Ensure you are using a modern browser (such as Google Chrome, Microsoft Edge, Mozilla Firefox, or Apple Safari) for the best graphics performance.

---

##  Getting Started (How to Run)

Follow these simple steps to run the application on your computer:

### Step 1: Open your Terminal / Command Prompt
Open your terminal (PowerShell/CMD on Windows, or Terminal on macOS/Linux) and navigate to the project directory:
```bash
cd /path/to/warehouse_3D
```

### Step 2: Install Project Dependencies
Run the following command to download all required packages (Express, SQLite3, Socket.io, and Nodemon):
```bash
npm install
```

### Step 3: Run the Server
You can launch the server using standard Node.js:
```bash
node server.js
```
*(Optional: If you want the server to auto-restart when code changes, run `npx nodemon server.js`)*

### Step 4: Open in Web Browser
Once started, you will see `Server running at http://localhost:3000` logged in the console. 

Open your web browser and go to:
 **[http://localhost:3000](http://localhost:3000)**

---

## How to Interact with the Dashboard

* **Camera Navigation**: 
  * **Rotate**: Click and hold **Left-Click** while moving your mouse.
  * **Pan**: Click and hold **Right-Click** while moving your mouse.
  * **Zoom**: Use your mouse scroll-wheel.
* **Inspect Goods**: Hover or **Click** on any cardboard package inside the 3D grid to instantly view its tracking ID, coordinates, shelf life, and priority QA sticker in the right sidebar.
* **Search/Locate**: Type a package ID (e.g. `PKG-A1B2`) into the **Search Package** field in the left HUD to make the camera dynamically fly and lock focus onto it with a cyan holographic glow.
* **Add Goods**: Enter a quantity, generate inputs, and click "Add Packages to DB". Watch the forklift automatically retrieve packages from the arrival bay and store them in the closest free slots.
* **Dispatch Goods**: Enter a package ID and watch the forklift retrieve it from its shelf and transport it to the exit dock.
* **System Operations**: Click the glowing red **"Clear All Warehouse"** button to instantly wipe the SQLite tables and start fresh.

---

## Project Architecture
* `server.js` — Lightweight Express API handling routing and SQLite database queries.
* `warehouse.db` — (Auto-generated on startup) Local SQLite file-based database storing inventory logs.
* `public/` — Frontend assets:
  * `index.html` — Layout and SVG icon system dashboard HUD.
  * `style.css` 
  * `app.js` — Three.js WebGL rendering engine, forklift pathfinding waypoints, and canvas animation.

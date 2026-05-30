const express = require("express");
// mysql2 removed

const app = express();

app.use(express.json());

app.use(express.static("public"));


// SQLITE
const sqlite3 = require("sqlite3").verbose();
const db = new sqlite3.Database("./warehouse.db", (err) => {
    if (err) {
        console.error("Error opening database:", err.message);
    } else {
        console.log("SQLite Connected");
        db.run(`
            CREATE TABLE IF NOT EXISTS packages (
                package_identifier TEXT PRIMARY KEY,
                lifespan INTEGER NOT NULL,
                slot_index INTEGER NOT NULL UNIQUE
            )
        `, (err) => {
            if (err) {
                console.error("Error creating table:", err.message);
            } else {
                console.log("Packages table initialized successfully.");
            }
        });
    }
});


// GET ALL PACKAGES
app.get("/packages", (req, res) => {

    const sql = "SELECT * FROM packages ORDER BY slot_index ASC";

    db.all(sql, [], (err, rows) => {

        if (err) {
            res.status(500).send(err);
        }
        else {
            res.json(rows);
        }

    });

});


// CLEAR ALL PACKAGES
app.post("/clear-all", (req, res) => {

    const sql = "DELETE FROM packages";

    db.run(sql, [], (err) => {

        if (err) {
            res.status(500).send(err);
        }
        else {
            res.send("All packages cleared");
        }

    });

});


// ADD PACKAGES
app.post("/add-package", (req, res) => {

    const packages = req.body.packages || [];

    if (packages.length === 0) {
        return res.status(400).send("No packages provided");
    }

    const getSlots = "SELECT slot_index FROM packages";

    db.all(getSlots, [], (err, results) => {

        if (err) {
            return res.status(500).send(err);
        }

        const occupied = results.map(r => r.slot_index);

        const freeSlots = [];

        // Total slots available: 60 (4 rows * 3 cols * 5 depth)
        for (let i = 0; i < 60; i++) {

            if (!occupied.includes(i)) {
                freeSlots.push(i);
            }

        }

        if (freeSlots.length < packages.length) {
            return res.status(400).send("Warehouse Full");
        }

        let completed = 0;
        let hasError = false;

        packages.forEach((pkg, index) => {
            if (hasError) return;

            const sql = `
                INSERT INTO packages
                (package_identifier, lifespan, slot_index)
                VALUES (?, ?, ?)
            `;

            db.run(
                sql,
                [
                    pkg.package_identifier,
                    pkg.lifespan,
                    freeSlots[index]
                ],
                (err) => {

                    if (err) {
                        hasError = true;
                        return res.status(500).send(err);
                    }

                    completed++;

                    if (completed === packages.length) {
                        res.send("Packages Added");
                    }

                }
            );

        });

    });

});


// DELETE / DISPATCH
app.delete("/dispatch/:id", (req, res) => {

    const id = req.params.id;

    const sql = `
        DELETE FROM packages
        WHERE package_identifier = ?
    `;

    db.run(sql, [id], (err) => {

        if (err) {
            res.status(500).send(err);
        }
        else {
            res.send("Package Dispatched");
        }

    });

});


app.listen(3000, () => {

    console.log("Server running at http://localhost:3000");

});
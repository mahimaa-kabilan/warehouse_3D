const express = require("express");
const mysql = require("mysql2");

const app = express();

app.use(express.json());

app.use(express.static("public"));


// MYSQL
const db = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "worms",
    database: "warehouse"
});


db.connect((err) => {

    if (err) {
        console.log(err);
    }
    else {
        console.log("MySQL Connected");
    }

});


// GET ALL PACKAGES
app.get("/packages", (req, res) => {

    const sql = "SELECT * FROM packages";

    db.query(sql, (err, result) => {

        if (err) {
            res.status(500).send(err);
        }
        else {
            res.json(result);
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

    db.query(getSlots, (err, results) => {

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

        packages.forEach((pkg, index) => {

            const sql = `
                INSERT INTO packages
                (package_identifier, lifespan, slot_index)
                VALUES (?, ?, ?)
            `;

            db.query(
                sql,
                [
                    pkg.package_identifier,
                    pkg.lifespan,
                    freeSlots[index]
                ],
                (err) => {

                    if (err) {
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

    db.query(sql, [id], (err) => {

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
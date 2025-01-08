const express = require("express");
const jwt = require("jsonwebtoken");
const router = express.Router();
require("dotenv").config();

const handleError = (res, statusCode, message) => {
    return res.status(statusCode).json({ success: false, error: message });
};

const authenticateUser = (req, res, next) => {
    const authHeader = req.headers.authorization;
    console.log("🚀 ~ Authorization Header:", authHeader);

    if (!authHeader) {
        console.error("No Authorization header provided");
        return res.status(401).json({ success: false, error: "Unauthorized: No token provided." });
    }

    const token = authHeader.split(" ")[1];
    console.log("🚀 ~ Token extracted:", token);

    if (!token) {
        console.error("Bearer token not provided");
        return res.status(401).json({ success: false, error: "Unauthorized: Bearer token missing." });
    }

    jwt.verify(token, process.env.SECRET, (err, decoded) => {
        if (err) {
            console.error("JWT verification error:", err.message);
            return res.status(403).json({ success: false, error: "Unauthorized: Invalid token." });
        }

        console.log("🚀 ~ Decoded Token:", decoded);
        req.user = decoded; // Attach decoded user info to request object
        next();
    });
};

router.post("/", authenticateUser, (req, res) => {
    const { name, description, location, start_date, close_registration, max_attendees } = req.body;

    if (!name || !description || !location || !start_date || !close_registration || !max_attendees) {
        return handleError(res, 400, "All fields are required.");
    }

    const sql = `INSERT INTO Events (name, description, location, start_date, close_registration, max_attendees, creator_id)
               VALUES (?, ?, ?, ?, ?, ?, ?)`;
    req.db.run(
        sql,
        [name, description, location, start_date, close_registration, max_attendees, req.user.id], // Use authenticated user ID
        function (err) {
            if (err) return handleError(res, 500, err.message);
            res.json({ success: true, message: "Event created successfully", event_id: this.lastID });
        }
    );
});

router.get("/", authenticateUser, (req, res) => {
    const sql = `SELECT * FROM Events WHERE creator_id = ?`;
    req.db.all(sql, [req.user.id], (err, rows) => {
        if (err) return handleError(res, 500, err.message);
        res.json({ success: true, events: rows });
    });
});

// GET /api/events/:id - Get event by ID
router.get("/:id", authenticateUser, (req, res) => {
    const sql = `SELECT * FROM Events WHERE event_id = ?`;
    req.db.get(sql, [req.params.id], (err, row) => {
        if (err) return handleError(res, 500, err.message);
        if (!row) return handleError(res, 404, "Event not found.");
        res.json({ success: true, event: row });
    });
});

// PUT /api/events/:id - Update an event
router.put("/:id", authenticateUser, (req, res) => {
    const { name, description, location, start_date, close_registration, max_attendees } = req.body;

    if (!name || !description || !location || !start_date || !close_registration || !max_attendees) {
        return handleError(res, 400, "All fields are required.");
    }

    const sql = `UPDATE Events SET name = ?, description = ?, location = ?, start_date = ?, close_registration = ?, max_attendees = ?
               WHERE event_id = ? AND creator_id = ?`;
    req.db.run(
        sql,
        [name, description, location, start_date, close_registration, max_attendees, req.params.id, req.user.id], // Ensure the user is the creator
        function (err) {
            if (err) return handleError(res, 500, err.message);
            if (this.changes === 0) return handleError(res, 404, "Event not found or you're not authorized.");
            res.json({ success: true, message: "Event updated successfully" });
        }
    );
});

// DELETE /api/events/:id - Delete an event
router.delete("/:id", authenticateUser, (req, res) => {
    const sql = `DELETE FROM Events WHERE event_id = ? AND creator_id = ?`;
    req.db.run(sql, [req.params.id, req.user.id], function (err) {
        if (err) return handleError(res, 500, err.message);
        if (this.changes === 0) return handleError(res, 404, "Event not found or you're not authorized.");
        res.json({ success: true, message: "Event deleted successfully" });
    });
});

module.exports = router;

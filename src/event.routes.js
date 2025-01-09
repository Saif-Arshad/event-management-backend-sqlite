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

router.get("/questions", (req, res) => {
    const { event_id } = req.query;

    if (!event_id) {
        return res
            .status(400)
            .json({ success: false, error: "Event ID is required" });
    }

    const sql = `
    SELECT * 
    FROM Questions 
    WHERE event_id = ?`;

    req.db.all(sql, [event_id], (err, rows) => {
        if (err) {
            return res.status(500).json({ success: false, error: err.message });
        }

        res.json({ success: true, questions: rows });
    });
});


router.post("/question", authenticateUser, async (req, res) => {
    try {
        const { question, question_id, event_id } = req.body;

        if (!question || !question_id || !event_id) {
            return res
                .status(400)
                .json({ error: "Missing required fields (question, question_id, event_id)." });
        }

        let user_id = req.user.id



        const insertQuery = `
      INSERT INTO Questions (question_id, question, asked_by, event_id, votes)
      VALUES (?, ?, ?, ?, 0)
    `;
        await req.db.run(insertQuery, [question_id, question, user_id, event_id]);

        return res.status(201).json({
            message: "Question created successfully",
            data: {
                question_id,
                question,
                event_id,
                asked_by: user_id,
                votes: 0,
            },
        });
    } catch (err) {
        console.error("Error creating question:", err);
        return res.status(500).json({ error: "Internal server error" });
    }
});
router.get("/", authenticateUser, (req, res) => {
    const sql = `SELECT * FROM Events WHERE creator_id = ?`;
    req.db.all(sql, [req.user.id], (err, rows) => {
        if (err) return handleError(res, 500, err.message);
        res.json({ success: true, events: rows });
    });
});
router.get("/all-events", (req, res) => {
    const sql = `SELECT * FROM Events`;
    req.db.all(sql, [], (err, rows) => {
        if (err) return handleError(res, 500, err.message);
        res.json({ success: true, events: rows });
    });
});

router.get("/:id", (req, res) => {
    const sql = `SELECT * FROM Events WHERE event_id = ?`;
    req.db.get(sql, [req.params.id], (err, row) => {
        if (err) return handleError(res, 500, err.message);
        if (!row) return handleError(res, 404, "Event not found.");
        res.json({ success: true, event: row });
    });
});

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

router.delete("/:id", authenticateUser, (req, res) => {
    const sql = `DELETE FROM Events WHERE event_id = ? AND creator_id = ?`;
    req.db.run(sql, [req.params.id, req.user.id], function (err) {
        if (err) return handleError(res, 500, err.message);
        if (this.changes === 0) return handleError(res, 404, "Event not found or you're not authorized.");
        res.json({ success: true, message: "Event deleted successfully" });
    });
});

module.exports = router;

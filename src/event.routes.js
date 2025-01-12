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
        const { question, event_id } = req.body;

        if (!question || !event_id) {
            return res
                .status(400)
                .json({ error: "Missing required fields (question, question_id, event_id)." });
        }

        let user_id = req.user.id



        const insertQuery = `
            INSERT INTO Questions (question, asked_by, event_id, votes)
            VALUES (?, ?, ?, 0)
        `;
        await req.db.run(insertQuery, [question, user_id, event_id]);

        return res.status(201).json({
            message: "Question created successfully",
            data: {
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

router.get("/:id", authenticateUser, (req, res) => {
    const eventId = req.params.id;
    const userId = req.user.id;

    const eventDetailsQuery = `
        SELECT e.*, 
               (SELECT COUNT(*) FROM Attendees WHERE event_id = e.event_id) AS attendee_count
        FROM Events e 
        WHERE e.event_id = ?
    `;

    const questionsQuery = `
        SELECT q.*, 
               (SELECT COUNT(*) FROM Votes WHERE question_id = q.question_id AND voter_id = ?) AS user_voted
        FROM Questions q 
        WHERE q.event_id = ?
    `;

    const userAttendanceQuery = `
        SELECT COUNT(*) AS is_joined 
        FROM Attendees 
        WHERE event_id = ? AND user_id = ?
    `;

    req.db.get(eventDetailsQuery, [eventId], (err, event) => {
        if (err) return handleError(res, 500, err.message);
        if (!event) return handleError(res, 404, "Event not found.");

        req.db.all(questionsQuery, [userId, eventId], (err, questions) => {
            if (err) return handleError(res, 500, err.message);

            req.db.get(userAttendanceQuery, [eventId, userId], (err, attendance) => {
                if (err) return handleError(res, 500, err.message);

                res.json({
                    success: true,
                    event: {
                        ...event,
                        is_joined: attendance.is_joined > 0, // True if user has joined
                    },
                    questions: questions.map((q) => ({
                        ...q,
                        user_voted: q.user_voted > 0, // True if user voted
                    })),
                });
            });
        });
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
router.post("/attend", authenticateUser, (req, res) => {
    const { event_id } = req.body;

    if (!event_id) {
        return handleError(res, 400, "Event ID is required.");
    }

    const sqlCheck = `SELECT * FROM Events WHERE event_id = ?`;
    req.db.get(sqlCheck, [event_id], (err, row) => {
        if (err) return handleError(res, 500, err.message);
        if (!row) return handleError(res, 404, "Event not found.");

        const sqlInsert = `INSERT INTO Attendees (event_id, user_id) VALUES (?, ?)`;
        req.db.run(sqlInsert, [event_id, req.user.id], function (err) {
            if (err) {
                if (err.message.includes("UNIQUE constraint failed")) {
                    return handleError(res, 400, "User is already an attendee of this event.");
                }
                return handleError(res, 500, err.message);
            }

            res.json({
                success: true,
                message: "You have successfully registered as an attendee for the event.",
            });
        });
    });
});

router.post("/vote", authenticateUser, (req, res) => {
    const { question_id } = req.body;

    if (!question_id) {
        return handleError(res, 400, "Question ID is required.");
    }

    const sqlCheck = `SELECT * FROM Questions WHERE question_id = ?`;
    req.db.get(sqlCheck, [question_id], (err, row) => {
        if (err) return handleError(res, 500, err.message);
        if (!row) return handleError(res, 404, "Question not found.");

        const sqlInsert = `INSERT INTO Votes (question_id, voter_id) VALUES (?, ?)`;
        req.db.run(sqlInsert, [question_id, req.user.id], function (err) {
            if (err) {
                if (err.message.includes("UNIQUE constraint failed")) {
                    return handleError(res, 400, "You have already voted for this question.");
                }
                return handleError(res, 500, err.message);
            }

            const sqlUpdateVotes = `UPDATE Questions SET votes = votes + 1 WHERE question_id = ?`;
            req.db.run(sqlUpdateVotes, [question_id], (err) => {
                if (err) return handleError(res, 500, err.message);

                res.json({
                    success: true,
                    message: "Your vote has been recorded.",
                });
            });
        });
    });
});


module.exports = router;

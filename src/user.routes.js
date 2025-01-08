const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const router = express.Router();
require("dotenv").config();

const handleError = (res, statusCode, message) => {
    return res.status(statusCode).json({ success: false, error: message });
};

router.post("/register", async (req, res) => {
    try {
        const { first_name, last_name, email, password } = req.body;

        if (!first_name || !last_name || !email || !password) {
            return handleError(res, 400, "All fields are required.");
        }

        req.db.get(
            `SELECT * FROM Users WHERE email = ?`,
            [email],
            async (err, existingUser) => {
                if (err) {
                    return handleError(res, 500, "Database error.");
                }

                if (existingUser) {
                    return handleError(res, 400, "User with this email already exists.");
                }

                const salt = await bcrypt.genSalt(10);
                const hashedPassword = await bcrypt.hash(password, salt);

                req.db.run(
                    `INSERT INTO Users (first_name, last_name, email, password, salt) VALUES (?, ?, ?, ?, ?)`,
                    [first_name, last_name, email, hashedPassword, salt],
                    function (insertErr) {
                        if (insertErr) {
                            return handleError(res, 500, "Failed to create user.");
                        }

                        req.db.get(
                            `SELECT user_id, first_name, last_name, email FROM Users WHERE user_id = ?`,
                            [this.lastID],
                            (err, newUser) => {
                                if (err) {
                                    return handleError(res, 500, "Database error.");
                                }

                                return res.status(201).json({
                                    success: true,
                                    user: newUser,
                                    message: "User registered successfully.",
                                });
                            }
                        );
                    }
                );
            }
        );
    } catch (err) {
        console.error(err);
        return handleError(res, 500, "Internal server error.");
    }
});

router.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return handleError(res, 400, "Email and password are required.");
        }

        req.db.get(`SELECT * FROM Users WHERE email = ?`, [email], async (err, user) => {
            if (err) {
                return handleError(res, 500, "Database error.");
            }

            if (!user) {
                return handleError(res, 401, "Invalid email or password.");
            }

            const isMatch = await bcrypt.compare(password, user.password);
            if (!isMatch) {
                return handleError(res, 401, "Invalid email or password.");
            }

            const token = jwt.sign({ id: user.user_id }, process.env.SECRET, { expiresIn: "7d" });

            req.db.run(`UPDATE Users SET session_token = ? WHERE user_id = ?`, [token, user.user_id], (updateErr) => {
                if (updateErr) {
                    return handleError(res, 500, "Failed to update session token.");
                }

                return res.status(200).json({
                    success: true,
                    token,
                    user: {
                        user_id: user.user_id,
                        first_name: user.first_name,
                        last_name: user.last_name,
                        email: user.email,
                    },
                });
            });
        });
    } catch (err) {
        console.error(err);
        return handleError(res, 500, "Internal server error.");
    }
});

router.get("/me", async (req, res) => {
    try {
        const token = req.headers.authorization?.split(" ")[1]; // Get token from Authorization header
        if (!token) {
            return handleError(res, 401, "Unauthorized.");
        }

        // Verify the token
        jwt.verify(token, process.env.SECRET, (err, decoded) => {
            if (err) {
                return handleError(res, 401, "Invalid token.");
            }

            // Fetch the user by ID
            req.db.get(`SELECT user_id, first_name, last_name, email FROM Users WHERE user_id = ?`, [decoded.id], (err, user) => {
                if (err) {
                    return handleError(res, 500, "Database error.");
                }

                if (!user) {
                    return handleError(res, 404, "User not found.");
                }

                return res.status(200).json({
                    success: true,
                    user,
                });
            });
        });
    } catch (err) {
        console.error(err);
        return handleError(res, 500, "Internal server error.");
    }
});

module.exports = router;

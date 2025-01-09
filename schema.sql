CREATE TABLE IF NOT EXISTS Users (
    user_id INTEGER PRIMARY KEY AUTOINCREMENT,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    salt TEXT NOT NULL,
    session_token TEXT
);


CREATE TABLE IF NOT EXISTS Events (
    event_id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    location TEXT NOT NULL,
    start_date INTEGER NOT NULL,
    close_registration INTEGER NOT NULL,
    max_attendees INTEGER NOT NULL,
    creator_id INTEGER NOT NULL,
    FOREIGN KEY (creator_id) REFERENCES Users(user_id)
);
CREATE TABLE IF NOT EXISTS Attendees (
    event_id INTEGER NOT NULL,
    user_id  INTEGER NOT NULL,
    PRIMARY KEY (event_id, user_id),
    FOREIGN KEY (event_id) REFERENCES Events(event_id),
    FOREIGN KEY (user_id)  REFERENCES Users(user_id)
);
CREATE TABLE IF NOT EXISTS Questions (
    question_id INTEGER PRIMARY KEY AUTOINCREMENT,
    question    TEXT    NOT NULL,
    asked_by    INTEGER NOT NULL,
    event_id    INTEGER NOT NULL,
    votes       INTEGER DEFAULT 0,
    FOREIGN KEY (asked_by) REFERENCES Users(user_id),
    FOREIGN KEY (event_id) REFERENCES Events(event_id)
);

CREATE TABLE IF NOT EXISTS Votes (
    question_id INTEGER NOT NULL,
    voter_id    INTEGER NOT NULL,
    PRIMARY KEY (question_id, voter_id),
    FOREIGN KEY (question_id) REFERENCES Questions(question_id),
    FOREIGN KEY (voter_id)    REFERENCES Users(user_id)
);
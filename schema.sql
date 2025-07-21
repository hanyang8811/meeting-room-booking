-- schema.sql

DROP TABLE IF EXISTS rooms;
CREATE TABLE IF NOT EXISTS rooms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    capacity INTEGER NOT NULL,
    description TEXT
);

DROP TABLE IF EXISTS bookings;
CREATE TABLE IF NOT EXISTS bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room_id INTEGER NOT NULL,
    start_time DATETIME NOT NULL,
    end_time DATETIME NOT NULL,
    booked_by TEXT NOT NULL,
    FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
);

-- Optional: Seed some initial data
INSERT INTO rooms (name, capacity, description) VALUES
('Conference Room A', 10, 'Main conference room with projector'),
('Meeting Room B', 4, 'Small meeting room'),
('Huddle Space 1', 2, 'Informal huddle area');

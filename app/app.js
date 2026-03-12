// Import express.js
const express = require("express");

// Create express app
var app = express();

// Add static files location
app.use(express.static("static"));


// pug engine
app.set("view engine", "pug");
app.set("views", "./app/views");
 
// Get the functions in the db.js file to use
const db = require('./services/db');

// Create a route for root - /
// app.get("/", function(req, res) {
//     res.send("Hello world!");
// });

app.get("/", (req, res) => {
  res.render("home", {
    pageTitle: "Smart School",
    navLinks: [
      { href: "/", label: "Overview" },
      { href: "/#modules", label: "Modules" },
      { href: "/#journey", label: "Journey" },
      { href: "/teachers/dashboard", label: "Teacher Dashboard" },
      { href: "/#contact", label: "Contact" }
    ]
  });
});

app.get("/teachers/dashboard", async (req, res) => {
    const teacherId = Number(req.query.teacher_id) || 1;
    const today = new Date().toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric"
    });

    try {
        const teacherRows = await db.query(
            "SELECT id, full_name, class_name FROM teachers WHERE id = ? LIMIT 1",
            [teacherId]
        );

        if (!teacherRows[0]) {
            return res.status(404).send("Teacher not found");
        }

        const stats = await db.query(
            "SELECT stat_label AS label, stat_value AS value FROM teacher_stats WHERE teacher_id = ? ORDER BY sort_order, id",
            [teacherId]
        );

        const periods = await db.query(
            `SELECT
                CONCAT(TIME_FORMAT(start_time, '%H:%i'), ' - ', TIME_FORMAT(end_time, '%H:%i')) AS time,
                subject_name AS subject,
                room_name AS room,
                status_label AS status
             FROM teacher_schedule
             WHERE teacher_id = ?
             ORDER BY sort_order, start_time`,
            [teacherId]
        );

        const todoRows = await db.query(
            "SELECT task_text, is_done FROM teacher_tasks WHERE teacher_id = ? ORDER BY is_done, sort_order, id",
            [teacherId]
        );

        const notices = await db.query(
            "SELECT notice_text FROM teacher_notices WHERE teacher_id = ? ORDER BY notice_date DESC, id DESC",
            [teacherId]
        );

        res.render("teacher-dashboard", {
            pageTitle: "Teacher Dashboard | Smart School",
            navLinks: [
                { href: "/", label: "Overview" },
                { href: "/teachers/dashboard", label: "Teacher Dashboard" },
                { href: "/#contact", label: "Contact" }
            ],
            dashboard: {
                teacherName: teacherRows[0].full_name,
                className: teacherRows[0].class_name,
                today,
                stats,
                periods,
                todos: todoRows.map((row) => row.task_text),
                doneTodos: todoRows.filter((row) => row.is_done === 1).map((row) => row.task_text),
                notices: notices.map((row) => row.notice_text)
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).send("Could not load teacher dashboard.");
    }
});

// Create a route for testing the db
app.get("/db_test", function(req, res) {
    // Assumes a table called test_table exists in your database
    const sql = 'select * from test_table';
    db.query(sql).then(results => {
        console.log(results);
        res.send(results)
    });
});

// Create a route for /goodbye
// Responds to a 'GET' request
app.get("/goodbye", function(req, res) {
    res.send("Goodbye world!");
});

// Create a dynamic route for /hello/<name>, where name is any value provided by user
// At the end of the URL
// Responds to a 'GET' request
app.get("/hello/:name", function(req, res) {
    // req.params contains any parameters in the request
    // We can examine it in the console for debugging purposes
    console.log(req.params);
    //  Retrieve the 'name' parameter and use it in a dynamically generated page
    res.send("Hello " + req.params.name);
});

// Start server on port 3000
app.listen(3000,function(){
    console.log(`Server running at http://127.0.0.1:3000/`);
});

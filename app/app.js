// Import express.js
const express = require("express");
const { User } = require("./models/user");
// Create express app
var app = express();

// Add static files location
app.use(express.static("static"));
app.use(express.urlencoded({ extended: true }));


// pug engine
app.set("view engine", "pug");
app.set("views", "./app/views");
 
// Get the functions in the db.js file to use
const db = require('./services/db');

const cookieParser = require("cookie-parser");
const session = require('express-session');
const bodyParser = require('body-parser');
const oneDay = 1000 * 60 * 60 * 24;
const sessionMiddleware = session({
    secret: "driveyourpassion",
    saveUninitialized: true,
    cookie: { maxAge: oneDay },
    resave: false
});
app.use(cookieParser());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(sessionMiddleware);

function getIsoDate(value) {
    if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return value;
    }

    return new Date().toISOString().slice(0, 10);
}

const VALID_ROLES = new Set(["student", "teacher", "admin"]);

function getAuthNavLinks(mode) {
    return [
        { href: "/", label: "Overview" },
        { href: "/#modules", label: "Modules" },
        { href: mode === "register" ? "/login" : "/register", label: mode === "register" ? "Login" : "Register" },
        { href: "/#contact", label: "Contact" }
    ];
}

function renderAuthPage(res, authMode, options = {}) {
    const authValues = options.authValues || {};

    res.status(options.statusCode || 200).render("auth", {
        pageTitle: `${authMode === "register" ? "Register" : "Login"} | Smart School`,
        authMode,
        navLinks: getAuthNavLinks(authMode),
        authError: options.authError || null,
        authSuccess: options.authSuccess || null,
        authValues
    });
}

function normalizeText(value) {
    return typeof value === "string" ? value.trim() : "";
}

async function ensureRoleRecord(role, details) {
    if (role === "teacher") {
        const existingTeachers = await db.query(
            "SELECT id FROM teachers WHERE email = ? LIMIT 1",
            [details.email]
        );

        if (existingTeachers[0]) {
            return existingTeachers[0].id;
        }

        const result = await db.query(
            "INSERT INTO teachers (full_name, email, class_name) VALUES (?, ?, ?)",
            [details.fullName, details.email, details.className]
        );

        return result.insertId;
    }

    if (role === "student") {
        const existingStudents = await db.query(
            "SELECT id FROM students WHERE email = ? LIMIT 1",
            [details.email]
        );

        if (existingStudents[0]) {
            return existingStudents[0].id;
        }

        const result = await db.query(
            "INSERT INTO students (full_name, email, class_name, roll_number) VALUES (?, ?, ?, ?)",
            [details.fullName, details.email, details.className, details.rollNumber]
        );

        return result.insertId;
    }

    return null;
}

function getRedirectForUser(user) {
    if (user.role === "teacher" && user.relatedId) {
        return `/teachers/dashboard?teacher_id=${user.relatedId}`;
    }

    if (user.role === "student" && user.relatedId) {
        return `/students/dashboard?student_id=${user.relatedId}`;
    }

    return "/";
}

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
      { href: "/students/dashboard", label: "Student Dashboard" },
      { href: "/teachers/dashboard", label: "Teacher Dashboard" },
      { href: "/#contact", label: "Contact" }
    ]
  });
});

app.get("/login", (req, res) => {
    if (req.session.uid) {
        return res.redirect(req.session.redirectTo || "/");
    }

    renderAuthPage(res, "login", {
        authSuccess: req.query.registered === "1" ? "Account created. Please sign in." : null
    });
});

app.get("/register", (req, res) => {
    if (req.session.uid) {
        return res.redirect(req.session.redirectTo || "/");
    }

    renderAuthPage(res, "register");
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
                { href: "/students/dashboard", label: "Student Dashboard" },
                { href: "/teachers/dashboard", label: "Teacher Dashboard" },
                { href: "/#contact", label: "Contact" }
            ],
            dashboard: {
                teacherId,
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

app.post('/authenticate', async (req, res) => {
    try {
        const email = normalizeText(req.body.email).toLowerCase();
        const password = req.body.password;
        const requestedRole = normalizeText(req.body.role).toLowerCase();

        if (!email || !password) {
            return renderAuthPage(res, "login", {
                statusCode: 400,
                authError: "Email and password are required.",
                authValues: { email, role: requestedRole }
            });
        }

        const user = await User.findByEmail(email);
        if (!user) {
            return renderAuthPage(res, "login", {
                statusCode: 401,
                authError: "Invalid email or password.",
                authValues: { email, role: requestedRole }
            });
        }

        if (requestedRole && VALID_ROLES.has(requestedRole) && user.role !== requestedRole) {
            return renderAuthPage(res, "login", {
                statusCode: 401,
                authError: "Selected role does not match this account.",
                authValues: { email, role: requestedRole }
            });
        }

        const match = await user.authenticate(password);
        if (!match) {
            return renderAuthPage(res, "login", {
                statusCode: 401,
                authError: "Invalid email or password.",
                authValues: { email, role: requestedRole }
            });
        }

        const redirectTo = getRedirectForUser(user);

        req.session.uid = user.id;
        req.session.loggedIn = true;
        req.session.role = user.role;
        req.session.redirectTo = redirectTo;
        req.session.relatedId = user.relatedId || null;
        res.redirect(redirectTo);
    } catch (err) {
        console.error(`Error while authenticating user:`, err.message);
        res.status(500).send('Internal Server Error');
    }
});

app.get('/logout', (req, res) => {
    try {
        req.session.destroy();
        res.redirect('/login');
    } catch (err) {
        console.error("Error logging out:", err);
        res.status(500).send('Internal Server Error');
    }
});

app.post('/register', async (req, res) => {
    try {
        const registrationData = {
            fullName: normalizeText(req.body.full_name),
            email: normalizeText(req.body.email).toLowerCase(),
            password: req.body.password,
            role: normalizeText(req.body.role).toLowerCase(),
            className: normalizeText(req.body.class_name),
            rollNumber: normalizeText(req.body.roll_number),
            phone: normalizeText(req.body.phone),
            about: normalizeText(req.body.about)
        };

        if (!registrationData.fullName || !registrationData.email || !registrationData.password || !registrationData.role) {
            return renderAuthPage(res, "register", {
                statusCode: 400,
                authError: "Full name, role, email, and password are required.",
                authValues: registrationData
            });
        }

        if (!VALID_ROLES.has(registrationData.role)) {
            return renderAuthPage(res, "register", {
                statusCode: 400,
                authError: "Please choose a valid role.",
                authValues: registrationData
            });
        }

        if (registrationData.role !== "admin" && !registrationData.className) {
            return renderAuthPage(res, "register", {
                statusCode: 400,
                authError: "Class or department is required for student and teacher accounts.",
                authValues: registrationData
            });
        }

        if (registrationData.role === "student" && !registrationData.rollNumber) {
            return renderAuthPage(res, "register", {
                statusCode: 400,
                authError: "Roll number is required for student accounts.",
                authValues: registrationData
            });
        }

        const existingUser = await User.findByEmail(registrationData.email);
        if (existingUser) {
            return renderAuthPage(res, "register", {
                statusCode: 409,
                authError: "An account with this email already exists.",
                authValues: registrationData
            });
        }

        const relatedId = await ensureRoleRecord(registrationData.role, registrationData);
        await User.create({
            ...registrationData,
            relatedId
        });

        return res.redirect("/login?registered=1");
    } catch (err) {
        console.error(`Error while registering user:`, err.message);
        res.status(500).send('Internal Server Error');
    }
});

app.get("/teachers/attendance", async (req, res) => {
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

        const selectedDate = getIsoDate(req.query.date);
        const subjectRows = await db.query(
            `SELECT DISTINCT subject_name AS subject
             FROM teacher_schedule
             WHERE teacher_id = ?
             ORDER BY subject_name`,
            [teacherId]
        );
        const selectedSubject = req.query.subject || subjectRows[0]?.subject || "Mathematics";

        const studentRows = await db.query(
            `SELECT
                s.full_name AS student_name,
                s.id AS student_id,
                s.roll_number,
                sa.id AS attendance_id,
                sa.status_label AS status,
                sa.remarks
             FROM students s
             LEFT JOIN student_attendance sa
               ON sa.student_id = s.id
              AND sa.attendance_date = ?
              AND sa.subject_name = ?
             WHERE s.class_name = ?
             ORDER BY s.roll_number ASC`,
            [selectedDate, selectedSubject, teacherRows[0].class_name]
        );

        res.render("teacher-attendance", {
            pageTitle: "Teacher Attendance | Smart School",
            navLinks: [
                { href: "/", label: "Overview" },
                { href: `/teachers/dashboard?teacher_id=${teacherId}`, label: "Teacher Dashboard" },
                { href: `/teachers/attendance?teacher_id=${teacherId}`, label: "Attendance" },
                { href: "/students/dashboard", label: "Student Dashboard" },
                { href: "/#contact", label: "Contact" }
            ],
            attendancePage: {
                teacherId,
                teacherName: teacherRows[0].full_name,
                className: teacherRows[0].class_name,
                today,
                selectedDate,
                selectedSubject,
                subjects: subjectRows.map((row) => row.subject),
                students: studentRows,
                message: req.query.saved === "1" ? "Attendance saved." : null
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).send("Could not load teacher attendance.");
    }
});

app.post("/teachers/attendance", async (req, res) => {
    const teacherId = Number(req.body.teacher_id) || 1;
    const selectedDate = getIsoDate(req.body.date);
    const selectedSubject = typeof req.body.subject === "string" && req.body.subject.trim()
        ? req.body.subject.trim()
        : "Mathematics";

    try {
        const teacherRows = await db.query(
            "SELECT id, class_name FROM teachers WHERE id = ? LIMIT 1",
            [teacherId]
        );

        if (!teacherRows[0]) {
            return res.status(404).send("Teacher not found");
        }

        const students = await db.query(
            "SELECT id FROM students WHERE class_name = ? ORDER BY roll_number ASC",
            [teacherRows[0].class_name]
        );

        for (const student of students) {
            const status = req.body[`status_${student.id}`];
            const remarksValue = req.body[`remarks_${student.id}`];
            const remarks = typeof remarksValue === "string" ? remarksValue.trim() : "";

            if (!status) {
                continue;
            }

            await db.query(
                `INSERT INTO student_attendance (student_id, attendance_date, subject_name, status_label, remarks)
                 VALUES (?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE
                   status_label = VALUES(status_label),
                   remarks = VALUES(remarks)`,
                [student.id, selectedDate, selectedSubject, status, remarks || null]
            );
        }

        res.redirect(
            `/teachers/attendance?teacher_id=${teacherId}&date=${selectedDate}&subject=${encodeURIComponent(selectedSubject)}&saved=1`
        );
    } catch (error) {
        console.error(error);
        res.status(500).send("Could not save teacher attendance.");
    }
});

app.get("/students/dashboard", async (req, res) => {
    const studentId = Number(req.query.student_id) || 1;
    const today = new Date().toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric"
    });

    try {
        const studentRows = await db.query(
            "SELECT id, full_name, class_name, roll_number FROM students WHERE id = ? LIMIT 1",
            [studentId]
        );

        if (!studentRows[0]) {
            return res.status(404).send("Student not found");
        }

        const stats = await db.query(
            "SELECT stat_label AS label, stat_value AS value FROM student_stats WHERE student_id = ? ORDER BY sort_order, id",
            [studentId]
        );

        const periods = await db.query(
            `SELECT
                CONCAT(TIME_FORMAT(start_time, '%H:%i'), ' - ', TIME_FORMAT(end_time, '%H:%i')) AS time,
                subject_name AS subject,
                room_name AS room,
                status_label AS status
             FROM student_schedule
             WHERE student_id = ?
            ORDER BY sort_order, start_time`,
            [studentId]
        );

        const assignments = await db.query(
            `SELECT
                task_title AS title,
                subject_name AS subject,
                due_label AS due,
                progress_label AS progress
             FROM student_assignments
             WHERE student_id = ?
             ORDER BY sort_order, id`,
            [studentId]
        );

        const notices = await db.query(
            "SELECT notice_text FROM student_notices WHERE student_id = ? ORDER BY notice_date DESC, id DESC",
            [studentId]
        );

        res.render("student-dashboard", {
            pageTitle: "Student Dashboard | Smart School",
            navLinks: [
                { href: "/", label: "Overview" },
                { href: "/students/dashboard", label: "Student Dashboard" },
                { href: "/teachers/dashboard", label: "Teacher Dashboard" },
                { href: "/#contact", label: "Contact" }
            ],
            dashboard: {
                studentName: studentRows[0].full_name,
                className: studentRows[0].class_name,
                rollNumber: studentRows[0].roll_number,
                today,
                stats,
                periods,
                studentId,
                assignments,
                notices: notices.map((row) => row.notice_text)
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).send("Could not load student dashboard.");
    }
});

app.get("/students/attendance", async (req, res) => {
    const studentId = Number(req.query.student_id) || 1;
    const today = new Date().toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric"
    });

    try {
        const studentRows = await db.query(
            "SELECT id, full_name, class_name, roll_number FROM students WHERE id = ? LIMIT 1",
            [studentId]
        );

        if (!studentRows[0]) {
            return res.status(404).send("Student not found");
        }

        const attendance = await db.query(
            `SELECT
                DATE_FORMAT(attendance_date, '%b %e, %Y') AS day,
                subject_name AS subject,
                status_label AS status,
                remarks
             FROM student_attendance
             WHERE student_id = ?
             ORDER BY attendance_date DESC, id DESC`,
            [studentId]
        );

        res.render("student-attendance", {
            pageTitle: "Student Attendance | Smart School",
            navLinks: [
                { href: "/", label: "Overview" },
                { href: `/students/dashboard?student_id=${studentId}`, label: "Student Dashboard" },
                { href: `/students/attendance?student_id=${studentId}`, label: "Attendance" },
                { href: "/teachers/dashboard", label: "Teacher Dashboard" },
                { href: "/#contact", label: "Contact" }
            ],
            attendancePage: {
                studentId,
                studentName: studentRows[0].full_name,
                className: studentRows[0].class_name,
                rollNumber: studentRows[0].roll_number,
                today,
                attendance
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).send("Could not load student attendance.");
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

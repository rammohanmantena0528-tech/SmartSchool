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

app.use(async (req, res, next) => {
    if (req.session.uid && !req.session.fullName) {
        try {
            const user = await User.findById(req.session.uid);

            if (user) {
                req.session.fullName = user.fullName;
                req.session.role = req.session.role || user.role;
                req.session.relatedId = req.session.relatedId || user.relatedId || null;
            }
        } catch (error) {
            console.error("Could not refresh session user details:", error.message);
        }
    }

    res.locals.loggedIn = Boolean(req.session.uid);
    res.locals.currentUserName = req.session.fullName || "";
    res.locals.currentRole = req.session.role || null;
    res.locals.navLinks = getNavLinksForRequest(req);
    next();
});

function getIsoDate(value) {
    if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return value;
    }

    return new Date().toISOString().slice(0, 10);
}

const VALID_ROLES = new Set(["student", "teacher", "admin"]);
const PROFILE_MESSAGES = {
    updated: "Profile updated.",
    password_changed: "Password changed.",
    missing_profile_fields: "Full name, email, and assigned class are required.",
    duplicate_email: "That email is already used by another account.",
    missing_password_fields: "Current password, new password, and confirmation are required.",
    password_mismatch: "New password and confirmation do not match.",
    password_short: "New password must be at least 6 characters.",
    password_account_missing: "Password cannot be changed because no user account is linked to this teacher.",
    current_password_invalid: "Current password is incorrect."
};
const ANNOUNCEMENT_MESSAGES = {
    created: "Announcement created.",
    missing_fields: "Title, description, and category are required."
};
let announcementTableReady = false;

function getAuthNavLinks(mode) {
    return [
        { href: "/", label: "Overview" },
        { href: "/#modules", label: "Modules" },
        { href: mode === "register" ? "/login" : "/register", label: mode === "register" ? "Login" : "Register" },
        { href: "/#contact", label: "Contact" }
    ];
}

function getStudentDashboardHref(studentId) {
    return `/students/dashboard${studentId ? `?student_id=${studentId}` : ""}`;
}

function getTeacherDashboardHref(teacherId) {
    return `/teachers/dashboard${teacherId ? `?teacher_id=${teacherId}` : ""}`;
}

function getDefaultNavLinks() {
    return [
        { href: "/", label: "Overview" },
        { href: "/#modules", label: "Modules" },
        { href: "/#journey", label: "Journey" },
        { href: "/#contact", label: "Contact" }
    ];
}

function getProfileMessage(query) {
    if (query.saved && PROFILE_MESSAGES[query.saved]) {
        return {
            type: "success",
            text: PROFILE_MESSAGES[query.saved]
        };
    }

    if (query.error && PROFILE_MESSAGES[query.error]) {
        return {
            type: "error",
            text: PROFILE_MESSAGES[query.error]
        };
    }

    return null;
}

function getAnnouncementMessage(query) {
    if (query.saved && ANNOUNCEMENT_MESSAGES[query.saved]) {
        return {
            type: "success",
            text: ANNOUNCEMENT_MESSAGES[query.saved]
        };
    }

    if (query.error && ANNOUNCEMENT_MESSAGES[query.error]) {
        return {
            type: "error",
            text: ANNOUNCEMENT_MESSAGES[query.error]
        };
    }

    return null;
}

function getNavLinksForRequest(req) {
    if (!req.session.uid) {
        return getDefaultNavLinks();
    }

    return [];
}

function requireLogin(req, res, next) {
    if (!req.session.uid) {
        return res.redirect("/login");
    }

    next();
}

function requireTeacher(req, res, next) {
    if (!req.session.uid) {
        return res.redirect("/login");
    }

    if (req.session.role !== "teacher") {
        return res.redirect(req.session.redirectTo || "/");
    }

    next();
}

async function ensureAnnouncementTable() {
    if (announcementTableReady) {
        return;
    }

    await db.query(
        `CREATE TABLE IF NOT EXISTS announcements (
            id int NOT NULL AUTO_INCREMENT,
            teacher_id int NOT NULL,
            class_name varchar(60) NOT NULL,
            title varchar(160) NOT NULL,
            description text NOT NULL,
            category varchar(60) NOT NULL,
            created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY idx_announcements_teacher_id (teacher_id),
            KEY idx_announcements_class_name (class_name),
            CONSTRAINT fk_announcements_teacher
                FOREIGN KEY (teacher_id) REFERENCES teachers (id)
                ON DELETE CASCADE
         ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`
    );
    announcementTableReady = true;
}

async function getTeacherProfile(teacherId) {
    const teacherRows = await db.query(
        `SELECT
            t.id,
            t.full_name,
            t.email,
            t.class_name,
            u.phone,
            u.about
         FROM teachers t
         LEFT JOIN Users u
           ON u.related_id = t.id
          AND u.role = 'teacher'
         WHERE t.id = ?
         LIMIT 1`,
        [teacherId]
    );

    return teacherRows[0] || null;
}

async function getStudentProfile(studentId) {
    const studentRows = await db.query(
        `SELECT
            s.id,
            s.full_name,
            s.email,
            s.class_name,
            s.roll_number,
            u.phone,
            u.about
         FROM students s
         LEFT JOIN Users u
           ON u.related_id = s.id
          AND u.role = 'student'
         WHERE s.id = ?
         LIMIT 1`,
        [studentId]
    );

    return studentRows[0] || null;
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
    if (user.role === "teacher") {
        return getTeacherDashboardHref(user.relatedId);
    }

    if (user.role === "student") {
        return getStudentDashboardHref(user.relatedId);
    }

    return "/";
}

// Create a route for root - /
// app.get("/", function(req, res) {
//     res.send("Hello world!");
// });

app.get("/", (req, res) => {
  res.render("home", {
    pageTitle: "Smart School"
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

app.get("/teachers/dashboard", requireLogin, async (req, res) => {
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

app.get("/teachers/profile", requireLogin, async (req, res) => {
    const teacherId = Number(req.query.teacher_id) || 1;

    try {
        const teacher = await getTeacherProfile(teacherId);

        if (!teacher) {
            return res.status(404).send("Teacher not found");
        }

        res.render("teacher-profile", {
            pageTitle: "Teacher Profile | Smart School",
            profileMessage: getProfileMessage(req.query),
            profile: {
                teacherId,
                teacherName: teacher.full_name,
                email: teacher.email,
                className: teacher.class_name,
                phone: teacher.phone,
                about: teacher.about
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).send("Could not load teacher profile.");
    }
});

app.post("/teachers/profile", requireLogin, async (req, res) => {
    const teacherId = Number(req.body.teacher_id) || 1;
    const fullName = normalizeText(req.body.full_name);
    const email = normalizeText(req.body.email).toLowerCase();
    const className = normalizeText(req.body.class_name);
    const phone = normalizeText(req.body.phone);
    const about = normalizeText(req.body.about);
    const profileUrl = `/teachers/profile?teacher_id=${teacherId}`;

    try {
        if (!fullName || !email || !className) {
            return res.redirect(`${profileUrl}&error=missing_profile_fields`);
        }

        const teacherEmailRows = await db.query(
            "SELECT id FROM teachers WHERE email = ? AND id <> ? LIMIT 1",
            [email, teacherId]
        );
        const userEmailRows = await db.query(
            `SELECT id
             FROM Users
             WHERE email = ?
               AND NOT (role = 'teacher' AND related_id = ?)
             LIMIT 1`,
            [email, teacherId]
        );

        if (teacherEmailRows[0] || userEmailRows[0]) {
            return res.redirect(`${profileUrl}&error=duplicate_email`);
        }

        await db.query(
            "UPDATE teachers SET full_name = ?, email = ?, class_name = ? WHERE id = ?",
            [fullName, email, className, teacherId]
        );
        await db.query(
            `UPDATE Users
             SET full_name = ?, email = ?, class_name = ?, phone = ?, about = ?
             WHERE role = 'teacher'
               AND related_id = ?`,
            [fullName, email, className, phone || null, about || null, teacherId]
        );

        if (req.session.relatedId === teacherId && req.session.role === "teacher") {
            req.session.fullName = fullName;
        }

        res.redirect(`${profileUrl}&saved=updated`);
    } catch (error) {
        console.error(error);
        res.status(500).send("Could not update teacher profile.");
    }
});

app.post("/teachers/password", requireLogin, async (req, res) => {
    const teacherId = Number(req.body.teacher_id) || 1;
    const currentPassword = req.body.current_password;
    const newPassword = req.body.new_password;
    const confirmPassword = req.body.confirm_password;
    const profileUrl = `/teachers/profile?teacher_id=${teacherId}`;

    try {
        if (!currentPassword || !newPassword || !confirmPassword) {
            return res.redirect(`${profileUrl}&error=missing_password_fields`);
        }

        if (newPassword !== confirmPassword) {
            return res.redirect(`${profileUrl}&error=password_mismatch`);
        }

        if (newPassword.length < 6) {
            return res.redirect(`${profileUrl}&error=password_short`);
        }

        const user = await User.findTeacherAccount(teacherId);
        if (!user) {
            return res.redirect(`${profileUrl}&error=password_account_missing`);
        }

        const currentPasswordMatches = await user.authenticate(currentPassword);
        if (!currentPasswordMatches) {
            return res.redirect(`${profileUrl}&error=current_password_invalid`);
        }

        await User.updatePassword(user.id, newPassword);
        res.redirect(`${profileUrl}&saved=password_changed`);
    } catch (error) {
        console.error(error);
        res.status(500).send("Could not change teacher password.");
    }
});

app.get("/teachers/announcements", requireTeacher, async (req, res) => {
    const teacherId = req.session.relatedId || Number(req.query.teacher_id) || 1;

    try {
        await ensureAnnouncementTable();

        const teacherRows = await db.query(
            "SELECT id, full_name, class_name FROM teachers WHERE id = ? LIMIT 1",
            [teacherId]
        );

        if (!teacherRows[0]) {
            return res.status(404).send("Teacher not found");
        }

        const announcements = await db.query(
            `SELECT
                id,
                title,
                description,
                category,
                DATE_FORMAT(created_at, '%b %e, %Y') AS postedOn
             FROM announcements
             WHERE teacher_id = ?
             ORDER BY created_at DESC, id DESC`,
            [teacherId]
        );

        res.render("teacher-announcements", {
            pageTitle: "Teacher Announcements | Smart School",
            announcementMessage: getAnnouncementMessage(req.query),
            announcementPage: {
                teacherId,
                teacherName: teacherRows[0].full_name,
                className: teacherRows[0].class_name,
                announcements
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).send("Could not load teacher announcements.");
    }
});

app.post("/teachers/announcements", requireTeacher, async (req, res) => {
    const teacherId = req.session.relatedId || Number(req.body.teacher_id) || 1;
    const title = normalizeText(req.body.title);
    const description = normalizeText(req.body.description);
    const category = normalizeText(req.body.category);
    const announcementsUrl = `/teachers/announcements?teacher_id=${teacherId}`;

    try {
        await ensureAnnouncementTable();

        if (!title || !description || !category) {
            return res.redirect(`${announcementsUrl}&error=missing_fields`);
        }

        const teacherRows = await db.query(
            "SELECT id, class_name FROM teachers WHERE id = ? LIMIT 1",
            [teacherId]
        );

        if (!teacherRows[0]) {
            return res.status(404).send("Teacher not found");
        }

        await db.query(
            `INSERT INTO announcements (teacher_id, class_name, title, description, category)
             VALUES (?, ?, ?, ?, ?)`,
            [teacherId, teacherRows[0].class_name, title, description, category]
        );

        res.redirect(`${announcementsUrl}&saved=created`);
    } catch (error) {
        console.error(error);
        res.status(500).send("Could not create announcement.");
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
        req.session.fullName = user.fullName;
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
    req.session.destroy((err) => {
        if (err) {
            console.error("Error logging out:", err);
            return res.status(500).send('Internal Server Error');
        }

        res.clearCookie("connect.sid");
        res.redirect('/login');
    });
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

app.get("/teachers/attendance", requireLogin, async (req, res) => {
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

app.post("/teachers/attendance", requireLogin, async (req, res) => {
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

app.get("/students/dashboard", requireLogin, async (req, res) => {
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
        await ensureAnnouncementTable();
        const announcements = await db.query(
            `SELECT
                title,
                description,
                category,
                DATE_FORMAT(created_at, '%b %e, %Y') AS postedOn
             FROM announcements
             WHERE class_name = ?
             ORDER BY created_at DESC, id DESC
             LIMIT 6`,
            [studentRows[0].class_name]
        );

        res.render("student-dashboard", {
            pageTitle: "Student Dashboard | Smart School",
            dashboard: {
                studentName: studentRows[0].full_name,
                className: studentRows[0].class_name,
                rollNumber: studentRows[0].roll_number,
                today,
                stats,
                periods,
                studentId,
                assignments,
                announcements,
                notices: notices.map((row) => row.notice_text)
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).send("Could not load student dashboard.");
    }
});

app.get("/students/profile", requireLogin, async (req, res) => {
    const studentId = Number(req.query.student_id) || 1;

    try {
        const student = await getStudentProfile(studentId);

        if (!student) {
            return res.status(404).send("Student not found");
        }

        res.render("student-profile", {
            pageTitle: "Student Profile | Smart School",
            profileMessage: getProfileMessage(req.query),
            profile: {
                studentId,
                studentName: student.full_name,
                email: student.email,
                className: student.class_name,
                rollNumber: student.roll_number,
                phone: student.phone,
                about: student.about
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).send("Could not load student profile.");
    }
});

app.post("/students/password", requireLogin, async (req, res) => {
    const studentId = Number(req.body.student_id) || 1;
    const currentPassword = req.body.current_password;
    const newPassword = req.body.new_password;
    const confirmPassword = req.body.confirm_password;
    const profileUrl = `/students/profile?student_id=${studentId}`;

    try {
        if (!currentPassword || !newPassword || !confirmPassword) {
            return res.redirect(`${profileUrl}&error=missing_password_fields`);
        }

        if (newPassword !== confirmPassword) {
            return res.redirect(`${profileUrl}&error=password_mismatch`);
        }

        if (newPassword.length < 6) {
            return res.redirect(`${profileUrl}&error=password_short`);
        }

        const user = await User.findStudentAccount(studentId);
        if (!user) {
            return res.redirect(`${profileUrl}&error=password_account_missing`);
        }

        const currentPasswordMatches = await user.authenticate(currentPassword);
        if (!currentPasswordMatches) {
            return res.redirect(`${profileUrl}&error=current_password_invalid`);
        }

        await User.updatePassword(user.id, newPassword);
        res.redirect(`${profileUrl}&saved=password_changed`);
    } catch (error) {
        console.error(error);
        res.status(500).send("Could not change student password.");
    }
});

app.get("/students/attendance", requireLogin, async (req, res) => {
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

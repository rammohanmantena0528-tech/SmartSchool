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
    updated: "Announcement updated.",
    deleted: "Announcement deleted.",
    missing_fields: "Title, description, and category are required."
};
const ATTENDANCE_MESSAGES = {
    created: "Attendance saved for the selected day.",
    updated: "Attendance updated for the selected day."
};
const MARKS_MESSAGES = {
    created: "Marks uploaded for the selected assessment.",
    updated: "Marks updated for the selected assessment.",
    missing_title: "Enter an assessment title before loading or uploading marks."
};
const TIMETABLE_MESSAGES = {
    created: "Timetable entry added.",
    updated: "Timetable entry updated.",
    deleted: "Timetable entry removed."
};
let announcementTableReady = false;
let marksTableReady = false;

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

function getAttendanceMessage(query) {
    if (query.saved && ATTENDANCE_MESSAGES[query.saved]) {
        return {
            type: "success",
            text: ATTENDANCE_MESSAGES[query.saved]
        };
    }

    return null;
}

function getMarksMessage(query) {
    if (query.saved && MARKS_MESSAGES[query.saved]) {
        return {
            type: "success",
            text: MARKS_MESSAGES[query.saved]
        };
    }

    return null;
}

function getTimetableMessage(query) {
    if (query.saved && TIMETABLE_MESSAGES[query.saved]) {
        return {
            type: "success",
            text: TIMETABLE_MESSAGES[query.saved]
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

async function ensureMarksTable() {
    if (marksTableReady) {
        return;
    }

    await db.query(
        `CREATE TABLE IF NOT EXISTS student_marks (
            id int NOT NULL AUTO_INCREMENT,
            student_id int NOT NULL,
            subject_name varchar(120) NOT NULL,
            assessment_type varchar(40) NOT NULL,
            assessment_title varchar(160) NOT NULL,
            assessment_date date NOT NULL,
            max_marks int NOT NULL,
            scored_marks decimal(6,2) NOT NULL,
            remarks varchar(255) DEFAULT NULL,
            created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY idx_student_marks_student_id (student_id),
            KEY idx_student_marks_date (assessment_date),
            UNIQUE KEY uniq_student_marks_entry (student_id, subject_name, assessment_type, assessment_title),
            CONSTRAINT fk_student_marks_student
                FOREIGN KEY (student_id) REFERENCES students (id)
                ON DELETE CASCADE
         ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`
    );
    marksTableReady = true;
}

async function syncStudentScheduleForClass(className, teacherId) {
    const students = await db.query(
        "SELECT id FROM students WHERE class_name = ? ORDER BY roll_number ASC",
        [className]
    );
    const scheduleRows = await db.query(
        `SELECT start_time, end_time, subject_name, room_name, status_label, sort_order
         FROM teacher_schedule
         WHERE teacher_id = ?
         ORDER BY sort_order, start_time, id`,
        [teacherId]
    );

    if (!students.length) {
        return;
    }

    await db.query(
        `DELETE ss
         FROM student_schedule ss
         INNER JOIN students s
           ON s.id = ss.student_id
         WHERE s.class_name = ?`,
        [className]
    );

    for (const student of students) {
        for (const row of scheduleRows) {
            await db.query(
                `INSERT INTO student_schedule (
                    student_id,
                    start_time,
                    end_time,
                    subject_name,
                    room_name,
                    status_label,
                    sort_order
                 )
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [
                    student.id,
                    row.start_time,
                    row.end_time,
                    row.subject_name,
                    row.room_name,
                    row.status_label,
                    row.sort_order
                ]
            );
        }
    }
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

app.post("/teachers/announcements/:id/update", requireTeacher, async (req, res) => {
    const teacherId = req.session.relatedId || Number(req.body.teacher_id) || 1;
    const announcementId = Number(req.params.id);
    const title = normalizeText(req.body.title);
    const description = normalizeText(req.body.description);
    const category = normalizeText(req.body.category);
    const announcementsUrl = `/teachers/announcements?teacher_id=${teacherId}`;

    try {
        await ensureAnnouncementTable();

        if (!announcementId) {
            return res.status(404).send("Announcement not found");
        }

        if (!title || !description || !category) {
            return res.redirect(`${announcementsUrl}&error=missing_fields`);
        }

        const result = await db.query(
            `UPDATE announcements
             SET title = ?, description = ?, category = ?
             WHERE id = ?
               AND teacher_id = ?`,
            [title, description, category, announcementId, teacherId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).send("Announcement not found");
        }

        res.redirect(`${announcementsUrl}&saved=updated`);
    } catch (error) {
        console.error(error);
        res.status(500).send("Could not update announcement.");
    }
});

app.post("/teachers/announcements/:id/delete", requireTeacher, async (req, res) => {
    const teacherId = req.session.relatedId || Number(req.body.teacher_id) || 1;
    const announcementId = Number(req.params.id);
    const announcementsUrl = `/teachers/announcements?teacher_id=${teacherId}`;

    try {
        await ensureAnnouncementTable();

        if (!announcementId) {
            return res.status(404).send("Announcement not found");
        }

        const result = await db.query(
            "DELETE FROM announcements WHERE id = ? AND teacher_id = ?",
            [announcementId, teacherId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).send("Announcement not found");
        }

        res.redirect(`${announcementsUrl}&saved=deleted`);
    } catch (error) {
        console.error(error);
        res.status(500).send("Could not delete announcement.");
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
        const selectedSubject = typeof req.query.subject === "string" && req.query.subject.trim()
            ? req.query.subject.trim()
            : "Mathematics";

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
        const hasExistingAttendance = studentRows.some((student) => Boolean(student.attendance_id));

        res.render("teacher-attendance", {
            pageTitle: "Teacher Attendance | Smart School",
            attendancePage: {
                teacherId,
                teacherName: teacherRows[0].full_name,
                className: teacherRows[0].class_name,
                today,
                selectedDate,
                selectedSubject,
                students: studentRows,
                hasExistingAttendance,
                message: getAttendanceMessage(req.query)
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
        const existingAttendance = await db.query(
            `SELECT id
             FROM student_attendance
             WHERE attendance_date = ?
               AND subject_name = ?
               AND student_id IN (
                   SELECT id
                   FROM students
                   WHERE class_name = ?
               )`,
            [selectedDate, selectedSubject, teacherRows[0].class_name]
        );
        const wasExistingAttendance = existingAttendance.length > 0;

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
            `/teachers/attendance?teacher_id=${teacherId}&date=${selectedDate}&subject=${encodeURIComponent(selectedSubject)}&saved=${wasExistingAttendance ? "updated" : "created"}`
        );
    } catch (error) {
        console.error(error);
        res.status(500).send("Could not save teacher attendance.");
    }
});

app.get("/teachers/attendance-reports", requireLogin, async (req, res) => {
    const teacherId = Number(req.query.teacher_id) || 1;
    const today = new Date().toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric"
    });
    const todayIso = new Date().toISOString().slice(0, 10);
    const defaultStartDate = `${todayIso.slice(0, 8)}01`;

    try {
        const teacherRows = await db.query(
            "SELECT id, full_name, class_name FROM teachers WHERE id = ? LIMIT 1",
            [teacherId]
        );

        if (!teacherRows[0]) {
            return res.status(404).send("Teacher not found");
        }

        const selectedStartDate = getIsoDate(req.query.start_date || defaultStartDate);
        const selectedEndDate = getIsoDate(req.query.end_date || todayIso);
        const selectedSubject = typeof req.query.subject === "string" && req.query.subject.trim()
            ? req.query.subject.trim()
            : "All Subjects";

        const reportParams = [
            selectedStartDate,
            selectedEndDate,
            teacherRows[0].class_name
        ];
        let subjectFilter = "";

        if (selectedSubject !== "All Subjects") {
            subjectFilter = " AND sa.subject_name = ?";
            reportParams.splice(2, 0, selectedSubject);
        }

        const reportRows = await db.query(
            `SELECT
                s.id AS student_id,
                s.full_name AS student_name,
                s.roll_number,
                COUNT(sa.id) AS total_days,
                SUM(CASE WHEN sa.status_label = 'Present' THEN 1 ELSE 0 END) AS present_count,
                SUM(CASE WHEN sa.status_label = 'Late' THEN 1 ELSE 0 END) AS late_count,
                SUM(CASE WHEN sa.status_label = 'Absent' THEN 1 ELSE 0 END) AS absent_count
             FROM students s
             LEFT JOIN student_attendance sa
               ON sa.student_id = s.id
              AND sa.attendance_date BETWEEN ? AND ?
              ${subjectFilter}
             WHERE s.class_name = ?
             GROUP BY s.id, s.full_name, s.roll_number
             ORDER BY s.roll_number ASC`,
            reportParams
        );

        const rows = reportRows.map((row) => {
            const totalDays = Number(row.total_days) || 0;
            const presentCount = Number(row.present_count) || 0;
            const lateCount = Number(row.late_count) || 0;
            const absentCount = Number(row.absent_count) || 0;
            const participationRate = totalDays
                ? `${Math.round(((presentCount + lateCount) / totalDays) * 100)}%`
                : "0%";

            return {
                ...row,
                totalDays,
                presentCount,
                lateCount,
                absentCount,
                participationRate
            };
        });

        const summary = rows.reduce((totals, row) => {
            totals.totalDays += row.totalDays;
            totals.presentCount += row.presentCount;
            totals.lateCount += row.lateCount;
            totals.absentCount += row.absentCount;
            return totals;
        }, {
            totalDays: 0,
            presentCount: 0,
            lateCount: 0,
            absentCount: 0
        });
        const participationRate = summary.totalDays
            ? `${Math.round(((summary.presentCount + summary.lateCount) / summary.totalDays) * 100)}%`
            : "0%";

        res.render("teacher-attendance-reports", {
            pageTitle: "Teacher Attendance Reports | Smart School",
            reportPage: {
                teacherId,
                teacherName: teacherRows[0].full_name,
                className: teacherRows[0].class_name,
                today,
                selectedStartDate,
                selectedEndDate,
                selectedSubject,
                rows,
                summary: {
                    ...summary,
                    participationRate
                }
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).send("Could not load attendance reports.");
    }
});

app.get("/teachers/performance-reports", requireLogin, async (req, res) => {
    const teacherId = req.session.relatedId || Number(req.query.teacher_id) || 1;
    const today = new Date().toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric"
    });

    try {
        await ensureMarksTable();

        const teacherRows = await db.query(
            "SELECT id, full_name, class_name FROM teachers WHERE id = ? LIMIT 1",
            [teacherId]
        );

        if (!teacherRows[0]) {
            return res.status(404).send("Teacher not found");
        }

        const selectedSubject = typeof req.query.subject === "string" && req.query.subject.trim()
            ? req.query.subject.trim()
            : "All Subjects";
        const selectedAssessmentType = req.query.assessment_type === "Assignment"
            ? "Assignment"
            : req.query.assessment_type === "Exam"
                ? "Exam"
                : "All Types";

        const reportParams = [teacherRows[0].class_name];
        let subjectFilter = "";
        let typeFilter = "";

        if (selectedSubject !== "All Subjects") {
            subjectFilter = " AND sm.subject_name = ?";
            reportParams.push(selectedSubject);
        }

        if (selectedAssessmentType !== "All Types") {
            typeFilter = " AND sm.assessment_type = ?";
            reportParams.push(selectedAssessmentType);
        }

        const rows = await db.query(
            `SELECT
                s.id AS student_id,
                s.full_name AS student_name,
                s.roll_number,
                COUNT(sm.id) AS assessments_count,
                ROUND(AVG((sm.scored_marks / NULLIF(sm.max_marks, 0)) * 100), 1) AS average_percent
             FROM students s
             LEFT JOIN student_marks sm
               ON sm.student_id = s.id
             WHERE s.class_name = ?
               ${subjectFilter}
               ${typeFilter}
             GROUP BY s.id, s.full_name, s.roll_number
             ORDER BY s.roll_number ASC`,
            reportParams
        );

        const reportRows = [];
        for (const row of rows) {
            const latestParams = [row.student_id];
            let latestSubjectFilter = "";
            let latestTypeFilter = "";

            if (selectedSubject !== "All Subjects") {
                latestSubjectFilter = " AND subject_name = ?";
                latestParams.push(selectedSubject);
            }

            if (selectedAssessmentType !== "All Types") {
                latestTypeFilter = " AND assessment_type = ?";
                latestParams.push(selectedAssessmentType);
            }

            const latestRow = await db.query(
                `SELECT
                    assessment_date,
                    ROUND((scored_marks / NULLIF(max_marks, 0)) * 100, 1) AS latest_percent
                 FROM student_marks
                 WHERE student_id = ?
                   ${latestSubjectFilter}
                   ${latestTypeFilter}
                 ORDER BY assessment_date DESC, id DESC
                 LIMIT 1`,
                latestParams
            );

            const avg = row.average_percent === null ? null : Number(row.average_percent);
            const latest = latestRow[0]?.latest_percent === null || latestRow[0]?.latest_percent === undefined
                ? null
                : Number(latestRow[0].latest_percent);
            const band = avg === null
                ? "No Data"
                : avg >= 85
                    ? "Excellent"
                    : avg >= 70
                        ? "Good"
                        : avg >= 50
                            ? "Needs Support"
                            : "At Risk";

            reportRows.push({
                ...row,
                averagePercent: avg === null ? "-" : `${avg}%`,
                latestPercent: latest === null ? "-" : `${latest}%`,
                performanceBand: band,
                latestAssessmentDate: latestRow[0]?.assessment_date
                    ? new Date(latestRow[0].assessment_date).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric"
                    })
                    : "-"
            });
        }

        const completedReports = reportRows.filter((row) => row.assessments_count > 0).length;
        const classAverageRaw = reportRows
            .filter((row) => row.average_percent !== null)
            .reduce((sum, row, _, arr) => sum + Number(row.average_percent) / arr.length, 0);

        res.render("teacher-performance-reports", {
            pageTitle: "Teacher Performance Reports | Smart School",
            reportPage: {
                teacherId,
                teacherName: teacherRows[0].full_name,
                className: teacherRows[0].class_name,
                today,
                selectedSubject,
                selectedAssessmentType,
                rows: reportRows,
                summary: {
                    totalStudents: reportRows.length,
                    completedReports,
                    classAverage: completedReports ? `${Math.round(classAverageRaw)}%` : "0%",
                    highPerformers: reportRows.filter((row) => row.performanceBand === "Excellent").length
                }
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).send("Could not load performance reports.");
    }
});

app.get("/teachers/timetable", requireLogin, async (req, res) => {
    const teacherId = req.session.relatedId || Number(req.query.teacher_id) || 1;

    try {
        const teacherRows = await db.query(
            "SELECT id, full_name, class_name FROM teachers WHERE id = ? LIMIT 1",
            [teacherId]
        );

        if (!teacherRows[0]) {
            return res.status(404).send("Teacher not found");
        }

        const periods = await db.query(
            `SELECT
                id,
                TIME_FORMAT(start_time, '%H:%i') AS start_time,
                TIME_FORMAT(end_time, '%H:%i') AS end_time,
                subject_name,
                room_name,
                status_label,
                sort_order
             FROM teacher_schedule
             WHERE teacher_id = ?
             ORDER BY sort_order, start_time, id`,
            [teacherId]
        );

        const editingId = Number(req.query.edit_id) || null;
        const editingPeriod = periods.find((period) => period.id === editingId) || null;

        res.render("teacher-timetable", {
            pageTitle: "Teacher Timetable | Smart School",
            timetablePage: {
                teacherId,
                teacherName: teacherRows[0].full_name,
                className: teacherRows[0].class_name,
                periods,
                editingPeriod,
                message: getTimetableMessage(req.query)
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).send("Could not load timetable manager.");
    }
});

app.post("/teachers/timetable", requireLogin, async (req, res) => {
    const teacherId = req.session.relatedId || Number(req.body.teacher_id) || 1;
    const periodId = Number(req.body.period_id) || null;
    const startTime = typeof req.body.start_time === "string" ? req.body.start_time : "";
    const endTime = typeof req.body.end_time === "string" ? req.body.end_time : "";
    const subjectName = typeof req.body.subject_name === "string" ? req.body.subject_name.trim() : "";
    const roomName = typeof req.body.room_name === "string" ? req.body.room_name.trim() : "";
    const statusLabel = typeof req.body.status_label === "string" && req.body.status_label.trim()
        ? req.body.status_label.trim()
        : "Upcoming";
    const sortOrderRaw = Number(req.body.sort_order);
    const sortOrder = Number.isFinite(sortOrderRaw) ? sortOrderRaw : 0;

    try {
        const teacherRows = await db.query(
            "SELECT id, class_name FROM teachers WHERE id = ? LIMIT 1",
            [teacherId]
        );

        if (!teacherRows[0]) {
            return res.status(404).send("Teacher not found");
        }

        if (periodId) {
            await db.query(
                `UPDATE teacher_schedule
                 SET start_time = ?, end_time = ?, subject_name = ?, room_name = ?, status_label = ?, sort_order = ?
                 WHERE id = ? AND teacher_id = ?`,
                [startTime, endTime, subjectName, roomName, statusLabel, sortOrder, periodId, teacherId]
            );
        } else {
            await db.query(
                `INSERT INTO teacher_schedule (
                    teacher_id,
                    start_time,
                    end_time,
                    subject_name,
                    room_name,
                    status_label,
                    sort_order
                 )
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [teacherId, startTime, endTime, subjectName, roomName, statusLabel, sortOrder]
            );
        }

        await syncStudentScheduleForClass(teacherRows[0].class_name, teacherId);
        res.redirect(`/teachers/timetable?teacher_id=${teacherId}&saved=${periodId ? "updated" : "created"}`);
    } catch (error) {
        console.error(error);
        res.status(500).send("Could not save timetable entry.");
    }
});

app.post("/teachers/timetable/delete", requireLogin, async (req, res) => {
    const teacherId = req.session.relatedId || Number(req.body.teacher_id) || 1;
    const periodId = Number(req.body.period_id) || null;

    try {
        const teacherRows = await db.query(
            "SELECT id, class_name FROM teachers WHERE id = ? LIMIT 1",
            [teacherId]
        );

        if (!teacherRows[0]) {
            return res.status(404).send("Teacher not found");
        }

        await db.query(
            "DELETE FROM teacher_schedule WHERE id = ? AND teacher_id = ?",
            [periodId, teacherId]
        );
        await syncStudentScheduleForClass(teacherRows[0].class_name, teacherId);
        res.redirect(`/teachers/timetable?teacher_id=${teacherId}&saved=deleted`);
    } catch (error) {
        console.error(error);
        res.status(500).send("Could not delete timetable entry.");
    }
});

app.get("/teachers/marks", requireLogin, async (req, res) => {
    const teacherId = req.session.relatedId || Number(req.query.teacher_id) || 1;
    const today = new Date().toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric"
    });

    try {
        await ensureMarksTable();

        const teacherRows = await db.query(
            "SELECT id, full_name, class_name FROM teachers WHERE id = ? LIMIT 1",
            [teacherId]
        );

        if (!teacherRows[0]) {
            return res.status(404).send("Teacher not found");
        }

        const selectedSubject = typeof req.query.subject === "string" && req.query.subject.trim()
            ? req.query.subject.trim()
            : "Mathematics";
        const assessmentType = req.query.assessment_type === "Assignment" ? "Assignment" : "Exam";
        const assessmentTitle = typeof req.query.assessment_title === "string" && req.query.assessment_title.trim()
            ? req.query.assessment_title.trim()
            : "";
        const assessmentDate = getIsoDate(req.query.assessment_date);
        const maxMarksRaw = Number(req.query.max_marks);
        const maxMarks = Number.isFinite(maxMarksRaw) && maxMarksRaw > 0 ? maxMarksRaw : 100;

        const studentRows = await db.query(
            `SELECT
                s.full_name AS student_name,
                s.id AS student_id,
                s.roll_number,
                sm.id AS mark_id,
                sm.scored_marks,
                sm.remarks
             FROM students s
             LEFT JOIN student_marks sm
               ON sm.student_id = s.id
              AND sm.subject_name = ?
              AND sm.assessment_type = ?
              AND sm.assessment_title = ?
             WHERE s.class_name = ?
             ORDER BY s.roll_number ASC`,
            [selectedSubject, assessmentType, assessmentTitle, teacherRows[0].class_name]
        );

        res.render("teacher-marks", {
            pageTitle: "Teacher Marks Upload | Smart School",
            marksPage: {
                teacherId,
                teacherName: teacherRows[0].full_name,
                className: teacherRows[0].class_name,
                today,
                selectedSubject,
                assessmentType,
                assessmentTitle,
                assessmentDate,
                maxMarks,
                students: studentRows,
                hasExistingMarks: Boolean(assessmentTitle) && studentRows.some((student) => Boolean(student.mark_id)),
                message: getMarksMessage(req.query),
                hasAssessmentTitle: Boolean(assessmentTitle)
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).send("Could not load marks upload.");
    }
});

app.post("/teachers/marks", requireLogin, async (req, res) => {
    const teacherId = req.session.relatedId || Number(req.body.teacher_id) || 1;
    const selectedSubject = typeof req.body.subject === "string" && req.body.subject.trim()
        ? req.body.subject.trim()
        : "Mathematics";
    const assessmentType = req.body.assessment_type === "Assignment" ? "Assignment" : "Exam";
    const assessmentTitle = typeof req.body.assessment_title === "string" ? req.body.assessment_title.trim() : "";
    const assessmentDate = getIsoDate(req.body.assessment_date);
    const maxMarksRaw = Number(req.body.max_marks);
    const maxMarks = Number.isFinite(maxMarksRaw) && maxMarksRaw > 0 ? maxMarksRaw : 100;

    try {
        await ensureMarksTable();

        if (!assessmentTitle) {
            return res.redirect(
                `/teachers/marks?teacher_id=${teacherId}&subject=${encodeURIComponent(selectedSubject)}&assessment_type=${encodeURIComponent(assessmentType)}&assessment_date=${assessmentDate}&max_marks=${maxMarks}&saved=missing_title`
            );
        }

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
        const existingMarks = await db.query(
            `SELECT id
             FROM student_marks
             WHERE subject_name = ?
               AND assessment_type = ?
               AND assessment_title = ?
               AND student_id IN (
                   SELECT id
                   FROM students
                   WHERE class_name = ?
               )`,
            [selectedSubject, assessmentType, assessmentTitle, teacherRows[0].class_name]
        );
        const hadExistingMarks = existingMarks.length > 0;

        for (const student of students) {
            const scoreRaw = req.body[`score_${student.id}`];
            const remarksValue = req.body[`remarks_${student.id}`];
            const remarks = typeof remarksValue === "string" ? remarksValue.trim() : "";

            if (scoreRaw === undefined || scoreRaw === "") {
                continue;
            }

            const scoredMarks = Number(scoreRaw);
            if (!Number.isFinite(scoredMarks) || scoredMarks < 0) {
                continue;
            }

            await db.query(
                `INSERT INTO student_marks (
                    student_id,
                    subject_name,
                    assessment_type,
                    assessment_title,
                    assessment_date,
                    max_marks,
                    scored_marks,
                    remarks
                 )
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE
                   assessment_date = VALUES(assessment_date),
                   max_marks = VALUES(max_marks),
                   scored_marks = VALUES(scored_marks),
                   remarks = VALUES(remarks)`,
                [
                    student.id,
                    selectedSubject,
                    assessmentType,
                    assessmentTitle,
                    assessmentDate,
                    maxMarks,
                    scoredMarks,
                    remarks || null
                ]
            );
        }

        res.redirect(
            `/teachers/marks?teacher_id=${teacherId}&subject=${encodeURIComponent(selectedSubject)}&assessment_type=${encodeURIComponent(assessmentType)}&assessment_title=${encodeURIComponent(assessmentTitle)}&assessment_date=${assessmentDate}&max_marks=${maxMarks}&saved=${hadExistingMarks ? "updated" : "created"}`
        );
    } catch (error) {
        console.error(error);
        res.status(500).send("Could not save marks.");
    }
});

app.get("/students/dashboard", requireLogin, async (req, res) => {
    const studentId = req.session.relatedId || Number(req.query.student_id) || 1;
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
        await ensureMarksTable();
        const marksPreview = await db.query(
            `SELECT
                subject_name AS subject,
                assessment_title AS title,
                scored_marks AS score,
                max_marks AS maxMarks
             FROM student_marks
             WHERE student_id = ?
             ORDER BY assessment_date DESC, id DESC
             LIMIT 4`,
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
                marksPreview,
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

app.get("/students/marks", requireLogin, async (req, res) => {
    const studentId = req.session.relatedId || Number(req.query.student_id) || 1;
    const today = new Date().toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric"
    });

    try {
        await ensureMarksTable();

        const studentRows = await db.query(
            "SELECT id, full_name, class_name, roll_number FROM students WHERE id = ? LIMIT 1",
            [studentId]
        );

        if (!studentRows[0]) {
            return res.status(404).send("Student not found");
        }

        const marks = await db.query(
            `SELECT
                subject_name AS subject,
                assessment_type AS assessmentType,
                assessment_title AS title,
                DATE_FORMAT(assessment_date, '%b %e, %Y') AS assessmentDate,
                scored_marks AS score,
                max_marks AS maxMarks,
                remarks
             FROM student_marks
             WHERE student_id = ?
             ORDER BY assessment_date DESC, id DESC`,
            [studentId]
        );

        res.render("student-marks", {
            pageTitle: "Student Marks | Smart School",
            marksPage: {
                studentId,
                studentName: studentRows[0].full_name,
                className: studentRows[0].class_name,
                rollNumber: studentRows[0].roll_number,
                today,
                marks
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).send("Could not load student marks.");
    }
});

app.get("/students/performance", requireLogin, async (req, res) => {
    const studentId = req.session.relatedId || Number(req.query.student_id) || 1;
    const today = new Date().toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric"
    });

    try {
        await ensureMarksTable();

        const studentRows = await db.query(
            "SELECT id, full_name, class_name, roll_number FROM students WHERE id = ? LIMIT 1",
            [studentId]
        );

        if (!studentRows[0]) {
            return res.status(404).send("Student not found");
        }

        const subjectRows = await db.query(
            `SELECT
                subject_name AS subject,
                COUNT(id) AS assessments_count,
                ROUND(AVG((scored_marks / NULLIF(max_marks, 0)) * 100), 1) AS average_percent,
                ROUND(MAX((scored_marks / NULLIF(max_marks, 0)) * 100), 1) AS best_percent
             FROM student_marks
             WHERE student_id = ?
             GROUP BY subject_name
             ORDER BY subject_name ASC`,
            [studentId]
        );

        const summaryRow = await db.query(
            `SELECT
                COUNT(id) AS total_assessments,
                ROUND(AVG((scored_marks / NULLIF(max_marks, 0)) * 100), 1) AS overall_average
             FROM student_marks
             WHERE student_id = ?`,
            [studentId]
        );

        const summary = summaryRow[0] || { total_assessments: 0, overall_average: null };
        const rows = subjectRows.map((row) => {
            const average = row.average_percent === null ? null : Number(row.average_percent);
            const best = row.best_percent === null ? null : Number(row.best_percent);
            return {
                subject: row.subject,
                assessmentsCount: Number(row.assessments_count) || 0,
                averagePercent: average === null ? "-" : `${average}%`,
                bestPercent: best === null ? "-" : `${best}%`,
                progressBand: average === null
                    ? "No Data"
                    : average >= 85
                        ? "Excellent"
                        : average >= 70
                            ? "Good"
                            : average >= 50
                                ? "Needs Support"
                                : "At Risk"
            };
        });

        res.render("student-performance", {
            pageTitle: "Student Performance | Smart School",
            performancePage: {
                studentId,
                studentName: studentRows[0].full_name,
                className: studentRows[0].class_name,
                rollNumber: studentRows[0].roll_number,
                today,
                rows,
                summary: {
                    totalAssessments: Number(summary.total_assessments) || 0,
                    overallAverage: summary.overall_average === null ? "0%" : `${Number(summary.overall_average)}%`,
                    strongSubjects: rows.filter((row) => row.progressBand === "Excellent").length
                }
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).send("Could not load student performance.");
    }
});

app.get("/students/timetable", requireLogin, async (req, res) => {
    const studentId = req.session.relatedId || Number(req.query.student_id) || 1;
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

        const periods = await db.query(
            `SELECT
                CONCAT(TIME_FORMAT(start_time, '%H:%i'), ' - ', TIME_FORMAT(end_time, '%H:%i')) AS time,
                subject_name AS subject,
                room_name AS room,
                status_label AS status
             FROM student_schedule
             WHERE student_id = ?
             ORDER BY sort_order, start_time, id`,
            [studentId]
        );

        res.render("student-timetable", {
            pageTitle: "Student Timetable | Smart School",
            timetablePage: {
                studentId,
                studentName: studentRows[0].full_name,
                className: studentRows[0].class_name,
                rollNumber: studentRows[0].roll_number,
                today,
                periods
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).send("Could not load student timetable.");
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

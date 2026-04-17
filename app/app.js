const express = require("express");
const cookieParser = require("cookie-parser");
const session = require("express-session");
const bodyParser = require("body-parser");

const db = require("./services/db");
const { User } = require("./models/user");
const { Teacher } = require("./models/teacher");
const { Student } = require("./models/student");
const { Announcement } = require("./models/announcement");
const { Mark } = require("./models/mark");

const app = express();
const oneDay = 1000 * 60 * 60 * 24;
const sessionMiddleware = session({
    secret: "driveyourpassion",
    saveUninitialized: true,
    cookie: { maxAge: oneDay },
    resave: false
});

const VALID_ROLES = new Set(["student", "teacher"]);
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

app.use(express.static("static"));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(sessionMiddleware);

app.set("view engine", "pug");
app.set("views", "./app/views");

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

function normalizeText(value) {
    return typeof value === "string" ? value.trim() : "";
}

function getIsoDate(value) {
    if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return value;
    }

    return new Date().toISOString().slice(0, 10);
}

function getTodayLabel() {
    return new Date().toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric"
    });
}

function getAuthNavLinks(mode) {
    return [
        { href: "/", label: "Overview" },
        { href: "/#modules", label: "Modules" },
        { href: mode === "register" ? "/login" : "/register", label: mode === "register" ? "Login" : "Register" },
        { href: "/#contact", label: "Contact" }
    ];
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
        return { type: "success", text: PROFILE_MESSAGES[query.saved] };
    }

    if (query.error && PROFILE_MESSAGES[query.error]) {
        return { type: "error", text: PROFILE_MESSAGES[query.error] };
    }

    return null;
}

function getAnnouncementMessage(query) {
    if (query.saved && ANNOUNCEMENT_MESSAGES[query.saved]) {
        return { type: "success", text: ANNOUNCEMENT_MESSAGES[query.saved] };
    }

    if (query.error && ANNOUNCEMENT_MESSAGES[query.error]) {
        return { type: "error", text: ANNOUNCEMENT_MESSAGES[query.error] };
    }

    return null;
}

function getAttendanceMessage(query) {
    if (query.saved && ATTENDANCE_MESSAGES[query.saved]) {
        return { type: "success", text: ATTENDANCE_MESSAGES[query.saved] };
    }

    return null;
}

function getMarksMessage(query) {
    if (query.saved && MARKS_MESSAGES[query.saved]) {
        return { type: "success", text: MARKS_MESSAGES[query.saved] };
    }

    return null;
}

function getTimetableMessage(query) {
    if (query.saved && TIMETABLE_MESSAGES[query.saved]) {
        return { type: "success", text: TIMETABLE_MESSAGES[query.saved] };
    }

    return null;
}

function getStudentDashboardHref(studentId) {
    return `/students/dashboard${studentId ? `?student_id=${studentId}` : ""}`;
}

function getTeacherDashboardHref(teacherId) {
    return `/teachers/dashboard${teacherId ? `?teacher_id=${teacherId}` : ""}`;
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

function renderAuthPage(res, authMode, options = {}) {
    res.status(options.statusCode || 200).render("auth", {
        pageTitle: `${authMode === "register" ? "Register" : "Login"} | Smart School`,
        authMode,
        navLinks: getAuthNavLinks(authMode),
        authError: options.authError || null,
        authSuccess: options.authSuccess || null,
        authValues: options.authValues || {}
    });
}

async function ensureRoleRecord(role, details) {
    if (role === "teacher") {
        return Teacher.ensureRoleRecord(details);
    }

    if (role === "student") {
        return Student.ensureRoleRecord(details);
    }

    return null;
}

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

app.post("/authenticate", async (req, res) => {
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
    } catch (error) {
        console.error("Error while authenticating user:", error.message);
        res.status(500).send("Internal Server Error");
    }
});

app.get("/logout", (req, res) => {
    req.session.destroy((error) => {
        if (error) {
            console.error("Error logging out:", error);
            return res.status(500).send("Internal Server Error");
        }

        res.clearCookie("connect.sid");
        res.redirect("/login");
    });
});

app.post("/register", async (req, res) => {
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

        if (!registrationData.className) {
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

        res.redirect("/login?registered=1");
    } catch (error) {
        console.error("Error while registering user:", error.message);
        res.status(500).send("Internal Server Error");
    }
});

app.get("/teachers/dashboard", requireLogin, async (req, res) => {
    const teacherId = req.session.relatedId || Number(req.query.teacher_id) || 1;

    try {
        const dashboardData = await Teacher.getDashboardData(teacherId);
        if (!dashboardData) {
            return res.status(404).send("Teacher not found");
        }

        const announcements = await Announcement.listByTeacher(teacherId);

        res.render("teacher-dashboard", {
            pageTitle: "Teacher Dashboard | Smart School",
            dashboard: {
                teacherId,
                teacherName: dashboardData.teacher.fullName,
                className: dashboardData.teacher.className,
                today: getTodayLabel(),
                stats: dashboardData.stats,
                periods: dashboardData.periods,
                announcements
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).send("Could not load teacher dashboard.");
    }
});

app.get("/teachers/profile", requireLogin, async (req, res) => {
    const teacherId = req.session.relatedId || Number(req.query.teacher_id) || 1;

    try {
        const teacher = await Teacher.getProfile(teacherId);
        if (!teacher) {
            return res.status(404).send("Teacher not found");
        }

        res.render("teacher-profile", {
            pageTitle: "Teacher Profile | Smart School",
            profileMessage: getProfileMessage(req.query),
            profile: {
                teacherId,
                teacherName: teacher.fullName,
                email: teacher.email,
                className: teacher.className,
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
    const teacherId = req.session.relatedId || Number(req.body.teacher_id) || 1;
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

        const duplicateEmail = await Teacher.emailExistsForOther(email, teacherId);
        if (duplicateEmail) {
            return res.redirect(`${profileUrl}&error=duplicate_email`);
        }

        await Teacher.updateProfile(teacherId, {
            fullName,
            email,
            className,
            phone,
            about
        });

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
    const teacherId = req.session.relatedId || Number(req.body.teacher_id) || 1;
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
        const teacher = await Teacher.findById(teacherId);
        if (!teacher) {
            return res.status(404).send("Teacher not found");
        }

        const announcements = await Announcement.listByTeacher(teacherId);
        res.render("teacher-announcements", {
            pageTitle: "Teacher Announcements | Smart School",
            announcementMessage: getAnnouncementMessage(req.query),
            announcementPage: {
                teacherId,
                teacherName: teacher.fullName,
                className: teacher.className,
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
        if (!title || !description || !category) {
            return res.redirect(`${announcementsUrl}&error=missing_fields`);
        }

        const teacher = await Teacher.findById(teacherId);
        if (!teacher) {
            return res.status(404).send("Teacher not found");
        }

        await Announcement.create(teacherId, teacher.className, {
            title,
            description,
            category
        });
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
        if (!announcementId) {
            return res.status(404).send("Announcement not found");
        }

        if (!title || !description || !category) {
            return res.redirect(`${announcementsUrl}&error=missing_fields`);
        }

        const result = await Announcement.update(teacherId, announcementId, {
            title,
            description,
            category
        });

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
        if (!announcementId) {
            return res.status(404).send("Announcement not found");
        }

        const result = await Announcement.delete(teacherId, announcementId);
        if (result.affectedRows === 0) {
            return res.status(404).send("Announcement not found");
        }

        res.redirect(`${announcementsUrl}&saved=deleted`);
    } catch (error) {
        console.error(error);
        res.status(500).send("Could not delete announcement.");
    }
});

app.get("/teachers/attendance", requireLogin, async (req, res) => {
    const teacherId = req.session.relatedId || Number(req.query.teacher_id) || 1;
    const selectedDate = getIsoDate(req.query.date);
    const selectedSubject = normalizeText(req.query.subject) || "Mathematics";

    try {
        const attendanceData = await Teacher.getAttendancePageData(teacherId, selectedDate, selectedSubject);
        if (!attendanceData) {
            return res.status(404).send("Teacher not found");
        }

        res.render("teacher-attendance", {
            pageTitle: "Teacher Attendance | Smart School",
            attendancePage: {
                teacherId,
                teacherName: attendanceData.teacher.fullName,
                className: attendanceData.teacher.className,
                today: getTodayLabel(),
                selectedDate,
                selectedSubject,
                students: attendanceData.students,
                hasExistingAttendance: attendanceData.hasExistingAttendance,
                message: getAttendanceMessage(req.query)
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).send("Could not load teacher attendance.");
    }
});

app.post("/teachers/attendance", requireLogin, async (req, res) => {
    const teacherId = req.session.relatedId || Number(req.body.teacher_id) || 1;
    const selectedDate = getIsoDate(req.body.date);
    const selectedSubject = normalizeText(req.body.subject) || "Mathematics";

    try {
        const result = await Teacher.saveAttendance(teacherId, selectedDate, selectedSubject, req.body);
        if (!result) {
            return res.status(404).send("Teacher not found");
        }

        res.redirect(
            `/teachers/attendance?teacher_id=${teacherId}&date=${selectedDate}&subject=${encodeURIComponent(selectedSubject)}&saved=${result.savedState}`
        );
    } catch (error) {
        console.error(error);
        res.status(500).send("Could not save teacher attendance.");
    }
});

app.get("/teachers/attendance-reports", requireLogin, async (req, res) => {
    const teacherId = req.session.relatedId || Number(req.query.teacher_id) || 1;
    const todayIso = new Date().toISOString().slice(0, 10);
    const defaultStartDate = `${todayIso.slice(0, 8)}01`;
    const selectedStartDate = getIsoDate(req.query.start_date || defaultStartDate);
    const selectedEndDate = getIsoDate(req.query.end_date || todayIso);
    const selectedSubject = normalizeText(req.query.subject) || "All Subjects";

    try {
        const reportData = await Teacher.getAttendanceReport(
            teacherId,
            selectedStartDate,
            selectedEndDate,
            selectedSubject
        );

        if (!reportData) {
            return res.status(404).send("Teacher not found");
        }

        res.render("teacher-attendance-reports", {
            pageTitle: "Teacher Attendance Reports | Smart School",
            reportPage: {
                teacherId,
                teacherName: reportData.teacher.fullName,
                className: reportData.teacher.className,
                today: getTodayLabel(),
                selectedStartDate,
                selectedEndDate,
                selectedSubject,
                rows: reportData.rows,
                summary: reportData.summary
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).send("Could not load attendance reports.");
    }
});

app.get("/teachers/performance-reports", requireLogin, async (req, res) => {
    const teacherId = req.session.relatedId || Number(req.query.teacher_id) || 1;
    const selectedSubject = normalizeText(req.query.subject) || "All Subjects";
    const selectedAssessmentType = req.query.assessment_type === "Assignment"
        ? "Assignment"
        : req.query.assessment_type === "Exam"
            ? "Exam"
            : "All Types";

    try {
        const teacher = await Teacher.findById(teacherId);
        if (!teacher) {
            return res.status(404).send("Teacher not found");
        }

        const reportData = await Mark.getTeacherPerformanceReport(
            teacher.className,
            selectedSubject,
            selectedAssessmentType
        );

        res.render("teacher-performance-reports", {
            pageTitle: "Teacher Performance Reports | Smart School",
            reportPage: {
                teacherId,
                teacherName: teacher.fullName,
                className: teacher.className,
                today: getTodayLabel(),
                selectedSubject,
                selectedAssessmentType,
                rows: reportData.rows.map((row) => ({
                    student_name: row.studentName,
                    roll_number: row.rollNumber,
                    assessments_count: row.assessmentsCount,
                    averagePercent: row.averagePercent,
                    latestPercent: row.latestPercent,
                    latestAssessmentDate: row.latestAssessmentDate,
                    performanceBand: row.performanceBand
                })),
                summary: reportData.summary
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).send("Could not load performance reports.");
    }
});

app.get("/teachers/timetable", requireLogin, async (req, res) => {
    const teacherId = req.session.relatedId || Number(req.query.teacher_id) || 1;
    const editingId = Number(req.query.edit_id) || null;

    try {
        const timetableData = await Teacher.getTimetablePageData(teacherId);
        if (!timetableData) {
            return res.status(404).send("Teacher not found");
        }

        res.render("teacher-timetable", {
            pageTitle: "Teacher Timetable | Smart School",
            timetablePage: {
                teacherId,
                teacherName: timetableData.teacher.fullName,
                className: timetableData.teacher.className,
                periods: timetableData.periods,
                editingPeriod: timetableData.periods.find((period) => period.id === editingId) || null,
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
    const sortOrderRaw = Number(req.body.sort_order);

    try {
        const result = await Teacher.saveTimetableEntry(teacherId, {
            periodId,
            startTime: typeof req.body.start_time === "string" ? req.body.start_time : "",
            endTime: typeof req.body.end_time === "string" ? req.body.end_time : "",
            subjectName: normalizeText(req.body.subject_name),
            roomName: normalizeText(req.body.room_name),
            statusLabel: normalizeText(req.body.status_label) || "Upcoming",
            sortOrder: Number.isFinite(sortOrderRaw) ? sortOrderRaw : 0
        });

        if (!result) {
            return res.status(404).send("Teacher not found");
        }

        res.redirect(`/teachers/timetable?teacher_id=${teacherId}&saved=${result.savedState}`);
    } catch (error) {
        console.error(error);
        res.status(500).send("Could not save timetable entry.");
    }
});

app.post("/teachers/timetable/delete", requireLogin, async (req, res) => {
    const teacherId = req.session.relatedId || Number(req.body.teacher_id) || 1;
    const periodId = Number(req.body.period_id) || null;

    try {
        const teacher = await Teacher.deleteTimetableEntry(teacherId, periodId);
        if (!teacher) {
            return res.status(404).send("Teacher not found");
        }

        res.redirect(`/teachers/timetable?teacher_id=${teacherId}&saved=deleted`);
    } catch (error) {
        console.error(error);
        res.status(500).send("Could not delete timetable entry.");
    }
});

app.get("/teachers/marks", requireLogin, async (req, res) => {
    const teacherId = req.session.relatedId || Number(req.query.teacher_id) || 1;
    const selectedSubject = normalizeText(req.query.subject) || "Mathematics";
    const assessmentType = req.query.assessment_type === "Assignment" ? "Assignment" : "Exam";
    const assessmentTitle = normalizeText(req.query.assessment_title);
    const assessmentDate = getIsoDate(req.query.assessment_date);
    const maxMarksRaw = Number(req.query.max_marks);
    const maxMarks = Number.isFinite(maxMarksRaw) && maxMarksRaw > 0 ? maxMarksRaw : 100;

    try {
        const teacher = await Teacher.findById(teacherId);
        if (!teacher) {
            return res.status(404).send("Teacher not found");
        }

        const marksData = await Mark.getTeacherMarksPage(teacher.className, {
            selectedSubject,
            assessmentType,
            assessmentTitle
        });

        res.render("teacher-marks", {
            pageTitle: "Teacher Marks Upload | Smart School",
            marksPage: {
                teacherId,
                teacherName: teacher.fullName,
                className: teacher.className,
                today: getTodayLabel(),
                selectedSubject,
                assessmentType,
                assessmentTitle,
                assessmentDate,
                maxMarks,
                students: marksData.students.map((student) => ({
                    student_name: student.studentName,
                    roll_number: student.rollNumber,
                    student_id: student.studentId,
                    scored_marks: student.mark ? student.mark.scoredMarks : null,
                    remarks: student.mark ? student.mark.remarks : ""
                })),
                hasExistingMarks: marksData.hasExistingMarks,
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
    const selectedSubject = normalizeText(req.body.subject) || "Mathematics";
    const assessmentType = req.body.assessment_type === "Assignment" ? "Assignment" : "Exam";
    const assessmentTitle = normalizeText(req.body.assessment_title);
    const assessmentDate = getIsoDate(req.body.assessment_date);
    const maxMarksRaw = Number(req.body.max_marks);
    const maxMarks = Number.isFinite(maxMarksRaw) && maxMarksRaw > 0 ? maxMarksRaw : 100;

    try {
        if (!assessmentTitle) {
            return res.redirect(
                `/teachers/marks?teacher_id=${teacherId}&subject=${encodeURIComponent(selectedSubject)}&assessment_type=${encodeURIComponent(assessmentType)}&assessment_date=${assessmentDate}&max_marks=${maxMarks}&saved=missing_title`
            );
        }

        const teacher = await Teacher.findById(teacherId);
        if (!teacher) {
            return res.status(404).send("Teacher not found");
        }

        const savedState = await Mark.saveTeacherMarks(teacher.className, {
            selectedSubject,
            assessmentType,
            assessmentTitle,
            assessmentDate,
            maxMarks
        }, req.body);

        res.redirect(
            `/teachers/marks?teacher_id=${teacherId}&subject=${encodeURIComponent(selectedSubject)}&assessment_type=${encodeURIComponent(assessmentType)}&assessment_title=${encodeURIComponent(assessmentTitle)}&assessment_date=${assessmentDate}&max_marks=${maxMarks}&saved=${savedState}`
        );
    } catch (error) {
        console.error(error);
        res.status(500).send("Could not save marks.");
    }
});

app.get("/students/dashboard", requireLogin, async (req, res) => {
    const studentId = req.session.relatedId || Number(req.query.student_id) || 1;

    try {
        const dashboardData = await Student.getDashboardData(studentId);
        if (!dashboardData) {
            return res.status(404).send("Student not found");
        }

        const marksPreview = await Mark.getStudentMarksPreview(studentId);
        const announcements = await Announcement.listForClass(dashboardData.student.className);

        res.render("student-dashboard", {
            pageTitle: "Student Dashboard | Smart School",
            dashboard: {
                studentName: dashboardData.student.fullName,
                className: dashboardData.student.className,
                rollNumber: dashboardData.student.rollNumber,
                today: getTodayLabel(),
                stats: dashboardData.stats,
                periods: dashboardData.periods,
                studentId,
                assignments: dashboardData.assignments,
                marksPreview: marksPreview.map((mark) => ({
                    title: mark.assessmentTitle,
                    subject: mark.subjectName,
                    score: mark.scoredMarks,
                    maxMarks: mark.maxMarks
                })),
                announcements,
                notices: dashboardData.notices
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).send("Could not load student dashboard.");
    }
});

app.get("/students/profile", requireLogin, async (req, res) => {
    const studentId = req.session.relatedId || Number(req.query.student_id) || 1;

    try {
        const student = await Student.getProfile(studentId);
        if (!student) {
            return res.status(404).send("Student not found");
        }

        res.render("student-profile", {
            pageTitle: "Student Profile | Smart School",
            profileMessage: getProfileMessage(req.query),
            profile: {
                studentId,
                studentName: student.fullName,
                email: student.email,
                className: student.className,
                rollNumber: student.rollNumber,
                phone: student.phone,
                about: student.about
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).send("Could not load student profile.");
    }
});

app.post("/students/profile", requireLogin, async (req, res) => {
    const studentId = req.session.relatedId || Number(req.body.student_id) || 1;
    const fullName = normalizeText(req.body.full_name);
    const email = normalizeText(req.body.email).toLowerCase();
    const className = normalizeText(req.body.class_name);
    const rollNumber = normalizeText(req.body.roll_number);
    const phone = normalizeText(req.body.phone);
    const about = normalizeText(req.body.about);
    const profileUrl = `/students/profile?student_id=${studentId}`;

    try {
        if (!fullName || !email || !className) {
            return res.redirect(`${profileUrl}&error=missing_profile_fields`);
        }

        const duplicateEmail = await Student.emailExistsForOther(email, studentId);
        if (duplicateEmail) {
            return res.redirect(`${profileUrl}&error=duplicate_email`);
        }

        await Student.updateProfile(studentId, {
            fullName,
            email,
            className,
            rollNumber,
            phone,
            about
        });

        if (req.session.relatedId === studentId && req.session.role === "student") {
            req.session.fullName = fullName;
        }

        res.redirect(`${profileUrl}&saved=updated`);
    } catch (error) {
        console.error(error);
        res.status(500).send("Could not update student profile.");
    }
});

app.post("/students/password", requireLogin, async (req, res) => {
    const studentId = req.session.relatedId || Number(req.body.student_id) || 1;
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
    const studentId = req.session.relatedId || Number(req.query.student_id) || 1;

    try {
        const attendanceData = await Student.getAttendancePageData(studentId);
        if (!attendanceData) {
            return res.status(404).send("Student not found");
        }

        res.render("student-attendance", {
            pageTitle: "Student Attendance | Smart School",
            attendancePage: {
                studentId,
                studentName: attendanceData.student.fullName,
                className: attendanceData.student.className,
                rollNumber: attendanceData.student.rollNumber,
                today: getTodayLabel(),
                attendance: attendanceData.attendance
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).send("Could not load student attendance.");
    }
});

app.get("/students/announcements", requireLogin, async (req, res) => {
    const studentId = req.session.relatedId || Number(req.query.student_id) || 1;

    try {
        const student = await Student.findById(studentId);
        if (!student) {
            return res.status(404).send("Student not found");
        }

        const announcements = await Announcement.listForClass(student.className);
        res.render("student-announcements", {
            pageTitle: "Student Announcements | Smart School",
            announcementPage: {
                studentId,
                studentName: student.fullName,
                className: student.className,
                rollNumber: student.rollNumber,
                today: getTodayLabel(),
                announcements
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).send("Could not load announcements.");
    }
});

app.get("/students/marks", requireLogin, async (req, res) => {
    const studentId = req.session.relatedId || Number(req.query.student_id) || 1;

    try {
        const student = await Student.findById(studentId);
        if (!student) {
            return res.status(404).send("Student not found");
        }

        const marks = await Mark.getStudentMarks(studentId);
        res.render("student-marks", {
            pageTitle: "Student Marks | Smart School",
            marksPage: {
                studentId,
                studentName: student.fullName,
                className: student.className,
                rollNumber: student.rollNumber,
                today: getTodayLabel(),
                marks: marks.map((mark) => ({
                    subject: mark.subjectName,
                    assessmentType: mark.assessmentType,
                    title: mark.assessmentTitle,
                    assessmentDate: mark.assessmentDate,
                    score: mark.scoredMarks,
                    maxMarks: mark.maxMarks,
                    remarks: mark.remarks
                }))
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).send("Could not load student marks.");
    }
});

app.get("/students/performance", requireLogin, async (req, res) => {
    const studentId = req.session.relatedId || Number(req.query.student_id) || 1;

    try {
        const student = await Student.findById(studentId);
        if (!student) {
            return res.status(404).send("Student not found");
        }

        const performanceData = await Mark.getStudentPerformance(studentId);
        res.render("student-performance", {
            pageTitle: "Student Performance | Smart School",
            performancePage: {
                studentId,
                studentName: student.fullName,
                className: student.className,
                rollNumber: student.rollNumber,
                today: getTodayLabel(),
                rows: performanceData.rows,
                summary: performanceData.summary
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).send("Could not load student performance.");
    }
});

app.get("/students/timetable", requireLogin, async (req, res) => {
    const studentId = req.session.relatedId || Number(req.query.student_id) || 1;

    try {
        const timetableData = await Student.getTimetablePageData(studentId);
        if (!timetableData) {
            return res.status(404).send("Student not found");
        }

        res.render("student-timetable", {
            pageTitle: "Student Timetable | Smart School",
            timetablePage: {
                studentId,
                studentName: timetableData.student.fullName,
                className: timetableData.student.className,
                rollNumber: timetableData.student.rollNumber,
                today: getTodayLabel(),
                periods: timetableData.periods
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).send("Could not load student timetable.");
    }
});

app.get("/db_test", (req, res) => {
    db.query("select * from test_table").then((results) => {
        console.log(results);
        res.send(results);
    });
});

app.get("/goodbye", (req, res) => {
    res.send("Goodbye world!");
});

app.get("/hello/:name", (req, res) => {
    console.log(req.params);
    res.send(`Hello ${req.params.name}`);
});

app.listen(3000, () => {
    console.log("Server running at http://127.0.0.1:3000/");
});

module.exports = app;

const db = require("../services/db");

class Student {
    id;
    fullName;
    email;
    className;
    rollNumber;
    phone;
    about;

    constructor({
        id = null,
        fullName = "",
        email = "",
        className = "",
        rollNumber = "",
        phone = "",
        about = ""
    }) {
        this.id = id;
        this.fullName = fullName;
        this.email = email;
        this.className = className;
        this.rollNumber = rollNumber;
        this.phone = phone;
        this.about = about;
    }

    static normalizeText(value) {
        return typeof value === "string" ? value.trim() : "";
    }

    static buildFromRow(row) {
        if (!row) {
            return null;
        }

        return new Student({
            id: row.id,
            fullName: row.full_name,
            email: row.email,
            className: row.class_name,
            rollNumber: row.roll_number,
            phone: row.phone,
            about: row.about
        });
    }

    static async ensureRoleRecord(details) {
        const email = Student.normalizeText(details.email).toLowerCase();
        const existingStudents = await db.query(
            "SELECT id FROM students WHERE email = ? LIMIT 1",
            [email]
        );

        if (existingStudents[0]) {
            return existingStudents[0].id;
        }

        const result = await db.query(
            "INSERT INTO students (full_name, email, class_name, roll_number) VALUES (?, ?, ?, ?)",
            [
                Student.normalizeText(details.fullName),
                email,
                Student.normalizeText(details.className),
                Student.normalizeText(details.rollNumber)
            ]
        );

        return result.insertId;
    }

    static async findById(id) {
        const rows = await db.query(
            "SELECT id, full_name, email, class_name, roll_number FROM students WHERE id = ? LIMIT 1",
            [id]
        );

        return Student.buildFromRow(rows[0]);
    }

    static async getProfile(id) {
        const rows = await db.query(
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
            [id]
        );

        return Student.buildFromRow(rows[0]);
    }

    static async emailExistsForOther(email, studentId) {
        const normalizedEmail = Student.normalizeText(email).toLowerCase();
        const studentEmailRows = await db.query(
            "SELECT id FROM students WHERE email = ? AND id <> ? LIMIT 1",
            [normalizedEmail, studentId]
        );
        const userEmailRows = await db.query(
            `SELECT id
             FROM Users
             WHERE email = ?
               AND NOT (role = 'student' AND related_id = ?)
             LIMIT 1`,
            [normalizedEmail, studentId]
        );

        return Boolean(studentEmailRows[0] || userEmailRows[0]);
    }

    static async updateProfile(studentId, details) {
        const fullName = Student.normalizeText(details.fullName);
        const email = Student.normalizeText(details.email).toLowerCase();
        const className = Student.normalizeText(details.className);
        const rollNumber = Student.normalizeText(details.rollNumber);
        const phone = Student.normalizeText(details.phone);
        const about = Student.normalizeText(details.about);

        await db.query(
            "UPDATE students SET full_name = ?, email = ?, class_name = ?, roll_number = ? WHERE id = ?",
            [fullName, email, className, rollNumber, studentId]
        );
        await db.query(
            `UPDATE Users
             SET full_name = ?, email = ?, class_name = ?, roll_number = ?, phone = ?, about = ?
             WHERE role = 'student'
               AND related_id = ?`,
            [fullName, email, className, rollNumber, phone || null, about || null, studentId]
        );
    }

    static async getDashboardData(studentId) {
        const student = await Student.findById(studentId);
        if (!student) {
            return null;
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

        return {
            student,
            stats,
            periods,
            assignments,
            notices: notices.map((row) => row.notice_text)
        };
    }

    static async getAttendancePageData(studentId) {
        const student = await Student.findById(studentId);
        if (!student) {
            return null;
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

        return {
            student,
            attendance
        };
    }

    static async getAttendanceReportData(studentId) {
        const student = await Student.findById(studentId);
        if (!student) {
            return null;
        }

        const summaryRows = await db.query(
            `SELECT
                COUNT(id) AS total_days,
                SUM(CASE WHEN status_label = 'Present' THEN 1 ELSE 0 END) AS present_count,
                SUM(CASE WHEN status_label = 'Late' THEN 1 ELSE 0 END) AS late_count,
                SUM(CASE WHEN status_label = 'Absent' THEN 1 ELSE 0 END) AS absent_count
             FROM student_attendance
             WHERE student_id = ?`,
            [studentId]
        );
        const subjectRows = await db.query(
            `SELECT
                subject_name AS subject,
                COUNT(id) AS total_days,
                SUM(CASE WHEN status_label = 'Present' THEN 1 ELSE 0 END) AS present_count,
                SUM(CASE WHEN status_label = 'Late' THEN 1 ELSE 0 END) AS late_count,
                SUM(CASE WHEN status_label = 'Absent' THEN 1 ELSE 0 END) AS absent_count
             FROM student_attendance
             WHERE student_id = ?
             GROUP BY subject_name
             ORDER BY subject_name ASC`,
            [studentId]
        );

        const summary = summaryRows[0] || {
            total_days: 0,
            present_count: 0,
            late_count: 0,
            absent_count: 0
        };
        const totalDays = Number(summary.total_days) || 0;
        const presentCount = Number(summary.present_count) || 0;
        const lateCount = Number(summary.late_count) || 0;
        const absentCount = Number(summary.absent_count) || 0;

        return {
            student,
            summary: {
                totalDays,
                presentCount,
                lateCount,
                absentCount,
                attendanceRate: totalDays
                    ? `${Math.round(((presentCount + lateCount) / totalDays) * 100)}%`
                    : "0%"
            },
            rows: subjectRows.map((row) => {
                const subjectTotal = Number(row.total_days) || 0;
                const subjectPresent = Number(row.present_count) || 0;
                const subjectLate = Number(row.late_count) || 0;
                const subjectAbsent = Number(row.absent_count) || 0;

                return {
                    subject: row.subject,
                    totalDays: subjectTotal,
                    presentCount: subjectPresent,
                    lateCount: subjectLate,
                    absentCount: subjectAbsent,
                    attendanceRate: subjectTotal
                        ? `${Math.round(((subjectPresent + subjectLate) / subjectTotal) * 100)}%`
                        : "0%"
                };
            })
        };
    }

    static async getTimetablePageData(studentId) {
        const student = await Student.findById(studentId);
        if (!student) {
            return null;
        }

        const periods = await db.query(
            `SELECT
                CONCAT(TIME_FORMAT(start_time, '%H:%i') , ' - ', TIME_FORMAT(end_time, '%H:%i')) AS time,
                subject_name AS subject,
                room_name AS room,
                status_label AS status
             FROM student_schedule
             WHERE student_id = ?
             ORDER BY sort_order, start_time, id`,
            [studentId]
        );

        return {
            student,
            periods
        };
    }
}

module.exports = {
    Student
};

const db = require("../services/db");

class Teacher {
    id;
    fullName;
    email;
    className;
    phone;
    about;

    constructor({
        id = null,
        fullName = "",
        email = "",
        className = "",
        phone = "",
        about = ""
    }) {
        this.id = id;
        this.fullName = fullName;
        this.email = email;
        this.className = className;
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

        return new Teacher({
            id: row.id,
            fullName: row.full_name,
            email: row.email,
            className: row.class_name,
            phone: row.phone,
            about: row.about
        });
    }

    static async ensureRoleRecord(details) {
        const email = Teacher.normalizeText(details.email).toLowerCase();
        const existingTeachers = await db.query(
            "SELECT id FROM teachers WHERE email = ? LIMIT 1",
            [email]
        );

        if (existingTeachers[0]) {
            return existingTeachers[0].id;
        }

        const result = await db.query(
            "INSERT INTO teachers (full_name, email, class_name) VALUES (?, ?, ?)",
            [
                Teacher.normalizeText(details.fullName),
                email,
                Teacher.normalizeText(details.className)
            ]
        );

        return result.insertId;
    }

    static async findById(id) {
        const rows = await db.query(
            "SELECT id, full_name, email, class_name FROM teachers WHERE id = ? LIMIT 1",
            [id]
        );

        return Teacher.buildFromRow(rows[0]);
    }

    static async getProfile(id) {
        const rows = await db.query(
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
            [id]
        );

        return Teacher.buildFromRow(rows[0]);
    }

    static async emailExistsForOther(email, teacherId) {
        const normalizedEmail = Teacher.normalizeText(email).toLowerCase();
        const teacherEmailRows = await db.query(
            "SELECT id FROM teachers WHERE email = ? AND id <> ? LIMIT 1",
            [normalizedEmail, teacherId]
        );
        const userEmailRows = await db.query(
            `SELECT id
             FROM Users
             WHERE email = ?
               AND NOT (role = 'teacher' AND related_id = ?)
             LIMIT 1`,
            [normalizedEmail, teacherId]
        );

        return Boolean(teacherEmailRows[0] || userEmailRows[0]);
    }

    static async updateProfile(teacherId, details) {
        const fullName = Teacher.normalizeText(details.fullName);
        const email = Teacher.normalizeText(details.email).toLowerCase();
        const className = Teacher.normalizeText(details.className);
        const phone = Teacher.normalizeText(details.phone);
        const about = Teacher.normalizeText(details.about);

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
    }

    static async getDashboardData(teacherId) {
        const teacher = await Teacher.findById(teacherId);
        if (!teacher) {
            return null;
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

        return {
            teacher,
            stats,
            periods,
            todos: todoRows.map((row) => row.task_text),
            doneTodos: todoRows.filter((row) => row.is_done === 1).map((row) => row.task_text),
            notices: notices.map((row) => row.notice_text)
        };
    }

    static async getAttendancePageData(teacherId, selectedDate, selectedSubject) {
        const teacher = await Teacher.findById(teacherId);
        if (!teacher) {
            return null;
        }

        const students = await db.query(
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
            [selectedDate, selectedSubject, teacher.className]
        );

        return {
            teacher,
            students,
            hasExistingAttendance: students.some((student) => Boolean(student.attendance_id))
        };
    }

    static async saveAttendance(teacherId, selectedDate, selectedSubject, body) {
        const teacher = await Teacher.findById(teacherId);
        if (!teacher) {
            return null;
        }

        const students = await db.query(
            "SELECT id FROM students WHERE class_name = ? ORDER BY roll_number ASC",
            [teacher.className]
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
            [selectedDate, selectedSubject, teacher.className]
        );

        for (const student of students) {
            const status = body[`status_${student.id}`];
            const remarksValue = body[`remarks_${student.id}`];
            const remarks = Teacher.normalizeText(remarksValue);

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

        return {
            teacher,
            savedState: existingAttendance.length > 0 ? "updated" : "created"
        };
    }

    static async getAttendanceReport(teacherId, startDate, endDate, selectedSubject) {
        const teacher = await Teacher.findById(teacherId);
        if (!teacher) {
            return null;
        }

        const reportParams = [startDate, endDate, teacher.className];
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

            return {
                ...row,
                totalDays,
                presentCount,
                lateCount,
                absentCount,
                participationRate: totalDays
                    ? `${Math.round(((presentCount + lateCount) / totalDays) * 100)}%`
                    : "0%"
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

        return {
            teacher,
            rows,
            summary: {
                ...summary,
                participationRate: summary.totalDays
                    ? `${Math.round(((summary.presentCount + summary.lateCount) / summary.totalDays) * 100)}%`
                    : "0%"
            }
        };
    }

    static async getTimetablePageData(teacherId) {
        const teacher = await Teacher.findById(teacherId);
        if (!teacher) {
            return null;
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

        return {
            teacher,
            periods
        };
    }

    static async saveTimetableEntry(teacherId, period) {
        const teacher = await Teacher.findById(teacherId);
        if (!teacher) {
            return null;
        }

        if (period.periodId) {
            await db.query(
                `UPDATE teacher_schedule
                 SET start_time = ?, end_time = ?, subject_name = ?, room_name = ?, status_label = ?, sort_order = ?
                 WHERE id = ? AND teacher_id = ?`,
                [
                    period.startTime,
                    period.endTime,
                    period.subjectName,
                    period.roomName,
                    period.statusLabel,
                    period.sortOrder,
                    period.periodId,
                    teacherId
                ]
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
                [
                    teacherId,
                    period.startTime,
                    period.endTime,
                    period.subjectName,
                    period.roomName,
                    period.statusLabel,
                    period.sortOrder
                ]
            );
        }

        await Teacher.syncStudentScheduleForClass(teacher.className, teacherId);

        return {
            teacher,
            savedState: period.periodId ? "updated" : "created"
        };
    }

    static async deleteTimetableEntry(teacherId, periodId) {
        const teacher = await Teacher.findById(teacherId);
        if (!teacher) {
            return null;
        }

        await db.query(
            "DELETE FROM teacher_schedule WHERE id = ? AND teacher_id = ?",
            [periodId, teacherId]
        );
        await Teacher.syncStudentScheduleForClass(teacher.className, teacherId);

        return teacher;
    }

    static async syncStudentScheduleForClass(className, teacherId) {
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
}

module.exports = {
    Teacher
};

const db = require("../services/db");

let marksTableReady = false;

class Mark {
    id;
    studentId;
    subjectName;
    assessmentType;
    assessmentTitle;
    assessmentDate;
    maxMarks;
    scoredMarks;
    remarks;

    constructor({
        id = null,
        studentId = null,
        subjectName = "",
        assessmentType = "",
        assessmentTitle = "",
        assessmentDate = "",
        maxMarks = 0,
        scoredMarks = 0,
        remarks = ""
    }) {
        this.id = id;
        this.studentId = studentId;
        this.subjectName = subjectName;
        this.assessmentType = assessmentType;
        this.assessmentTitle = assessmentTitle;
        this.assessmentDate = assessmentDate;
        this.maxMarks = maxMarks;
        this.scoredMarks = scoredMarks;
        this.remarks = remarks;
    }

    static normalizeText(value) {
        return typeof value === "string" ? value.trim() : "";
    }

    static buildFromRow(row) {
        if (!row) {
            return null;
        }

        return new Mark({
            id: row.id,
            studentId: row.student_id,
            subjectName: row.subject_name || row.subject,
            assessmentType: row.assessment_type || row.assessmentType,
            assessmentTitle: row.assessment_title || row.title,
            assessmentDate: row.assessmentDate || row.assessment_date || "",
            maxMarks: row.max_marks ?? row.maxMarks ?? 0,
            scoredMarks: row.scored_marks ?? row.score ?? 0,
            remarks: row.remarks || ""
        });
    }

    static formatAssessmentDate(value) {
        return new Date(value).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric"
        });
    }

    static async ensureTable() {
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

    static async getTeacherMarksPage(className, filters) {
        await Mark.ensureTable();

        const rows = await db.query(
            `SELECT
                s.full_name AS student_name,
                s.id AS student_id,
                s.roll_number,
                sm.id,
                sm.student_id,
                sm.subject_name,
                sm.assessment_type,
                sm.assessment_title,
                DATE_FORMAT(sm.assessment_date, '%b %e, %Y') AS assessmentDate,
                sm.max_marks,
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
            [filters.selectedSubject, filters.assessmentType, filters.assessmentTitle, className]
        );

        const students = rows.map((row) => ({
            studentName: row.student_name,
            studentId: row.student_id,
            rollNumber: row.roll_number,
            mark: Mark.buildFromRow(row)
        }));

        return {
            students,
            hasExistingMarks: Boolean(filters.assessmentTitle) && students.some((student) => Boolean(student.mark))
        };
    }

    static async saveTeacherMarks(className, filters, body) {
        await Mark.ensureTable();

        const students = await db.query(
            "SELECT id FROM students WHERE class_name = ? ORDER BY roll_number ASC",
            [className]
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
            [filters.selectedSubject, filters.assessmentType, filters.assessmentTitle, className]
        );

        for (const student of students) {
            const scoreRaw = body[`score_${student.id}`];
            const remarks = Mark.normalizeText(body[`remarks_${student.id}`]);

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
                    Mark.normalizeText(filters.selectedSubject),
                    Mark.normalizeText(filters.assessmentType),
                    Mark.normalizeText(filters.assessmentTitle),
                    filters.assessmentDate,
                    filters.maxMarks,
                    scoredMarks,
                    remarks || null
                ]
            );
        }

        return existingMarks.length > 0 ? "updated" : "created";
    }

    static async getTeacherPerformanceReport(className, selectedSubject, selectedAssessmentType) {
        await Mark.ensureTable();

        const reportParams = [className];
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

            reportRows.push({
                studentId: row.student_id,
                studentName: row.student_name,
                rollNumber: row.roll_number,
                assessmentsCount: Number(row.assessments_count) || 0,
                averagePercent: avg === null ? "-" : `${avg}%`,
                latestPercent: latest === null ? "-" : `${latest}%`,
                performanceBand: avg === null
                    ? "No Data"
                    : avg >= 85
                        ? "Excellent"
                        : avg >= 70
                            ? "Good"
                            : avg >= 50
                                ? "Needs Support"
                                : "At Risk",
                latestAssessmentDate: latestRow[0]?.assessment_date
                    ? Mark.formatAssessmentDate(latestRow[0].assessment_date)
                    : "-",
                averagePercentValue: avg
            });
        }

        const completedReports = reportRows.filter((row) => row.assessmentsCount > 0).length;
        const classAverageRaw = reportRows
            .filter((row) => row.averagePercentValue !== null)
            .reduce((sum, row, _, arr) => sum + row.averagePercentValue / arr.length, 0);

        return {
            rows: reportRows,
            summary: {
                totalStudents: reportRows.length,
                completedReports,
                classAverage: completedReports ? `${Math.round(classAverageRaw)}%` : "0%",
                highPerformers: reportRows.filter((row) => row.performanceBand === "Excellent").length
            }
        };
    }

    static async getStudentMarks(studentId) {
        await Mark.ensureTable();

        const rows = await db.query(
            `SELECT
                id,
                student_id,
                subject_name,
                assessment_type,
                assessment_title,
                DATE_FORMAT(assessment_date, '%b %e, %Y') AS assessmentDate,
                max_marks,
                scored_marks,
                remarks
             FROM student_marks
             WHERE student_id = ?
             ORDER BY assessment_date DESC, id DESC`,
            [studentId]
        );

        return rows.map((row) => Mark.buildFromRow(row));
    }

    static async getStudentMarksPreview(studentId, limit = 4) {
        await Mark.ensureTable();

        const rows = await db.query(
            `SELECT
                id,
                student_id,
                subject_name,
                assessment_type,
                assessment_title,
                DATE_FORMAT(assessment_date, '%b %e, %Y') AS assessmentDate,
                max_marks,
                scored_marks,
                remarks
             FROM student_marks
             WHERE student_id = ?
             ORDER BY assessment_date DESC, id DESC
             LIMIT ${Number(limit) || 4}`,
            [studentId]
        );

        return rows.map((row) => Mark.buildFromRow(row));
    }

    static async getStudentPerformance(studentId) {
        await Mark.ensureTable();

        const subjectRows = await db.query(
            `SELECT
                subject_name AS subject_name,
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

        const rows = subjectRows.map((row) => {
            const average = row.average_percent === null ? null : Number(row.average_percent);
            const best = row.best_percent === null ? null : Number(row.best_percent);

            return {
                subject: row.subject_name,
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

        const summary = summaryRow[0] || { total_assessments: 0, overall_average: null };

        return {
            rows,
            summary: {
                totalAssessments: Number(summary.total_assessments) || 0,
                overallAverage: summary.overall_average === null ? "0%" : `${Number(summary.overall_average)}%`,
                strongSubjects: rows.filter((row) => row.progressBand === "Excellent").length
            }
        };
    }
}

module.exports = {
    Mark
};

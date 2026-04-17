const db = require("../services/db");

let announcementTableReady = false;

class Announcement {
    id;
    teacherId;
    className;
    title;
    description;
    category;
    postedOn;

    constructor({
        id = null,
        teacherId = null,
        className = "",
        title = "",
        description = "",
        category = "",
        postedOn = ""
    }) {
        this.id = id;
        this.teacherId = teacherId;
        this.className = className;
        this.title = title;
        this.description = description;
        this.category = category;
        this.postedOn = postedOn;
    }

    static normalizeText(value) {
        return typeof value === "string" ? value.trim() : "";
    }

    static buildFromRow(row) {
        if (!row) {
            return null;
        }

        return new Announcement({
            id: row.id,
            teacherId: row.teacher_id,
            className: row.class_name,
            title: row.title,
            description: row.description,
            category: row.category,
            postedOn: row.postedOn || ""
        });
    }

    static async ensureTable() {
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

    static async listByTeacher(teacherId) {
        await Announcement.ensureTable();

        const rows = await db.query(
            `SELECT
                id,
                teacher_id,
                class_name,
                title,
                description,
                category,
                DATE_FORMAT(created_at, '%b %e, %Y') AS postedOn
             FROM announcements
             WHERE teacher_id = ?
             ORDER BY created_at DESC, id DESC`,
            [teacherId]
        );

        return rows.map((row) => Announcement.buildFromRow(row));
    }

    static async create(teacherId, className, announcement) {
        await Announcement.ensureTable();

        const title = Announcement.normalizeText(announcement.title);
        const description = Announcement.normalizeText(announcement.description);
        const category = Announcement.normalizeText(announcement.category);
        const normalizedClassName = Announcement.normalizeText(className);

        const result = await db.query(
            `INSERT INTO announcements (teacher_id, class_name, title, description, category)
             VALUES (?, ?, ?, ?, ?)`,
            [teacherId, normalizedClassName, title, description, category]
        );

        return new Announcement({
            id: result.insertId,
            teacherId,
            className: normalizedClassName,
            title,
            description,
            category
        });
    }

    static async update(teacherId, announcementId, announcement) {
        await Announcement.ensureTable();

        return db.query(
            `UPDATE announcements
             SET title = ?, description = ?, category = ?
             WHERE id = ?
               AND teacher_id = ?`,
            [
                Announcement.normalizeText(announcement.title),
                Announcement.normalizeText(announcement.description),
                Announcement.normalizeText(announcement.category),
                announcementId,
                teacherId
            ]
        );
    }

    static async delete(teacherId, announcementId) {
        await Announcement.ensureTable();

        return db.query(
            "DELETE FROM announcements WHERE id = ? AND teacher_id = ?",
            [announcementId, teacherId]
        );
    }

    static async listForClass(className, limit = 6) {
        await Announcement.ensureTable();

        const rows = await db.query(
            `SELECT
                id,
                teacher_id,
                class_name,
                title,
                description,
                category,
                DATE_FORMAT(created_at, '%b %e, %Y') AS postedOn
             FROM announcements
             WHERE class_name = ?
             ORDER BY created_at DESC, id DESC
             LIMIT ${Number(limit) || 6}`,
            [Announcement.normalizeText(className)]
        );

        return rows.map((row) => Announcement.buildFromRow(row));
    }
}

module.exports = {
    Announcement
};

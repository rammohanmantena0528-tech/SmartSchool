const bcrypt = require("bcryptjs");
const db = require("../services/db");

class User {
    id;
    fullName;
    email;
    password;
    role;
    className;
    rollNumber;
    phone;
    about;
    relatedId;

    constructor({
        id = null,
        fullName = "",
        email,
        password = null,
        role = "student",
        className = "",
        rollNumber = "",
        phone = "",
        about = "",
        relatedId = null
    }) {
        this.id = id;
        this.fullName = fullName;
        this.email = email;
        this.password = password;
        this.role = role;
        this.className = className;
        this.rollNumber = rollNumber;
        this.phone = phone;
        this.about = about;
        this.relatedId = relatedId;
    }

    static normalizeText(value) {
        return typeof value === "string" ? value.trim() : "";
    }

    static buildFromRow(row) {
        if (!row) {
            return null;
        }

        return new User({
            id: row.id,
            fullName: row.full_name,
            email: row.email,
            password: row.password,
            role: row.role,
            className: row.class_name,
            rollNumber: row.roll_number,
            phone: row.phone,
            about: row.about,
            relatedId: row.related_id
        });
    }

    static async findByEmail(email) {
        const normalizedEmail = User.normalizeText(email).toLowerCase();
        const rows = await db.query(
            `SELECT id, full_name, email, password, role, class_name, roll_number, phone, about, related_id
             FROM Users
             WHERE email = ?
             LIMIT 1`,
            [normalizedEmail]
        );

        return User.buildFromRow(rows[0]);
    }

    static async findById(id) {
        const rows = await db.query(
            `SELECT id, full_name, email, password, role, class_name, roll_number, phone, about, related_id
             FROM Users
             WHERE id = ?
             LIMIT 1`,
            [id]
        );

        return User.buildFromRow(rows[0]);
    }

    static async findTeacherAccount(teacherId) {
        const rows = await db.query(
            `SELECT id, full_name, email, password, role, class_name, roll_number, phone, about, related_id
             FROM Users
             WHERE role = 'teacher'
               AND related_id = ?
             LIMIT 1`,
            [teacherId]
        );

        return User.buildFromRow(rows[0]);
    }

    static async findStudentAccount(studentId) {
        const rows = await db.query(
            `SELECT id, full_name, email, password, role, class_name, roll_number, phone, about, related_id
             FROM Users
             WHERE role = 'student'
               AND related_id = ?
             LIMIT 1`,
            [studentId]
        );

        return User.buildFromRow(rows[0]);
    }

    static async updatePassword(id, password) {
        const passwordHash = await bcrypt.hash(password, 10);

        await db.query(
            "UPDATE Users SET password = ? WHERE id = ?",
            [passwordHash, id]
        );
    }

    static async create(details) {
        const fullName = User.normalizeText(details.fullName);
        const email = User.normalizeText(details.email).toLowerCase();
        const password = details.password;
        const role = User.normalizeText(details.role).toLowerCase();
        const className = User.normalizeText(details.className);
        const rollNumber = User.normalizeText(details.rollNumber);
        const phone = User.normalizeText(details.phone);
        const about = User.normalizeText(details.about);
        const relatedId = details.relatedId ? Number(details.relatedId) : null;
        const passwordHash = await bcrypt.hash(password, 10);

        const result = await db.query(
            `INSERT INTO Users (full_name, email, password, role, class_name, roll_number, phone, about, related_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                fullName,
                email,
                passwordHash,
                role,
                className,
                rollNumber || null,
                phone || null,
                about || null,
                Number.isInteger(relatedId) ? relatedId : null
            ]
        );

        return new User({
            id: result.insertId,
            fullName,
            email,
            role,
            className,
            rollNumber,
            phone,
            about,
            relatedId
        });
    }

    async authenticate(submittedPassword) {
        if (!this.password) {
            return false;
        }

        return bcrypt.compare(submittedPassword, this.password);
    }
}

module.exports = {
    User
};

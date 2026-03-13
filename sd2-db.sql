-- Smart School SQL seed for teacher and student dashboards

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

-- Keep original sample table
DROP TABLE IF EXISTS `test_table`;
CREATE TABLE `test_table` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(512) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT INTO `test_table` (`id`, `name`) VALUES
(1, 'Lisa'),
(2, 'Kimia');

-- Teacher dashboard base tables
DROP TABLE IF EXISTS `teacher_notices`;
DROP TABLE IF EXISTS `teacher_tasks`;
DROP TABLE IF EXISTS `teacher_schedule`;
DROP TABLE IF EXISTS `teacher_stats`;
DROP TABLE IF EXISTS `teachers`;
DROP TABLE IF EXISTS `student_notices`;
DROP TABLE IF EXISTS `student_assignments`;
DROP TABLE IF EXISTS `student_attendance`;
DROP TABLE IF EXISTS `student_schedule`;
DROP TABLE IF EXISTS `student_stats`;
DROP TABLE IF EXISTS `students`;

CREATE TABLE `teachers` (
  `id` int NOT NULL AUTO_INCREMENT,
  `full_name` varchar(120) NOT NULL,
  `email` varchar(120) NOT NULL,
  `class_name` varchar(60) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_teacher_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `students` (
  `id` int NOT NULL AUTO_INCREMENT,
  `full_name` varchar(120) NOT NULL,
  `email` varchar(120) NOT NULL,
  `class_name` varchar(60) NOT NULL,
  `roll_number` varchar(20) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_student_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `teacher_stats` (
  `id` int NOT NULL AUTO_INCREMENT,
  `teacher_id` int NOT NULL,
  `stat_label` varchar(120) NOT NULL,
  `stat_value` varchar(60) NOT NULL,
  `sort_order` int NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `idx_teacher_stats_teacher_id` (`teacher_id`),
  CONSTRAINT `fk_teacher_stats_teacher` FOREIGN KEY (`teacher_id`) REFERENCES `teachers` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `teacher_schedule` (
  `id` int NOT NULL AUTO_INCREMENT,
  `teacher_id` int NOT NULL,
  `start_time` time NOT NULL,
  `end_time` time NOT NULL,
  `subject_name` varchar(120) NOT NULL,
  `room_name` varchar(80) NOT NULL,
  `status_label` varchar(40) NOT NULL,
  `sort_order` int NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `idx_teacher_schedule_teacher_id` (`teacher_id`),
  CONSTRAINT `fk_teacher_schedule_teacher` FOREIGN KEY (`teacher_id`) REFERENCES `teachers` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `teacher_tasks` (
  `id` int NOT NULL AUTO_INCREMENT,
  `teacher_id` int NOT NULL,
  `task_text` varchar(255) NOT NULL,
  `is_done` tinyint(1) NOT NULL DEFAULT 0,
  `sort_order` int NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `idx_teacher_tasks_teacher_id` (`teacher_id`),
  CONSTRAINT `fk_teacher_tasks_teacher` FOREIGN KEY (`teacher_id`) REFERENCES `teachers` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `teacher_notices` (
  `id` int NOT NULL AUTO_INCREMENT,
  `teacher_id` int NOT NULL,
  `notice_text` varchar(255) NOT NULL,
  `notice_date` date NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_teacher_notices_teacher_id` (`teacher_id`),
  CONSTRAINT `fk_teacher_notices_teacher` FOREIGN KEY (`teacher_id`) REFERENCES `teachers` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `student_stats` (
  `id` int NOT NULL AUTO_INCREMENT,
  `student_id` int NOT NULL,
  `stat_label` varchar(120) NOT NULL,
  `stat_value` varchar(60) NOT NULL,
  `sort_order` int NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `idx_student_stats_student_id` (`student_id`),
  CONSTRAINT `fk_student_stats_student` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `student_attendance` (
  `id` int NOT NULL AUTO_INCREMENT,
  `student_id` int NOT NULL,
  `attendance_date` date NOT NULL,
  `subject_name` varchar(120) NOT NULL,
  `status_label` varchar(40) NOT NULL,
  `remarks` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_student_attendance_student_id` (`student_id`),
  KEY `idx_student_attendance_date` (`attendance_date`),
  UNIQUE KEY `uniq_student_attendance_entry` (`student_id`,`attendance_date`,`subject_name`),
  CONSTRAINT `fk_student_attendance_student` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `student_schedule` (
  `id` int NOT NULL AUTO_INCREMENT,
  `student_id` int NOT NULL,
  `start_time` time NOT NULL,
  `end_time` time NOT NULL,
  `subject_name` varchar(120) NOT NULL,
  `room_name` varchar(80) NOT NULL,
  `status_label` varchar(40) NOT NULL,
  `sort_order` int NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `idx_student_schedule_student_id` (`student_id`),
  CONSTRAINT `fk_student_schedule_student` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `student_assignments` (
  `id` int NOT NULL AUTO_INCREMENT,
  `student_id` int NOT NULL,
  `task_title` varchar(255) NOT NULL,
  `subject_name` varchar(120) NOT NULL,
  `due_label` varchar(80) NOT NULL,
  `progress_label` varchar(40) NOT NULL,
  `sort_order` int NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `idx_student_assignments_student_id` (`student_id`),
  CONSTRAINT `fk_student_assignments_student` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `student_notices` (
  `id` int NOT NULL AUTO_INCREMENT,
  `student_id` int NOT NULL,
  `notice_text` varchar(255) NOT NULL,
  `notice_date` date NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_student_notices_student_id` (`student_id`),
  CONSTRAINT `fk_student_notices_student` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Seed data for dashboard
INSERT INTO `teachers` (`id`, `full_name`, `email`, `class_name`) VALUES
(1, 'Ms. Anita Rao', 'anita.rao@smartschool.edu', 'Class 8 - A');

INSERT INTO `students` (`id`, `full_name`, `email`, `class_name`, `roll_number`) VALUES
(1, 'Aarav Sharma', 'aarav.sharma@smartschool.edu', 'Class 8 - A', '8A-12'),
(2, 'Diya Verma', 'diya.verma@smartschool.edu', 'Class 8 - A', '8A-07'),
(3, 'Rohan Iyer', 'rohan.iyer@smartschool.edu', 'Class 8 - A', '8A-18');

INSERT INTO `teacher_stats` (`teacher_id`, `stat_label`, `stat_value`, `sort_order`) VALUES
(1, 'Students Present', '38/40', 1),
(1, 'Assignments Pending', '17', 2),
(1, 'Avg. Class Score', '84%', 3),
(1, 'Notices Today', '3', 4);

INSERT INTO `teacher_schedule` (`teacher_id`, `start_time`, `end_time`, `subject_name`, `room_name`, `status_label`, `sort_order`) VALUES
(1, '08:30:00', '09:15:00', 'Mathematics', 'Room 204', 'Completed', 1),
(1, '09:20:00', '10:05:00', 'Science', 'Lab 2', 'Completed', 2),
(1, '10:25:00', '11:10:00', 'Mathematics', 'Room 204', 'Next', 3),
(1, '11:15:00', '12:00:00', 'Mentor Period', 'Class 8-A', 'Upcoming', 4);

INSERT INTO `teacher_tasks` (`teacher_id`, `task_text`, `is_done`, `sort_order`) VALUES
(1, 'Upload Unit Test marks by 4:00 PM', 0, 1),
(1, 'Share homework circular for tomorrow', 0, 2),
(1, 'Review attendance exceptions from Class 8-A', 1, 3);

INSERT INTO `teacher_notices` (`teacher_id`, `notice_text`, `notice_date`) VALUES
(1, 'PTA meeting scheduled for Friday at 10:00 AM.', '2026-03-12'),
(1, 'Science lab maintenance from 1:00 PM to 2:00 PM.', '2026-03-12'),
(1, 'Submit activity photos before end of day.', '2026-03-11');

INSERT INTO `student_stats` (`student_id`, `stat_label`, `stat_value`, `sort_order`) VALUES
(1, 'Attendance', '94%', 1),
(1, 'Assignments Due', '3', 2),
(1, 'Average Score', '88%', 3),
(1, 'Unread Notices', '2', 4);

INSERT INTO `student_attendance` (`student_id`, `attendance_date`, `subject_name`, `status_label`, `remarks`) VALUES
(1, '2026-03-13', 'Mathematics', 'Present', 'On time'),
(1, '2026-03-13', 'Science', 'Present', 'Lab session attended'),
(1, '2026-03-12', 'English', 'Late', 'Joined after assembly'),
(1, '2026-03-11', 'Computer Lab', 'Absent', 'Medical leave submitted'),
(2, '2026-03-13', 'Mathematics', 'Present', 'Participated well'),
(2, '2026-03-13', 'Science', 'Late', 'Arrived 10 minutes late'),
(3, '2026-03-13', 'Mathematics', 'Absent', 'Parent informed class teacher'),
(3, '2026-03-13', 'Science', 'Present', 'Joined after first period');

INSERT INTO `student_schedule` (`student_id`, `start_time`, `end_time`, `subject_name`, `room_name`, `status_label`, `sort_order`) VALUES
(1, '08:30:00', '09:15:00', 'Mathematics', 'Room 204', 'Completed', 1),
(1, '09:20:00', '10:05:00', 'Science', 'Lab 2', 'Completed', 2),
(1, '10:25:00', '11:10:00', 'English', 'Room 108', 'Next', 3),
(1, '11:15:00', '12:00:00', 'Computer Lab', 'Lab 1', 'Upcoming', 4);

INSERT INTO `student_assignments` (`student_id`, `task_title`, `subject_name`, `due_label`, `progress_label`, `sort_order`) VALUES
(1, 'Complete algebra worksheet 6B', 'Mathematics', 'Due Today', 'In Progress', 1),
(1, 'Prepare lab record for acids and bases', 'Science', 'Due Tomorrow', 'Pending', 2),
(1, 'Read Chapter 4 and write summary', 'English', 'Due Monday', 'Submitted', 3);

INSERT INTO `student_notices` (`student_id`, `notice_text`, `notice_date`) VALUES
(1, 'Bring geometry box for the math activity period tomorrow.', '2026-03-12'),
(1, 'Basketball trials begin on Saturday at 8:00 AM.', '2026-03-12'),
(1, 'Library books due this week must be renewed by Friday.', '2026-03-11');

COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;

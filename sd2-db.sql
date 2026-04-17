-- phpMyAdmin SQL Dump
-- version 5.2.3
-- https://www.phpmyadmin.net/
--
-- Host: db
-- Generation Time: Apr 17, 2026 at 09:07 AM
-- Server version: 9.6.0
-- PHP Version: 8.3.26

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `sd2-db`
--

-- --------------------------------------------------------

--
-- Table structure for table `announcements`
--

CREATE TABLE `announcements` (
  `id` int NOT NULL,
  `teacher_id` int NOT NULL,
  `class_name` varchar(60) NOT NULL,
  `title` varchar(160) NOT NULL,
  `description` text NOT NULL,
  `category` varchar(60) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `announcements`
--

INSERT INTO `announcements` (`id`, `teacher_id`, `class_name`, `title`, `description`, `category`, `created_at`) VALUES
(1, 3, '10 A', 'Year 10 maths quiz results available', 'The algebra quiz marks are now available on the portal. Please review your feedback before Monday.', 'Exam', '2026-04-14 08:15:00'),
(2, 3, '10 A', 'Biology practical on Thursday', 'Please bring a lab notebook and a black pen for the cells and microscopy practical this Thursday.', 'Academic', '2026-04-15 07:45:00'),
(3, 3, '10 A', 'History museum trip consent forms', 'Signed consent forms for the Manchester Museum visit must be returned by Friday afternoon.', 'Event', '2026-04-15 12:10:00'),
(4, 3, '10 A', 'Computing homework reminder', 'Complete the spreadsheet formulas worksheet and upload it before 7:00 PM on Sunday.', 'Academic', '2026-04-16 09:00:00'),
(5, 3, '10 A', 'English speaking presentations next week', 'Presentation slots for the persuasive speaking task will begin next Tuesday during period one.', 'General', '2026-04-16 14:20:00');

-- --------------------------------------------------------

--
-- Table structure for table `sessions`
--

CREATE TABLE `sessions` (
  `sid` varchar(128) NOT NULL,
  `session_data` text NOT NULL,
  `expires_at` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `sessions`
--

INSERT INTO `sessions` (`sid`, `session_data`, `expires_at`) VALUES
('UKS001A2-session', '{\"cookie\":{\"originalMaxAge\":86400000,\"expires\":\"2026-04-17T08:00:00.000Z\",\"httpOnly\":true,\"path\":\"/\",\"sameSite\":\"lax\"},\"uid\":3,\"loggedIn\":true,\"role\":\"student\",\"redirectTo\":\"/students/dashboard?student_id=5\",\"relatedId\":5}', '2026-04-17 08:00:00'),
('UKS002B4-session', '{\"cookie\":{\"originalMaxAge\":86400000,\"expires\":\"2026-04-17T08:10:00.000Z\",\"httpOnly\":true,\"path\":\"/\",\"sameSite\":\"lax\"},\"uid\":4,\"loggedIn\":true,\"role\":\"teacher\",\"redirectTo\":\"/teachers/dashboard?teacher_id=3\",\"relatedId\":3}', '2026-04-17 08:10:00'),
('UKS003C6-session', '{\"cookie\":{\"originalMaxAge\":86400000,\"expires\":\"2026-04-17T08:20:00.000Z\",\"httpOnly\":true,\"path\":\"/\",\"sameSite\":\"lax\"},\"uid\":3,\"loggedIn\":true,\"role\":\"student\",\"redirectTo\":\"/students/marks?student_id=5\",\"relatedId\":5}', '2026-04-17 08:20:00'),
('UKS004D8-session', '{\"cookie\":{\"originalMaxAge\":86400000,\"expires\":\"2026-04-17T08:30:00.000Z\",\"httpOnly\":true,\"path\":\"/\",\"sameSite\":\"lax\"},\"uid\":4,\"loggedIn\":true,\"role\":\"teacher\",\"redirectTo\":\"/teachers/announcements?teacher_id=3\",\"relatedId\":3}', '2026-04-17 08:30:00'),
('UKS005E0-session', '{\"cookie\":{\"originalMaxAge\":86400000,\"expires\":\"2026-04-17T08:40:00.000Z\",\"httpOnly\":true,\"path\":\"/\",\"sameSite\":\"lax\"},\"uid\":3,\"loggedIn\":true,\"role\":\"student\",\"redirectTo\":\"/students/timetable?student_id=5\",\"relatedId\":5}', '2026-04-17 08:40:00');

-- --------------------------------------------------------

--
-- Table structure for table `students`
--

CREATE TABLE `students` (
  `id` int NOT NULL,
  `full_name` varchar(120) NOT NULL,
  `email` varchar(120) NOT NULL,
  `class_name` varchar(60) NOT NULL,
  `roll_number` varchar(20) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `students`
--

INSERT INTO `students` (`id`, `full_name`, `email`, `class_name`, `roll_number`) VALUES
(1, 'Priyanka Khadka', 'priyanka.khadka@greenfieldacademy.co.uk', '10 A', 'A00081894'),
(2, 'Prem Kayat', 'prem.kayat@greenfieldacademy.co.uk', '10 A', 'A00084273'),
(3, 'Hema Madana', 'hema.madana@greenfieldacademy.co.uk', '10 A', 'A00086001'),
(4, 'Sruthi Bhavya Marri', 'sruthi.bhavya.marri@greenfieldacademy.co.uk', '10 A', 'A00089750'),
(5, 'Ram Mohan Mantena', 'student@gmail.com', '10 A', 'A00086700');

-- --------------------------------------------------------

--
-- Table structure for table `student_assignments`
--

CREATE TABLE `student_assignments` (
  `id` int NOT NULL,
  `student_id` int NOT NULL,
  `task_title` varchar(255) NOT NULL,
  `subject_name` varchar(120) NOT NULL,
  `due_label` varchar(80) NOT NULL,
  `progress_label` varchar(40) NOT NULL,
  `sort_order` int NOT NULL DEFAULT '0'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `student_assignments`
--

INSERT INTO `student_assignments` (`id`, `student_id`, `task_title`, `subject_name`, `due_label`, `progress_label`, `sort_order`) VALUES
(1, 5, 'Complete algebra problem set 4', 'Mathematics', 'Due Monday', 'In Progress', 1),
(2, 5, 'Draft a Shakespeare character analysis', 'English', 'Due Tuesday', 'Pending', 2),
(3, 5, 'Revise cell structure practical notes', 'Biology', 'Due Wednesday', 'Submitted', 3),
(4, 5, 'Prepare Industrial Revolution source notes', 'History', 'Due Thursday', 'Pending', 4),
(5, 5, 'Build spreadsheet formulas exercise', 'Computing', 'Due Friday', 'In Progress', 5);

-- --------------------------------------------------------

--
-- Table structure for table `student_attendance`
--

CREATE TABLE `student_attendance` (
  `id` int NOT NULL,
  `student_id` int NOT NULL,
  `attendance_date` date NOT NULL,
  `subject_name` varchar(120) NOT NULL,
  `status_label` varchar(40) NOT NULL,
  `remarks` varchar(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `student_attendance`
--

INSERT INTO `student_attendance` (`id`, `student_id`, `attendance_date`, `subject_name`, `status_label`, `remarks`) VALUES
(1, 5, '2026-04-13', 'Mathematics', 'Present', 'Arrived on time'),
(2, 5, '2026-04-14', 'English', 'Late', 'Reached class after registration'),
(3, 5, '2026-04-15', 'Biology', 'Present', 'Completed lab starter activity'),
(4, 5, '2026-04-16', 'History', 'Absent', 'Medical appointment'),
(5, 5, '2026-04-17', 'Computing', 'Present', 'Participated well in class');

-- --------------------------------------------------------

--
-- Table structure for table `student_marks`
--

CREATE TABLE `student_marks` (
  `id` int NOT NULL,
  `student_id` int NOT NULL,
  `subject_name` varchar(120) NOT NULL,
  `assessment_type` varchar(40) NOT NULL,
  `assessment_title` varchar(160) NOT NULL,
  `assessment_date` date NOT NULL,
  `max_marks` int NOT NULL,
  `scored_marks` decimal(6,2) NOT NULL,
  `remarks` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `student_marks`
--

INSERT INTO `student_marks` (`id`, `student_id`, `subject_name`, `assessment_type`, `assessment_title`, `assessment_date`, `max_marks`, `scored_marks`, `remarks`, `created_at`, `updated_at`) VALUES
(1, 5, 'Mathematics', 'Exam', 'Algebra Quiz', '2026-04-10', 100, 78.00, 'Solid working shown throughout.', '2026-04-10 15:00:00', '2026-04-10 15:00:00'),
(2, 5, 'English', 'Assignment', 'Poetry Response', '2026-04-09', 100, 84.00, 'Good analysis with clear evidence.', '2026-04-09 15:00:00', '2026-04-09 15:00:00'),
(3, 5, 'Biology', 'Exam', 'Cells Test', '2026-04-08', 100, 73.00, 'Revise key terminology for higher marks.', '2026-04-08 15:00:00', '2026-04-08 15:00:00'),
(4, 5, 'History', 'Assignment', 'Tudor Source Essay', '2026-04-11', 100, 88.00, 'Well-structured answer with good context.', '2026-04-11 15:00:00', '2026-04-11 15:00:00'),
(5, 5, 'Computing', 'Exam', 'Spreadsheet Functions Test', '2026-04-12', 100, 91.00, 'Excellent accuracy and method.', '2026-04-12 15:00:00', '2026-04-12 15:00:00');

-- --------------------------------------------------------

--
-- Table structure for table `student_notices`
--

CREATE TABLE `student_notices` (
  `id` int NOT NULL,
  `student_id` int NOT NULL,
  `notice_text` varchar(255) NOT NULL,
  `notice_date` date NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `student_notices`
--

INSERT INTO `student_notices` (`id`, `student_id`, `notice_text`, `notice_date`) VALUES
(1, 5, 'Bring your scientific calculator for Monday''s maths lesson.', '2026-04-13'),
(2, 5, 'The library will stay open until 5:00 PM on Wednesday for revision.', '2026-04-14'),
(3, 5, 'History trip forms must be handed in to reception by Thursday.', '2026-04-15'),
(4, 5, 'Wear PE kit on Friday morning for the inter-form fitness session.', '2026-04-16'),
(5, 5, 'Tutor time on Monday will cover GCSE option guidance.', '2026-04-17');

-- --------------------------------------------------------

--
-- Table structure for table `student_schedule`
--

CREATE TABLE `student_schedule` (
  `id` int NOT NULL,
  `student_id` int NOT NULL,
  `start_time` time NOT NULL,
  `end_time` time NOT NULL,
  `subject_name` varchar(120) NOT NULL,
  `room_name` varchar(80) NOT NULL,
  `status_label` varchar(40) NOT NULL,
  `sort_order` int NOT NULL DEFAULT '0'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `student_schedule`
--

INSERT INTO `student_schedule` (`id`, `student_id`, `start_time`, `end_time`, `subject_name`, `room_name`, `status_label`, `sort_order`) VALUES
(1, 5, '08:45:00', '09:30:00', 'Mathematics', 'Room M2', 'Completed', 1),
(2, 5, '09:35:00', '10:20:00', 'English', 'Room E1', 'Completed', 2),
(3, 5, '10:40:00', '11:25:00', 'Biology', 'Lab B3', 'Next', 3),
(4, 5, '11:30:00', '12:15:00', 'History', 'Room H4', 'Upcoming', 4),
(5, 5, '13:10:00', '13:55:00', 'Computing', 'ICT Suite 2', 'Upcoming', 5);

-- --------------------------------------------------------

--
-- Table structure for table `student_stats`
--

CREATE TABLE `student_stats` (
  `id` int NOT NULL,
  `student_id` int NOT NULL,
  `stat_label` varchar(120) NOT NULL,
  `stat_value` varchar(60) NOT NULL,
  `sort_order` int NOT NULL DEFAULT '0'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `student_stats`
--

INSERT INTO `student_stats` (`id`, `student_id`, `stat_label`, `stat_value`, `sort_order`) VALUES
(1, 5, 'Attendance', '80%', 1),
(2, 5, 'Average Grade', 'B', 2),
(3, 5, 'Assessments Logged', '5', 3),
(4, 5, 'Announcements', '5', 4),
(5, 5, 'Lessons Today', '5', 5);

-- --------------------------------------------------------

--
-- Table structure for table `teachers`
--

CREATE TABLE `teachers` (
  `id` int NOT NULL,
  `full_name` varchar(120) NOT NULL,
  `email` varchar(120) NOT NULL,
  `class_name` varchar(60) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `teachers`
--

INSERT INTO `teachers` (`id`, `full_name`, `email`, `class_name`) VALUES
(1, 'Charlotte Evans', 'charlotte.evans@greenfieldacademy.co.uk', '10 A'),
(2, 'Daniel Brooks', 'daniel.brooks@greenfieldacademy.co.uk', '10 A'),
(3, 'Sruthi Patel', 'teacher@gmail.com', '10 A'),
(4, 'Rebecca Collins', 'rebecca.collins@greenfieldacademy.co.uk', '10 A'),
(5, 'James Turner', 'james.turner@greenfieldacademy.co.uk', '10 A');

-- --------------------------------------------------------

--
-- Table structure for table `teacher_notices`
--

CREATE TABLE `teacher_notices` (
  `id` int NOT NULL,
  `teacher_id` int NOT NULL,
  `notice_text` varchar(255) NOT NULL,
  `notice_date` date NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `teacher_notices`
--

INSERT INTO `teacher_notices` (`id`, `teacher_id`, `notice_text`, `notice_date`) VALUES
(1, 3, 'Department meeting will begin at 3:30 PM in the staff room.', '2026-04-13'),
(2, 3, 'Please upload mock assessment data before Wednesday morning.', '2026-04-14'),
(3, 3, 'ICT Suite 2 is reserved for Year 10 computing after lunch.', '2026-04-15'),
(4, 3, 'Parents'' evening appointment lists have been published.', '2026-04-16'),
(5, 3, 'Cover work packs for Friday must be submitted by noon.', '2026-04-17');

-- --------------------------------------------------------

--
-- Table structure for table `teacher_schedule`
--

CREATE TABLE `teacher_schedule` (
  `id` int NOT NULL,
  `teacher_id` int NOT NULL,
  `start_time` time NOT NULL,
  `end_time` time NOT NULL,
  `subject_name` varchar(120) NOT NULL,
  `room_name` varchar(80) NOT NULL,
  `status_label` varchar(40) NOT NULL,
  `sort_order` int NOT NULL DEFAULT '0'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `teacher_schedule`
--

INSERT INTO `teacher_schedule` (`id`, `teacher_id`, `start_time`, `end_time`, `subject_name`, `room_name`, `status_label`, `sort_order`) VALUES
(1, 3, '08:45:00', '09:30:00', 'Mathematics', 'Room M2', 'Completed', 1),
(2, 3, '09:35:00', '10:20:00', 'English', 'Room E1', 'Completed', 2),
(3, 3, '10:40:00', '11:25:00', 'Biology', 'Lab B3', 'Next', 3),
(4, 3, '11:30:00', '12:15:00', 'History', 'Room H4', 'Upcoming', 4),
(5, 3, '13:10:00', '13:55:00', 'Computing', 'ICT Suite 2', 'Upcoming', 5);

-- --------------------------------------------------------

--
-- Table structure for table `teacher_stats`
--

CREATE TABLE `teacher_stats` (
  `id` int NOT NULL,
  `teacher_id` int NOT NULL,
  `stat_label` varchar(120) NOT NULL,
  `stat_value` varchar(60) NOT NULL,
  `sort_order` int NOT NULL DEFAULT '0'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `teacher_stats`
--

INSERT INTO `teacher_stats` (`id`, `teacher_id`, `stat_label`, `stat_value`, `sort_order`) VALUES
(1, 3, 'Students Present', '24/25', 1),
(2, 3, 'Assignments Marked', '5', 2),
(3, 3, 'Average Class Score', '83%', 3),
(4, 3, 'Announcements Posted', '5', 4),
(5, 3, 'Lessons Today', '5', 5);

-- --------------------------------------------------------

--
-- Table structure for table `teacher_tasks`
--

CREATE TABLE `teacher_tasks` (
  `id` int NOT NULL,
  `teacher_id` int NOT NULL,
  `task_text` varchar(255) NOT NULL,
  `is_done` tinyint(1) NOT NULL DEFAULT '0',
  `sort_order` int NOT NULL DEFAULT '0'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `teacher_tasks`
--

INSERT INTO `teacher_tasks` (`id`, `teacher_id`, `task_text`, `is_done`, `sort_order`) VALUES
(1, 3, 'Upload Year 10 algebra quiz feedback by 4:00 PM', 0, 1),
(2, 3, 'Print biology practical sheets for Thursday', 1, 2),
(3, 3, 'Review absence notes for 10 A registration', 0, 3),
(4, 3, 'Prepare history trip reminder for tutor time', 0, 4),
(5, 3, 'Check computing room booking for next week', 1, 5);

-- --------------------------------------------------------

--
-- Table structure for table `test_table`
--

CREATE TABLE `test_table` (
  `id` int NOT NULL,
  `name` varchar(512) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `test_table`
--

INSERT INTO `test_table` (`id`, `name`) VALUES
(1, 'Harper'),
(2, 'Mason'),
(3, 'Freya'),
(4, 'Archie'),
(5, 'Poppy');

-- --------------------------------------------------------

--
-- Table structure for table `Users`
--

CREATE TABLE `Users` (
  `id` int NOT NULL,
  `full_name` varchar(120) NOT NULL,
  `email` varchar(120) NOT NULL,
  `password` varchar(255) NOT NULL,
  `role` varchar(20) NOT NULL,
  `class_name` varchar(60) DEFAULT NULL,
  `roll_number` varchar(20) DEFAULT NULL,
  `phone` varchar(30) DEFAULT NULL,
  `about` text,
  `related_id` int DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `Users`
--

INSERT INTO `Users` (`id`, `full_name`, `email`, `password`, `role`, `class_name`, `roll_number`, `phone`, `about`, `related_id`) VALUES
(1, 'Priyanka Khadka', 'priyanka.khadka@greenfieldacademy.co.uk', '$2a$10$sG86.ECM0BDXvdSNgjF6ie.A5SKZHM3M8d0OTHIUSSV1iowmeU5QO', 'student', '10 A', 'A00081894', '+447700900101', NULL, 1),
(2, 'Prem Kayat', 'prem.kayat@greenfieldacademy.co.uk', '$2a$10$sG86.ECM0BDXvdSNgjF6ie.A5SKZHM3M8d0OTHIUSSV1iowmeU5QO', 'student', '10 A', 'A00084273', '+447700900102', NULL, 2),
(3, 'Ram Mohan Mantena', 'student@gmail.com', '$2a$10$sG86.ECM0BDXvdSNgjF6ie.A5SKZHM3M8d0OTHIUSSV1iowmeU5QO', 'student', '10 A', 'A00086700', '+447818947678', NULL, 5),
(4, 'sruthi', 'teacher@gmail.com', '$2a$10$jIcfuiDvKfRnFToCLnNl5ueMaR/sReNiacaz6UUKaQDplDA.fe9l6', 'teacher', '10 A', '12345', '+44781894767', NULL, 3),
(5, 'Hema Madana', 'hema.madana@greenfieldacademy.co.uk', '$2a$10$sG86.ECM0BDXvdSNgjF6ie.A5SKZHM3M8d0OTHIUSSV1iowmeU5QO', 'student', '10 A', 'A00086001', '+447700900103', NULL, 3),
(6, 'Sruthi Bhavya Marri', 'sruthi.bhavya.marri@greenfieldacademy.co.uk', '$2a$10$sG86.ECM0BDXvdSNgjF6ie.A5SKZHM3M8d0OTHIUSSV1iowmeU5QO', 'student', '10 A', 'A00089750', '+447700900104', NULL, 4);

--
-- Indexes for dumped tables
--

--
-- Indexes for table `announcements`
--
ALTER TABLE `announcements`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_announcements_teacher_id` (`teacher_id`),
  ADD KEY `idx_announcements_class_name` (`class_name`);

--
-- Indexes for table `sessions`
--
ALTER TABLE `sessions`
  ADD PRIMARY KEY (`sid`),
  ADD KEY `idx_sessions_expires_at` (`expires_at`);

--
-- Indexes for table `students`
--
ALTER TABLE `students`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uniq_student_email` (`email`);

--
-- Indexes for table `student_assignments`
--
ALTER TABLE `student_assignments`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_student_assignments_student_id` (`student_id`);

--
-- Indexes for table `student_attendance`
--
ALTER TABLE `student_attendance`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uniq_student_attendance_entry` (`student_id`,`attendance_date`,`subject_name`),
  ADD KEY `idx_student_attendance_student_id` (`student_id`),
  ADD KEY `idx_student_attendance_date` (`attendance_date`);

--
-- Indexes for table `student_marks`
--
ALTER TABLE `student_marks`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uniq_student_marks_entry` (`student_id`,`subject_name`,`assessment_type`,`assessment_title`),
  ADD KEY `idx_student_marks_student_id` (`student_id`),
  ADD KEY `idx_student_marks_date` (`assessment_date`);

--
-- Indexes for table `student_notices`
--
ALTER TABLE `student_notices`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_student_notices_student_id` (`student_id`);

--
-- Indexes for table `student_schedule`
--
ALTER TABLE `student_schedule`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_student_schedule_student_id` (`student_id`);

--
-- Indexes for table `student_stats`
--
ALTER TABLE `student_stats`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_student_stats_student_id` (`student_id`);

--
-- Indexes for table `teachers`
--
ALTER TABLE `teachers`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uniq_teacher_email` (`email`);

--
-- Indexes for table `teacher_notices`
--
ALTER TABLE `teacher_notices`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_teacher_notices_teacher_id` (`teacher_id`);

--
-- Indexes for table `teacher_schedule`
--
ALTER TABLE `teacher_schedule`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_teacher_schedule_teacher_id` (`teacher_id`);

--
-- Indexes for table `teacher_stats`
--
ALTER TABLE `teacher_stats`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_teacher_stats_teacher_id` (`teacher_id`);

--
-- Indexes for table `teacher_tasks`
--
ALTER TABLE `teacher_tasks`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_teacher_tasks_teacher_id` (`teacher_id`);

--
-- Indexes for table `test_table`
--
ALTER TABLE `test_table`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `Users`
--
ALTER TABLE `Users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uniq_users_email` (`email`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `announcements`
--
ALTER TABLE `announcements`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT for table `students`
--
ALTER TABLE `students`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT for table `student_assignments`
--
ALTER TABLE `student_assignments`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT for table `student_attendance`
--
ALTER TABLE `student_attendance`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT for table `student_marks`
--
ALTER TABLE `student_marks`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT for table `student_notices`
--
ALTER TABLE `student_notices`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT for table `student_schedule`
--
ALTER TABLE `student_schedule`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT for table `student_stats`
--
ALTER TABLE `student_stats`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT for table `teachers`
--
ALTER TABLE `teachers`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT for table `teacher_notices`
--
ALTER TABLE `teacher_notices`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT for table `teacher_schedule`
--
ALTER TABLE `teacher_schedule`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT for table `teacher_stats`
--
ALTER TABLE `teacher_stats`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT for table `teacher_tasks`
--
ALTER TABLE `teacher_tasks`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT for table `test_table`
--
ALTER TABLE `test_table`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT for table `Users`
--
ALTER TABLE `Users`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `announcements`
--
ALTER TABLE `announcements`
  ADD CONSTRAINT `fk_announcements_teacher` FOREIGN KEY (`teacher_id`) REFERENCES `teachers` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `student_assignments`
--
ALTER TABLE `student_assignments`
  ADD CONSTRAINT `fk_student_assignments_student` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `student_attendance`
--
ALTER TABLE `student_attendance`
  ADD CONSTRAINT `fk_student_attendance_student` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `student_marks`
--
ALTER TABLE `student_marks`
  ADD CONSTRAINT `fk_student_marks_student` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `student_notices`
--
ALTER TABLE `student_notices`
  ADD CONSTRAINT `fk_student_notices_student` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `student_schedule`
--
ALTER TABLE `student_schedule`
  ADD CONSTRAINT `fk_student_schedule_student` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `student_stats`
--
ALTER TABLE `student_stats`
  ADD CONSTRAINT `fk_student_stats_student` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `teacher_notices`
--
ALTER TABLE `teacher_notices`
  ADD CONSTRAINT `fk_teacher_notices_teacher` FOREIGN KEY (`teacher_id`) REFERENCES `teachers` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `teacher_schedule`
--
ALTER TABLE `teacher_schedule`
  ADD CONSTRAINT `fk_teacher_schedule_teacher` FOREIGN KEY (`teacher_id`) REFERENCES `teachers` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `teacher_stats`
--
ALTER TABLE `teacher_stats`
  ADD CONSTRAINT `fk_teacher_stats_teacher` FOREIGN KEY (`teacher_id`) REFERENCES `teachers` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `teacher_tasks`
--
ALTER TABLE `teacher_tasks`
  ADD CONSTRAINT `fk_teacher_tasks_teacher` FOREIGN KEY (`teacher_id`) REFERENCES `teachers` (`id`) ON DELETE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;

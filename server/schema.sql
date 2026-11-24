-- PostgreSQL Schema & Query Optimization for Cohort Health Metrics Dashboard (PST_AD_055)

-- 1. Cohorts Master Table
CREATE TABLE IF NOT EXISTS cohorts (
    cohort_id SERIAL PRIMARY KEY,
    cohort_name VARCHAR(120) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Students Metrics Table
CREATE TABLE IF NOT EXISTS students (
    student_id VARCHAR(20) PRIMARY KEY,
    cohort_id INT REFERENCES cohorts(cohort_id) ON DELETE CASCADE,
    full_name VARCHAR(100) NOT NULL,
    attendance_percentage NUMERIC(5,2) NOT NULL CHECK (attendance_percentage BETWEEN 0 AND 100),
    submitted_assignments INT NOT NULL CHECK (submitted_assignments >= 0),
    total_assignments INT NOT NULL CHECK (total_assignments > 0),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Week 9 Performance Indexes (Fast filtering on cohort, attendance & student search)
CREATE INDEX IF NOT EXISTS idx_students_cohort_id ON students(cohort_id);
CREATE INDEX IF NOT EXISTS idx_students_attendance ON students(attendance_percentage);
CREATE INDEX IF NOT EXISTS idx_students_full_name ON students(full_name);

-- 4. Optimized Cohort Health Query with Dynamic At-Risk Flagging
SELECT 
    student_id,
    full_name,
    attendance_percentage,
    submitted_assignments,
    total_assignments,
    ROUND((submitted_assignments::DECIMAL / total_assignments) * 100, 0) AS submission_percentage,
    CASE 
        WHEN attendance_percentage < 75 OR ((submitted_assignments::DECIMAL / total_assignments) * 100) < 60 
        THEN 'At Risk'
        ELSE 'On Track'
    END AS status
FROM students
WHERE cohort_id = 1
ORDER BY student_id ASC;
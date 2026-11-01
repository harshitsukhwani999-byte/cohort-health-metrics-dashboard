// Submission percentage calculation formula
export function calculateSubmissionPercentage(submitted, total) {
  if (!total || total === 0) return 0;
  return Math.round((submitted / total) * 100);
}

// PRD At-Risk Rules: Attendance < 75% OR Submission < 60%
export function checkAtRisk(attendancePercentage, submissionPercentage) {
  const reasons = [];
  
  if (attendancePercentage < 75) {
    reasons.push("Attendance below 75%");
  }
  if (submissionPercentage < 60) {
    reasons.push("Submission completion below 60%");
  }

  return {
    isAtRisk: reasons.length > 0,
    reasons: reasons
  };
}


// Function 1: Attendance Percentage Calculate karna
export const calculateAttendancePercentage = (present, eligible) => {
  // Edge Case: Agar total sessions zero hain toh divide-by-zero crash bachane ke liye 0 return karo
  if (!eligible || eligible === 0) return 0;
  
  const percentage = (present / eligible) * 100;
  return Math.round(percentage); // Percentage ko round-off karne ke liye
};

// Function 3: Cohort Average Attendance Calculate karna
export const calculateCohortAverageAttendance = (students) => {
  if (!students || students.length === 0) return 0;

  const totalAttendance = students.reduce((sum, student) => {
    return sum + (student.attendancePercentage || 0);
  }, 0);

  return Math.round(totalAttendance / students.length);
};
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

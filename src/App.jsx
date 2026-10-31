import 'react';
import 'bootstrap/dist/css/bootstrap.min.css';
import cohortData from './data/sampleCohort.json';
import { calculateSubmissionPercentage, checkAtRisk } from './utils/metrics';

function App() {
  const students = cohortData.students;

  // 1. Calculate Summary Metrics
  const totalStudents = students.length;
  const avgAttendance = Math.round(
    students.reduce((acc, curr) => acc + curr.attendancePercentage, 0) / totalStudents
  );

  return (
    <div className="container mt-4">
      {/* Header */}
      <h2 className="mb-4">Cohort Health Metrics Dashboard - {cohortData.cohort.name}</h2>
      
      {/* Summary Cards */}
      <div className="row mb-4">
        <div className="col-md-6">
          <div className="card text-white bg-primary mb-3 shadow-sm">
            <div className="card-body">
              <h5 className="card-title">Total Students</h5>
              <p className="card-text fs-2 fw-bold">{totalStudents}</p>
            </div>
          </div>
        </div>
        <div className="col-md-6">
          <div className="card text-white bg-info mb-3 shadow-sm">
            <div className="card-body">
              <h5 className="card-title">Average Attendance</h5>
              <p className="card-text fs-2 fw-bold">{avgAttendance}%</p>
            </div>
          </div>
        </div>
      </div>

      {/* Student Metrics Table */}
      <h4 className="mb-3">Student Details</h4>
      <div className="table-responsive">
        <table className="table table-bordered table-hover align-middle">
          <thead className="table-dark">
            <tr>
              <th>ID</th>
              <th>Name</th>
              <th>Attendance %</th>
              <th>Submission %</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {students.map((student) => {
              const subPercentage = calculateSubmissionPercentage(
                student.submittedAssignments,
                student.totalAssignments
              );
              const riskInfo = checkAtRisk(student.attendancePercentage, subPercentage);

              return (
                <tr key={student.id}>
                  <td>{student.id}</td>
                  <td>{student.name}</td>
                  <td>{student.attendancePercentage}%</td>
                  <td>{subPercentage}%</td>
                  <td>
                    {riskInfo.isAtRisk ? (
                      <span className="badge bg-danger p-2">
                        At Risk ({riskInfo.reasons.join(', ')})
                      </span>
                    ) : (
                      <span className="badge bg-success p-2">On Track</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default App;
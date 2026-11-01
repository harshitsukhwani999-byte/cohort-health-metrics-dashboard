import 'bootstrap/dist/css/bootstrap.min.css';
import cohortData from './data/samplecohort.json';
import { 
  calculateSubmissionPercentage, 
  calculateCohortAverageAttendance 
} from './utils/metrics';
import './App.css';

function App() {
  const students = cohortData.students;

  // 1. Calculate Summary Metrics
  const totalStudents = students.length;
  const avgAttendance = calculateCohortAverageAttendance(students);

  return (
    <div className="container mt-4">
      <h2 className="mb-4">Cohort Health Metrics Dashboard</h2>

      {/* Summary Cards */}
      <div className="row mb-4">
        <div className="col-md-6">
          <div className="card text-white bg-primary mb-3">
            <div className="card-body">
              <h5 className="card-title">Total Students</h5>
              <p className="card-text display-6">{totalStudents}</p>
            </div>
          </div>
        </div>
        <div className="col-md-6">
          <div className="card text-white bg-success mb-3">
            <div className="card-body">
              <h5 className="card-title">Average Attendance</h5>
              <p className="card-text display-6">{avgAttendance}%</p>
            </div>
          </div>
        </div>
      </div>

      {/* Student Metrics Table */}
      <div className="card">
        <div className="card-header font-weight-bold">Student Progress Details</div>
        <div className="card-body p-0">
          <table className="table table-striped mb-0">
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Attendance %</th>
                <th>Submissions</th>
                <th>Submission %</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {students.map((student) => {
                const subPct = calculateSubmissionPercentage(
                  student.submittedAssignments,
                  student.totalAssignments
                );
                
                // At Risk condition: Attendance < 75% OR Submission < 60%
                const isAtRisk = student.attendancePercentage < 75 || subPct < 60;

                return (
                  <tr key={student.id}>
                    <td>{student.id}</td>
                    <td>{student.name}</td>
                    <td>{student.attendancePercentage}%</td>
                    <td>{student.submittedAssignments} / {student.totalAssignments}</td>
                    <td>{subPct}%</td>
                    <td>
                      {isAtRisk ? (
                        <span className="badge bg-danger">At Risk</span>
                      ) : (
                        <span className="badge bg-success">On Track</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default App;
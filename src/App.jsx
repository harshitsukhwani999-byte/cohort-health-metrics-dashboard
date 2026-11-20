import { useState } from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';
import {
  Chart as ChartJS,
  ArcElement,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
  Title
} from 'chart.js';
import { Doughnut, Bar } from 'react-chartjs-2';
import cohortData from './data/samplecohort.json';
import { 
  calculateSubmissionPercentage, 
  calculateCohortAverageAttendance 
} from './utils/metrics';
import './App.css';

// Register Chart.js components
ChartJS.register(
  ArcElement,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
  Title
);

function App() {
  // Safely extract students array regardless of JSON wrapper
  const students = Array.isArray(cohortData)
    ? cohortData
    : cohortData?.students || [];

  const cohortTitle = cohortData?.cohortName || '2026 Level 2 Core - Cohort Dashboard';

  // States: Role Access (FR-10), Search, Filter, Sort, Details Modal, and Feedback Alert
  const [userRole, setUserRole] = useState('mentor'); // 'mentor' or 'program_lead'
  const [searchQuery, setSearchQuery] = useState('');
  const [showOnlyAtRisk, setShowOnlyAtRisk] = useState(false);
  const [sortOption, setSortOption] = useState('default');
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [feedbackAlert, setFeedbackAlert] = useState(null);

  // 1. Calculate Summary Metrics (FR-02)
  const totalStudents = students.length;
  const avgAttendance = calculateCohortAverageAttendance(students);
  const avgSubmission = totalStudents === 0 
    ? 0 
    : Math.round(
        students.reduce((sum, s) => {
          return sum + calculateSubmissionPercentage(s.submittedAssignments, s.totalAssignments);
        }, 0) / totalStudents
      );

  // Calculate At-Risk vs On-Track counts for Charts & Summary
  let atRiskCount = 0;
  let onTrackCount = 0;
  const attendanceBuckets = [0, 0, 0, 0];

  students.forEach((student) => {
    const subPct = calculateSubmissionPercentage(
      student.submittedAssignments,
      student.totalAssignments
    );
    const isAtRisk = student.attendancePercentage < 75 || subPct < 60;
    if (isAtRisk) {
      atRiskCount++;
    } else {
      onTrackCount++;
    }

    if (student.attendancePercentage < 65) attendanceBuckets[0]++;
    else if (student.attendancePercentage < 75) attendanceBuckets[1]++;
    else if (student.attendancePercentage < 85) attendanceBuckets[2]++;
    else attendanceBuckets[3]++;
  });

  // Chart 1 Data: On-Track vs At-Risk Doughnut Chart
  const riskChartData = {
    labels: ['On Track', 'At Risk'],
    datasets: [
      {
        data: [onTrackCount, atRiskCount],
        backgroundColor: ['#198754', '#dc3545'],
        borderColor: ['#ffffff', '#ffffff'],
        borderWidth: 2,
      },
    ],
  };

  // Chart 2 Data: Attendance Distribution Bar Chart
  const attendanceChartData = {
    labels: ['< 65% (Critical)', '65% - 74% (Warning)', '75% - 84% (Good)', '85%+ (Excellent)'],
    datasets: [
      {
        label: 'Number of Students',
        data: attendanceBuckets,
        backgroundColor: ['#dc3545', '#ffc107', '#0dcaf0', '#198754'],
        borderRadius: 6,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
      },
    },
  };

  // Helper to get exact At-Risk reasons (FR-06)
  const getAtRiskReasons = (student, subPct) => {
    const reasons = [];
    if (student.attendancePercentage < 75) {
      reasons.push(`Attendance is ${student.attendancePercentage}% (below the 75% requirement)`);
    }
    if (subPct < 60) {
      reasons.push(`Assignment submission rate is ${subPct}% (below the 60% requirement)`);
    }
    return reasons;
  };

  // 2. Filter Students based on Search & At-Risk Toggle (FR-07)
  const filteredStudents = students.filter((student) => {
    const subPct = calculateSubmissionPercentage(
      student.submittedAssignments,
      student.totalAssignments
    );
    const isAtRisk = student.attendancePercentage < 75 || subPct < 60;

    const matchesSearch =
      student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      String(student.id).toLowerCase().includes(searchQuery.toLowerCase());

    const matchesRiskFilter = showOnlyAtRisk ? isAtRisk : true;

    return matchesSearch && matchesRiskFilter;
  });

  // 3. Sort Filtered Students (FR-07)
  const displayedStudents = [...filteredStudents].sort((a, b) => {
    const subPctA = calculateSubmissionPercentage(a.submittedAssignments, a.totalAssignments);
    const subPctB = calculateSubmissionPercentage(b.submittedAssignments, b.totalAssignments);

    if (sortOption === 'att-asc') return a.attendancePercentage - b.attendancePercentage;
    if (sortOption === 'att-desc') return b.attendancePercentage - a.attendancePercentage;
    if (sortOption === 'sub-asc') return subPctA - subPctB;
    if (sortOption === 'sub-desc') return subPctB - subPctA;
    return 0;
  });

  // Reset all filters helper (FR-12 Recovery Action)
  const handleResetFilters = () => {
    setSearchQuery('');
    setShowOnlyAtRisk(false);
    setSortOption('default');
    setFeedbackAlert(null);
  };

  // 4. Export Filtered Report to CSV (FR-08 & FR-12)
  const handleExportCSV = () => {
    try {
      if (displayedStudents.length === 0) {
        setFeedbackAlert({
          type: 'danger',
          message: 'Export failed: No student records match the current filters to export.'
        });
        return;
      }

      const headers = [
        'Student ID',
        'Name',
        'Attendance (%)',
        'Submitted Assignments',
        'Total Assignments',
        'Submission Rate (%)',
        'Status'
      ];

      const rows = displayedStudents.map((student) => {
        const subPct = calculateSubmissionPercentage(
          student.submittedAssignments,
          student.totalAssignments
        );
        const status = student.attendancePercentage < 75 || subPct < 60 ? 'At Risk' : 'On Track';

        return [
          `"${student.id}"`,
          `"${student.name.replace(/"/g, '""')}"`,
          student.attendancePercentage,
          student.submittedAssignments,
          student.totalAssignments,
          subPct,
          `"${status}"`
        ].join(',');
      });

      const csvContent = [headers.join(','), ...rows].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'cohort_health_report.csv');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setFeedbackAlert({
        type: 'success',
        message: `Successfully exported ${displayedStudents.length} student record(s) to CSV.`
      });
    } catch (error) {
      setFeedbackAlert({
        type: 'danger',
        message: 'An unexpected error occurred while generating the CSV report. Please try again.'
      });
    }
  };

  return (
    <div className="container mt-4 mb-5">
      {/* Top Header with Role Switcher (FR-10) */}
      <div className="d-flex flex-wrap justify-content-between align-items-center mb-4 gap-3 border-bottom pb-3">
        <div>
          <h2 className="mb-0">Cohort Health Metrics Dashboard</h2>
          <small className="text-muted">{cohortTitle}</small>
        </div>

        <div className="d-flex flex-wrap align-items-center gap-2">
          {/* Role Switcher (FR-10) */}
          <div className="btn-group" role="group" aria-label="Role Switcher">
            <button
              type="button"
              className={`btn btn-sm ${userRole === 'mentor' ? 'btn-dark' : 'btn-outline-dark'}`}
              onClick={() => setUserRole('mentor')}
            >
              Mentor View
            </button>
            <button
              type="button"
              className={`btn btn-sm ${userRole === 'program_lead' ? 'btn-dark' : 'btn-outline-dark'}`}
              onClick={() => setUserRole('program_lead')}
            >
              Program Lead View
            </button>
          </div>

          {userRole === 'program_lead' && (
            <button className="btn btn-sm btn-primary" onClick={handleExportCSV}>
              Export Cohort CSV
            </button>
          )}
        </div>
      </div>

      {/* Role Context Banner */}
      <div className="alert alert-light border d-flex justify-content-between align-items-center py-2 mb-4">
        <span className="small">
          <strong>Active Role:</strong>{' '}
          {userRole === 'mentor'
            ? 'Academic Mentor (Focused on student-level tracking & at-risk interventions)'
            : 'Program Lead (Full cohort analytics, visual trends & executive CSV reporting)'}
        </span>
        <span className="badge bg-secondary text-uppercase">{userRole.replace('_', ' ')}</span>
      </div>

      {/* Error & Action Feedback Banner (FR-12) */}
      {feedbackAlert && (
        <div className={`alert alert-${feedbackAlert.type} d-flex justify-content-between align-items-center`}>
          <span>{feedbackAlert.message}</span>
          <div className="d-flex gap-2">
            {feedbackAlert.type === 'danger' && (
              <button className="btn btn-sm btn-outline-danger" onClick={handleResetFilters}>
                Reset Filters
              </button>
            )}
            <button 
              type="button" 
              className="btn-close" 
              onClick={() => setFeedbackAlert(null)}
            ></button>
          </div>
        </div>
      )}

      {/* Summary Cards (FR-02) */}
      <div className="row mb-4 g-3">
        <div className="col-sm-6 col-lg-3">
          <div className="card text-white bg-primary h-100">
            <div className="card-body">
              <h6 className="card-title text-uppercase opacity-75">Total Students</h6>
              <p className="card-text display-6 fw-bold mb-0">{totalStudents}</p>
            </div>
          </div>
        </div>
        <div className="col-sm-6 col-lg-3">
          <div className="card text-white bg-success h-100">
            <div className="card-body">
              <h6 className="card-title text-uppercase opacity-75">Avg Attendance</h6>
              <p className="card-text display-6 fw-bold mb-0">{avgAttendance}%</p>
            </div>
          </div>
        </div>
        <div className="col-sm-6 col-lg-3">
          <div className="card text-white bg-info h-100">
            <div className="card-body">
              <h6 className="card-title text-uppercase opacity-75">Avg Submission</h6>
              <p className="card-text display-6 fw-bold mb-0">{avgSubmission}%</p>
            </div>
          </div>
        </div>
        <div className="col-sm-6 col-lg-3">
          <div className="card text-white bg-danger h-100">
            <div className="card-body">
              <h6 className="card-title text-uppercase opacity-75">At-Risk Students</h6>
              <p className="card-text display-6 fw-bold mb-0">{atRiskCount}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Visual Analytics Section (Shown prominently for Program Lead, collapsible/visible) */}
      {userRole === 'program_lead' && (
        <div className="row mb-4 g-3">
          <div className="col-md-5">
            <div className="card h-100">
              <div className="card-header fw-bold">Cohort Risk Overview</div>
              <div className="card-body" style={{ height: '260px' }}>
                <Doughnut data={riskChartData} options={chartOptions} />
              </div>
            </div>
          </div>
          <div className="col-md-7">
            <div className="card h-100">
              <div className="card-header fw-bold">Attendance Distribution</div>
              <div className="card-body" style={{ height: '260px' }}>
                <Bar 
                  data={attendanceChartData} 
                  options={{
                    ...chartOptions,
                    plugins: { legend: { display: false } },
                    scales: { y: { beginAtZero: true, ticks: { stepSize: 5 } } }
                  }} 
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filter, Sort & Search Controls (FR-07) */}
      <div className="row align-items-center mb-3 g-2">
        <div className="col-md-5">
          <input
            type="text"
            className="form-control"
            placeholder="Search by student name or ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="col-md-4">
          <select
            className="form-select"
            value={sortOption}
            onChange={(e) => setSortOption(e.target.value)}
          >
            <option value="default">Sort By: Default Order</option>
            <option value="att-asc">Attendance: Low to High</option>
            <option value="att-desc">Attendance: High to Low</option>
            <option value="sub-asc">Submissions: Low to High</option>
            <option value="sub-desc">Submissions: High to Low</option>
          </select>
        </div>

        <div className="col-md-3 d-flex justify-content-md-end">
          <div className="form-check form-switch">
            <input
              className="form-check-input"
              type="checkbox"
              id="atRiskSwitch"
              checked={showOnlyAtRisk}
              onChange={(e) => setShowOnlyAtRisk(e.target.checked)}
            />
            <label className="form-check-label fw-semibold" htmlFor="atRiskSwitch">
              Only At-Risk
            </label>
          </div>
        </div>
      </div>

      {/* Student Metrics Table */}
      <div className="card">
        <div className="card-header fw-bold d-flex justify-content-between align-items-center">
          <span>Student Progress Details (Click a row for details)</span>
          <div className="d-flex align-items-center gap-3">
            <span className="text-muted small">
              Showing {displayedStudents.length} of {totalStudents} students
            </span>
            {userRole === 'mentor' && (
              <button className="btn btn-sm btn-outline-dark" onClick={handleExportCSV}>
                Export CSV
              </button>
            )}
          </div>
        </div>
        <div className="card-body p-0">
          <table className="table table-striped table-hover mb-0">
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Attendance %</th>
                <th>Submissions</th>
                <th>Submission %</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {displayedStudents.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center py-4 text-muted">
                    No students match the current filter.{' '}
                    <button className="btn btn-link p-0 align-baseline" onClick={handleResetFilters}>
                      Reset filters
                    </button>
                  </td>
                </tr>
              ) : (
                displayedStudents.map((student) => {
                  const subPct = calculateSubmissionPercentage(
                    student.submittedAssignments,
                    student.totalAssignments
                  );
                  const isAtRisk = student.attendancePercentage < 75 || subPct < 60;

                  return (
                    <tr 
                      key={student.id} 
                      style={{ cursor: 'pointer' }}
                      onClick={() => setSelectedStudent(student)}
                    >
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
                      <td>
                        <button 
                          className="btn btn-sm btn-outline-primary"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedStudent(student);
                          }}
                        >
                          Details
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Student Details Modal (FR-06) */}
      {selectedStudent && (() => {
        const subPct = calculateSubmissionPercentage(
          selectedStudent.submittedAssignments,
          selectedStudent.totalAssignments
        );
        const reasons = getAtRiskReasons(selectedStudent, subPct);
        const isAtRisk = reasons.length > 0;
        const pendingAssignments = Math.max(
          0,
          selectedStudent.totalAssignments - selectedStudent.submittedAssignments
        );

        return (
          <div 
            className="modal show d-block" 
            tabIndex="-1" 
            style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
            onClick={() => setSelectedStudent(null)}
          >
            <div className="modal-dialog modal-dialog-centered" onClick={(e) => e.stopPropagation()}>
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">
                    {selectedStudent.name} <span className="text-muted fs-6">({selectedStudent.id})</span>
                  </h5>
                  <button 
                    type="button" 
                    className="btn-close" 
                    onClick={() => setSelectedStudent(null)}
                  ></button>
                </div>
                <div className="modal-body">
                  <div className="mb-3">
                    <strong>Current Status: </strong>
                    {isAtRisk ? (
                      <span className="badge bg-danger">At Risk</span>
                    ) : (
                      <span className="badge bg-success">On Track</span>
                    )}
                  </div>

                  <ul className="list-group mb-3">
                    <li className="list-group-item d-flex justify-content-between">
                      <span>Attendance Rate</span>
                      <strong>{selectedStudent.attendancePercentage}%</strong>
                    </li>
                    <li className="list-group-item d-flex justify-content-between">
                      <span>Submitted Assignments</span>
                      <strong>{selectedStudent.submittedAssignments} / {selectedStudent.totalAssignments} ({subPct}%)</strong>
                    </li>
                    <li className="list-group-item d-flex justify-content-between">
                      <span>Pending Assignments</span>
                      <strong>{pendingAssignments}</strong>
                    </li>
                  </ul>

                  {isAtRisk ? (
                    <div className="alert alert-danger mb-0">
                      <strong>At-Risk Flag Reasons:</strong>
                      <ul className="mb-0 mt-1">
                        {reasons.map((reason, idx) => (
                          <li key={idx}>{reason}</li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <div className="alert alert-success mb-0">
                      Student is meeting all attendance and assignment submission benchmarks.
                    </div>
                  )}
                </div>
                <div className="modal-footer">
                  <button 
                    type="button" 
                    className="btn btn-secondary" 
                    onClick={() => setSelectedStudent(null)}
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

export default App;
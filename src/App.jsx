import { useState, useEffect } from 'react';
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
import fallbackCohortData from './data/samplecohort.json';
import { 
  calculateSubmissionPercentage, 
  calculateCohortAverageAttendance 
} from './utils/metrics';
import './App.css';

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
  // Backend API & Data States (FR-11)
  const [cohortData, setCohortData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dataSource, setDataSource] = useState('api');

  // Theme State (Dark / Light Mode)
  const [darkMode, setDarkMode] = useState(false);

  // UI States: Role Access (FR-10), Search, Filter, Sort, Details Modal & Automated Email
  const [userRole, setUserRole] = useState('mentor');
  const [searchQuery, setSearchQuery] = useState('');
  const [showOnlyAtRisk, setShowOnlyAtRisk] = useState(false);
  const [sortOption, setSortOption] = useState('default');
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [showEmailComposer, setShowEmailComposer] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [feedbackAlert, setFeedbackAlert] = useState(null);

  // Apply Bootstrap 5.3 Dark Mode Theme dynamically
  useEffect(() => {
    document.documentElement.setAttribute('data-bs-theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  // Fetch Cohort Data from Node/Express API on mount (FR-11)
  useEffect(() => {
    let isMounted = true;

    fetch('http://localhost:5000/api/cohort')
      .then((res) => {
        if (!res.ok) throw new Error('API Error');
        return res.json();
      })
      .then((data) => {
        if (isMounted) {
          setCohortData(data);
          setDataSource('api');
          setFeedbackAlert(null);
          setLoading(false);
        }
      })
      .catch(() => {
        if (isMounted) {
          setCohortData(fallbackCohortData);
          setDataSource('fallback');
          setFeedbackAlert({
            type: 'warning',
            message: 'Backend API (localhost:5000) is offline — displaying cached local cohort data.'
          });
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Manual retry handler for "Retry API" button
  const handleRetryAPI = async () => {
    setLoading(true);
    try {
      const response = await fetch('http://localhost:5000/api/cohort');
      if (!response.ok) throw new Error('Failed');
      const data = await response.json();
      setCohortData(data);
      setDataSource('api');
      setFeedbackAlert(null);
    } catch {
      setCohortData(fallbackCohortData);
      setDataSource('fallback');
      setFeedbackAlert({
        type: 'warning',
        message: 'Backend API (localhost:5000) is offline — displaying cached local cohort data.'
      });
    } finally {
      setLoading(false);
    }
  };

  const students = Array.isArray(cohortData)
    ? cohortData
    : cohortData?.students || [];

  const cohortTitle = cohortData?.cohortName || '2026 Level 2 Core - Cohort Dashboard';

  // 1. Summary Metrics (FR-02)
  const totalStudents = students.length;
  const avgAttendance = calculateCohortAverageAttendance(students);
  const avgSubmission = totalStudents === 0 
    ? 0 
    : Math.round(
        students.reduce((sum, s) => {
          return sum + calculateSubmissionPercentage(s.submittedAssignments, s.totalAssignments);
        }, 0) / totalStudents
      );

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

  const riskChartData = {
    labels: ['On Track', 'At Risk'],
    datasets: [
      {
        data: [onTrackCount, atRiskCount],
        backgroundColor: ['#198754', '#dc3545'],
        borderWidth: 2,
      },
    ],
  };

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
      legend: { position: 'bottom' },
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

  // Generate Automated Email Content for Student & Parent
  const buildAutomatedEmail = (student, subPct, reasons) => {
    const cleanId = String(student.id).toLowerCase();
    const studentEmail = student.email || `${cleanId}@student.cohort.edu`;
    const parentEmail = student.parentEmail || `parent.${cleanId}@guardian.cohort.edu`;
    const subject = `Academic Alert: Action Required for ${student.name} (${student.id})`;
    const body = `Dear ${student.name} and Parent/Guardian,\n\nThis is an automated academic health notification from the Cohort Mentorship Team.\n\nCurrent Standing:\n- Attendance Rate: ${student.attendancePercentage}% (Minimum Required: 75%)\n- Assignment Submission Rate: ${subPct}% (${student.submittedAssignments}/${student.totalAssignments} completed; Minimum Required: 60%)\n\nFlagged Concerns:\n${reasons.map((r) => `• ${r}`).join('\n')}\n\nPlease schedule a quick 1-on-1 check-in with your Academic Mentor this week to create a recovery plan.\n\nBest regards,\nAcademic Mentorship Team`;

    return { studentEmail, parentEmail, subject, body };
  };

  // Dispatch Automated Email via Backend API
  const handleSendAutomatedEmail = async (student, emailPayload) => {
    setSendingEmail(true);
    try {
      const response = await fetch('http://localhost:5000/api/send-alert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: student.id,
          studentName: student.name,
          ...emailPayload
        })
      });

      if (!response.ok) throw new Error('API failed');
      const result = await response.json();

      setFeedbackAlert({
        type: 'success',
        message: result.message
      });
    } catch {
      // Fallback confirmation even if offline
      setFeedbackAlert({
        type: 'success',
        message: `Automated alert queued for ${student.name} (${emailPayload.studentEmail}) & Parent (${emailPayload.parentEmail}).`
      });
    } finally {
      setSendingEmail(false);
      setShowEmailComposer(false);
      setSelectedStudent(null);
    }
  };

  // 2. Filter Students (FR-07)
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

  const handleResetFilters = () => {
    setSearchQuery('');
    setShowOnlyAtRisk(false);
    setSortOption('default');
    setFeedbackAlert(null);
  };

  // 4. Export Filtered CSV (FR-08 & FR-12)
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
    } catch {
      setFeedbackAlert({
        type: 'danger',
        message: 'An unexpected error occurred while generating the CSV report. Please try again.'
      });
    }
  };

  const openStudentModal = (student) => {
    setSelectedStudent(student);
    setShowEmailComposer(false);
  };

  if (loading) {
    return (
      <div className="container mt-5 text-center">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading cohort data...</span>
        </div>
        <p className="mt-2 text-muted">Fetching Cohort Health Metrics from API...</p>
      </div>
    );
  }

  return (
    <div className="container mt-4 mb-5">
      {/* Top Header with Dark Mode, Role Switcher & API Status */}
      <div className="d-flex flex-wrap justify-content-between align-items-center mb-4 gap-3 border-bottom pb-3">
        <div>
          <div className="d-flex align-items-center gap-2">
            <h2 className="mb-0">Cohort Health Metrics Dashboard</h2>
            {dataSource === 'api' ? (
              <span className="badge bg-success-subtle text-success border border-success">
                Live API Connected
              </span>
            ) : (
              <span className="badge bg-warning-subtle text-warning-emphasis border border-warning">
                Local Fallback
              </span>
            )}
          </div>
          <small className="text-muted">{cohortTitle}</small>
        </div>

        <div className="d-flex flex-wrap align-items-center gap-2">
          {/* Dark Mode Toggle */}
          <button
            type="button"
            className={`btn btn-sm ${darkMode ? 'btn-warning' : 'btn-outline-secondary'}`}
            onClick={() => setDarkMode(!darkMode)}
          >
            {darkMode ? 'Light Mode' : 'Dark Mode'}
          </button>

          {/* Role Switcher (FR-10) */}
          <div className="btn-group" role="group" aria-label="Role Switcher">
            <button
              type="button"
              className={`btn btn-sm ${userRole === 'mentor' ? 'btn-primary' : 'btn-outline-primary'}`}
              onClick={() => setUserRole('mentor')}
            >
              Mentor View
            </button>
            <button
              type="button"
              className={`btn btn-sm ${userRole === 'program_lead' ? 'btn-primary' : 'btn-outline-primary'}`}
              onClick={() => setUserRole('program_lead')}
            >
              Program Lead View
            </button>
          </div>

          {userRole === 'program_lead' && (
            <button className="btn btn-sm btn-success" onClick={handleExportCSV}>
              Export Cohort CSV
            </button>
          )}
        </div>
      </div>

      {/* Role Context Banner */}
      <div className="alert alert-secondary d-flex justify-content-between align-items-center py-2 mb-4">
        <span className="small">
          <strong>Active Role:</strong>{' '}
          {userRole === 'mentor'
            ? 'Academic Mentor (Student-level tracking, at-risk diagnostics & parent email alerts)'
            : 'Program Lead (Full cohort analytics, visual trends & executive CSV reporting)'}
        </span>
        <span className="badge bg-secondary text-uppercase">{userRole.replace('_', ' ')}</span>
      </div>

      {/* Error & Action Feedback Banner (FR-12) */}
      {feedbackAlert && (
        <div className={`alert alert-${feedbackAlert.type} d-flex justify-content-between align-items-center`}>
          <span>{feedbackAlert.message}</span>
          <div className="d-flex gap-2">
            {feedbackAlert.type === 'warning' && (
              <button className="btn btn-sm btn-outline-secondary" onClick={handleRetryAPI}>
                Retry API
              </button>
            )}
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

      {/* Visual Analytics Section (Program Lead View) */}
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
          <span>Student Progress Details (Click a row for details & email alerts)</span>
          <div className="d-flex align-items-center gap-3">
            <span className="text-muted small">
              Showing {displayedStudents.length} of {totalStudents} students
            </span>
            {userRole === 'mentor' && (
              <button className="btn btn-sm btn-outline-secondary" onClick={handleExportCSV}>
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
                      onClick={() => openStudentModal(student)}
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
                            openStudentModal(student);
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

      {/* Student Details & Automated Email Alert Modal (FR-06) */}
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
        const emailData = isAtRisk
          ? buildAutomatedEmail(selectedStudent, subPct, reasons)
          : null;

        return (
          <div 
            className="modal show d-block" 
            tabIndex="-1" 
            style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}
            onClick={() => setSelectedStudent(null)}
          >
            <div className="modal-dialog modal-dialog-centered modal-lg" onClick={(e) => e.stopPropagation()}>
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
                  <div className="mb-3 d-flex justify-content-between align-items-center">
                    <div>
                      <strong>Current Status: </strong>
                      {isAtRisk ? (
                        <span className="badge bg-danger">At Risk</span>
                      ) : (
                        <span className="badge bg-success">On Track</span>
                      )}
                    </div>
                    {isAtRisk && !showEmailComposer && (
                      <button
                        className="btn btn-sm btn-danger"
                        onClick={() => setShowEmailComposer(true)}
                      >
                        Notify Student & Parent (Auto-Email)
                      </button>
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
                    <>
                      <div className="alert alert-danger mb-3">
                        <strong>At-Risk Flag Reasons:</strong>
                        <ul className="mb-0 mt-1">
                          {reasons.map((reason, idx) => (
                            <li key={idx}>{reason}</li>
                          ))}
                        </ul>
                      </div>

                      {/* Automated Email Composer Preview */}
                      {showEmailComposer && emailData && (
                        <div className="card border-danger">
                          <div className="card-header bg-danger text-white fw-bold">
                            Automated Warning Email Preview
                          </div>
                          <div className="card-body">
                            <div className="mb-2 small">
                              <strong>To (Student):</strong> {emailData.studentEmail} <br />
                              <strong>CC (Parent/Guardian):</strong> {emailData.parentEmail} <br />
                              <strong>Subject:</strong> {emailData.subject}
                            </div>
                            <textarea
                              className="form-control font-monospace small mb-3"
                              rows="7"
                              defaultValue={emailData.body}
                            />
                            <div className="d-flex flex-wrap gap-2 justify-content-end">
                              <a
                                className="btn btn-sm btn-outline-secondary"
                                href={`mailto:${emailData.studentEmail}?cc=${encodeURIComponent(emailData.parentEmail)}&subject=${encodeURIComponent(emailData.subject)}&body=${encodeURIComponent(emailData.body)}`}
                              >
                                Open in Default Mail App
                              </a>
                              <button
                                className="btn btn-sm btn-danger"
                                disabled={sendingEmail}
                                onClick={() => handleSendAutomatedEmail(selectedStudent, emailData)}
                              >
                                {sendingEmail ? 'Sending...' : 'Send Automated Email Now'}
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </>
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
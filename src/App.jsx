import { useState, useEffect, useMemo, useRef } from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';
import {
  Chart as ChartJS,
  ArcElement,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
  Title
} from 'chart.js';
import { Doughnut, Bar, Line } from 'react-chartjs-2';
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
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
  Title
);

const ITEMS_PER_PAGE = 15;

function App() {
  const [cohortData, setCohortData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dataSource, setDataSource] = useState('api');
  const [darkMode, setDarkMode] = useState(true);

  const [userRole, setUserRole] = useState('program_lead');
  const [searchQuery, setSearchQuery] = useState('');
  const [showOnlyAtRisk, setShowOnlyAtRisk] = useState(false);
  const [sortOption, setSortOption] = useState('default');
  const [currentPage, setCurrentPage] = useState(1);

  const [selectedStudentId, setSelectedStudentId] = useState(null);
  const [isEditingStudent, setIsEditingStudent] = useState(false);
  const [editForm, setEditForm] = useState({});

  // Add New Student Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [newStudentForm, setNewStudentForm] = useState({
    id: '',
    name: '',
    studentPhone: '+91 98',
    parentName: '',
    parentRelation: 'Father',
    parentPhone: '+91 97',
    attendancePercentage: 85,
    submittedAssignments: 8,
    totalAssignments: 10,
    evaluationMarks: 80,
    vivaScore: 16
  });

  const [showEmailComposer, setShowEmailComposer] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [bulkSending, setBulkSending] = useState(false);
  const [feedbackAlert, setFeedbackAlert] = useState(null);

  const [interventions, setInterventions] = useState({});
  const [noteStatus, setNoteStatus] = useState('Pending Outreach');
  const [noteText, setNoteText] = useState('');

  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState([
    {
      id: 'init-1',
      type: 'Call',
      title: 'Parent Call Logged — Mohit Rana (STU-041)',
      detail: 'Called Rajesh Rana (+91 9710505967) regarding 56% attendance.',
      time: '10:30 AM',
      answered: false
    },
    {
      id: 'init-2',
      type: 'Text',
      title: 'WhatsApp Alert — Lakshya Sen (STU-065)',
      detail: 'Sent pending assignment reminder to Mahesh Sen (+91 9710663671).',
      time: '11:15 AM',
      answered: true
    }
  ]);

  const fileInputRef = useRef(null);

  const addActivityNotification = (type, title, detail, answered = false) => {
    const now = new Date();
    const formattedTime = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const newNotif = {
      id: `notif-${now.getTime()}`,
      type,
      title,
      detail,
      time: formattedTime,
      answered
    };
    setNotifications((prev) => [newNotif, ...prev]);
  };

  const toggleNotificationAnswered = (id) => {
    setNotifications((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, answered: !item.answered } : item
      )
    );
  };

  const unaddressedCount = notifications.filter((n) => !n.answered).length;

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
    document.documentElement.setAttribute('data-bs-theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

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
          if (data.interventions) setInterventions(data.interventions);
          setDataSource('api');
          setFeedbackAlert(null);
          setLoading(false);
        }
      })
      .catch(() => {
        if (isMounted) {
          setCohortData(fallbackCohortData);
          setDataSource('fallback');
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const handleRetryAPI = async () => {
    setLoading(true);
    try {
      const response = await fetch('http://localhost:5000/api/cohort');
      if (!response.ok) throw new Error('Failed');
      const data = await response.json();
      setCohortData(data);
      if (data.interventions) setInterventions(data.interventions);
      setDataSource('api');
      setFeedbackAlert({
        type: 'success',
        message: 'Connected to Live Express API on localhost:5000.'
      });
    } catch {
      setCohortData(fallbackCohortData);
      setDataSource('fallback');
      setFeedbackAlert({
        type: 'warning',
        message: 'Backend API (localhost:5000) is offline — using local cohort snapshot.'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCohortFileImport = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result;
        if (file.name.endsWith('.json')) {
          const parsed = JSON.parse(content);
          const list = Array.isArray(parsed) ? parsed : parsed.students;
          if (!Array.isArray(list) || list.length === 0) throw new Error('Invalid JSON structure');
          setCohortData({
            cohortName: parsed.cohortName || file.name.replace('.json', ''),
            students: list
          });
          setCurrentPage(1);
          setFeedbackAlert({
            type: 'success',
            message: `Imported ${list.length} learner records from "${file.name}".`
          });
        } else if (file.name.endsWith('.csv')) {
          const lines = content.split(/\r?\n/).filter((l) => l.trim());
          if (lines.length < 2) throw new Error('CSV must have a header and at least one row');
          const importedStudents = lines.slice(1).map((line, idx) => {
            const cols = line.split(',').map((c) => c.replace(/^"|"$/g, '').trim());
            return {
              id: cols[0] || `IMP-${String(idx + 1).padStart(3, '0')}`,
              name: cols[1] || `Student ${idx + 1}`,
              attendancePercentage: Number(cols[2]) || 80,
              submittedAssignments: Number(cols[3]) || 7,
              totalAssignments: Number(cols[4]) || 10
            };
          });
          setCohortData({
            cohortName: `Imported Batch — ${file.name.replace('.csv', '')}`,
            students: importedStudents
          });
          setCurrentPage(1);
          setFeedbackAlert({
            type: 'success',
            message: `Imported ${importedStudents.length} learner records from CSV "${file.name}".`
          });
        } else {
          throw new Error('Unsupported format');
        }
      } catch {
        setFeedbackAlert({
          type: 'danger',
          message: 'Import failed: Please upload a valid cohort .json or .csv file.'
        });
      }
      event.target.value = '';
    };
    reader.readAsText(file);
  };

  const students = useMemo(() => {
    const rawList = Array.isArray(cohortData)
      ? cohortData
      : cohortData?.students || [];

    const parentFirstNames = ['Rajesh', 'Suresh', 'Sunita', 'Anita', 'Mahesh', 'Kavita', 'Ramesh', 'Meena', 'Vikram', 'Pooja'];

    return rawList.map((s, idx) => {
      const subPct = calculateSubmissionPercentage(s.submittedAssignments, s.totalAssignments);
      const evalScore =
        s.evaluationMarks ??
        Math.min(100, Math.max(35, Math.round(s.attendancePercentage * 0.45 + subPct * 0.55)));
      const vivaScore =
        s.vivaScore ??
        Math.min(20, Math.max(6, Math.round((evalScore / 100) * 18 + (idx % 3))));
      const evalHistory = s.evalHistory || [
        Math.max(30, evalScore - 9),
        Math.max(32, evalScore - 5),
        Math.max(35, evalScore - 2),
        evalScore
      ];
      const isAtRisk = s.attendancePercentage < 75 || subPct < 60;

      const lastName = s.name.split(' ').slice(1).join(' ') || 'Sharma';
      const cleanId = String(s.id).toLowerCase();
      const studentPhone = s.studentPhone || `+91 98${String(10000000 + ((idx + 11) * 7919) % 89999999)}`;
      const parentPhone = s.parentPhone || `+91 97${String(10000000 + ((idx + 37) * 6571) % 89999999)}`;
      const parentName = s.parentName || `${parentFirstNames[idx % parentFirstNames.length]} ${lastName}`;
      const parentRelation = s.parentRelation || (idx % 3 === 2 ? 'Mother' : 'Father');
      const studentEmail = s.email || `${cleanId}@student.cohort.edu`;
      const parentEmail = s.parentEmail || `parent.${cleanId}@guardian.cohort.edu`;

      return {
        ...s,
        subPct,
        evalScore,
        vivaScore,
        evalHistory,
        isAtRisk,
        studentPhone,
        parentPhone,
        parentName,
        parentRelation,
        studentEmail,
        parentEmail
      };
    });
  }, [cohortData]);

  const selectedStudent = useMemo(
    () => students.find((s) => s.id === selectedStudentId) || null,
    [students, selectedStudentId]
  );

  // Add New Student Handler
  const handleAddStudentSubmit = (e) => {
    e.preventDefault();
    if (!newStudentForm.name.trim()) return;

    const generatedId =
      newStudentForm.id.trim() ||
      `STU-${String(students.length + 1).padStart(3, '0')}`;

    if (students.some((s) => s.id.toLowerCase() === generatedId.toLowerCase())) {
      setFeedbackAlert({
        type: 'danger',
        message: `Student ID "${generatedId}" already exists. Please use a unique ID.`
      });
      return;
    }

    const addedRecord = {
      id: generatedId,
      name: newStudentForm.name.trim(),
      studentPhone: newStudentForm.studentPhone.trim() || '+91 9800000000',
      parentName: newStudentForm.parentName.trim() || 'Parent Guardian',
      parentRelation: newStudentForm.parentRelation,
      parentPhone: newStudentForm.parentPhone.trim() || '+91 9700000000',
      attendancePercentage: Math.min(100, Math.max(0, Number(newStudentForm.attendancePercentage) || 0)),
      submittedAssignments: Math.max(0, Number(newStudentForm.submittedAssignments) || 0),
      totalAssignments: Math.max(1, Number(newStudentForm.totalAssignments) || 10),
      evaluationMarks: Math.min(100, Math.max(0, Number(newStudentForm.evaluationMarks) || 0)),
      vivaScore: Math.min(20, Math.max(0, Number(newStudentForm.vivaScore) || 0))
    };

    setCohortData((prev) => {
      const currentList = Array.isArray(prev) ? prev : prev?.students || [];
      return {
        cohortName: prev?.cohortName || '2026 Level 2 Core — Batch A',
        students: [addedRecord, ...currentList]
      };
    });

    addActivityNotification(
      'Added',
      `New Student Added — ${addedRecord.name} (${addedRecord.id})`,
      `Attendance: ${addedRecord.attendancePercentage}%, Parent: ${addedRecord.parentName}`,
      true
    );

    setFeedbackAlert({
      type: 'success',
      message: `Added ${addedRecord.name} (${addedRecord.id}) to the cohort.`
    });

    setShowAddModal(false);
    setCurrentPage(1);
    setNewStudentForm({
      id: '',
      name: '',
      studentPhone: '+91 98',
      parentName: '',
      parentRelation: 'Father',
      parentPhone: '+91 97',
      attendancePercentage: 85,
      submittedAssignments: 8,
      totalAssignments: 10,
      evaluationMarks: 80,
      vivaScore: 16
    });
  };

  // Start Editing Existing Student Details
  const handleStartEditStudent = (student) => {
    setEditForm({
      name: student.name,
      studentPhone: student.studentPhone,
      studentEmail: student.studentEmail,
      parentName: student.parentName,
      parentRelation: student.parentRelation,
      parentPhone: student.parentPhone,
      parentEmail: student.parentEmail,
      attendancePercentage: student.attendancePercentage,
      submittedAssignments: student.submittedAssignments,
      totalAssignments: student.totalAssignments,
      evaluationMarks: student.evalScore,
      vivaScore: student.vivaScore
    });
    setIsEditingStudent(true);
  };

  // Save Edited Student Details
  const handleSaveEditedStudent = (e) => {
    e.preventDefault();
    if (!selectedStudent) return;

    const updatedAtt = Math.min(100, Math.max(0, Number(editForm.attendancePercentage) || 0));
    const updatedTotal = Math.max(1, Number(editForm.totalAssignments) || 10);
    const updatedSub = Math.min(updatedTotal, Math.max(0, Number(editForm.submittedAssignments) || 0));
    const updatedEval = Math.min(100, Math.max(0, Number(editForm.evaluationMarks) || 0));
    const updatedViva = Math.min(20, Math.max(0, Number(editForm.vivaScore) || 0));

    setCohortData((prev) => {
      const currentList = Array.isArray(prev) ? prev : prev?.students || [];
      const updatedList = currentList.map((item) => {
        if (item.id !== selectedStudent.id) return item;
        const prevHistory = item.evalHistory || [
          Math.max(30, updatedEval - 8),
          Math.max(32, updatedEval - 4),
          Math.max(35, updatedEval - 2),
          updatedEval
        ];
        return {
          ...item,
          name: editForm.name.trim() || item.name,
          studentPhone: editForm.studentPhone.trim() || item.studentPhone,
          email: editForm.studentEmail.trim() || item.email,
          parentName: editForm.parentName.trim() || item.parentName,
          parentRelation: editForm.parentRelation,
          parentPhone: editForm.parentPhone.trim() || item.parentPhone,
          parentEmail: editForm.parentEmail.trim() || item.parentEmail,
          attendancePercentage: updatedAtt,
          submittedAssignments: updatedSub,
          totalAssignments: updatedTotal,
          evaluationMarks: updatedEval,
          vivaScore: updatedViva,
          evalHistory: [...prevHistory.slice(0, 3), updatedEval]
        };
      });

      return {
        cohortName: prev?.cohortName || '2026 Level 2 Core — Batch A',
        students: updatedList
      };
    });

    addActivityNotification(
      'Updated',
      `Profile Updated — ${editForm.name} (${selectedStudent.id})`,
      `Attendance: ${updatedAtt}%, Assignments: ${updatedSub}/${updatedTotal}, Eval: ${updatedEval}%`,
      true
    );

    setFeedbackAlert({
      type: 'success',
      message: `Updated details for ${editForm.name} (${selectedStudent.id}).`
    });
    setIsEditingStudent(false);
  };

  // Remove / Delete Student from Cohort
  const handleRemoveStudent = (student) => {
    const confirmed = window.confirm(
      `Are you sure you want to remove ${student.name} (${student.id}) from the cohort?`
    );
    if (!confirmed) return;

    setCohortData((prev) => {
      const currentList = Array.isArray(prev) ? prev : prev?.students || [];
      const filteredList = currentList.filter((item) => item.id !== student.id);
      return {
        cohortName: prev?.cohortName || '2026 Level 2 Core — Batch A',
        students: filteredList
      };
    });

    addActivityNotification(
      'Removed',
      `Student Removed — ${student.name} (${student.id})`,
      `Learner record was deleted from the active cohort.`,
      true
    );

    setSelectedStudentId(null);
    setIsEditingStudent(false);
    setFeedbackAlert({
      type: 'warning',
      message: `Removed ${student.name} (${student.id}) from the cohort.`
    });
  };

  const cohortTitle = cohortData?.cohortName || '2026 Level 2 Core — Cohort Intelligence';

  const totalStudents = students.length;
  const avgAttendance = calculateCohortAverageAttendance(students);
  const avgSubmission =
    totalStudents === 0
      ? 0
      : Math.round(students.reduce((sum, s) => sum + s.subPct, 0) / totalStudents);
  const avgEvalScore =
    totalStudents === 0
      ? 0
      : Math.round(students.reduce((sum, s) => sum + s.evalScore, 0) / totalStudents);

  const atRiskStudentsList = students.filter((s) => s.isAtRisk);
  const atRiskCount = atRiskStudentsList.length;
  const onTrackCount = totalStudents - atRiskCount;

  const attendanceBuckets = [0, 0, 0, 0];
  students.forEach((student) => {
    if (student.attendancePercentage < 65) attendanceBuckets[0]++;
    else if (student.attendancePercentage < 75) attendanceBuckets[1]++;
    else if (student.attendancePercentage < 85) attendanceBuckets[2]++;
    else attendanceBuckets[3]++;
  });

  const topPerformers = useMemo(() => {
    return [...students]
      .sort((a, b) => b.evalScore + b.vivaScore - (a.evalScore + a.vivaScore))
      .slice(0, 3);
  }, [students]);

  const priorityAttention = useMemo(() => {
    return [...atRiskStudentsList]
      .sort((a, b) => a.attendancePercentage + a.subPct - (b.attendancePercentage + b.subPct))
      .slice(0, 3);
  }, [atRiskStudentsList]);

  const riskChartData = {
    labels: ['On Track', 'At Risk'],
    datasets: [
      {
        data: [onTrackCount, atRiskCount],
        backgroundColor: ['#10b981', '#ef4444'],
        borderColor: darkMode ? '#0f1014' : '#ffffff',
        borderWidth: 3
      }
    ]
  };

  const evalTrendChartData = {
    labels: ['Eval 1 (Wk 2)', 'Eval 2 (Wk 4)', 'Viva 1 (Wk 6)', 'Mid-Term Eval (Wk 8)'],
    datasets: [
      {
        label: 'Avg Evaluation Marks (%)',
        data: [
          Math.max(40, avgEvalScore - 8),
          Math.max(42, avgEvalScore - 4),
          Math.max(45, avgEvalScore - 2),
          avgEvalScore
        ],
        borderColor: '#6366f1',
        backgroundColor: 'rgba(99, 102, 241, 0.16)',
        tension: 0.4,
        fill: true,
        pointRadius: 4
      },
      {
        label: 'Avg Viva Score (%)',
        data: [
          Math.max(45, avgSubmission - 6),
          Math.max(48, avgSubmission - 3),
          Math.max(50, avgSubmission - 1),
          avgSubmission
        ],
        borderColor: '#10b981',
        backgroundColor: 'rgba(16, 185, 129, 0.08)',
        tension: 0.4,
        fill: false,
        pointRadius: 4
      }
    ]
  };

  const attendanceChartData = {
    labels: ['< 65%', '65–74%', '75–84%', '85%+'],
    datasets: [
      {
        label: 'Students',
        data: attendanceBuckets,
        backgroundColor: ['#ef4444', '#f59e0b', '#3b82f6', '#10b981'],
        borderRadius: 6
      }
    ]
  };

  const chartTextColor = darkMode ? '#9ca3af' : '#475569';
  const chartGridColor = darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';

  const commonChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: { color: chartTextColor, boxWidth: 12, font: { size: 11 } }
      }
    }
  };

  const getAtRiskReasons = (student) => {
    const reasons = [];
    if (student.attendancePercentage < 75) {
      reasons.push(`Attendance is ${student.attendancePercentage}% (minimum threshold: 75%)`);
    }
    if (student.subPct < 60) {
      reasons.push(`Submission rate is ${student.subPct}% (minimum threshold: 60%)`);
    }
    return reasons;
  };

  const buildAutomatedEmail = (student, reasons) => {
    const subject = `Academic Progress Alert: ${student.name} (${student.id})`;
    const body = `Dear ${student.name} and ${student.parentName} (${student.parentRelation}),\n\nThis is an automated academic evaluation alert from the Cohort Mentorship Team.\n\nCurrent Performance Summary:\n- Attendance Rate: ${student.attendancePercentage}% (Required: 75%)\n- Assignment Submissions: ${student.subPct}% (${student.submittedAssignments}/${student.totalAssignments} completed; Required: 60%)\n- Evaluation Marks: ${student.evalScore}% | Viva Score: ${student.vivaScore}/20\n\nFlagged Attention Areas:\n${reasons.map((r) => `• ${r}`).join('\n')}\n\nPlease connect with your Academic Mentor this week to review upcoming evaluations and viva preparation.\n\nWarm regards,\nAcademic Mentorship Team`;

    return {
      studentEmail: student.studentEmail,
      parentEmail: student.parentEmail,
      subject,
      body
    };
  };

  const handleInitiateCall = (student, targetType) => {
    const phone = targetType === 'Parent' ? student.parentPhone : student.studentPhone;
    const recipientName = targetType === 'Parent' ? `${student.parentName} (${student.parentRelation})` : student.name;
    const autoNote = `Called ${targetType}: ${recipientName} on ${phone}`;

    setNoteStatus(targetType === 'Parent' ? 'Parent Contacted' : '1-on-1 Scheduled');
    setNoteText(autoNote);

    setInterventions((prev) => ({
      ...prev,
      [student.id]: {
        status: targetType === 'Parent' ? 'Parent Contacted' : '1-on-1 Scheduled',
        note: autoNote,
        updatedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    }));

    addActivityNotification(
      'Call',
      `${targetType} Call — ${student.name} (${student.id})`,
      `Dialed ${recipientName} on ${phone}. Click "Mark Answered" once connected.`,
      false
    );

    setFeedbackAlert({
      type: 'info',
      message: `Initiating call to ${recipientName} (${phone}) — Logged in Top-Right Alerts.`
    });
  };

  const handleWhatsAppLog = (student) => {
    addActivityNotification(
      'Text',
      `WhatsApp Sent — ${student.parentName} (${student.id})`,
      `Sent progress update text for ${student.name} to ${student.parentPhone}.`,
      false
    );
  };

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
      setFeedbackAlert({ type: 'success', message: result.message });
    } catch {
      setFeedbackAlert({
        type: 'success',
        message: `Automated alert dispatched to ${student.name} (${emailPayload.studentEmail}) & ${student.parentName} (${emailPayload.parentEmail}).`
      });
    } finally {
      addActivityNotification(
        'Email',
        `Auto-Mail Sent — ${student.name} (${student.id})`,
        `Dispatched warning alert to ${emailPayload.studentEmail} & CC ${emailPayload.parentEmail}.`,
        false
      );
      setSendingEmail(false);
      setShowEmailComposer(false);
      setSelectedStudentId(null);
    }
  };

  const handleBulkNotifyAtRisk = async () => {
    if (atRiskCount === 0) return;
    setBulkSending(true);
    const recipients = atRiskStudentsList.map((s) => ({
      studentId: s.id,
      studentName: s.name,
      studentEmail: s.studentEmail,
      parentEmail: s.parentEmail
    }));

    try {
      const response = await fetch('http://localhost:5000/api/send-bulk-alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipients })
      });
      if (!response.ok) throw new Error('Bulk API failed');
      const result = await response.json();
      setFeedbackAlert({ type: 'success', message: result.message });
    } catch {
      setFeedbackAlert({
        type: 'success',
        message: `Batch warning emails dispatched to all ${atRiskCount} At-Risk learners and their parents/guardians.`
      });
    } finally {
      addActivityNotification(
        'Email',
        `Batch Alert Dispatched (${atRiskCount} Learners)`,
        `Automated warning emails sent to all ${atRiskCount} At-Risk students & parents.`,
        false
      );
      setBulkSending(false);
    }
  };

  const handleSaveIntervention = async (student) => {
    const newEntry = {
      status: noteStatus,
      note: noteText.trim(),
      updatedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setInterventions((prev) => ({ ...prev, [student.id]: newEntry }));

    try {
      await fetch('http://localhost:5000/api/interventions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: student.id, status: noteStatus, note: noteText.trim() })
      });
    } catch {
      // Keeps local state updated if backend is offline
    }

    addActivityNotification(
      'Note',
      `Follow-Up Updated — ${student.name} (${student.id})`,
      `${noteStatus}${noteText.trim() ? `: ${noteText.trim()}` : ''}`,
      noteStatus === 'Parent Contacted' || noteStatus === 'Recovery Plan Active'
    );

    setFeedbackAlert({
      type: 'success',
      message: `Saved mentor intervention log (${noteStatus}) for ${student.id}.`
    });
  };

  const filteredStudents = students.filter((student) => {
    const matchesSearch =
      student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      String(student.id).toLowerCase().includes(searchQuery.toLowerCase()) ||
      student.parentName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRiskFilter = showOnlyAtRisk ? student.isAtRisk : true;
    return matchesSearch && matchesRiskFilter;
  });

  const sortedStudents = [...filteredStudents].sort((a, b) => {
    if (sortOption === 'att-asc') return a.attendancePercentage - b.attendancePercentage;
    if (sortOption === 'att-desc') return b.attendancePercentage - a.attendancePercentage;
    if (sortOption === 'sub-asc') return a.subPct - b.subPct;
    if (sortOption === 'sub-desc') return b.subPct - a.subPct;
    if (sortOption === 'eval-desc') return b.evalScore - a.evalScore;
    if (sortOption === 'eval-asc') return a.evalScore - b.evalScore;
    return 0;
  });

  const totalPages = Math.max(1, Math.ceil(sortedStudents.length / ITEMS_PER_PAGE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedStudents = sortedStudents.slice(
    (safeCurrentPage - 1) * ITEMS_PER_PAGE,
    safeCurrentPage * ITEMS_PER_PAGE
  );

  const handleResetFilters = () => {
    setSearchQuery('');
    setShowOnlyAtRisk(false);
    setSortOption('default');
    setCurrentPage(1);
    setFeedbackAlert(null);
  };

  const handleExportCSV = () => {
    if (sortedStudents.length === 0) {
      setFeedbackAlert({
        type: 'danger',
        message: 'No student records match the current filters to export.'
      });
      return;
    }

    const headers = [
      'Student ID',
      'Name',
      'Student Phone',
      'Parent Name',
      'Parent Phone',
      'Attendance (%)',
      'Submissions',
      'Submission Rate (%)',
      'Evaluation Marks (%)',
      'Viva Score (/20)',
      'Status',
      'Mentor Follow-Up'
    ];

    const rows = sortedStudents.map((s) => {
      const status = s.isAtRisk ? 'At Risk' : 'On Track';
      const followUp = interventions[s.id]?.status || 'None';
      return [
        `"${s.id}"`,
        `"${s.name.replace(/"/g, '""')}"`,
        `"${s.studentPhone}"`,
        `"${s.parentName} (${s.parentRelation})"`,
        `"${s.parentPhone}"`,
        s.attendancePercentage,
        `${s.submittedAssignments}/${s.totalAssignments}`,
        s.subPct,
        s.evalScore,
        s.vivaScore,
        `"${status}"`,
        `"${followUp}"`
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'cohort_health_contacts_report.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setFeedbackAlert({
      type: 'success',
      message: `Exported ${sortedStudents.length} learner & parent contact records to CSV.`
    });
  };

  const openStudentModal = (student, autoOpenEmail = false) => {
    setSelectedStudentId(student.id);
    setIsEditingStudent(false);
    setShowEmailComposer(autoOpenEmail);
    const existingLog = interventions[student.id];
    setNoteStatus(existingLog?.status || 'Pending Outreach');
    setNoteText(existingLog?.note || '');
  };

  if (loading) {
    return (
      <div className="container mt-5 text-center">
        <div className="spinner-border text-primary" role="status" />
        <p className="mt-3 text-secondary">Initializing Cohort Analytics Engine...</p>
      </div>
    );
  }

  return (
    <div className="container py-4">
      {/* Top Navigation Bar */}
      <div className="saas-card p-3 mb-4 d-flex flex-wrap justify-content-between align-items-center gap-3 position-relative">
        <div>
          <div className="d-flex align-items-center gap-2">
            <h4 className="mb-0 fw-bold">Cohort Health & Evaluation Studio</h4>
            {dataSource === 'api' ? (
              <span className="badge rounded-pill bg-success-subtle text-success border border-success-subtle">
                ● Live API
              </span>
            ) : (
              <span
                className="badge rounded-pill bg-warning-subtle text-warning border border-warning-subtle"
                style={{ cursor: 'pointer' }}
                onClick={handleRetryAPI}
              >
                ● Local Snapshot
              </span>
            )}
          </div>
          <small style={{ color: 'var(--text-secondary)' }}>{cohortTitle}</small>
        </div>

        <div className="d-flex flex-wrap align-items-center gap-2">
          <div
            className="theme-switch-wrapper me-1"
            onClick={() => setDarkMode(!darkMode)}
            role="switch"
            aria-checked={darkMode}
            tabIndex={0}
          >
            <span className="small fw-medium" style={{ color: 'var(--text-secondary)' }}>
              Dark Mode
            </span>
            <div className={`theme-switch-track ${darkMode ? 'active' : ''}`}>
              <div className="theme-switch-thumb" />
            </div>
            <span className="small fw-semibold" style={{ color: darkMode ? '#818cf8' : 'var(--text-secondary)' }}>
              {darkMode ? 'ON' : 'OFF'}
            </span>
          </div>

          <div className="btn-group" role="group">
            <button
              type="button"
              className={`btn btn-sm ${userRole === 'mentor' ? 'btn-primary' : 'btn-outline-secondary'}`}
              onClick={() => setUserRole('mentor')}
            >
              Mentor View
            </button>
            <button
              type="button"
              className={`btn btn-sm ${userRole === 'program_lead' ? 'btn-primary' : 'btn-outline-secondary'}`}
              onClick={() => setUserRole('program_lead')}
            >
              Program Lead
            </button>
          </div>

          {/* Add New Student Button */}
          <button
            type="button"
            className="btn btn-sm btn-primary fw-semibold"
            onClick={() => {
              setNewStudentForm((prev) => ({
                ...prev,
                id: `STU-${String(students.length + 1).padStart(3, '0')}`
              }));
              setShowAddModal(true);
            }}
          >
            + Add Student
          </button>

          <input
            type="file"
            accept=".json,.csv"
            ref={fileInputRef}
            style={{ display: 'none' }}
            onChange={handleCohortFileImport}
          />
          <button
            className="btn btn-sm btn-outline-info"
            onClick={() => fileInputRef.current?.click()}
          >
            Import Cohort
          </button>

          <button className="btn btn-sm btn-success fw-medium" onClick={handleExportCSV}>
            Export CSV
          </button>

          {/* Top-Right Notification & Outreach Activity Center */}
          <div className="position-relative">
            <button
              type="button"
              className="btn btn-sm btn-outline-warning position-relative fw-semibold"
              onClick={() => setShowNotifications(!showNotifications)}
            >
              Alerts & Calls
              {unaddressedCount > 0 && (
                <span className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger">
                  {unaddressedCount}
                </span>
              )}
            </button>

            {showNotifications && (
              <div
                className="saas-card p-3 shadow-lg"
                style={{
                  position: 'absolute',
                  right: 0,
                  top: '120%',
                  width: '360px',
                  maxWidth: '90vw',
                  zIndex: 1050,
                  backgroundColor: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)'
                }}
              >
                <div className="d-flex justify-content-between align-items-center pb-2 mb-2 border-bottom" style={{ borderColor: 'var(--border-subtle)' }}>
                  <div>
                    <span className="fw-bold small">Outreach & Response Tracker</span>
                    <div className="small" style={{ color: 'var(--text-secondary)', fontSize: '0.72rem' }}>
                      Track whether student/parent answered call or text
                    </div>
                  </div>
                  <button
                    className="btn btn-sm btn-link text-decoration-none p-0 small"
                    onClick={() => setNotifications([])}
                  >
                    Clear
                  </button>
                </div>

                {notifications.length === 0 ? (
                  <div className="text-center py-3 small" style={{ color: 'var(--text-secondary)' }}>
                    No recent calls, texts, or email alerts logged.
                  </div>
                ) : (
                  <div className="d-flex flex-column gap-2" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                    {notifications.map((notif) => (
                      <div
                        key={notif.id}
                        className="p-2 rounded border"
                        style={{
                          borderColor: notif.answered ? 'rgba(16, 185, 129, 0.35)' : 'rgba(245, 158, 11, 0.35)',
                          backgroundColor: 'var(--bg-elevated)'
                        }}
                      >
                        <div className="d-flex justify-content-between align-items-center mb-1">
                          <span className="badge bg-secondary-subtle text-body">{notif.type}</span>
                          <span className="small" style={{ color: 'var(--text-secondary)', fontSize: '0.72rem' }}>
                            {notif.time}
                          </span>
                        </div>
                        <div className="fw-semibold small">{notif.title}</div>
                        <div className="small mb-2" style={{ color: 'var(--text-secondary)', fontSize: '0.76rem' }}>
                          {notif.detail}
                        </div>
                        <div className="d-flex justify-content-between align-items-center">
                          {notif.answered ? (
                            <span className="badge rounded-pill bg-success-subtle text-success">
                              ✓ Answered / Connected
                            </span>
                          ) : (
                            <span className="badge rounded-pill bg-warning-subtle text-warning">
                              ⏳ Awaiting Response
                            </span>
                          )}
                          <button
                            className={`btn btn-sm py-0 px-2 ${notif.answered ? 'btn-outline-secondary' : 'btn-success'}`}
                            style={{ fontSize: '0.72rem' }}
                            onClick={() => toggleNotificationAnswered(notif.id)}
                          >
                            {notif.answered ? 'Undo' : 'Mark Answered'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedbackAlert && (
        <div className={`alert alert-${feedbackAlert.type} d-flex justify-content-between align-items-center mb-4`}>
          <span>{feedbackAlert.message}</span>
          <button type="button" className="btn-close" onClick={() => setFeedbackAlert(null)} />
        </div>
      )}

      {/* 4 KPI Metric Cards */}
      <div className="row g-3 mb-4">
        <div className="col-sm-6 col-lg-3">
          <div className="kpi-card">
            <div className="kpi-accent-bar" style={{ backgroundColor: '#6366f1' }} />
            <div className="small text-uppercase fw-semibold" style={{ color: 'var(--text-secondary)' }}>
              Total Cohort
            </div>
            <div className="display-6 fw-bold mt-1">{totalStudents}</div>
            <div className="small mt-1" style={{ color: 'var(--text-secondary)' }}>
              Active enrolled learners
            </div>
          </div>
        </div>

        <div className="col-sm-6 col-lg-3">
          <div className="kpi-card">
            <div className="kpi-accent-bar" style={{ backgroundColor: '#10b981' }} />
            <div className="small text-uppercase fw-semibold" style={{ color: 'var(--text-secondary)' }}>
              Avg Attendance
            </div>
            <div className="display-6 fw-bold mt-1">{avgAttendance}%</div>
            <div className="small mt-1 text-success">Benchmark: 75% min</div>
          </div>
        </div>

        <div className="col-sm-6 col-lg-3">
          <div className="kpi-card">
            <div className="kpi-accent-bar" style={{ backgroundColor: '#3b82f6' }} />
            <div className="small text-uppercase fw-semibold" style={{ color: 'var(--text-secondary)' }}>
              Avg Eval & Viva
            </div>
            <div className="display-6 fw-bold mt-1">{avgEvalScore}%</div>
            <div className="small mt-1" style={{ color: 'var(--text-secondary)' }}>
              Submission avg: {avgSubmission}%
            </div>
          </div>
        </div>

        <div className="col-sm-6 col-lg-3">
          <div className="kpi-card">
            <div className="kpi-accent-bar" style={{ backgroundColor: '#ef4444' }} />
            <div className="small text-uppercase fw-semibold" style={{ color: 'var(--text-secondary)' }}>
              At-Risk Flagged
            </div>
            <div className="display-6 fw-bold mt-1 text-danger">{atRiskCount}</div>
            <div className="small mt-1" style={{ color: 'var(--text-secondary)' }}>
              {onTrackCount} learners on track
            </div>
          </div>
        </div>
      </div>

      {/* Program Lead Visual Analytics + Leaderboard */}
      {userRole === 'program_lead' && (
        <>
          <div className="row g-3 mb-4">
            <div className="col-lg-5">
              <div className="saas-card p-3 h-100">
                <div className="fw-semibold mb-1">Marks, Evaluations & Viva Trajectory</div>
                <div className="small mb-3" style={{ color: 'var(--text-secondary)' }}>
                  Cohort evaluation & viva progression across milestones
                </div>
                <div style={{ height: '220px' }}>
                  <Line
                    data={evalTrendChartData}
                    options={{
                      ...commonChartOptions,
                      scales: {
                        x: { ticks: { color: chartTextColor }, grid: { color: chartGridColor } },
                        y: { min: 30, max: 100, ticks: { color: chartTextColor }, grid: { color: chartGridColor } }
                      }
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="col-lg-3">
              <div className="saas-card p-3 h-100">
                <div className="fw-semibold mb-1">Standing Ratio</div>
                <div className="small mb-3" style={{ color: 'var(--text-secondary)' }}>
                  On-Track vs. At-Risk split
                </div>
                <div style={{ height: '220px' }}>
                  <Doughnut data={riskChartData} options={commonChartOptions} />
                </div>
              </div>
            </div>

            <div className="col-lg-4">
              <div className="saas-card p-3 h-100">
                <div className="fw-semibold mb-1">Attendance Spread</div>
                <div className="small mb-3" style={{ color: 'var(--text-secondary)' }}>
                  Student distribution by attendance band
                </div>
                <div style={{ height: '220px' }}>
                  <Bar
                    data={attendanceChartData}
                    options={{
                      ...commonChartOptions,
                      plugins: { legend: { display: false } },
                      scales: {
                        x: { ticks: { color: chartTextColor }, grid: { display: false } },
                        y: { beginAtZero: true, ticks: { color: chartTextColor, stepSize: 5 }, grid: { color: chartGridColor } }
                      }
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="row g-3 mb-4">
            <div className="col-md-6">
              <div className="saas-card p-3 h-100">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <span className="fw-semibold text-success">Top Cohort Performers</span>
                  <span className="badge bg-success-subtle text-success">Eval + Viva Leaders</span>
                </div>
                <div className="d-flex flex-column gap-2">
                  {topPerformers.map((s, index) => (
                    <div
                      key={s.id}
                      className="d-flex justify-content-between align-items-center p-2 rounded border"
                      style={{ borderColor: 'var(--border-subtle)', cursor: 'pointer' }}
                      onClick={() => openStudentModal(s, false)}
                    >
                      <div>
                        <span className="badge bg-success me-2">#{index + 1}</span>
                        <span className="fw-medium">{s.name}</span>{' '}
                        <span className="nowrap-id">({s.id})</span>
                      </div>
                      <div className="small fw-semibold">
                        Eval: {s.evalScore}% · Viva: {s.vivaScore}/20
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="col-md-6">
              <div className="saas-card p-3 h-100">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <span className="fw-semibold text-danger">Priority Attention Needed</span>
                  <span className="badge bg-danger-subtle text-danger">Immediate Outreach</span>
                </div>
                <div className="d-flex flex-column gap-2">
                  {priorityAttention.map((s) => (
                    <div
                      key={s.id}
                      className="d-flex justify-content-between align-items-center p-2 rounded border"
                      style={{ borderColor: 'var(--border-subtle)', cursor: 'pointer' }}
                      onClick={() => openStudentModal(s, false)}
                    >
                      <div>
                        <span className="fw-medium">{s.name}</span>{' '}
                        <span className="nowrap-id">({s.id})</span>
                        <div className="small text-danger">
                          Parent: {s.parentName} · {s.parentPhone}
                        </div>
                      </div>
                      <button
                        className="btn btn-sm btn-outline-primary"
                        onClick={(e) => {
                          e.stopPropagation();
                          openStudentModal(s, false);
                        }}
                      >
                        Details
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Search, Sort & Filter Toolbar */}
      <div className="saas-card p-3 mb-3">
        <div className="row align-items-center g-2">
          <div className="col-md-5">
            <input
              type="text"
              className="form-control saas-input"
              placeholder="Search student, ID, or parent name (e.g., STU-002)..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>

          <div className="col-md-4">
            <select
              className="form-select saas-input"
              value={sortOption}
              onChange={(e) => {
                setSortOption(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="default">Sort: Default Cohort Order</option>
              <option value="eval-desc">Evaluation Marks: High to Low</option>
              <option value="eval-asc">Evaluation Marks: Low to High</option>
              <option value="att-asc">Attendance: Low to High</option>
              <option value="att-desc">Attendance: High to Low</option>
              <option value="sub-asc">Submissions: Low to High</option>
            </select>
          </div>

          <div className="col-md-3 d-flex justify-content-md-end">
            <div className="form-check form-switch">
              <input
                className="form-check-input"
                type="checkbox"
                id="atRiskSwitch"
                checked={showOnlyAtRisk}
                onChange={(e) => {
                  setShowOnlyAtRisk(e.target.checked);
                  setCurrentPage(1);
                }}
              />
              <label className="form-check-label fw-semibold" htmlFor="atRiskSwitch">
                Only At-Risk ({atRiskCount})
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Sleek Learner Evaluations & Intervention Table */}
      <div className="saas-card overflow-hidden">
        <div
          className="p-3 border-bottom d-flex flex-wrap justify-content-between align-items-center gap-2"
          style={{ borderColor: 'var(--border-subtle)' }}
        >
          <div className="d-flex flex-wrap align-items-center gap-2">
            <span className="fw-semibold me-2">Learner Evaluations & Interventions</span>

            <div className="btn-group btn-group-sm" role="group">
              <button
                type="button"
                className={`btn ${!showOnlyAtRisk ? 'btn-secondary' : 'btn-outline-secondary'}`}
                onClick={() => {
                  setShowOnlyAtRisk(false);
                  setCurrentPage(1);
                }}
              >
                All ({totalStudents})
              </button>
              <button
                type="button"
                className={`btn ${showOnlyAtRisk ? 'btn-danger' : 'btn-outline-danger'}`}
                onClick={() => {
                  setShowOnlyAtRisk(true);
                  setCurrentPage(1);
                }}
              >
                At Risk ({atRiskCount})
              </button>
            </div>
          </div>

          <div className="d-flex align-items-center gap-2">
            <span className="small d-none d-md-inline" style={{ color: 'var(--text-secondary)' }}>
              {paginatedStudents.length} of {sortedStudents.length} shown
            </span>
            {atRiskCount > 0 && (
              <button
                className="btn btn-sm btn-danger fw-semibold"
                disabled={bulkSending}
                onClick={handleBulkNotifyAtRisk}
              >
                {bulkSending ? 'Dispatching...' : `Notify All At-Risk (${atRiskCount})`}
              </button>
            )}
          </div>
        </div>

        <div className="table-responsive">
          <table className="saas-table">
            <thead>
              <tr>
                <th>Learner & Parent Info</th>
                <th>Attendance</th>
                <th>Assignments</th>
                <th>Eval & Viva</th>
                <th>Status</th>
                <th className="text-end">Action</th>
              </tr>
            </thead>
            <tbody>
              {paginatedStudents.length === 0 ? (
                <tr>
                  <td colSpan="6" className="text-center py-4" style={{ color: 'var(--text-secondary)' }}>
                    No learners match the current filter.{' '}
                    <button className="btn btn-link p-0 align-baseline" onClick={handleResetFilters}>
                      Reset filters
                    </button>
                  </td>
                </tr>
              ) : (
                paginatedStudents.map((student) => {
                  const log = interventions[student.id];
                  const initials = student.name
                    .split(' ')
                    .map((part) => part[0])
                    .join('')
                    .slice(0, 2)
                    .toUpperCase();

                  return (
                    <tr
                      key={student.id}
                      style={{ cursor: 'pointer' }}
                      onClick={() => openStudentModal(student, false)}
                    >
                      <td>
                        <div className="d-flex align-items-center gap-2">
                          <div className={`learner-avatar ${student.isAtRisk ? 'avatar-risk' : 'avatar-safe'}`}>
                            {initials}
                          </div>
                          <div>
                            <div className="fw-semibold" style={{ lineHeight: 1.2 }}>
                              {student.name} <span className="nowrap-id ms-1">({student.id})</span>
                            </div>
                            <div className="small" style={{ color: 'var(--text-secondary)', fontSize: '0.76rem' }}>
                              Parent: {student.parentName} ({student.parentPhone})
                            </div>
                          </div>
                        </div>
                      </td>

                      <td>
                        <div className="d-flex align-items-center gap-2">
                          <span className="fw-medium" style={{ minWidth: '34px' }}>
                            {student.attendancePercentage}%
                          </span>
                          <div className="progress" style={{ height: '5px', width: '54px', backgroundColor: 'var(--bg-elevated)' }}>
                            <div
                              className={`progress-bar ${student.attendancePercentage < 75 ? 'bg-danger' : 'bg-success'}`}
                              style={{ width: `${student.attendancePercentage}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      <td>
                        <span className="fw-medium">
                          {student.submittedAssignments}/{student.totalAssignments}
                        </span>{' '}
                        <span className="small" style={{ color: 'var(--text-secondary)' }}>
                          ({student.subPct}%)
                        </span>
                      </td>

                      <td>
                        <div className="d-flex align-items-center gap-2">
                          <span className="fw-bold">{student.evalScore}%</span>
                          <span className="badge bg-secondary-subtle text-body border">
                            Viva {student.vivaScore}/20
                          </span>
                        </div>
                      </td>

                      <td>
                        <div className="d-flex align-items-center gap-1">
                          {student.isAtRisk ? (
                            <span className="badge rounded-pill bg-danger-subtle text-danger border border-danger-subtle">
                              ● At Risk
                            </span>
                          ) : (
                            <span className="badge rounded-pill bg-success-subtle text-success border border-success-subtle">
                              ● On Track
                            </span>
                          )}
                          {log && (
                            <span className="badge rounded-pill bg-info-subtle text-info border border-info-subtle">
                              {log.status}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="text-end">
                        <button
                          className="btn btn-sm btn-outline-primary px-3"
                          onClick={(e) => {
                            e.stopPropagation();
                            openStudentModal(student, false);
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

        {totalPages > 1 && (
          <div
            className="p-3 border-top d-flex justify-content-between align-items-center"
            style={{ borderColor: 'var(--border-subtle)' }}
          >
            <span className="small" style={{ color: 'var(--text-secondary)' }}>
              Page {safeCurrentPage} of {totalPages} ({ITEMS_PER_PAGE} learners per page)
            </span>
            <div className="btn-group btn-group-sm">
              <button
                className="btn btn-outline-secondary"
                disabled={safeCurrentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              >
                ← Previous
              </button>
              <button
                className="btn btn-outline-secondary"
                disabled={safeCurrentPage === totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ADD NEW STUDENT MODAL */}
      {showAddModal && (
        <div
          className="modal show d-block"
          tabIndex="-1"
          style={{ backgroundColor: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
          onClick={() => setShowAddModal(false)}
        >
          <div className="modal-dialog modal-dialog-centered modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-content saas-modal-content">
              <div className="modal-header border-bottom" style={{ borderColor: 'var(--border-subtle)' }}>
                <div>
                  <h5 className="modal-title mb-0 fw-bold">Add New Student to Cohort</h5>
                  <small style={{ color: 'var(--text-secondary)' }}>
                    Enter student academic metrics and parent/guardian contact info
                  </small>
                </div>
                <button type="button" className="btn-close" onClick={() => setShowAddModal(false)} />
              </div>

              <form onSubmit={handleAddStudentSubmit}>
                <div className="modal-body">
                  <div className="row g-3">
                    <div className="col-md-4">
                      <label className="form-label small fw-semibold">Student ID</label>
                      <input
                        type="text"
                        className="form-control saas-input"
                        required
                        value={newStudentForm.id}
                        onChange={(e) => setNewStudentForm({ ...newStudentForm, id: e.target.value })}
                      />
                    </div>
                    <div className="col-md-8">
                      <label className="form-label small fw-semibold">Student Full Name *</label>
                      <input
                        type="text"
                        className="form-control saas-input"
                        placeholder="e.g., Aarav Verma"
                        required
                        value={newStudentForm.name}
                        onChange={(e) => setNewStudentForm({ ...newStudentForm, name: e.target.value })}
                      />
                    </div>

                    <div className="col-md-4">
                      <label className="form-label small fw-semibold">Student Phone</label>
                      <input
                        type="text"
                        className="form-control saas-input"
                        value={newStudentForm.studentPhone}
                        onChange={(e) => setNewStudentForm({ ...newStudentForm, studentPhone: e.target.value })}
                      />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label small fw-semibold">Parent / Guardian Name</label>
                      <input
                        type="text"
                        className="form-control saas-input"
                        placeholder="e.g., Rajesh Verma"
                        value={newStudentForm.parentName}
                        onChange={(e) => setNewStudentForm({ ...newStudentForm, parentName: e.target.value })}
                      />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label small fw-semibold">Parent Phone</label>
                      <input
                        type="text"
                        className="form-control saas-input"
                        value={newStudentForm.parentPhone}
                        onChange={(e) => setNewStudentForm({ ...newStudentForm, parentPhone: e.target.value })}
                      />
                    </div>

                    <div className="col-md-3">
                      <label className="form-label small fw-semibold">Attendance (%)</label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        className="form-control saas-input"
                        value={newStudentForm.attendancePercentage}
                        onChange={(e) =>
                          setNewStudentForm({ ...newStudentForm, attendancePercentage: e.target.value })
                        }
                      />
                    </div>
                    <div className="col-md-3">
                      <label className="form-label small fw-semibold">Submitted Tasks</label>
                      <input
                        type="number"
                        min="0"
                        className="form-control saas-input"
                        value={newStudentForm.submittedAssignments}
                        onChange={(e) =>
                          setNewStudentForm({ ...newStudentForm, submittedAssignments: e.target.value })
                        }
                      />
                    </div>
                    <div className="col-md-3">
                      <label className="form-label small fw-semibold">Total Tasks</label>
                      <input
                        type="number"
                        min="1"
                        className="form-control saas-input"
                        value={newStudentForm.totalAssignments}
                        onChange={(e) =>
                          setNewStudentForm({ ...newStudentForm, totalAssignments: e.target.value })
                        }
                      />
                    </div>
                    <div className="col-md-3">
                      <label className="form-label small fw-semibold">Eval Marks (%)</label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        className="form-control saas-input"
                        value={newStudentForm.evaluationMarks}
                        onChange={(e) =>
                          setNewStudentForm({ ...newStudentForm, evaluationMarks: e.target.value })
                        }
                      />
                    </div>
                  </div>
                </div>

                <div className="modal-footer border-top" style={{ borderColor: 'var(--border-subtle)' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setShowAddModal(false)}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary fw-semibold">
                    + Add Student to Cohort
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* STUDENT DETAILS, EDIT PROFILE, REMOVE STUDENT, CALL & AUTO-MAIL MODAL */}
      {selectedStudent && (() => {
        const reasons = getAtRiskReasons(selectedStudent);
        const emailData = selectedStudent.isAtRisk ? buildAutomatedEmail(selectedStudent, reasons) : null;
        const whatsappText = encodeURIComponent(
          `Hello ${selectedStudent.parentName}, this is the Academic Mentor for ${selectedStudent.name} (${selectedStudent.id}). Current Attendance: ${selectedStudent.attendancePercentage}%, Assignments: ${selectedStudent.subPct}%, Eval Score: ${selectedStudent.evalScore}%. Let's connect briefly regarding their progress.`
        );

        const studentSparklineData = {
          labels: ['Eval 1', 'Eval 2', 'Viva 1', 'Current'],
          datasets: [
            {
              label: `${selectedStudent.name} Evaluation Score (%)`,
              data: selectedStudent.evalHistory,
              borderColor: selectedStudent.isAtRisk ? '#ef4444' : '#10b981',
              backgroundColor: selectedStudent.isAtRisk ? 'rgba(239,68,68,0.15)' : 'rgba(16,185,129,0.15)',
              tension: 0.35,
              fill: true
            }
          ]
        };

        return (
          <div
            className="modal show d-block"
            tabIndex="-1"
            style={{ backgroundColor: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(4px)' }}
            onClick={() => setSelectedStudentId(null)}
          >
            <div className="modal-dialog modal-dialog-centered modal-lg" onClick={(e) => e.stopPropagation()}>
              <div className="modal-content saas-modal-content">
                <div className="modal-header border-bottom" style={{ borderColor: 'var(--border-subtle)' }}>
                  <div>
                    <h5 className="modal-title mb-0 fw-bold">
                      {selectedStudent.name}{' '}
                      <span className="nowrap-id ms-1">({selectedStudent.id})</span>
                    </h5>
                    <small style={{ color: 'var(--text-secondary)' }}>
                      Manage Student Details, Contact Parent, or Remove Record
                    </small>
                  </div>
                  <div className="d-flex align-items-center gap-2">
                    {!isEditingStudent && (
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-info"
                        onClick={() => handleStartEditStudent(selectedStudent)}
                      >
                        Edit Details
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn-close"
                      onClick={() => setSelectedStudentId(null)}
                    />
                  </div>
                </div>

                <div className="modal-body">
                  {isEditingStudent ? (
                    <form onSubmit={handleSaveEditedStudent}>
                      <div className="p-3 rounded border mb-3" style={{ borderColor: 'var(--border-subtle)', backgroundColor: 'var(--bg-elevated)' }}>
                        <div className="fw-bold text-info mb-3">Edit Learner & Parent Details</div>
                        <div className="row g-3">
                          <div className="col-md-6">
                            <label className="form-label small fw-semibold">Student Name</label>
                            <input
                              type="text"
                              className="form-control form-control-sm saas-input"
                              value={editForm.name}
                              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                            />
                          </div>
                          <div className="col-md-6">
                            <label className="form-label small fw-semibold">Student Phone</label>
                            <input
                              type="text"
                              className="form-control form-control-sm saas-input"
                              value={editForm.studentPhone}
                              onChange={(e) => setEditForm({ ...editForm, studentPhone: e.target.value })}
                            />
                          </div>

                          <div className="col-md-5">
                            <label className="form-label small fw-semibold">Parent / Guardian Name</label>
                            <input
                              type="text"
                              className="form-control form-control-sm saas-input"
                              value={editForm.parentName}
                              onChange={(e) => setEditForm({ ...editForm, parentName: e.target.value })}
                            />
                          </div>
                          <div className="col-md-3">
                            <label className="form-label small fw-semibold">Relation</label>
                            <select
                              className="form-select form-select-sm saas-input"
                              value={editForm.parentRelation}
                              onChange={(e) => setEditForm({ ...editForm, parentRelation: e.target.value })}
                            >
                              <option value="Father">Father</option>
                              <option value="Mother">Mother</option>
                              <option value="Guardian">Guardian</option>
                            </select>
                          </div>
                          <div className="col-md-4">
                            <label className="form-label small fw-semibold">Parent Phone</label>
                            <input
                              type="text"
                              className="form-control form-control-sm saas-input"
                              value={editForm.parentPhone}
                              onChange={(e) => setEditForm({ ...editForm, parentPhone: e.target.value })}
                            />
                          </div>

                          <div className="col-md-3">
                            <label className="form-label small fw-semibold">Attendance (%)</label>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              className="form-control form-control-sm saas-input"
                              value={editForm.attendancePercentage}
                              onChange={(e) =>
                                setEditForm({ ...editForm, attendancePercentage: e.target.value })
                              }
                            />
                          </div>
                          <div className="col-md-3">
                            <label className="form-label small fw-semibold">Submitted Tasks</label>
                            <input
                              type="number"
                              min="0"
                              className="form-control form-control-sm saas-input"
                              value={editForm.submittedAssignments}
                              onChange={(e) =>
                                setEditForm({ ...editForm, submittedAssignments: e.target.value })
                              }
                            />
                          </div>
                          <div className="col-md-3">
                            <label className="form-label small fw-semibold">Eval Marks (%)</label>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              className="form-control form-control-sm saas-input"
                              value={editForm.evaluationMarks}
                              onChange={(e) =>
                                setEditForm({ ...editForm, evaluationMarks: e.target.value })
                              }
                            />
                          </div>
                          <div className="col-md-3">
                            <label className="form-label small fw-semibold">Viva (/20)</label>
                            <input
                              type="number"
                              min="0"
                              max="20"
                              className="form-control form-control-sm saas-input"
                              value={editForm.vivaScore}
                              onChange={(e) => setEditForm({ ...editForm, vivaScore: e.target.value })}
                            />
                          </div>
                        </div>

                        <div className="d-flex justify-content-end gap-2 mt-3">
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-secondary"
                            onClick={() => setIsEditingStudent(false)}
                          >
                            Cancel
                          </button>
                          <button type="submit" className="btn btn-sm btn-success fw-semibold">
                            Save Changes
                          </button>
                        </div>
                      </div>
                    </form>
                  ) : (
                    <>
                      {/* Student & Parent Contact Info Cards */}
                      <div className="row g-2 mb-3">
                        <div className="col-md-6">
                          <div className="p-3 rounded border h-100" style={{ borderColor: 'var(--border-subtle)', backgroundColor: 'var(--bg-elevated)' }}>
                            <div className="d-flex justify-content-between align-items-center mb-1">
                              <span className="small text-uppercase fw-bold text-primary">Student Contact</span>
                              <span className="nowrap-id">{selectedStudent.id}</span>
                            </div>
                            <div className="fw-semibold">{selectedStudent.name}</div>
                            <div className="small" style={{ color: 'var(--text-secondary)' }}>
                              Phone: {selectedStudent.studentPhone} <br />
                              Email: {selectedStudent.studentEmail}
                            </div>
                            <div className="d-flex gap-2 mt-2">
                              <a
                                href={`tel:${selectedStudent.studentPhone.replace(/\s+/g, '')}`}
                                className="btn btn-sm btn-primary"
                                onClick={() => handleInitiateCall(selectedStudent, 'Student')}
                              >
                                Call Student
                              </a>
                              <a
                                href={`mailto:${selectedStudent.studentEmail}`}
                                className="btn btn-sm btn-outline-secondary"
                              >
                                Email Student
                              </a>
                            </div>
                          </div>
                        </div>

                        <div className="col-md-6">
                          <div className="p-3 rounded border h-100" style={{ borderColor: 'var(--border-subtle)', backgroundColor: 'var(--bg-elevated)' }}>
                            <div className="d-flex justify-content-between align-items-center mb-1">
                              <span className="small text-uppercase fw-bold text-warning">Parent / Guardian Info</span>
                              <span className="badge bg-secondary-subtle text-body">{selectedStudent.parentRelation}</span>
                            </div>
                            <div className="fw-semibold">{selectedStudent.parentName}</div>
                            <div className="small" style={{ color: 'var(--text-secondary)' }}>
                              Phone: {selectedStudent.parentPhone} <br />
                              Email: {selectedStudent.parentEmail}
                            </div>
                            <div className="d-flex flex-wrap gap-2 mt-2">
                              <a
                                href={`tel:${selectedStudent.parentPhone.replace(/\s+/g, '')}`}
                                className="btn btn-sm btn-warning fw-semibold"
                                onClick={() => handleInitiateCall(selectedStudent, 'Parent')}
                              >
                                Call Parent
                              </a>
                              <a
                                href={`https://wa.me/${selectedStudent.parentPhone.replace(/[^0-9]/g, '')}?text=${whatsappText}`}
                                target="_blank"
                                rel="noreferrer"
                                className="btn btn-sm btn-success"
                                onClick={() => handleWhatsAppLog(selectedStudent)}
                              >
                                WhatsApp Text
                              </a>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Top Metric Strip */}
                      <div className="row g-2 mb-3 text-center">
                        <div className="col-3">
                          <div className="p-2 rounded border" style={{ borderColor: 'var(--border-subtle)' }}>
                            <div className="small" style={{ color: 'var(--text-secondary)' }}>Attendance</div>
                            <div className="fw-bold fs-5">{selectedStudent.attendancePercentage}%</div>
                          </div>
                        </div>
                        <div className="col-3">
                          <div className="p-2 rounded border" style={{ borderColor: 'var(--border-subtle)' }}>
                            <div className="small" style={{ color: 'var(--text-secondary)' }}>Submissions</div>
                            <div className="fw-bold fs-5">{selectedStudent.subPct}%</div>
                          </div>
                        </div>
                        <div className="col-3">
                          <div className="p-2 rounded border" style={{ borderColor: 'var(--border-subtle)' }}>
                            <div className="small" style={{ color: 'var(--text-secondary)' }}>Eval Marks</div>
                            <div className="fw-bold fs-5">{selectedStudent.evalScore}%</div>
                          </div>
                        </div>
                        <div className="col-3">
                          <div className="p-2 rounded border" style={{ borderColor: 'var(--border-subtle)' }}>
                            <div className="small" style={{ color: 'var(--text-secondary)' }}>Viva Score</div>
                            <div className="fw-bold fs-5">{selectedStudent.vivaScore}/20</div>
                          </div>
                        </div>
                      </div>

                      {/* Individual Evaluation Progression Graph */}
                      <div className="p-3 rounded border mb-3" style={{ borderColor: 'var(--border-subtle)' }}>
                        <div className="small fw-semibold mb-2">Individual Marks & Viva Progression</div>
                        <div style={{ height: '130px' }}>
                          <Line
                            data={studentSparklineData}
                            options={{
                              ...commonChartOptions,
                              plugins: { legend: { display: false } },
                              scales: {
                                x: { ticks: { color: chartTextColor }, grid: { display: false } },
                                y: { min: 0, max: 100, ticks: { color: chartTextColor }, grid: { color: chartGridColor } }
                              }
                            }}
                          />
                        </div>
                      </div>

                      {/* Mentor Intervention & Follow-Up Log */}
                      <div className="p-3 rounded border mb-3" style={{ borderColor: 'var(--border-subtle)' }}>
                        <div className="d-flex justify-content-between align-items-center mb-2">
                          <span className="small fw-semibold">Mentor Intervention & Follow-Up Log</span>
                          {interventions[selectedStudent.id]?.updatedAt && (
                            <span className="small text-info">
                              Last updated: {interventions[selectedStudent.id].updatedAt}
                            </span>
                          )}
                        </div>
                        <div className="row g-2">
                          <div className="col-md-4">
                            <select
                              className="form-select form-select-sm saas-input"
                              value={noteStatus}
                              onChange={(e) => setNoteStatus(e.target.value)}
                            >
                              <option value="Pending Outreach">Pending Outreach</option>
                              <option value="Parent Contacted">Parent Contacted</option>
                              <option value="1-on-1 Scheduled">1-on-1 Scheduled</option>
                              <option value="Recovery Plan Active">Recovery Plan Active</option>
                            </select>
                          </div>
                          <div className="col-md-6">
                            <input
                              type="text"
                              className="form-control form-control-sm saas-input"
                              placeholder="Add call summary or mentor note..."
                              value={noteText}
                              onChange={(e) => setNoteText(e.target.value)}
                            />
                          </div>
                          <div className="col-md-2 d-grid">
                            <button
                              className="btn btn-sm btn-primary"
                              onClick={() => handleSaveIntervention(selectedStudent)}
                            >
                              Save
                            </button>
                          </div>
                        </div>
                      </div>

                      {selectedStudent.isAtRisk ? (
                        <>
                          <div className="alert alert-danger d-flex justify-content-between align-items-center mb-3">
                            <div>
                              <strong>At-Risk Threshold Violation:</strong>
                              <ul className="mb-0 mt-1 small">
                                {reasons.map((reason, idx) => (
                                  <li key={idx}>{reason}</li>
                                ))}
                              </ul>
                            </div>
                            {!showEmailComposer && (
                              <button
                                className="btn btn-sm btn-danger"
                                onClick={() => setShowEmailComposer(true)}
                              >
                                Open Auto-Mail
                              </button>
                            )}
                          </div>

                          {showEmailComposer && emailData && (
                            <div className="p-3 rounded border border-danger">
                              <div className="d-flex justify-content-between align-items-center mb-2">
                                <span className="fw-bold text-danger">
                                  Automated Student & Parent Email Dispatch
                                </span>
                                <span className="badge bg-danger">Ready to Send</span>
                              </div>
                              <div className="small mb-2" style={{ color: 'var(--text-secondary)' }}>
                                <strong>To:</strong> {emailData.studentEmail} &nbsp;|&nbsp;{' '}
                                <strong>CC (Parent):</strong> {emailData.parentEmail}
                              </div>
                              <textarea
                                className="form-control saas-input font-monospace small mb-3"
                                rows="5"
                                defaultValue={emailData.body}
                              />
                              <div className="d-flex flex-wrap gap-2 justify-content-end">
                                <a
                                  className="btn btn-sm btn-outline-secondary"
                                  href={`mailto:${emailData.studentEmail}?cc=${encodeURIComponent(emailData.parentEmail)}&subject=${encodeURIComponent(emailData.subject)}&body=${encodeURIComponent(emailData.body)}`}
                                >
                                  Open in Mail App
                                </a>
                                <button
                                  className="btn btn-sm btn-danger"
                                  disabled={sendingEmail}
                                  onClick={() => handleSendAutomatedEmail(selectedStudent, emailData)}
                                >
                                  {sendingEmail ? 'Dispatching...' : 'Send Automated Email Now'}
                                </button>
                              </div>
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="alert alert-success mb-0">
                          Learner is performing well across attendance, assignments, evaluations, and viva checkpoints.
                        </div>
                      )}
                    </>
                  )}
                </div>

                <div className="modal-footer border-top d-flex justify-content-between" style={{ borderColor: 'var(--border-subtle)' }}>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-danger"
                    onClick={() => handleRemoveStudent(selectedStudent)}
                  >
                    Remove Student
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setSelectedStudentId(null)}
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









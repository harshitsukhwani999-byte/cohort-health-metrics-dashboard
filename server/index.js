import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());

// In-memory store for Mentor Interventions
const interventionLogs = {};

// GET /api/cohort - Serves cohort health metrics data
app.get('/api/cohort', (req, res) => {
  try {
    const dataPath = path.join(__dirname, '../src/data/samplecohort.json');
    const rawData = fs.readFileSync(dataPath, 'utf-8');
    const cohortData = JSON.parse(rawData);
    res.status(200).json({ ...cohortData, interventions: interventionLogs });
  } catch {
    res.status(500).json({ error: 'Failed to load cohort metrics data from server.' });
  }
});

// POST /api/send-alert - Single Automated Email Dispatch
app.post('/api/send-alert', (req, res) => {
  const { studentId, studentName, studentEmail, parentEmail, subject } = req.body;
  if (!studentId || !studentEmail) {
    return res.status(400).json({ error: 'Student ID and email are required.' });
  }

  console.log(`[SINGLE ALERT] To: ${studentEmail} | CC: ${parentEmail} | Subject: ${subject}`);
  res.status(200).json({
    success: true,
    message: `Automated warning email dispatched to ${studentName} (${studentEmail}) and Parent (${parentEmail}).`
  });
});

// POST /api/send-bulk-alerts - Batch Email Dispatch for All At-Risk Learners
app.post('/api/send-bulk-alerts', (req, res) => {
  const { recipients } = req.body;
  if (!Array.isArray(recipients) || recipients.length === 0) {
    return res.status(400).json({ error: 'No at-risk recipients provided.' });
  }

  console.log(`[BULK ALERT DISPATCHED] Count: ${recipients.length} students & parents notified.`);
  res.status(200).json({
    success: true,
    message: `Batch alert successfully dispatched to ${recipients.length} At-Risk learners and their parents/guardians.`
  });
});

// POST /api/interventions - Save Mentor Notes & Follow-Up Status
app.post('/api/interventions', (req, res) => {
  const { studentId, status, note } = req.body;
  if (!studentId) {
    return res.status(400).json({ error: 'Student ID is required.' });
  }

  interventionLogs[studentId] = {
    status: status || 'Pending Outreach',
    note: note || '',
    updatedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  };

  res.status(200).json({
    success: true,
    intervention: interventionLogs[studentId]
  });
});

app.listen(PORT, () => {
  console.log(`Cohort Health API running on http://localhost:${PORT}/api/cohort`);
});
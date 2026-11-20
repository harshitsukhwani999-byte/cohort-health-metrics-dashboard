const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());

// GET /api/cohort - Serves cohort health metrics data
app.get('/api/cohort', (req, res) => {
  try {
    const dataPath = path.join(__dirname, '../src/data/samplecohort.json');
    const rawData = fs.readFileSync(dataPath, 'utf-8');
    const cohortData = JSON.parse(rawData);
    res.status(200).json(cohortData);
  } catch (error) {
    res.status(500).json({ error: 'Failed to load cohort metrics data.' });
  }
});

app.listen(PORT, () => {
  console.log(`Cohort Health API running on http://localhost:${PORT}/api/cohort`);
});
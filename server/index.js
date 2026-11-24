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

// GET /api/cohort - Serves cohort health metrics data (FR-11)
app.get('/api/cohort', (req, res) => {
  try {
    const dataPath = path.join(__dirname, '../src/data/samplecohort.json');
    const rawData = fs.readFileSync(dataPath, 'utf-8');
    const cohortData = JSON.parse(rawData);
    res.status(200).json(cohortData);
  } catch {
    res.status(500).json({ error: 'Failed to load cohort metrics data from server.' });
  }
});

app.listen(PORT, () => {
  console.log(`Cohort Health API running on http://localhost:${PORT}/api/cohort`);
});
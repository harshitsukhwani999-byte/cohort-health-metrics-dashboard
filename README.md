# Cohort Health Metrics Dashboard (`PST_AD_055`)

An interactive full-stack analytics dashboard built for **Academic Mentors** and **Program Leads** to track student attendance, assignment submission rates, and early at-risk flags across a 75-student cohort.

---

## Key Features & PRD Mapping

| Requirement ID | Feature | Implementation Details |
| :--- | :--- | :--- |
| **FR-01 & FR-09** | Cohort Dataset & Graceful Handling | Loaded a 75-student dataset (`STU-001` to `STU-075`) with zero-division and empty-state safety. |
| **FR-02** | Cohort Summary Metrics | Real-time calculation of **Total Students**, **Avg Attendance %**, **Avg Submission %**, and **At-Risk Count**. |
| **FR-03 – FR-05** | Threshold & Status Flagging | Automatically flags students as **At Risk** if `Attendance < 75%` or `Submission Rate < 60%`. |
| **FR-06** | Student Details Modal | Interactive row/button modal displaying pending assignments and exact threshold violation reasons. |
| **FR-07** | Search, Filter & Multi-Sort | Live search by Name/ID, **Only At-Risk** toggle switch, and ascending/descending sorting by Attendance & Submissions. |
| **FR-08** | Filtered CSV Export | Client-side `Blob` export (`cohort_health_report.csv`) exporting currently filtered/sorted student records. |
| **FR-10** | Role-Based Access View | Dynamic **Mentor View** (operational tracking) and **Program Lead View** (executive analytics + CSV reporting). |
| **FR-11** | Full-Stack REST API | Node.js & Express backend (`/api/cohort`) with automatic local JSON fallback if offline. |
| **FR-12** | Error & Action Feedback | Actionable alert banners with one-click **Retry API** and **Reset Filters** recovery controls. |
| **Stretch Goal** | Interactive Visualizations | Built with `Chart.js` & `react-chartjs-2` (Cohort Risk Doughnut Chart & Attendance Distribution Bar Chart). |

---

## Tech Stack

- **Frontend:** React 19, Vite, Bootstrap 5, Chart.js (`react-chartjs-2`)
- **Backend:** Node.js, Express.js, CORS
- **Data Layer:** Structured JSON Cohort Dataset (`75 Students`), PostgreSQL-ready REST endpoint

---

## Project Structure

```text
cohort-health-metrics-dashboard/
├── server/
│   ├── index.js               # Express REST API serving GET /api/cohort
│   └── package.json
├── src/
│   ├── data/
│   │   └── samplecohort.json  # 75-student cohort dataset
│   ├── utils/
│   │   └── metrics.js         # Core attendance & submission calculation utilities
│   ├── App.jsx                # Main dashboard, charts, role switcher, modal & CSV export
│   └── main.jsx
├── package.json
└── README.md
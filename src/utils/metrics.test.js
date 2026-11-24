import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateSubmissionPercentage,
  calculateCohortAverageAttendance
} from './metrics.js';

test('calculateSubmissionPercentage computes accurate rounded percentage', () => {
  assert.equal(calculateSubmissionPercentage(8, 10), 80);
  assert.equal(calculateSubmissionPercentage(5, 8), 63);
});

test('calculateSubmissionPercentage handles 0 totalAssignments safely (FR-09)', () => {
  assert.equal(calculateSubmissionPercentage(0, 0), 0);
  assert.equal(calculateSubmissionPercentage(5, 0), 0);
});

test('calculateCohortAverageAttendance computes cohort average accurately', () => {
  const sampleStudents = [
    { attendancePercentage: 80 },
    { attendancePercentage: 90 },
    { attendancePercentage: 70 }
  ];
  assert.equal(calculateCohortAverageAttendance(sampleStudents), 80);
});

test('calculateCohortAverageAttendance returns 0 for empty student list', () => {
  assert.equal(calculateCohortAverageAttendance([]), 0);
});
import assert from 'assert';
import {
  validateUpdateSections,
  getDeadlineStatus,
  DEFAULT_APP_TIMEZONE,
  CUTOFF_HOUR,
  CUTOFF_MINUTE,
  COMPANY_REPORT_TO,
  COMPANY_REPORT_CC,
} from './validation.ts';

console.log('--- Running EMS Unit Tests ---');

// 1. Test validation logic
console.log('Testing validateUpdateSections...');
const emptyResult = validateUpdateSections({});
assert.strictEqual(emptyResult.valid, false, 'Empty payload should be invalid');
assert.strictEqual(emptyResult.errors.length, 1, "Should require Today's Tasks");

const validResult = validateUpdateSections({
  todaysTasks: ['Complete circuit floorplan', 'Timing closure'],
  suddenTasks: ['Debug clock jitter'],
  blockers: [],
  plansGoingForward: ['Run DRC checks'],
});
assert.strictEqual(validResult.valid, true, 'Valid payload should pass');
assert.strictEqual(validResult.sanitized.todaysTasks.length, 2);
assert.strictEqual(validResult.sanitized.suddenTasks.length, 1);
assert.strictEqual(validResult.sanitized.blockers.length, 0);
assert.strictEqual(validResult.sanitized.plansGoingForward.length, 1);

// 2. Test Deadline Status logic
console.log('Testing getDeadlineStatus...');
// Midday test (e.g., 2:00 PM Asia/Dhaka)
const midday = new Date('2026-10-18T08:00:00Z'); // 14:00 in UTC+6
const middayStatus = getDeadlineStatus(midday, 'Asia/Dhaka');
assert.strictEqual(middayStatus.isLocked, false, 'Midday should not be locked');
assert.ok(middayStatus.remainingSeconds > 0, 'Remaining seconds should be positive');

// Past cutoff test (e.g., 11:35 PM Asia/Dhaka)
const pastCutoff = new Date('2026-10-18T17:35:00Z'); // 23:35 in UTC+6
const pastStatus = getDeadlineStatus(pastCutoff, 'Asia/Dhaka');
assert.strictEqual(pastStatus.isLocked, true, '23:35 should be locked');
assert.strictEqual(pastStatus.remainingSeconds, 0, 'Remaining seconds should be 0 when locked');

// 3. Test Recipients configuration
console.log('Testing Company Report recipients...');
assert.strictEqual(COMPANY_REPORT_TO, 'foez.ahmed@adnsemicon.com');
assert.ok(COMPANY_REPORT_CC.includes('mohiuddin.reyad@adnsemicon.com'));
assert.ok(COMPANY_REPORT_CC.includes('farhan.efty@adnsemicon.com'));

console.log('All EMS unit tests passed successfully!');

const path = require('path');
const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// MySQL connection
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root', // change as needed
  password: 'root', // change as needed
  database: 'aws'
});

db.connect((err) => {
  if (err) {
    console.error('DB connection failed:', err);
  } else {
    console.log('Connected to MySQL');
  }
});

// Create tables if not exist
db.query(`
  CREATE TABLE IF NOT EXISTS exams (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    timeLimitMinutes INT DEFAULT 30,
    passPercent INT DEFAULT 70,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`, (err) => {
  if (err) console.error('Create exams table error:', err);
});

db.query(`
  CREATE TABLE IF NOT EXISTS questions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    exam_id INT,
    text TEXT NOT NULL,
    answers JSON,
    correct JSON,
    isMulti BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE
  )
`, (err) => {
  if (err) console.error('Create questions table error:', err);
});

db.query(`
  CREATE TABLE IF NOT EXISTS exam_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    exam_name VARCHAR(255) NOT NULL,
    pct INT DEFAULT 0,
    correct INT DEFAULT 0,
    total INT DEFAULT 0,
    passed BOOLEAN DEFAULT FALSE,
    time_taken INT DEFAULT 0,
    pass_percent INT DEFAULT 0,
    date DATETIME,
    details JSON
  )
`, (err) => {
  if (err) console.error('Create exam_history table error:', err);
});

function parseJSONOrArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string') return [value];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed;
    return [parsed];
  } catch {
    const trimmed = value.trim();
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      return JSON.parse(trimmed.replace(/,\s*$/, ']'));
    }
    if (trimmed.includes(',')) {
      return trimmed.split(',').map(item => item.trim()).filter(Boolean);
    }
    return [trimmed];
  }
}

function normalizeDetails(details) {
  if (Array.isArray(details)) return details;
  if (typeof details === 'string') {
    try { return JSON.parse(details); } catch (err) { return []; }
  }
  return [];
}

// API endpoints
app.post('/save-exam', (req, res) => {
  const { name, desc, timeLimitMinutes, passPercent, questions } = req.body;
  const sql = 'INSERT INTO exams (name, description, timeLimitMinutes, passPercent) VALUES (?, ?, ?, ?)';
  db.query(sql, [name, desc, timeLimitMinutes, passPercent], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    const examId = result.insertId;
    const qSql = 'INSERT INTO questions (exam_id, text, answers, correct, isMulti) VALUES ?';
    const qValues = questions.map(q => [examId, q.text, JSON.stringify(q.answers), JSON.stringify(q.correct), q.isMulti]);
    db.query(qSql, [qValues], (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ examId });
    });
  });
});

app.get('/exams', (req, res) => {
  const sql = 'SELECT id, name, description, timeLimitMinutes, passPercent, createdAt FROM exams ORDER BY createdAt DESC';
  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

app.get('/exam/:id', (req, res) => {
  const examId = req.params.id;
  const examSql = 'SELECT * FROM exams WHERE id = ?';
  db.query(examSql, [examId], (err, examResults) => {
    if (err) return res.status(500).json({ error: err.message });
    if (examResults.length === 0) return res.status(404).json({ error: 'Exam not found' });
    const exam = examResults[0];
    const qSql = 'SELECT text, answers, correct, isMulti FROM questions WHERE exam_id = ? ORDER BY id';
    db.query(qSql, [examId], (err, qResults) => {
      if (err) return res.status(500).json({ error: err.message });
      exam.questions = qResults.map(q => ({
        text: q.text,
        answers: parseJSONOrArray(q.answers),
        correct: parseJSONOrArray(q.correct)
          .map(ch => {
            if (typeof ch === 'number' && Number.isInteger(ch)) return ch;
            if (typeof ch === 'string') {
              const trimmed = ch.trim();
              if (/^[0-9]+$/.test(trimmed)) return parseInt(trimmed, 10);
              const letterMatch = trimmed.toUpperCase().match(/^([A-E])$/);
              if (letterMatch) return letterMatch[1].charCodeAt(0) - 65;
            }
            return null;
          })
          .filter(idx => Number.isInteger(idx) && idx >= 0),
        isMulti: q.isMulti
      }));
      res.json(exam);
    });
  });
});

app.put('/exam/:id', (req, res) => {
  const examId = req.params.id;
  const { name, desc, timeLimitMinutes, passPercent, questions } = req.body;
  const sql = 'UPDATE exams SET name = ?, description = ?, timeLimitMinutes = ?, passPercent = ? WHERE id = ?';
  db.query(sql, [name, desc, timeLimitMinutes, passPercent, examId], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Exam not found' });
    // Delete old questions
    db.query('DELETE FROM questions WHERE exam_id = ?', [examId], (err) => {
      if (err) return res.status(500).json({ error: err.message });
      // Insert new questions
      const qSql = 'INSERT INTO questions (exam_id, text, answers, correct, isMulti) VALUES ?';
      const qValues = questions.map(q => [examId, q.text, JSON.stringify(q.answers), JSON.stringify(q.correct), q.isMulti]);
      db.query(qSql, [qValues], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ examId });
      });
    });
  });
});

app.delete('/exam/:id', (req, res) => {
  const examId = req.params.id;
  const sql = 'DELETE FROM exams WHERE id = ?';
  db.query(sql, [examId], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Exam not found' });
    res.json({ message: 'Exam deleted' });
  });
});

app.post('/history', (req, res) => {
  const { examName, pct, correct, total, passed, timeTaken, passPercent, date, details } = req.body;
  const sql = 'INSERT INTO exam_history (exam_name, pct, correct, total, passed, time_taken, pass_percent, date, details) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)';
  const dateValue = date ? new Date(date) : new Date();
  db.query(sql, [examName, pct, correct, total, passed ? 1 : 0, timeTaken, passPercent, dateValue, JSON.stringify(details || [])], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ historyId: result.insertId });
  });
});

app.get('/history', (req, res) => {
  const sql = `SELECT id, exam_name AS examName, pct, correct, total, passed, time_taken AS timeTaken, pass_percent AS passPercent, DATE_FORMAT(date, '%Y-%m-%dT%H:%i:%s') AS date, details FROM exam_history ORDER BY date DESC`;
  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    results.forEach(r => {
      r.details = normalizeDetails(r.details);
      r.passed = Boolean(r.passed);
    });
    res.json(results);
  });
});

app.delete('/history/:id', (req, res) => {
  const historyId = req.params.id;
  const sql = 'DELETE FROM exam_history WHERE id = ?';
  db.query(sql, [historyId], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    if (result.affectedRows === 0) return res.status(404).json({ error: 'History entry not found' });
    res.json({ message: 'History entry deleted' });
  });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(3000, () => {
  console.log('Server running on port 3000');
});
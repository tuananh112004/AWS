const path = require('path');
const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

const mongoUri = process.env.MONGODB_URI || 'mongodb+srv://bonsdark02:cunto2004@cluster0.hhxrjre.mongodb.net/?retryWrites=true&w=majority';
const dbName = process.env.MONGODB_DB_NAME || 'aws';

let db;
let examsCollection;
let historyCollection;

async function initDb() {
  try {
    const client = new MongoClient(mongoUri);
    await client.connect();
    db = client.db(dbName);
    examsCollection = db.collection('exams');
    historyCollection = db.collection('exam_history');

    await examsCollection.createIndex({ createdAt: -1 });
    await historyCollection.createIndex({ date: -1 });

    console.log('Connected to MongoDB');
    return client;
  } catch (err) {
    console.error('MongoDB connection failed:', err);
    process.exit(1);
  }
}

initDb().then(client => {
  app.listen(3000, () => {
    console.log('Server running on port 3000');
  });
}).catch(() => {
  process.exit(1);
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

function mapExamForList(exam) {
  return {
    id: exam._id.toString(),
    name: exam.name,
    description: exam.description,
    timeLimitMinutes: exam.timeLimitMinutes,
    passPercent: exam.passPercent,
    createdAt: exam.createdAt
  };
}

app.post('/save-exam', async (req, res) => {
  const { name, desc, timeLimitMinutes, passPercent, questions } = req.body;
  if (!Array.isArray(questions) || questions.length === 0) {
    return res.status(400).json({ error: 'Exam must include questions' });
  }

  const examDoc = {
    name,
    description: desc,
    timeLimitMinutes,
    passPercent,
    createdAt: new Date(),
    questions: questions.map(q => ({
      text: q.text,
      answers: Array.isArray(q.answers) ? q.answers : [],
      correct: Array.isArray(q.correct) ? q.correct : q.correct !== undefined ? [q.correct] : [],
      isMulti: Boolean(q.isMulti)
    }))
  };

  try {
    const result = await examsCollection.insertOne(examDoc);
    res.json({ examId: result.insertedId.toString() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/exams', async (req, res) => {
  try {
    const exams = await examsCollection
      .find({}, { projection: { name: 1, description: 1, timeLimitMinutes: 1, passPercent: 1, createdAt: 1 } })
      .sort({ createdAt: -1 })
      .toArray();
    res.json(exams.map(mapExamForList));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/exam/:id', async (req, res) => {
  const examId = req.params.id;
  let objectId;

  try {
    objectId = new ObjectId(examId);
  } catch {
    return res.status(400).json({ error: 'Invalid exam ID' });
  }

  try {
    const exam = await examsCollection.findOne({ _id: objectId });
    if (!exam) {
      return res.status(404).json({ error: 'Exam not found' });
    }

    exam.id = exam._id.toString();
    delete exam._id;
    res.json(exam);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/exam/:id', async (req, res) => {
  const examId = req.params.id;
  const { name, desc, timeLimitMinutes, passPercent, questions } = req.body;
  let objectId;

  try {
    objectId = new ObjectId(examId);
  } catch {
    return res.status(400).json({ error: 'Invalid exam ID' });
  }

  try {
    const update = {
      $set: {
        name,
        description: desc,
        timeLimitMinutes,
        passPercent,
        questions: Array.isArray(questions) ? questions.map(q => ({
          text: q.text,
          answers: Array.isArray(q.answers) ? q.answers : [],
          correct: Array.isArray(q.correct) ? q.correct : q.correct !== undefined ? [q.correct] : [],
          isMulti: Boolean(q.isMulti)
        })) : []
      }
    };

    const result = await examsCollection.updateOne({ _id: objectId }, update);
    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'Exam not found' });
    }
    res.json({ examId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/exam/:id', async (req, res) => {
  const examId = req.params.id;
  let objectId;

  try {
    objectId = new ObjectId(examId);
  } catch {
    return res.status(400).json({ error: 'Invalid exam ID' });
  }

  try {
    const result = await examsCollection.deleteOne({ _id: objectId });
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Exam not found' });
    }
    res.json({ message: 'Exam deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/history', async (req, res) => {
  const { examName, pct, correct, total, passed, timeTaken, passPercent, date, details } = req.body;
  const historyDoc = {
    examName,
    pct,
    correct,
    total,
    passed: Boolean(passed),
    timeTaken,
    passPercent,
    date: date ? new Date(date) : new Date(),
    details: Array.isArray(details) ? details : normalizeDetails(details)
  };

  try {
    const result = await historyCollection.insertOne(historyDoc);
    res.json({ historyId: result.insertedId.toString() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/history', async (req, res) => {
  try {
    const history = await historyCollection.find({}).sort({ date: -1 }).toArray();
    const mapped = history.map(entry => ({
      id: entry._id.toString(),
      examName: entry.examName,
      pct: entry.pct,
      correct: entry.correct,
      total: entry.total,
      passed: Boolean(entry.passed),
      timeTaken: entry.timeTaken,
      passPercent: entry.passPercent,
      date: entry.date instanceof Date ? entry.date.toISOString() : entry.date,
      details: normalizeDetails(entry.details)
    }));
    res.json(mapped);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/history/:id', async (req, res) => {
  const historyId = req.params.id;
  let objectId;

  try {
    objectId = new ObjectId(historyId);
  } catch {
    return res.status(400).json({ error: 'Invalid history ID' });
  }

  try {
    const result = await historyCollection.deleteOne({ _id: objectId });
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'History entry not found' });
    }
    res.json({ message: 'History entry deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

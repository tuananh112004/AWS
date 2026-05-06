/* ============================================================
   ExamCraft — app.js
   Toàn bộ logic: Admin, Exam, Scoring, History
   ============================================================ */

'use strict';

// ── STATE ─────────────────────────────────────────────────────
let adminQuestions = [];   // câu hỏi đang soạn
let currentExam   = null;  // đề đang thi { name, time, pass, questions }
let userAnswers   = {};    // { qIndex: Set(answerIndexes) }
let timerInterval = null;
let timeLeft      = 0;
let examStartTime = null;
let isPracticeMode = false; // true for practice, false for exam
let showCorrect = false; // for practice mode
let selectedQuestionIndexes = [];

// ── SCREEN MANAGEMENT ────────────────────────────────────────
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));

  const screenMap = {
    'home':      'screen-home',
    'admin':     'screen-admin',
    'manage':    'screen-manage',
    'exam-load': 'screen-exam-load',
    'exam':      'screen-exam',
    'result':    'screen-result',
    'history':   'screen-history',
  };
  const tabMap = {
    'home': 'tab-home', 'admin': 'tab-admin', 'manage': 'tab-manage',
    'exam-load': 'tab-exam', 'exam': 'tab-exam',
    'result': 'tab-exam', 'history': 'tab-history',
  };

  const screenEl = document.getElementById(screenMap[id]);
  if (screenEl) screenEl.classList.add('active');
  const tabEl = document.getElementById(tabMap[id]);
  if (tabEl) tabEl.classList.add('active');

  if (id === 'history') renderHistory();
  if (id === 'manage') loadManageExams();
  if (id === 'admin' && adminQuestions.length === 0) addQuestion();
}

// ── TOAST ──────────────────────────────────────────────────────
function toast(msg, type = '') {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2800);
}

// ── ADMIN: QUESTION EDITOR ────────────────────────────────────
function addQuestion(data = null) {
  const q = data || {
    text: '',
    answers: ['', '', '', '', '', ''],
    correct: [], // array of indexes
    isMulti: false,
  };
  adminQuestions.push(q);
  renderAdminQuestions();
  // scroll to new question
  setTimeout(() => {
    const cards = document.querySelectorAll('.question-card');
    if (cards.length) cards[cards.length - 1].scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, 80);
}

function removeQuestion(idx) {
  adminQuestions.splice(idx, 1);
  renderAdminQuestions();
}

function clearAllQuestions() {
  if (adminQuestions.length === 0) return;
  if (!confirm('Xoá tất cả câu hỏi?')) return;
  adminQuestions = [];
  document.getElementById('export-area').style.display = 'none';
  renderAdminQuestions();
}

function resetAdminData() {
  // Clear all questions and reset form fields
  adminQuestions = [];
  document.getElementById('exam-name').value = 'Đề thi trắc nghiệm';
  document.getElementById('exam-time').value = '30';
  document.getElementById('exam-pass').value = '70';
  document.getElementById('exam-desc').value = '';
  document.getElementById('export-area').style.display = 'none';
  renderAdminQuestions();
}

function renderAdminQuestions() {
  const container = document.getElementById('questions-container');
  if (adminQuestions.length === 0) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">📋</div><p>Chưa có câu hỏi nào. Nhấn "+ Thêm câu hỏi" để bắt đầu.</p></div>`;
    return;
  }

  container.innerHTML = adminQuestions.map((q, qi) => `
    <div class="question-card" id="qcard-${qi}">
      <div class="q-header">
        <div class="q-num">${qi + 1}</div>
        <div class="q-num-title">Câu hỏi ${qi + 1}</div>
        <span class="tag ${q.isMulti ? 'tag-multi' : 'tag-single'}">${q.isMulti ? '☑ Nhiều đáp án' : '○ Một đáp án'}</span>
        <button class="btn btn-danger btn-sm q-delete" onclick="removeQuestion(${qi})">✕ Xoá</button>
      </div>

      <div style="margin-bottom:10px;">
        <label class="field-label">Nội dung câu hỏi</label>
        <textarea placeholder="Nhập nội dung câu hỏi..." onchange="updateQText(${qi},this.value)">${escHtml(q.text)}</textarea>
      </div>

      <div>
        <label class="field-label">Đáp án (click vào chữ cái để đánh dấu đúng)</label>
        <div class="answers-grid">
          ${q.answers.map((ans, ai) => {
            const isCorrect = q.correct.includes(ai);
            return `
              <div class="answer-row">
                <div class="answer-label ${isCorrect ? 'correct' : ''}"
                     title="Đánh dấu đáp án đúng"
                     onclick="toggleCorrect(${qi},${ai},${q.isMulti})">${'ABCDEF'[ai]}</div>
                <input type="text" placeholder="Đáp án ${'ABCDEF'[ai]}..."
                       value="${escHtml(ans)}"
                       oninput="updateAnswer(${qi},${ai},this.value)">
              </div>`;
          }).join('')}
        </div>
      </div>

      <div class="correct-toggle" style="margin-top:10px;">
        <input type="checkbox" id="multi-${qi}" ${q.isMulti ? 'checked' : ''} onchange="toggleMulti(${qi},this.checked)">
        <label for="multi-${qi}" style="cursor:pointer;">Cho phép chọn nhiều đáp án đúng</label>
        <span style="margin-left:auto;font-size:11px;color:var(--accent);">
          ✓ Đúng: ${q.correct.length > 0 ? q.correct.map(i => 'ABCDEF'[i]).join(', ') : 'Chưa chọn'}
        </span>
      </div>
    </div>
  `).join('');
}

function updateQText(qi, val) { adminQuestions[qi].text = val; }
function updateAnswer(qi, ai, val) { adminQuestions[qi].answers[ai] = val; }

function toggleCorrect(qi, ai, isMulti) {
  const q = adminQuestions[qi];
  const idx = q.correct.indexOf(ai);
  if (idx === -1) {
    if (!q.isMulti) q.correct = [ai]; // single: replace
    else q.correct.push(ai);          // multi: add
  } else {
    q.correct.splice(idx, 1);
  }
  renderAdminQuestions();
}

function toggleMulti(qi, checked) {
  adminQuestions[qi].isMulti = checked;
  if (!checked && adminQuestions[qi].correct.length > 1) {
    adminQuestions[qi].correct = [adminQuestions[qi].correct[0]];
  }
  renderAdminQuestions();
}

// ── ADMIN: EXPORT ─────────────────────────────────────────────
function exportExam() {
  const errors = validateAdmin();
  if (errors.length) { toast('⚠ ' + errors[0], 'error'); return; }

  const examData = buildExamJSON();
  const json = JSON.stringify(examData, null, 2);
  document.getElementById('json-output').value = json;
  document.getElementById('export-area').style.display = 'block';
  document.getElementById('export-area').scrollIntoView({ behavior: 'smooth' });
  toast('✅ Đề thi đã được tạo!', 'success');
}

function validateAdmin() {
  const errors = [];
  if (adminQuestions.length === 0) errors.push('Thêm ít nhất 1 câu hỏi.');
  adminQuestions.forEach((q, i) => {
    if (!q.text.trim()) errors.push(`Câu ${i+1}: Thiếu nội dung câu hỏi.`);
    const filled = q.answers.filter(a => a.trim()).length;
    if (filled < 2) errors.push(`Câu ${i+1}: Cần ít nhất 2 đáp án.`);
    if (q.correct.length === 0) errors.push(`Câu ${i+1}: Chưa chọn đáp án đúng.`);
  });
  return errors;
}

function buildExamJSON() {
  return {
    name: document.getElementById('exam-name').value.trim() || 'Đề thi trắc nghiệm',
    desc: document.getElementById('exam-desc').value.trim(),
    timeLimitMinutes: parseInt(document.getElementById('exam-time').value) || 30,
    passPercent: parseInt(document.getElementById('exam-pass').value) || 70,
    createdAt: new Date().toISOString(),
    questions: adminQuestions.map(q => ({
      text: q.text.trim(),
      answers: q.answers.map(a => a.trim()),
      correct: q.correct,
      isMulti: q.isMulti,
    }))
  };
}

function parseCorrectIndex(value) {
  if (typeof value === 'number' && Number.isInteger(value) && value >= 0) return value;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (/^[0-9]+$/.test(trimmed)) {
      return parseInt(trimmed, 10);
    }
    const letterMatch = trimmed.toUpperCase().match(/^([A-E])$/);
    if (letterMatch) {
      return letterMatch[1].charCodeAt(0) - 65;
    }
  }
  return null;
}

function normalizeExamData(data) {
  return {
    ...data,
    questions: Array.isArray(data.questions) ? data.questions.map(q => ({
      text: String(q.text || ''),
      answers: Array.isArray(q.answers) ? q.answers.map(a => String(a || '')) : [],
      correct: Array.isArray(q.correct)
        ? [...new Set(q.correct
            .map(parseCorrectIndex)
            .filter(idx => Number.isInteger(idx) && idx >= 0))]
        : [],
      isMulti: Boolean(q.isMulti),
    })) : [],
  };
}

function copyJSON() {
  const ta = document.getElementById('json-output');
  ta.select();
  navigator.clipboard.writeText(ta.value).then(() => toast('📋 Đã sao chép!', 'success'));
}

function downloadJSON() {
  const json = document.getElementById('json-output').value;
  const name = (document.getElementById('exam-name').value.trim() || 'exam').replace(/\s+/g,'_');
  const blob = new Blob([json], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${name}.json`;
  a.click();
  toast('⬇ Đã tải xuống!', 'success');
}

function goToExamWithCurrent() {
  const json = document.getElementById('json-output').value;
  document.getElementById('exam-json-input').value = json;
  showScreen('exam-load');
}

function saveToDB() {
  const examData = buildExamJSON();
  fetch('http://localhost:3000/save-exam', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(examData)
  })
  .then(res => res.json())
  .then(data => {
    if (data.error) {
      toast('❌ Lỗi lưu DB: ' + data.error, 'error');
    } else {
      toast('✅ Đã lưu vào DB!', 'success');
    }
  })
  .catch(err => {
    toast('❌ Không kết nối được server. Chạy `npm start` trong thư mục project.', 'error');
  });
}

// ── ADMIN: IMPORT ─────────────────────────────────────────────
function showImport() { document.getElementById('import-modal').style.display = 'flex'; }
function hideImport()  { document.getElementById('import-modal').style.display = 'none'; }

function importJSON() {
  try {
    resetAdminData();
    const data = JSON.parse(document.getElementById('import-input').value);
    if (!data.questions || !Array.isArray(data.questions)) throw new Error('Sai định dạng');
    if (data.name) document.getElementById('exam-name').value = data.name;
    if (data.timeLimitMinutes) document.getElementById('exam-time').value = data.timeLimitMinutes;
    if (data.passPercent) document.getElementById('exam-pass').value = data.passPercent;
    if (data.desc) document.getElementById('exam-desc').value = data.desc;
    adminQuestions = data.questions.map(q => ({
      text: q.text || '',
      answers: q.answers || ['','','','','',''],
      correct: q.correct || [],
      isMulti: q.isMulti || false,
    }));
    renderAdminQuestions();
    hideImport();
    toast(`✅ Đã import ${adminQuestions.length} câu hỏi!`, 'success');
  } catch(e) {
    toast('❌ JSON không hợp lệ: ' + e.message, 'error');
  }
}

// ── MANAGE EXAMS ────────────────────────────────────────────
function loadManageExams() {
  fetch('http://localhost:3000/exams')
  .then(res => res.json())
  .then(exams => {
    renderManageList(exams);
  })
  .catch(err => {
    toast('❌ Không tải được danh sách đề thi.', 'error');
  });
}

function renderManageList(exams) {
  const container = document.getElementById('manage-list');
  if (exams.length === 0) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">📋</div><p>Chưa có đề thi nào. Tạo đề mới tại "Tạo đề".</p></div>`;
    return;
  }

  container.innerHTML = exams.map(exam => `
    <div class="card">
      <div style="display:flex;align-items:center;gap:1rem;flex-wrap:wrap;">
        <div style="flex:1;">
          <div style="font-weight:600;font-size:1.1rem;margin-bottom:4px;">${escHtml(exam.name)}</div>
          <div style="color:var(--ink-muted);font-size:0.9rem;">
            ${exam.description ? escHtml(exam.description) + ' • ' : ''}
            ${exam.timeLimitMinutes} phút • Điểm đạt ${exam.passPercent}% • 
            ${new Date(exam.createdAt).toLocaleDateString('vi-VN')}
          </div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <button class="btn btn-primary btn-sm" onclick="editExam(${exam.id})">✏️ Sửa</button>
          <button class="btn btn-danger btn-sm" onclick="deleteExam(${exam.id}, '${escHtml(exam.name)}')">🗑 Xóa</button>
        </div>
      </div>
    </div>
  `).join('');
}

function editExam(examId) {
  fetch(`http://localhost:3000/exam/${examId}`)
  .then(res => res.json())
  .then(exam => {
    // Reset admin data first
    resetAdminData();
    // Load into admin
    document.getElementById('exam-name').value = exam.name;
    document.getElementById('exam-desc').value = exam.description || '';
    document.getElementById('exam-time').value = exam.timeLimitMinutes;
    document.getElementById('exam-pass').value = exam.passPercent;
    adminQuestions = exam.questions.map(q => ({
      text: q.text,
      answers: [...(q.answers || []), '', '', '', '', '', ''].slice(0, 6),
      correct: q.correct,
      isMulti: q.isMulti,
    }));
    renderAdminQuestions();
    document.getElementById('export-area').style.display = 'none';
    // Add update button
    const exportArea = document.getElementById('export-area');
    exportArea.innerHTML = `
      <div style="margin-top:10px;">
        <button class="btn btn-primary" onclick="updateExam(${examId})">💾 Cập nhật đề thi</button>
      </div>
    `;
    exportArea.style.display = 'block';
    showScreen('admin');
    toast('✅ Đã load đề để sửa!', 'success');
  })
  .catch(err => {
    toast('❌ Lỗi load đề thi.', 'error');
  });
}

function updateExam(examId) {
  const errors = validateAdmin();
  if (errors.length) { toast('⚠ ' + errors[0], 'error'); return; }

  const examData = buildExamJSON();
  fetch(`http://localhost:3000/exam/${examId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(examData)
  })
  .then(res => res.json())
  .then(data => {
    if (data.error) {
      toast('❌ Lỗi cập nhật: ' + data.error, 'error');
    } else {
      toast('✅ Đã cập nhật đề thi!', 'success');
      showScreen('manage');
      loadManageExams();
    }
  })
  .catch(err => {
    toast('❌ Không kết nối được server.', 'error');
  });
}

function deleteExam(examId, name) {
  if (!confirm(`Xóa đề thi "${name}"?`)) return;
  fetch(`http://localhost:3000/exam/${examId}`, {
    method: 'DELETE'
  })
  .then(res => res.json())
  .then(data => {
    if (data.error) {
      toast('❌ Lỗi xóa: ' + data.error, 'error');
    } else {
      toast('✅ Đã xóa đề thi!', 'success');
      loadManageExams();
    }
  })
  .catch(err => {
    toast('❌ Không kết nối được server.', 'error');
  });
}

// ── EXAM LOAD ─────────────────────────────────────────────────
function loadJSONFile(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => { document.getElementById('exam-json-input').value = e.target.result; };
  reader.readAsText(file);
}

function loadSampleExam() {
  const sample = {
    name: "Kiến thức lập trình cơ bản",
    desc: "Đề thi mẫu dành cho lập trình viên",
    timeLimitMinutes: 10,
    passPercent: 60,
    questions: [
      { text: "Ngôn ngữ nào sau đây là ngôn ngữ lập trình hướng đối tượng?", answers: ["C", "Python", "Assembly", "HTML"], correct: [1], isMulti: false },
      { text: "HTTP status code nào được trả về khi tài nguyên không tìm thấy?", answers: ["200", "301", "404", "500"], correct: [2], isMulti: false },
      { text: "Cấu trúc dữ liệu nào hoạt động theo nguyên tắc LIFO?", answers: ["Queue", "Stack", "Linked List", "Tree"], correct: [1], isMulti: false },
      { text: "Đâu là các kiểu dữ liệu nguyên thủy (primitive) trong JavaScript?", answers: ["String", "Object", "Number", "Array"], correct: [0, 2], isMulti: true },
      { text: "SQL là viết tắt của?", answers: ["Structured Query Language", "Simple Query Language", "Standard Query List", "Sequential Query Language"], correct: [0], isMulti: false },
      { text: "Trong Git, lệnh nào dùng để tạo branch mới và chuyển sang branch đó?", answers: ["git branch new-branch", "git checkout -b new-branch", "git switch --create new-branch", "git merge new-branch"], correct: [1, 2], isMulti: true },
      { text: "REST API thường sử dụng giao thức nào?", answers: ["FTP", "HTTP/HTTPS", "SMTP", "SSH"], correct: [1], isMulti: false },
      { text: "Thuật toán nào có độ phức tạp trung bình là O(n log n)?", answers: ["Bubble Sort", "Selection Sort", "Quick Sort", "Insertion Sort"], correct: [2], isMulti: false },
    ]
  };
  document.getElementById('exam-json-input').value = JSON.stringify(sample, null, 2);
  toast('🎲 Đã load đề mẫu!', 'success');
  renderQuestionSelection(sample);
}

function previewQuestions() {
  const jsonStr = document.getElementById('exam-json-input').value.trim();
  if (!jsonStr) {
    toast('⚠ Vui lòng nhập hoặc dán JSON đề thi trước.', 'error');
    return;
  }

  try {
    const data = normalizeExamData(JSON.parse(jsonStr));
    if (!data.questions || data.questions.length === 0) throw new Error('Không có câu hỏi');
    renderQuestionSelection(data);
    toast('✅ Danh sách câu hỏi đã được cập nhật.', 'success');
  } catch (e) {
    toast('❌ JSON không hợp lệ: ' + e.message, 'error');
  }
}

function renderQuestionSelection(data) {
  selectedQuestionIndexes = data.questions.map((_, idx) => idx);
  const panel = document.getElementById('question-selection-panel');
  panel.style.display = 'block';
  panel.innerHTML = `
    <div class="card-header">Chọn câu hỏi</div>
    <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;">
      <div>Chọn câu hỏi bạn muốn làm ở chế độ thi / luyện tập.</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <button class="btn btn-sm btn-secondary" onclick="toggleSelectAll(true)">Chọn tất cả</button>
        <button class="btn btn-sm btn-secondary" onclick="toggleSelectAll(false)">Bỏ chọn</button>
      </div>
    </div>
    <div class="question-selection-summary" id="selection-summary" style="margin-top:0.75rem;font-size:0.95rem;color:var(--ink-muted);"></div>
    <div class="question-selection-list" id="question-selection-list" style="margin-top:0.75rem;display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:0.75rem;"></div>
  `;

  const list = document.getElementById('question-selection-list');
  list.innerHTML = data.questions.map((q, idx) => {
    const label = q.text.length > 80 ? escHtml(q.text.slice(0, 77) + '...') : escHtml(q.text);
    return `
      <label class="question-select-row" style="display:flex;align-items:flex-start;gap:8px;padding:0.8rem;border:1px solid var(--border);border-radius:0.75rem;cursor:pointer;">
        <input type="checkbox" checked onchange="toggleQuestionSelection(${idx}, this.checked)" style="margin-top:4px;" />
        <div>
          <div style="font-weight:600;margin-bottom:4px;">Câu ${idx + 1}</div>
          <div style="font-size:0.95rem;line-height:1.4;">${label}</div>
        </div>
      </label>`;
  }).join('');
  updateSelectionSummary();
}

function toggleQuestionSelection(idx, checked) {
  if (checked && !selectedQuestionIndexes.includes(idx)) {
    selectedQuestionIndexes.push(idx);
  } else if (!checked) {
    selectedQuestionIndexes = selectedQuestionIndexes.filter(i => i !== idx);
  }
  updateSelectionSummary();
}

function toggleSelectAll(value) {
  const inputs = document.querySelectorAll('#question-selection-list input[type=checkbox]');
  inputs.forEach((input, idx) => {
    input.checked = value;
  });
  selectedQuestionIndexes = value ? Array.from({ length: inputs.length }, (_, idx) => idx) : [];
  updateSelectionSummary();
}

function updateSelectionSummary() {
  const summary = document.getElementById('selection-summary');
  if (!summary) return;
  summary.textContent = `Đã chọn ${selectedQuestionIndexes.length} câu trên tổng ${document.querySelectorAll('#question-selection-list input[type=checkbox]').length} câu.`;
}

function loadExamsFromDB() {
  fetch('http://localhost:3000/exams')
  .then(res => res.json())
  .then(exams => {
    const select = document.getElementById('db-exam-select');
    select.innerHTML = '<option value="">-- Chọn đề thi --</option>';
    exams.forEach(exam => {
      const option = document.createElement('option');
      option.value = exam.id;
      option.textContent = `${exam.name} (${new Date(exam.createdAt).toLocaleDateString('vi-VN')})`;
      select.appendChild(option);
    });
    toast(`📚 Đã tải ${exams.length} đề thi từ DB!`, 'success');
  })
  .catch(err => {
    toast('❌ Không tải được từ DB. Chạy server trước.', 'error');
  });
}

function loadExamFromDB(examId) {
  if (!examId) return;
  fetch(`http://localhost:3000/exam/${examId}`)
  .then(res => res.json())
  .then(exam => {
    document.getElementById('exam-json-input').value = JSON.stringify(exam, null, 2);
    toast('✅ Đã load đề từ DB!', 'success');
  })
  .catch(err => {
    toast('❌ Lỗi load đề từ DB.', 'error');
  });
}

function startExam() {
  const jsonStr = document.getElementById('exam-json-input').value.trim();
  if (!jsonStr) { toast('⚠ Vui lòng nhập JSON đề thi!', 'error'); return; }

  try {
    const rawData = JSON.parse(jsonStr);
    const data = normalizeExamData(rawData);
    if (!data.questions || data.questions.length === 0) throw new Error('Không có câu hỏi');

    const panelVisible = document.getElementById('question-selection-panel')?.style.display === 'block';
    const selectedIndexes = panelVisible && selectedQuestionIndexes.length > 0
      ? selectedQuestionIndexes.filter(i => i >= 0 && i < data.questions.length)
      : data.questions.map((_, idx) => idx);

    if (panelVisible && selectedIndexes.length === 0) {
      toast('⚠ Vui lòng chọn ít nhất 1 câu hỏi.', 'error');
      return;
    }

    const questions = selectedIndexes.length > 0
      ? selectedIndexes.map(i => data.questions[i])
      : data.questions;

    currentExam = { ...data, questions };
    isPracticeMode = document.getElementById('practice-mode').checked;
    if (document.getElementById('shuffle-q').checked) {
      currentExam.questions = [...currentExam.questions].sort(() => Math.random() - 0.5);
    }

    userAnswers = {};
    examStartTime = Date.now();
    renderExamScreen();
    showScreen('exam');
    if (!isPracticeMode) startTimer(data.timeLimitMinutes || 30);
  } catch(e) {
    toast('❌ JSON không hợp lệ: ' + e.message, 'error');
  }
}

// ── EXAM SCREEN ───────────────────────────────────────────────
let currentQIndex = 0;

function renderExamScreen() {
  currentQIndex = 0;
  showCorrect = false;
  renderExamView();
}

function renderExamView() {
  const q = currentExam.questions[currentQIndex];
  const total = currentExam.questions.length;

  const el = document.getElementById('screen-exam');

  if (isPracticeMode) {
    // Practice mode: single question, show correct after answer
    const answered = userAnswers[currentQIndex] && userAnswers[currentQIndex].size > 0;
    el.innerHTML = `
      <div class="exam-topbar">
        <div class="exam-info">
          <div class="exam-title-text">${escHtml(currentExam.name)} - Luyện tập</div>
          <div class="exam-meta-row">
            <span class="meta-pill">📋 Câu ${currentQIndex + 1} / ${total}</span>
            ${currentExam.desc ? `<span class="meta-pill">ℹ ${escHtml(currentExam.desc)}</span>` : ''}
          </div>
        </div>
      </div>

      <div class="q-nav-dots">
        ${currentExam.questions.map((_,i) => {
          let cls = 'q-dot';
          if (i === currentQIndex) cls += ' current';
          if (userAnswers[i] && userAnswers[i].size > 0) cls += ' answered';
          return `<div class="${cls}" onclick="gotoQ(${i})" title="Câu ${i+1}">${i+1}</div>`;
        }).join('')}
      </div>

      <div class="question-display">
        <div class="q-badge">
          Câu ${currentQIndex + 1}
          ${q.isMulti ? '<span class="tag tag-multi" style="margin-left:4px;">☑ Nhiều đáp án</span>' : ''}
        </div>
        ${q.isMulti ? '<div class="q-multi-hint">Câu này có thể chọn nhiều đáp án đúng.</div>' : ''}
        <div class="q-text">${escHtml(q.text)}</div>
        <div class="option-list">
          ${q.answers.map((ans, ai) => {
            const sel = userAnswers[currentQIndex] && userAnswers[currentQIndex].has(ai);
            const isCorrect = q.correct.includes(ai);
            let cls = 'option-item';
            if (sel) cls += ' selected';
            if (showCorrect) {
              if (isCorrect) cls += ' correct';
              else if (sel) cls += ' wrong';
            }
            return `
              <button class="option-item ${cls}" ${showCorrect ? 'disabled' : ''}
                      onclick="toggleAnswer(${currentQIndex},${ai},${q.isMulti})">
                <div class="opt-letter">${'ABCDEF'[ai]}</div>
                <div class="opt-text">${escHtml(ans)}</div>
                ${sel ? '<div class="opt-icon">✓</div>' : ''}
              </button>`;
          }).join('')}
        </div>
      </div>

      <div class="exam-actions">
        <div style="display:flex;gap:8px;">
          ${showCorrect || answered
            ? `<button class="btn btn-primary" onclick="practiceNext()">${currentQIndex < total - 1 ? 'Câu tiếp →' : 'Hoàn thành'}</button>`
            : `<button class="btn btn-secondary" disabled>Chọn đáp án để tiếp tục</button>`
          }
        </div>
      </div>
    `;
  } else {
    // Exam mode: full view
    const answered = Object.keys(userAnswers).length;
    const pct = Math.round((answered / total) * 100);

    el.innerHTML = `
      <div class="exam-topbar">
        <div class="exam-info">
          <div class="exam-title-text">${escHtml(currentExam.name)}</div>
          <div class="exam-meta-row">
            <span class="meta-pill">📋 ${total} câu</span>
            <span class="meta-pill">✅ Đã trả lời: ${answered}/${total}</span>
            ${currentExam.desc ? `<span class="meta-pill">ℹ ${escHtml(currentExam.desc)}</span>` : ''}
          </div>
        </div>
        <div>
          <div style="font-size:11px;color:var(--ink-muted);text-align:center;margin-bottom:2px;">Thời gian</div>
          <div class="timer-display" id="timer-display">--:--</div>
        </div>
      </div>

      <div class="progress-wrap">
        <div class="progress-label">
          <span>Tiến độ làm bài</span>
          <span>${pct}%</span>
        </div>
        <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
      </div>

      <div class="q-nav-dots">
        ${currentExam.questions.map((_,i) => {
          let cls = 'q-dot';
          if (i === currentQIndex) cls += ' current';
          if (userAnswers[i] && userAnswers[i].size > 0) cls += ' answered';
          return `<div class="${cls}" onclick="gotoQ(${i})" title="Câu ${i+1}">${i+1}</div>`;
        }).join('')}
      </div>

      <div class="question-display">
        <div class="q-badge">
          Câu ${currentQIndex + 1} / ${total}
          ${q.isMulti ? '<span class="tag tag-multi" style="margin-left:4px;">☑ Nhiều đáp án</span>' : ''}
        </div>
        ${q.isMulti ? '<div class="q-multi-hint">Câu này có thể chọn nhiều đáp án đúng.</div>' : ''}
        <div class="q-text">${escHtml(q.text)}</div>
        <div class="option-list">
          ${q.answers.map((ans, ai) => {
            const sel = userAnswers[currentQIndex] && userAnswers[currentQIndex].has(ai);
            return `
              <button class="option-item ${sel ? 'selected' : ''}"
                      onclick="toggleAnswer(${currentQIndex},${ai},${q.isMulti})">
                <div class="opt-letter">${'ABCDEF'[ai]}</div>
                <div class="opt-text">${escHtml(ans)}</div>
                ${sel ? '<div class="opt-icon">✓</div>' : ''}
              </button>`;
          }).join('')}
        </div>
      </div>

      <div class="exam-actions">
        <button class="btn btn-secondary" ${currentQIndex === 0 ? 'disabled' : ''} onclick="gotoQ(${currentQIndex-1})">← Câu trước</button>
        <div style="display:flex;gap:8px;">
          ${currentQIndex < total - 1
            ? `<button class="btn btn-primary" onclick="gotoQ(${currentQIndex+1})">Câu tiếp →</button>`
            : `<button class="btn btn-dark btn-lg" onclick="confirmSubmit()">📨 Nộp bài</button>`
          }
        </div>
      </div>
    `;

    // Re-attach timer display
    updateTimerDisplay();
  }
}

function gotoQ(idx) {
  currentQIndex = idx;
  if (isPracticeMode) showCorrect = false;
  renderExamView();
}

function toggleAnswer(qi, ai, isMulti) {
  if (!userAnswers[qi]) userAnswers[qi] = new Set();
  const set = userAnswers[qi];
  if (set.has(ai)) {
    set.delete(ai);
  } else {
    if (!isMulti) set.clear(); // single-choice: clear first
    set.add(ai);
  }
  renderExamView();
}

function practiceNext() {
  if (!showCorrect) {
    showCorrect = true;
    renderExamView();
  } else {
    showCorrect = false;
    currentQIndex++;
    if (currentQIndex >= currentExam.questions.length) {
      // End practice, go to result
      confirmSubmit();
    } else {
      renderExamView();
    }
  }
}

// ── TIMER ─────────────────────────────────────────────────────
function startTimer(minutes) {
  clearInterval(timerInterval);
  timeLeft = minutes * 60;
  updateTimerDisplay();
  timerInterval = setInterval(() => {
    timeLeft--;
    updateTimerDisplay();
    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      toast('⏰ Hết giờ! Bài thi đã được nộp tự động.', 'error');
      submitExam();
    }
  }, 1000);
}

function updateTimerDisplay() {
  const el = document.getElementById('timer-display');
  if (!el) return;
  const m = Math.floor(timeLeft / 60).toString().padStart(2,'0');
  const s = (timeLeft % 60).toString().padStart(2,'0');
  el.textContent = `${m}:${s}`;
  el.classList.toggle('warning', timeLeft <= 60);
}

// ── SUBMIT ────────────────────────────────────────────────────
function confirmSubmit() {
  const total = currentExam.questions.length;
  const answered = Object.values(userAnswers).filter(s => s.size > 0).length;
  const unanswered = total - answered;

  if (unanswered > 0) {
    showModal(
      'Nộp bài?',
      `Bạn còn ${unanswered} câu chưa trả lời. Bạn có chắc muốn nộp bài không?`,
      submitExam
    );
  } else {
    submitExam();
  }
}

function submitExam() {
  clearInterval(timerInterval);
  const timeTaken = Math.floor((Date.now() - examStartTime) / 1000);
  const result = scoreExam(timeTaken);
  saveToHistory(result);
  renderResult(result);
  showScreen('result');
}

// ── SCORING ───────────────────────────────────────────────────
function scoreExam(timeTaken) {
  const questions = currentExam.questions;
  let correct = 0;
  const details = questions.map((q, qi) => {
    const userSet = userAnswers[qi] || new Set();
    const correctSet = new Set(q.correct);
    const isCorrect = setsEqual(userSet, correctSet);
    if (isCorrect) correct++;
    return { q, userAnswers: userSet, correctAnswers: correctSet, isCorrect };
  });

  const total = questions.length;
  const pct = Math.round((correct / total) * 100);
  const passed = pct >= (currentExam.passPercent || 70);
  const timeLimitSec = (currentExam.timeLimitMinutes || 30) * 60;

  return {
    examName: currentExam.name,
    total, correct, pct, passed, timeTaken, timeLimitSec,
    details,
    passPercent: currentExam.passPercent || 70,
    date: new Date().toISOString(),
  };
}

function setsEqual(a, b) {
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
}

// ── RESULT RENDER ─────────────────────────────────────────────
function renderResult(result) {
  const { total, correct, pct, passed, timeTaken, details, examName } = result;
  const wrong = total - correct;
  const tm = fmtTime(timeTaken);

  const el = document.getElementById('screen-result');
  el.innerHTML = `
    <div class="result-hero">
      <div class="score-ring-wrap">
        <div class="score-ring ${passed ? '' : 'fail'}" style="border-color:var(--${passed?'green':'red'})">
          <div class="score-pct" style="color:var(--${passed?'green':'red'})">${pct}%</div>
          <div class="score-sub">${correct}/${total} câu</div>
        </div>
      </div>
      <div class="pass-badge ${passed ? 'pass' : 'fail'}">
        ${passed ? '🎉 ĐẠT' : '❌ CHƯA ĐẠT'}
        — Điểm qua: ${result.passPercent}%
      </div>
      <div class="page-title" style="font-size:1.2rem;margin-bottom:.25rem">${escHtml(examName)}</div>
      <div class="stats-row" style="margin-top:1rem">
        <div class="stat-item">
          <div class="stat-val" style="color:var(--green)">${correct}</div>
          <div class="stat-lbl">Câu đúng</div>
        </div>
        <div class="stat-item">
          <div class="stat-val" style="color:var(--red)">${wrong}</div>
          <div class="stat-lbl">Câu sai</div>
        </div>
        <div class="stat-item">
          <div class="stat-val">${tm}</div>
          <div class="stat-lbl">Thời gian</div>
        </div>
        <div class="stat-item">
          <div class="stat-val">${pct}%</div>
          <div class="stat-lbl">Điểm số</div>
        </div>
      </div>
    </div>

    <div class="row" style="margin-bottom:1.25rem;">
      <div class="page-title" style="font-size:1.1rem;">📋 Xem lại đáp án</div>
      <div class="spacer"></div>
      <button class="btn btn-secondary" onclick="showScreen('exam-load')">🔄 Thi lại</button>
      <button class="btn btn-primary" onclick="showScreen('history')">📊 Lịch sử</button>
    </div>

    <div class="review-list">
      ${details.map((d, i) => renderReviewCard(d, i)).join('')}
    </div>
  `;
}

function renderReviewCard(d, i) {
  const { q, userAnswers: ua, correctAnswers: ca, isCorrect } = d;
  return `
    <div class="review-card">
      <div class="review-card-header" style="background:${isCorrect ? 'var(--green-lt)' : 'var(--red-lt)'}">
        <div class="review-icon">${isCorrect ? '✅' : '❌'}</div>
        <div class="review-q-text"><strong>Câu ${i+1}:</strong> ${escHtml(q.text)}</div>
      </div>
      <div class="review-card-body">
        ${q.answers.map((ans, ai) => {
          const userChose = ua.has(ai);
          const isRight   = ca.has(ai);
          let cls = '';
          let icon = '';
          if (userChose && isRight)   { cls = 'correct'; icon = '✓ Bạn chọn — Đúng'; }
          else if (userChose && !isRight) { cls = 'wrong';   icon = '✗ Bạn chọn — Sai'; }
          else if (!userChose && isRight) { cls = 'missed';  icon = '← Đáp án đúng'; }
          if (!cls) return '';
          return `<div class="review-option ${cls}">
            <strong>${'ABCDEF'[ai]}.</strong> ${escHtml(ans)}
            <span style="margin-left:auto;font-size:11px;opacity:.8">${icon}</span>
          </div>`;
        }).join('')}
        ${[...ca].every(ai => !ua.has(ai)) && ua.size === 0 ? `<div style="font-size:12px;color:var(--ink-muted);margin-top:4px;font-style:italic">Bạn chưa trả lời câu này.</div>` : ''}
      </div>
    </div>`;
}

// ── HISTORY ───────────────────────────────────────────────────
function saveToHistory(result) {
  const history = getHistory();
  history.unshift({
    examName:   result.examName,
    pct:        result.pct,
    correct:    result.correct,
    total:      result.total,
    passed:     result.passed,
    timeTaken:  result.timeTaken,
    passPercent:result.passPercent,
    date:       result.date,
  });
  localStorage.setItem('examcraft_history', JSON.stringify(history.slice(0, 50)));
}

function getHistory() {
  try { return JSON.parse(localStorage.getItem('examcraft_history') || '[]'); }
  catch { return []; }
}

function renderHistory() {
  const history = getHistory();
  const el = document.getElementById('history-list');
  if (history.length === 0) {
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">📊</div><p>Chưa có lịch sử thi nào.<br>Hãy làm bài thi đầu tiên!</p></div>`;
    return;
  }
  el.innerHTML = history.map((h, i) => `
    <div class="history-item">
      <div class="history-score-badge ${h.passed ? 'pass' : 'fail'}">${h.pct}%</div>
      <div class="history-info">
        <div class="history-name">${escHtml(h.examName)}</div>
        <div class="history-meta">
          ${h.correct}/${h.total} câu đúng
          · Thời gian: ${fmtTime(h.timeTaken)}
          · Điểm qua: ${h.passPercent}%
          · ${fmtDate(h.date)}
        </div>
      </div>
      <div class="tag ${h.passed ? 'tag-single' : 'tag-multi'}">${h.passed ? '🎉 Đạt' : '❌ Trượt'}</div>
    </div>
  `).join('');
}

function clearHistory() {
  if (!confirm('Xoá toàn bộ lịch sử thi?')) return;
  localStorage.removeItem('examcraft_history');
  renderHistory();
  toast('🗑 Đã xoá lịch sử!');
}

// ── MODAL ─────────────────────────────────────────────────────
let _modalCb = null;
function showModal(title, body, onConfirm) {
  _modalCb = onConfirm;
  let m = document.getElementById('_modal');
  if (!m) {
    m = document.createElement('div');
    m.id = '_modal';
    m.className = 'modal-backdrop';
    m.innerHTML = `<div class="modal-box">
      <div class="modal-title" id="_modal-title"></div>
      <div class="modal-body" id="_modal-body"></div>
      <div class="modal-actions">
        <button class="btn btn-secondary" onclick="closeModal()">Huỷ</button>
        <button class="btn btn-primary" onclick="confirmModal()">Xác nhận</button>
      </div>
    </div>`;
    document.body.appendChild(m);
  }
  document.getElementById('_modal-title').textContent = title;
  document.getElementById('_modal-body').textContent = body;
  m.style.display = 'flex';
}
function closeModal() {
  const m = document.getElementById('_modal');
  if (m) m.style.display = 'none';
}
function confirmModal() {
  closeModal();
  if (_modalCb) _modalCb();
}

// ── UTILS ─────────────────────────────────────────────────────
function escHtml(str) {
  return String(str || '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function fmtTime(sec) {
  const m = Math.floor(sec / 60), s = sec % 60;
  return `${m}p ${s.toString().padStart(2,'0')}s`;
}

function fmtDate(iso) {
  try {
    return new Date(iso).toLocaleDateString('vi-VN', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
  } catch { return ''; }
}

// ── FILE IMPORT ───────────────────────────────────────────────
let _parsedQuestions = []; // staging area before confirm
let _currentFileTab  = 'txt';

function showFileImport() {
  document.getElementById('file-import-modal').style.display = 'flex';
  switchFileTab('txt');
  _parsedQuestions = [];
  document.getElementById('file-parse-preview').style.display = 'none';
  document.getElementById('file-import-confirm').disabled = true;
  document.getElementById('txt-paste-area').value = '';
}

function hideFileImport() {
  document.getElementById('file-import-modal').style.display = 'none';
}

function switchFileTab(tab) {
  _currentFileTab = tab;
  ['txt','excel','word'].forEach(t => {
    document.getElementById(`ftab-content-${t}`).style.display = t === tab ? 'block' : 'none';
    document.getElementById(`ftab-${t}`).classList.toggle('ftab-active', t === tab);
  });
  document.getElementById('file-parse-preview').style.display = 'none';
  document.getElementById('file-import-confirm').disabled = true;
}

// ── TXT PARSER ────────────────────────────────────────────────
/*
  Hỗ trợ các định dạng phổ biến:

  [Dạng 1 - Số câu + đáp án dòng cuối]
  Câu 1: Nội dung câu hỏi?
  A. Đáp án A
  B. Đáp án B
  C. Đáp án C
  D. Đáp án D
  Đáp án: A

  [Dạng 2 - Không có tiêu đề câu, chỉ có câu hỏi và ABCD]
  Nội dung câu hỏi không cần "Câu X:"?
  A) Đáp án A
  B) Đáp án B
  C) Đáp án C
  D) Đáp án D
  Answer: B

  [Dạng 3 - Nhiều đáp án đúng]
  Câu 3: Các ngôn ngữ OOP?
  A. Java   B. C   C. Python   D. HTML
  Đáp án: A,C
*/
function parseTxtText(raw) {
  const questions = [];
  // Normalize line endings, split into blocks by blank line(s)
  const blocks = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
    .split(/\n{2,}/)
    .map(b => b.trim())
    .filter(b => b.length > 0);

  for (const block of blocks) {
    const lines = block.split('\n').map(l => l.trim()).filter(l => l);

    let qText = '';
    let answers = ['', '', '', '', ''];
    let correctRaw = '';

    // Find question text: first line, strip leading "Câu N:" or "Question N:"
    const rawFirstLine = lines[0].replace(/^(câu\s*\d+[\.\:\)]\s*|question\s*\d+[\.\:\)]\s*|\d+[\.\:\)]\s*)/i, '').trim();
    qText = rawFirstLine;

    // Find answer lines: match A. / A) / A- / A: / A <text> patterns, with optional * đánh dấu đáp án đúng
    const ansRe = /^\*?\s*([A-Ea-e])(?:[\.\)\-\:])?\s+(.+)/;
    const correctReLine = /\b(đáp\s*án|answer|correct|key)\s*[\:\-]\s*([A-Ea-e,\s]+)/i;

    const blockMerged = lines.join(' ').replace(/\s+/g, ' ').trim();
    const inlineRe = /(\*?)\s*([A-Ea-e])(?:[\.\)\-\:])?\s*(.+?)(?=\s+\*?[A-Ea-e](?:[\.\)\-\:])?\s+|$)/gi;
    const inlineMatches = [...blockMerged.matchAll(inlineRe)];
    const explicitCorrectMatch = blockMerged.match(correctReLine);

    if (explicitCorrectMatch) {
      correctRaw = explicitCorrectMatch[2].trim();
    }

    if (inlineMatches.length >= 2) {
      const firstMatchIndex = inlineMatches[0].index || 0;
      const questionPart = blockMerged.slice(0, firstMatchIndex).replace(/^(câu\s*\d+[\.\:\)]\s*|question\s*\d+[\.\:\)]\s*|\d+[\.\:\)]\s*)/i, '').trim();
      if (questionPart) qText = questionPart;
      inlineMatches.forEach(m => {
        const letter = m[1].toUpperCase();
        const li = letter.charCodeAt(0) - 65;
        if (li >= 0 && li <= 4) {
          answers[li] = m[2].trim();
          if (m[0].trim().startsWith('*')) {
            if (!correctRaw) correctRaw = '';
            correctRaw += `${letter},`;
          }
        }
      });
    }

    if (lines.length < 3 && inlineMatches.length < 2) continue;

    let ansIdx = 0;
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];

      // Check if it's the correct answer line
      const correctMatch = line.match(correctReLine);
      if (correctMatch) {
        correctRaw = correctMatch[2].trim();
        continue;
      }

      // Check standard answer line
      const ansMatch = line.match(ansRe);
      if (ansMatch) {
        const letterIdx = ansMatch[1].toUpperCase().charCodeAt(0) - 65;
        if (letterIdx >= 0 && letterIdx <= 4) {
          answers[letterIdx] = ansMatch[2].trim();
          if (/^\s*\*/.test(line)) {
            if (!correctRaw) correctRaw = '';
            correctRaw += `${String.fromCharCode(65 + letterIdx)},`;
          }
        }
        continue;
      }

      // Check inline answers (A. x B. y C. z D. w)
      const inlineMatches = [...line.matchAll(inlineRe)];
      if (inlineMatches.length >= 2) {
        inlineMatches.forEach(m => {
          const letter = m[1].toUpperCase();
          const li = letter.charCodeAt(0) - 65;
          if (li >= 0 && li <= 4) {
            answers[li] = m[2].trim();
            if (m[0].trim().startsWith('*')) {
              if (!correctRaw) correctRaw = '';
              correctRaw += `${letter},`;
            }
          }
        });
        continue;
      }

      // If no pattern matched and we haven't set qText continuation
      // treat extra lines as continuation of question text
      if (i === 1 && !ansMatch && !correctMatch) {
        qText += ' ' + line;
      }
    }

    // Parse correct letters
    const correct = [];
    if (correctRaw) {
      correctRaw.toUpperCase().split(/[,\s]+/).forEach(ch => {
        const ci = ch.charCodeAt(0) - 65;
        if (ci >= 0 && ci <= 4 && !correct.includes(ci)) correct.push(ci);
      });
    }

    if (!qText) continue;

    questions.push({
      text: qText,
      answers,
      correct,
      isMulti: correct.length > 1,
      _raw: block, // for error display
    });
  }

  return questions;
}

function handleFileTxt(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    document.getElementById('txt-paste-area').value = e.target.result;
    parseTxtFromTab();
  };
  reader.readAsText(file, 'UTF-8');
}

function parseTxtFromTab() {
  if (_currentFileTab === 'txt') {
    const text = document.getElementById('txt-paste-area').value;
    if (!text.trim()) { toast('⚠ Chưa có nội dung để parse', 'error'); return; }
    _parsedQuestions = parseTxtText(text);
    showParsePreview(_parsedQuestions);
  }
  // Excel/Word handle via their own handlers
}

// ── EXCEL PARSER ──────────────────────────────────────────────
/*
  Cột A: Câu hỏi
  Cột B: Đáp án A  Cột C: Đáp án B  Cột D: Đáp án C  Cột E: Đáp án D
  Cột F: Đáp án đúng (A / B / C,D / ...)
  Dòng 1 là header, data từ dòng 2
*/
function handleFileExcel(event) {
  const file = event.target.files[0];
  if (!file) return;
  const preview = document.getElementById('excel-preview');
  preview.textContent = '⏳ Đang đọc file...';

  const reader = new FileReader();
  reader.onload = e => {
    try {
      const wb = XLSX.read(e.target.result, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

      if (rows.length < 2) {
        preview.innerHTML = '<span style="color:var(--red)">File Excel không có dữ liệu (cần ít nhất 2 dòng: header + data)</span>';
        return;
      }

      // Show column mapping preview
      const header = rows[0].map(String);
      preview.innerHTML = `<div style="font-size:11px;color:var(--ink-muted);background:var(--surface);padding:8px;border-radius:6px;margin-bottom:8px;">
        Header phát hiện: ${header.map((h,i) => `<strong>Cột ${String.fromCharCode(65+i)}</strong>: ${escHtml(h||'(trống)')}`).join(' | ')}
      </div>`;

      const questions = [];
      for (let r = 1; r < rows.length; r++) {
        const row = rows[r];
        const qText = String(row[0] || '').trim();
        if (!qText) continue;
        const answers = [
          String(row[1] || '').trim(),
          String(row[2] || '').trim(),
          String(row[3] || '').trim(),
          String(row[4] || '').trim(),
        ];
        const correctRaw = String(row[5] || row[6] || '').trim();
        const correct = [];
        correctRaw.toUpperCase().split(/[,\s]+/).forEach(ch => {
          const ci = ch.charCodeAt(0) - 65;
          if (ci >= 0 && ci <= 3 && !correct.includes(ci)) correct.push(ci);
        });
        questions.push({ text: qText, answers, correct, isMulti: correct.length > 1 });
      }
      _parsedQuestions = questions;
      showParsePreview(questions);
    } catch(err) {
      preview.innerHTML = `<span style="color:var(--red)">❌ Lỗi đọc file: ${err.message}</span>`;
    }
  };
  reader.readAsArrayBuffer(file);
}

// ── WORD PARSER ───────────────────────────────────────────────
function handleFileWord(event) {
  const file = event.target.files[0];
  if (!file) return;
  const preview = document.getElementById('word-preview');
  preview.textContent = '⏳ Đang đọc file Word...';

  const reader = new FileReader();
  reader.onload = e => {
    mammoth.extractRawText({ arrayBuffer: e.target.result })
      .then(result => {
        const text = result.value;
        preview.textContent = `✅ Đã đọc ${text.length} ký tự từ file Word.`;
        // Reuse TXT parser
        _parsedQuestions = parseTxtText(text);
        showParsePreview(_parsedQuestions);
      })
      .catch(err => {
        preview.innerHTML = `<span style="color:var(--red)">❌ Không đọc được file: ${err.message}</span>`;
      });
  };
  reader.readAsArrayBuffer(file);
}

// ── PREVIEW & CONFIRM ─────────────────────────────────────────
function showParsePreview(questions) {
  const previewEl = document.getElementById('file-parse-preview');
  const statusEl  = document.getElementById('parse-status');
  const listEl    = document.getElementById('parse-preview-list');
  const confirmBtn = document.getElementById('file-import-confirm');

  if (questions.length === 0) {
    statusEl.innerHTML = '<span style="color:var(--red)">❌ Không tìm thấy câu hỏi nào. Kiểm tra lại định dạng file.</span>';
    previewEl.style.display = 'block';
    confirmBtn.disabled = true;
    return;
  }

  const ok  = questions.filter(q => q.text && q.correct.length > 0);
  const bad = questions.filter(q => !q.text || q.correct.length === 0);

  statusEl.innerHTML = `✅ Phát hiện <strong>${questions.length}</strong> câu hỏi
    — <span style="color:var(--green)">${ok.length} hợp lệ</span>
    ${bad.length > 0 ? `— <span style="color:var(--red)">${bad.length} thiếu đáp án đúng</span>` : ''}`;

  listEl.innerHTML = questions.map((q, i) => {
    const hasCorrect = q.correct.length > 0;
    const hasText    = !!q.text;
    const isOk = hasCorrect && hasText;
    return `<div class="parse-q-row ${isOk ? 'ok' : 'err'}">
      <span class="parse-q-num">C${i+1}</span>
      <span style="flex:1">${escHtml((q.text || '(thiếu câu hỏi)').slice(0,80))}${q.text?.length > 80 ? '…' : ''}</span>
      <span style="white-space:nowrap">${hasCorrect ? '✓ ' + q.correct.map(c=>'ABCD'[c]).join(',') : '⚠ chưa có đáp án'}</span>
    </div>`;
  }).join('');

  previewEl.style.display = 'block';
  confirmBtn.disabled = ok.length === 0;
}

function confirmFileImport() {
  const valid = _parsedQuestions.filter(q => q.text && q.correct.length > 0);
  if (valid.length === 0) { toast('⚠ Không có câu hỏi hợp lệ để import', 'error'); return; }

  const append = adminQuestions.length > 0
    && confirm(`Bạn đang có ${adminQuestions.length} câu hỏi. Thêm vào hay thay thế?\n\nOK = Thêm vào cuối | Cancel = Thay thế tất cả`);

  if (!append) {
    adminQuestions = [];
    document.getElementById('exam-name').value = 'Đề thi trắc nghiệm';
    document.getElementById('exam-time').value = '30';
    document.getElementById('exam-pass').value = '70';
    document.getElementById('exam-desc').value = '';
  }
  valid.forEach(q => adminQuestions.push({
    text: q.text,
    answers: q.answers,
    correct: q.correct,
    isMulti: q.isMulti,
  }));

  renderAdminQuestions();
  hideFileImport();
  toast(`✅ Đã import ${valid.length} câu hỏi!`, 'success');
  document.getElementById('export-area').style.display = 'none';
}

// ── INIT ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  showScreen('home');
});
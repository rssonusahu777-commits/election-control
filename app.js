/**
 * =============================================================
 * APP.JS — MAIN CONTROLLER
 * Orchestrates the multi-agent pipeline and UI interactions
 * =============================================================
 */

'use strict';

// ─── Global State ───────────────────────────────────────────
const AppState = {
  currentStep: 1,
  eligibilityResult: null,
  identityResult: null,
  fraudResult: null,
  faceVerified: false,
  selectedCandidate: null,
};

// ─── UI Helpers ─────────────────────────────────────────────
function showPanel(step) {
  document.querySelectorAll('.sim-panel').forEach(p => p.classList.add('hidden'));
  const panel = document.getElementById(`panel-${step}`);
  if (panel) {
    panel.classList.remove('hidden');
    panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  AppState.currentStep = step;
}

function updateProgress(completedStep) {
  for (let i = 1; i <= 4; i++) {
    const stepEl = document.getElementById(`prog-${i}`);
    const lineEl = document.getElementById(`line-${i}`);
    if (!stepEl) continue;
    stepEl.classList.remove('active', 'done');
    if (i < completedStep) {
      stepEl.classList.add('done');
      if (lineEl) lineEl.classList.add('done');
    } else if (i === completedStep) {
      stepEl.classList.add('active');
    }
  }
}

function showResult(panelId, type, message) {
  const box = document.getElementById(`result-${panelId}`);
  if (!box) return;
  box.className = `result-box ${type}`;
  box.innerHTML = message;
  box.classList.remove('hidden');
}

function blockFlow(agentName, message, details) {
  document.querySelectorAll('.sim-panel').forEach(p => p.classList.add('hidden'));
  const blocked = document.getElementById('panel-blocked');
  blocked.classList.remove('hidden');
  blocked.scrollIntoView({ behavior: 'smooth' });
  document.getElementById('blocked-msg').textContent = `${agentName} rejected your application.`;
  const detailBox = document.getElementById('blocked-detail');
  detailBox.className = 'result-box error';
  detailBox.innerHTML = `<strong>Reason:</strong> ${message}`;
}

// ─── AGENT 1: Eligibility Form Handler ──────────────────────
document.getElementById('form-eligibility').addEventListener('submit', function (e) {
  e.preventDefault();
  const ageRaw = document.getElementById('age').value;
  const age = parseFloat(ageRaw);
  const registeredState = document.getElementById('reg-state').value;
  const currentLocation = document.getElementById('current-loc').value;

  const result = EligibilityAgent.run({ age, registeredState, currentLocation });
  AppState.eligibilityResult = result;

  if (result.status === 'Eligible') {
    showResult(1, 'success',
      `✅ <strong>${result.status}</strong> — ${result.message}`
    );
    updateProgress(2);
    setTimeout(() => showPanel(2), 1200);
  } else if (result.status === 'Error') {
    showResult(1, 'error', `⚠️ <strong>Input Error:</strong> ${result.message}`);
  } else {
    showResult(1, 'error', `❌ <strong>Not Eligible:</strong> ${result.message}`);
    setTimeout(() => blockFlow('Eligibility Agent', result.message), 1500);
  }
});

// ─── OTP Simulation ─────────────────────────────────────────
function simulateSendOTP() {
  const voterId = document.getElementById('voter-id').value.trim();
  if (!voterId || voterId.length < 5) {
    document.getElementById('otp-hint').textContent = '⚠️ Enter a valid Voter ID first (min 5 chars).';
    return;
  }
  const otp = IdentityAgent.generateOTP();
  document.getElementById('otp-hint').innerHTML =
    `✅ OTP sent to registered mobile. <strong style="color:var(--gold)">Simulation OTP: ${otp}</strong>`;
  const btn = document.getElementById('send-otp-btn');
  btn.textContent = 'OTP Sent ✓';
  btn.disabled = true;
  btn.style.opacity = '0.6';
}

// ─── Face Verification Simulation ───────────────────────────
function toggleFaceVerify() {
  const box = document.getElementById('face-box');
  const icon = document.getElementById('face-icon');
  const text = document.getElementById('face-text');
  const scanLine = document.getElementById('face-scan-line');

  // Show scanning animation
  icon.textContent = '🔍';
  text.textContent = 'Scanning face...';
  scanLine.classList.remove('hidden');
  box.classList.remove('verified', 'failed');

  setTimeout(() => {
    scanLine.classList.add('hidden');
    const success = Math.random() > 0.25; // 75% success rate simulation
    AppState.faceVerified = success;
    IdentityAgent.setFaceVerified(success);
    if (success) {
      box.classList.add('verified');
      icon.textContent = '✅';
      text.textContent = 'Face verified successfully!';
      text.style.color = 'var(--success)';
    } else {
      box.classList.add('failed');
      icon.textContent = '❌';
      text.textContent = 'Face verification failed. Click to retry.';
      text.style.color = 'var(--danger)';
    }
  }, 2000);
}

// ─── AGENT 2: Identity Form Handler ─────────────────────────
document.getElementById('form-identity').addEventListener('submit', function (e) {
  e.preventDefault();
  const voterId = document.getElementById('voter-id').value.trim();
  const otp = document.getElementById('otp').value.trim();
  const faceVerified = AppState.faceVerified;

  const result = IdentityAgent.run({ voterId, otp, faceVerified });
  AppState.identityResult = result;

  if (result.verified) {
    showResult(2, 'success', `✅ <strong>Identity Confirmed</strong> — ${result.message}`);
    updateProgress(3);
    // Pre-fill voter ID in fraud panel
    setTimeout(() => showPanel(3), 1200);
  } else {
    showResult(2, 'error', `❌ <strong>Verification Failed:</strong> ${result.message}`);
    if (result.message.includes('Face') || result.message.includes('OTP') || result.message.includes('Voter ID')) {
      // Don't block immediately on correctable errors, let user retry
    } else {
      setTimeout(() => blockFlow('Identity Agent', result.message), 1500);
    }
  }
});

// ─── AGENT 3: Fraud Detection Form Handler ──────────────────
document.getElementById('form-fraud').addEventListener('submit', function (e) {
  e.preventDefault();
  const name = document.getElementById('full-name').value.trim();
  const dob = document.getElementById('dob').value;
  const state = document.getElementById('fraud-state').value;
  const voterId = document.getElementById('voter-id').value.trim(); // reuse from agent 2
  const eligibilityState = AppState.eligibilityResult?.details?.registeredState || '';

  const result = FraudDetectionAgent.run({ name, dob, state, voterId, eligibilityState });
  AppState.fraudResult = result;

  // Show analysis box
  const analysisBox = document.getElementById('fraud-analysis');
  analysisBox.className = `fraud-analysis-box ${result.riskLevel.toLowerCase()}`;
  analysisBox.classList.remove('hidden');

  const riskClass = { Low: 'risk-low', Medium: 'risk-medium', High: 'risk-high' }[result.riskLevel];
  const signalsHTML = result.signals.map(s => {
    const emoji = s.type === 'HIGH' ? '🔴' : s.type === 'MEDIUM' ? '🟡' : s.type === 'ERROR' ? '⛔' : '🟢';
    return `<div style="margin-bottom:6px;font-size:12px;color:var(--gray-400)">${emoji} ${s.reason}</div>`;
  }).join('');

  analysisBox.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
      <strong style="font-size:14px">Fraud Analysis Report</strong>
      <span class="risk-badge ${riskClass}">${result.riskLevel} Risk</span>
    </div>
    <div style="margin-bottom:12px">${signalsHTML}</div>
    <p style="font-size:12px;font-weight:600;color:${result.riskLevel === 'High' ? '#FCA5A5' : result.riskLevel === 'Medium' ? '#FCD34D' : '#86EFAC'}">${result.explanation}</p>
  `;

  if (!result.allowVoting) {
    showResult(3, 'error', `❌ <strong>Voting Blocked:</strong> ${result.explanation}`);
    setTimeout(() => blockFlow('Fraud Detection Agent', result.explanation), 1800);
  } else {
    showResult(3, 'success', `✅ <strong>${result.riskLevel} Risk</strong> — ${result.explanation}`);
    updateProgress(4);
    setTimeout(() => showPanel(4), 1500);
  }
});

// ─── EVM: Candidate Selection ────────────────────────────────
function selectCandidate(row) {
  document.querySelectorAll('.candidate-row').forEach(r => r.classList.remove('selected'));
  row.classList.add('selected');
  AppState.selectedCandidate = row.getAttribute('data-candidate');
  document.getElementById('selected-display').textContent = AppState.selectedCandidate;
}

// ─── AGENT 4: Cast Vote ──────────────────────────────────────
function castVote() {
  if (!AppState.selectedCandidate) {
    alert('Please select a candidate before casting your vote.');
    return;
  }

  const confirmed = confirm(`Confirm your vote for:\n"${AppState.selectedCandidate}"\n\nThis action cannot be undone in this simulation.`);
  if (!confirmed) return;

  const result = VotingAgent.run({
    eligibilityResult: AppState.eligibilityResult,
    identityResult: AppState.identityResult,
    fraudResult: AppState.fraudResult,
    selectedCandidate: AppState.selectedCandidate
  });

  if (result.voteStatus === 'Success') {
    document.getElementById('evm-machine').classList.add('hidden');
    const successDiv = document.getElementById('vote-success');
    successDiv.classList.remove('hidden');

    const ts = new Date(result.timestamp);
    document.getElementById('receipt-details').innerHTML = `
      <div class="receipt-row"><span class="receipt-key">Receipt ID</span><span class="receipt-val">${result.receiptId}</span></div>
      <div class="receipt-row"><span class="receipt-key">Candidate</span><span class="receipt-val" style="color:var(--white);font-family:Inter,sans-serif">${result.selectedCandidate}</span></div>
      <div class="receipt-row"><span class="receipt-key">Timestamp</span><span class="receipt-val">${ts.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST</span></div>
      <div class="receipt-row"><span class="receipt-key">Constituency</span><span class="receipt-val">Demo District (Simulation)</span></div>
      <div class="receipt-row"><span class="receipt-key">Status</span><span class="receipt-val" style="color:#86EFAC">RECORDED ✓</span></div>
    `;
    successDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
  } else {
    blockFlow('Voting Agent', result.message);
  }
}

// ─── Reset Simulation ────────────────────────────────────────
function resetSimulation() {
  AppState.currentStep = 1;
  AppState.eligibilityResult = null;
  AppState.identityResult = null;
  AppState.fraudResult = null;
  AppState.faceVerified = false;
  AppState.selectedCandidate = null;
  VotingAgent.reset();
  IdentityAgent._simulatedOTP = null;

  // Reset forms
  document.getElementById('form-eligibility').reset();
  document.getElementById('form-identity').reset();
  document.getElementById('form-fraud').reset();

  // Reset face verify
  const faceBox = document.getElementById('face-box');
  faceBox.classList.remove('verified', 'failed');
  document.getElementById('face-icon').textContent = '👤';
  const faceText = document.getElementById('face-text');
  faceText.textContent = 'Click to simulate face scan';
  faceText.style.color = '';
  document.getElementById('face-scan-line').classList.add('hidden');

  // Reset OTP btn
  const otpBtn = document.getElementById('send-otp-btn');
  otpBtn.textContent = 'Send OTP';
  otpBtn.disabled = false;
  otpBtn.style.opacity = '1';
  document.getElementById('otp-hint').textContent = 'Click "Send OTP" to receive a simulated code';

  // Reset EVM
  document.getElementById('evm-machine').classList.remove('hidden');
  document.getElementById('vote-success').classList.add('hidden');
  document.querySelectorAll('.candidate-row').forEach(r => r.classList.remove('selected'));
  document.getElementById('selected-display').textContent = 'None';

  // Reset fraud analysis
  document.getElementById('fraud-analysis').classList.add('hidden');

  // Hide result boxes
  ['result-1','result-2','result-3'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
  });

  // Reset progress
  for (let i = 1; i <= 4; i++) {
    const s = document.getElementById(`prog-${i}`);
    const l = document.getElementById(`line-${i}`);
    if (s) s.classList.remove('active', 'done');
    if (l) l.classList.remove('done');
  }
  document.getElementById('prog-1').classList.add('active');

  showPanel(1);
  document.getElementById('start').scrollIntoView({ behavior: 'smooth' });
}

// ─── Smooth scroll for nav links ─────────────────────────────
document.querySelectorAll('a[href^="#"]').forEach(link => {
  link.addEventListener('click', function (e) {
    const target = document.querySelector(this.getAttribute('href'));
    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth' });
    }
  });
});

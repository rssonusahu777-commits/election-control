/**
 * =============================================================
 * MULTI-AGENT SYSTEM — AGENT DEFINITIONS
 * Each agent is an independent module with defined:
 *   - Input schema
 *   - Processing logic
 *   - Output schema
 *   - Failure conditions
 * =============================================================
 */

'use strict';

// ─────────────────────────────────────────────────────────────
// AGENT 1: ELIGIBILITY AGENT
// Purpose: Determine if user is legally eligible to vote
// ─────────────────────────────────────────────────────────────
const EligibilityAgent = {
  name: 'Eligibility Agent',
  version: '1.0.0',

  /**
   * @param {{ age: number, registeredState: string, currentLocation: string }} input
   * @returns {{ status: string, message: string, nextStep: string, details: object }}
   */
  run(input) {
    // --- Input validation (Failure Conditions) ---
    if (!input || input.age === undefined || input.age === null || input.age === '') {
      return this._fail('Missing required input: age');
    }
    if (typeof input.age !== 'number' || isNaN(input.age)) {
      return this._fail('Invalid age format: age must be a valid number');
    }
    if (!input.registeredState || typeof input.registeredState !== 'string' || input.registeredState.trim() === '') {
      return this._fail('Missing required input: registeredState');
    }
    if (!input.currentLocation || typeof input.currentLocation !== 'string' || input.currentLocation.trim() === '') {
      return this._fail('Missing required input: currentLocation');
    }

    const { age, registeredState, currentLocation } = input;
    const stateMatch = registeredState.trim() === currentLocation.trim();

    // --- Processing Rules ---
    if (age < 18) {
      return {
        status: 'Not Eligible',
        message: `Age ${age} is below the legal voting age of 18. You are not eligible to vote.`,
        nextStep: 'Stop',
        details: { ageCheck: 'FAILED', stateCheck: stateMatch ? 'PASSED' : 'WARNING', age, registeredState, currentLocation }
      };
    }

    if (!stateMatch) {
      return {
        status: 'Not Eligible',
        message: `You are registered in "${registeredState}" but currently located in "${currentLocation}". Remote cross-state voting is not permitted in this simulation.`,
        nextStep: 'Stop',
        details: { ageCheck: 'PASSED', stateCheck: 'FAILED', age, registeredState, currentLocation }
      };
    }

    return {
      status: 'Eligible',
      message: `Age ${age} ✓ | State match: ${registeredState} ✓ — You are eligible to proceed.`,
      nextStep: 'Proceed',
      details: { ageCheck: 'PASSED', stateCheck: 'PASSED', age, registeredState, currentLocation }
    };
  },

  _fail(reason) {
    return { status: 'Error', message: reason, nextStep: 'Stop', details: { error: true } };
  }
};


// ─────────────────────────────────────────────────────────────
// AGENT 2: IDENTITY VERIFICATION AGENT
// Purpose: Simulate identity verification before voting
// ─────────────────────────────────────────────────────────────
const IdentityAgent = {
  name: 'Identity Verification Agent',
  version: '1.0.0',
  _simulatedOTP: null,        // Set when OTP is "sent"
  _faceVerified: false,       // Set by UI interaction

  /**
   * @param {{ voterId: string, otp: string, faceVerified: boolean }} input
   * @returns {{ verified: boolean, message: string, checks: object }}
   */
  run(input) {
    // --- Input validation (Failure Conditions) ---
    if (!input || !input.voterId || !input.otp) {
      return this._fail('Missing required fields: voterId and otp are required.');
    }

    const { voterId, otp, faceVerified } = input;
    const checks = {};

    // Check 1: Voter ID length (>= 5 characters)
    const voterIdValid = typeof voterId === 'string' && voterId.trim().length >= 5;
    checks.voterId = voterIdValid ? 'PASSED' : 'FAILED';
    if (!voterIdValid) {
      return { verified: false, message: 'Voter ID must be at least 5 characters long.', checks };
    }

    // Check 2: OTP verification (match with predefined simulated OTP)
    const otpValid = this._simulatedOTP !== null && otp.trim() === String(this._simulatedOTP);
    checks.otp = otpValid ? 'PASSED' : 'FAILED';
    if (!otpValid) {
      return {
        verified: false,
        message: this._simulatedOTP === null
          ? 'OTP not sent. Please click "Send OTP" first.'
          : 'Incorrect OTP. Please enter the correct code.',
        checks
      };
    }

    // Check 3: Face verification (simulated)
    checks.face = faceVerified ? 'PASSED' : 'FAILED';
    if (!faceVerified) {
      return { verified: false, message: 'Face verification failed or not completed. Please scan your face.', checks };
    }

    return {
      verified: true,
      message: `Voter ID ✓ | OTP ✓ | Face Scan ✓ — Identity confirmed for ${voterId.trim().toUpperCase()}`,
      checks
    };
  },

  generateOTP() {
    this._simulatedOTP = Math.floor(100000 + Math.random() * 900000);
    return this._simulatedOTP;
  },

  setFaceVerified(val) { this._faceVerified = val; },

  _fail(reason) {
    return { verified: false, message: reason, checks: { error: true } };
  }
};


// ─────────────────────────────────────────────────────────────
// AGENT 3: FRAUD DETECTION AGENT
// Purpose: Detect suspicious/fraudulent voter activity
// ─────────────────────────────────────────────────────────────
const FraudDetectionAgent = {
  name: 'Fraud Detection Agent',
  version: '1.0.0',

  /**
   * @param {{ name: string, dob: string, state: string, voterId: string, eligibilityState: string }} input
   * @returns {{ riskLevel: string, explanation: string, allowVoting: boolean, signals: object[] }}
   */
  run(input) {
    // --- Input validation (Failure Conditions) ---
    if (!input || !input.name || !input.dob || !input.state || !input.voterId) {
      return this._fail('Missing or malformed data. All fields are required for fraud analysis.');
    }

    const { name, dob, state, voterId, eligibilityState } = input;
    const signals = [];
    let riskScore = 0;

    // --- Signal 1: Calculate age from DOB ---
    const dobDate = new Date(dob);
    if (isNaN(dobDate.getTime())) {
      return this._fail('Invalid date of birth format.');
    }
    const today = new Date();
    let calculatedAge = today.getFullYear() - dobDate.getFullYear();
    const m = today.getMonth() - dobDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dobDate.getDate())) calculatedAge--;

    if (calculatedAge < 18) {
      signals.push({ type: 'HIGH', reason: `Age from DOB (${calculatedAge}) is below 18 — possible fraudulent registration.` });
      riskScore += 3;
    } else if (calculatedAge > 120) {
      signals.push({ type: 'HIGH', reason: 'Calculated age exceeds 120 — likely invalid DOB.' });
      riskScore += 3;
    } else {
      signals.push({ type: 'CLEAR', reason: `Age from DOB: ${calculatedAge} years — valid.` });
    }

    // --- Signal 2: Voter ID format check ---
    const voterIdPattern = /^[A-Z]{2,3}[0-9]{6,8}$/i;
    const voterIdValid = voterIdPattern.test(voterId.trim());
    if (!voterIdValid) {
      signals.push({ type: 'HIGH', reason: `Voter ID "${voterId}" does not match standard format (e.g., DL1234567).` });
      riskScore += 3;
    } else {
      signals.push({ type: 'CLEAR', reason: `Voter ID format "${voterId.toUpperCase()}" — valid format.` });
    }

    // --- Signal 3: State mismatch ---
    if (eligibilityState && state.trim() !== eligibilityState.trim()) {
      signals.push({ type: 'MEDIUM', reason: `State mismatch: Fraud form says "${state}" but eligibility check used "${eligibilityState}".` });
      riskScore += 1;
    } else {
      signals.push({ type: 'CLEAR', reason: `State consistency check: "${state}" — consistent.` });
    }

    // --- Signal 4: Name checks ---
    if (!name || name.trim().length < 3) {
      signals.push({ type: 'MEDIUM', reason: 'Name is too short or suspicious.' });
      riskScore += 1;
    }

    // --- Determine risk level ---
    let riskLevel, explanation, allowVoting;
    if (riskScore >= 3) {
      riskLevel = 'High';
      explanation = 'HIGH RISK — Multiple fraud signals detected. Voting is blocked pending manual review.';
      allowVoting = false;
    } else if (riskScore >= 1) {
      riskLevel = 'Medium';
      explanation = 'MEDIUM RISK — Some anomalies detected. Proceeding with enhanced monitoring.';
      allowVoting = true;
    } else {
      riskLevel = 'Low';
      explanation = 'LOW RISK — No significant fraud signals detected. Profile appears legitimate.';
      allowVoting = true;
    }

    return { riskLevel, explanation, allowVoting, signals, calculatedAge };
  },

  _fail(reason) {
    return { riskLevel: 'High', explanation: reason, allowVoting: false, signals: [{ type: 'ERROR', reason }] };
  }
};


// ─────────────────────────────────────────────────────────────
// AGENT 4: VOTING SIMULATION AGENT
// Purpose: Execute the voting process if all agents approve
// ─────────────────────────────────────────────────────────────
const VotingAgent = {
  name: 'Voting Simulation Agent',
  version: '1.0.0',
  _sessionVoted: false,

  /**
   * @param {{ eligibilityResult, identityResult, fraudResult, selectedCandidate: string }} input
   * @returns {{ voteStatus: string, receiptId: string|null, message: string, timestamp: string }}
   */
  run(input) {
    const { eligibilityResult, identityResult, fraudResult, selectedCandidate } = input;

    // --- Failure Condition: Multiple voting prevention ---
    if (this._sessionVoted) {
      return {
        voteStatus: 'Blocked',
        receiptId: null,
        message: 'You have already voted in this session. Multiple voting is not permitted.',
        timestamp: new Date().toISOString()
      };
    }

    // --- Failure Condition: Unauthorized access ---
    if (!eligibilityResult || !identityResult || !fraudResult) {
      return {
        voteStatus: 'Blocked',
        receiptId: null,
        message: 'Unauthorized access attempt. All verification agents must complete before voting.',
        timestamp: new Date().toISOString()
      };
    }

    // --- Gate Check: All agents must approve ---
    if (eligibilityResult.status !== 'Eligible') {
      return {
        voteStatus: 'Blocked',
        receiptId: null,
        message: `Blocked by Eligibility Agent: ${eligibilityResult.message}`,
        timestamp: new Date().toISOString()
      };
    }

    if (!identityResult.verified) {
      return {
        voteStatus: 'Blocked',
        receiptId: null,
        message: `Blocked by Identity Agent: ${identityResult.message}`,
        timestamp: new Date().toISOString()
      };
    }

    if (!fraudResult.allowVoting) {
      return {
        voteStatus: 'Blocked',
        receiptId: null,
        message: `Blocked by Fraud Detection Agent: ${fraudResult.explanation}`,
        timestamp: new Date().toISOString()
      };
    }

    // --- Failure Condition: No candidate selected ---
    if (!selectedCandidate || selectedCandidate.trim() === '') {
      return {
        voteStatus: 'Blocked',
        receiptId: null,
        message: 'No candidate selected. Please choose a candidate before casting your vote.',
        timestamp: new Date().toISOString()
      };
    }

    // --- SUCCESS: Record vote and generate receipt ---
    this._sessionVoted = true;
    const receiptId = this._generateReceiptId();
    const timestamp = new Date().toISOString();

    return {
      voteStatus: 'Success',
      receiptId,
      message: `Vote successfully recorded for "${selectedCandidate}". Receipt ID: ${receiptId}`,
      timestamp,
      selectedCandidate
    };
  },

  _generateReceiptId() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let id = 'SV-';
    for (let i = 0; i < 12; i++) {
      if (i === 4 || i === 8) id += '-';
      id += chars[Math.floor(Math.random() * chars.length)];
    }
    return id;
  },

  reset() { this._sessionVoted = false; }
};

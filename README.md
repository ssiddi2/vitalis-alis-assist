# VirtualisONE

<!DOCTYPE html>




<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Virtualis + ALIS · Ambient Medicine Demo</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');




```
    * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
    }




    :root {
        --bg-primary: #0a0a0a;
        --bg-secondary: #111111;
        --bg-tertiary: #1a1a1a;
        --text-primary: #ffffff;
        --text-secondary: #a0a0a0;
        --text-tertiary: #606060;
        --accent-critical: #ff3b30;
        --accent-warning: #ff9500;
        --accent-success: #34c759;
        --accent-info: #007aff;
        --border: rgba(255, 255, 255, 0.06);
        --border-strong: rgba(255, 255, 255, 0.12);
        --alis-gradient: linear-gradient(135deg, #0066cc 0%, #004c99 100%);
        --shadow-soft: 0 2px 16px rgba(0, 0, 0, 0.4);
        --transition-standard: 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }




    body {
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
        background: var(--bg-primary);
        color: var(--text-primary);
        line-height: 1.5;
        -webkit-font-smoothing: antialiased;
        overflow-x: hidden;
    }




    .demo-container {
        max-width: 1400px;
        margin: 0 auto;
        padding: 0;
        min-height: 100vh;
    }




    /* Top Bar */
    .top-bar {
        background: var(--bg-secondary);
        border-bottom: 1px solid var(--border);
        padding: 12px 24px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        backdrop-filter: blur(20px);
        position: sticky;
        top: 0;
        z-index: 100;
    }




    .logo {
        display: flex;
        align-items: center;
        gap: 12px;
    }




    .logo-icon {
        width: 32px;
        height: 32px;
        background: var(--alis-gradient);
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 16px;
        font-weight: 600;
        color: white;
    }




    .logo-text {
        display: flex;
        flex-direction: column;
        gap: 0;
    }




    .logo-title {
        font-size: 14px;
        font-weight: 600;
        letter-spacing: -0.01em;
    }




    .logo-subtitle {
        font-size: 10px;
        font-weight: 400;
        color: var(--text-tertiary);
        letter-spacing: 0.02em;
        text-transform: uppercase;
    }




    .controls {
        display: flex;
        gap: 12px;
        align-items: center;
    }




    .demo-selector {
        background: var(--bg-tertiary);
        border: 1px solid var(--border);
        border-radius: 8px;
        padding: 8px 16px;
        color: var(--text-primary);
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
        transition: var(--transition-standard);
    }




    .demo-selector:hover {
        border-color: var(--border-strong);
        background: rgba(255, 255, 255, 0.03);
    }




    .time-display {
        font-family: 'JetBrains Mono', monospace;
        font-size: 12px;
        color: var(--text-tertiary);
        padding: 8px 12px;
        background: var(--bg-tertiary);
        border-radius: 6px;
    }




    /* Main Layout */
    .main-layout {
        display: grid;
        grid-template-columns: 1fr 400px;
        gap: 0;
        min-height: calc(100vh - 57px);
    }




    /* Patient Card */
    .patient-card {
        background: var(--bg-secondary);
        padding: 32px;
        border-right: 1px solid var(--border);
    }




    .patient-header {
        margin-bottom: 32px;
        padding-bottom: 24px;
        border-bottom: 1px solid var(--border);
    }




    .patient-name {
        font-size: 24px;
        font-weight: 600;
        margin-bottom: 8px;
        letter-spacing: -0.02em;
    }




    .patient-meta {
        display: flex;
        gap: 24px;
        font-size: 13px;
        color: var(--text-secondary);
    }




    .patient-meta span {
        display: flex;
        align-items: center;
        gap: 6px;
    }




    /* What Matters Now */
    .matters-now {
        margin-bottom: 32px;
    }




    .section-title {
        font-size: 11px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--text-tertiary);
        margin-bottom: 16px;
    }




    .insight-card {
        background: var(--bg-tertiary);
        border: 1px solid var(--border);
        border-radius: 12px;
        padding: 20px;
        margin-bottom: 12px;
        transition: var(--transition-standard);
    }




    .insight-card.critical {
        border-color: var(--accent-critical);
        background: rgba(255, 59, 48, 0.05);
    }




    .insight-card.warning {
        border-color: var(--accent-warning);
        background: rgba(255, 149, 0, 0.05);
    }




    .insight-header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        margin-bottom: 12px;
    }




    .insight-title {
        font-size: 14px;
        font-weight: 600;
        margin-bottom: 4px;
    }




    .insight-time {
        font-size: 11px;
        color: var(--text-tertiary);
        font-family: 'JetBrains Mono', monospace;
    }




    .insight-badge {
        font-size: 10px;
        padding: 4px 8px;
        border-radius: 4px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.05em;
    }




    .insight-badge.critical {
        background: var(--accent-critical);
        color: white;
    }




    .insight-badge.warning {
        background: var(--accent-warning);
        color: var(--bg-primary);
    }




    .insight-description {
        font-size: 13px;
        line-height: 1.6;
        color: var(--text-secondary);
        margin-bottom: 12px;
    }




    .insight-sources {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-top: 12px;
    }




    .source-tag {
        font-size: 11px;
        padding: 4px 8px;
        background: rgba(255, 255, 255, 0.04);
        border: 1px solid var(--border);
        border-radius: 4px;
        color: var(--text-tertiary);
        font-family: 'JetBrains Mono', monospace;
    }




    /* Trends */
    .trends-section {
        margin-bottom: 32px;
    }




    .trend-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px 0;
        border-bottom: 1px solid var(--border);
    }




    .trend-item:last-child {
        border-bottom: none;
    }




    .trend-label {
        font-size: 13px;
        color: var(--text-secondary);
    }




    .trend-value {
        display: flex;
        align-items: center;
        gap: 8px;
    }




    .trend-number {
        font-size: 15px;
        font-weight: 600;
        font-family: 'JetBrains Mono', monospace;
    }




    .trend-direction {
        font-size: 12px;
        color: var(--accent-warning);
    }




    .trend-direction.up {
        color: var(--accent-critical);
    }




    .trend-direction.stable {
        color: var(--text-tertiary);
    }




    /* ALIS Panel */
    .alis-panel {
        background: var(--bg-primary);
        display: flex;
        flex-direction: column;
        height: calc(100vh - 57px);
    }




    .alis-header {
        padding: 24px;
        border-bottom: 1px solid var(--border);
        background: var(--alis-gradient);
    }




    .alis-title {
        font-size: 16px;
        font-weight: 600;
        margin-bottom: 4px;
        display: flex;
        align-items: center;
        gap: 8px;
    }




    .alis-status {
        font-size: 12px;
        color: rgba(255, 255, 255, 0.8);
    }




    .alis-pulse {
        width: 6px;
        height: 6px;
        background: var(--accent-success);
        border-radius: 50%;
        animation: pulse 2s ease-in-out infinite;
    }




    @keyframes pulse {
        0%, 100% { opacity: 1; transform: scale(1); }
        50% { opacity: 0.5; transform: scale(0.9); }
    }




    /* Conversation */
    .conversation {
        flex: 1;
        overflow-y: auto;
        padding: 24px;
        display: flex;
        flex-direction: column;
        gap: 16px;
    }




    .message {
        max-width: 85%;
        animation: messageSlide 0.3s ease-out;
    }




    @keyframes messageSlide {
        from {
            opacity: 0;
            transform: translateY(10px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }




    .message.alis {
        align-self: flex-start;
    }




    .message.user {
        align-self: flex-end;
    }




    .message-bubble {
        padding: 14px 16px;
        border-radius: 12px;
        font-size: 13px;
        line-height: 1.6;
    }




    .message.alis .message-bubble {
        background: var(--bg-secondary);
        border: 1px solid var(--border);
    }




    .message.user .message-bubble {
        background: var(--accent-info);
        color: white;
    }




    .message-time {
        font-size: 10px;
        color: var(--text-tertiary);
        margin-top: 6px;
        font-family: 'JetBrains Mono', monospace;
    }




    .message.alis .message-time {
        text-align: left;
    }




    .message.user .message-time {
        text-align: right;
        color: rgba(255, 255, 255, 0.6);
    }




    /* Action Buttons */
    .action-buttons {
        display: flex;
        gap: 8px;
        margin-top: 12px;
    }




    .action-btn {
        padding: 8px 14px;
        background: var(--bg-tertiary);
        border: 1px solid var(--border);
        border-radius: 8px;
        font-size: 12px;
        font-weight: 500;
        color: var(--text-primary);
        cursor: pointer;
        transition: var(--transition-standard);
    }




    .action-btn:hover {
        background: rgba(255, 255, 255, 0.05);
        border-color: var(--border-strong);
    }




    .action-btn.primary {
        background: var(--accent-info);
        border-color: var(--accent-info);
        color: white;
    }




    .action-btn.primary:hover {
        background: #0051d5;
    }




    /* Input Area */
    .input-area {
        padding: 16px 24px;
        border-top: 1px solid var(--border);
        background: var(--bg-secondary);
    }




    .input-container {
        display: flex;
        gap: 12px;
        align-items: center;
    }




    .message-input {
        flex: 1;
        background: var(--bg-tertiary);
        border: 1px solid var(--border);
        border-radius: 8px;
        padding: 10px 14px;
        color: var(--text-primary);
        font-size: 13px;
        font-family: inherit;
        outline: none;
        transition: var(--transition-standard);
    }




    .message-input:focus {
        border-color: var(--accent-info);
        background: var(--bg-primary);
    }




    .send-btn {
        padding: 10px 20px;
        background: var(--accent-info);
        border: none;
        border-radius: 8px;
        color: white;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        transition: var(--transition-standard);
    }




    .send-btn:hover {
        background: #0051d5;
    }




    .send-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }




    /* Modal */
    .modal-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.8);
        display: none;
        align-items: center;
        justify-content: center;
        z-index: 1000;
        backdrop-filter: blur(4px);
        animation: fadeIn 0.2s ease-out;
    }




    @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
    }




    .modal-overlay.active {
        display: flex;
    }




    .modal {
        background: var(--bg-secondary);
        border: 1px solid var(--border-strong);
        border-radius: 16px;
        max-width: 800px;
        width: 90%;
        max-height: 80vh;
        overflow-y: auto;
        box-shadow: var(--shadow-soft);
        animation: modalSlide 0.3s ease-out;
    }




    @keyframes modalSlide {
        from {
            opacity: 0;
            transform: translateY(20px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }




    .modal-header {
        padding: 24px 28px;
        border-bottom: 1px solid var(--border);
        display: flex;
        justify-content: space-between;
        align-items: center;
    }




    .modal-title {
        font-size: 18px;
        font-weight: 600;
    }




    .modal-close {
        width: 32px;
        height: 32px;
        border-radius: 8px;
        background: var(--bg-tertiary);
        border: 1px solid var(--border);
        color: var(--text-primary);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: var(--transition-standard);
    }




    .modal-close:hover {
        background: rgba(255, 255, 255, 0.05);
    }




    .modal-content {
        padding: 28px;
    }




    .order-item {
        background: var(--bg-tertiary);
        border: 1px solid var(--border);
        border-radius: 12px;
        padding: 16px;
        margin-bottom: 12px;
    }




    .order-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 8px;
    }




    .order-name {
        font-size: 14px;
        font-weight: 600;
    }




    .order-details {
        font-size: 12px;
        color: var(--text-secondary);
        line-height: 1.6;
    }




    .order-badge {
        font-size: 10px;
        padding: 4px 8px;
        background: rgba(0, 122, 255, 0.15);
        color: var(--accent-info);
        border-radius: 4px;
        font-weight: 600;
    }




    .modal-actions {
        padding: 20px 28px;
        border-top: 1px solid var(--border);
        display: flex;
        gap: 12px;
        justify-content: flex-end;
    }




    .modal-btn {
        padding: 10px 20px;
        border-radius: 8px;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        transition: var(--transition-standard);
    }




    .modal-btn.secondary {
        background: var(--bg-tertiary);
        border: 1px solid var(--border);
        color: var(--text-primary);
    }




    .modal-btn.secondary:hover {
        background: rgba(255, 255, 255, 0.05);
    }




    .modal-btn.approve {
        background: var(--accent-success);
        border: none;
        color: white;
    }




    .modal-btn.approve:hover {
        background: #2db04f;
    }




    /* Footer */
    .footer {
        position: fixed;
        bottom: 24px;
        left: 50%;
        transform: translateX(-50%);
        font-size: 11px;
        color: var(--text-tertiary);
        text-align: center;
        font-weight: 500;
        letter-spacing: 0.02em;
        opacity: 0;
        animation: footerFade 1s ease-in-out 2s forwards;
    }




    @keyframes footerFade {
        to { opacity: 0.6; }
    }




    /* Typing Indicator */
    .typing-indicator {
        display: flex;
        gap: 4px;
        padding: 14px 16px;
        background: var(--bg-secondary);
        border: 1px solid var(--border);
        border-radius: 12px;
        width: fit-content;
    }




    .typing-dot {
        width: 6px;
        height: 6px;
        background: var(--text-tertiary);
        border-radius: 50%;
        animation: typingBounce 1.4s ease-in-out infinite;
    }




    .typing-dot:nth-child(2) {
        animation-delay: 0.2s;
    }




    .typing-dot:nth-child(3) {
        animation-delay: 0.4s;
    }




    @keyframes typingBounce {
        0%, 60%, 100% { transform: translateY(0); }
        30% { transform: translateY(-6px); }
    }




    /* Scrollbar */
    ::-webkit-scrollbar {
        width: 8px;
    }




    ::-webkit-scrollbar-track {
        background: var(--bg-primary);
    }




    ::-webkit-scrollbar-thumb {
        background: var(--bg-tertiary);
        border-radius: 4px;
    }




    ::-webkit-scrollbar-thumb:hover {
        background: rgba(255, 255, 255, 0.15);
    }




    /* Responsive */
    @media (max-width: 1024px) {
        .main-layout {
            grid-template-columns: 1fr;
        }




        .alis-panel {
            display: none;
        }
    }
</style>
```




</head>
<body>
    <div class="demo-container">
        <!-- Top Bar -->
        <div class="top-bar">
            <div class="logo">
                <div class="logo-icon">V</div>
                <div class="logo-text">
                    <div class="logo-title">Virtualis</div>
                    <div class="logo-subtitle">Universal Clinical Layer</div>
                </div>
            </div>
            <div class="controls">
                <select class="demo-selector" id="demoMode">
                    <option value="day1">Day 1 – Admission</option>
                    <option value="day2">Day 2 – Trajectory Shift</option>
                    <option value="prevention">Prevention – Action Bundle</option>
                </select>
                <div class="time-display" id="timeDisplay">Loading...</div>
            </div>
        </div>




```
    <!-- Main Layout -->
    <div class="main-layout">
        <!-- Patient Card -->
        <div class="patient-card">
            <div class="patient-header">
                <h1 class="patient-name">Margaret Chen</h1>
                <div class="patient-meta">
                    <span>📋 MRN: 2847563</span>
                    <span>🎂 72F</span>
                    <span>📍 5 West, Bed 12</span>
                    <span>🏥 Day 2 of 3</span>
                </div>
            </div>




            <!-- What Matters Now -->
            <div class="matters-now">
                <h2 class="section-title">What Matters Now</h2>
                <div id="insightsContainer">
                    <!-- Dynamically populated -->
                </div>
            </div>




            <!-- Trends -->
            <div class="trends-section">
                <h2 class="section-title">Clinical Trends</h2>
                <div id="trendsContainer">
                    <!-- Dynamically populated -->
                </div>
            </div>
        </div>




        <!-- ALIS Panel -->
        <div class="alis-panel">
            <div class="alis-header">
                <div class="alis-title">
                    <div class="alis-pulse"></div>
                    ALIS
                </div>
                <div class="alis-status">Ambient Clinical Intelligence</div>
            </div>




            <div class="conversation" id="conversation">
                <!-- Messages appear here -->
            </div>




            <div class="input-area">
                <div class="input-container">
                    <input 
                        type="text" 
                        class="message-input" 
                        id="messageInput"
                        placeholder="Ask ALIS anything..."
                    />
                    <button class="send-btn" id="sendBtn">Send</button>
                </div>
            </div>
        </div>
    </div>
</div>




<!-- Order Review Modal -->
<div class="modal-overlay" id="orderModal">
    <div class="modal">
        <div class="modal-header">
            <h2 class="modal-title">Review Order Bundle</h2>
            <button class="modal-close" id="closeModal">✕</button>
        </div>
        <div class="modal-content" id="orderContent">
            <!-- Dynamically populated -->
        </div>
        <div class="modal-actions">
            <button class="modal-btn secondary" id="editOrders">Edit Orders</button>
            <button class="modal-btn approve" id="approveOrders">Approve & Send to EMR</button>
        </div>
    </div>
</div>




<!-- Note Review Modal -->
<div class="modal-overlay" id="noteModal">
    <div class="modal">
        <div class="modal-header">
            <h2 class="modal-title">ALIS-Assisted Progress Note</h2>
            <button class="modal-close" id="closeNoteModal">✕</button>
        </div>
        <div class="modal-content">
            <div style="background: var(--bg-tertiary); padding: 20px; border-radius: 12px; border: 1px solid var(--border); font-family: 'JetBrains Mono', monospace; font-size: 12px; line-height: 1.8; color: var(--text-secondary);">
                <div style="color: var(--text-primary); font-weight: 600; margin-bottom: 16px;">HOSPITAL DAY 2 - PROGRESS NOTE</div>
                <div style="margin-bottom: 12px;">
                    <strong style="color: var(--text-primary);">SUBJECTIVE:</strong><br/>
                    Patient reports increased shortness of breath over past 12 hours. Denies chest pain. Minimal cough production.
                </div>
                <div style="margin-bottom: 12px;">
                    <strong style="color: var(--text-primary);">OBJECTIVE:</strong><br/>
                    • O2 requirement: 2L NC → 4L NC (↑ 100% over 48h)<br/>
                    • HR trend: 78 → 94 bpm (↑ 20%)<br/>
                    • Mobility: Independent → Assist of 1 (per PT eval)<br/>
                    • Anticoagulation: Missed dose noted at 18:00 yesterday<br/>
                    • Remote history: DVT 2019 (outside records)
                </div>
                <div style="margin-bottom: 12px;">
                    <strong style="color: var(--text-primary);">ASSESSMENT:</strong><br/>
                    72F admitted for CAP now with concerning trajectory for acute PE given:<br/>
                    1. Progressive hypoxemia despite antibiotics<br/>
                    2. Tachycardia without infectious source<br/>
                    3. Reduced mobility + missed prophylaxis<br/>
                    4. Prior VTE history
                </div>
                <div>
                    <strong style="color: var(--text-primary);">PLAN:</strong><br/>
                    1. CTA chest with PE protocol - STAT<br/>
                    2. D-dimer, troponin, BNP<br/>
                    3. Lower extremity dopplers<br/>
                    4. Resume therapeutic anticoagulation pending imaging<br/>
                    5. Pulmonology consult<br/>
                    6. Hold discharge planning
                </div>
                <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--border); font-size: 10px; color: var(--text-tertiary);">
                    Note assisted by ALIS | Reviewed and approved by attending physician
                </div>
            </div>
        </div>
        <div class="modal-actions">
            <button class="modal-btn secondary" id="editNote">Edit Note</button>
            <button class="modal-btn approve" id="signNote">Sign & Commit to EMR</button>
        </div>
    </div>
</div>




<div class="footer">
    Care no longer waits to be coordinated.
</div>




<script>
    // Demo State Management
    const demoState = {
        currentMode: 'day1',
        conversations: {
            day1: [],
            day2: [],
            prevention: []
        }
    };




    // Time Display
    function updateTime() {
        const now = new Date();
        const options = { 
            weekday: 'short', 
            month: 'short', 
            day: 'numeric', 
            hour: '2-digit', 
            minute: '2-digit'
        };
        document.getElementById('timeDisplay').textContent = now.toLocaleDateString('en-US', options);
    }
    updateTime();
    setInterval(updateTime, 60000);




    // Demo Data
    const demoData = {
        day1: {
            insights: [
                {
                    title: "New Admission",
                    description: "Community-acquired pneumonia. Initial vitals stable. Started on ceftriaxone + azithromycin.",
                    time: "Day 1, 14:20",
                    badge: null,
                    sources: ["ED Report", "Admission Orders", "Initial Vitals"]
                }
            ],
            trends: [
                { label: "O₂ Requirement", value: "2L NC", direction: "stable" },
                { label: "Heart Rate", value: "78 bpm", direction: "stable" },
                { label: "Respiratory Rate", value: "18/min", direction: "stable" },
                { label: "Temperature", value: "38.2°C", direction: "stable" }
            ],
            initialMessage: {
                text: "I'm monitoring Margaret's pneumonia treatment. Initial response to antibiotics appears appropriate. I'll alert you to any concerning changes.",
                time: "Day 1, 14:45"
            }
        },
        day2: {
            insights: [
                {
                    title: "Trajectory Concern",
                    description: "Across nursing flowsheets, mobility assessments, and MAR data, I'm seeing a pattern that concerns me. Oxygen needs have doubled, heart rate is climbing, and mobility has declined—all while on appropriate antibiotics.",
                    time: "Day 2, 08:15",
                    badge: { text: "Warning", type: "warning" },
                    sources: ["Nursing Flowsheets", "PT Eval", "MAR", "Vitals Trend"]
                },
                {
                    title: "Missed Prophylaxis + History",
                    description: "Anticoagulation dose missed yesterday at 18:00. I also found a DVT in 2019 from outside records that wasn't in our current problem list.",
                    time: "Day 2, 08:20",
                    badge: { text: "Critical", type: "critical" },
                    sources: ["MAR", "Outside Records", "Problem List"]
                }
            ],
            trends: [
                { label: "O₂ Requirement", value: "4L NC", direction: "up", change: "↑ 100%" },
                { label: "Heart Rate", value: "94 bpm", direction: "up", change: "↑ 20%" },
                { label: "Mobility Status", value: "Assist of 1", direction: "down" },
                { label: "Temperature", value: "37.8°C", direction: "stable" }
            ],
            initialMessage: {
                text: "I need to share something important. I'm observing a concerning pattern in Margaret's clinical trajectory that doesn't match typical pneumonia progression. Would you like me to walk you through what I'm seeing?",
                time: "Day 2, 08:15"
            }
        },
        prevention: {
            insights: [
                {
                    title: "Action Bundle Prepared",
                    description: "Based on the trajectory analysis, I've prepared a comprehensive workup for acute PE. All orders are ready for your review and require only your approval.",
                    time: "Day 2, 08:30",
                    badge: { text: "Action", type: "warning" },
                    sources: ["Evidence Synthesis", "Clinical Guidelines", "Patient Context"]
                }
            ],
            trends: [
                { label: "VTE Risk Score", value: "High", direction: "up" },
                { label: "Wells Criteria", value: "6.5 points", direction: "up" },
                { label: "Time to Imaging", value: "STAT ordered", direction: "stable" },
                { label: "Anticoagulation", value: "Resumed", direction: "stable" }
            ]
        }
    };




    // Render Functions
    function renderInsights(mode) {
        const container = document.getElementById('insightsContainer');
        const insights = demoData[mode].insights;
        
        container.innerHTML = insights.map(insight => `
            <div class="insight-card ${insight.badge ? insight.badge.type : ''}">
                <div class="insight-header">
                    <div>
                        <div class="insight-title">${insight.title}</div>
                        <div class="insight-time">${insight.time}</div>
                    </div>
                    ${insight.badge ? `<div class="insight-badge ${insight.badge.type}">${insight.badge.text}</div>` : ''}
                </div>
                <div class="insight-description">${insight.description}</div>
                <div class="insight-sources">
                    ${insight.sources.map(source => `<span class="source-tag">${source}</span>`).join('')}
                </div>
            </div>
        `).join('');
    }




    function renderTrends(mode) {
        const container = document.getElementById('trendsContainer');
        const trends = demoData[mode].trends;
        
        container.innerHTML = trends.map(trend => `
            <div class="trend-item">
                <div class="trend-label">${trend.label}</div>
                <div class="trend-value">
                    <span class="trend-number">${trend.value}</span>
                    ${trend.change ? `<span class="trend-direction ${trend.direction}">${trend.change}</span>` : ''}
                </div>
            </div>
        `).join('');
    }




    function addMessage(text, sender, time, buttons = null) {
        const conversation = document.getElementById('conversation');
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${sender}`;
        
        let buttonHTML = '';
        if (buttons) {
            buttonHTML = `
                <div class="action-buttons">
                    ${buttons.map(btn => `
                        <button class="action-btn ${btn.primary ? 'primary' : ''}" onclick="${btn.action}">${btn.text}</button>
                    `).join('')}
                </div>
            `;
        }
        
        messageDiv.innerHTML = `
            <div class="message-bubble">${text}</div>
            <div class="message-time">${time}</div>
            ${buttonHTML}
        `;
        
        conversation.appendChild(messageDiv);
        conversation.scrollTop = conversation.scrollHeight;
    }




    function showTyping() {
        const conversation = document.getElementById('conversation');
        const typingDiv = document.createElement('div');
        typingDiv.className = 'message alis';
        typingDiv.id = 'typingIndicator';
        typingDiv.innerHTML = `
            <div class="typing-indicator">
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
            </div>
        `;
        conversation.appendChild(typingDiv);
        conversation.scrollTop = conversation.scrollHeight;
    }




    function hideTyping() {
        const typing = document.getElementById('typingIndicator');
        if (typing) typing.remove();
    }




    // Demo Mode Conversations
    function loadDay1Conversation() {
        const conv = document.getElementById('conversation');
        conv.innerHTML = '';
        
        addMessage(demoData.day1.initialMessage.text, 'alis', demoData.day1.initialMessage.time);
        
        setTimeout(() => {
            addMessage("Thanks ALIS. Let me know if anything changes.", 'user', 'Day 1, 14:50');
        }, 1000);
    }




    function loadDay2Conversation() {
        const conv = document.getElementById('conversation');
        conv.innerHTML = '';
        
        addMessage(demoData.day2.initialMessage.text, 'alis', demoData.day2.initialMessage.time, [
            { text: "Show me", action: "showDay2Analysis()", primary: true }
        ]);
    }




    function showDay2Analysis() {
        showTyping();
        setTimeout(() => {
            hideTyping();
            addMessage("Yes, walk me through it.", 'user', 'Day 2, 08:16');
            setTimeout(() => {
                showTyping();
                setTimeout(() => {
                    hideTyping();
                    addMessage(
                        "Over the past 48 hours, Margaret's oxygen requirement has doubled from 2L to 4L nasal cannula. This isn't typical for pneumonia on appropriate antibiotics.\n\nSimultaneously, her heart rate has increased 20% (78→94 bpm) without fever escalation, and PT documented reduced mobility—she now needs assist of one.\n\nI cross-referenced the MAR and found a missed anticoagulation dose yesterday. When I checked outside records, I found a DVT from 2019 that wasn't carried forward to our problem list.\n\nThese elements together suggest we may be looking at an evolving PE rather than treatment failure.", 
                        'alis', 
                        'Day 2, 08:18'
                    );
                    setTimeout(() => {
                        addMessage("What sources did you use?", 'user', 'Day 2, 08:19');
                        setTimeout(() => {
                            showTyping();
                            setTimeout(() => {
                                hideTyping();
                                addMessage(
                                    "I synthesized data from:\n• Nursing flowsheets (O₂ requirements, vital trends)\n• Physical therapy evaluation (mobility decline)\n• Medication administration record (missed dose)\n• Outside hospital records via Virtualis (prior DVT)\n• Current problem list (missing VTE history)\n• Antibiotic response timeline\n\nEvery data point is timestamped and auditable. Would you like me to prepare a workup bundle?",
                                    'alis',
                                    'Day 2, 08:20',
                                    [
                                        { text: "Yes, prepare orders", action: "prepareOrders()", primary: true },
                                        { text: "Show me sources", action: "showSources()" }
                                    ]
                                );
                            }, 1500);
                        }, 500);
                    }, 1500);
                }, 2000);
            }, 1000);
        }, 800);
    }




    function prepareOrders() {
        addMessage("Prepare the PE workup bundle", 'user', 'Day 2, 08:22');
        showTyping();
        setTimeout(() => {
            hideTyping();
            addMessage(
                "I've prepared a comprehensive PE evaluation bundle based on clinical guidelines and Margaret's specific context. The bundle includes STAT imaging, confirmatory labs, and consultations.\n\nAll orders are staged and require your approval before being sent to the EMR. Would you like to review?",
                'alis',
                'Day 2, 08:23',
                [
                    { text: "Review orders", action: "showOrderModal()", primary: true }
                ]
            );
        }, 2000);
    }




    function showSources() {
        addMessage("Show me the source documents", 'user', 'Day 2, 08:20');
        showTyping();
        setTimeout(() => {
            hideTyping();
            addMessage(
                "Here are the linked sources:\n\n📊 Nursing Flowsheet 2/6 0600-2200\n📋 PT Evaluation 2/6 1430\n💊 MAR 2/5-2/6\n🏥 Outside Records: Memorial Hospital 2019\n📝 Current Problem List (last updated 2/5)\n\nEach document is accessible through Virtualis and shows the exact timestamp and value I referenced. All changes are tracked with full audit trail.",
                'alis',
                'Day 2, 08:21'
            );
        }, 1500);
    }




    function showOrderModal() {
        const modal = document.getElementById('orderModal');
        const content = document.getElementById('orderContent');
        
        content.innerHTML = `
            <div class="order-item">
                <div class="order-header">
                    <div class="order-name">CTA Chest with PE Protocol</div>
                    <div class="order-badge">STAT</div>
                </div>
                <div class="order-details">
                    Priority: STAT | With contrast | Reason: Suspected acute PE<br/>
                    Rationale: Progressive hypoxemia + tachycardia + risk factors
                </div>
            </div>
            <div class="order-item">
                <div class="order-header">
                    <div class="order-name">Laboratory Panel</div>
                    <div class="order-badge">STAT</div>
                </div>
                <div class="order-details">
                    D-dimer, Troponin I, BNP, CBC, CMP<br/>
                    Rationale: Rule out alternative diagnoses, assess cardiac strain
                </div>
            </div>
            <div class="order-item">
                <div class="order-header">
                    <div class="order-name">Lower Extremity Doppler</div>
                    <div class="order-badge">Today</div>
                </div>
                <div class="order-details">
                    Bilateral | Reason: Evaluate for DVT source<br/>
                    Rationale: Prior VTE history, current immobility
                </div>
            </div>
            <div class="order-item">
                <div class="order-header">
                    <div class="order-name">Pulmonology Consult</div>
                    <div class="order-badge">Urgent</div>
                </div>
                <div class="order-details">
                    Request same-day evaluation<br/>
                    Rationale: Complex respiratory trajectory, possible PE management
                </div>
            </div>
            <div class="order-item">
                <div class="order-header">
                    <div class="order-name">Resume Therapeutic Anticoagulation</div>
                    <div class="order-badge">Now</div>
                </div>
                <div class="order-details">
                    Enoxaparin 1mg/kg Q12h | Hold for imaging if needed<br/>
                    Rationale: Missed dose, high clinical suspicion, prior VTE
                </div>
            </div>
        `;
        
        modal.classList.add('active');
    }




    function closeOrderModal() {
        document.getElementById('orderModal').classList.remove('active');
    }




    function approveOrders() {
        closeOrderModal();
        addMessage("Approve and send to EMR", 'user', 'Day 2, 08:25');
        showTyping();
        setTimeout(() => {
            hideTyping();
            addMessage(
                "Orders approved and transmitted to EMR at 08:25.\n\n✓ CTA Chest (STAT) - Radiology notified\n✓ Labs (STAT) - Sent to lab\n✓ LE Doppler - Scheduled 11:00 today\n✓ Pulmonology consult - Paged\n✓ Anticoagulation - Active in MAR\n\nFull audit trail created. Discharge planning automatically held. Would you like me to generate the progress note?",
                'alis',
                'Day 2, 08:26',
                [
                    { text: "Generate note", action: "showNoteModal()", primary: true }
                ]
            );
        }, 2000);
    }




    function showNoteModal() {
        document.getElementById('noteModal').classList.add('active');
    }




    function closeNoteModal() {
        document.getElementById('noteModal').classList.remove('active');
    }




    function signNote() {
        closeNoteModal();
        addMessage("Sign note and commit to EMR", 'user', 'Day 2, 08:28');
        showTyping();
        setTimeout(() => {
            hideTyping();
            addMessage(
                "Progress note signed and committed to EMR at 08:28.\n\n✓ Billing codes captured (high complexity visit)\n✓ Quality metrics documented (VTE prevention)\n✓ Audit trail complete\n✓ Care team notified\n\nI'll continue monitoring Margaret's trajectory and alert you to any changes in her clinical status or imaging results.",
                'alis',
                'Day 2, 08:29'
            );
        }, 1500);
    }




    // Mode Switching
    function switchMode(mode) {
        demoState.currentMode = mode;
        renderInsights(mode);
        renderTrends(mode);
        
        switch(mode) {
            case 'day1':
                loadDay1Conversation();
                break;
            case 'day2':
                loadDay2Conversation();
                break;
            case 'prevention':
                loadPreventionMode();
                break;
        }
    }




    function loadPreventionMode() {
        const conv = document.getElementById('conversation');
        conv.innerHTML = '';
        
        addMessage(
            "CTA results are back: Large bilateral pulmonary emboli confirmed.\n\nBecause we acted early based on trajectory analysis, Margaret is stable on therapeutic anticoagulation. Pulmonology is managing her care.\n\nWithout ambient monitoring across systems, this pattern would likely have been missed until she decompensated—possibly with catastrophic consequences.\n\nThe patient never crashed. Care no longer waits to be coordinated.",
            'alis',
            'Day 2, 14:30'
        );
    }




    // Event Listeners
    document.getElementById('demoMode').addEventListener('change', (e) => {
        switchMode(e.target.value);
    });




    document.getElementById('closeModal').addEventListener('click', closeOrderModal);
    document.getElementById('editOrders').addEventListener('click', () => {
        alert('In production, this would open EMR order editor with pre-populated fields.');
    });
    document.getElementById('approveOrders').addEventListener('click', approveOrders);




    document.getElementById('closeNoteModal').addEventListener('click', closeNoteModal);
    document.getElementById('editNote').addEventListener('click', () => {
        alert('In production, this would open EMR note editor with editable ALIS-generated content.');
    });
    document.getElementById('signNote').addEventListener('click', signNote);




    // Input handling
    document.getElementById('sendBtn').addEventListener('click', sendMessage);
    document.getElementById('messageInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });




    function sendMessage() {
        const input = document.getElementById('messageInput');
        const text = input.value.trim();
        
        if (!text) return;
        
        const now = new Date();
        const time = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        
        addMessage(text, 'user', time);
        input.value = '';
        
        // Simple response logic
        showTyping();
        setTimeout(() => {
            hideTyping();
            let response = "I can help you with that. In production, I would access real-time clinical data and provide evidence-based guidance.";
            
            if (text.toLowerCase().includes('why')) {
                response = "Every recommendation I make is backed by specific clinical data points. I synthesize information across nursing assessments, lab values, imaging, medications, and prior records—all with source attribution and timestamps.";
            } else if (text.toLowerCase().includes('source')) {
                response = "I maintain full audit trails of every data point used in my analysis. All sources are linked, timestamped, and accessible for review through Virtualis.";
            } else if (text.toLowerCase().includes('trend')) {
                response = "I track clinical trajectories by continuously analyzing data streams from all systems. I look for patterns that span time, roles, and departments—the kind of subtle changes that traditional alerts miss.";
            }
            
            addMessage(response, 'alis', time);
        }, 1500);
    }




    // Initialize
    switchMode('day1');
</script>
```




</body>
</html>

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://vitalis-alis-assist.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/2e29a090-42af-4198-bc03-522b3e857b96).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

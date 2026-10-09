# SECURIO — Security Lifecycle Intelligence

**OPCODE IMPACT 2026 | Hackathon Submission**

**Team ID:** OPCO28  
**Team Name:** SNAG

## 1. Problem Statement

Security information can become difficult to manage when configuration changes, overdue security reviews, and unresolved security issues are considered separately. A security setting that was previously checked may change later, a review may become overdue, or a known issue may remain unresolved. When these signals are scattered across different records, users may struggle to understand what requires attention and what action to take next.

SECURIO addresses this problem by bringing these security lifecycle signals into one understandable workflow.

## 2. Solution Title

**SECURIO — Security Lifecycle Intelligence**

## 3. Solution Description

SECURIO is a web-based security management prototype that combines Security Drift, Security Expiry, and Security Debt in one interface. It compares recorded security information against a saved baseline, highlights overdue security reviews, and tracks known unresolved issues. Using rule-based logic, it presents lifecycle information, explanations, risk summaries, and suggested next actions to support human review. The current prototype uses recorded and sample information rather than live connections to organizational infrastructure.

## 4. Architecture Diagram

<img width="1312" height="1199" alt="architecture" src="https://github.com/user-attachments/assets/361e2cc1-fbea-413b-afae-dbad3ddce24e" />

### Workflow

1. The user signs in and accesses the security workspace.
2. The user adds a security item, and its first submitted state is saved as the baseline.
3. When the recorded current state is updated, SECURIO compares it with the saved baseline.
4. The system checks applicable review periods and unresolved-issue information.
5. Rule-based logic generates lifecycle signals and a summary.
6. The frontend displays the results, explanations, and suggested next actions.

A detected difference is not proof of an attack; it requires investigation by a human.

## 5. Technology Stack

- **Frontend:** HTML5, CSS3, JavaScript
- **Backend:** Node.js, Express.js
- **Database:** No persistent database; in-memory JavaScript data structures are used for prototype data.
- **Other Technologies:** REST-style HTTP communication, Node.js `crypto.scrypt` for password hashing, token-based prototype sessions, Git, and GitHub.

## 6. Quick Start Guide

### Prerequisites

- Node.js and npm
- Visual Studio Code or another code editor
- A modern web browser

### Installation & Execution

Open a terminal in the project root directory, where `package.json` is located.

```bash
npm install
npm start
```

Once the server starts, open the following address in your browser:

`http://localhost:3000`

**Note:** User accounts, sessions, and security items are stored in memory and reset when the server restarts.

## 7. Output Screenshots

<img width="1901" height="867" alt="op 1" src="https://github.com/user-attachments/assets/58e6f909-b261-4ce7-bd3c-a09fe43e61df" />
<img width="1917" height="865" alt="op 2" src="https://github.com/user-attachments/assets/ff812768-5efb-487f-8e83-e6063983d547" />
<img width="1902" height="871" alt="op 3" src="https://github.com/user-attachments/assets/8e01ecb4-b6ed-4a74-b55a-965c739f8bd8" />
<img width="1901" height="867" alt="op 4" src="https://github.com/user-attachments/assets/c7d0b1b8-1a1b-4757-b264-3181571df080" />
<img width="1917" height="872" alt="op 5" src="https://github.com/user-attachments/assets/c202f429-98f1-450a-a611-8bcb3b544fbe" />

The output presents security lifecycle information, including recorded baseline differences, overdue-review indicators, unresolved issues, rule-based summaries, and suggested next actions.

## 8. Future Scope

- Integrate with authorized identity providers, device-management systems, and security platforms to retrieve live security information.
- Introduce persistent storage using PostgreSQL or MongoDB.
- Improve audit logs, change history, and security investigation records.
- Add configurable risk policies and more detailed prioritization.
- Develop carefully authorized remediation workflows with human approval and verification.

These are proposed enhancements, not claims about features already implemented in the current prototype.

## 9. Team Contributions

| Member Name | Contribution |
|---|---|
| **Gayathri Bhadra R** | Core project idea, overall system planning, backend development, security lifecycle implementation, and project integration |
| **Nandhana S** | Backend development, application functionality, security data handling, and support for system integration |
| **Alenta Abhilash** | Frontend development, user interface design, dashboard layout, and page implementation |
| **Shaleen Elza Siby** | Frontend development, UI components, dashboard presentation, and frontend functionality |

## 10. Tools Used

| Tool / Platform | Purpose / Why Used |
|---|---|
| Visual Studio Code | Writing, editing, and managing project code |
| HTML5, CSS3, JavaScript | Building the frontend interface and user interactions |
| Node.js and Express.js | Implementing backend functionality and application routes |
| Web Browser | Running and testing the application |
| Git and GitHub | Version control and project collaboration |
| ChatGPT | AI-assisted development support, debugging guidance, technical explanations, and documentation drafting |

---

**Project:** SECURIO — Security Lifecycle Intelligence  
**Event:** OPCODE IMPACT 2026  
**Team ID:** OPCO28  
**Team Name:** SNAG

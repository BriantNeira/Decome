# DecoMe — User Guide

## What is DecoMe?

DecoMe is a BDM (Business Development Manager) Reminder & AI Communications Platform. It helps BDMs manage calendar reminders per Account/Program, receive email alerts, and generate AI-assisted email communications.

## Getting Started

### Logging In

1. Navigate to `http://localhost:3000` (or the production URL)
2. Enter your email and password
3. If Two-Factor Authentication (2FA) is enabled, enter the 6-digit code from your authenticator app

### First-time Admin Setup

Default admin credentials:
- **Email**: admin@decome.app
- **Password**: Admin123!

**Important**: Change the password immediately after first login.

---

## Roles

| Role | Description |
|------|-------------|
| **Admin** | Full access: manage users, accounts, programs, branding, templates, budgets |
| **BDM** | Create/manage reminders, generate communications, view dashboard |
| **Director** | View team KPIs, export reports, AI diagnosis |

---

## Features by Phase

### Phase 1 (Current) — Foundation

#### Theme Toggle
- Click the moon/sun icon in the top-right corner to switch between **Day** and **Night** modes
- Your preference is saved automatically

#### Two-Factor Authentication (2FA)
1. Go to **Settings** from the navigation menu
2. Click **Enable 2FA**
3. Scan the QR code with an authenticator app (Google Authenticator, Authy, etc.)
4. Enter the 6-digit code to confirm and activate 2FA

To disable 2FA, go to Settings and click **Disable 2FA**, then confirm with your current authenticator code.

#### Password Reset
1. On the login page, click **Forgot your password?**
2. Enter your email address
3. Follow the link sent to your email (in development mode, the link appears in API logs)
4. Set a new password (must include: 8+ chars, uppercase, lowercase, digit, special character)

---

## Admin Features

### User Management (Admin only)
1. Navigate to **Users** in the sidebar
2. View all users with their role, status, and 2FA status
3. **Add User**: Click **+ Add User**, fill in the form, click **Create User**
4. **Change Role**: Use the dropdown in the Role column
5. **Deactivate/Activate**: Click the button in the Actions column

### Branding (Admin only)
1. Navigate to **Branding** in the sidebar
2. Upload logos for **Light** and **Dark** modes (SVG or PNG, max 2 MB)
3. Upload a **Favicon** (PNG or ICO, max 500 KB)
4. Drag and drop files onto the upload zone, or click to browse
5. Changes appear immediately across the platform

---

## Upcoming Features

The following features are planned for upcoming phases:

- **Phase 2**: Accounts, Programs, Contacts, Custom Fields
- **Phase 3**: Calendar, Reminders, BDM Dashboard
- **Phase 4**: Email Alerts (7 days / 1 day before, overdue)
- **Phase 5**: AI Communications, Templates, Token Budgets
- **Phase 6**: Knowledge Base, Customer Profiles
- **Phase 7**: Credit/Debt Tracking, Bulk Upload
- **Phase 8**: Director KPIs, Excel Export, AI Diagnosis

---

## Support

For issues or feedback: check with your system administrator or refer to the Technical Guide.

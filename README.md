# SECURIO — Security Lifecycle Intelligence

SECURIO is a hackathon prototype that treats security as a lifecycle instead of a one-time check. It connects **Security Drift**, **Security Expiry**, and **Security Debt** to explain what changed, why it matters, and what action to take.

## Included
- Sign in and user sign-up screens
- Separate user and administrator roles
- Backend-enforced role-based access: users only see their own security items; admins can see all security items
- Password hashing using Node.js `crypto.scrypt`
- Token-based prototype sessions and sign-out
- Node.js + Express REST API
- Type-specific Add Security Item form
- Warm chocolate / mauve / caramel / orange palette
- Soft, rounded serif headings inspired by the supplied Gentle font reference; readable DM Sans body text
- Overview with risk and priority actions
- Security Change Story and lifecycle view
- User-managed initial baselines: the first submitted state is copied into the baseline automatically, so a new item does not show false drift
- Update Current action: users update current item details; SECURIO compares them against the saved baseline
- Admin-only User Approvals page: admins approve or reject sign-up requests; admins do not approve each security item or drift update

## Demo admin login
- Email: `admin@securio.demo`
- Password: `SecurioAdmin!2026`

Do not use these demo credentials in a real deployment. A normal sign-up creates a pending regular account. The admin must approve it before the user can sign in; users cannot promote themselves to admin through the sign-up form.

## Run locally
1. Install Node.js.
2. Open this folder in VS Code / PowerShell.
3. Run `npm install`.
4. Run `npm start`.
5. Open `http://localhost:3000`.

## Important prototype limitations
- Users, sessions, and security items are stored in memory. They reset when the server restarts; this is for demo purposes only.
- This is not production-ready authentication. A production deployment should use a persistent database, secure cookie-based sessions or a properly managed identity provider, HTTPS, rate limiting, password reset, account verification, and audit logging.
- The demo does not automatically connect to company identity providers, devices, or APIs. Security item details and user-defined initial baselines are registered/updated by the user. Admin approval is limited to user account requests.

## Lifecycle flow
**User submits item → SECURIO saves initial state as baseline → User updates current state → Drift / Expiry / Debt → Risk → Recommended Action**

## Security item fields
- **User Access:** Employee, Department, Role, Permissions, MFA, Device
- **API Credential:** API Name, Environment, Owner, Status, Last Rotated
- **Trusted Device:** Device Name, Assigned User, OS, Encryption, Trust Status
- **Vendor Access:** Vendor, System, Access Level, Contract / Expiry, MFA
- **Database Permission:** Database, User / Service Account, Permission Level, Environment, Last Reviewed

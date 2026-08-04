> **STARTER TEMPLATE — review and adopt with legal/compliance counsel before relying on it.**

# Workforce Security & Acceptable Use Policy

**Owner:** Security Officer · **Review:** annually · HIPAA §164.308(a)(3), §164.308(a)(5), §164.310(b)–(c)

Applies to all employees, contractors, founders and any other workforce member with access to VirtualisONE systems or data.

## 1. Onboarding

1. Background screening appropriate to the role, where permitted by law.
2. Signed confidentiality agreement and written acknowledgement of this policy set.
3. HIPAA privacy and security orientation before any access to PHI.
4. Access provisioned by an administrator on the **minimum necessary** principle — accounts are created through the `admin-create-user` invitation flow; there is no self-service sign-up.
5. Hospital membership (`hospital_users`) granted only for facilities the person actually supports.

## 2. Acceptable use

- Access PHI only when required for an assigned task, and only the minimum necessary. Curiosity about a colleague, family member, public figure or oneself is a terminable violation.
- Use company-approved services only. Do not paste PHI into any external tool, AI assistant, chat application, ticket, spreadsheet or screenshot. All clinical AI use goes through the in-product ALIS features, which route exclusively to AWS Bedrock under the AWS BAA.
- Do not copy production data into demo, staging or local environments. Demos use synthetic data.
- Do not disable or work around a security control, including tenancy checks, rate limits, validation caps or the controlled-substance block.
- Do not use the ALIS voice feature with real PHI until the ElevenLabs BAA is executed.
- Report suspected security or privacy incidents to the Security Officer immediately.

## 3. Device and workstation requirements

- Full-disk encryption enabled.
- Screen lock after no more than 10 minutes of inactivity; lock the screen when leaving the device.
- Current, supported OS with automatic security updates and reputable endpoint protection.
- Strong unique passwords stored in an approved password manager; **MFA enabled on every account that supports it** — including your VirtualisONE account (TOTP enrollment is available in Security settings).
- No PHI stored locally. Work in the application; do not export to the desktop.
- Avoid untrusted public Wi-Fi for PHI access; use a trusted network or VPN.
- Report a lost or stolen device immediately so sessions and credentials can be revoked.

## 4. Remote work and physical safeguards

Position screens so PHI is not visible to others. Do not discuss patient information where it can be overheard. Store any paper containing PHI securely and shred it when no longer needed — the preference is that no PHI is ever printed.

## 5. Separation and role change

On separation or role change, on the **same day**: disable the Supabase Auth account, remove `hospital_users` memberships and administrative roles, revoke access to the source repository, secret store and cloud consoles, rotate any shared credential the person could have known, and record the actions in `audit_logs`. Deactivating an account terminates login; clinical records the person authored are retained per the [retention schedule](./data-retention.md).

## 6. Sanctions

Violations are handled proportionately: coaching and re-training for a minor first offence; written warning and access reduction for repeated or negligent violations; immediate revocation of access and termination (and, for contractors, termination of engagement) for intentional unauthorized access to PHI, disclosure of PHI, or deliberate circumvention of a security control. Sanctions are documented and retained six years.

## 7. Training

Security and privacy orientation at onboarding, with annual refreshers and ad-hoc reminders after incidents or material changes. **Gap:** a formal recurring training program with completion tracking is not yet established (see the risk analysis).

## 8. Non-retaliation

No workforce member will be retaliated against for reporting a suspected violation, incident or unsafe practice in good faith.

# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added
- TTL cache for JIT user provisioning (94% reduction in DB queries)
- `SecurityHandler` for field-level protection
- Defense-in-depth security layers (XSUAA + Handler Auth + Field Protection)
- Documentation skill for agent team
- PR requirements rule with documentation checklist

### Changed
- Reorganized documentation structure (dev docs, user guide, ADRs)
- Updated RLS visibility matrix (removed cross-org visibility for privacy)

### Fixed
- Step owner authorization check in `submitStep`
- Step owner authorization check in `respondToClarification`
- Coordinator/admin can now force-release stuck claims

### Security
- Added XSUAA roles: Requester, Approver, Viewer
- Field sanitization prevents forged fields in API calls
- Immutable fields (ownerId, coordinatorId) protected on UPDATE

---

## [1.0.0] - 2026-01-15

### Added
- Initial release of Flexible Request Management
- Dynamic form builder with 10+ field types
- Multi-step approval workflows
- Group-based assignments with claim mechanism
- Row-Level Security (RLS)
- Shadow Directory for identity management
- JIT user provisioning

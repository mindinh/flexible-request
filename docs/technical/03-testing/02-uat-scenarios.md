# UAT Test Scenarios

> **Epic:** Authorization & Roles  
> **Sprint:** 4 (Mar 3 - Mar 16)  
> **Document Type:** Business-Focused Test Cases  

---

## Test Environment Setup

Before executing UAT scenarios, ensure the following test data exists:

| Entity | Name | Members |
|--------|------|---------|
| User | Alice | alice@company.com |
| User | Bob | bob@company.com |
| User | Carol | carol@company.com |
| User | Charlie | charlie@company.com |
| User | Dave | dave@company.com |
| Group | Finance Team | Alice, Bob |
| Group | IT Support | Dave |
| Group | Operations Team | Carol |

---

## Scenario 1: Group Approval Flow

**Objective:** Verify that any member of an assigned group can approve a step.

### Steps
1. **Alice** creates a new request (Type: "Purchase Order")
2. Request auto-assigns approval to "Finance Team"
3. **Alice** submits the request
4. **Bob** (Finance Team member) logs in
5. Bob navigates to **Team Tasks** tab
6. Bob sees the pending approval
7. Bob clicks **Approve**
8. **Alice** (also Finance Team member) refreshes her Team Tasks
9. Alice no longer sees the approval (already completed by Bob)

### Expected Results
| Step | Assertion |
|------|-----------|
| 6 | Bob sees approval in "Team Tasks" |
| 7 | Approval succeeds with `decidedBy = Bob` |
| 9 | Alice does NOT see the approval |

### Pass Criteria
- [x] First group member can approve
- [x] Approval recorded with correct `decidedBy`
- [x] Other group members excluded after approval

---

## Scenario 2: Step Claim/Release (4-hour Timeout)

**Objective:** Verify that step claims expire after 4 hours of inactivity.

### Steps
1. **Alice** creates request with group-assigned data input step
2. Step is assigned to "Finance Team"
3. **Bob** claims the step at 10:00 AM
4. **Carol** tries to claim at 11:00 AM (1 hour later)
5. Carol sees error: "Step is claimed by Bob"
6. **Carol** tries to claim at 3:00 PM (5 hours later)
7. Claim succeeds (Bob's claim expired)
8. **Bob** tries to work on the step
9. Bob sees notification: "Your claim has expired"

### Expected Results
| Step | Assertion |
|------|-----------|
| 5 | Error message displayed, claim blocked |
| 7 | Claim succeeds, `claimedBy = Carol` |
| 9 | Bob notified, cannot edit |

### Pass Criteria
- [x] Active claims (< 4h) block re-claim
- [x] Expired claims (≥ 4h) allow re-claim
- [x] Original claimer notified of expiration

---

## Scenario 3: Coordinator Delegation

**Objective:** Verify that coordinators can delegate to another user or group.

### Steps
1. **Charlie** creates a request
2. Charlie is auto-assigned as coordinator
3. Charlie navigates to request detail page
4. Charlie clicks **Delegate** button
5. Dialog shows principal picker (User/Group)
6. Charlie selects **Operations Team** (GROUP)
7. Charlie confirms delegation
8. **Carol** (Operations Team member) logs in
9. Carol navigates to **Coordinating** tab
10. Carol sees the request

### Expected Results
| Step | Assertion |
|------|-----------|
| 7 | `coordinatorType = GROUP`, `coordinatorId = OperationsTeam.ID` |
| 7 | `delegatedFrom = Charlie.ID`, `delegatedAt = now()` |
| 10 | Carol sees request in Coordinating tab |

### Pass Criteria
- [x] Delegation updates coordinator fields
- [x] Delegation history recorded
- [x] All group members see in Coordinating tab

---

## Scenario 4: Inbox Tab Filtering

**Objective:** Verify that inbox tabs display correct filtered data.

### Test Data for Dave
- 2 direct USER approvals (assigned to dave@company.com)
- 3 GROUP approvals (via "IT Support" group)
- 1 request as coordinator

### Steps
1. **Dave** logs in
2. Dave navigates to **My Tasks** tab
3. Dave sees **2 items** (USER type only)
4. Dave navigates to **Team Tasks** tab
5. Dave sees **3 items** (GROUP/TEAM types)
6. Dave navigates to **Coordinating** tab
7. Dave sees **1 item**

### Expected Results
| Tab | Count | Filter Logic |
|-----|-------|--------------|
| My Tasks | 2 | `approverType = 'USER' AND approverId = Dave.ID` |
| Team Tasks | 3 | `approverType IN ('GROUP','TEAM') AND approverId IN (Dave's groups)` |
| Coordinating | 1 | `coordinatorId = Dave.ID OR coordinatorId IN (Dave's groups)` |

### Pass Criteria
- [x] Tab counts are correct
- [x] Items do not overlap between tabs
- [x] Empty tabs show "No items" message

---

## Scenario 5: DRAFT Request Privacy

**Objective:** Verify that DRAFT requests are only visible to requester and coordinator.

### Steps
1. **Alice** creates a DRAFT request (does not submit)
2. **Bob** logs in
3. Bob searches for requests
4. Bob does NOT see Alice's DRAFT request
5. Alice assigns Bob as coordinator
6. Bob refreshes request list
7. Bob NOW sees the DRAFT request

### Expected Results
| Step | Assertion |
|------|-----------|
| 4 | Bob cannot see Alice's DRAFT |
| 7 | Bob can see DRAFT after coordinator assignment |

### Pass Criteria
- [x] DRAFTs hidden from non-requester/non-coordinator
- [x] Coordinator assignment grants visibility

---

## Sign-Off

| Tester | Date | Result | Comments |
|--------|------|--------|----------|
| Business User 1 | | ⬜ Pass / Fail | |
| Business User 2 | | ⬜ Pass / Fail | |
| IT Reviewer | | ⬜ Pass / Fail | |

**Final Sign-Off:** _____________________ Date: _____________
